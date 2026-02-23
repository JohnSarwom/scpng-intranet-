import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import { buildProgressTrendData } from '@/utils/strategyAnalyticsUtils';
import { TrendingUp } from 'lucide-react';

interface ProgressTrendsProps {
    objectives: any[];
}

const ProgressTrends: React.FC<ProgressTrendsProps> = ({ objectives }) => {
    const data = buildProgressTrendData(objectives);

    return (
        <Card className="animate-fade-in">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-intranet-primary" />
                    <CardTitle className="text-lg font-semibold">Progress Trends</CardTitle>
                </div>
                <CardDescription>Monthly objective & execution progress over time</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ChartContainer
                        config={{
                            objectives: { color: "#2563eb" },
                            executions: { color: "#600018" }
                        }}
                    >
                        <RechartsLineChart
                            data={data}
                            margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis
                                label={{ value: 'Progress (%)', angle: -90, position: 'insideLeft' }}
                                domain={[0, 100]}
                            />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="objectives"
                                name="Objectives"
                                stroke="#2563eb"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="executions"
                                name="Executions"
                                stroke="#600018"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                        </RechartsLineChart>
                    </ChartContainer>
                </div>
            </CardContent>
        </Card>
    );
};

export default ProgressTrends;
