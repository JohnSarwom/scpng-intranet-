import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TaskCompletionDonut } from '@/components/dashboard/TaskCompletionDonut';
import { buildStatusDistributionData } from '@/utils/strategyAnalyticsUtils';

type TabKey = 'objectives' | 'kras' | 'kpis';

interface StatusDistributionProps {
    objectives: any[];
    kras?: any[];
    kpis?: any[];
}

const TAB_LABELS: Record<TabKey, string> = {
    objectives: 'Objectives',
    kras: 'KRAs',
    kpis: 'KPIs',
};

const SEGMENT_COLOURS = [
    { name: "Completed", color: "#5C001E" },
    { name: "On Track", color: "#9E3A5D" },
    { name: "Needs Attention", color: "#f97316" },
    { name: "At Risk", color: "#ef4444" },
];

const StatusDistribution: React.FC<StatusDistributionProps> = ({ objectives, kras = [], kpis = [] }) => {
    const [activeTab, setActiveTab] = useState<TabKey>('objectives');

    const dataForTab = useMemo(() => {
        switch (activeTab) {
            case 'kras':
                return buildStatusDistributionData(kras);
            case 'kpis':
                return buildStatusDistributionData(kpis);
            default:
                return buildStatusDistributionData(objectives);
        }
    }, [activeTab, objectives, kras, kpis]);

    const total = dataForTab.reduce((sum, item) => sum + item.value, 0);
    const completed = dataForTab.find(d => d.name === "Completed")?.value || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    const segments = SEGMENT_COLOURS.map(s => {
        const d = dataForTab.find(item => item.name === s.name);
        return {
            label: s.name,
            value: d ? d.value : 0,
            color: s.color,
        };
    }).filter(s => s.value > 0);

    return (
        <Card className="group relative">
            <CardHeader className="pb-3">
                <div>
                    <CardTitle>Strategic Status Distribution</CardTitle>
                    <CardDescription>Real-time status of {TAB_LABELS[activeTab]}</CardDescription>
                </div>
                {/* Tab toggle */}
                <div className="flex gap-1 mt-2 bg-muted/50 rounded-lg p-1 w-fit">
                    {(Object.keys(TAB_LABELS) as TabKey[]).map(key => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === key
                                    ? 'bg-white dark:bg-gray-800 text-intranet-primary shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {TAB_LABELS[key]}
                        </button>
                    ))}
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] flex flex-col items-center justify-center gap-6">
                    {total === 0 ? (
                        <div className="text-center text-sm text-muted-foreground">
                            <p className="font-semibold">No {TAB_LABELS[activeTab]} data</p>
                            <p className="text-xs mt-1 opacity-70">
                                {activeTab === 'objectives' && 'Add objectives in the Strategy tab.'}
                                {activeTab === 'kras' && 'KRAs will appear once linked to objectives.'}
                                {activeTab === 'kpis' && 'KPIs will appear once linked to KRAs.'}
                            </p>
                        </div>
                    ) : (
                        <TaskCompletionDonut
                            segments={segments}
                            centerLabel={`${percentage}%`}
                            centerSubtext="Completed"
                            size={200}
                        />
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default StatusDistribution;
