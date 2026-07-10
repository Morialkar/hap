import { createFileRoute, useParams, useSearch, useNavigate, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { apiClient } from '../lib/apiClient';
import type { ApiRecord, ApiRecordData } from '../lib/apiTypes';
import { type BuilderField } from '../lib/fieldTypes';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { SurfaceCard } from '../components/ui/SurfaceCard';

interface NavigationSearch {
  tableId?: string;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  columnsCount?: number;
}

export const Route = createFileRoute('/navigation/$databaseId')({
  validateSearch: (search: Record<string, unknown>): NavigationSearch => ({
    tableId: search.tableId as string | undefined,
    search: search.search as string | undefined,
    sortBy: search.sortBy as string | undefined,
    sortDir: search.sortDir as 'asc' | 'desc' | undefined,
    columnsCount: search.columnsCount ? Number(search.columnsCount) : undefined,
  }),
  component: NavigationModePage,
});

interface Table {
  id: string;
  name: string;
  database_id: string;
  is_front_facing?: boolean;
}

interface Database {
  id: string;
  name: string;
  workspace_id: string;
}

interface ViewSchema {
  id: string;
  name: string;
  type: string;
  config: {
    columnCount: number;
    columns: string[][];
  } | null;
  is_default?: boolean;
}

function NavigationModePage() {
  const { databaseId } = useParams({ from: '/navigation/$databaseId' });
  const searchParams = useSearch({ from: '/navigation/$databaseId' });
  const navigate = useNavigate({ from: '/navigation/$databaseId' });
  const { t } = useI18n();

  const [activeLightboxHash, setActiveLightboxHash] = useState<string | null>(null);

  // Search parameters from URL state
  const activeTableId = searchParams.tableId;
  const searchQuery = searchParams.search ?? '';
  const sortBy = searchParams.sortBy ?? '';
  const sortDir = searchParams.sortDir ?? 'asc';
  const columnsCount = searchParams.columnsCount ?? 2; // Default to 2 columns of cards

  // Queries
  const databaseQuery = useQuery<Database, Error>({
    queryKey: ['database', databaseId],
    queryFn: () => apiClient.get(`/databases/${databaseId}`),
  });

  const tablesQuery = useQuery<Table[], Error>({
    queryKey: ['tables', databaseId],
    queryFn: () => apiClient.get(`/tables?database_id=${databaseId}`),
  });

  // Extract front-facing tables
  const frontFacingTables = useMemo(() => {
    return (tablesQuery.data ?? []).filter((table) => table.is_front_facing);
  }, [tablesQuery.data]);

  // Determine selected table ID, fallback to first front-facing table
  const selectedTableId = useMemo(() => {
    if (activeTableId && frontFacingTables.some((t) => t.id === activeTableId)) {
      return activeTableId;
    }
    return frontFacingTables[0]?.id || null;
  }, [activeTableId, frontFacingTables]);

  const selectedTable = useMemo(() => {
    return frontFacingTables.find((t) => t.id === selectedTableId) || null;
  }, [frontFacingTables, selectedTableId]);

  const fieldsQuery = useQuery<BuilderField[], Error>({
    queryKey: ['fields', selectedTableId],
    queryFn: () => apiClient.get(`/fields?table_id=${selectedTableId}`),
    enabled: !!selectedTableId,
  });

  const viewsQuery = useQuery<ViewSchema[], Error>({
    queryKey: ['views', selectedTableId],
    queryFn: () => apiClient.get(`/views?table_id=${selectedTableId}`),
    enabled: !!selectedTableId,
  });

  const recordsQuery = useQuery<{ data: ApiRecord[] }, Error>({
    queryKey: ['records', selectedTableId, searchQuery, sortBy, sortDir],
    queryFn: () => {
      const qParams = new URLSearchParams();
      qParams.append('table_id', selectedTableId!);
      qParams.append('per_page', '100');

      if (searchQuery.trim()) {
        qParams.append('search', searchQuery.trim());
      }
      if (sortBy) {
        qParams.append('sort', sortBy);
        qParams.append('sort_dir', sortDir);
      }

      return apiClient.get(`/records?${qParams.toString()}`);
    },
    enabled: !!selectedTableId,
  });

  // Loading state
  const isLoading =
    databaseQuery.isLoading ||
    tablesQuery.isLoading ||
    (!!selectedTableId && (fieldsQuery.isLoading || viewsQuery.isLoading || recordsQuery.isLoading));

  // Handlers for sorting/filtering/layout
  const handleTableChange = (tableId: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        tableId,
        // Reset query parameters on table change
        search: undefined,
        sortBy: undefined,
        sortDir: undefined,
      }),
    });
  };

  const handleSearchChange = (val: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        search: val || undefined,
      }),
    });
  };

  const handleSortChange = (field: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        sortBy: field || undefined,
        sortDir: prev.sortBy === field && prev.sortDir === 'asc' ? 'desc' : 'asc',
      }),
    });
  };

  const handleColumnsCountChange = (count: number) => {
    navigate({
      search: (prev) => ({
        ...prev,
        columnsCount: count,
      }),
    });
  };

  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [customViewId, setCustomViewId] = useState<string | null>(null);
  const [collapsedFields, setCollapsedFields] = useState<Record<string, boolean>>({});

  const toggleFieldCollapse = (fieldId: string) => {
    setCollapsedFields((prev) => ({
      ...prev,
      [fieldId]: prev[fieldId] === false ? true : false,
    }));
  };

  // Reset custom states on table selection change
  useEffect(() => {
    setCustomViewId(null);
    setActiveFilters({});
    setCollapsedFields({});
  }, [selectedTableId]);

  const toggleFilterValue = (fieldName: string, value: string) => {
    setActiveFilters((prev) => {
      const current = prev[fieldName] || [];
      let updated: string[];
      if (current.includes(value)) {
        updated = current.filter((v) => v !== value);
      } else {
        updated = [...current, value];
      }
      
      const next = { ...prev };
      if (updated.length === 0) {
        delete next[fieldName];
      } else {
        next[fieldName] = updated;
      }
      return next;
    });
  };

  const clearAllFilters = () => {
    setActiveFilters({});
  };

  // Maps for dynamic layout field resolution
  const fields = useMemo(() => fieldsQuery.data || [], [fieldsQuery.data]);
  
  const views = viewsQuery.data || [];
  const cardViews = useMemo(() => views.filter((v) => v.type === 'card' || !v.type), [views]);

  const defaultView = useMemo(() => {
    return cardViews.find((v) => v.is_default) || cardViews[0] || null;
  }, [cardViews]);

  const activeView = useMemo(() => {
    if (customViewId) {
      return cardViews.find((v) => v.id === customViewId) || defaultView;
    }
    return defaultView;
  }, [customViewId, cardViews, defaultView]);

  const fieldsByIdMap = useMemo(() => {
    return new Map(fields.map((f) => [f.id, f]));
  }, [fields]);

  const fieldsByNameMap = useMemo(() => {
    return new Map(fields.map((f) => [f.name, f]));
  }, [fields]);

  // Construct column layouts to render inside cards
  const columnsLayout = useMemo(() => {
    if (!activeView || !activeView.config || !activeView.config.columns) {
      // Fallback: single column with all fields in order (excluding title field)
      return [fields.filter((f) => f.type !== 'title').map((f) => f.id)];
    }
    return activeView.config.columns;
  }, [activeView, fields]);

  const titleField = useMemo(() => fields.find((f) => f.type === 'title'), [fields]);

  const rawRecords = useMemo(() => recordsQuery.data?.data || [], [recordsQuery.data]);

  const filterableFields = useMemo(() => {
    return fields.filter(
      (f) => f.type !== 'image' && f.type !== 'file' && f.type !== 'long_text' && f.is_filterable !== false
    );
  }, [fields]);

  const facetCounts = useMemo(() => {
    const counts: Record<string, Record<string, number>> = {};
    filterableFields.forEach((f) => {
      counts[f.name] = {};
    });

    rawRecords.forEach((rec) => {
      filterableFields.forEach((f) => {
        const val = rec.data?.[f.name];
        const strVal = val === undefined || val === null || val === '' ? '--' : String(val);
        counts[f.name][strVal] = (counts[f.name][strVal] || 0) + 1;
      });
    });

    return counts;
  }, [rawRecords, filterableFields]);

  const filteredRecords = useMemo(() => {
    let recs = rawRecords;
    Object.entries(activeFilters).forEach(([fieldName, selectedValues]) => {
      if (selectedValues.length > 0) {
        recs = recs.filter((rec) => {
          const val = rec.data?.[fieldName];
          const strVal = val === undefined || val === null || val === '' ? '--' : String(val);
          return selectedValues.includes(strVal);
        });
      }
    });
    return recs;
  }, [rawRecords, activeFilters]);

  // Render helpers
  const renderFieldValue = (fieldName: string, recordData: ApiRecordData) => {
    const field = fieldsByNameMap.get(fieldName);
    if (!field) return null;

    const value = recordData[fieldName];
    if (value === undefined || value === null || value === '') {
      return <span className="text-muted small">--</span>;
    }

    switch (field.type) {
      case 'boolean':
        return (
          <i
            className={`ti ti-${value ? 'check text-success fs-3' : 'x text-danger fs-3'}`}
            aria-hidden="true"
          />
        );

      case 'select':
        return <span className="badge text-bg-secondary px-2 py-1">{String(value)}</span>;

      case 'reference':
        return <ReferenceLabel targetRecordId={String(value)} />;

      case 'image':
      case 'file': {
        const isImg = field.type === 'image';
        const hashes = (Array.isArray(value) ? value : [value]).map(String);

        return (
          <div className="d-flex flex-wrap gap-2 mt-1">
            {hashes.map((hash) => (
              <div key={hash} className="border rounded p-1 bg-white">
                {isImg ? (
                  <button
                    type="button"
                    className="btn btn-link p-0 border-0"
                    onClick={() => setActiveLightboxHash(hash)}
                    title="Zoom"
                  >
                    <img
                      src={`/api/v1/uploads/${hash}/thumbnail`}
                      alt="Thumbnail"
                      className="rounded"
                      style={{ width: 48, height: 48, objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `/api/v1/uploads/${hash}`;
                      }}
                    />
                  </button>
                ) : (
                  <a
                    href={`/api/v1/uploads/${hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="d-flex align-items-center gap-1 small text-decoration-none py-1 px-2"
                  >
                    <i className="ti ti-file" />
                    <span>Download</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        );
      }

      default:
        return <div className="text-body text-wrap text-break lh-sm small">{String(value)}</div>;
    }
  };

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If no tables are front-facing, show empty state
  if (frontFacingTables.length === 0) {
    return (
      <div>
        <PageHeader
          pretitle={databaseQuery.data?.name}
          title={t('nav.navigation')}
        />
        <SurfaceCard className="p-5">
          <EmptyState
            icon="folders-off"
            title={t('navigation.emptyState.title')}
            description={t('navigation.emptyState.description')}
          />
          <div className="text-center mt-3">
            <Link
              to="/workspaces"
              className="btn btn-primary"
            >
              <i className="ti ti-folders me-1" aria-hidden="true" />
              {t('nav.workspaces')}
            </Link>
          </div>
        </SurfaceCard>
      </div>
    );
  }

  // Select layout style for wide cards
  const gridColClass =
    columnsCount === 3
      ? 'col-lg-4 col-md-6 col-12'
      : columnsCount === 2
      ? 'col-md-6 col-12'
      : 'col-12';

  const colWidthClass =
    columnsLayout.length === 4
      ? 'col-md-3 col-6'
      : columnsLayout.length === 3
      ? 'col-md-4 col-12'
      : columnsLayout.length === 2
      ? 'col-md-6 col-12'
      : 'col-12';

  const records = filteredRecords;

  return (
    <div className="navigation-mode-container">
      {/* Custom microfiche aesthetics style block */}
      <style>{`
        .hap-navigation-tabs .nav-link {
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease-in-out;
        }
        .hap-navigation-tabs .nav-link.active {
          border-bottom: 2px solid var(--hap-accent);
          font-weight: 600;
          color: var(--hap-accent-text);
          background: transparent !important;
        }
        .hap-fiche-card {
          border-top: 4px solid var(--hap-accent);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          background-color: var(--tblr-bg-surface);
        }
        .hap-fiche-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1) !important;
        }
        .hap-fiche-field-header {
          font-size: 0.65rem;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--tblr-border-color-translucent);
        }
        .hover-bg-light:hover {
          background-color: var(--tblr-bg-surface-secondary, #f8f9fa);
        }
      `}</style>

      <PageHeader
        pretitle={databaseQuery.data?.name}
        title={t('nav.navigation')}
      />

      {/* Tabs for Front-Facing Tables */}
      <ul className="nav nav-tabs hap-navigation-tabs mb-4 border-bottom">
        {frontFacingTables.map((tbl) => (
          <li className="nav-item" key={tbl.id}>
            <button
              type="button"
              className={`nav-link border-0 py-3 px-4 ${tbl.id === selectedTableId ? 'active' : ''}`}
              onClick={() => handleTableChange(tbl.id)}
            >
              <i className="ti ti-table me-2 text-muted" aria-hidden="true" />
              {tbl.name}
            </button>
          </li>
        ))}
      </ul>

      {/* Query Toolbar */}
      <SurfaceCard className="mb-4">
        <div className="card-body py-3">
          <div className="row g-3 align-items-center">
            {/* Search Input */}
            <div className="col-md-3">
              <div className="input-icon">
                <span className="input-icon-addon">
                  <i className="ti ti-search" aria-hidden="true" />
                </span>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder={t('navigation.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
            </div>

            {/* Sort Controls */}
            <div className="col-md-4 d-flex align-items-center gap-2">
              <label className="form-label mb-0 text-nowrap small text-muted">
                {t('navigation.sortBy')} :
              </label>
              <select
                className="form-select form-select-sm"
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
              >
                <option value="">--</option>
                {fields
                  .filter((f) => f.type !== 'image' && f.type !== 'file' && f.type !== 'long_text')
                  .map((f) => (
                    <option key={f.id} value={f.name}>
                      {f.name}
                    </option>
                  ))}
              </select>

              {sortBy && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary px-2"
                  onClick={() =>
                    navigate({
                      search: (prev) => ({
                        ...prev,
                        sortDir: prev.sortDir === 'asc' ? 'desc' : 'asc',
                      }),
                    })
                  }
                  title={t(`navigation.sortDir.${sortDir}`)}
                >
                  <i className={`ti ti-sort-${sortDir === 'asc' ? 'ascending' : 'descending'}`} aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Layout Selector */}
            <div className="col-md-3 d-flex align-items-center gap-2">
              <label className="form-label mb-0 text-nowrap small text-muted">
                Disposition :
              </label>
              <select
                className="form-select form-select-sm"
                value={activeView?.id || ''}
                onChange={(e) => setCustomViewId(e.target.value || null)}
                disabled={cardViews.length === 0}
              >
                {cardViews.length === 0 && <option value="">Aucune disposition</option>}
                {cardViews.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.is_default ? ' (Défaut)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Columns Count Switcher */}
            <div className="col-md-2 d-flex justify-content-end align-items-center gap-2">
              <div className="btn-group btn-group-sm" role="group">
                <button
                  type="button"
                  className={`btn btn-outline-secondary ${columnsCount === 1 ? 'active' : ''}`}
                  onClick={() => handleColumnsCountChange(1)}
                  title="1 Colonne"
                >
                  <i className="ti ti-layout-column-1" />
                </button>
                <button
                  type="button"
                  className={`btn btn-outline-secondary ${columnsCount === 2 ? 'active' : ''}`}
                  onClick={() => handleColumnsCountChange(2)}
                  title="2 Colonnes"
                >
                  <i className="ti ti-layout-grid-2" />
                </button>
                <button
                  type="button"
                  className={`btn btn-outline-secondary ${columnsCount === 3 ? 'active' : ''}`}
                  onClick={() => handleColumnsCountChange(3)}
                  title="3 Colonnes"
                >
                  <i className="ti ti-layout-grid-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </SurfaceCard>

      {/* Main Content Area: Facet Sidebar + Cards Grid */}
      <div className="row g-4">
        {/* Left Sidebar: Facets */}
        <div className="col-12 col-md-3">
          <div className="card shadow-sm border-0">
            <div className="card-header py-3 d-flex justify-content-between align-items-center bg-light">
              <h3 className="card-title fw-bold mb-0 fs-4">
                <i className="ti ti-filter me-2 text-muted" />
                Filtres
              </h3>
              {Object.keys(activeFilters).length > 0 && (
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none small text-danger"
                  onClick={clearAllFilters}
                >
                  Réinitialiser
                </button>
              )}
            </div>
            <div className="card-body p-3">
              {filterableFields.length === 0 && (
                <div className="text-center text-muted py-3 small">Aucun filtre disponible</div>
              )}
              {filterableFields.map((field) => {
                const countsObj = facetCounts[field.name] || {};
                const sortedValues = Object.entries(countsObj).sort((a, b) => b[1] - a[1]);

                if (sortedValues.length === 0) return null;
                const isCollapsed = collapsedFields[field.id] !== false;

                return (
                  <div key={field.id} className="mb-3 border-bottom pb-2">
                    <div
                      className="d-flex align-items-center justify-content-between cursor-pointer py-1 select-none"
                      onClick={() => toggleFieldCollapse(field.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleFieldCollapse(field.id);
                        }
                      }}
                      style={{ outline: 'none' }}
                    >
                      <h4 className="fw-semibold text-uppercase text-muted mb-0 small tracking-wider">
                        {field.name}
                      </h4>
                      <i
                        className={`ti ti-chevron-${isCollapsed ? 'right' : 'down'} text-muted fs-4`}
                        style={{ transition: 'transform 0.2s' }}
                      />
                    </div>
                    
                    {!isCollapsed && (
                      <div className="d-flex flex-column gap-1 mt-2">
                        {sortedValues.map(([val, count]) => {
                          const isChecked = (activeFilters[field.name] || []).includes(val);
                          return (
                            <label
                              key={val}
                              className="d-flex align-items-center justify-content-between cursor-pointer py-1 px-2 rounded hover-bg-light mb-0 small"
                            >
                              <div className="d-flex align-items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="form-check-input m-0 cursor-pointer"
                                  checked={isChecked}
                                  onChange={() => toggleFilterValue(field.name, val)}
                                />
                                <span className="text-body text-truncate" style={{ maxWidth: '140px' }} title={val === '--' ? 'Sans valeur' : val}>
                                  {field.type === 'reference' ? (
                                    <ReferenceLabel targetRecordId={val} fallback={val} className="" />
                                  ) : (
                                    val === '--' ? 'Sans valeur' : val
                                  )}
                                </span>
                              </div>
                              <span className="badge text-bg-light rounded-pill text-muted small px-2">
                                {count}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Content: Cards Grid */}
        <div className="col-12 col-md-9">
          {records.length === 0 ? (
            <SurfaceCard className="p-5 text-center text-muted">
              <i className="ti ti-notebook-off fs-1 mb-2 text-muted" />
              <div>Aucune fiche trouvée.</div>
            </SurfaceCard>
          ) : (
            <div className="row g-4">
              {records.map((rec) => {
                const cardTitle = titleField ? rec.data?.[titleField.name] : null;

                return (
                  <div className={gridColClass} key={rec.id}>
                    <div className="card h-100 shadow-sm border-0 hap-fiche-card">
                      <div className="card-body p-3">
                        {cardTitle && (
                          <div className="border-bottom pb-2 mb-3">
                            <h3 className="card-title fw-bold fs-3 mb-0 text-primary">
                              {String(cardTitle)}
                            </h3>
                          </div>
                        )}
                        <div className="row g-3">
                          {columnsLayout.map((colFields, colIdx) => (
                            <div key={colIdx} className={colWidthClass}>
                              <div className="vstack gap-3 h-100 p-2 border border-dashed rounded bg-light-subtle">
                                {colFields.map((fId) => {
                                  const cleanId = fId.startsWith('draft-') ? fId.substring(6) : fId;
                                  const fieldDef = fieldsByIdMap.get(cleanId);
                                  if (!fieldDef || fieldDef.type === 'title') return null;

                                  return (
                                    <div key={cleanId} className="hap-fiche-field">
                                      <div className="small text-muted fw-bold mb-1 text-uppercase hap-fiche-field-header py-1">
                                        {fieldDef.name}
                                      </div>
                                      <div className="lh-sm mt-1">{renderFieldValue(fieldDef.name, rec.data || {})}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Footer linking back to full record detail table */}
                    <div className="card-footer bg-light-subtle py-2 px-3 border-top-0 d-flex justify-content-between align-items-center">
                      <span className="text-muted small">v{rec.version}</span>
                      <Link
                        to="/tables/$databaseId/$tableId"
                        params={{ databaseId, tableId: selectedTable!.id }}
                        search={{ action: 'edit', recordId: rec.id }}
                        className="btn btn-xs btn-link p-0 text-decoration-none"
                      >
                        <i className="ti ti-edit me-1" />
                        Éditer la fiche
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal overlay for images */}
      {activeLightboxHash && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          role="dialog"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100 }}
          onClick={() => setActiveLightboxHash(null)}
          data-testid="lightbox"
        >
          <div className="modal-dialog modal-dialog-centered modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 bg-transparent text-center position-relative">
              <button
                type="button"
                className="btn-close btn-close-white position-absolute top-0 end-0 m-3"
                style={{ zIndex: 1110 }}
                onClick={() => setActiveLightboxHash(null)}
              />
              <img
                src={`/api/v1/uploads/${activeLightboxHash}`}
                alt="Enlarged preview"
                className="img-fluid rounded shadow-lg max-vh-80 mx-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReferenceLabel({
  targetRecordId,
  fallback,
  className = 'fw-medium text-primary small',
}: {
  targetRecordId: string;
  fallback?: string;
  className?: string;
}) {
  const recordQuery = useQuery<ApiRecord, Error>({
    queryKey: ['records', targetRecordId],
    queryFn: () => apiClient.get(`/records/${targetRecordId}`),
    enabled: !!targetRecordId && targetRecordId !== '--',
  });

  const targetTableId = recordQuery.data?.table_id;

  const fieldsQuery = useQuery<BuilderField[], Error>({
    queryKey: ['fields', targetTableId],
    queryFn: () => apiClient.get(`/fields?table_id=${targetTableId}`),
    enabled: !!targetTableId,
  });

  if (targetRecordId === '--') {
    return <span>Sans valeur</span>;
  }

  if (recordQuery.isLoading || fieldsQuery.isLoading) {
    return <LoadingSpinner size="sm" />;
  }

  if (recordQuery.isError || !recordQuery.data) {
    return <span className={className}>{fallback || targetRecordId}</span>;
  }

  const rData = recordQuery.data.data || {};
  const fields = fieldsQuery.data || [];

  // Find the field of type 'title'
  const titleField = fields.find((f) => f.type === 'title');
  if (titleField && rData[titleField.name] !== undefined && rData[titleField.name] !== null && rData[titleField.name] !== '') {
    return <span className={className}>{String(rData[titleField.name])}</span>;
  }

  // Find the first field (by position or just first in list)
  const sortedFields = [...fields].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const firstField = sortedFields[0];
  if (firstField && rData[firstField.name] !== undefined && rData[firstField.name] !== null && rData[firstField.name] !== '') {
    return <span className={className}>{String(rData[firstField.name])}</span>;
  }

  // Fallback if no fields exist or values are empty
  const defaultLabel =
    rData.name || rData.title || rData.nom || rData.titre || Object.values(rData)[0] || fallback || targetRecordId;

  return <span className={className}>{String(defaultLabel)}</span>;
}
