# E2E Journeys

The R0-S4 journeys are adapter-based. The same specs run against either the
legacy v2 capsule or the v3 HAP platform.

## v2 Capsule

```bash
npm test
```

By default, Playwright targets `http://localhost:8056` with `E2E_TARGET=v2`.

## v3 Platform

Run against already-started API and client servers:

```bash
E2E_TARGET=v3 npm test
```

Defaults:

- client: `http://127.0.0.1:15173`
- API: `http://127.0.0.1:18080`

Run with local web servers managed by Playwright:

```bash
E2E_TARGET=v3 E2E_V3_WEB_SERVER=1 npm test
```

## v3 Bootstrap

This resets the configured Laravel database and imports the canonical Eusèbe SQL
dump before running journeys:

```bash
E2E_TARGET=v3 E2E_V3_BOOTSTRAP=1 E2E_V3_WEB_SERVER=1 npm test
```

`E2E_V3_BOOTSTRAP=1` is intentionally opt-in because it runs
`php artisan migrate:fresh --seed --force`.

Optional variables:

- `EUSEBE_SQL_PATH`: path to `eusebe.sql`; default `/Users/nao/Eusebe/sql/eusebe.sql`
- `E2E_V3_API_PORT`: managed API server port; default `18080`
- `E2E_V3_CLIENT_PORT`: managed client server port and v3 base URL; default `15173`
- `E2E_V3_EMAIL`: login email; default `test@example.com`
- `E2E_V3_PASSWORD`: login password; default `password`
