import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    CheckCircle,
    Clock,
    Target,
    TrendingUp,
    AlertTriangle,
    PauseCircle,
    ListTodo,
    Briefcase,
    Calendar,
    Activity,
    Download,
    Flag,
    Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Task, KRA, KPI } from '@/types';

interface StaffDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    staff: {
        name: string;
        email: string;
        jobTitle: string;
        initials: string;
        unit?: string;
        performanceScore: number;
        taskRate: number;
        statusLabel: string;
        statusColor: string;
    } | null;
    tasks: Task[];
    kras: KRA[];
    onExport: (staffEmail: string) => void;
}

export const StaffDetailModal: React.FC<StaffDetailModalProps> = ({
    isOpen,
    onClose,
    staff,
    tasks: allTasks,
    kras: allKras,
    onExport
}) => {
    if (!staff) return null;

    const emailLower = staff.email.toLowerCase();
    const staffUnit = staff.unit?.toLowerCase() || '';

    // Tasks — assigned to or created by this person
    const staffTasks = allTasks.filter(t =>
        t.assignees?.some(a => a.email?.toLowerCase() === emailLower) ||
        t.assignedTo?.toLowerCase() === emailLower ||
        t.createdByEmail?.toLowerCase() === emailLower ||
        t.authorEmail?.toLowerCase() === emailLower
    );

    // KPIs — scan every KPI across every KRA; include this person if they're an assignee
    const allKpisFlat = allKras.flatMap(k => (k.unitKpis || k.kpis || []) as KPI[]);
    const staffKpis = allKpisFlat.filter((kpi: any) =>
        kpi.assignees?.some((a: any) => a.email?.toLowerCase() === emailLower)
    );

    // Objectives (KRAs) — show KRAs that belong to this person's unit.
    // mapKRA() stores the unit in kra.department (SharePoint "Department" field), not kra.unit,
    // so we check both. We also include any KRA personally linked to this person so nothing is missed.
    const unitKras = allKras.filter(k => {
        const kraScope = (k.unit || k.department || '').toLowerCase();
        const isUnitMatch = staffUnit ? kraScope === staffUnit : false;

        // Deep check: include KRA if any of its KPIs are assigned to this person
        const kraKpis = (k.unitKpis || k.kpis || []) as KPI[];
        const hasAssignedKpi = kraKpis.some(kpi =>
            kpi.assignees?.some(a => a.email?.toLowerCase() === emailLower)
        );

        const isPersonalLink =
            k.owner?.email?.toLowerCase() === emailLower ||
            k.createdByEmail?.toLowerCase() === emailLower ||
            k.assignees?.some(a => a.email?.toLowerCase() === emailLower) ||
            hasAssignedKpi;

        return isUnitMatch || isPersonalLink;
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
                <DialogHeader className="p-6 bg-intranet-primary text-white space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16 border-2 border-white/20 shadow-lg">
                                <AvatarFallback className="bg-white/10 text-white font-bold text-xl uppercase">
                                    {staff.initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <DialogTitle className="text-2xl font-bold">{staff.name}</DialogTitle>
                                <DialogDescription className="text-white/80 font-medium flex items-center gap-2">
                                    <Briefcase className="h-3.5 w-3.5" /> {staff.jobTitle}
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <Badge className={cn("px-3 py-1 text-[10px] uppercase font-bold border-none", staff.statusColor.replace('text-', 'bg-').replace('border-', ''))}>
                                {staff.statusLabel}
                            </Badge>
                            <Button size="sm" variant="secondary" className="h-8 text-xs font-semibold gap-2" onClick={() => onExport(staff.email)}>
                                <Download className="h-3.5 w-3.5" /> Export Report
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/10">
                            <span className="text-[10px] text-white/60 uppercase font-bold block mb-1">Performance</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold">{staff.performanceScore}%</span>
                                <TrendingUp className="h-3 w-3 text-emerald-400" />
                            </div>
                        </div>
                        <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/10">
                            <span className="text-[10px] text-white/60 uppercase font-bold block mb-1">Task Completion</span>
                            <span className="text-xl font-bold">{staff.taskRate}%</span>
                        </div>
                        <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/10">
                            <span className="text-[10px] text-white/60 uppercase font-bold block mb-1">Active KPIs</span>
                            <span className="text-xl font-bold">{staffKpis.length}</span>
                        </div>
                        <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/10">
                            <span className="text-[10px] text-white/60 uppercase font-bold block mb-1">Key Result Areas</span>
                            <span className="text-xl font-bold">{unitKras.length}</span>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden p-6 bg-slate-50 flex flex-col min-h-0">
                    <Tabs defaultValue="tasks" className="flex-1 flex flex-col min-h-0">
                        <TabsList className="grid w-full grid-cols-3 bg-slate-200/50 p-1 rounded-xl mb-4 shrink-0">
                            <TabsTrigger value="tasks" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <CheckCircle className="h-4 w-4 mr-2" /> Tasks
                            </TabsTrigger>
                            <TabsTrigger value="kpis" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <Target className="h-4 w-4 mr-2" /> KPIs
                            </TabsTrigger>
                            <TabsTrigger value="objectives" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <Activity className="h-4 w-4 mr-2" /> KRAs
                            </TabsTrigger>
                        </TabsList>

                        <ScrollArea className="flex-1 min-h-0 pr-4">
                            {/* ── TASKS TAB ─────────────────────────────────────── */}
                            <TabsContent value="tasks" className="m-0 space-y-4">
                                {/* Task Summary Cards */}
                                {(() => {
                                    const total = staffTasks.length;
                                    const todoCount = staffTasks.filter(t => t.status?.toLowerCase() === 'todo').length;
                                    const inProgressCount = staffTasks.filter(t => t.status?.toLowerCase() === 'in-progress').length;
                                    const completedCount = staffTasks.filter(t => ['done', 'completed'].includes(t.status?.toLowerCase() || '')).length;
                                    const onHoldCount = staffTasks.filter(t => t.status?.toLowerCase() === 'on-hold').length;
                                    const urgentHighCount = staffTasks.filter(t => ['urgent', 'high'].includes(t.priority?.toLowerCase() || '')).length;
                                    const mediumCount = staffTasks.filter(t => t.priority?.toLowerCase() === 'medium').length;
                                    const lowCount = staffTasks.filter(t => t.priority?.toLowerCase() === 'low').length;

                                    return (
                                        <div className="space-y-3 mb-4">
                                            {/* Status row */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                <div className="bg-slate-100 rounded-xl p-3 flex flex-col gap-1">
                                                    <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1"><Layers className="h-3 w-3" /> Total</span>
                                                    <span className="text-2xl font-bold text-slate-800">{total}</span>
                                                    <span className="text-[10px] text-slate-400">tasks assigned</span>
                                                </div>
                                                <div className="bg-amber-50 rounded-xl p-3 flex flex-col gap-1">
                                                    <span className="text-[10px] text-amber-600 uppercase font-bold flex items-center gap-1"><ListTodo className="h-3 w-3" /> Todo</span>
                                                    <span className="text-2xl font-bold text-amber-700">{todoCount}</span>
                                                    <span className="text-[10px] text-amber-400">not started</span>
                                                </div>
                                                <div className="bg-blue-50 rounded-xl p-3 flex flex-col gap-1">
                                                    <span className="text-[10px] text-blue-600 uppercase font-bold flex items-center gap-1"><Clock className="h-3 w-3" /> In Progress</span>
                                                    <span className="text-2xl font-bold text-blue-700">{inProgressCount}</span>
                                                    <span className="text-[10px] text-blue-400">active</span>
                                                </div>
                                                <div className="bg-emerald-50 rounded-xl p-3 flex flex-col gap-1">
                                                    <span className="text-[10px] text-emerald-600 uppercase font-bold flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Completed</span>
                                                    <span className="text-2xl font-bold text-emerald-700">{completedCount}</span>
                                                    <span className="text-[10px] text-emerald-400">done</span>
                                                </div>
                                            </div>
                                            {/* Priority row */}
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="bg-rose-50 rounded-xl p-3 flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                                                        <Flag className="h-4 w-4 text-rose-600" />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-rose-500 uppercase font-bold block">High / Urgent</span>
                                                        <span className="text-xl font-bold text-rose-700">{urgentHighCount}</span>
                                                    </div>
                                                </div>
                                                <div className="bg-amber-50 rounded-xl p-3 flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                                        <Flag className="h-4 w-4 text-amber-600" />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-amber-500 uppercase font-bold block">Medium</span>
                                                        <span className="text-xl font-bold text-amber-700">{mediumCount}</span>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                                        <Flag className="h-4 w-4 text-slate-500" />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Low</span>
                                                        <span className="text-xl font-bold text-slate-600">{lowCount}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Task list */}
                                {staffTasks.length > 0 ? staffTasks.map((task) => {
                                    const isDone = ['done', 'completed'].includes(task.status?.toLowerCase() || '');
                                    const priorityColor = task.priority === 'urgent' || task.priority === 'high'
                                        ? 'bg-rose-50 text-rose-600 border-rose-200'
                                        : task.priority === 'medium'
                                            ? 'bg-amber-50 text-amber-600 border-amber-200'
                                            : 'bg-slate-50 text-slate-500 border-slate-200';
                                    return (
                                        <Card key={task.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                                            <CardContent className="p-4 flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className={cn(
                                                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                                                        isDone ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                                                    )}>
                                                        <Clock className="h-5 w-5" />
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-semibold text-slate-900 truncate">{task.title}</span>
                                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                                            <Calendar className="h-3 w-3 shrink-0" /> Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {task.priority && (
                                                        <Badge variant="outline" className={cn("text-[9px] rounded-full uppercase", priorityColor)}>
                                                            {task.priority}
                                                        </Badge>
                                                    )}
                                                    <Badge variant="outline" className={cn(
                                                        "text-[10px] rounded-full",
                                                        isDone ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200"
                                                    )}>
                                                        {task.status?.toUpperCase()}
                                                    </Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                }) : (
                                    <div className="text-center py-10 text-slate-400">No active tasks assigned.</div>
                                )}
                            </TabsContent>

                            {/* ── KPIs TAB ──────────────────────────────────────── */}
                            <TabsContent value="kpis" className="m-0 space-y-4">
                                {/* KPI Summary Cards */}
                                {(() => {
                                    const total = staffKpis.length;
                                    const onTrackCount = staffKpis.filter((k: any) => k.status === 'on-track').length;
                                    const atRiskCount = staffKpis.filter((k: any) => k.status === 'at-risk').length;
                                    const behindCount = staffKpis.filter((k: any) => k.status === 'behind').length;
                                    const completedCount = staffKpis.filter((k: any) => k.status === 'completed').length;

                                    return (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                            <div className="bg-slate-100 rounded-xl p-3 flex flex-col gap-1">
                                                <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1"><Target className="h-3 w-3" /> Total KPIs</span>
                                                <span className="text-2xl font-bold text-slate-800">{total}</span>
                                                <span className="text-[10px] text-slate-400">indicators tracked</span>
                                            </div>
                                            <div className="bg-emerald-50 rounded-xl p-3 flex flex-col gap-1">
                                                <span className="text-[10px] text-emerald-600 uppercase font-bold flex items-center gap-1"><CheckCircle className="h-3 w-3" /> On Track</span>
                                                <span className="text-2xl font-bold text-emerald-700">{onTrackCount}</span>
                                                <span className="text-[10px] text-emerald-400">meeting target</span>
                                            </div>
                                            <div className="bg-amber-50 rounded-xl p-3 flex flex-col gap-1">
                                                <span className="text-[10px] text-amber-600 uppercase font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> At Risk</span>
                                                <span className="text-2xl font-bold text-amber-700">{atRiskCount}</span>
                                                <span className="text-[10px] text-amber-400">needs attention</span>
                                            </div>
                                            <div className="bg-rose-50 rounded-xl p-3 flex flex-col gap-1">
                                                <span className="text-[10px] text-rose-600 uppercase font-bold flex items-center gap-1"><TrendingUp className="h-3 w-3 rotate-180" /> Behind</span>
                                                <span className="text-2xl font-bold text-rose-700">{behindCount}</span>
                                                <span className="text-[10px] text-rose-400">below target</span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* KPI list */}
                                {staffKpis.length > 0 ? staffKpis.map((kpi: any, idx) => {
                                    const kpiName = kpi.name || kpi.title || 'Unnamed KPI';
                                    const kpiTarget = Number(kpi.target ?? kpi.targetValue ?? 0);
                                    const kpiActual = Number(kpi.actual ?? kpi.actualValue ?? 0);
                                    return (
                                        <Card key={`${kpiName}-${idx}`} className="border-none shadow-sm">
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex flex-col min-w-0 pr-4">
                                                        <span className="text-base font-bold text-slate-900">{kpiName}</span>
                                                        <span className="text-xs text-muted-foreground">{kpi.description}</span>
                                                    </div>
                                                    <Badge className={cn("text-[10px] uppercase font-bold shrink-0",
                                                        kpi.status === 'on-track' ? 'bg-emerald-500' :
                                                            kpi.status === 'at-risk' ? 'bg-amber-500' :
                                                                kpi.status === 'completed' ? 'bg-blue-500' : 'bg-rose-500')}>
                                                        {kpi.status?.replace('-', ' ')}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-xs font-semibold">
                                                        <span>Target: {kpiTarget}</span>
                                                        <span>Actual: {kpiActual}</span>
                                                    </div>
                                                    <Progress value={Math.min(100, (kpiActual / (kpiTarget || 1)) * 100)} className="h-2" />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                }) : (
                                    <div className="text-center py-10 text-slate-400">No KPIs tracked for this staff member.</div>
                                )}
                            </TabsContent>

                            {/* ── OBJECTIVES TAB ────────────────────────────────── */}
                            <TabsContent value="objectives" className="m-0 space-y-4">
                                {/* Objectives Summary Cards */}
                                {(() => {
                                    const total = unitKras.length;
                                    const openCount = unitKras.filter(k => (k.status as string) === 'open' || (k.status as string) === 'pending').length;
                                    const inProgressCount = unitKras.filter(k => (k.status as string) === 'in-progress' || (k.status as string) === 'on-track').length;
                                    const completedCount = unitKras.filter(k => (k.status as string) === 'completed' || (k.status as string) === 'closed').length;
                                    const atRiskCount = unitKras.filter(k => (k.status as string) === 'at-risk' || (k.status as string) === 'behind').length;

                                    return (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                            <div className="bg-slate-100 rounded-xl p-3 flex flex-col gap-1">
                                                <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1"><Briefcase className="h-3 w-3" /> Total</span>
                                                <span className="text-2xl font-bold text-slate-800">{total}</span>
                                                <span className="text-[10px] text-slate-400">key result areas</span>
                                            </div>
                                            <div className="bg-blue-50 rounded-xl p-3 flex flex-col gap-1">
                                                <span className="text-[10px] text-blue-600 uppercase font-bold flex items-center gap-1"><Activity className="h-3 w-3" /> In Progress</span>
                                                <span className="text-2xl font-bold text-blue-700">{inProgressCount}</span>
                                                <span className="text-[10px] text-blue-400">active</span>
                                            </div>
                                            <div className="bg-emerald-50 rounded-xl p-3 flex flex-col gap-1">
                                                <span className="text-[10px] text-emerald-600 uppercase font-bold flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Completed</span>
                                                <span className="text-2xl font-bold text-emerald-700">{completedCount}</span>
                                                <span className="text-[10px] text-emerald-400">closed out</span>
                                            </div>
                                            <div className="bg-amber-50 rounded-xl p-3 flex flex-col gap-1">
                                                <span className="text-[10px] text-amber-600 uppercase font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> At Risk</span>
                                                <span className="text-2xl font-bold text-amber-700">{atRiskCount}</span>
                                                <span className="text-[10px] text-amber-400">needs review</span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Objectives list */}
                                {unitKras.length > 0 ? unitKras.map((kra) => {
                                    const kraStatusColor =
                                        (kra.status as string) === 'completed' || (kra.status as string) === 'closed'
                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                            : (kra.status as string) === 'in-progress' || (kra.status as string) === 'on-track'
                                                ? 'bg-blue-50 text-blue-600 border-blue-200'
                                                : (kra.status as string) === 'at-risk' || (kra.status as string) === 'behind'
                                                    ? 'bg-amber-50 text-amber-600 border-amber-200'
                                                    : 'bg-slate-50 text-slate-500 border-slate-200';
                                    const kraKpis = (kra.unitKpis || kra.kpis || []) as KPI[];
                                    return (
                                        <Card key={kra.id} className="border-none shadow-sm">
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-2 min-w-0 pr-4">
                                                        <Activity className="h-4 w-4 text-intranet-primary shrink-0" />
                                                        <span className="text-sm font-bold text-slate-900">{kra.title}</span>
                                                    </div>
                                                    <Badge variant="outline" className={cn("text-[10px] rounded-full shrink-0 uppercase", kraStatusColor)}>
                                                        {kra.status}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{kra.description}</p>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        <Badge variant="secondary" className="text-[9px] bg-slate-100 text-slate-600">UNIT ORIENTED</Badge>
                                                        <Badge variant="secondary" className="text-[9px] bg-slate-100 text-slate-600">Q1-Q4 2026</Badge>
                                                        {kraKpis.length > 0 && (
                                                            <Badge variant="secondary" className="text-[9px] bg-intranet-primary/10 text-intranet-primary">
                                                                {kraKpis.length} KPI{kraKpis.length !== 1 ? 's' : ''}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {kra.progress !== undefined && (
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                                                            <Progress value={kra.progress} className="h-1.5 w-20" />
                                                            <span className="font-semibold text-slate-700">{kra.progress}%</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                }) : (
                                    <div className="text-center py-10 text-slate-400">No Key Result Areas linked.</div>
                                )}
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
};
