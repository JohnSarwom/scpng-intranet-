import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  FileText, Download, Printer, RefreshCw, Calendar, BarChart2,
  CheckCircle, AlertTriangle, Clock, Target, TrendingUp, Loader2,
  ListChecks, Crosshair, Flag, Bell, Save, Mail, Users, Pencil, Trash2,
  ChevronDown, ChevronUp, Info, RotateCw, GitBranch
} from 'lucide-react';
import {
  ReportTimePeriod, ReportDataCategory, GeneratedReport, ReportConfig
} from '@/types/division.types';
import { Task, KRA, KPI, Objective, UserContext } from '@/types';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { SharePointOpsService } from '@/services/sharePointOpsService';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import useRoleBasedAuth from '@/hooks/useRoleBasedAuth';
import { useStrategyExecutionGraph } from '@/hooks/useStrategyExecutionGraph';
import { buildStrategyReport, strategyReportToCsv } from '@/services/strategyReportingService';
import { createSharePointStrategyReportArchiveService } from '@/services/strategyReportArchiveService';
import type { StrategyTraceabilityReport } from '@/types/strategyExecution';
import type { StoredStrategyReportArchive } from '@/services/strategyReportArchiveService';
import { StrategyGovernanceSections } from '@/components/reports/StrategyGovernanceSections';

// ===== Metadata for Internal Reference & Setup =====

const SHAREPOINT_METADATA = {
  site: "https://scpng1.sharepoint.com/sites/scpngintranet",
  lists: {
    tasks: {
      displayName: "Operations_Tasks",
      url: "https://scpng1.sharepoint.com/sites/scpngintranet/Lists/Operations_Tasks/AllItems.aspx",
      schema: {
        Title: "Text (Task Title)",
        Description: "Note (Task Description)",
        Status: "Choice (Todo, In Progress, Review, Done)",
        Priority: "Choice (Low, Medium, High, Urgent)",
        DueDate: "DateTime (yyyy-MM-dd)",
        StartDate: "DateTime (yyyy-MM-dd)",
        Department: "Text (Unit Name/ID)",
        SubtasksJSON: "Note (JSON Array for Subtasks)",
        CommentsJSON: "Note (JSON Array for Comments)",
        Tags: "Text (Comma-separated keywords)",
        RelatedKRALookupId: "Lookup (Performance_KRAs)",
        RelatedKPILookupId: "Lookup (Performance_KPIs)",
        RelatedTaskGroupLookupId: "Lookup (Operations_TaskGroups)",
        Assignees: "Note (JSON Array for Assigned Users)",
        AttachmentsJSON: "Note (JSON Array for File Meta)"
      },
      sample: {
        Title: "Conduct Quarterly Risk Audit",
        Description: "Perform the mandatory Q1 2026 security and risk audit for IT systems.",
        Status: "In Progress",
        Priority: "High",
        DueDate: "2026-03-31",
        Department: "Technology Division",
        Tags: "audit,compliance,q1",
        SubtasksJSON: "[{\"title\":\"Check firewalls\",\"completed\":true},{\"title\":\"Review access logs\",\"completed\":false}]"
      }
    },
    kras: {
      displayName: "Performance_KRAs",
      url: "https://scpng1.sharepoint.com/sites/scpngintranet/Lists/Performance_KRAs/AllItems.aspx",
      schema: {
        Title: "Text (KRA Title)",
        Description: "Note (Detailed Description)",
        Status: "Choice (Open, In Progress, Closed)",
        Progress: "Number (0-100)",
        Unit: "Text (Owner Unit)",
        Division: "Text (Owner Division)",
        Responsible: "Text (Primary Owner Name)",
        Assignees: "Note (JSON Array for Project Team)",
        EndDate: "DateTime",
        UnitObjectiveLookupId: "Lookup (Unit_Objectives)"
      },
      sample: {
        Title: "Financial Stability & Compliance",
        Description: "Ensure all regulatory standards are met for market stability.",
        Status: "In Progress",
        Progress: 72,
        Unit: "Internal Audit",
        Division: "Executive Office",
        Responsible: "Sarah Miller",
        EndDate: "2026-12-31T00:00:00Z"
      }
    },
    kpis: {
      displayName: "Performance_KPIs",
      url: "https://scpng1.sharepoint.com/sites/scpngintranet/Lists/Performance_KPIs/AllItems.aspx",
      schema: {
        Title: "Text (Metric Name)",
        Metric: "Text (e.g., %, #, PGK)",
        ActualValue: "Number",
        TargetValue: "Number",
        Status: "Choice (On Track, At Risk, Behind, Completed)",
        Description: "Note (Calculation details)",
        StartDate: "DateTime",
        EndDate: "DateTime",
        CalculationType: "Choice (Manual, Sum, Average)",
        ChecklistJSON: "Note (JSON Array for sub-metrics)",
        RelatedKRALookupId: "Lookup (Performance_KRAs)"
      },
      sample: {
        Title: "% of Investigations Resolved",
        Metric: "%",
        ActualValue: 85,
        TargetValue: 90,
        Status: "On Track",
        Description: "Percentage of reported cases closed within 30 days.",
        CalculationType: "Manual"
      }
    },
    objectives: {
      displayName: "Unit_Objectives",
      url: "https://scpng1.sharepoint.com/sites/scpngintranet/Lists/Unit_Objectives/AllItems.aspx",
      schema: {
        Title: "Text (Objective Name)",
        Description: "Note",
        GoalType: "Choice (Org, Division, Unit, Individual)",
        Division: "Text",
        Unit: "Text",
        Progress: "Number (0-100)",
        Status: "Choice (On Track, At Risk, Completed, Not Started)",
        Owner: "Text (Responsible Name)",
        Year: "Text (e.g. 2026)",
        StartDate: "DateTime (yyyy-MM-dd)",
        EndDate: "DateTime (yyyy-MM-dd)",
        ParentGoalIdLookupId: "Lookup (Strategic_Objectives)"
      },
      sample: {
        Title: "Modernize Digital Archiving",
        Description: "Phase 1 implementation of the cloud archiving system.",
        GoalType: "Division",
        Division: "Corporate Services",
        Unit: "Records Management",
        Progress: 40,
        Status: "In Progress",
        Year: "2026",
        StartDate: "2026-01-01",
        EndDate: "2026-06-30"
      }
    }
  }
};

// ===== Types =====

interface ReportsTabProps {
  tasks: Task[];
  kras: KRA[];
  kpis: KPI[];
  objectives: Objective[];
  userContext: UserContext | null;
}

interface ReportMetrics {
  // Tasks
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  todoTasks: number;
  onHoldTasks: number;
  tasksByPriority: Record<string, number>;
  taskCompletionRate: number;
  // KRAs
  totalKRAs: number;
  activeKRAs: number;
  completedKRAs: number;
  atRiskKRAs: number;
  avgKRAProgress: number;
  // KPIs
  totalKPIs: number;
  onTrackKPIs: number;
  atRiskKPIs: number;
  behindKPIs: number;
  completedKPIs: number;
  kpiOnTrackPercentage: number;
  // Objectives
  totalObjectives: number;
  objectivesByStatus: Record<string, number>;
  avgObjectiveProgress: number;
}

type CategoryKey = ReportDataCategory;
type UnitGeneratedReport = GeneratedReport & {
  strategySnapshot: StrategyTraceabilityReport;
  archive: StoredStrategyReportArchive;
};

const unitReportFromArchive = (stored: StoredStrategyReportArchive): UnitGeneratedReport => ({
  id: stored.storageId,
  config: stored.record.presentationConfig as unknown as ReportConfig,
  title: stored.record.snapshot.title,
  generatedAt: stored.record.snapshot.generatedAt,
  generatedBy: stored.record.snapshot.generatedBy,
  sections: [],
  strategySnapshot: stored.record.snapshot,
  archive: stored,
});

const ALL_CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: 'tasks', label: 'Tasks / Daily Operations' },
  { key: 'kras', label: 'KRAs' },
  { key: 'kpis', label: 'KPIs' },
  { key: 'objectives', label: 'Objectives' },
];

const TIME_PERIOD_OPTIONS: { value: ReportTimePeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half-yearly', label: 'Half Yearly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom Date Range' },
];

const TIME_OPTIONS: { value: string; label: string }[] = [
  { value: '06:00', label: '6:00 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '17:00', label: '5:00 PM' },
];

const DAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const DAY_OF_MONTH_OPTIONS = Array.from({ length: 28 }, (_, i) => String(i + 1));

// ===== Helpers =====

function getDateRange(period: ReportTimePeriod): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case 'daily':
      start.setHours(0, 0, 0, 0);
      break;
    case 'weekly':
      start.setDate(end.getDate() - 7);
      break;
    case 'monthly':
      start.setMonth(end.getMonth() - 1);
      break;
    case 'quarterly':
      start.setMonth(end.getMonth() - 3);
      break;
    case 'half-yearly':
      start.setMonth(end.getMonth() - 6);
      break;
    case 'yearly':
      start.setFullYear(end.getFullYear() - 1);
      break;
    case 'custom':
      // Custom date range handled externally; return full range as fallback
      start.setMonth(end.getMonth() - 1);
      break;
  }

  return { start, end };
}

function isDateInRange(dateStr: string | Date | undefined, start: Date, end: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d >= start && d <= end;
}

function filterTasks(tasks: Task[], start: Date, end: Date): Task[] {
  return tasks.filter(t =>
    isDateInRange(t.dueDate, start, end) ||
    isDateInRange(t.startDate, start, end) ||
    isDateInRange(t.createdAt, start, end)
  );
}

function filterKRAs(kras: KRA[], start: Date, end: Date): KRA[] {
  return kras.filter(k =>
    isDateInRange(k.startDate, start, end) ||
    isDateInRange(k.endDate, start, end) ||
    isDateInRange(k.createdAt, start, end)
  );
}

function filterKPIs(kpis: KPI[], start: Date, end: Date): KPI[] {
  return kpis.filter(k =>
    isDateInRange(k.startDate, start, end) ||
    isDateInRange(k.date, start, end)
  );
}

function filterObjectives(objectives: Objective[], start: Date, end: Date): Objective[] {
  return objectives.filter(o =>
    isDateInRange(o.startDate, start, end) ||
    isDateInRange(o.endDate, start, end)
  );
}

function computeMetrics(
  tasks: Task[], kras: KRA[], kpis: KPI[], objectives: Objective[]
): ReportMetrics {
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'done').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
  const todoTasks = tasks.filter(t => t.status === 'todo').length;
  const onHoldTasks = tasks.filter(t => t.status === 'on-hold').length;
  const now = new Date();
  const overdueTasks = tasks.filter(t => {
    if (t.status === 'completed' || t.status === 'done') return false;
    return t.dueDate && new Date(t.dueDate) < now;
  }).length;

  const tasksByPriority: Record<string, number> = {};
  tasks.forEach(t => {
    tasksByPriority[t.priority] = (tasksByPriority[t.priority] || 0) + 1;
  });

  const activeKRAs = kras.filter(k => k.status === 'in-progress' || k.status === 'open').length;
  const completedKRAs = kras.filter(k => k.status === 'closed').length;
  const atRiskKRAs = kras.filter(k => k.progress !== undefined && k.progress < 30 && k.status !== 'closed').length;
  const avgKRAProgress = kras.length > 0
    ? Math.round(kras.reduce((sum, k) => sum + (k.progress || 0), 0) / kras.length)
    : 0;

  const onTrackKPIs = kpis.filter(k => k.status === 'on-track' || k.status === 'completed').length;
  const atRiskKPIs = kpis.filter(k => k.status === 'at-risk').length;
  const behindKPIs = kpis.filter(k => k.status === 'behind').length;
  const completedKPIs = kpis.filter(k => k.status === 'completed').length;

  const objectivesByStatus: Record<string, number> = {};
  objectives.forEach(o => {
    const s = o.status || 'unknown';
    objectivesByStatus[s] = (objectivesByStatus[s] || 0) + 1;
  });
  const avgObjectiveProgress = objectives.length > 0
    ? Math.round(objectives.reduce((sum, o) => sum + (o.progress || 0), 0) / objectives.length)
    : 0;

  return {
    totalTasks: tasks.length,
    completedTasks,
    inProgressTasks,
    overdueTasks,
    todoTasks,
    onHoldTasks,
    tasksByPriority,
    taskCompletionRate: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0,
    totalKRAs: kras.length,
    activeKRAs,
    completedKRAs,
    atRiskKRAs,
    avgKRAProgress,
    totalKPIs: kpis.length,
    onTrackKPIs,
    atRiskKPIs,
    behindKPIs,
    completedKPIs,
    kpiOnTrackPercentage: kpis.length > 0 ? Math.round((onTrackKPIs / kpis.length) * 100) : 0,
    totalObjectives: objectives.length,
    objectivesByStatus,
    avgObjectiveProgress,
  };
}

function metricsFromStrategySnapshot(report: StrategyTraceabilityReport): ReportMetrics {
  const rows = report.sections.find(section => section.id === 'traceability')?.rows || [];
  const taskRows = rows.filter(row => row.entityType === 'task');
  const kraRows = rows.filter(row => row.entityType === 'performance_kra');
  const kpiRows = rows.filter(row => row.entityType === 'kpi');
  const objectiveRows = rows.filter(row => row.entityType === 'objective');
  const completedTasks = taskRows.filter(row => ['completed', 'done'].includes(row.status || '')).length;
  const tasksByPriority = taskRows.reduce((counts, row) => {
    if (row.priority) counts[row.priority] = (counts[row.priority] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  const objectiveStatuses = objectiveRows.reduce((counts, row) => {
    const status = row.status || 'unknown';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  const average = (values: Array<number | undefined>) => {
    const available = values.filter((value): value is number => value !== undefined);
    return available.length ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length) : 0;
  };
  const onTrack = (status?: string) => ['on_track', 'completed'].includes(status || '');
  return {
    totalTasks: taskRows.length,
    completedTasks,
    inProgressTasks: taskRows.filter(row => row.status === 'in-progress').length,
    overdueTasks: report.sections.find(section => section.id === 'overdue')?.rows.length || 0,
    todoTasks: taskRows.filter(row => row.status === 'todo').length,
    onHoldTasks: taskRows.filter(row => row.status === 'on-hold').length,
    tasksByPriority,
    taskCompletionRate: taskRows.length ? Math.round((completedTasks / taskRows.length) * 100) : 0,
    totalKRAs: kraRows.length,
    activeKRAs: kraRows.filter(row => !['completed', 'closed', 'done'].includes(row.status || '')).length,
    completedKRAs: kraRows.filter(row => ['completed', 'closed', 'done'].includes(row.status || '')).length,
    atRiskKRAs: kraRows.filter(row => ['behind_or_early'].includes(row.statusBand || '')).length,
    avgKRAProgress: average(kraRows.map(row => row.progress)),
    totalKPIs: kpiRows.length,
    onTrackKPIs: kpiRows.filter(row => onTrack(row.statusBand)).length,
    atRiskKPIs: kpiRows.filter(row => row.statusBand === 'behind_or_early').length,
    behindKPIs: kpiRows.filter(row => row.statusBand === 'behind_or_early').length,
    completedKPIs: kpiRows.filter(row => row.statusBand === 'completed').length,
    kpiOnTrackPercentage: kpiRows.length
      ? Math.round((kpiRows.filter(row => onTrack(row.statusBand)).length / kpiRows.length) * 100)
      : 0,
    totalObjectives: objectiveRows.length,
    objectivesByStatus: objectiveStatuses,
    avgObjectiveProgress: average(objectiveRows.map(row => row.progress)),
  };
}

function buildTitle(period: ReportTimePeriod, categories: CategoryKey[]): string {
  const periodLabel = TIME_PERIOD_OPTIONS.find(o => o.value === period)?.label || period;
  if (categories.length === ALL_CATEGORIES.length) {
    return `${periodLabel} Comprehensive Report`;
  }
  const catLabels = categories.map(c => ALL_CATEGORIES.find(a => a.key === c)?.label || c);
  return `${periodLabel} ${catLabels.join(' & ')} Report`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-PG', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ===== Report Preview =====

interface ReportPreviewProps {
  report: UnitGeneratedReport;
  metrics: ReportMetrics;
  categories: CategoryKey[];
  unitName: string;
  onPrint: () => void;
  onExportCSV: () => void;
}

const ReportPreview: React.FC<ReportPreviewProps> = ({
  report, metrics, categories, unitName, onPrint, onExportCSV
}) => {
  const snapshot = report.strategySnapshot;
  const traceabilityRows = snapshot.sections.find(section => section.id === 'traceability')?.rows || [];
  const today = formatDate(new Date(report.generatedAt));

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onExportCSV}>
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onPrint}>
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>
      </div>

      <div className="border rounded-xl font-sans overflow-hidden print:shadow-none border-gray-200 dark:border-white/10 shadow-sm transition-all duration-300">
        {/* Header */}
        <div className="bg-[#83002A] text-white p-6 print:p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{report.title}</h1>
              <p className="text-white/80 text-sm mt-1">
                {unitName} &middot; Generated: {today}
              </p>
            </div>
            <div className="text-right">
              <div className="text-white/70 text-xs">Period</div>
              <div className="font-semibold capitalize">
                {report.config.timePeriod.replace('-', ' ')} Report
              </div>
              <div className="text-white/70 text-xs mt-1">
                {formatDate(new Date(report.config.dateRange.start))} &mdash; {formatDate(new Date(report.config.dateRange.end))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 bg-white dark:bg-gray-950 print:p-4">
          <section className="grid gap-2 rounded-lg border bg-muted/20 p-3 text-xs md:grid-cols-2">
            <p><strong>Scope:</strong> {snapshot.scope} — {snapshot.snapshot.scopeLabel}</p>
            <p><strong>Diagnostics:</strong> {snapshot.summary.diagnosticCount}</p>
            <p className="md:col-span-2"><strong>Source:</strong> {snapshot.snapshot.dataSourceSummary}</p>
            <p className="md:col-span-2"><strong>Formula:</strong> {snapshot.snapshot.progressFormula}</p>
          </section>

          {/* Executive Summary */}
          <section>
            <h2 className="text-base font-bold mb-3 flex items-center gap-2 text-[#83002A]">
              <BarChart2 className="h-4 w-4" />
              Executive Summary
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {categories.includes('tasks') && (
                <div className="border border-gray-100 dark:border-white/10 rounded-xl p-4 bg-white dark:bg-gray-900/50 transition-all hover:bg-gray-50 dark:hover:bg-gray-900/80 group">
                  <div className="flex items-center gap-1.5 text-green-600 mb-1">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Task Completion</span>
                  </div>
                  <div className="text-2xl font-bold">{metrics.taskCompletionRate}%</div>
                  <div className="text-xs text-muted-foreground">{metrics.completedTasks}/{metrics.totalTasks} tasks</div>
                </div>
              )}
              {categories.includes('kras') && (
                <div className="border border-gray-100 dark:border-white/10 rounded-xl p-4 bg-white dark:bg-gray-900/50 transition-all hover:bg-gray-50 dark:hover:bg-gray-900/80 group">
                  <div className="flex items-center gap-1.5 text-purple-600 mb-1">
                    <Target className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Active KRAs</span>
                  </div>
                  <div className="text-2xl font-bold">{metrics.activeKRAs}</div>
                  <div className="text-xs text-muted-foreground">Avg progress: {metrics.avgKRAProgress}%</div>
                </div>
              )}
              {categories.includes('kpis') && (
                <div className="border border-gray-100 dark:border-white/10 rounded-xl p-4 bg-white dark:bg-gray-900/50 transition-all hover:bg-gray-50 dark:hover:bg-gray-900/80 group">
                  <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">KPIs On Track</span>
                  </div>
                  <div className="text-2xl font-bold">{metrics.kpiOnTrackPercentage}%</div>
                  <div className="text-xs text-muted-foreground">{metrics.onTrackKPIs}/{metrics.totalKPIs} KPIs</div>
                </div>
              )}
              {categories.includes('objectives') && (
                <div className="border border-gray-100 dark:border-white/10 rounded-xl p-4 bg-white dark:bg-gray-900/50 transition-all hover:bg-gray-50 dark:hover:bg-gray-900/80 group">
                  <div className="flex items-center gap-1.5 text-orange-600 mb-1">
                    <Flag className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Objectives</span>
                  </div>
                  <div className="text-2xl font-bold">{metrics.totalObjectives}</div>
                  <div className="text-xs text-muted-foreground">Avg progress: {metrics.avgObjectiveProgress}%</div>
                </div>
              )}
            </div>
          </section>

          {/* Tasks Section */}
          {categories.includes('tasks') && (
            <>
              <Separator />
              <section>
                <h2 className="text-base font-bold mb-3 flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-green-600" />
                  Task Performance
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Status Breakdown</h3>
                    <div className="space-y-2">
                      {[
                        { label: 'Completed', value: metrics.completedTasks, color: 'bg-green-500' },
                        { label: 'In Progress', value: metrics.inProgressTasks, color: 'bg-blue-500' },
                        { label: 'To Do', value: metrics.todoTasks, color: 'bg-gray-400' },
                        { label: 'On Hold', value: metrics.onHoldTasks, color: 'bg-yellow-500' },
                        { label: 'Overdue', value: metrics.overdueTasks, color: 'bg-red-500' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="text-sm w-24">{item.label}</span>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-800/60 rounded-full h-2 overflow-hidden">
                            {metrics.totalTasks > 0 && (
                              <div
                                className={`h-full rounded-full ${item.color}`}
                                style={{ width: `${(item.value / metrics.totalTasks) * 100}%` }}
                              />
                            )}
                          </div>
                          <span className="text-sm font-medium w-8 text-right">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Priority Distribution</h3>
                    <div className="space-y-1.5 text-sm">
                      {['urgent', 'high', 'medium', 'low'].map(p => (
                        <div key={p} className="flex justify-between">
                          <span className="text-muted-foreground capitalize">{p}</span>
                          <span className="font-medium">{metrics.tasksByPriority[p] || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* KRAs Section */}
          {categories.includes('kras') && (
            <>
              <Separator />
              <section>
                <h2 className="text-base font-bold mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-purple-600" />
                  Key Result Areas
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Total', value: metrics.totalKRAs, color: 'text-foreground' },
                    { label: 'Active', value: metrics.activeKRAs, color: 'text-blue-600' },
                    { label: 'Completed', value: metrics.completedKRAs, color: 'text-green-600' },
                    { label: 'At Risk', value: metrics.atRiskKRAs, color: 'text-red-600' },
                  ].map((item, idx) => (
                    <div key={idx} className="border border-gray-100 dark:border-white/10 rounded-xl p-4 text-center bg-white dark:bg-gray-900/30 transition-all hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                      <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Average Progress</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800/60 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-500"
                      style={{ width: `${metrics.avgKRAProgress}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{metrics.avgKRAProgress}%</span>
                </div>
              </section>
            </>
          )}

          {/* KPIs Section */}
          {categories.includes('kpis') && (
            <>
              <Separator />
              <section>
                <h2 className="text-base font-bold mb-3 flex items-center gap-2">
                  <Crosshair className="h-4 w-4 text-blue-600" />
                  Key Performance Indicators
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Total', value: metrics.totalKPIs, color: 'text-foreground' },
                    { label: 'On Track', value: metrics.onTrackKPIs, color: 'text-green-600' },
                    { label: 'At Risk', value: metrics.atRiskKPIs, color: 'text-yellow-600' },
                    { label: 'Behind', value: metrics.behindKPIs, color: 'text-red-600' },
                  ].map((item, idx) => (
                    <div key={idx} className="border border-gray-100 dark:border-white/10 rounded-xl p-4 text-center bg-white dark:bg-gray-900/30 transition-all hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                      <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">On Track Rate</span>
                  <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${metrics.kpiOnTrackPercentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{metrics.kpiOnTrackPercentage}%</span>
                </div>
              </section>
            </>
          )}

          {/* Objectives Section */}
          {categories.includes('objectives') && (
            <>
              <Separator />
              <section>
                <h2 className="text-base font-bold mb-3 flex items-center gap-2">
                  <Flag className="h-4 w-4 text-orange-600" />
                  Objectives
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Status Distribution</h3>
                    <div className="space-y-1.5 text-sm">
                      {Object.entries(metrics.objectivesByStatus).map(([status, count]) => (
                        <div key={status} className="flex justify-between">
                          <span className="text-muted-foreground capitalize">{status}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                      {Object.keys(metrics.objectivesByStatus).length === 0 && (
                        <div className="text-muted-foreground">No objectives in this period</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Progress Overview</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">Average</span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-800/60 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-orange-500"
                          style={{ width: `${metrics.avgObjectiveProgress}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold">{metrics.avgObjectiveProgress}%</span>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {metrics.totalObjectives} objective{metrics.totalObjectives !== 1 ? 's' : ''} in period
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          <Separator />
          <section>
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-[#83002A]" />
              Strategy Traceability
            </h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[760px] text-xs">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-2 font-semibold">Type</th>
                    <th className="p-2 font-semibold">Hierarchy</th>
                    <th className="p-2 font-semibold">Owner</th>
                    <th className="p-2 font-semibold text-right">Progress</th>
                    <th className="p-2 font-semibold text-right">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {traceabilityRows.map((row, index) => (
                    <tr key={`${row.entityType}:${row.entityId}:${index}`} className="border-t align-top">
                      <td className="p-2 capitalize">{row.entityType.replace(/_/g, ' ')}</td>
                      <td className="p-2">
                        <div className="font-medium">{row.title}</div>
                        {row.parentPath && <div className="mt-0.5 text-muted-foreground">{row.parentPath}</div>}
                      </td>
                      <td className="p-2">{row.ownerName || 'Unassigned'}</td>
                      <td className="p-2 text-right">{row.progress === undefined ? '—' : `${Math.round(row.progress)}%`}</td>
                      <td className="p-2 text-right">{row.evidenceCount || 0}</td>
                    </tr>
                  ))}
                  {traceabilityRows.length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No traceability rows in this reporting scope.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <Separator />

          <StrategyGovernanceSections report={snapshot} deliveryHistory={report.archive.record.deliveryHistory} />

          {/* Footer */}
          <div className="text-xs text-muted-foreground text-center pt-4 border-t dark:border-white/10">
            Confidential &mdash; {unitName} &middot; Generated {today} &middot; SCPNG Intranet
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== Main Reports Tab =====

export const ReportsTab: React.FC<ReportsTabProps> = ({
  tasks, kras, kpis, objectives, userContext
}) => {
  const { instance: msalInstance } = useMsal();
  const { isAdmin } = useRoleBasedAuth();

  const [timePeriod, setTimePeriod] = useState<ReportTimePeriod>('monthly');
  const [selectedCategories, setSelectedCategories] = useState<CategoryKey[]>(['tasks', 'kras', 'kpis', 'objectives']);
  const [generating, setGenerating] = useState(false);
  const [isGeneratorExpanded, setIsGeneratorExpanded] = useState(false);
  const [isScheduleExpanded, setIsScheduleExpanded] = useState(false);
  const [currentReport, setCurrentReport] = useState<UnitGeneratedReport | null>(null);
  const [reportHistory, setReportHistory] = useState<UnitGeneratedReport[]>([]);
  const graphState = useStrategyExecutionGraph({
    scope: 'unit',
    ownerEmail: userContext?.email,
    ownerName: userContext?.name,
    division: userContext?.division,
    unit: userContext?.unit,
    role: userContext?.role,
  });

  useEffect(() => {
    let active = true;
    const loadReportHistory = async () => {
      if (!userContext?.email) return;
      try {
        const graphClient = await getGraphClient(msalInstance);
        if (!graphClient) throw new Error('No Graph client');
        const opsService = new SharePointOpsService(graphClient);
        await opsService.initialize();
        const history = await createSharePointStrategyReportArchiveService(opsService).history(20);
        if (active) setReportHistory(history.map(unitReportFromArchive));
      } catch (error) {
        console.error('Failed to load persisted Unit report history:', error);
      }
    };
    loadReportHistory();
    return () => { active = false; };
  }, [userContext?.email, msalInstance]);

  // Schedule state
  const [scheduleActive, setScheduleActive] = useState(false);
  const [schedulePeriod, setSchedulePeriod] = useState<ReportTimePeriod>('weekly');
  const [scheduleCategories, setScheduleCategories] = useState<CategoryKey[]>(['tasks', 'kras', 'kpis', 'objectives']);
  const [scheduleTime, setScheduleTime] = useState('07:00');
  const [scheduleDay, setScheduleDay] = useState('Monday');
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState('1');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleNextSend, setScheduleNextSend] = useState<string | null>(null);
  const [scheduleManagerEmail, setScheduleManagerEmail] = useState('');

  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isOneTime, setIsOneTime] = useState(true);
  const [rollingWindowDays, setRollingWindowDays] = useState('30');
  const [customIntervalDays, setCustomIntervalDays] = useState('14');

  // Manage all schedules state
  const [allSchedules, setAllSchedules] = useState<any[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [schedulesExpanded, setSchedulesExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Track which schedule is being edited from the admin panel
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editingScheduleEmail, setEditingScheduleEmail] = useState<string | null>(null);
  const [editingScheduleName, setEditingScheduleName] = useState<string | null>(null);

  // Load existing schedule on mount
  useEffect(() => {
    const loadSchedule = async () => {
      if (!userContext?.email) { setScheduleLoading(false); return; }
      try {
        const graphClient = await getGraphClient(msalInstance);
        if (!graphClient) { setScheduleLoading(false); return; }
        const opsService = new SharePointOpsService(graphClient);
        await opsService.initialize();
        const existing = await opsService.getReportSchedule(userContext.email, 'unit');
        if (existing) {
          setScheduleActive(existing.IsActive === 'true');
          setSchedulePeriod((existing.TimePeriod as ReportTimePeriod) || 'weekly');
          setScheduleTime(existing.PreferredTime || '07:00');
          setScheduleDay(existing.PreferredDay || 'Monday');
          setScheduleDayOfMonth(existing.PreferredDayOfMonth || '1');
          setScheduleManagerEmail(existing.ManagerEmail || '');
          if (existing.Categories) {
            try { setScheduleCategories(JSON.parse(existing.Categories)); } catch {}
          }
          // Custom date range fields
          if (existing.TimePeriod === 'custom') {
            setIsOneTime(existing.IsOneTime === 'true');
            setCustomStartDate(existing.CustomStartDate || '');
            setCustomEndDate(existing.CustomEndDate || '');
            setRollingWindowDays(existing.RollingWindowDays || '30');
            setCustomIntervalDays(existing.CustomIntervalDays || '14');
          }
          if (existing.NextSendAt) {
            setScheduleNextSend(new Date(existing.NextSendAt).toLocaleString('en-PG', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            }));
          }
        }
      } catch (e) {
        console.error('Failed to load report schedule:', e);
      } finally {
        setScheduleLoading(false);
      }
    };
    loadSchedule();
  }, [userContext?.email, msalInstance]);

  const handleSaveSchedule = async () => {
    if (!userContext?.email) return;
    setScheduleSaving(true);
    try {
      const graphClient = await getGraphClient(msalInstance);
      if (!graphClient) throw new Error('No Graph client');
      const opsService = new SharePointOpsService(graphClient);
      await opsService.initialize();

      // When editing a specific schedule from the admin panel, use its id/email
      const targetEmail = editingScheduleEmail || userContext.email;
      const targetName = editingScheduleName || userContext.name || userContext.email;

      const result = await opsService.saveReportSchedule({
        userEmail: targetEmail,
        userName: targetName,
        division: userContext.division || '',
        unit: userContext.unit || '',
        scope: 'unit',
        timePeriod: schedulePeriod,
        categories: scheduleCategories,
        isActive: scheduleActive,
        preferredTime: scheduleTime,
        preferredDay: scheduleDay,
        preferredDayOfMonth: scheduleDayOfMonth,
        managerEmail: scheduleManagerEmail,
        itemId: editingScheduleId || undefined,
        ...(schedulePeriod === 'custom' ? {
          customStartDate: customStartDate || undefined,
          customEndDate: customEndDate || undefined,
          rollingWindowDays: isOneTime ? undefined : rollingWindowDays,
          customIntervalDays: isOneTime ? undefined : customIntervalDays,
          isOneTime,
        } : {}),
      });

      if (result.NextSendAt) {
        setScheduleNextSend(new Date(result.NextSendAt).toLocaleString('en-PG', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }));
      }

      toast.success('Report schedule saved successfully');
      // Clear admin edit context after successful save
      setEditingScheduleId(null);
      setEditingScheduleEmail(null);
      setEditingScheduleName(null);
    } catch (e: any) {
      console.error('Failed to save report schedule:', e);
      toast.error(e.message || 'Failed to save schedule');
    } finally {
      setScheduleSaving(false);
    }
  };

  const loadAllSchedules = async () => {
    setSchedulesLoading(true);
    try {
      const graphClient = await getGraphClient(msalInstance);
      if (!graphClient) throw new Error('No Graph client');
      const opsService = new SharePointOpsService(graphClient);
      await opsService.initialize();
      const schedules = await opsService.getAllReportSchedules();
      const mySchedules = schedules.filter((s: any) =>
        s.UserEmail?.toLowerCase() === userContext?.email?.toLowerCase()
      );
      setAllSchedules(mySchedules);
    } catch (e: any) {
      console.error('Failed to load schedules:', e);
      toast.error('Failed to load schedules');
    } finally {
      setSchedulesLoading(false);
    }
  };

  const handleDeleteSchedule = async (itemId: string, userName: string) => {
    if (!confirm(`Delete schedule for ${userName}?`)) return;
    setDeletingId(itemId);
    try {
      const graphClient = await getGraphClient(msalInstance);
      if (!graphClient) throw new Error('No Graph client');
      const opsService = new SharePointOpsService(graphClient);
      await opsService.initialize();
      await opsService.deleteReportSchedule(itemId);
      setAllSchedules(prev => prev.filter(s => s.id !== itemId));
      toast.success(`Schedule for ${userName} deleted`);
    } catch (e: any) {
      console.error('Failed to delete schedule:', e);
      toast.error(e.message || 'Failed to delete schedule');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditSchedule = (schedule: any) => {
    // Track the specific schedule being edited
    setEditingScheduleId(schedule.id);
    setEditingScheduleEmail(schedule.UserEmail);
    setEditingScheduleName(schedule.Title || schedule.UserEmail);
    // Populate the schedule form with this user's data
    setScheduleActive(schedule.IsActive === 'true');
    setSchedulePeriod((schedule.TimePeriod as ReportTimePeriod) || 'weekly');
    setScheduleTime(schedule.PreferredTime || '07:00');
    setScheduleDay(schedule.PreferredDay || 'Monday');
    setScheduleDayOfMonth(schedule.PreferredDayOfMonth || '1');
    setScheduleManagerEmail(schedule.ManagerEmail || '');
    if (schedule.Categories) {
      try { setScheduleCategories(JSON.parse(schedule.Categories)); } catch {}
    }
    // Custom date range fields
    if (schedule.TimePeriod === 'custom') {
      setIsOneTime(schedule.IsOneTime === 'true');
      setCustomStartDate(schedule.CustomStartDate || '');
      setCustomEndDate(schedule.CustomEndDate || '');
      setRollingWindowDays(schedule.RollingWindowDays || '30');
      setCustomIntervalDays(schedule.CustomIntervalDays || '14');
    } else {
      // Reset custom fields when editing a non-custom schedule
      setIsOneTime(true);
      setCustomStartDate('');
      setCustomEndDate('');
      setRollingWindowDays('30');
      setCustomIntervalDays('14');
    }
    if (schedule.NextSendAt) {
      setScheduleNextSend(new Date(schedule.NextSendAt).toLocaleString('en-PG', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }));
    }
    // Expand and scroll to the schedule form
    setIsScheduleExpanded(true);
    document.getElementById('schedule-form-card')?.scrollIntoView({ behavior: 'smooth' });
    toast.info(`Editing schedule for ${schedule.Title || schedule.UserEmail}`);
  };

  const toggleScheduleCategory = (key: CategoryKey) => {
    setScheduleCategories(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
  };

  const allSelected = selectedCategories.length === ALL_CATEGORIES.length;

  const toggleCategory = (key: CategoryKey) => {
    setSelectedCategories(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
  };

  const toggleAll = () => {
    setSelectedCategories(allSelected ? [] : ALL_CATEGORIES.map(c => c.key));
  };

  // Compute metrics for current report
  const currentMetrics = useMemo(() => {
    if (!currentReport) return null;
    return metricsFromStrategySnapshot(currentReport.strategySnapshot);
  }, [currentReport]);

  const handleGenerate = async () => {
    if (selectedCategories.length === 0) return;
    if (graphState.isLoading) { toast.info('The strategy graph is still loading.'); return; }
    if (graphState.error) { toast.error(`The strategy graph could not be loaded: ${graphState.error.message}`); return; }
    setGenerating(true);
    try {
      let { start, end } = getDateRange(timePeriod);
      if (timePeriod === 'custom') {
        if (!customStartDate || !customEndDate) throw new Error('Choose both custom report dates.');
        start = new Date(customStartDate);
        end = new Date(customEndDate);
        end.setUTCHours(23, 59, 59, 999);
      }
      const config: ReportConfig = {
        timePeriod, scope: 'unit', reportType: 'operations', divisionId: '',
        divisionName: userContext?.division, unitName: userContext?.unit,
        dateRange: { start: start.toISOString(), end: end.toISOString() },
        includeCharts: true, includeAISummary: false, categories: selectedCategories,
      };
      const title = buildTitle(timePeriod, selectedCategories);
      const strategySnapshot = buildStrategyReport(graphState.graph, {
        type: 'strategic-traceability', title,
        generatedBy: userContext?.name || userContext?.email || 'Unknown',
        scopeLabel: userContext?.unit || '', dateRange: config.dateRange,
      });
      const graphClient = await getGraphClient(msalInstance);
      if (!graphClient) throw new Error('The report archive is unavailable because no Graph client could be created.');
      const opsService = new SharePointOpsService(graphClient);
      await opsService.initialize();
      const stored = await createSharePointStrategyReportArchiveService(opsService).archive(
        strategySnapshot,
        config as unknown as Record<string, unknown>,
        { division: userContext?.division, unit: userContext?.unit },
      );
      const report: UnitGeneratedReport = {
        ...unitReportFromArchive(stored), config, title,
      };
      setCurrentReport(report);
      setReportHistory(prev => [report, ...prev.filter(item => item.id !== report.id)].slice(0, 20));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The report could not be generated.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyMetadata = () => {
    try {
      const metadata = JSON.stringify(SHAREPOINT_METADATA, null, 2);
      navigator.clipboard.writeText(metadata);
      toast.success("SharePoint metadata schema copied to clipboard", {
        description: "Includes list URLs, schemas, and sample data for Tasks, KRAs, KPIs, and Objectives."
      });
    } catch (err) {
      console.error('Failed to copy metadata:', err);
      toast.error('Failed to copy metadata to clipboard');
    }
  };

  const recordDeliveryEvent = async (
    report: UnitGeneratedReport,
    channel: 'download' | 'print',
    status: 'queued' | 'sent' | 'failed',
    error?: string,
  ) => {
    const graphClient = await getGraphClient(msalInstance);
    if (!graphClient) throw new Error('No Graph client');
    const opsService = new SharePointOpsService(graphClient);
    await opsService.initialize();
    const stored = await createSharePointStrategyReportArchiveService(opsService).recordDelivery(
      report.archive.record,
      { channel, status, error },
    );
    const event = stored.record.event;
    const addEvent = (item: UnitGeneratedReport): UnitGeneratedReport => ({
      ...item,
      archive: {
        ...item.archive,
        record: { ...item.archive.record, deliveryHistory: [event, ...item.archive.record.deliveryHistory] },
      },
    });
    setCurrentReport(previous => previous?.id === report.id ? addEvent(previous) : previous);
    setReportHistory(previous => previous.map(item => item.id === report.id ? addEvent(item) : item));
  };

  const handlePrint = async () => {
    if (!currentReport) return;
    try {
      await recordDeliveryEvent(currentReport, 'print', 'queued');
      window.print();
      await recordDeliveryEvent(currentReport, 'print', 'sent');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Print audit failed.';
      try { await recordDeliveryEvent(currentReport, 'print', 'failed', message); } catch {}
      toast.error(`The report could not be printed with a complete audit trail: ${message}`);
    }
  };

  const handleExportCSV = async () => {
    if (!currentReport) return;
    try {
      await recordDeliveryEvent(currentReport, 'download', 'queued');
      const csv = strategyReportToCsv(currentReport.strategySnapshot);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentReport.title.replace(/\s+/g, '_')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      await recordDeliveryEvent(currentReport, 'download', 'sent');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSV export audit failed.';
      try { await recordDeliveryEvent(currentReport, 'download', 'failed', message); } catch {}
      toast.error(`The CSV could not be exported with a complete audit trail: ${message}`);
    }
  };

  const unitName = userContext?.unit || 'Unit';

  return (
    <div className="space-y-6 mt-4 px-1">
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            Unit Performance & Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate reports and manage automated dispatch schedules for your unit.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 bg-white/5 border-white/10 hover:bg-white/10 text-gray-300 transition-all duration-300"
              onClick={handleCopyMetadata}
            >
              <Copy className="h-4 w-4" />
              Copy List Metadata
            </Button>
          )}
        </div>
      </div>
      {/* Config Panel */}
      <Card className="dark:bg-gray-900 dark:border-white/10 shadow-sm overflow-hidden">
        <CardHeader
          className="pb-3 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
          onClick={() => setIsGeneratorExpanded(!isGeneratorExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-intranet-primary" />
                Report Generator
              </CardTitle>
              <CardDescription className="text-xs">
                Configure the time period and data categories to include in your report.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setIsGeneratorExpanded(!isGeneratorExpanded);
              }}
            >
              {isGeneratorExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </CardHeader>
        {isGeneratorExpanded && (
          <CardContent className="space-y-4 pt-0 border-t dark:border-white/10 mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Time Period */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Time Period
              </label>
              <Select value={timePeriod} onValueChange={v => setTimePeriod(v as ReportTimePeriod)}>
                <SelectTrigger className="dark:bg-gray-950 dark:border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-950 dark:border-white/10">
                  {TIME_PERIOD_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Categories */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5">
                <BarChart2 className="h-3.5 w-3.5" />
                Data Categories
              </label>
              <div className="space-y-2 border rounded-md p-3 dark:border-white/10 dark:bg-gray-950">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                    Select All
                  </label>
                </div>
                 <Separator className="dark:bg-white/10" />
                {ALL_CATEGORIES.map(cat => (
                  <div key={cat.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`cat-${cat.key}`}
                      className="dark:border-white/20"
                      checked={selectedCategories.includes(cat.key)}
                      onCheckedChange={() => toggleCategory(cat.key)}
                    />
                    <label htmlFor={`cat-${cat.key}`} className="text-sm cursor-pointer">
                      {cat.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || graphState.isLoading || selectedCategories.length === 0}
            className="w-full bg-[#83002A] hover:bg-[#5C001E] gap-2"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating Report...</>
            ) : (
              <><RefreshCw className="h-4 w-4" /> Generate Report</>
            )}
          </Button>
        </CardContent>
        )}
      </Card>

      {/* Schedule Reports */}
      <Card id="schedule-form-card" className="dark:bg-gray-900 dark:border-white/10 shadow-sm overflow-hidden">
        <CardHeader
          className="pb-3 border-b dark:border-white/10 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
          onClick={() => setIsScheduleExpanded(!isScheduleExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-intranet-primary" />
                {editingScheduleId ? `Editing Schedule: ${editingScheduleName}` : 'Schedule Recurring Reports'}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {editingScheduleId
                  ? `Editing schedule for ${editingScheduleEmail}. Save to apply changes.`
                  : 'Receive automated reports via email from automation@scpng.gov.pg at your preferred schedule.'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs text-muted-foreground">{scheduleActive ? 'Active' : 'Inactive'}</span>
                <Switch
                  checked={scheduleActive}
                  onCheckedChange={setScheduleActive}
                  disabled={scheduleLoading}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsScheduleExpanded(!isScheduleExpanded);
                }}
              >
                {isScheduleExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {isScheduleExpanded && (
          <CardContent className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {scheduleLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading schedule...
            </div>
          ) : (
            <>
              {/* Status banner */}
               {scheduleNextSend && scheduleActive && (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50 rounded-lg p-3 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-green-700" />
                  <div className="text-sm">
                    <span className="font-semibold text-green-800 dark:text-green-400">Next report: </span>
                    <span className="text-green-700 dark:text-green-500">{scheduleNextSend}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Period */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Frequency
                  </label>
                  <Select value={schedulePeriod} onValueChange={v => setSchedulePeriod(v as ReportTimePeriod)}>
                    <SelectTrigger className="dark:bg-gray-950 dark:border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-950 dark:border-white/10">
                      {TIME_PERIOD_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Time of day — hidden for custom (shown inside custom section instead) */}
                {schedulePeriod !== 'custom' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Preferred Time
                    </label>
                    <Select value={scheduleTime} onValueChange={setScheduleTime}>
                      <SelectTrigger className="dark:bg-gray-950 dark:border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-950 dark:border-white/10">
                        {TIME_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Day of week — only for weekly */}
                {schedulePeriod === 'weekly' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Day of Week</label>
                    <Select value={scheduleDay} onValueChange={setScheduleDay}>
                      <SelectTrigger className="dark:bg-gray-950 dark:border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-950 dark:border-white/10">
                        {DAY_OPTIONS.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Day of month — for monthly, quarterly, half-yearly, yearly */}
                {['monthly', 'quarterly', 'half-yearly', 'yearly'].includes(schedulePeriod) && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Day of Month</label>
                    <Select value={scheduleDayOfMonth} onValueChange={setScheduleDayOfMonth}>
                      <SelectTrigger className="dark:bg-gray-950 dark:border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-950 dark:border-white/10">
                        {DAY_OF_MONTH_OPTIONS.map(d => (
                          <SelectItem key={d} value={d}>{d}{['1','21'].includes(d) ? 'st' : ['2','22'].includes(d) ? 'nd' : ['3','23'].includes(d) ? 'rd' : 'th'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Custom Date Range Options */}
              {schedulePeriod === 'custom' && (
                <div className="space-y-3 rounded-lg border p-3 bg-intranet-primary/5 dark:bg-intranet-primary/10 dark:border-intranet-primary/20">
                  <div className="flex items-center gap-2 text-xs font-semibold text-intranet-primary dark:text-intranet-secondary">
                    <Calendar className="h-3.5 w-3.5" />
                    Custom Date Range Configuration
                  </div>

                  {/* One-Time vs Rolling toggle */}
                  <div className="flex gap-1 rounded-md bg-white dark:bg-gray-950 border dark:border-white/10 p-0.5">
                    <button
                      type="button"
                      onClick={() => setIsOneTime(true)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        isOneTime
                          ? 'bg-intranet-primary text-white shadow-md'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Calendar className="h-3 w-3" />
                      One-Time Report
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsOneTime(false)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        !isOneTime
                          ? 'bg-intranet-primary text-white shadow-md'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <RotateCw className="h-3 w-3" />
                      Rolling Window
                    </button>
                  </div>

                  {/* Send Time — shown inside custom section */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      Send Time
                    </label>
                    <Select value={scheduleTime} onValueChange={setScheduleTime}>
                      <SelectTrigger className="dark:bg-gray-950 dark:border-white/10 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-950 dark:border-white/10">
                        {TIME_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isOneTime ? (
                    <>
                      {/* One-time: Start + End date pickers */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Start Date</label>
                          <Input
                            type="date"
                            value={customStartDate}
                            onChange={e => setCustomStartDate(e.target.value)}
                            className="dark:bg-gray-950 dark:border-white/10 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium">End Date</label>
                          <Input
                            type="date"
                            value={customEndDate}
                            onChange={e => setCustomEndDate(e.target.value)}
                            className="dark:bg-gray-950 dark:border-white/10 text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 p-2">
                        <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          This report will send once at {TIME_OPTIONS.find(t => t.value === scheduleTime)?.label || scheduleTime} covering the selected date range, then automatically deactivate.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Rolling: window days + interval days */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Rolling Window (days)</label>
                          <Input
                            type="number"
                            min="1"
                            max="365"
                            value={rollingWindowDays}
                            onChange={e => setRollingWindowDays(e.target.value)}
                            placeholder="30"
                            className="dark:bg-gray-950 dark:border-white/10 text-xs"
                          />
                          <p className="text-[10px] text-muted-foreground">How many days back to include</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Send Every (days)</label>
                          <Input
                            type="number"
                            min="1"
                            max="365"
                            value={customIntervalDays}
                            onChange={e => setCustomIntervalDays(e.target.value)}
                            placeholder="14"
                            className="dark:bg-gray-950 dark:border-white/10 text-xs"
                          />
                          <p className="text-[10px] text-muted-foreground">Recurrence interval</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 rounded-md bg-intranet-primary/5 dark:bg-intranet-primary/10 border border-intranet-primary/20 p-2">
                        <Info className="h-3.5 w-3.5 text-intranet-primary dark:text-intranet-secondary mt-0.5 shrink-0" />
                        <p className="text-xs text-intranet-primary dark:text-intranet-secondary font-medium">
                          Every {customIntervalDays || '14'} days at {TIME_OPTIONS.find(t => t.value === scheduleTime)?.label || scheduleTime}, a report covering the last {rollingWindowDays || '30'} days will be sent.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Categories */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1.5">
                  <BarChart2 className="h-3.5 w-3.5" />
                  Report Categories
                </label>
                <div className="flex flex-wrap gap-3">
                  {ALL_CATEGORIES.map(cat => (
                    <div key={cat.key} className="flex items-center gap-1.5">
                       <Checkbox
                        id={`sched-cat-${cat.key}`}
                        className="dark:border-white/20 data-[state=checked]:bg-intranet-primary data-[state=checked]:border-intranet-primary"
                        checked={scheduleCategories.includes(cat.key)}
                        onCheckedChange={() => toggleScheduleCategory(cat.key)}
                      />
                      <label htmlFor={`sched-cat-${cat.key}`} className="text-sm cursor-pointer">
                        {cat.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* CC Manager (optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  CC Manager Email <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  type="email"
                  value={scheduleManagerEmail}
                  onChange={e => setScheduleManagerEmail(e.target.value)}
                  placeholder="e.g., manager@scpng.gov.pg"
                   className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-intranet-primary/20 dark:bg-gray-950 dark:border-white/10 dark:text-gray-100"
                />
              </div>

              <Button
                onClick={handleSaveSchedule}
                disabled={scheduleSaving || scheduleCategories.length === 0}
                className="w-full gap-2"
                variant={scheduleActive ? 'default' : 'outline'}
              >
                {scheduleSaving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Saving Schedule...</>
                ) : (
                  <><Save className="h-4 w-4" /> Save Schedule</>
                )}
              </Button>
            </>
          )}
        </CardContent>
        )}
      </Card>

      {/* Manage All Schedules */}
      <Card className="dark:bg-gray-900 dark:border-white/10 shadow-sm overflow-hidden">
        <CardHeader
          className="pb-3 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
          onClick={() => {
            if (!schedulesExpanded) loadAllSchedules();
            setSchedulesExpanded(!schedulesExpanded);
          }}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-intranet-primary" />
                Manage Report Schedules
              </CardTitle>
              <CardDescription className="text-xs">
                View, edit, or delete report schedules across the organization.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                if (!schedulesExpanded) loadAllSchedules();
                setSchedulesExpanded(!schedulesExpanded);
              }}
            >
              {schedulesExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </CardHeader>
        {schedulesExpanded && (
          <CardContent>
            {schedulesLoading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading schedules...
              </div>
            ) : allSchedules.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No report schedules found.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground mb-2">
                  {allSchedules.length} schedule{allSchedules.length !== 1 ? 's' : ''} found
                </div>
                <div className="border rounded-lg overflow-hidden dark:border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 dark:bg-gray-800/50 border-b dark:border-white/10">
                        <th className="text-left p-2.5 text-xs font-medium">User</th>
                        <th className="text-left p-2.5 text-xs font-medium">Unit</th>
                        <th className="text-left p-2.5 text-xs font-medium">Frequency</th>
                        <th className="text-left p-2.5 text-xs font-medium">Time</th>
                        <th className="text-left p-2.5 text-xs font-medium">Status</th>
                        <th className="text-left p-2.5 text-xs font-medium">Next Send</th>
                        <th className="text-right p-2.5 text-xs font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSchedules.map((sched) => (
                        <tr key={sched.id} className="border-b dark:border-white/10 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                          <td className="p-2.5">
                            <div className="font-medium text-xs">{sched.Title || '—'}</div>
                            <div className="text-xs text-muted-foreground">{sched.UserEmail}</div>
                          </td>
                          <td className="p-2.5 text-xs">{sched.Unit || '—'}</td>
                          <td className="p-2.5">
                            <Badge variant="outline" className="text-xs capitalize dark:border-white/20">
                              {sched.TimePeriod === 'custom'
                                ? (sched.IsOneTime === 'true' ? 'Custom (One-Time)' : 'Custom (Rolling)')
                                : (sched.TimePeriod || '—')}
                            </Badge>
                          </td>
                          <td className="p-2.5 text-xs">
                            {sched.PreferredTime || '—'}
                            {sched.TimePeriod === 'weekly' && sched.PreferredDay ? `, ${sched.PreferredDay}` : ''}
                            {['monthly', 'quarterly', 'half-yearly', 'yearly'].includes(sched.TimePeriod) && sched.PreferredDayOfMonth ? `, Day ${sched.PreferredDayOfMonth}` : ''}
                            {sched.TimePeriod === 'custom' && sched.IsOneTime !== 'true' && sched.CustomIntervalDays ? `, Every ${sched.CustomIntervalDays}d` : ''}
                          </td>
                          <td className="p-2.5">
                            <Badge
                              variant={sched.IsActive === 'true' ? 'default' : 'secondary'}
                              className={`text-xs ${sched.IsActive === 'true' ? 'bg-green-600' : 'dark:bg-gray-800 dark:text-gray-400'}`}
                            >
                              {sched.IsActive === 'true' ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="p-2.5 text-xs text-muted-foreground">
                            {sched.NextSendAt
                              ? new Date(sched.NextSendAt).toLocaleDateString('en-PG', {
                                  day: 'numeric', month: 'short', year: 'numeric'
                                })
                              : '—'}
                          </td>
                          <td className="p-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => handleEditSchedule(sched)}
                                title="Edit schedule"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteSchedule(sched.id, sched.Title || sched.UserEmail)}
                                disabled={deletingId === sched.id}
                                title="Delete schedule"
                              >
                                {deletingId === sched.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Report Preview */}
      {currentReport && currentMetrics && (
        <ReportPreview
          report={currentReport}
          metrics={currentMetrics}
          categories={currentReport.config.categories || []}
          unitName={unitName}
          onPrint={handlePrint}
          onExportCSV={handleExportCSV}
        />
      )}

      {/* Report History */}
      {reportHistory.some(report => report.id !== currentReport?.id) && (
        <Card className="dark:bg-gray-900 dark:border-white/10 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reportHistory.filter(report => report.id !== currentReport?.id).map(rpt => (
                <div
                  key={rpt.id}
                  className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors dark:border-white/10 dark:bg-gray-900/50"
                  onClick={() => setCurrentReport(rpt)}
                >
                  <div>
                    <div className="text-sm font-medium">{rpt.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(rpt.generatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {(rpt.config.categories || []).map(c => (
                      <Badge key={c} variant="outline" className="text-xs capitalize">{c}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
