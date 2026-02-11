
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ArrowRight, Layers, Users, Briefcase, AlertTriangle } from 'lucide-react';

interface TaskGroupData {
    name: string;
    value: number;
    color?: string;
    icon?: React.ReactNode;
}

interface TaskGroupListProps {
    data: TaskGroupData[];
}

export const TaskGroupList: React.FC<TaskGroupListProps> = ({ data }) => {
    // Sort by value (count) descending
    const sortedData = [...data].sort((a, b) => b.value - a.value);

    // Take top 5 to fit nicely in the height
    const displayData = sortedData.slice(0, 5);

    const getIcon = (name: string) => {
        const lower = name.toLowerCase();
        if (lower.includes('urgent')) return <AlertTriangle className="h-4 w-4 text-red-500" />;
        if (lower.includes('team') || lower.includes('licensing') || lower.includes('finance')) return <Users className="h-4 w-4 text-blue-500" />;
        if (lower.includes('todo')) return <Layers className="h-4 w-4 text-slate-500" />;
        if (lower.includes('progress')) return <Briefcase className="h-4 w-4 text-amber-500" />;
        return <Layers className="h-4 w-4 text-muted-foreground" />;
    };

    return (
        <div className="flex flex-col gap-3 h-[300px] overflow-y-auto pr-2">
            {displayData.map((group, index) => (
                <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-full bg-muted", group.color ? `bg-[${group.color}]/10` : "")}>
                            {getIcon(group.name)}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-medium text-sm">{group.name}</span>
                            <span className="text-xs text-muted-foreground">Task Group</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="font-bold text-sm h-6 min-w-[30px] justify-center">
                            {group.value}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-50" />
                    </div>
                </div>
            ))}

            {data.length > 5 && (
                <div className="text-center pt-2">
                    <span className="text-xs text-muted-foreground">
                        + {data.length - 5} more groups
                    </span>
                </div>
            )}

            {data.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Layers className="h-8 w-8 mb-2 opacity-50" />
                    <p>No task groups found</p>
                </div>
            )}
        </div>
    );
};
