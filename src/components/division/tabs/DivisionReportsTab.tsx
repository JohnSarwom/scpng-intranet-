import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { useStrategyExecutionGraph } from '@/hooks/useStrategyExecutionGraph';
import { buildStrategyReport, strategyReportToCsv } from '@/services/strategyReportingService';
import { createSharePointStrategyReportArchiveService } from '@/services/strategyReportArchiveService';
import type { ProgressScope, StrategyReportType, StrategyTraceabilityReport } from '@/types/strategyExecution';
import type { StoredStrategyReportArchive } from '@/services/strategyReportArchiveService';
import { StrategyGovernanceSections } from '@/components/reports/StrategyGovernanceSections';

// ===== Constants =====

type CategoryKey = ReportDataCategory;
type DivisionGeneratedReport = GeneratedReport & {
  strategySnapshot: StrategyTraceabilityReport;
  archive: StoredStrategyReportArchive;
};

const divisionReportFromArchive = (stored: StoredStrategyReportArchive): DivisionGeneratedReport => ({
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

// ===== Report Preview =====

interface ReportPreviewProps {
  report: DivisionGeneratedReport;
  data: UseDivisionDataReturn;
  onPrint: () => void;
  onExportCSV: () => void;
}

const ReportPreview: React.FC<ReportPreviewProps> = ({ report, data, onPrint, onExportCSV }) => {
  const snapshot = report.strategySnapshot;
  const today = new Date(report.generatedAt).toLocaleDateString('en-PG', { day: '2-digit', month: 'long', year: 'numeric' });
  const traceRows = snapshot.sections.find(section => section.id === 'traceability')?.rows || [];
  const taskRows = traceRows.filter(row => row.entityType === 'task');
  const completedTasks = taskRows.filter(row => row.statusBand === 'completed').length;
  const overdueTasks = snapshot.sections.find(section => section.id === 'overdue')?.rows.length || 0;
  const taskCompletionRate = taskRows.length ? Math.round((completedTasks / taskRows.length) * 100) : 0;

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
                {snapshot.snapshot.scopeLabel} &middot; Generated: {today}
              </p>
            </div>
            <div className="text-right">
              <div className="text-white/70 text-xs">Period</div>
              <div className="font-semibold capitalize">{report.config.timePeriod} Report</div>
              <div className="text-white/70 text-xs mt-1 capitalize">Scope: {snapshot.scope}</div>
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
                { label: 'Graph Progress', value: `${snapshot.summary.averageProgress}%`, icon: TrendingUp, color: 'text-green-600' },
                { label: 'Included Tasks', value: snapshot.summary.taskCount, icon: CheckCircle, color: 'text-blue-600' },
                { label: 'Evidence Signals', value: snapshot.summary.evidenceCount, icon: Target, color: 'text-purple-600' },
                { label: 'Diagnostics', value: snapshot.summary.diagnosticCount, icon: Flag, color: 'text-orange-600' },
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
                { label: 'Total Tasks', value: taskRows.length, max: taskRows.length },
                { label: 'Completed', value: completedTasks, max: taskRows.length, color: 'bg-green-500' },
                { label: 'Completion rate', value: taskCompletionRate, max: 100, color: 'bg-blue-500' },
                { label: 'Overdue', value: overdueTasks, max: taskRows.length, color: 'bg-red-500' },
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
                  <div className="flex justify-between"><span className="text-muted-foreground">Performance KRAs</span><span className="font-medium">{snapshot.summary.performanceKraCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Objectives</span><span className="font-medium">{snapshot.summary.objectiveCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Units</span><span className="font-medium">{snapshot.summary.unitCount}</span></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Key Performance Indicators</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total KPIs</span><span className="font-medium">{snapshot.summary.kpiCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Evidence</span><span className="font-medium text-green-600">{snapshot.summary.evidenceCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Conserved</span><span className="font-medium">{snapshot.integrity.isConserved ? 'Yes' : 'No'}</span></div>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-2 text-xs">
            <h2 className="text-base font-bold text-[#83002A]">Scope and evidence contract</h2>
            <p><strong>Period:</strong> {new Date(snapshot.dateRange.start).toLocaleDateString('en-PG')} – {new Date(snapshot.dateRange.end).toLocaleDateString('en-PG')}</p>
            <p><strong>Source:</strong> {snapshot.snapshot.dataSourceSummary}</p>
            <p><strong>Formula:</strong> {snapshot.snapshot.progressFormula}</p>
            <p><strong>Date basis:</strong> planned interval overlap and actual completion events; last-modified timestamps are not used.</p>
          </section>

          <Separator />

          <section>
            <h2 className="text-base font-bold mb-3">Strategy traceability</h2>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted"><tr><th className="p-2 text-left">Type</th><th className="p-2 text-left">Hierarchy</th><th className="p-2 text-left">Owner</th><th className="p-2 text-right">Progress</th><th className="p-2 text-right">Evidence</th></tr></thead>
                <tbody>{traceRows.map(row => <tr key={`${row.entityType}:${row.entityId}`} className="border-t">
                  <td className="p-2">{row.entityType.replace(/_/g, ' ')}</td>
                  <td className="p-2"><span className="text-muted-foreground">{row.parentPath ? `${row.parentPath} > ` : ''}</span>{row.title}</td>
                  <td className="p-2">{row.ownerName || 'Unassigned'}</td>
                  <td className="p-2 text-right">{row.progress ?? '—'}{row.progress !== undefined ? '%' : ''}</td>
                  <td className="p-2 text-right">{row.evidenceCount || 0}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </section>

          <Separator />

          <StrategyGovernanceSections report={snapshot} deliveryHistory={report.archive.record.deliveryHistory} />

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

function reportDateRange(period: ReportTimePeriod, customStart?: string, customEnd?: string) {
  const end = new Date();
  const start = new Date(end);
  if (period === 'daily') start.setHours(0, 0, 0, 0);
  else if (period === 'weekly') start.setDate(start.getDate() - 7);
  else if (period === 'monthly') start.setMonth(start.getMonth() - 1);
  else if (period === 'quarterly') start.setMonth(start.getMonth() - 3);
  else if (period === 'half-yearly') start.setMonth(start.getMonth() - 6);
  else if (period === 'yearly') start.setFullYear(start.getFullYear() - 1);
  else {
    if (!customStart || !customEnd) throw new Error('Choose both custom report dates.');
    const customRangeEnd = new Date(customEnd);
    customRangeEnd.setUTCHours(23, 59, 59, 999);
    return { start: new Date(customStart), end: customRangeEnd };
  }
  return { start, end };
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

export const DivisionReportsTab: React.FC<DivisionReportsTabProps> = ({ data }) => {
  const { instance: msalInstance } = useMsal();
  const { isAdmin } = useRoleBasedAuth();
  const reportRef = useRef<HTMLDivElement>(null);

  // Generator state
  const [timePeriod, setTimePeriod] = useState<ReportTimePeriod>('monthly');
  const [scope, setScope] = useState<ReportScope>('division');
  const [reportType, setReportType] = useState<ReportType>('performance');
  const [generating, setGenerating] = useState(false);
  const [currentReport, setCurrentReport] = useState<DivisionGeneratedReport | null>(null);
  const [reportHistory, setReportHistory] = useState<DivisionGeneratedReport[]>([]);
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
  const graphScope: ProgressScope = scope === 'individual' ? 'personal' : scope;
  const graphState = useStrategyExecutionGraph({
    scope: graphScope,
    ownerEmail: userContext.email,
    ownerName: userContext.name,
    division: data.division?.name || userContext.division,
    unit: userContext.unit,
    role: userContext.role,
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
        if (active) setReportHistory(history.map(divisionReportFromArchive));
      } catch (error) {
        console.error('Failed to load persisted Division report history:', error);
      }
    };
    loadReportHistory();
    return () => { active = false; };
  }, [userContext?.email, msalInstance]);

  // Load existing schedule on mount
  useEffect(() => {
    const loadSchedule = async () => {
      if (!userContext?.email) { setScheduleLoading(false); return; }
      try {
        const graphClient = await getGraphClient(msalInstance);
        if (!graphClient) { setScheduleLoading(false); return; }
        const opsService = new SharePointOpsService(graphClient);
        await opsService.initialize();
        const existing = await opsService.getReportSchedule(userContext.email, 'division');
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
        unit: '',
        scope: 'division',
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
    if (graphState.isLoading) {
      toast.info('The strategy graph is still loading.');
      return;
    }
    if (graphState.error) {
      toast.error(`The strategy graph could not be loaded: ${graphState.error.message}`);
      return;
    }
    setGenerating(true);
    try {
      const { start, end } = reportDateRange(timePeriod, customStartDate, customEndDate);
      const config: ReportConfig = {
        timePeriod, scope, reportType,
        divisionId: data.division?.id || '', divisionName: data.division?.name,
        unitName: graphScope === 'unit' ? userContext.unit : undefined,
        individualEmail: graphScope === 'personal' ? userContext.email : undefined,
        individualName: graphScope === 'personal' ? userContext.name : undefined,
        dateRange: { start: start.toISOString(), end: end.toISOString() },
        includeCharts: true, includeAISummary: false,
      };
      const strategyType: StrategyReportType = reportType === 'operations'
        ? 'overdue-strategic-tasks'
        : reportType === 'performance'
          ? 'kra-kpi-evidence'
          : 'strategic-traceability';
      const title = buildReportTitle(config);
      const strategySnapshot = buildStrategyReport(graphState.graph, {
        type: strategyType,
        title,
        generatedBy: data.userContext.name || data.userContext.email,
        dateRange: config.dateRange,
        scopeLabel: graphScope === 'personal'
          ? data.userContext.name
          : graphScope === 'unit'
            ? data.userContext.unit
            : data.division?.name || data.userContext.division,
      });
      const graphClient = await getGraphClient(msalInstance);
      if (!graphClient) throw new Error('The report archive is unavailable because no Graph client could be created.');
      const opsService = new SharePointOpsService(graphClient);
      await opsService.initialize();
      const stored = await createSharePointStrategyReportArchiveService(opsService).archive(
        strategySnapshot,
        config as unknown as Record<string, unknown>,
        {
          division: data.division?.name || data.userContext.division,
          unit: graphScope === 'unit' ? data.userContext.unit : undefined,
          ownerEmail: graphScope === 'personal' ? data.userContext.email : undefined,
        },
      );
      const report: DivisionGeneratedReport = {
        ...divisionReportFromArchive(stored), config, title,
      };
      setCurrentReport(report);
      setReportHistory(prev => [report, ...prev.filter(item => item.id !== report.id)].slice(0, 20));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The report could not be generated.');
    } finally {
      setGenerating(false);
    }
  };

  const recordDeliveryEvent = async (
    report: DivisionGeneratedReport,
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
    const addEvent = (item: DivisionGeneratedReport): DivisionGeneratedReport => ({
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

            {timePeriod === 'custom' && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="division-report-start" className="text-xs font-medium">Report start date</label>
                  <Input id="division-report-start" type="date" value={customStartDate} onChange={event => setCustomStartDate(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="division-report-end" className="text-xs font-medium">Report end date</label>
                  <Input id="division-report-end" type="date" value={customEndDate} onChange={event => setCustomEndDate(event.target.value)} />
                </div>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={generating || graphState.isLoading}
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
            onPrint={handlePrint}
            onExportCSV={handleExportCSV}
          />
        </div>
      )}

      {/* Report History */}
      {reportHistory.some(report => report.id !== currentReport?.id) && (
        <Card>
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
