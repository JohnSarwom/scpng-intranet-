import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar, BarChart2, Target, Clock, Flag,
  CheckCircle, AlertTriangle, Briefcase, Settings, Cloud, Activity
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useStrategySharePoint } from '@/hooks/useStrategySharePoint';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Objective, Task, Project, KRA } from '@/types';

import { TaskCompletionDonut } from '@/components/dashboard/TaskCompletionDonut';
import LocalStorageFallbackNotice from '@/components/setup-wizard/components/LocalStorageFallbackNotice';

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
}

// Add a new component for the OneDrive switch dialog
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
  setupState
}) => {
  const [selectedInsight, setSelectedInsight] = useState('overview');
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const { strategyData } = useStrategySharePoint();
  const objectives = strategyData?.objectives || [];

  const completedTasks = tasks.filter(task => task.status?.toLowerCase() === 'done' || task.status?.toLowerCase() === 'completed').length;
  const inProgressTasks = tasks.filter(task => task.status?.toLowerCase() === 'in-progress' || task.status?.toLowerCase() === 'in progress').length;
  const todoTasks = tasks.filter(task => task.status?.toLowerCase() === 'todo' || task.status?.toLowerCase() === 'not started').length;
  const reviewTasks = tasks.filter(task => task.status?.toLowerCase() === 'review').length;

  const activeProjects = projects.filter(project => project.status === 'in-progress').length;
  const completedProjects = projects.filter(project => project.status === 'completed').length;
  const plannedProjects = projects.filter(project => project.status === 'planned').length;
  const onHoldProjects = projects.filter(project => project.status === 'on-hold').length;

  // --- Calculate Task Group Statistics ---
  // 1. Get all buckets (Default Statuses + Custom Groups from Projects)
  const initialBuckets = [
    { id: 'todo', title: 'TO DO' },
    { id: 'in-progress', title: 'IN PROGRESS' },
    { id: 'review', title: 'REVIEW' },
    { id: 'done', title: 'DONE' }
  ];

  const customBuckets = projects
    .filter(p => p.isCustomGroup)
    .map(p => ({ id: String(p.id), title: p.name }));

  const allBuckets = [...initialBuckets, ...customBuckets];

  // 2. Count tasks per bucket
  const taskCountsByBucket = allBuckets.reduce((acc, bucket) => {
    acc[bucket.id] = 0;
    return acc;
  }, {} as Record<string, number>);

  tasks.forEach(task => {
    // Logic must match TasksTab distribution logic
    if (task.projectId) {
      // If task belongs to a group (Project), count it there
      if (taskCountsByBucket[task.projectId] !== undefined) {
        taskCountsByBucket[task.projectId]++;
        return;
      }
    }

    // Fallback to Status
    const status = task.status?.toLowerCase().trim() || 'todo';
    let targetBucket = 'todo';

    if (status === 'todo' || status === 'not started' || status === 'open' || status === 'to do') targetBucket = 'todo';
    else if (status === 'in-progress' || status === 'in progress' || status === 'doing' || status === 'active') targetBucket = 'in-progress';
    else if (status === 'review' || status === 'in review' || status === 'under review') targetBucket = 'review';
    else if (status === 'done' || status === 'completed' || status === 'closed' || status === 'complete') targetBucket = 'done';
    else if (taskCountsByBucket[status] !== undefined) targetBucket = status;

    if (taskCountsByBucket[targetBucket] !== undefined) {
      taskCountsByBucket[targetBucket]++;
    }
  });

  // 3. Format data for the chart
  // Filter out empty buckets if too many? User said "put them... into the KPI card".
  // Let's show all non-empty or just significant ones.
  const taskGroupData = allBuckets.map((bucket, index) => ({
    name: bucket.title,
    value: taskCountsByBucket[bucket.id] || 0,
    color: index < 4 ? ['#94a3b8', '#fbbf24', '#f59e0b', '#34d399'][index] : '#3b82f6' // Default colors for first 4, blue for others
  }));


  // Calculate KPI Statuses
  const allKpis = kras.flatMap(kra => kra.unitKpis || kra.kpis || []);
  const kpiStats = {
    completed: allKpis.filter(k => k.status === 'completed').length,
    onTrack: allKpis.filter(k => k.status === 'on-track').length,
    atRisk: allKpis.filter(k => k.status === 'at-risk').length,
    behind: allKpis.filter(k => k.status === 'behind').length,
    notStarted: allKpis.filter(k => k.status === 'not-started' || !k.status).length
  };

  // Calculate Objective Statuses
  const totalObjectives = objectives?.length || 0;
  const completedObjectives = objectives?.filter(obj => obj.progress === 100).length || 0;
  // Fallback to progress calculation logic if exact status isn't available
  const objectiveProgress = totalObjectives > 0
    ? (objectives?.reduce((acc, obj) => acc + (obj.progress || 0), 0) || 0) / totalObjectives
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
    { name: 'Review', value: reviewTasks, color: '#f59e0b' },
    { name: 'Done', value: completedTasks, color: '#34d399' }
  ];

  const projectStatusData = [
    { name: 'Planned', value: plannedProjects, color: '#3b82f6' },
    { name: 'In Progress', value: activeProjects, color: '#fbbf24' },
    { name: 'Completed', value: completedProjects, color: '#34d399' },
    { name: 'On Hold', value: onHoldProjects, color: '#ef4444' }
  ];

  // Monthly task completion sample data
  // --- Derived Metrics ---
  const taskTrendData = React.useMemo(() => calculateTaskTrends(tasks), [tasks]);
  const trafficLightMetrics = React.useMemo(() => calculateTrafficLightMetrics(tasks, projects, objectives), [tasks, projects, objectives]);

  // --- Prepare KRA Chart Data ---
  const kraStatusCounts = {
    onTrack: kras.filter(k => k.status === 'on-track').length,
    atRisk: kras.filter(k => k.status === 'at-risk').length,
    offTrack: kras.filter(k => k.status === 'off-track').length,
    completed: kras.filter(k => k.status === 'completed' || k.status === 'closed').length, // handle both status sets
    pending: kras.filter(k => !k.status || k.status === 'pending').length
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
  const objectiveChartData = objectives.map(obj => ({
    title: obj.title,
    progress: obj.progress || 0
  })).sort((a, b) => b.progress - a.progress) // Sort by progress descending
    .slice(0, 10); // Limit to top 10 to prevent overflow

  // Check if we're using local storage mode - Remove dependency on setupState.csvConfig
  // Assume local storage if explicitly set, otherwise assume not local.
  const isLocalStorage = localStorage.getItem('unitopia_storage_type') === 'local';

  // Handler for initiating the switch to OneDrive - Remove dependency on setupState.csvConfig
  const handleCreateOneDriveFolder = async (folderName) => {
    try {
      // Check if we have the Microsoft Graph hook available
      if (!window.msalInstance) {
        toast.error('Microsoft authentication is not available');
        return;
      }

      // Create a folder in OneDrive
      toast.info('Creating OneDrive folder...');

      // Get a token
      const accounts = window.msalInstance.getAllAccounts();
      if (!accounts || accounts.length === 0) {
        toast.error('No Microsoft account found. Please sign in first.');
        return;
      }

      const response = await window.msalInstance.acquireTokenSilent({
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

  return (
    <div className="space-y-6 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex flex-col space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight">Dashboard Overview</h2>
        <p className="text-muted-foreground">High-level summary of unit performance and metrics.</p>
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasks/Daily Operations</CardTitle>
              <CheckCircle className="h-6 w-6 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasks.length}</div>
              <p className="text-xs text-muted-foreground">
                {completedTasks} completed, {inProgressTasks} in progress
              </p>
              <Progress className="h-2 mt-2" value={(completedTasks / tasks.length) * 100 || 0} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">KPIs</CardTitle>
              <Briefcase className="h-6 w-6 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kras.reduce((acc, kra) => acc + (kra.unitKpis?.length || kra.kpis?.length || 0), 0)}
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">KRA Progress</CardTitle>
              <Target className="h-6 w-6 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(kras.reduce((acc, kra) => acc + kra.progress, 0) / (kras.length || 1))}%
              </div>
              <p className="text-xs text-muted-foreground">
                {kras.filter(kra => kra.status === 'closed').length} completed
              </p>
              <Progress
                className="h-2 mt-2"
                value={kras.reduce((acc, kra) => acc + kra.progress, 0) / (kras.length || 1)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Objectives Summary</CardTitle>
              <Flag className="h-6 w-6 text-muted-foreground" />
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
        </div>


        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Task Completion</CardTitle>
              <CardDescription>Overall progress of all tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex flex-col items-center justify-center gap-6">
                <TaskCompletionDonut
                  segments={[
                    { value: todoTasks, color: '#cbd5e1', label: 'To Do' },
                    { value: inProgressTasks, color: '#9E3A5D', label: 'In Progress' },
                    { value: reviewTasks, color: '#83002A', label: 'Review' },
                    { value: completedTasks, color: '#5C001E', label: 'Done' }
                  ]}
                  centerLabel={`${tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0}%`}
                  centerSubtext="Completed"
                  size={200}
                />


              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Task Groups</CardTitle>
              <CardDescription>Active tasks by group</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Using new TaskGroupList component (Horizontal Cards) */}
              <TaskGroupList data={taskGroupData} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Task Trends</CardTitle>
            <CardDescription>Tasks completed vs. new tasks over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <TaskTrendsLine data={taskTrendData} />
            </div>
          </CardContent>
        </Card>

        {/* Duplicated KPI Performance Card - Full Width */}
        <Card>
          <CardHeader>
            <CardTitle>KPI Performance</CardTitle>
            <CardDescription>Performance distribution of KPIs (Expanded View)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <KPIPerformanceBar data={kpiStatusData} />
            </div>
          </CardContent>
        </Card>

        {/* NEW Charts: KRA Status and Objectives Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>KRA Status Distribution</CardTitle>
              <CardDescription>Overview of KRA health</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <KRAStatusChart data={kraChartData} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Objectives Progress</CardTitle>
              <CardDescription>Progress of key objectives</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ObjectivesProgressChart data={objectiveChartData} />
              </div>
            </CardContent>
          </Card>
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
