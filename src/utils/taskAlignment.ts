/**
 * Strategy alignment choice for a Task: either linked to a KPI or explicitly
 * marked as operational (day-to-day work that is deliberately not linked).
 *
 * The operational flag is stored as a tag on the existing Operations_Tasks Tags
 * column, so no SharePoint schema change is needed. Kept free of runtime
 * imports so the Node test harness can load it directly.
 */

export const OPERATIONAL_TASK_TAG = 'strategy:operational';

/** Select value used by the task form for "Operational work". */
export const OPERATIONAL_KPI_CHOICE = 'operational';

const hasKpi = (kpiId: unknown): boolean => {
  const value = kpiId === null || kpiId === undefined ? '' : String(kpiId).trim();
  return !!value && value !== 'none' && value !== OPERATIONAL_KPI_CHOICE;
};

export function isOperationalTask(tags: readonly string[] | null | undefined): boolean {
  return (tags || []).some(tag => tag.trim().toLowerCase() === OPERATIONAL_TASK_TAG);
}

export function withOperationalTag(tags: readonly string[] | null | undefined, operational: boolean): string[] {
  const rest = (tags || []).filter(tag => tag.trim().toLowerCase() !== OPERATIONAL_TASK_TAG);
  return operational ? [...rest, OPERATIONAL_TASK_TAG] : rest;
}

/** The form's KPI select value for a task: its KPI, "operational", or undefined when undecided. */
export function alignmentChoiceFor(task: { kpi_id?: unknown; tags?: readonly string[] | null } | null | undefined): string | undefined {
  if (!task) return undefined;
  if (hasKpi(task.kpi_id)) return String(task.kpi_id).trim();
  return isOperationalTask(task.tags) ? OPERATIONAL_KPI_CHOICE : undefined;
}

export type TriageAction = { kind: 'link'; kpiId: string } | { kind: 'operational' };

export interface TriageUpdate {
  kpi_id: string;
  kra_id?: string;
  tags: string[];
  revision?: string;
}

/**
 * The task fields a manager's clean-up action writes. Linking sets the KPI (the
 * service derives the matching KRA) and drops the operational tag; marking
 * operational clears both links and adds the tag. Other tags are kept, and the
 * loaded revision is sent so a task changed meanwhile is refused, not overwritten.
 */
export function triageUpdateFor(
  action: TriageAction,
  current: { tags?: readonly string[] | null; revision?: string },
): TriageUpdate {
  if (action.kind === 'link') {
    if (!hasKpi(action.kpiId)) throw new Error('Choose a KPI to link.');
    return { kpi_id: String(action.kpiId).trim(), tags: withOperationalTag(current.tags, false), revision: current.revision };
  }
  return { kpi_id: 'none', kra_id: 'none', tags: withOperationalTag(current.tags, true), revision: current.revision };
}

/**
 * New tasks must either link a KPI or be marked operational. Returns a message
 * for the form when the choice is missing, or null when the task may be saved.
 */
export function alignmentChoiceError(choice: string | undefined, isNewTask: boolean): string | null {
  if (!isNewTask) return null;
  if (choice === OPERATIONAL_KPI_CHOICE || hasKpi(choice)) return null;
  return 'Link this task to a KPI, or mark it as operational work.';
}
