import { User } from '@/types';

// ===== Work Plan Types =====

export type WorkPlanTimePeriod = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'H1' | 'H2' | 'annual' | 'custom';
export type WorkPlanStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface WorkPlan {
  id: string;
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
