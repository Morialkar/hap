import { isTauri } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import Database from '@tauri-apps/plugin-sql';
import type {
  LocalPlatformProbe,
  SqliteProbeResult,
  VaultCapabilityResult,
  VaultProbeResult,
} from '@hap/core';

const SPIKE_VALUE = 'hap-r3-a-sqlite-persistence';
const SPIKE_FILE = 'hap-r3-a-vault-probe.md';

export const tauriSpikeProbe: LocalPlatformProbe = {
  isAvailable: () => isTauri(),

  async verifySqlitePersistence(): Promise<SqliteProbeResult> {
    const database = await Database.load('sqlite:hap-r3-a-spike.sqlite');

    try {
      await database.execute(
        'CREATE TABLE IF NOT EXISTS spike_probe (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL)'
      );
      await database.execute('INSERT OR REPLACE INTO spike_probe (id, value) VALUES (1, $1)', [
        SPIKE_VALUE,
      ]);
    } finally {
      await database.close();
    }

    const reopened = await Database.load('sqlite:hap-r3-a-spike.sqlite');
    try {
      const rows = await reopened.select<Array<{ value: string }>>(
        'SELECT value FROM spike_probe WHERE id = 1'
      );
      const value = rows[0]?.value;
      if (value !== SPIKE_VALUE) {
        throw new Error('SQLite probe value was not persisted after reopening the database.');
      }

      return { value, persisted: true };
    } finally {
      await reopened.close();
    }
  },

  async recordProbeVerdict(probe: string, verdict: unknown): Promise<void> {
    const database = await Database.load('sqlite:hap-r3-a-spike.sqlite');
    try {
      await database.execute(
        'CREATE TABLE IF NOT EXISTS probe_verdicts (probe TEXT PRIMARY KEY, verdict TEXT NOT NULL, recorded_at TEXT NOT NULL)'
      );
      await database.execute(
        'INSERT OR REPLACE INTO probe_verdicts (probe, verdict, recorded_at) VALUES ($1, $2, $3)',
        [probe, JSON.stringify(verdict), new Date().toISOString()]
      );
    } finally {
      await database.close();
    }
  },

  /**
   * Runs without interaction, so the mobile targets can be checked by a smoke script.
   *
   * The desktop vault hands the user an arbitrary folder. Mobile may not allow that at
   * all, and the spec requires recording the constraint rather than pretending desktop
   * semantics carry over — so this reports both what app-scoped storage can do and
   * whether a directory picker exists.
   */
  async probeVaultCapability(): Promise<VaultCapabilityResult> {
    let appScopedWrite: VaultCapabilityResult['appScopedWrite'] = null;
    const notes: string[] = [];

    try {
      const { writeTextFile, readTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
      const contents = '# HAP R3-A vault capability\n\nEcriture UTF-8 en stockage applicatif.\n';
      await writeTextFile(SPIKE_FILE, contents, { baseDir: BaseDirectory.AppData });
      const readBack = await readTextFile(SPIKE_FILE, { baseDir: BaseDirectory.AppData });
      appScopedWrite = { path: `AppData/${SPIKE_FILE}`, roundTrip: readBack === contents };
    } catch (error) {
      notes.push(`app-scoped write failed: ${error instanceof Error ? error.message : error}`);
    }

    // A directory picker that is missing usually rejects immediately; one that exists
    // would block on UI, which a smoke run must not do. Time-box it either way.
    // Both branches below assign it, so an initial value would be dead.
    let directoryPicker: VaultCapabilityResult['directoryPicker'];
    try {
      const picked = await Promise.race([
        open({ directory: true, multiple: false, title: 'Capability probe' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('__ui_shown__')), 2500)),
      ]);
      directoryPicker = 'supported';
      notes.push(`picker returned ${JSON.stringify(picked)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === '__ui_shown__') {
        // It opened and is waiting for a human: the capability exists.
        directoryPicker = 'supported';
        notes.push('picker opened and awaited interaction');
      } else {
        directoryPicker = 'unsupported';
        notes.push(`picker rejected: ${message}`);
      }
    }

    return { appScopedWrite, directoryPicker, detail: notes.join(' | ') };
  },

  async selectVaultDirectory(): Promise<string | null> {
    const result = await open({
      directory: true,
      multiple: false,
      title: 'Choisir le dossier du vault de test',
    });
    return typeof result === 'string' ? result : null;
  },

  async writeVaultProbe(directory: string): Promise<VaultProbeResult> {
    const path = await join(directory, SPIKE_FILE);
    const contents = '# HAP R3-A vault probe\n\nCette fiche confirme l’écriture locale UTF-8.\n';
    await writeTextFile(path, contents);
    const persistedContents = await readTextFile(path);

    if (persistedContents !== contents) {
      throw new Error('Vault probe contents did not round-trip from the selected directory.');
    }

    return { path, contents: persistedContents };
  },
};
