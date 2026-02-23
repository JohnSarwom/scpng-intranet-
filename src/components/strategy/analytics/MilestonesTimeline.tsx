import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

interface MilestonesTimelineProps {
    milestones: any[];
}

const defaultMilestones = [
    { date: "May 2025", title: "Internal Policy Finalization", status: "Upcoming", color: "bg-blue-500", context: "Corporate Services Division completion" },
    { date: "Sept 2025", title: "Strategic Plan 2025-2030", status: "Planning", color: "bg-purple-500", context: "Finalize with ADB and IFC stakeholders" },
    { date: "April 2026", title: "Board Appointment Cycle", status: "On-Track", color: "bg-green-500", context: "New Board following parliamentary changes" },
    { date: "Dec 2026", title: "SC Act & Capital Market Act", status: "Critical", color: "bg-red-500", context: "Legislative amendments passage deadline" },
];

const MilestonesTimeline: React.FC<MilestonesTimelineProps> = ({ milestones }) => {
    const displayMilestones = milestones && milestones.length > 0 ? milestones : defaultMilestones;

    return (
        <Card className="animate-fade-in overflow-hidden">
            <CardHeader className="border-b border-gray-50 dark:border-gray-800 pb-4">
                <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-intranet-primary" />
                    <CardTitle className="text-lg">Critical Roadmaps & Milestones</CardTitle>
                </div>
                <CardDescription>Upcoming major strategy deadlines (2025-2026)</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                <div className="space-y-6">
                    {displayMilestones.map((milestone: any, idx: number) => (
                        <div key={idx} className="flex gap-4 group">
                            <div className="flex flex-col items-center">
                                <div
                                    className={`w-3 h-3 rounded-full ${milestone.color?.startsWith('bg-') ? milestone.color : 'bg-intranet-primary'} ring-4 ring-gray-50 dark:ring-gray-800`}
                                    style={{ backgroundColor: !milestone.color?.startsWith('bg-') ? milestone.color : undefined }}
                                />
                                {idx !== (displayMilestones.length - 1) && <div className="w-0.5 h-full bg-gray-100 dark:bg-gray-800 my-1" />}
                            </div>
                            <div className="pb-4 flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="text-xs font-black text-intranet-primary tracking-tighter">{milestone.date}</div>
                                        <div className="font-bold text-sm text-gray-900 dark:text-gray-100">{milestone.title}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{milestone.context}</div>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-tight">{milestone.status}</Badge>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default MilestonesTimeline;
