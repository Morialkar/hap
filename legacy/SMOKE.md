# Eusèbe v2 — Smoke Test Report (R0-S2)

Capsule: `eusebe-v2` stack, PHP 5.4 / MySQL 5.7, serving at `http://localhost:8056`.
Canonical state: **470 ouvrages / 213 auteurs / 17 périodiques**.
All tests performed programmatically via `curl` against the running container.
No authentication is required for any route (B9).

---

## Route Coverage Table

### Dashboard

| Route | Method | HTTP | Observed behavior |
|---|---|---|---|
| `/` | GET | 200 | Dashboard renders: "Nombre d'Ouvrages: 470", "Nombre d'Auteurs: 213", "Nombre de Périodiques: 17" |

### Browse — Ouvrages

| Route | Method | HTTP | Observed behavior |
|---|---|---|---|
| `view/ouvrage/titre` | GET | 200 | Full alphabetical list, ~82 KB HTML |
| `view/ouvrage/auteurs` | GET | 200 | Browse index grouped by author |
| `view/ouvrage/auteur/5` | GET | 200 | List of works for author id=5 with resolved name |
| `view/ouvrage/dates` | GET | 200 | Browse index grouped by year |
| `view/ouvrage/dates/1885` | GET | 200 | Filtered list for year 1885 |
| `view/ouvrage/genre` | GET | 200 | Browse index (list of types) |
| `view/ouvrage/genre/1` | GET | 200 | **Renders `view.ouvrage.auteur` template** — type name "Livre" appears in the `<h2>` auteurNom slot (see B3) |
| `view/ouvrage/categorie` | GET | 200 | Browse index (list of categories) |
| `view/ouvrage/categorie/1` | GET | 200 | Renders `view.ouvrage.auteur` template with category name in auteurNom slot (same pattern as genre — see B3) |
| `view/ouvrage/id/5` | GET | 200 | Detail page with all resolved lookup names, edit + delete + share icons |

### Browse — Périodiques

| Route | Method | HTTP | Observed behavior |
|---|---|---|---|
| `view/periodique/titre` | GET | 200 | Full list of 17 périodiques |
| `view/periodique/id/1` | GET | 200 | Detail page with edit + delete icons (delete icon links to `/delete/periodique/1` — dead, see B1-periodique note) |

### Annex

| Route | Method | HTTP | Observed behavior |
|---|---|---|---|
| `/annex` | GET | 200 | Groups by year: Inconnu, 1854, 1855, … Each entry: **author name, title (italic), pages, Imprimeur name, Éditeur name** (see B8) |

### Add / Edit forms

| Route | Method | HTTP | Observed behavior |
|---|---|---|---|
| `/ajouter/ouvrage` | GET | 200 | Blank ouvrage form with AJAX modals for inline auteur/éditeur/imprimeur creation |
| `/ajouter/periodique` | GET | 200 | Blank périodique form |
| `/editer/ouvrage/5` | GET | 200 | Edit form pre-populated with ouvrage id=5 data |
| `/editer/periodique/1` | GET | 200 | Edit form pre-populated with périodique id=1 data |

### Write — Ouvrages (POST)

| Route | Method | HTTP | Observed behavior |
|---|---|---|---|
| `POST /ajouter/ouvrage` (no image) | POST | 200 | DB row created; `images` = `img/default.png`; response = `add.ouvrage` view with ok=1 |
| `POST /ajouter/ouvrage` (single file `img0`) | POST | 200 | DB row created; `images` = `img/<filename>~`; file does **not** exist on disk (see B2) |
| `POST /ajouter/ouvrage` (two files `img0`+`img1`) | POST | 200 | DB row created; `images` = `img/<name1>~img/<name2>~` (tilde-delimited — see B6) |
| `POST /editer/ouvrage/{id}` | POST | 200 | Persistence confirmed via DB re-read; response renders **`edit.periodique` view** (see B7) |

### Write — Périodiques (POST)

| Route | Method | HTTP | Observed behavior |
|---|---|---|---|
| `POST /ajouter/periodique` (no image) | POST | 200 | DB row created; `images` = `img/default.png`; `fk_frequence` FK honoured (valid id required — see InnoDB FK note) |
| `POST /editer/periodique/{id}` | POST | 200 | Persistence confirmed via DB re-read; response renders `edit.periodique` view |

### Delete

| Route | Method | HTTP | Observed behavior |
|---|---|---|---|
| `GET /delete/ouvrage/{id}` | GET | 200 | **Empty body (0 bytes)**; record removed from DB (see B1) |
| `GET /delete/periodique/{id}` | GET | 404 | **Route does not exist** — but `view/periodique/id/{id}` detail page renders a delete icon linking to `/delete/periodique/{id}`; clicking it → 404 (see dead-delete-link finding) |

### Share

| Route | Method | HTTP | Observed behavior |
|---|---|---|---|
| `share/ouvrage/{id}` | GET | 404 | Route not defined. The `view/ouvrage/id/{id}` detail page renders a mail/share icon linking to `/share/ouvrage/{id}`; clicking it → 404 (see B4) |

### AJAX — loadchoices (7 routes)

| Route | Method | HTTP | Observed behavior |
|---|---|---|---|
| `/ajax/loadchoices/auteur` | GET | 200 | JSON array of auteur objects; `naissance`/`deces` fields contain `0000-00-00` dates verbatim (see B10) |
| `/ajax/loadchoices/type` | GET | 200 | JSON array of type objects |
| `/ajax/loadchoices/categorie` | GET | 200 | JSON array of category objects |
| `/ajax/loadchoices/editeur` | GET | 200 | JSON array of éditeur objects |
| `/ajax/loadchoices/imprimeur` | GET | 200 | JSON array of imprimeur objects |
| `/ajax/loadchoices/localisation` | GET | 200 | JSON array of localisation objects |
| `/ajax/loadchoices/frequence` | GET | 200 | JSON array of frequence objects |

### AJAX — save (5 routes)

| Route | Method | HTTP | Observed behavior |
|---|---|---|---|
| `GET /ajax/save/auteur?aut_nom=…&aut_prenom=…` | GET | 200 | Returns `'1'`; row created in `auteurs` table — **mutation via GET** (see B5) |
| `GET /ajax/save/editeur?edit_nom=…` | GET | 200 | Returns `'1'`; row created in `editeurs` table — mutation via GET (see B5) |
| `GET /ajax/save/imprimeur?impr_nom=…` | GET | 200 | Returns `'1'`; row created in `imprimeurs` table |
| `GET /ajax/save/localisation?local_nom=…` | GET | 200 | Returns `'1'`; row created in `localisations` table |
| `GET /ajax/save/frequence?freq_nom=…` | GET | 200 | Returns `'1'`; row created in `frequences` table |

---

## B1–B10 Findings

### B1 — `GET /delete/ouvrage/{id}` returns blank/empty 200

**Confirmed.** `curl -s -w "HTTP:%{http_code}|LEN:%{size_download}" http://localhost:8056/delete/ouvrage/{id}` → HTTP 200, body length 0. The route executes `$toDelete->delete()` with no return statement — Laravel returns an empty 200. The record is gone on a fresh DB query.

**Dead delete link (periodique):** `GET /delete/periodique/{id}` → **404** — no such route exists. The `view/periodique/id/{id}` detail page renders a delete icon (`ui-icon-closethick`) linking to `/delete/periodique/{id}`. Clicking it in the app produces the Laravel 404 error page. Flag for DELTAS.md: periodique delete is broken.

### B2 — Image upload: file never materializes; DB references a phantom path

**Confirmed.** The upload handler (`routes.php` lines 159–166) passes the client-supplied filename as the **source** path to `move_uploaded_file`:

```php
$filename = $img['name'];          // client filename, e.g. "smoke-test.png"
move_uploaded_file($filename, $path . '/' . $filename);  // source = "smoke-test.png", not the tmp file
```

`move_uploaded_file` requires the PHP temp file path as its first argument; passing the client filename fails silently. Result:
- DB row is created with `images = img/<clientfilename>~`
- The image file **does not exist** at `/var/www/html/img/` in the container
- `docker exec eusebe-v2-app-1 ls /var/www/html/img/` shows only the original static asset (`Numériser 2.jpeg`), never any uploaded file

When no file is supplied, `images` defaults to `img/default.png` (a fallback that also does not universally exist in the img/ dir — the static asset list is minimal).

The `img/` directory inside the container appears to be read-only (mounted from the source tree), which would prevent upload even if the path were correct.

### B3 — `view/ouvrage/genre/{id}` renders the auteur view template

**Confirmed.** The route handler (`routes.php` lines 99–104) resolves the `Type` record into `$auteurNom` and calls `View::make('view.ouvrage.auteur')`. The genre name (e.g. "Livre" for id=1) is injected into the `$auteurNom` variable and appears in the `<h2>` heading. Same pattern for `view/ouvrage/categorie/{id}` (category name in auteurNom slot). These are copy-paste artefacts — the auteur view is reused verbatim for genre and categorie filtered listings.

### B4 — `share/ouvrage/{id}` → 404

**Confirmed.** No share route is defined in `routes.php`. The detail view (`view/ouvrage/id/{id}`) renders a mail icon (`ui-icon-mail-closed`) with `href="/share/ouvrage/{id}"`. That URL returns Laravel's 404 error page. Share functionality was never implemented.

### B5 — `GET /ajax/save/editeur` and `GET /ajax/save/auteur` perform mutations

**Confirmed.** Both routes use `Route::get(...)` to create DB rows. Sending a GET request with query parameters creates a new row and returns `'1'`. This violates HTTP semantics (GET must be idempotent/safe) — any crawler, browser pre-fetch, or repeated refresh can create duplicate lookup entries. Example observed: `GET /ajax/save/editeur?edit_nom=TEST-SMOKE-EDITEUR` → row created in `editeurs`. All five save routes (`auteur`, `editeur`, `imprimeur`, `localisation`, `frequence`) have the same pattern.

### B6 — Multi-image: tilde-delimited string in `images` column

**Confirmed.** Sending `img0` and `img1` as multipart fields produces `images = img/<name0>~img/<name1>~`. The upload handler iterates `Input::file()` and concatenates `$path . '/' . $filename . '~'` for each file. The trailing tilde after the last entry is included. Example: `img/smoke-test.png~img/smoke-test2.png~`. Note: as per B2, neither file actually materializes on disk — only the DB string is written.

### B7 — `POST /editer/ouvrage/{id}` renders the périodique edit view

**Confirmed.** The route handler (`routes.php` lines 197–231`) saves the ouvrage correctly (persistence verified via DB re-read), but returns `View::make('edit.periodique')` instead of `edit.ouvrage`. The response page shows périodique-specific elements: `view/periodique/titre` navigation link, `periodique.js` script, `freq_add` div (fréquence modal). The ouvrage data is passed as `$ouvrage` to the périodique template; some fields render incorrectly (mismatched field names). **Data is saved correctly; only the response view is wrong.**

### B8 — `/annex` entries contain author name, title, pages, imprimeur, éditeur

**Confirmed.** Each entry in the annex list follows the pattern:
```
<strong>Lastname , Firstname</strong>, <em>Title</em>, N pages, Imprimeur: X, Éditeur: Y
```
Example (year 1854):
- `Cockburn , G.F.`, *Report on proposed docks…*, 8 pages, Imprimeur: Senécal & Daniel, Éditeur: Senécal & Daniel
- `Meilleur , Jean-Baptiste`, *Nouvelle grammaire anglaise…*, 122 pages, Imprimeur: imprimé par Senécal & Daniel, Éditeur: non-inscrit

Groups are sorted by year ascending; "Inconnu" (unknown year) appears first.

### B9 — Zero authentication required

**Confirmed.** Every route tested — including all write routes (`POST /ajouter/ouvrage`, `POST /editer/ouvrage`, `GET /delete/ouvrage`, all `ajax/save/*`) — is accessible with no session, cookie, or credential. The `routes.php` auth filter exists (`Route::filter('auth', …)`) but is attached to no routes. The `users` table exists in the schema but is unused by any route.

### B10 — `0000-00-00` dates appear verbatim in loadchoices JSON

**Confirmed.** `GET /ajax/loadchoices/auteur` returns JSON where `naissance` and `deces` fields contain the string `"0000-00-00"` for authors with unknown birth/death dates. MySQL 5.7 with empty `sql_mode` stores and returns this value without error. This is the canonical representation that the platform importer must handle (PLAN.md R1-E: `0000-00-00` → partial-date-unknown P17).

---

## InnoDB FK Constraint Finding

**Flag for PLAN.md §2.2 / DELTAS.md / R1-E importer.**

The audit note that the schema uses MyISAM (no FK constraints) is **partially incorrect**. The `users` table uses MyISAM, but the `ouvrages` and `periodiques` tables use **InnoDB with real FK constraints**:

- `ouvrages_ibfk_2` on `fk_editeur` → `editeurs.id`
- Similar constraints on `fk_auteur`, `fk_type`, `fk_cat`, `fk_imprimeur`, `fk_local`
- `periodiques` similarly constrained on `fk_editeur`, `fk_imprimeur`, `fk_frequence`

**Observed consequence:** `POST /ajouter/ouvrage` with `editeur=1` returned HTTP 500 (SQLSTATE 23000 / Error 1452: Cannot add or update a child row — FK constraint failure) because `editeurs.id` does not start at 1 (MIN id = 3 in the canonical dataset).

**Rule for all write tests:** always query `SELECT MIN(id) FROM <table>` before using FK values in test payloads. Canonical FK ranges:

| Table | MIN id | MAX id | Count |
|---|---|---|---|
| `editeurs` | 3 | 81 | 79 |
| `auteurs` | 4 | 218 | 213 |
| `types` | 1 | 11 | 11 |
| `categories` | 1 | 9 | 9 |
| `imprimeurs` | 2 | 57 | 56 |
| `localisations` | 1 | 23 | 23 |
| `frequences` | 1 | 4 | 4 |

**Implication for R1-E importer:** the Eusèbe importer must resolve lookup IDs by name (or re-seed lookup tables before records). Numeric IDs are not stable across environments.

---

## Dead Links Summary

| Dead link | Found in | Returns | Notes |
|---|---|---|---|
| `/share/ouvrage/{id}` | `view/ouvrage/id/{id}` detail page (mail icon) | 404 | No share route implemented (B4) |
| `/delete/periodique/{id}` | `view/periodique/id/{id}` detail page (delete icon) | 404 | No delete route for périodiques (B1 extension) |

---

## Reseed Verification

After all write tests:

```
docker compose down && docker compose up -d
```

Dashboard confirmed: **470 / 213 / 17** — all test rows gone (MySQL data lives in the container layer, no persistent volume; `down` destroys the container and `up -d` reseeds from `EUSEBE_DUMP_PATH`).

`git -C ~/Eusebe status` → **clean** (nothing to commit, working tree clean).

---

## Summary

All routes from the §2.3 route list are covered. All B1–B10 behaviors are empirically confirmed or corrected:

| ID | Status | Verdict |
|---|---|---|
| B1 | Confirmed | `GET /delete/ouvrage/{id}` → 200 empty; **periodique delete → 404 (dead route)** |
| B2 | Confirmed | Upload uses client filename as source path; file never materializes; DB stores phantom path |
| B3 | Confirmed | `view/ouvrage/genre/{id}` and `view/ouvrage/categorie/{id}` reuse the auteur template |
| B4 | Confirmed | `share/ouvrage/{id}` → 404 |
| B5 | Confirmed | All five `ajax/save/*` routes mutate via GET |
| B6 | Confirmed | Multi-file upload produces tilde-delimited string with trailing `~` |
| B7 | Confirmed | `POST /editer/ouvrage/{id}` saves correctly but renders `edit.periodique` in response |
| B8 | Confirmed | `/annex` entries contain author name, title, pages, imprimeur, éditeur |
| B9 | Confirmed | Zero authentication on all routes including all write paths |
| B10 | Confirmed | `0000-00-00` dates verbatim in loadchoices JSON |
| **InnoDB FK** | **New finding** | `ouvrages`/`periodiques` have real InnoDB FK constraints; audit's MyISAM note applies only to `users` |
