# Eusèbe v2 — Time Capsule (R0-S1/S2)

Runs the frozen 2012 Laravel 3 app from `~/Eusebe` (mounted **read-only**) with its
real data, for characterization testing. See `~/Literary-Heritage-Archive/PLAN.md`.

## Boot

```bash
# prerequisite: the private dump exists at $EUSEBE_DUMP_PATH
# (default: ~/Archives/eusebe/eusebe.sql — created by R0-S5, never in a repo)
cd ~/Literary-Heritage-Archive/legacy
docker compose up --build -d
open http://localhost:8056        # dashboard: 470 ouvrages / 213 auteurs / 17 périodiques
```

Env vars (all optional): `EUSEBE_DUMP_PATH` (dump file), `EUSEBE_SRC` (v2 repo path,
default `../../Eusebe`).

## How fidelity is preserved

- The v2 repo is mounted **read-only**; `git -C ~/Eusebe status` stays clean forever.
- DB config is overridden by mounting `overrides/database.php` **over**
  `application/config/database.php` (host → the `db` container; same credentials as
  the committed original).
- `storage/` (Blade cache etc.) is a writable named volume mounted over the RO tree.
- MySQL seeds itself from `$EUSEBE_DUMP_PATH` on first boot (`initdb.d`).

## Archaeology notes (hard-won, do not rediscover)

1. **PHP must be 5.4, not 5.6:** Laravel 3's `helpers.php` defines a function named
   `yield` — a reserved keyword since PHP 5.5 → instant parse error.
2. **Official `php:5.4` images are unpullable** on Docker 28+ (manifest schema 1
   removed). The image is therefore built from `debian:wheezy` (schema-2 rebuild)
   with PHP 5.4.45 from `archive.debian.org` (`[trusted=yes]`: the era's GPG keys
   are expired — acceptable for a local throwaway capsule).
3. **`php5-mcrypt` is required**: session driver is `cookie`, encrypted via
   Laravel 3's Crypter (mcrypt-based).
4. **MySQL runs with empty `sql_mode`** (the 5.5-era default): 5.7's
   `ONLY_FULL_GROUP_BY` breaks `/annex` (`GROUP BY annee_publication` with a full
   `SELECT *`). Config, not code.
5. Apache 2.2 (wheezy): vhost syntax uses `Order allow,deny`; docroot is the repo's
   `public/`, `.htaccess` honored via `AllowOverride All`.

## Verified so far (initial smoke — full pass is R0-S2/SMOKE.md)

| Route | Result |
|---|---|
| `/` | 200 — counts 470/213/17 ✓ |
| `/view/ouvrage/titre` | 200 — full ordered list (82 KB) |
| `/view/ouvrage/id/5` | 200 — detail with resolved lookups |
| `/view/ouvrage/auteurs` | 200 |
| `/view/periodique/titre` | 200 |
| `/annex` | 200 — grouped by year (Inconnu, 1854, 1855…) |
| `/ajax/loadchoices/auteur` | 200 — JSON (`0000-00-00` dates verbatim) |
| `/ajouter/ouvrage` | 200 — form renders |
