import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, Cell, LabelList } from 'recharts';
import { buildDivisionalComparisonData } from '@/utils/strategyAnalyticsUtils';
import { Network, Info, Trophy, AlertTriangle } from 'lucide-react';
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
    orgHierarchy?: any[];
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

/** Rich custom tooltip showing counts */
const CustomTooltipContent = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const entry = payload[0]?.payload;
    return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-xs min-w-[160px]">
            <p className="font-bold text-sm mb-2">{entry?.fullName || label}</p>
            <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-[#600018] shrink-0" />
                        <span className="text-muted-foreground">Objectives</span>
                    </div>
                    <span className="font-bold">{entry?.objectiveProgress ?? 0}%
                        <span className="font-normal text-muted-foreground ml-1">({entry?.objCount ?? 0})</span>
                    </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-[#2563eb] shrink-0" />
                        <span className="text-muted-foreground">KRAs</span>
                    </div>
                    <span className="font-bold">{entry?.kraProgress ?? 0}%
                        <span className="font-normal text-muted-foreground ml-1">({entry?.kraCount ?? 0})</span>
                    </span>
                </div>
            </div>
        </div>
    );
};

const DivisionalComparison: React.FC<DivisionalComparisonProps> = ({
    objectives, kras, unitObjectives = [], kpis = [], orgHierarchy = []
}) => {
    const data = buildDivisionalComparisonData(objectives, kras, unitObjectives, kpis, orgHierarchy);

    // Find top and lowest performers
    const { topDiv, lowestDiv } = useMemo(() => {
        if (data.length === 0) return { topDiv: null, lowestDiv: null };
        const withData = data.filter(d => d.objCount > 0 || d.kraCount > 0);
        if (withData.length === 0) return { topDiv: null, lowestDiv: null };
        const sorted = [...withData].sort((a, b) =>
            (a.objectiveProgress + a.kraProgress) - (b.objectiveProgress + b.kraProgress)
        );
        return { topDiv: sorted[sorted.length - 1], lowestDiv: sorted[0] };
    }, [data]);

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
                    <CardDescription>
                        Objective &amp; KRA progress comparison across {data.length} divisions
                        {orgHierarchy.length > 0 && (
                            <span className="text-[9px] ml-1 opacity-60">(from Org Hierarchy)</span>
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Top / Lowest performer callouts */}
                    {topDiv && lowestDiv && topDiv !== lowestDiv && (
                        <div className="flex gap-3 mb-4">
                            <div className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                                <Trophy className="w-3 h-3" />
                                <span><span className="font-bold">{topDiv.fullName}</span> leads</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                <AlertTriangle className="w-3 h-3" />
                                <span><span className="font-bold">{lowestDiv.fullName}</span> needs focus</span>
                            </div>
                        </div>
                    )}

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
                                    label={{ value: 'Progress (%)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                                    domain={[0, 100]}
                                    tick={{ fontSize: 11 }}
                                />
                                <ChartTooltip content={<CustomTooltipContent />} />
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
                    {orgHierarchy.length > 0 && (
                        <div className="rounded-md bg-green-50 dark:bg-green-900/20 px-3 py-2 text-xs text-green-700 dark:text-green-300">
                            ✓ Divisions are sourced dynamically from the <strong>Org_Hierarchy</strong> SharePoint list ({orgHierarchy.length} entries).
                        </div>
                    )}
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
