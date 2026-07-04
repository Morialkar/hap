# HANDOFF — Finish R0-S2 (v2 smoke pass + B1–B10 verification → SMOKE.md)

You are picking up task R0-S2 of the Heritage Archives Patrimoine (HAP) project,
mid-execution. Read `~/Literary-Heritage-Archive/PLAN.md` §2.3–§2.4 first, and
`~/Literary-Heritage-Archive/prompts/R0.md` (R0-S2 section) for the task definition.

## Hard rules (non-negotiable)
1. `~/Eusebe` is **read-only**. Never modify it (`git -C ~/Eusebe status` must stay clean).
2. The former contributor identity must **never** be typed, printed, or written into
   any file/command/report — it exists only in `~/Archives/eusebe/identity.mailmap`.
3. Everything you write into project folders is in **English**.
4. The SQL dump (`~/Archives/eusebe/eusebe.sql`) never enters a repo.

## Current state
- The v2 Docker time capsule (R0-S1) **works**: `~/Literary-Heritage-Archive/legacy/`,
  stack `eusebe-v2` (containers `eusebe-v2-app-1`, `eusebe-v2-db-1`), serving at
  **http://localhost:8056**. Details + archaeology notes: `legacy/README.md`.
  If down: `cd ~/Literary-Heritage-Archive/legacy && docker compose up -d`.
- DB access: `docker exec eusebe-v2-db-1 mysql -ueusebe -p<password> eusebe`
  (password: see `legacy/overrides/database.php`).
- ⚠️ The DB is currently **polluted by test writes**: an `editeurs` row
  `TEST-SMOKE-EDITEUR` and an `auteurs` row `TEST-SMOKE / Agent`. MySQL data lives
  in the container layer (no persistent volume), so `docker compose down && up -d`
  **reseeds to canonical state** (dashboard must then show 470 / 213 / 17).

## Verified so far (include these results in SMOKE.md)
All GET read routes return 200 with real content: `/`, `/annex` (grouped by year,
first groups: Inconnu, 1854, 1855…), `view/ouvrage/{titre,auteurs,dates,genre,categorie}`,
`view/ouvrage/id/5`, `view/ouvrage/auteur/5`, `view/ouvrage/dates/1885`,
`view/ouvrage/genre/1`, `view/ouvrage/categorie/1`, `view/periodique/titre`,
`view/periodique/id/1`, `ajouter/{ouvrage,periodique}`, `editer/ouvrage/5`,
`editer/periodique/1`, all 7 `ajax/loadchoices/*` (JSON).
- **B3 confirmed**: `view/ouvrage/genre/1` renders the *auteur* view — genre name
  "Livre" appears in the `<h2>{{ $auteurNom }}</h2>` slot.
- **B4 confirmed**: `share/ouvrage/5` → 404 (dead icon, no route).
- **B5 confirmed**: `GET /ajax/save/editeur?edit_nom=…` and `/ajax/save/auteur?…`
  return `'1'` and create rows (GET mutations).
- **B10 confirmed**: `0000-00-00` dates verbatim in loadchoices JSON.
- **NEW FINDING (record it in SMOKE.md and flag for PLAN.md §2.2):** the `ouvrages`
  table has **real InnoDB FK constraints** (e.g. `ouvrages_ibfk_2` on `fk_editeur`) —
  the "MyISAM" note in the audit applies to `users` but not all tables. A POST
  `/ajouter/ouvrage` with `editeur=1` failed with SQLSTATE 23000/1452 because
  **lookup IDs don't start at 1**. Pick valid FK ids from the DB before write tests
  (e.g. `SELECT MIN(id) FROM editeurs;` etc.).

## Interrupted exactly here
The B2 write test (create ouvrage with image upload) returned HTTP 500 (FK 1452)
because of the invalid `editeur=1` id — the upload behavior itself is still
**unverified**.

## Remaining work
1. Redo `POST /ajouter/ouvrage` (multipart, `img0=@somefile.png` + all fields from
   `~/Eusebe/application/routes.php` lines 157–194) with **valid FK ids**. Then check:
   DB row created? `images` column value? does the image file actually exist in the
   container (`docker exec eusebe-v2-app-1 ls /var/www/html/img/`)? → this settles
   **B2** (upload code uses the client filename as `move_uploaded_file` source —
   expected: DB references a path, file never materializes; the img/ dir is also RO)
   and **B6** (`~`-delimited multi-image string: send two files img0+img1).
2. `POST /editer/ouvrage/{id}` on the test record → confirm persistence and **B7**
   (response renders the *periodique* edit view).
3. `POST /ajouter/periodique` + `POST /editer/periodique/{id}` (fields in routes.php
   lines 255–320; `frequence` FK — check valid ids).
4. `GET /delete/ouvrage/{test-id}` → **B1**: expect blank/empty 200 response, record
   gone. Also confirm `GET /delete/periodique/{id}` → 404 (route doesn't exist —
   the detail page links to it anyway; note as the dead-delete-link finding).
5. Remaining ajax saves: `imprimeur`, `localisation`, `frequence` (`impr_nom`,
   `local_nom`, `freq_nom` params) → `'1'`.
6. **B8**: `/annex` already 200; spot-check one entry shows author-name + title +
   pages + printer + publisher.
7. **B9**: note that every route above worked with zero authentication.
8. **Reseed**: `docker compose down && docker compose up -d`, verify dashboard shows
   **470 / 213 / 17** again and the TEST-SMOKE rows are gone.
9. Write **`~/Literary-Heritage-Archive/legacy/SMOKE.md`** (English): a table of every
   route from PLAN.md §2.3 with observed status/behavior, a section per B1–B10 with
   the empirical evidence, and the InnoDB-FK finding. Keep test values generic —
   no personal data.
10. Report back: SMOKE.md path, any surprises vs PLAN.md §2.4, and confirmation the
    capsule is back in canonical state.

Definition of done: SMOKE.md complete and committed-ready, capsule reseeded and
canonical, `git -C ~/Eusebe status` clean.
