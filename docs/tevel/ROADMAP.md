# Tevel IntelliDB — Implementation Roadmap

> Fork of Antares SQL → AI-first SQL IDE. Design doc. **No code until you approve the decision log below.**
> Companion: [ANTARES-MAP.md](./ANTARES-MAP.md) (cached architecture — read that first, saves re-scanning).

---

## 0. Decision log — LOCKED 2026-07-21

- **D1 = A. Keep Vue 3.** Add AI as new Vue components; reuse 100% of Antares. No React rewrite.
- **D2 = Ranker-first, no LangGraph.** Deterministic ranker → local embeddings behind a flag for huge schemas only. Pipeline = typed TS state machine. No Python.
- **D3 = Nemotron default** on NVIDIA NIM; small 8B for intent routing; model is a setting; validate via eval harness (T0.4).

Original tradeoff analysis retained below for the record.

### DECISION 1 (BLOCKING) — Frontend framework

The spec wants **React 19 + Vite + Tailwind + shadcn + Zustand**. Antares is **Vue 3 + Webpack + Pinia + SCSS**.

You cannot both "reuse Antares' result grid / tabs / database explorer" **and** rewrite the UI in React — those components *are* Vue SFCs. But the parts you actually named as valuable (connection manager, drivers, query execution, SSH, SSL, workers) live in `src/main` and are **plain TypeScript, framework-agnostic — reusable no matter what the UI is.**

| Option | Reuse | Effort to first AI feature | Verdict |
|--------|-------|---------------------------|---------|
| **A. Keep Vue** — add AI as Vue components/panels | Everything (100%) | ~1 week | ✅ **Recommended.** Lazy, ships fast, honors "don't rewrite from scratch." |
| **B. React shell + embed reused Vue** | main + some UI | high, brittle | ❌ Two frameworks in one renderer = permanent pain. |
| **C. Full React rewrite of renderer** | main + common only | months | ⚠️ This is "reuse Antares' backend," NOT "fork Antares." Throws away the mature grid/tabs/explorer. Only pick if a React UI is a hard product requirement. |

**My call: A.** The AI IDE differentiator is the *intelligence layer + UX flow*, not React-vs-Vue. Modern glass UI is fully achievable in Vue 3. If you later want React, do it as a separate milestone once the AI layer proves out — don't pay that tax up front.

### DECISION 2 — Retrieval: vector DB / embeddings / LangGraph

Spec says embeddings + vector search + LangGraph for "10,000+ tables."

- The full schema graph is **already in memory** (`workspaces.structure`). For the common case (< ~500 tables) a deterministic ranker (name/comment/FK/keyword match) retrieves relevant tables in <1ms — **no embeddings, no vector store, no network.**
- Embeddings only earn their cost past a few thousand tables. Plan: **local** embeddings (transformers.js + `sqlite-vec`, on-device, metadata only) behind a feature flag, activated only for large schemas.
- **LangGraph is Python.** This is a TS/Electron app. Adding a Python runtime for graph orchestration is a large deployment liability. The Vercel AI SDK + a small typed state machine covers the whole pipeline in-process.

**My call:** Deterministic ranker first → local embeddings behind a flag for huge schemas → **no LangGraph.**

### DECISION 3 — Default LLM (NVIDIA NIM: Llama vs Nemotron)

For text-to-SQL + schema reasoning + strict instruction-following (never leak data, output only SQL):
- **Nemotron** (NVIDIA's reasoning/instruction-tuned Llama derivatives) generally beats base **Llama** on reasoning & instruction adherence — the traits that matter most here.
- **My call:** Nemotron as default generator; a small/fast model (e.g. an 8B) for cheap intent-detection/routing. Make the model a setting. Validate against a local SQL eval set before locking it in — treat this as tuned, not assumed.

---

## Architecture (target, assuming Decision 1 = A)

```
User NL question
  → [main] AI IPC handler
  → Schema Intelligence Layer (reads workspaces.structure — metadata only, never rows)
      · ranker: pick relevant tables/columns/FKs
      · business vocabulary: tbl_cust_hdr → "Customer"
      · relationship graph: Customer→Order→Invoice→Payment
      · prompt builder (token-budgeted)
  → LLM provider (NIM default; OpenAI-compatible interface)
  → SQL parser → validator (read-only unless write-mode) → auto-repair loop
  → Preview (never auto-run)
  → User clicks Execute → existing Antares query path
```

**Safety invariant (enforced in code + tested):** the AI layer's input is derived *only* from the metadata interfaces in ANTARES-MAP.md. There is no code path from query results / row data to the LLM. This is a unit-tested boundary, not a convention.

---

## Phased roadmap — small, independently reviewable tasks

Each task is one PR-sized unit with a clear done-check. `[core]` = must-have MVP.

### Phase 0 — Foundation (½ week)
- **T0.1** `[core]` Add `docs/tevel/` (done) + `AGENTS`/`CLAUDE.md` note pointing here.
- **T0.2** `[core]` Rename/branding scaffold: product name, ids — no logic change.
- **T0.3** `[core]` Add AI settings store slice (provider, baseURL, apiKey, model, write-mode default off). Persist via existing `electron-store`.
- **T0.4** Add local eval harness stub (SQL question → expected-shape) for Decision 3.

### Phase 1 — LLM plumbing (1 week)
- **T1.1** `[core]` `AiProvider` interface (OpenAI-compatible: `chat`, `stream`). One impl: NIM. Lives in `src/main`.
- **T1.2** `[core]` IPC: `ai.ts` handler + `ipc-api/Ai.ts` wrapper (streaming via existing IPC pattern).
- **T1.3** `[core]` Minimal chat panel (Vue) — send text, stream markdown reply. No schema yet. Proves the pipe.
- **T1.4** Provider settings UI + connection test button.

### Phase 2 — Schema Intelligence Layer (2 weeks) — the heart
- **T2.1** `[core]` `SchemaSnapshot` adapter: read `workspaces.structure` → normalized metadata object. **Unit test the no-row-data boundary.**
- **T2.2** `[core]` Deterministic table ranker (name/comment/FK/keyword). Test: given a question + schema, returns ranked tables.
- **T2.3** `[core]` Relationship graph builder from `TableForeign[]` (traversable joins). Test: known FK chain resolves.
- **T2.4** `[core]` Token-budgeted prompt builder (schema DDL-ish text for top-N tables). Test: respects budget.
- **T2.5** Business vocabulary map (`tbl_cust_hdr`→Customer) + user-editable aliases store. Test: alias resolution.
- **T2.6** Join predictor (suggest join path between two tables via graph). Test: shortest-path join.
- **T2.7** *(flagged, large-schema only)* Local embeddings + `sqlite-vec` retrieval. Skip unless a real DB forces it.

### Phase 3 — SQL pipeline (1.5 weeks)
- **T3.1** `[core]` SQL parser/classifier (statement type). Reuse Antares parsers if present, else lightweight.
- **T3.2** `[core]` Read-only validator: allow SELECT/WITH/EXPLAIN/SHOW/DESCRIBE; reject DML/DDL/EXEC/CALL unless write-mode. **Heavily tested — this is a safety gate.**
- **T3.3** `[core]` Auto-repair loop: on validation/parse fail, feed error back to LLM (bounded retries).
- **T3.4** `[core]` NL→SQL end-to-end: question → schema retrieval → prompt → LLM → validate → repair → **preview** (editable, not executed).
- **T3.5** `[core]` "Execute" button wires preview → existing Antares query execution + result grid.

### Phase 4 — AI DB-engineer features (2 weeks)
- **T4.1** Explain SQL. **T4.2** Optimize SQL. **T4.3** Fix SQL (uses repair loop).
- **T4.4** Schema Chat (Q&A over metadata graph). **T4.5** Relationship Explorer view.
- **T4.6** Prompt library / saved prompts / favorites (reuse `history`/`scratchpad` store patterns).

### Phase 5 — Polish & scale (ongoing)
- ER diagram, execution plans / cost analysis (from existing EXPLAIN), schema watcher (invalidate cache on DDL), workspace memory, modern glass UI pass.
- Providers: OpenAI, Anthropic, OpenRouter, LM Studio, Ollama (all OpenAI-compatible → mostly config).

---

## Non-negotiable engineering rules (per spec)
- Strict TS on all **new** code (don't boil the ocean migrating TS 4.6 → strict everywhere; tighten touched files).
- Feature-first folders under `src/renderer/ai/` and `src/main/ai/`. SOLID, no speculative abstractions (ponytail).
- Every safety-critical unit (validator, no-row-data boundary) has tests. No commits unless you ask; **never** co-authored.
- Reuse Antares stores/patterns over new infra.

## Status — Phases 0–4 core IMPLEMENTED (2026-07-21)

Built in Vue, reusing all of Antares' backend. See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for the file map + how to run.

| Task | State |
|------|-------|
| T0.3 AI settings (persisted) | ✅ `src/renderer/stores/ai.ts` |
| T1.1 Provider (OpenAI-compatible / NIM) | ✅ `src/main/libs/ai/providers/` |
| T1.2 AI IPC handler + wrapper | ✅ `src/main/ipc-handlers/ai.ts`, `src/renderer/ipc-api/Ai.ts` |
| T1.3 Chat + NL→SQL panel | ✅ `src/renderer/components/TheAiAssistant.vue` |
| T2.1 Snapshot / no-row-data boundary | ✅ `SchemaSnapshot.ts` (tested) |
| T2.2 Deterministic ranker | ✅ `TableRanker.ts` (tested) |
| T2.3 Relationship graph + join path | ✅ `RelationshipGraph.ts` (tested) |
| T2.4 Token-budgeted prompt builder | ✅ `PromptBuilder.ts` |
| T2.5 Business vocabulary + aliases | ✅ `BusinessVocabulary.ts` (tested) |
| T3.2 Read-only validator | ✅ `SqlValidator.ts` (tested, safety gate) |
| T3.3 Auto-repair loop | ✅ `NlToSqlPipeline.ts` (tested) |
| T3.4 NL→SQL end-to-end + preview | ✅ pipeline + panel |
| T3.5 "Open in editor" (reuses Antares exec) | ✅ `aiStore.sendToEditor` → `newTab` |
| T4.1–4.3 Explain / optimize / fix | ✅ `ai:explain-sql` handler (UI: explain wired via chat; buttons = follow-up) |
| T4.4 Schema chat | ✅ panel "Schema Chat" mode |
| **Tests** | ✅ 27 unit tests, `npm run test:ai` |

### Deliberate deferrals (ponytail)
- **Streaming responses** — non-streaming works and is testable; add IPC event streaming when the UX needs it.
- **T2.6 join predictor UI**, **T2.7 embeddings** — graph exists; embeddings only for >few-thousand-table schemas, flag-gated later.
- **Explain/Optimize buttons in a query tab** — handler exists (`ai:explain-sql`); wire toolbar buttons in QueryEditor next.
- **Markdown rendering** in chat — plain pre-wrap for now; add `marked` if richer formatting is wanted.
- **Anthropic provider** — one OpenAI-compatible client covers NIM/OpenAI/OpenRouter/LMStudio/Ollama; add Anthropic wire format when needed.
- **ER diagram, exec-plan/cost UI, prompt library** — Phase 5.

### Known environment issue
`npm install` fails building native modules (`cpu-features`, `better-sqlite3`, …) — no C toolchain on this machine. JS deps installed via `--omit=optional --ignore-scripts`, enough to typecheck + run `test:ai` + webpack-build. Running the full Electron app needs Visual Studio Build Tools + `npm run rebuild:electron`.
