import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '../contexts/I18nContext';
import { apiClient } from '../lib/apiClient';
import type { ApiRecordData, ApiValue } from '../lib/apiTypes';
import { LoadingSpinner } from './LoadingSpinner';
import { formatDistanceToNow } from 'date-fns';

interface HistoryLog {
  id: number;
  action: 'create' | 'update' | 'delete' | 'restore';
  changes: {
    data?: ApiRecordData;
    diff?: Record<
      string,
      | { type: 'added'; new: ApiValue }
      | { type: 'changed'; old: ApiValue; new: ApiValue }
      | { type: 'removed'; old: ApiValue }
    >;
    version?: number;
    new_version?: number;
  };
  user: {
    id: string;
    name: string;
  };
  created_at: string;
}

interface RecordHistoryPanelProps {
  recordId: string;
  onRestoreSuccess: () => void;
}

export function RecordHistoryPanel({ recordId, onRestoreSuccess }: RecordHistoryPanelProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const historyQuery = useQuery<{ data: HistoryLog[] }, Error>({
    queryKey: ['records-history', recordId],
    queryFn: () => apiClient.get(`/records/${recordId}/history`),
    enabled: !!recordId,
  });

  const restoreMutation = useMutation({
    mutationFn: (logId: number) =>
      apiClient.post(`/records/${recordId}/restore-version`, {
        log_id: logId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      onRestoreSuccess();
    },
  });

  if (historyQuery.isLoading) {
    return (
      <div className="d-flex justify-content-center py-4">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  const logs = historyQuery.data?.data || [];

  return (
    <div className="vstack gap-3" data-testid="history-panel">
      <h4 className="mb-0 d-flex align-items-center gap-2">
        <i className="ti ti-history text-muted" />
        {t('records.history.title')}
      </h4>

      {logs.length === 0 ? (
        <p className="text-muted small my-3">{t('records.history.empty')}</p>
      ) : (
        <div className="list-group list-group-flush border rounded overflow-hidden">
          {logs.map((log) => {
            const dateText = formatDistanceToNow(new Date(log.created_at), { addSuffix: true });
            return (
              <div key={log.id} className="list-group-item p-3" data-testid={`history-item-${log.id}`}>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <span className="badge bg-secondary-subtle text-secondary me-2">
                      {t(`records.history.action.${log.action}`)}
                    </span>
                    <span className="small text-muted">{dateText}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-xs py-0 px-2"
                    onClick={() => restoreMutation.mutate(log.id)}
                    disabled={restoreMutation.isPending}
                    data-testid={`restore-version-btn-${log.id}`}
                  >
                    {t('records.history.restore')}
                  </button>
                </div>

                <div className="small text-muted mb-2">
                  <i className="ti ti-user me-1" />
                  {log.user.name}
                </div>

                {/* Diff summary rendering */}
                <div className="border-start ps-2 py-1 small text-secondary bg-light-subtle">
                  {log.action === 'create' && log.changes.data && (
                    <div>Initialized with {Object.keys(log.changes.data).length} fields</div>
                  )}

                  {log.action === 'update' && log.changes.diff && (
                    <ul className="list-unstyled mb-0 vstack gap-1">
                      {Object.entries(log.changes.diff).map(([field, details]) => {
                        if (details.type === 'added') {
                          return (
                            <li key={field}>
                              <span className="text-success fw-medium">+ {field}</span>:{' '}
                              {String(details.new)}
                            </li>
                          );
                        }
                        if (details.type === 'changed') {
                          return (
                            <li key={field}>
                              <span className="text-warning fw-medium">~ {field}</span>:{' '}
                              <del className="text-muted">{String(details.old)}</del> &rarr;{' '}
                              <span className="text-dark">{String(details.new)}</span>
                            </li>
                          );
                        }
                        if (details.type === 'removed') {
                          return (
                            <li key={field}>
                              <span className="text-danger fw-medium">- {field}</span> (was:{' '}
                              {String(details.old)})
                            </li>
                          );
                        }
                        return null;
                      })}
                    </ul>
                  )}

                  {log.action === 'restore' && (
                    <div>Restored to version {log.changes.version || 'previous'}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
