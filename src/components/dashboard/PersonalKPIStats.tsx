
import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Loader2 } from 'lucide-react';
import { useSharePointTasks, useSharePointKRAs, useSharePointKPIs } from '@/hooks/useSharePointOps';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useGraphProfile } from '@/hooks/useGraphProfile';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { useStaffByDepartment } from '@/hooks/useStaffByDepartment';
import { startOfQuarter, endOfQuarter, isWithinInterval, getQuarter, getYear, parseISO, isValid } from 'date-fns';

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
      const kpis = kpiState.data || [];
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
      const kras = kraState.data || [];
      const quarterKras = kras.filter(k => {
        const dateToCheck = k.targetDate ? new Date(k.targetDate) : (k.startDate ? new Date(k.startDate) : null);
        if (dateToCheck && isValid(dateToCheck)) {
          return isWithinInterval(dateToCheck, { start: qStart, end: qEnd });
        }
        return false;
      });

      const totalKraProgress = quarterKras.reduce((acc, k) => acc + (k.progress || 0), 0);
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
        progress: k.progress || 0,
        status: k.status === 'completed' || (k.progress || 0) >= 100 ? 'completed' : 'in-progress'
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
    return (
      <Card className="shadow-sm mb-6 animate-fade-in rounded-xl h-96 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-intranet-primary animate-spin" />
      </Card>
    );
  }

  return (
    <Card className="shadow-sm mb-6 animate-fade-in rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Activity className="h-5 w-5 text-intranet-primary" />
          Personal KPI Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <Tabs defaultValue="performance" className="w-full h-full flex flex-col">
          <TabsList className="grid grid-cols-2 mb-4 flex-shrink-0">
            <TabsTrigger value="performance">Performance Trends</TabsTrigger>
            <TabsTrigger value="goals">Quarterly Goals</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-4 flex-1 overflow-hidden">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={quarterlyData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    formatter={(value) => [`${value}%`, 'Score']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                  <Bar dataKey="productivity" name="Productivity" fill="#83002A" radius={[8, 8, 8, 8]} />
                  <Bar dataKey="efficiency" name="Efficiency" fill="#5C001E" radius={[8, 8, 8, 8]} />
                  <Bar dataKey="kraSuccess" name="KRA Success" fill="#9E3A5D" radius={[8, 8, 8, 8]} />
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
                        <span className="text-sm font-semibold text-intranet-primary">{goal.quarter}</span>
                        <span className="text-sm text-gray-700 line-clamp-1" title={goal.goal}>{goal.goal}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-600 flex-shrink-0">{goal.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
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
