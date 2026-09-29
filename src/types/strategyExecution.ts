import type { Kpi, Task } from '@/types';

export type ProgressScope = 'personal' | 'unit' | 'division' | 'corporate' | 'audit';

export type ProgressStatusBand =
  | 'no_linked_data'
  | 'not_started'
  | 'behind_or_early'
  | 'in_progress'
  | 'on_track'
  | 'completed';

export type ProgressCalculationSource =
  | 'manual'
  | 'checklist'
  | 'task-completion'
  | 'specialized-measurement'
  | 'weighted'
  | 'average'
  | 'explicit-status'
  | 'cached'
  | 'no-linked-data';

export type LinkageDiagnosticSeverity = 'info' | 'warning' | 'error';

export type StrategyExecutionEntityType =
  | 'strategic_goal'
  | 'organisational_kra'
  | 'objective'
  | 'performance_kra'
  | 'kpi'
  | 'task'
  | 'division'
  | 'unit'
  | 'report'
  | 'schedule';

export interface ProgressCalculationResult {
  value: number;
  statusBand: ProgressStatusBand;
  hasLinkedData: boolean;
  source: ProgressCalculationSource;
  scope: ProgressScope;
  calculatedAt: string;
  childCount: number;
  completedChildCount?: number;
  explanation: string;
  warnings?: string[];
  measurement?: ProgressMeasurementSummary;
}

export interface ProgressMeasurementSummary {
  mode: NonNullable<Kpi['measurementDefinition']>['mode'];
  rawTarget: string;
  operator?: NonNullable<Kpi['measurementDefinition']>['operator'];
  target?: number;
  actual?: number;
  numerator?: number;
  denominator?: number;
  unit?: string;
  population?: string;
  frequency?: string;
  serviceLevel?: string;
  windowStart?: string;
  windowEnd?: string;
  asOf?: string;
  evidenceCount: number;
  targetMet?: boolean;
  state: 'calculated' | 'missing-evidence' | 'invalid';
}

export interface LinkageDiagnostic {
  id: string;
  entityType: StrategyExecutionEntityType;
  entityId: string;
  title?: string;
  severity: LinkageDiagnosticSeverity;
  message: string;
  missingRelationship?: string;
  parentEntityType?: StrategyExecutionEntityType;
  parentEntityId?: string;
  recommendedAction?: string;
}

export interface StrategyExecutionGraph {
  generatedAt: string;
  scope: ProgressScope;
  goals: StrategyGoalNode[];
  divisions: DivisionExecutionNode[];
  lookups: StrategyExecutionLookups;
  diagnostics: LinkageDiagnostic[];
  /** Records that could not be placed on a trustworthy canonical path. */
  exceptions: StrategyExecutionExceptions;
  /** Conservation proof for the exact input and active scope. */
  integrity: StrategyExecutionIntegritySummary;
}

export interface StrategyExecutionExceptions {
  performanceRecords: PerformanceNode[];
  tasks: TaskNode[];
}

export interface StrategyExecutionIntegritySummary {
  inputGoalCount: number;
  inputPerformanceRecordCount: number;
  inputTaskCount: number;
  includedPerformanceRecordCount: number;
  includedTaskCount: number;
  representedGoalCount: number;
  representedPerformanceRecordCount: number;
  representedTaskCount: number;
  filteredOutPerformanceRecordCount: number;
  filteredOutTaskCount: number;
  performanceRecordsConserved: boolean;
  tasksConserved: boolean;
  isConserved: boolean;
}

export interface StrategyExecutionLookups {
  goalsById: Record<string, StrategyGoalNode>;
  /** Role-recursive flat map of every performance record node. */
  performanceRecordsById?: Record<string, PerformanceNode>;
  tasksById: Record<string, TaskNode>;
  divisionsById: Record<string, DivisionExecutionNode>;
  unitsById: Record<string, UnitExecutionNode>;
  // Legacy fixed-shape maps (optional).
  organisationalKrasById?: Record<string, OrganisationalKraNode>;
  objectivesById?: Record<string, ObjectiveNode>;
  performanceKrasById?: Record<string, PerformanceKraNode>;
  kpisById?: Record<string, KpiNode>;
}

export interface StrategyExecutionBaseNode {
  id: string;
  /** Original list item id when the graph id had to be namespaced/quarantined. */
  sourceId?: string;
  title: string;
  sourceList: string;
  ownerName?: string;
  ownerEmail?: string;
  /** False means the node is retained only as ancestry context for a scoped view. */
  inScope?: boolean;
  progress?: ProgressCalculationResult;
  diagnostics?: LinkageDiagnostic[];
}

export interface StrategyGoalNode extends StrategyExecutionBaseNode {
  divisionName?: string;
  /** Legacy fixed-shape view (optional; kept for back-compat). */
  organisationalKras?: OrganisationalKraNode[];
  /** Role-recursive: the top rungs (Org KRAs) hanging off this goal. */
  performanceRoots?: PerformanceNode[];
}

export interface OrganisationalKraNode extends StrategyExecutionBaseNode {
  parentGoalId?: string;
  objectives: ObjectiveNode[];
}

export interface ObjectiveNode extends StrategyExecutionBaseNode {
  divisionName?: string;
  unitName?: string;
  parentGoalId?: string;
  parentOrganisationalKraId?: string;
  performanceKras: PerformanceKraNode[];
}

export interface PerformanceKraNode extends StrategyExecutionBaseNode {
  parentObjectiveId?: string;
  kpis: KpiNode[];
}

export interface KpiNode extends StrategyExecutionBaseNode {
  parentPerformanceKraId?: string;
  calculationType?: Kpi['calculationType'];
  raw?: Kpi;
  tasks: TaskNode[];
}

export interface TaskNode extends StrategyExecutionBaseNode {
  parentKpiId?: string;
  parentPerformanceKraId?: string;
  status?: Task['status'];
  dueDate?: string;
  completedAt?: string;
  evidenceCount?: number;
  createdByEmail?: string;
  raw?: Task;
}

// ---------------------------------------------------------------------------
// Role-recursive model (Phase 2 revision — see PHASE-2-REVISION-role-based-cascade.md)
// One record is its owner's KPI and, to the owner's manager, a KRA they assigned.
// ---------------------------------------------------------------------------

export type PerformanceRole = 'director' | 'manager' | 'officer';

/** The single unified record. It IS the owner's KPI and the assigner's KRA. */
export interface PerformanceRecord {
  id: string;
  title: string;
  ownerEmail?: string;
  ownerName?: string;
  ownerRole?: PerformanceRole;
  /** Self-lookup up the chain (the parent owner's KPI). null/undefined = top rung. */
  parentId?: string | null;
  /** Set only for top-level Org KRAs that hang off a Strategic Goal. */
  parentStrategicGoalId?: string | null;
  assignedByEmail?: string;
  division?: string;
  unit?: string;
  calculationType?: 'manual' | 'checklist' | 'task-completion';
  checklist?: Kpi['checklist'];
  measurementDefinition?: Kpi['measurementDefinition'];
  measurementEvidence?: Kpi['measurementEvidence'];
  target?: number;
  actual?: number;
  weight?: number;
  status?: string;
  progress?: number;
  sourceList?: string;
  dataSource?: string;
  reportingFrequency?: Kpi['reportingFrequency'];
  reviewAuthority?: string;
  reviewStatus?: Kpi['reviewStatus'];
  reviewNote?: string;
  /** True when role/parent were inferred by the legacy adapter, not stored. */
  rolesInferred?: boolean;
}

/** Recursive node. `children` are the KRAs this owner assigned downward. */
export interface PerformanceNode extends StrategyExecutionBaseNode {
  ownerRole?: PerformanceRole;
  parentId?: string;
  /** Original parent lookup retained when an unsafe edge is quarantined. */
  sourceParentId?: string;
  parentStrategicGoalId?: string;
  division?: string;
  unit?: string;
  calculationType?: PerformanceRecord['calculationType'];
  checklist?: PerformanceRecord['checklist'];
  measurementDefinition?: PerformanceRecord['measurementDefinition'];
  measurementEvidence?: PerformanceRecord['measurementEvidence'];
  evidenceCount?: number;
  status?: PerformanceRecord['status'];
  dataSource?: PerformanceRecord['dataSource'];
  reportingFrequency?: PerformanceRecord['reportingFrequency'];
  reviewAuthority?: PerformanceRecord['reviewAuthority'];
  reviewStatus?: PerformanceRecord['reviewStatus'];
  reviewNote?: PerformanceRecord['reviewNote'];
  children: PerformanceNode[];
  tasks: TaskNode[];
  rolesInferred?: boolean;
}

export interface DivisionExecutionNode extends StrategyExecutionBaseNode {
  units: UnitExecutionNode[];
  objectives?: ObjectiveNode[];
  /** Role-recursive: top-of-division performance records. */
  performanceRecords?: PerformanceNode[];
}

export interface UnitExecutionNode extends StrategyExecutionBaseNode {
  divisionId?: string;
  divisionName?: string;
  objectives?: ObjectiveNode[];
  performanceKras?: PerformanceKraNode[];
  kpis?: KpiNode[];
  tasks?: TaskNode[];
  /** Role-recursive: performance records physically owned in this unit. */
  performanceRecords?: PerformanceNode[];
}

export interface StrategyTraceabilityReport {
  id: string;
  title: string;
  type: StrategyReportType;
  scope: ProgressScope;
  generatedAt: string;
  generatedBy: string;
  dateRange: { start: string; end: string };
  source: 'graph' | 'cached' | 'mixed';
  goals: StrategyGoalNode[];
  diagnostics: LinkageDiagnostic[];
  summary: StrategyReportSummary;
  sections: StrategyReportSection[];
  snapshot: StrategyReportSnapshot;
  integrity: StrategyExecutionIntegritySummary;
}

export interface StrategyReportSnapshot {
  version: 1;
  graphGeneratedAt: string;
  capturedAt: string;
  immutable: true;
  dateBasis: 'task-interval-overlap-and-completion-events';
  scopeLabel: string;
  dataSourceSummary: string;
  progressFormula: string;
}

export type StrategyReportType =
  | 'strategic-traceability'
  | 'division-unit-heatmap'
  | 'kra-kpi-evidence'
  | 'unlinked-records'
  | 'overdue-strategic-tasks'
  | 'owner-accountability'
  | 'progress-variance'
  | 'kpi-review-governance';

export interface StrategyReportSummary {
  strategicGoalCount: number;
  organisationalKraCount: number;
  divisionCount: number;
  unitCount: number;
  objectiveCount: number;
  performanceKraCount: number;
  kpiCount: number;
  taskCount: number;
  evidenceCount: number;
  diagnosticCount: number;
  averageProgress: number;
}

export interface StrategyReportSection {
  id: string;
  title: string;
  rows: StrategyReportRow[];
}

export interface StrategyReportRow {
  entityType: StrategyExecutionEntityType;
  entityId: string;
  title: string;
  parentPath: string;
  ownerName?: string;
  progress?: number;
  statusBand?: ProgressStatusBand;
  calculationSource?: ProgressCalculationSource;
  evidenceCount?: number;
  diagnosticCount?: number;
  nextAction?: string;
  divisionName?: string;
  unitName?: string;
  dueDate?: string;
  completedAt?: string;
  evidenceState?: 'not-applicable' | 'present' | 'missing';
  sourceList?: string;
  status?: string;
  priority?: string;
  target?: number;
  actual?: number;
  variance?: number;
  varianceState?: 'favorable' | 'unfavorable' | 'on-target' | 'unavailable';
  measurementMode?: NonNullable<Kpi['measurementDefinition']>['mode'];
  measurementOperator?: NonNullable<Kpi['measurementDefinition']>['operator'];
  dataSource?: string;
  reportingFrequency?: Kpi['reportingFrequency'];
  reviewAuthority?: string;
  reviewStatus?: Kpi['reviewStatus'];
}
