# R3-A — Tauri 2 feasibility spike

## AFTER status

- Specification: approved on 2026-07-12.
- Architecture: proposed; implementation is blocked pending explicit approval.
- Implementation scope: R3-A only. R3-B (local driver), R3-C (vault product), and R3-D
  (packaging) remain out of scope.

## Objective

Produce reproducible evidence that the existing React client can run inside Tauri 2 on
macOS, Windows, iOS, and Android with the three capabilities that R3 depends on:

1. a local SQLite database;
2. a user-selected filesystem location for a Markdown vault;
3. an offline MapLibre map backed by a bundled PMTiles archive.

This is a feasibility spike, not a local-first implementation. It must not introduce a
production local repository, sync queue, vault exporter, or installer/update pipeline.

## Timebox and decision record

Recommended timebox: five working days after the architecture is approved.

At the end of the timebox, the evidence bundle records one decision:

- **Go:** all required target/capability combinations pass their smoke tests and the
  platform boundary below remains intact.
- **No-go:** a required native capability is structurally blocked on one of the mobile
  targets, or requires platform-specific domain logic.
- **Conditional go:** desktop passes but a mobile capability is blocked. This is not a
  silent go: it requires a product decision before R3-B begins.

The ratified fallback in D8 is Capacitor for mobile plus Electron for desktop. The
older references to Flutter as the fallback are superseded by that decision.

## Proposed architecture

### Shell boundary

Add a new `apps/desktop` Tauri 2 shell that consumes the existing `apps/client` build.
The React application remains the sole UI implementation. Native calls are exposed
through a narrow TypeScript adapter, never imported from route or component code.

```
apps/client UI
       |
packages/core platform contracts
       |                         |
web adapters                 apps/desktop Tauri adapters
                                  |
                       Rust commands and Tauri plugins
```

The spike may add only the interfaces and a test harness under `packages/core`; its
adapters are disposable proof-of-feasibility code. R3-B/C will turn the validated
interfaces into product services.

### Contracts to prove

```ts
interface LocalDatabaseProbe {
  initialize(): Promise<void>;
  writeFixture(): Promise<void>;
  readFixture(): Promise<{ value: string }>;
  reopenAndReadFixture(): Promise<{ value: string }>;
}

interface VaultProbe {
  selectDirectory(): Promise<string | null>;
  writeProbeFile(directory: string): Promise<{ path: string; contents: string }>;
  readProbeFile(path: string): Promise<string>;
}

interface OfflineMapProbe {
  loadBundledArchive(): Promise<{ center: [number, number]; zoom: number }>;
}
```

The contracts deliberately contain no HAP record, sync, or production vault semantics.

### Native capabilities

| Capability | Tauri boundary | Proof |
| --- | --- | --- |
| SQLite | Tauri SQL plugin or a minimal Rust command | A fixture survives close/reopen. |
| Vault write | Tauri dialog + filesystem plugins | A user-approved folder contains a UTF-8 Markdown probe file whose contents round-trip. |
| Offline map | Client-side MapLibre + a bundled small PMTiles fixture | Map renders after network interception is disabled. |

The PMTiles fixture must be small, redistributable, and limited to the spike. It must
not use OSM tile-server prefetching.

## Target matrix

| Target | Build | SQLite | Vault | Offline PMTiles | Evidence |
| --- | --- | --- | --- | --- | --- |
| macOS | required | required | required | required | CI build plus local smoke run |
| Windows | required | required | required | required | CI build plus automated smoke where available |
| iOS simulator | required | required | capability check | required | simulator smoke and native logs |
| Android emulator | required | required | capability check | required | emulator smoke and native logs |

On mobile, the vault proof may use the operating-system document picker rather than an
arbitrary filesystem path. The architecture must record the resulting UX constraint;
it must not fake desktop semantics.

## Test strategy

1. Type-level tests for the platform contracts in `packages/core`.
2. Rust command tests for SQLite and vault behavior where supported by the Tauri
   harness.
3. A deterministic smoke screen that runs the three probes and exposes machine-readable
   pass/fail output.
4. Desktop WebDriver smoke test against the Tauri shell.
5. iOS and Android emulator smoke scripts; physical-device confirmation is supplemental
   evidence, not a replacement for the scripts.
6. A network-disabled assertion around the PMTiles test.

## Non-functional acceptance checks

- No network request is needed for the map proof.
- The SQLite file and vault probe file are created only in test-controlled locations.
- The app still builds as a normal web client.
- The existing Playwright, Pest, Vitest, lint, and build checks stay green.
- Native plugin versions, platform SDK versions, fixture licence, commands, and test
  output are captured in `docs/R3-A-EVIDENCE.md` during implementation.

## Approval gate

Approve this architecture to begin the timeboxed R3-A implementation. Approval authorizes
the shell, adapters, fixtures, and smoke tests described here; it does not authorize
R3-B, R3-C, R3-D, or any sync/local-first product behavior.
