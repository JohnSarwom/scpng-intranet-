import { User } from '@/types';

// ===== Work Plan Types =====

export type WorkPlanTimePeriod = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'H1' | 'H2' | 'annual' | 'custom';
export type WorkPlanStatus = 'draft' | 'active' | 'completed' | 'archived';
export type WorkPlanRetirementAction = 'retire' | 'clear-links' | 'reassign';
export type WorkPlanStructureKind = 'kra' | 'goal';

export interface WorkPlanGovernanceActor {
  email: string;
  name: string;
  role?: string;
}

export interface WorkPlanRetirementImpact {
  version: 1;
  operationId: string;
  signature: string;
  planId: string;
  planRevision: string;
  activityId: string;
  activityTitle: string;
  action: WorkPlanRetirementAction;
  /** Versions covered by the reviewed signature; used for stale-write rejection and recovery. */
  revisions: {
    sourceKra: string;
    targetKra?: string;
    kpi: string;
    tasks: Record<string, string>;
  };
  sourceKra: { id: string; title: string; progress: number; projectedProgress: number; activeKpiCount: number };
  targetKra?: { id: string; title: string; progress: number; projectedProgress: number; activeKpiCount: number };
  kpi: { id: string; title: string; status: string; measurementEvidenceCount: number; hasMeasurementDefinition: boolean; hasChecklistEvidence: boolean };
  tasks: Array<{ id: string; title: string; status: string }>;
  warnings: string[];
}

export interface WorkPlanRetirementRequest {
  impact: WorkPlanRetirementImpact;
  reason: string;
  /** Stamped by the authoritative service boundary, never trusted from form input. */
  performedBy?: WorkPlanGovernanceActor;
}

export interface WorkPlanStructureRetirementImpact {
  version: 1;
  entityKind: WorkPlanStructureKind;
  operationId: string;
  signature: string;
  planId: string;
  planRevision: string;
  sourceId: string;
  sourceExecutionId: string;
  sourceTitle: string;
  action: WorkPlanRetirementAction;
  target?: { id: string; title: string };
  affected: {
    objectiveIds: string[];
    kraIds: string[];
    kpiIds: string[];
    taskIds: string[];
  };
  progress: Array<{
    kind: 'kra' | 'objective';
    id: string;
    title: string;
    progress: number;
    projectedProgress: number;
    activeMemberCount: number;
    projectedMemberCount: number;
  }>;
  evidence: {
    measurementDefinitions: number;
    measurementEvidenceRefs: number;
    checklists: number;
    tasks: number;
  };
  revisions: {
    objectives: Record<string, string>;
    kras: Record<string, string>;
    kpis: Record<string, string>;
    tasks: Record<string, string>;
  };
  warnings: string[];
}

export interface WorkPlanStructureRetirementRequest {
  impact: WorkPlanStructureRetirementImpact;
  reason: string;
  /** Stamped by the authoritative service boundary, never trusted from form input. */
  performedBy?: WorkPlanGovernanceActor;
}

export interface WorkPlanStructureRetirementRecord {
  operationId: string;
  entityKind: WorkPlanStructureKind;
  sourceId: string;
  sourceExecutionId: string;
  action: WorkPlanRetirementAction;
  reason: string;
  completedAt: string;
  targetExecutionId?: string;
  impact: WorkPlanStructureRetirementImpact;
  sourceSnapshot: WorkPlanGoal | WorkPlanKra;
  performedBy?: WorkPlanGovernanceActor;
}

export interface WorkPlanRetirementRecord {
  operationId: string;
  activityId: string;
  action: WorkPlanRetirementAction;
  reason: string;
  completedAt: string;
  sourceKraId: string;
  targetKraId?: string;
  kpiId: string;
  taskIds: string[];
  impact: WorkPlanRetirementImpact;
  activitySnapshot: WorkPlanActivity;
  performedBy?: WorkPlanGovernanceActor;
}

export type WorkPlanGovernanceStatus = 'completed' | 'running' | 'failed';

export interface WorkPlanGovernanceEvent {
  operationId: string;
  planId: string;
  planTitle: string;
  planYear: number;
  divisionId: string;
  divisionName: string;
  entityKind: 'activity' | WorkPlanStructureKind;
  sourceId: string;
  sourceExecutionId?: string;
  sourceTitle: string;
  action: WorkPlanRetirementAction;
  status: WorkPlanGovernanceStatus;
  reason: string;
  completedAt?: string;
  lastCheckpointAt?: string;
  leaseUntil?: string;
  performedBy?: WorkPlanGovernanceActor;
  target?: { id: string; title?: string };
  affected: { objectives: number; kras: number; kpis: number; tasks: number };
  evidence: { measurementDefinitions: number; measurementEvidenceRefs: number; checklists: number; tasks: number };
  progress: Array<{ kind: 'kra' | 'objective'; id: string; title: string; progress: number; projectedProgress: number }>;
  completedSteps: string[];
  warnings: string[];
  error?: string;
  recoveryGuidance?: string;
  reversalAvailable: false;
}

export interface WorkPlanGovernanceHistory {
  version: 1;
  capturedAt: string;
  scope: { divisionId: string; divisionName: string };
  summary: { total: number; completed: number; running: number; failed: number; retirements: number; reassignments: number; clearedLinks: number };
  events: WorkPlanGovernanceEvent[];
}

/** Source evidence is planning metadata, never a progress contribution by itself. */
export interface WorkPlanSource {
  documentName: string;
  sha256?: string;
  table?: number;
  row?: number;
  reference?: string;
  unresolvedIssues?: string[];
}

export interface WorkPlanTarget {
  rawText: string;
  measurementMode?: import('@/types').KpiMeasurementMode;
  operator?: 'at-least' | 'at-most' | 'equal';
  quantity?: number;
  unit?: string;
  population?: string;
  frequency?: string;
  serviceLevel?: string;
  timeAllowance?: { value: number; unit: string };
  milestoneWindow?: string;
}

export interface WorkPlanMeasure {
  id: string;
  description: string;
  target: WorkPlanTarget;
  source?: WorkPlanSource;
}

export interface WorkPlanKra {
  id: string;
  code: string;
  title: string;
  objective?: string;
  linkedKraId?: string;
  source?: WorkPlanSource;
}

export interface WorkPlan {
  id: string;
  revision?: string;
  title: string;
  description: string;
  divisionId: string;
  divisionName: string;
  status: WorkPlanStatus;
  timePeriod: WorkPlanTimePeriod;
  year: number;
  startDate: string;
  endDate: string;
  linkedStrategicObjectiveId?: string;
  linkedStrategicObjectiveTitle?: string;
  goals: WorkPlanGoal[];
  overallProgress: number;
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  // Comprehensive work plan fields
  organization?: string;
  preparedBy?: string;
  planningPeriodLabel?: string;
  mandate?: string;
  monitoringAndReporting?: string;
  reviewFrequency?: string;
  reportingTo?: string;
  retirementHistory?: Array<WorkPlanRetirementRecord | WorkPlanStructureRetirementRecord>;
}

export interface WorkPlanGoal {
  id: string;
  workPlanId: string;
  title: string;
  description: string;
  linkedObjectiveId?: string;
  linkedObjectiveTitle?: string;
  targetMetric?: string;
  targetValue?: number;
  actualValue?: number;
  responsibleUnitIds: string[];
  responsibleUnitNames: string[];
  activities: WorkPlanActivity[];
  progress: number;
  status: 'not-started' | 'in-progress' | 'completed' | 'at-risk';
  order: number;
  source?: WorkPlanSource;
  sourceCode?: string;
  strategicObjective?: string;
  expectedOutcomes?: string[];
  policyAlignment?: string[];
  kras?: WorkPlanKra[];
  goalMeasures?: WorkPlanMeasure[];
  /** Explicit list identity; legacy linkedObjectiveId must not be guessed into this. */
  organizationalGoalRef?: { list: 'Strategic_Goals' | 'Strategic_Objectives'; id: string };
  /** Populated only by creation or an explicit verified legacy crosswalk. */
  executionObjectiveRef?: { list: 'Unit_Objectives'; id: string };
  /** Explicit compatibility mapping when the organizational goal is in Strategic_Goals. */
  legacyStrategicObjectiveId?: string;
}

export interface WorkPlanActivity {
  id: string;
  goalId: string;
  title: string;
  description: string;
  assignedUnitId: string;
  assignedUnitName: string;
  responsiblePersonEmail?: string;
  responsiblePersonName?: string;
  startDate: string;
  endDate: string;
  expectedOutput: string;
  linkedTaskIds: string[];
  linkedKraId?: string;
  linkedKpiId?: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'overdue' | 'blocked';
  progress: number;
  order: number;
  // Comprehensive fields
  kpiDescription?: string;
  resourcesRequired?: string;
  source?: WorkPlanSource;
  sourceKraId?: string;
  annualTarget?: WorkPlanTarget;
  plannedQuarters?: Array<'Q1' | 'Q2' | 'Q3' | 'Q4'>;
  responsiblePosition?: string;
  supervisorPosition?: string;
  contributingUnitIds?: string[];
  sourceUnitText?: string;
  budget?: { rawText: string; amount?: number; currency?: string };
  dependencies?: string;
  risk?: string;
  /** Creation uses the ordinary Task schema; recurring obligations may link many existing Tasks. */
  taskPolicy?: 'link-existing' | 'create-task';
}

export interface WorkPlanGoalExtended extends WorkPlanGoal {
  linkedObjectiveTitle?: string;
}

// ===== Report Types =====

export type ReportTimePeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly' | 'custom';
export type ReportScope = 'individual' | 'unit' | 'division';
export type ReportType = 'operations' | 'performance' | 'strategic' | 'custom';
export type ReportDataCategory = 'tasks' | 'kras' | 'kpis' | 'objectives';

export interface ReportConfig {
  timePeriod: ReportTimePeriod;
  scope: ReportScope;
  reportType: ReportType;
  divisionId: string;
  divisionName?: string;
  unitId?: string;
  unitName?: string;
  individualEmail?: string;
  individualName?: string;
  dateRange: {
    start: string;
    end: string;
  };
  includeCharts: boolean;
  includeAISummary: boolean;
  categories?: ReportDataCategory[];
}

export interface GeneratedReport {
  id: string;
  config: ReportConfig;
  title: string;
  generatedAt: string;
  generatedBy: string;
  sections: ReportSection[];
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'summary' | 'table' | 'chart' | 'text' | 'metrics';
  data: Record<string, unknown>;
  order: number;
}

// ===== Analytics Types =====

export type InsightCategory = 'bottleneck' | 'trend' | 'prediction' | 'optimization';
export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface AIInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  recommendation: string;
  relatedEntityType?: 'task' | 'kra' | 'kpi' | 'unit' | 'staff';
  relatedEntityId?: string;
  confidence: number;
  generatedAt: string;
  dismissed: boolean;
}

export interface PredictionDataPoint {
  date: string;
  value: number;
  confidence?: number;
}

export interface PredictionData {
  metric: string;
  label: string;
  historical: PredictionDataPoint[];
  projected: PredictionDataPoint[];
}

export interface BottleneckData {
  stage: string;
  count: number;
  averageDaysStuck: number;
  affectedItems: { id: string; title: string; type: string }[];
}

// ===== UI State Types =====

export type RAGStatus = 'green' | 'amber' | 'red';

export interface RAGMetric {
  label: string;
  value: number | string;
  status: RAGStatus;
  trend: 'up' | 'down' | 'flat';
  threshold: {
    green: number;
    amber: number;
  };
}

export interface UnitComparisonData {
  unitId: string;
  unitName: string;
  manager?: string;
  taskCompletion: number;
  kraProgress: number;
  kpiOnTrack: number;
  projectHealth: number;
  staffCount: number;
  overallScore: number;
}

export interface DivisionViewState {
  divisionId: string;
  divisionName: string;
  selectedUnitId?: string;
  selectedStaffEmail?: string;
  timePeriod: ReportTimePeriod | 'all';
  activeTab: string;
}

// ===== Division Data Aggregation =====

export interface DivisionMetrics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  taskCompletionRate: number;
  activeKRAs: number;
  completedKRAs: number;
  atRiskKRAs: number;
  kpiOnTrackPercentage: number;
  totalKPIs: number;
  activeProjects: number;
  completedProjects: number;
  overdueProjects: number;
  staffCount: number;
  staffOnLeave: number;
  averageTasksPerPerson: number;
  strategicAlignmentScore: number;
  overallPerformanceScore: number;
  unitComparisons: UnitComparisonData[];
}

export interface DivisionSettingsConfig {
  notifications: {
    dailySummary: boolean;
    weeklyDigest: boolean;
    alertOnRisk: boolean;
    alertOnOverdue: boolean;
  };
  display: {
    defaultTab: string;
    defaultTimePeriod: ReportTimePeriod | 'all';
    showAIInsights: boolean;
  };
}
