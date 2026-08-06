import { createFileRoute, useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '../contexts/RepositoryContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { useState } from 'react';

export const Route = createFileRoute('/shares/$databaseId')({
  component: SharesManagement,
});

interface ShareItem {
  id: string;
  name: string;
  token: string;
  target_type: 'record' | 'view' | 'report';
  target_id: string;
  target_name: string;
  expires_at: string | null;
  created_at: string;
  is_expired: boolean;
}

interface Database {
  id: string;
  name: string;
}

function SharesManagement() {
  const { databaseId } = useParams({ from: '/shares/$databaseId' });
  const queryClient = useQueryClient();
  const repository = useRepository();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch Database details
  const databaseQuery = useQuery<Database, Error>({
    queryKey: ['database', databaseId],
    queryFn: () => repository.databases.get(databaseId),
  });

  // Fetch Shares list
  const sharesQuery = useQuery<ShareItem[], Error>({
    queryKey: ['shares', databaseId],
    queryFn: () => repository.shares.listByDatabase(databaseId),
  });

  // Mutation to Revoke (delete) Share link
  const revokeShareMutation = useMutation({
    mutationFn: (shareId: string) => repository.shares.remove(shareId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', databaseId] });
    },
  });

  const handleCopy = async (share: ShareItem) => {
    const fullLink = `${window.location.origin}/public-shares/${share.token}`;
    try {
      await navigator.clipboard.writeText(fullLink);
      setCopiedId(share.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const isLoading = databaseQuery.isLoading || sharesQuery.isLoading;

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const shares = sharesQuery.data || [];

  return (
    <div className="vstack gap-4">
      <PageHeader
        title="Gestion des partages"
        description={`Base de données : ${databaseQuery.data?.name || ''}`}
      />

      <SurfaceCard>
        <div className="card-header pb-0 border-bottom-0">
          <h3 className="card-title fw-bold">Liens de partage actifs</h3>
        </div>
        <div className="card-body">
          {shares.length === 0 ? (
            <EmptyState
              icon="share"
              title="Aucun lien de partage"
              description="Générez des liens de partage sécurisés depuis le détail d'une fiche, d'une vue de table ou d'un rapport."
            />
          ) : (
            <div className="table-responsive">
              <table className="table table-vcenter card-table table-hover">
                <thead>
                  <tr>
                    <th>Nom / Description</th>
                    <th>Cible</th>
                    <th>Jeton</th>
                    <th>Création</th>
                    <th>Expiration</th>
                    <th>Statut</th>
                    <th className="w-1">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shares.map((share) => {
                    const fullLink = `${window.location.origin}/public-shares/${share.token}`;
                    return (
                      <tr key={share.id}>
                        <td>
                          <div className="font-weight-medium fw-bold">{share.name}</div>
                        </td>
                        <td className="text-muted">
                          <div className="d-flex align-items-center gap-1 small">
                            {share.target_type === 'record' && (
                              <>
                                <i className="ti ti-file-text text-primary" />
                                Fiche : {share.target_name}
                              </>
                            )}
                            {share.target_type === 'view' && (
                              <>
                                <i className="ti ti-layout-grid text-success" />
                                Disposition : {share.target_name}
                              </>
                            )}
                            {share.target_type === 'report' && (
                              <>
                                <i className="ti ti-report text-warning" />
                                Rapport : {share.target_name}
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <div
                            className="input-group input-group-flat"
                            style={{ maxWidth: '280px' }}
                          >
                            <input
                              type="text"
                              className="form-control form-control-sm bg-light text-truncate"
                              readOnly
                              value={fullLink}
                            />
                            <span className="input-group-text p-0">
                              <button
                                type="button"
                                className="btn btn-sm btn-ghost-secondary p-1 border-0"
                                onClick={() => handleCopy(share)}
                                title="Copier"
                              >
                                {copiedId === share.id ? (
                                  <i className="ti ti-check text-success" />
                                ) : (
                                  <i className="ti ti-copy" />
                                )}
                              </button>
                            </span>
                          </div>
                        </td>
                        <td className="small text-muted">
                          {new Date(share.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="small text-muted">
                          {share.expires_at ? (
                            new Date(share.expires_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          ) : (
                            <span className="text-muted small">Jamais</span>
                          )}
                        </td>
                        <td>
                          {share.is_expired ? (
                            <span className="badge bg-danger-subtle text-danger">Expiré</span>
                          ) : (
                            <span className="badge bg-success-subtle text-success">Actif</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Voulez-vous révoquer ce lien de partage ? Toute personne l'utilisant perdra l'accès immédiatement."
                                )
                              ) {
                                revokeShareMutation.mutate(share.id);
                              }
                            }}
                          >
                            <i className="ti ti-trash me-1" />
                            Révoquer
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SurfaceCard>
    </div>
  );
}
