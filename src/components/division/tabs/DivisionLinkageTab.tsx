import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Download, Link2Off, RefreshCw, ShieldCheck } from 'lucide-react';
import { UseDivisionDataReturn } from '@/hooks/useDivisionData';
import { useLinkageInventory, useLinkageTriage, type TriageOutcome } from '@/hooks/useLinkageInventory';
import type { TriageAction } from '@/utils/taskAlignment';
import {
  linkageIssuesToCsv,
  strategicTaskCount,
  tracedTaskShare,
  type InventoryIssue,
  type UnitLinkageSummary,
} from '@/services/linkageInventoryService';

const ISSUE_ROW_LIMIT = 200;

interface DivisionLinkageTabProps {
  data: UseDivisionDataReturn;
  isAdmin: boolean;
  /** Managers, Directors and admins who may link tasks or mark them operational. */
  canTriage: boolean;
}

function StatTile({ label, value, hint, tone = 'default' }: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold mt-1 ${tone === 'warn' ? 'text-amber-600' : ''}`}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

const count = (value: number) => (value > 0 ? <span className="font-medium text-amber-600">{value}</span> : <span className="text-muted-foreground">0</span>);

function UnitRow({ summary, emphasis = false }: { summary: UnitLinkageSummary; emphasis?: boolean }) {
  const share = tracedTaskShare(summary);
  return (
    <TableRow className={emphasis ? 'font-semibold bg-muted/40' : undefined}>
      <TableCell className="whitespace-nowrap">{summary.unit}</TableCell>
      <TableCell className="text-right">{summary.tasks.total}</TableCell>
      <TableCell className="text-right text-muted-foreground">{summary.tasks.operational}</TableCell>
      <TableCell className="text-right whitespace-nowrap">
        {summary.tasks.traced}{share !== null && <span className="text-xs text-muted-foreground"> ({share}%)</span>}
      </TableCell>
      <TableCell className="text-right">{count(summary.tasks.unlinked)}</TableCell>
      <TableCell className="text-right">{count(summary.tasks.kraOnly)}</TableCell>
      <TableCell className="text-right">{count(summary.tasks.brokenLink + summary.tasks.chainIncomplete)}</TableCell>
      <TableCell className="text-right">{count(summary.tasks.kraConflict)}</TableCell>
      <TableCell className="text-right">{summary.kpis.total}</TableCell>
      <TableCell className="text-right">{summary.kras.total}</TableCell>
      <TableCell className="text-right">{count(summary.kras.noObjective + summary.kras.brokenObjective)}</TableCell>
      <TableCell className="text-right">{summary.objectives.total}</TableCell>
      <TableCell className="text-right">{count(summary.objectives.noParent)}</TableCell>
    </TableRow>
  );
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DivisionLinkageTab({ data, isAdmin, canTriage }: DivisionLinkageTabProps) {
  const divisionName = data.division?.name;
  const unitNames = data.division?.unitNames || [];
  const { data: inventory, isLoading, error, refetch, isFetching } = useLinkageInventory(divisionName, unitNames, true);
  const triage = useLinkageTriage();

  const [unitFilter, setUnitFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState<'gap' | 'all'>('gap');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [triageKpiId, setTriageKpiId] = useState<string>('');
  const [pendingAction, setPendingAction] = useState<TriageAction | null>(null);
  const [lastOutcomes, setLastOutcomes] = useState<TriageOutcome[] | null>(null);

  const toggleTask = (taskId: string, checked: boolean) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(taskId); else next.delete(taskId);
      return next;
    });
  };

  const runTriage = async () => {
    if (!pendingAction || !inventory) return;
    const taskIds = Array.from(selectedTaskIds);
    const action = pendingAction;
    setPendingAction(null);
    try {
      const outcomes = await triage.mutateAsync({ taskIds, action, taskMeta: inventory.taskMeta });
      setLastOutcomes(outcomes);
      // Keep only the failures selected so they can be retried after a refresh.
      setSelectedTaskIds(new Set(outcomes.filter(o => !o.ok).map(o => o.taskId)));
    } catch (err: any) {
      setLastOutcomes(taskIds.map(taskId => ({ taskId, ok: false, error: err?.message || 'Could not connect to SharePoint.' })));
    }
  };

  const filteredIssues = useMemo<InventoryIssue[]>(() => {
    if (!inventory) return [];
    return inventory.issues.filter(issue =>
      (unitFilter === 'all' || issue.unit === unitFilter) &&
      (severityFilter === 'all' || issue.severity === 'gap'),
    );
  }, [inventory, unitFilter, severityFilter]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (error || !inventory) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-48 gap-3 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-sm font-medium">The linkage inventory could not be loaded</p>
          <p className="text-xs text-muted-foreground max-w-md">
            {error?.message || 'No data was returned.'} No counts are shown, because partial data would understate the gaps.
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const { totals } = inventory;
  const share = tracedTaskShare(totals);
  const shownIssues = filteredIssues.slice(0, ISSUE_ROW_LIMIT);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Strategy linkage inventory</h2>
              {!canTriage && <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" />Read only</Badge>}
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              How many of this Division's tasks trace all the way from Task to KPI, KRA and Unit Objective, and which
              records are missing a link. Counts come straight from SharePoint; nothing is inferred, and records change only when you save a clean-up below.
              Generated {new Date(inventory.generatedAt).toLocaleString()}.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={inventory.issues.length === 0}
              onClick={() => downloadCsv(
                `linkage-inventory-${inventory.divisionName.replace(/\s+/g, '-').toLowerCase()}-${inventory.generatedAt.slice(0, 10)}.csv`,
                linkageIssuesToCsv(inventory),
              )}
            >
              <Download className="h-4 w-4" />Download issues
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Strategic tasks fully traced"
          value={share === null ? '—' : `${share}%`}
          hint={`${totals.tasks.traced} of ${strategicTaskCount(totals)} tasks; ${totals.tasks.operational} marked operational`}
        />
        <StatTile
          label="Tasks with no link"
          value={totals.tasks.unlinked}
          hint={`${totals.tasks.kraOnly} more linked to a KRA only`}
          tone={totals.tasks.unlinked > 0 ? 'warn' : 'default'}
        />
        <StatTile
          label="KRAs without an Objective"
          value={totals.kras.noObjective + totals.kras.brokenObjective}
          hint={`of ${totals.kras.total} KRAs`}
          tone={totals.kras.noObjective + totals.kras.brokenObjective > 0 ? 'warn' : 'default'}
        />
        <StatTile
          label="Objectives without a strategic parent"
          value={totals.objectives.noParent}
          hint={`of ${totals.objectives.total} Unit Objectives`}
          tone={totals.objectives.noParent > 0 ? 'warn' : 'default'}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">By unit</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="text-right">Operational</TableHead>
                <TableHead className="text-right">Traced</TableHead>
                <TableHead className="text-right">No link</TableHead>
                <TableHead className="text-right">KRA only</TableHead>
                <TableHead className="text-right whitespace-nowrap">Broken chain</TableHead>
                <TableHead className="text-right whitespace-nowrap">KRA conflict</TableHead>
                <TableHead className="text-right">KPIs</TableHead>
                <TableHead className="text-right">KRAs</TableHead>
                <TableHead className="text-right whitespace-nowrap">No Objective</TableHead>
                <TableHead className="text-right">Objectives</TableHead>
                <TableHead className="text-right whitespace-nowrap">No parent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory.units.map(summary => <UnitRow key={summary.unit} summary={summary} />)}
              <UnitRow summary={totals} emphasis />
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-3">
            "Broken chain" covers links to deleted or retired records and KPIs whose KRA or Objective is missing.
            "KRA conflict" means a task's own KRA differs from its KPI's KRA. "Operational" tasks are day-to-day work
            deliberately not linked to strategy; they don't count against the traced share. Tasks with no unit are counted here only
            when their KPI or KRA belongs to this Division.
          </p>
        </CardContent>
      </Card>

      {inventory.unplacedKpis.length > 0 && (
        <Card>
          <CardContent className="p-4 flex gap-3 items-start">
            <Link2Off className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p>
                <span className="font-medium">{inventory.unplacedKpis.length} KPIs across the organisation have no valid KRA.</span>{' '}
                They record no unit of their own, so they can't be counted under any Division.
              </p>
              {isAdmin ? (
                <ul className="text-xs text-muted-foreground list-disc pl-4 max-h-40 overflow-y-auto">
                  {inventory.unplacedKpis.map(kpi => (
                    <li key={kpi.recordId}>#{kpi.recordId} {kpi.title}: {kpi.detail}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">An administrator can see the full list.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-sm">Records to review ({filteredIssues.length})</CardTitle>
          <div className="flex gap-2">
            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All units</SelectItem>
                {inventory.units.map(summary => (
                  <SelectItem key={summary.unit} value={summary.unit}>{summary.unit}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={value => setSeverityFilter(value as 'gap' | 'all')}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gap">Missing links only</SelectItem>
                <SelectItem value="all">Include unused KPIs/KRAs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {canTriage && (
            <div className="mb-3 rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Tick tasks below, then link them to a KPI or mark them as operational work. Each task is saved on its
                own; a task someone else changed since this list loaded is skipped, not overwritten.
              </p>
              <div className="flex flex-col md:flex-row gap-2 md:items-center">
                <span className="text-xs font-medium whitespace-nowrap">{selectedTaskIds.size} selected</span>
                <Select value={triageKpiId} onValueChange={setTriageKpiId}>
                  <SelectTrigger className="h-8 text-xs md:w-80"><SelectValue placeholder="Choose a KPI to link to" /></SelectTrigger>
                  <SelectContent>
                    {inventory.kpiOptions.map(option => (
                      <SelectItem key={option.id} value={option.id} className="text-xs">
                        {option.unit}: {option.name} (KRA: {option.kraTitle}){option.traced ? '' : ' - KRA has no Objective'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-8"
                    disabled={selectedTaskIds.size === 0 || !triageKpiId || triage.isPending}
                    onClick={() => setPendingAction({ kind: 'link', kpiId: triageKpiId })}
                  >
                    Link to KPI
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={selectedTaskIds.size === 0 || triage.isPending}
                    onClick={() => setPendingAction({ kind: 'operational' })}
                  >
                    Mark operational
                  </Button>
                  {selectedTaskIds.size > 0 && (
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelectedTaskIds(new Set())}>Clear</Button>
                  )}
                </div>
              </div>
              {triage.isPending && <p className="text-xs">Saving tasks...</p>}
              {lastOutcomes && !triage.isPending && (
                <div className="text-xs space-y-1">
                  <p>
                    {lastOutcomes.filter(o => o.ok).length} task(s) saved.
                    {lastOutcomes.some(o => !o.ok) && ` ${lastOutcomes.filter(o => !o.ok).length} not saved and still selected:`}
                  </p>
                  {lastOutcomes.filter(o => !o.ok).map(o => (
                    <p key={o.taskId} className="text-red-600">Task {o.taskId}: {o.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          {shownIssues.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No records need review for this filter.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {canTriage && <TableHead className="w-8"><span className="sr-only">Select</span></TableHead>}
                  <TableHead>Unit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Issue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shownIssues.map(issue => (
                  <TableRow key={`${issue.code}:${issue.recordType}:${issue.recordId}`}>
                    {canTriage && (
                      <TableCell className="w-8">
                        {issue.recordType === 'task' && (
                          <Checkbox
                            aria-label={`Select task ${issue.recordId}`}
                            checked={selectedTaskIds.has(issue.recordId)}
                            onCheckedChange={checked => toggleTask(issue.recordId, checked === true)}
                          />
                        )}
                      </TableCell>
                    )}
                    <TableCell className="whitespace-nowrap text-xs">{issue.unit}</TableCell>
                    <TableCell className="text-xs uppercase">{issue.recordType}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{issue.recordId}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate" title={issue.title}>{issue.title}</TableCell>
                    <TableCell className="text-xs">
                      {issue.severity === 'info' && <Badge variant="secondary" className="mr-1.5 text-[10px]">Review</Badge>}
                      {issue.detail}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {filteredIssues.length > ISSUE_ROW_LIMIT && (
            <p className="text-xs text-muted-foreground mt-3">
              Showing the first {ISSUE_ROW_LIMIT} of {filteredIssues.length}. Download the issues file for the full list.
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingAction} onOpenChange={open => { if (!open) setPendingAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.kind === 'link' ? 'Link tasks to this KPI?' : 'Mark tasks as operational?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.kind === 'link'
                ? `${selectedTaskIds.size} task(s) will be linked to "${inventory.kpiOptions.find(o => o.id === triageKpiId)?.name || 'the selected KPI'}". Their KRA is set from the KPI, and the KPI's checklist is updated.`
                : `${selectedTaskIds.size} task(s) will be marked as operational work. Any existing KPI or KRA link on them is removed.`}
              {' '}This changes live SharePoint records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runTriage}>Save changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
