// The record shape lives in @hap/core so both drivers and the UI share it.
import type { RecordData, RecordEntity, RecordPrimitive, RecordValue } from '@hap/core';

export type ApiPrimitive = RecordPrimitive;
export type ApiValue = RecordValue;
export type ApiRecordData = RecordData;
export type ApiRecord = RecordEntity;

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
