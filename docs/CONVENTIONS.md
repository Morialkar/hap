# HAP Conventions

This document defines naming, structure, and workflow conventions for the Heritage Archives Patrimoine (HAP) platform. All subsequent development should reference these conventions.

## 1. Domain Naming Map (EN ↔ FR)

The platform domain entities use the following bilingual naming:

| English | French | Context |
|---------|--------|---------|
| Work | Œuvre | Literary or cultural work |
| Author | Auteur | Creator of a work |
| Periodical | Périodique | Serial publication (newspaper, magazine, journal) |
| Publisher | Éditeur | Publishing house or organization |
| Printer | Imprimeur | Printing press or print shop |
| Location | Lieu | Geographic location (city, region) |
| Genre | Genre | Categorization (fiction, non-fiction, poetry, etc.) |
| Category | Catégorie | Broader classification system |
| Frequency | Fréquence | Publication frequency (daily, weekly, monthly) |

**Usage:**
- Database table names: English singular (e.g., `work`, `author`, `periodical`)
- API resource endpoints: English plural (e.g., `/api/v1/works`, `/api/v1/authors`)
- UI labels: French (primary language of the platform)
- Code identifiers: English (variables, functions, class names)

## 2. Platform Terms Glossary

| Term | Definition | Example |
|------|------------|--------|
| **Workspace** | Top-level container for a user's archives. In R1, workspace membership is owner-only. | "My Literary Archive" |
| **Database** | A user-created archive within a workspace. Contains tables, records, views, reports, and templates. | "19th Century Quebec Press" |
| **Table** | A card type defining a schema (fields, validation). Maps to domain entities (Work, Author, Periodical). | `work` table with fields: title, year, author_id |
| **Field** | A typed, ordered column within a table with options and validation rules. | Text field "title" with max-length 140 |
| **Record** | A JSONB document conforming to its table's field schema. | `{"title": "Les Misérables", "year": 1862}` |
| **View** | Saved presentation configuration: list, card detail, or map. Includes column count and stacked blocks per column. | "Works by Author" card layout |
| **Report** | Saved visual query + output layout. Supports print, PDF, CSV export. | "Annexe B" bibliography report |
| **Template** | Exportable database definition (schema + views + reports, no data). Used to share archive structures. | "Literary Catalog" template |

## 3. API Shape Rules

### Resource Naming
- **Endpoints:** `/api/v1/{resources}` (plural, kebab-case)
  - Example: `/api/v1/works`, `/api/v1/periodicals`
- **Resource IDs:** UUID strings
- **Relationships:** Use dot notation for nested resources
  - Example: `/api/v1/works/{id}/author` (fetch related author)

### Error Envelope
All error responses follow this structure:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The given data was invalid.",
    "details": {
      "title": ["The title field is required."]
    }
  }
}
```

Standard error codes:
- `VALIDATION_FAILED` — Input validation errors
- `NOT_FOUND` — Resource not found
- `UNAUTHORIZED` — Missing or invalid authentication
- `FORBIDDEN` — Insufficient permissions
- `CONFLICT` — Resource state conflict (e.g., concurrent edit)
- `SERVER_ERROR` — Internal server error (500)

### Pagination
List endpoints use cursor-based pagination:

```json
{
  "data": [...],
  "meta": {
    "cursor": "eyJpZCI6IjEyMzQifQ==",
    "limit": 50,
    "hasMore": true
  }
}
```

- Pass `cursor` query param to fetch next page
- Default `limit`: 50, max: 200
- `hasMore` indicates if additional pages exist

## 4. Folder Structure

```
Heritage-Archives-Patrimoine/
├── apps/
│   ├── api/              # Laravel 12 headless API
│   │   ├── app/         # Application code (Controllers, Models, etc.)
│   │   ├── routes/      # API routes (api.php)
│   │   ├── tests/       # Pest tests (Feature, Unit)
│   │   └── database/    # Migrations, seeders
│   └── client/          # React + TypeScript client
│       ├── src/
│       │   ├── routes/  # TanStack Router file-based routes
│       │   ├── lib/     # Utilities, HTTP client
│       │   ├── styles/  # SCSS styles
│       │   └── test/    # Vitest tests
│       └── public/      # Static assets
├── packages/
│   ├── core/            # Shared core: schema engine, validation, ApiClient interface
│   ├── theme/           # Design system (Tabler SCSS overrides)
│   ├── sync/            # Sync logic (R4)
│   └── export/          # Local vault/export formats (R4)
├── docker/              # Docker Compose stack
├── docs/                # Documentation (CONVENTIONS.md, etc.)
└── prompts/             # Epic/task prompts (R1.md, R2.md, etc.)
```

**Conventions:**
- `apps/` — runnable applications
- `packages/` — shared libraries (no entry points)
- `src/` — source code (not `lib/` or `app/`)
- `test/` — co-located with source code (not `tests/` at root)
- TypeScript files use `.ts` / `.tsx` extensions
- SCSS files use `.scss` extension

### Design System
- `docs/DESIGN-SYSTEM.md` defines the R1-D6 UI foundation.
- `packages/theme` owns Tabler imports, HAP design tokens, accent variables, and shared SCSS.
- `apps/client/src/components/ui` contains reusable route/page primitives.
- Feature routes should reuse shared primitives before adding route-local layout markup.

## 5. Testing Conventions

### Contract-First Testing
- **API contracts:** Define expected request/response shapes in test files before implementation
- **Golden tests:** Use fixture snapshots for critical outputs (e.g., report engine SQL)
- **Property-based tests:** Use Vitest's `test.prop()` for schema engine validation

### Test Suite Locations
- **API (Laravel/Pest):**
  - Feature tests: `apps/api/tests/Feature/` — HTTP endpoint tests
  - Unit tests: `apps/api/tests/Unit/` — isolated class/function tests
- **Client (Vitest):**
  - Component tests: `apps/client/src/**/*.test.tsx` — React component tests
  - Unit tests: `apps/client/src/lib/**/*.test.ts` — utility function tests
  - E2E tests: `tests/e2e/` — Playwright tests (R4)

### Test Naming
- Pest: `it('does something', function () { ... })` — descriptive sentences
- Vitest: `test('does something', () => { ... })` — same convention
- File names: `{ComponentName}.test.tsx` or `{feature}.test.ts`

## 6. i18n String Workflow (FR/EN)

**Primary language:** French (FR)
**Secondary language:** English (EN)

### String Extraction
- All user-facing strings in `apps/client` use the i18n library (e.g., `i18next`)
- Strings are defined in `apps/client/src/locales/fr.json` (primary) and `en.json` (secondary)
- Keys use dot notation: `common.save`, `work.title`, `validation.required`

### Adding New Strings
1. Add to `fr.json` first (primary language)
2. Add to `en.json` with translation
3. Use in code: `t('work.title')`

### Missing Translations
- If an EN translation is missing, fall back to FR
- CI should warn about missing EN keys (future R1 task)

### API Responses
- API error messages: FR by default, with `Accept-Language` header support
- Resource field labels: FR (stored in schema definitions)

## 7. Code Style

### PHP (Laravel)
- **Formatter:** Laravel Pint (default config)
- **Static analysis:** Larastan (level 6)
- **Naming:** PascalCase for classes, camelCase for methods, snake_case for database columns

### TypeScript (React)
- **Formatter:** Prettier (single quotes, trailing commas, 100 char width)
- **Linter:** ESLint (recommended + TypeScript rules)
- **Naming:** PascalCase for components, camelCase for functions/variables

### Git Commits
- **Format:** `{scope}: {message}`
- **Scopes:** `api`, `client`, `core`, `theme`, `sync`, `export`, `docs`, `ci`
- **Examples:**
  - `api: add /api/v1/works endpoint`
  - `client: implement work form component`
  - `docs: update API shape rules`
