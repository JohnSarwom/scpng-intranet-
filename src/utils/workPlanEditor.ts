import type { WorkPlanActivity, WorkPlanGoal } from '../types/division.types';

/** Editable cells plus the complete originals: hidden data must survive a save. */
export interface WorkPlanTableRow {
  id: string;
  strategicObjective: string;
  linkedObjectiveId?: string;
  organizationalGoalRef?: WorkPlanGoal['organizationalGoalRef'];
  activity: string;
  output: string;
  kpi: string;
  responsibleOfficer: string;
  responsibleOfficerEmail?: string;
  timelineStart: string;
  timelineEnd: string;
  resources: string;
  status: WorkPlanActivity['status'];
  originalGoal?: WorkPlanGoal;
  originalActivity?: WorkPlanActivity;
}

export function goalsToRows(goals: WorkPlanGoal[]): WorkPlanTableRow[] {
  return goals.flatMap(goal => {
    const originalGoal = structuredClone(goal);
    const activities = goal.activities.length ? goal.activities : [undefined];
    return activities.map(activity => ({
      id: activity?.id ?? `empty-${goal.id}`,
      strategicObjective: goal.title,
      linkedObjectiveId: goal.linkedObjectiveId,
      organizationalGoalRef: goal.organizationalGoalRef,
      activity: activity?.title ?? '',
      output: activity?.expectedOutput ?? '',
      kpi: activity?.kpiDescription ?? '',
      responsibleOfficer: activity?.responsiblePersonName ?? '',
      responsibleOfficerEmail: activity?.responsiblePersonEmail,
      timelineStart: activity?.startDate ?? '',
      timelineEnd: activity?.endDate ?? '',
      resources: activity?.resourcesRequired ?? '',
      status: activity?.status ?? 'not-started',
      originalGoal,
      originalActivity: activity ? structuredClone(activity) : undefined,
    }));
  });
}

/** Duplicating planned work never duplicates execution or source identities. */
export function duplicateWorkPlanRow(row: WorkPlanTableRow): WorkPlanTableRow {
  return { ...row, id: `new-${crypto.randomUUID()}`, originalActivity: undefined, status: 'not-started' };
}

/** Existing goal labels are renames, never a title-based reassignment to another list. */
export function updateWorkPlanRow(rows: WorkPlanTableRow[], id: string, updates: Partial<WorkPlanTableRow>): WorkPlanTableRow[] {
  const selected = rows.find(row => row.id === id);
  return rows.map(row => {
    if (row.id === id) return { ...row, ...updates };
    if (updates.strategicObjective !== undefined && selected?.originalGoal &&
        row.originalGoal?.id === selected.originalGoal.id) {
      return { ...row, strategicObjective: updates.strategicObjective };
    }
    return row;
  });
}

export function rowsToGoals(rows: WorkPlanTableRow[], planId: string): WorkPlanGoal[] {
  const groups = new Map<string, WorkPlanTableRow[]>();
  for (const row of rows) {
    // Never merge existing goals just because their titles or parent IDs match.
    const key = row.originalGoal ? `existing:${row.originalGoal.id}` :
      JSON.stringify(['new', row.organizationalGoalRef ?? null, row.strategicObjective || 'General']);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map((groupRows, index) => {
    const first = groupRows[0];
    const original = first.originalGoal ? structuredClone(first.originalGoal) : undefined;
    const goalId = original?.id ?? `goal-${planId}-${first.id}`;
    const activities = groupRows.filter(row => row.activity.trim() || row.originalActivity).map((row, order): WorkPlanActivity => {
      const activity = row.originalActivity ? structuredClone(row.originalActivity) : undefined;
      const statusUnchanged = activity?.status === row.status;
      return {
        ...activity,
        id: activity?.id ?? (row.id.startsWith('empty-') ? `act-${row.id}` : row.id),
        goalId,
        title: row.activity,
        description: activity?.description ?? '',
        assignedUnitId: activity?.assignedUnitId ?? '',
        assignedUnitName: activity?.assignedUnitName ?? '',
        responsiblePersonName: row.responsibleOfficer || undefined,
        responsiblePersonEmail: row.responsibleOfficerEmail,
        startDate: row.timelineStart,
        endDate: row.timelineEnd,
        expectedOutput: row.output,
        kpiDescription: row.kpi || (activity?.kpiDescription === undefined ? undefined : ''),
        resourcesRequired: row.resources || (activity?.resourcesRequired === undefined ? undefined : ''),
        linkedTaskIds: activity?.linkedTaskIds ?? [],
        status: row.status,
        progress: statusUnchanged ? activity.progress : row.status === 'completed' ? 100 : row.status === 'in-progress' ? 50 : 0,
        order: activity?.order ?? order,
      };
    });
    const membershipAndStatusUnchanged = original && activities.length === original.activities.length &&
      activities.every(activity => original.activities.some(old => old.id === activity.id && old.status === activity.status));
    const completed = activities.filter(activity => activity.status === 'completed').length;
    const progress = activities.length ? Math.round(completed / activities.length * 100) : 0;
    return {
      ...original,
      id: goalId,
      workPlanId: planId,
      title: first.strategicObjective || 'General',
      description: original?.description ?? '',
      // A strategic dropdown value is not a Unit_Objectives execution ID.
      linkedObjectiveId: original?.linkedObjectiveId,
      organizationalGoalRef: original?.organizationalGoalRef ?? first.organizationalGoalRef,
      linkedObjectiveTitle: original?.linkedObjectiveTitle,
      responsibleUnitIds: original?.responsibleUnitIds ?? [],
      responsibleUnitNames: original?.responsibleUnitNames ?? [],
      activities,
      progress: membershipAndStatusUnchanged ? original.progress : progress,
      status: membershipAndStatusUnchanged ? original.status : activities.length && completed === activities.length ? 'completed' :
        activities.some(activity => ['overdue', 'blocked'].includes(activity.status)) ? 'at-risk' : progress > 0 ? 'in-progress' : 'not-started',
      order: original?.order ?? index,
    };
  });
}

export function workPlanProgressUnchanged(before: WorkPlanGoal[], after: WorkPlanGoal[]): boolean {
  return before.length === after.length && after.every(goal => {
    const old = before.find(candidate => candidate.id === goal.id);
    return old && old.activities.length === goal.activities.length && goal.activities.every(activity =>
      old.activities.some(candidate => candidate.id === activity.id && candidate.status === activity.status && candidate.progress === activity.progress));
  });
}
