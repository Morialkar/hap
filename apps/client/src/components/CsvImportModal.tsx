import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { BuilderField, FieldType } from '../lib/fieldTypes';
import { FIELD_TYPE_ORDER } from '../lib/fieldTypes';

interface CsvImportModalProps {
  tableId: string;
  fields: BuilderField[];
  onClose: () => void;
  onImported: () => void;
}

type MappingKind = 'field' | 'create_field' | 'reference' | 'skip';

interface ColumnMapping {
  type: MappingKind;
  field: string;
  field_type?: FieldType;
  target_table_id?: string;
  display_field?: string;
  match_or_create?: boolean;
}

interface CsvImportResult {
  detected_encoding: string;
  delimiter: string;
  row_count: number;
  accepted_count: number;
  rejected_count: number;
  warnings: string[];
  accepted_rows: Array<{ row: number; data: Record<string, unknown>; record_id?: string }>;
  rejected_rows: Array<{ row: number; errors: Record<string, string[]> }>;
}

function sniffHeaders(text: string): string[] {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
  const delimiters = [',', ';', '\t'];
  const delimiter = delimiters.reduce((best, candidate) => {
    return firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best;
  }, ',');

  return firstLine
    .split(delimiter)
    .map((header) => header.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

export function CsvImportModal({ tableId, fields, onClose, onImported }: CsvImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, ColumnMapping>>({});
  const [result, setResult] = useState<CsvImportResult | null>(null);

  const fieldsByName = useMemo(() => new Map(fields.map((field) => [field.name, field])), [fields]);

  const buildFormData = () => {
    if (!file) {
      throw new Error('Aucun fichier CSV sélectionné.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));
    return formData;
  };

  const dryRunMutation = useMutation({
    mutationFn: () =>
      apiClient.postForm<CsvImportResult>(`/tables/${tableId}/csv-import/dry-run`, buildFormData()),
    onSuccess: setResult,
  });

  const importMutation = useMutation({
    mutationFn: () =>
      apiClient.postForm<CsvImportResult>(`/tables/${tableId}/csv-import`, buildFormData()),
    onSuccess: (data) => {
      setResult(data);
      onImported();
    },
  });

  const handleFileChange = async (selected: File | null) => {
    setFile(selected);
    setResult(null);

    if (!selected) {
      setHeaders([]);
      setMapping({});
      return;
    }

    const text = await selected.text();
    const parsedHeaders = sniffHeaders(text);
    setHeaders(parsedHeaders);
    setMapping(
      Object.fromEntries(
        parsedHeaders.map((header) => {
          const existingField = fieldsByName.get(header);
          return [
            header,
            existingField
              ? {
                  type: existingField.type === 'reference' ? 'reference' : 'field',
                  field: existingField.name,
                  target_table_id:
                    typeof existingField.options?.target_table === 'string'
                      ? existingField.options.target_table
                      : undefined,
                  display_field: 'Nom',
                  match_or_create: existingField.type === 'reference',
                }
              : {
                  type: 'create_field',
                  field: header,
                  field_type: 'text',
                },
          ];
        }),
      ),
    );
  };

  const updateMapping = (header: string, patch: Partial<ColumnMapping>) => {
    setMapping((current) => ({
      ...current,
      [header]: {
        ...current[header],
        ...patch,
      },
    }));
  };

  const errorMessage =
    dryRunMutation.error instanceof Error
      ? dryRunMutation.error.message
      : importMutation.error instanceof Error
        ? importMutation.error.message
        : null;

  return (
    <div className="modal modal-blur d-block" role="dialog" aria-modal="true" aria-labelledby="csv-import-title">
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h2 id="csv-import-title" className="modal-title">
              Importer un CSV
            </h2>
            <button type="button" className="btn-close" aria-label="Fermer" onClick={onClose} />
          </div>

          <div className="modal-body">
            {errorMessage && (
              <div className="alert alert-danger" role="alert">
                {errorMessage}
              </div>
            )}

            <div className="mb-3">
              <label htmlFor="csv-import-file" className="form-label">
                Fichier CSV
              </label>
              <input
                id="csv-import-file"
                type="file"
                accept=".csv,text/csv,text/plain"
                className="form-control"
                data-testid="csv-file-input"
                onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              />
            </div>

            {headers.length > 0 && (
              <div className="table-responsive mb-3">
                <table className="table table-vcenter">
                  <thead>
                    <tr>
                      <th>Colonne</th>
                      <th>Action</th>
                      <th>Champ</th>
                      <th>Type</th>
                      <th>Référence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((header) => {
                      const config = mapping[header];
                      return (
                        <tr key={header}>
                          <td className="fw-medium">{header}</td>
                          <td>
                            <select
                              className="form-select"
                              value={config?.type ?? 'skip'}
                              data-testid={`csv-map-type-${header}`}
                              onChange={(event) =>
                                updateMapping(header, { type: event.target.value as MappingKind })
                              }
                            >
                              <option value="field">Champ existant</option>
                              <option value="create_field">Créer un champ</option>
                              <option value="reference">Référence</option>
                              <option value="skip">Ignorer</option>
                            </select>
                          </td>
                          <td>
                            {config?.type === 'field' || config?.type === 'reference' ? (
                              <select
                                className="form-select"
                                value={config.field}
                                data-testid={`csv-map-field-${header}`}
                                onChange={(event) => updateMapping(header, { field: event.target.value })}
                              >
                                {fields.map((field) => (
                                  <option key={field.id} value={field.name}>
                                    {field.name}
                                  </option>
                                ))}
                              </select>
                            ) : config?.type === 'create_field' ? (
                              <input
                                type="text"
                                className="form-control"
                                value={config.field}
                                onChange={(event) => updateMapping(header, { field: event.target.value })}
                              />
                            ) : (
                              <span className="text-muted">--</span>
                            )}
                          </td>
                          <td>
                            {config?.type === 'create_field' ? (
                              <select
                                className="form-select"
                                value={config.field_type ?? 'text'}
                                onChange={(event) =>
                                  updateMapping(header, { field_type: event.target.value as FieldType })
                                }
                              >
                                {FIELD_TYPE_ORDER.filter((type) => !['image', 'file', 'reference'].includes(type)).map(
                                  (type) => (
                                    <option key={type} value={type}>
                                      {type}
                                    </option>
                                  ),
                                )}
                              </select>
                            ) : (
                              <span className="text-muted">--</span>
                            )}
                          </td>
                          <td>
                            {config?.type === 'reference' ? (
                              <div className="d-flex gap-2">
                                <input
                                  type="text"
                                  className="form-control"
                                  value={config.display_field ?? ''}
                                  placeholder="Nom"
                                  aria-label="Champ d'affichage"
                                  onChange={(event) =>
                                    updateMapping(header, { display_field: event.target.value })
                                  }
                                />
                                <label className="form-check form-switch mb-0">
                                  <input
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={config.match_or_create ?? false}
                                    onChange={(event) =>
                                      updateMapping(header, { match_or_create: event.target.checked })
                                    }
                                  />
                                  <span className="form-check-label">Créer</span>
                                </label>
                              </div>
                            ) : (
                              <span className="text-muted">--</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {result && (
              <div className="vstack gap-3" data-testid="csv-dry-run-report">
                <div className="d-flex flex-wrap gap-2">
                  <span className="badge bg-blue-lt">{result.row_count} lignes</span>
                  <span className="badge bg-green-lt">{result.accepted_count} acceptées</span>
                  <span className="badge bg-red-lt">{result.rejected_count} rejetées</span>
                  <span className="badge bg-secondary-lt">{result.detected_encoding}</span>
                  <span className="badge bg-secondary-lt">
                    {result.delimiter === '\t' ? 'tab' : result.delimiter}
                  </span>
                </div>

                {result.rejected_rows.length > 0 && (
                  <div>
                    <h3 className="h4">Lignes rejetées</h3>
                    <ul className="list-group" data-testid="csv-rejected-rows">
                      {result.rejected_rows.map((row) => (
                        <li key={row.row} className="list-group-item">
                          Ligne {row.row}: {Object.values(row.errors).flat().join(', ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-link" onClick={onClose}>
              Annuler
            </button>
            <button
              type="button"
              className="btn btn-outline-primary"
              disabled={!file || dryRunMutation.isPending}
              onClick={() => dryRunMutation.mutate()}
              data-testid="csv-dry-run-btn"
            >
              Prévisualiser
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!file || importMutation.isPending}
              onClick={() => importMutation.mutate()}
              data-testid="csv-import-submit"
            >
              Importer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
