import { createFileRoute, useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { useEffect, useMemo, useState, Fragment } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { PageActions, PageHeader } from '../components/ui/PageHeader';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { ShareModal } from '../components/ShareModal';

export const Route = createFileRoute('/reports/$databaseId/$tableId')({
  component: ReportBuilderPage,
});

interface Database {
  id: string;
  name: string;
}

interface Table {
  id: string;
  name: string;
  database_id: string;
}

interface Field {
  id: string;
  name: string;
  type: string;
  options?: Record<string, any>;
  table_id: string;
  is_filterable?: boolean;
}

interface Report {
  id: string;
  table_id: string;
  name: string;
  query: {
    select?: string[];
    where?: {
      logic: 'and' | 'or';
      conditions: any[];
    };
    sort?: { field: string; direction: 'asc' | 'desc' }[];
    group_by?: string;
  } | null;
  layout: {
    fields?: { name: string; visible: boolean; order?: number }[];
    group_order?: string[];
    view_id?: string;
    show_headers_only?: boolean;
    per_page?: number;
  } | null;
}

interface Condition {
  id: string;
  field: string;
  operator: string;
  value: any;
}

interface SortRule {
  field: string;
  direction: 'asc' | 'desc';
}

function ReportBuilderPage() {
  const { databaseId, tableId } = useParams({ from: '/reports/$databaseId/$tableId' });
  const { t } = useI18n();
  const queryClient = useQueryClient();

  // Basic Page States
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportName, setReportName] = useState('');
  const [activePreviewTab, setActivePreviewTab] = useState<'live' | 'print'>('live');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Visual Editor Configuration States
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [groupField, setGroupField] = useState<string>('');
  const [selectedViewId, setSelectedViewId] = useState<string>('');
  const [showHeadersOnly, setShowHeadersOnly] = useState<boolean>(false);
  const [sorts, setSorts] = useState<SortRule[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [logic, setLogic] = useState<'and' | 'or'>('and');

  // Preview Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(10);

  // Load Database and Table Details
  const databaseQuery = useQuery<Database, Error>({
    queryKey: ['database', databaseId],
    queryFn: () => apiClient.get(`/databases/${databaseId}`),
  });

  const tableQuery = useQuery<Table, Error>({
    queryKey: ['table', tableId],
    queryFn: () => apiClient.get(`/tables/${tableId}`),
  });

  const fieldsQuery = useQuery<Field[], Error>({
    queryKey: ['fields', tableId],
    queryFn: () => apiClient.get(`/fields?table_id=${tableId}`),
  });

  // Load table Views / Dispositions
  const viewsQuery = useQuery<any[], Error>({
    queryKey: ['views', tableId],
    queryFn: () => apiClient.get(`/views?table_id=${tableId}`),
  });

  // Load Saved Reports
  const reportsQuery = useQuery<Report[], Error>({
    queryKey: ['reports', tableId],
    queryFn: () => apiClient.get(`/reports?table_id=${tableId}`),
  });

  // Get unique related table IDs from reference fields
  const targetTableIds = useMemo(() => {
    if (!fieldsQuery.data) return [];
    const ids = fieldsQuery.data
      .filter((f) => f.type === 'reference' && f.options?.target_table)
      .map((f) => f.options?.target_table as string);
    return Array.from(new Set(ids));
  }, [fieldsQuery.data]);

  // Load target table fields
  const targetTablesQueries = useQueries({
    queries: targetTableIds.map((targetId) => ({
      queryKey: ['fields', targetId],
      queryFn: () => apiClient.get(`/fields?table_id=${targetId}`),
      enabled: !!targetId,
    })),
  });

  // Load target table records to show names in value dropdown select
  const targetRecordsQueries = useQueries({
    queries: targetTableIds.map((targetId) => ({
      queryKey: ['records', targetId],
      queryFn: () => apiClient.get(`/records?table_id=${targetId}&per_page=100`),
      enabled: !!targetId,
    })),
  });

  // Compile all available fields for selection (scalar + reference traversal)
  const availableColumns = useMemo(() => {
    if (!fieldsQuery.data) return [];
    const cols: { name: string; label: string; type: string; baseField: Field }[] = [];

    fieldsQuery.data.forEach((field) => {
      if (field.type === 'reference') {
        const targetTableId = field.options?.target_table;
        const targetQuery = targetTablesQueries.find(
          (q) =>
            q.data && (q.data as any).length > 0 && (q.data as any)[0].table_id === targetTableId
        );

        if (targetQuery?.data) {
          (targetQuery.data as any[]).forEach((targetField) => {
            cols.push({
              name: `${field.name}.${targetField.name}`,
              label: `${field.name} ➔ ${targetField.name}`,
              type: targetField.type,
              baseField: field,
            });
          });
          cols.push({
            name: `${field.name}.id`,
            label: `${field.name} ➔ ID`,
            type: 'text',
            baseField: field,
          });
        } else {
          cols.push({
            name: `${field.name}.id`,
            label: `${field.name} ➔ ID`,
            type: 'text',
            baseField: field,
          });
        }
      } else {
        cols.push({
          name: field.name,
          label: field.name,
          type: field.type,
          baseField: field,
        });
      }
    });

    return cols;
  }, [fieldsQuery.data, targetTablesQueries]);

  // Groupable fields matching the frontend filterable condition
  const groupableFields = useMemo(() => {
    if (!fieldsQuery.data) return [];
    return fieldsQuery.data.filter(
      (f) =>
        f.type !== 'image' &&
        f.type !== 'file' &&
        f.type !== 'long_text' &&
        f.type !== 'title' &&
        f.type !== 'gps' &&
        f.is_filterable !== false
    );
  }, [fieldsQuery.data]);

  const activeView = useMemo(() => {
    return viewsQuery.data?.find((v) => v.id === selectedViewId);
  }, [viewsQuery.data, selectedViewId]);

  const fieldsByIdMap = useMemo(() => {
    if (!fieldsQuery.data) return new Map<string, Field>();
    return new Map(fieldsQuery.data.map((f) => [f.id, f]));
  }, [fieldsQuery.data]);

  const columnsLayout = useMemo(() => {
    if (!activeView || !activeView.config || !activeView.config.columns) {
      if (!fieldsQuery.data) return [];
      return [fieldsQuery.data.filter((f) => f.type !== 'title').map((f) => f.id)];
    }
    return activeView.config.columns as string[][];
  }, [activeView, fieldsQuery.data]);

  const renderCardField = (fieldDef: Field, rec: any) => {
    const valKey = Object.keys(rec).find((k) => k.toLowerCase() === fieldDef.name.toLowerCase());
    const val = valKey ? rec[valKey] : null;

    if (val === null || val === undefined || val === '') {
      return <span className="text-muted small">--</span>;
    }

    if (Array.isArray(val)) {
      return val.join(', ');
    }
    if (typeof val === 'object' && val !== null) {
      if (val.lat !== undefined && val.lng !== undefined) {
        return `${val.lat}, ${val.lng}`;
      }
      return JSON.stringify(val);
    }
    return String(val);
  };

  // Synchronize visual state when selecting a saved report
  useEffect(() => {
    if (selectedReportId && reportsQuery.data) {
      const report = reportsQuery.data.find((r) => r.id === selectedReportId);
      if (report) {
        setReportName(report.name);

        // Restore query selection
        const selectCols = report.query?.select ?? [];
        setSelectedColumns(selectCols);

        // Restore groupField
        setGroupField(report.query?.group_by ?? '');
        setSelectedViewId(report.layout?.view_id ?? '');
        setShowHeadersOnly(report.layout?.show_headers_only ?? false);
        setPerPage(report.layout?.per_page ?? 10);

        // Restore sorts
        const sortRules = (report.query?.sort ?? []).map((s) => ({
          field: s.field,
          direction: s.direction,
        }));
        setSorts(sortRules);

        // Restore conditions
        const conds = (report.query?.where?.conditions ?? []).map((c, idx) => ({
          id: `cond-${idx}-${Date.now()}`,
          field: c.field,
          operator: c.operator,
          value: c.value,
        }));
        setConditions(conds);
        setLogic(report.query?.where?.logic ?? 'and');

        setCurrentPage(1);
      }
    } else {
      // Clear visual state for new report
      setReportName('');
      const titleField = fieldsQuery.data?.find(
        (f) => f.type === 'title' || f.options?.is_title === true
      );
      setSelectedColumns(titleField ? [titleField.name] : []);
      setGroupField('');
      setSelectedViewId('');
      setShowHeadersOnly(false);
      setPerPage(10);
      setSorts([]);
      setConditions([]);
      setLogic('and');
      setCurrentPage(1);
    }
  }, [selectedReportId, reportsQuery.data, fieldsQuery.data]);

  // Mutators for Saving, Updating and Deleting Reports
  const saveReportMutation = useMutation({
    mutationFn: async () => {
      const queryAST = {
        select: selectedColumns,
        group_by: groupField || undefined,
        sort: sorts.map((s) => ({ field: s.field, direction: s.direction })),
        where:
          conditions.length > 0
            ? {
                logic,
                conditions: conditions.map((c) => ({
                  field: c.field,
                  operator: c.operator,
                  value: c.value,
                })),
              }
            : undefined,
      };

      const layoutObj = {
        fields: selectedColumns.map((col, idx) => ({
          name: col,
          visible: true,
          order: idx + 1,
        })),
        show_headers_only: showHeadersOnly,
        view_id: selectedViewId || undefined,
        per_page: perPage,
      };

      const payload = {
        table_id: tableId,
        name: reportName || t('reports.newReport'),
        query: queryAST,
        layout: layoutObj,
      };

      if (selectedReportId) {
        return apiClient.put(`/reports/${selectedReportId}`, payload);
      }
      return apiClient.post('/reports', payload);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['reports', tableId] });
      if (!selectedReportId && data?.id) {
        setSelectedReportId(data.id);
      }
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async () => {
      if (selectedReportId) {
        return apiClient.delete(`/reports/${selectedReportId}`);
      }
    },
    onSuccess: () => {
      setSelectedReportId(null);
      queryClient.invalidateQueries({ queryKey: ['reports', tableId] });
    },
  });

  // Query Preview Data from backend preview endpoint
  const previewQuery = useQuery({
    queryKey: [
      'report-preview',
      tableId,
      selectedColumns,
      groupField,
      showHeadersOnly,
      selectedViewId,
      sorts,
      conditions,
      logic,
      currentPage,
      perPage,
    ],
    queryFn: () => {
      const queryAST = {
        select: selectedColumns,
        group_by: groupField || undefined,
        sort: sorts.map((s) => ({ field: s.field, direction: s.direction })),
        where:
          conditions.length > 0
            ? {
                logic,
                conditions: conditions.map((c) => ({
                  field: c.field,
                  operator: c.operator,
                  value: c.value,
                })),
              }
            : undefined,
      };

      const layoutObj = {
        fields: selectedColumns.map((col, idx) => ({
          name: col,
          visible: true,
          order: idx + 1,
        })),
        show_headers_only: showHeadersOnly,
        view_id: selectedViewId || undefined,
        per_page: perPage,
      };

      return apiClient.post('/reports/preview', {
        table_id: tableId,
        query: queryAST,
        layout: layoutObj,
        per_page: showHeadersOnly ? undefined : perPage,
        page: showHeadersOnly ? undefined : currentPage,
      });
    },
    enabled: selectedColumns.length > 0,
  });

  // Handler helpers for visual configuration editor
  const toggleColumn = (colName: string) => {
    setSelectedColumns((prev) =>
      prev.includes(colName) ? prev.filter((c) => c !== colName) : [...prev, colName]
    );
  };

  const addCondition = () => {
    const firstCol = availableColumns[0]?.name || '';
    setConditions((prev) => [
      ...prev,
      { id: `cond-${Date.now()}-${Math.random()}`, field: firstCol, operator: 'eq', value: '' },
    ]);
  };

  const removeCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    setConditions((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const newCond = { ...c, ...updates };
        // Reset value if field changes to avoid incompatibilities
        if (updates.field) {
          newCond.value = '';
        }
        return newCond;
      })
    );
  };

  const addSort = () => {
    const firstCol = availableColumns[0]?.name || '';
    setSorts((prev) => [...prev, { field: firstCol, direction: 'asc' }]);
  };

  const removeSort = (index: number) => {
    setSorts((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSort = (index: number, updates: Partial<SortRule>) => {
    setSorts((prev) => prev.map((s, i) => (i !== index ? s : { ...s, ...updates })));
  };

  const downloadFile = async (
    url: string,
    method: 'GET' | 'POST',
    body?: any,
    defaultFilename: string = 'export'
  ) => {
    try {
      const response = await fetch(url.startsWith('/api') ? url : `/api/v1${url}`, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const disposition = response.headers.get('Content-Disposition');
      let filename = defaultFilename;
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error(err);
      alert("Erreur lors du téléchargement de l'export.");
    }
  };

  const handleExportCsv = () => {
    const queryAST = {
      select: selectedColumns,
      group_by: groupField || undefined,
      sort: sorts.map((s) => ({ field: s.field, direction: s.direction })),
      where:
        conditions.length > 0
          ? {
              logic,
              conditions: conditions.map((c) => ({
                field: c.field,
                operator: c.operator,
                value: c.value,
              })),
            }
          : undefined,
    };

    const layoutObj = {
      fields: selectedColumns.map((col, idx) => ({
        name: col,
        visible: true,
        order: idx + 1,
      })),
      show_headers_only: showHeadersOnly,
      view_id: selectedViewId || undefined,
      per_page: perPage,
    };

    if (selectedReportId) {
      void downloadFile(
        `/reports/${selectedReportId}/export/csv`,
        'GET',
        undefined,
        `${reportName || 'rapport'}.csv`
      );
    } else {
      void downloadFile(
        '/reports/preview/csv',
        'POST',
        {
          table_id: tableId,
          query: queryAST,
          layout: layoutObj,
        },
        'rapport_apercu.csv'
      );
    }
  };

  const handleExportPdf = () => {
    const queryAST = {
      select: selectedColumns,
      group_by: groupField || undefined,
      sort: sorts.map((s) => ({ field: s.field, direction: s.direction })),
      where:
        conditions.length > 0
          ? {
              logic,
              conditions: conditions.map((c) => ({
                field: c.field,
                operator: c.operator,
                value: c.value,
              })),
            }
          : undefined,
    };

    const layoutObj = {
      fields: selectedColumns.map((col, idx) => ({
        name: col,
        visible: true,
        order: idx + 1,
      })),
      show_headers_only: showHeadersOnly,
      view_id: selectedViewId || undefined,
      per_page: perPage,
    };

    if (selectedReportId) {
      void downloadFile(
        `/reports/${selectedReportId}/export/pdf`,
        'GET',
        undefined,
        `${reportName || 'rapport'}.pdf`
      );
    } else {
      void downloadFile(
        '/reports/preview/pdf',
        'POST',
        {
          table_id: tableId,
          name: reportName || 'Rapport temporaire',
          query: queryAST,
          layout: layoutObj,
        },
        'rapport_apercu.pdf'
      );
    }
  };

  const handleDeleteReport = () => {
    if (window.confirm(t('reports.confirmDelete'))) {
      deleteReportMutation.mutate();
    }
  };

  const renderConditionValueInput = (cond: Condition, index: number) => {
    const colDef = availableColumns.find((c) => c.name === cond.field);
    if (!colDef) return null;

    if (cond.operator === 'is_null') return null;

    if (colDef.name.endsWith('.id') || colDef.type === 'reference') {
      const targetTableId = colDef.baseField?.options?.target_table;
      const targetRecordsQuery = targetRecordsQueries.find(
        (q) => q.data && (q.data as any).length > 0 && (q.data as any)[0].table_id === targetTableId
      );

      const recordsList = (targetRecordsQuery?.data ?? []) as any[];

      const targetFieldsQuery = targetTablesQueries.find(
        (q) => q.data && (q.data as any).length > 0 && (q.data as any)[0].table_id === targetTableId
      );
      const titleField = (targetFieldsQuery?.data as any[])?.find((f) => f.type === 'title');
      const titleFieldName = titleField?.name ?? 'name';

      return (
        <select
          className="form-select form-select-sm"
          value={cond.value || ''}
          onChange={(e) => updateCondition(index, { value: e.target.value })}
        >
          <option value="">-- Choisir --</option>
          {recordsList.map((rec) => {
            const label = rec.data?.[titleFieldName] || rec.id;
            return (
              <option key={rec.id} value={rec.id}>
                {label}
              </option>
            );
          })}
        </select>
      );
    }

    if (colDef.type === 'number') {
      return (
        <input
          type="number"
          className="form-control form-control-sm"
          value={cond.value ?? ''}
          onChange={(e) =>
            updateCondition(index, {
              value: e.target.value ? Number(e.target.value) : '',
            })
          }
        />
      );
    }

    if (colDef.type === 'date') {
      return (
        <input
          type="date"
          className="form-control form-control-sm"
          value={cond.value ?? ''}
          onChange={(e) => updateCondition(index, { value: e.target.value })}
        />
      );
    }

    return (
      <input
        type="text"
        className="form-control form-control-sm"
        value={cond.value ?? ''}
        onChange={(e) => updateCondition(index, { value: e.target.value })}
      />
    );
  };

  const getAvailableOperators = (fieldName: string) => {
    const colDef = availableColumns.find((c) => c.name === fieldName);
    if (!colDef) return [];

    if (colDef.type === 'number') {
      return [
        { value: 'eq', label: '=' },
        { value: 'neq', label: '≠' },
        { value: 'gt', label: '>' },
        { value: 'gte', label: '≥' },
        { value: 'lt', label: '<' },
        { value: 'lte', label: '≤' },
        { value: 'is_null', label: 'Est vide' },
      ];
    }

    if (colDef.type === 'text' || colDef.type === 'long_text') {
      return [
        { value: 'contains', label: 'Contient' },
        { value: 'eq', label: 'Est égal à' },
        { value: 'neq', label: 'Est différent de' },
        { value: 'is_null', label: 'Est vide' },
      ];
    }

    return [
      { value: 'eq', label: 'Est égal à' },
      { value: 'neq', label: 'Est différent de' },
      { value: 'is_null', label: 'Est vide' },
    ];
  };

  if (
    databaseQuery.isLoading ||
    tableQuery.isLoading ||
    fieldsQuery.isLoading ||
    reportsQuery.isLoading
  ) {
    return (
      <div
        className="d-flex align-items-center justify-content-center"
        style={{ minHeight: '60vh' }}
      >
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const reportsList = reportsQuery.data || [];
  const previewData = previewQuery.data as any;

  return (
    <div className="report-builder-page">
      <style>{`
        .report-section-header {
          border-bottom: 2px solid var(--border);
          padding-bottom: 0.5rem;
          margin-bottom: 1rem;
        }
        .report-card-selected {
          border-left: 4px solid var(--accent) !important;
          background-color: var(--accent-bg) !important;
        }
        .preview-pane-table th {
          background-color: var(--tblr-bg-surface-secondary, #f8f9fa);
          font-weight: 600;
        }
        .print-layout-container {
          background: white;
          color: #1e293b;
          font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05);
          padding: 2cm;
          min-height: 29.7cm;
          box-sizing: border-box;
          width: 21cm;
          margin: 0 auto;
          border-radius: 8px;
        }
        .print-layout-container table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1rem;
          margin-bottom: 1.5rem;
        }
        .print-layout-container th, .print-layout-container td {
          border-bottom: 1px solid #e2e8f0;
          padding: 10px 12px;
          text-align: left;
          font-size: 9.5pt;
        }
        .print-layout-container th {
          background-color: #f8fafc;
          color: #475569;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 8pt;
          letter-spacing: 0.05em;
          border-top: 1px solid #e2e8f0;
        }
        .print-layout-container h1 {
          font-family: inherit;
          font-size: 24pt;
          font-weight: 700;
          color: #0f172a;
          text-align: left;
          margin-bottom: 0.5rem;
        }
        .print-layout-container .group-header {
          font-weight: 700;
          font-size: 12pt;
          color: #0f172a;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          padding-bottom: 4px;
          border-bottom: 2px solid #cbd5e1;
        }
        .print-layout-container .report-meta {
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 0.75rem;
          margin-bottom: 1.5rem;
          color: #64748b;
          font-size: 9pt;
        }
        @media print {
          body, .page, #root, .page-wrapper, .page-body, .container-xl {
            background: white !important;
            color: black !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .d-print-none, header, nav, .navbar, .page-header, .report-sidebar, .report-editor-card, .nav-tabs, .btn, .pagination-wrapper, .tanstack-router-devtools {
            display: none !important;
          }
          .print-layout-container {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      <PageHeader
        pretitle={`${databaseQuery.data?.name} ➔ ${tableQuery.data?.name}`}
        title={t('reports.title')}
        actions={
          <PageActions>
            {selectedReportId && (
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={() => setIsShareModalOpen(true)}
              >
                <i className="ti ti-share me-1" aria-hidden="true" />
                Partager le rapport
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setSelectedReportId(null)}
            >
              <i className="ti ti-plus me-1" aria-hidden="true" />
              {t('reports.newReport')}
            </button>
          </PageActions>
        }
      />

      <div className="row g-3">
        {/* Left Sidebar - Reports List & Visual Configuration Form */}
        <div className="col-md-4 d-print-none">
          {/* Saved Reports Section */}
          <SurfaceCard className="mb-3 report-sidebar">
            <div className="card-body">
              <h3 className="card-title text-muted mb-2">{t('reports.savedReports')}</h3>
              {reportsList.length === 0 ? (
                <div className="text-muted small py-2">{t('reports.noReports')}</div>
              ) : (
                <div className="list-group list-group-flush">
                  {reportsList.map((rep) => (
                    <button
                      key={rep.id}
                      type="button"
                      className={`list-group-item list-group-item-action border-0 px-2 py-2 rounded mb-1 text-start ${selectedReportId === rep.id ? 'report-card-selected fw-bold' : ''}`}
                      onClick={() => setSelectedReportId(rep.id)}
                    >
                      <i className="ti ti-chart-bar me-2 text-muted" />
                      {rep.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </SurfaceCard>

          {/* Visual Query Builder Card */}
          <SurfaceCard className="report-editor-card">
            <div className="card-body">
              <h3 className="card-title mb-3">
                {selectedReportId ? t('reports.save') : t('reports.newReport')}
              </h3>

              {/* Report Name Input */}
              <div className="mb-3">
                <label className="form-label">{t('reports.name.label')}</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="ex. Rapport d'activité annuel"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                />
              </div>

              {/* Columns Visibility Selector */}
              <div className="mb-3">
                <label className="form-label">{t('reports.columns.label')}</label>
                <div
                  className="border rounded p-2"
                  style={{ maxHeight: '180px', overflowY: 'auto' }}
                >
                  {availableColumns.map((col) => (
                    <div className="form-check mb-1" key={col.name}>
                      <input
                        className="form-check-input cursor-pointer"
                        type="checkbox"
                        id={`col-${col.name}`}
                        checked={selectedColumns.includes(col.name)}
                        onChange={() => toggleColumn(col.name)}
                      />
                      <label
                        className="form-check-label small cursor-pointer"
                        htmlFor={`col-${col.name}`}
                      >
                        {col.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Group By Field Selector */}
              <div className="mb-3">
                <label className="form-label">{t('reports.groupBy.label')}</label>
                <select
                  className="form-select form-select-sm"
                  value={groupField}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGroupField(val);
                    if (!val) setShowHeadersOnly(false);
                  }}
                >
                  <option value="">-- Sans regroupement --</option>
                  {groupableFields.map((field) => (
                    <option key={field.name} value={field.name}>
                      {field.name}
                    </option>
                  ))}
                </select>
              </div>

              {groupField && (
                <div className="form-check mb-3">
                  <input
                    className="form-check-input cursor-pointer"
                    type="checkbox"
                    id="show-headers-only"
                    checked={showHeadersOnly}
                    onChange={(e) => setShowHeadersOnly(e.target.checked)}
                  />
                  <label
                    className="form-check-label small cursor-pointer"
                    htmlFor="show-headers-only"
                  >
                    {t('reports.showHeadersOnly.label')}
                  </label>
                </div>
              )}

              {/* Disposition Selector */}
              <div className="mb-3">
                <label className="form-label">Disposition des fiches</label>
                <select
                  className="form-select form-select-sm"
                  value={selectedViewId}
                  onChange={(e) => setSelectedViewId(e.target.value)}
                >
                  <option value="">-- Sans disposition (Tableau) --</option>
                  {viewsQuery.data?.map((view) => (
                    <option key={view.id} value={view.id}>
                      {view.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Page Size Selector */}
              {!showHeadersOnly && (
                <div className="mb-3">
                  <label className="form-label">Fiches par page</label>
                  <select
                    className="form-select form-select-sm"
                    value={perPage}
                    onChange={(e) => {
                      setPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={5}>5 fiches</option>
                    <option value={10}>10 fiches</option>
                    <option value={25}>25 fiches</option>
                    <option value={50}>50 fiches</option>
                    <option value={100}>100 fiches</option>
                  </select>
                </div>
              )}

              {/* Sorting Rules Editor */}
              <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <label className="form-label mb-0">{t('reports.sortBy.label')}</label>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost-secondary p-0 px-1 border-0"
                    onClick={addSort}
                  >
                    <i className="ti ti-plus me-1" />
                    {t('reports.addSort')}
                  </button>
                </div>
                {sorts.length === 0 ? (
                  <div className="text-muted small">Aucun tri appliqué.</div>
                ) : (
                  <div className="vstack gap-2">
                    {sorts.map((sort, index) => (
                      <div className="d-flex align-items-center gap-1" key={index}>
                        <select
                          className="form-select form-select-sm"
                          value={sort.field}
                          onChange={(e) => updateSort(index, { field: e.target.value })}
                        >
                          {availableColumns.map((col) => (
                            <option key={col.name} value={col.name}>
                              {col.label}
                            </option>
                          ))}
                        </select>
                        <select
                          className="form-select form-select-sm"
                          style={{ width: '90px' }}
                          value={sort.direction}
                          onChange={(e) =>
                            updateSort(index, { direction: e.target.value as 'asc' | 'desc' })
                          }
                        >
                          <option value="asc">ASC</option>
                          <option value="desc">DESC</option>
                        </select>
                        <button
                          type="button"
                          className="btn btn-sm btn-icon btn-outline-danger border-0 px-1"
                          onClick={() => removeSort(index)}
                        >
                          <i className="ti ti-trash" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Filter Conditions Editor */}
              <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <label className="form-label mb-0">{t('reports.conditions.label')}</label>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost-secondary p-0 px-1 border-0"
                    onClick={addCondition}
                  >
                    <i className="ti ti-plus me-1" />
                    {t('reports.addCondition')}
                  </button>
                </div>

                {conditions.length > 0 && (
                  <div className="mb-2">
                    <select
                      className="form-select form-select-sm w-100"
                      value={logic}
                      onChange={(e) => setLogic(e.target.value as 'and' | 'or')}
                    >
                      <option value="and">{t('reports.conditions.logic.and')}</option>
                      <option value="or">{t('reports.conditions.logic.or')}</option>
                    </select>
                  </div>
                )}

                {conditions.length === 0 ? (
                  <div className="text-muted small">Aucun filtre appliqué.</div>
                ) : (
                  <div className="vstack gap-2">
                    {conditions.map((cond, index) => (
                      <div className="border rounded p-2 bg-light position-relative" key={cond.id}>
                        <button
                          type="button"
                          className="btn btn-sm btn-icon btn-outline-danger border-0 position-absolute end-0 top-0 mt-1 me-1 p-0 px-1"
                          onClick={() => removeCondition(index)}
                          aria-label="Supprimer la condition"
                        >
                          <i className="ti ti-x" />
                        </button>
                        <div className="mb-1 pe-4">
                          <select
                            className="form-select form-select-sm"
                            value={cond.field}
                            onChange={(e) => updateCondition(index, { field: e.target.value })}
                          >
                            {availableColumns.map((col) => (
                              <option key={col.name} value={col.name}>
                                {col.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="row g-1">
                          <div className="col-5">
                            <select
                              className="form-select form-select-sm"
                              value={cond.operator}
                              onChange={(e) => updateCondition(index, { operator: e.target.value })}
                            >
                              {getAvailableOperators(cond.field).map((op) => (
                                <option key={op.value} value={op.value}>
                                  {op.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-7">{renderConditionValueInput(cond, index)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="d-flex align-items-center gap-2 mt-4 pt-2 border-top">
                <button
                  type="button"
                  className="btn btn-primary flex-grow-1"
                  onClick={() => saveReportMutation.mutate()}
                  disabled={saveReportMutation.isPending || selectedColumns.length === 0}
                >
                  <i className="ti ti-device-floppy me-1" />
                  {t('common.save')}
                </button>
                {selectedReportId && (
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={handleDeleteReport}
                    disabled={deleteReportMutation.isPending}
                    aria-label="Supprimer le rapport"
                  >
                    <i className="ti ti-trash" />
                  </button>
                )}
              </div>
            </div>
          </SurfaceCard>
        </div>

        {/* Right Main Area - Live Preview and Print Renders */}
        <div className="col-md-8">
          <div className="d-flex align-items-center justify-content-between mb-3 d-print-none">
            <SurfaceCard className="mb-0 flex-grow-1 me-3">
              <div className="card-header p-0">
                <ul className="nav nav-tabs card-header-tabs m-0">
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link border-0 py-3 px-4 ${activePreviewTab === 'live' ? 'active fw-bold' : ''}`}
                      onClick={() => setActivePreviewTab('live')}
                    >
                      <i className="ti ti-device-desktop me-1" aria-hidden="true" />
                      {t('reports.preview.live')}
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link border-0 py-3 px-4 ${activePreviewTab === 'print' ? 'active fw-bold' : ''}`}
                      onClick={() => setActivePreviewTab('print')}
                    >
                      <i className="ti ti-printer me-1" aria-hidden="true" />
                      {t('reports.preview.print')}
                    </button>
                  </li>
                </ul>
              </div>
            </SurfaceCard>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={handleExportCsv}
                disabled={selectedColumns.length === 0}
              >
                <i className="ti ti-file-text me-1" />
                CSV
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={handleExportPdf}
                disabled={selectedColumns.length === 0}
              >
                <i className="ti ti-file-type-pdf me-1" />
                PDF
              </button>
            </div>
          </div>

          {selectedColumns.length === 0 ? (
            <SurfaceCard className="h-100 min-vh-50 d-print-none">
              <EmptyState icon="chart-bar" title={t('reports.emptyPreview')} />
            </SurfaceCard>
          ) : previewQuery.isLoading ? (
            <div className="d-flex flex-column align-items-center justify-content-center border rounded bg-white min-vh-50 p-4">
              <LoadingSpinner size="md" />
              <div className="text-muted small">{t('reports.loading')}</div>
            </div>
          ) : (
            <div>
              {/* Live Preview Tab */}
              {activePreviewTab === 'live' && (
                <SurfaceCard className="d-print-none">
                  <div className="card-body p-3" style={{ overflowX: 'auto' }}>
                    {selectedViewId ? (
                      <div className="vstack gap-4">
                        {previewData?.groups?.length === 0 ? (
                          <div className="text-center text-muted py-4">
                            Aucune fiche ne correspond aux critères.
                          </div>
                        ) : (
                          previewData?.groups?.map((group: any, gIdx: number) => (
                            <Fragment key={gIdx}>
                              {group.key && (
                                <div className="fw-bold text-muted small py-2 px-3 border-bottom mb-3">
                                  {groupField} : {group.key} ({group.records.length})
                                </div>
                              )}
                              {!showHeadersOnly && (
                                <div className="row g-3">
                                  {group.records.map((rec: any, rIdx: number) => {
                                    const titleFieldDef = fieldsQuery.data?.find(
                                      (f) => f.options?.is_title === true || f.type === 'title'
                                    );
                                    const titleValKey = titleFieldDef
                                      ? Object.keys(rec).find(
                                          (k) =>
                                            k.toLowerCase() === titleFieldDef.name.toLowerCase()
                                        )
                                      : null;
                                    const cardTitle = titleValKey ? rec[titleValKey] : null;

                                    return (
                                      <div className="col-12" key={rIdx}>
                                        <div className="card shadow-sm border p-3 bg-white">
                                          {cardTitle && (
                                            <div className="border-bottom pb-2 mb-3">
                                              <h3 className="card-title fw-bold fs-4 mb-0 text-primary">
                                                {String(cardTitle)}
                                              </h3>
                                            </div>
                                          )}
                                          <div className="row g-3">
                                            {columnsLayout.map((colFields, colIdx) => {
                                              const colWidthClass =
                                                columnsLayout.length === 1 ? 'col-12' : 'col-6';
                                              return (
                                                <div key={colIdx} className={colWidthClass}>
                                                  <div className="vstack gap-3 h-100 p-2 border border-dashed rounded bg-light-subtle">
                                                    {colFields.map((fId) => {
                                                      const cleanId = fId.startsWith('draft-')
                                                        ? fId.substring(6)
                                                        : fId;
                                                      const fieldDef = fieldsByIdMap.get(cleanId);
                                                      if (!fieldDef || fieldDef.type === 'title')
                                                        return null;

                                                      return (
                                                        <div
                                                          key={cleanId}
                                                          className="hap-fiche-field"
                                                        >
                                                          <div
                                                            className="small text-muted fw-bold mb-1 text-uppercase"
                                                            style={{
                                                              fontSize: '7.5pt',
                                                              letterSpacing: '0.05em',
                                                            }}
                                                          >
                                                            {fieldDef.name}
                                                          </div>
                                                          <div
                                                            className="lh-sm"
                                                            style={{ fontSize: '9.5pt' }}
                                                          >
                                                            {renderCardField(fieldDef, rec)}
                                                          </div>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </Fragment>
                          ))
                        )}
                      </div>
                    ) : (
                      <table className="table table-hover table-striped preview-pane-table mb-0">
                        {!showHeadersOnly && (
                          <thead>
                            <tr>
                              {previewData?.columns?.map((col: string) => {
                                const colDef = availableColumns.find(
                                  (c) => c.name.toLowerCase() === col.toLowerCase()
                                );
                                return <th key={col}>{colDef ? colDef.label : col}</th>;
                              })}
                            </tr>
                          </thead>
                        )}
                        <tbody>
                          {previewData?.groups?.length === 0 ? (
                            <tr>
                              <td
                                colSpan={previewData?.columns?.length || 1}
                                className="text-center text-muted py-4"
                              >
                                Aucune fiche ne correspond aux critères.
                              </td>
                            </tr>
                          ) : (
                            previewData?.groups?.map((group: any, gIdx: number) => (
                              <Fragment key={gIdx}>
                                {group.key && (
                                  <tr className="table-group-header">
                                    <td
                                      colSpan={previewData?.columns?.length || 1}
                                      className="bg-light fw-bold text-muted small py-2 px-3 border-bottom"
                                    >
                                      {groupField} : {group.key} ({group.records.length})
                                    </td>
                                  </tr>
                                )}
                                {!showHeadersOnly &&
                                  group.records.map((rec: any, rIdx: number) => (
                                    <tr key={rIdx}>
                                      {previewData?.columns?.map((col: string) => {
                                        const val = rec[col];
                                        return (
                                          <td key={col}>
                                            {Array.isArray(val)
                                              ? val.join(', ')
                                              : typeof val === 'object' && val !== null
                                                ? val.lat !== undefined && val.lng !== undefined
                                                  ? `${val.lat}, ${val.lng}`
                                                  : JSON.stringify(val)
                                                : (val ?? '-')}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                              </Fragment>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Pagination Footer */}
                  {previewData?.pagination && (
                    <div className="card-footer d-flex align-items-center justify-content-between py-2 border-top pagination-wrapper">
                      <div className="d-flex align-items-center gap-3">
                        <div className="text-muted small">
                          Total : {previewData.pagination.total} fiches
                        </div>
                        <div className="d-flex align-items-center gap-1">
                          <span className="small text-muted text-nowrap">Taille :</span>
                          <select
                            className="form-select form-select-sm py-0 px-1"
                            style={{ width: '70px', height: '24px', fontSize: '8.5pt' }}
                            value={perPage}
                            onChange={(e) => {
                              setPerPage(Number(e.target.value));
                              setCurrentPage(1);
                            }}
                          >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary px-2"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        >
                          Précédent
                        </button>
                        <span className="small text-muted px-2">
                          Page {previewData.pagination.current_page} sur{' '}
                          {previewData.pagination.last_page}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary px-2"
                          disabled={currentPage >= previewData.pagination.last_page}
                          onClick={() => setCurrentPage((p) => p + 1)}
                        >
                          Suivant
                        </button>
                      </div>
                    </div>
                  )}
                </SurfaceCard>
              )}

              {/* Print Preview Tab (visible in tab, and always active during print rendering) */}
              {(activePreviewTab === 'print' || window.matchMedia('print').matches) && (
                <div>
                  <div className="d-flex justify-content-end mb-3 d-print-none">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => window.print()}
                    >
                      <i className="ti ti-printer me-1" />
                      {t('reports.print')}
                    </button>
                  </div>

                  <div className="print-layout-container">
                    <h1>{reportName || t('reports.newReport')}</h1>
                    <div className="report-meta d-flex justify-content-between">
                      <div>
                        <strong>Base :</strong> {databaseQuery.data?.name} •{' '}
                        <strong>Table :</strong> {tableQuery.data?.name}
                      </div>
                      <div>
                        <strong>Date :</strong> {new Date().toLocaleDateString('fr-FR')}
                      </div>
                    </div>

                    {previewData?.groups?.map((group: any, gIdx: number) => (
                      <div key={gIdx} className="mb-4">
                        {group.key && (
                          <div className="group-header">
                            {groupField} : {group.key} ({group.records.length})
                          </div>
                        )}
                        {!showHeadersOnly &&
                          (selectedViewId ? (
                            <div className="vstack gap-3 d-flex flex-column">
                              {group.records.map((rec: any, rIdx: number) => {
                                const titleFieldDef = fieldsQuery.data?.find(
                                  (f) => f.options?.is_title === true || f.type === 'title'
                                );
                                const titleValKey = titleFieldDef
                                  ? Object.keys(rec).find(
                                      (k) => k.toLowerCase() === titleFieldDef.name.toLowerCase()
                                    )
                                  : null;
                                const cardTitle = titleValKey ? rec[titleValKey] : null;

                                return (
                                  <div
                                    className="card p-3 border mb-3 bg-white w-100 text-start"
                                    key={rIdx}
                                    style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                                  >
                                    {cardTitle && (
                                      <div className="border-bottom pb-1 mb-2">
                                        <h4
                                          className="fw-bold mb-0 text-primary text-start"
                                          style={{ fontSize: '12pt' }}
                                        >
                                          {String(cardTitle)}
                                        </h4>
                                      </div>
                                    )}
                                    <div className="row g-2">
                                      {columnsLayout.map((colFields, colIdx) => {
                                        const colWidthClass =
                                          columnsLayout.length === 1 ? 'col-12' : 'col-6';
                                        return (
                                          <div key={colIdx} className={colWidthClass}>
                                            <div className="p-2 border border-dashed rounded bg-light-subtle h-100">
                                              {colFields.map((fId) => {
                                                const cleanId = fId.startsWith('draft-')
                                                  ? fId.substring(6)
                                                  : fId;
                                                const fieldDef = fieldsByIdMap.get(cleanId);
                                                if (!fieldDef || fieldDef.type === 'title')
                                                  return null;

                                                return (
                                                  <div key={cleanId} className="mb-2 text-start">
                                                    <div
                                                      className="text-muted fw-bold text-uppercase"
                                                      style={{
                                                        fontSize: '7pt',
                                                        letterSpacing: '0.05em',
                                                      }}
                                                    >
                                                      {fieldDef.name}
                                                    </div>
                                                    <div
                                                      style={{ fontSize: '9pt', color: '#1e293b' }}
                                                    >
                                                      {renderCardField(fieldDef, rec)}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <table>
                              <thead>
                                <tr>
                                  {previewData?.columns?.map((col: string) => {
                                    const colDef = availableColumns.find(
                                      (c) => c.name.toLowerCase() === col.toLowerCase()
                                    );
                                    return <th key={col}>{colDef ? colDef.label : col}</th>;
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                {group.records.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={previewData?.columns?.length || 1}
                                      className="text-center text-muted"
                                    >
                                      Aucune fiche
                                    </td>
                                  </tr>
                                ) : (
                                  group.records.map((rec: any, rIdx: number) => (
                                    <tr key={rIdx}>
                                      {previewData?.columns?.map((col: string) => {
                                        const val = rec[col];
                                        return (
                                          <td key={col}>
                                            {Array.isArray(val)
                                              ? val.join(', ')
                                              : typeof val === 'object' && val !== null
                                                ? val.lat !== undefined && val.lng !== undefined
                                                  ? `${val.lat}, ${val.lng}`
                                                  : JSON.stringify(val)
                                                : (val ?? '-')}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedReportId && (
        <ShareModal
          databaseId={databaseId}
          targetType="report"
          targetId={selectedReportId}
          targetName={reportName}
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}
    </div>
  );
}
