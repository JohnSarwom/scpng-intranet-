import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TaskCompletionDonut } from '@/components/dashboard/TaskCompletionDonut';
import { buildStatusDistributionData } from '@/utils/strategyAnalyticsUtils';

interface StatusDistributionProps {
    objectives: any[];
}

const StatusDistribution: React.FC<StatusDistributionProps> = ({ objectives }) => {
    const data = buildStatusDistributionData(objectives);
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const completed = data.find(d => d.name === "Completed")?.value || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Map strategic colors to match TaskCompletionDonut's maroon theme if desired, 
    // or keep them but use the TaskCompletionDonut component.
    // The user asked for "the same style", and TaskCompletionDonut is a specific component
    // with its own internal logic for center text and interactive legend.

    const segments = [
        { name: "Completed", color: "#5C001E" },
        { name: "On Track", color: "#9E3A5D" },
        { name: "Needs Attention", color: "#f97316" },
        { name: "At Risk", color: "#ef4444" }
    ].map(s => {
        const d = data.find(item => item.name === s.name);
        return {
            label: s.name,
            value: d ? d.value : 0,
            color: s.color
        };
    }).filter(s => s.value > 0);

    return (
        <Card className="group relative">
            <CardHeader>
                <div>
                    <CardTitle>Strategic Status Distribution</CardTitle>
                    <CardDescription>Real-time status of Objectives & Executions</CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] flex flex-col items-center justify-center gap-6">
                    <TaskCompletionDonut
                        segments={segments.length > 0 ? segments : [{ label: "No Data", value: 1, color: "#cbd5e1" }]}
                        centerLabel={`${percentage}%`}
                        centerSubtext="Completed"
                        size={200}
                    />
                </div>
            </CardContent>
        </Card>
    );
};

export default StatusDistribution;
