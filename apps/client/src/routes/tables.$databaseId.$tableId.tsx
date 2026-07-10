import { createFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useI18n } from '../contexts/I18nContext';
import { apiClient } from '../lib/apiClient';
import type { ApiErrorLike, ApiRecord, DeleteConflictData } from '../lib/apiTypes';
import { type BuilderField } from '../lib/fieldTypes';
import { RecordForm } from '../components/RecordForm';
import { RecordDetailView } from '../components/RecordDetailView';
import { RecordHistoryPanel } from '../components/RecordHistoryPanel';
import { DeleteReassignModal } from '../components/DeleteReassignModal';
import { TrashManagerModal } from '../components/TrashManagerModal';
import { CsvImportModal } from '../components/CsvImportModal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { PageActions, PageHeader } from '../components/ui/PageHeader';
import { SurfaceCard } from '../components/ui/SurfaceCard';

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

type RecordData = ApiRecord;

type TableSearch = {
  action?: string;
  recordId?: string;
};

interface FilterItem {
  field: string;
  operator: string;
  value: string;
}

function TableRecordsPage() {
  const { databaseId, tableId } = Route.useParams();
  const search = useSearch({ from: '/tables/$databaseId/$tableId' });
  const navigate = useNavigate();
  const { t } = useI18n();
  const queryClient = useQueryClient();

  // Route Form State
  const activeAction = search.action;
  const activeRecordId = search.recordId;

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterItem[]>([]);
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [groupByField, setGroupByField] = useState('');

  // Modals & Panels State
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [deleteConflictConfig, setDeleteConflictConfig] = useState<{
    recordId: string;
    conflictData: DeleteConflictData;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');

  const [successToast, setSuccessToast] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Unsaved changes guard
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
  }, [isFormDirty, t]);

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

  // Query records dynamically based on search, filter, and sort states
  const recordsQuery = useQuery<{ data: RecordData[] }, Error>({
    queryKey: ['records', tableId, searchQuery, filters, sortBy, sortDir],
    queryFn: () => {
      const qParams = new URLSearchParams();
      qParams.append('table_id', tableId);
      qParams.append('per_page', '100');

      if (searchQuery.trim()) {
        qParams.append('search', searchQuery.trim());
      }
      if (filters.length > 0) {
        qParams.append('filters', JSON.stringify(filters));
      }
      if (sortBy) {
        qParams.append('sort', sortBy);
        qParams.append('sort_dir', sortDir);
      }

      return apiClient.get(`/records?${qParams.toString()}`);
    },
  });

  // Mutations
  const deleteRecordMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/records/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['records-select'] });
      showToast('Record deleted successfully');
    },
    onError: (err: ApiErrorLike, id: string) => {
      if (err.status === 409 && err.data?.reference_counts) {
        setDeleteConflictConfig({
          recordId: id,
          conflictData: err.data.reference_counts,
        });
      } else {
        alert(err.message || 'Failed to delete record.');
      }
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
    navigate({ search: {} as TableSearch });
    setIsFormDirty(false);
  };

  const handleSaveSuccess = () => {
    showToast(t('common.save'));
    navigate({ search: {} as TableSearch });
    setIsFormDirty(false);
  };

  const handleDeleteRecord = (id: string) => {
    if (window.confirm(t('common.confirm'))) {
      deleteRecordMutation.mutate(id);
    }
  };

  // Build the list of records
  const rawRecords = useMemo(() => recordsQuery.data?.data || [], [recordsQuery.data]);
  const fields = fieldsQuery.data || [];

  // Group records locally if groupBy is set
  const groupedRecords = useMemo(() => {
    if (!groupByField) {
      return [{ key: '', items: rawRecords }];
    }

    const groups: Record<string, RecordData[]> = {};
    rawRecords.forEach((rec) => {
      const val = rec.data?.[groupByField];
      const key = val === undefined || val === null || val === '' ? 'Empty' : String(val);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(rec);
    });

    return Object.entries(groups).map(([key, items]) => ({
      key,
      items,
    }));
  }, [rawRecords, groupByField]);

  // Flattened list of grouped items to virtualize (either Group Headers or Records)
  const flatListItems = useMemo(() => {
    const list: ({ type: 'header'; key: string; count: number } | { type: 'record'; record: RecordData })[] = [];

    groupedRecords.forEach((group) => {
      if (groupByField) {
        list.push({ type: 'header', key: group.key, count: group.items.length });
      }
      group.items.forEach((item) => {
        list.push({ type: 'record', record: item });
      });
    });

    return list;
  }, [groupedRecords, groupByField]);

  // Virtualizer Setup
  const rowVirtualizer = useVirtualizer({
    count: flatListItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 15,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  // Header click sorting
  const handleSort = (fieldName: string) => {
    if (sortBy === fieldName) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(fieldName);
      setSortDir('asc');
    }
  };

  // Filter creation handlers
  const handleAddFilter = () => {
    if (fields.length === 0) return;
    setFilters((prev) => [...prev, { field: fields[0].name, operator: 'eq', value: '' }]);
  };

  const handleUpdateFilter = (index: number, key: keyof FilterItem, val: string) => {
    setFilters((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: val };
      return updated;
    });
  };

  const handleRemoveFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, idx) => idx !== index));
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

  return (
    <div className="hap-records-page">
      {/* Toast alert */}
      {successToast && (
        <div className="alert alert-success py-2 px-3 mb-3 d-flex align-items-center gap-2">
          <i className="ti ti-check" aria-hidden="true" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Main Header */}
      <PageHeader
        pretitle={databaseQuery.data?.name}
        title={tableQuery.data?.name}
        description={t('records.title')}
        actions={
          <PageActions>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setIsCsvImportOpen(true)}
                data-testid="csv-import-btn"
              >
                <i className="ti ti-file-import me-1" aria-hidden="true" />
                Importer CSV
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setIsTrashOpen(true)}
                data-testid="trash-btn"
              >
                <i className="ti ti-trash me-1" aria-hidden="true" />
                {t('records.trash.title')}
              </button>
              <Link
                to="/builder/$databaseId/$tableId"
                params={{ databaseId, tableId }}
                className="btn btn-outline-secondary"
              >
                <i className="ti ti-stack-2 me-1" aria-hidden="true" />
                {t('builder.tabs.structure')}
              </Link>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate({ search: { action: 'create' } as TableSearch })}
                data-testid="add-record-btn"
              >
                <i className="ti ti-plus me-1" aria-hidden="true" />
                {t('records.add')}
              </button>
          </PageActions>
        }
      />

      {/* Query Filter and Search Controls */}
      <SurfaceCard variant="toolbar" className="mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-center">
            {/* Search Input */}
            <div className="col-md-4">
              <div className="input-icon">
                <span className="input-icon-addon">
                  <i className="ti ti-search" />
                </span>
                <input
                  type="text"
                  className="form-control"
                  aria-label={t('common.search')}
                  placeholder={t('records.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="search-input"
                />
              </div>
            </div>

            {/* Group By Selector */}
            <div className="col-md-4">
              <div className="d-flex align-items-center gap-2">
                <label htmlFor="group-by-field" className="text-nowrap small mb-0">
                  {t('records.groupBy')}:
                </label>
                <select
                  id="group-by-field"
                  className="form-select form-select-sm"
                  value={groupByField}
                  onChange={(e) => setGroupByField(e.target.value)}
                  data-testid="group-by-select"
                >
                  <option value="">{t('records.noGrouping')}</option>
                  {fields.map((f) => (
                    <option key={f.id} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Add Filter trigger */}
            <div className="col-md-4 text-end">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={handleAddFilter}
                data-testid="add-filter-btn"
              >
                <i className="ti ti-plus me-1" />
                {t('records.filter.add')}
              </button>
            </div>
          </div>

          {/* Active AST filter builders */}
          {filters.length > 0 && (
            <div className="mt-3 border-top pt-3 vstack gap-2">
              {filters.map((filter, index) => (
                <div key={index} className="row g-2 align-items-center">
                  <div className="col-md-3">
                    <select
                      className="form-select form-select-sm"
                      aria-label={t('records.filter.field')}
                      value={filter.field}
                      onChange={(e) => handleUpdateFilter(index, 'field', e.target.value)}
                    >
                      {fields.map((f) => (
                        <option key={f.id} value={f.name}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <select
                      className="form-select form-select-sm"
                      aria-label={t('records.filter.operator')}
                      value={filter.operator}
                      onChange={(e) => handleUpdateFilter(index, 'operator', e.target.value)}
                    >
                      <option value="eq">Equals (==)</option>
                      <option value="neq">Not equals (!=)</option>
                      <option value="contains">Contains (LIKE)</option>
                      <option value="starts_with">Starts with</option>
                      <option value="ends_with">Ends with</option>
                      <option value="gt">Greater than (&gt;)</option>
                      <option value="gte">Greater or equal (&gt;=)</option>
                      <option value="lt">Less than (&lt;)</option>
                      <option value="lte">Less or equal (&lt;=)</option>
                      <option value="is_null">Is empty</option>
                      <option value="is_not_null">Is not empty</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    {filter.operator !== 'is_null' && filter.operator !== 'is_not_null' && (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        aria-label={t('records.filter.value')}
                        placeholder="Value..."
                        value={filter.value}
                        onChange={(e) => handleUpdateFilter(index, 'value', e.target.value)}
                        data-testid={`filter-value-${index}`}
                      />
                    )}
                  </div>
                  <div className="col-md-2">
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm py-1"
                      aria-label={t('common.remove')}
                      onClick={() => handleRemoveFilter(index)}
                    >
                      <i className="ti ti-trash" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SurfaceCard>

      <div className="row g-4">
        {/* Spreadsheet Records browser */}
        <div className={activeAction || activeRecordId ? 'col-lg-7' : 'col-12'}>
          <SurfaceCard className="overflow-hidden">
            <div
              ref={parentRef}
              className="table-responsive hap-records-table"
              style={{ maxHeight: '600px', overflowY: 'auto' }}
            >
              <table className="table table-vcenter card-table table-hover mb-0">
                <thead>
                  <tr>
                    {fields.slice(0, 5).map((f) => (
                      <th
                        key={f.id}
                        aria-sort={
                          sortBy === f.name
                            ? sortDir === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                        data-testid={`sort-header-${f.name}`}
                      >
                        <button
                          type="button"
                          className="hap-sort-button"
                          onClick={() => handleSort(f.name)}
                        >
                          <span>{f.name}</span>
                          {sortBy === f.name ? (
                            <i className={`ti ti-chevron-${sortDir === 'asc' ? 'up' : 'down'}`} />
                          ) : (
                            <i className="ti ti-selector text-muted small" />
                          )}
                        </button>
                      </th>
                    ))}
                    <th className="w-1">
                      <span className="visually-hidden">{t('common.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {flatListItems.length === 0 && (
                    <tr>
                      <td colSpan={fields.slice(0, 5).length + 1}>
                        <EmptyState
                          icon="notes-off"
                          title={t('records.empty.title')}
                          description={t('records.empty.description')}
                          testId="records-empty-state"
                          action={
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => navigate({ search: { action: 'create' } as TableSearch })}
                            >
                              <i className="ti ti-plus me-1" aria-hidden="true" />
                              {t('records.add')}
                            </button>
                          }
                        />
                      </td>
                    </tr>
                  )}

                  {paddingTop > 0 && (
                    <tr style={{ height: `${paddingTop}px` }}>
                      <td colSpan={fields.slice(0, 5).length + 1} />
                    </tr>
                  )}

                  {virtualItems.map((virtualRow) => {
                    const item = flatListItems[virtualRow.index];

                    if (item.type === 'header') {
                      return (
                        <tr
                          key={`group-header-${item.key}`}
                          className="bg-light-subtle"
                          style={{ height: `${virtualRow.size}px` }}
                        >
                          <td colSpan={fields.slice(0, 5).length + 1} className="fw-bold py-2 px-3 text-secondary border-bottom">
                            <i className="ti ti-folder me-2" />
                            {item.key} &mdash; {item.count} {tableQuery.data?.name.toLowerCase()}
                          </td>
                        </tr>
                      );
                    }

                    const rec = item.record;
                    const recordData = rec.data || {};
                    const isSelected = activeRecordId === rec.id;

                    return (
                      <tr
                        key={rec.id}
                        onClick={() =>
                          navigate({
                            search: { action: search.action, recordId: rec.id } as TableSearch,
                          })
                        }
                        className={`hap-record-row ${isSelected ? 'is-selected' : ''}`}
                        style={{ height: `${virtualRow.size}px` }}
                        data-testid={`record-row-${rec.id}`}
                      >
                        {fields.slice(0, 5).map((f) => {
                          const val = recordData[f.name];
                          return (
                            <td key={f.id}>
                              {Array.isArray(val) ? (
                                <span className="badge bg-light text-muted">{val.length} files</span>
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
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="btn-list flex-nowrap">
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm py-1 px-2"
                              aria-label={t('common.details')}
                              onClick={() =>
                                navigate({
                                  search: { action: search.action, recordId: rec.id } as TableSearch,
                                })
                              }
                            >
                              <i className="ti ti-eye" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm py-1 px-2"
                              aria-label={t('common.edit')}
                              onClick={() =>
                                navigate({
                                  search: { action: 'edit', recordId: rec.id } as TableSearch,
                                })
                              }
                              data-testid={`edit-record-${rec.id}`}
                            >
                              <i className="ti ti-edit" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm py-1 px-2"
                              onClick={() =>
                                navigate({
                                  search: { action: 'duplicate', recordId: rec.id } as TableSearch,
                                })
                              }
                              data-testid={`duplicate-record-${rec.id}`}
                              aria-label={t('records.duplicate')}
                              title={t('records.duplicate')}
                            >
                              <i className="ti ti-copy" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm py-1 px-2"
                              aria-label={t('common.delete')}
                              onClick={() => handleDeleteRecord(rec.id)}
                              data-testid={`delete-record-${rec.id}`}
                            >
                              <i className="ti ti-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {paddingBottom > 0 && (
                    <tr style={{ height: `${paddingBottom}px` }}>
                      <td colSpan={fields.slice(0, 5).length + 1} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>

        {/* Side Panel: Create/Edit Form or Detail Card Layout switcher */}
        {(activeAction || activeRecordId) && (
          <div className="col-lg-5">
            <SurfaceCard variant="detail">
              <div className="card-header d-flex justify-content-between align-items-center py-2">
                <h2 className="card-title mb-0">
                  {activeAction === 'create'
                    ? t('records.add')
                    : activeAction === 'edit'
                    ? t('records.edit')
                    : activeAction === 'duplicate'
                    ? t('records.duplicate')
                    : t('common.details')}
                </h2>
                <button
                  type="button"
                  className="btn-close"
                  aria-label={t('common.close')}
                  onClick={handleCloseForm}
                />
              </div>

              {/* Tab Header if viewing record details */}
              {!activeAction && activeRecordId && (
                <div className="card-header p-0 border-bottom-0">
                  <ul className="nav nav-tabs card-header-tabs m-0 px-3 border-bottom">
                    <li className="nav-item">
                      <button
                        type="button"
                        className={`nav-link border-0 py-2 ${activeTab === 'details' ? 'active font-weight-bold text-primary border-bottom border-primary' : ''}`}
                        onClick={() => setActiveTab('details')}
                        data-testid="details-tab-btn"
                      >
                        {t('common.details')}
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        type="button"
                        className={`nav-link border-0 py-2 ${activeTab === 'history' ? 'active font-weight-bold text-primary border-bottom border-primary' : ''}`}
                        onClick={() => setActiveTab('history')}
                        data-testid="history-tab-btn"
                      >
                        {t('records.history.title')}
                      </button>
                    </li>
                  </ul>
                </div>
              )}

              <div className="card-body">
                {activeAction ? (
                  /* Form create / edit / duplicate */
                  <RecordForm
                    tableId={tableId}
                    fields={fields}
                    recordId={activeRecordId}
                    isDuplicate={activeAction === 'duplicate'}
                    onCancel={handleCloseForm}
                    onSaveSuccess={handleSaveSuccess}
                    onDirtyChange={setIsFormDirty}
                  />
                ) : activeRecordId ? (
                  /* Detail card layout or history panel */
                  activeTab === 'details' ? (
                    <RecordDetailView tableId={tableId} recordId={activeRecordId} />
                  ) : (
                    <RecordHistoryPanel
                      recordId={activeRecordId}
                      onRestoreSuccess={() => {
                        showToast('Version restored successfully');
                        setActiveTab('details');
                      }}
                    />
                  )
                ) : null}
              </div>
            </SurfaceCard>
          </div>
        )}
      </div>

      {/* Delete / Reassign links conflict Modal */}
      {deleteConflictConfig && (
        <DeleteReassignModal
          recordId={deleteConflictConfig.recordId}
          tableId={tableId}
          conflictData={deleteConflictConfig.conflictData}
          onClose={() => setDeleteConflictConfig(null)}
          onSuccess={() => {
            setDeleteConflictConfig(null);
            showToast('Links reassigned and record deleted.');
          }}
        />
      )}

      {/* Trash manager Modal */}
      {isTrashOpen && (
        <TrashManagerModal
          tableId={tableId}
          isOpen
          onClose={() => setIsTrashOpen(false)}
          onDeleteConflict={(id, counts) =>
            setDeleteConflictConfig({ recordId: id, conflictData: counts })
          }
        />
      )}

      {isCsvImportOpen && (
        <CsvImportModal
          tableId={tableId}
          fields={fields}
          onClose={() => setIsCsvImportOpen(false)}
          onImported={() => {
            queryClient.invalidateQueries({ queryKey: ['records'] });
            queryClient.invalidateQueries({ queryKey: ['fields'] });
            showToast('Import CSV terminé');
          }}
        />
      )}
    </div>
  );
}
