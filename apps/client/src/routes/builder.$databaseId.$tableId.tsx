import { createFileRoute, useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { apiClient } from '../lib/apiClient';
import { FIELD_TYPES, type FieldType, type BuilderField } from '../lib/fieldTypes';
import { generateId } from '../lib/id';
import { FieldPalette } from '../components/FieldPalette';
import { FieldCanvas, BuilderDndProvider } from '../components/FieldCanvas';
import { FieldOptionPanel } from '../components/FieldOptionPanel';
import { DestructiveChangeModal } from '../components/DestructiveChangeModal';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const Route = createFileRoute('/builder/$databaseId/$tableId')({
  component: StructureBuilder,
});

interface Table {
  id: string;
  name: string;
  database_id: string;
}

interface Database {
  id: string;
  name: string;
  workspace_id: string;
}

interface Field {
  id: string;
  name: string;
  type: FieldType;
  position: number;
  options: Record<string, unknown>;
  validation: Record<string, unknown>;
  table_id: string;
  created_at?: string;
  updated_at?: string;
}

interface SchemaImpact {
  affected_records: number;
  orphaned_values: number;
  coercion_required: boolean;
}

function createNewField(type: FieldType, position: number): BuilderField {
  const definition = FIELD_TYPES[type];
  const defaultOptions: Record<string, unknown> = {};

  definition.options.forEach((opt: { key: string; type: string; placeholder?: string }) => {
    if (opt.type === 'boolean') {
      defaultOptions[opt.key] = false;
    } else if (opt.type === 'number') {
      defaultOptions[opt.key] = opt.placeholder ? Number(opt.placeholder) : undefined;
    } else if (opt.type === 'string[]') {
      defaultOptions[opt.key] = [];
    } else {
      defaultOptions[opt.key] = opt.placeholder ?? '';
    }
  });

  return {
    id: generateId(),
    name: '',
    type,
    position,
    options: defaultOptions,
    validation: {},
    isNew: true,
    persistedId: null,
  };
}

function StructureBuilder() {
  const { databaseId, tableId } = useParams({ from: '/builder/$databaseId/$tableId' });
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [fields, setFields] = useState<BuilderField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const [pendingAction, setPendingAction] = useState<{
    fieldId: string;
    action: 'delete' | 'type-change';
    newType?: FieldType;
    token?: string;
    impact: SchemaImpact;
    message: string;
    title: string;
  } | null>(null);

  const databaseQuery = useQuery<Database, Error>({
    queryKey: ['database', databaseId],
    queryFn: () => apiClient.get(`/databases/${databaseId}`),
  });

  const tableQuery = useQuery<Table, Error>({
    queryKey: ['table', tableId],
    queryFn: () => apiClient.get(`/tables/${tableId}`),
  });

  const fieldsQuery = useQuery<Field[], Error>({
    queryKey: ['fields', tableId],
    queryFn: () => apiClient.get(`/fields?table_id=${tableId}`),
  });

  const tablesQuery = useQuery<Table[], Error>({
    queryKey: ['tables', databaseId],
    queryFn: () => apiClient.get(`/tables?database_id=${databaseId}`),
  });

  const saveFieldMutation = useMutation({
    mutationFn: async (field: BuilderField) => {
      const payload = {
        name: field.name,
        type: field.type,
        position: field.position,
        options: field.options,
        validation: field.validation,
        table_id: tableId,
      };

      if (field.isNew) {
        return apiClient.post<Field>('/fields', payload);
      }

      return apiClient.put<Field>(`/fields/${field.persistedId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields', tableId] });
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (field: BuilderField) => {
      if (field.persistedId) {
        return apiClient.delete(`/fields/${field.persistedId}`);
      }
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields', tableId] });
    },
  });

  useEffect(() => {
    if (fieldsQuery.data && !initializedRef.current) {
      initializedRef.current = true;
      const loadedFields: BuilderField[] = fieldsQuery.data.map((f) => ({
        id: `draft-${f.id}`,
        name: f.name,
        type: f.type,
        position: f.position,
        options: f.options || {},
        validation: f.validation || {},
        isNew: false,
        persistedId: f.id,
      }));

      const sorted = [...loadedFields].sort((a, b) => a.position - b.position);
      setFields(sorted);
      if (sorted.length > 0) {
        setSelectedFieldId(sorted[0].id);
      }
    }
  }, [fieldsQuery.data]);

  const previewTypeChange = useCallback(async (field: BuilderField) => {
    if (!field.persistedId) return;

    try {
      const impact = await apiClient.get<SchemaImpact>(`/fields/${field.persistedId}/preview-impact`);

      if (impact.affected_records > 0) {
        const token = await apiClient.get<{ token: string }>(
          `/fields/${field.persistedId}/confirmation-token`
        );

        setPendingAction({
          fieldId: field.id,
          action: 'type-change',
          newType: field.type,
          token: token.token,
          impact,
          title: t('builder.destructive.title'),
          message: t('builder.destructive.typeChangeMessage'),
        });
      }
    } catch {
      // Non-destructive or preview unavailable; allow change.
    }
  }, [t]);

  const handleFieldChange = useCallback((updatedField: BuilderField) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== updatedField.id) return f;

        const typeChanged = f.type !== updatedField.type;
        if (typeChanged && f.persistedId) {
          void previewTypeChange(updatedField);
        }

        return updatedField;
      })
    );
  }, [previewTypeChange]);

  const handleAdd = useCallback((type: FieldType, insertIndex?: number) => {
    const index = insertIndex ?? fields.length;
    const newField = createNewField(type, index);

    setFields((prev) => {
      const before = prev.filter((f) => f.position < index);
      const after = prev.filter((f) => f.position >= index).map((f) => ({
        ...f,
        position: f.position + 1,
      }));
      return [...before, newField, ...after];
    });

    setSelectedFieldId(newField.id);
  }, [fields.length]);

  const handleReorder = useCallback((reordered: BuilderField[]) => {
    setFields(reordered);
  }, []);

  const confirmRemove = useCallback((fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;

    if (field.persistedId) {
      deleteFieldMutation.mutate(field);
    }

    setFields((prev) => prev.filter((f) => f.id !== fieldId));
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  }, [deleteFieldMutation, fields, selectedFieldId]);

  const handleRemove = useCallback((fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;

    if (field.persistedId) {
      apiClient
        .get<SchemaImpact>(`/fields/${field.persistedId}/preview-impact`)
        .then(async (impact) => {
          if (impact.affected_records > 0) {
            const tokenResponse = await apiClient.get<{ token: string }>(
              `/fields/${field.persistedId}/confirmation-token`
            );
            setPendingAction({
              fieldId,
              action: 'delete',
              token: tokenResponse.token,
              impact,
              title: t('builder.destructive.title'),
              message: t('builder.destructive.deleteMessage'),
            });
          } else {
            confirmRemove(fieldId);
          }
        })
        .catch(() => confirmRemove(fieldId));
    } else {
      confirmRemove(fieldId);
    }
  }, [fields, t, confirmRemove]);

  const handleConfirmDestructive = () => {
    if (!pendingAction) return;

    if (pendingAction.action === 'delete') {
      confirmRemove(pendingAction.fieldId);
      setPendingAction(null);
      return;
    }

    // Type change confirmed: save with token.
    const field = fields.find((f) => f.id === pendingAction.fieldId);
    if (!field || !field.persistedId) return;

    const payload = {
      name: field.name,
      type: pendingAction.newType,
      position: field.position,
      options: field.options,
      validation: field.validation,
      table_id: tableId,
      confirmation_token: pendingAction.token,
    };

    apiClient
      .put<Field>(`/fields/${field.persistedId}`, payload)
      .then(() => {
        setPendingAction(null);
        queryClient.invalidateQueries({ queryKey: ['fields', tableId] });
      })
      .catch(() => {
        setPendingAction(null);
      });
  };

  const handleSaveAll = useCallback(() => {
    const newFields = fields.filter((f) => f.isNew);
    const existingFields = fields.filter((f) => !f.isNew);

    Promise.all([
      ...newFields.map((f) => saveFieldMutation.mutateAsync(f)),
      ...existingFields.map((f) => saveFieldMutation.mutateAsync(f)),
    ]).then(() => {
      queryClient.invalidateQueries({ queryKey: ['fields', tableId] });
    });
  }, [fields, queryClient, tableId, saveFieldMutation]);

  const selectedField = selectedFieldId ? fields.find((f) => f.id === selectedFieldId) : undefined;

  const availableTables = tablesQuery.data
    ?.filter((table) => table.id !== tableId)
    .map((table) => ({ id: table.id, name: table.name }));

  if (databaseQuery.isLoading || tableQuery.isLoading || fieldsQuery.isLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2>{t('builder.title')}</h2>
          <p className="text-muted mb-0">
            {databaseQuery.data?.name} → {tableQuery.data?.name}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSaveAll}
          disabled={saveFieldMutation.isPending}
        >
          <i className="ti ti-device-floppy me-1" />
          {t('common.save')}
        </button>
      </div>

      <BuilderDndProvider fields={fields} onAdd={handleAdd} onReorder={handleReorder}>
      <div className="row g-3" style={{ minHeight: '70vh' }}>
        <div className="col-md-3">
          <FieldPalette onAdd={handleAdd} />
        </div>

        <div className="col-md-5">
          <FieldCanvas
            fields={fields}
            selectedId={selectedFieldId}
            onSelect={setSelectedFieldId}
            onRemove={handleRemove}
          />
        </div>

        <div className="col-md-4">
          {selectedField ? (
            <FieldOptionPanel
              field={selectedField}
              availableTables={availableTables}
              onChange={handleFieldChange}
            />
          ) : (
            <div className="card h-100">
              <div className="card-body text-center text-muted">
                {t('builder.canvas.empty')}
              </div>
            </div>
          )}
        </div>
      </div>
      </BuilderDndProvider>

      {pendingAction && (
        <DestructiveChangeModal
          title={pendingAction.title}
          message={pendingAction.message}
          impact={pendingAction.impact}
          isOpen
          onConfirm={handleConfirmDestructive}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}

export default StructureBuilder;
