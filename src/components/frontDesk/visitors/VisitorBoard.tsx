import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { VISITOR_STATUSES, type VisitorStatus } from '@/services/frontDesk/frontDeskConfig';
import { VISITOR_STATUS_LABELS, type FrontDeskVisitor } from '@/services/frontDesk/visitorRules';
import type { VisitorActionHandlers } from './VisitorActions';
import { VisitorCard } from './VisitorCard';
import { STATUS_DOT } from './visitorDisplay';

const Column: React.FC<{ status: VisitorStatus; count: number; children: React.ReactNode }> = ({ status, count, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className={cn('w-80 flex-shrink-0 flex flex-col bg-muted/30 dark:bg-muted/20 rounded-lg overflow-hidden', isOver && 'ring-2 ring-primary ring-inset')}>
      <div className="p-3 font-medium flex items-center bg-muted/50 dark:bg-muted/30">
        <div className={cn('w-3 h-3 rounded-full mr-2', STATUS_DOT[status])} />
        <h3 className="font-medium text-sm">{VISITOR_STATUS_LABELS[status]}</h3>
        <Badge variant="outline" className="ml-2 bg-gray-100 dark:bg-gray-800 font-normal text-xs">{count}</Badge>
      </div>
      <div ref={setNodeRef} className={cn('p-2 flex-grow min-h-[200px] space-y-3', isOver && 'bg-primary/5')}>
        {children}
        {count === 0 && <p className="text-xs text-muted-foreground text-center py-8">No visitors</p>}
      </div>
    </div>
  );
};

/**
 * Board by status. Dropping a card in another column changes the visitor's status through the
 * same rules as the buttons, so dropping on Signed Out signs the visitor out (plan P3.5).
 */
export const VisitorBoard: React.FC<VisitorActionHandlers & {
  visitors: FrontDeskVisitor[];
  todayKey: string;
  nowIso: string;
}> = ({ visitors, todayKey, nowIso, ...actions }) => {
  const [dragging, setDragging] = useState<FrontDeskVisitor | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (event: DragStartEvent) => setDragging(visitors.find(v => v.id === String(event.active.id)) ?? null);
  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const visitor = visitors.find(v => v.id === String(event.active.id));
    const overId = event.over ? String(event.over.id) : '';
    const target = (VISITOR_STATUSES as readonly string[]).includes(overId)
      ? overId as VisitorStatus
      : visitors.find(v => v.id === overId)?.status;
    // Without update permission the card snaps back.
    if (visitor && target && target !== visitor.status && actions.canUpdate) actions.onChangeStatus(visitor, target);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="flex gap-4 overflow-x-auto pb-6">
        {VISITOR_STATUSES.map(status => {
          const column = visitors.filter(v => v.status === status);
          return (
            <Column key={status} status={status} count={column.length}>
              <SortableContext items={column.map(v => v.id)} strategy={verticalListSortingStrategy}>
                {column.map(visitor => (
                  <VisitorCard key={visitor.id} visitor={visitor} todayKey={todayKey} nowIso={nowIso} isDragging={dragging?.id === visitor.id} {...actions} />
                ))}
              </SortableContext>
            </Column>
          );
        })}
      </div>
      <DragOverlay>
        {dragging && <VisitorCard visitor={dragging} todayKey={todayKey} nowIso={nowIso} isDragging {...actions} canUpdate={false} canDelete={false} />}
      </DragOverlay>
    </DndContext>
  );
};
