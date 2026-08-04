import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { tauriSpikeProbe } from '../lib/tauriSpikeProbe';
import { runOfflineMapProbe } from '../lib/offlineMapProbe';

export const Route = createFileRoute('/tauri-spike')({
  component: TauriSpikePage,
});

function TauriSpikePage() {
  const [sqliteResult, setSqliteResult] = useState<string>('Non exécuté');
  const [vaultResult, setVaultResult] = useState<string>('Non exécuté');
  const [mapResult, setMapResult] = useState<string>('Non exécuté');
  const [isMapRunning, setIsMapRunning] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const isNative = tauriSpikeProbe.isAvailable();

  // The map proof runs in the webview, so unlike the two native probes it is also
  // meaningful in a plain browser; that is what makes it comparable across targets.
  const verifyOfflineMap = useCallback(async () => {
    if (!mapContainerRef.current) return;
    setIsMapRunning(true);
    setMapResult('Rendu en cours…');
    try {
      const result = await runOfflineMapProbe(mapContainerRef.current);
      if (result.sourceFeatures === 0) {
        setMapResult('Échec : aucune entité décodée depuis l’archive embarquée.');
        return;
      }
      const blocked =
        result.blockedRequests.length === 0
          ? 'aucune ressource réseau demandée'
          : `${result.blockedRequests.length} ressource(s) réseau refusée(s) : ${result.blockedRequests.join(', ')}`;
      const painted =
        result.renderedFeatures === null
          ? 'peinture non observable ici (rAF suspendu)'
          : `${result.renderedFeatures} entités peintes`;
      setMapResult(
        `Hors-ligne : ${result.sourceFeatures} entités décodées depuis ${result.fixtureUrl}; ${painted}; ${blocked}.`
      );
    } catch (error) {
      setMapResult(`Erreur carte : ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsMapRunning(false);
    }
  }, []);

  // Unattended run for the target matrix: the Windows, iOS and Android smoke scripts
  // cannot click, so the map probe runs on load and records its verdict where a
  // harness can read it back — the spike database, plus a JSON file when the
  // filesystem scope allows it.
  useEffect(() => {
    if (!isNative) return;
    void (async () => {
      if (!mapContainerRef.current) return;
      // Range support is the thing PMTiles depends on: it reads a header, then a
      // directory, then individual tiles, all as byte ranges of one file.
      const rangeCheck: Record<string, unknown> = {};
      try {
        const probeUrl = new URL('/fixtures/r3a-countries.pmtiles', window.location.href).href;
        const ranged = await fetch(probeUrl, { headers: { Range: 'bytes=0-126' } });
        const body = await ranged.arrayBuffer();
        rangeCheck.status = ranged.status;
        rangeCheck.contentRange = ranged.headers.get('Content-Range');
        rangeCheck.bytes = body.byteLength;
        rangeCheck.magic = new TextDecoder().decode(new Uint8Array(body, 0, 7));
      } catch (error) {
        rangeCheck.error = error instanceof Error ? error.message : String(error);
      }

      // Every step is bounded and recorded before the map runs, so a hang in one of
      // them still leaves evidence behind instead of an empty table.
      const withTimeout = <T,>(label: string, work: Promise<T>, ms = 8000): Promise<T> =>
        Promise.race([
          work,
          new Promise<T>((_, reject) =>
            window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
          ),
        ]);

      const nativeRead: Record<string, unknown> = {};
      try {
        const { resolveResource } = await import('@tauri-apps/api/path');
        const path = await withTimeout(
          'resolveResource',
          resolveResource('fixtures/r3a-countries.pmtiles')
        );
        nativeRead.path = path;

        const { TauriFileSource } = await import('../lib/tauriPmtilesSource');
        const source = new TauriFileSource(path);

        const head = await withTimeout('getBytes(0,127)', source.getBytes(0, 127));
        nativeRead.headerBytes = head.data.byteLength;
        nativeRead.magic = new TextDecoder().decode(new Uint8Array(head.data, 0, 7));

        const { PMTiles } = await import('pmtiles');
        const archive = new PMTiles(source);
        const header = await withTimeout('getHeader', archive.getHeader());
        nativeRead.maxZoom = header.maxZoom;

        const tile = await withTimeout('getZxy(2,1,1)', archive.getZxy(2, 1, 1));
        nativeRead.sampleTileBytes = tile?.data.byteLength ?? 0;
      } catch (error) {
        nativeRead.error = error instanceof Error ? error.message : String(error);
      }

      await tauriSpikeProbe
        .recordProbeVerdict('offline-map-diagnostics', { rangeCheck, nativeRead })
        .catch(() => {});

      let payload: Record<string, unknown>;
      try {
        payload = {
          ok: true,
          rangeCheck,
          nativeRead,
          ...(await runOfflineMapProbe(mapContainerRef.current)),
        };
      } catch (error) {
        payload = {
          ok: false,
          rangeCheck,
          nativeRead,
          error: error instanceof Error ? error.message : String(error),
        };
      }
      setMapResult(JSON.stringify(payload));
      await tauriSpikeProbe.recordProbeVerdict('offline-map', payload).catch(() => {
        // Recording is best effort; the on-screen result stays authoritative.
      });
    })();
  }, [isNative]);

  const verifySqlite = async () => {
    try {
      const result = await tauriSpikeProbe.verifySqlitePersistence();
      setSqliteResult(result.persisted ? `Persisté : ${result.value}` : 'Échec de persistance');
    } catch (error) {
      setSqliteResult(`Erreur SQLite : ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const verifyVault = async () => {
    try {
      const directory = await tauriSpikeProbe.selectVaultDirectory();
      if (!directory) {
        setVaultResult('Sélection annulée');
        return;
      }

      const result = await tauriSpikeProbe.writeVaultProbe(directory);
      setVaultResult(`Écrit et relu : ${result.path}`);
    } catch (error) {
      setVaultResult(`Erreur vault : ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <main className="container py-5" data-testid="tauri-spike-page">
      <h1 className="h3">HAP R3-A — Tauri Spike</h1>
      <p className="text-muted">
        Preuves natives isolées; aucune donnée HAP de production n’est écrite.
      </p>

      {!isNative && (
        <div className="alert alert-warning">Cette page doit être ouverte dans Tauri.</div>
      )}

      <section className="card mb-3">
        <div className="card-body">
          <h2 className="h5">SQLite</h2>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isNative}
            onClick={verifySqlite}
          >
            Vérifier l’écriture et la réouverture
          </button>
          <output className="d-block mt-2" data-testid="sqlite-spike-result">
            {sqliteResult}
          </output>
        </div>
      </section>

      <section className="card">
        <div className="card-body">
          <h2 className="h5">Vault Markdown</h2>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isNative}
            onClick={verifyVault}
          >
            Choisir un dossier et écrire la sonde
          </button>
          <output className="d-block mt-2" data-testid="vault-spike-result">
            {vaultResult}
          </output>
        </div>
      </section>
      <section className="card mt-3">
        <div className="card-body">
          <h2 className="h5">Carte hors-ligne (PMTiles)</h2>
          <p className="text-muted small mb-2">
            Archive Natural Earth embarquée; tout accès réseau est bloqué pendant le rendu.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={isMapRunning}
            onClick={verifyOfflineMap}
          >
            Rendre la carte sans réseau
          </button>
          <output className="d-block mt-2" data-testid="map-spike-result">
            {mapResult}
          </output>
          <div
            ref={mapContainerRef}
            data-testid="map-spike-container"
            className="mt-3 border rounded"
            style={{ height: 320 }}
          />
        </div>
      </section>
    </main>
  );
}
