# Heritage Archives Patrimoine (HAP)

[![CI](https://github.com/Morialkar/hap/actions/workflows/ci.yml/badge.svg)](https://github.com/Morialkar/hap/actions/workflows/ci.yml)

> A platform for cataloguing and preserving literary and cultural heritage collections.

HAP is an open-source, self-hostable web application for building structured heritage databases — works, authors, periodicals, and any other collection you define. It is the modern successor to the 2012 Éusèbe Sénécal literary heritage database.

## Status

**Pre-alpha — active development.** R0 groundwork complete; R1 platform core in progress.

See [PLAN.md](PLAN.md) for the full architecture record and release plan.

## Architecture

- **API:** Laravel 12 / PHP 8.4+ / PostgreSQL 16 + PostGIS
- **Client:** React + TypeScript / TanStack Router + Query / Tabler UI
- **Desktop (R3):** Tauri 2 wrapper (planned)
- **License:** AGPL-3.0

## Quickstart

### Prerequisites
- Docker + Docker Compose v2
- pnpm ≥ 9
- PHP 8.4+ + Composer 2 (for local artisan commands; optional if using Docker only)

### 1. Clone & install JS dependencies

```bash
git clone git@github.com:Morialkar/hap.git
cd hap
pnpm install
```

### 2. Configure the API

```bash
cp apps/api/.env.example apps/api/.env
# Generate app key (or let the Docker entrypoint do it):
php apps/api/artisan key:generate
```

### 3. Start the dev stack

One command starts the Docker API stack, runs migrations, and starts the Vite client:

```bash
pnpm dev:stack
```

Default URLs:

- Client: http://127.0.0.1:5173
- API: http://localhost:8080/api/v1/ping
- Mailpit: http://localhost:8025

Useful options:

```bash
pnpm dev:stack:fresh
pnpm dev:stack -- --fresh --import-eusebe
```

`--import-eusebe` reads `EUSEBE_DUMP_PATH` when set, otherwise it uses
`/Users/nao/Eusebe/sql/eusebe.sql`.

Stop the Docker services when you are done:

```bash
docker compose -f docker/compose.yml down
```

Manual Docker-only startup is still available:

```bash
cd docker
cp .env.example .env          # adjust ports if needed
docker compose up --build -d
docker compose exec app php artisan migrate
```

### 4. Verify

```bash
curl http://localhost:8080/api/v1/ping
# → {"status":"ok","service":"Heritage Archives Patrimoine API","version":"1"}
```

### 5. Run API tests (from repo root)

```bash
cd apps/api && ./vendor/bin/pest
```

Mailpit UI: http://localhost:8025

## License

Copyright © 2026 Naomi Gilbert. Licensed under the [GNU Affero General Public License v3.0](LICENSE).
