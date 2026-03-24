import React, { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar, BarChart2, Target, Clock, Flag,
  CheckCircle, AlertTriangle, Briefcase, Settings, Cloud, Activity, Info, Maximize2, Minimize2, Crosshair, TrendingUp, Zap
} from 'lucide-react';
import { KPIPerformanceBar } from '@/components/dashboard/KPIPerformanceBar';
import { TaskTrendsLine } from '@/components/dashboard/TaskTrendsLine';
import { TaskGroupList } from '@/components/dashboard/TaskGroupList';
import { KRAStatusChart } from '@/components/dashboard/KRAStatusChart';
import { ObjectivesProgressChart } from '@/components/dashboard/ObjectivesProgressChart';
import { TrafficLightCard } from '@/components/dashboard/TrafficLightCard';
import { calculateTaskTrends, calculateTrafficLightMetrics } from '@/utils/dashboardUtils';
import { calculateKraProgress, calculateStrategicProgress, calculateObjectiveStatus } from '@/utils/kpiUtils';
import { SetupWizard } from '@/components/setup-wizard/SetupWizard';
import { SetupWizardState as FullSetupWizardState } from '@/hooks/useSetupWizard';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useStrategySharePoint } from '@/hooks/useStrategySharePoint';
import DivisionStaffMap from '@/utils/divisionStaffMap';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Objective, Task, Project, KRA, UserContext } from '@/types';
import { UserRole } from '@/services/userSharePointService';

import { TaskCompletionDonut } from '@/components/dashboard/TaskCompletionDonut';
import LocalStorageFallbackNotice from '@/components/setup-wizard/components/LocalStorageFallbackNotice';

import { Bucket } from '@/components/unit-tabs/TasksTab';

type DashboardViewScope = 'individual' | 'unit' | 'division';

interface OverviewTabSetupProps {
  showSetupWizard: boolean;
  setShowSetupWizard: (show: boolean) => void;
}

interface OverviewTabProps {
  projects: Project[];
  tasks: Task[];
  kras: KRA[];
  setupState?: FullSetupWizardState;
  objectives?: Objective[];
  buckets?: Bucket[];
  userContext?: UserContext;
  /** Live unit staff roster from SharePoint UserRoles via useUnitRoster */
  unitRoster?: UserRole[];
}

// ... (SwitchToOneDriveDialog component remains unchanged)
const SwitchToOneDriveDialog = ({ isOpen, onClose, onSwitch }) => {
  const [folderName, setFolderName] = useState('Unit Dashboard');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSwitch(folderName);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Switch to OneDrive Storage</DialogTitle>
          <DialogDescription>
            Create a new OneDrive folder to store your data in. This will move your data from local storage to OneDrive.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="folder-name" className="col-span-4">
                Folder Name
              </Label>
              <Input
                id="folder-name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="col-span-4"
                required
                minLength={3}
                maxLength={64}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              <Cloud className="mr-2 h-4 w-4" />
              Create Folder & Switch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const OverviewTab: React.FC<OverviewTabProps> = ({
  projects,
  tasks,
  kras,
  setupState,
  objectives: objectivesFromProps,
  buckets = [],
  unitRoster,
  userContext
}) => {
  const [selectedInsight, setSelectedInsight] = useState('overview');
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Use the objectives prop from Unit.tsx (unit-level objectives from SharePoint)
  // Fallback to strategy data only if no prop objectives are available
  const { strategyData } = useStrategySharePoint();
  const objectives = (objectivesFromProps && objectivesFromProps.length > 0)
    ? objectivesFromProps
    : (strategyData?.objectives || []);

  // Always show individual data only
  const viewScope: DashboardViewScope = 'individual';

  // Only managers, admins, and super admins can use the View Scope dropdown
  const canUseViewScope = useMemo(() => {
    const role = userContext?.role?.toLowerCase();
    return role === 'manager' || role === 'admin' || role === 'super_admin';
  }, [userContext?.role]);

  const userEmail = userContext?.email?.toLowerCase() || '';
  const userUnit = userContext?.unit || '';
  const userDivision = userContext?.division || '';
  const userName = userContext?.name || '';

  // Pre-compute unit staff email set — used by both scoped memos and staff performance cards.
  // Prefers the live SharePoint UserRoles roster (unitRoster) when available;
  // falls back to the static DivisionStaffMap so the UI is never empty while loading.
  const unitStaffEmails = useMemo(() => {
    if (!userUnit) return new Set<string>();

    const sourceEmails: string[] =
      unitRoster && unitRoster.length > 0
        ? unitRoster.map(u => u.user_email.toLowerCase())
        : DivisionStaffMap.getAllStaff()
          .filter(s => s.unit?.toLowerCase() === userUnit.toLowerCase())
          .map(s => s.email.toLowerCase());

    const emails = new Set(sourceEmails);
    if (userEmail) emails.add(userEmail); // always include self
    return emails;
  }, [userUnit, userEmail, unitRoster]);

  // Scope-filtered tasks
  const scopedTasks = useMemo(() => {
    if (!canUseViewScope) return tasks;
    if (viewScope === 'individual' && userEmail) {
      return tasks.filter(t =>
        t.assignees?.some(a => a.email?.toLowerCase() === userEmail) ||
        t.createdByEmail?.toLowerCase() === userEmail ||
        t.authorEmail?.toLowerCase() === userEmail ||
        t.assignedTo?.toLowerCase() === userEmail
      );
    }
    if (viewScope === 'unit' && userUnit) {
      // Email-roster match — reliable regardless of unit_id field population
      return tasks.filter(t => {
        const creator = (t.createdByEmail || t.authorEmail || '').toLowerCase();
        const assignees = t.assignees?.map(a => a.email?.toLowerCase() || '') || [];
        return unitStaffEmails.has(creator) || assignees.some(e => e && unitStaffEmails.has(e));
      });
    }
    return tasks;
  }, [tasks, viewScope, userEmail, userUnit, canUseViewScope, unitStaffEmails]);

  // Scope-filtered KRAs
  const scopedKras = useMemo(() => {
    if (!canUseViewScope) return kras;
    if (viewScope === 'individual' && userEmail) {
      return kras.filter(k =>
        k.owner?.email?.toLowerCase() === userEmail ||
        k.createdByEmail?.toLowerCase() === userEmail ||
        k.assignees?.some(a => a.email?.toLowerCase() === userEmail)
      );
    }
    if (viewScope === 'unit' && userUnit) {
      // KRAs mapKRA doesn't populate k.unit; match by email roster + department fallback
      return kras.filter(k => {
        const ownerEmail = k.owner?.email?.toLowerCase() || '';
        const creatorEmail = k.createdByEmail?.toLowerCase() || '';
        const assigneeEmails = k.assignees?.map(a => a.email?.toLowerCase() || '') || [];
        const deptMatch = k.department?.toLowerCase() === userUnit.toLowerCase();
        return unitStaffEmails.has(ownerEmail) ||
          unitStaffEmails.has(creatorEmail) ||
          assigneeEmails.some(e => e && unitStaffEmails.has(e)) ||
          deptMatch;
      });
    }
    return kras;
  }, [kras, viewScope, userEmail, userUnit, canUseViewScope, unitStaffEmails]);

  // Scope-filtered objectives
  const scopedObjectives = useMemo(() => {
    if (!canUseViewScope) return objectives;
    if (viewScope === 'individual' && userEmail) {
      return objectives.filter(o =>
        (o as any).ownerEmail?.toLowerCase() === userEmail ||
        (o as any).owner?.toLowerCase() === userName.toLowerCase()
      );
    }
    if (viewScope === 'unit' && userUnit) {
      return objectives.filter(o => (o as any).unit === userUnit);
    }
    if (viewScope === 'division' && userDivision) {
      return objectives.filter(o =>
        (o as any).division === userDivision || (!(o as any).unit && !(o as any).division)
      );
    }
    return objectives;
  }, [objectives, viewScope, userEmail, userName, userUnit, userDivision, canUseViewScope]);

  const activeProjects = projects.filter(project => project.status === 'in-progress').length;
  const completedProjects = projects.filter(project => project.status === 'completed').length;
  const plannedProjects = projects.filter(project => project.status === 'planned').length;
  const onHoldProjects = projects.filter(project => project.status === 'on-hold').length;


  // --- Calculate Task Group Statistics ---
  // Use passed buckets (which include virtual ones and renames) 
  // If not provided, fall back to basic status buckets (less accurate for custom groups)

  // No fallback to defaults anymore - only use custom groups
  const activeBuckets = buckets.length > 0
    ? buckets
    : projects.filter(p => p.isCustomGroup).map(p => ({ id: String(p.id), title: p.name, isCustom: true }));

  // 2. Count tasks per bucket
  const taskCountsByBucket = activeBuckets.reduce((acc, bucket) => {
    acc[bucket.id] = 0;
    return acc;
  }, {} as Record<string, number>);

  // Track tasks for "Task Completion" chart consistency (Standard Statuses)
  const taskStatusCounts = {
    todo: 0,
    inProgress: 0,
    onHold: 0,
    review: 0,
    done: 0
  };

  scopedTasks.forEach(task => {
    // A. BUCKET COUNTING (For Task Groups List)
    // -----------------------------------------
    let matchedBucket = false;

    // Logic 1: Check if task belongs to a specific project bucket (Project ID match)
    if (task.projectId && taskCountsByBucket[task.projectId] !== undefined) {
      taskCountsByBucket[task.projectId]++;
      matchedBucket = true;
    }

    if (!matchedBucket) {
      // Logic 3: Fallback to Status Mapping
      const status = task.status?.toLowerCase().trim() || 'todo';
      let targetBucketId = 'todo';

      if (['todo', 'not started', 'open', 'to do'].includes(status)) targetBucketId = 'todo';
      else if (['in-progress', 'in progress', 'doing', 'active'].includes(status)) targetBucketId = 'in-progress';
      else if (['on-hold', 'on hold'].includes(status)) targetBucketId = 'on-hold';
      else if (['review', 'in review', 'under review', 'in-review'].includes(status)) targetBucketId = 'in-review';
      else if (['done', 'completed', 'closed', 'complete'].includes(status)) targetBucketId = 'done';
      else if (taskCountsByBucket[status] !== undefined) targetBucketId = status;

      if (taskCountsByBucket[targetBucketId] !== undefined) {
        taskCountsByBucket[targetBucketId]++;
      }
    }

    // B. STATUS COUNTING (For Task Completion Chart)
    // ----------------------------------------------
    // Count ALL tasks by status regardless of bucket to show full picture
    const status = task.status?.toLowerCase().trim() || '';

    if (['todo', 'not started', 'open', 'to do'].includes(status)) taskStatusCounts.todo++;
    else if (['in-progress', 'in progress', 'doing', 'active'].includes(status)) taskStatusCounts.inProgress++;
    else if (['on-hold', 'on hold'].includes(status)) taskStatusCounts.onHold++;
    else if (['review', 'in review', 'under review', 'in-review'].includes(status)) taskStatusCounts.review++;
    else if (['done', 'completed', 'closed', 'complete'].includes(status)) taskStatusCounts.done++;
    else {
      // Default fallback for unknown status -> To Do (matches generic logic)
      taskStatusCounts.todo++;
    }
  });

  const todoTasks = taskStatusCounts.todo;
  const inProgressTasks = taskStatusCounts.inProgress;
  const onHoldTasks = taskStatusCounts.onHold;
  const reviewTasks = taskStatusCounts.review;
  const completedTasks = taskStatusCounts.done;

  // 3. Format data for the task groups chart
  const taskGroupData = activeBuckets.map((bucket, index) => ({
    name: bucket.title,
    value: taskCountsByBucket[bucket.id] || 0,
    // Use bucket color if available, else default cycle
    color: index < 4 ? ['#94a3b8', '#fbbf24', '#f59e0b', '#34d399'][index] : '#3b82f6'
  }));


  // Calculate KPI Statuses
  const allKpis = scopedKras.flatMap(kra => (kra.unitKpis || kra.kpis || []) as any[]);
  const kpiStats = {
    completed: allKpis.filter(k => k.status === 'completed').length,
    onTrack: allKpis.filter(k => k.status === 'on-track').length,
    atRisk: allKpis.filter(k => k.status === 'at-risk').length,
    behind: allKpis.filter(k => k.status === 'behind').length,
    notStarted: allKpis.filter(k => k.status === 'not-started' || !k.status).length
  };

  // Calculate Objective Statuses — dynamically from linked KRAs
  const totalObjectives = scopedObjectives?.length || 0;

  // Compute dynamic progress for each objective from its linked KRAs
  const objectivesWithDynamicProgress = useMemo(() => {
    return scopedObjectives.map(obj => {
      const linkedKras = scopedKras.filter(kra =>
        String((kra as any).objective_id) === String(obj.id) ||
        String(kra.objectiveId) === String(obj.id)
      );
      const dynamicProgress = linkedKras.length > 0
        ? calculateStrategicProgress(linkedKras, allKpis)
        : (obj.progress || 0);
      const dynamicStatus = calculateObjectiveStatus(obj, scopedKras);
      return { ...obj, progress: dynamicProgress, status: dynamicStatus };
    });
  }, [scopedObjectives, scopedKras, allKpis]);

  const completedObjectives = objectivesWithDynamicProgress.filter(obj => obj.progress === 100).length;
  const objectiveProgress = totalObjectives > 0
    ? objectivesWithDynamicProgress.reduce((acc, obj) => acc + obj.progress, 0) / totalObjectives
    : 0;

  const kpiStatusData = [
    { name: 'On Track', value: kpiStats.onTrack, color: '#34d399' }, // Green
    { name: 'Completed', value: kpiStats.completed, color: '#3b82f6' }, // Blue
    { name: 'At Risk', value: kpiStats.atRisk, color: '#fbbf24' }, // Yellow
    { name: 'Behind', value: kpiStats.behind, color: '#ef4444' }, // Red
  ];

  // Sample chart data
  const taskStatusData = [
    { name: 'To Do', value: todoTasks, color: '#94a3b8' },
    { name: 'In Progress', value: inProgressTasks, color: '#fbbf24' },
    { name: 'On Hold', value: onHoldTasks, color: '#f97316' }, // Orange
    { name: 'In Review', value: reviewTasks, color: '#f59e0b' },
    { name: 'Completed', value: completedTasks, color: '#34d399' }
  ];

  const projectStatusData = [
    { name: 'Planned', value: plannedProjects, color: '#3b82f6' },
    { name: 'In Progress', value: activeProjects, color: '#fbbf24' },
    { name: 'Completed', value: completedProjects, color: '#34d399' },
    { name: 'On Hold', value: onHoldProjects, color: '#ef4444' }
  ];

  // Monthly task completion sample data
  // --- Derived Metrics ---
  const taskTrendData = React.useMemo(() => calculateTaskTrends(scopedTasks), [scopedTasks]);
  const trafficLightMetrics = React.useMemo(() => calculateTrafficLightMetrics(scopedTasks, projects, scopedObjectives), [scopedTasks, projects, scopedObjectives]);

  // ─── Dynamic Insights Logic (Local/Free) ─────────────────────
  const insights = useMemo(() => {
    const getInsight = (value: number, thresholds: { neutral: number, positive: number }, templates: { high: string, mid: string, low: string }, data: any) => {
      let template = templates.mid;
      if (value >= thresholds.positive) template = templates.high;
      if (value < thresholds.neutral) template = templates.low;
      return template.replace(/{(\w+)}/g, (match, key) => data[key] || match);
    };

    // 1. Task Velocity
    const taskVelocity = scopedTasks.length > 0 ? (completedTasks / scopedTasks.length) * 100 : 0;
    const velocityTemplates = {
      high: "High operational velocity detected: {pct}% of tasks are now complete, indicating efficient unit delivery.",
      mid: "Operational velocity is steady at {pct}%. Focus on transitioning 'In Review' items to completion.",
      low: "Operational velocity is currently limited ({pct}%). Potential bottlenecks identified in the review pipeline."
    };
    const velocityText = getInsight(taskVelocity, { neutral: 30, positive: 60 }, velocityTemplates, { pct: Math.round(taskVelocity) });

    // 2. Strategic Health (KRAs)
    const healthyKras = kraStatusCounts.onTrack + kraStatusCounts.completed;
    const kraHealthPct = scopedKras.length > 0 ? (healthyKras / scopedKras.length) * 100 : 0;
    const healthTemplates = {
      high: "Strategic alignment is exceptional ({pct}%). Your unit's core results are consistently hitting targets.",
      mid: "KRAs show healthy progress ({pct}%). Minor adjustments to 'At Risk' areas will solidify strategic goals.",
      low: "Strategic health is under pressure ({pct}%). Redirecting focus to off-track KRAs is recommended for alignment."
    };
    const healthText = getInsight(kraHealthPct, { neutral: 40, positive: 75 }, healthTemplates, { pct: Math.round(kraHealthPct) });

    // 3. Resource Balance
    const totalWorking = inProgressTasks + reviewTasks;
    const focusRatio = totalWorking > 0 ? (inProgressTasks / (totalWorking || 1)) * 100 : 0;
    const balanceTemplates = {
      high: "Resource focus is highly active: {pct}% of current workload is in active execution phase.",
      mid: "Workload distribution is balanced. Active tasks are progressing steadily through the pipeline.",
      low: "Executing resources are currently fragmented. High volume of 'On Hold' items may slow down momentum."
    };
    const balanceText = getInsight(focusRatio, { neutral: 40, positive: 70 }, balanceTemplates, { pct: Math.round(focusRatio) });

    return {
      velocity: velocityText,
      health: healthText,
      balance: balanceText,
      kraHealthPct
    };
  }, [scopedTasks, completedTasks, reviewTasks, scopedKras, kraStatusCounts, inProgressTasks]);

  // --- Prepare KRA Chart Data ---
  // KRA statuses from SharePoint map to: 'open', 'in-progress', 'closed'
  // Additionally check raw status values that may come through unmapped
  const kraStatusCounts = {
    onTrack: scopedKras.filter(k => {
      const s = (k.status as string)?.toLowerCase();
      return s === 'in-progress' || s === 'on-track';
    }).length,
    atRisk: scopedKras.filter(k => (k.status as string)?.toLowerCase() === 'at-risk').length,
    offTrack: scopedKras.filter(k => {
      const s = (k.status as string)?.toLowerCase();
      return s === 'off-track' || s === 'behind';
    }).length,
    completed: scopedKras.filter(k => {
      const s = (k.status as string)?.toLowerCase();
      return s === 'completed' || s === 'closed' || s === 'done';
    }).length,
    open: scopedKras.filter(k => {
      const s = (k.status as string)?.toLowerCase();
      return !s || s === 'open' || s === 'pending' || s === 'not-started';
    }).length
  };

  const kraChartData = [
    { status: 'On Track', count: kraStatusCounts.onTrack, color: '#34d399' },
    { status: 'Completed', count: kraStatusCounts.completed, color: '#3b82f6' },
    { status: 'At Risk', count: kraStatusCounts.atRisk, color: '#fbbf24' },
    { status: 'Off Track', count: kraStatusCounts.offTrack, color: '#ef4444' },
    ...(kraStatusCounts.open > 0 ? [{ status: 'Open', count: kraStatusCounts.open, color: '#94a3b8' }] : [])
  ].filter(d => d.count > 0); // Hide zero values

  if (kraChartData.length === 0) {
    kraChartData.push({ status: 'No Data', count: 1, color: '#e2e8f0' });
  }

  // --- Prepare Objectives Chart Data (using dynamic progress from KRAs) ---
  const objectiveChartData = objectivesWithDynamicProgress.map(obj => ({
    title: obj.title,
    progress: obj.progress || 0
  })).sort((a, b) => b.progress - a.progress)
    .slice(0, 10);

  // Check if we're using local storage mode - Remove dependency on setupState.csvConfig
  // Assume local storage if explicitly set, otherwise assume not local.
  const isLocalStorage = localStorage.getItem('unitopia_storage_type') === 'local';

  // Handler for initiating the switch to OneDrive - Remove dependency on setupState.csvConfig
  const handleCreateOneDriveFolder = async (folderName) => {
    try {
      // Check if we have the Microsoft Graph hook available
      if (!(window as any).msalInstance) {
        toast.error('Microsoft authentication is not available');
        return;
      }

      // Create a folder in OneDrive
      toast.info('Creating OneDrive folder...');

      // Get a token
      const accounts = (window as any).msalInstance.getAllAccounts();
      if (!accounts || accounts.length === 0) {
        toast.error('No Microsoft account found. Please sign in first.');
        return;
      }

      const response = await (window as any).msalInstance.acquireTokenSilent({
        scopes: ['Files.ReadWrite.All'],
        account: accounts[0]
      });

      // Create the folder directly using fetch
      const result = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${response.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: folderName,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename'
        })
      });

      if (!result.ok) {
        const errorText = await result.text();
        toast.error(`Failed to create folder: ${result.status} ${result.statusText}`);
        console.error('Error creating folder:', errorText);
        return;
      }

      const folderData = await result.json();

      // Switch to OneDrive mode - This function might need removal or refactoring
      // as setupState is optional/removed
      // const switchResult = await setupState?.switchToOneDrive({
      //   folderId: folderData.id,
      //   folderName: folderData.name
      // });

      // if (switchResult) {
      //   toast.success(`Switched to OneDrive folder: ${folderData.name}`);
      // }
      toast.info("OneDrive folder created. Functionality to switch data storage needs review."); // Placeholder message

    } catch (error) {
      console.error('Error switching to OneDrive:', error);
      toast.error(`Failed to switch to OneDrive: ${error.message}`);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div ref={containerRef} className={cn("space-y-6 border border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-all duration-300", isFullScreen ? "bg-background overflow-y-auto h-screen fixed inset-0 z-50 border-0 m-0 rounded-none" : "bg-gradient-to-br from-card to-muted/30 shadow-sm")}>
      <div className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col space-y-1.5">
          <h2 className="text-2xl font-bold tracking-tight">Dashboard Overview</h2>
          <p className="text-muted-foreground">High-level summary of unit performance and metrics.</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} title={isFullScreen ? "Exit Full Screen" : "Full Screen"}>
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {/* Setup File Button - Removed */}
      {/* <div className="flex justify-end">
        <Button
          // onClick={() => setupState?.setShowSetupWizard(true)} // Functionality removed/optional
          onClick={() => toast.info("Setup functionality needs review.")} // Placeholder action
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" /> Setup File 
        </Button>
      </div> */}

      {/* Local Storage Notice */}
      {isLocalStorage && (
        <LocalStorageFallbackNotice onSwitch={() => setShowSwitchDialog(true)} />
      )}

      <div className="space-y-6">
        {/* Unit Performance Highlights */}
        <div className="grid grid-cols-1 gap-4">
          <Card className="bg-gradient-to-br from-[#400010]/5 to-transparent border-[#400010]/10 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Zap className="w-32 h-32 text-primary rotate-12" />
            </div>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Unit Insights & Performance Analysis</CardTitle>
              </div>
              <CardDescription>Automated operational intelligence for {userUnit || 'the Unit'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                    <TrendingUp size={12} className="text-green-600" /> Operational Velocity
                  </p>
                  <p className="text-sm font-medium leading-relaxed">{insights.velocity}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                    <Target size={12} className="text-blue-600" /> Strategic Health
                  </p>
                  <p className="text-sm font-medium leading-relaxed">{insights.health}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                    <Activity size={12} className="text-amber-600" /> Resource Balance
                  </p>
                  <p className="text-sm font-medium leading-relaxed">{insights.balance}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-[#400010]/10 mt-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                    <Crosshair size={14} className="text-primary animate-pulse" /> Unit Strategic Alignment Signal
                  </span>
                  <span className="text-xs font-bold text-primary">{Math.round(insights.kraHealthPct)}% synchronized with Enterprise Strategy</span>
                </div>
                <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-1000 ease-out" 
                    style={{ width: `${insights.kraHealthPct}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats cards - Expanded to 4 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Dialog>
            <Card className="group relative overflow-hidden transition-all hover:shadow-md border-primary/5 bg-card/50 backdrop-blur-sm">
              <div className="absolute -right-2 -bottom-2 opacity-[0.03] transition-transform group-hover:scale-110">
                <CheckCircle size={80} />
              </div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasks/Daily Operations</CardTitle>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{scopedTasks.length}</div>
                <p className="text-xs text-muted-foreground">
                  {completedTasks} completed, {inProgressTasks} in progress
                </p>
                <Progress className="h-2 mt-2" value={(completedTasks / scopedTasks.length) * 100 || 0} />
              </CardContent>
            </Card>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>About Tasks</DialogTitle>
                <DialogDescription>
                  Daily operations and task management
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p>This card shows the total volume of operational tasks currently in the system.</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-primary/20"></div>
                    <span><strong>Progress Bar:</strong> Visualizes the completion rate relative to total tasks.</span>
                  </div>
                </div>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li><strong>Analysis:</strong> High task volume with low completion may indicate bottlenecks.</li>
                  <li><strong>Trend:</strong> A steady increase in completed tasks shows healthy operational velocity.</li>
                </ul>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog>
            <Card className="group relative overflow-hidden transition-all hover:shadow-md border-primary/5 bg-card/50 backdrop-blur-sm">
              <div className="absolute -right-2 -bottom-2 opacity-[0.03] transition-transform group-hover:scale-110">
                <Activity size={80} />
              </div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">KPIs/Operational Metrics</CardTitle>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{scopedKpis.length}</div>
                <p className="text-xs text-muted-foreground">
                  {kpiStatusCounts.onTrack + kpiStatusCounts.completed} healthy metrics
                </p>
                <div className="flex h-2 mt-2 w-full rounded-full overflow-hidden bg-secondary">
                  <div style={{ width: `${(kpiStats.onTrack / (Object.values(kpiStats).reduce((a, b) => a + b, 0) || 1)) * 100}%` }} className="bg-emerald-500" title="On Track" />
                  <div style={{ width: `${(kpiStats.completed / (Object.values(kpiStats).reduce((a, b) => a + b, 0) || 1)) * 100}%` }} className="bg-blue-500" title="Completed" />
                  <div style={{ width: `${(kpiStats.atRisk / (Object.values(kpiStats).reduce((a, b) => a + b, 0) || 1)) * 100}%` }} className="bg-amber-500" title="At Risk" />
                  <div style={{ width: `${(kpiStats.behind / (Object.values(kpiStats).reduce((a, b) => a + b, 0) || 1)) * 100}%` }} className="bg-rose-500" title="Behind" />
                </div>
              </CardContent>
            </Card>
            <DialogContent className="max-w-md" container={isFullScreen ? containerRef.current : null}>
              <DialogHeader>
                <DialogTitle>About KPIs</DialogTitle>
                <DialogDescription>
                  Key Performance Indicators summary
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p>This card aggregates the status of all KPIs associated with your unit's KRAs.</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                    <span><strong>Green:</strong> On Track</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-blue-500"></div>
                    <span><strong>Blue:</strong> Completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-amber-500"></div>
                    <span><strong>Yellow:</strong> At Risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-rose-500"></div>
                    <span><strong>Red:</strong> Behind</span>
                  </div>
                </div>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li><strong>Analysis:</strong> The colored bar provides an instant visual health check of your performance metrics.</li>
                  <li><strong>Trend:</strong> A growing green/blue section indicates successful strategy execution.</li>
                </ul>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog>
            <Card className="group relative overflow-hidden transition-all hover:shadow-md border-primary/5 bg-card/50 backdrop-blur-sm">
              <div className="absolute -right-2 -bottom-2 opacity-[0.03] transition-transform group-hover:scale-110">
                <Target size={80} />
              </div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">KRAs/Strategic Alignment</CardTitle>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{scopedKras.length}</div>
                <p className="text-xs text-muted-foreground">
                  {kraStatusCounts.onTrack + kraStatusCounts.completed} on track/done
                </p>
                <Progress
                  className="h-2 mt-2"
                  value={scopedKras.reduce((acc, kra) => acc + calculateKraProgress(kra, allKpis), 0) / (scopedKras.length || 1)}
                />
              </CardContent>
            </Card>
            <DialogContent className="max-w-md" container={isFullScreen ? containerRef.current : null}>
              <DialogHeader>
                <DialogTitle>About KRA Progress</DialogTitle>
                <DialogDescription>
                  Key Result Area performance
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p>This card shows the overall KRA completion for your unit, calculated live from the status of linked KPIs — <strong>no stored value is used</strong>.</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-primary/20"></div>
                    <span><strong>Percentage:</strong> Average across all KRAs of (completed KPIs ÷ total KPIs) × 100.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-primary/20"></div>
                    <span><strong>X completed:</strong> Count of KRAs where <em>all</em> linked KPIs have status "Completed".</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-primary/20"></div>
                    <span><strong>Progress Bar:</strong> Visualizes the same average across all KRAs.</span>
                  </div>
                </div>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li><strong>How to move this number:</strong> Mark individual KPIs as <em>Completed</em> in the KRAs &amp; Objectives tab.</li>
                  <li><strong>Note:</strong> Target/Actual figures on KPIs do not affect this percentage — only the KPI status does.</li>
                </ul>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <Card className="group relative overflow-hidden transition-all hover:shadow-md border-primary/5 bg-card/50 backdrop-blur-sm">
              <div className="absolute -right-2 -bottom-2 opacity-[0.03] transition-transform group-hover:scale-110">
                <Flag size={80} />
              </div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Objectives Summary</CardTitle>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalObjectives}</div>
                <p className="text-xs text-muted-foreground">
                  {completedObjectives} completed
                </p>
                <Progress
                  className="h-2 mt-2"
                  value={objectiveProgress} // Average progress of objectives
                />
              </CardContent>
            </Card>
            <DialogContent className="max-w-md" container={isFullScreen ? containerRef.current : null}>
              <DialogHeader>
                <DialogTitle>About Objectives</DialogTitle>
                <DialogDescription>
                  Strategic Objectives overview
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p>This card displays the count and progress of high-level strategic objectives.</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-primary/20"></div>
                    <span><strong>Progress Bar:</strong> Visualizes the average progress across all Objectives.</span>
                  </div>
                </div>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li><strong>Analysis:</strong> Objectives are the highest level of goal tracking. Stalled progress here impacts all downstream KRAs and KPIs.</li>
                  <li><strong>Trend:</strong> Consistent progress indicates good alignment between daily work and strategic vision.</li>
                </ul>
              </div>
            </DialogContent>
          </Dialog>
        </div>


        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Dialog>
            <Card className="group relative">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Task Completion</CardTitle>
                    <CardDescription>Overall progress of all tasks</CardDescription>
                  </div>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DialogTrigger>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex flex-col items-center justify-center gap-6">
                  <TaskCompletionDonut
                    segments={[
                      { value: todoTasks, color: '#cbd5e1', label: 'To Do' },
                      { value: inProgressTasks, color: '#9E3A5D', label: 'In Progress' },
                      { value: onHoldTasks, color: '#f97316', label: 'On Hold' },
                      { value: reviewTasks, color: '#83002A', label: 'In Review' },
                      { value: completedTasks, color: '#5C001E', label: 'Completed' }
                    ]}
                    centerLabel={`${scopedTasks.length > 0 ? Math.round((completedTasks / scopedTasks.length) * 100) : 0}%`}
                    centerSubtext="Completed"
                    size={200}
                  />
                </div>
              </CardContent>
            </Card>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>About Task Completion</DialogTitle>
                <DialogDescription>
                  Breakdown of task statuses
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p>This donut chart visualizes the distribution of tasks by their current status.</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#cbd5e1]"></div>
                    <span><strong>To Do:</strong> Not yet started.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#9E3A5D]"></div>
                    <span><strong>In Progress:</strong> Currently being worked on.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#f97316]"></div>
                    <span><strong>On Hold:</strong> Suspended or waiting.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#83002A]"></div>
                    <span><strong>In Review:</strong> Awaiting approval or feedback.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#5C001E]"></div>
                    <span><strong>Completed:</strong> Successfully finished.</span>
                  </div>
                </div>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li><strong>Analysis:</strong> A large 'In Progress' segment suggests good activity, but 'Review' bottlenecks should be monitored.</li>
                  <li><strong>Trend:</strong> The goal is to maximize the dark maroon 'Done' segment over time.</li>
                </ul>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <Card className="group relative">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Task Groups</CardTitle>
                    <CardDescription>Active tasks by group</CardDescription>
                  </div>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DialogTrigger>
                </div>
              </CardHeader>
              <CardContent>
                {/* Using new TaskGroupList component (Horizontal Cards) */}
                <TaskGroupList data={taskGroupData} />
              </CardContent>
            </Card>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>About Task Groups</DialogTitle>
                <DialogDescription>
                  Workload by category
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p>This list shows how your active tasks are distributed across different projects, departments, or custom groups.</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li><strong>Analysis:</strong> identifies which projects or teams carry the heaviest workload.</li>
                  <li><strong>Trend:</strong> Balanced distribution ensures no single group is overwhelmed.</li>
                </ul>
                <p className="text-muted-foreground pt-2 border-t">
                  The colored bars indicate the relative volume of tasks in each group.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog>
          <Card className="group relative">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Task Trends</CardTitle>
                  <CardDescription>Tasks completed vs. new tasks over time</CardDescription>
                </div>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <TaskTrendsLine data={taskTrendData} />
              </div>
            </CardContent>
          </Card>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>About Task Trends</DialogTitle>
              <DialogDescription>
                Historical task activity analysis
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <p>This chart tracks task activity over time, showing the volume of new tasks versus completed tasks.</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" style={{ height: '2px' }}></div>
                  <span><strong>Line Trend:</strong> Shows the velocity of task completion.</span>
                </div>
              </div>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Analysis:</strong> Helps forecast workload and identify productivity peaks or slumps.</li>
                <li><strong>Trend:</strong> Ideally, the completion rate should match or exceed the rate of new tasks to prevent backlog accumulation.</li>
              </ul>
            </div>
          </DialogContent>
        </Dialog>

        {/* Duplicated KPI Performance Card - Full Width */}
        <Dialog>
          <Card className="group relative">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>KPI Performance</CardTitle>
                  <CardDescription>Performance distribution of KPIs (Expanded View)</CardDescription>
                </div>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <KPIPerformanceBar data={kpiStatusData} />
              </div>
            </CardContent>
          </Card>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>About KPI Performance</DialogTitle>
              <DialogDescription>
                Detailed KPI status breakdown
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <p>This bar chart provides a comparative view of KPI statuses across the organization.</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#34d399]"></div>
                  <span><strong>On Track:</strong> Progressing as planned.</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#3b82f6]"></div>
                  <span><strong>Completed:</strong> Goal achieved.</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#fbbf24]"></div>
                  <span><strong>At Risk:</strong> Needs attention.</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#ef4444]"></div>
                  <span><strong>Behind:</strong> Delayed.</span>
                </div>
              </div>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Analysis:</strong> Compares the volume of successful KPIs against those needing intervention.</li>
                <li><strong>Trend:</strong> Watch for any increase in the 'At Risk' or 'Behind' bars to take proactive measures.</li>
              </ul>
            </div>
          </DialogContent>
        </Dialog>

        {/* NEW Charts: KRA Status and Objectives Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Dialog>
            <Card className="group relative">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>KRA Status Distribution</CardTitle>
                    <CardDescription>Overview of KRA health</CardDescription>
                  </div>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DialogTrigger>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <KRAStatusChart data={kraChartData} />
                </div>
              </CardContent>
            </Card>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>About KRA Status</DialogTitle>
                <DialogDescription>
                  Health check of Key Result Areas
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p>This chart categorizes KRAs based on their overall status.</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-[#34d399]"></div>
                    <span><strong>On Track:</strong> Proceeding nicely.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-[#3b82f6]"></div>
                    <span><strong>Completed:</strong> Done.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-[#fbbf24]"></div>
                    <span><strong>At Risk:</strong> Warning signs present.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-[#ef4444]"></div>
                    <span><strong>Off Track:</strong> Deviated from plan.</span>
                  </div>
                </div>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li><strong>Analysis:</strong> Provides a high-level strategic health check. A healthy dashboard is predominantly blue and green.</li>
                  <li><strong>Trend:</strong> Use this to identify systemic issues if multiple KRAs go off-track simultaneously.</li>
                </ul>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <Card className="group relative">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Top Objectives Progress</CardTitle>
                    <CardDescription>Progress of key objectives</CardDescription>
                  </div>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DialogTrigger>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ObjectivesProgressChart data={objectiveChartData} />
                </div>
              </CardContent>
            </Card>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>About Top Objectives</DialogTitle>
                <DialogDescription>
                  Leaderboard of strategic goals
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p>This chart ranks your top strategic objectives by their completion percentage.</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-primary/20"></div>
                    <span><strong>Bars:</strong> Represent the percentage of progress towards the objective goal.</span>
                  </div>
                </div>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li><strong>Analysis:</strong> Highlights which top-tier goals are nearing completion and which are lagging.</li>
                  <li><strong>Trend:</strong> Focus resources on objectives consistently appearing at the bottom of this list.</li>
                </ul>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Task Audit Table - Removed */}

      </div>

      {/* Switch to OneDrive Dialog */}
      <SwitchToOneDriveDialog
        isOpen={showSwitchDialog}
        onClose={() => setShowSwitchDialog(false)}
        onSwitch={handleCreateOneDriveFolder}
      />
    </div>
  );
};
