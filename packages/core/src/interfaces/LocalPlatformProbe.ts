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
  transport: 'tauri-fs' | 'http';
}

export interface LocalPlatformProbe {
  isAvailable(): boolean;
  verifySqlitePersistence(): Promise<SqliteProbeResult>;
  selectVaultDirectory(): Promise<string | null>;
  writeVaultProbe(directory: string): Promise<VaultProbeResult>;
  /** Persists a probe verdict so unattended smoke runs can be read back later. */
  recordProbeVerdict(probe: string, verdict: unknown): Promise<void>;
}
