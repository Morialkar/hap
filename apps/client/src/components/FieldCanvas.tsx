import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDndContext,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useI18n } from '../contexts/I18nContext';
import { FIELD_TYPES, type FieldType, type BuilderField } from '../lib/fieldTypes';

interface FieldCanvasProps {
  fields: BuilderField[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (type: FieldType, insertIndex?: number) => void;
  onReorder: (fields: BuilderField[]) => void;
  onRemove: (id: string) => void;
}

interface BuilderDndProviderProps {
  fields: BuilderField[];
  onAdd: (type: FieldType, insertIndex?: number) => void;
  onReorder: (fields: BuilderField[]) => void;
  children: React.ReactNode;
}

export function BuilderDndProvider({
  fields,
  onAdd,
  onReorder,
  children,
}: BuilderDndProviderProps) {
  const [draggedType, setDraggedType] = useState<FieldType | null>(null);
  const { t } = useI18n();

  const orderedFields = useMemo(
    () => [...fields].sort((a, b) => a.position - b.position),
    [fields]
  );

  const sensors: SensorDescriptor<SensorOptions>[] = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const findInsertIndex = (overId: string | undefined): number => {
    if (!overId || overId === 'canvas' || overId === 'canvas-empty') return orderedFields.length;
    const index = orderedFields.findIndex((f) => f.id === overId);
    return index === -1 ? orderedFields.length : index;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.source === 'palette') {
      setDraggedType(data.type as FieldType);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedType(null);
    if (!over) return;
    if (active.data.current?.source === 'palette') {
      const type = active.data.current.type as FieldType;
      const insertIndex = findInsertIndex(over.id as string);
      onAdd(type, insertIndex);
      return;
    }
    if (active.id !== over.id) {
      const oldIndex = orderedFields.findIndex((f) => f.id === active.id);
      const newIndex = orderedFields.findIndex((f) => f.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(orderedFields, oldIndex, newIndex).map((f, idx) => ({
          ...f,
          position: idx,
        }));
        onReorder(reordered);
      }
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {children}
      <DragOverlay>
        {draggedType && (
          <div className="list-group-item d-flex align-items-center gap-2" style={{ width: 240 }}>
            <i className={`ti ti-${FIELD_TYPES[draggedType].icon}`} aria-hidden="true" />
            <span>{t(FIELD_TYPES[draggedType].labelKey)}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

interface SortableFieldItemProps {
  field: BuilderField;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

function SortableFieldItem({ field, isSelected, onSelect, onRemove }: SortableFieldItemProps) {
  const { t } = useI18n();
  const definition = FIELD_TYPES[field.type];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleRemove = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onRemove();
  };

  return (
    <div
      ref={setNodeRef}
      aria-selected={isSelected}
      className={`list-group-item d-flex align-items-center justify-content-between gap-2 ${
        isSelected ? 'active' : ''
      }`}
      style={style}
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      <div className="d-flex align-items-center gap-2 overflow-hidden">
        <i className="ti ti-grip-vertical text-muted" aria-hidden="true" />
        <i className={`ti ti-${definition.icon}`} aria-hidden="true" />
        <span className="text-truncate">{field.name}</span>
      </div>
      <div className="d-flex align-items-center gap-1">
        <span className="badge text-bg-secondary text-nowrap">{t(definition.labelKey)}</span>
        <button
          type="button"
          className="btn btn-sm btn-link text-danger p-0 ms-1"
          onClick={handleRemove}
          aria-label={t('common.remove')}
        >
          <i className="ti ti-trash" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function EmptyCanvas({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-empty' });
  return (
    <div
      ref={setNodeRef}
      data-testid="canvas-empty"
      className={`p-4 text-center text-muted ${isOver ? 'bg-light' : ''}`}
    >
      {children}
    </div>
  );
}

function DroppableCanvasList({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className} style={{ minHeight: '300px' }}>
      {children}
    </div>
  );
}

export function FieldCanvas({
  fields,
  selectedId,
  onSelect,
  onRemove,
}: Omit<FieldCanvasProps, 'onAdd' | 'onReorder'>) {
  const { t } = useI18n();
  const { active, over } = useDndContext();

  const orderedFields = useMemo(
    () => [...fields].sort((a, b) => a.position - b.position),
    [fields]
  );

  const fieldIds = useMemo(() => orderedFields.map((f) => f.id), [orderedFields]);

  const insertIndex = useMemo(() => {
    if (!active || !over) return -1;
    if (over.id === 'canvas' || over.id === 'canvas-empty') return orderedFields.length;
    const idx = orderedFields.findIndex((f) => f.id === over.id);
    return idx === -1 ? orderedFields.length : idx;
  }, [active, over, orderedFields]);

  const isDraggingFromPalette = active?.data.current?.source === 'palette';
  const showPlaceholder = isDraggingFromPalette && insertIndex !== -1;

  return (
    <div className="card h-100">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h4 className="card-title mb-0">{t('builder.canvas.title')}</h4>
        <span className="text-muted small">{t('builder.saveDraft.label')}</span>
      </div>
      <div
        className="card-body p-0"
        role="list"
        aria-label={t('builder.canvas.title')}
        style={{ minHeight: '300px' }}
      >
        {orderedFields.length === 0 ? (
          <EmptyCanvas>{t('builder.canvas.empty')}</EmptyCanvas>
        ) : (
          <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
            <DroppableCanvasList id="canvas" className="list-group list-group-flush p-2">
              {orderedFields.map((field, idx) => (
                <div key={field.id}>
                  {showPlaceholder && idx === insertIndex && (
                    <div className="border border-primary border-dashed rounded p-3 my-2 text-bg-light text-primary text-center small fw-semibold">
                      <i className="ti ti-download me-1" aria-hidden="true" />
                      {t('builder.palette.dragHint')}
                    </div>
                  )}
                  <SortableFieldItem
                    field={field}
                    isSelected={field.id === selectedId}
                    onSelect={() => onSelect(field.id)}
                    onRemove={() => onRemove(field.id)}
                  />
                </div>
              ))}
              {showPlaceholder && insertIndex === orderedFields.length && (
                <div className="border border-primary border-dashed rounded p-3 my-2 text-bg-light text-primary text-center small fw-semibold">
                  <i className="ti ti-download me-1" aria-hidden="true" />
                  {t('builder.palette.dragHint')}
                </div>
              )}
            </DroppableCanvasList>
          </SortableContext>
        )}
      </div>
    </div>
  );
}
