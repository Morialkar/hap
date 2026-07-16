import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  execute: vi.fn(),
  isTauri: vi.fn(),
  join: vi.fn(),
  load: vi.fn(),
  open: vi.fn(),
  readTextFile: vi.fn(),
  select: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ isTauri: mocks.isTauri }));
vi.mock('@tauri-apps/api/path', () => ({ join: mocks.join }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }));
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: mocks.readTextFile,
  writeTextFile: mocks.writeTextFile,
}));
vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load: mocks.load } }));

import { tauriSpikeProbe } from '../tauriSpikeProbe';

describe('tauriSpikeProbe', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.isTauri.mockReturnValue(true);
    mocks.execute.mockResolvedValue({ rowsAffected: 1 });
    mocks.close.mockResolvedValue(true);
    mocks.load.mockResolvedValue({
      close: mocks.close,
      execute: mocks.execute,
      select: mocks.select,
    });
  });

  test('writes and reads the SQLite fixture after reopening the database', async () => {
    mocks.select.mockResolvedValue([{ value: 'hap-r3-a-sqlite-persistence' }]);

    await expect(tauriSpikeProbe.verifySqlitePersistence()).resolves.toEqual({
      persisted: true,
      value: 'hap-r3-a-sqlite-persistence',
    });

    expect(mocks.load).toHaveBeenCalledTimes(2);
    expect(mocks.execute).toHaveBeenCalledWith(
      'INSERT OR REPLACE INTO spike_probe (id, value) VALUES (1, $1)',
      ['hap-r3-a-sqlite-persistence']
    );
    expect(mocks.close).toHaveBeenCalledTimes(2);
  });

  test('writes and reads the UTF-8 vault fixture in the selected directory', async () => {
    mocks.join.mockResolvedValue('/vault/hap-r3-a-vault-probe.md');
    mocks.readTextFile.mockResolvedValue('# HAP R3-A vault probe\n\nCette fiche confirme l’écriture locale UTF-8.\n');

    await expect(tauriSpikeProbe.writeVaultProbe('/vault')).resolves.toEqual({
      contents: '# HAP R3-A vault probe\n\nCette fiche confirme l’écriture locale UTF-8.\n',
      path: '/vault/hap-r3-a-vault-probe.md',
    });

    expect(mocks.writeTextFile).toHaveBeenCalledWith(
      '/vault/hap-r3-a-vault-probe.md',
      '# HAP R3-A vault probe\n\nCette fiche confirme l’écriture locale UTF-8.\n'
    );
  });
});
