# HAP Design System

This document records the R1-D6 design system decisions for Heritage Archives
Patrimoine. It is the source of truth for UI implementation until a dedicated
component catalog exists.

## 1. Foundation

- Base UI: Tabler, through `@tabler/core`.
- Ownership boundary: Tabler is declared by `packages/theme`, not by feature routes.
- Client entrypoint: `apps/client/src/styles/app.scss` imports the HAP theme package.
- Custom styles live in `packages/theme/src`.
- React components live in `apps/client/src/components`.
- No jQuery is permitted. Interactive behaviors are React-owned.
- No Maxton files, markup, SCSS, images, or copied implementation may enter the repo.
  Maxton remains a reference-only artifact on the user's machine.

The implemented visual direction is Tabler-native: horizontal navigation, elevated
cards, high-contrast focus states, and a green-tinted dark baseline that can be
combined with any approved accent.

## 2. Appearance and accents

The approved model is not three fixed themes. Users choose:

1. Appearance: `light` or `dark`.
2. Accent: one predefined color.

The legacy `green-dark` value is migrated to `dark` appearance with the default green
accent. This keeps old preferences safe without preserving a separate legacy class.

### Accent palette

| Token | FR label | Intended use |
| --- | --- | --- |
| `heritage-green` | Vert | Default HAP identity accent, based on the v2 green. |
| `lime` | Lime | Brighter green-yellow alternative. |
| `amber` | Ambre | Warm yellow/orange accent. |
| `orange` | Orange | Strong warm accent. |
| `red` | Rouge | Alert-like accent when chosen by the user, not for semantic errors. |
| `rose` | Rose | Soft red/pink accent. |
| `magenta` | Magenta | Saturated pink-purple accent. |
| `violet` | Violet | Purple accent. |
| `indigo` | Indigo | Blue-purple accent. |
| `blue` | Bleu | Classic blue accent. |
| `cyan` | Cyan | Bright blue-green accent. |
| `teal` | Turquoise | Green-blue accent. |

Accent tokens are exposed as CSS variables:

- `--hap-accent`
- `--hap-accent-rgb`
- `--hap-accent-hover`
- `--hap-accent-foreground`
- `--hap-accent-text`
- `--hap-focus`

Tabler's primary and link variables are mapped to these HAP tokens so buttons,
active navigation, links, badges, and focus states remain coherent.

## 3. Shared components

### `AppearanceMenu`

Location: `apps/client/src/components/AppearanceMenu.tsx`

Owns the UI for appearance and accent selection. It writes through `ThemeContext`,
persists to local storage, and updates `data-bs-theme` plus `data-hap-accent` on the
document root.

### `ThemeProvider`

Location: `apps/client/src/contexts/ThemeContext.tsx`

Owns:

- persisted appearance and accent preferences;
- legacy preference migration;
- document root attributes consumed by Tabler and HAP CSS variables.

### `PageHeader` and `PageActions`

Location: `apps/client/src/components/ui/PageHeader.tsx`

Use for every route-level page title. This prevents heading hierarchy drift and keeps
primary actions in a predictable location.

### `SurfaceCard`

Location: `apps/client/src/components/ui/SurfaceCard.tsx`

Use for reusable card surfaces. Current variants:

- `default`: standard Tabler card;
- `toolbar`: list/filter/action surfaces;
- `detail`: side panels and record detail surfaces.

### `EmptyState`

Location: `apps/client/src/components/ui/EmptyState.tsx`

Use whenever a page, list, or panel has no data. Empty states must include a useful
title and explanatory text; actions are optional.

## 4. Component inventory for upcoming R1-D tasks

| Need | Base component strategy | Custom work |
| --- | --- | --- |
| R1-D1 app shell | Tabler horizontal navbar, dropdowns, cards, auth page patterns | React-owned mobile menu and route guard states. |
| R1-D2 form/structure builder | Tabler cards, buttons, forms, alerts, badges | Drag/drop canvas, field palette, destructive-change preview, registry-driven option panels. |
| R1-D3 card layout builder | Tabler cards, button groups, form controls | Column layout editor, draggable field blocks, per-view layout preview. |
| R1-D4 dynamic record forms | Tabler forms, input groups, validation states, modals | Field-type editor registry, inline-create reference modal, upload previews, unsaved-change guard. |
| R1-D5 list/detail views | Tabler tables, cards, buttons, badges, modals | TanStack Table/Virtual integration, record detail layout renderer, delete/reassign flow, history/trash panels. |
| Auth screens | Tabler auth-page layout and form styling | Product copy, return-to behavior, bilingual validation/errors. |
| Empty/loading/error states | `EmptyState`, Tabler spinners/alerts | Route-specific recovery actions and bilingual messages. |

## 5. Accessibility rules

- Every route has exactly one `h1` through `PageHeader`.
- Nested panels use descending heading levels; do not skip from `h1` to `h3`.
- Icon-only buttons need an accessible label.
- Focus must remain visible in both appearances and all accents.
- Links and primary text use `--hap-accent-text`, not raw accent colors, so contrast
  remains legible.
- Automated coverage:
  - Vitest covers preference persistence, shared primitives, and dependency policy.
  - Playwright covers theme persistence, contrast probes, and axe checks on shell and
    list/detail screens.

## 6. Typography and heritage notes

Tabler typography is retained for R1-D6.

FontleroyBrown is deferred until the font-license conclusion is documented in this
repository. Do not add the font, derived assets, or CSS references until that review is
complete.

The v2 heritage nod is the default green accent. Additional heritage-specific visual
treatments should be implemented as HAP tokens/components, not copied from the legacy
application or commercial templates.
