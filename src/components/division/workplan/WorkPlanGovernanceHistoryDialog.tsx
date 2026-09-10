import React, { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileCheck2, History, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { useWorkPlanGovernanceHistory } from '@/hooks/useWorkPlanGovernanceHistory';
import type { WorkPlanGovernanceEvent, WorkPlanGovernanceStatus, WorkPlanRetirementAction } from '@/types/division.types';

interface WorkPlanGovernanceHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  divisionId: string;
  divisionName: string;
}

type StatusFilter = 'all' | WorkPlanGovernanceStatus;
type ActionFilter = 'all' | WorkPlanRetirementAction;

const statusStyle: Record<WorkPlanGovernanceStatus, { label: string; className: string; icon: React.ReactNode }> = {
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  running: { label: 'In progress', className: 'bg-blue-100 text-blue-800 border-blue-200', icon: <Clock3 className="h-3.5 w-3.5" /> },
  failed: { label: 'Recovery required', className: 'bg-red-100 text-red-800 border-red-200', icon: <XCircle className="h-3.5 w-3.5" /> },
};

const actionLabel: Record<WorkPlanRetirementAction, string> = {
  retire: 'Retired with links retained',
  'clear-links': 'Retired and links cleared',
  reassign: 'Reassigned',
};

const formatDate = (value?: string) => value
  ? new Date(value).toLocaleString('en-PG', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not recorded';

const Metric: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-lg border bg-muted/20 px-3 py-2">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-xl font-semibold tabular-nums">{value}</p>
  </div>
);

const EventCard: React.FC<{ event: WorkPlanGovernanceEvent }> = ({ event }) => {
  const status = statusStyle[event.status];
  return (
    <Card className={event.status === 'failed' ? 'border-red-300' : event.status === 'running' ? 'border-blue-300' : ''}>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`gap-1 ${status.className}`}>{status.icon}{status.label}</Badge>
              <Badge variant="secondary" className="capitalize">{event.entityKind}</Badge>
              <Badge variant="outline">{actionLabel[event.action]}</Badge>
            </div>
            <h3 className="mt-2 font-semibold">{event.sourceTitle}</h3>
            <p className="text-xs text-muted-foreground">{event.planTitle} · {event.planYear} · Operation {event.operationId}</p>
          </div>
          <div className="text-left text-xs text-muted-foreground sm:text-right">
            <p>{event.status === 'completed' ? 'Completed' : 'Last checkpoint'}</p>
            <p className="font-medium text-foreground">{formatDate(event.completedAt || event.lastCheckpointAt)}</p>
          </div>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Authorized reason / approval reference</p>
            <p className="whitespace-pre-wrap">{event.reason}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Recorded actor</p>
            {event.performedBy
              ? <p>{event.performedBy.name} <span className="text-muted-foreground">({event.performedBy.email})</span></p>
              : <p className="text-amber-700">Not captured by the legacy record</p>}
          </div>
        </div>

        {event.target && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/20 p-2 text-sm">
            <span className="text-muted-foreground">Source execution {event.sourceExecutionId || event.sourceId}</span>
            <ArrowRight className="h-4 w-4" />
            <span className="font-medium">{event.target.title || `Target ${event.target.id}`}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Objectives" value={event.affected.objectives} />
          <Metric label="KRAs" value={event.affected.kras} />
          <Metric label="KPIs" value={event.affected.kpis} />
          <Metric label="Tasks retained" value={event.affected.tasks} />
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-md bg-muted/30 p-3 text-xs">
          <span className="flex items-center gap-1.5"><FileCheck2 className="h-3.5 w-3.5" /> {event.evidence.measurementEvidenceRefs} measurement reference(s)</span>
          <span>{event.evidence.measurementDefinitions} definition(s)</span>
          <span>{event.evidence.checklists} checklist(s)</span>
          <span>{event.evidence.tasks} Task record(s)</span>
        </div>

        {event.progress.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Reviewed progress impact</p>
            <div className="space-y-1">
              {event.progress.map(item => (
                <div key={`${item.kind}:${item.id}`} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate">{item.title}</span>
                  <span className="shrink-0 tabular-nums">{item.progress}% <ArrowRight className="inline h-3 w-3" /> {item.projectedProgress}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {event.completedSteps.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Persisted checkpoints</p>
            <div className="flex flex-wrap gap-1.5">
              {event.completedSteps.map(step => <Badge key={step} variant="outline" className="font-mono text-[10px]">{step}</Badge>)}
            </div>
          </div>
        )}

        {event.error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{event.error}</p>}
        {event.recoveryGuidance && (
          <p className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{event.recoveryGuidance}
          </p>
        )}
        {event.warnings.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {event.warnings.map(warning => <li key={warning}>{warning}</li>)}
          </ul>
        )}

        <div className="flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          Read-only audit evidence. Reversal is unavailable until an explicit governance policy is approved.
        </div>
      </CardContent>
    </Card>
  );
};

export const WorkPlanGovernanceHistoryDialog: React.FC<WorkPlanGovernanceHistoryDialogProps> = ({
  open, onOpenChange, divisionId, divisionName,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const query = useWorkPlanGovernanceHistory(divisionId, divisionName, open);
  const events = useMemo(() => (query.data?.events || []).filter(event =>
    (statusFilter === 'all' || event.status === statusFilter) &&
    (actionFilter === 'all' || event.action === actionFilter)), [query.data, statusFilter, actionFilter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-[#83002A]" />Retirement governance history</DialogTitle>
          <DialogDescription>
            Authorized read-only history for {divisionName}. This view cannot retire, reassign, recover or reverse execution records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6">
          {query.data && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Total events" value={query.data.summary.total} />
              <Metric label="Completed" value={query.data.summary.completed} />
              <Metric label="In progress" value={query.data.summary.running} />
              <Metric label="Recovery required" value={query.data.summary.failed} />
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={statusFilter} onValueChange={value => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="running">In progress</SelectItem>
                <SelectItem value="failed">Recovery required</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={value => setActionFilter(value as ActionFilter)}>
              <SelectTrigger className="sm:w-56"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="retire">Retained links</SelectItem>
                <SelectItem value="clear-links">Cleared links</SelectItem>
                <SelectItem value="reassign">Reassigned</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5 sm:ml-auto" onClick={() => query.refetch()} disabled={query.isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />Refresh
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-[58vh] px-6">
          <div className="space-y-3 pb-5">
            {query.isLoading && <p role="status" className="py-12 text-center text-sm text-muted-foreground">Loading authorized governance history…</p>}
            {query.error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{query.error instanceof Error ? query.error.message : 'Governance history could not be loaded.'}</p>}
            {!query.isLoading && !query.error && events.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <History className="mx-auto mb-2 h-8 w-8 opacity-40" />
                No retirement events match this authorized scope and filter.
              </div>
            )}
            {events.map(event => <EventCard key={event.operationId} event={event} />)}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t px-6 py-4">
          <p className="mr-auto text-xs text-muted-foreground">Captured {formatDate(query.data?.capturedAt)}</p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
