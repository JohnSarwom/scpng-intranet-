import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle, Target, TrendingUp, Briefcase, Users, BarChart2,
  AlertTriangle, ArrowUp, ArrowDown, Minus, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DivisionMetrics } from '@/types/division.types';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle: string;
  trend?: 'up' | 'down' | 'flat';
  trendColor?: string;
  info?: {
    title: string;
    description: string;
    content: React.ReactNode;
  };
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subtitle, trend, trendColor, info }) => {
  const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus;
  const defaultTrendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400';

  const cardContent = (
    <Card className="hover:shadow-md transition-shadow h-full relative group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            {icon}
            <span className="text-xs font-medium">{label}</span>
          </div>
          <div className="flex items-center gap-1">
            {info && (
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity -mr-1">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DialogTrigger>
            )}
            {trend && (
              <TrendIcon className={`h-3.5 w-3.5 ${trendColor || defaultTrendColor}`} />
            )}
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );

  if (info) {
    return (
      <Dialog>
        {cardContent}
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{info.title}</DialogTitle>
            <DialogDescription>{info.description}</DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-4">
            {info.content}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return cardContent;
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
      info: {
        title: "Total Tasks",
        description: "Division Workload Monitoring",
        content: (
          <>
            <p>The total volume of work currently assigned at the division level, tracking overall completion velocity.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Completed:</strong> Individual tasks successfully reached a 'Done' or 'Closed' state.</li>
              <li><strong>Overdue:</strong> Tasks that have passed their assigned deadline without being completed.</li>
              <li><strong>Significance:</strong> High overdue counts relative to total tasks may indicate resource bottlenecks or unrealistic timelines.</li>
            </ul>
          </>
        )
      }
    },
    {
      icon: <Target className="h-4 w-4" />,
      label: 'Active KRAs',
      value: metrics.activeKRAs,
      subtitle: `${metrics.atRiskKRAs} at-risk, ${metrics.completedKRAs} completed`,
      trend: metrics.atRiskKRAs > 3 ? 'down' : 'flat',
      info: {
        title: "Active KRAs",
        description: "Key Result Areas Tracking",
        content: (
          <>
            <p>Monitors the strategic priorities currently being pursued by the division.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>At-Risk:</strong> KRAs where linked KPIs are below target or milestones are failing.</li>
              <li><strong>Completed:</strong> Strategic outcomes that have been fully realized for the current period.</li>
              <li><strong>Significance:</strong> This metric ensures the division remains focused on its primary strategic mandates.</li>
            </ul>
          </>
        )
      }
    },
    {
      icon: <TrendingUp className="h-4 w-4" />,
      label: 'KPI On Track',
      value: `${metrics.kpiOnTrackPercentage}%`,
      subtitle: `${metrics.totalKPIs} total KPIs tracked`,
      trend: metrics.kpiOnTrackPercentage >= 70 ? 'up' : 'down',
      info: {
        title: "KPI On Track",
        description: "Performance Target Achievement",
        content: (
          <>
            <p>The percentage of measurable Key Performance Indicators that are currently meeting or exceeding their targets.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Tracking:</strong> Continuously monitors specific numeric targets across all units.</li>
              <li><strong>Threshold:</strong> Targets are considered 'On Track' when Actual value matches or exceeds the defined target.</li>
              <li><strong>Significance:</strong> This is the primary indicator of quantitative mission success.</li>
            </ul>
          </>
        )
      }
    },
    {
      icon: <Briefcase className="h-4 w-4" />,
      label: 'Active Projects',
      value: metrics.activeProjects,
      subtitle: `${metrics.completedProjects} completed, ${metrics.overdueProjects} overdue`,
      trend: metrics.overdueProjects > 0 ? 'down' : 'up',
      info: {
        title: "Active Projects",
        description: "Major Initiatives Progress",
        content: (
          <>
            <p>Tracks the status of major division-wide initiatives and cross-functional projects.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Projects:</strong> Represents high-level efforts distinct from routine departmental tasks.</li>
              <li><strong>Compliance:</strong> Focuses on meeting project milestones and final delivery dates.</li>
              <li><strong>Significance:</strong> Essential for monitoring the division's growth and development projects.</li>
            </ul>
          </>
        )
      }
    },
    {
      icon: <Users className="h-4 w-4" />,
      label: 'Staff',
      value: metrics.staffCount,
      subtitle: `~${metrics.averageTasksPerPerson} tasks/person`,
      trend: 'flat',
      info: {
        title: "Staff Performance Capacity",
        description: "Resource Utilization",
        content: (
          <>
            <p>Provides a view of the human resources available to the division and their current workload distribution.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Headcount:</strong> Total number of active staff members currently assigned to the division.</li>
              <li><strong>Load:</strong> The average number of open tasks per person provides a window into workforce utilization.</li>
              <li><strong>Significance:</strong> Sudden spikes in load may signal the need for additional resources or task prioritization.</li>
            </ul>
          </>
        )
      }
    },
    {
      icon: <BarChart2 className="h-4 w-4" />,
      label: 'Strategic Alignment',
      value: `${metrics.strategicAlignmentScore}%`,
      subtitle: 'Objectives linked to strategy',
      trend: metrics.strategicAlignmentScore >= 70 ? 'up' : 'down',
      info: {
        title: "Strategic Alignment",
        description: "Corporate Strategy Linkage",
        content: (
          <>
            <p>Measures how well the division's local objectives align with the organization's overarching corporate strategy.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Linkage:</strong> Established when a unit objective is explicitly mapped to a corporate strategic pillar.</li>
              <li><strong>Goal:</strong> To ensure that every effort in the division directly contributes to organization-wide success.</li>
              <li><strong>Significance:</strong> Prevents 'Silo' activities and ensures all units are rowing in the same direction.</li>
            </ul>
          </>
        )
      }
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
