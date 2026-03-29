import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
    X, User, AtSign, Briefcase, Activity,
    Mail, Phone, MapPin, Clock, Building2,
    ChevronRight, Share2, Printer, Flag, FileText, Pencil,
    CheckCircle2, Target, BarChart3, Layers, TrendingUp,
    ListChecks, AlertCircle, LayoutDashboard, ArrowUpRight,
    Quote, Award, Calendar
} from 'lucide-react';

import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

export interface OfficerProfile {
    id?: string;
    name: string;
    jobTitle: string;
    email: string;
    phone: string | null;
    employeeId: string;
    joinedDate: string;
    division: string;
    unit: string;
    summary: string;
    skills: string[];
    reportsTo: { name: string; title: string } | null;
    directReports: number;
    officeExtension: string | null;
    timezone: string;
    statutoryDuty?: string;
    photoUrl?: string;
    modalUrl?: string;
    profileImageUrl?: string;
}

export interface OfficerPerformanceStats {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    inReviewTasks: number;
    onHoldTasks: number;
    todoTasks: number;
    taskCompletion: number;
    totalKRAs: number;
    kraProgress: number;
    totalKPIs: number;
    onTrackKPIs: number;
    totalObjectives: number;
    overallScore: number;
}

interface OfficerProfileModalProps {
    officer: OfficerProfile | null;
    open: boolean;
    onClose: () => void;
    performance?: OfficerPerformanceStats;
}

// --- RAG helpers ---
const ragLabel = (score: number) =>
    score >= 70 ? 'On Track' : score >= 40 ? 'At Risk' : 'Off Track';
const ragBadgeClass = (score: number) =>
    score >= 70
        ? 'bg-[#800020]/20 text-[#800020] dark:text-intranet-primary-light border-[#800020]/30'
        : score >= 40
            ? 'bg-[#800020]/10 text-[#800020]/80 dark:text-intranet-primary-light/80 border-[#800020]/20'
            : 'bg-[#800020]/5 text-[#800020]/60 dark:text-intranet-primary-light/60 border-[#800020]/10';
const ragDotClass = (score: number) =>
    score >= 70 ? 'bg-[#800020]' : score >= 40 ? 'bg-[#800020]/70' : 'bg-[#800020]/40';
const ragBarClass = (score: number) =>
    score >= 70 ? 'bg-[#800020]' : score >= 40 ? 'bg-[#800020]/70' : 'bg-[#800020]/40';

const OfficerProfileModal = ({ officer, open, onClose, performance }: OfficerProfileModalProps) => {
    const [activeTab, setActiveTab] = useState(performance ? 'overview' : 'about');
    const { hasPermission, isAdmin } = useRoleBasedAuth();
    const navigate = useNavigate();

    // Reset to overview (if has perf data) or about whenever the modal opens
    useEffect(() => {
        if (open) {
            setActiveTab(performance ? 'overview' : 'about');
        }
    }, [open, performance]);

    if (!officer) return null;

    const initials = officer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const reportsToInitials = officer.reportsTo
        ? officer.reportsTo.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
        : '';

    // Derived performance values
    const kpiPct = performance && performance.totalKPIs > 0
        ? Math.round((performance.onTrackKPIs / performance.totalKPIs) * 100)
        : 0;
    // Task status segments for stacked bar (ordered: done → in-review → in-progress → on-hold → todo)
    const taskSegments = performance ? [
        { key: 'completed', label: 'Completed', count: performance.completedTasks, color: 'bg-emerald-500' },
        { key: 'in-review', label: 'In Review', count: performance.inReviewTasks, color: 'bg-violet-400' },
        { key: 'in-progress', label: 'In Progress', count: performance.inProgressTasks, color: 'bg-blue-500' },
        { key: 'on-hold', label: 'On Hold', count: performance.onHoldTasks, color: 'bg-orange-400' },
        { key: 'todo', label: 'To Do', count: performance.todoTasks, color: 'bg-gray-200' },
    ] : [];

    const tabs = [
        ...(performance ? [{ value: 'overview', label: 'Overview', icon: TrendingUp }] : []),
        { value: 'about', label: 'About', icon: User },
        { value: 'contact', label: 'Contact', icon: AtSign },
        { value: 'experience', label: 'Experience', icon: Briefcase },
        { value: 'activity', label: 'Activity', icon: Activity },
        { value: 'statutory-duty', label: 'Statutory Duty', icon: FileText },
    ];

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="max-w-5xl p-0 overflow-hidden border-none bg-gray-50 dark:bg-gray-900 shadow-2xl rounded-2xl dark:border dark:border-white/10 gap-0 [&>button]:hidden flex flex-col md:flex-row min-h-[520px] max-h-[90vh]">
                <DialogTitle className="sr-only">{officer.name} Profile</DialogTitle>

                {/* Left Panel */}
                <div className="w-[340px] bg-[#400010] flex flex-col relative flex-shrink-0 overflow-hidden">
                    {(officer.modalUrl || officer.photoUrl) ? (
                        <>
                            <div className="absolute inset-0">
                                <img
                                    src={officer.modalUrl || officer.photoUrl}
                                    alt={officer.name}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/10" />
                            </div>
                            <div className="flex-1" />
                        </>
                    ) : (
                        <div className="flex-1 bg-gradient-to-b from-[#600018] to-[#400010] flex items-center justify-center p-8">
                            <div className="w-48 h-48 rounded-full bg-[#800020] border-4 border-white/20 flex items-center justify-center shadow-2xl relative z-10">
                                <span className="text-white text-5xl font-bold">{initials}</span>
                            </div>
                        </div>
                    )}
                    <div className="bg-black/40 backdrop-blur-md px-6 py-4 flex items-center justify-between relative z-10 border-t border-white/10">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-white/70 font-medium">Employee ID</p>
                            <p className="text-white font-bold text-sm tracking-wide">{officer.employeeId}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-white/50 font-medium">Joined</p>
                            <p className="text-white font-bold text-sm">{officer.joinedDate}</p>
                        </div>
                    </div>
                </div>

                {/* Right Panel */}
                <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 min-w-0 overflow-hidden">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                        {/* Scrollable tab nav */}
                        <TabsList className="bg-transparent border-b border-gray-100 dark:border-white/10 rounded-none h-auto p-0 px-4 pt-4 flex-wrap justify-start gap-0">
                            {[
                                { value: 'overview', label: 'Overview', icon: LayoutDashboard },
                                { value: 'strategy', label: 'Strategic Alignment', icon: Target },
                                { value: 'activity', label: 'Recent Activity', icon: Activity },
                                { value: 'about', label: 'About', icon: User },
                                { value: 'contact', label: 'Contact', icon: AtSign },
                                { value: 'experience', label: 'Experience', icon: Briefcase },
                                { value: 'statutory-duty', label: 'Statutory Duty', icon: FileText },
                            ].map((tab) => (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    className={`
                                        rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 font-medium text-sm text-gray-500
                                        hover:text-gray-700 dark:hover:text-gray-300 data-[state=active]:border-[#800020] data-[state=active]:text-[#800020] dark:data-[state=active]:text-intranet-primary-light
                                        data-[state=active]:font-bold transition-all flex items-center gap-2
                                    `}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        {/* ── Overview Tab ── */}
                        {performance && (
                            <TabsContent value="overview" className="m-0 focus-visible:outline-none p-6 md:p-8 space-y-8 overflow-y-auto overflow-x-hidden custom-scrollbar">
                                {/* Header Info */}
                                <div>
                                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight leading-tight">{officer.name}</h2>
                                    <p className="text-[#800020] dark:text-intranet-primary-light font-bold text-sm uppercase tracking-wider mt-2">{officer.jobTitle}</p>
                                </div>

                                {/* Metric Cards Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-white/10 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="p-2 bg-[#800020]/10 dark:bg-[#800020]/20 rounded-lg text-[#800020] dark:text-intranet-primary-light">
                                                <Target className="w-5 h-5" />
                                            </div>
                                            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Strategic Goals</span>
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-black text-gray-900 dark:text-gray-100">{performance.totalObjectives}</span>
                                            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">Active Items</span>
                                        </div>
                                        <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-[#800020] h-full rounded-full" style={{ width: '65%' }}></div>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-white/10 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="p-2 bg-[#800020]/10 dark:bg-[#800020]/20 rounded-lg text-[#800020] dark:text-intranet-primary-light">
                                                <Award className="w-5 h-5" />
                                            </div>
                                            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Performance</span>
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-black text-gray-900 dark:text-gray-100">{performance.overallScore}%</span>
                                            <ArrowUpRight className="w-4 h-4 text-[#800020] dark:text-intranet-primary-light" />
                                        </div>
                                        <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-tight">Q1 Variance: +2.4%</p>
                                    </div>


                                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-white/10 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="p-2 bg-[#800020]/10 dark:bg-[#800020]/20 rounded-lg text-[#800020] dark:text-intranet-primary-light">
                                                <TrendingUp className="w-5 h-5" />
                                            </div>
                                            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Growth</span>
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-black text-gray-900 dark:text-gray-100">8.2</span>
                                            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">Index Score</span>
                                        </div>
                                        <div className="mt-2 flex gap-1">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <div key={i} className={`h-1.5 w-full rounded-full ${i <= 4 ? 'bg-[#800020]' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Biography section */}
                                <div className="relative">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-1 h-6 bg-[#800020] rounded-full"></div>
                                        <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">Professional Biography</h4>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-white/10 rounded-2xl p-6 relative overflow-hidden group">
                                        <Quote className="absolute -right-4 -bottom-4 w-32 h-32 text-gray-50 dark:text-gray-800/20 group-hover:scale-110 transition-transform duration-700 pointer-events-none" />
                                        <p className="text-gray-600 dark:text-gray-300 leading-loose text-sm italic relative z-10">
                                            {(officer as any).bio || officer.summary}
                                        </p>
                                    </div>

                                </div>
                            </TabsContent>
                        )}

                        {/* ── About Tab ── */}
                        <TabsContent value="about" className="flex-1 overflow-y-auto px-6 py-5 mt-0 space-y-6">
                            <div className="border-b border-gray-100 dark:border-white/10 pb-5 mb-5 space-y-2">
                                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{officer.name}</h2>
                                <h3 className="text-lg font-semibold text-[#800020] dark:text-intranet-primary-light uppercase tracking-wide">{officer.jobTitle}</h3>
                                {(officer.division || officer.unit) && (
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
                                        {officer.division && <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300">{officer.division}</span>}
                                        {officer.division && officer.unit && <span className="text-gray-300 dark:text-gray-600">•</span>}
                                        {officer.unit && <span>{officer.unit}</span>}
                                    </div>
                                )}
                            </div>

                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                                    <span className="w-1 h-5 bg-[#800020] rounded-full" />
                                    Professional Summary
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{officer.summary}</p>
                            </div>

                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                                    <span className="w-1 h-5 bg-[#800020] rounded-full" />
                                    Core Skills
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {officer.skills.map((skill, i) => (
                                        <Badge
                                            key={i}
                                            variant="outline"
                                            className="border-[#800020]/30 text-[#800020] bg-[#800020]/5 px-3 py-1 text-xs font-medium rounded-full dark:border-intranet-primary-light/30 dark:text-intranet-primary-light dark:bg-intranet-primary-light/10"
                                        >
                                            {skill}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                                    <span className="w-1 h-5 bg-[#800020] rounded-full" />
                                    Team & Structure
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold mb-2">Reports To</p>
                                        {officer.reportsTo ? (
                                            <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                                                <div className="w-10 h-10 rounded-full bg-[#600018] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                    {reportsToInitials}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{officer.reportsTo.name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{officer.reportsTo.title}</p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-400 dark:text-gray-500 italic">None</p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold mb-2">Direct Reports ({officer.directReports})</p>
                                        {officer.directReports > 0 ? (
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: Math.min(officer.directReports, 3) }).map((_, i) => (
                                                    <div key={i} className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 border-2 border-white dark:border-gray-900 -ml-1 first:ml-0" />
                                                ))}
                                                {officer.directReports > 3 && (
                                                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 border-2 border-white dark:border-gray-900 -ml-1 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
                                                        +{officer.directReports - 3}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-400 dark:text-gray-500 italic">None</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div className="w-10 h-10 rounded-full bg-[#800020]/10 flex items-center justify-center">
                                        <Phone className="w-5 h-5 text-[#800020]" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold">Office Extension</p>
                                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{officer.officeExtension || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div className="w-10 h-10 rounded-full bg-[#800020]/10 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-[#800020]" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold">Timezone</p>
                                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{officer.timezone}</p>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* ── Contact Tab ── */}
                        <TabsContent value="contact" className="flex-1 overflow-y-auto px-6 py-5 mt-0 space-y-4">
                            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                                <span className="w-1 h-5 bg-[#800020] rounded-full" />
                                Contact Information
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-4 p-4 border border-gray-200 dark:border-white/10 rounded-lg">
                                    <div className="w-10 h-10 rounded-full bg-[#800020]/10 flex items-center justify-center">
                                        <Mail className="w-5 h-5 text-[#800020]" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold">Email</p>
                                        <a href={`mailto:${officer.email}`} className="text-sm font-medium text-[#800020] dark:text-intranet-primary-light hover:underline">{officer.email}</a>
                                    </div>
                                </div>
                                {officer.phone && (
                                    <div className="flex items-center gap-4 p-4 border border-gray-200 dark:border-white/10 rounded-lg">
                                        <div className="w-10 h-10 rounded-full bg-[#800020]/10 flex items-center justify-center">
                                            <Phone className="w-5 h-5 text-[#800020]" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold">Phone</p>
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{officer.phone}</p>
                                        </div>
                                    </div>
                                )}
                                {officer.officeExtension && (
                                    <div className="flex items-center gap-4 p-4 border border-gray-200 dark:border-white/10 rounded-lg">
                                        <div className="w-10 h-10 rounded-full bg-[#800020]/10 flex items-center justify-center">
                                            <Phone className="w-5 h-5 text-[#800020]" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold">Office Extension</p>
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{officer.officeExtension}</p>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center gap-4 p-4 border border-gray-200 dark:border-white/10 rounded-lg">
                                    <div className="w-10 h-10 rounded-full bg-[#800020]/10 flex items-center justify-center">
                                        <Building2 className="w-5 h-5 text-[#800020]" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold">Division / Unit</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{officer.division}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{officer.unit}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 p-4 border border-gray-200 dark:border-white/10 rounded-lg">
                                    <div className="w-10 h-10 rounded-full bg-[#800020]/10 flex items-center justify-center">
                                        <MapPin className="w-5 h-5 text-[#800020]" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold">Location</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Port Moresby, Papua New Guinea</p>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* ── Experience Tab ── */}
                        <TabsContent value="experience" className="flex-1 overflow-y-auto px-6 py-5 mt-0 space-y-4">
                            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                                <span className="w-1 h-5 bg-[#800020] rounded-full" />
                                Work Experience
                            </h3>
                            <div className="relative pl-6 border-l-2 border-[#800020] dark:border-intranet-primary-light pb-6">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#800020] dark:bg-intranet-primary-light border-2 border-white dark:border-gray-900" />
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge className="bg-[#800020]/10 text-[#800020] text-[10px] border-0 dark:bg-[#800020]/20 dark:text-intranet-primary-light">Current</Badge>
                                    </div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{officer.jobTitle}</p>
                                    <p className="text-xs text-[#800020] dark:text-intranet-primary-light font-medium">Securities Commission of PNG</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{officer.joinedDate} - Present</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{officer.division} &bull; {officer.unit}</p>
                                </div>
                            </div>
                        </TabsContent>

                        {/* ── Activity Tab ── */}
                        {officer.recentActivity && (
                            <TabsContent value="activity" className="m-0 focus-visible:outline-none p-6 md:p-8 overflow-y-auto overflow-x-hidden custom-scrollbar">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">Recent Activity</h2>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1 uppercase tracking-wider">{officer.name}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-white/10">
                                            <Calendar className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="relative border-l-2 border-gray-100 dark:border-white/10 ml-4 space-y-10 pb-4">
                                    {officer.recentActivity.map((activity, idx) => (
                                        <div key={idx} className="relative pl-10 group">
                                            <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-white dark:border-gray-900 bg-gray-200 dark:bg-gray-800 group-hover:bg-[#800020] group-hover:border-red-50 dark:group-hover:border-red-900/30 transition-all shadow-sm"></div>
                                            <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-white/10 rounded-2xl p-5 hover:shadow-xl hover:translate-x-1 transition-all duration-300">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{activity.date} — {activity.type}</span>
                                                    <div className="w-2 h-2 rounded-full bg-[#800020]"></div>
                                                </div>
                                                <h5 className="font-bold text-gray-900 dark:text-gray-100 mb-2 leading-snug group-hover:text-[#800020] dark:group-hover:text-intranet-primary-light transition-colors">{activity.title}</h5>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                                                    {activity.description}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>
                        )}

                        {/* ── Statutory Duty Tab ── */}
                        <TabsContent value="statutory-duty" className="flex-1 overflow-y-auto px-6 py-5 mt-0 space-y-4 h-full">
                            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                                <span className="w-1 h-5 bg-[#800020] rounded-full" />
                                Statutory Duty
                            </h3>
                            {officer.statutoryDuty ? (
                                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-lg p-5">
                                    <div className="prose prose-sm prose-gray max-w-none prose-headings:text-[#800020] prose-a:text-[#800020] prose-strong:text-gray-900 dark:prose-headings:text-intranet-primary-light dark:prose-a:text-intranet-primary-light dark:prose-strong:text-gray-100 dark:text-gray-300">
                                        <ReactMarkdown>{officer.statutoryDuty}</ReactMarkdown>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
                                    <FileText className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                                    <p className="text-sm text-gray-400 dark:text-gray-500">No statutory duties documented for this profile</p>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>

                    {/* Footer */}
                    <div className="border-t border-gray-200 dark:border-white/10 px-6 py-3 flex items-center justify-between flex-shrink-0">
                        <p className="text-xs text-gray-400 dark:text-gray-500">Last updated: Today at 09:12 AM</p>
                        <div className="flex items-center gap-2">
                            {(isAdmin || hasPermission('admin', 'access')) && (
                                <button
                                    onClick={() => { onClose(); navigate('/admin?tab=org-structure'); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-[#800020]/5 text-gray-600 hover:text-[#800020] rounded-md transition-colors border border-gray-200 dark:bg-gray-800 dark:hover:bg-[#800020]/20 dark:text-gray-300 dark:hover:text-intranet-primary-light dark:border-white/10"
                                    title="Edit Profile in Admin Dashboard"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                    <span className="text-xs font-medium">Edit Profile</span>
                                </button>
                            )}
                            <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-500 dark:hover:text-gray-300" title="Share">
                                <Share2 className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-500 dark:hover:text-gray-300" title="Print">
                                <Printer className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-500 dark:hover:text-gray-300" title="Flag">
                                <Flag className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default OfficerProfileModal;
