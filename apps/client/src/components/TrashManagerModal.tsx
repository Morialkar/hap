import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '../contexts/I18nContext';
import { apiClient } from '../lib/apiClient';
import type { ApiErrorLike, ApiRecordData, DeleteConflictData } from '../lib/apiTypes';
import { LoadingSpinner } from './LoadingSpinner';

interface TrashManagerModalProps {
  tableId: string;
  isOpen: boolean;
  onClose: () => void;
  onDeleteConflict: (recordId: string, conflictData: DeleteConflictData) => void;
}

interface TrashedRecord {
  id: string;
  table_id: string;
  data: ApiRecordData;
  deleted_at: string;
}

export function TrashManagerModal({
  tableId,
  isOpen,
  onClose,
  onDeleteConflict,
}: TrashManagerModalProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const trashQuery = useQuery<{ data: TrashedRecord[] }, Error>({
    queryKey: ['records-trash', tableId],
    queryFn: () => apiClient.get(`/records/trash?table_id=${tableId}`),
    enabled: isOpen && !!tableId,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/records/${id}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['records-trash', tableId] });
      queryClient.invalidateQueries({ queryKey: ['records-select'] });
    },
  });

  const purgeMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/records/${id}/purge`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records-trash', tableId] });
    },
    onError: (err: ApiErrorLike, id: string) => {
      if (err.status === 409 && err.data?.reference_counts) {
        // Trigger parent block/reassign delete conflict modal
        onDeleteConflict(id, err.data.reference_counts);
        onClose();
      }
    },
  });

  if (!isOpen) return null;

  const records = trashQuery.data?.data || [];

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" style={{ zIndex: 1045 }}>
        <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="ti ti-trash me-2 text-muted" />
                {t('records.trash.title')}
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label={t('common.close')}
                onClick={onClose}
              />
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {trashQuery.isLoading ? (
                <div className="d-flex justify-content-center p-4">
                  <LoadingSpinner size="md" />
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="ti ti-trash-off fs-1 mb-2 d-block" />
                  <p>{t('records.trash.empty')}</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-vcenter card-table">
                    <thead>
                      <tr>
                        <th>Content Summary</th>
                        <th>Deleted At</th>
                        <th className="w-1" />
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => {
                        const rData = r.data || {};
                        const displayName =
                          rData.name ||
                          rData.title ||
                          rData.nom ||
                          rData.titre ||
                          Object.values(rData)[0] ||
                          r.id;

                        return (
                          <tr key={r.id} data-testid={`trash-item-${r.id}`}>
                            <td>
                              <span className="fw-medium">{String(displayName)}</span>
                              <div className="text-muted small">{r.id}</div>
                            </td>
                            <td>{new Date(r.deleted_at).toLocaleString()}</td>
                            <td>
                              <div className="btn-list flex-nowrap">
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  onClick={() => restoreMutation.mutate(r.id)}
                                  disabled={restoreMutation.isPending}
                                  data-testid={`restore-trash-${r.id}`}
                                >
                                  {t('records.trash.restore')}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => {
                                    if (window.confirm(t('common.confirm'))) {
                                      purgeMutation.mutate(r.id);
                                    }
                                  }}
                                  disabled={purgeMutation.isPending}
                                  data-testid={`purge-trash-${r.id}`}
                                >
                                  {t('records.trash.purge')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} data-testid="trash-close-btn">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
