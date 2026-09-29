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
  ProgressMeasurementSummary,
  StrategyExecutionIntegritySummary,
} from '@/types/strategyExecution';
import { normalizeLookupString } from '@/utils/sharePointLookupUtils';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface GraphInput {
  scope?: ProgressScope;
  /** Required for personal/unit/division scope; omitted for corporate/audit. */
  scopeContext?: GraphScopeContext;
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

export interface GraphScopeContext {
  ownerEmail?: string;
  ownerName?: string;
  division?: string;
  unit?: string;
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
const emailKey = (v: unknown): string => String(v ?? '').trim().toLowerCase();

function sameText(left: unknown, right: unknown): boolean {
  const l = titleKey(left);
  const r = titleKey(right);
  return Boolean(l && r && l === r);
}

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
  measurement?: ProgressMeasurementSummary;
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
    measurement: p.measurement,
  };
}

/** Weighted (if child weights) or simple average of child node progress. */
function rollupChildren(
  children: PerformanceNode[],
  scope: ProgressScope,
  now: string,
  label: string,
): ProgressCalculationResult {
  const withValues = children.filter(
    (c) => c.progress?.hasLinkedData && typeof c.progress.value === 'number',
  );
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
  const values = nodes
    .filter((node) => node.progress?.hasLinkedData)
    .map((node) => node.progress?.value)
    .filter((value): value is number => typeof value === 'number');
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

function specializedEvidenceCount(record: PerformanceRecord): number {
  const evidence = record.measurementEvidence;
  if (!evidence) return 0;
  return Math.max(1, (evidence.evidenceRefs?.length || 0) +
    (evidence.observations?.length || 0) +
    (evidence.milestones?.length || 0));
}

function specializedMeasurementProgress(
  record: PerformanceRecord,
  taskNodes: TaskNode[],
  scope: ProgressScope,
  now: string,
): ProgressCalculationResult | null {
  const definition = record.measurementDefinition;
  if (!definition) return null;
  const evidence = record.measurementEvidence;
  const base: ProgressMeasurementSummary = {
    mode: definition.mode,
    rawTarget: definition.rawTarget,
    operator: definition.operator,
    target: definition.target,
    unit: definition.unit,
    population: definition.population,
    frequency: definition.frequency,
    serviceLevel: definition.serviceLevel,
    windowStart: evidence?.windowStart,
    windowEnd: evidence?.windowEnd,
    asOf: evidence?.asOf,
    evidenceCount: specializedEvidenceCount(record),
    state: 'calculated',
  };
  const taskWarning = taskNodes.length > 0
    ? ['Linked Tasks are supporting records only; their Done status is not specialized measurement evidence.']
    : [];
  const missing = (reason: string, warnings: string[] = []): ProgressCalculationResult => makeProgress({
    value: 0,
    hasLinkedData: false,
    source: 'specialized-measurement',
    scope,
    childCount: 0,
    explanation: reason,
    warnings: [...warnings, ...taskWarning],
    measurement: { ...base, state: 'missing-evidence' },
    calculatedAt: now,
  });
  const invalid = (reason: string): ProgressCalculationResult => makeProgress({
    value: 0,
    hasLinkedData: false,
    source: 'specialized-measurement',
    scope,
    childCount: 0,
    explanation: reason,
    warnings: [reason, ...taskWarning],
    measurement: { ...base, state: 'invalid' },
    calculatedAt: now,
  });
  const calculated = (
    value: number,
    explanation: string,
    summary: Partial<ProgressMeasurementSummary>,
    warnings: string[] = [],
  ): ProgressCalculationResult => makeProgress({
    value,
    hasLinkedData: true,
    source: 'specialized-measurement',
    scope,
    childCount: summary.denominator ?? base.evidenceCount,
    completedChildCount: summary.numerator,
    explanation,
    warnings: [...warnings, ...taskWarning],
    measurement: { ...base, ...summary, state: 'calculated' },
    calculatedAt: now,
  });
  const finiteNonNegative = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0;

  if (!definition.rawTarget?.trim()) return invalid('Specialized measurement must preserve the original target wording.');
  if (!evidence) return missing('Specialized measurement has no dated evidence.');
  if (!evidence.windowStart || !evidence.windowEnd || !evidence.asOf) {
    return missing('Specialized measurement evidence requires a reporting window and as-of date.');
  }
  const windowStart = Date.parse(evidence.windowStart);
  const windowEnd = Date.parse(evidence.windowEnd);
  const asOf = Date.parse(evidence.asOf);
  if (![windowStart, windowEnd, asOf].every(Number.isFinite) || windowStart > windowEnd || asOf < windowStart) {
    return invalid('Specialized measurement evidence has an invalid reporting window or as-of date.');
  }

  if (definition.mode === 'count' || definition.mode === 'percentage') {
    const target = definition.target;
    const actual = evidence.actual;
    if (!finiteNonNegative(target) || target <= 0) return invalid('Specialized measurement requires a positive numeric target.');
    if (!finiteNonNegative(actual)) return missing('Specialized measurement has no recorded actual value.');
    const lowerIsBetter = definition.operator === 'at-most';
    const targetMet = lowerIsBetter ? actual <= target : actual >= target;
    const progress = lowerIsBetter
      ? (actual <= target ? 100 : (target / actual) * 100)
      : (actual / target) * 100;
    return calculated(progress, `${actual}/${target} ${definition.unit || definition.mode}`, {
      target,
      actual,
      targetMet,
      evidenceCount: Math.max(base.evidenceCount, 1),
    });
  }

  if (definition.mode === 'population' || definition.mode === 'service-level') {
    const denominator = evidence?.eligibleCount;
    const numerator = evidence?.compliantCount;
    const target = definition.target;
    if (!finiteNonNegative(target) || target <= 0 || target > 100) {
      return invalid('Population and service-level measurements require an explicit target percentage from 0 to 100.');
    }
    if (!finiteNonNegative(denominator) || denominator === 0) {
      return missing('No eligible population was recorded for this reporting window.', ['Zero eligible cases are not treated as 100% attainment.']);
    }
    if (!finiteNonNegative(numerator) || numerator > denominator) {
      return invalid('Compliant/covered evidence must be between zero and the eligible population.');
    }
    const actual = (numerator / denominator) * 100;
    return calculated((actual / target) * 100, `${numerator}/${denominator} eligible cases met the measure (${actual.toFixed(1)}% against ${target}%)`, {
      target,
      actual,
      numerator,
      denominator,
      targetMet: actual >= target,
      evidenceCount: Math.max(base.evidenceCount, denominator),
    });
  }

  if (definition.mode === 'duration-at-most') {
    const target = definition.timeAllowance?.value ?? definition.target;
    if (!finiteNonNegative(target) || target <= 0) return invalid('At-most duration measurement requires a positive time allowance.');
    const observations = evidence?.observations || [];
    if (observations.length > 0) {
      if (observations.some((item) => !finiteNonNegative(item.value))) return invalid('Duration observations must be finite non-negative numbers.');
      const numerator = observations.filter((item) => item.value <= target).length;
      const denominator = observations.length;
      const actual = observations.reduce((sum, item) => sum + item.value, 0) / denominator;
      return calculated((numerator / denominator) * 100, `${numerator}/${denominator} observations met the at-most ${target} ${definition.timeAllowance?.unit || definition.unit || 'time-unit'} standard`, {
        target,
        actual,
        numerator,
        denominator,
        targetMet: numerator === denominator,
        evidenceCount: Math.max(base.evidenceCount, denominator),
      });
    }
    const actual = evidence?.actual;
    if (!finiteNonNegative(actual)) return missing('At-most duration measurement has no observations.');
    return calculated(actual <= target ? 100 : 0, `Observed duration ${actual} against at-most ${target}`, {
      target,
      actual,
      targetMet: actual <= target,
      evidenceCount: Math.max(base.evidenceCount, 1),
    });
  }

  if (definition.mode === 'recurrence' || definition.mode === 'continuous' || definition.mode === 'as-required') {
    const denominator = evidence?.expectedOccurrences ?? definition.target;
    const numerator = evidence?.completedOccurrences;
    if (!finiteNonNegative(denominator) || denominator === 0) {
      return missing('No required occurrences were recorded for this reporting window.', ['Zero scheduled or demanded occurrences are not treated as 100% attainment.']);
    }
    if (!finiteNonNegative(numerator) || numerator > denominator) {
      return invalid('Completed occurrences must be between zero and the required occurrences.');
    }
    return calculated((numerator / denominator) * 100, `${numerator}/${denominator} required occurrences completed`, {
      target: denominator,
      actual: numerator,
      numerator,
      denominator,
      targetMet: numerator >= denominator,
      evidenceCount: Math.max(base.evidenceCount, numerator),
    });
  }

  if (definition.mode === 'milestone') {
    const milestones = evidence?.milestones || [];
    if (milestones.length === 0) return missing('Milestone measurement has no milestone evidence.');
    const invalidWeight = milestones.some((item) => item.weight !== undefined && (!finiteNonNegative(item.weight) || item.weight === 0));
    if (invalidWeight) return invalid('Milestone weights must be positive finite numbers.');
    const hasWeights = milestones.some((item) => item.weight !== undefined);
    const denominator = hasWeights ? milestones.reduce((sum, item) => sum + (item.weight || 0), 0) : milestones.length;
    if (denominator <= 0) return invalid('Milestone evidence has no usable denominator.');
    const numerator = hasWeights
      ? milestones.reduce((sum, item) => sum + (item.completed ? (item.weight || 0) : 0), 0)
      : milestones.filter((item) => item.completed).length;
    const overdue = milestones.filter((item) => !item.completed && item.dueDate && Date.parse(item.dueDate) < Date.parse(now)).length;
    return calculated((numerator / denominator) * 100, `${milestones.filter((item) => item.completed).length}/${milestones.length} milestones completed`, {
      numerator,
      denominator,
      targetMet: milestones.every((item) => item.completed),
      evidenceCount: Math.max(base.evidenceCount, milestones.length),
    }, overdue ? [`${overdue} incomplete milestone${overdue === 1 ? '' : 's'} past due.`] : []);
  }

  return invalid(`Unsupported specialized measurement mode: ${String((definition as any).mode)}`);
}

/** Leaf progress for a record met by tasks / manual target (no child records). */
function leafProgress(
  record: PerformanceRecord,
  taskNodes: TaskNode[],
  scope: ProgressScope,
  now: string,
): ProgressCalculationResult {
  const specialized = specializedMeasurementProgress(record, taskNodes, scope, now);
  if (specialized) return specialized;
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
  if (calc === 'checklist') {
    const checklist = record.checklist || [];
    if (checklist.length === 0) {
      return makeProgress({
        value: 0,
        hasLinkedData: false,
        source: 'no-linked-data',
        scope,
        childCount: 0,
        explanation: 'Checklist KPI with no checklist items',
        calculatedAt: now,
      });
    }
    const complete = checklist.filter((item) => item.checked).length;
    return makeProgress({
      value: (complete / checklist.length) * 100,
      hasLinkedData: true,
      source: 'checklist',
      scope,
      childCount: checklist.length,
      completedChildCount: complete,
      explanation: `${complete}/${checklist.length} checklist items complete`,
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
      ownerEmail: k.owner?.email || k.assignees?.[0]?.email,
      ownerRole: 'manager',
      parentId: objId ? nsObj(objId) : null,
      assignedByEmail: k.createdByEmail,
      division: k.department || undefined,
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
      ownerEmail: p.owner?.email || p.assignees?.[0]?.email,
      ownerRole: kpiLevelToRole(p.level),
      parentId: kraId ? nsKra(kraId) : null,
      calculationType: p.calculationType,
      checklist: p.checklist,
      measurementDefinition: p.measurementDefinition,
      measurementEvidence: p.measurementEvidence,
      dataSource: p.dataSource,
      reportingFrequency: p.reportingFrequency,
      reviewAuthority: p.reviewAuthority,
      reviewStatus: p.reviewStatus,
      reviewNote: p.reviewNote,
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
function taskRecordCandidates(task: Task): string[] {
  const candidates: string[] = [];
  const kpiId = key(task.kpi_id);
  if (kpiId) candidates.push(nsKpi(kpiId), kpiId);
  const kraId = key(task.kra_id);
  if (kraId) candidates.push(nsKra(kraId), kraId);
  return [...new Set(candidates)];
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

interface PreparedRecord {
  raw: PerformanceRecord;
  index: number;
  sourceId: string;
  graphId: string;
  parentSourceId: string | null;
  parentGraphId: string | null;
  duplicate: boolean;
  missingId: boolean;
  cycleId?: string;
  division: string;
  unit: string;
}

interface PreparedTask {
  raw: Task;
  index: number;
  sourceId: string;
  graphId: string;
  duplicate: boolean;
  missingId: boolean;
  linkedRecordId: string | null;
}

function duplicateGraphId(kind: 'goal' | 'performance' | 'task', sourceId: string, index: number): string {
  return `duplicate:${kind}:${sourceId}:${index + 1}`;
}

function taskMatchesPerson(task: Task, context?: GraphScopeContext): boolean {
  const email = emailKey(context?.ownerEmail);
  const name = titleKey(context?.ownerName);
  if (!email && !name) return false;
  const assigneeEmails = task.assignees?.map((person) => emailKey(person.email)) || [];
  const assigneeNames = task.assignees?.map((person) => titleKey(person.name)) || [];
  return Boolean(
    (email && [emailKey(task.createdByEmail), emailKey(task.authorEmail), emailKey(task.assignedTo), ...assigneeEmails].includes(email)) ||
      (name && [titleKey(task.assignee), ...assigneeNames].includes(name)),
  );
}

export function buildStrategyExecutionGraph(input: GraphInput): StrategyExecutionGraph {
  const scope: ProgressScope = input.scope ?? 'corporate';
  const now = new Date().toISOString();

  const rawRecords: PerformanceRecord[] =
    input.performanceRecords ??
    legacyToPerformanceRecords({
      unitObjectives: input.unitObjectives,
      performanceKras: input.performanceKras,
      kpis: input.kpis,
      strategicGoals: input.strategicGoals,
    });
  const strategicGoals = input.strategicGoals ?? [];
  const rawTasks = input.tasks ?? [];
  const divisionStructure = input.divisionStructure ?? {};

  const diagnostics: LinkageDiagnostic[] = [];
  const diagnosticsByGraphId = new Map<string, LinkageDiagnostic[]>();
  const addDiagnostic = (diagnostic: LinkageDiagnostic, graphId?: string) => {
    diagnostics.push(diagnostic);
    if (!graphId) return;
    const existing = diagnosticsByGraphId.get(graphId);
    if (existing) existing.push(diagnostic);
    else diagnosticsByGraphId.set(graphId, [diagnostic]);
  };
  const lookups: StrategyExecutionLookups = {
    goalsById: {},
    performanceRecordsById: {},
    tasksById: {},
    divisionsById: {},
    unitsById: {},
  };

  // Prepare Strategic Goals without allowing duplicate or missing source IDs to
  // overwrite each other in the lookup.
  const goalIdCounts = new Map<string, number>();
  for (const goal of strategicGoals) {
    const sourceId = key(goal.id);
    if (sourceId) goalIdCounts.set(sourceId, (goalIdCounts.get(sourceId) || 0) + 1);
  }
  const uniqueGoalGraphIdBySource = new Map<string, string>();
  const goalNodes: StrategyGoalNode[] = [];
  const goalByGraphId = new Map<string, StrategyGoalNode>();
  strategicGoals.forEach((goal, index) => {
    const normalizedId = key(goal.id);
    const sourceId = normalizedId || `missing:goal:${index + 1}`;
    const duplicate = Boolean(normalizedId && (goalIdCounts.get(normalizedId) || 0) > 1);
    const graphId = duplicate ? duplicateGraphId('goal', sourceId, index) : sourceId;
    const node: StrategyGoalNode = {
      id: graphId,
      sourceId,
      title: goal.title || 'Untitled Goal',
      sourceList: 'Strategic_Goals',
      ownerName: goal.owner,
      ownerEmail: goal.ownerEmail,
      performanceRoots: [],
    };
    goalNodes.push(node);
    goalByGraphId.set(graphId, node);
    lookups.goalsById[graphId] = node;
    if (normalizedId && !duplicate) uniqueGoalGraphIdBySource.set(normalizedId, graphId);
    if (!normalizedId || duplicate) {
      const issue = !normalizedId ? 'missing' : 'duplicate';
      addDiagnostic({
        id: `${issue}-goal-id:${graphId}`,
        entityType: 'strategic_goal',
        entityId: sourceId,
        title: node.title,
        severity: 'error',
        message: !normalizedId
          ? 'Strategic Goal has no stable source ID.'
          : `Strategic Goal ID "${sourceId}" occurs more than once; its child links are ambiguous.`,
        recommendedAction: 'Assign a unique stable ID before relying on this goal in reporting.',
      }, graphId);
    }
  });

  // Prepare every performance record. Duplicate records are quarantined under
  // unique graph IDs; no input row is silently overwritten.
  const recordIdCounts = new Map<string, number>();
  for (const record of rawRecords) {
    const sourceId = key(record.id);
    if (sourceId) recordIdCounts.set(sourceId, (recordIdCounts.get(sourceId) || 0) + 1);
  }
  const records: PreparedRecord[] = rawRecords.map((raw, index) => {
    const normalizedId = key(raw.id);
    const sourceId = normalizedId || `missing:performance:${index + 1}`;
    const duplicate = Boolean(normalizedId && (recordIdCounts.get(normalizedId) || 0) > 1);
    return {
      raw,
      index,
      sourceId,
      graphId: duplicate ? duplicateGraphId('performance', sourceId, index) : sourceId,
      parentSourceId: key(raw.parentId),
      parentGraphId: null,
      duplicate,
      missingId: !normalizedId,
      division: '',
      unit: '',
    };
  });
  const uniqueRecordBySource = new Map<string, PreparedRecord>();
  for (const record of records) {
    if (!record.duplicate && !record.missingId) uniqueRecordBySource.set(record.sourceId, record);
  }
  for (const record of records) {
    record.parentGraphId = record.parentSourceId
      ? uniqueRecordBySource.get(record.parentSourceId)?.graphId || null
      : null;
  }

  // Detect every parent cycle before recursion. Break one deterministic edge in
  // each cycle for rendering, while retaining the original parent in diagnostics.
  const recordByGraphId = new Map(records.map((record) => [record.graphId, record]));
  const visitState = new Map<string, 0 | 1 | 2>();
  const visitStack: string[] = [];
  const cycles = new Map<string, string[]>();
  const visitForCycles = (record: PreparedRecord) => {
    const state = visitState.get(record.graphId) || 0;
    if (state === 2) return;
    if (state === 1) {
      const start = visitStack.lastIndexOf(record.graphId);
      const members = visitStack.slice(start);
      const signature = [...members].sort().join('|');
      if (members.length) cycles.set(signature, members);
      return;
    }
    visitState.set(record.graphId, 1);
    visitStack.push(record.graphId);
    if (record.parentGraphId) {
      const parent = recordByGraphId.get(record.parentGraphId);
      if (parent) visitForCycles(parent);
    }
    visitStack.pop();
    visitState.set(record.graphId, 2);
  };
  records.forEach(visitForCycles);
  for (const [signature, members] of cycles) {
    const cycleId = `parent-cycle:${signature}`;
    for (const memberId of members) recordByGraphId.get(memberId)!.cycleId = cycleId;
    const anchor = [...members].sort()[0];
    recordByGraphId.get(anchor)!.parentGraphId = null;
  }

  // Resolve effective location after cycle edges are safe. Blank child fields
  // inherit from their parent so unit/division scope works for legacy rows.
  const locationState = new Set<string>();
  const resolveLocation = (record: PreparedRecord): { division: string; unit: string } => {
    if (record.division || record.unit) return { division: record.division, unit: record.unit };
    if (locationState.has(record.graphId)) return remapDivisionUnit(record.raw.division, record.raw.unit);
    locationState.add(record.graphId);
    const parent = record.parentGraphId ? recordByGraphId.get(record.parentGraphId) : undefined;
    const inherited = parent ? resolveLocation(parent) : { division: '', unit: '' };
    const resolved = remapDivisionUnit(
      record.raw.division || inherited.division,
      record.raw.unit || inherited.unit,
    );
    record.division = resolved.division;
    record.unit = resolved.unit;
    locationState.delete(record.graphId);
    return resolved;
  };
  records.forEach(resolveLocation);

  // Enforce active scope in the pure service. Scoped graphs retain matching
  // records plus their ancestors for traceability; unrelated rows are excluded.
  const context = input.scopeContext;
  const requiredScopeValueMissing =
    (scope === 'personal' && !emailKey(context?.ownerEmail) && !titleKey(context?.ownerName)) ||
    (scope === 'unit' && !titleKey(context?.unit)) ||
    (scope === 'division' && !titleKey(context?.division));
  if (requiredScopeValueMissing) {
    addDiagnostic({
      id: `scope-context-missing:${scope}`,
      entityType: 'report',
      entityId: scope,
      severity: 'error',
      message: `${scope} scope requires an explicit matching context; corporate data was not substituted.`,
      recommendedAction: 'Provide the current owner, unit or division when building the graph.',
    });
  }
  const directlyInScope = new Set<string>();
  if (!requiredScopeValueMissing) {
    for (const record of records) {
      let matches = scope === 'corporate' || scope === 'audit';
      if (scope === 'personal') {
        matches = Boolean(
          (emailKey(context?.ownerEmail) &&
            [emailKey(record.raw.ownerEmail), emailKey(record.raw.assignedByEmail)].includes(emailKey(context?.ownerEmail))) ||
            (titleKey(context?.ownerName) && sameText(record.raw.ownerName, context?.ownerName)),
        );
      } else if (scope === 'unit') {
        matches = sameText(record.unit, context?.unit) &&
          (!context?.division || sameText(record.division, context.division));
      } else if (scope === 'division') {
        matches = sameText(record.division, context?.division);
      }
      if (matches) directlyInScope.add(record.graphId);
    }
  }
  const includedRecordIds = new Set(directlyInScope);
  for (const graphId of [...directlyInScope]) {
    let parentId = recordByGraphId.get(graphId)?.parentGraphId || null;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      includedRecordIds.add(parentId);
      parentId = recordByGraphId.get(parentId)?.parentGraphId || null;
    }
  }
  const includedRecords = records.filter((record) => includedRecordIds.has(record.graphId));

  // Add record-integrity diagnostics only for the active scope.
  const roleRank: Record<PerformanceRole, number> = { director: 0, manager: 1, officer: 2 };
  const normalizedStructure = new Map(
    Object.entries(divisionStructure).map(([division, units]) => [titleKey(division), new Set(units.map(titleKey))]),
  );
  for (const record of includedRecords) {
    if (record.missingId || record.duplicate) {
      addDiagnostic({
        id: `${record.missingId ? 'missing' : 'duplicate'}-record-id:${record.graphId}`,
        entityType: roleToEntityType(record.raw.ownerRole),
        entityId: record.sourceId,
        title: record.raw.title,
        severity: 'error',
        message: record.missingId
          ? 'Performance record has no stable source ID.'
          : `Performance record ID "${record.sourceId}" occurs more than once and was quarantined.`,
        recommendedAction: 'Assign a unique stable ID and then repair its parent link.',
      }, record.graphId);
    }
    if (record.parentSourceId && !record.parentGraphId && !record.cycleId) {
      const ambiguous = (recordIdCounts.get(record.parentSourceId) || 0) > 1;
      addDiagnostic({
        id: `${ambiguous ? 'ambiguous' : 'broken'}-parent:${record.graphId}`,
        entityType: roleToEntityType(record.raw.ownerRole),
        entityId: record.sourceId,
        title: record.raw.title,
        severity: ambiguous ? 'error' : 'warning',
        message: ambiguous
          ? 'parentId matches duplicate records and cannot be resolved safely.'
          : 'Parent record referenced by parentId was not found.',
        missingRelationship: 'parentId',
        parentEntityId: record.parentSourceId,
        recommendedAction: 'Repair the parent link after resolving duplicate or missing records.',
      }, record.graphId);
    }
    if (record.cycleId) {
      addDiagnostic({
        id: `${record.cycleId}:${record.graphId}`,
        entityType: roleToEntityType(record.raw.ownerRole),
        entityId: record.sourceId,
        title: record.raw.title,
        severity: 'error',
        message: 'Performance parent links form a cycle. One edge was quarantined so every record remains visible.',
        missingRelationship: 'acyclic parentId',
        parentEntityId: record.parentSourceId || undefined,
        recommendedAction: 'Choose the correct top record and repair the cyclic parent link.',
      }, record.graphId);
    }
    const parent = record.parentGraphId ? recordByGraphId.get(record.parentGraphId) : undefined;
    if (parent?.raw.ownerRole && record.raw.ownerRole &&
        roleRank[record.raw.ownerRole] !== roleRank[parent.raw.ownerRole] + 1) {
      addDiagnostic({
        id: `role-scope-mismatch:${record.graphId}`,
        entityType: roleToEntityType(record.raw.ownerRole),
        entityId: record.sourceId,
        title: record.raw.title,
        severity: 'warning',
        message: `Owner role ${record.raw.ownerRole} is not directly below parent role ${parent.raw.ownerRole}.`,
        parentEntityId: parent.sourceId,
        recommendedAction: 'Verify the owner role and parent assignment.',
      }, record.graphId);
    }
    if (parent?.raw.ownerEmail && record.raw.assignedByEmail &&
        emailKey(parent.raw.ownerEmail) !== emailKey(record.raw.assignedByEmail)) {
      addDiagnostic({
        id: `owner-scope-mismatch:${record.graphId}`,
        entityType: roleToEntityType(record.raw.ownerRole),
        entityId: record.sourceId,
        title: record.raw.title,
        severity: 'warning',
        message: 'assignedByEmail does not match the parent record owner.',
        parentEntityId: parent.sourceId,
        recommendedAction: 'Verify ownership and assignment provenance.',
      }, record.graphId);
    }
    const allowedUnits = normalizedStructure.get(titleKey(record.division));
    if (allowedUnits && record.unit && record.unit !== GENERAL_UNIT && !allowedUnits.has(titleKey(record.unit))) {
      addDiagnostic({
        id: `organisation-scope-mismatch:${record.graphId}`,
        entityType: roleToEntityType(record.raw.ownerRole),
        entityId: record.sourceId,
        title: record.raw.title,
        severity: 'warning',
        message: `Unit "${record.unit}" is not configured under division "${record.division}".`,
        recommendedAction: 'Correct the record scope or update the canonical division structure.',
      }, record.graphId);
    }
  }

  // Prepare and resolve Tasks. Dual links are diagnosed and reduced to one
  // canonical parent; unresolvable Tasks remain in the exception collection.
  const taskIdCounts = new Map<string, number>();
  for (const task of rawTasks) {
    const sourceId = key(task.id);
    if (sourceId) taskIdCounts.set(sourceId, (taskIdCounts.get(sourceId) || 0) + 1);
  }
  const resolvedTaskLinks = rawTasks.map((task) => {
    const candidates = taskRecordCandidates(task);
    const matches: PreparedRecord[] = [];
    const ambiguousSources: string[] = [];
    for (const candidate of candidates) {
      const count = recordIdCounts.get(candidate) || 0;
      if (count > 1) ambiguousSources.push(candidate);
      const match = uniqueRecordBySource.get(candidate);
      if (match && !matches.some((item) => item.graphId === match.graphId)) matches.push(match);
    }
    return { task, matches, ambiguousSources };
  });
  const preparedTasks: PreparedTask[] = rawTasks.map((raw, index) => {
    const normalizedId = key(raw.id);
    const sourceId = normalizedId || `missing:task:${index + 1}`;
    const duplicate = Boolean(normalizedId && (taskIdCounts.get(normalizedId) || 0) > 1);
    const link = resolvedTaskLinks[index];
    const preferred = link.matches.find((record) => includedRecordIds.has(record.graphId)) || link.matches[0];
    return {
      raw,
      index,
      sourceId,
      graphId: duplicate ? duplicateGraphId('task', sourceId, index) : sourceId,
      duplicate,
      missingId: !normalizedId,
      linkedRecordId: preferred?.graphId || null,
    };
  });
  const includedTasks = preparedTasks.filter((task, index) => {
    if (scope === 'corporate' || scope === 'audit') return true;
    const linkedIncluded = Boolean(task.linkedRecordId && includedRecordIds.has(task.linkedRecordId));
    if (scope === 'personal') return linkedIncluded || taskMatchesPerson(task.raw, context);
    if (scope === 'unit') return linkedIncluded || sameText(task.raw.unit_id, context?.unit);
    return linkedIncluded;
  });
  const tasksByRecordId = new Map<string, PreparedTask[]>();
  const orphanTasks: PreparedTask[] = [];
  for (const task of includedTasks) {
    const link = resolvedTaskLinks[task.index];
    if (task.missingId || task.duplicate) {
      addDiagnostic({
        id: `${task.missingId ? 'missing' : 'duplicate'}-task-id:${task.graphId}`,
        entityType: 'task',
        entityId: task.sourceId,
        title: task.raw.title,
        severity: 'error',
        message: task.missingId
          ? 'Task has no stable source ID.'
          : `Task ID "${task.sourceId}" occurs more than once and was kept under a quarantined graph ID.`,
        recommendedAction: 'Assign a unique stable ID before using this Task as evidence.',
      }, task.graphId);
    }
    if (link.matches.length > 1) {
      addDiagnostic({
        id: `duplicate-task-links:${task.graphId}`,
        entityType: 'task',
        entityId: task.sourceId,
        title: task.raw.title,
        severity: 'warning',
        message: 'Task resolves to more than one performance parent; the KPI link was preferred once.',
        parentEntityId: task.linkedRecordId || undefined,
        recommendedAction: 'Remove the stale secondary link after confirming the intended KPI.',
      }, task.graphId);
    }
    if (link.ambiguousSources.length) {
      addDiagnostic({
        id: `ambiguous-task-link:${task.graphId}`,
        entityType: 'task',
        entityId: task.sourceId,
        title: task.raw.title,
        severity: 'error',
        message: 'Task link targets a duplicate performance record ID and cannot be resolved safely.',
        recommendedAction: 'Resolve duplicate parent records, then relink the Task.',
      }, task.graphId);
    }
    if (task.linkedRecordId && includedRecordIds.has(task.linkedRecordId) && !link.ambiguousSources.length) {
      pushToIndex(tasksByRecordId, task.linkedRecordId, task);
    } else {
      orphanTasks.push(task);
      addDiagnostic({
        id: `task-without-performance-parent:${task.graphId}`,
        entityType: 'task',
        entityId: task.sourceId,
        title: task.raw.title,
        severity: 'warning',
        message: task.linkedRecordId
          ? 'Task parent exists outside the active scope.'
          : 'Task has no resolvable KPI or Performance KRA parent.',
        missingRelationship: 'kpi_id/kra_id',
        recommendedAction: 'Link the Task to one in-scope performance record.',
      }, task.graphId);
    }
  }

  const childrenByParent = new Map<string, PreparedRecord[]>();
  for (const record of includedRecords) {
    if (record.parentGraphId && includedRecordIds.has(record.parentGraphId)) {
      pushToIndex(childrenByParent, record.parentGraphId, record);
    }
  }

  const builtNodes: PerformanceNode[] = [];
  const builtNodeIds = new Set<string>();
  const exceptionPerformanceRecords: PerformanceNode[] = [];
  const exceptionRecordIds = new Set<string>();
  const exceptionTasks: TaskNode[] = [];

  const buildTaskNode = (task: PreparedTask, parentRecordId?: string): TaskNode => {
    const assignee = task.raw.assignees?.[0];
    const node: TaskNode = {
      id: task.graphId,
      sourceId: task.sourceId,
      title: task.raw.title || 'Untitled Task',
      sourceList: 'Operations_Tasks',
      ownerName: assignee?.name || task.raw.assignee,
      ownerEmail: assignee?.email || (String(task.raw.assignedTo || '').includes('@') ? task.raw.assignedTo : undefined),
      createdByEmail: task.raw.createdByEmail || task.raw.authorEmail,
      parentKpiId: key(task.raw.kpi_id) ? parentRecordId : undefined,
      parentPerformanceKraId: !key(task.raw.kpi_id) && key(task.raw.kra_id) ? parentRecordId : undefined,
      status: task.raw.status,
      dueDate: task.raw.dueDate,
      completedAt: task.raw.completedAt || task.raw.completionDate,
      evidenceCount: evidenceCountFor(task.raw),
      inScope: true,
      diagnostics: diagnosticsByGraphId.get(task.graphId),
      raw: task.raw,
    };
    lookups.tasksById[node.id] = node;
    return node;
  };

  const buildNode = (
    record: PreparedRecord,
    inheritedDivision: string,
    inheritedUnit: string,
  ): PerformanceNode => {
    const { division, unit } = remapDivisionUnit(
      record.division || inheritedDivision,
      record.unit || inheritedUnit,
    );
    const childRecords = childrenByParent.get(record.graphId) || [];
    const childNodes = childRecords.map((c) => buildNode(c, division, unit));
    const linkedTasks = tasksByRecordId.get(record.graphId) || [];
    const taskNodes = linkedTasks.map((task) => buildTaskNode(task, record.graphId));

    const progress =
      childNodes.length > 0
        ? rollupChildren(childNodes, scope, now, record.raw.title)
        : leafProgress(record.raw, taskNodes, scope, now);

    const directChecklistCount = record.raw.checklist?.filter((item) => item.checked).length || 0;
    if (childNodes.length > 0 && (taskNodes.length > 0 || (record.raw.checklist?.length || 0) > 0 || Boolean(record.raw.measurementDefinition))) {
      progress.warnings = [
        ...(progress.warnings || []),
        'Direct Task/checklist/specialized measurement evidence is preserved on this parent but excluded from the interim child rollup.',
      ];
      addDiagnostic({
        id: `direct-evidence-on-parent:${record.graphId}`,
        entityType: roleToEntityType(record.raw.ownerRole),
        entityId: record.sourceId,
        title: record.raw.title,
        severity: 'info',
        message: 'This parent has direct Task/checklist/specialized measurement evidence as well as child records; evidence is preserved without changing the existing rollup formula.',
        recommendedAction: 'Confirm the intended weighting during the specialized-measurement phase.',
      }, record.graphId);
    }
    if (childNodes.length === 0 && progress.measurement?.state !== undefined && progress.measurement.state !== 'calculated') {
      const invalid = progress.measurement.state === 'invalid';
      addDiagnostic({
        id: `measurement-${progress.measurement.state}:${record.graphId}`,
        entityType: roleToEntityType(record.raw.ownerRole),
        entityId: record.sourceId,
        title: record.raw.title,
        severity: invalid ? 'error' : 'warning',
        message: progress.explanation,
        missingRelationship: invalid ? 'valid measurement definition/evidence' : 'measurement evidence for the reporting window',
        recommendedAction: invalid
          ? 'Correct the normalized definition or impossible evidence values before using this KPI in a rolling rollup.'
          : 'Record dated evidence and an explicit denominator for the reporting window.',
      }, record.graphId);
    }

    const node: PerformanceNode = {
      id: record.graphId,
      sourceId: record.sourceId,
      title: record.raw.title,
      sourceList: record.raw.sourceList || 'Performance_KRAs',
      ownerName: record.raw.ownerName,
      ownerEmail: record.raw.ownerEmail,
      ownerRole: record.raw.ownerRole,
      parentId: record.parentGraphId ?? undefined,
      sourceParentId: record.parentSourceId ?? undefined,
      parentStrategicGoalId: key(record.raw.parentStrategicGoalId) ?? undefined,
      division: division || GENERAL_DIVISION,
      unit: unit || GENERAL_UNIT,
      calculationType: record.raw.calculationType,
      checklist: record.raw.checklist,
      measurementDefinition: record.raw.measurementDefinition,
      measurementEvidence: record.raw.measurementEvidence,
      evidenceCount: taskNodes.reduce((sum, task) => sum + (task.evidenceCount || 0), 0) + directChecklistCount + specializedEvidenceCount(record.raw),
      status: record.raw.status,
      dataSource: record.raw.dataSource,
      reportingFrequency: record.raw.reportingFrequency,
      reviewAuthority: record.raw.reviewAuthority,
      reviewStatus: record.raw.reviewStatus,
      reviewNote: record.raw.reviewNote,
      children: childNodes,
      tasks: taskNodes,
      rolesInferred: record.raw.rolesInferred,
      inScope: directlyInScope.has(record.graphId),
      progress,
    };
    (node as any)._weight = record.raw.weight || 0;

    // Governance diagnostic: officers must not have child KRAs.
    if (record.raw.ownerRole === 'officer' && childNodes.length > 0) {
      const d: LinkageDiagnostic = {
        id: `officer-with-children:${record.graphId}`,
        entityType: 'kpi',
        entityId: record.sourceId,
        title: record.raw.title,
        severity: 'warning',
        message: 'Unit Officer records must not have child KRAs (cascade stops at officer).',
        recommendedAction: 'Reassign the child records to a Manager, or reclassify the owner role.',
      };
      addDiagnostic(d, record.graphId);
    }

    node.diagnostics = diagnosticsByGraphId.get(record.graphId);
    lookups.performanceRecordsById![node.id] = node;
    builtNodes.push(node);
    builtNodeIds.add(node.id);
    return node;
  };

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

  const rootRecords = includedRecords.filter(
    (record) => !record.parentGraphId || !includedRecordIds.has(record.parentGraphId),
  );

  for (const record of rootRecords) {
    const node = buildNode(record, GENERAL_DIVISION, GENERAL_UNIT);
    const goalSourceId = key(record.raw.parentStrategicGoalId);
    const goalGraphId = goalSourceId ? uniqueGoalGraphIdBySource.get(goalSourceId) : undefined;
    const goal = goalGraphId ? goalByGraphId.get(goalGraphId) : undefined;
    const quarantined = record.missingId || record.duplicate || Boolean(record.cycleId) ||
      Boolean(record.parentSourceId && !record.parentGraphId);
    if (goal && !quarantined) {
      goal.performanceRoots!.push(node);
    } else {
      getUnlinkedGoal().performanceRoots!.push(node);
      if (!exceptionRecordIds.has(node.id)) {
        exceptionRecordIds.add(node.id);
        exceptionPerformanceRecords.push(node);
      }
      addDiagnostic({
        id: `record-without-goal:${record.graphId}`,
        entityType: roleToEntityType(record.raw.ownerRole),
        entityId: record.sourceId,
        title: record.raw.title,
        severity: goalSourceId ? 'warning' : 'info',
        message: goalSourceId
          ? 'parentStrategicGoalId did not match any Strategic Goal.'
          : 'Top-level record is not linked to a Strategic Goal.',
        missingRelationship: 'parentStrategicGoalId',
        recommendedAction: 'Link this record to a Strategic Goal.',
      }, record.graphId);
      node.diagnostics = diagnosticsByGraphId.get(record.graphId);
    }
  }

  // Defensive conservation pass: a future relationship change must never make
  // a record disappear merely because it ceased to be reachable from a root.
  for (const record of includedRecords) {
    if (builtNodeIds.has(record.graphId)) continue;
    addDiagnostic({
      id: `unreachable-record:${record.graphId}`,
      entityType: roleToEntityType(record.raw.ownerRole),
      entityId: record.sourceId,
      title: record.raw.title,
      severity: 'error',
      message: 'Record was unreachable from canonical roots and was recovered into the exception collection.',
      recommendedAction: 'Inspect its parent chain for an unsupported relationship.',
    }, record.graphId);
    const node = buildNode(record, GENERAL_DIVISION, GENERAL_UNIT);
    getUnlinkedGoal().performanceRoots!.push(node);
    exceptionRecordIds.add(node.id);
    exceptionPerformanceRecords.push(node);
  }

  for (const task of orphanTasks) exceptionTasks.push(buildTaskNode(task));

  // The flat exception collection includes every structurally unsafe record,
  // including non-root cycle members that are also visible below a quarantined root.
  for (const node of builtNodes) {
    const structuralIssue = (node.diagnostics || []).some((diagnostic) =>
      diagnostic.severity === 'error' ||
      diagnostic.id.startsWith('broken-parent:') ||
      diagnostic.id.startsWith('record-without-goal:') ||
      diagnostic.id.startsWith('unreachable-record:'),
    );
    if (structuralIssue && !exceptionRecordIds.has(node.id)) {
      exceptionRecordIds.add(node.id);
      exceptionPerformanceRecords.push(node);
    }
  }

  // Goal progress rollup + empty-goal diagnostic.
  for (const goal of goalNodes) {
    goal.progress = averageOf(goal.performanceRoots || [], scope, now, `Goal ${goal.title}`);
    if ((goal.performanceRoots || []).length === 0 && goal.id !== UNLINKED_GOAL_ID) {
      addDiagnostic({
        id: `goal-without-kra:${goal.id}`,
        entityType: 'strategic_goal',
        entityId: goal.id,
        title: goal.title,
        severity: 'info',
        message: 'Strategic Goal has no Organisational KRAs.',
        missingRelationship: 'organisational_kras',
      }, goal.id);
    }
    goal.diagnostics = diagnosticsByGraphId.get(goal.id);
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

  // Pre-seed only the relevant structure for scoped graphs.
  const structureEntries = Object.entries(divisionStructure).filter(([division]) =>
    scope === 'corporate' || scope === 'audit' ||
    (scope === 'division' && sameText(division, context?.division)) ||
    (scope === 'unit' && (!context?.division || sameText(division, context.division))),
  );
  for (const [div, allUnits] of structureEntries) {
    const dNode = getDivision(div);
    const units = scope === 'unit' ? allUnits.filter((unit) => sameText(unit, context?.unit)) : allUnits;
    for (const u of units) getUnit(dNode, u);
  }

  // Place every built node into its division/unit (flat), then roll up from the
  // "top-of-unit"/"top-of-division" nodes (those whose parent lives elsewhere).
  const parentDifferentUnit = (node: PerformanceNode): boolean => {
    if (!node.parentId) return true;
    const parent = lookups.performanceRecordsById![node.parentId];
    return !parent || parent.division !== node.division || parent.unit !== node.unit;
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
        addDiagnostic({
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
      addDiagnostic({
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

  const integrity: StrategyExecutionIntegritySummary = {
    inputGoalCount: strategicGoals.length,
    inputPerformanceRecordCount: rawRecords.length,
    inputTaskCount: rawTasks.length,
    includedPerformanceRecordCount: includedRecords.length,
    includedTaskCount: includedTasks.length,
    representedGoalCount: strategicGoals.length,
    representedPerformanceRecordCount: builtNodes.length,
    representedTaskCount: Object.keys(lookups.tasksById).length,
    filteredOutPerformanceRecordCount: rawRecords.length - includedRecords.length,
    filteredOutTaskCount: rawTasks.length - includedTasks.length,
    performanceRecordsConserved: builtNodes.length === includedRecords.length,
    tasksConserved: Object.keys(lookups.tasksById).length === includedTasks.length,
    isConserved:
      builtNodes.length === includedRecords.length &&
      Object.keys(lookups.tasksById).length === includedTasks.length,
  };

  return {
    generatedAt: now,
    scope,
    goals: goalNodes,
    divisions,
    lookups,
    diagnostics,
    exceptions: { performanceRecords: exceptionPerformanceRecords, tasks: exceptionTasks },
    integrity,
  };
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
