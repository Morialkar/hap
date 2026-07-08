import { useQuery } from '@tanstack/react-query';
import { useI18n } from '../contexts/I18nContext';
import { apiClient } from '../lib/apiClient';
import { type BuilderField } from '../lib/fieldTypes';
import { RecordForm } from './RecordForm';
import { LoadingSpinner } from './LoadingSpinner';

interface Table {
  id: string;
  name: string;
  database_id: string;
}

interface InlineRecordModalProps {
  tableId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (record: { id: string; name: string }) => void;
}

export function InlineRecordModal({ tableId, isOpen, onClose, onSuccess }: InlineRecordModalProps) {
  const { t } = useI18n();

  // Fetch the target table details
  const tableQuery = useQuery<Table, Error>({
    queryKey: ['tables', tableId],
    queryFn: () => apiClient.get(`/tables/${tableId}`),
    enabled: isOpen && !!tableId,
  });

  // Fetch the fields schema for this target table
  const fieldsQuery = useQuery<BuilderField[], Error>({
    queryKey: ['fields', tableId],
    queryFn: () => apiClient.get(`/fields?table_id=${tableId}`),
    enabled: isOpen && !!tableId,
  });

  if (!isOpen) return null;

  const isLoading = tableQuery.isLoading || fieldsQuery.isLoading;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1060 }} />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" style={{ zIndex: 1070 }}>
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header border-bottom-0 pb-0">
              <h5 className="modal-title">
                {t('records.inlineCreate.title')}{' '}
                {tableQuery.data ? `(${tableQuery.data.name})` : ''}
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label={t('common.close')}
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              {isLoading ? (
                <div className="d-flex justify-content-center p-4">
                  <LoadingSpinner size="md" />
                </div>
              ) : fieldsQuery.data ? (
                <RecordForm
                  tableId={tableId}
                  fields={fieldsQuery.data}
                  isInline
                  onCancel={onClose}
                  onSaveSuccess={(record) => {
                    // Extract a display name: try fields like "name", "title", "nom", "titre"
                    const rData = record.data || {};
                    const displayName =
                      rData.name ||
                      rData.title ||
                      rData.nom ||
                      rData.titre ||
                      Object.values(rData)[0] ||
                      record.id;

                    onSuccess({
                      id: record.id,
                      name: String(displayName),
                    });
                  }}
                />
              ) : (
                <div className="text-center text-muted py-3">Error loading fields schema.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
