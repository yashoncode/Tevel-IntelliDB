<!-- markdownlint-disable -->
<p align="center">
    <img width="800" src="https://raw.githubusercontent.com/antares-sql/antares/master/docs/gh-logo.png">
</p>
<!-- markdownlint-restore -->

# Tevel IntelliDB

**An AI-first SQL client — a database engineer, not just a chat box.**

Tevel IntelliDB is a fork of the excellent [Antares SQL](https://github.com/antares-sql/antares) client, extended with a deep **Schema Intelligence Layer** and a natural-language → SQL pipeline. Ask a question in plain English; Tevel retrieves the relevant schema, writes the query, validates it for safety, and hands you a preview to review and run.

> 🔒 **Privacy first:** the AI reasons over database **metadata only** — schemas, tables, columns, keys, constraints, indexes, relationships. It **never** receives table rows, query results, or customer data.

## 🙏 Thanks to Antares

Tevel IntelliDB stands entirely on the shoulders of [**Antares SQL**](https://github.com/antares-sql/antares) by [Fabio Di Stasio](https://fabiodistasio.it/) and its [wonderful community of contributors](#contributors-).

Antares gave us a mature, battle-tested foundation that we reuse as-is — the connection manager, database drivers (MySQL/MariaDB, PostgreSQL, SQLite, Firebird), query execution, SSH/SSL tunneling, the result grid, tabs, and the database explorer. None of the AI work here would have been possible without their years of thoughtful engineering, and their commitment to a **forever 100% free and open-source** SQL client.

**Thank you, Antares team.** 💛 If you appreciate this project, please go [star the original Antares repository](https://github.com/antares-sql/antares) and [try Antares itself](https://github.com/antares-sql/antares/releases/latest) — it's a fantastic SQL client in its own right.

Tevel IntelliDB remains MIT-licensed, like Antares.

## ✨ AI features (added by Tevel)

- **Natural language → SQL** with a safe, reviewable preview — nothing runs until you say so.
- **Schema Intelligence Layer** — a deterministic table ranker, a foreign-key relationship graph with join-path finding, and a business vocabulary that understands cryptic names (`tbl_cust_hdr` → *customer header*).
- **Read-only safety gate** — blocks `INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE`, injection, and `EXPLAIN ANALYZE` unless you explicitly enable write mode.
- **Auto-repair loop** — invalid SQL is fed back to the model with the error until it validates.
- **Schema Chat** — ask questions about structure and relationships.
- **Bring your own model** — defaults to **NVIDIA NIM** (Nemotron), and works with any OpenAI-compatible endpoint: OpenAI, OpenRouter, LM Studio, Ollama.

See [`docs/tevel/`](./docs/tevel/) for the architecture map, roadmap, and implementation notes.

## 🗄️ Inherited Antares features

- Multiple simultaneous database connections.
- Full table management, including indexes and foreign keys.
- Views, triggers, stored routines, functions and schedulers management.
- Modern tab system, query history, saved queries/notes, fake data filler.
- SSH tunnel support, manual commit mode, import/export dumps.
- Customizable shortcuts, dark/light themes, editor themes.

## 🧩 Supported databases

- [x] MySQL / MariaDB
- [x] PostgreSQL
- [x] SQLite
- [x] Firebird SQL

## 🚀 Development

```bash
npm install                 # requires a C toolchain for native modules (better-sqlite3, ssh2)
npm run rebuild:electron
npm run debug               # launch the app

npm run test:ai             # AI-layer unit tests
npm run compile             # production build (main + workers + renderer)
```

## Contributors ✨

Tevel IntelliDB inherits and gratefully credits the Antares contributors below. Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://fabiodistasio.it/"><img src="https://avatars.githubusercontent.com/u/31471771?v=4?s=100" width="100px;" alt="Fabio Di Stasio"/><br /><sub><b>Fabio Di Stasio</b></sub></a><br /><a href="https://github.com/antares-sql/antares/commits?author=Fabio286" title="Code">💻</a> <a href="#translation-Fabio286" title="Translation">🌍</a> <a href="https://github.com/antares-sql/antares/commits?author=Fabio286" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.linkedin.com/in/giulioganci/"><img src="https://avatars.githubusercontent.com/u/4192159?v=4?s=100" width="100px;" alt="Giulio Ganci"/><br /><sub><b>Giulio Ganci</b></sub></a><br /><a href="https://github.com/antares-sql/antares/commits?author=toriphes" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://christianratz.de/"><img src="https://avatars.githubusercontent.com/u/2630316?v=4?s=100" width="100px;" alt="Christian Ratz"/><br /><sub><b>Christian Ratz</b></sub></a><br /><a href="https://github.com/antares-sql/antares/commits?author=digitalgopnik" title="Code">💻</a> <a href="#translation-digitalgopnik" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://reverb6821.github.io/"><img src="https://avatars.githubusercontent.com/u/55198803?v=4?s=100" width="100px;" alt="Giuseppe Gigliotti"/><br /><sub><b>Giuseppe Gigliotti</b></sub></a><br /><a href="#translation-reverb6821" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Mohd-PH"><img src="https://avatars.githubusercontent.com/u/9362157?v=4?s=100" width="100px;" alt="Mohd-PH"/><br /><sub><b>Mohd-PH</b></sub></a><br /><a href="#translation-Mohd-PH" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/hongkfui"><img src="https://avatars.githubusercontent.com/u/37477191?v=4?s=100" width="100px;" alt="hongkfui"/><br /><sub><b>hongkfui</b></sub></a><br /><a href="#translation-hongkfui" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/MrAnyx"><img src="https://avatars.githubusercontent.com/u/44176707?v=4?s=100" width="100px;" alt="Robin"/><br /><sub><b>Robin</b></sub></a><br /><a href="#translation-MrAnyx" title="Translation">🌍</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/daeleduardo"><img src="https://avatars.githubusercontent.com/u/8599078?v=4?s=100" width="100px;" alt="Daniel Eduardo"/><br /><sub><b>Daniel Eduardo</b></sub></a><br /><a href="#translation-daeleduardo" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://ngoquocdat.com/"><img src="https://avatars.githubusercontent.com/u/56961917?v=4?s=100" width="100px;" alt="Ngô Quốc Đạt"/><br /><sub><b>Ngô Quốc Đạt</b></sub></a><br /><a href="#translation-datlechin" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/IsamuSugi"><img src="https://avatars.githubusercontent.com/u/7746658?v=4?s=100" width="100px;" alt="Isamu Sugiura"/><br /><sub><b>Isamu Sugiura</b></sub></a><br /><a href="#translation-IsamuSugi" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://rsacchetto.nexxontech.it/"><img src="https://avatars.githubusercontent.com/u/18429412?v=4?s=100" width="100px;" alt="Riccardo Sacchetto"/><br /><sub><b>Riccardo Sacchetto</b></sub></a><br /><a href="#platform-Occhioverde" title="Packaging/porting to new platform">📦</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://kilianstallinger.com"><img src="https://avatars.githubusercontent.com/u/5290318?v=4?s=100" width="100px;" alt="Kilian Stallinger"/><br /><sub><b>Kilian Stallinger</b></sub></a><br /><a href="https://github.com/antares-sql/antares/commits?author=kilianstallz" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/wenj91"><img src="https://avatars.githubusercontent.com/u/12549338?v=4?s=100" width="100px;" alt="文杰"/><br /><sub><b>文杰</b></sub></a><br /><a href="https://github.com/antares-sql/antares/commits?author=wenj91" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/goYou"><img src="https://avatars.githubusercontent.com/u/62732795?v=4?s=100" width="100px;" alt="goYou"/><br /><sub><b>goYou</b></sub></a><br /><a href="#translation-goYou" title="Translation">🌍</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/raliqala"><img src="https://avatars.githubusercontent.com/u/30502407?v=4?s=100" width="100px;" alt="Topollo"/><br /><sub><b>Topollo</b></sub></a><br /><a href="https://github.com/antares-sql/antares/commits?author=raliqala" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/SmileYzn"><img src="https://avatars.githubusercontent.com/u/5851851?v=4?s=100" width="100px;" alt="Cleverson"/><br /><sub><b>Cleverson</b></sub></a><br /><a href="#translation-SmileYzn" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/fredatgithub"><img src="https://avatars.githubusercontent.com/u/6720055?v=4?s=100" width="100px;" alt="fred"/><br /><sub><b>fred</b></sub></a><br /><a href="#translation-fredatgithub" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/xak666"><img src="https://avatars.githubusercontent.com/u/38811437?v=4?s=100" width="100px;" alt="xaka_xak"/><br /><sub><b>xaka_xak</b></sub></a><br /><a href="#translation-xak666" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://codepen.io/theo-billardey"><img src="https://avatars.githubusercontent.com/u/48206778?v=4?s=100" width="100px;" alt="Théo Billardey"/><br /><sub><b>Théo Billardey</b></sub></a><br /><a href="#translation-brdtheo" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://yaskur.net"><img src="https://avatars.githubusercontent.com/u/9539970?v=4?s=100" width="100px;" alt="Muhammad Dyas Yaskur"/><br /><sub><b>Muhammad Dyas Yaskur</b></sub></a><br /><a href="#translation-dyaskur" title="Translation">🌍</a> <a href="https://github.com/antares-sql/antares/commits?author=dyaskur" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/jimcat8"><img src="https://avatars.githubusercontent.com/u/86754294?v=4?s=100" width="100px;" alt="tianci li"/><br /><sub><b>tianci li</b></sub></a><br /><a href="#translation-jimcat8" title="Translation">🌍</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/555cider"><img src="https://avatars.githubusercontent.com/u/73565447?v=4?s=100" width="100px;" alt="555cider"/><br /><sub><b>555cider</b></sub></a><br /><a href="#translation-555cider" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/m1khal3v"><img src="https://avatars.githubusercontent.com/u/41085561?v=4?s=100" width="100px;" alt="Anton Mikhalev"/><br /><sub><b>Anton Mikhalev</b></sub></a><br /><a href="#translation-m1khal3v" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://64k.nl/"><img src="https://avatars.githubusercontent.com/u/3864423?v=4?s=100" width="100px;" alt="René"/><br /><sub><b>René</b></sub></a><br /><a href="https://github.com/antares-sql/antares/commits?author=64knl" title="Code">💻</a> <a href="#translation-64knl" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/zxp19821005"><img src="https://avatars.githubusercontent.com/u/4915850?v=4?s=100" width="100px;" alt="Woodenman"/><br /><sub><b>Woodenman</b></sub></a><br /><a href="#platform-zxp19821005" title="Packaging/porting to new platform">📦</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/markusand"><img src="https://avatars.githubusercontent.com/u/12972543?v=4?s=100" width="100px;" alt="Marc Vilella"/><br /><sub><b>Marc Vilella</b></sub></a><br /><a href="#translation-markusand" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Lawondyss"><img src="https://avatars.githubusercontent.com/u/272130?v=4?s=100" width="100px;" alt="Ladislav Vondráček"/><br /><sub><b>Ladislav Vondráček</b></sub></a><br /><a href="#translation-Lawondyss" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/zvlad"><img src="https://avatars.githubusercontent.com/u/9055134?v=4?s=100" width="100px;" alt="Vladyslav"/><br /><sub><b>Vladyslav</b></sub></a><br /><a href="#translation-zvlad" title="Translation">🌍</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/bagusindrayana"><img src="https://avatars.githubusercontent.com/u/36830534?v=4?s=100" width="100px;" alt="Bagus Indrayana"/><br /><sub><b>Bagus Indrayana</b></sub></a><br /><a href="https://github.com/antares-sql/antares/commits?author=bagusindrayana" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/penguinlab"><img src="https://avatars.githubusercontent.com/u/10959317?v=4?s=100" width="100px;" alt="Naoki Ishikawa"/><br /><sub><b>Naoki Ishikawa</b></sub></a><br /><a href="#translation-penguinlab" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://fazevedo.dev"><img src="https://avatars.githubusercontent.com/u/1640325?v=4?s=100" width="100px;" alt="Filipe Azevedo"/><br /><sub><b>Filipe Azevedo</b></sub></a><br /><a href="https://github.com/antares-sql/antares/commits?author=mangas" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/zwei-c"><img src="https://avatars.githubusercontent.com/u/55912811?v=4?s=100" width="100px;" alt="CHANG, CHIH WEI"/><br /><sub><b>CHANG, CHIH WEI</b></sub></a><br /><a href="#translation-zwei-c" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/mirrorb"><img src="https://avatars.githubusercontent.com/u/34116207?v=4?s=100" width="100px;" alt="GaoChun"/><br /><sub><b>GaoChun</b></sub></a><br /><a href="https://github.com/antares-sql/antares/commits?author=mirrorb" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/LeviEyal"><img src="https://avatars.githubusercontent.com/u/48846533?v=4?s=100" width="100px;" alt="Eyal Levi"/><br /><sub><b>Eyal Levi</b></sub></a><br /><a href="#translation-LeviEyal" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://telegram.dog/SawGoD"><img src="https://avatars.githubusercontent.com/u/67802757?v=4?s=100" width="100px;" alt="Nikita Karelikov"/><br /><sub><b>Nikita Karelikov</b></sub></a><br /><a href="#translation-SawGoD" title="Translation">🌍</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/carvalhods"><img src="https://avatars.githubusercontent.com/u/6569255?v=4?s=100" width="100px;" alt="David Carvalho"/><br /><sub><b>David Carvalho</b></sub></a><br /><a href="#platform-carvalhods" title="Packaging/porting to new platform">📦</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/r4f4dev"><img src="https://avatars.githubusercontent.com/u/65920592?v=4?s=100" width="100px;" alt="r4f4dev"/><br /><sub><b>r4f4dev</b></sub></a><br /><a href="#translation-r4f4dev" title="Translation">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/salvymc"><img src="https://avatars.githubusercontent.com/u/10051897?v=4?s=100" width="100px;" alt="Salvatore Forino"/><br /><sub><b>Salvatore Forino</b></sub></a><br /><a href="https://github.com/antares-sql/antares/commits?author=salvymc" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://gadev.com.es/"><img src="https://avatars.githubusercontent.com/u/16820141?v=4?s=100" width="100px;" alt="José González"/><br /><sub><b>José González</b></sub></a><br /><a href="#translation-JoseGonzalez84" title="Translation">🌍</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. The contributors above are from the upstream [Antares SQL](https://github.com/antares-sql/antares) project — all credit to them.
