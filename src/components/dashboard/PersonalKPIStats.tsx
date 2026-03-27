
import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Loader2, Info } from 'lucide-react';
import { useSharePointTasks, useSharePointKRAs, useSharePointKPIs } from '@/hooks/useSharePointOps';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useGraphProfile } from '@/hooks/useGraphProfile';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { useStaffByDepartment } from '@/hooks/useStaffByDepartment';
import { startOfQuarter, endOfQuarter, isWithinInterval, getQuarter, getYear, parseISO, isValid } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { PersonalKPIStatsSkeleton } from './skeletons/PersonalKPIStatsSkeleton';

const PersonalKPIStats: React.FC = () => {
  // 1. Context & User Setup
  const { user } = useSupabaseAuth();
  const { profile: graphProfile } = useGraphProfile();
  const { user: roleUser } = useRoleBasedAuth();
  const { currentUserDepartment } = useStaffByDepartment();

  // Determine effective department
  const targetDepartment = currentUserDepartment || user?.user_metadata?.divisionName;

  const userContext = useMemo(() => ({
    division: graphProfile?.officeLocation || user?.user_metadata?.divisionName || 'General',
    unit: graphProfile?.department || user?.user_metadata?.unitName || 'General',
    email: graphProfile?.mail || user?.email || '',
    name: graphProfile?.displayName || user?.user_metadata?.full_name || user?.email || '',
    role: roleUser?.role_name
  }), [user, graphProfile, roleUser]);

  // 2. Data Fetching
  const taskState = useSharePointTasks(targetDepartment, 'Individual', userContext);
  const kraState = useSharePointKRAs(targetDepartment, 'Individual', userContext);
  const kpiState = useSharePointKPIs(targetDepartment, userContext);

  const isLoading = taskState.loading || kraState.loading || kpiState.loading;

  // 3. Data Processing for Charts
  const currentYear = new Date().getFullYear();

  const quarterlyData = useMemo(() => {
    const quarters = [1, 2, 3, 4];

    return quarters.map(q => {
      const qStart = new Date(currentYear, (q - 1) * 3, 1);
      const qEnd = endOfQuarter(qStart);

      // -- Productivity (Tasks) --
      // Formula: (Completed Tasks in Quarter / Total Tasks due or completed in Quarter) * 100
      const tasks = taskState.data || [];

      // Strict Personal Filter: 
      // 1. Must be assigned to current user (email match)
      // 2. Exclude [MOCK] tasks (to clean up view as requested)
      const personalTasks = tasks.filter(t => {
        // Check both 'assignedTo' (legacy/single) and 'assignees' (multi-select)
        const isAssignedToMe =
          t.assignedTo?.toLowerCase() === userContext.email?.toLowerCase() ||
          t.assignees?.some(a => a.email?.toLowerCase() === userContext.email?.toLowerCase());

        const isMock = t.title?.includes('[MOCK]');
        return isAssignedToMe && !isMock;
      });

      const quarterTasks = personalTasks.filter(t => {
        // Check if completed in this quarter
        if (t.completionDate) {
          const cDate = new Date(t.completionDate);
          if (isValid(cDate) && isWithinInterval(cDate, { start: qStart, end: qEnd })) return true;
        }
        // Check if due in this quarter
        if (t.dueDate) {
          const dDate = new Date(t.dueDate);
          if (isValid(dDate) && isWithinInterval(dDate, { start: qStart, end: qEnd })) return true;
        }
        return false;
      });

      const completedInQuarter = quarterTasks.filter(t =>
        (t.status === 'done' || t.status === 'completed') &&
        t.completionDate &&
        isWithinInterval(new Date(t.completionDate), { start: qStart, end: qEnd })
      ).length;

      const productivity = quarterTasks.length > 0
        ? Math.round((completedInQuarter / quarterTasks.length) * 100)
        : 0;


      // -- Efficiency (KPIs) --
      // Formula: Average % achievement of KPIs due or active in this quarter

      // Filter out orphaned KPIs (must be linked to an active KRA)
      const kras = kraState.data || [];
      const validKraIds = new Set(kras.map(k => String(k.id)));

      const kpis = (kpiState.data || []).filter(k =>
        k.kra_id && validKraIds.has(String(k.kra_id))
      );

      const quarterKpis = kpis.filter(k => {
        // Use targetDate or startDate to place in quarter
        const dateToCheck = k.targetDate ? new Date(k.targetDate) : (k.startDate ? new Date(k.startDate) : null);
        if (dateToCheck && isValid(dateToCheck)) {
          return isWithinInterval(dateToCheck, { start: qStart, end: qEnd });
        }
        return false;
      });

      let totalEfficiency = 0;
      let efficiencyCount = 0;

      quarterKpis.forEach(k => {
        const actual = Number(k.actual) || 0;
        const target = Number(k.target) || 1; // Avoid divide by zero
        if (target > 0) {
          // Cap individual KPI efficiency at 100% for the aggregate chart to avoid skewing?
          // Or let it fly. Let's cap at 100 for the visual chart consistency unless it's sales.
          const eff = Math.min(100, (actual / target) * 100);
          totalEfficiency += eff;
          efficiencyCount++;
        }
      });

      const efficiency = efficiencyCount > 0 ? Math.round(totalEfficiency / efficiencyCount) : 0;


      // -- KRA Success --
      // Formula: Average progress of KRAs due or active in this quarter
      const quarterKras = kras.filter(k => {
        const dateToCheck = k.targetDate ? new Date(k.targetDate) : (k.startDate ? new Date(k.startDate) : null);
        if (dateToCheck && isValid(dateToCheck)) {
          return isWithinInterval(dateToCheck, { start: qStart, end: qEnd });
        }
        return false;
      });

      const totalKraProgress = quarterKras.reduce((acc, k) => acc + ((k as any).progress || 0), 0);
      const kraSuccess = quarterKras.length > 0 ? Math.round(totalKraProgress / quarterKras.length) : 0;


      return {
        name: `Q${q}`,
        productivity,
        efficiency,
        kraSuccess
      };
    });
  }, [taskState.data, kraState.data, kpiState.data, currentYear]);


  // 4. Quarterly Goals List
  const quarterlyGoals = useMemo(() => {
    const kras = kraState.data || [];
    const quarters = [1, 2, 3, 4];
    let goals: any[] = [];

    quarters.forEach(q => {
      const qStart = new Date(currentYear, (q - 1) * 3, 1);
      const qEnd = endOfQuarter(qStart);

      const krasInQuarter = kras.filter(k => {
        const dateToCheck = k.targetDate ? new Date(k.targetDate) : (k.startDate ? new Date(k.startDate) : null);
        if (dateToCheck && isValid(dateToCheck)) {
          return isWithinInterval(dateToCheck, { start: qStart, end: qEnd });
        }
        return false;
      });

      const mappedGoals = krasInQuarter.map(k => ({
        quarter: `Q${q}`,
        goal: k.title,
        progress: (k as any).progress || 0,
        status: k.status === 'completed' || ((k as any).progress || 0) >= 100 ? 'completed' : 'in-progress'
      }));

      goals = [...goals, ...mappedGoals];
    });

    // If no goals found, maybe show a placeholder or empty state? 
    // For now, let's just return what we have.
    // If absolutely empty (new user), maybe add one dummy "Set Goals" item?
    if (goals.length === 0 && !isLoading) {
      return [];
    }

    return goals;

  }, [kraState.data, currentYear, isLoading]);


  if (isLoading) {
    return <PersonalKPIStatsSkeleton />;
  }

  return (
    <Card className="bg-white dark:bg-gray-800 shadow-sm mb-6 animate-fade-in rounded-xl group border dark:border-white/10">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold dark:text-gray-100">
          <Activity className="h-5 w-5 text-intranet-primary" />
          Personal KPI Statistics
        </CardTitle>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              <Info className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Personal KPI Statistics</DialogTitle>
              <DialogDescription>Quarterly performance metrics breakdown</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <p>This chart visualizes your performance across three key dimensions: Productivity (task completion), Efficiency (KPI achievement), and KRA Success (goal progress) for each quarter of the current year.</p>

              <div className="space-y-2">
                <h4 className="font-semibold text-xs uppercase text-muted-foreground">Legend Colors</h4>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#83002A]"></div>
                    <span><strong>Productivity:</strong> Task completion vs assignments.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ff6b6b]"></div>
                    <span><strong>Efficiency:</strong> KPI target achievement rate.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#5C001E]"></div>
                    <span><strong>KRA Success:</strong> Progress on long-term goals.</span>
                  </div>
                </div>
              </div>

              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Analysis:</strong> Compare the three metrics to identify if high activity (Productivity) translates to effective results (Efficiency/KRA).</li>
                <li><strong>Trend:</strong> Look for consistent growth or maintenance of high scores across all quarters. Dips in one area may indicate a need for focus shift.</li>
              </ul>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="h-80">
        <Tabs defaultValue="performance" className="w-full h-full flex flex-col">
          <TabsList className="grid grid-cols-2 mb-4 flex-shrink-0 dark:bg-gray-900/50 dark:border-gray-700">
            <TabsTrigger value="performance" className="dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-white">Performance Trends</TabsTrigger>
            <TabsTrigger value="goals" className="dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-white">Quarterly Goals</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-4 flex-1 overflow-hidden">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={quarterlyData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" className="dark:opacity-50" />
                  <XAxis dataKey="name" tick={{ fill: '#9CA3AF' }} axisLine={{ stroke: '#4B5563' }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#9CA3AF' }} axisLine={{ stroke: '#4B5563' }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value}%`, name]}
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151', 
                      borderRadius: '8px', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
                      color: '#F3F4F6'
                    }}
                    itemStyle={{ color: '#F3F4F6' }}
                  />
                  <Legend />
                  <Bar dataKey="productivity" name="Productivity" fill="#83002A" radius={[8, 8, 8, 8]} />
                  <Bar dataKey="efficiency" name="Efficiency" fill="#ff6b6b" radius={[8, 8, 8, 8]} />
                  <Bar dataKey="kraSuccess" name="KRA Success" fill="#5C001E" radius={[8, 8, 8, 8]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-center text-muted-foreground">
              Quarterly Performance Metrics ({currentYear})
            </div>
          </TabsContent>

          <TabsContent value="goals" className="flex-1 overflow-hidden">
            {quarterlyGoals.length > 0 ? (
              <div className="h-full overflow-y-auto py-4 space-y-4 scrollbar-thin pr-2">
                {quarterlyGoals.map((goal, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-intranet-primary dark:text-intranet-accent-light">{goal.quarter}</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300 line-clamp-1" title={goal.goal}>{goal.goal}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 flex-shrink-0">{goal.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${goal.status === 'completed' ? 'bg-green-600' : 'bg-intranet-primary'}`}
                        style={{ width: `${goal.progress}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <p>No goals found for this year.</p>
                <p className="text-xs">Add KRAs with target dates to see them here.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default PersonalKPIStats;
