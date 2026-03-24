import React from 'react';
import { Building2, Users, FolderKanban, Target, User as UserIcon, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DivisionInfo } from '@/hooks/useDivisionData';
import { DivisionMetrics } from '@/types/division.types';

interface DivisionHeaderProps {
  division: DivisionInfo | null;
  metrics: DivisionMetrics;
  loading?: boolean;
}

export const DivisionHeader: React.FC<DivisionHeaderProps> = ({ division, metrics, loading }) => {
  if (loading || !division) {
    return (
      <div className="mb-6 animate-pulse">
        <div className="h-24 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mb-6">
      {/* Division Title Bar */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#83002A] to-[#5C001E] text-white p-6">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{division.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-white/80 text-sm">
              {division.director && (
                <span className="flex items-center gap-1">
                  <UserIcon className="h-3.5 w-3.5" />
                  {division.director}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {metrics.staffCount} Staff
              </span>
              <span className="flex items-center gap-1">
                <FolderKanban className="h-3.5 w-3.5" />
                {division.unitNames.length} Units
              </span>
              <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                {division.code}
              </Badge>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <Dialog>
              <div className="text-center group relative flex flex-col items-center">
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-4 w-4 absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity p-0">
                    <Info className="h-3 w-3 text-white/70" />
                  </Button>
                </DialogTrigger>
                <div className="text-2xl font-bold">{metrics.taskCompletionRate}%</div>
                <div className="text-white/70 text-xs">Task Completion</div>
              </div>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Task Completion</DialogTitle>
                  <DialogDescription>Division-level execution velocity</DialogDescription>
                </DialogHeader>
                <div className="text-sm space-y-4">
                  <p>The percentage of all division-level tasks that have reached a finalized state.</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Calculation:</strong> (Completed Tasks / Total Tasks) * 100.</li>
                    <li><strong>Significance:</strong> Measures the division's throughput and efficiency in closing out assigned work items.</li>
                  </ul>
                </div>
              </DialogContent>
            </Dialog>

            <div className="w-px h-10 bg-white/20" />

            <Dialog>
              <div className="text-center group relative flex flex-col items-center">
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-4 w-4 absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity p-0">
                    <Info className="h-3 w-3 text-white/70" />
                  </Button>
                </DialogTrigger>
                <div className="text-2xl font-bold">{metrics.kpiOnTrackPercentage}%</div>
                <div className="text-white/70 text-xs">KPI On Track</div>
              </div>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>KPI On Track</DialogTitle>
                  <DialogDescription>Performance target achievement status</DialogDescription>
                </DialogHeader>
                <div className="text-sm space-y-4">
                  <p>The health of specific, measurable performance targets assigned to the division.</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Threshold:</strong> Percentage of KPIs where the current 'Actual' value meets or exceeds the 'Target' value.</li>
                    <li><strong>Significance:</strong> Indicates whether the division is meeting its quantitative performance goals.</li>
                  </ul>
                </div>
              </DialogContent>
            </Dialog>

            <div className="w-px h-10 bg-white/20" />

            <Dialog>
              <div className="text-center group relative flex flex-col items-center">
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-4 w-4 absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity p-0">
                    <Info className="h-3 w-3 text-white/70" />
                  </Button>
                </DialogTrigger>
                <div className="text-2xl font-bold">{metrics.overallPerformanceScore}%</div>
                <div className="text-white/70 text-xs">Performance</div>
              </div>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Overall Performance</DialogTitle>
                  <DialogDescription>Aggregate divisional health score</DialogDescription>
                </DialogHeader>
                <div className="text-sm space-y-4">
                  <p>An aggregate health score for the entire division based on multiple performance vectors.</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Composition:</strong> A weighted average of Task Completion, KPI Achievement, and Strategic Alignment.</li>
                    <li><strong>Significance:</strong> Provides a high-level "pulse" of the division's overall success across all activities.</li>
                  </ul>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
};
