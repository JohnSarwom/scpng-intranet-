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
  ChevronDown, ChevronUp, Info, RotateCw
} from 'lucide-react';
import {
  ReportTimePeriod, ReportDataCategory, GeneratedReport, ReportConfig
} from '@/types/division.types';
import { Task, KRA, KPI, Objective, UserContext } from '@/types';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { SharePointOpsService } from '@/services/sharePointOpsService';
import { toast } from 'sonner';

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
  report: GeneratedReport;
  metrics: ReportMetrics;
  categories: CategoryKey[];
  unitName: string;
  onPrint: () => void;
  onExportCSV: () => void;
}

const ReportPreview: React.FC<ReportPreviewProps> = ({
  report, metrics, categories, unitName, onPrint, onExportCSV
}) => {
  const today = formatDate(new Date());

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

  const [timePeriod, setTimePeriod] = useState<ReportTimePeriod>('monthly');
  const [selectedCategories, setSelectedCategories] = useState<CategoryKey[]>(['tasks', 'kras', 'kpis', 'objectives']);
  const [generating, setGenerating] = useState(false);
  const [currentReport, setCurrentReport] = useState<GeneratedReport | null>(null);
  const [reportHistory, setReportHistory] = useState<GeneratedReport[]>([]);

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

  // Load existing schedule on mount
  useEffect(() => {
    const loadSchedule = async () => {
      if (!userContext?.email) { setScheduleLoading(false); return; }
      try {
        const graphClient = await getGraphClient(msalInstance);
        if (!graphClient) { setScheduleLoading(false); return; }
        const opsService = new SharePointOpsService(graphClient);
        await opsService.initialize();
        const existing = await opsService.getReportSchedule(userContext.email);
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

      const result = await opsService.saveReportSchedule({
        userEmail: userContext.email,
        userName: userContext.name || userContext.email,
        division: userContext.division || '',
        unit: userContext.unit || '',
        timePeriod: schedulePeriod,
        categories: scheduleCategories,
        isActive: scheduleActive,
        preferredTime: scheduleTime,
        preferredDay: scheduleDay,
        preferredDayOfMonth: scheduleDayOfMonth,
        managerEmail: scheduleManagerEmail,
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
      setAllSchedules(schedules);
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
    // Scroll to the schedule form
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
    const { start, end } = {
      start: new Date(currentReport.config.dateRange.start),
      end: new Date(currentReport.config.dateRange.end),
    };
    const cats = currentReport.config.categories || [];
    const fTasks = cats.includes('tasks') ? filterTasks(tasks, start, end) : [];
    const fKRAs = cats.includes('kras') ? filterKRAs(kras, start, end) : [];
    const fKPIs = cats.includes('kpis') ? filterKPIs(kpis, start, end) : [];
    const fObjs = cats.includes('objectives') ? filterObjectives(objectives, start, end) : [];
    return computeMetrics(fTasks, fKRAs, fKPIs, fObjs);
  }, [currentReport, tasks, kras, kpis, objectives]);

  const handleGenerate = async () => {
    if (selectedCategories.length === 0) return;
    setGenerating(true);
    await new Promise(r => setTimeout(r, 500));

    let { start, end } = getDateRange(timePeriod);
    // Override with custom dates if available
    if (timePeriod === 'custom' && customStartDate) {
      start = new Date(customStartDate);
    }
    if (timePeriod === 'custom' && customEndDate) {
      end = new Date(customEndDate);
    }
    const config: ReportConfig = {
      timePeriod,
      scope: 'unit',
      reportType: 'operations',
      divisionId: '',
      divisionName: userContext?.division,
      unitName: userContext?.unit,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      includeCharts: true,
      includeAISummary: false,
      categories: selectedCategories,
    };

    const report: GeneratedReport = {
      id: `rpt-${Date.now()}`,
      config,
      title: buildTitle(timePeriod, selectedCategories),
      generatedAt: new Date().toISOString(),
      generatedBy: userContext?.name || 'Unknown',
      sections: [],
    };

    setCurrentReport(report);
    setReportHistory(prev => [report, ...prev.slice(0, 9)]);
    setGenerating(false);
  };

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    if (!currentReport || !currentMetrics) return;
    const cats = currentReport.config.categories || [];
    const rows: (string | number)[][] = [['Metric', 'Value']];

    if (cats.includes('tasks')) {
      rows.push(
        ['--- Tasks ---', ''],
        ['Total Tasks', currentMetrics.totalTasks],
        ['Completed', currentMetrics.completedTasks],
        ['In Progress', currentMetrics.inProgressTasks],
        ['To Do', currentMetrics.todoTasks],
        ['On Hold', currentMetrics.onHoldTasks],
        ['Overdue', currentMetrics.overdueTasks],
        ['Completion Rate', `${currentMetrics.taskCompletionRate}%`],
        ['Priority - Urgent', currentMetrics.tasksByPriority['urgent'] || 0],
        ['Priority - High', currentMetrics.tasksByPriority['high'] || 0],
        ['Priority - Medium', currentMetrics.tasksByPriority['medium'] || 0],
        ['Priority - Low', currentMetrics.tasksByPriority['low'] || 0],
      );
    }
    if (cats.includes('kras')) {
      rows.push(
        ['--- KRAs ---', ''],
        ['Total KRAs', currentMetrics.totalKRAs],
        ['Active', currentMetrics.activeKRAs],
        ['Completed', currentMetrics.completedKRAs],
        ['At Risk', currentMetrics.atRiskKRAs],
        ['Avg Progress', `${currentMetrics.avgKRAProgress}%`],
      );
    }
    if (cats.includes('kpis')) {
      rows.push(
        ['--- KPIs ---', ''],
        ['Total KPIs', currentMetrics.totalKPIs],
        ['On Track', currentMetrics.onTrackKPIs],
        ['At Risk', currentMetrics.atRiskKPIs],
        ['Behind', currentMetrics.behindKPIs],
        ['On Track Rate', `${currentMetrics.kpiOnTrackPercentage}%`],
      );
    }
    if (cats.includes('objectives')) {
      rows.push(
        ['--- Objectives ---', ''],
        ['Total Objectives', currentMetrics.totalObjectives],
        ['Avg Progress', `${currentMetrics.avgObjectiveProgress}%`],
      );
      Object.entries(currentMetrics.objectivesByStatus).forEach(([status, count]) => {
        rows.push([`Status: ${status}`, count]);
      });
    }

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentReport.title.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const unitName = userContext?.unit || 'Unit';

  return (
    <div className="space-y-6 mt-4">
      {/* Config Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Report Generator
          </CardTitle>
          <CardDescription className="text-xs">
            Configure the time period and data categories to include in your report.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            disabled={generating || selectedCategories.length === 0}
            className="w-full bg-[#83002A] hover:bg-[#5C001E] gap-2"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating Report...</>
            ) : (
              <><RefreshCw className="h-4 w-4" /> Generate Report</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Schedule Reports */}
      <Card id="schedule-form-card" className="dark:bg-gray-900 dark:border-white/10">
        <CardHeader className="pb-3 border-b dark:border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Schedule Recurring Reports
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Receive automated reports via email from automation@scpng.gov.pg at your preferred schedule.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{scheduleActive ? 'Active' : 'Inactive'}</span>
              <Switch
                checked={scheduleActive}
                onCheckedChange={setScheduleActive}
                disabled={scheduleLoading}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {scheduleLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading schedule...
            </div>
          ) : (
            <>
              {/* Status banner */}
              {scheduleNextSend && scheduleActive && (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-green-600" />
                  <div className="text-sm">
                    <span className="font-medium text-green-700 dark:text-green-400">Next report: </span>
                    <span className="text-green-600 dark:text-green-500">{scheduleNextSend}</span>
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
                <div className="space-y-3 rounded-lg border p-3 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900/30">
                  <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-400">
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
                          ? 'bg-blue-600 text-white shadow-sm'
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
                          ? 'bg-blue-600 text-white shadow-sm'
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
                      <div className="flex items-start gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 p-2">
                        <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-700 dark:text-blue-300">
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
                        className="dark:border-white/20"
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
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/20 dark:bg-gray-950 dark:border-white/10 dark:text-gray-100"
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
      </Card>

      {/* Manage All Schedules */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Manage Report Schedules
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                View, edit, or delete report schedules across the organization.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!schedulesExpanded) loadAllSchedules();
                setSchedulesExpanded(!schedulesExpanded);
              }}
              className="gap-1.5"
            >
              {schedulesExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {schedulesExpanded ? 'Hide' : 'View All'}
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
      {reportHistory.length > 1 && (
        <Card className="dark:bg-gray-900 dark:border-white/10 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reportHistory.slice(1).map(rpt => (
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
