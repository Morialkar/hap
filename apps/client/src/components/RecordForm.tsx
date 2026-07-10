import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '../contexts/I18nContext';
import { apiClient } from '../lib/apiClient';
import type { ApiRecord, ApiRecordData, ApiValue } from '../lib/apiTypes';
import { type BuilderField } from '../lib/fieldTypes';
import { LoadingSpinner } from './LoadingSpinner';
import { InlineRecordModal } from './InlineRecordModal';

interface RecordFormProps {
  tableId: string;
  fields: BuilderField[];
  recordId?: string | null;
  isDuplicate?: boolean;
  isInline?: boolean;
  onCancel: () => void;
  onSaveSuccess?: (record: ApiRecord) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

interface RecordPayload {
  table_id: string;
  data: ApiRecordData;
  version?: number;
}

interface FormStateSnapshot {
  isDirty: boolean;
}

interface DynamicFieldApi {
  state: {
    value: ApiValue | undefined;
  };
  handleChange: (value: ApiValue) => void;
}

export function RecordForm({
  tableId,
  fields,
  recordId,
  isDuplicate = false,
  isInline = false,
  onCancel,
  onSaveSuccess,
  onDirtyChange,
}: RecordFormProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);

  // Modal state for inline reference creation
  const [inlineModalConfig, setInlineModalConfig] = useState<{
    targetTableId: string;
    fieldKey: string;
  } | null>(null);

  // State to track upload tasks: key is field key, value is array of file upload states
  const [uploadsState, setUploadsState] = useState<
    Record<string, { hash: string; name: string; isUploading: boolean }[]>
  >({});

  // Fetch record data if we are editing or duplicating
  const isEditing = !!recordId && !isDuplicate;
  const isDuplicating = !!recordId && isDuplicate;

  const recordQuery = useQuery<ApiRecord, Error>({
    queryKey: ['records', recordId],
    queryFn: () => apiClient.get(`/records/${recordId}`),
    enabled: !!recordId,
  });

  const recordFields = useMemo(() => {
    return [...fields].sort((a, b) => a.position - b.position);
  }, [fields]);

  // Compute default values
  const defaultValues = useMemo(() => {
    const data: ApiRecordData = {};
    recordFields.forEach((field) => {
      // Default type values
      if (field.type === 'boolean') {
        data[field.name] = false;
      } else {
        data[field.name] = '';
      }
    });

    if (recordQuery.data && (isEditing || isDuplicating)) {
      Object.assign(data, recordQuery.data.data);
    }
    return { data };
  }, [recordFields, recordQuery.data, isEditing, isDuplicating]);

  // TanStack Form setup
  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      const payload: RecordPayload = {
        table_id: tableId,
        data: value.data,
        version: isEditing ? recordQuery.data?.version : undefined,
      };

      if (isEditing) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync(payload);
      }
    },
  });

  // Track dirty state
  const isFormDirty = useStore(form.store, (state: FormStateSnapshot) => state.isDirty);
  useEffect(() => {
    onDirtyChange?.(isFormDirty);
  }, [isFormDirty, onDirtyChange]);

  // React to defaultValues change when editing data is loaded
  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: RecordPayload) => apiClient.post<ApiRecord>('/records', payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['records-select'] });
      onSaveSuccess?.(response);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: RecordPayload) =>
      apiClient.put<ApiRecord>(`/records/${recordId}`, {
        data: payload.data,
        version: payload.version,
      }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['records-select'] });
      onSaveSuccess?.(response);
    },
  });

  // Handle Ctrl+Enter to submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  // Upload file handler
  const handleFileUpload = async (fieldKey: string, filesList: FileList | null, multi: boolean) => {
    if (!filesList) return;
    const files = Array.from(filesList);

    // Update uploading status locally
    setUploadsState((prev) => {
      const current = prev[fieldKey] || [];
      const incoming = files.map((f) => ({
        hash: '',
        name: f.name,
        isUploading: true,
      }));
      return { ...prev, [fieldKey]: [...current, ...incoming] };
    });

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/v1/uploads', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          throw new Error('Upload failed');
        }

        const data = (await res.json()) as { hash: string };

        // Update uploadsState and form value with the returned hash
        setUploadsState((prev) => {
          const current = prev[fieldKey] || [];
          const updated = current.map((item) =>
            item.name === file.name && item.isUploading
              ? { hash: data.hash, name: file.name, isUploading: false }
              : item
          );
          return { ...prev, [fieldKey]: updated };
        });

        // Set the form value
        const currentValue = form.getFieldValue(`data.${fieldKey}`);
        if (multi) {
          const arr = Array.isArray(currentValue) ? currentValue : [];
          form.setFieldValue(`data.${fieldKey}`, [...arr, data.hash]);
        } else {
          form.setFieldValue(`data.${fieldKey}`, data.hash);
        }
      } catch (err) {
        console.error(err);
        // Remove failed file from uploadsState
        setUploadsState((prev) => {
          const current = prev[fieldKey] || [];
          return {
            ...prev,
            [fieldKey]: current.filter((item) => item.name !== file.name),
          };
        });
      }
    }
  };

  const handleRemoveUpload = (fieldKey: string, hash: string, multi: boolean) => {
    setUploadsState((prev) => {
      const current = prev[fieldKey] || [];
      return {
        ...prev,
        [fieldKey]: current.filter((item) => item.hash !== hash),
      };
    });

    const currentValue = form.getFieldValue(`data.${fieldKey}`);
    if (multi && Array.isArray(currentValue)) {
      form.setFieldValue(
        `data.${fieldKey}`,
        currentValue.filter((h) => h !== hash)
      );
    } else {
      form.setFieldValue(`data.${fieldKey}`, '');
    }
  };

  const handleSaveAndAddAnother = async () => {
    await form.handleSubmit();
    // Reset to initial values and clear inputs
    form.reset(defaultValues);
    setUploadsState({});
  };

  if (recordQuery.isLoading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        onKeyDown={handleKeyDown}
        className="vstack gap-3"
      >
      {recordFields.map((field) => {
        const options = field.options || {};
        return (
          <form.Field
            key={field.id}
            name={`data.${field.name}`}
          >
            {((fieldApi: DynamicFieldApi) => {
              const value = fieldApi.state.value || '';
              const isRequired = field.validation?.required === true;

              return (
                <div className="mb-2">
                  <label className="form-label d-flex justify-content-between align-items-center">
                    <span>
                      {field.name}{' '}
                      {isRequired && <span className="text-danger">*</span>}
                    </span>
                    {/* Character Counter for short and long text */}
                    {(field.type === 'text' || field.type === 'long_text') && !!options.max_length && (
                      <span
                        className={`small ${
                          String(value).length > Number(options.max_length) - 10
                            ? 'text-danger fw-bold'
                            : 'text-muted'
                        }`}
                      >
                        {t('records.charCounter', {
                          count: String(value).length,
                          max: options.max_length,
                        })}
                      </span>
                    )}
                  </label>

                  {/* Render Editor based on Field Type */}
                  {(() => {
                    switch (field.type) {
                      case 'text':
                        return (
                          <input
                            type="text"
                            className="form-control"
                            placeholder={String(options.placeholder || '')}
                            value={String(value)}
                            onChange={(e) => fieldApi.handleChange(e.target.value)}
                            maxLength={options.max_length ? Number(options.max_length) : undefined}
                            data-testid={`field-input-${field.name}`}
                          />
                        );

                      case 'long_text':
                        return (
                          <textarea
                            className="form-control"
                            rows={options.rows ? Number(options.rows) : 4}
                            value={String(value)}
                            onChange={(e) => fieldApi.handleChange(e.target.value)}
                            maxLength={options.max_length ? Number(options.max_length) : undefined}
                            data-testid={`field-input-${field.name}`}
                          />
                        );

                      case 'number':
                        return (
                          <input
                            type="number"
                            className="form-control"
                            min={options.min !== undefined ? Number(options.min) : undefined}
                            max={options.max !== undefined ? Number(options.max) : undefined}
                            step={options.step !== undefined ? Number(options.step) : 'any'}
                            value={value === '' ? '' : Number(value)}
                            onChange={(e) =>
                              fieldApi.handleChange(e.target.value === '' ? '' : Number(e.target.value))
                            }
                            data-testid={`field-input-${field.name}`}
                          />
                        );

                      case 'date':
                        return (
                          <input
                            type={options.includeTime ? 'datetime-local' : 'date'}
                            className="form-control"
                            value={String(value)}
                            onChange={(e) => fieldApi.handleChange(e.target.value)}
                            data-testid={`field-input-${field.name}`}
                          />
                        );

                      case 'boolean':
                        return (
                          <div className="form-check form-switch">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              role="switch"
                              checked={!!value}
                              onChange={(e) => fieldApi.handleChange(e.target.checked)}
                              data-testid={`field-input-${field.name}`}
                            />
                          </div>
                        );

                      case 'select': {
                        const vals = Array.isArray(options.values) ? options.values : [];
                        return (
                          <select
                            className="form-select"
                            value={String(value)}
                            onChange={(e) => fieldApi.handleChange(e.target.value)}
                            data-testid={`field-input-${field.name}`}
                          >
                            <option value="">-- Select --</option>
                            {vals.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        );
                      }

                      case 'reference':
                        return (
                          <ReferenceFieldEditor
                            field={field}
                            value={String(value)}
                            onChange={(val) => fieldApi.handleChange(val)}
                            onOpenInlineModal={(targetTableId) =>
                              setInlineModalConfig({ targetTableId, fieldKey: field.name })
                            }
                          />
                        );

                      case 'image':
                      case 'file': {
                        const isImage = field.type === 'image';
                        const multi = !!options.multi;
                        const uploadedHashes = Array.isArray(value)
                          ? value
                          : value
                          ? [value]
                          : [];

                        return (
                          <div className="border rounded p-3 bg-light-subtle">
                            <input
                              type="file"
                              className="form-control mb-2"
                              multiple={multi}
                              accept={isImage ? 'image/*' : undefined}
                              onChange={(e) => handleFileUpload(field.name, e.target.files, multi)}
                              data-testid={`field-input-${field.name}`}
                            />
                            <div className="text-muted small mb-2">{t('records.upload.hint')}</div>

                            {/* Render Upload Previews / Items */}
                            {uploadedHashes.length > 0 && (
                              <div className="d-flex flex-wrap gap-2 mt-2">
                                {uploadedHashes.map((hash) => (
                                  <div
                                    key={hash}
                                    className="position-relative border rounded p-1 bg-white d-flex align-items-center gap-2"
                                    style={{ minWidth: 100 }}
                                  >
                                    {isImage ? (
                                      <img
                                        src={`/api/v1/uploads/${hash}/thumbnail`}
                                        alt="Preview"
                                        className="rounded"
                                        style={{ width: 48, height: 48, objectFit: 'cover' }}
                                        onError={(e) => {
                                          // Fallback if GD thumbnail not served
                                          (e.target as HTMLImageElement).src = `/api/v1/uploads/${hash}`;
                                        }}
                                      />
                                    ) : (
                                      <i className="ti ti-file fs-2 text-primary" />
                                    )}
                                    <span className="text-truncate small" style={{ maxWidth: 80 }} title={hash}>
                                      {hash.slice(0, 8)}...
                                    </span>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-link text-danger p-0"
                                      onClick={() => handleRemoveUpload(field.name, hash, multi)}
                                      title={t('common.remove')}
                                    >
                                      <i className="ti ti-x" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Uploading states spinner */}
                            {(uploadsState[field.name] || []).filter((u) => u.isUploading).length > 0 && (
                              <div className="d-flex align-items-center gap-2 mt-2 text-muted small">
                                <LoadingSpinner size="sm" />
                                <span>Uploading...</span>
                              </div>
                            )}
                          </div>
                        );
                      }

                      default:
                        return (
                          <input
                            type="text"
                            className="form-control"
                            value={String(value)}
                            onChange={(e) => fieldApi.handleChange(e.target.value)}
                          />
                        );
                    }
                  })()}
                </div>
              );
            })}
          </form.Field>
        );
      })}

      {/* Form Submission Buttons */}
      <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
          {t('common.cancel')}
        </button>

        <div className="d-flex gap-2">
          {!isEditing && !isInline && (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={handleSaveAndAddAnother}
              disabled={createMutation.isPending}
              data-testid="save-add-another"
            >
              {t('records.saveAndAddAnother')}
            </button>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="save-record"
          >
            {createMutation.isPending || updateMutation.isPending ? (
              <LoadingSpinner size="sm" />
            ) : (
              t('common.save')
            )}
          </button>
        </div>
      </div>
      </form>

      {/* Inline Reference Creator Modal */}
      {inlineModalConfig && (
        <InlineRecordModal
          tableId={inlineModalConfig.targetTableId}
          isOpen
          onClose={() => setInlineModalConfig(null)}
          onSuccess={(newRecord) => {
            // Automatically set the value of the reference select
            form.setFieldValue(`data.${inlineModalConfig.fieldKey}`, newRecord.id);
            setInlineModalConfig(null);
          }}
        />
      )}
    </>
  );
}

interface ReferenceFieldEditorProps {
  field: BuilderField;
  value: string;
  onChange: (val: string) => void;
  onOpenInlineModal: (targetTableId: string) => void;
}

function ReferenceFieldEditor({ field, value, onChange, onOpenInlineModal }: ReferenceFieldEditorProps) {
  const { t } = useI18n();
  const targetTableId = String(field.options?.target_table || '');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch referencing records of target table
  const recordsQuery = useQuery<{ data: ApiRecord[] }, Error>({
    queryKey: ['records-select', targetTableId],
    queryFn: () => apiClient.get(`/records?table_id=${targetTableId}&per_page=100`),
    enabled: !!targetTableId,
  });

  const selectOptions = useMemo(() => {
    return (recordsQuery.data?.data || []).map((r) => {
      // Find a suitable label name
      const rData = r.data || {};
      const label =
        rData.name || rData.title || rData.nom || rData.titre || Object.values(rData)[0] || r.id;
      return { value: r.id, label: String(label) };
    });
  }, [recordsQuery.data]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return selectOptions;
    const term = searchQuery.toLowerCase();
    return selectOptions.filter((opt) => opt.label.toLowerCase().includes(term));
  }, [selectOptions, searchQuery]);

  return (
    <div className="d-flex gap-2">
      <div className="flex-grow-1 position-relative">
        <select
          className="form-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`field-input-${field.name}`}
        >
          <option value="">-- Select --</option>
          {filteredOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {/* Simple inline search input to filter values */}
        {selectOptions.length > 5 && (
          <input
            type="text"
            className="form-control form-control-sm mt-1 py-1 px-2"
            placeholder="Search options..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ fontSize: '0.8rem' }}
          />
        )}
      </div>

      <button
        type="button"
        className="btn btn-outline-secondary d-flex align-items-center justify-content-center"
        onClick={() => onOpenInlineModal(targetTableId)}
        title={t('records.inlineCreate.title')}
        data-testid={`inline-create-${field.name}`}
      >
        <i className="ti ti-plus" />
      </button>
    </div>
  );
}
