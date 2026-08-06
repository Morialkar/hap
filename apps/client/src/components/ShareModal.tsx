import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRepository } from '../contexts/RepositoryContext';

interface ShareModalProps {
  databaseId: string;
  targetType: 'record' | 'view' | 'report';
  targetId: string;
  targetName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({
  databaseId,
  targetType,
  targetId,
  targetName,
  isOpen,
  onClose,
}: ShareModalProps) {
  const repository = useRepository();
  const [shareName, setShareName] = useState('');
  const [expiryOption, setExpiryOption] = useState<'24h' | '7d' | '30d' | 'never'>('never');
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShareName(targetName);
      setShareLink('');
      setCopied(false);
      setExpiryOption('never');
    }
  }, [isOpen, targetName]);

  const generateShareMutation = useMutation({
    mutationFn: async () => {
      let expiresAt: string | null = null;
      if (expiryOption === '24h') {
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      } else if (expiryOption === '7d') {
        expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (expiryOption === '30d') {
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      return repository.shares.create(databaseId, {
        name: shareName || `Partage ${targetType}`,
        target_type: targetType,
        target_id: targetId,
        expires_at: expiresAt,
      });
    },
    onSuccess: (data: any) => {
      const publicLink = `${window.location.origin}/public-shares/${data.token}`;
      setShareLink(publicLink);
    },
  });

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMailTo = () => {
    const subject = encodeURIComponent(`Lien de partage : ${shareName}`);
    const body = encodeURIComponent(
      `Bonjour,\n\nVoici le lien de partage pour consulter cet élément en lecture seule :\n${shareLink}\n\nCordialement.`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1060 }} />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" style={{ zIndex: 1070 }}>
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header">
              <h5 className="modal-title fw-bold text-primary">
                <i className="ti ti-share me-2" />
                Partager cet élément
              </h5>
              <button type="button" className="btn-close" aria-label="Fermer" onClick={onClose} />
            </div>
            <div className="modal-body">
              {!shareLink ? (
                <div className="vstack gap-3">
                  <div className="mb-2 text-muted small">
                    Créez un lien de partage sécurisé en lecture seule pour cet élément (
                    {targetName}).
                  </div>
                  <div>
                    <label className="form-label small fw-bold">Nom du partage</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={shareName}
                      onChange={(e) => setShareName(e.target.value)}
                      placeholder="Nom descriptif"
                    />
                  </div>
                  <div>
                    <label className="form-label small fw-bold">Expiration du lien</label>
                    <select
                      className="form-select form-select-sm"
                      value={expiryOption}
                      onChange={(e) => setExpiryOption(e.target.value as any)}
                    >
                      <option value="never">Jamais (Permanent)</option>
                      <option value="24h">24 heures</option>
                      <option value="7d">7 jours</option>
                      <option value="30d">30 jours</option>
                    </select>
                  </div>
                  <div className="d-flex justify-content-end gap-2 mt-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost-secondary"
                      onClick={onClose}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={generateShareMutation.isPending}
                      onClick={() => generateShareMutation.mutate()}
                    >
                      {generateShareMutation.isPending ? 'Génération...' : 'Générer le lien'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="vstack gap-3">
                  <div className="alert alert-success d-flex align-items-center py-2 px-3 mb-0 small">
                    <i className="ti ti-circle-check-filled me-2" />
                    Lien de partage généré avec succès !
                  </div>
                  <div>
                    <label className="form-label small fw-bold">Lien public sécurisé</label>
                    <div className="input-group">
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        readOnly
                        value={shareLink}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={handleCopy}
                      >
                        {copied ? (
                          <>
                            <i className="ti ti-check text-success me-1" />
                            Copié
                          </>
                        ) : (
                          <>
                            <i className="ti ti-copy me-1" />
                            Copier
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary flex-fill"
                      onClick={handleMailTo}
                    >
                      <i className="ti ti-mail me-1" />
                      Envoyer par e-mail
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost-secondary"
                      onClick={onClose}
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
