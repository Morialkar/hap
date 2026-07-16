export interface SqliteProbeResult {
  value: string;
  persisted: boolean;
}

export interface VaultProbeResult {
  path: string;
  contents: string;
}

export interface LocalPlatformProbe {
  isAvailable(): boolean;
  verifySqlitePersistence(): Promise<SqliteProbeResult>;
  selectVaultDirectory(): Promise<string | null>;
  writeVaultProbe(directory: string): Promise<VaultProbeResult>;
}
