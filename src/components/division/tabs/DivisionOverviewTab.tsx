import React from 'react';
import { BarChart2 } from 'lucide-react';
import { UseDivisionDataReturn } from '@/hooks/useDivisionData';
import { DivisionMetrics } from '@/types/division.types';
import { DivisionStatsRow } from '../overview/DivisionStatsRow';
import { DivisionTrafficLightPanel } from '../overview/DivisionTrafficLightPanel';
import { DivisionPerformanceTrends } from '../overview/DivisionPerformanceTrends';
import { DivisionUnitComparison } from '../overview/DivisionUnitComparison';
import { DivisionObjectivesAlignment } from '../overview/DivisionObjectivesAlignment';
import { DivisionWorkPlanStats } from '../overview/DivisionWorkPlanStats';
import DivisionAIChat from '../analytics/DivisionAIChat';

interface DivisionOverviewTabProps {
  data: UseDivisionDataReturn;
  metrics: DivisionMetrics;
}

export const DivisionOverviewTab: React.FC<DivisionOverviewTabProps> = ({ data, metrics }) => {
  return (
    <div className="space-y-6 mt-4">
      {/* Tab Header */}
      <div className="px-1 mb-2">
        <h2 className="text-lg font-bold text-black">
          Division Overview
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          High-level performance metrics, strategic alignment, and AI-driven insights for the division.
        </p>
      </div>

      <DivisionStatsRow metrics={metrics} />
      
      {/* Zone 1.5: Work Plan Stats */}
      <DivisionWorkPlanStats data={data} />

      {/* Zone 2: Traffic Light RAG Status */}
      <DivisionTrafficLightPanel metrics={metrics} />

      {/* Zone 3: Charts - 2 column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DivisionPerformanceTrends tasks={data.tasks} />
        <DivisionUnitComparison unitComparisons={metrics.unitComparisons} />
      </div>

      {/* Zone 4: Strategic Alignment */}
      <DivisionObjectivesAlignment
        objectives={data.objectives}
        kras={data.combinedKras}
      />

      {/* Zone 5: AI Analyst Chat */}
      <DivisionAIChat data={data} metrics={metrics} />
    </div>
  );
};
