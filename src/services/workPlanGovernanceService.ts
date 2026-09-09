import type { StrategyReportActor } from './strategyReportArchiveService';
import type {
  WorkPlanGovernanceActor,
  WorkPlanGovernanceEvent,
  WorkPlanGovernanceHistory,
  WorkPlanRetirementImpact,
  WorkPlanRetirementRecord,
  WorkPlanStructureRetirementImpact,
  WorkPlanStructureRetirementRecord,
} from '../types/division.types';

export interface WorkPlanGovernanceSourceItem {
  id: string;
  lastModifiedDateTime?: string;
  fields?: Record<string, any>;
}

type PendingRetirementOperation = {
  version: 1;
  entityKind: 'activity' | 'kra' | 'goal';
  operationId: string;
  state: 'running' | 'failed';
  leaseUntil: number;
  completedSteps: string[];
  reason: string;
  impact: WorkPlanRetirementImpact | WorkPlanStructureRetirementImpact;
  activitySnapshot?: { title?: string };
  sourceSnapshot?: { title?: string };
  performedBy?: WorkPlanGovernanceActor;
  error?: string;
};

type RetirementStore = {
  version: 1;
  history: Array<WorkPlanRetirementRecord | WorkPlanStructureRetirementRecord>;
  operation?: PendingRetirementOperation;
};

const normalize = (value?: string) => value?.trim().toLowerCase() || '';
const ACTIONS = new Set(['retire', 'clear-links', 'reassign']);

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  return value;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function canViewWorkPlanGovernance(actor: StrategyReportActor | null | undefined, divisionName: string): boolean {
  if (!actor || !normalize(actor.email) || !normalize(divisionName)) return false;
  const role = normalize(actor.role);
  if (actor.isAdmin || role === 'admin' || role === 'super_admin') return true;
  return ['manager', 'director'].includes(role) && normalize(actor.division) === normalize(divisionName);
}

export function assertCanViewWorkPlanGovernance(actor: StrategyReportActor | null | undefined, divisionName: string): void {
  if (!canViewWorkPlanGovernance(actor, divisionName)) {
    throw new Error('You do not have permission to view retirement governance for this Division.');
  }
}

function parseStore(raw: unknown, planId: string): RetirementStore {
  if (!raw) return { version: 1, history: [] };
  let value: any;
  try { value = typeof raw === 'string' ? JSON.parse(raw) : clone(raw); }
  catch { throw new Error(`Work plan ${planId} has invalid retirement governance JSON.`); }
  if (value?.version !== 1 || !Array.isArray(value.history)) {
    throw new Error(`Work plan ${planId} has an unsupported retirement governance envelope.`);
  }
  return value;
}

function safeDate(value: unknown, label: string, required = false): string | undefined {
  if (!value && !required) return undefined;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`${label} has an invalid timestamp.`);
  return new Date(value).toISOString();
}

function actor(value: any): WorkPlanGovernanceActor | undefined {
  if (!value) return undefined;
  const email = normalize(value.email);
  if (!email) return undefined;
  return { email, name: String(value.name || email).trim(), role: value.role?.trim() || undefined };
}

function activityProjection(
  plan: { id: string; title: string; year: number; divisionId: string; divisionName: string; lastModifiedAt?: string },
  record: WorkPlanRetirementRecord,
  status: WorkPlanGovernanceEvent['status'],
  pending?: PendingRetirementOperation,
): WorkPlanGovernanceEvent {
  const impact = record.impact;
  return {
    operationId: record.operationId,
    planId: plan.id,
    planTitle: plan.title,
    planYear: plan.year,
    divisionId: plan.divisionId,
    divisionName: plan.divisionName,
    entityKind: 'activity',
    sourceId: record.activityId,
    sourceExecutionId: record.kpiId,
    sourceTitle: record.activitySnapshot?.title || impact.activityTitle || 'Untitled activity',
    action: record.action,
    status,
    reason: record.reason,
    completedAt: safeDate(record.completedAt, `Retirement ${record.operationId}`, status === 'completed'),
    lastCheckpointAt: status === 'completed' ? undefined : safeDate(plan.lastModifiedAt, `Retirement ${record.operationId} checkpoint`),
    leaseUntil: pending?.leaseUntil ? new Date(pending.leaseUntil).toISOString() : undefined,
    performedBy: actor(record.performedBy || pending?.performedBy),
    target: record.targetKraId ? { id: record.targetKraId, title: impact.targetKra?.title } : undefined,
    affected: { objectives: 0, kras: 1, kpis: 1, tasks: record.taskIds?.length || impact.tasks.length },
    evidence: {
      measurementDefinitions: impact.kpi.hasMeasurementDefinition ? 1 : 0,
      measurementEvidenceRefs: impact.kpi.measurementEvidenceCount,
      checklists: impact.kpi.hasChecklistEvidence ? 1 : 0,
      tasks: impact.tasks.length,
    },
    progress: [impact.sourceKra, ...(impact.targetKra ? [impact.targetKra] : [])].map(item => ({
      kind: 'kra', id: item.id, title: item.title, progress: item.progress, projectedProgress: item.projectedProgress,
    })),
    completedSteps: [...(pending?.completedSteps || [])],
    warnings: [...(impact.warnings || [])],
    error: pending?.error?.trim() || undefined,
    recoveryGuidance: status === 'failed'
      ? 'Resume this same reviewed operation from the work-plan editor; do not create a different intent or delete its checkpoints.'
      : status === 'running'
        ? 'This operation owns the retirement lease. Reload after it completes or recover the same intent after the lease expires.'
        : undefined,
    reversalAvailable: false,
  };
}

function structureProjection(
  plan: { id: string; title: string; year: number; divisionId: string; divisionName: string; lastModifiedAt?: string },
  record: WorkPlanStructureRetirementRecord,
  status: WorkPlanGovernanceEvent['status'],
  pending?: PendingRetirementOperation,
): WorkPlanGovernanceEvent {
  const impact = record.impact;
  return {
    operationId: record.operationId,
    planId: plan.id,
    planTitle: plan.title,
    planYear: plan.year,
    divisionId: plan.divisionId,
    divisionName: plan.divisionName,
    entityKind: record.entityKind,
    sourceId: record.sourceId,
    sourceExecutionId: record.sourceExecutionId,
    sourceTitle: record.sourceSnapshot?.title || impact.sourceTitle || `Untitled ${record.entityKind}`,
    action: record.action,
    status,
    reason: record.reason,
    completedAt: safeDate(record.completedAt, `Retirement ${record.operationId}`, status === 'completed'),
    lastCheckpointAt: status === 'completed' ? undefined : safeDate(plan.lastModifiedAt, `Retirement ${record.operationId} checkpoint`),
    leaseUntil: pending?.leaseUntil ? new Date(pending.leaseUntil).toISOString() : undefined,
    performedBy: actor(record.performedBy || pending?.performedBy),
    target: record.targetExecutionId ? { id: record.targetExecutionId, title: impact.target?.title } : undefined,
    affected: {
      objectives: impact.affected.objectiveIds.length,
      kras: impact.affected.kraIds.length,
      kpis: impact.affected.kpiIds.length,
      tasks: impact.affected.taskIds.length,
    },
    evidence: { ...impact.evidence },
    progress: impact.progress.map(item => ({
      kind: item.kind, id: item.id, title: item.title, progress: item.progress, projectedProgress: item.projectedProgress,
    })),
    completedSteps: [...(pending?.completedSteps || [])],
    warnings: [...(impact.warnings || [])],
    error: pending?.error?.trim() || undefined,
    recoveryGuidance: status === 'failed'
      ? 'Resume this same reviewed operation from the work-plan editor; do not create a different intent or delete its checkpoints.'
      : status === 'running'
        ? 'This operation owns the retirement lease. Reload after it completes or recover the same intent after the lease expires.'
        : undefined,
    reversalAvailable: false,
  };
}

function assertRecord(record: any, planId: string): void {
  const action = record?.action || record?.impact?.action;
  if (!record?.operationId || !ACTIONS.has(action) || !record.reason?.trim() || !record.impact) {
    throw new Error(`Work plan ${planId} contains an incomplete retirement governance record.`);
  }
}

/** Builds a recursively immutable, read-only projection from authoritative RetirementJSON rows. */
export function buildWorkPlanGovernanceHistory(
  items: readonly WorkPlanGovernanceSourceItem[],
  scope: { divisionId: string; divisionName: string },
  capturedAt = new Date().toISOString(),
): WorkPlanGovernanceHistory {
  if (!scope.divisionId?.trim() || !scope.divisionName?.trim()) throw new Error('An exact Division identity is required for governance history.');
  const capture = safeDate(capturedAt, 'Governance history capture', true)!;
  const events: WorkPlanGovernanceEvent[] = [];
  const operationIds = new Set<string>();

  for (const item of items) {
    const fields = item.fields || {};
    if (String(fields.DivisionId || '') !== scope.divisionId || normalize(fields.DivisionName) !== normalize(scope.divisionName)) {
      throw new Error(`Work plan ${item.id} does not match the requested Division governance scope.`);
    }
    const plan = {
      id: String(item.id), title: String(fields.Title || 'Untitled work plan'), year: Number(fields.Year) || 0,
      divisionId: String(fields.DivisionId), divisionName: String(fields.DivisionName), lastModifiedAt: item.lastModifiedDateTime,
    };
    const store = parseStore(fields.RetirementJSON, plan.id);
    for (const record of store.history) {
      assertRecord(record, plan.id);
      if (operationIds.has(record.operationId)) throw new Error(`Duplicate retirement operation ${record.operationId} requires reconciliation.`);
      operationIds.add(record.operationId);
      events.push('entityKind' in record
        ? structureProjection(plan, record as WorkPlanStructureRetirementRecord, 'completed')
        : activityProjection(plan, record as WorkPlanRetirementRecord, 'completed'));
    }
    if (store.operation) {
      const operation = store.operation;
      assertRecord(operation, plan.id);
      if (!['activity', 'kra', 'goal'].includes(operation.entityKind) || !['running', 'failed'].includes(operation.state)) {
        throw new Error(`Work plan ${plan.id} has an unsupported active retirement operation.`);
      }
      if (operationIds.has(operation.operationId)) throw new Error(`Retirement operation ${operation.operationId} is both active and completed.`);
      operationIds.add(operation.operationId);
      if (operation.entityKind === 'activity') {
        const impact = operation.impact as WorkPlanRetirementImpact;
        events.push(activityProjection(plan, {
          operationId: operation.operationId,
          activityId: impact.activityId,
          action: impact.action,
          reason: operation.reason,
          completedAt: '',
          sourceKraId: impact.sourceKra.id,
          targetKraId: impact.targetKra?.id,
          kpiId: impact.kpi.id,
          taskIds: impact.tasks.map(task => task.id),
          impact,
          activitySnapshot: operation.activitySnapshot as any,
          performedBy: operation.performedBy,
        }, operation.state, operation));
      } else {
        const impact = operation.impact as WorkPlanStructureRetirementImpact;
        events.push(structureProjection(plan, {
          operationId: operation.operationId,
          entityKind: operation.entityKind,
          sourceId: impact.sourceId,
          sourceExecutionId: impact.sourceExecutionId,
          action: impact.action,
          reason: operation.reason,
          completedAt: '',
          targetExecutionId: impact.target?.id,
          impact,
          sourceSnapshot: operation.sourceSnapshot as any,
          performedBy: operation.performedBy,
        }, operation.state, operation));
      }
    }
  }

  events.sort((left, right) => Date.parse(right.completedAt || right.lastCheckpointAt || '1970-01-01') -
    Date.parse(left.completedAt || left.lastCheckpointAt || '1970-01-01'));
  const result: WorkPlanGovernanceHistory = {
    version: 1,
    capturedAt: capture,
    scope: { divisionId: scope.divisionId, divisionName: scope.divisionName.trim() },
    summary: {
      total: events.length,
      completed: events.filter(event => event.status === 'completed').length,
      running: events.filter(event => event.status === 'running').length,
      failed: events.filter(event => event.status === 'failed').length,
      retirements: events.filter(event => event.action === 'retire').length,
      reassignments: events.filter(event => event.action === 'reassign').length,
      clearedLinks: events.filter(event => event.action === 'clear-links').length,
    },
    events,
  };
  return deepFreeze(clone(result));
}
