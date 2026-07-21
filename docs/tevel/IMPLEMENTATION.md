# Tevel IntelliDB — Implementation (Phases 0–4 core)

AI-first layer built on top of Antares (Vue 3), reusing all of its backend. Metadata-only.

## File map

### Shared
- [src/common/interfaces/ai.ts](../../src/common/interfaces/ai.ts) — all AI types. Includes `RawColumnMeta`/`RawKeyUsageMeta` (the only shapes the core reads from drivers), so the AI core stays decoupled from the Antares driver type graph.

### Main process — AI core (pure TS, unit-tested)
- `src/main/libs/ai/sql/SqlValidator.ts` — **read-only safety gate**. Allows SELECT/WITH/EXPLAIN/SHOW/DESCRIBE; blocks DML/DDL/CALL/multi-statement injection/`EXPLAIN ANALYZE` unless write-mode. Errs toward blocking.
- `src/main/libs/ai/schema-intelligence/`
  - `SchemaSnapshot.ts` — **no-row-data boundary**: builds AI metadata objects by explicit field whitelist. Row data cannot pass through.
  - `TableRanker.ts` — deterministic retriever (name/comment/vocabulary overlap). No embeddings.
  - `RelationshipGraph.ts` — FK graph + BFS join-path finder.
  - `BusinessVocabulary.ts` — `tbl_cust_hdr` → "customer header"; user aliases override.
  - `PromptBuilder.ts` — token-budgeted schema context + rules.
- `src/main/libs/ai/providers/` — `AiProvider` interface + `createProvider` factory + `OpenAiCompatibleProvider` (NIM/OpenAI/OpenRouter/LMStudio/Ollama via `fetch`, no SDK).
- `src/main/libs/ai/pipeline/NlToSqlPipeline.ts` — rank → enrich → prompt → LLM → validate → **auto-repair** → result. Decoupled from Electron via an `enrich` callback.
- `src/main/ipc-handlers/ai.ts` — IPC: `ai:generate-sql`, `ai:chat`, `ai:explain-sql`, `ai:test-connection`, `ai:validate-sql`. Enriches retrieved tables via the DB client's **metadata methods only** (`getTableColumns`, `getKeyUsage`) — never `getTableData`.

### Renderer
- `src/renderer/ipc-api/Ai.ts` — IPC wrapper.
- `src/renderer/stores/ai.ts` — Pinia store: persisted settings + chat/generation state; reads active workspace to assemble the table list; `sendToEditor` pushes generated SQL into a new query tab (reuses Antares' editor + execution + grid).
- `src/renderer/components/TheAiAssistant.vue` — right-side drawer: NL→SQL + Schema Chat + settings.
- Wiring: `stores/application.ts` (`isAiAssistant`), `App.vue` (mount), `TheSettingBar.vue` (launch button).

## Default LLM
NVIDIA NIM, model `nvidia/nemotron-3-ultra-550b-a55b` (reasoning). Base URL `https://integrate.api.nvidia.com/v1`.
Reasoning ("thinking") is on by default → sends `chat_template_kwargs.enable_thinking` + `reasoning_budget` (default 8192). Toggle + model + key are editable in the panel's Settings and persist via `electron-store`.

## Safety invariant
The AI layer's only inputs are the metadata interfaces above. There is **no code path** from query results / row data to the LLM. Locked by `SchemaSnapshot` (whitelist) + the handler calling metadata methods exclusively. Tested in `tests/ai/SchemaIntelligence.test.ts`.

## Run
```
npm run test:ai          # 27 unit tests (validator, ranker, graph, boundary, vocab, pipeline)
npm run compile:renderer # webpack build renderer
npm run compile:main     # webpack build main
```
Full Electron app: needs native modules rebuilt — install Visual Studio Build Tools, then
`npm install && npm run rebuild:electron && npm run debug`. (This machine lacks a C toolchain,
so native deps — cpu-features/better-sqlite3 — could not be built here; JS deps installed with
`--omit=optional --ignore-scripts`.)

## Next increments (not yet built)
Streaming responses (matters for the 550B reasoning model latency), Explain/Optimize buttons in the query toolbar, ER diagram, embeddings for >few-thousand-table schemas (flag-gated), Anthropic provider, richer markdown in chat.
