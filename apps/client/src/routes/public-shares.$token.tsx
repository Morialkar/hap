import { createFileRoute, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useRepository } from '../contexts/RepositoryContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { GpsMapPicker } from '../components/GpsMapPicker';
import { GpsLocalityLabel } from '../components/GpsLocalityLabel';

export const Route = createFileRoute('/public-shares/$token')({
  component: PublicShareView,
});

interface BuilderField {
  id: string;
  name: string;
  type: string;
  options?: any;
}

function PublicShareView() {
  const repository = useRepository();
  const { token } = useParams({ from: '/public-shares/$token' });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeImageHash, setActiveImageHash] = useState<string | null>(null);

  // Fetch public share dataset
  const shareQuery = useQuery<any, any>({
    queryKey: ['public-share', token],
    queryFn: () => repository.shares.getByToken(token),
    retry: false,
  });

  const getMediaUrl = (hash: string) => `/api/v1/shares/${token}/uploads/${hash}`;
  const getThumbnailUrl = (hash: string) => `/api/v1/shares/${token}/uploads/${hash}/thumbnail`;

  const parseGpsCoordinates = (val: any) => {
    if (!val) return null;
    if (typeof val === 'object' && val.lat && val.lng) {
      return { lat: Number(val.lat), lng: Number(val.lng) };
    }
    if (typeof val === 'string') {
      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(val);
      } catch {
        parsedValue = undefined;
      }
      if (
        typeof parsedValue === 'object' &&
        parsedValue !== null &&
        'lat' in parsedValue &&
        'lng' in parsedValue
      ) {
        return { lat: Number(parsedValue.lat), lng: Number(parsedValue.lng) };
      }
      const parts = val.split(',').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { lat: parts[0], lng: parts[1] };
      }
    }
    return null;
  };

  const renderSharedValue = (field: BuilderField, value: any) => {
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
        if (Array.isArray(value)) {
          return (
            <div className="d-flex flex-wrap gap-1">
              {value.map((v, i) => (
                <span key={i} className="badge bg-light text-dark border px-2 py-1">
                  {String(v)}
                </span>
              ))}
            </div>
          );
        }
        return <span className="badge bg-light text-dark border px-2 py-1">{String(value)}</span>;

      case 'gps': {
        const coords = parseGpsCoordinates(value);
        return coords ? (
          <div className="vstack gap-2">
            <GpsMapPicker coordinates={coords} height={180} readOnly />
            {field.options?.show_locality === true && <GpsLocalityLabel coordinates={coords} />}
          </div>
        ) : (
          <span className="text-muted small">--</span>
        );
      }

      case 'image':
      case 'file': {
        const isImg = field.type === 'image';
        const files = Array.isArray(value) ? value : [value];

        return (
          <div className="d-flex flex-wrap gap-2 mt-1">
            {files.map((fileObj: any, index) => {
              const fileHash = typeof fileObj === 'object' ? fileObj.hash : String(fileObj);
              const fileName = typeof fileObj === 'object' ? fileObj.name : 'Fichier';
              if (!fileHash) return null;

              return (
                <div
                  key={index}
                  className="border rounded p-1 bg-white shadow-sm position-relative"
                >
                  {isImg ? (
                    <button
                      type="button"
                      className="btn btn-link p-0 border-0"
                      onClick={() => setActiveImageHash(fileHash)}
                      title="Zoom"
                    >
                      <img
                        src={getThumbnailUrl(fileHash)}
                        alt="Aperçu"
                        className="rounded"
                        style={{ width: 80, height: 80, objectFit: 'cover' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getMediaUrl(fileHash);
                        }}
                      />
                    </button>
                  ) : (
                    <a
                      href={getMediaUrl(fileHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="d-flex align-items-center gap-1 small text-decoration-none py-1 px-2 fw-semibold text-primary"
                    >
                      <i className="ti ti-download fs-4" />
                      <span>{fileName}</span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        );
      }

      default:
        return <div className="text-body text-wrap small">{String(value)}</div>;
    }
  };

  if (shareQuery.isLoading) {
    return (
      <div
        className="d-flex align-items-center justify-content-center"
        style={{ minHeight: '100vh' }}
      >
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (shareQuery.isError) {
    const status = shareQuery.error?.status || shareQuery.error?.response?.status;
    return (
      <div className="container py-6 col-md-6 col-lg-5">
        <div className="card shadow border-0 text-center p-4">
          <div className="card-body">
            <div className="text-danger mb-3">
              <i className="ti ti-lock-off display-4" />
            </div>
            <h3 className="fw-bold mb-2">
              {status === 410 ? 'Lien de partage expiré' : 'Lien invalide'}
            </h3>
            <p className="text-muted small">
              {status === 410
                ? "Ce lien de partage n'est plus actif car sa date de validité est dépassée."
                : 'Ce lien de partage est introuvable ou a été révoqué par son propriétaire.'}
            </p>
            <div className="mt-4">
              <a href="/login" className="btn btn-primary btn-sm">
                Se connecter à l'application
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const {
    target_type,
    name,
    database_name,
    table_name,
    record,
    view,
    records,
    report,
    result,
    fields,
  } = shareQuery.data;

  const fieldsByNameMap = new Map<string, BuilderField>(fields?.map((f: any) => [f.name, f]) || []);

  return (
    <div className="container py-4">
      {/* Top Banner */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 border-bottom pb-3 mb-4 d-print-none">
        <div>
          <span className="badge bg-primary-subtle text-primary mb-1">
            Partage Public • {database_name}
          </span>
          <h2 className="h4 fw-bold mb-0 text-dark">{name}</h2>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => window.print()}
          >
            <i className="ti ti-printer me-1" />
            Imprimer
          </button>
        </div>
      </div>

      {/* Target Renderers */}
      {target_type === 'record' && record && (
        <div className="row justify-content-center">
          <div className="col-lg-10">
            <SurfaceCard>
              <div className="card-header border-bottom-0 pb-0 d-flex align-items-center justify-content-between">
                <div>
                  <h3 className="card-title fw-bold text-dark">{table_name}</h3>
                  <p className="text-muted small mb-0">Fiche d'archive en lecture seule</p>
                </div>
                <i className="ti ti-file-text text-primary fs-2" />
              </div>
              <div className="card-body">
                <div className="row g-4">
                  {fields.map((field: BuilderField) => {
                    const value = record.data[field.name];
                    return (
                      <div key={field.id} className="col-md-6 col-12">
                        <div className="p-3 border rounded bg-light-subtle h-100">
                          <label className="form-label text-muted small fw-bold mb-1">
                            {field.name}
                          </label>
                          <div className="fw-medium text-dark">
                            {renderSharedValue(field, value)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SurfaceCard>
          </div>
        </div>
      )}

      {target_type === 'view' && view && (
        <SurfaceCard>
          <div className="card-header pb-0 border-bottom-0 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <h3 className="card-title fw-bold text-dark">
                {table_name} • {view.name}
              </h3>
              <p className="text-muted small mb-0">
                Données partagées en lecture seule ({records?.length || 0} fiches)
              </p>
            </div>
            <div className="input-icon w-auto" style={{ minWidth: '220px' }}>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-vcenter card-table table-hover">
                <thead>
                  <tr>
                    {fields.map((f: BuilderField) => (
                      <th key={f.id}>{f.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records
                    ?.filter((r: any) =>
                      Object.values(r.data).some((val) =>
                        String(val).toLowerCase().includes(searchQuery.toLowerCase())
                      )
                    )
                    .map((r: any) => (
                      <tr key={r.id}>
                        {fields.map((f: BuilderField) => (
                          <td key={f.id}>{renderSharedValue(f, r.data[f.name])}</td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </SurfaceCard>
      )}

      {target_type === 'report' && report && result && (
        <SurfaceCard>
          <div className="card-header pb-0 border-bottom-0">
            <h3 className="card-title fw-bold text-dark">
              {table_name} • {report.name}
            </h3>
            <p className="text-muted small mb-0">
              Rapport généré le {new Date().toLocaleDateString('fr-FR')}
            </p>
          </div>
          <div className="card-body">
            {/* Show Headers Only or standard grouped table */}
            {report.layout?.show_headers_only === true ? (
              <div className="vstack gap-2">
                {result.groups?.map((group: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 border rounded bg-light d-flex justify-content-between align-items-center"
                  >
                    <span className="fw-bold text-primary">
                      {group.group_value || 'Sans regroupement'}
                    </span>
                    <span className="badge bg-secondary-subtle text-secondary px-2 py-1">
                      {group.count} {group.count > 1 ? 'fiches' : 'fiche'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="vstack gap-4">
                {result.groups?.map((group: any, gIdx: number) => (
                  <div key={gIdx} className="border rounded p-3 bg-white">
                    <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                      <h4 className="fw-bold mb-0 text-primary">
                        {group.group_value || 'Sans regroupement'}
                      </h4>
                      <span className="badge bg-secondary-subtle text-secondary">
                        {group.count} {group.count > 1 ? 'fiches' : 'fiche'}
                      </span>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-vcenter table-sm card-table">
                        <thead>
                          <tr>
                            {report.query?.select?.map((colName: string) => {
                              const f = fieldsByNameMap.get(colName);
                              return <th key={colName}>{f ? f.name : colName}</th>;
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {group.records?.map((r: any, rIdx: number) => (
                            <tr key={rIdx}>
                              {report.query?.select?.map((colName: string) => {
                                const f = fieldsByNameMap.get(colName);
                                return (
                                  <td key={colName}>
                                    {f
                                      ? renderSharedValue(f, r.data[colName])
                                      : String(r.data[colName] ?? '--')}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SurfaceCard>
      )}

      {/* Lightbox Modal */}
      {activeImageHash && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ zIndex: 2000 }}
            onClick={() => setActiveImageHash(null)}
          />
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            style={{ zIndex: 2010 }}
            onClick={() => setActiveImageHash(null)}
          >
            <div
              className="modal-dialog modal-lg modal-dialog-centered"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-content bg-transparent border-0">
                <div className="position-relative text-center">
                  <button
                    type="button"
                    className="btn-close btn-close-white position-absolute top-0 end-0 m-3"
                    style={{ zIndex: 10 }}
                    onClick={() => setActiveImageHash(null)}
                  />
                  <img
                    src={getMediaUrl(activeImageHash)}
                    alt="Agrandissement"
                    className="img-fluid rounded shadow-lg max-h-80"
                    style={{ maxHeight: '85vh', objectFit: 'contain' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
