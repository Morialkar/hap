import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { ApiRecord, ApiRecordData } from '../lib/apiTypes';
import { parseGpsValue } from '../lib/fieldDisplay';
import { type BuilderField } from '../lib/fieldTypes';
import { GpsMapPicker } from './GpsMapPicker';
import { LoadingSpinner } from './LoadingSpinner';
import { Link } from '@tanstack/react-router';

interface RecordDetailViewProps {
  tableId: string;
  recordId: string;
  databaseId: string;
}

interface ViewSchema {
  id: string;
  name: string;
  type?: string;
  config: {
    columnCount: number;
    columns: string[][];
    hiddenLabels?: Record<string, boolean>;
  } | null;
  is_default?: boolean;
  is_single_default?: boolean;
}

export function RecordDetailView({ tableId, recordId, databaseId: propsDatabaseId }: RecordDetailViewProps) {
  const [activeLightboxHash, setActiveLightboxHash] = useState<string | null>(null);

  // Queries
  const fieldsQuery = useQuery<BuilderField[], Error>({
    queryKey: ['fields', tableId],
    queryFn: () => apiClient.get(`/fields?table_id=${tableId}`),
  });

  const viewsQuery = useQuery<{ data: ViewSchema[] }, Error>({
    queryKey: ['views', tableId],
    queryFn: () => apiClient.get(`/views?table_id=${tableId}`),
  });

  interface RecordData {
    id: string;
    table_id: string;
    data: ApiRecordData;
    version: number;
  }

  const recordQuery = useQuery<RecordData, Error>({
    queryKey: ['records', recordId],
    queryFn: () => apiClient.get(`/records/${recordId}`),
    enabled: !!recordId,
  });

  const databaseId = propsDatabaseId;

  const tablesQuery = useQuery<{ id: string; name: string }[], Error>({
    queryKey: ['tables', databaseId],
    queryFn: () => apiClient.get(`/tables?database_id=${databaseId}`),
    enabled: !!databaseId,
  });

  const tablesMap = useMemo(() => {
    return new Map((tablesQuery.data || []).map((t) => [t.id, t.name]));
  }, [tablesQuery.data]);

  const referencingQuery = useQuery<{ data: ReferencingRecordItem[] }, Error>({
    queryKey: ['records', recordId, 'referencing'],
    queryFn: () => apiClient.get(`/records/${recordId}/referencing-records`),
    enabled: !!recordId,
  });

  const referencingRecords = referencingQuery.data?.data || [];

  const activeView = useMemo(() => {
    const list = viewsQuery.data?.data || [];
    const singleDefault = list.find((v) => v.is_single_default);
    if (singleDefault) return singleDefault;
    const cardView = list.find((v) => v.type === 'card');
    if (cardView) return cardView;
    return list[0] || null;
  }, [viewsQuery.data]);
  const fields = useMemo(() => fieldsQuery.data || [], [fieldsQuery.data]);
  const recordData = recordQuery.data?.data || {};

  // Maps for ID and Name lookups
  const fieldsByIdMap = useMemo(() => {
    return new Map(fields.map((f) => [f.id, f]));
  }, [fields]);

  const fieldsByNameMap = useMemo(() => {
    return new Map(fields.map((f) => [f.name, f]));
  }, [fields]);

  // Construct column layouts to render
  const columnsLayout = useMemo(() => {
    if (!activeView || !activeView.config || !activeView.config.columns) {
      // Fallback: single column with all fields in order
      return [fields.map((f) => f.id)];
    }
    return activeView.config.columns;
  }, [activeView, fields]);

  const isLoading = fieldsQuery.isLoading || viewsQuery.isLoading || recordQuery.isLoading;

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (recordQuery.isError) {
    return (
      <div className="alert alert-danger mb-0" role="alert" data-testid="detail-error">
        {recordQuery.error.message}
      </div>
    );
  }

  // Helper to render field value
  const renderFieldValue = (fieldName: string) => {
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
        return <ReferenceLabel targetRecordId={String(value)} databaseId={databaseId} />;

      case 'gps': {
        const coordinates = parseGpsValue(value);
        return coordinates ? (
          <GpsMapPicker coordinates={coordinates} height={220} readOnly />
        ) : (
          <span className="text-muted small">--</span>
        );
      }

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
                      style={{ width: 64, height: 64, objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `/api/v1/uploads/${hash}`;
                      }}
                      data-testid={`image-thumbnail-${hash}`}
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
        return <div className="text-body text-wrap">{String(value)}</div>;
    }
  };

  const colWidthClass =
    columnsLayout.length === 4
      ? 'col-md-3'
      : columnsLayout.length === 3
        ? 'col-md-4'
        : columnsLayout.length === 2
          ? 'col-md-6'
          : 'col-12';

  return (
    <div className="vstack gap-4" data-testid="detail-view">
      <div className="row g-3">
        {columnsLayout.map((colFields, colIdx) => (
          <div key={colIdx} className={colWidthClass}>
            <div className="vstack gap-3 h-100 p-2 border border-dashed rounded bg-light-subtle">
              {colFields.map((fId) => {
                const cleanId = fId.startsWith('draft-') ? fId.substring(6) : fId;
                const fieldDef = fieldsByIdMap.get(cleanId);
                if (!fieldDef) return null;
                const hideLabel = activeView?.config?.hiddenLabels?.[cleanId] === true;

                return (
                  <div key={cleanId} className="hap-detail-field">
                    {!hideLabel && (
                      <div className="small text-muted fw-bold mb-1 text-uppercase">
                        {fieldDef.name}
                      </div>
                    )}
                    <div className="lh-sm">{renderFieldValue(fieldDef.name)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {referencingRecords.length > 0 && (
        <div className="mt-4 border-top pt-3" data-testid="referencing-section">
          <h4 className="h6 text-muted fw-bold text-uppercase mb-3">
            Fiches associées ({referencingRecords.length})
          </h4>
          <div className="border rounded bg-white overflow-hidden">
            {referencingRecords.map((item) => (
              <ReferencingRecordRow
                key={`${item.record_id}-${item.field_id}`}
                recordId={item.record_id}
                tableId={item.table_id}
                fieldName={item.field_name}
                recordData={item.record_data}
                databaseId={databaseId}
                tableName={tablesMap.get(item.table_id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Lightbox Modal overlay */}
      {activeLightboxHash && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          role="dialog"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100 }}
          onClick={() => setActiveLightboxHash(null)}
          data-testid="lightbox"
        >
          <div
            className="modal-dialog modal-dialog-centered modal-xl"
            onClick={(e) => e.stopPropagation()}
          >
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
  className = 'fw-medium text-primary',
  databaseId,
}: {
  targetRecordId: string;
  fallback?: string;
  className?: string;
  databaseId: string;
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

  // Determine the label to display
  let labelText = '';
  const titleField = fields.find((f) => f.options?.is_title === true) ?? fields.find((f) => f.type === 'title');
  if (
    titleField &&
    rData[titleField.name] !== undefined &&
    rData[titleField.name] !== null &&
    rData[titleField.name] !== ''
  ) {
    labelText = String(rData[titleField.name]);
  } else {
    const sortedFields = [...fields].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const firstField = sortedFields[0];
    if (
      firstField &&
      rData[firstField.name] !== undefined &&
      rData[firstField.name] !== null &&
      rData[firstField.name] !== ''
    ) {
      labelText = String(rData[firstField.name]);
    } else {
      labelText = String(
        rData.name ||
        rData.title ||
        rData.nom ||
        rData.titre ||
        Object.values(rData)[0] ||
        fallback ||
        targetRecordId
      );
    }
  }



  if (databaseId && targetTableId) {
    const isFront = window.location.pathname.startsWith('/navigation');
    if (isFront) {
      return (
        <Link
          to="/navigation/$databaseId/record/$recordId"
          params={{ databaseId, recordId: targetRecordId }}
          className={`${className} text-decoration-none`}
        >
          {labelText}
        </Link>
      );
    }
    return (
      <Link
        to="/tables/$databaseId/$tableId"
        params={{ databaseId, tableId: targetTableId }}
        search={{ recordId: targetRecordId }}
        className={`${className} text-decoration-none`}
      >
        {labelText}
      </Link>
    );
  }

  return <span className={className}>{labelText}</span>;
}

interface ReferencingRecordItem {
  record_id: string;
  table_id: string;
  field_id: string;
  field_name: string;
  record_data: ApiRecordData;
}

function ReferencingRecordRow({
  recordId,
  tableId,
  fieldName,
  recordData,
  databaseId,
  tableName,
}: {
  recordId: string;
  tableId: string;
  fieldName: string;
  recordData: ApiRecordData;
  databaseId?: string;
  tableName?: string;
}) {
  const fieldsQuery = useQuery<BuilderField[], Error>({
    queryKey: ['fields', tableId],
    queryFn: () => apiClient.get(`/fields?table_id=${tableId}`),
    enabled: !!tableId,
  });

  if (fieldsQuery.isLoading) {
    return <LoadingSpinner size="sm" />;
  }

  const fields = fieldsQuery.data || [];

  // Determine the label to display
  let labelText = '';
  const titleField = fields.find((f) => f.options?.is_title === true) ?? fields.find((f) => f.type === 'title');
  if (
    titleField &&
    recordData[titleField.name] !== undefined &&
    recordData[titleField.name] !== null &&
    recordData[titleField.name] !== ''
  ) {
    labelText = String(recordData[titleField.name]);
  } else {
    const sortedFields = [...fields].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const firstField = sortedFields[0];
    if (
      firstField &&
      recordData[firstField.name] !== undefined &&
      recordData[firstField.name] !== null &&
      recordData[firstField.name] !== ''
    ) {
      labelText = String(recordData[firstField.name]);
    } else {
      labelText = String(
        recordData.name ||
        recordData.title ||
        recordData.nom ||
        recordData.titre ||
        Object.values(recordData)[0] ||
        recordId
      );
    }
  }

  return (
    <div className="hap-referencing-record d-flex align-items-center justify-content-between p-2 border-bottom gap-3">
      <div className="hap-referencing-record-title flex-grow-1">
        {databaseId ? (
          window.location.pathname.startsWith('/navigation') ? (
            <Link
              to="/navigation/$databaseId/record/$recordId"
              params={{ databaseId, recordId }}
              className="fw-bold text-primary text-decoration-none text-wrap text-break"
            >
              {labelText}
            </Link>
          ) : (
            <Link
              to="/tables/$databaseId/$tableId"
              params={{ databaseId, tableId }}
              search={{ recordId }}
              className="fw-bold text-primary text-decoration-none text-wrap text-break"
            >
              {labelText}
            </Link>
          )
        ) : (
          <span className="fw-bold text-primary text-wrap text-break">{labelText}</span>
        )}
        <div className="text-muted small">
          Champ : <span className="font-monospace">{fieldName}</span>
        </div>
      </div>
      {tableName && (
        <span className="hap-referencing-record-table badge text-bg-secondary">{tableName}</span>
      )}
    </div>
  );
}
