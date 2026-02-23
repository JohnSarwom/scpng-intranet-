import React, { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar, BarChart2, Target, Clock, Flag,
  CheckCircle, AlertTriangle, Briefcase, Settings, Cloud, Activity, Info, Maximize2, Minimize2, Users, TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import { KPIPerformanceBar } from '@/components/dashboard/KPIPerformanceBar';
import { TaskTrendsLine } from '@/components/dashboard/TaskTrendsLine';
import { TaskGroupList } from '@/components/dashboard/TaskGroupList';
import { KRAStatusChart } from '@/components/dashboard/KRAStatusChart';
import { ObjectivesProgressChart } from '@/components/dashboard/ObjectivesProgressChart';
import { TrafficLightCard } from '@/components/dashboard/TrafficLightCard';
import { calculateTaskTrends, calculateTrafficLightMetrics } from '@/utils/dashboardUtils';
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
  buckets = [],
  unitRoster,
  userContext
}) => {
  const [selectedInsight, setSelectedInsight] = useState('overview');
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { strategyData } = useStrategySharePoint();
  const objectives = strategyData?.objectives || [];

  // --- View Scope ---
  const [viewScope, setViewScope] = useState<DashboardViewScope>('individual');

  // Set default scope based on role when userContext becomes available
  useEffect(() => {
    if (!userContext?.role) return;
    const role = userContext.role.toLowerCase();
    if (role === 'admin' || role === 'super_admin') setViewScope('division');
    else if (role === 'manager') setViewScope('unit');
    else setViewScope('individual');
  }, [userContext?.role]);

  // Only managers, admins, and super admins can use the View Scope dropdown
  const canUseViewScope = useMemo(() => {
    const role = userContext?.role?.toLowerCase();
    return role === 'manager' || role === 'admin' || role === 'super_admin';
  }, [userContext?.role]);

  const availableScopes = useMemo(() => {
    const role = userContext?.role?.toLowerCase();
    const isAdmin = role === 'admin' || role === 'super_admin';
    const isManager = role === 'manager';

    const scopes: { value: DashboardViewScope; label: string }[] = [
      { value: 'individual', label: 'My Data' }
    ];
    if (isManager || isAdmin) {
      scopes.push({ value: 'unit', label: userContext?.unit ? `Unit – ${userContext.unit}` : 'Unit' });
    }
    if (isAdmin) {
      scopes.push({ value: 'division', label: userContext?.division ? `Division – ${userContext.division}` : 'Division' });
    }
    return scopes;
  }, [userContext]);

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

  // --- Unit Staff Performance (only in Unit scope) ---
  // Source of truth is the live SharePoint UserRoles roster (unitRoster prop).
  // Falls back to the static DivisionStaffMap while the roster is loading,
  // so the UI is never blank during the initial fetch.
  const unitStaffPerformance = useMemo(() => {
    if (viewScope !== 'unit' || !canUseViewScope) return [];

    // Service-account / facility keywords — exclude these from performance cards
    const serviceKeywords = ['service account', 'facility', 'information service', 'boardroom', 'enquiries'];

    // Build a normalised roster: prefer live SharePoint data, fall back to static map
    type RosterEntry = { email: string; name: string; jobTitle: string };
    let rosterEntries: RosterEntry[];

    if (unitRoster && unitRoster.length > 0) {
      // Live roster from SharePoint UserRoles
      rosterEntries = unitRoster
        .filter(u => {
          const isService = serviceKeywords.some(
            kw => u.role_name?.toLowerCase().includes(kw) ||
              u.user_name?.toLowerCase().includes(kw) ||
              u.user_email?.toLowerCase().includes(kw)
          );
          return !isService;
        })
        .map(u => ({
          email: u.user_email,
          name: u.user_name || u.user_email,
          jobTitle: u.role_name || '',
        }));
    } else {
      // Fallback: static DivisionStaffMap (available immediately, no network needed)
      rosterEntries = DivisionStaffMap.getAllStaff()
        .filter(s => {
          const unitMatch = s.unit?.toLowerCase() === userUnit.toLowerCase();
          const isService = serviceKeywords.some(
            kw => s.job_title?.toLowerCase().includes(kw) || s.name?.toLowerCase().includes(kw)
          );
          return unitMatch && !isService;
        })
        .map(s => ({ email: s.email, name: s.name, jobTitle: s.job_title }));
    }

    if (rosterEntries.length === 0) return [];

    const getLevel = (score: number) => {
      if (score >= 80) return { label: 'Excellent', color: '#10b981', trend: 'up' };
      if (score >= 60) return { label: 'Good', color: '#3b82f6', trend: 'up' };
      if (score >= 40) return { label: 'Fair', color: '#f59e0b', trend: 'flat' };
      return { label: 'Needs Attention', color: '#ef4444', trend: 'down' };
    };

    return rosterEntries
      .map(staff => {
        const staffEmail = staff.email.toLowerCase();

        const staffTasks = tasks.filter(t =>
          t.assignees?.some(a => a.email?.toLowerCase() === staffEmail) ||
          t.createdByEmail?.toLowerCase() === staffEmail ||
          t.authorEmail?.toLowerCase() === staffEmail ||
          t.assignedTo?.toLowerCase() === staffEmail
        );

        const staffKras = kras.filter(k => {
          const kraKpis = (k.unitKpis || k.kpis || []) as any[];
          const hasAssignedKpi = kraKpis.some(kpi =>
            kpi.assignees?.some((a: any) => a.email?.toLowerCase() === staffEmail)
          );

          return k.owner?.email?.toLowerCase() === staffEmail ||
            k.createdByEmail?.toLowerCase() === staffEmail ||
            k.assignees?.some(a => a.email?.toLowerCase() === staffEmail) ||
            hasAssignedKpi;
        });

        // Task metrics
        const totalTasks = staffTasks.length;
        const doneTasks = staffTasks.filter(t =>
          ['done', 'completed', 'closed', 'complete'].includes(t.status?.toLowerCase() || '')
        ).length;
        const inProgressTasks = staffTasks.filter(t =>
          ['in-progress', 'in progress', 'doing', 'active'].includes(t.status?.toLowerCase() || '')
        ).length;
        const taskRate = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

        // KRA metrics
        const totalKras = staffKras.length;
        const completedKras = staffKras.filter(k =>
          (k.status as string) === 'completed' || (k.status as string) === 'closed'
        ).length;
        const onTrackKras = staffKras.filter(k => (k.status as string) === 'on-track').length;
        const atRiskKras = staffKras.filter(k =>
          (k.status as string) === 'at-risk' || (k.status as string) === 'off-track'
        ).length;
        const kraRate = totalKras > 0 ? ((completedKras + onTrackKras) / totalKras) * 100 : 0;

        // KPI metrics — count all KPIs assigned to this staff member across all KRAs
        const allStaffKpis = kras.flatMap(k => (k.unitKpis || k.kpis || []) as any[])
          .filter(kpi => kpi.assignees?.some((a: any) => a.email?.toLowerCase() === staffEmail));

        const totalKpis = allStaffKpis.length;
        const completedKpis = allStaffKpis.filter(kpi => kpi.status === 'completed').length;
        const onTrackKpis = allStaffKpis.filter(kpi => kpi.status === 'on-track').length;
        const atRiskKpis = allStaffKpis.filter(kpi =>
          kpi.status === 'at-risk' || kpi.status === 'behind'
        ).length;
        const kpiRate = totalKpis > 0 ? ((completedKpis + onTrackKpis) / totalKpis) * 100 : 0;

        // Weighted performance score
        let weightedScore = 0;
        let totalWeight = 0;
        if (totalTasks > 0) { weightedScore += taskRate * 0.4; totalWeight += 0.4; }
        if (totalKpis > 0) { weightedScore += kpiRate * 0.4; totalWeight += 0.4; }
        if (totalKras > 0) { weightedScore += kraRate * 0.2; totalWeight += 0.2; }
        const performanceScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

        const nameParts = staff.name.split(' ').filter(Boolean);
        const initials = nameParts.length >= 2
          ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
          : staff.name.substring(0, 2).toUpperCase();

        return {
          email: staff.email,
          name: staff.name,
          jobTitle: staff.jobTitle,
          initials,
          totalTasks,
          doneTasks,
          inProgressTasks,
          taskRate: Math.round(taskRate),
          totalKras,
          completedKras,
          onTrackKras,
          atRiskKras,
          kraRate: Math.round(kraRate),
          totalKpis,
          completedKpis,
          onTrackKpis,
          atRiskKpis,
          kpiRate: Math.round(kpiRate),
          performanceScore,
          level: getLevel(performanceScore),
        };
      })
      .sort((a, b) => b.performanceScore - a.performanceScore);
  }, [viewScope, canUseViewScope, tasks, kras, userUnit, unitRoster]);

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
      // Logic 2: Check for Virtual Buckets (e.g. Shared Tasks)
      // If we have 'shared-tasks-virtual' bucket, and the task has a project ID that we didn't find above,
      // it likely belongs there (orphaned project task).
      // Or if it's a cross-unit task.
      const isSharedBucketAvailable = taskCountsByBucket['shared-tasks-virtual'] !== undefined;

      // Simple heuristic for Overview: If it has a project ID but didn't match a bucket above, and we have shared bucket -> put it there.
      if (isSharedBucketAvailable && task.projectId && task.projectId !== 'undefined') {
        taskCountsByBucket['shared-tasks-virtual']++;
        matchedBucket = true; // Counted in shared
      }
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

  // Calculate Objective Statuses
  const totalObjectives = scopedObjectives?.length || 0;
  const completedObjectives = scopedObjectives?.filter(obj => obj.progress === 100).length || 0;
  // Fallback to progress calculation logic if exact status isn't available
  const objectiveProgress = totalObjectives > 0
    ? (scopedObjectives?.reduce((acc, obj) => acc + (obj.progress || 0), 0) || 0) / totalObjectives
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

  // --- Prepare KRA Chart Data ---
  const kraStatusCounts = {
    onTrack: scopedKras.filter(k => (k.status as string) === 'on-track').length,
    atRisk: scopedKras.filter(k => (k.status as string) === 'at-risk').length,
    offTrack: scopedKras.filter(k => (k.status as string) === 'off-track').length,
    completed: scopedKras.filter(k => (k.status as string) === 'completed' || (k.status as string) === 'closed').length,
    pending: scopedKras.filter(k => !k.status || (k.status as string) === 'pending').length
  };

  const kraChartData = [
    { status: 'On Track', count: kraStatusCounts.onTrack, color: '#34d399' },
    { status: 'Completed', count: kraStatusCounts.completed, color: '#3b82f6' },
    { status: 'At Risk', count: kraStatusCounts.atRisk, color: '#fbbf24' },
    { status: 'Off Track', count: kraStatusCounts.offTrack, color: '#ef4444' },
    // Only show pending if > 0 to save space
    ...(kraStatusCounts.pending > 0 ? [{ status: 'Pending', count: kraStatusCounts.pending, color: '#94a3b8' }] : [])
  ].filter(d => d.count > 0); // Hide zero values

  if (kraChartData.length === 0) {
    kraChartData.push({ status: 'No Data', count: 1, color: '#e2e8f0' });
  }

  // --- Prepare Objectives Chart Data ---
  const objectiveChartData = scopedObjectives.map(obj => ({
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
    <div ref={containerRef} className={cn("space-y-6 border border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-all duration-300", isFullScreen ? "bg-background overflow-y-auto h-screen fixed inset-0 z-50 border-0 m-0 rounded-none" : "")}>
      <div className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col space-y-1.5">
          <h2 className="text-2xl font-bold tracking-tight">Dashboard Overview</h2>
          <p className="text-muted-foreground">High-level summary of unit performance and metrics.</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {canUseViewScope && availableScopes.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">View Scope:</span>
              <Select value={viewScope} onValueChange={(v) => setViewScope(v as DashboardViewScope)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableScopes.map(scope => (
                    <SelectItem key={scope.value} value={scope.value}>
                      {scope.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
        {/* Stats cards - Expanded to 4 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Dialog>
            <Card className="group relative">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasks/Daily Operations</CardTitle>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
                <CheckCircle className="h-6 w-6 text-muted-foreground opacity-50 absolute right-6 top-6" />
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
            <Card className="group relative">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">KPIs</CardTitle>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
                <Briefcase className="h-6 w-6 text-muted-foreground opacity-50 absolute right-6 top-6" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {scopedKras.reduce((acc, kra) => acc + (kra.unitKpis?.length || kra.kpis?.length || 0), 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total KPIs tracked across all KRAs
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
            <Card className="group relative">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">KRA Progress</CardTitle>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
                <Target className="h-6 w-6 text-muted-foreground opacity-50 absolute right-6 top-6" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(scopedKras.reduce((acc, kra) => acc + kra.progress, 0) / (scopedKras.length || 1))}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {scopedKras.filter(kra => kra.status === 'closed').length} completed
                </p>
                <Progress
                  className="h-2 mt-2"
                  value={scopedKras.reduce((acc, kra) => acc + kra.progress, 0) / (scopedKras.length || 1)}
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
                <p>This card tracks the average completion percentage of all assigned KRAs.</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-primary/20"></div>
                    <span><strong>Progress Bar:</strong> Visualizes the average progress across all KRAs.</span>
                  </div>
                </div>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li><strong>Analysis:</strong> A low percentage here suggests that while daily tasks might be moving, strategic goals are lagging.</li>
                  <li><strong>Trend:</strong> Ensure this metric moves in tandem with your KPI completion rates.</li>
                </ul>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <Card className="group relative">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Objectives Summary</CardTitle>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
                <Flag className="h-6 w-6 text-muted-foreground opacity-50 absolute right-6 top-6" />
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

        {/* Unit Staff Performance Section */}
        {viewScope === 'unit' && canUseViewScope && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">Unit Staff Performance</h3>
                <p className="text-sm text-muted-foreground">
                  Individual performance metrics for staff in {userUnit || 'this unit'}
                </p>
              </div>
            </div>

            {unitStaffPerformance.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border rounded-lg bg-muted/30">
                <Users className="h-10 w-10 mb-3 opacity-40" />
                <p className="font-medium">No staff found for <span className="text-foreground">{userUnit}</span></p>
                <p className="text-xs mt-1">Ensure unit names match the staff directory exactly.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {unitStaffPerformance.map(staff => (
                  <Card
                    key={staff.email}
                    className="border-l-4 overflow-hidden"
                    style={{ borderLeftColor: staff.level.color }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        {/* Avatar + Name */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
                            style={{ backgroundColor: staff.level.color }}
                          >
                            {staff.initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm leading-tight truncate">{staff.name}</p>
                            {staff.jobTitle && (
                              <p className="text-xs font-medium text-muted-foreground truncate">{staff.jobTitle}</p>
                            )}
                            <p className="text-xs text-muted-foreground/60 truncate">{staff.email}</p>
                          </div>
                        </div>
                        {/* Score */}
                        <div className="text-right flex-shrink-0">
                          <div className="text-2xl font-bold leading-none" style={{ color: staff.level.color }}>
                            {staff.performanceScore}%
                          </div>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            {staff.level.trend === 'up' && <TrendingUp className="h-3 w-3" style={{ color: staff.level.color }} />}
                            {staff.level.trend === 'down' && <TrendingDown className="h-3 w-3" style={{ color: staff.level.color }} />}
                            {staff.level.trend === 'flat' && <Minus className="h-3 w-3" style={{ color: staff.level.color }} />}
                            <span className="text-xs font-medium" style={{ color: staff.level.color }}>
                              {staff.level.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 pt-0">
                      {/* Tasks */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                            <CheckCircle className="h-3 w-3" /> Daily Tasks
                          </span>
                          <span className="text-xs tabular-nums">
                            <span className="font-semibold">{staff.doneTasks}</span>
                            <span className="text-muted-foreground">/{staff.totalTasks} done</span>
                            {staff.inProgressTasks > 0 && (
                              <span className="text-muted-foreground ml-1">· {staff.inProgressTasks} active</span>
                            )}
                          </span>
                        </div>
                        <Progress value={staff.taskRate} className="h-1.5" />
                      </div>

                      {/* KRAs */}
                      {staff.totalKras > 0 && (
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                              <Target className="h-3 w-3" /> KRAs
                            </span>
                            <span className="text-xs tabular-nums">
                              <span className="font-semibold">{staff.completedKras}</span>
                              <span className="text-muted-foreground"> done · {staff.onTrackKras} on-track / {staff.totalKras}</span>
                            </span>
                          </div>
                          <Progress value={staff.kraRate} className="h-1.5" />
                        </div>
                      )}

                      {/* KPIs */}
                      {staff.totalKpis > 0 && (
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                              <Briefcase className="h-3 w-3" /> KPIs
                            </span>
                            <span className="text-xs tabular-nums">
                              <span className="font-semibold">{staff.completedKpis}</span>
                              <span className="text-muted-foreground"> done · {staff.onTrackKpis} on-track / {staff.totalKpis}</span>
                            </span>
                          </div>
                          <Progress value={staff.kpiRate} className="h-1.5" />
                        </div>
                      )}

                      {/* Risk badges */}
                      {(staff.atRiskKras > 0 || staff.atRiskKpis > 0) && (
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                          {staff.atRiskKras > 0 && (
                            <Badge variant="destructive" className="text-xs px-1.5 py-0">
                              <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                              {staff.atRiskKras} KRA{staff.atRiskKras > 1 ? 's' : ''} at risk
                            </Badge>
                          )}
                          {staff.atRiskKpis > 0 && (
                            <Badge variant="destructive" className="text-xs px-1.5 py-0">
                              <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                              {staff.atRiskKpis} KPI{staff.atRiskKpis > 1 ? 's' : ''} at risk
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

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
