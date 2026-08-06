/**
 * Canonical shapes for the platform's entities.
 *
 * Routes and components each used to declare their own copy — `Table` and `Database`
 * were written out seven times apiece, with fields that drifted between them. The
 * repository drivers need one agreed shape, so these are it.
 */

/** The field-type registry's closed set. Drivers and UI must agree on it. */
export type FieldType =
  | "title"
  | "text"
  | "long_text"
  | "number"
  | "date"
  | "boolean"
  | "select"
  | "reference"
  | "image"
  | "file"
  | "url"
  | "email"
  | "gps"
  | "compound";

/** What a record field can hold once serialized. */
export type RecordPrimitive = string | number | boolean | null;
export type RecordValue =
  RecordPrimitive | RecordValue[] | { [key: string]: RecordValue };
export type RecordData = Record<string, RecordValue>;

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
  /** Always present in the domain; drivers substitute {} when the API omits them. */
  options: Record<string, unknown>;
  validation: Record<string, unknown>;
  is_filterable?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RecordEntity {
  id: string;
  table_id: string;
  data: RecordData;
  version: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

/** The card layout a view describes: fields laid out in columns. */
export interface ViewConfig {
  columnCount: number;
  columns: string[][];
  hiddenLabels?: Record<string, boolean>;
}

export interface ViewEntity {
  id: string;
  table_id: string;
  name: string;
  type: string;
  config: ViewConfig | null;
  is_default?: boolean;
  is_single_default?: boolean;
}

export interface ReportQuery {
  select?: string[];
  group_by?: string;
  sort?: { field: string; direction: "asc" | "desc" }[];
  where?: {
    logic: "and" | "or";
    conditions: { field: string; operator: string; value: unknown }[];
  };
}

export interface ReportLayout {
  fields?: { name: string; visible: boolean; order?: number }[];
  group_order?: string[];
  view_id?: string;
  show_headers_only?: boolean;
  per_page?: number;
  orientation?: "portrait" | "landscape";
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
  name: string;
  token: string;
  target_type: "record" | "view" | "report";
  target_id: string;
  target_name: string;
  expires_at: string | null;
  created_at: string;
  is_expired: boolean;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  /** Bumped when the template format itself changes, for the upgrade path. */
  format_version: number;
  template_version: string;
  /** The installer rewrites `database.name`; the rest travels untouched. */
  payload: {
    database?: { name?: string; [key: string]: unknown };
    [key: string]: unknown;
  };
  includes_demo_records: boolean;
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
