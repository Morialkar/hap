# R1-F3 Dress Rehearsal and Sign-off

Date: 2026-07-10

## Scope

R1-F3 validates the R1 release gate from a clean platform state:

1. Fresh v3 platform database.
2. Literary Catalog template installed as part of the Eusèbe import path.
3. Legacy Eusèbe dump imported with `php artisan import:eusebe`.
4. Full parity suite green.
5. Full v3 journey suite green.
6. Parity matrix generated.
7. Ten side-by-side v2/v3 record spot-checks captured with screenshots.
8. User verdict captured before R1 tag.

## Specification Delta

The R1-F3 prompt names `archive:import`, but the current platform command is
`import:eusebe`. `php artisan list` confirms that `archive:import` is not present.
For this rehearsal, `import:eusebe` is the verified import command and performs
the Literary Catalog template setup before importing legacy records.

## Automated Rehearsal Log

| Step | Command | Result | Notes |
| --- | --- | --- | --- |
| v2 capsule | `docker compose -f legacy/compose.yml up -d` | Passed | Legacy app and DB containers running for v2 journey and side-by-side checks. |
| v3 zero bootstrap + journeys | `cd tests/e2e && npm run test:v3:local` | Passed | Fresh `migrate:fresh --seed --force`, `import:eusebe`, local API/client servers, and 22/22 v3 journeys passed. |
| v2 journeys | `cd tests/e2e && npm run test:v2` | Passed | 22/22 v2 journeys passed after restoring legacy periodical edit select state in the page object. |
| parity contracts | `cd apps/api && ./vendor/bin/pest ../../tests/parity/ParityTest.php` | Passed | 12/12 tests, 2060 assertions. Periodical detail coverage now checks owner, dates, publisher, printer, and frequency mappings. |
| importer regression | `cd apps/api && ./vendor/bin/pest tests/Feature/ImportEusebeTest.php` | Passed | 1/1 test, 27 assertions; covers the legacy `periodiques` column order. |
| parity matrix | `pnpm parity:matrix` | Passed | Generated `tests/parity/artifacts/parity-matrix.md` and `.html`. |
| client lint | `pnpm --filter client exec eslint . --max-warnings 0` | Passed | Confirms the client lint cleanup remains clean. |
| spot-check capture | `node tests/e2e/scripts/r1-f3-spot-check.mjs` | Passed | Generated 20 screenshots and `docs/artifacts/r1-f3/spot-check/manifest.json`. |

## Rehearsal Findings and Fixes

The side-by-side spot-check found a real importer defect before sign-off:
legacy `periodiques` columns were mapped in the wrong order. This shifted
`proprietaire`, references, dates, descriptions, and notes in v3. The importer
now follows the actual SQL dump order:
`id, titre, proprietaire, fk_imprimeur, fk_editeur, debut, fin,
description_courte, description, fk_frequence, images, created_at, updated_at,
notes`.

The parity adapter and importer feature test were strengthened so this cannot
silently pass again.

## Spot-check Records

The spot-check set should cover common and risky cases: regular works, accented
titles, long titles, duplicated display labels, periodicals, unknown dates, and
annex-relevant records.

| # | Type | Legacy ID / selector | Title | v2 screenshot | v3 screenshot | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Work | 3 | Journal des opérations de l'armée américaine lors de l'invasion du Canada en 1775-1776 | [v2](./artifacts/r1-f3/spot-check/01-work-3-v2.png) | [v3](./artifacts/r1-f3/spot-check/01-work-3-v3.png) | Agent spot-check OK; user verdict pending |
| 2 | Work | 18 | De l'incapacité légale de la femme mariée : thèse pour le doctorat présentée et soutenue le 28 juin 1899 / par Louis J. Loranger... | [v2](./artifacts/r1-f3/spot-check/02-work-18-v2.png) | [v3](./artifacts/r1-f3/spot-check/02-work-18-v3.png) | Agent spot-check OK; user verdict pending |
| 3 | Work | 37 | Informations précises et officielles touchant l'enregistrement et l'impôt / par J.C. Auger... | [v2](./artifacts/r1-f3/spot-check/03-work-37-v2.png) | [v3](./artifacts/r1-f3/spot-check/03-work-37-v3.png) | Agent spot-check OK; user verdict pending |
| 4 | Work | 58 | Règlements de la cité de Montréal compilés à date : Montréal, septembre 1893 | [v2](./artifacts/r1-f3/spot-check/04-work-58-v2.png) | [v3](./artifacts/r1-f3/spot-check/04-work-58-v3.png) | Agent spot-check OK; user verdict pending |
| 5 | Work | 116 | L'Honorable J.A. Chapleau : sa biographie, suivie de ses principaux discours, manifestes, etc., publiés depuis son entrée au Parlement en 1867 / [compilation par A. de Bonneterre]. | [v2](./artifacts/r1-f3/spot-check/05-work-116-v2.png) | [v3](./artifacts/r1-f3/spot-check/05-work-116-v3.png) | Agent spot-check OK; user verdict pending |
| 6 | Work | 207 | Respect aux vieillards / par F.P.B. | [v2](./artifacts/r1-f3/spot-check/06-work-207-v2.png) | [v3](./artifacts/r1-f3/spot-check/06-work-207-v3.png) | Agent spot-check OK; user verdict pending |
| 7 | Work | 470 | Notice sur la famille Guy, et sur quelques autres familles. | [v2](./artifacts/r1-f3/spot-check/07-work-470-v2.png) | [v3](./artifacts/r1-f3/spot-check/07-work-470-v3.png) | Agent spot-check OK; user verdict pending |
| 8 | Periodical | 1 | (titre vide) | [v2](./artifacts/r1-f3/spot-check/08-periodical-1-v2.png) | [v3](./artifacts/r1-f3/spot-check/08-periodical-1-v3.png) | Agent spot-check OK; user verdict pending |
| 9 | Periodical | 10 | La revue franciscaine puis Petite revue du tiers Ordre et de Saint-François. | [v2](./artifacts/r1-f3/spot-check/09-periodical-10-v2.png) | [v3](./artifacts/r1-f3/spot-check/09-periodical-10-v3.png) | Agent spot-check OK; user verdict pending |
| 10 | Periodical | 17 | The Journal of agriculture illustrated / Department of Agriculture for the Province of Quebec | [v2](./artifacts/r1-f3/spot-check/10-periodical-17-v2.png) | [v3](./artifacts/r1-f3/spot-check/10-periodical-17-v3.png) | Agent spot-check OK; user verdict pending |

## Deltas Presented for Sign-off

See [DELTAS.md](./DELTAS.md).

## User Verdict

Signed off by user on 2026-07-10.

## Release Actions

| Action | Status |
| --- | --- |
| User signs off R1 | Complete |
| R1 tag created | Pending |
| `PLAN.md` updated with D5 status and release notes | Pending |
| R2 elaboration session scheduled | Pending |
