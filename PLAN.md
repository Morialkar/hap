# Heritage Archives Patrimoine (HAP) — Platform Plan (rev. 3 — "The Pivot")

> Product name: **Heritage Archives Patrimoine (HAP)** — bilingual by construction
> (D13 ✅). Repo directory remains `~/Literary-Heritage-Archive` until renaming is
> convenient; "Literary Catalog" stays the name of the Eusèbe-derived template.

**Method:** AFTER (Architect First, Test Everything Rigorously)
**Status:** Planning — no implementation started
**Date:** 2026-07-03 (rev. 3 — merges the platform pivot into the migration plan)

---

## 1. Vision

What began as a 1:1 migration of **Eusèbe** (Laravel 3, 2012) is now a **form-first,
local-first database platform** — a digital card catalog builder:

- Users create **infinite databases**, each with its own structure, built visually:
  the paradigm is *form first* — you design the form/card that represents your data,
  and the data structure hides behind it.
- A catalog of **typed fields** (text, dates, references, images, GPS points, …) with
  per-type behaviors; a **card layout builder** (columns, stacked blocks) controls how
  records display; a **visual query/report builder** selects and prints/exports data.
- **Three delivery targets, one product:** hosted web app, desktop app, mobile app —
  all feature-identical. Laravel becomes a **headless API**; a single cross-platform
  client does everything.
- Desktop/mobile are **fully offline-capable** (no auth, no API needed): content
  stored on-device in a reusable format (SQLite) *and* a human-readable vault
  (Markdown files a non-technical person can read if the app disappears). Auth exists
  only to **sync** with a cloud account.
- **Eusèbe is the first database**: its v2 characterization goldens are the platform's
  acceptance fixture. When the platform, configured with the "Literary Catalog"
  template, reproduces every v2 feature and all 470 works losslessly — the engine is
  proven. The Eusèbe *data* stays private (not a public dataset); public **templates
  and demo datasets** ship instead.

### Unchanged commitments (from rev. 2)
- v2 repo: frozen code; authorship rewrite → Naomi Gilbert; dump purged from history
  and kept locally; one Docker-runnability commit; published as the historical base.
- Dump lives on the user's machine (`EUSEBE_DUMP_PATH`); never in a public repo.
- AFTER discipline: contracts before code; parity on features and data, never pixels.

---

## 2. Architecture Decisions (D8–D13 — recommendations, user to ratify)

### D8 — Client stack (recommendation: **React + TypeScript everywhere, Tauri 2 shells**)

| Option | Pros | Cons |
|---|---|---|
| **A. Flutter** (one Dart codebase: iOS/Android/desktop/web) | True parity everywhere; excellent offline/SQLite (drift); single team | Web output is canvas-rendered (a11y, SEO, text selection, low-end perf); abandons the React/TanStack decision; DOM-style drag-drop builders (form/layout/report) are harder; smaller ecosystem |
| **B. React web + React Native mobile (+ Electron/RN-desktop)** | JS everywhere; shared logic packages | **Two UI implementations** of every screen incl. the three visual builders — worst code duplication; RN desktop immature / Electron heavy |
| **C. React + TS single codebase; browser (hosted) + Tauri 2 shells for desktop AND mobile** ✅ | Literally one UI codebase incl. builders (DOM drag-drop is native territory); keeps TanStack Router/Query/Form/Table/Virtual; Tauri: small binaries, SQLite plugin, filesystem access for the MD vault, works with MapLibre/PMTiles in the webview; shared TS core packages (schema engine, validation, sync client, exporters) used by web too | Tauri **mobile** is the newest layer (stable since v2, late 2024) — needs an early risk spike; per-OS webview quirks; "web feel" rather than native-widget feel; occasional Rust for native plugins |
| **Monorepo shape (with C):** `apps/api` (Laravel), `apps/client` (React, all targets), `packages/core` (schema engine, validation, query model), `packages/sync`, `packages/export` | | |

**Also considered (user question):** **Cordova** — effectively legacy; superseded by
Capacitor, plugin ecosystem decaying, mobile-only. **Ionic** — a UI component kit on
top of Capacitor; irrelevant here since the builders are custom UI (the runtime that
matters is Capacitor). **Electron** — desktop-only, heavyweight (bundled Chromium +
Node, ~200 MB, RAM-hungry) but the most battle-tested webview shell (VS Code, Slack,
Obsidian). **Capacitor** — the modern Cordova successor: mature iOS/Android shells for
web code, solid SQLite plugin; desktop only via community Electron glue.
The credible alternative to Tauri-everywhere is therefore the **Capacitor (mobile) +
Electron (desktop)** combo — two boring, proven shells instead of one newer one; it is
exactly what Obsidian ships, and Obsidian is the archetype of our local-vault app. Cost:
two packaging pipelines and two native-bridge APIs (absorbed behind the platform
abstraction), plus Electron's footprint.
**Ratified plan:** Tauri 2 primary (one shell, small footprint). **Fallback if the R3
spike fails: Capacitor + Electron** — keeps 100% of the React codebase, only the shells
change. Flutter is dropped as fallback (would rebuild all UI). The platform-abstraction
layer in `packages/core` (storage, filesystem, dialogs behind interfaces) is a working
agreement so the shell choice stays reversible.

### D9 — Dynamic data storage (recommendation: **hybrid document model on the relational DB**)

The problem: user-defined schemas mean records can't map to fixed columns. Options:

| Option | Pros | Cons |
|---|---|---|
| **1. EAV** (one row per field value, typed value columns) | Pure relational; per-field indexing; schema changes are metadata-only; identical model in MySQL/SQLite | Reading a card = N-row pivot; filters become join pyramids; poor locality; ORM misery; aggregation collapses at scale; export requires reassembly. Industry consensus: avoid |
| **2. Document-in-relational** (one row per record, `data` JSONB) | Record = atomic unit → **perfect for sync, versioning, audit, MD export**; Postgres JSONB + GIN + generated columns for hot fields; one datastore; **SQLite JSON1 mirrors the exact same model on-device** | Typing enforced at app layer (schema registry), not DB; reference integrity needs a side table; ad-hoc analytics on arbitrary fields needs deliberate indexing |
| **3. True NoSQL** (MongoDB / CouchDB+PouchDB) | Native documents; CouchDB replication ≈ free sync | Second datastore beside Laravel's SQL (users/auth stay relational); second ops burden; Laravel support second-class; geo/aggregation weaker than PostGIS; locks sync design to Couch |
| **4. Physical tables per user-table** (Baserow/NocoDB style: runtime DDL) | Real types, FKs, indexes; best raw query performance; natural SQL analytics | Runtime `ALTER TABLE` on user actions (locking, risk); table explosion in multi-tenant; record-level versioning and **sync diffing much harder**; device mirror must replay DDL |

**Recommended: Option 2 as a hybrid** —
- **Schema registry** (real tables): `workspaces`, `databases`, `tables`, `fields`
  (type, options, validation), `views`, `reports`, `templates`.
- **Records**: `records(id ULID, table_id, data JSONB, hlc_version, created/updated,
  deleted_at)` — tombstones for sync.
- **Side tables for what JSONB does poorly:**
  `record_links(from_record, field_id, to_record)` → referential integrity + fast
  reverse lookups ("all works by this author");
  `record_points(record_id, field_id, geog GEOGRAPHY)` → PostGIS map queries,
  clustering, geo-aggregation;
  generated `tsvector` (or side table) → full-text search.
- **On-device mirror:** same shape in SQLite (JSON1 + R*Tree), so the sync unit is
  simply the record document + links. Human-readable vault renders from the same
  documents.

### D10 — Server database: **PostgreSQL (+ PostGIS)** instead of MySQL 8
JSONB with GIN indexing, generated columns, and PostGIS (the GPS field, map browsing,
locality aggregation) are all materially better on Postgres. Laravel support is
first-class. (MySQL stays possible but every D9 mechanism gets worse.)

### D11 — Maps & geo (all open-source, per requirement: no Google)
- **Rendering:** MapLibre GL JS + OSM-derived vector tiles; **Protomaps PMTiles** for
  self-hostable tiles and **offline tile bundles** on device.
- **GPS field UX:** map picker (drag a pin), manual lat/long entry.
- **Reverse geocoding** (point → city/region/country): self-hosted **Photon** or
  **Nominatim** (public instances have strict usage policies). Runs server-side on a
  queue; the resolved locality snapshot (city, region, country + place IDs) is stored
  **denormalized on the record**, so aggregation and offline browsing need no live
  geocoder. Offline-created points are queued and resolved at next connectivity.
- **Map browse view:** per-database map page plotting all records with GPS fields,
  clustering, and aggregation drill-down by country → region → city.
- **Geocoding: embedded gazetteer as THE resolver — no services, no self-hosting**
  (user-ratified; the earlier Photon-container tier is dropped as over-engineering).
  One resolver package (`packages/core`), pure data + in-process spatial index,
  runs identically on device, in the web client, and in the API:
  - **Country + province/state:** point-in-polygon against **Natural Earth**
    admin boundaries (public domain, ~10–20 MB at 1:10m) — *exact* assignment for
    the two levels aggregation cares about most, no border-snapping errors.
  - **City label:** nearest-city from **GeoNames** `cities1000` (a few MB, CC-BY 4.0
    with attribution) — city-level precision; the worst failure mode is labeling a
    rural point with the neighboring town, which is benign for aggregation.
  - **Forward search too:** the same GeoNames index answers "type a place name to
    jump the map there" in the GPS picker — offline.
  - Total bundle ≈ 15–25 MB, fully offline everywhere, zero infrastructure. What it
    can't do is street-level addresses — which no feature needs: city level suffices
    for automated locality data, and the map itself shows *where in the city* a
    point sits — sub-city precision never needs to become data.
  - **No external geocoder integration** (user decision): no `GEOCODER_URL`, no
    provider keys, no refinement queue. If a finer need ever materializes, it gets
    designed then. Snapshots still record `resolution_source` + gazetteer dataset
    version, purely so future re-resolution against updated bundled data stays
    possible.

### D12 — Sync model (recommendation: **field-level LWW with HLC, not CRDT — yet**)
- Hybrid logical clocks per device; record documents carry `hlc_version`; per-field
  last-writer-wins merge; tombstones for deletes; server is the arbiter and history
  keeper; conflicts that LWW resolves *silently keep both versions in the record's
  activity log* (P29), and true concurrent-field conflicts surface in the UI.
- Media/files: content-addressed blobs, synced by hash.
- Full CRDT (Yjs/Automerge style) deferred — needed only for real-time co-editing,
  which is not in scope. Revisit if sharing (R4) grows toward collaboration.
- Local mode has **no auth**; an account is required only when enabling sync.

### D13 — Naming
`Literary-Heritage-Archive` is now one *template* of a generic product. Repo name
stays for now; product naming is an open decision before public release (R1 end).

---

## 3. Platform Domain Model

```
Workspace ─── (membership: P30 groundwork — owner-only at first)
 └─ Database            "one archive" — user-created, infinite
     ├─ Table           a card type (Eusèbe: Works, Authors, Periodicals, …)
     │   └─ Field       typed, ordered, with options + validation
     ├─ Record          JSONB document conforming to its Table's fields
     ├─ View            saved presentation: list / card detail / map (+ future)
     │                  card layout = column count + stacked blocks per column
     ├─ Report          saved visual query + output layout (print/PDF/CSV export)
     └─ Template        exportable Database definition (schema+views+reports, no data)
```

### Field type catalog v1
| Type | Behaviors |
|---|---|
| Text (short) | max-length option (Eusèbe: 140-char + live counter) |
| Text (long/rich) | markdown-ish rich text |
| Number | int/decimal, min/max |
| Date | **partial dates** (year-only, year-month — Eusèbe requires this), unknown allowed |
| Boolean | — |
| Select / Multi-select | fixed option lists |
| **Reference** | link to record(s) in another Table; **inline-create in forms** (reproduces v2's ajax modals); delete protection: **block, with reassign offered in the UI** (P4 ✅) |
| Image / File | multi-file, gallery display (P1), content-addressed storage |
| URL / Email | validated |
| **GPS Point** | D11: map picker, lat/long, reverse-geocoded locality snapshot |
| System | created/updated timestamps, record ID |

Extensible: field types are a registry (server validation + client editor/display
components + SQLite/export mapping per type).

### The three visual builders
1. **Form/structure builder** — drag field types onto a card; configure options;
   this *is* schema editing (form-first paradigm). Schema versioning: additive changes
   free; destructive changes (delete/retype field) require explicit confirmation with
   data-impact preview.
2. **Card layout builder** — choose column count; stack field blocks per column;
   per-View layouts.
3. **Report/query builder (P26 ✅ expanded)** — visual condition builder
   (field/operator/value, AND/OR groups), sort, grouping, field selection; output to
   print layout / PDF (P24), CSV (P25), and saved as reusable Reports. Eusèbe's
   "Annexe B" becomes a shipped Report in the Literary Catalog template — and its
   golden output is the report engine's acceptance test.

---

## 4. Application Architecture

### Laravel headless API (`apps/api`)
- API-only: Sanctum token auth, `/api/v1/*`, JSON:API-ish resources.
- Modules: identity/workspaces, schema registry, record engine (JSONB + side tables),
  query engine (compiles report-builder AST → SQL), sync endpoints (R4), file storage,
  geocoding queue, backup destinations (R4: SFTP/WebDAV/email/Proton*), activity log.
- Multi-user groundwork from day one (P30 ✅): every resource scoped to workspace
  membership; roles enum exists (owner only used until R4).

### Cross-platform client (`apps/client`)
- React + TS, TanStack Router (file-based), TanStack Query (server state), TanStack
  Form (dynamic forms driven by schema), TanStack Table/Virtual (big lists).
- **Data layer abstraction** (`packages/core`): one repository interface, two drivers —
  *remote* (API via TanStack Query) and *local* (SQLite via Tauri plugin). Web = remote;
  desktop/mobile = local by default, remote/sync when signed in.
- Local vault (`packages/export`): SQLite file + Markdown vault (one `.md` per record,
  YAML frontmatter = fields, folder per table, `schema.json` + human README) — written
  on-device, doubling as the human-readable backup format. Also exportable from web.
- Offline queue: mutations, file blobs, pending reverse-geocodes.

### Testing (AFTER, adapted to a platform)
1. **Eusèbe acceptance fixture** (from rev. 2, unchanged in spirit): v2 goldens +
   journeys, now executed against *the platform configured with the Literary Catalog
   template + imported dump*. The parity matrix survives as the R1 exit gate.
2. **Engine test pyramid:** property-based tests on the schema engine (arbitrary
   schemas → valid records round-trip storage/export/import), query-engine golden SQL
   tests, sync-protocol simulation tests (two virtual devices, conflict matrices).
3. **E2E:** Playwright (web + Tauri desktop via webdriver); device smoke suite for
   Tauri mobile.
4. Contract-first stays law: platform features ship with their contracts; the three
   builders each get scenario suites (build Eusèbe's schema *through the UI* = the
   flagship E2E).

---

## 5. Releases & Backlog

Near releases fully split; later releases progressively elaborated (stories will be
split when their release approaches).

### R0 — Heritage groundwork *(unchanged from rev. 2, runs first / in parallel)*
| ID | Story | Est |
|---|---|---|
| R0-S1 | v2 Docker time capsule (php:5.6 + mysql:5.7), seeded from `EUSEBE_DUMP_PATH` | M |
| R0-S2 | Smoke-verify all v2 routes; `SMOKE.md` | M |
| R0-S3 | Golden-master harvester → versioned goldens (counts, ordered lists ×dimensions, detail payloads, annex structure, loadchoices) | L |
| R0-S4 | v2 journey specs (Playwright, role/text selectors) recorded as the acceptance journeys | L |
| R0-S5 | Safety net: git bundle + dump SHA-256 logged, local home established | S |
| R0-S6 | `git-filter-repo`: authorship → Naomi Gilbert; purge `sql/eusebe.sql`; verify byte-identical tree | M |
| R0-S7 | Docker-runnability commit + README pointer; leak audit; push private → audit → public | M |
| R0-S8 | Pre-publication legal check: verify FontleroyBrown webfont's redistribution license (repo ships the font files publicly); note that error_logs expose old host username `gdw` + domain (user-accepted, documented) | S |
| R0-S9 | Kickoff logistics: convert this backlog into GitHub issues/project board (agents work from issues, PLAN.md stays the architecture record); decide fate of the currently-hosted v2 instance (sunset/cutover note) | S |

### R1 — Platform core + web app → **exit gate: Eusèbe Parity Milestone**
**Epic R1-A Foundation:** monorepo (`apps/api`, `apps/client`, `packages/*`); Laravel + Postgres/PostGIS + Sanctum; React/TS + TanStack scaffold; CI (lint, Pest, Vitest, Playwright); conventions doc. *(absorbs old E4/E5)*
**Epic R1-B Schema engine:** registry migrations/models; field-type registry v1 (all types except GPS — GPS lands R2); schema versioning + destructive-change guard; property-based round-trip tests.
**Epic R1-C Record engine:** JSONB records + `record_links` + tombstones; validation from schema; CRUD API; full-text search (P7 ✅); filtering/sort (P8/P9 ✅) with **per-database locale/collation setting** (French accent ordering); pagination/virtualization (P10 ✅); reference delete = block + UI reassign (P4 ✅); activity log (P29 ✅) with **per-record history view + restore-version** (doubles as edit-undo); **trash can**: tombstoned records restorable before purge (accidental-delete recovery — tombstones exist for sync anyway); optimistic concurrency guard (two tabs editing one record); **scale targets defined and enforced by a synthetic load fixture** (propose: 100k records/database, 50 fields/table, p95 list < 200 ms — validates D9 before the builders sit on it).
**Epic R1-D Builders & views (web):** form/structure builder; card layout builder; dynamic record forms (TanStack Form) with inline reference creation, unsaved-changes guard (P19 ✅), toasts/optimistic updates (P18 ✅); **data-entry ergonomics** ("save & add another" loop — v2's implicit workflow —, duplicate-record-as-template, keyboard navigation); list + detail views with images/galleries (P1 ✅), counts on browse indexes (P11 ✅); auth screens; dark mode (P21 ✅); bilingual FR/EN UI shell (P22 ✅) incl. locale-aware date/number formatting.
**Epic R1-E Templates & import:** template export/import format (**versioned**, with an upgrade path when shipped templates evolve); **generic CSV import** (column→field mapping wizard, dry-run report — every database tool lives or dies by this); **Literary Catalog template** (Works/Authors/Periodicals + lookups as referenced tables — v2's lookup CRUD gaps P5/P12 dissolve: referenced tables get full CRUD for free); demo datasets (P28 replacement ✅); **Eusèbe importer** (dump → records, `0000-00-00`→partial-date-unknown P17 ✅, `~`-split→image lists, integrity report P16 ✅, dupe-candidate flags P15 ✅, validation rules P14 ✅).
**Epic R1-F Parity gate:** v3 adapters for all rev.-2 contracts (platform+template edition); journeys re-pointed; **parity matrix green** modulo `DELTAS.md`; side-by-side dress rehearsal vs the v2 container; design direction (D5) settled in R1-D with FontleroyBrown/green heritage nod (P23 ✅) considered.

### R2 — Geo, reports, sharing surface
**Epic R2-A GPS & maps (D11):** GPS field type; map picker with offline place-name search; PostGIS side table; map browse view with clustering; **embedded gazetteer resolver** (Natural Earth polygons + GeoNames cities, in-process, all targets) producing locality snapshots; aggregation by city/region/country; **image EXIF handling**: strip GPS/EXIF on share/export by default (privacy), and offer "use photo's location" to fill a GPS field on upload (feature).
**Epic R2-B Report/query builder (P24/P25/P26 ✅):** visual query AST + server compiler; print layout designer; PDF/CSV outputs; Annexe B as shipped template report, validated against its golden.
**Epic R2-C Share (P2 ✅):** signed read-only share links for records/views (squares full-auth with shareability).

### R3 — Local-first desktop & mobile
**Epic R3-A Spike (timeboxed, first): ✅ done — GO (2026-08-03).** Tauri 2 proven on macOS, iOS simulator and Android emulator (Windows assumed, not executed): SQLite plugin, filesystem vault write, MapLibre+PMTiles offline render. D8 stands, fallback not triggered. Two findings carried forward: the app protocol does not support HTTP byte serving, so the PMTiles archive must be read natively (informs R3-D offline map bundles); and **no mobile directory picker exists → D16**. Evidence: `docs/R3-A-EVIDENCE.md`.
**Epic R3-B Local driver:** SQLite mirror schema; repository local-driver; offline queue; no-auth local mode.
**Epic R3-C Vault:** Markdown vault writer (+ SQLite export); continuous on-change export; re-import path (vault → database) so the format is truly reusable.
**Epic R3-D Packaging:** installers, auto-update, mobile store readiness; offline map bundles.

### R4 — Sync, accounts, multi-user, backups
**Epic R4-A Sync protocol (D12):** HLC versioning, push/pull batches, field-LWW merge, conflict surfacing, blob sync; two-device simulation suite before any UI.
**Epic R4-B Accounts & sharing:** registration with an **instance-level open/closed toggle** (admin setting — the family instance runs registration-closed; invites still possible when closed); device linking; workspace membership + roles activate (P30 groundwork ✅ → real); per-database sharing; **email infrastructure decision** (SMTP provider — needed by password reset AND the email-backup destination); **account deletion + full data export** (vault covers export; deletion is an Apple App Store requirement and a Québec Law 25 / GDPR obligation once the platform hosts other people's data); storage **quotas** per account (media grows); rate limiting & upload scanning on the hosted instance; activity-log/tombstone **compaction policy**.
**Epic R4-C Backups (P27 ✅ expanded):** `archive:backup` + UI-triggered/scheduled backups to **SFTP, WebDAV, email**; **Proton Drive** best-effort (no official public API — likely via rclone/bridge; flagged risk); restore path tested.
**Epic R4-D Hosting & operations:** deployment story for the multi-user cloud instance; **shared-hosting (cPanel) deployment mode** — no docker, cron-driven queue worker, tier-2/3 geocoding only, documented install guide (may be pulled forward for the family instance as soon as R1 is usable); error reporting/monitoring (self-hostable, e.g. Sentry/GlitchTip) wired into API and clients from R1 but productionized here; backup-of-the-platform-itself (Postgres + blobs) distinct from user-facing backups.

### Deliberately deferred (named so they're choices, not oversights)
Computed/rollup fields (e.g. live "works per author" on a card); cross-database references; real-time collaboration (CRDT revisit); global search across databases; bulk edit operations beyond delete; template marketplace/sharing; mobile background sync (foreground-sync first — iOS limits); import from other tools (Airtable/Notion) beyond CSV.

---

## 6. Enhancement Verdicts (from the decision sheet)

**Adopted:** P1, P2, P3, P4 (block + reassign in UI), P5, P6*, P7, P8, P9, P10, P11,
P12, P14, P15, P16, P17, P18, P19, P21, P22, P23, P24, P25, P26 (+ full visual
query/report builder), P27 (+ email/SFTP/WebDAV/Proton destinations), P29, P30
(groundwork now, activation R4).
**Rejected:** P28 — Eusèbe data is not public. Replaced by public **templates + demo
datasets** (R1-E).
*(P6 — periodical issues/articles: in the platform model this is just "more tables in
the Literary Catalog template" — Numéros/Articles/Illustrations tables with reference
fields. Scheduled with template work, R1-E stretch / R2.)*

Most adopted items dissolved into platform features rather than standalone stories —
e.g. P5/P12 (edit lookups, browse périodiques by more dimensions) are inherent once
lookups are real referenced tables with views.

## 7. Risks (new/changed)

| Risk | Impact | Mitigation |
|---|---|---|
| **Scope: this is a product, not a port** (~5–10× rev. 2) | Fatigue, never shipping | Release gates; R1 ends with a *usable, deployable* web product proven by Eusèbe parity |
| Tauri 2 mobile immaturity | R3 blocked | R3-A spike is first and timeboxed; Flutter is the documented fallback (loses builder-dev-speed, revisit D8) |
| Sync correctness | Data loss = trust loss | Protocol built test-first via simulation suite (R4-A) before any UI; activity log keeps pre-merge versions |
| Query/report builder complexity creep | R2 stalls | AST v1 limited to field/operator/value + AND/OR + sort + group; no cross-table joins beyond reference traversal v1 |
| Design-inspiration drift (Maxton is Elements-licensed, reference-only) | Accidentally copying Maxton markup/SCSS into the repo would violate Envato terms | D5 resolved on Tabler (MIT): rule = ideas yes, files never; PR review checks `packages/theme` contains only Tabler-derived/original code |
| Gazetteer precision limits (nearest-city labels, dataset staleness) | Occasional mislabeled locality near boundaries | Country/region via exact point-in-polygon (Natural Earth); city label editable by the user on the record; dataset refreshed with app updates (snapshots keep dataset version for re-resolution) |
| cPanel shared hosting constraints (no docker, cron-only workers) | Hosted family instance | Postgres confirmed available (D15 ✅); shared-hosting deployment mode (R4-D) covers the rest; geocoding needs no service at all under revised D11 |
| Proton Drive has no official API | P27 partial | SFTP/WebDAV/email are the committed targets; Proton flagged best-effort |
| Schema-change data loss (user deletes a field) | User trust | Destructive-change preview + soft-retention of orphaned values + activity log |
| Old risk set (L3 boot, import mojibake, history-rewrite leaks) | — | Unchanged from rev. 2, lives in R0 |

## 8. Decision Log

| ID | Decision | Status |
|---|---|---|
| D1 | Name cleanup = authorship only | ✅ Resolved |
| D2 | English code identifiers, French data/UI (now: bilingual UI, P22) | ✅ Assumed |
| D3 | v2 frozen; deltas ledgered | ✅ Resolved |
| D4 | Dormant tables → superseded: they become template tables (P6) | ✅ Superseded |
| D5 | Visual direction: **Tabler (MIT, Bootstrap 5) as the code base, re-skinned with a Maxton-inspired design language.** User holds Maxton via **Envato Elements** (no redistribution in open source → its files/SCSS/markup never enter the repo; the template stays on the user's machine as a **visual reference only**). From Maxton we take *ideas*: **horizontal menu layout**, the blue-theme's deep-dark aesthetic re-expressed as a **green dark theme** (v2 greens `#459e00` primary / `#67b021` hover over deep green-tinted dark backgrounds), popping accent colors and strong contrasts. Implemented natively with Tabler's SCSS variables/components + Tabler Icons (MIT); charts ApexCharts-react; tables TanStack Table. Fully AGPL-compatible — license gate dissolved | ✅ **Ratified** |
| D6 | Dump local; long-term form | ✅ Resolved (private forever — P28 rejected) |
| D7 | Full-auth web; **amended:** desktop/mobile local mode = no auth, auth only for sync | ✅ Amended |
| **D8** | Client stack: React+TS everywhere, Tauri 2 shells; **fallback = Capacitor (mobile) + Electron (desktop)**, Flutter dropped. **R3-A spike closed GO on 2026-08-03** — SQLite, Markdown write and offline PMTiles all exercised on macOS, iOS simulator and Android emulator (two webview engines); fallback not triggered. Windows was not executed (accepted risk). Evidence: `docs/R3-A-EVIDENCE.md` | ✅ **Ratified — spike confirmed** |
| **D9** | Storage: hybrid JSONB document model + side tables | ✅ **Ratified** |
| **D10** | Postgres + PostGIS (replaces MySQL 8 decision) | ✅ **Ratified** |
| **D11** | MapLibre + Protomaps/OSM tiles; Photon reverse geocoding, **bundled as an optional compose profile with country extracts + graceful degradation** | ✅ **Ratified** |
| **D12** | Sync: HLC + field-level LWW + tombstones; CRDT deferred | ✅ **Ratified** |
| **D13** | Product name: **Heritage Archives Patrimoine (HAP)** — bilingual (EN/FR) in the name itself; repo dir rename optional/whenever convenient | ✅ **Ratified** |
| **D14** | Platform license: **AGPL-3.0** | ✅ **Ratified** |
| **D15** | Deployment reality: hosted instances may live on **cPanel shared hosting** for a while (family instance, registration closed); needs the no-docker deployment mode. **PostgreSQL confirmed available on the host** ✅ | ✅ **Resolved** |
| **D16** | **Mobile vault model — open.** The R3-A spike found no directory picker on either mobile platform ("Folder picker is not implemented on mobile"), so the desktop vault — an arbitrary user-chosen folder such as an Obsidian directory — has no mobile equivalent. Mobile can write Markdown only inside app-private storage, invisible to other apps and deleted with the app. Options: (a) app-scoped vault + explicit import/export; (b) system document picker (UIDocumentPicker / Storage Access Framework) via a Tauri plugin to write or source — URI-based, often time-limited grants, not a stable path; (c) vault on desktop only, mobile read/consult. Affects Working Agreement 5 and both R3-B and R3-C | ⏳ **To ratify before R3-C** |

## 9. Working Agreements
1. AFTER: no feature before its contract; Eusèbe goldens gate R1.
2. `~/Eusebe` frozen (R0 scope only). Dump never leaves the machine.
3. Every behavior difference vs v2 → `DELTAS.md`; every silent LWW merge → activity log.
4. Field types, exporters, and drivers are registries — new ones never touch engine core.
5. The Markdown vault is a contract: versioned format spec, round-trip tested (export → import → identical records).
6. Progressive elaboration: split R2+ stories only when their release nears; re-plan at each release gate.
