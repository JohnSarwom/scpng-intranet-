
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
    ArrowUpRight,
    ArrowDownRight,
    MinusCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TrafficLightCardItem {
    label: string;
    value: string;
    status: 'good' | 'warning' | 'critical';
}

export interface TrafficLightCardProps {
    category: string;
    status: 'good' | 'warning' | 'critical';
    score: number;
    trend: 'up' | 'down' | 'flat';
    items: TrafficLightCardItem[];
    className?: string;
}

const StatusIndicator = ({ status }: { status: string }) => {
    const colors = {
        good: "bg-green-500",
        warning: "bg-amber-500",
        critical: "bg-red-500",
    };

    return (
        <div className={cn(
            "w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-950 shadow-sm",
            colors[status as keyof typeof colors]
        )} />
    );
};

export const TrafficLightCard: React.FC<TrafficLightCardProps> = ({
    category,
    status,
    score,
    trend,
    items,
    className
}) => {
    return (
        <Card className={cn(
            "border-t-4 shadow-md hover:shadow-lg transition-shadow",
            status === 'good' ? 'border-t-green-500' :
                status === 'warning' ? 'border-t-amber-500' : 'border-t-red-500',
            className
        )}>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-base font-semibold">{category}</CardTitle>
                        <CardDescription className="text-xs mt-1 flex items-center gap-1">
                            {trend === 'up' && <ArrowUpRight className="w-3 h-3 text-green-500" />}
                            {trend === 'down' && <ArrowDownRight className="w-3 h-3 text-red-500" />}
                            {trend === 'flat' && <MinusCircle className="w-3 h-3 text-gray-400" />}
                            <span>vs last month</span>
                        </CardDescription>
                    </div>
                    <StatusIndicator status={status} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-end justify-between mb-4">
                    <span className="text-3xl font-bold">{score}%</span>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Health Score</div>
                </div>
                <Progress
                    value={score}
                    className={cn(
                        "h-2 mb-4",
                        status === 'good' ? 'bg-green-100 dark:bg-green-900' :
                            status === 'warning' ? 'bg-amber-100 dark:bg-amber-900' : 'bg-red-100 dark:bg-red-900'
                    )}
                    indicatorClassName={
                        status === 'good' ? 'bg-green-500' :
                            status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                    }
                />

                <div className="space-y-2 mt-4">
                    {items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0 border-dashed">
                            <span className="text-muted-foreground">{item.label}</span>
                            <div className="flex items-center gap-2">
                                <span className="font-medium">{item.value}</span>
                                <div className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    item.status === 'good' ? 'bg-green-500' :
                                        item.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                                )} />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
