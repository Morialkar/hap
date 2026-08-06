import type {
  CsvImportResult,
  Database,
  Field,
  HapRepository,
  Paginated,
  RecordEntity,
  RecordListParams,
  Report,
  SchemaImpact,
  Share,
  Table,
  Template,
  ViewEntity,
} from '@hap/core';
import { apiClient } from './apiClient';

/**
 * The hosted driver: the repository contract over the REST API.
 *
 * Paths and payloads mirror what the screens were calling directly, so swapping the
 * call sites to the repository changes no behaviour. A SQLite driver implementing the
 * same contract is what makes the local mode possible (R3-B).
 */

function recordQuery(params: RecordListParams): string {
  const query = new URLSearchParams();
  query.append('table_id', params.table_id);
  if (params.per_page !== undefined) query.append('per_page', String(params.per_page));
  if (params.page !== undefined) query.append('page', String(params.page));
  if (params.search) query.append('search', params.search);
  if (params.sort) query.append('sort', params.sort);
  if (params.sort_dir) query.append('sort_dir', params.sort_dir);
  if (params.filters && Object.keys(params.filters).length > 0) {
    query.append('filters', JSON.stringify(params.filters));
  }
  return query.toString();
}

export const httpRepository: HapRepository = {
  databases: {
    list: () => apiClient.get<Database[]>('/databases'),
    get: (id) => apiClient.get<Database>(`/databases/${id}`),
    create: (input) => apiClient.post<Database>('/databases', input),
    mapPoints: (databaseId) => apiClient.get<unknown[]>(`/databases/${databaseId}/map-points`),
  },

  tables: {
    list: (databaseId) =>
      apiClient.get<Table[]>(databaseId ? `/tables?database_id=${databaseId}` : '/tables'),
    get: (id) => apiClient.get<Table>(`/tables/${id}`),
    create: (input) => apiClient.post<Table>('/tables', input),
    update: (id, input) => apiClient.put<Table>(`/tables/${id}`, input),
    csvImportDryRun: (tableId, payload) =>
      apiClient.postForm<CsvImportResult>(`/tables/${tableId}/csv-import/dry-run`, payload),
    csvImport: (tableId, payload) =>
      apiClient.postForm<CsvImportResult>(`/tables/${tableId}/csv-import`, payload),
  },

  fields: {
    listByTable: (tableId) => apiClient.get<Field[]>(`/fields?table_id=${tableId}`),
    create: (input) => apiClient.post<Field>('/fields', input),
    update: (id, input) => apiClient.put<Field>(`/fields/${id}`, input),
    remove: (id, confirmationToken) =>
      apiClient.delete(`/fields/${id}`, { confirmation_token: confirmationToken }),
    previewImpact: (id) => apiClient.get<SchemaImpact>(`/fields/${id}/preview-impact`),
    confirmationToken: (id) => apiClient.get<{ token: string }>(`/fields/${id}/confirmation-token`),
  },

  records: {
    list: (params) => apiClient.get<Paginated<RecordEntity>>(`/records?${recordQuery(params)}`),
    get: (id) => apiClient.get<RecordEntity>(`/records/${id}`),
    create: (input) => apiClient.post<RecordEntity>('/records', input),
    update: (id, input) => apiClient.put<RecordEntity>(`/records/${id}`, input),
    remove: (id) => apiClient.delete(`/records/${id}`),

    trash: (tableId) => apiClient.get(`/records/trash?table_id=${tableId}`),
    restore: (id) => apiClient.post<RecordEntity>(`/records/${id}/restore`, {}),
    purge: (id) => apiClient.delete(`/records/${id}/purge`),

    history: (id) => apiClient.get(`/records/${id}/history`),
    restoreVersion: (id, logId) =>
      apiClient.post<RecordEntity>(`/records/${id}/restore-version`, { log_id: logId }),

    referencingRecords: (id) => apiClient.get(`/records/${id}/referencing-records`),
    reassignLinks: async (id, toRecordId) => {
      await apiClient.post(`/records/${id}/reassign-links`, { to_record_id: toRecordId });
    },
  },

  views: {
    listByTable: (tableId) => apiClient.get<ViewEntity[]>(`/views?table_id=${tableId}`),
    create: (input) => apiClient.post<ViewEntity>('/views', input),
    update: (id, input) => apiClient.put<ViewEntity>(`/views/${id}`, input),
    remove: (id) => apiClient.delete(`/views/${id}`),
  },

  reports: {
    listByTable: (tableId) => apiClient.get<Report[]>(`/reports?table_id=${tableId}`),
    create: (input) => apiClient.post<Report>('/reports', input),
    update: (id, input) => apiClient.put<Report>(`/reports/${id}`, input),
    remove: (id) => apiClient.delete(`/reports/${id}`),
    preview: (input) =>
      apiClient.post<{ columns: string[]; groups: unknown[]; pagination?: unknown }>(
        '/reports/preview',
        input
      ),
  },

  shares: {
    listByDatabase: (databaseId) => apiClient.get<Share[]>(`/databases/${databaseId}/shares`),
    create: (databaseId, input) =>
      apiClient.post<Share & { token?: string }>(`/databases/${databaseId}/shares`, input),
    remove: (id) => apiClient.delete(`/shares/${id}`),
    getByToken: (token) => apiClient.get<unknown>(`/shares/${token}`),
  },

  templates: {
    list: () => apiClient.get<Template[]>('/templates'),
    install: (workspaceId, input) =>
      apiClient.post<unknown>(`/workspaces/${workspaceId}/install-template`, input),
  },
};
