/**
 * Strategic Goal link review (admin)
 *
 * One-time move of every Unit Objective onto the official goal list,
 * Strategic_Goals, through the StrategicGoal lookup column.
 *
 * "Review links" only reads. Each write is a separate button with its own
 * confirmation: creating the column (a schema change), adding missing
 * Corporate Plan goals, and applying the reviewed links. Link writes use the
 * version each objective was loaded with, so a record changed in the meantime
 * is refused rather than overwritten.
 */

import { useMemo, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Link2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { getGraphClient } from '@/services/graphService';
import { SharePointOpsService } from '@/services/sharePointOpsService';
import { StrategyService } from '@/services/strategyService';
import {
  type CorporatePlanGoal,
  type CrosswalkRow,
  type CrosswalkStatus,
  crosswalkChanges,
  missingCorporatePlanGoals,
  proposeGoalCrosswalk,
} from '@/utils/strategicGoalLink';

type ColumnStatus = Awaited<ReturnType<SharePointOpsService['getStrategicGoalColumnStatus']>>;

interface Review {
  column: ColumnStatus;
  goals: Array<{ id: string; title: string }>;
  rows: CrosswalkRow[];
  missingPlanGoals: CorporatePlanGoal[];
  loadedAt: string;
}

interface ApplyOutcome {
  objectiveId: string;
  title: string;
  ok: boolean;
  error?: string;
}

type PendingAction = 'column' | 'goals' | 'apply' | null;

const STATUS_LABEL: Record<CrosswalkStatus, string> = {
  linked: 'Linked',
  proposed: 'Proposed',
  conflict: 'Conflict',
  unresolved: 'Needs a choice',
};

const STATUS_CLASS: Record<CrosswalkStatus, string> = {
  linked: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  proposed: 'bg-blue-50 text-blue-700 border-blue-200',
  conflict: 'bg-amber-50 text-amber-700 border-amber-200',
  unresolved: 'bg-gray-100 text-gray-700 border-gray-200',
};

const NO_GOAL = '';

export default function StrategicGoalLinkPanel() {
  const { instance: msalInstance } = useMsal();
  const { isAdmin } = useRoleBasedAuth();
  const queryClient = useQueryClient();

  const [review, setReview] = useState<Review | null>(null);
  const [choices, setChoices] = useState<Record<string, string | null>>({});
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [outcomes, setOutcomes] = useState<ApplyOutcome[] | null>(null);

  const services = async () => {
    const graphClient = await getGraphClient(msalInstance);
    if (!graphClient) throw new Error('Could not connect to Microsoft Graph.');
    const ops = new SharePointOpsService(graphClient);
    const strategy = new StrategyService(graphClient);
    await Promise.all([ops.initialize(), strategy.initialize()]);
    return { ops, strategy };
  };

  const load = async () => {
    setBusy('Reading SharePoint...');
    setError(null);
    try {
      const { ops, strategy } = await services();
      const [column, goalItems, legacyObjectives, objectives] = await Promise.all([
        ops.getStrategicGoalColumnStatus(),
        strategy.fetchStrategicGoals(),
        strategy.fetchLegacyObjectiveTitles(),
        ops.getObjectives('Division', { division: '', unit: '', email: '', name: '', role: 'super_admin' } as any),
      ]);
      const goals = goalItems.map((goal: any) => ({ id: String(goal.id), title: String(goal.title || '') }));
      const rows = proposeGoalCrosswalk({
        objectives: objectives.map(objective => ({
          id: String(objective.id),
          title: objective.title,
          goalType: objective.goalType,
          division: objective.division,
          unit: objective.unit,
          parentGoalId: objective.parentGoalId,
          linkedDeliverable: objective.linkedDeliverable,
          strategicGoalId: objective.strategicGoalId,
          revision: objective.revision,
        })),
        goals,
        legacyObjectives,
      });
      setReview({ column, goals, rows, missingPlanGoals: missingCorporatePlanGoals(goals), loadedAt: new Date().toISOString() });
      setChoices({});
      setOutcomes(null);
    } catch (err: any) {
      setError(err?.message || 'The review could not be loaded.');
    } finally {
      setBusy(null);
    }
  };

  const changes = useMemo(() => (review ? crosswalkChanges(review.rows, choices) : []), [review, choices]);
  const goalTitle = (id: string | null) => (id ? review?.goals.find(goal => goal.id === id)?.title || `Goal ${id}` : 'None');
  const counts = useMemo(() => {
    const result: Record<CrosswalkStatus, number> = { linked: 0, proposed: 0, conflict: 0, unresolved: 0 };
    for (const row of review?.rows || []) result[row.status] += 1;
    return result;
  }, [review]);
  const visibleRows = (review?.rows || []).filter(row => showAll || row.status !== 'linked');
  const columnReady = !!review?.column.columnExists && review.column.targetsStrategicGoals;

  const runPending = async () => {
    const action = pending;
    setPending(null);
    if (!action || !review) return;
    setError(null);
    try {
      const { ops, strategy } = await services();
      if (action === 'column') {
        setBusy('Creating the Strategic Goal column...');
        await ops.createStrategicGoalColumn();
      } else if (action === 'goals') {
        setBusy('Adding Corporate Plan goals...');
        for (const goal of review.missingPlanGoals) {
          await strategy.createStrategicGoal({ title: goal.title, description: goal.description, icon: goal.icon });
        }
      } else if (action === 'apply') {
        const results: ApplyOutcome[] = [];
        let done = 0;
        for (const change of changes) {
          done += 1;
          setBusy(`Saving links (${done} of ${changes.length})...`);
          const title = review.rows.find(row => row.objectiveId === change.objectiveId)?.title || change.objectiveId;
          try {
            await ops.updateObjective(change.objectiveId, { strategicGoalId: change.toGoalId, revision: change.revision });
            results.push({ objectiveId: change.objectiveId, title, ok: true });
          } catch (err: any) {
            results.push({ objectiveId: change.objectiveId, title, ok: false, error: err?.message || 'Not saved.' });
          }
        }
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: ['sharePoint', 'objectives'] }),
          queryClient.invalidateQueries({ queryKey: ['strategyData'] }),
          queryClient.invalidateQueries({ queryKey: ['linkageInventory'] }),
        ]);
        setBusy(null);
        await load();
        setOutcomes(results);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['strategyData'] });
      setBusy(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'The change could not be saved.');
      setBusy(null);
    }
  };

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          Strategic Goal links
        </CardTitle>
        <CardDescription>
          Links every Unit Objective to an item in Strategic_Goals, the official list of organisational goals. Review reads only;
          each change below asks for confirmation first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={load} disabled={!!busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {review ? 'Reload review' : 'Review links'}
          </Button>
          {busy && <span className="text-xs text-muted-foreground">{busy}</span>}
          {review && !busy && <span className="text-xs text-muted-foreground">Loaded {new Date(review.loadedAt).toLocaleString()}</span>}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {review && (
          <>
            {/* Step 1: column */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">1. Link column on Unit_Objectives</h3>
              {columnReady ? (
                <p className="flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />The Strategic Goal column exists and looks up Strategic_Goals.</p>
              ) : review.column.columnExists ? (
                <p className="text-sm text-amber-700">A StrategicGoal column exists but does not look up Strategic_Goals. Fix it in SharePoint list settings before applying links.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-muted-foreground">The column doesn't exist yet. Links can be reviewed, but not saved, until it does.</p>
                  <Button size="sm" onClick={() => setPending('column')} disabled={!!busy || !review.column.goalsListId}>Create column</Button>
                </div>
              )}
            </section>

            {/* Step 2: goals */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">2. Goals in Strategic_Goals ({review.goals.length})</h3>
              {review.goals.length === 0 ? (
                <p className="text-sm text-muted-foreground">The list is empty.</p>
              ) : (
                <ul className="text-sm space-y-0.5">
                  {review.goals.map(goal => (
                    <li key={goal.id}><span className="text-muted-foreground">#{goal.id}</span> {goal.title}</li>
                  ))}
                </ul>
              )}
              {review.missingPlanGoals.length > 0 ? (
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-800">
                    Not yet in the list from the Corporate Plan 2026–2028: {review.missingPlanGoals.map(goal => `Goal ${goal.number} ${goal.title}`).join('; ')}.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setPending('goals')} disabled={!!busy}>
                    Add {review.missingPlanGoals.length} goal{review.missingPlanGoals.length === 1 ? '' : 's'}
                  </Button>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />All four Corporate Plan goals are in the list.</p>
              )}
            </section>

            {/* Step 3: review */}
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">3. Objective links ({review.rows.length} objectives)</h3>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={showAll} onChange={event => setShowAll(event.target.checked)} />
                  Show already linked
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                {counts.linked} linked, {counts.proposed} proposed, {counts.conflict} with conflicting evidence, {counts.unresolved} need a choice.
                Proposals come from the old deliverable text and parent fields; check each before applying.
              </p>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Objective</th>
                      <th className="p-2 text-left">Division / unit</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Evidence</th>
                      <th className="p-2 text-left min-w-[220px]">Strategic Goal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.length === 0 && (
                      <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Every objective is linked to an existing goal.</td></tr>
                    )}
                    {visibleRows.map(row => {
                      const chosen = Object.prototype.hasOwnProperty.call(choices, row.objectiveId)
                        ? choices[row.objectiveId]
                        : row.proposedGoalId;
                      return (
                        <tr key={row.objectiveId} className="border-t align-top">
                          <td className="p-2">
                            <div className="font-medium">{row.title}</div>
                            <div className="text-xs text-muted-foreground">#{row.objectiveId} · {row.goalType || 'no type'}</div>
                          </td>
                          <td className="p-2 text-xs">{row.division || '—'}<br />{row.unit || '—'}</td>
                          <td className="p-2"><Badge variant="outline" className={STATUS_CLASS[row.status]}>{STATUS_LABEL[row.status]}</Badge></td>
                          <td className="p-2 text-xs text-muted-foreground max-w-[320px]">{row.evidence.join(' ')}</td>
                          <td className="p-2">
                            <select
                              className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                              value={chosen || NO_GOAL}
                              onChange={event => setChoices(prev => ({ ...prev, [row.objectiveId]: event.target.value || null }))}
                              disabled={!!busy}
                            >
                              <option value={NO_GOAL}>No goal</option>
                              {review.goals.map(goal => (
                                <option key={goal.id} value={goal.id}>{goal.title}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Step 4: apply */}
            <section className="flex flex-wrap items-center gap-3">
              <Button onClick={() => setPending('apply')} disabled={!!busy || changes.length === 0 || !columnReady}>
                Apply {changes.length} link change{changes.length === 1 ? '' : 's'}
              </Button>
              {!columnReady && changes.length > 0 && (
                <span className="text-xs text-muted-foreground">Create the column first.</span>
              )}
            </section>

            {outcomes && (
              <section className="space-y-1 text-sm">
                <p className={outcomes.every(o => o.ok) ? 'text-emerald-700' : 'text-amber-700'}>
                  {outcomes.filter(o => o.ok).length} of {outcomes.length} links saved.
                </p>
                {outcomes.filter(o => !o.ok).map(o => (
                  <p key={o.objectiveId} className="text-xs text-red-700">#{o.objectiveId} {o.title}: {o.error}</p>
                ))}
              </section>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog open={pending !== null} onOpenChange={open => { if (!open) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending === 'column' && 'Create the Strategic Goal column?'}
              {pending === 'goals' && 'Add the missing Corporate Plan goals?'}
              {pending === 'apply' && `Save ${changes.length} objective link${changes.length === 1 ? '' : 's'}?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {pending === 'column' && (
                  <p>Adds a "Strategic Goal" lookup column to the Unit_Objectives list, pointing at Strategic_Goals. This changes the production list's schema. Existing data is not changed.</p>
                )}
                {pending === 'goals' && review && (
                  <>
                    <p>Creates these items in the Strategic_Goals list:</p>
                    <ul className="list-disc pl-5">
                      {review.missingPlanGoals.map(goal => <li key={goal.number}>{goal.title}</li>)}
                    </ul>
                    <p>Existing goals are not changed or removed.</p>
                  </>
                )}
                {pending === 'apply' && (
                  <>
                    <p>Writes the Strategic Goal link on {changes.length} Unit Objective{changes.length === 1 ? '' : 's'}. No other field is changed. An objective edited since this review was loaded is skipped.</p>
                    <ul className="max-h-48 overflow-y-auto list-disc pl-5 text-xs">
                      {changes.map(change => (
                        <li key={change.objectiveId}>
                          {review?.rows.find(row => row.objectiveId === change.objectiveId)?.title}: {goalTitle(change.fromGoalId)} → {goalTitle(change.toGoalId)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runPending}>
              {pending === 'column' && 'Create column'}
              {pending === 'goals' && 'Add goals'}
              {pending === 'apply' && 'Save links'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
