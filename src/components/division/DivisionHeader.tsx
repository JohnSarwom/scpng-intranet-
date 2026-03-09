import React from 'react';
import { Building2, Users, FolderKanban, Target, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
            <div className="text-center">
              <div className="text-2xl font-bold">{metrics.taskCompletionRate}%</div>
              <div className="text-white/70 text-xs">Task Completion</div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <div className="text-2xl font-bold">{metrics.kpiOnTrackPercentage}%</div>
              <div className="text-white/70 text-xs">KPI On Track</div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <div className="text-2xl font-bold">{metrics.overallPerformanceScore}%</div>
              <div className="text-white/70 text-xs">Performance</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
