import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Search,
    Filter,
    Download,
    TrendingUp,
    TrendingDown,
    Minus,
    MoreHorizontal,
    Target,
    CheckCircle,
    Activity,
    Users,
    Briefcase,
    FileBarChart,
    Info
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Task, KRA, UserContext } from '@/types';
import { UserRole } from '@/services/userSharePointService';
import DivisionStaffMap from '@/utils/divisionStaffMap';
import { useOfficerProfiles } from '@/hooks/useOfficerProfiles';
import { StaffDetailModal } from './modals/StaffDetailModal';
import { objectsToCSV } from '@/utils/csv-helpers';
import { toast } from 'sonner';

interface StaffMetricsTabProps {
    tasks: Task[];
    kras: KRA[];
    unitRoster?: UserRole[];
    userContext?: UserContext;
}

export const StaffMetricsTab: React.FC<StaffMetricsTabProps> = ({
    tasks,
    kras,
    unitRoster,
    userContext
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTimePeriod, setFilterTimePeriod] = useState('Quarterly');
    const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { data: officerProfiles = [] } = useOfficerProfiles();
    const userUnit = userContext?.unit || '';

    // Calculate staff performance metrics (reusing logic from OverviewTab)
    const staffPerformance = useMemo(() => {
        // Service-account / facility keywords — exclude these from performance cards
        const serviceKeywords = ['service account', 'facility', 'information service', 'boardroom', 'enquiries'];

        // Build a normalised roster: prefer live SharePoint data, fall back to static map
        type RosterEntry = { email: string; name: string; jobTitle: string };
        let rosterEntries: RosterEntry[];

        const isServiceEntry = (name: string, title: string, email: string) =>
            serviceKeywords.some(kw =>
                title?.toLowerCase().includes(kw) ||
                name?.toLowerCase().includes(kw) ||
                email?.toLowerCase().includes(kw)
            );

        if (unitRoster && unitRoster.length > 0) {
            rosterEntries = unitRoster
                .filter(u => !isServiceEntry(u.user_name || '', u.role_name || '', u.user_email || ''))
                .map(u => ({
                    email: u.user_email,
                    name: u.user_name || u.user_email,
                    jobTitle: u.role_name || '',
                }));
        } else {
            // Prefer live officer profiles, fall back to static map
            const liveMatched = officerProfiles.filter(p =>
                p.unit?.toLowerCase() === userUnit.toLowerCase() &&
                !isServiceEntry(p.name || '', p.jobTitle || '', p.email || '')
            );

            if (liveMatched.length > 0) {
                rosterEntries = liveMatched.map(p => ({
                    email: p.email,
                    name: p.name,
                    jobTitle: p.jobTitle,
                }));
            } else {
            const allStaff = DivisionStaffMap.getAllStaff();

            // Tier 1: exact unit match
            let matched = allStaff.filter(s =>
                s.unit?.toLowerCase() === userUnit.toLowerCase() &&
                !isServiceEntry(s.name || '', s.job_title || '', s.email || '')
            );

            // Tier 2: partial / contains match (handles "IT Unit" vs "IT" etc.)
            if (matched.length === 0 && userUnit) {
                matched = allStaff.filter(s =>
                    (s.unit?.toLowerCase().includes(userUnit.toLowerCase()) ||
                        userUnit.toLowerCase().includes(s.unit?.toLowerCase() || '__')) &&
                    !isServiceEntry(s.name || '', s.job_title || '', s.email || '')
                );
            }

            // Tier 3: derive unique people from task/KRA data so the page is never blank
            if (matched.length === 0) {
                const emailsSeen = new Set<string>();
                const derived: RosterEntry[] = [];

                const addPerson = (email: string, name?: string, title?: string) => {
                    const e = email?.toLowerCase();
                    if (!e || emailsSeen.has(e) || isServiceEntry(name || '', title || '', e)) return;
                    emailsSeen.add(e);
                    derived.push({ email: e, name: name || email, jobTitle: title || '' });
                };

                tasks.forEach(t => {
                    t.assignees?.forEach(a => addPerson(a.email || '', a.name, ''));
                    if (t.assignedTo) addPerson(t.assignedTo, t.assignedTo, '');
                    if (t.createdByEmail) addPerson(t.createdByEmail, t.createdBy, '');
                });

                kras.forEach(k => {
                    if (k.owner?.email) addPerson(k.owner.email, k.owner.name, '');
                    k.assignees?.forEach(a => addPerson(a.email || '', a.name, ''));
                });

                matched = derived.map(d => allStaff.find(s => s.email.toLowerCase() === d.email)
                    ? { email: d.email, name: allStaff.find(s => s.email.toLowerCase() === d.email)!.name, jobTitle: allStaff.find(s => s.email.toLowerCase() === d.email)!.job_title }
                    : d
                );
            }

            rosterEntries = matched.map(s => ({ email: s.email, name: s.name, jobTitle: (s as any).job_title || (s as any).jobTitle || '' }));
            } // end DivisionStaffMap fallback
        }

        if (rosterEntries.length === 0) return [];

        const getLevel = (score: number) => {
            if (score >= 80) return { label: 'Excellent', color: 'bg-emerald-500', text: 'text-white' };
            if (score >= 60) return { label: 'Good', color: 'bg-blue-500', text: 'text-white' };
            if (score >= 40) return { label: 'Fair', color: 'bg-amber-500', text: 'text-white' };
            return { label: 'Needs Attention', color: 'bg-rose-500', text: 'text-white' };
        };

        const getStatusLabel = (score: number) => {
            if (score >= 80) return 'ON TRACK';
            if (score >= 60) return 'STABLE';
            if (score >= 40) return 'AT RISK';
            return 'BELOW GOAL';
        };

        const getStatusColor = (score: number) => {
            if (score >= 80) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            if (score >= 60) return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            if (score >= 40) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
        };

        return rosterEntries
            .map(staff => {
                const staffEmail = staff.email.toLowerCase();

                const staffTasks = tasks.filter(t =>
                    t.assignees?.some(a => a.email?.toLowerCase() === staffEmail) ||
                    t.createdByEmail?.toLowerCase() === staffEmail ||
                    t.authorEmail?.toLowerCase() === staffEmail ||
                    t.assignedTo?.toLowerCase() === staffEmail
                );

                const staffKras = kras.filter(k => {
                    const kraKpis = (k.unitKpis || k.kpis || []) as any[];
                    const hasAssignedKpi = kraKpis.some(kpi =>
                        kpi.assignees?.some((a: any) => a.email?.toLowerCase() === staffEmail)
                    );

                    return k.owner?.email?.toLowerCase() === staffEmail ||
                        k.createdByEmail?.toLowerCase() === staffEmail ||
                        k.assignees?.some(a => a.email?.toLowerCase() === staffEmail) ||
                        hasAssignedKpi;
                });

                // Task metrics
                const totalTasks = staffTasks.length;
                const doneTasks = staffTasks.filter(t =>
                    ['done', 'completed', 'closed', 'complete'].includes(t.status?.toLowerCase() || '')
                ).length;
                const taskRate = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

                // KRA metrics
                const totalKras = staffKras.length;
                const completedKras = staffKras.filter(k =>
                    (k.status as string) === 'completed' || (k.status as string) === 'closed'
                ).length;
                const onTrackKras = staffKras.filter(k => (k.status as string) === 'on-track').length;
                const kraRate = totalKras > 0 ? ((completedKras + onTrackKras) / totalKras) * 100 : 0;

                // KPI metrics — count all KPIs assigned to this staff member across all KRAs
                const allStaffKpis = kras.flatMap(k => (k.unitKpis || k.kpis || []) as any[])
                    .filter(kpi => kpi.assignees?.some((a: any) => a.email?.toLowerCase() === staffEmail));

                const totalKpis = allStaffKpis.length;
                const completedKpis = allStaffKpis.filter(kpi => kpi.status === 'completed').length;
                const onTrackKpis = allStaffKpis.filter(kpi => kpi.status === 'on-track').length;
                const kpiRate = totalKpis > 0 ? ((completedKpis + onTrackKpis) / totalKpis) * 100 : 0;

                // Weighted performance score
                let weightedScore = 0;
                let totalWeight = 0;
                if (totalTasks > 0) { weightedScore += taskRate * 0.4; totalWeight += 0.4; }
                if (totalKpis > 0) { weightedScore += kpiRate * 0.4; totalWeight += 0.4; }
                if (totalKras > 0) { weightedScore += kraRate * 0.2; totalWeight += 0.2; }
                const performanceScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

                const nameParts = staff.name.split(' ').filter(Boolean);
                const initials = nameParts.length >= 2
                    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
                    : staff.name.substring(0, 2).toUpperCase();

                return {
                    email: staff.email,
                    name: staff.name,
                    jobTitle: staff.jobTitle,
                    unit: userUnit,
                    initials,
                    totalTasks,
                    doneTasks,
                    taskRate: Math.round(taskRate),
                    performanceScore,
                    statusLabel: getStatusLabel(performanceScore),
                    statusColor: getStatusColor(performanceScore),
                    level: getLevel(performanceScore),
                };
            })
            .sort((a, b) => b.performanceScore - a.performanceScore);
    }, [tasks, kras, unitRoster, userUnit, officerProfiles]);

    // Derived filtered staff
    const filteredStaff = useMemo(() => {
        if (!searchQuery) return staffPerformance;
        const query = searchQuery.toLowerCase();
        return staffPerformance.filter(s =>
            s.name.toLowerCase().includes(query) ||
            s.jobTitle.toLowerCase().includes(query) ||
            s.statusLabel.toLowerCase().includes(query)
        );
    }, [staffPerformance, searchQuery]);

    // Modal handlers
    const handleViewDetails = (staff: any) => {
        setSelectedStaff(staff);
        setIsModalOpen(true);
    };

    const handleExportIndividual = (email: string) => {
        const staff = staffPerformance.find(s => s.email === email);
        if (!staff) return;

        const data = [
            { Metric: 'Staff Name', Value: staff.name },
            { Metric: 'Job Title', Value: staff.jobTitle },
            { Metric: 'Performance Score', Value: `${staff.performanceScore}%` },
            { Metric: 'Task Completion Rate', Value: `${staff.taskRate}%` },
            { Metric: 'Total Tasks', Value: staff.totalTasks },
            { Metric: 'Completed Tasks', Value: staff.doneTasks },
            { Metric: 'Status', Value: staff.statusLabel },
            { Metric: 'Report Date', Value: new Date().toLocaleDateString() },
        ];

        const csvContent = objectsToCSV(data);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Performance_Report_${staff.name.replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Individual report exported successfully');
    };

    const handleExportAll = () => {
        const data = filteredStaff.map(s => ({
            Name: s.name,
            Role: s.jobTitle,
            Status: s.statusLabel,
            'Performance Score (%)': s.performanceScore,
            'Task Completion (%)': s.taskRate,
            'Total Tasks': s.totalTasks,
            'Done Tasks': s.doneTasks
        }));

        const csvContent = objectsToCSV(data);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Unit_Performance_Matrix_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Overall matrix exported successfully');
    };

    // Summary Metrics
    const summaryMetrics = useMemo(() => {
        if (staffPerformance.length === 0) return { productivity: 0, taskRate: 0, kpiScore: 0, kraProgress: 0 };

        const avgProductivity = Math.round(staffPerformance.reduce((acc, s) => acc + s.performanceScore, 0) / staffPerformance.length);
        const avgTaskRate = Math.round(staffPerformance.reduce((acc, s) => acc + s.taskRate, 0) / staffPerformance.length);

        return {
            productivity: avgProductivity,
            taskRate: avgTaskRate,
            kpiScore: (avgProductivity / 20).toFixed(1),
            kraProgress: Math.min(100, Math.round(avgProductivity * 0.9))
        };
    }, [staffPerformance]);

    // Department Task Load
    const deptTaskLoad = useMemo(() => {
        const groups: Record<string, { total: number, done: number }> = {};
        staffPerformance.forEach(s => {
            const groupName = s.jobTitle || 'General';
            if (!groups[groupName]) groups[groupName] = { total: 0, done: 0 };
            groups[groupName].total += s.totalTasks;
            groups[groupName].done += s.doneTasks;
        });

        return Object.entries(groups)
            .map(([name, counts]) => ({
                name,
                progress: counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0
            }))
            .sort((a, b) => b.progress - a.progress)
            .slice(0, 5);
    }, [staffPerformance]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex flex-col space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight dark:text-gray-100">Staff Performance Metrics</h2>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px] py-0 px-1.5 h-4 dark:bg-blue-500/20 dark:border-blue-500/30">LIVE VIEW</Badge>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground dark:text-gray-400" />
                        <Input
                            type="search"
                            placeholder="Search staff or metric..."
                            className="pl-9 h-9 dark:bg-gray-900 dark:border-white/10 dark:text-gray-100 dark:placeholder:text-gray-500"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={filterTimePeriod} onValueChange={setFilterTimePeriod}>
                        <SelectTrigger className="h-9 w-32 dark:bg-gray-900 dark:border-white/10 dark:text-gray-100">
                            <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-950 dark:border-white/10">
                            <SelectItem value="Weekly">Weekly</SelectItem>
                            <SelectItem value="Monthly">Monthly</SelectItem>
                            <SelectItem value="Quarterly">Quarterly</SelectItem>
                            <SelectItem value="Yearly">Yearly</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="h-9 dark:border-white/10 dark:text-gray-300 dark:hover:bg-gray-800" onClick={handleExportAll}>
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Dialog>
                    <Card className="bg-card group relative dark:bg-gray-900 dark:border-white/10">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground dark:text-gray-400">Overall Productivity %</span>
                                <Activity className="h-4 w-4 text-intranet-primary dark:text-blue-400" />
                            </div>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 dark:hover:bg-gray-800">
                                    <Info className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
                                </Button>
                            </DialogTrigger>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold dark:text-gray-100">{summaryMetrics.productivity}%</span>
                                <span className="text-[10px] text-emerald-500 flex items-center dark:text-emerald-400">
                                    <TrendingUp className="h-2 w-2 mr-0.5" /> 2.4%
                                </span>
                            </div>
                            <Progress className="h-1 mt-3 bg-intranet-primary/10 dark:bg-blue-500/10" value={summaryMetrics.productivity} />
                        </CardContent>
                    </Card>
                    <DialogContent className="max-w-md dark:bg-gray-950 dark:border-white/10">
                        <DialogHeader>
                            <DialogTitle className="dark:text-gray-100">About Overall Productivity</DialogTitle>
                            <DialogDescription className="dark:text-gray-400">Weighted staff performance score</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 text-sm dark:text-gray-300">
                            <p>This card shows the average weighted performance score across all staff members in the unit.</p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm bg-primary/20 dark:bg-blue-500/30"></div>
                                    <span><strong className="dark:text-gray-100">Progress Bar:</strong> Visualizes the unit's overall productivity relative to 100%.</span>
                                </div>
                            </div>
                            <ul className="list-disc pl-5 space-y-1 mt-2">
                                <li><strong className="dark:text-gray-100">Calculation:</strong> A weighted average combining task completion (40%), KPI performance (40%), and KRA progress (20%) per staff member.</li>
                                <li><strong className="dark:text-gray-100">Analysis:</strong> A low score may indicate resourcing issues, unclear assignments, or untracked work.</li>
                                <li><strong className="dark:text-gray-100">Trend:</strong> Consistent improvement signals a healthy and engaged team.</li>
                            </ul>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog>
                    <Card className="bg-card group relative dark:bg-gray-900 dark:border-white/10">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground dark:text-gray-400">Task Completion Rate</span>
                                <CheckCircle className="h-4 w-4 text-intranet-primary dark:text-blue-400" />
                            </div>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 dark:hover:bg-gray-800">
                                    <Info className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
                                </Button>
                            </DialogTrigger>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold dark:text-gray-100">{summaryMetrics.taskRate}%</span>
                                <span className="text-[10px] text-rose-500 flex items-center dark:text-rose-400">
                                    <TrendingDown className="h-2 w-2 mr-0.5" /> 1.2%
                                </span>
                            </div>
                            <Progress className="h-1 mt-3 bg-emerald-500/10 dark:bg-emerald-500/20" value={summaryMetrics.taskRate} />
                        </CardContent>
                    </Card>
                    <DialogContent className="max-w-md dark:bg-gray-950 dark:border-white/10">
                        <DialogHeader>
                            <DialogTitle className="dark:text-gray-100">About Task Completion Rate</DialogTitle>
                            <DialogDescription className="dark:text-gray-400">Unit-wide daily task throughput</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 text-sm dark:text-gray-300">
                            <p>This card reflects the average percentage of tasks that have been marked as completed across all staff members.</p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm bg-emerald-500/20 dark:bg-emerald-500/30"></div>
                                    <span><strong className="dark:text-gray-100">Progress Bar:</strong> Represents the unit's average task completion rate.</span>
                                </div>
                            </div>
                            <ul className="list-disc pl-5 space-y-1 mt-2">
                                <li><strong className="dark:text-gray-100">Analysis:</strong> A declining rate may indicate task overload, unclear priorities, or blockers preventing staff from closing work.</li>
                                <li><strong className="dark:text-gray-100">Trend:</strong> A steady or rising rate indicates the team is effectively managing and closing daily operational work.</li>
                            </ul>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog>
                    <Card className="bg-card group relative dark:bg-gray-900 dark:border-white/10">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground dark:text-gray-400">Average KPI Score</span>
                                <Target className="h-4 w-4 text-intranet-primary dark:text-blue-400" />
                            </div>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 dark:hover:bg-gray-800">
                                    <Info className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
                                </Button>
                            </DialogTrigger>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold dark:text-gray-100">{summaryMetrics.kpiScore}/5</span>
                                <span className="text-[10px] text-emerald-500 flex items-center dark:text-emerald-400">
                                    <TrendingUp className="h-2 w-2 mr-0.5" /> 0.5%
                                </span>
                            </div>
                            <div className="flex gap-1 mt-3">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "h-1.5 w-1.5 rounded-full",
                                            i <= Math.round(Number(summaryMetrics.kpiScore)) ? "bg-intranet-primary dark:bg-blue-400" : "bg-muted dark:bg-gray-800"
                                        )}
                                    />
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                    <DialogContent className="max-w-md dark:bg-gray-950 dark:border-white/10">
                        <DialogHeader>
                            <DialogTitle className="dark:text-gray-100">About Average KPI Score</DialogTitle>
                            <DialogDescription className="dark:text-gray-400">Key Performance Indicator rating out of 5</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 text-sm dark:text-gray-300">
                            <p>This card shows the unit's average KPI performance score on a 5-point scale, derived from each staff member's overall productivity score.</p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-intranet-primary dark:bg-blue-400"></div>
                                    <span><strong className="dark:text-gray-100">Filled Dots:</strong> Represent the achieved score level out of 5.</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-muted dark:bg-gray-800"></div>
                                    <span><strong className="dark:text-gray-100">Empty Dots:</strong> Remaining potential to achieve.</span>
                                </div>
                            </div>
                            <ul className="list-disc pl-5 space-y-1 mt-2">
                                <li><strong className="dark:text-gray-100">Scale:</strong> 1–2 Needs Attention · 3 Fair · 4 Good · 5 Excellent.</li>
                                <li><strong className="dark:text-gray-100">Analysis:</strong> A low score signals that KPI targets are not being met across the team and may require strategic intervention.</li>
                                <li><strong className="dark:text-gray-100">Trend:</strong> Progress here reflects direct improvement in how well the unit is tracking against its strategic goals.</li>
                            </ul>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog>
                    <Card className="bg-card group relative dark:bg-gray-900 dark:border-white/10">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground dark:text-gray-400">KRA Progress</span>
                                <Briefcase className="h-4 w-4 text-intranet-primary dark:text-blue-400" />
                            </div>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 dark:hover:bg-gray-800">
                                    <Info className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
                                </Button>
                            </DialogTrigger>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold dark:text-gray-100">{summaryMetrics.kraProgress}%</span>
                                <span className="text-[10px] text-emerald-500 flex items-center dark:text-emerald-400">
                                    <TrendingUp className="h-2 w-2 mr-0.5" /> 3.0%
                                </span>
                            </div>
                            <Progress className="h-1 mt-3 bg-intranet-primary/10 dark:bg-blue-500/10" value={summaryMetrics.kraProgress} />
                        </CardContent>
                    </Card>
                    <DialogContent className="max-w-md dark:bg-gray-950 dark:border-white/10">
                        <DialogHeader>
                            <DialogTitle className="dark:text-gray-100">About KRA Progress</DialogTitle>
                            <DialogDescription className="dark:text-gray-400">Key Result Area completion across the unit</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 text-sm dark:text-gray-300">
                            <p>This card displays the estimated overall progress of Key Result Areas (KRAs) across the unit's staff members.</p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm bg-primary/20 dark:bg-blue-500/30"></div>
                                    <span><strong className="dark:text-gray-100">Progress Bar:</strong> Visualizes the unit-wide KRA completion percentage.</span>
                                </div>
                            </div>
                            <ul className="list-disc pl-5 space-y-1 mt-2">
                                <li><strong className="dark:text-gray-100">Analysis:</strong> Low KRA progress while tasks are active may indicate effort is not aligned with strategic objectives.</li>
                                <li><strong className="dark:text-gray-100">Trend:</strong> This metric should grow in tandem with KPI scores. Divergence between the two warrants investigation.</li>
                            </ul>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Main Matrix Table */}
            <Card className="dark:bg-gray-900 dark:border-white/10">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold dark:text-gray-100">Staff Performance Matrix</CardTitle>
                    <CardDescription className="text-xs dark:text-gray-400">Detailed breakdown of key performance indicators by team member</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50 dark:bg-gray-800/50">
                            <TableRow className="hover:bg-transparent border-y dark:border-white/10 bg-muted/50 dark:bg-gray-800/50">
                                <TableHead className="text-[10px] font-bold uppercase tracking-wider h-10 dark:text-gray-300">Staff Member</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-wider h-10 dark:text-gray-300">Status</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-wider h-10 dark:text-gray-300">KPI Trend</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-wider h-10 dark:text-gray-300">Task Progress</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-wider h-10 dark:text-gray-300">Current Score</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-wider h-10 text-right dark:text-gray-300">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredStaff.map((staff) => (
                                <TableRow
                                    key={staff.email}
                                    className="border-b last:border-0 h-16 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800/50 dark:border-white/10 transition-colors"
                                    onClick={() => handleViewDetails(staff)}
                                >
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9 border dark:border-white/10">
                                                <AvatarFallback className="text-xs font-semibold dark:bg-gray-800 dark:text-gray-200">{staff.initials}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold dark:text-gray-200">{staff.name}</span>
                                                <span className="text-[10px] text-muted-foreground dark:text-gray-400 leading-tight">{staff.jobTitle}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("text-[8px] px-1.5 py-0.5 font-bold border rounded-full h-5", staff.statusColor)}>
                                            {staff.statusLabel}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-end gap-0.5 h-6">
                                            {[30, 50, 45, 70, 85, 90, staff.performanceScore].map((h, i) => (
                                                <div
                                                    key={i}
                                                    className={cn(
                                                        "w-1.5 rounded-t-[1px]",
                                                        i === 6 ? (staff.performanceScore >= 60 ? "bg-intranet-primary dark:bg-blue-500" : "bg-amber-500") : "bg-intranet-primary/20 dark:bg-blue-500/20"
                                                    )}
                                                    style={{ height: `${Math.max(10, h * 0.25)}px` }}
                                                />
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1 w-40">
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-muted-foreground dark:text-gray-400">{staff.doneTasks}/{staff.totalTasks} Tasks</span>
                                                <span className="font-semibold dark:text-gray-200">{staff.taskRate}%</span>
                                            </div>
                                            <Progress
                                                className="h-1 dark:bg-gray-800"
                                                value={staff.taskRate}
                                                style={{ '--indicator-color': staff.performanceScore >= 80 ? '#10b981' : staff.performanceScore >= 60 ? '#3b82f6' : '#f59e0b' } as any}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-sm font-bold dark:text-gray-100">{(staff.performanceScore / 20).toFixed(1)}</span>
                                            <span className="text-[10px] text-muted-foreground dark:text-gray-400">/ 5.0</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 hover:bg-intranet-primary/10 hover:text-intranet-primary dark:hover:bg-blue-500/10 dark:hover:text-blue-400 dark:text-gray-400"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleViewDetails(staff);
                                            }}
                                        >
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <div className="p-4 border-t dark:border-white/10 flex items-center justify-between text-[10px] text-muted-foreground dark:text-gray-400 bg-muted/20 dark:bg-gray-800/20">
                        <span>Showing {filteredStaff.length} of {staffPerformance.length} staff members</span>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-6 w-6 dark:border-white/10" disabled><Minus className="h-3 w-3 rotate-90" /></Button>
                            <Button variant="outline" size="icon" className="h-6 w-6 dark:border-white/10 dark:hover:bg-gray-800"><Minus className="h-3 w-3 -rotate-90" /></Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 dark:bg-gray-900 dark:border-white/10">
                    <CardHeader className="pb-4 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-semibold dark:text-gray-100">Unit Task Load</CardTitle>
                        <span className="text-[10px] text-muted-foreground dark:text-gray-400">By Role / Group</span>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {deptTaskLoad.map((dept) => (
                            <div key={dept.name} className="space-y-1.5">
                                <div className="flex justify-between text-xs">
                                    <span className="font-medium dark:text-gray-200">{dept.name}</span>
                                    <span className="font-bold dark:text-gray-100">{dept.progress}%</span>
                                </div>
                                <Progress
                                    className="h-1.5 bg-muted dark:bg-gray-800"
                                    value={dept.progress}
                                    style={{ '--indicator-color': dept.progress >= 80 ? '#3b82f6' : '#f59e0b' } as any}
                                />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="dark:bg-gray-900 dark:border-white/10">
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold dark:text-gray-100">Top Performers</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-5">
                            {staffPerformance.slice(0, 3).map((staff) => (
                                <div key={staff.email} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback className="text-[10px] font-bold bg-intranet-primary/10 text-intranet-primary dark:bg-blue-500/20 dark:text-blue-400">{staff.initials}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs font-semibold dark:text-gray-200">{staff.name}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400">{(staff.performanceScore / 20).toFixed(1)} score</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 text-center">
                            <Button variant="link" className="text-intranet-primary dark:text-blue-400 text-[10px] h-auto p-0 hover:no-underline font-bold">VIEW FULL RANKING</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <StaffDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                staff={selectedStaff}
                tasks={tasks}
                kras={kras}
                onExport={handleExportIndividual}
            />
        </div>
    );
};
