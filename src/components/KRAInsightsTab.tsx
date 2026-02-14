import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
  viewScope: 'my' | 'department' | 'organization';
  onScopeChange: (scope: 'my' | 'department' | 'organization') => void;
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
  foreground: '#0f172a'
};

const statusColors: Record<string, string> = {
  'Completed': themeColors.primary,
  'On Track': '#10b981',
  'In Progress': '#3b82f6',
  'Pending': themeColors.neutral,
  'Not Started': themeColors.neutral,
  'On Hold': '#f59e0b',
  'At Risk': themeColors.accent,
  'Behind': '#ef4444',
};

export const KRAInsightsTab: React.FC<KRAInsightsTabProps> = ({ kras, viewScope, onScopeChange }) => {
  const validKras = Array.isArray(kras) ? kras : [];
  const { theme } = useTheme();
  const { user } = useSupabaseAuth();

  // Computed Data based on Scope
  const { activeKras, activeKpis, scopeLabel } = React.useMemo(() => {
    let krasResult = validKras;
    let kpisResult = validKras.flatMap(k => k.unitKpis || []);
    let label = 'Organization';

    if (viewScope === 'my' && user) {
      krasResult = validKras.filter(k => k.ownerId === user.id);
      // For KPIs, filtering by assignment
      kpisResult = validKras.flatMap(k => k.unitKpis || [])
        .filter(kpi => kpi.assignees?.some(a => a.email === user.email));
      label = 'My';
    } else if (viewScope === 'department' && user?.user_metadata?.unitName) {
      krasResult = validKras.filter(k => k.unit === user.user_metadata.unitName);
      kpisResult = krasResult.flatMap(k => k.unitKpis || []);
      label = 'Department';
    }

    return { activeKras: krasResult, activeKpis: kpisResult, scopeLabel: label };
  }, [viewScope, validKras, user]);

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
        statusCounts[kpi.status] = (statusCounts[kpi.status] || 0) + 1;
      }
    });
    return Object.entries(statusCounts)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0);
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
        <div className="rounded-lg border bg-background p-2 shadow-sm text-sm">
          <p className="font-medium mb-1">{label || payload[0].name}</p>
          <p className="text-muted-foreground">
            <span style={{ color: payload[0].payload?.fill || payload[0].color }}>■</span> {payload[0].name}:
            <span className="font-bold ml-1">{payload[0].value}{unit || ''}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 mt-4">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{scopeLabel} KRA Status Overview</CardTitle>
            <CardDescription>Status distribution of KRAs ({scopeLabel.toLowerCase()})</CardDescription>
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
                      <tspan x="50%" dy="-0.5em" fontSize="24" fontWeight="bold" fill={themeColors.foreground}>
                        {kraCompletionRate}%
                      </tspan>
                      <tspan x="50%" dy="1.5em" fontSize="12" fill={themeColors.neutral}>
                        Completed
                      </tspan>
                    </text>
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      formatter={(value, entry) => <span style={{ color: themeColors.foreground }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-4">
                  <p className="text-muted-foreground">No KRAs found in {scopeLabel} view.</p>
                  {viewScope === 'my' && (
                    <Button variant="outline" size="sm" onClick={() => onScopeChange('organization')}>
                      View Organization Stats
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{scopeLabel} KPI Status</CardTitle>
            <CardDescription>Status distribution of KPIs ({scopeLabel.toLowerCase()})</CardDescription>
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
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={themeColors.neutral} strokeOpacity={0.3} />
                    <XAxis type="number" allowDecimals={false} stroke={themeColors.neutral} fontSize={12} />
                    <YAxis type="category" dataKey="name" width={80} stroke={themeColors.neutral} fontSize={12} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="value" name="KPIs" radius={[0, 8, 8, 0]}>
                      {kpiStatusData.map((entry) => (
                        <Cell key={`cell-kpi-${entry.name}`} fill={statusColors[entry.name] || themeColors.neutral} />
                      ))}
                      <LabelList dataKey="value" position="right" fontSize={11} fill={themeColors.foreground} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-4">
                  <p className="text-muted-foreground">No KPIs found in {scopeLabel} view.</p>
                  {viewScope === 'my' && (
                    <Button variant="outline" size="sm" onClick={() => onScopeChange('organization')}>
                      View Organization Stats
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New insights section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completion Trend Chart - UPDATED */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{scopeLabel} Completion Rate (6 Months)</CardTitle>
            <CardDescription>Average KPI completion rate over the last 6 months</CardDescription>
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
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
                <div className="flex items-center justify-center h-full text-muted-foreground">No trend data available.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPI Distribution by Objective - UPDATED with Labels */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>KPI Distribution by Objective</CardTitle>
            <CardDescription>Top objectives by number of KPIs ({scopeLabel.toLowerCase()})</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {kpisByObjective.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={kpisByObjective}
                    margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      interval={0}
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="total" name="Total KPIs" fill={themeColors.neutral} radius={[8, 8, 8, 8]}>
                      <LabelList dataKey="total" position="top" fontSize={11} fill={themeColors.foreground} />
                    </Bar>
                    <Bar dataKey="completed" name="Completed" fill={themeColors.primary} radius={[8, 8, 8, 8]}>
                      <LabelList dataKey="completed" position="top" fontSize={11} fill={themeColors.foreground} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No objective data available.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Priority KPIs Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Priority KPIs Needing Attention</CardTitle>
          <CardDescription>KPIs ({scopeLabel.toLowerCase()}) that are at risk or behind</CardDescription>
        </CardHeader>
        <CardContent>
          {priorityKpis.length > 0 ? (
            <div className="space-y-4">
              {priorityKpis.map((kpi) => (
                <div key={kpi.id} className="border rounded-md p-4 bg-muted/20">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium mb-1">{kpi.name}</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {kpi.kraTitle} • {kpi.objective}
                      </p>
                    </div>
                    <Badge variant={kpi.status === 'at-risk' ? 'destructive' : 'default'}>
                      {kpi.status === 'at-risk' ? 'At Risk' : 'Behind'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Target</p>
                      <p className="font-medium">{kpi.target}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Actual</p>
                      <p className="font-medium">{kpi.actual || 0}</p>
                    </div>
                    {(kpi.target_date || kpi.targetDate) && (
                      <div>
                        <p className="text-muted-foreground">Target Date</p>
                        <p className="font-medium">
                          {new Date(kpi.target_date || kpi.targetDate || '').toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No priority KPIs to show. Great job!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KRAInsightsTab;