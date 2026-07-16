import { isTauri } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import Database from '@tauri-apps/plugin-sql';
import type { LocalPlatformProbe, SqliteProbeResult, VaultProbeResult } from '@hap/core';

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

  async selectVaultDirectory(): Promise<string | null> {
    const result = await open({ directory: true, multiple: false, title: 'Choisir le dossier du vault de test' });
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
