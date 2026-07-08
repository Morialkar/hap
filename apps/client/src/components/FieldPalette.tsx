import { useDraggable } from '@dnd-kit/core';
import { useI18n } from '../contexts/I18nContext';
import { FIELD_TYPES, FIELD_TYPE_ORDER, type FieldType } from '../lib/fieldTypes';

interface FieldPaletteItemProps {
  type: FieldType;
  onAdd?: (type: FieldType) => void;
}

function FieldPaletteItem({ type, onAdd }: FieldPaletteItemProps) {
  const { t } = useI18n();
  const definition = FIELD_TYPES[type];
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `palette-${type}`,
    data: { type, source: 'palette' },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      className="list-group-item list-group-item-action d-flex align-items-center justify-content-between gap-2"
      style={style}
      {...listeners}
      {...attributes}
      role="button"
      aria-label={t(definition.labelKey)}
    >
      <div className="d-flex align-items-center gap-2">
        <i className={`ti ti-${definition.icon}`} aria-hidden="true" />
        <div className="text-start">
          <div className="fw-medium">{t(definition.labelKey)}</div>
          <small className="text-muted">{t(definition.descriptionKey)}</small>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-sm btn-outline-primary"
        onClick={() => onAdd?.(type)}
        data-testid={`add-field-${type}`}
        aria-label={t('common.create')}
        title={t('common.create')}
      >
        <i className="ti ti-plus" aria-hidden="true" />
      </button>
    </div>
  );
}

interface FieldPaletteProps {
  onAdd?: (type: FieldType) => void;
}

export function FieldPalette({ onAdd }: FieldPaletteProps) {
  const { t } = useI18n();

  return (
    <div className="card h-100">
      <div className="card-header">
        <h4 className="card-title mb-0">{t('builder.palette.title')}</h4>
      </div>
      <div className="list-group list-group-flush">
        {FIELD_TYPE_ORDER.map((type) => (
          <FieldPaletteItem key={type} type={type} onAdd={onAdd} />
        ))}
      </div>
      <div className="card-footer text-muted">
        <small>{t('builder.palette.dragHint')}</small>
      </div>
    </div>
  );
}
