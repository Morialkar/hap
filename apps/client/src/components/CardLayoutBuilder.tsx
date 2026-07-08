import { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '../contexts/I18nContext';
import { apiClient } from '../lib/apiClient';
import { FIELD_TYPES, type BuilderField } from '../lib/fieldTypes';
import { LoadingSpinner } from './LoadingSpinner';

interface CardLayoutBuilderProps {
  tableId: string;
  fields: BuilderField[];
}

interface View {
  id: string;
  table_id: string;
  name: string;
  type: string;
  config: {
    columnCount: number;
    columns: string[][];
  } | null;
}

interface DroppableColumnProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

function DroppableColumn({ id, children, className, style }: DroppableColumnProps) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className} style={style}>
      {children}
    </div>
  );
}

export function CardLayoutBuilder({ tableId, fields }: CardLayoutBuilderProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [newViewName, setNewViewName] = useState('');
  const [columnCount, setColumnCount] = useState<number>(1);
  
  // Unified state for all drag-and-drop containers
  const [layoutItems, setLayoutItems] = useState<Record<string, string[]>>({
    unassigned: [],
  });
  
  // Dragging states
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch views for this table
  const viewsQuery = useQuery<View[], Error>({
    queryKey: ['views', tableId],
    queryFn: () => apiClient.get(`/views?table_id=${tableId}`),
  });

  const cardViews = useMemo(() => {
    return (viewsQuery.data ?? []).filter((v) => v.type === 'card');
  }, [viewsQuery.data]);

  // Selected view object
  const selectedView = useMemo(() => {
    return cardViews.find((v) => v.id === selectedViewId) || null;
  }, [cardViews, selectedViewId]);

  // Auto-select first view or initialize
  useEffect(() => {
    if (cardViews.length > 0 && !selectedViewId) {
      setSelectedViewId(cardViews[0].id);
    }
  }, [cardViews, selectedViewId]);

  // Sync state with selected view layout config
  useEffect(() => {
    if (!selectedView) {
      setColumnCount(1);
      setLayoutItems({
        unassigned: [],
        'column-0': fields.map((f) => f.id),
      });
      return;
    }

    const fieldIdsMap = new Set(fields.map((f) => f.id));
    const config = selectedView.config;

    if (config && config.columns && typeof config.columnCount === 'number') {
      setColumnCount(config.columnCount);
      
      const newItems: Record<string, string[]> = {
        unassigned: [],
      };

      // Load columns
      const loadedColumns = config.columns.map((col) =>
        col.filter((id) => fieldIdsMap.has(id))
      );

      // Pad columns to match current columnCount
      while (loadedColumns.length < config.columnCount) {
        loadedColumns.push([]);
      }
      if (loadedColumns.length > config.columnCount) {
        loadedColumns.splice(config.columnCount);
      }

      loadedColumns.forEach((col, idx) => {
        newItems[`column-${idx}`] = col;
      });

      // Find any fields in table that are not placed in columns
      const placedIds = new Set(loadedColumns.flat());
      newItems.unassigned = fields
        .map((f) => f.id)
        .filter((id) => !placedIds.has(id));

      setLayoutItems(newItems);
    } else {
      setColumnCount(1);
      setLayoutItems({
        unassigned: [],
        'column-0': fields.map((f) => f.id),
      });
    }
  }, [selectedView, fields]);

  // Change columns count handler
  const handleColumnCountChange = (newCount: number) => {
    setColumnCount(newCount);
    setLayoutItems((prev) => {
      const next = { ...prev };
      
      // Ensure all columns exist up to newCount
      for (let i = 0; i < newCount; i++) {
        if (!next[`column-${i}`]) {
          next[`column-${i}`] = [];
        }
      }

      // Merge excess columns back to the new last column
      const excessItems: string[] = [];
      Object.keys(next).forEach((key) => {
        if (key.startsWith('column-')) {
          const colIdx = parseInt(key.replace('column-', ''), 10);
          if (colIdx >= newCount) {
            excessItems.push(...next[key]);
            delete next[key];
          }
        }
      });

      if (excessItems.length > 0 && newCount > 0) {
        const lastColKey = `column-${newCount - 1}`;
        next[lastColKey] = [...(next[lastColKey] || []), ...excessItems];
      }

      return next;
    });
  };

  // API mutations
  const createViewMutation = useMutation({
    mutationFn: (name: string) =>
      apiClient.post<View>('/views', {
        table_id: tableId,
        name,
        type: 'card',
        config: {
          columnCount: 1,
          columns: [fields.map((f) => f.id)],
        },
      }),
    onSuccess: (newView) => {
      queryClient.invalidateQueries({ queryKey: ['views', tableId] });
      setSelectedViewId(newView.id);
      setNewViewName('');
    },
  });

  const saveLayoutMutation = useMutation({
    mutationFn: (config: { columnCount: number; columns: string[][] }) => {
      if (!selectedViewId) return Promise.reject(new Error('No view selected'));
      return apiClient.put(`/views/${selectedViewId}`, {
        config,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['views', tableId] });
      showToast(t('layout.saveSuccess'));
    },
  });

  const deleteViewMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/views/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['views', tableId] });
      setSelectedViewId(null);
    },
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Drag and Drop settings
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const getContainer = (id: string): string => {
    if (layoutItems[id]) return id;
    return Object.keys(layoutItems).find((key) => layoutItems[key].includes(id)) || '';
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    const activeContainer = getContainer(activeIdStr);
    const overContainer = getContainer(overIdStr);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setLayoutItems((prev) => {
      const activeItems = prev[activeContainer] || [];
      const overItems = prev[overContainer] || [];

      const overIndex = overItems.indexOf(overIdStr);

      let newIndex = overItems.length;
      if (overIndex !== -1) {
        newIndex = overIndex;
      }

      return {
        ...prev,
        [activeContainer]: activeItems.filter((item) => item !== activeIdStr),
        [overContainer]: [
          ...overItems.slice(0, newIndex),
          activeIdStr,
          ...overItems.slice(newIndex)
        ]
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    const activeContainer = getContainer(activeIdStr);
    const overContainer = getContainer(overIdStr);

    if (!activeContainer || !overContainer) return;

    if (activeContainer === overContainer) {
      setLayoutItems((prev) => {
        const items = prev[activeContainer] || [];
        const oldIndex = items.indexOf(activeIdStr);
        const newIndex = items.indexOf(overIdStr);
        return {
          ...prev,
          [activeContainer]: arrayMove(items, oldIndex, newIndex),
        };
      });
    }
  };

  const handleSave = () => {
    const colsArray = Array.from({ length: columnCount }).map(
      (_, idx) => layoutItems[`column-${idx}`] || []
    );
    saveLayoutMutation.mutate({
      columnCount,
      columns: colsArray,
    });
  };

  const handleCreateView = (e: React.FormEvent) => {
    e.preventDefault();
    if (newViewName.trim()) {
      createViewMutation.mutate(newViewName.trim());
    }
  };

  const handleDeleteView = () => {
    if (selectedViewId && window.confirm(t('common.confirm'))) {
      deleteViewMutation.mutate(selectedViewId);
    }
  };

  const fieldMap = useMemo(() => {
    return new Map(fields.map((f) => [f.id, f]));
  }, [fields]);

  const activeField = activeId ? fieldMap.get(activeId) : null;

  const unassigned = layoutItems.unassigned || [];
  const columns = Array.from({ length: columnCount }).map(
    (_, idx) => layoutItems[`column-${idx}`] || []
  );

  if (viewsQuery.isLoading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="card h-100">
      <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div className="d-flex align-items-center gap-3">
          <h4 className="mb-0">{t('layout.title')}</h4>
          <div className="d-flex align-items-center gap-2">
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={selectedViewId || ''}
              onChange={(e) => setSelectedViewId(e.target.value || null)}
              aria-label={t('layout.selectView')}
            >
              <option value="">-- {t('layout.selectView')} --</option>
              {cardViews.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            {selectedViewId && (
              <button
                type="button"
                className="btn btn-sm btn-link text-danger p-0"
                onClick={handleDeleteView}
                title={t('common.delete')}
              >
                <i className="ti ti-trash" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleCreateView} className="d-flex gap-2 align-items-center">
          <input
            type="text"
            className="form-control form-control-sm"
            style={{ width: 220 }}
            placeholder={t('layout.newView.placeholder')}
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-sm btn-secondary text-nowrap"
            disabled={!newViewName.trim() || createViewMutation.isPending}
          >
            {t('common.create')}
          </button>
        </form>
      </div>

      <div className="card-body">
        {toastMessage && (
          <div className="alert alert-success py-2 px-3 mb-3 d-flex align-items-center gap-2">
            <i className="ti ti-check" aria-hidden="true" />
            <span>{toastMessage}</span>
          </div>
        )}

        {!selectedViewId ? (
          <div className="text-center py-5 text-muted">
            <i className="ti ti-layout-grid-add fs-1 mb-2 d-block" />
            <p>{t('layout.selectView')}</p>
          </div>
        ) : (
          <div>
            {/* View configuration controls */}
            <div className="row mb-4 align-items-center">
              <div className="col-auto">
                <label className="form-label mb-0">{t('layout.columns.label')}</label>
              </div>
              <div className="col-auto">
                <div className="btn-group btn-group-sm" role="group">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      className={`btn ${columnCount === num ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => handleColumnCountChange(num)}
                    >
                      {t(`layout.columns.option_${num === 1 ? 'one' : 'other'}`, { count: num })}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col text-end">
                <button
                  type="button"
                  className="btn btn-sm btn-success"
                  onClick={handleSave}
                  disabled={saveLayoutMutation.isPending}
                >
                  <i className="ti ti-device-floppy me-1" aria-hidden="true" />
                  {t('layout.saveLayout')}
                </button>
              </div>
            </div>

            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="row g-3">
                {/* Left sidebar: Unassigned Fields */}
                <div className="col-md-3">
                  <div className="card bg-light-subtle h-100">
                    <div className="card-header py-2">
                      <h6 className="mb-0 text-muted">{t('layout.unassignedFields.title')}</h6>
                    </div>
                    <div className="card-body p-2" style={{ minHeight: '400px' }}>
                      <SortableContext items={unassigned} strategy={verticalListSortingStrategy}>
                        <DroppableColumn id="unassigned" className="vstack gap-2 h-100" style={{ minHeight: '380px' }}>
                          {unassigned.length === 0 ? (
                            <div className="text-center py-4 text-muted small">
                              {t('layout.unassignedFields.empty')}
                            </div>
                          ) : (
                            unassigned.map((id) => {
                              const field = fieldMap.get(id);
                              return field ? <LayoutFieldItem key={id} field={field} /> : null;
                            })
                          )}
                        </DroppableColumn>
                      </SortableContext>
                    </div>
                  </div>
                </div>

                {/* Right Columns Grid */}
                <div className="col-md-9">
                  <div className="row g-3">
                    {Array.from({ length: columnCount }).map((_, colIdx) => {
                      const colItems = columns[colIdx] ?? [];
                      return (
                        <div key={colIdx} className={`col-${12 / columnCount}`}>
                          <div className="card h-100 border-dashed">
                            <div className="card-header py-2 text-center bg-transparent border-bottom-0">
                              <span className="badge text-bg-secondary">
                                {t('layout.column.title', { number: colIdx + 1 })}
                              </span>
                            </div>
                            <div
                              className="card-body p-2"
                              style={{ minHeight: '350px', backgroundColor: 'var(--bs-light-bg-subtle)' }}
                            >
                              <SortableContext items={colItems} strategy={verticalListSortingStrategy}>
                                <DroppableColumn
                                  id={`column-${colIdx}`}
                                  className="vstack gap-2 h-100"
                                  style={{ minHeight: '330px' }}
                                >
                                  {colItems.length === 0 ? (
                                    <div className="text-center py-5 text-muted small">
                                      {t('layout.column.empty')}
                                    </div>
                                  ) : (
                                    colItems.map((id) => {
                                      const field = fieldMap.get(id);
                                      return field ? <LayoutFieldItem key={id} field={field} /> : null;
                                    })
                                  )}
                                </DroppableColumn>
                              </SortableContext>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Drag overlay */}
              <DragOverlay>
                {activeField && (
                  <div className="card shadow-sm border-primary">
                    <div className="card-body py-2 px-3 d-flex align-items-center gap-2">
                      <i className={`ti ti-${FIELD_TYPES[activeField.type].icon} text-muted`} />
                      <strong className="text-truncate" style={{ maxWidth: 150 }}>
                        {activeField.name}
                      </strong>
                    </div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>
        )}
      </div>
    </div>
  );
}

function LayoutFieldItem({ field }: { field: BuilderField }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: 'grab',
  };

  const definition = FIELD_TYPES[field.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card border shadow-none"
      {...attributes}
      {...listeners}
    >
      <div className="card-body py-2 px-3 d-flex align-items-center justify-content-between gap-2">
        <div className="d-flex align-items-center gap-2 overflow-hidden">
          <i className="ti ti-grip-vertical text-muted" aria-hidden="true" />
          <i className={`ti ti-${definition.icon} text-primary`} aria-hidden="true" />
          <span className="text-truncate fw-medium">{field.name}</span>
        </div>
        <span className="badge text-bg-light border text-muted small">{field.type}</span>
      </div>
    </div>
  );
}
