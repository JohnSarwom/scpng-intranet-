import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { buildDivisionalComparisonData } from '@/utils/strategyAnalyticsUtils';
import { Network, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

interface DivisionalComparisonProps {
    objectives: any[];
    kras: any[];
    unitObjectives?: any[];
    kpis?: any[];
}

const CustomXAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const text = payload.value;
    const maxLength = 20;
    const truncatedText = text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;

    return (
        <g transform={`translate(${x},${y})`}>
            <text
                x={0}
                y={0}
                dy={16}
                textAnchor="middle"
                fill="currentColor"
                fontSize={11}
                className="fill-muted-foreground transition-colors"
            >
                <title>{text}</title>
                {truncatedText}
            </text>
        </g>
    );
};

const DivisionalComparison: React.FC<DivisionalComparisonProps> = ({ objectives, kras, unitObjectives = [], kpis = [] }) => {
    const data = buildDivisionalComparisonData(objectives, kras, unitObjectives, kpis);

    return (
        <Dialog>
            <Card className="animate-fade-in group relative">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Network className="w-5 h-5 text-intranet-primary" />
                            <CardTitle className="text-lg font-semibold">Divisional Performance</CardTitle>
                        </div>
                        <DialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="How this chart is calculated"
                            >
                                <Info className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </DialogTrigger>
                    </div>
                    <CardDescription>Objective &amp; KRA progress comparison across divisions</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[350px] w-full">
                        <ChartContainer
                            className="aspect-auto h-full w-full"
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
                                <XAxis
                                    dataKey="fullName"
                                    interval={0}
                                    tick={<CustomXAxisTick />}
                                />
                                <YAxis
                                    label={{ value: 'Progress (%)', angle: -90, position: 'insideLeft' }}
                                    domain={[0, 100]}
                                />
                                <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => [`${value}%`, name]} />} />
                                <Legend />
                                <Bar dataKey="objectiveProgress" name="Objectives" fill="#600018" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                <Bar dataKey="kraProgress" name="KRAs" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={60} />
                            </RechartsBarChart>
                        </ChartContainer>
                    </div>
                </CardContent>
            </Card>

            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>About Divisional Performance</DialogTitle>
                    <DialogDescription>How Objectives &amp; KRA progress is calculated</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                    <p>This chart compares the average progress of <strong>Objectives</strong> and <strong>KRAs</strong> across each SCPNG division.</p>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm bg-[#600018] shrink-0" />
                            <span><strong>Objectives bar:</strong> Average progress % of unit-level objectives belonging to that division.</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm bg-[#2563eb] shrink-0" />
                            <span><strong>KRAs bar:</strong> Average KRA completion, calculated live — <em>no stored value is used</em>.</span>
                        </div>
                    </div>
                    <div className="rounded-md bg-muted px-3 py-2 text-xs leading-relaxed">
                        <strong>KRA Progress formula:</strong><br />
                        (KPIs with status "Completed" ÷ total KPIs per KRA) × 100,<br />
                        then averaged across all KRAs in that division.
                    </div>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Note:</strong> Target/Actual figures on KPIs do not affect the KRA bar — only KPI status does.</li>
                        <li><strong>To increase the KRA bar:</strong> Mark KPIs as <em>Completed</em> in the KRAs &amp; Objectives tab.</li>
                        <li>A division with no linked KRAs will show 0% for the KRAs bar.</li>
                    </ul>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default DivisionalComparison;
