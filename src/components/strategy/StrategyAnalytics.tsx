import React, { useState, useMemo } from 'react';
import BarChart from '@/components/organization/BarChart';
import TimeFilter from './analytics/TimeFilter';
import ExecutiveScorecard from './analytics/ExecutiveScorecard';
import StatusDistribution from './analytics/StatusDistribution';
import ProgressTrends from './analytics/ProgressTrends';
import DivisionalComparison from './analytics/DivisionalComparison';
import MilestonesTimeline from './analytics/MilestonesTimeline';
import StrategyAIChat from './analytics/StrategyAIChat';
import { TimePeriod, filterByTimePeriod } from '@/utils/strategyAnalyticsUtils';

interface StrategyAnalyticsProps {
    objectives: any[];
    milestones: any[];
    kras: any[];
    kpis: any[];
    unitObjectives: any[];
    orgHierarchy?: any[];
}

const StrategyAnalytics: React.FC<StrategyAnalyticsProps> = ({
    objectives,
    milestones,
    kras,
    kpis,
    unitObjectives,
    orgHierarchy = [],
}) => {
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');

    const filteredObjectives = useMemo(() =>
        filterByTimePeriod(objectives, timePeriod), [objectives, timePeriod]);

    const filteredKras = useMemo(() =>
        filterByTimePeriod(kras, timePeriod), [kras, timePeriod]);

    const filteredMilestones = useMemo(() =>
        filterByTimePeriod(milestones, timePeriod), [milestones, timePeriod]);

    return (
        <div className="space-y-8">
            {/* Time Filter */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Analytics Dashboard</h2>
                    <p className="text-xs text-muted-foreground">Strategic performance insights and AI-driven analysis</p>
                </div>
                <TimeFilter value={timePeriod} onChange={setTimePeriod} />
            </div>

            {/* Executive Scorecard */}
            <ExecutiveScorecard objectives={filteredObjectives} />

            {/* Row 1: Status Distribution + Progress Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StatusDistribution objectives={filteredObjectives} />
                <ProgressTrends objectives={filteredObjectives} />
            </div>

            {/* Row 2: Objective Progress Bar Chart + Divisional Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BarChart
                    title="Objective & Execution Progress"
                    description="Progress tracking across Strategy Objectives & Executions"
                    data={[
                        ...filteredObjectives.map((obj: any) => ({
                            name: obj.title.split(' ')[0],
                            current: obj.progress || 0,
                            target: 100
                        }))
                    ]}
                    xAxisLabel="Strategic Items"
                    yAxisLabel="Completion (%)"
                />
                <DivisionalComparison objectives={filteredObjectives} kras={filteredKras} />
            </div>

            {/* Milestones Timeline */}
            <MilestonesTimeline milestones={filteredMilestones} />

            {/* AI-Powered Analysis */}
            <StrategyAIChat
                objectives={objectives}
                kras={kras}
                kpis={kpis}
                milestones={milestones}
                unitObjectives={unitObjectives}
                orgHierarchy={orgHierarchy}
            />
        </div>
    );
};

export default StrategyAnalytics;
