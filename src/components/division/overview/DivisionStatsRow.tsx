import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle, Target, TrendingUp, Briefcase, Users, BarChart2,
  AlertTriangle, ArrowUp, ArrowDown, Minus
} from 'lucide-react';
import { DivisionMetrics } from '@/types/division.types';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle: string;
  trend?: 'up' | 'down' | 'flat';
  trendColor?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subtitle, trend, trendColor }) => {
  const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus;
  const defaultTrendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            {icon}
            <span className="text-xs font-medium">{label}</span>
          </div>
          {trend && (
            <TrendIcon className={`h-3.5 w-3.5 ${trendColor || defaultTrendColor}`} />
          )}
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
};

interface DivisionStatsRowProps {
  metrics: DivisionMetrics;
}

export const DivisionStatsRow: React.FC<DivisionStatsRowProps> = ({ metrics }) => {
  const stats: StatCardProps[] = [
    {
      icon: <CheckCircle className="h-4 w-4" />,
      label: 'Total Tasks',
      value: metrics.totalTasks,
      subtitle: `${metrics.completedTasks} completed, ${metrics.overdueTasks} overdue`,
      trend: metrics.overdueTasks > 5 ? 'down' : 'up',
    },
    {
      icon: <Target className="h-4 w-4" />,
      label: 'Active KRAs',
      value: metrics.activeKRAs,
      subtitle: `${metrics.atRiskKRAs} at-risk, ${metrics.completedKRAs} completed`,
      trend: metrics.atRiskKRAs > 3 ? 'down' : 'flat',
    },
    {
      icon: <TrendingUp className="h-4 w-4" />,
      label: 'KPI On Track',
      value: `${metrics.kpiOnTrackPercentage}%`,
      subtitle: `${metrics.totalKPIs} total KPIs tracked`,
      trend: metrics.kpiOnTrackPercentage >= 70 ? 'up' : 'down',
    },
    {
      icon: <Briefcase className="h-4 w-4" />,
      label: 'Active Projects',
      value: metrics.activeProjects,
      subtitle: `${metrics.completedProjects} completed, ${metrics.overdueProjects} overdue`,
      trend: metrics.overdueProjects > 0 ? 'down' : 'up',
    },
    {
      icon: <Users className="h-4 w-4" />,
      label: 'Staff',
      value: metrics.staffCount,
      subtitle: `~${metrics.averageTasksPerPerson} tasks/person`,
      trend: 'flat',
    },
    {
      icon: <BarChart2 className="h-4 w-4" />,
      label: 'Strategic Alignment',
      value: `${metrics.strategicAlignmentScore}%`,
      subtitle: 'Objectives linked to strategy',
      trend: metrics.strategicAlignmentScore >= 70 ? 'up' : 'down',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((stat, idx) => (
        <StatCard key={idx} {...stat} />
      ))}
    </div>
  );
};
