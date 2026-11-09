import React from 'react';
import { AlertTriangle, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatDateKey,
  formatPngTime,
  isCarriedOver,
  visitDuration,
  type FrontDeskVisitor,
} from '@/services/frontDesk/visitorRules';
import { VisitorActions, type VisitorActionHandlers } from './VisitorActions';
import { initialsOfVisitor, shortDate } from './visitorDisplay';
import { VisitorStatusBadge } from './VisitorStatusBadge';

const th = 'px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap';
const td = 'px-3 py-2 text-sm align-top';

const TimeIn: React.FC<{ visitor: FrontDeskVisitor }> = ({ visitor }) =>
  visitor.timeIn
    ? <span>{formatPngTime(visitor.timeIn)}</span>
    : visitor.expectedStart
      ? <span className="text-muted-foreground">Expected {formatPngTime(visitor.expectedStart)}</span>
      : <span className="text-muted-foreground">—</span>;

const VisitorName: React.FC<{ visitor: FrontDeskVisitor; todayKey: string; withAvatar?: boolean }> = ({ visitor, todayKey, withAvatar }) => (
  <div className="flex items-start gap-2">
    {withAvatar && (
      <div className="w-8 h-8 flex-shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
        {initialsOfVisitor(visitor.name)}
      </div>
    )}
    <div className="min-w-0">
      <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
        {visitor.name}
        {visitor.photoUrl && (
          <a href={visitor.photoUrl} target="_blank" rel="noreferrer" title="Open photo" className="text-muted-foreground hover:text-foreground">
            <ImageIcon className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      {isCarriedOver(visitor, todayKey) && (
        <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />Not signed out — {formatDateKey(visitor.visitDate)}
        </div>
      )}
      {withAvatar && visitor.badgeNo && <div className="text-xs text-muted-foreground">Badge {visitor.badgeNo}</div>}
    </div>
  </div>
);

/**
 * `log`: the paper Visitors Log Sheet's columns, in its order (plan P3.5).
 * `list`: the same rows with status and visit length instead of date and reason.
 */
export const VisitorTable: React.FC<VisitorActionHandlers & {
  visitors: FrontDeskVisitor[];
  todayKey: string;
  variant: 'log' | 'list';
  nowIso: string;
}> = ({ visitors, todayKey, variant, nowIso, ...actions }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      <thead className="bg-gray-50 dark:bg-gray-900">
        {variant === 'log' ? (
          <tr>
            <th className={th}>Date</th>
            <th className={th}>Visitor's Name</th>
            <th className={th}>Company</th>
            <th className={th}>Reason for Visit</th>
            <th className={th}>Time In</th>
            <th className={th}>Time Out</th>
            <th className={th}>Host</th>
            <th className={cn(th, 'text-right')}><span className="sr-only">Actions</span></th>
          </tr>
        ) : (
          <tr>
            <th className={th}>Visitor</th>
            <th className={th}>Status</th>
            <th className={th}>Time In</th>
            <th className={th}>Time Out</th>
            <th className={th}>Duration</th>
            <th className={th}>Host</th>
            <th className={th}>Company</th>
            <th className={cn(th, 'text-right')}><span className="sr-only">Actions</span></th>
          </tr>
        )}
      </thead>
      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
        {visitors.map(visitor => (
          <tr key={visitor.id} className={cn('hover:bg-gray-50 dark:hover:bg-gray-700/50', visitor.status === 'No Show' && 'opacity-60')}>
            {variant === 'log' ? (
              <>
                <td className={cn(td, 'whitespace-nowrap')}>{shortDate(visitor.visitDate)}</td>
                <td className={td}><VisitorName visitor={visitor} todayKey={todayKey} /></td>
                <td className={td}>{visitor.company || <span className="text-muted-foreground">—</span>}</td>
                <td className={cn(td, 'max-w-[18rem]')}>{visitor.reason}</td>
                <td className={cn(td, 'whitespace-nowrap')}>
                  {visitor.status === 'No Show' ? <VisitorStatusBadge status="No Show" /> : <TimeIn visitor={visitor} />}
                </td>
                <td className={cn(td, 'whitespace-nowrap')}>{formatPngTime(visitor.timeOut) || <span className="text-muted-foreground">—</span>}</td>
                <td className={td}>{visitor.hostName || <span className="text-muted-foreground">—</span>}</td>
              </>
            ) : (
              <>
                <td className={td}><VisitorName visitor={visitor} todayKey={todayKey} withAvatar /></td>
                <td className={td}><VisitorStatusBadge status={visitor.status} /></td>
                <td className={cn(td, 'whitespace-nowrap')}><TimeIn visitor={visitor} /></td>
                <td className={cn(td, 'whitespace-nowrap')}>{formatPngTime(visitor.timeOut) || <span className="text-muted-foreground">—</span>}</td>
                <td className={cn(td, 'whitespace-nowrap')}>{visitDuration(visitor.timeIn, visitor.timeOut, nowIso) || '—'}</td>
                <td className={td}>{visitor.hostName || <span className="text-muted-foreground">—</span>}</td>
                <td className={td}>{visitor.company || <span className="text-muted-foreground">—</span>}</td>
              </>
            )}
            <td className={cn(td, 'text-right whitespace-nowrap')}>
              <VisitorActions visitor={visitor} size="xs" {...actions} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
