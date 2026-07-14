/**
 * StrategyExecutionGraphService (Phase 3, role-recursive)
 *
 * ONE pure normalization + relationship layer for strategy execution. It receives
 * already-fetched records (it never fetches) and returns a `StrategyExecutionGraph`
 * that Strategy, Unit, Reports, and Analytics can all consume instead of each
 * rebuilding the cascade.
 *
 * MODEL (see docs/strategy-execution/PHASE-2-REVISION-role-based-cascade.md):
 * role-recursive with KRA/KPI duality. A single `PerformanceRecord` IS its owner's
 * KPI and, to the owner's manager, a KRA they assigned. The tree is built by
 * recursing `parentId`, rooted at Strategic Goals, with Tasks as leaf evidence:
 *
 *   Strategic Goal
 *   -> Org KRA        (= Director KPI)
 *   -> Manager KRA    (= Manager KPI)
 *   -> Officer KRA    (= Officer KPI)
 *   -> Task (evidence)
 *
 * The KRA/KPI label is never stored — derive it from viewer vs owner via
 * `performanceLabel()`.
 *
 * Interim: real data has no ownerRole/parentId columns yet, so
 * `legacyToPerformanceRecords()` maps the existing Unit_Objectives / Performance_KRAs
 * / Performance_KPIs lists into records with inferred role/parent. Delete the adapter
 * after the migration.
 *
 * Phase 4 replaces the progress internals at the `// Phase 4:` seams; the result
 * shape (`ProgressCalculationResult`) is stable.
 */

import type { Objective, Kra, Kpi, Task, StrategicGoal } from '@/types';
import type {
  StrategyExecutionGraph,
  StrategyExecutionLookups,
  StrategyGoalNode,
  PerformanceRecord,
  PerformanceNode,
  PerformanceRole,
  TaskNode,
  DivisionExecutionNode,
  UnitExecutionNode,
  LinkageDiagnostic,
  StrategyExecutionEntityType,
  ProgressScope,
  ProgressStatusBand,
  ProgressCalculationResult,
  ProgressCalculationSource,
} from '@/types/strategyExecution';
import { normalizeLookupString } from '@/utils/sharePointLookupUtils';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface GraphInput {
  scope?: ProgressScope;
  strategicGoals?: StrategicGoal[];
  /** Target model: pass unified records directly. */
  performanceRecords?: PerformanceRecord[];
  /** Legacy interim: adapter builds records from these when performanceRecords omitted. */
  unitObjectives?: Objective[];
  performanceKras?: Kra[];
  kpis?: Kpi[];
  tasks?: Task[];
  divisionStructure?: Record<string, string[]>;
}

export const UNLINKED_GOAL_ID = 'unlinked:goal';
const GENERAL_DIVISION = 'General';
const GENERAL_UNIT = 'General';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const key = (v: unknown): string | null => normalizeLookupString(v);
const idKey = (v: unknown): string => String(v ?? '');
const titleKey = (v: unknown): string => String(v ?? '').trim().toLowerCase();

function pushToIndex<T>(index: Map<string, T[]>, k: string | null, value: T) {
  if (!k) return;
  const arr = index.get(k);
  if (arr) arr.push(value);
  else index.set(k, [value]);
}

/** Preserve the legacy division/unit remap from Strategy.tsx:284-295. */
export function remapDivisionUnit(divisionRaw?: string, unitRaw?: string): { division: string; unit: string } {
  let division = (divisionRaw || '').trim();
  let unit = (unitRaw || '').trim();
  if (division === 'Executive Division') {
    division = 'Office of the Chairman';
    if (!unit || unit === 'General') unit = 'Executive Division';
  } else if (division === 'Secretariat Unit') {
    division = 'Office of the Chairman';
    unit = 'Secretariat Unit';
  }
  return { division, unit };
}

const roleToEntityType = (role?: PerformanceRole): StrategyExecutionEntityType =>
  role === 'officer' ? 'kpi' : 'performance_kra';

/**
 * Derive the KRA/KPI label from the viewer, never stored.
 * - viewer is the owner            -> "KPI" (my KPI)
 * - viewer created it (parent owner) -> "KRA" (a KRA I assigned)
 * - otherwise                       -> "KRA/KPI" (read-only)
 */
export function performanceLabel(
  node: PerformanceNode,
  viewerEmail?: string,
  parentNode?: PerformanceNode,
): 'KPI' | 'KRA' | 'KRA/KPI' {
  const v = (viewerEmail || '').trim().toLowerCase();
  if (v && node.ownerEmail && node.ownerEmail.trim().toLowerCase() === v) return 'KPI';
  if (v && parentNode?.ownerEmail && parentNode.ownerEmail.trim().toLowerCase() === v) return 'KRA';
  return 'KRA/KPI';
}

// ---------------------------------------------------------------------------
// Progress wrapping (Phase 4 replaces internals; result shape is stable)
// ---------------------------------------------------------------------------

function bandFor(value: number, hasLinkedData: boolean): ProgressStatusBand {
  if (!hasLinkedData) return 'no_linked_data';
  if (value <= 0) return 'not_started';
  if (value < 40) return 'behind_or_early';
  if (value < 75) return 'in_progress';
  if (value < 100) return 'on_track';
  return 'completed';
}

interface ProgressParams {
  value: number;
  hasLinkedData: boolean;
  source: ProgressCalculationSource;
  scope: ProgressScope;
  childCount: number;
  completedChildCount?: number;
  explanation: string;
  warnings?: string[];
  calculatedAt: string;
}

function makeProgress(p: ProgressParams): ProgressCalculationResult {
  const value = Math.max(0, Math.min(100, Math.round(p.value)));
  return {
    value,
    statusBand: bandFor(value, p.hasLinkedData),
    hasLinkedData: p.hasLinkedData,
    source: p.hasLinkedData ? p.source : 'no-linked-data',
    scope: p.scope,
    calculatedAt: p.calculatedAt,
    childCount: p.childCount,
    completedChildCount: p.completedChildCount,
    explanation: p.explanation,
    warnings: p.warnings && p.warnings.length ? p.warnings : undefined,
  };
}

/** Weighted (if child weights) or simple average of child node progress. */
function rollupChildren(
  children: PerformanceNode[],
  scope: ProgressScope,
  now: string,
  label: string,
): ProgressCalculationResult {
  const withValues = children.filter((c) => typeof c.progress?.value === 'number');
  if (withValues.length === 0) {
    return makeProgress({
      value: 0,
      hasLinkedData: false,
      source: 'no-linked-data',
      scope,
      childCount: children.length,
      explanation: `${label}: no linked child data`,
      calculatedAt: now,
    });
  }
  const totalWeight = withValues.reduce((s, c) => s + ((c as any)._weight || 0), 0);
  const completed = withValues.filter((c) => (c.progress?.value ?? 0) >= 100).length;
  if (totalWeight > 0) {
    const weighted = withValues.reduce((s, c) => s + (c.progress!.value) * ((c as any)._weight || 0), 0);
    return makeProgress({
      value: weighted / totalWeight,
      hasLinkedData: true,
      source: 'weighted',
      scope,
      childCount: children.length,
      completedChildCount: completed,
      explanation: `${label}: weighted average of ${withValues.length} children`,
      calculatedAt: now,
    });
  }
  const avg = withValues.reduce((s, c) => s + c.progress!.value, 0) / withValues.length;
  return makeProgress({
    value: avg,
    hasLinkedData: true,
    source: 'average',
    scope,
    childCount: children.length,
    completedChildCount: completed,
    explanation: `${label}: average of ${withValues.length} children`,
    calculatedAt: now,
  });
}

/** Average of arbitrary progress-bearing nodes (division/unit/goal rollups). */
function averageOf(
  nodes: { progress?: ProgressCalculationResult }[],
  scope: ProgressScope,
  now: string,
  label: string,
): ProgressCalculationResult {
  const values = nodes.map((n) => n.progress?.value).filter((v): v is number => typeof v === 'number');
  if (values.length === 0) {
    return makeProgress({
      value: 0,
      hasLinkedData: false,
      source: 'no-linked-data',
      scope,
      childCount: nodes.length,
      explanation: `${label}: no linked data`,
      calculatedAt: now,
    });
  }
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return makeProgress({
    value: avg,
    hasLinkedData: true,
    source: 'average',
    scope,
    childCount: nodes.length,
    completedChildCount: values.filter((v) => v >= 100).length,
    explanation: `${label}: average of ${values.length}`,
    calculatedAt: now,
  });
}

// ---------------------------------------------------------------------------
// Evidence / tasks
// ---------------------------------------------------------------------------

function isTaskComplete(task: Task): boolean {
  return task.completed === true || ['completed', 'done'].includes((task.status || '').toLowerCase());
}
function evidenceCountFor(task: Task): number {
  return (task.attachments?.length || 0) + (task.comments?.length || 0) + (isTaskComplete(task) ? 1 : 0);
}

/** Leaf progress for a record met by tasks / manual target (no child records). */
function leafProgress(
  record: PerformanceRecord,
  taskNodes: TaskNode[],
  scope: ProgressScope,
  now: string,
): ProgressCalculationResult {
  const status = (record.status || '').toLowerCase();
  if (['completed', 'achieved', 'done', 'closed'].includes(status)) {
    return makeProgress({
      value: 100,
      hasLinkedData: true,
      source: 'explicit-status',
      scope,
      childCount: taskNodes.length,
      completedChildCount: taskNodes.length,
      explanation: 'Marked completed',
      calculatedAt: now,
    });
  }
  const calc = record.calculationType;
  if (calc === 'task-completion' || (!calc && taskNodes.length > 0)) {
    if (taskNodes.length === 0) {
      return makeProgress({
        value: 0,
        hasLinkedData: false,
        source: 'no-linked-data',
        scope,
        childCount: 0,
        explanation: 'Task-completion KPI with no linked tasks',
        calculatedAt: now,
      });
    }
    const done = taskNodes.filter((t) => t.raw && isTaskComplete(t.raw)).length;
    return makeProgress({
      value: (done / taskNodes.length) * 100,
      hasLinkedData: true,
      source: 'task-completion',
      scope,
      childCount: taskNodes.length,
      completedChildCount: done,
      explanation: `${done}/${taskNodes.length} linked tasks complete`,
      calculatedAt: now,
    });
  }
  if (calc === 'manual' && (record.target || 0) > 0) {
    return makeProgress({
      value: ((record.actual || 0) / (record.target as number)) * 100,
      hasLinkedData: true,
      source: 'manual',
      scope,
      childCount: 0,
      explanation: 'Manual actual/target',
      calculatedAt: now,
    });
  }
  const stored = record.progress || 0;
  return makeProgress({
    value: stored,
    hasLinkedData: false,
    source: 'cached',
    scope,
    childCount: 0,
    explanation: stored > 0 ? 'Stored/cached progress (no linked children or tasks)' : 'No linked data',
    warnings: ['No linked children or tasks'],
    calculatedAt: now,
  });
}

// ---------------------------------------------------------------------------
// Legacy adapter (interim) — maps existing 3 lists to unified records.
// ID namespacing avoids collisions across lists (obj: / kra: / kpi:).
// ---------------------------------------------------------------------------

const nsObj = (id: unknown) => `obj:${idKey(id)}`;
const nsKra = (id: unknown) => `kra:${idKey(id)}`;
const nsKpi = (id: unknown) => `kpi:${idKey(id)}`;

function kpiLevelToRole(level?: string): PerformanceRole {
  if (level === 'director') return 'director';
  if (level === 'manager') return 'manager';
  return 'officer'; // 'staff' or undefined -> officer
}

export function legacyToPerformanceRecords(input: {
  unitObjectives?: Objective[];
  performanceKras?: Kra[];
  kpis?: Kpi[];
  strategicGoals?: StrategicGoal[];
}): PerformanceRecord[] {
  const goalsByTitle = new Map<string, string>();
  for (const g of input.strategicGoals || []) goalsByTitle.set(titleKey(g.title), idKey(g.id));

  const records: PerformanceRecord[] = [];

  // Objectives (goalType unit) -> director-level rung under a Strategic Goal.
  for (const o of input.unitObjectives || []) {
    if (['org', 'strategic', 'board'].includes((o.goalType || '').toLowerCase())) continue;
    const { division, unit } = remapDivisionUnit(o.division, o.unit);
    const goalId =
      key(o.parentGoalId) ??
      goalsByTitle.get(titleKey(o.linkedDeliverable)) ??
      goalsByTitle.get(titleKey(o.parentGoalTitle)) ??
      null;
    records.push({
      id: nsObj(o.id),
      title: o.title || 'Untitled Objective',
      ownerEmail: o.ownerEmail,
      ownerName: o.owner,
      ownerRole: 'director',
      parentId: null,
      parentStrategicGoalId: goalId,
      division,
      unit,
      status: o.status,
      progress: o.progress,
      sourceList: 'Unit_Objectives',
      rolesInferred: true,
    });
  }

  // Performance KRAs -> manager-level rung under an objective.
  for (const k of input.performanceKras || []) {
    const objId = key(k.objective_id) ?? key((k as any).objectiveId);
    records.push({
      id: nsKra(k.id),
      title: k.title || 'Untitled KRA',
      ownerName: k.owner?.name,
      ownerRole: 'manager',
      parentId: objId ? nsObj(objId) : null,
      unit: k.unit || undefined,
      status: k.status,
      progress: (k as any).progress,
      sourceList: 'Performance_KRAs',
      rolesInferred: true,
    });
  }

  // KPIs -> officer-level leaf under a KRA (met by tasks).
  for (const p of input.kpis || []) {
    const kraId = key(p.kra_id);
    records.push({
      id: nsKpi(p.id),
      title: p.name || 'Untitled KPI',
      ownerName: p.owner?.name,
      ownerRole: kpiLevelToRole(p.level),
      parentId: kraId ? nsKra(kraId) : null,
      calculationType: p.calculationType,
      target: p.target,
      actual: p.actual,
      weight: p.weight,
      status: p.status,
      progress: p.progress,
      sourceList: 'Performance_KPIs',
      rolesInferred: true,
    });
  }

  return records;
}

/**
 * Resolve the record id a task links to. Handles both the target model (raw
 * `kpi_id`/`kra_id` == record id) and the legacy adapter (namespaced `kpi:`/`kra:`),
 * picking whichever candidate actually exists as a record. KPI link preferred.
 */
function matchTaskRecordId(task: Task, recordIds: Set<string>): string | null {
  const candidates: string[] = [];
  const kpiId = key(task.kpi_id);
  if (kpiId) candidates.push(nsKpi(kpiId), kpiId);
  const kraId = key(task.kra_id);
  if (kraId) candidates.push(nsKra(kraId), kraId);
  return candidates.find((c) => recordIds.has(c)) ?? null;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildStrategyExecutionGraph(input: GraphInput): StrategyExecutionGraph {
  const scope: ProgressScope = input.scope ?? 'corporate';
  const now = new Date().toISOString();

  const records: PerformanceRecord[] =
    input.performanceRecords ??
    legacyToPerformanceRecords({
      unitObjectives: input.unitObjectives,
      performanceKras: input.performanceKras,
      kpis: input.kpis,
      strategicGoals: input.strategicGoals,
    });
  const strategicGoals = input.strategicGoals ?? [];
  const tasks = input.tasks ?? [];
  const divisionStructure = input.divisionStructure ?? {};

  const diagnostics: LinkageDiagnostic[] = [];
  const lookups: StrategyExecutionLookups = {
    goalsById: {},
    performanceRecordsById: {},
    tasksById: {},
    divisionsById: {},
    unitsById: {},
  };

  // Record id set (needed to resolve task links + detect broken parents).
  const recordIds = new Set(records.map((r) => r.id));

  // Index tasks by the record id they link to (raw or namespaced).
  const tasksByRecordId = new Map<string, Task[]>();
  for (const t of tasks) pushToIndex(tasksByRecordId, matchTaskRecordId(t, recordIds), t);

  const childrenByParent = new Map<string, PerformanceRecord[]>();
  for (const r of records) {
    const pid = key(r.parentId);
    if (pid) pushToIndex(childrenByParent, pid, r);
  }

  // All built nodes (for the division-first pass).
  const builtNodes: PerformanceNode[] = [];

  const buildTaskNode = (task: Task, parentRecordId: string): TaskNode => {
    const node: TaskNode = {
      id: idKey(task.id),
      title: task.title || 'Untitled Task',
      sourceList: 'Operations_Tasks',
      ownerName: task.assignee,
      ownerEmail: task.createdByEmail || task.authorEmail,
      parentKpiId: parentRecordId,
      status: task.status,
      dueDate: task.dueDate,
      completedAt: task.completedAt || task.completionDate,
      evidenceCount: evidenceCountFor(task),
      raw: task,
    };
    lookups.tasksById[node.id] = node;
    return node;
  };

  const buildNode = (
    record: PerformanceRecord,
    inheritedDivision: string,
    inheritedUnit: string,
  ): PerformanceNode => {
    const { division, unit } = remapDivisionUnit(
      record.division || inheritedDivision,
      record.unit || inheritedUnit,
    );
    const childRecords = childrenByParent.get(record.id) || [];
    const childNodes = childRecords.map((c) => buildNode(c, division, unit));
    const linkedTasks = tasksByRecordId.get(record.id) || [];
    const taskNodes = linkedTasks.map((t) => buildTaskNode(t, record.id));

    const progress =
      childNodes.length > 0
        ? rollupChildren(childNodes, scope, now, record.title)
        : leafProgress(record, taskNodes, scope, now);

    const node: PerformanceNode = {
      id: record.id,
      title: record.title,
      sourceList: record.sourceList || 'Performance_KRAs',
      ownerName: record.ownerName,
      ownerEmail: record.ownerEmail,
      ownerRole: record.ownerRole,
      parentId: key(record.parentId) ?? undefined,
      parentStrategicGoalId: key(record.parentStrategicGoalId) ?? undefined,
      division: division || GENERAL_DIVISION,
      unit: unit || GENERAL_UNIT,
      calculationType: record.calculationType,
      children: childNodes,
      tasks: taskNodes,
      rolesInferred: record.rolesInferred,
      progress,
    };
    // carry weight for parent weighted rollup (non-enumerable-ish helper field)
    (node as any)._weight = record.weight || 0;

    // Governance diagnostic: officers must not have child KRAs.
    if (record.ownerRole === 'officer' && childNodes.length > 0) {
      const d: LinkageDiagnostic = {
        id: `officer-with-children:${record.id}`,
        entityType: 'kpi',
        entityId: record.id,
        title: record.title,
        severity: 'warning',
        message: 'Unit Officer records must not have child KRAs (cascade stops at officer).',
        recommendedAction: 'Reassign the child records to a Manager, or reclassify the owner role.',
      };
      node.diagnostics = [d];
      diagnostics.push(d);
    }

    lookups.performanceRecordsById![node.id] = node;
    builtNodes.push(node);
    return node;
  };

  // --- Goals ---------------------------------------------------------------
  const goalNodes: StrategyGoalNode[] = [];
  const goalById = new Map<string, StrategyGoalNode>();
  for (const g of strategicGoals) {
    const node: StrategyGoalNode = {
      id: idKey(g.id),
      title: g.title || 'Untitled Goal',
      sourceList: 'Strategic_Goals',
      ownerName: g.owner,
      ownerEmail: g.ownerEmail,
      performanceRoots: [],
    };
    goalNodes.push(node);
    goalById.set(node.id, node);
    lookups.goalsById[node.id] = node;
  }

  let unlinkedGoal: StrategyGoalNode | null = null;
  const getUnlinkedGoal = (): StrategyGoalNode => {
    if (unlinkedGoal) return unlinkedGoal;
    unlinkedGoal = {
      id: UNLINKED_GOAL_ID,
      title: 'Unlinked (no Strategic Goal)',
      sourceList: 'synthetic',
      performanceRoots: [],
    };
    goalNodes.push(unlinkedGoal);
    lookups.goalsById[unlinkedGoal.id] = unlinkedGoal;
    return unlinkedGoal;
  };

  // --- Roots: records with no parent, or a parent that doesn't resolve ------
  const rootRecords = records.filter((r) => {
    const pid = key(r.parentId);
    return !pid || !recordIds.has(pid);
  });

  for (const record of rootRecords) {
    const node = buildNode(record, GENERAL_DIVISION, GENERAL_UNIT);
    const pid = key(record.parentId);
    if (pid && !recordIds.has(pid)) {
      const d: LinkageDiagnostic = {
        id: `broken-parent:${record.id}`,
        entityType: roleToEntityType(record.ownerRole),
        entityId: record.id,
        title: record.title,
        severity: 'warning',
        message: 'Parent record referenced by parentId was not found.',
        missingRelationship: 'parentId',
        recommendedAction: 'Fix or clear the parent link.',
      };
      node.diagnostics = [...(node.diagnostics || []), d];
      diagnostics.push(d);
    }
    const goalId = key(record.parentStrategicGoalId);
    const goal = goalId ? goalById.get(goalId) : undefined;
    if (goal) {
      goal.performanceRoots!.push(node);
    } else {
      getUnlinkedGoal().performanceRoots!.push(node);
      diagnostics.push({
        id: `record-without-goal:${record.id}`,
        entityType: roleToEntityType(record.ownerRole),
        entityId: record.id,
        title: record.title,
        severity: goalId ? 'warning' : 'info',
        message: goalId
          ? 'parentStrategicGoalId did not match any Strategic Goal.'
          : 'Top-level record is not linked to a Strategic Goal.',
        missingRelationship: 'parentStrategicGoalId',
        recommendedAction: 'Link this record to a Strategic Goal.',
      });
    }
  }

  // Goal progress rollup + empty-goal diagnostic.
  for (const goal of goalNodes) {
    goal.progress = averageOf(goal.performanceRoots || [], scope, now, `Goal ${goal.title}`);
    if ((goal.performanceRoots || []).length === 0 && goal.id !== UNLINKED_GOAL_ID) {
      diagnostics.push({
        id: `goal-without-kra:${goal.id}`,
        entityType: 'strategic_goal',
        entityId: goal.id,
        title: goal.title,
        severity: 'info',
        message: 'Strategic Goal has no Organisational KRAs.',
        missingRelationship: 'organisational_kras',
      });
    }
  }

  // --- Division-first view -------------------------------------------------
  const divisions: DivisionExecutionNode[] = [];
  const divisionByName = new Map<string, DivisionExecutionNode>();
  const unitByKey = new Map<string, UnitExecutionNode>();

  const getDivision = (name: string): DivisionExecutionNode => {
    const existing = divisionByName.get(name);
    if (existing) return existing;
    const node: DivisionExecutionNode = {
      id: `division:${name}`,
      title: name,
      sourceList: 'org-structure',
      units: [],
      performanceRecords: [],
    };
    divisionByName.set(name, node);
    divisions.push(node);
    lookups.divisionsById[node.id] = node;
    return node;
  };
  const getUnit = (division: DivisionExecutionNode, unitName: string): UnitExecutionNode => {
    const uKey = `${division.title}::${unitName}`;
    const existing = unitByKey.get(uKey);
    if (existing) return existing;
    const node: UnitExecutionNode = {
      id: `unit:${uKey}`,
      title: unitName,
      sourceList: 'org-structure',
      divisionId: division.id,
      divisionName: division.title,
      performanceRecords: [],
    };
    unitByKey.set(uKey, node);
    division.units.push(node);
    lookups.unitsById[node.id] = node;
    return node;
  };

  // Pre-seed known structure so empty divisions/units still render.
  for (const [div, units] of Object.entries(divisionStructure)) {
    const dNode = getDivision(div);
    for (const u of units) getUnit(dNode, u);
  }

  // Place every built node into its division/unit (flat), then roll up from the
  // "top-of-unit"/"top-of-division" nodes (those whose parent lives elsewhere).
  const parentDifferentUnit = (node: PerformanceNode): boolean => {
    if (!node.parentId) return true;
    const parent = lookups.performanceRecordsById![node.parentId];
    return !parent || parent.unit !== node.unit;
  };
  const parentDifferentDivision = (node: PerformanceNode): boolean => {
    if (!node.parentId) return true;
    const parent = lookups.performanceRecordsById![node.parentId];
    return !parent || parent.division !== node.division;
  };

  for (const node of builtNodes) {
    const dNode = getDivision(node.division || GENERAL_DIVISION);
    const uNode = getUnit(dNode, node.unit || GENERAL_UNIT);
    uNode.performanceRecords!.push(node);
    dNode.performanceRecords!.push(node);
  }

  for (const dNode of divisions) {
    for (const uNode of dNode.units) {
      const tops = (uNode.performanceRecords || []).filter(parentDifferentUnit);
      uNode.progress = averageOf(tops, scope, now, `Unit ${uNode.title}`);
      if ((uNode.performanceRecords || []).length === 0) {
        diagnostics.push({
          id: `unit-without-objectives:${uNode.id}`,
          entityType: 'unit',
          entityId: uNode.id,
          title: uNode.title,
          severity: 'info',
          message: `Unit "${uNode.title}" has no performance records.`,
          missingRelationship: 'performanceRecords',
        });
      }
    }
    const divTops = (dNode.performanceRecords || []).filter(parentDifferentDivision);
    dNode.progress = averageOf(divTops, scope, now, `Division ${dNode.title}`);
    if ((dNode.performanceRecords || []).length === 0) {
      diagnostics.push({
        id: `division-without-execution:${dNode.id}`,
        entityType: 'division',
        entityId: dNode.id,
        title: dNode.title,
        severity: 'info',
        message: `Division "${dNode.title}" has no execution data.`,
        missingRelationship: 'performanceRecords',
      });
    }
  }

  return { generatedAt: now, scope, goals: goalNodes, divisions, lookups, diagnostics };
}

// ---------------------------------------------------------------------------
// View selectors
// ---------------------------------------------------------------------------

export function selectStrategyFirst(graph: StrategyExecutionGraph): StrategyGoalNode[] {
  return graph.goals;
}
export function selectDivisionFirst(graph: StrategyExecutionGraph): DivisionExecutionNode[] {
  return graph.divisions;
}

export type DiagnosticSeverityFilter = LinkageDiagnostic['severity'];
const SEVERITY_ORDER: Record<DiagnosticSeverityFilter, number> = { info: 0, warning: 1, error: 2 };
export function selectDiagnostics(
  graph: StrategyExecutionGraph,
  minSeverity: DiagnosticSeverityFilter = 'info',
): LinkageDiagnostic[] {
  const min = SEVERITY_ORDER[minSeverity];
  return graph.diagnostics.filter((d) => SEVERITY_ORDER[d.severity] >= min);
}
