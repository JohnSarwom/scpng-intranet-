import React from 'react';
import { Card } from '@/components/ui/card';
import { Layers, TrendingUp, Rocket, Zap, AlertTriangle } from 'lucide-react';

interface ExecutiveScorecardProps {
    objectives: any[];
}

// Returns Tailwind colour classes based on a 0-100 completion percentage
function getCompletionColour(pct: number): { text: string; bg: string } {
    if (pct >= 70) return { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' };
    if (pct >= 40) return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' };
    return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
}

/**
 * Time-aware at-risk classification.
 *
 * For objectives with startDate + endDate:
 *   expectedProgress = (daysSinceStart / totalDuration) × 100
 *   at-risk if actual < (expectedProgress - 20) — i.e. more than 20 pp behind schedule
 *
 * For objectives with no date data, fall back to:
 *   explicit status = 'at-risk' | 'behind'  OR  progress < 25%
 */
function isAtRisk(obj: any, now: Date): boolean {
    const status = (obj.status || '').toLowerCase();

    // Always respect an explicitly set status
    if (status === 'at-risk' || status === 'behind') return true;
    // Already completed — not at risk
    if (status === 'completed' || status === 'achieved' || (obj.progress || 0) >= 100) return false;

    const startStr = obj.startDate;
    const endStr = obj.endDate;

    if (startStr && endStr) {
        const start = new Date(startStr);
        const end = new Date(endStr);
        const totalMs = end.getTime() - start.getTime();
        if (totalMs <= 0) return false; // invalid dates

        // Clamp nowMs: don't go before start, don't exceed end
        const clampedNow = Math.min(Math.max(now.getTime(), start.getTime()), end.getTime());
        const elapsedMs = clampedNow - start.getTime();
        const expectedProgress = Math.round((elapsedMs / totalMs) * 100);
        const actualProgress = obj.progress || 0;

        // At-risk: more than 20 percentage points behind expected schedule
        return actualProgress < expectedProgress - 20;
    }

    // No date context — fall back to hard threshold
    return (obj.progress || 0) < 25;
}

const ExecutiveScorecard: React.FC<ExecutiveScorecardProps> = ({ objectives }) => {
    const now = new Date();

    const avgCompletion = Math.round(
        objectives.reduce((acc: number, curr: any) => acc + (curr.progress || 0), 0) / (objectives.length || 1)
    );

    const featuredObjectives = objectives.filter((o: any) => o.isFeatured);
    const executionProgress = Math.round(
        featuredObjectives.reduce((acc: number, curr: any) => acc + (curr.progress || 0), 0) / (featuredObjectives.length || 1)
    );

    const atRiskCount = objectives.filter((o: any) => isAtRisk(o, now)).length;

    // Dynamic colours
    const avgCompletionColour = getCompletionColour(avgCompletion);
    const executionColour = getCompletionColour(executionProgress);
    const atRiskColour = atRiskCount > 0
        ? { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' }
        : { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' };

    const primaryColour = { text: 'text-intranet-primary', bg: 'bg-intranet-primary/5' };

    const stats = [
        {
            label: 'Strategic Objectives',
            value: objectives.length.toString(),
            sub: 'Core Focus Areas',
            icon: Layers,
            color: primaryColour.text,
            bg: primaryColour.bg,
        },
        {
            label: 'Avg. Completion',
            value: `${avgCompletion}%`,
            sub: 'Objective Progress',
            icon: TrendingUp,
            color: avgCompletionColour.text,
            bg: avgCompletionColour.bg,
        },
        {
            label: 'Priority Initiatives',
            value: featuredObjectives.length.toString(),
            sub: 'Flagged Objectives',
            icon: Rocket,
            color: primaryColour.text,
            bg: primaryColour.bg,
        },
        {
            label: 'Execution Progress',
            value: `${executionProgress}%`,
            sub: 'Initiatives Avg.',
            icon: Zap,
            color: executionColour.text,
            bg: executionColour.bg,
        },
        {
            label: 'At-Risk Objectives',
            value: atRiskCount.toString(),
            sub: atRiskCount === 0 ? 'All on schedule' : 'Behind schedule',
            icon: AlertTriangle,
            color: atRiskColour.text,
            bg: atRiskColour.bg,
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {stats.map((stat, i) => (
                <Card key={i} className="animate-fade-in dark:bg-gray-900 dark:border-white/10 shadow-sm transition-all duration-300">
                    <div className="p-5 flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-1">{stat.label}</div>
                            <div className="text-[9px] text-muted-foreground opacity-60 mt-1">{stat.sub}</div>
                        </div>
                    </div>
                </Card>
            ))}

        </div>
    );
};

export default ExecutiveScorecard;
