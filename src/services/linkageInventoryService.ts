/**
 * Linkage inventory (rebuild Phase 0)
 *
 * Read-only count of how well each Unit's Tasks, KPIs, KRAs and Unit Objectives
 * are connected to the strategy chain:
 *
 *   Task → KPI → Performance KRA → Unit Objective → strategic parent
 *
 * The service is pure: it receives already-fetched list records and returns
 * counts plus a flat list of exception records. It never writes, repairs or
 * infers links, so the numbers describe the stored data exactly.
 *
 * Kept free of runtime imports so the Node test harness can load it directly.
 */

export interface InventoryTaskInput {
  id: string;
  title?: string;
  status?: string;
  unit_id?: string | null;
  kpi_id?: string | number | null;
  kra_id?: string | number | null;
}

export interface InventoryKpiInput {
  id: string;
  name?: string;
  kra_id?: string | number | null;
}

export interface InventoryKraInput {
  id: string;
  title?: string;
  unit?: string | null;
  division?: string | null;
  objective_id?: string | number | null;
}

export interface InventoryObjectiveInput {
  id: string;
  title?: string;
  goalType?: string | null;
  unit?: string | null;
  division?: string | null;
  parentGoalId?: string | number | null;
  linkedDeliverable?: string | null;
}

export interface LinkageInventoryInput {
  divisionName: string;
  /** Unit names known to belong to the division (from the staff roster). */
  unitNames: string[];
  tasks: InventoryTaskInput[];
  kpis: InventoryKpiInput[];
  kras: InventoryKraInput[];
  objectives: InventoryObjectiveInput[];
  generatedAt?: string;
}

export type TaskLinkageState =
  /** KPI, its KRA and that KRA's Objective all exist. */
  | 'traced'
  /** KPI exists but its KRA or Objective is missing. */
  | 'chain_incomplete'
  /** Linked to a KRA directly, with no KPI. */
  | 'kra_only'
  /** Points to a KPI/KRA that no longer exists or is retired. */
  | 'broken_link'
  /** No KPI and no KRA. */
  | 'unlinked';

export type InventoryIssueCode =
  | 'task_unlinked'
  | 'task_kra_only'
  | 'task_broken_kpi'
  | 'task_broken_kra'
  | 'task_chain_incomplete'
  | 'task_kra_conflict'
  | 'kpi_no_kra'
  | 'kpi_broken_kra'
  | 'kpi_no_tasks'
  | 'kra_no_objective'
  | 'kra_broken_objective'
  | 'kra_no_kpis'
  | 'objective_no_parent';

export type InventoryRecordType = 'task' | 'kpi' | 'kra' | 'objective';

export interface InventoryIssue {
  code: InventoryIssueCode;
  /** 'gap' needs a link; 'info' is worth reviewing but may be intentional. */
  severity: 'gap' | 'info';
  recordType: InventoryRecordType;
  recordId: string;
  title: string;
  unit: string;
  detail: string;
}

export interface UnitLinkageSummary {
  unit: string;
  tasks: {
    total: number;
    traced: number;
    chainIncomplete: number;
    kraOnly: number;
    brokenLink: number;
    unlinked: number;
    kraConflict: number;
  };
  kpis: { total: number; traced: number; noTasks: number };
  kras: { total: number; traced: number; noObjective: number; brokenObjective: number; noKpis: number };
  objectives: { total: number; noParent: number };
}

export interface LinkageInventory {
  divisionName: string;
  generatedAt: string;
  units: UnitLinkageSummary[];
  totals: UnitLinkageSummary;
  issues: InventoryIssue[];
  /**
   * KPIs with no resolvable KRA carry no unit or division of their own, so they
   * cannot be placed in any Division. Reported organisation-wide.
   */
  unplacedKpis: InventoryIssue[];
}

export const NO_UNIT_LABEL = 'No unit recorded';

const ISSUE_TEXT: Record<InventoryIssueCode, { severity: 'gap' | 'info'; detail: string }> = {
  task_unlinked: { severity: 'gap', detail: 'Task is not linked to any KPI or KRA.' },
  task_kra_only: { severity: 'gap', detail: 'Task is linked to a KRA but not to a KPI.' },
  task_broken_kpi: { severity: 'gap', detail: 'Task points to a KPI that no longer exists or is retired.' },
  task_broken_kra: { severity: 'gap', detail: 'Task points to a KRA that no longer exists or is retired.' },
  task_chain_incomplete: { severity: 'gap', detail: "Task's KPI does not trace up to a KRA and Objective." },
  task_kra_conflict: { severity: 'gap', detail: "Task's direct KRA differs from its KPI's KRA." },
  kpi_no_kra: { severity: 'gap', detail: 'KPI is not linked to a KRA.' },
  kpi_broken_kra: { severity: 'gap', detail: 'KPI points to a KRA that no longer exists or is retired.' },
  kpi_no_tasks: { severity: 'info', detail: 'No tasks are linked to this KPI yet.' },
  kra_no_objective: { severity: 'gap', detail: 'KRA is not linked to a Unit Objective.' },
  kra_broken_objective: { severity: 'gap', detail: 'KRA points to an Objective that no longer exists or is retired.' },
  kra_no_kpis: { severity: 'info', detail: 'KRA has no KPIs yet.' },
  objective_no_parent: { severity: 'gap', detail: 'Objective has no strategic parent goal or linked deliverable.' },
};

const clean = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());

/** Case-insensitive name key; "Legal Division" and "legal" compare equal. */
export function normalizeOrgName(value: unknown): string {
  return clean(value).toLowerCase().replace(/\s+/g, ' ').replace(/ division$/, '');
}

const isOrgLevelObjective = (objective: InventoryObjectiveInput): boolean => {
  const type = clean(objective.goalType).toLowerCase();
  return !type || type === 'org' || type === 'strategic' || type === 'board';
};

function emptySummary(unit: string): UnitLinkageSummary {
  return {
    unit,
    tasks: { total: 0, traced: 0, chainIncomplete: 0, kraOnly: 0, brokenLink: 0, unlinked: 0, kraConflict: 0 },
    kpis: { total: 0, traced: 0, noTasks: 0 },
    kras: { total: 0, traced: 0, noObjective: 0, brokenObjective: 0, noKpis: 0 },
    objectives: { total: 0, noParent: 0 },
  };
}

function addInto(target: Record<string, number>, source: Record<string, number>): void {
  for (const key of Object.keys(source)) target[key] = (target[key] || 0) + source[key];
}

/** Read access mirrors work-plan governance: admins everywhere, managers/directors in their own Division. */
export function canViewLinkageInventory(
  viewer: { role_name?: string | null; is_admin?: boolean | null; division_name?: string | null } | null | undefined,
  divisionName: string,
): boolean {
  if (!viewer || !normalizeOrgName(divisionName)) return false;
  const role = clean(viewer.role_name).toLowerCase();
  if (viewer.is_admin || role === 'admin' || role === 'super_admin') return true;
  return (role === 'manager' || role === 'director') &&
    normalizeOrgName(viewer.division_name) === normalizeOrgName(divisionName);
}

export function buildLinkageInventory(input: LinkageInventoryInput): LinkageInventory {
  const divisionKey = normalizeOrgName(input.divisionName);
  const unitKeys = new Map<string, string>();
  for (const name of input.unitNames) {
    const key = normalizeOrgName(name);
    if (key && !unitKeys.has(key)) unitKeys.set(key, clean(name));
  }

  const krasById = new Map(input.kras.map(kra => [clean(kra.id), kra]));
  const kpisById = new Map(input.kpis.map(kpi => [clean(kpi.id), kpi]));
  const objectivesById = new Map(input.objectives.map(objective => [clean(objective.id), objective]));

  const unitLabel = (raw: unknown): string => {
    const key = normalizeOrgName(raw);
    if (!key) return NO_UNIT_LABEL;
    return unitKeys.get(key) || clean(raw);
  };
  const inDivisionByOrg = (division: unknown, unit: unknown): boolean => {
    const divKey = normalizeOrgName(division);
    if (divKey) return divKey === divisionKey;
    return unitKeys.has(normalizeOrgName(unit));
  };
  const kraInDivision = (kra: InventoryKraInput | undefined): boolean => !!kra && inDivisionByOrg(kra.division, kra.unit);

  const summaries = new Map<string, UnitLinkageSummary>();
  for (const label of unitKeys.values()) summaries.set(label, emptySummary(label));
  const summaryFor = (unit: string): UnitLinkageSummary => {
    let summary = summaries.get(unit);
    if (!summary) {
      summary = emptySummary(unit);
      summaries.set(unit, summary);
    }
    return summary;
  };

  const issues: InventoryIssue[] = [];
  const pushIssue = (code: InventoryIssueCode, recordType: InventoryRecordType, recordId: string, title: string, unit: string) => {
    issues.push({ code, severity: ISSUE_TEXT[code].severity, recordType, recordId, title: title || '(untitled)', unit, detail: ISSUE_TEXT[code].detail });
  };

  // --- KRAs -----------------------------------------------------------------
  const kpiCountByKra = new Map<string, number>();
  for (const kpi of input.kpis) {
    const kraId = clean(kpi.kra_id);
    if (kraId) kpiCountByKra.set(kraId, (kpiCountByKra.get(kraId) || 0) + 1);
  }

  const kraTraced = (kra: InventoryKraInput | undefined): boolean =>
    !!kra && !!clean(kra.objective_id) && objectivesById.has(clean(kra.objective_id));

  for (const kra of input.kras) {
    if (!kraInDivision(kra)) continue;
    const id = clean(kra.id);
    const unit = unitLabel(kra.unit);
    const summary = summaryFor(unit);
    summary.kras.total += 1;
    const objectiveId = clean(kra.objective_id);
    if (!objectiveId) {
      summary.kras.noObjective += 1;
      pushIssue('kra_no_objective', 'kra', id, clean(kra.title), unit);
    } else if (!objectivesById.has(objectiveId)) {
      summary.kras.brokenObjective += 1;
      pushIssue('kra_broken_objective', 'kra', id, clean(kra.title), unit);
    } else {
      summary.kras.traced += 1;
    }
    if (!kpiCountByKra.get(id)) {
      summary.kras.noKpis += 1;
      pushIssue('kra_no_kpis', 'kra', id, clean(kra.title), unit);
    }
  }

  // --- KPIs -----------------------------------------------------------------
  const taskCountByKpi = new Map<string, number>();
  for (const task of input.tasks) {
    const kpiId = clean(task.kpi_id);
    if (kpiId) taskCountByKpi.set(kpiId, (taskCountByKpi.get(kpiId) || 0) + 1);
  }

  const unplacedKpis: InventoryIssue[] = [];
  for (const kpi of input.kpis) {
    const id = clean(kpi.id);
    const kraId = clean(kpi.kra_id);
    const kra = kraId ? krasById.get(kraId) : undefined;
    if (!kra) {
      // No resolvable KRA means no unit or division to place the KPI under.
      const code: InventoryIssueCode = kraId ? 'kpi_broken_kra' : 'kpi_no_kra';
      unplacedKpis.push({
        code, severity: 'gap', recordType: 'kpi', recordId: id, title: clean(kpi.name) || '(untitled)',
        unit: NO_UNIT_LABEL, detail: ISSUE_TEXT[code].detail,
      });
      continue;
    }
    if (!kraInDivision(kra)) continue;
    const unit = unitLabel(kra.unit);
    const summary = summaryFor(unit);
    summary.kpis.total += 1;
    if (kraTraced(kra)) summary.kpis.traced += 1;
    if (!taskCountByKpi.get(id)) {
      summary.kpis.noTasks += 1;
      pushIssue('kpi_no_tasks', 'kpi', id, clean(kpi.name), unit);
    }
  }

  // --- Tasks ----------------------------------------------------------------
  for (const task of input.tasks) {
    const id = clean(task.id);
    const kpiId = clean(task.kpi_id);
    const kraId = clean(task.kra_id);
    const kpi = kpiId ? kpisById.get(kpiId) : undefined;
    const directKra = kraId ? krasById.get(kraId) : undefined;
    const kpiKra = kpi && clean(kpi.kra_id) ? krasById.get(clean(kpi.kra_id)) : undefined;

    // A recorded unit decides the Division; without one, fall back to the linked KRA's Division.
    const taskUnitKey = normalizeOrgName(task.unit_id);
    const belongs = taskUnitKey ? unitKeys.has(taskUnitKey) : kraInDivision(kpiKra || directKra);
    if (!belongs) continue;

    const unit = unitLabel(task.unit_id);
    const summary = summaryFor(unit);
    const title = clean(task.title);
    summary.tasks.total += 1;

    let state: TaskLinkageState;
    if (kpiId && !kpi) {
      state = 'broken_link';
      pushIssue('task_broken_kpi', 'task', id, title, unit);
    } else if (kpi) {
      state = kraTraced(kpiKra) ? 'traced' : 'chain_incomplete';
      if (state === 'chain_incomplete') pushIssue('task_chain_incomplete', 'task', id, title, unit);
    } else if (kraId && !directKra) {
      state = 'broken_link';
      pushIssue('task_broken_kra', 'task', id, title, unit);
    } else if (directKra) {
      state = 'kra_only';
      pushIssue('task_kra_only', 'task', id, title, unit);
    } else {
      state = 'unlinked';
      pushIssue('task_unlinked', 'task', id, title, unit);
    }

    if (state === 'traced') summary.tasks.traced += 1;
    else if (state === 'chain_incomplete') summary.tasks.chainIncomplete += 1;
    else if (state === 'kra_only') summary.tasks.kraOnly += 1;
    else if (state === 'broken_link') summary.tasks.brokenLink += 1;
    else summary.tasks.unlinked += 1;

    if (kpi && kraId && clean(kpi.kra_id) && kraId !== clean(kpi.kra_id)) {
      summary.tasks.kraConflict += 1;
      pushIssue('task_kra_conflict', 'task', id, title, unit);
    }
  }

  // --- Unit Objectives --------------------------------------------------------
  for (const objective of input.objectives) {
    if (isOrgLevelObjective(objective)) continue;
    if (!inDivisionByOrg(objective.division, objective.unit)) continue;
    const unit = unitLabel(objective.unit);
    const summary = summaryFor(unit);
    summary.objectives.total += 1;
    if (!clean(objective.parentGoalId) && !clean(objective.linkedDeliverable)) {
      summary.objectives.noParent += 1;
      pushIssue('objective_no_parent', 'objective', clean(objective.id), clean(objective.title), unit);
    }
  }


  const units = Array.from(summaries.values()).sort((a, b) => {
    if (a.unit === NO_UNIT_LABEL) return 1;
    if (b.unit === NO_UNIT_LABEL) return -1;
    return a.unit.localeCompare(b.unit);
  });

  const totals = emptySummary('All units');
  for (const summary of units) {
    addInto(totals.tasks, summary.tasks);
    addInto(totals.kpis, summary.kpis);
    addInto(totals.kras, summary.kras);
    addInto(totals.objectives, summary.objectives);
  }


  return {
    divisionName: clean(input.divisionName),
    generatedAt: input.generatedAt || new Date().toISOString(),
    units,
    totals,
    issues,
    unplacedKpis,
  };
}

/** Share of tasks whose full chain resolves; null when the scope has no tasks. */
export function tracedTaskShare(summary: UnitLinkageSummary): number | null {
  if (summary.tasks.total === 0) return null;
  return Math.round((summary.tasks.traced / summary.tasks.total) * 100);
}

const csvCell = (value: unknown): string => {
  const text = clean(value);
  // Neutralise spreadsheet formula injection as well as quoting.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function linkageIssuesToCsv(inventory: LinkageInventory): string {
  const header = ['Division', 'Unit', 'Record type', 'Record ID', 'Title', 'Severity', 'Issue'];
  const rows = inventory.issues.map(issue => [
    inventory.divisionName, issue.unit, issue.recordType, issue.recordId, issue.title, issue.severity, issue.detail,
  ]);
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}
