import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import { buildProgressTrendData, TimePeriod } from '@/utils/strategyAnalyticsUtils';
import { TrendingUp, Info } from 'lucide-react';

const periodDescriptions: Record<TimePeriod, string> = {
    weekly: 'Daily objective & execution progress this week',
    monthly: 'Weekly objective & execution progress this month',
    quarterly: 'Monthly objective & execution progress this quarter',
    yearly: 'Monthly objective & execution progress this year',
    all: 'Monthly objective & execution progress over time',
};

interface ProgressTrendsProps {
    objectives: any[];
    timePeriod?: TimePeriod;
}

const ProgressTrends: React.FC<ProgressTrendsProps> = ({ objectives, timePeriod = 'all' }) => {
    const data = buildProgressTrendData(objectives, timePeriod);

    // Detect flat lines: all objective values identical and all execution values identical
    const isFlatLine = useMemo(() => {
        if (data.length <= 1) return false;
        const objVals = new Set(data.map(d => d.objectives));
        const execVals = new Set(data.map(d => d.executions));
        return objVals.size <= 1 && execVals.size <= 1;
    }, [data]);

    // Check if any planned data is non-zero (objectives have dates)
    const hasPlannedData = useMemo(() => data.some(d => d.planned > 0), [data]);

    // Check if executions data exists
    const hasExecutions = useMemo(() => data.some(d => d.executions > 0), [data]);

    return (
        <Card className="animate-fade-in">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-intranet-primary" />
                    <CardTitle className="text-lg font-semibold">Progress Trends</CardTitle>
                </div>
                <CardDescription>{periodDescriptions[timePeriod]}</CardDescription>
            </CardHeader>
            <CardContent>
                {/* Flat-line info banner */}
                {isFlatLine && (
                    <div className="flex items-start gap-2 p-2.5 mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-tight">
                            <span className="font-bold">Flat lines detected.</span> Progress is not historically tracked — these lines show the current snapshot value repeated.
                            {hasPlannedData && ' The dashed line shows where you should be based on elapsed time.'}
                        </p>
                    </div>
                )}

                <div className="h-[300px] w-full">
                    <ChartContainer
                        config={{
                            objectives: { color: "#2563eb" },
                            executions: { color: "#600018" },
                            planned: { color: "#94a3b8" },
                        }}
                    >
                        <RechartsLineChart
                            data={data}
                            margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis
                                label={{ value: 'Progress (%)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                                domain={[0, 100]}
                                tick={{ fontSize: 11 }}
                            />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend />

                            {/* Planned progress reference line (dashed) */}
                            {hasPlannedData && (
                                <Line
                                    type="monotone"
                                    dataKey="planned"
                                    name="Expected (by timeline)"
                                    stroke="#94a3b8"
                                    strokeWidth={2}
                                    strokeDasharray="6 4"
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                            )}

                            {/* Actual objectives */}
                            <Line
                                type="monotone"
                                dataKey="objectives"
                                name="Objectives"
                                stroke="#2563eb"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }}
                            />

                            {/* Actual executions */}
                            {hasExecutions && (
                                <Line
                                    type="monotone"
                                    dataKey="executions"
                                    name="Executions"
                                    stroke="#600018"
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            )}
                        </RechartsLineChart>
                    </ChartContainer>
                </div>

                {/* Empty executions note */}
                {!hasExecutions && objectives.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-2 text-center opacity-70">
                        No featured objectives found — Executions line is hidden. Mark objectives as featured to enable tracking.
                    </p>
                )}
            </CardContent>
        </Card>
    );
};

export default ProgressTrends;
