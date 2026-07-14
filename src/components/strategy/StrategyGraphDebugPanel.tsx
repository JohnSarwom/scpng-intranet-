/**
 * StrategyGraphDebugPanel (Phase 3 — read-only)
 *
 * Renders the role-recursive StrategyExecutionGraph against live SharePoint data so
 * the tree, rollups, and linkage diagnostics can be eyeballed BEFORE the Strategy
 * page is switched over. Read-only: it never writes.
 */

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Network, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';
import { useStrategyExecutionGraph } from '@/hooks/useStrategyExecutionGraph';
import type {
  PerformanceNode,
  ProgressStatusBand,
  LinkageDiagnostic,
  DivisionExecutionNode,
} from '@/types/strategyExecution';

const BAND_COLOR: Record<ProgressStatusBand, string> = {
  no_linked_data: 'bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  not_started: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  behind_or_early: 'bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  in_progress: 'bg-blue-200 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  on_track: 'bg-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  completed: 'bg-green-300 text-green-900 dark:bg-green-900/50 dark:text-green-200',
};

const ROLE_COLOR: Record<string, string> = {
  director: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  manager: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  officer: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
};

const SEVERITY_COLOR: Record<LinkageDiagnostic['severity'], string> = {
  info: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function ProgressBadge({ node }: { node: { progress?: PerformanceNode['progress'] } }) {
  const p = node.progress;
  if (!p) return null;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${BAND_COLOR[p.statusBand]}`} title={p.explanation}>
      {p.value}% · {p.statusBand.replace(/_/g, ' ')}
    </span>
  );
}

function NodeRow({ node, depth }: { node: PerformanceNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 text-sm hover:bg-muted/40 rounded px-1"
        style={{ paddingLeft: depth * 16 }}
      >
        {hasChildren ? (
          <button onClick={() => setOpen((o) => !o)} className="shrink-0 text-muted-foreground">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {node.ownerRole && (
          <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${ROLE_COLOR[node.ownerRole] || ''}`}>
            {node.ownerRole}
          </span>
        )}
        <span className="font-medium truncate max-w-[280px]" title={node.title}>{node.title}</span>
        <ProgressBadge node={node} />
        {node.ownerName || node.ownerEmail ? (
          <span className="text-xs text-muted-foreground truncate">· {node.ownerName || node.ownerEmail}</span>
        ) : null}
        {node.tasks.length > 0 && (
          <span className="text-[10px] text-muted-foreground">{node.tasks.length} task(s)</span>
        )}
        {node.rolesInferred && (
          <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
            inferred
          </span>
        )}
        {node.diagnostics?.length ? (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-label="has diagnostics" />
        ) : null}
      </div>
      {open && hasChildren && (
        <div>
          {node.children.map((c) => (
            <NodeRow key={c.id} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function DivisionRow({ division }: { division: DivisionExecutionNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 py-1.5 text-sm">
        <button onClick={() => setOpen((o) => !o)} className="shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <span className="font-semibold truncate max-w-[240px]">{division.title}</span>
        <ProgressBadge node={division} />
        <span className="text-[10px] text-muted-foreground">
          {division.units.length} unit(s) · {division.performanceRecords?.length || 0} record(s)
        </span>
      </div>
      {open && (
        <div className="pl-6 pb-2">
          {division.units.map((u) => (
            <div key={u.id} className="flex items-center gap-2 py-1 text-sm">
              <span className="truncate max-w-[220px]">{u.title}</span>
              <ProgressBadge node={u} />
              <span className="text-[10px] text-muted-foreground">
                {u.performanceRecords?.length || 0} record(s)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const StrategyGraphDebugPanel: React.FC = () => {
  const { graph, isLoading } = useStrategyExecutionGraph({ scope: 'corporate' });
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const stats = useMemo(() => {
    const bySeverity = { info: 0, warning: 0, error: 0 };
    for (const d of graph.diagnostics) bySeverity[d.severity]++;
    return {
      goals: graph.goals.length,
      divisions: graph.divisions.length,
      records: Object.keys(graph.lookups.performanceRecordsById || {}).length,
      tasks: Object.keys(graph.lookups.tasksById).length,
      diagnostics: graph.diagnostics.length,
      bySeverity,
    };
  }, [graph]);

  return (
    <Card className="border-2 border-cyan-500/40 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
          <Network className="h-5 w-5" />
          Strategy Execution Graph — Debug (read-only)
        </CardTitle>
        <CardDescription>
          Role-recursive graph built live from SharePoint via <code>useStrategyExecutionGraph</code>.
          Use this to verify the cascade and linkage diagnostics before wiring the Strategy page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading graph…
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{stats.goals} goals</Badge>
              <Badge variant="secondary">{stats.divisions} divisions</Badge>
              <Badge variant="secondary">{stats.records} records</Badge>
              <Badge variant="secondary">{stats.tasks} tasks</Badge>
              <Badge className={SEVERITY_COLOR.info}>{stats.bySeverity.info} info</Badge>
              <Badge className={SEVERITY_COLOR.warning}>{stats.bySeverity.warning} warning</Badge>
              <Badge className={SEVERITY_COLOR.error}>{stats.bySeverity.error} error</Badge>
            </div>

            {/* Strategy-first tree */}
            <div>
              <h4 className="text-sm font-semibold mb-1">Strategy-first (Goal → roles → tasks)</h4>
              <div className="rounded border border-border/60 p-2 max-h-[420px] overflow-auto">
                {graph.goals.length === 0 && (
                  <p className="text-sm text-muted-foreground">No goals.</p>
                )}
                {graph.goals.map((g) => (
                  <div key={g.id} className="mb-2">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <span className="truncate max-w-[300px]">{g.title}</span>
                      <ProgressBadge node={g} />
                      <span className="text-[10px] text-muted-foreground">
                        {(g.performanceRoots || []).length} root(s)
                      </span>
                    </div>
                    {(g.performanceRoots || []).map((n) => (
                      <NodeRow key={n.id} node={n} depth={1} />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Division-first */}
            <div>
              <h4 className="text-sm font-semibold mb-1">Division-first (Division → Unit)</h4>
              <div className="rounded border border-border/60 p-2 max-h-[300px] overflow-auto">
                {graph.divisions.map((d) => (
                  <DivisionRow key={d.id} division={d} />
                ))}
              </div>
            </div>

            {/* Diagnostics */}
            <div>
              <Button variant="outline" size="sm" onClick={() => setShowDiagnostics((s) => !s)}>
                {showDiagnostics ? 'Hide' : 'Show'} diagnostics ({stats.diagnostics})
              </Button>
              {showDiagnostics && (
                <div className="mt-2 rounded border border-border/60 p-2 max-h-[300px] overflow-auto space-y-1">
                  {graph.diagnostics.length === 0 && (
                    <p className="text-sm text-muted-foreground">No diagnostics — clean graph.</p>
                  )}
                  {graph.diagnostics.map((d) => (
                    <div key={d.id} className="flex items-start gap-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded shrink-0 ${SEVERITY_COLOR[d.severity]}`}>
                        {d.severity}
                      </span>
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{d.entityType}</span>
                        {d.title ? ` "${d.title}"` : ''} — {d.message}
                        {d.recommendedAction ? ` → ${d.recommendedAction}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default StrategyGraphDebugPanel;
