import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { buildDivisionalComparisonData } from '@/utils/strategyAnalyticsUtils';
import { Network } from 'lucide-react';

interface DivisionalComparisonProps {
    objectives: any[];
    kras: any[];
}

const DivisionalComparison: React.FC<DivisionalComparisonProps> = ({ objectives, kras }) => {
    const data = buildDivisionalComparisonData(objectives, kras);

    return (
        <Card className="animate-fade-in">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                    <Network className="w-5 h-5 text-intranet-primary" />
                    <CardTitle className="text-lg font-semibold">Divisional Performance</CardTitle>
                </div>
                <CardDescription>Objective & KRA progress comparison across divisions</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ChartContainer
                        config={{
                            objectiveProgress: { color: "#600018" },
                            kraProgress: { color: "#2563eb" }
                        }}
                    >
                        <RechartsBarChart
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
                            <Bar dataKey="objectiveProgress" name="Objectives" fill="#600018" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="kraProgress" name="KRAs" fill="#2563eb" radius={[4, 4, 0, 0]} />
                        </RechartsBarChart>
                    </ChartContainer>
                </div>
            </CardContent>
        </Card>
    );
};

export default DivisionalComparison;
