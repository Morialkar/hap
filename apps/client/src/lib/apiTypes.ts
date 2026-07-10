export type ApiPrimitive = string | number | boolean | null;
export type ApiValue = ApiPrimitive | ApiValue[] | { [key: string]: ApiValue };
export type ApiRecordData = Record<string, ApiValue>;

export interface ApiRecord {
  id: string;
  table_id: string;
  data: ApiRecordData;
  version: number;
}

export interface ApiErrorPayload {
  message?: string;
  reference_counts?: DeleteConflictData;
  [key: string]: unknown;
}

export interface DeleteConflictData {
  total: number;
  by_table: Record<string, number>;
}

export interface ApiErrorLike extends Error {
  status?: number;
  data?: ApiErrorPayload;
}
