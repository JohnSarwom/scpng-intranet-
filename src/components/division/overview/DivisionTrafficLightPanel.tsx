import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Activity, Briefcase, Users, Info } from 'lucide-react';
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
import { RAGStatus } from '@/types/division.types';

interface RAGCardProps {
  title: string;
  icon: React.ReactNode;
  status: RAGStatus;
  score: number;
  items: { label: string; value: string | number }[];
  info?: {
    title: string;
    description: string;
    content: React.ReactNode;
  };
}

const ragColors: Record<RAGStatus, { bg: string; text: string; dot: string; border: string }> = {
  green: { bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500', border: 'border-green-200 dark:border-green-800' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', border: 'border-amber-200 dark:border-amber-800' },
  red: { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500', border: 'border-red-200 dark:border-red-800' },
};

const RAGCard: React.FC<RAGCardProps> = ({ title, icon, status, score, items, info }) => {
  const colors = ragColors[status];

  const cardContent = (
    <Card className={`${colors.bg} ${colors.border} border h-full relative group transition-all hover:shadow-md cursor-help`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-semibold">{title}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {info && (
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity p-0">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DialogTrigger>
            )}
            <div className={`h-2.5 w-2.5 rounded-full ${colors.dot} animate-pulse`} />
            <span className={`text-sm font-bold ${colors.text}`}>{score}%</span>
          </div>
        </div>
        <div className="space-y-1.5">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium">{item.value}</span>
            </div>
          ))}
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

function getRAGStatus(score: number): RAGStatus {
  if (score >= 70) return 'green';
  if (score >= 40) return 'amber';
  return 'red';
}

interface DivisionTrafficLightPanelProps {
  metrics: DivisionMetrics;
}

export const DivisionTrafficLightPanel: React.FC<DivisionTrafficLightPanelProps> = ({ metrics }) => {
  const strategicScore = metrics.strategicAlignmentScore;
  const operationalScore = metrics.taskCompletionRate;
  const projectScore = metrics.activeProjects > 0
    ? Math.round((metrics.completedProjects / (metrics.activeProjects + metrics.completedProjects)) * 100)
    : 100;
  const staffScore = metrics.staffCount > 0
    ? Math.min(100, Math.round(((metrics.totalTasks - metrics.overdueTasks) / Math.max(metrics.totalTasks, 1)) * 100))
    : 100;

  const cards: RAGCardProps[] = [
    {
      title: 'Strategic Alignment',
      icon: <Target className="h-4 w-4 text-blue-500" />,
      status: getRAGStatus(strategicScore),
      score: strategicScore,
      items: [
        { label: 'Objectives linked', value: `${strategicScore}%` },
        { label: 'KRAs active', value: metrics.activeKRAs },
        { label: 'At-risk KRAs', value: metrics.atRiskKRAs },
      ],
      info: {
        title: "Strategic Alignment Status",
        description: "Corporate Strategy Integration",
        content: (
          <>
            <p>This panel evaluates how effectively the division's localized goals are integrated with the broader corporate strategy.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Objectives Linked:</strong> Measures the depth of strategic connectivity.</li>
              <li><strong>KRAs Active:</strong> Highlights the volume of high-level result areas currently in motion.</li>
              <li><strong>At-Risk KRAs:</strong> Flags strategic categories where performance is significantly lagging.</li>
            </ul>
          </>
        )
      }
    },
    {
      title: 'Operational Health',
      icon: <Activity className="h-4 w-4 text-emerald-500" />,
      status: getRAGStatus(operationalScore),
      score: operationalScore,
      items: [
        { label: 'Task completion', value: `${metrics.taskCompletionRate}%` },
        { label: 'Overdue tasks', value: metrics.overdueTasks },
        { label: 'In progress', value: metrics.inProgressTasks },
      ],
      info: {
        title: "Operational Health Status",
        description: "Execution Efficiency Monitoring",
        content: (
          <>
            <p>A real-time snapshot of the division's daily operational efficiency and task-level execution.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Task Completion:</strong> Overall velocity of work finishing.</li>
              <li><strong>Overdue:</strong> The number of items that have missed their commitment dates.</li>
              <li><strong>In Progress:</strong> The volume of active, open work items.</li>
            </ul>
          </>
        )
      }
    },
    {
      title: 'Project Delivery',
      icon: <Briefcase className="h-4 w-4 text-purple-500" />,
      status: getRAGStatus(projectScore),
      score: projectScore,
      items: [
        { label: 'Active projects', value: metrics.activeProjects },
        { label: 'Completed', value: metrics.completedProjects },
        { label: 'Overdue', value: metrics.overdueProjects },
      ],
      info: {
        title: "Project Delivery Status",
        description: "Capital Initiative Performance",
        content: (
          <>
            <p>Monitors the success rate and deadline compliance of significant division-wide projects.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Active:</strong> Major projects currently consuming development resources.</li>
              <li><strong>Completed:</strong> Successful milestone realizations in the current cycle.</li>
              <li><strong>Overdue:</strong> Projects currently behind their project plan timeline.</li>
            </ul>
          </>
        )
      }
    },
    {
      title: 'Staff Performance',
      icon: <Users className="h-4 w-4 text-orange-500" />,
      status: getRAGStatus(staffScore),
      score: staffScore,
      items: [
        { label: 'Avg tasks/person', value: metrics.averageTasksPerPerson },
        { label: 'Total staff', value: metrics.staffCount },
        { label: 'KPI on track', value: `${metrics.kpiOnTrackPercentage}%` },
      ],
      info: {
        title: "Staff Performance Status",
        description: "Workforce Output & Health",
        content: (
          <>
            <p>Evaluates the productivity and efficiency of the human resources assigned to the division.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Avg Tasks:</strong> Indicates the relative workload pressure on individual team members.</li>
              <li><strong>KPI On Track:</strong> Shows the percentage of specific staff targets that are being successfully met.</li>
            </ul>
          </>
        )
      }
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card, idx) => (
        <RAGCard key={idx} {...card} />
      ))}
    </div>
  );
};
