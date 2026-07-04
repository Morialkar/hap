# Eusèbe v2 — Golden-Master Harvester (R0-S3)

Captures deterministic JSON snapshots from the running v2 capsule.
Goldens are used as the acceptance fixture for the HAP platform parity gate (R1-F).

## Output files (`tests/golden/`)

| File | Contents |
|---|---|
| `dashboard.json` | Counts: ouvrages / auteurs / périodiques |
| `browse_ouvrage_titre.json` | Ordered list of all 470 works (id + titre) |
| `browse_ouvrage_auteurs.json` | Per-author ordered lists |
| `browse_ouvrage_dates.json` | Per-year ordered lists |
| `browse_ouvrage_genre.json` | Per-genre ordered lists |
| `browse_ouvrage_categorie.json` | Per-category ordered lists |
| `browse_periodique_titre.json` | Ordered list of all 17 périodiques |
| `detail_ouvrages.json` | All fields for every ouvrage (470 records) |
| `detail_periodiques.json` | All fields for every périodique (17 records) |
| `annex.json` | Year-grouped annex entries (author, titre, pages, imprimeur, éditeur) |
| `loadchoices.json` | Verbatim JSON from all 7 `/ajax/loadchoices/*` endpoints |

## Prerequisites

1. The v2 capsule must be running and seeded from the canonical dump:
   ```bash
   cd ~/Literary-Heritage-Archive/legacy
   docker compose up -d
   # verify: curl http://localhost:8056/ shows 470 / 213 / 17
   ```
2. Node 18+ (uses built-in `fetch`).

## Run

```bash
cd tests/parity/harvester
npm install          # first time only
TARGET_BASE_URL=http://localhost:8056 npm run harvest:dev
```

Goldens are written to `tests/golden/`. The directory is created if it does not exist.

## Idempotency guarantee

Two consecutive runs against the canonical capsule produce **byte-identical** output.
Verified: `diff -r <run1> <run2>` → empty.

## Rules

- **Never hand-edit goldens.** They are machine-generated from the canonical dump only.
- **Only re-harvest against the canonical capsule** (470 / 213 / 17 after a fresh
  `docker compose down && docker compose up -d`). Test writes pollute counts.
- Goldens are committed and treated as the source of truth for parity testing.
