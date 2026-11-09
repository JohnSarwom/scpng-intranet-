import React from 'react';
import { Clock, UserIcon } from 'lucide-react';
import { BaseCard } from '@/components/ui/BaseCard';
import { cn } from '@/lib/utils';
import { formatDateKey, formatPngTime, isCarriedOver, visitDuration, type FrontDeskVisitor } from '@/services/frontDesk/visitorRules';
import { VisitorActions, type VisitorActionHandlers } from './VisitorActions';
import { initialsOfVisitor } from './visitorDisplay';
import { VisitorStatusBadge } from './VisitorStatusBadge';

const timeLine = (visitor: FrontDeskVisitor, nowIso: string) => {
  if (visitor.status === 'Expected') return visitor.expectedStart ? `Expected ${formatPngTime(visitor.expectedStart)}` : 'Expected';
  if (visitor.status === 'No Show') return 'Did not arrive';
  const span = `${formatPngTime(visitor.timeIn)}${visitor.timeOut ? ` – ${formatPngTime(visitor.timeOut)}` : ''}`;
  return `${span} · ${visitDuration(visitor.timeIn, visitor.timeOut, nowIso)}`;
};

/** One visitor on the board or grid. Drag it between board columns to change the status. */
export const VisitorCard: React.FC<VisitorActionHandlers & {
  visitor: FrontDeskVisitor;
  todayKey: string;
  nowIso: string;
  isDragging?: boolean;
}> = ({ visitor, todayKey, nowIso, isDragging, ...actions }) => (
  <BaseCard
    id={visitor.id}
    isDragging={isDragging}
    headerContent={(
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 flex-shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
          {initialsOfVisitor(visitor.name)}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium leading-tight">{visitor.name}</h3>
          <p className="text-xs text-muted-foreground">{visitor.company || visitor.reason}</p>
        </div>
      </div>
    )}
    headerActions={<VisitorActions visitor={visitor} size="xs" {...actions} />}
    cardContent={(
      <div className="mt-2 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <VisitorStatusBadge status={visitor.status} />
          <span className="flex items-center text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5 mr-1" />{timeLine(visitor, nowIso)}</span>
        </div>
        {visitor.company && <p className="text-xs text-muted-foreground line-clamp-2">{visitor.reason}</p>}
        {isCarriedOver(visitor, todayKey) && (
          <p className="text-xs text-amber-700 dark:text-amber-400">Not signed out — {formatDateKey(visitor.visitDate)}</p>
        )}
      </div>
    )}
    footerContent={(
      <span className={cn('flex items-center text-xs', visitor.hostName ? 'text-foreground' : 'text-muted-foreground')}>
        <UserIcon className="h-3.5 w-3.5 mr-1" />{visitor.hostName || 'No host'}
      </span>
    )}
  />
);
