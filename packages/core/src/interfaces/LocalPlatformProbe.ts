export interface SqliteProbeResult {
  value: string;
  persisted: boolean;
}

export interface VaultProbeResult {
  path: string;
  contents: string;
}

export interface OfflineMapProbeResult {
  /** Features decoded from the bundled archive. Independent of painting. */
  sourceFeatures: number;
  /**
   * Features actually painted. Null when the host never ran an animation frame —
   * a headless or backgrounded webview throttles rAF, which is a property of the
   * environment rather than of the map.
   */
  renderedFeatures: number | null;
  /** Any resource other than the fixture that the map asked for. */
  blockedRequests: string[];
  fixtureUrl: string;
  /** How the archive bytes were obtained: native file reads, or HTTP. */
  transport: "tauri-fs" | "http";
}

export interface VaultCapabilityResult {
  /** A Markdown file written and read back inside app-scoped storage. */
  appScopedWrite: { path: string; roundTrip: boolean } | null;
  /**
   * Whether the platform can hand the app an arbitrary user-chosen directory, which
   * is what the desktop vault relies on.
   */
  directoryPicker: "supported" | "unsupported" | "unknown";
  detail: string;
}

export interface LocalPlatformProbe {
  isAvailable(): boolean;
  verifySqlitePersistence(): Promise<SqliteProbeResult>;
  selectVaultDirectory(): Promise<string | null>;
  writeVaultProbe(directory: string): Promise<VaultProbeResult>;
  /** Persists a probe verdict so unattended smoke runs can be read back later. */
  recordProbeVerdict(probe: string, verdict: unknown): Promise<void>;
  /** Unattended check of what the vault can rely on, per platform. */
  probeVaultCapability(): Promise<VaultCapabilityResult>;
}
