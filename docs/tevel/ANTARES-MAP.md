# Antares Architecture Map (cache — do not re-scan)

> Purpose: persistent memory of the forked Antares codebase so we don't re-explore
> and re-spend tokens each session. Antares v0.7.35. Verified 2026-07-21.

## Three-layer structure

| Layer | Path | Runtime | Framework | Reusable for AI? |
|-------|------|---------|-----------|------------------|
| **common** | `src/common` | shared | plain TS | ✅ types, data-types, libs |
| **main** | `src/main` | Electron main + workers | plain TS (Node) | ✅✅ THE valuable layer — framework-agnostic |
| **renderer** | `src/renderer` | Electron renderer | **Vue 3 + Pinia + SCSS** | ⚠️ UI is Vue SFCs |

## Build & stack (ACTUAL)
- **Vue 3.4** (Options + Composition API), **Pinia 2.1**, **vue-i18n 9**
- **Webpack 5** (`webpack.main/renderer/workers.config.js`) — NOT Vite
- **TypeScript 4.6** — NOT strict-latest
- Electron 30, SCSS. ESLint + stylelint.
- ⛔ Spec asked for React 19 + Vite + Tailwind + shadcn + Zustand + TanStack. FULL frontend mismatch — see ROADMAP decision log.

## main layer (reuse as-is, framework-agnostic)
- `libs/clients/` — **DB drivers**: `BaseClient.ts` (query builder + metadata methods), `MySQLClient`, `PostgreSQLClient`, `SQLiteClient`, `FirebirdSQLClient`. Clients: `mysql | maria | pg | sqlite | firebird`.
- `ipc-handlers/` — IPC surface: `connection, database, schema, tables, views, functions, routines, triggers, schedulers, users, application, updates`.
- `libs/` — `exporters/`, `importers/`, `parsers/`, `misc/` (incl. SSH/SSL handling).
- `workers/` — background query execution.

## Metadata model — ALREADY COMPLETE (`src/common/interfaces/antares.ts`, 422 lines)
The spec's "AI must know" list is **already extracted** by Antares:
- `SchemaInfos` → `{ name, size, tables[], functions[], procedures[], triggers[], schedulers[] }`
- `TableInfos` → `{ name, type, rows, engine, comment, size, collation, autoIncrement }`
- `TableField` → name, type, precision/scale/length, nullable, unsigned, default, enumValues, charset, collation, autoIncrement, comment, **key: 'pri'|'uni'|''**
- `TableForeign` → constraintName, refSchema, table, refTable, field, refField, onUpdate, onDelete
- `TableIndex`, `TableCheck`, `RoutineInfos`, `FunctionInfos`, `TriggerInfos`, `EventInfos`, `CollationInfos`
- ⇒ **We do NOT need to build a "Metadata Extractor" from scratch.** Consume `getStructure`.

## How the full schema graph is loaded (already in memory!)
- IPC: `ipcMain.handle('get-structure', ...)` → `connections[uid].getStructure(schemas)` (`ipc-handlers/schema.ts:70`).
- Renderer: `stores/workspaces.ts` holds `structure: WorkspaceStructure[]` per connection.
  - `refreshStructure(uid)` / `refreshSchema({uid, schema})` populate it via `Schema.getStructure`.
- ⇒ The complete schema graph (schemas→tables→columns→FKs→indexes→routines) is **already a live in-memory object**. The Schema Intelligence Layer reads THIS, no new extraction pipeline needed.

## Renderer state (Pinia stores)
`application, connections, console, history, notifications, schemaExport, scratchpad, settings, workspaces`

## IPC pattern
- main: `ipcMain.handle('verb-noun', async (event, params) => {...})` returns `{ status: 'success'|'error', response }` (`IpcResponse<T>`).
- renderer: thin wrappers in `src/renderer/ipc-api/*.ts`.
- ⇒ New AI features follow the SAME pattern: add `ai.ts` ipc-handler + `ipc-api/Ai.ts` wrapper. Metadata never leaves main unless we send it.
