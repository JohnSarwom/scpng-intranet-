import React from 'react';
import { UseDivisionDataReturn } from '@/hooks/useDivisionData';
import { DivisionMetrics } from '@/types/division.types';
import { DivisionStatsRow } from '../overview/DivisionStatsRow';
import { DivisionTrafficLightPanel } from '../overview/DivisionTrafficLightPanel';
import { DivisionPerformanceTrends } from '../overview/DivisionPerformanceTrends';
import { DivisionUnitComparison } from '../overview/DivisionUnitComparison';
import { DivisionObjectivesAlignment } from '../overview/DivisionObjectivesAlignment';

interface DivisionOverviewTabProps {
  data: UseDivisionDataReturn;
  metrics: DivisionMetrics;
}

export const DivisionOverviewTab: React.FC<DivisionOverviewTabProps> = ({ data, metrics }) => {
  return (
    <div className="space-y-6 mt-4">
      {/* Zone 1: Stats Row */}
      <DivisionStatsRow metrics={metrics} />

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
    </div>
  );
};
