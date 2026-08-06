import { createFileRoute, useBlocker, useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import type { Database, Field, SchemaImpact, Table } from '@hap/core';
import { useRepository } from '../contexts/RepositoryContext';
import { FIELD_TYPES, type FieldType, type BuilderField } from '../lib/fieldTypes';
import { generateId } from '../lib/id';
import { FieldPalette } from '../components/FieldPalette';
import { FieldCanvas, BuilderDndProvider } from '../components/FieldCanvas';
import { FieldOptionPanel } from '../components/FieldOptionPanel';
import { DestructiveChangeModal } from '../components/DestructiveChangeModal';
import { UnsavedChangesModal } from '../components/UnsavedChangesModal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { PageActions, PageHeader } from '../components/ui/PageHeader';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { CardLayoutBuilder } from '../components/CardLayoutBuilder';

export const Route = createFileRoute('/builder/$databaseId/$tableId')({
  component: StructureBuilder,
});

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

/**
 * Serialize the parts of a field that `handleSaveAll` persists, so the draft can be
 * compared against what the server currently holds.
 */
function snapshotField(field: BuilderField): string {
  return JSON.stringify({
    name: field.name,
    type: field.type,
    position: field.position,
    options: field.options,
    validation: field.validation,
  });
}

function snapshotFields(fields: BuilderField[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.id, snapshotField(f)]));
}

function StructureBuilder() {
  const { databaseId, tableId } = useParams({ from: '/builder/$databaseId/$tableId' });
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const repository = useRepository();

  const [fields, setFields] = useState<BuilderField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'structure' | 'layout'>('structure');
  const initializedRef = useRef(false);
  // Snapshot of what the server holds, keyed by draft field id. Compared against the
  // live draft to know whether leaving the page would discard work.
  const [savedSnapshot, setSavedSnapshot] = useState<Record<string, string>>({});
  // The layout tab keeps its own working state; `CardLayoutBuilder` reports whether it
  // holds edits that the explicit Save has not persisted yet.
  const [isLayoutDirty, setIsLayoutDirty] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
    queryFn: () => repository.databases.get(databaseId),
  });

  const tableQuery = useQuery<Table, Error>({
    queryKey: ['table', tableId],
    queryFn: () => repository.tables.get(tableId),
  });

  const fieldsQuery = useQuery<Field[], Error>({
    queryKey: ['fields', tableId],
    queryFn: () => repository.fields.listByTable(tableId),
  });

  const tablesQuery = useQuery<Table[], Error>({
    queryKey: ['tables', databaseId],
    queryFn: () => repository.tables.list(databaseId),
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
        is_filterable:
          field.type !== 'title' &&
          field.type !== 'image' &&
          field.type !== 'file' &&
          field.type !== 'long_text' &&
          field.is_filterable !== false,
      };

      if (field.isNew) {
        return repository.fields.create(payload);
      }

      return repository.fields.update(field.persistedId!, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields', tableId] });
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async ({ field, token }: { field: BuilderField; token?: string }) => {
      if (field.persistedId) {
        // The API treats every field deletion as destructive, so a confirmation
        // token is always required — not only when records are affected.
        return repository.fields.remove(field.persistedId, token);
      }
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields', tableId] });
    },
    onError: (_error, { field }) => {
      // The deletion did not reach the server: put the field back rather than
      // leaving the canvas showing a removal that never happened.
      setFields((prev) =>
        prev.some((f) => f.id === field.id)
          ? prev
          : [...prev, field].sort((a, b) => a.position - b.position)
      );
      setSavedSnapshot((prev) => ({ ...prev, [field.id]: snapshotField(field) }));
      setDeleteError(field.name);
    },
  });

  const updateTableMutation = useMutation({
    mutationFn: (isFrontFacing: boolean) =>
      repository.tables.update(tableId, { is_front_facing: isFrontFacing }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['table', tableId] });
      queryClient.invalidateQueries({ queryKey: ['tables', databaseId] });
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
      setSavedSnapshot(snapshotFields(sorted));
      if (sorted.length > 0) {
        setSelectedFieldId(sorted[0].id);
      }
    }
  }, [fieldsQuery.data]);

  const previewTypeChange = useCallback(
    async (field: BuilderField) => {
      if (!field.persistedId) return;

      try {
        const impact = await repository.fields.previewImpact(field.persistedId);

        if (impact.affected_records > 0) {
          const token = await repository.fields.confirmationToken(field.persistedId);

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
    },
    [t]
  );

  const handleFieldChange = useCallback(
    (updatedField: BuilderField) => {
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
    },
    [previewTypeChange]
  );

  const handleAdd = useCallback(
    (type: FieldType, insertIndex?: number) => {
      const index = insertIndex ?? fields.length;
      const newField = createNewField(type, index);

      setFields((prev) => {
        const before = prev.filter((f) => f.position < index);
        const after = prev
          .filter((f) => f.position >= index)
          .map((f) => ({
            ...f,
            position: f.position + 1,
          }));
        return [...before, newField, ...after];
      });

      setSelectedFieldId(newField.id);
    },
    [fields.length]
  );

  const handleReorder = useCallback((reordered: BuilderField[]) => {
    setFields(reordered);
  }, []);

  const confirmRemove = useCallback(
    (fieldId: string, token?: string) => {
      const field = fields.find((f) => f.id === fieldId);
      if (!field) return;

      if (field.persistedId) {
        deleteFieldMutation.mutate({ field, token });
      }

      setFields((prev) => prev.filter((f) => f.id !== fieldId));
      // The removal is persisted immediately (or the field never existed server-side),
      // so drop it from the baseline rather than reporting it as an unsaved change.
      setSavedSnapshot((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
      if (selectedFieldId === fieldId) {
        setSelectedFieldId(null);
      }
    },
    [deleteFieldMutation, fields, selectedFieldId]
  );

  const handleRemove = useCallback(
    (fieldId: string) => {
      const field = fields.find((f) => f.id === fieldId);
      if (!field) return;

      if (field.persistedId) {
        // A token is needed for every deletion; the impact only decides whether the
        // user is warned first.
        Promise.all([
          repository.fields.previewImpact(field.persistedId),
          repository.fields.confirmationToken(field.persistedId),
        ])
          .then(([impact, tokenResponse]) => {
            if (impact.affected_records > 0) {
              setPendingAction({
                fieldId,
                action: 'delete',
                token: tokenResponse.token,
                impact,
                title: t('builder.destructive.title'),
                message: t('builder.destructive.deleteMessage'),
              });
            } else {
              confirmRemove(fieldId, tokenResponse.token);
            }
          })
          .catch(() => setDeleteError(field.name));
      } else {
        confirmRemove(fieldId);
      }
    },
    [fields, t, confirmRemove]
  );

  const handleConfirmDestructive = () => {
    if (!pendingAction) return;

    if (pendingAction.action === 'delete') {
      confirmRemove(pendingAction.fieldId, pendingAction.token);
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

    repository.fields
      .update(field.persistedId, payload)
      .then(() => {
        setPendingAction(null);
        // This field is now persisted with its new type; rebase it so it no longer
        // counts as an unsaved change.
        setSavedSnapshot((prev) => ({
          ...prev,
          [field.id]: snapshotField({ ...field, type: pendingAction.newType ?? field.type }),
        }));
        queryClient.invalidateQueries({ queryKey: ['fields', tableId] });
      })
      .catch(() => {
        setPendingAction(null);
      });
  };

  const handleSaveAll = useCallback(() => {
    const newFields = fields.filter((f) => f.isNew);
    const existingFields = fields.filter((f) => !f.isNew);

    const saveField = async (field: BuilderField): Promise<[string, Field | null]> => {
      try {
        return [field.id, await saveFieldMutation.mutateAsync(field)];
      } catch {
        return [field.id, null];
      }
    };

    Promise.all([...newFields.map(saveField), ...existingFields.map(saveField)]).then((results) => {
      const savedByDraftId = new Map(results);

      // Rebase drafts onto what the server persisted: without this a field created in
      // this session keeps isNew/persistedId=null and the next save POSTs it again,
      // duplicating it on the table. Fields whose save failed keep their draft state.
      setFields((prev) =>
        prev.map((f) => {
          const persistedId = savedByDraftId.get(f.id)?.id ?? f.persistedId;
          if (!persistedId) return f;
          return { ...f, isNew: false, persistedId };
        })
      );

      // Only the fields that round-tripped are what the server now holds. Snapshot
      // those and leave the rest alone, so a field whose save failed stays dirty and
      // still trips the unsaved-changes guard.
      const persisted = [...newFields, ...existingFields].filter((f) => savedByDraftId.get(f.id));
      setSavedSnapshot((prev) => ({
        ...prev,
        ...Object.fromEntries(persisted.map((f) => [f.id, snapshotField(f)])),
      }));

      queryClient.invalidateQueries({ queryKey: ['fields', tableId] });
    });
  }, [fields, queryClient, tableId, saveFieldMutation]);

  const isStructureDirty = useMemo(() => {
    const current = snapshotFields(fields);
    const currentIds = Object.keys(current);
    const savedIds = Object.keys(savedSnapshot);

    if (currentIds.length !== savedIds.length) return true;
    return currentIds.some((id) => current[id] !== savedSnapshot[id]);
  }, [fields, savedSnapshot]);

  // Either tab holds work behind an explicit Save, so either can be lost on navigation.
  const isDirty = isStructureDirty || isLayoutDirty;

  // Covers in-app navigation; `enableBeforeUnload` covers tab close and reload.
  const blocker = useBlocker({
    shouldBlockFn: () => isDirty,
    enableBeforeUnload: () => isDirty,
    withResolver: true,
  });

  const selectedField = selectedFieldId ? fields.find((f) => f.id === selectedFieldId) : undefined;

  const availableTables = tablesQuery.data
    ?.filter((table) => table.id !== tableId)
    .map((table) => ({ id: table.id, name: table.name }));

  if (databaseQuery.isLoading || tableQuery.isLoading || fieldsQuery.isLoading) {
    return (
      <div
        className="d-flex align-items-center justify-content-center"
        style={{ minHeight: '60vh' }}
      >
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        pretitle={databaseQuery.data?.name}
        title={tableQuery.data?.name}
        description={t('builder.title')}
        actions={
          <PageActions>
            <div
              className="form-check form-switch me-3 d-inline-flex align-items-center mb-0"
              title={t('builder.isFrontFacing')}
            >
              <input
                className="form-check-input me-2 cursor-pointer"
                type="checkbox"
                role="switch"
                id="isFrontFacingSwitch"
                checked={tableQuery.data?.is_front_facing ?? false}
                onChange={(e) => updateTableMutation.mutate(e.target.checked)}
                disabled={updateTableMutation.isPending}
              />
              <label
                className="form-check-label text-muted small cursor-pointer"
                htmlFor="isFrontFacingSwitch"
              >
                {t('builder.isFrontFacing')}
              </label>
            </div>
            {activeTab === 'structure' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveAll}
                disabled={saveFieldMutation.isPending}
              >
                <i className="ti ti-device-floppy me-1" aria-hidden="true" />
                {t('common.save')}
              </button>
            )}
          </PageActions>
        }
      />

      <SurfaceCard className="mb-3">
        <div className="card-header p-0">
          <ul className="nav nav-tabs card-header-tabs m-0">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link border-0 py-3 px-4 ${activeTab === 'structure' ? 'active fw-bold' : ''}`}
                onClick={() => setActiveTab('structure')}
              >
                <i className="ti ti-stack-2 me-1" aria-hidden="true" />
                {t('builder.tabs.structure')}
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link border-0 py-3 px-4 ${activeTab === 'layout' ? 'active fw-bold' : ''}`}
                onClick={() => setActiveTab('layout')}
                data-testid="layout-tab"
              >
                <i className="ti ti-layout-board me-1" aria-hidden="true" />
                {t('builder.tabs.layout')}
              </button>
            </li>
          </ul>
        </div>
      </SurfaceCard>

      {activeTab === 'structure' ? (
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
                isDirty={isStructureDirty}
              />
            </div>

            <div className="col-md-4">
              {selectedField ? (
                <FieldOptionPanel
                  field={selectedField}
                  availableTables={availableTables}
                  onChange={handleFieldChange}
                  fields={fields}
                />
              ) : (
                <SurfaceCard className="h-100">
                  <EmptyState icon="forms" title={t('builder.canvas.empty')} />
                </SurfaceCard>
              )}
            </div>
          </div>
        </BuilderDndProvider>
      ) : (
        <CardLayoutBuilder tableId={tableId} fields={fields} onDirtyChange={setIsLayoutDirty} />
      )}

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

      {deleteError && (
        <div className="alert alert-danger alert-dismissible mt-3" role="alert">
          {t('builder.deleteFailed', { name: deleteError })}
          <button
            type="button"
            className="btn-close"
            onClick={() => setDeleteError(null)}
            aria-label={t('common.close')}
          />
        </div>
      )}

      <UnsavedChangesModal
        isOpen={blocker.status === 'blocked'}
        onLeave={() => blocker.proceed?.()}
        onStay={() => blocker.reset?.()}
      />
    </div>
  );
}

export default StructureBuilder;
