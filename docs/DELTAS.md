# Collation and Sorting Deltas (v2 vs v3)

This document records the design and behavior differences between the legacy v2 capsule and the v3 Heritage Archives Patrimoine (HAP) platform.

## 1. Database Collation Sorting Differences

The legacy v2 database used MySQL's default collation (typically `utf8_general_ci` or binary), which handles French accent sorting inaccurately. The v3 platform uses correct French Canadian (`fr-CA`) ICU collation rules in production (PostgreSQL) and simple binary collation in local SQLite testing environments.

Because of this, the sorted order of records containing accented characters (e.g. `É`, `À`, `Ç`) will differ across environments:

* **v2 MySQL**: Accented characters are folded (e.g. `É` sorted with `E`) but without full French collation rules.
* **v3 SQLite (Local Testing)**: Accented characters are sorted at the end of the alphabet (after `Z`) because they have higher Unicode code points (binary sorting).
* **v3 PostgreSQL (Production)**: Accented characters are sorted correctly according to `fr-CA` collation rules (e.g. `É` sorted with `E`, with secondary sorting handling the accent position).

### Accepted Parity Deviations

The parity test suite verifies that:
1. The **set of records** returned matches the golden master exactly (no data loss).
2. The sorting order is validated, but any deviations in order due purely to collation rules are accepted and ledgered.

---

## 2. Dynamic Reference Mappings

In the legacy database, lookup values (like authors, categories, genres, etc.) were hardcoded as separate tables with integer foreign keys. In the modern HAP platform, these are dynamic referenced tables inside the user workspace. Their database IDs are dynamically generated ULIDs, and the relationship maps are resolved dynamically at runtime using the `record_links` table.

## 3. Duplicate Display Labels

Some legacy rows have identical display labels while retaining distinct integer IDs:

* `periodiques`: two records titled `Journal d'agriculture illustré`
* `auteurs`: two records displayed as `Dansereau, Clément Arthur`

The v3 adapter validates these as ID sets grouped by display label, instead of matching the first record with that label. This preserves identity while avoiding false negatives caused by duplicate human-readable labels.

## 4. Annex Ordering and Whitespace

The annex contract validates the exact normalized content of each year group. It does not require byte-for-byte row order inside a year group, because v2 ordering depends on legacy MySQL string behavior and v3 ordering depends on the active database collation.

The adapter also normalizes legacy HTML whitespace before punctuation, for example `l'exposition , 8 pages` versus `l'exposition, 8 pages`. These are rendering whitespace differences, not data differences.

## 5. Unknown Legacy Dates

The v2 dump stores unknown dates as `0000-00-00`. The v3 platform normalizes that
sentinel to `unknown` for dynamic date fields. This is an intentional data-quality
delta: the information content is unchanged, but the modern platform no longer
persists invalid calendar dates.
