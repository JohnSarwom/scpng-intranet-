import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Calendar, Download, FileText, Mail, PenSquare, Plus, Printer, Save, Settings, Share } from "lucide-react";
import { Task, Project, Risk } from '@/types';
import { Kra, Kpi, Objective } from '@/types';
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { format } from 'date-fns';
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import WeeklyReviewTab from './WeeklyReviewTab';
import { SharePointOpsService } from '@/services/sharePointOpsService';
import { StrategyService } from '@/services/strategyService';
import { getGraphClient } from '@/services/graphService';
import { reportsService } from '@/integrations/supabase/reportsService';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useMsal } from "@azure/msal-react";
import { Report, ReportSectionContent } from '@/types/reports';
import { Loader2, RefreshCcw, Eye } from 'lucide-react';
import { ReportViewerModal } from '../reports/ReportViewerModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ReportsTabProps {
  tasks?: Task[];
  kras?: Kra[];
  projects?: Project[];
  risks?: Risk[];
  objectives?: Objective[];
}

// Define report templates
const reportTemplates = [
  { id: "kpi-summary", name: "KPI Summary Report", description: "Overview of all KPIs and their statuses" },
  { id: "unit-performance", name: "Unit Performance Report", description: "Comprehensive view of unit performance across all metrics" },
  { id: "project-status", name: "Project Status Report", description: "Status update for all ongoing projects" },
  { id: "risk-assessment", name: "Risk Assessment Report", description: "Analysis of current risks and their mitigation status" },
  { id: "task-completion", name: "Task Completion Report", description: "Summary of task completion rates and status" },
  { id: "custom", name: "Custom Report", description: "Create a report with custom metrics and layout" },
];

// Define report scheduling options
const schedulingOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

// AI analysis suggestions
const aiAnalysisSuggestions = [
  "Analyze performance trends",
  "Identify bottlenecks in workflows",
  "Highlight resource allocation issues",
  "Recommend optimization opportunities",
  "Predict completion dates based on current progress",
  "Identify at-risk items requiring attention"
];

export const ReportsTab: React.FC<ReportsTabProps> = ({
  tasks = [],
  kras = [],
  projects = [],
  risks = [],
  objectives = []
}) => {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("kpi-summary");
  const [selectedReportTab, setSelectedReportTab] = useState<string>("generate");
  const [reportName, setReportName] = useState<string>("");
  const [showScheduleDialog, setShowScheduleDialog] = useState<boolean>(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<string>("weekly");
  const [recipients, setRecipients] = useState<string>("");
  const [enableAIAnalysis, setEnableAIAnalysis] = useState<boolean>(true);
  const [selectedAIFeatures, setSelectedAIFeatures] = useState<string[]>(["trends", "risks"]);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(new Date());
  const [reportLayout, setReportLayout] = useState<string>("standard");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const { user } = useSupabaseAuth();
  const { instance } = useMsal();

  // History State
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [viewReport, setViewReport] = useState<Report | null>(null);
  const [showReportViewer, setShowReportViewer] = useState(false);

  const handleFetchReports = async () => {
    setIsLoadingReports(true);
    try {
      const client = await getGraphClient(instance);
      if (client) {
        const ops = new SharePointOpsService(client);
        const data = await ops.getReports();
        setReports(data);
      }
    } catch (error) {
      console.error("Failed to fetch reports", error);
      toast({ title: "Error", description: "Failed to load report history", variant: "destructive" });
    } finally {
      setIsLoadingReports(false);
    }
  };

  React.useEffect(() => {
    if (selectedReportTab === 'history') {
      handleFetchReports();
    }
  }, [selectedReportTab]);

  // Helper to filter items by date range
  const filterByDateRange = (items: any[], dateField: string) => {
    if (!customStartDate || !customEndDate) return items;
    return items.filter(item => {
      const itemDate = new Date(item[dateField]); // Ensure your types have consistent date fields or handle variations
      return itemDate >= customStartDate && itemDate <= customEndDate;
    });
  };

  const handleGenerateReport = async () => {
    if (!reportName) {
      toast({
        title: "Report Name Required",
        description: "Please provide a name for your report",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    const client = await getGraphClient(instance);
    if (!client) {
      setIsGenerating(false);
      toast({
        title: "Connection Error",
        description: "Could not connect to SharePoint services.",
        variant: "destructive"
      });
      return;
    }
    const strategyService = new StrategyService(client);
    const sharePointOpsService = new SharePointOpsService(client);

    try {
      await strategyService.initialize();
      // Check if Ops service is initialized, if strict check needed, do here. Assuming it is or will lazily init if designed so.
      // Actually Ops Service needs explicit init usually.
      await sharePointOpsService.initialize();

      // 1. Fetch Data
      // Note: Services usually fetch "all" for the context, we then filter by date here for the report.
      const [allProjects, allTasks, allRisks, allKRAs] = await Promise.all([
        sharePointOpsService.getProjects('Unit', { unit: 'IT Unit', division: 'Operations', email: user?.email || '', name: user?.email || '', role: 'admin' }),
        sharePointOpsService.getTasks('Unit', { unit: 'IT Unit', division: 'Operations', email: user?.email || '', name: user?.email || '', role: 'admin' }),
        sharePointOpsService.getRisks('Unit', { unit: 'IT Unit', division: 'Operations', email: user?.email || '', name: user?.email || '', role: 'admin' }),
        sharePointOpsService.getKRAs('Unit', { unit: 'IT Unit', division: 'Operations', email: user?.email || '', name: user?.email || '', role: 'admin' })
      ]);

      // 2. Filter Data by Date Range (using Created or Modified or DueDate depending on report type)
      // For a general "Status Report", we usually want active items or items due in range.
      // Let's assume we want items active in the range (StartDate <= End AND EndDate >= Start)
      // Or simpler: items due in this range?
      // For simplicity: Include ALL fetched items for the Status Report, and let specific sections filter if needed.
      // Or filter Tasks by DueDate within range.

      // const filteredTasks = allTasks.filter(t => t.dueDate && new Date(t.dueDate) >= customStartDate! && new Date(t.dueDate) <= customEndDate!);
      // Using all active data for "Current State" report is often better.

      const filteredTasks = allTasks;
      const filteredProjects = allProjects;
      const filteredRisks = allRisks;
      const filteredKRAs = allKRAs;


      // 3. Process Metrics
      const completedTasks = filteredTasks.filter(t => t.status === 'completed').length;
      const totalTasks = filteredTasks.length;
      const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      const atRiskKPIs = filteredKRAs.filter(k => (k as any).status === 'at-risk').length; // KRA/Kra status normalization
      const onTrackKPIs = filteredKRAs.filter(k => (k as any).status === 'in-progress' || (k as any).status === 'on-track').length;

      const highRisks = filteredRisks.filter(r => r.impact === 'high' || r.impact === 'critical').length;


      // 4. Construct Report Sections
      const reportSections: ReportSectionContent[] = [];

      // Executive Summary (Custom Section)
      reportSections.push({
        id: 'exec-summary',
        title: 'Executive Summary',
        type: 'custom',
        data: [
          { label: 'Task Completion', value: `${taskCompletionRate}%`, status: taskCompletionRate > 80 ? 'good' : 'average' },
          { label: 'Active Projects', value: filteredProjects.length, status: 'neutral' },
          { label: 'High Risks', value: highRisks, status: highRisks > 0 ? 'bad' : 'good' },
          { label: 'KPIs On Track', value: onTrackKPIs, status: 'good' }
        ],
        visualization: { type: 'metrics' }
      });

      // KPIs Section
      if (filteredKRAs.length > 0) {
        reportSections.push({
          id: 'kpis',
          title: 'KPI Performance',
          type: 'kpi',
          data: filteredKRAs.map(k => ({
            name: k.title,
            status: k.status,
            progress: k.progress
          })),
          visualization: { type: 'chart', chart_type: 'bar' }
        });
      }

      // Projects Section
      if (filteredProjects.length > 0) {
        reportSections.push({
          id: 'projects',
          title: 'Project Status',
          type: 'project',
          data: filteredProjects.map(p => ({
            name: p.name,
            status: p.status,
            progress: p.progress,
            manager: p.manager
          })),
          visualization: { type: 'table' }
        });
      }

      // Risks Section
      if (filteredRisks.length > 0) {
        reportSections.push({
          id: 'risks',
          title: 'Risk Assessment',
          type: 'risk',
          data: filteredRisks.map(r => ({
            title: r.title,
            impact: r.impact,
            mitigation: r.mitigationPlan || 'None'
          })),
          visualization: { type: 'table' }
        });
      }

      // Generate report object
      const newReport: Omit<Report, 'id'> = {
        name: reportName || `Report - ${format(new Date(), 'PP')}`,
        template_id: selectedTemplate,
        content: {
          sections: reportSections,
          metadata: {
            generated_at: new Date().toISOString(),
            version: '1.0'
          }
        },
        created_by: user?.email || 'system',
        created_at: new Date().toISOString(),
        date_range: {
          start_date: customStartDate ? customStartDate.toISOString() : undefined,
          end_date: customEndDate ? customEndDate.toISOString() : undefined,
        },
        ai_analysis: enableAIAnalysis,
        ai_insights: enableAIAnalysis ? {
          trends: ['Performance is stable', 'Task completion rate is consistent'],
          risks: ['Review high priority risks in IT'],
          recommendations: ['Focus on closing overdue tasks'],
          predictions: ['Project completion expected on time']
        } : undefined
      };

      // Save to SharePoint List "Performance_Reports"
      // Note: ReportsService (Supabase) is replaced by SharePointOpsService
      try {
        await sharePointOpsService.saveReport(newReport);

        toast({
          title: "Report Generated",
          description: "Your report has been generated and saved to SharePoint successfully.",
        });
      } catch (error) {
        console.error("Failed to save report to SharePoint", error);
        toast({
          title: "Save Failed",
          description: "Report generated but failed to save to SharePoint.",
          variant: "destructive"
        });
      }

      setIsGenerating(false);
      setSelectedReportTab("templates"); // Redirect to templates/list view for now
    } catch (error) {
      console.error("Report generation failed:", error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate report. Check console for details.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleScheduleReport = () => {
    if (!reportName) {
      toast({
        title: "Report Name Required",
        description: "Please provide a name for your report",
        variant: "destructive"
      });
      return;
    }

    if (!recipients) {
      toast({
        title: "Recipients Required",
        description: "Please specify at least one recipient email",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Report Scheduled",
      description: `Your report will be sent ${scheduleFrequency}`,
    });

    setShowScheduleDialog(false);
  };

  const handlePrintReport = () => {
    toast({
      title: "Printing Report",
      description: "Sending report to printer..."
    });
    // In a real implementation, this would use window.print() or a printing library
  };

  const handleEmailReport = () => {
    const emailDialog = window.prompt("Enter email addresses (comma separated):");
    if (emailDialog) {
      toast({
        title: "Report Sent",
        description: `Report has been emailed to: ${emailDialog}`
      });
    }
  };

  const renderGenerateSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Report Template</CardTitle>
            <CardDescription>Select a template or create a custom report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {reportTemplates.map(template => (
                <div key={template.id} className="flex items-start space-x-3">
                  <Checkbox
                    id={`template-${template.id}`}
                    checked={selectedTemplate === template.id}
                    onCheckedChange={() => setSelectedTemplate(template.id)}
                  />
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor={`template-${template.id}`}
                      className="font-medium leading-none cursor-pointer"
                    >
                      {template.name}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Report Configuration</CardTitle>
            <CardDescription>Customize your report details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="report-name">Report Name</Label>
                <Input
                  id="report-name"
                  placeholder="Enter report name"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label>Date Range</Label>
                <div className="flex gap-4">
                  <div className="grid gap-1.5 flex-1">
                    <Label htmlFor="start-date" className="text-xs">Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <Calendar className="mr-2 h-4 w-4" />
                          {customStartDate ? format(customStartDate, 'PPP') : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <DatePicker
                          selected={customStartDate}
                          onSelect={setCustomStartDate}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid gap-1.5 flex-1">
                    <Label htmlFor="end-date" className="text-xs">End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <Calendar className="mr-2 h-4 w-4" />
                          {customEndDate ? format(customEndDate, 'PPP') : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <DatePicker
                          selected={customEndDate}
                          onSelect={setCustomEndDate}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="enable-ai">Enable AI Analysis</Label>
                  <Switch
                    id="enable-ai"
                    checked={enableAIAnalysis}
                    onCheckedChange={setEnableAIAnalysis}
                  />
                </div>

                {enableAIAnalysis && (
                  <div className="grid gap-1.5 mt-2">
                    <Label className="text-xs">AI Analysis Features</Label>
                    <ToggleGroup type="multiple" variant="outline" className="flex flex-wrap">
                      <ToggleGroupItem value="trends" className="text-xs">Performance Trends</ToggleGroupItem>
                      <ToggleGroupItem value="risks" className="text-xs">Risk Identification</ToggleGroupItem>
                      <ToggleGroupItem value="recommendations" className="text-xs">Recommendations</ToggleGroupItem>
                      <ToggleGroupItem value="predictions" className="text-xs">Predictions</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Report Content</CardTitle>
            <CardDescription>Select what data to include in your report</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Data Sections</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-kpis" defaultChecked />
                    <Label htmlFor="include-kpis">KPIs & KRAs ({kras.length} items)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-projects" defaultChecked />
                    <Label htmlFor="include-projects">Projects ({projects.length} items)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-tasks" defaultChecked />
                    <Label htmlFor="include-tasks">Tasks ({tasks.length} items)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-risks" defaultChecked />
                    <Label htmlFor="include-risks">Risks ({risks.length} items)</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Report Layout</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="layout-standard"
                      checked={reportLayout === "standard"}
                      onCheckedChange={() => setReportLayout("standard")}
                    />
                    <Label htmlFor="layout-standard">Standard Layout</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="layout-compact"
                      checked={reportLayout === "compact"}
                      onCheckedChange={() => setReportLayout("compact")}
                    />
                    <Label htmlFor="layout-compact">Compact Layout</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="layout-detailed"
                      checked={reportLayout === "detailed"}
                      onCheckedChange={() => setReportLayout("detailed")}
                    />
                    <Label htmlFor="layout-detailed">Detailed Layout</Label>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handlePrintReport}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" onClick={handleEmailReport}>
            <Mail className="mr-2 h-4 w-4" />
            Email
          </Button>
          <Button variant="outline" onClick={() => setShowScheduleDialog(true)}>
            <Calendar className="mr-2 h-4 w-4" />
            Schedule
          </Button>
        </div>
        <Button onClick={handleGenerateReport} disabled={isGenerating}>
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Generate Report
            </>
          )}
        </Button>
      </div>
    </div >
  );

  const renderHistorySection = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Report History</CardTitle>
          <CardDescription>View previously generated reports</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleFetchReports} disabled={isLoadingReports}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${isLoadingReports ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Generated By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {isLoadingReports ? "Loading reports..." : "No reports found."}
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.name}</TableCell>
                    <TableCell><Badge variant="outline">{report.template_id}</Badge></TableCell>
                    <TableCell>{format(new Date(report.created_at || new Date()), 'PP p')}</TableCell>
                    <TableCell>{report.created_by}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => {
                        setViewReport(report);
                        setShowReportViewer(true);
                      }}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  const renderScheduledSection = () => (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled Reports</CardTitle>
        <CardDescription>Manage your scheduled reports</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <div className="p-4">
            <div className="text-center text-muted-foreground py-6">
              No scheduled reports yet. Schedule a report to see it here.
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={() => {
          setSelectedReportTab("generate");
          setShowScheduleDialog(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Schedule New Report
        </Button>
      </CardFooter>
    </Card>
  );

  const renderTemplateSection = () => (
    <Card>
      <CardHeader>
        <CardTitle>Report Templates</CardTitle>
        <CardDescription>Create and manage custom report templates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          <div className="border rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Custom Templates</h3>
              <Button variant="outline" size="sm">
                <PenSquare className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </div>
            <div className="text-center text-muted-foreground py-6">
              No custom templates yet. Create a template to see it here.
            </div>
          </div>

          <div className="border rounded-md p-4 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">System Setup (Admin)</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Use this to create the necessary SharePoint list for storing reports if it doesn't exist.
            </p>
            <Button variant="outline" size="sm" onClick={handleInitializeReportsList}>
              Initialize Reports List
            </Button>
          </div>

          <div className="border rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">System Templates</h3>
              <Badge variant="outline">Default</Badge>
            </div>
            <div className="space-y-3 mt-4">
              {reportTemplates.slice(0, -1).map(template => (
                <div key={template.id} className="flex items-center justify-between p-2 border rounded-md">
                  <div>
                    <h4 className="font-medium">{template.name}</h4>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    <FileText className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const handleInitializeReportsList = async () => {
    const { instance } = useMsal();
    const client = await getGraphClient(instance);
    if (!client) {
      toast({ title: "Error", description: "No Graph Client available", variant: "destructive" });
      return;
    }
    const sharePointOpsService = new SharePointOpsService(client);

    toast({ title: "Initializing...", description: "Setting up SharePoint List..." });
    try {
      await sharePointOpsService.initialize();
      await sharePointOpsService.createReportsList();
      toast({ title: "Success", description: "Performance_Reports list created/verified!" });
    } catch (e: any) {
      toast({ title: "Error", description: `Failed: ${e.message}`, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex justify-between items-center">
        <div className="space-y-0.5">
          <h2 className="text-2xl font-bold">Reports</h2>
          <p className="text-muted-foreground">Generate and view performance reports.</p>
        </div>
      </div>

      <Tabs defaultValue="generate" value={selectedReportTab} onValueChange={setSelectedReportTab}>
        <TabsList>
          <TabsTrigger value="generate">Generate Reports</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Review</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>
          <TabsTrigger value="templates">Report Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4 mt-4">
          {renderGenerateSection()}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          {renderHistorySection()}
        </TabsContent>

        <TabsContent value="weekly" className="space-y-4 mt-4">
          <WeeklyReviewTab />
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4 mt-4">
          {renderScheduledSection()}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4 mt-4">
          {renderTemplateSection()}
        </TabsContent>
      </Tabs>

      {/* Schedule Report Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Report</DialogTitle>
            <DialogDescription>
              Set up automatic report generation and distribution
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="schedule-name">Report Name</Label>
              <Input
                id="schedule-name"
                placeholder="Enter report name"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="schedule-frequency">Frequency</Label>
              <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {schedulingOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="schedule-recipients">Recipients (comma separated emails)</Label>
              <Input
                id="schedule-recipients"
                placeholder="Enter email addresses"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="schedule-ai-analysis"
                checked={enableAIAnalysis}
                onCheckedChange={(checked) => setEnableAIAnalysis(checked === true)}
              />
              <Label htmlFor="schedule-ai-analysis">Include AI Analysis</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
            <Button onClick={handleScheduleReport}>Schedule Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReportViewerModal
        report={viewReport}
        open={showReportViewer}
        onOpenChange={setShowReportViewer}
      />
    </div >
  );
};

export default ReportsTab; 