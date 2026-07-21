# Tevel IntelliDB

**An AI-first SQL client — a database engineer, not just a chat box.**

Ask a question in plain English; Tevel retrieves the relevant schema, writes the query, validates it for safety, and hands you a preview to review and run.

> 🔒 **Privacy first:** the AI reasons over database **metadata only** — schemas, tables, columns, keys, constraints, indexes, relationships. It **never** receives table rows, query results, or customer data.

## ✨ AI features

- **Natural language → SQL** with a safe, reviewable preview — nothing runs until you say so.
- **Schema Intelligence Layer** — a deterministic table ranker, a foreign-key relationship graph with join-path finding, and a business vocabulary that understands cryptic names (`tbl_cust_hdr` → *customer header*).
- **Read-only safety gate** — blocks `INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE`, injection, and `EXPLAIN ANALYZE` unless you explicitly enable write mode.
- **Auto-repair loop** — invalid SQL is fed back to the model with the error until it validates.
- **Schema Chat** — ask questions about structure and relationships.
- **Bring your own model** — defaults to **NVIDIA NIM** (Nemotron), and works with any OpenAI-compatible endpoint: OpenAI, OpenRouter, LM Studio, Ollama.

See [`docs/tevel/`](./docs/tevel/) for the architecture map, roadmap, and implementation notes.

## 🧩 Supported databases

MySQL / MariaDB · PostgreSQL · SQLite · Firebird SQL

## 🚀 Development

```bash
npm install                 # requires a C toolchain for native modules (better-sqlite3, ssh2)
npm run rebuild:electron
npm run debug               # launch the app

npm run test:ai             # AI-layer unit tests
npm run compile             # production build (main + workers + renderer)
```

## 🙏 Built on Antares

Tevel IntelliDB is a fork of [**Antares SQL**](https://github.com/antares-sql/antares) by [Fabio Di Stasio](https://fabiodistasio.it/) and its community. Antares provides the mature foundation we reuse — connection manager, database drivers, query execution, SSH/SSL tunneling, result grid, tabs, and the database explorer. **Thank you, Antares team.** 💛 Please [star the original repo](https://github.com/antares-sql/antares).

MIT licensed, like Antares.
