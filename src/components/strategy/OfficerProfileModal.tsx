import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
    X, User, AtSign, Briefcase, Activity,
    Mail, Phone, MapPin, Clock, Building2,
    ChevronRight, Share2, Printer, Flag
} from 'lucide-react';

export interface OfficerProfile {
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
}

interface OfficerProfileModalProps {
    officer: OfficerProfile | null;
    open: boolean;
    onClose: () => void;
}

const OfficerProfileModal = ({ officer, open, onClose }: OfficerProfileModalProps) => {
    const [activeTab, setActiveTab] = useState('about');

    if (!officer) return null;

    const initials = officer.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    const reportsToInitials = officer.reportsTo
        ? officer.reportsTo.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
        : '';

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="max-w-[900px] p-0 overflow-hidden rounded-2xl border-0 gap-0 [&>button]:hidden">
                <DialogTitle className="sr-only">{officer.name} Profile</DialogTitle>
                <div className="flex min-h-[520px]">
                    {/* Left Panel - Photo / Avatar */}
                    <div className="w-[340px] bg-gradient-to-b from-[#600018] to-[#400010] flex flex-col relative flex-shrink-0">
                        {/* Large avatar area */}
                        <div className="flex-1 flex items-center justify-center p-8">
                            <div className="w-48 h-48 rounded-full bg-[#800020] border-4 border-white/20 flex items-center justify-center shadow-2xl">
                                <span className="text-white text-5xl font-bold">{initials}</span>
                            </div>
                        </div>

                        {/* Bottom overlay with employee info */}
                        <div className="bg-black/40 px-6 py-4 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-white/50 font-medium">Employee ID</p>
                                <p className="text-white font-bold text-sm">{officer.employeeId}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-white/50 font-medium">Joined</p>
                                <p className="text-white font-bold text-sm">{officer.joinedDate}</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Tabs & Content */}
                    <div className="flex-1 flex flex-col bg-white min-w-0">
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Tabs */}
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                            <TabsList className="bg-transparent border-b border-gray-200 rounded-none h-auto p-0 px-6 pt-3 justify-start gap-0">
                                {[
                                    { value: 'about', label: 'About', icon: User },
                                    { value: 'contact', label: 'Contact', icon: AtSign },
                                    { value: 'experience', label: 'Experience', icon: Briefcase },
                                    { value: 'activity', label: 'Activity', icon: Activity },
                                ].map(tab => (
                                    <TabsTrigger
                                        key={tab.value}
                                        value={tab.value}
                                        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-none border-b-2 text-sm font-medium transition-all data-[state=active]:shadow-none ${
                                            activeTab === tab.value
                                                ? 'border-[#800020] text-[#800020] bg-transparent'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 bg-transparent'
                                        }`}
                                    >
                                        <tab.icon className="w-4 h-4" />
                                        {tab.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>

                            {/* About Tab */}
                            <TabsContent value="about" className="flex-1 overflow-y-auto px-6 py-5 mt-0 space-y-6">
                                {/* Professional Summary */}
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
                                        <span className="w-1 h-5 bg-[#800020] rounded-full"></span>
                                        Professional Summary
                                    </h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">{officer.summary}</p>
                                </div>

                                {/* Core Skills */}
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
                                        <span className="w-1 h-5 bg-[#800020] rounded-full"></span>
                                        Core Skills
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {officer.skills.map((skill, i) => (
                                            <Badge
                                                key={i}
                                                variant="outline"
                                                className="border-[#800020]/30 text-[#800020] bg-[#800020]/5 px-3 py-1 text-xs font-medium rounded-full"
                                            >
                                                {skill}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                {/* Team & Structure */}
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
                                        <span className="w-1 h-5 bg-[#800020] rounded-full"></span>
                                        Team & Structure
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Reports To */}
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Reports To</p>
                                            {officer.reportsTo ? (
                                                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                                                    <div className="w-10 h-10 rounded-full bg-[#600018] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                        {reportsToInitials}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-semibold text-gray-900 truncate">{officer.reportsTo.name}</p>
                                                        <p className="text-xs text-gray-500 truncate">{officer.reportsTo.title}</p>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-400 italic">None</p>
                                            )}
                                        </div>

                                        {/* Direct Reports */}
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Direct Reports ({officer.directReports})</p>
                                            {officer.directReports > 0 ? (
                                                <div className="flex items-center gap-1">
                                                    {Array.from({ length: Math.min(officer.directReports, 3) }).map((_, i) => (
                                                        <div key={i} className="w-10 h-10 rounded-full bg-gray-300 border-2 border-white -ml-1 first:ml-0"></div>
                                                    ))}
                                                    {officer.directReports > 3 && (
                                                        <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-white -ml-1 flex items-center justify-center text-xs font-medium text-gray-600">
                                                            +{officer.directReports - 3}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-400 italic">None</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Office Extension & Timezone */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                        <div className="w-10 h-10 rounded-full bg-[#800020]/10 flex items-center justify-center">
                                            <Phone className="w-5 h-5 text-[#800020]" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Office Extension</p>
                                            <p className="text-sm font-bold text-gray-900">{officer.officeExtension || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                        <div className="w-10 h-10 rounded-full bg-[#800020]/10 flex items-center justify-center">
                                            <Clock className="w-5 h-5 text-[#800020]" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Timezone</p>
                                            <p className="text-sm font-bold text-gray-900">{officer.timezone}</p>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Contact Tab */}
                            <TabsContent value="contact" className="flex-1 overflow-y-auto px-6 py-5 mt-0 space-y-4">
                                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
                                    <span className="w-1 h-5 bg-[#800020] rounded-full"></span>
                                    Contact Information
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                                        <div className="w-10 h-10 rounded-full bg-[#800020]/10 flex items-center justify-center">
                                            <Mail className="w-5 h-5 text-[#800020]" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Email</p>
                                            <a href={`mailto:${officer.email}`} className="text-sm font-medium text-[#800020] hover:underline">{officer.email}</a>
                                        </div>
                                    </div>
                                    {officer.phone && (
                                        <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                                            <div className="w-10 h-10 rounded-full bg-[#800020]/10 flex items-center justify-center">
                                                <Phone className="w-5 h-5 text-[#800020]" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Phone</p>
                                                <p className="text-sm font-medium text-gray-900">{officer.phone}</p>
                                            </div>
                                        </div>
                                    )}
                                    {officer.officeExtension && (
                                        <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                                            <div className="w-10 h-10 rounded-full bg-[#800020]/10 flex items-center justify-center">
                                                <Phone className="w-5 h-5 text-[#800020]" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Office Extension</p>
                                                <p className="text-sm font-medium text-gray-900">{officer.officeExtension}</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                                        <div className="w-10 h-10 rounded-full bg-[#800020]/10 flex items-center justify-center">
                                            <Building2 className="w-5 h-5 text-[#800020]" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Division / Unit</p>
                                            <p className="text-sm font-medium text-gray-900">{officer.division}</p>
                                            <p className="text-xs text-gray-500">{officer.unit}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                                        <div className="w-10 h-10 rounded-full bg-[#800020]/10 flex items-center justify-center">
                                            <MapPin className="w-5 h-5 text-[#800020]" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Location</p>
                                            <p className="text-sm font-medium text-gray-900">Port Moresby, Papua New Guinea</p>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Experience Tab */}
                            <TabsContent value="experience" className="flex-1 overflow-y-auto px-6 py-5 mt-0 space-y-4">
                                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
                                    <span className="w-1 h-5 bg-[#800020] rounded-full"></span>
                                    Work Experience
                                </h3>
                                {/* Current role */}
                                <div className="relative pl-6 border-l-2 border-[#800020] pb-6">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#800020] border-2 border-white"></div>
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge className="bg-green-100 text-green-700 text-[10px] border-0">Current</Badge>
                                        </div>
                                        <p className="text-sm font-bold text-gray-900">{officer.jobTitle}</p>
                                        <p className="text-xs text-[#800020] font-medium">Securities Commission of PNG</p>
                                        <p className="text-xs text-gray-400 mt-1">{officer.joinedDate} - Present</p>
                                        <p className="text-xs text-gray-500 mt-2">{officer.division} &bull; {officer.unit}</p>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Activity Tab */}
                            <TabsContent value="activity" className="flex-1 overflow-y-auto px-6 py-5 mt-0 space-y-4">
                                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
                                    <span className="w-1 h-5 bg-[#800020] rounded-full"></span>
                                    Recent Activity
                                </h3>
                                <div className="text-center py-12">
                                    <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-sm text-gray-400">No recent activity to display</p>
                                </div>
                            </TabsContent>
                        </Tabs>

                        {/* Footer */}
                        <div className="border-t border-gray-200 px-6 py-3 flex items-center justify-between">
                            <p className="text-xs text-gray-400">Last updated: Today at 09:12 AM</p>
                            <div className="flex items-center gap-2">
                                <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors" title="Share">
                                    <Share2 className="w-4 h-4" />
                                </button>
                                <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors" title="Print">
                                    <Printer className="w-4 h-4" />
                                </button>
                                <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors" title="Flag">
                                    <Flag className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default OfficerProfileModal;
