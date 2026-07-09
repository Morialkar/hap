import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { type BuilderField } from '../lib/fieldTypes';
import { LoadingSpinner } from './LoadingSpinner';

interface RecordDetailViewProps {
  tableId: string;
  recordId: string;
}

interface ViewSchema {
  id: string;
  name: string;
  config: {
    columnCount: number;
    columns: string[][];
  } | null;
}

export function RecordDetailView({ tableId, recordId }: RecordDetailViewProps) {
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
    data: Record<string, any>;
    version: number;
  }

  const recordQuery = useQuery<{ data: RecordData }, Error>({
    queryKey: ['records', recordId],
    queryFn: () => apiClient.get(`/records/${recordId}`),
    enabled: !!recordId,
  });

  const activeView = viewsQuery.data?.data?.[0] || null;
  const fields = useMemo(() => fieldsQuery.data || [], [fieldsQuery.data]);
  const recordData = recordQuery.data?.data?.data || {};

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
        return <span className="badge bg-light text-dark px-2 py-1">{String(value)}</span>;

      case 'reference':
        return <ReferenceLabel targetRecordId={String(value)} />;

      case 'image':
      case 'file': {
        const isImg = field.type === 'image';
        const hashes = Array.isArray(value) ? value : [value];

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
        return <div className="text-dark text-wrap">{String(value)}</div>;
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
                const fieldDef = fieldsByIdMap.get(fId);
                if (!fieldDef) return null;

                return (
                  <div key={fId} className="card shadow-sm border-0 p-3">
                    <div className="small text-muted fw-bold mb-1 text-uppercase">{fieldDef.name}</div>
                    <div className="lh-sm">{renderFieldValue(fieldDef.name)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

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



function ReferenceLabel({ targetRecordId }: { targetRecordId: string }) {
  const recordQuery = useQuery<{ data: any }, Error>({
    queryKey: ['records', targetRecordId],
    queryFn: () => apiClient.get(`/records/${targetRecordId}`),
    enabled: !!targetRecordId,
  });

  if (recordQuery.isLoading) return <LoadingSpinner size="sm" />;

  const rData = recordQuery.data?.data?.data || {};
  const label =
    rData.name || rData.title || rData.nom || rData.titre || Object.values(rData)[0] || targetRecordId;

  return <span className="fw-medium text-primary">{String(label)}</span>;
}
