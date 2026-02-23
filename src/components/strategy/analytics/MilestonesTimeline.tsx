import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CalendarX2, Milestone } from 'lucide-react';
import { differenceInDays, parse, parseISO } from 'date-fns';

interface MilestonesTimelineProps {
    milestones: any[];
}

/** Attempt to parse a date string in various formats */
function parseMilestoneDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    // Try ISO first (e.g. "2026-04-15")
    try {
        const d = parseISO(dateStr);
        if (!isNaN(d.getTime())) return d;
    } catch { /* fallback */ }
    // Try "Month YYYY" (e.g. "April 2026")
    try {
        const d = parse(dateStr, 'MMMM yyyy', new Date());
        if (!isNaN(d.getTime())) return d;
    } catch { /* fallback */ }
    // Try "MMM YYYY" (e.g. "Apr 2026")
    try {
        const d = parse(dateStr, 'MMM yyyy', new Date());
        if (!isNaN(d.getTime())) return d;
    } catch { /* fallback */ }
    // Try native Date
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

/** Compute countdown text + colour */
function getCountdown(dateStr: string, now: Date): { text: string; isOverdue: boolean; className: string } {
    const d = parseMilestoneDate(dateStr);
    if (!d) return { text: '', isOverdue: false, className: '' };

    const days = differenceInDays(d, now);

    if (days < 0) {
        return {
            text: `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`,
            isOverdue: true,
            className: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
        };
    }
    if (days === 0) {
        return {
            text: 'Due today',
            isOverdue: false,
            className: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
        };
    }
    if (days <= 30) {
        return {
            text: `${days} day${days !== 1 ? 's' : ''} away`,
            isOverdue: false,
            className: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
        };
    }
    return {
        text: `${days} days away`,
        isOverdue: false,
        className: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    };
}

/** Determine timeline dot colour — override to red if overdue */
function getDotColour(milestone: any, isOverdue: boolean): string {
    if (isOverdue) return 'bg-red-500';
    const status = (milestone.status || '').toLowerCase();
    if (status === 'critical') return 'bg-red-500';
    if (status === 'on-track' || status === 'on track') return 'bg-green-500';
    if (status === 'planning') return 'bg-purple-500';
    if (status === 'upcoming') return 'bg-blue-500';
    if (status === 'completed' || status === 'done') return 'bg-green-600';
    // Fallback: use the colour prop if it starts with bg-
    if (milestone.color?.startsWith('bg-')) return milestone.color;
    return 'bg-intranet-primary';
}

const MilestonesTimeline: React.FC<MilestonesTimelineProps> = ({ milestones }) => {
    const now = new Date();

    // Empty state — no hardcoded defaults
    if (!milestones || milestones.length === 0) {
        return (
            <Card className="animate-fade-in">
                <CardHeader className="border-b border-gray-50 dark:border-gray-800 pb-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-intranet-primary" />
                        <CardTitle className="text-lg">Critical Roadmaps & Milestones</CardTitle>
                    </div>
                    <CardDescription>Upcoming major strategy deadlines</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="flex flex-col items-center justify-center text-center gap-3 py-8">
                        <div className="p-4 rounded-full bg-muted/50">
                            <Milestone className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                        <div>
                            <p className="font-semibold text-sm text-muted-foreground">No milestones recorded</p>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                                Add milestones in the Strategy tab to track critical deadlines here.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="animate-fade-in overflow-hidden">
            <CardHeader className="border-b border-gray-50 dark:border-gray-800 pb-4">
                <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-intranet-primary" />
                    <CardTitle className="text-lg">Critical Roadmaps & Milestones</CardTitle>
                </div>
                <CardDescription>Upcoming major strategy deadlines</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                <div className="space-y-6">
                    {milestones.map((milestone: any, idx: number) => {
                        const countdown = getCountdown(milestone.date, now);
                        const dotColour = getDotColour(milestone, countdown.isOverdue);
                        const displayStatus = countdown.isOverdue ? 'Overdue' : (milestone.status || 'Upcoming');

                        return (
                            <div key={idx} className="flex gap-4 group">
                                <div className="flex flex-col items-center">
                                    <div
                                        className={`w-3 h-3 rounded-full ${dotColour} ring-4 ring-gray-50 dark:ring-gray-800`}
                                    />
                                    {idx !== milestones.length - 1 && (
                                        <div className="w-0.5 h-full bg-gray-100 dark:bg-gray-800 my-1" />
                                    )}
                                </div>
                                <div className="pb-4 flex-1">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-black text-intranet-primary tracking-tighter">
                                                {milestone.date}
                                            </div>
                                            <div className="font-bold text-sm text-gray-900 dark:text-gray-100">
                                                {milestone.title}
                                            </div>
                                            {milestone.context && (
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {milestone.context}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {/* Countdown chip */}
                                            {countdown.text && (
                                                <span
                                                    className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${countdown.className}`}
                                                >
                                                    {countdown.text}
                                                </span>
                                            )}
                                            {/* Status badge */}
                                            <Badge
                                                variant="outline"
                                                className={`text-[9px] font-bold uppercase tracking-tight ${countdown.isOverdue
                                                        ? 'border-red-300 text-red-600 dark:text-red-400'
                                                        : ''
                                                    }`}
                                            >
                                                {displayStatus}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};

export default MilestonesTimeline;
