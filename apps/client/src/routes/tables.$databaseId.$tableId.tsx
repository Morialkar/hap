import { createFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { apiClient } from '../lib/apiClient';
import { type BuilderField } from '../lib/fieldTypes';
import { RecordForm } from '../components/RecordForm';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const Route = createFileRoute('/tables/$databaseId/$tableId')({
  component: TableRecordsPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      action: (search.action as string) || undefined,
      recordId: (search.recordId as string) || undefined,
    };
  },
});

interface Table {
  id: string;
  name: string;
  database_id: string;
}

interface Database {
  id: string;
  name: string;
}

interface RecordData {
  id: string;
  table_id: string;
  data: Record<string, any>;
  version: number;
}

function TableRecordsPage() {
  const { databaseId, tableId } = Route.useParams();
  const search = useSearch({ from: '/tables/$databaseId/$tableId' });
  const navigate = useNavigate();
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [isFormDirty, setIsFormDirty] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Read action and recordId from search parameters
  const activeAction = search.action;
  const activeRecordId = search.recordId;

  // Unsaved changes guard (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isFormDirty) {
        e.preventDefault();
        e.returnValue = t('records.unsavedChanges');
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isFormDirty]);

  // Queries
  const databaseQuery = useQuery<Database, Error>({
    queryKey: ['databases', databaseId],
    queryFn: () => apiClient.get(`/databases/${databaseId}`),
  });

  const tableQuery = useQuery<Table, Error>({
    queryKey: ['tables', tableId],
    queryFn: () => apiClient.get(`/tables/${tableId}`),
  });

  const fieldsQuery = useQuery<BuilderField[], Error>({
    queryKey: ['fields', tableId],
    queryFn: () => apiClient.get(`/fields?table_id=${tableId}`),
  });

  const recordsQuery = useQuery<{ data: RecordData[] }, Error>({
    queryKey: ['records', tableId],
    queryFn: () => apiClient.get(`/records?table_id=${tableId}&per_page=100`),
  });

  // Mutations
  const deleteRecordMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/records/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records', tableId] });
      showToast('Record deleted successfully');
    },
  });

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleCloseForm = () => {
    if (isFormDirty && !window.confirm(t('records.unsavedChanges'))) {
      return;
    }
    navigate({
      search: {} as any,
    });
    setIsFormDirty(false);
  };

  const handleSaveSuccess = () => {
    showToast(t('common.save'));
    navigate({
      search: {} as any,
    });
    setIsFormDirty(false);
  };

  const handleDeleteRecord = (id: string) => {
    if (window.confirm(t('common.confirm'))) {
      deleteRecordMutation.mutate(id);
    }
  };

  const isLoading =
    databaseQuery.isLoading ||
    tableQuery.isLoading ||
    fieldsQuery.isLoading ||
    recordsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const fields = fieldsQuery.data || [];
  const records = recordsQuery.data?.data || [];

  return (
    <div className="container-fluid py-4">
      {/* Toast alert */}
      {successToast && (
        <div className="alert alert-success py-2 px-3 mb-3 d-flex align-items-center gap-2">
          <i className="ti ti-check" aria-hidden="true" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h2>{t('records.title')}</h2>
          <p className="text-muted mb-0">
            {databaseQuery.data?.name} → {tableQuery.data?.name}
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link
            to="/builder/$databaseId/$tableId"
            params={{ databaseId, tableId }}
            className="btn btn-outline-secondary btn-sm"
          >
            <i className="ti ti-stack-2 me-1" aria-hidden="true" />
            {t('builder.tabs.structure')}
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() =>
              navigate({
                search: { action: 'create' } as any,
              })
            }
            data-testid="add-record-btn"
          >
            <i className="ti ti-plus me-1" aria-hidden="true" />
            {t('records.add')}
          </button>
        </div>
      </div>

      <div className="row g-4">
        {/* Main Records Table list */}
        <div className={activeAction ? 'col-lg-7' : 'col-12'}>
          <div className="card">
            <div className="card-body p-0">
              {records.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="ti ti-database fs-1 mb-2 d-block" />
                  <p>{t('records.empty')}</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-vcenter table-mobile-md card-table">
                    <thead>
                      <tr>
                        {fields.slice(0, 4).map((f) => (
                          <th key={f.id}>{f.name}</th>
                        ))}
                        <th className="w-1" />
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => {
                        const recordData = record.data || {};
                        return (
                          <tr key={record.id}>
                            {fields.slice(0, 4).map((f) => {
                              const val = recordData[f.name];
                              return (
                                <td key={f.id} data-label={f.name}>
                                  {Array.isArray(val) ? (
                                    <span className="badge bg-light text-muted">
                                      {val.length} items
                                    </span>
                                  ) : typeof val === 'boolean' ? (
                                    <i
                                      className={`ti ti-${val ? 'check text-success' : 'x text-danger'}`}
                                    />
                                  ) : (
                                    String(val ?? '')
                                  )}
                                </td>
                              );
                            })}
                            <td>
                              <div className="btn-list flex-nowrap">
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  onClick={() =>
                                    navigate({
                                      search: { action: 'edit', recordId: record.id } as any,
                                    })
                                  }
                                  data-testid={`edit-record-${record.id}`}
                                >
                                  <i className="ti ti-edit" />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  onClick={() =>
                                    navigate({
                                      search: { action: 'duplicate', recordId: record.id } as any,
                                    })
                                  }
                                  data-testid={`duplicate-record-${record.id}`}
                                  title={t('records.duplicate')}
                                >
                                  <i className="ti ti-copy" />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => handleDeleteRecord(record.id)}
                                >
                                  <i className="ti ti-trash" />
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
          </div>
        </div>

        {/* Side Panel: Create/Edit/Duplicate Form */}
        {activeAction && (
          <div className="col-lg-5">
            <div className="card shadow-sm border-primary">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h3 className="card-title">
                  {activeAction === 'create'
                    ? t('records.add')
                    : activeAction === 'edit'
                    ? t('records.edit')
                    : t('records.duplicate')}
                </h3>
                <button
                  type="button"
                  className="btn-close"
                  aria-label={t('common.close')}
                  onClick={handleCloseForm}
                />
              </div>
              <div className="card-body">
                <RecordForm
                  tableId={tableId}
                  fields={fields}
                  recordId={activeRecordId}
                  isDuplicate={activeAction === 'duplicate'}
                  onCancel={handleCloseForm}
                  onSaveSuccess={handleSaveSuccess}
                  onDirtyChange={setIsFormDirty}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
