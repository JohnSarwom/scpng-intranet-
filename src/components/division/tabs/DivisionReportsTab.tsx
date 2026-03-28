import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  FileText, Download, Printer, RefreshCw, Calendar, BarChart2,
  CheckCircle, AlertTriangle, Clock, Users, Target, TrendingUp, Loader2
} from 'lucide-react';
import {
  ReportConfig, ReportTimePeriod, ReportScope, ReportType, GeneratedReport
} from '@/types/division.types';
import { UseDivisionDataReturn } from '@/hooks/useDivisionData';
import { DivisionMetrics } from '@/types/division.types';

// --- Report Preview Component ---
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
      {/* Report Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onExportCSV}>
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onPrint}>
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>
      </div>

      {/* Printable Report Content */}
      <div className="border rounded-xl overflow-hidden print:shadow-none">
        {/* Report Header */}
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
              <div className="font-semibold capitalize">
                {report.config.timePeriod} Report
              </div>
              <div className="text-white/70 text-xs mt-1 capitalize">
                Scope: {report.config.scope}
              </div>
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

          {/* Report Footer */}
          <div className="text-xs text-muted-foreground text-center pt-4 border-t">
            Confidential — {data.division?.name} &middot; Generated {today} &middot; SCPNG Intranet
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Reports Tab ---
interface DivisionReportsTabProps {
  data: UseDivisionDataReturn;
  metrics: DivisionMetrics;
}

function buildReportTitle(config: ReportConfig): string {
  const period = config.timePeriod.charAt(0).toUpperCase() + config.timePeriod.slice(1);
  const scope = config.scope.charAt(0).toUpperCase() + config.scope.slice(1);
  const type = config.reportType.charAt(0).toUpperCase() + config.reportType.slice(1);
  return `${period} ${scope}-Level ${type} Report`;
}

export const DivisionReportsTab: React.FC<DivisionReportsTabProps> = ({ data, metrics }) => {
  const [timePeriod, setTimePeriod] = useState<ReportTimePeriod>('monthly');
  const [scope, setScope] = useState<ReportScope>('division');
  const [reportType, setReportType] = useState<ReportType>('performance');
  const [generating, setGenerating] = useState(false);
  const [currentReport, setCurrentReport] = useState<GeneratedReport | null>(null);
  const [reportHistory, setReportHistory] = useState<GeneratedReport[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    // Simulate generation delay
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

  const handlePrint = () => {
    window.print();
  };

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
    a.download = `${currentReport?.title || 'report'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Tab Header */}
      <div className="px-1 mb-2">
        <h2 className="text-lg font-bold text-black">
          Division Reports
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Generate and export comprehensive performance reports across various scopes and time periods.
        </p>
      </div>
      {/* Report Generator Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Report Generator
          </CardTitle>
          <CardDescription className="text-xs">
            Configure and generate reports at any scope and time period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
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
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating Report...</>
            ) : (
              <><RefreshCw className="h-4 w-4" /> Generate Report</>
            )}
          </Button>
        </CardContent>
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
    </div>
  );
};
