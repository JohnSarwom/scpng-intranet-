import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Kra, Kpi, User } from '@/types/kpi';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LabelList,
  AreaChart,
  Area
} from 'recharts';
import { useTheme } from "next-themes";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { Badge } from '@/components/ui/badge';

interface KRAInsightsTabProps {
  kras: Kra[];
}

const getKraProgress = (kpis: Kpi[]): number => {
  if (!kpis || kpis.length === 0) return 0;
  const totalTarget = kpis.reduce((sum, kpi) => sum + (Number(kpi.target) || 0), 0);
  if (totalTarget === 0) return 0;
  const totalActual = kpis.reduce((sum, kpi) => sum + (Number(kpi.actual) || 0), 0);
  const progress = Math.min(100, (totalActual / totalTarget) * 100);
  return Math.round(progress);
};

const getKraStatus = (kpis: Kpi[]): string => {
  if (!kpis || kpis.length === 0) return 'Not Started';
  if (kpis.some(kpi => kpi.status === 'at-risk')) return 'At Risk';
  if (kpis.some(kpi => kpi.status === 'behind')) return 'Behind';
  if (kpis.some(kpi => kpi.status === 'on-hold')) return 'On Hold';
  if (kpis.some(kpi => kpi.status === 'in-progress')) return 'In Progress';
  if (kpis.some(kpi => kpi.status === 'on-track')) return 'On Track';
  if (kpis.every(kpi => kpi.status === 'completed')) return 'Completed';
  return 'Not Started';
};

const themeColors = {
  primary: '#83002A',
  secondary: '#5C001E',
  accent: '#ff6b6b',
  neutral: '#64748b',
  background: '#ffffff',
  foreground: '#0f172a',
  dark: {
    background: '#0a0a0a',
    foreground: '#f8fafc',
    neutral: '#94a3b8',
    border: 'rgba(255, 255, 255, 0.1)'
  }
};

const statusColors: Record<string, string> = {
  'Completed': '#83002A',
  'On Track': '#10b981',
  'In Progress': '#3b82f6',
  'Pending': '#64748b',
  'Not Started': '#64748b',
  'On Hold': '#f59e0b',
  'At Risk': '#ff6b6b',
  'Behind': '#ef4444',
};

export const KRAInsightsTab: React.FC<KRAInsightsTabProps> = ({ kras }) => {
  const validKras = Array.isArray(kras) ? kras : [];
  const { theme } = useTheme();
  const { user } = useSupabaseAuth();

  // Computed Data based on Individual Scope
  const { activeKras, activeKpis } = React.useMemo(() => {
    let krasResult = validKras;
    let kpisResult = validKras.flatMap(k => k.unitKpis || []);

    if (user) {
      krasResult = validKras.filter(k => k.ownerId === user.id);
      // For KPIs, filtering by assignment
      kpisResult = validKras.flatMap(k => k.unitKpis || [])
        .filter(kpi => kpi.assignees?.some(a => a.email === user.email));
    }

    return { activeKras: krasResult, activeKpis: kpisResult };
  }, [validKras, user]);

  const kraStatusData = React.useMemo(() => {
    const statusCounts: Record<string, number> = {};
    activeKras.forEach(kra => {
      const status = getKraStatus(kra.unitKpis || []);
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    return Object.entries(statusCounts)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0);
  }, [activeKras]);

  // Calculate generic completion (Completed / Total)
  const kraCompletionRate = React.useMemo(() => {
    if (activeKras.length === 0) return 0;
    const completed = activeKras.filter(kra => getKraStatus(kra.unitKpis || []) === 'Completed').length;
    return Math.round((completed / activeKras.length) * 100);
  }, [activeKras]);

  const kpiStatusData = React.useMemo(() => {
    const statusCounts: Record<string, number> = {};
    activeKpis.forEach(kpi => {
      if (kpi?.status) {
        // Normalize status to match statusColors keys (Title Case)
        const normalizedStatus = kpi.status
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        statusCounts[normalizedStatus] = (statusCounts[normalizedStatus] || 0) + 1;
      }
    });

    // Sort logic to match the order in modals if possible, or just value desc
    return Object.entries(statusCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [activeKpis]);

  // Completion Trend (Last 6 Months)
  const completionTrendData = React.useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();

    // Get last 6 months including current
    const relevantMonths = Array.from({ length: 6 }, (_, i) => {
      const monthIndex = (currentMonth - i + 12) % 12;
      return months[monthIndex];
    }).reverse();

    // Create baseline data
    const baseData = relevantMonths.map(month => ({ month, completed: 0, total: 0 }));

    // Count KPIs using the *active scope* (or all if that's preferred for trends, but scope is consistent)
    activeKpis.forEach(kpi => {
      if (kpi.target_date || kpi.targetDate) {
        const date = new Date(kpi.target_date || kpi.targetDate || '');
        if (!isNaN(date.getTime())) {
          const monthName = months[date.getMonth()];
          const monthIndex = relevantMonths.indexOf(monthName);

          if (monthIndex !== -1) {
            baseData[monthIndex].total++;
            if (kpi.status === 'completed') {
              baseData[monthIndex].completed++;
            }
          }
        }
      }
    });

    return baseData.map(item => ({
      ...item,
      percentage: item.total === 0 ? 0 : Math.round((item.completed / item.total) * 100)
    }));
  }, [activeKpis]);

  // KPI distribution by objective
  const kpisByObjective = React.useMemo(() => {
    const objectiveMap: Record<string, { total: number, completed: number, name: string }> = {};

    activeKras.forEach(kra => {
      const objectiveId = kra.objective_id?.toString() || 'unknown';
      const objectiveName = kra.unitObjectives?.title || 'Unknown Objective';

      if (!objectiveMap[objectiveId]) {
        objectiveMap[objectiveId] = { total: 0, completed: 0, name: objectiveName };
      }

      const kpis = kra.unitKpis || [];
      objectiveMap[objectiveId].total += kpis.length;
      objectiveMap[objectiveId].completed += kpis.filter(kpi => kpi.status === 'completed').length;
    });

    return Object.values(objectiveMap)
      .filter(obj => obj.total > 0)
      .map(obj => ({
        name: obj.name,
        total: obj.total,
        completed: obj.completed,
        percentage: Math.round((obj.completed / obj.total) * 100)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5); // Top 5 objectives
  }, [activeKras]);

  // Priority KPIs (At Risk / Behind)
  const priorityKpis = React.useMemo(() => {
    return activeKpis
      .filter(kpi => kpi.status === 'at-risk' || kpi.status === 'behind')
      .map(kpi => {
        // Find parent KRA for context
        const parentKra = validKras.find(kra =>
          kra.unitKpis?.some(k => k.id === kpi.id)
        );

        return {
          ...kpi,
          kraTitle: parentKra?.title || 'Unknown KRA',
          objective: parentKra?.unitObjectives?.title || 'Unknown Objective'
        };
      })
      .slice(0, 3);
  }, [activeKpis, validKras]);

  const CustomTooltip = ({ active, payload, label, unit }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background dark:bg-gray-950 dark:border-white/10 p-2 shadow-sm text-sm">
          <p className="font-medium mb-1 border-b dark:border-white/10 pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-muted-foreground flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: entry.color || entry.fill }}
              />
              <span className="dark:text-gray-300">{entry.name}:</span>
              <span className="font-bold ml-auto dark:text-gray-100">{entry.value}{unit || ''}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 mt-4">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Dialog>
          <Card className="group relative dark:bg-gray-900 dark:border-white/10">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="dark:text-gray-100">My KRA Status Overview</CardTitle>
                  <CardDescription className="dark:text-gray-400">Status distribution of My KRAs</CardDescription>
                </div>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 dark:hover:bg-gray-800">
                    <Info className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
                  </Button>
                </DialogTrigger>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {kraStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip content={<CustomTooltip />} />
                      <Pie
                        data={kraStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={100}
                        paddingAngle={5}
                        cornerRadius={10}
                        dataKey="value"
                        labelLine={false}
                        stroke="none"
                      >
                        {kraStatusData.map((entry) => (
                          <Cell key={`cell-kra-${entry.name}`} fill={statusColors[entry.name] || themeColors.neutral} />
                        ))}
                      </Pie>
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                        <tspan x="50%" dy="-0.5em" fontSize="24" fontWeight="bold" fill={theme === 'dark' ? themeColors.dark.foreground : themeColors.foreground}>
                          {kraCompletionRate}%
                        </tspan>
                        <tspan x="50%" dy="1.5em" fontSize="12" fill={theme === 'dark' ? themeColors.dark.neutral : themeColors.neutral}>
                          Completed
                        </tspan>
                      </text>
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        formatter={(value, entry) => <span style={{ color: theme === 'dark' ? themeColors.dark.foreground : themeColors.foreground }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-4">
                    <p className="text-muted-foreground dark:text-gray-500">No KRAs assigned to you.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <DialogContent className="max-w-md dark:bg-gray-950 dark:border-white/10">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-100">About KRA Status</DialogTitle>
              <DialogDescription className="dark:text-gray-400">
                Overview of Key Result Areas status
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm dark:text-gray-300">
              <p>This chart provides a high-level view of how KRAs are progressing:</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#83002A]"></div>
                  <span><strong>Completed:</strong> All KPIs within the KRA are finished.</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#10b981]"></div>
                  <span><strong>On Track:</strong> Moving forward according to plan.</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#3b82f6]"></div>
                  <span><strong>In Progress:</strong> Active but may need monitoring.</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#ef4444]"></div>
                  <span><strong>Behind:</strong> Issues detected that may affect the KRA outcome.</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#ff6b6b]"></div>
                  <span><strong>At Risk:</strong> Significant issues needing immediate attention.</span>
                </div>
              </div>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Analysis:</strong> Helps identify which areas need support and which are performing well.</li>
                <li><strong>Trend:</strong> A high percentage of 'On Track' or 'Completed' indicates successful execution, while 'At Risk' suggests potential blockers.</li>
              </ul>
              <div className="mt-4 pt-4 border-t dark:border-white/10">
                <p className="font-medium dark:text-gray-200">Center Metric</p>
                <p className="text-muted-foreground dark:text-gray-400">The percentage in the center represents the overall completion rate of KRAs.</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <Card className="group relative dark:bg-gray-900 dark:border-white/10">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="dark:text-gray-100">My KPI Status</CardTitle>
                  <CardDescription className="dark:text-gray-400">Status distribution of My KPIs</CardDescription>
                </div>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 dark:hover:bg-gray-800">
                    <Info className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
                  </Button>
                </DialogTrigger>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {kpiStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={kpiStatusData}
                      margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                      barGap={4}
                      barSize={12}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={theme === 'dark' ? themeColors.dark.neutral : themeColors.neutral} strokeOpacity={0.2} />
                      <XAxis type="number" allowDecimals={false} stroke={theme === 'dark' ? themeColors.dark.neutral : themeColors.neutral} fontSize={12} />
                      <YAxis type="category" dataKey="name" width={80} stroke={theme === 'dark' ? themeColors.dark.neutral : themeColors.neutral} fontSize={12} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                      <Bar dataKey="value" name="KPIs" radius={[0, 8, 8, 0]}>
                        {kpiStatusData.map((entry) => (
                          <Cell key={`cell-kpi-${entry.name}`} fill={statusColors[entry.name] || themeColors.neutral} />
                        ))}
                        <LabelList dataKey="value" position="right" fontSize={11} fill={theme === 'dark' ? themeColors.dark.foreground : themeColors.foreground} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-4">
                    <p className="text-muted-foreground dark:text-gray-500">No KPIs assigned to you.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <DialogContent className="max-w-md dark:bg-gray-950 dark:border-white/10">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-100">About KPI Status</DialogTitle>
              <DialogDescription className="dark:text-gray-400">
                Current status of Key Performance Indicators
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm dark:text-gray-300">
              <p>This chart breaks down KPIs by their current tracking status:</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#83002A]"></div>
                  <span><strong>Completed:</strong> KPIs that have reached their target.</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#10b981]"></div>
                  <span><strong>On Track:</strong> Progressing as expected towards the deadline.</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#3b82f6]"></div>
                  <span><strong>In Progress:</strong> Active but may need monitoring.</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#ef4444]"></div>
                  <span><strong>Behind:</strong> Falling short of expected progress.</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#ff6b6b]"></div>
                  <span><strong>At Risk:</strong> Significant issues needing immediate attention.</span>
                </div>
              </div>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Analysis:</strong> Provides a granular view of performance across all objectives.</li>
                <li><strong>Trend:</strong> Monitoring the shift of KPIs from 'In Progress' to 'Completed' helps track operational velocity.</li>
              </ul>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* New insights section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completion Trend Chart - UPDATED */}
        <Dialog>
          <Card className="group relative dark:bg-gray-900 dark:border-white/10">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="dark:text-gray-100">My Completion Rate (6 Months)</CardTitle>
                  <CardDescription className="dark:text-gray-400">My average KPI completion rate over the last 6 months</CardDescription>
                </div>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 dark:hover:bg-gray-800">
                    <Info className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
                  </Button>
                </DialogTrigger>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {completionTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={completionTrendData}
                      margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorPercentage" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={themeColors.accent} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={themeColors.accent} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? themeColors.dark.neutral : themeColors.neutral} strokeOpacity={0.2} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} stroke={theme === 'dark' ? themeColors.dark.neutral : themeColors.neutral} />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} stroke={theme === 'dark' ? themeColors.dark.neutral : themeColors.neutral} />
                      <Tooltip content={<CustomTooltip unit="%" />} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="percentage"
                        name="Completion %"
                        stroke={themeColors.accent}
                        fillOpacity={1}
                        fill="url(#colorPercentage)"
                        strokeWidth={3}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground dark:text-gray-500">No trend data available.</div>
                )}
              </div>
            </CardContent>
          </Card>
          <DialogContent className="max-w-md dark:bg-gray-950 dark:border-white/10">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-100">About Completion Rate</DialogTitle>
              <DialogDescription className="dark:text-gray-400">
                Historical performance trends
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm dark:text-gray-300">
              <p>
                This area chart tracks the <strong>average KPI completion rate</strong> over the past 6 months.
              </p>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-[#ff6b6b]"></div>
                <span><strong>Completion %:</strong> The upward or downward trend of completed KPIs over time.</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Analysis:</strong> Helps ensure consistency in performance delivery.</li>
                <li><strong>Trend:</strong> An upward trend indicates improving efficiency, while a downward trend may suggest bottlenecks or increasing workload.</li>
              </ul>
              <p className="text-muted-foreground dark:text-gray-400 pt-2 border-t dark:border-white/10">
                Based on target dates of KPIs falling within each month.
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* KPI Distribution by Objective - UPDATED with Info Modal */}
        <Dialog>
          <Card className="group relative dark:bg-gray-900 dark:border-white/10">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="dark:text-gray-100">My KPI Distribution by Objective</CardTitle>
                  <CardDescription className="dark:text-gray-400">Top objectives by number of My KPIs</CardDescription>
                </div>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 dark:hover:bg-gray-800">
                    <Info className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
                  </Button>
                </DialogTrigger>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {kpisByObjective.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={kpisByObjective}
                      margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? themeColors.dark.neutral : themeColors.neutral} strokeOpacity={0.2} />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        fontSize={11}
                        tickLine={false}
                        height={40}
                        stroke={theme === 'dark' ? themeColors.dark.neutral : themeColors.neutral}
                        tick={({ x, y, payload }) => (
                          <g transform={`translate(${x},${y})`}>
                            <title>{payload.value}</title>
                            <text
                              x={0}
                              y={0}
                              dy={16}
                              textAnchor="middle"
                              fill={theme === 'dark' ? themeColors.dark.neutral : themeColors.neutral}
                              fontSize={11}
                            >
                              {payload.value.length > 12 ? `${payload.value.substring(0, 12)}...` : payload.value}
                            </text>
                          </g>
                        )}
                      />
                      <YAxis tickLine={false} axisLine={false} stroke={theme === 'dark' ? themeColors.dark.neutral : themeColors.neutral} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="total" name="Total KPIs" fill={theme === 'dark' ? themeColors.dark.neutral : themeColors.neutral} radius={[8, 8, 8, 8]}>
                        <LabelList dataKey="total" position="top" fontSize={11} fill={theme === 'dark' ? themeColors.dark.foreground : themeColors.foreground} />
                      </Bar>
                      <Bar dataKey="completed" name="Completed" fill={themeColors.primary} radius={[8, 8, 8, 8]}>
                        <LabelList dataKey="completed" position="top" fontSize={11} fill={theme === 'dark' ? themeColors.dark.foreground : themeColors.foreground} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground dark:text-gray-500">No objective data available.</div>
                )}
              </div>
            </CardContent>
          </Card>
          <DialogContent className="max-w-md dark:bg-gray-950 dark:border-white/10">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-100">About this Chart</DialogTitle>
              <DialogDescription className="dark:text-gray-400">
                Understanding the KPI Distribution by Objective
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm dark:text-gray-300">
              <p>
                This chart visualizes the workload distribution across your strategic objectives.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-slate-400 rounded-sm"></div>
                  <span><strong>Grey Bars (Total):</strong> The total number of KPIs linked to a specific objective.</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#83002A] rounded-sm"></div>
                  <span><strong>Maroon Bars (Completed):</strong> The count of KPIs that have been marked as completed.</span>
                </div>
              </div>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Analysis:</strong> Identifies which objectives are driving the most activity.</li>
                <li><strong>Trend:</strong> Large gaps between Total and Completed bars may indicate resource constraints or ambitious targeting.</li>
              </ul>
              <p className="text-muted-foreground dark:text-gray-400 pt-2 border-t dark:border-white/10">
                Use this chart to identify which objectives have the most activity and track their completion progress relative to the total workload.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Priority KPIs Section */}
      <Card className="dark:bg-gray-900 dark:border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="dark:text-gray-100">My Priority KPIs Needing Attention</CardTitle>
          <CardDescription className="dark:text-gray-400">My KPIs that are at risk or behind</CardDescription>
        </CardHeader>
        <CardContent>
          {priorityKpis.length > 0 ? (
            <div className="space-y-4">
              {priorityKpis.map((kpi) => (
                <div key={kpi.id} className="border dark:border-white/10 rounded-md p-4 bg-muted/20 dark:bg-gray-950/40">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium mb-1 dark:text-gray-100">{kpi.name}</h3>
                      <p className="text-sm text-muted-foreground dark:text-gray-400 mb-2">
                        {kpi.kraTitle} • {kpi.objective}
                      </p>
                    </div>
                    <Badge variant={kpi.status === 'at-risk' ? 'destructive' : 'default'} className={kpi.status === 'at-risk' ? '' : 'dark:bg-gray-800 dark:text-gray-300 dark:border-white/10'}>
                      {kpi.status === 'at-risk' ? 'At Risk' : 'Behind'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                    <div>
                      <p className="text-muted-foreground dark:text-gray-500">Target</p>
                      <p className="font-medium dark:text-gray-200">{kpi.target}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground dark:text-gray-500">Actual</p>
                      <p className="font-medium dark:text-gray-200">{kpi.actual || 0}</p>
                    </div>
                    {(kpi.target_date || kpi.targetDate) && (
                      <div>
                        <p className="text-muted-foreground dark:text-gray-500">Target Date</p>
                        <p className="font-medium dark:text-gray-200">
                          {new Date(kpi.target_date || kpi.targetDate || '').toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground dark:text-gray-500">
              No priority KPIs to show. Great job!
            </div>
          )}
        </CardContent>
      </Card >
    </div >
  );
};

export default KRAInsightsTab;