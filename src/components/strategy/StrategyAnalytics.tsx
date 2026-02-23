import React, { useState, useMemo } from 'react';
import BarChart from '@/components/organization/BarChart';
import TimeFilter from './analytics/TimeFilter';
import ExecutiveScorecard from './analytics/ExecutiveScorecard';
import StatusDistribution from './analytics/StatusDistribution';
import ProgressTrends from './analytics/ProgressTrends';
import DivisionalComparison from './analytics/DivisionalComparison';
import MilestonesTimeline from './analytics/MilestonesTimeline';
import StrategyAIChat from './analytics/StrategyAIChat';
import { TimePeriod, filterByTimePeriod, computeDateRange } from '@/utils/strategyAnalyticsUtils';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

/** Build a human-readable range label for the active time period */
function getPeriodLabel(period: TimePeriod): string {
    const now = new Date();
    const fmt = (d: Date, pattern: string) => format(d, pattern);

    switch (period) {
        case 'weekly': {
            const ws = startOfWeek(now, { weekStartsOn: 1 });
            const we = endOfWeek(now, { weekStartsOn: 1 });
            return `Mon ${fmt(ws, 'd MMM')} – Sun ${fmt(we, 'd MMM yyyy')}`;
        }
        case 'monthly': {
            return `${fmt(startOfMonth(now), 'MMMM yyyy')}  ·  Week 1 – Week 4`;
        }
        case 'quarterly': {
            const qs = startOfQuarter(now);
            const qe = endOfQuarter(now);
            return `${fmt(qs, 'MMM')} – ${fmt(qe, 'MMM yyyy')}  ·  Q${Math.ceil((now.getMonth() + 1) / 3)}`;
        }
        case 'yearly': {
            return `Jan – Dec ${now.getFullYear()}`;
        }
        case 'all':
        default:
            return 'All Time  ·  Jan – Dec';
    }
}

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
                    <p className="text-xs text-muted-foreground">
                        Strategic performance insights and AI-driven analysis
                        <span className="mx-1.5 text-muted-foreground/40">|</span>
                        <span className="font-semibold text-intranet-primary/80">{getPeriodLabel(timePeriod)}</span>
                    </p>
                </div>
                <TimeFilter value={timePeriod} onChange={setTimePeriod} />
            </div>

            {/* Executive Scorecard */}
            <ExecutiveScorecard objectives={filteredObjectives} />

            {/* Row 1: Status Distribution + Progress Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StatusDistribution objectives={filteredObjectives} />
                <ProgressTrends objectives={filteredObjectives} timePeriod={timePeriod} />
            </div>

            {/* Row 2: Objective Progress Bar Chart + Divisional Comparison */}
            <div className="grid grid-cols-1 gap-6">
                <BarChart
                    title="Objective & Execution Progress"
                    description="Progress tracking across Strategy Objectives & Executions"
                    data={filteredObjectives.map((obj: any) => ({
                        name: obj.title,
                        current: obj.progress || 0,
                        status: obj.status || '',
                    }))}
                />
                <DivisionalComparison objectives={filteredObjectives} kras={filteredKras} unitObjectives={unitObjectives} kpis={kpis} />
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
