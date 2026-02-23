import React from 'react';
import { Card } from '@/components/ui/card';
import { Layers, TrendingUp, Rocket, Zap } from 'lucide-react';

interface ExecutiveScorecardProps {
    objectives: any[];
}

const ExecutiveScorecard: React.FC<ExecutiveScorecardProps> = ({ objectives }) => {
    const avgCompletion = Math.round(
        objectives.reduce((acc: number, curr: any) => acc + (curr.progress || 0), 0) / (objectives.length || 1)
    );
    const featuredObjectives = objectives.filter((o: any) => o.isFeatured);
    const executionProgress = Math.round(
        featuredObjectives.reduce((acc: number, curr: any) => acc + (curr.progress || 0), 0) / (featuredObjectives.length || 1)
    );

    const stats = [
        { label: "Strategic Objectives", value: objectives.length.toString(), sub: "Core Focus Areas", icon: Layers, color: "text-intranet-primary", bg: "bg-intranet-primary/5" },
        { label: "Avg. Completion", value: `${avgCompletion}%`, sub: "Objective Progress", icon: TrendingUp, color: "text-intranet-primary", bg: "bg-intranet-primary/5" },
        { label: "Strategic Executions", value: featuredObjectives.length.toString(), sub: "Featured Projects", icon: Rocket, color: "text-intranet-primary", bg: "bg-intranet-primary/5" },
        { label: "Execution Progress", value: `${executionProgress}%`, sub: "Featured Avg", icon: Zap, color: "text-intranet-primary", bg: "bg-intranet-primary/5" },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
                <Card key={i} className="animate-fade-in">
                    <div className="p-5 flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black">{stat.value}</div>
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
