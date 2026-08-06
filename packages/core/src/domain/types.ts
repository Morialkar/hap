/**
 * Canonical shapes for the platform's entities.
 *
 * Routes and components each used to declare their own copy — `Table` and `Database`
 * were written out seven times apiece, with fields that drifted between them. The
 * repository drivers need one agreed shape, so these are it.
 */

/** The field-type registry's closed set. Drivers and UI must agree on it. */
export type FieldType =
  | 'title'
  | 'text'
  | 'long_text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'reference'
  | 'image'
  | 'file'
  | 'url'
  | 'email'
  | 'gps'
  | 'compound';

export interface Workspace {
  id: string;
  name: string;
}

export interface Database {
  id: string;
  name: string;
  workspace_id: string;
  locale?: string;
}

export interface Table {
  id: string;
  name: string;
  database_id: string;
  is_front_facing?: boolean;
}

export interface Field {
  id: string;
  name: string;
  type: FieldType;
  position: number;
  table_id: string;
  options?: Record<string, unknown>;
  validation?: Record<string, unknown>;
  is_filterable?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RecordEntity {
  id: string;
  table_id: string;
  data: Record<string, unknown>;
  version: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface ViewEntity {
  id: string;
  table_id: string;
  name: string;
  type: string;
  config: Record<string, unknown> | null;
  is_default?: boolean;
  is_single_default?: boolean;
}

export interface ReportQuery {
  select?: string[];
  group_by?: string;
  sort?: { field: string; direction: 'asc' | 'desc' }[];
  where?: {
    logic: 'and' | 'or';
    conditions: { field: string; operator: string; value: unknown }[];
  };
}

export interface ReportLayout {
  fields?: { name: string; visible: boolean; order?: number }[];
  group_order?: string[];
  view_id?: string;
  show_headers_only?: boolean;
  per_page?: number;
  orientation?: 'portrait' | 'landscape';
  card_columns?: number;
  compact_cards?: boolean;
}

export interface Report {
  id: string;
  table_id: string;
  name: string;
  query: ReportQuery | null;
  layout: ReportLayout | null;
}

export interface Share {
  id: string;
  token?: string;
  database_id?: string;
  table_id?: string | null;
  expires_at?: string | null;
}

export interface Template {
  id: string;
  name: string;
  version?: string;
  description?: string;
}

/** What a destructive schema change would cost, shown before it is confirmed. */
export interface SchemaImpact {
  affected_records: number;
  orphaned_values: number;
  coercion_required: boolean;
}

export interface Paginated<T> {
  data: T[];
  pagination?: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}
