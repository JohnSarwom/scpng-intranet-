import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  FileText, Download, Printer, RefreshCw, Calendar, BarChart2,
  CheckCircle, Clock, Users, Target, TrendingUp, Loader2,
  Bell, Save, Mail, Pencil, Trash2, ChevronDown, ChevronUp, Info, RotateCw, Flag
} from 'lucide-react';
import {
  ReportConfig, ReportTimePeriod, ReportScope, ReportType, GeneratedReport, ReportDataCategory
} from '@/types/division.types';
import { UseDivisionDataReturn } from '@/hooks/useDivisionData';
import { DivisionMetrics } from '@/types/division.types';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { SharePointOpsService } from '@/services/sharePointOpsService';
import { toast } from 'sonner';
import useRoleBasedAuth from '@/hooks/useRoleBasedAuth';

// ===== Constants =====

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

// ===== Report Preview =====

interface ReportPreviewProps {
  report: GeneratedReport;
  data: UseDivisionDataReturn;
  metrics: DivisionMetrics;
  onPrint: () => void;
  onExportCSV: () => void;
}

const ReportPreview: React.FC<ReportPreviewProps> = ({ report, data, metrics, onPrint, onExportCSV }) => {
  const today = new Date().toLocaleDateString('en-PG', { day: '2-digit', month: 'long', year: 'numeric' });

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

      <div className="border rounded-xl overflow-hidden print:shadow-none">
        {/* Header */}
        <div className="bg-[#83002A] text-white p-6 print:p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{report.title}</h1>
              <p className="text-white/80 text-sm mt-1">
                {data.division?.name} &middot; Generated: {today}
              </p>
            </div>
            <div className="text-right">
              <div className="text-white/70 text-xs">Period</div>
              <div className="font-semibold capitalize">{report.config.timePeriod} Report</div>
              <div className="text-white/70 text-xs mt-1 capitalize">Scope: {report.config.scope}</div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 bg-white dark:bg-card print:p-4">
          {/* Executive Summary */}
          <section>
            <h2 className="text-base font-bold mb-3 flex items-center gap-2 text-[#83002A]">
              <BarChart2 className="h-4 w-4" />
              Executive Summary
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Task Completion', value: `${metrics.taskCompletionRate}%`, icon: CheckCircle, color: 'text-green-600' },
                { label: 'KPI On Track', value: `${metrics.kpiOnTrackPercentage}%`, icon: TrendingUp, color: 'text-blue-600' },
                { label: 'Active KRAs', value: metrics.activeKRAs, icon: Target, color: 'text-purple-600' },
                { label: 'Staff Count', value: metrics.staffCount, icon: Users, color: 'text-orange-600' },
              ].map((item, idx) => (
                <div key={idx} className="border rounded-lg p-3">
                  <div className={`flex items-center gap-1.5 ${item.color} mb-1`}>
                    <item.icon className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </div>
                  <div className="text-2xl font-bold">{item.value}</div>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          {/* Task Performance */}
          <section>
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Task Performance
            </h2>
            <div className="space-y-2">
              {[
                { label: 'Total Tasks', value: metrics.totalTasks, max: metrics.totalTasks },
                { label: 'Completed', value: metrics.completedTasks, max: metrics.totalTasks, color: 'bg-green-500' },
                { label: 'In Progress', value: metrics.inProgressTasks, max: metrics.totalTasks, color: 'bg-blue-500' },
                { label: 'Overdue', value: metrics.overdueTasks, max: metrics.totalTasks, color: 'bg-red-500' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-sm w-28">{item.label}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    {item.max > 0 && (
                      <div
                        className={`h-full rounded-full ${item.color || 'bg-[#83002A]'}`}
                        style={{ width: `${(item.value / item.max) * 100}%` }}
                      />
                    )}
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{item.value}</span>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          {/* KRA & KPI Status */}
          <section>
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-600" />
              KRA & KPI Status
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold mb-2">Key Result Areas</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Active KRAs</span><span className="font-medium">{metrics.activeKRAs}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span className="font-medium text-green-600">{metrics.completedKRAs}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">At Risk</span><span className="font-medium text-red-600">{metrics.atRiskKRAs}</span></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Key Performance Indicators</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total KPIs</span><span className="font-medium">{metrics.totalKPIs}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">On Track</span><span className="font-medium text-green-600">{metrics.kpiOnTrackPercentage}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Alignment Score</span><span className="font-medium">{metrics.strategicAlignmentScore}%</span></div>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Unit Comparison */}
          {metrics.unitComparisons.length > 0 && (
            <section>
              <h2 className="text-base font-bold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-orange-600" />
                Unit Performance Summary
              </h2>
              <div className="space-y-2">
                {metrics.unitComparisons.map(unit => (
                  <div key={unit.unitId} className="flex items-center gap-3">
                    <span className="text-sm w-32 truncate">{unit.unitName}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Tasks: {unit.taskCompletion}%</span>
                        <span className="text-muted-foreground">KRAs: {unit.kraProgress}%</span>
                      </div>
                      <Progress value={unit.overallScore} className="h-1.5" />
                    </div>
                    <span className="text-sm font-semibold w-12 text-right">{unit.overallScore}%</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="text-xs text-muted-foreground text-center pt-4 border-t">
            Confidential — {data.division?.name} &middot; Generated {today} &middot; SCPNG Intranet
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== Helpers =====

function buildReportTitle(config: ReportConfig): string {
  const period = config.timePeriod.charAt(0).toUpperCase() + config.timePeriod.slice(1);
  const scope = config.scope.charAt(0).toUpperCase() + config.scope.slice(1);
  const type = config.reportType.charAt(0).toUpperCase() + config.reportType.slice(1);
  return `${period} ${scope}-Level ${type} Report`;
}

function dayOrdinal(d: string): string {
  if (['1', '21'].includes(d)) return `${d}st`;
  if (['2', '22'].includes(d)) return `${d}nd`;
  if (['3', '23'].includes(d)) return `${d}rd`;
  return `${d}th`;
}

// ===== Main Component =====

interface DivisionReportsTabProps {
  data: UseDivisionDataReturn;
  metrics: DivisionMetrics;
}

export const DivisionReportsTab: React.FC<DivisionReportsTabProps> = ({ data, metrics }) => {
  const { instance: msalInstance } = useMsal();
  const { isAdmin } = useRoleBasedAuth();
  const reportRef = useRef<HTMLDivElement>(null);

  // Generator state
  const [timePeriod, setTimePeriod] = useState<ReportTimePeriod>('monthly');
  const [scope, setScope] = useState<ReportScope>('division');
  const [reportType, setReportType] = useState<ReportType>('performance');
  const [generating, setGenerating] = useState(false);
  const [currentReport, setCurrentReport] = useState<GeneratedReport | null>(null);
  const [reportHistory, setReportHistory] = useState<GeneratedReport[]>([]);
  const [isGeneratorExpanded, setIsGeneratorExpanded] = useState(false);

  // Schedule state
  const [isScheduleExpanded, setIsScheduleExpanded] = useState(false);
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
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editingScheduleEmail, setEditingScheduleEmail] = useState<string | null>(null);
  const [editingScheduleName, setEditingScheduleName] = useState<string | null>(null);

  const userContext = data.userContext;

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

      const targetEmail = editingScheduleEmail || userContext.email;
      const targetName = editingScheduleName || userContext.name || userContext.email;

      const result = await opsService.saveReportSchedule({
        userEmail: targetEmail,
        userName: targetName,
        division: data.division?.name || userContext.division || '',
        unit: data.division?.name || '',
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
    setEditingScheduleId(schedule.id);
    setEditingScheduleEmail(schedule.UserEmail);
    setEditingScheduleName(schedule.Title || schedule.UserEmail);
    setScheduleActive(schedule.IsActive === 'true');
    setSchedulePeriod((schedule.TimePeriod as ReportTimePeriod) || 'weekly');
    setScheduleTime(schedule.PreferredTime || '07:00');
    setScheduleDay(schedule.PreferredDay || 'Monday');
    setScheduleDayOfMonth(schedule.PreferredDayOfMonth || '1');
    setScheduleManagerEmail(schedule.ManagerEmail || '');
    if (schedule.Categories) {
      try { setScheduleCategories(JSON.parse(schedule.Categories)); } catch {}
    }
    if (schedule.TimePeriod === 'custom') {
      setIsOneTime(schedule.IsOneTime === 'true');
      setCustomStartDate(schedule.CustomStartDate || '');
      setCustomEndDate(schedule.CustomEndDate || '');
      setRollingWindowDays(schedule.RollingWindowDays || '30');
      setCustomIntervalDays(schedule.CustomIntervalDays || '14');
    } else {
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
    setIsScheduleExpanded(true);
    document.getElementById('div-schedule-form-card')?.scrollIntoView({ behavior: 'smooth' });
    toast.info(`Editing schedule for ${schedule.Title || schedule.UserEmail}`);
  };

  const toggleScheduleCategory = (key: CategoryKey) => {
    setScheduleCategories(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
  };

  const handleGenerate = async () => {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 900));

    const config: ReportConfig = {
      timePeriod,
      scope,
      reportType,
      divisionId: data.division?.id || '',
      divisionName: data.division?.name,
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      includeCharts: true,
      includeAISummary: false,
    };

    const report: GeneratedReport = {
      id: `rpt-${Date.now()}`,
      config,
      title: buildReportTitle(config),
      generatedAt: new Date().toISOString(),
      generatedBy: data.userContext.name,
      sections: [],
    };

    setCurrentReport(report);
    setReportHistory(prev => [report, ...prev.slice(0, 9)]);
    setGenerating(false);
  };

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Tasks', metrics.totalTasks],
      ['Completed Tasks', metrics.completedTasks],
      ['Task Completion Rate', `${metrics.taskCompletionRate}%`],
      ['Overdue Tasks', metrics.overdueTasks],
      ['Active KRAs', metrics.activeKRAs],
      ['At-Risk KRAs', metrics.atRiskKRAs],
      ['KPI On Track', `${metrics.kpiOnTrackPercentage}%`],
      ['Active Projects', metrics.activeProjects],
      ['Staff Count', metrics.staffCount],
      ['Strategic Alignment', `${metrics.strategicAlignmentScore}%`],
      ['Overall Performance', `${metrics.overallPerformanceScore}%`],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentReport?.title || 'division-report'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Tab Header */}
      <div className="px-1 mb-2">
        <h2 className="text-lg font-bold text-black dark:text-gray-100">
          Division Reports
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Generate and export comprehensive performance reports across various scopes and time periods.
        </p>
      </div>

      {/* ===== Report Generator ===== */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader
          className="pb-3 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
          onClick={() => setIsGeneratorExpanded(!isGeneratorExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#83002A]" />
                Report Generator
              </CardTitle>
              <CardDescription className="text-xs">
                Configure and generate reports at any scope and time period.
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
              {isGeneratorExpanded
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />
              }
            </Button>
          </div>
        </CardHeader>

        {isGeneratorExpanded && (
          <CardContent className="space-y-4 pt-0 border-t mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Time Period */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Time Period
                </label>
                <Select value={timePeriod} onValueChange={v => setTimePeriod(v as ReportTimePeriod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_PERIOD_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Scope Level */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Scope Level
                </label>
                <Select value={scope} onValueChange={v => setScope(v as ReportScope)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="division">Division</SelectItem>
                    <SelectItem value="unit">Unit</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Report Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1.5">
                  <BarChart2 className="h-3.5 w-3.5" />
                  Report Type
                </label>
                <Select value={reportType} onValueChange={v => setReportType(v as ReportType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="strategic">Strategic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full bg-[#83002A] hover:bg-[#5C001E] gap-2"
            >
              {generating
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating Report...</>
                : <><RefreshCw className="h-4 w-4" /> Generate Report</>
              }
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Generated Report Preview */}
      {currentReport && (
        <div ref={reportRef}>
          <ReportPreview
            report={currentReport}
            data={data}
            metrics={metrics}
            onPrint={handlePrint}
            onExportCSV={handleExportCSV}
          />
        </div>
      )}

      {/* Report History */}
      {reportHistory.length > 1 && (
        <Card>
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
                  className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setCurrentReport(rpt)}
                >
                  <div>
                    <div className="text-sm font-medium">{rpt.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(rpt.generatedAt).toLocaleString()}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{rpt.config.scope}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== Schedule Recurring Reports ===== */}
      <Card id="div-schedule-form-card" className="shadow-sm overflow-hidden">
        <CardHeader
          className="pb-3 border-b cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
          onClick={() => setIsScheduleExpanded(!isScheduleExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#83002A]" />
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
                {isScheduleExpanded
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                }
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
                {/* Next send banner */}
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
                  {/* Frequency */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Frequency
                    </label>
                    <Select value={schedulePeriod} onValueChange={v => setSchedulePeriod(v as ReportTimePeriod)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_PERIOD_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Preferred Time — hidden for custom */}
                  {schedulePeriod !== 'custom' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Preferred Time
                      </label>
                      <Select value={scheduleTime} onValueChange={setScheduleTime}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Day of week — weekly only */}
                  {schedulePeriod === 'weekly' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Day of Week</label>
                      <Select value={scheduleDay} onValueChange={setScheduleDay}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAY_OPTIONS.map(d => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Day of month — monthly, quarterly, half-yearly, yearly */}
                  {['monthly', 'quarterly', 'half-yearly', 'yearly'].includes(schedulePeriod) && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Day of Month</label>
                      <Select value={scheduleDayOfMonth} onValueChange={setScheduleDayOfMonth}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAY_OF_MONTH_OPTIONS.map(d => (
                            <SelectItem key={d} value={d}>{dayOrdinal(d)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Custom Date Range */}
                {schedulePeriod === 'custom' && (
                  <div className="space-y-3 rounded-lg border p-3 bg-[#83002A]/5 border-[#83002A]/20">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#83002A]">
                      <Calendar className="h-3.5 w-3.5" />
                      Custom Date Range Configuration
                    </div>

                    {/* One-Time vs Rolling toggle */}
                    <div className="flex gap-1 rounded-md bg-white dark:bg-gray-950 border p-0.5">
                      <button
                        type="button"
                        onClick={() => setIsOneTime(true)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                          isOneTime
                            ? 'bg-[#83002A] text-white shadow-md'
                            : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
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
                            ? 'bg-[#83002A] text-white shadow-md'
                            : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <RotateCw className="h-3 w-3" />
                        Rolling Window
                      </button>
                    </div>

                    {/* Send Time inside custom section */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        Send Time
                      </label>
                      <Select value={scheduleTime} onValueChange={setScheduleTime}>
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {isOneTime ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Start Date</label>
                            <Input
                              type="date"
                              value={customStartDate}
                              onChange={e => setCustomStartDate(e.target.value)}
                              className="text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium">End Date</label>
                            <Input
                              type="date"
                              value={customEndDate}
                              onChange={e => setCustomEndDate(e.target.value)}
                              className="text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2">
                          <Info className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                          <p className="text-xs text-amber-700">
                            This report will send once at {TIME_OPTIONS.find(t => t.value === scheduleTime)?.label || scheduleTime} covering the selected date range, then automatically deactivate.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
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
                              className="text-xs"
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
                              className="text-xs"
                            />
                            <p className="text-[10px] text-muted-foreground">Recurrence interval</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 rounded-md bg-[#83002A]/5 border border-[#83002A]/20 p-2">
                          <Info className="h-3.5 w-3.5 text-[#83002A] mt-0.5 shrink-0" />
                          <p className="text-xs text-[#83002A] font-medium">
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
                          id={`div-sched-cat-${cat.key}`}
                          checked={scheduleCategories.includes(cat.key)}
                          onCheckedChange={() => toggleScheduleCategory(cat.key)}
                        />
                        <label htmlFor={`div-sched-cat-${cat.key}`} className="text-sm cursor-pointer">
                          {cat.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CC Manager */}
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
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#83002A]/20"
                  />
                </div>

                <Button
                  onClick={handleSaveSchedule}
                  disabled={scheduleSaving || scheduleCategories.length === 0}
                  className="w-full gap-2"
                  variant={scheduleActive ? 'default' : 'outline'}
                >
                  {scheduleSaving
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving Schedule...</>
                    : <><Save className="h-4 w-4" /> Save Schedule</>
                  }
                </Button>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* ===== Manage Report Schedules ===== */}
      <Card className="shadow-sm overflow-hidden">
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
                <Users className="h-4 w-4 text-[#83002A]" />
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
              {schedulesExpanded
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />
              }
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
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left p-2.5 text-xs font-medium">User</th>
                        <th className="text-left p-2.5 text-xs font-medium">Unit / Division</th>
                        <th className="text-left p-2.5 text-xs font-medium">Frequency</th>
                        <th className="text-left p-2.5 text-xs font-medium">Time</th>
                        <th className="text-left p-2.5 text-xs font-medium">Status</th>
                        <th className="text-left p-2.5 text-xs font-medium">Next Send</th>
                        <th className="text-right p-2.5 text-xs font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSchedules.map((sched) => (
                        <tr key={sched.id} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                          <td className="p-2.5">
                            <div className="font-medium text-xs">{sched.Title || '—'}</div>
                            <div className="text-xs text-muted-foreground">{sched.UserEmail}</div>
                          </td>
                          <td className="p-2.5 text-xs">{sched.Unit || sched.Division || '—'}</td>
                          <td className="p-2.5">
                            <Badge variant="outline" className="text-xs capitalize">
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
                              className={`text-xs ${sched.IsActive === 'true' ? 'bg-green-600' : ''}`}
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
                                {deletingId === sched.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Trash2 className="h-3.5 w-3.5" />
                                }
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
    </div>
  );
};
