import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '../contexts/I18nContext';
import { apiClient } from '../lib/apiClient';
import type { ApiErrorLike, ApiRecord, DeleteConflictData } from '../lib/apiTypes';
import { LoadingSpinner } from './LoadingSpinner';

interface DeleteReassignModalProps {
  recordId: string;
  tableId: string;
  conflictData: DeleteConflictData;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteReassignModal({
  recordId,
  tableId,
  conflictData,
  onClose,
  onSuccess,
}: DeleteReassignModalProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [targetRecordId, setTargetRecordId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch candidate replacement records (same table, excluding current record)
  const candidatesQuery = useQuery<{ data: ApiRecord[] }, Error>({
    queryKey: ['records-reassign-candidates', tableId],
    queryFn: () => apiClient.get(`/records?table_id=${tableId}&per_page=100`),
  });

  const candidates = useMemo(() => {
    return (candidatesQuery.data?.data || [])
      .filter((r) => r.id !== recordId)
      .map((r) => {
        const rData = r.data || {};
        const label =
          rData.name || rData.title || rData.nom || rData.titre || Object.values(rData)[0] || r.id;
        return { id: r.id, name: String(label) };
      });
  }, [candidatesQuery.data, recordId]);

  const reassignMutation = useMutation({
    mutationFn: async () => {
      // 1. Reassign links to target record B
      await apiClient.post(`/records/${recordId}/reassign-links`, {
        to_record_id: targetRecordId,
      });

      // 2. Perform deletion
      await apiClient.delete(`/records/${recordId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['records-select'] });
      onSuccess();
    },
    onError: (err: ApiErrorLike) => {
      setErrorMsg(err.message || 'Failed to reassign and delete record.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRecordId) return;
    reassignMutation.mutate();
  };

  const tableNames = Object.entries(conflictData.by_table)
    .map(([tbl, count]) => `${tbl} (${count})`)
    .join(', ');

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }} />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" style={{ zIndex: 1060 }}>
        <div className="modal-dialog modal-dialog-centered" role="document">
          <form onSubmit={handleSubmit} className="modal-content border-0 shadow-lg">
            <div className="modal-header">
              <h5 className="modal-title text-danger">
                <i className="ti ti-alert-triangle me-2" />
                {t('records.deleteConflict.title')}
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label={t('common.close')}
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              {errorMsg && (
                <div className="alert alert-danger py-2 px-3 mb-3 small">{errorMsg}</div>
              )}

              <p className="text-muted small mb-4">
                {t('records.deleteConflict.text', {
                  count: conflictData.total,
                  tables: tableNames,
                })}
              </p>

              <div className="mb-3">
                <label className="form-label fw-bold">{t('records.deleteConflict.target')}</label>
                {candidatesQuery.isLoading ? (
                  <div className="d-flex align-items-center gap-2 text-muted small">
                    <LoadingSpinner size="sm" />
                    <span>Loading candidates...</span>
                  </div>
                ) : (
                  <select
                    className="form-select"
                    value={targetRecordId}
                    onChange={(e) => setTargetRecordId(e.target.value)}
                    required
                    data-testid="reassign-select"
                  >
                    <option value="">-- Select --</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="btn btn-danger btn-sm"
                disabled={!targetRecordId || reassignMutation.isPending}
                data-testid="reassign-submit"
              >
                {reassignMutation.isPending ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  t('records.deleteConflict.submit')
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
