import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { tauriSpikeProbe } from '../lib/tauriSpikeProbe';

export const Route = createFileRoute('/tauri-spike')({
  component: TauriSpikePage,
});

function TauriSpikePage() {
  const [sqliteResult, setSqliteResult] = useState<string>('Non exécuté');
  const [vaultResult, setVaultResult] = useState<string>('Non exécuté');
  const isNative = tauriSpikeProbe.isAvailable();

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
    </main>
  );
}
