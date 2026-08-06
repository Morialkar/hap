import type {
  Database,
  RecordData,
  Field,
  Paginated,
  RecordEntity,
  Report,
  SchemaImpact,
  Share,
  Table,
  Template,
  ViewEntity,
} from "../domain/types";

/**
 * The data access contract the client codes against, so the shell choice stays
 * reversible (working agreement behind D8) and a local SQLite driver can replace the
 * HTTP one without touching a single screen.
 *
 * Query keys, caching and optimistic updates stay in the client: these are plain
 * promises, deliberately free of TanStack Query concepts.
 */

export interface DatabaseRepository {
  list(): Promise<Database[]>;
  get(id: string): Promise<Database>;
  create(input: { name: string; workspace_id: string }): Promise<Database>;
  /** Also envelope-wrapped; callers narrow the point shape. */
  mapPoints<T = unknown>(databaseId: string): Promise<{ data: T[] }>;
}

export interface CsvImportResult {
  detected_encoding: string;
  delimiter: string;
  row_count: number;
  accepted_count: number;
  rejected_count: number;
  warnings: string[];
  accepted_rows: Array<{
    row: number;
    data: Record<string, unknown>;
    record_id?: string;
  }>;
  rejected_rows: Array<{ row: number; errors: Record<string, string[]> }>;
}

export interface TableRepository {
  list(databaseId?: string): Promise<Table[]>;
  get(id: string): Promise<Table>;
  create(input: { name: string; database_id: string }): Promise<Table>;
  update(id: string, input: Partial<Table>): Promise<Table>;
  /**
   * Upload-shaped on purpose: the hosted driver posts multipart, and a local driver
   * can read the same payload off disk.
   */
  csvImportDryRun(tableId: string, payload: FormData): Promise<CsvImportResult>;
  csvImport(tableId: string, payload: FormData): Promise<CsvImportResult>;
}

export interface FieldRepository {
  listByTable(tableId: string): Promise<Field[]>;
  create(input: Partial<Field> & { table_id: string }): Promise<Field>;
  update(
    id: string,
    input: Partial<Field> & { confirmation_token?: string },
  ): Promise<Field>;
  /** Deleting a field is always destructive server-side, so a token is always required. */
  remove(id: string, confirmationToken?: string): Promise<void>;
  previewImpact(id: string): Promise<SchemaImpact>;
  confirmationToken(id: string): Promise<{ token: string }>;
}

export interface RecordFilter {
  field: string;
  operator: string;
  value: string;
}

export interface RecordListParams {
  table_id: string;
  per_page?: number;
  page?: number;
  search?: string;
  sort?: string;
  /** Named after the query parameter the API actually reads. */
  sort_dir?: "asc" | "desc";
  /** Sent JSON-encoded; an array, not a map — the UI allows repeated fields. */
  filters?: RecordFilter[];
}

export interface RecordRepository {
  list(params: RecordListParams): Promise<Paginated<RecordEntity>>;
  get(id: string): Promise<RecordEntity>;
  create(input: { table_id: string; data: RecordData }): Promise<RecordEntity>;
  /** `version` drives the optimistic-concurrency guard when the caller has one. */
  update(
    id: string,
    input: { data: RecordData; version?: number },
  ): Promise<RecordEntity>;
  remove(id: string): Promise<void>;

  /** Soft-deleted records, restorable until purged. Wrapped in a `data` envelope. */
  trash<T = RecordEntity>(tableId: string): Promise<{ data: T[] }>;
  restore(id: string): Promise<RecordEntity>;
  purge(id: string): Promise<void>;

  /** The API wraps these in a `data` envelope; callers narrow the entry shape. */
  history<T = unknown>(id: string): Promise<{ data: T[] }>;
  /** Restores from an activity-log entry; the API keys this by log id, not version. */
  restoreVersion(id: string, logId: number): Promise<RecordEntity>;

  /** Records pointing at this one; a delete is blocked until they are reassigned. */
  referencingRecords<T = unknown>(id: string): Promise<{ data: T[] }>;
  reassignLinks(id: string, toRecordId: string): Promise<void>;
}

export interface ViewRepository {
  listByTable(tableId: string): Promise<ViewEntity[]>;
  create(
    input: Partial<ViewEntity> & { table_id: string },
  ): Promise<ViewEntity>;
  update(id: string, input: Partial<ViewEntity>): Promise<ViewEntity>;
  remove(id: string): Promise<void>;
}

export interface ReportRepository {
  listByTable(tableId: string): Promise<Report[]>;
  create(input: Partial<Report> & { table_id: string }): Promise<Report>;
  update(id: string, input: Partial<Report>): Promise<Report>;
  remove(id: string): Promise<void>;
  preview(input: {
    table_id: string;
    query?: unknown;
    layout?: unknown;
    per_page?: number;
    page?: number;
  }): Promise<{ columns: string[]; groups: unknown[]; pagination?: unknown }>;
}

export interface ShareInput {
  name: string;
  target_type: Share["target_type"];
  target_id: string;
  expires_at: string | null;
}

export interface ShareRepository {
  listByDatabase(databaseId: string): Promise<Share[]>;
  create(databaseId: string, input: ShareInput): Promise<Share>;
  remove(id: string): Promise<void>;
  getByToken(token: string): Promise<unknown>;
}

export interface TemplateInstallInput {
  format_version: number;
  template_version: string;
  name: string;
  payload: Template["payload"];
}

export interface TemplateRepository {
  list(): Promise<Template[]>;
  /** The whole payload travels: the installer rewrites the database name into it. */
  install(workspaceId: string, input: TemplateInstallInput): Promise<unknown>;
}

/** Everything the client needs, in one injectable object. */
export interface HapRepository {
  databases: DatabaseRepository;
  tables: TableRepository;
  fields: FieldRepository;
  records: RecordRepository;
  views: ViewRepository;
  reports: ReportRepository;
  shares: ShareRepository;
  templates: TemplateRepository;
}
