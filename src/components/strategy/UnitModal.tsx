import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Building2, AtSign, MapPin, Users, Network, Shield, TrendingUp, Globe, Rocket, Award, Scale, BookOpen, Briefcase, FileSearch, ShieldAlert, Share2, Printer, Flag, Edit, Save, Ban, Loader2, Plus, Trash2, Fingerprint } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQueryClient } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { UnitService } from '@/services/unitService';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

export interface MockUnitData {
    id: string;
    unitName: string;
    parentDivision: string;
    primaryContact: {
        label: string;
        email: string;
    };
    location: string;
    totalStaff: number;
    manager: {
        quote: string;
        name: string;
    };
    missionStatement: string;
    coreFunctions: Array<{
        name: string;
        description: string;
        icon: 'network' | 'shield' | 'trending' | 'globe' | 'scale' | 'book' | 'briefcase' | 'search' | 'alert' | 'fingerprint';
    }>;
    achievements: Array<{
        title: string;
        date: string;
        description: string;
        icon: 'rocket' | 'award';
    }>;
    statutoryDuties?: string[];
}

const getIcon = (iconName: string) => {
    switch (iconName) {
        case 'network': return <Network className="w-5 h-5 text-gray-500" />;
        case 'shield': return <Shield className="w-5 h-5 text-gray-500" />;
        case 'trending': return <TrendingUp className="w-5 h-5 text-gray-500" />;
        case 'globe': return <Globe className="w-5 h-5 text-gray-500" />;
        case 'scale': return <Scale className="w-5 h-5 text-gray-500" />;
        case 'book': return <BookOpen className="w-5 h-5 text-gray-500" />;
        case 'briefcase': return <Briefcase className="w-5 h-5 text-gray-500" />;
        case 'search': return <FileSearch className="w-5 h-5 text-gray-500" />;
        case 'alert': return <ShieldAlert className="w-5 h-5 text-gray-500" />;
        case 'fingerprint': return <Fingerprint className="w-5 h-5 text-gray-500" />;
        case 'rocket': return <Rocket className="w-4 h-4 text-white" />;
        case 'award': return <Award className="w-4 h-4 text-gray-500" />;
        default: return <Building2 className="w-5 h-5 text-gray-500" />;
    }
};

interface UnitModalProps {
    isOpen: boolean;
    onClose: () => void;
    unit: MockUnitData | null;
}

const UnitModal: React.FC<UnitModalProps> = ({ isOpen, onClose, unit }) => {
    const [activeTab, setActiveTab] = useState('overview');

    // Auth and Data Fetching hooks
    const { isAdmin } = useRoleBasedAuth();
    const { instance: msalInstance } = useMsal();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState<MockUnitData | null>(null);

    const handleEditToggle = () => {
        if (!isEditing && unit) {
            setFormData(JSON.parse(JSON.stringify(unit))); // deep copy
        }
        setIsEditing(!isEditing);
    };

    const handleSave = async () => {
        if (!formData || !unit) return;
        setIsSaving(true);
        try {
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error("No Graph Client");

            const service = new UnitService(graphClient);
            await service.updateUnit(unit.id, {
                location: formData.location,
                missionStatement: formData.missionStatement,
                primaryContact: formData.primaryContact,
                manager: formData.manager,
                statutoryDuties: formData.statutoryDuties,
            });

            toast({
                title: "Success",
                description: "Unit updated successfully",
            });

            queryClient.invalidateQueries({ queryKey: ["strategyUnits"] });
            setIsEditing(false);
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to update unit",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleNestedChange = (field: 'primaryContact' | 'manager', subfield: string, value: string) => {
        setFormData(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                [field]: {
                    ...prev[field],
                    [subfield]: value
                }
            };
        });
    };

    const handleDutyChange = (index: number, value: string) => {
        setFormData(prev => {
            if (!prev) return prev;
            const newArray = [...(prev.statutoryDuties || [])];
            newArray[index] = value;
            return { ...prev, statutoryDuties: newArray };
        });
    };

    const addDuty = () => {
        setFormData(prev => {
            if (!prev) return prev;
            return { ...prev, statutoryDuties: [...(prev.statutoryDuties || []), ""] };
        });
    };

    const removeDuty = (index: number) => {
        setFormData(prev => {
            if (!prev) return prev;
            const newArray = [...(prev.statutoryDuties || [])];
            newArray.splice(index, 1);
            return { ...prev, statutoryDuties: newArray };
        });
    };

    // Derived state for display
    const currentData = isEditing && formData ? formData : unit;

    if (!unit || !currentData) return null;

    return (
        <Transition show={isOpen} as={React.Fragment}>
            <Dialog as="div" className="relative z-50" onClose={() => {
                if (isEditing) setIsEditing(false);
                onClose();
            }}>
                <Transition.Child
                    as={React.Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 md:p-12 overflow-hidden pointer-events-none">
                    <div className="flex w-full h-full justify-center items-center pointer-events-auto">
                        <Transition.Child
                            as={React.Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-xl bg-gray-50 text-left shadow-2xl transition-all w-full max-w-5xl flex flex-col md:flex-row min-h-[500px] h-full max-h-[90vh] p-0">

                                {/* Left Sidebar */}
                                <div className="w-full md:w-80 bg-[#400010] text-white p-8 flex flex-col relative overflow-y-auto flex-shrink-0 custom-scrollbar">
                                    <Building2 className="absolute -bottom-10 -right-10 w-64 h-64 text-white opacity-5 pointer-events-none" />

                                    <div className="mb-8">
                                        <div className="w-16 h-16 bg-white/10 rounded-xl mb-6 flex items-center justify-center backdrop-blur-sm border border-white/20">
                                            <Building2 className="w-8 h-8 text-white" />
                                        </div>
                                        <h2 className="text-3xl font-bold tracking-tight mb-2 leading-tight">
                                            {currentData.unitName}
                                        </h2>
                                        <p className="text-[#FDF5E6] text-sm uppercase tracking-wider font-semibold opacity-90">
                                            {currentData.parentDivision}
                                        </p>
                                    </div>

                                    <div className="space-y-6 mt-4 flex-1">
                                        <div className="flex items-start gap-4">
                                            <AtSign className="w-5 h-5 text-[#FDF5E6] opacity-80 mt-0.5 shrink-0" />
                                            <div className="w-full">
                                                <p className="text-xs uppercase tracking-wider text-[#FDF5E6] opacity-70 font-semibold mb-1">Primary Contact</p>
                                                {isEditing ? (
                                                    <Input
                                                        value={currentData.primaryContact.email}
                                                        onChange={(e) => handleNestedChange('primaryContact', 'email', e.target.value)}
                                                        className="h-8 px-2 text-sm bg-white/10 border-white/20 text-white placeholder-white/50 focus-visible:ring-1 focus-visible:ring-white"
                                                    />
                                                ) : (
                                                    <p className="text-sm font-medium">{currentData.primaryContact.email}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <MapPin className="w-5 h-5 text-[#FDF5E6] opacity-80 mt-0.5 shrink-0" />
                                            <div className="w-full">
                                                <p className="text-xs uppercase tracking-wider text-[#FDF5E6] opacity-70 font-semibold mb-1">Location</p>
                                                {isEditing ? (
                                                    <Input
                                                        value={currentData.location}
                                                        onChange={(e) => setFormData(prev => prev ? { ...prev, location: e.target.value } : prev)}
                                                        className="h-8 px-2 text-sm bg-white/10 border-white/20 text-white placeholder-white/50 focus-visible:ring-1 focus-visible:ring-white"
                                                    />
                                                ) : (
                                                    <p className="text-sm font-medium leading-snug">{currentData.location}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <Users className="w-5 h-5 text-[#FDF5E6] opacity-80 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-xs uppercase tracking-wider text-[#FDF5E6] opacity-70 font-semibold mb-1">Total Staff</p>
                                                <p className="text-sm font-medium">{currentData.totalStaff} Employees</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quote Box */}
                                    <div className="mt-8 bg-black/20 rounded-lg p-5 border border-white/10 relative z-10 backdrop-blur-sm">
                                        {isEditing ? (
                                            <div className="space-y-3">
                                                <div>
                                                    <Label className="text-xs text-white/70">Manager Name</Label>
                                                    <Input
                                                        value={currentData.manager.name}
                                                        onChange={(e) => handleNestedChange('manager', 'name', e.target.value)}
                                                        className="h-8 px-2 text-sm bg-white/10 border-white/20 text-white focus-visible:ring-1 focus-visible:ring-white"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-white/70">Quote</Label>
                                                    <Textarea
                                                        value={currentData.manager.quote}
                                                        onChange={(e) => handleNestedChange('manager', 'quote', e.target.value)}
                                                        className="min-h-[60px] p-2 text-sm bg-white/10 border-white/20 text-white focus-visible:ring-1 focus-visible:ring-white custom-scrollbar"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="text-sm italic text-[#FDF5E6] mb-3 leading-relaxed">
                                                    "{currentData.manager.quote}"
                                                </p>
                                                <p className="text-sm font-bold text-white">
                                                    — {currentData.manager.name}
                                                </p>
                                            </>
                                        )}
                                    </div>

                                    {/* Bottom Info */}
                                    <div className="mt-auto pt-8 flex items-center justify-between text-[#FDF5E6] relative z-10 font-medium">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest opacity-60 mb-1 leading-none">ID Code</p>
                                            <p className="text-sm">UNT-{currentData.id}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Content Area */}
                                <div className="flex-1 flex flex-col relative bg-white min-w-0 overflow-hidden h-full">
                                    <div className="absolute top-4 right-4 z-10">
                                        <button
                                            onClick={() => {
                                                if (isEditing) setIsEditing(false);
                                                onClose();
                                            }}
                                            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors bg-white/80 backdrop-blur-sm shadow-sm"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden min-h-0">
                                        <TabsList className="bg-transparent border-b border-gray-200 rounded-none h-auto p-0 px-4 pt-3 flex-wrap justify-start gap-0">
                                            {[
                                                { value: 'overview', label: 'Overview', icon: Building2 },
                                                { value: 'duty', label: 'Statutory Duty', icon: Scale },
                                            ].map((tab) => (
                                                <TabsTrigger
                                                    key={tab.value}
                                                    value={tab.value}
                                                    className={`
                                                        rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 font-medium text-sm text-gray-500
                                                        hover:text-gray-700 data-[state=active]:border-[#800020] data-[state=active]:text-[#800020]
                                                        data-[state=active]:font-bold transition-all flex items-center gap-2
                                                    `}
                                                >
                                                    <tab.icon className="w-4 h-4" />
                                                    {tab.label}
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>

                                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
                                            {/* Edit mode indicator */}
                                            {isEditing && (
                                                <div className="absolute top-4 right-8 flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-medium border border-amber-200">
                                                    <Edit className="w-3.5 h-3.5" /> Editing Mode
                                                </div>
                                            )}

                                            <TabsContent value="overview" className="m-0 focus-visible:outline-none max-w-3xl">
                                                <div className="mb-8">
                                                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-tight pr-10">{currentData.unitName} Overview</h2>
                                                    <p className="text-[#800020] font-bold text-sm uppercase tracking-wider mt-2">{currentData.parentDivision}</p>
                                                </div>

                                                {/* Mission Statement */}
                                                <div className="mb-10">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-1 h-6 bg-[#800020] rounded-full"></div>
                                                        <h4 className="text-lg font-bold text-gray-900">Mission Statement</h4>
                                                    </div>
                                                    {isEditing ? (
                                                        <Textarea
                                                            value={currentData.missionStatement}
                                                            onChange={(e) => setFormData(prev => prev ? { ...prev, missionStatement: e.target.value } : prev)}
                                                            className="min-h-[100px] text-gray-700 text-sm leading-relaxed"
                                                            placeholder="Enter mission statement..."
                                                        />
                                                    ) : (
                                                        <p className="text-gray-600 leading-relaxed text-sm">
                                                            {currentData.missionStatement}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Core Functions */}
                                                <div className="mb-12">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-1 h-6 bg-[#800020] rounded-full"></div>
                                                        <h4 className="text-lg font-bold text-gray-900">Core Functions</h4>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        {currentData.coreFunctions.map((func, idx) => (
                                                            <div key={idx} className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex items-start gap-4 hover:border-gray-200 transition-colors hover:shadow-sm">
                                                                <div className="bg-white p-2.5 rounded-lg shadow-sm border border-gray-100 shrink-0">
                                                                    {getIcon(func.icon)}
                                                                </div>
                                                                <div>
                                                                    <h5 className="font-semibold text-gray-900 text-sm mb-1">{func.name}</h5>
                                                                    <p className="text-xs text-gray-500 leading-snug">{func.description}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Recent Achievements */}
                                                {currentData.achievements && currentData.achievements.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center gap-3 mb-6">
                                                            <div className="w-1 h-6 bg-[#800020] rounded-full"></div>
                                                            <h4 className="text-lg font-bold text-gray-900">Recent Achievements</h4>
                                                        </div>
                                                        <div className="relative border-l border-gray-200 ml-3 md:ml-6 space-y-8 pb-4">
                                                            {currentData.achievements.map((achievement, idx) => (
                                                                <div key={idx} className="relative pl-8 md:pl-10">
                                                                    <div className={`absolute -left-4 md:-left-5 top-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm ${achievement.icon === 'rocket' ? 'bg-[#800020]' : 'bg-gray-100'}`}>
                                                                        {getIcon(achievement.icon)}
                                                                    </div>
                                                                    <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-shadow">
                                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                                                                            <h5 className="font-bold text-gray-900">{achievement.title}</h5>
                                                                            <span className="text-xs font-bold text-[#800020] bg-red-50 px-2 py-1 rounded-md shrink-0">
                                                                                {achievement.date}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-sm text-gray-600 leading-relaxed">
                                                                            {achievement.description}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </TabsContent>

                                            <TabsContent value="duty" className="m-0 focus-visible:outline-none max-w-3xl">
                                                <div className="mb-8">
                                                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-tight pr-10">Statutory Duties</h2>
                                                    <p className="text-[#800020] font-bold text-sm uppercase tracking-wider mt-2">{currentData.unitName}</p>
                                                </div>

                                                <div className="space-y-6">
                                                    {isEditing ? (
                                                        <div className="space-y-4">
                                                            {(currentData.statutoryDuties || []).map((duty, idx) => (
                                                                <div key={idx} className="flex gap-3 items-start">
                                                                    <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 shrink-0 mt-1">
                                                                        <Scale className="w-4 h-4 text-gray-500" />
                                                                    </div>
                                                                    <Textarea
                                                                        value={duty}
                                                                        onChange={(e) => handleDutyChange(idx, e.target.value)}
                                                                        className="flex-1 min-h-[60px] text-sm"
                                                                        placeholder="Enter duty description..."
                                                                    />
                                                                    <button
                                                                        onClick={() => removeDuty(idx)}
                                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-1 shrink-0"
                                                                        title="Remove duty"
                                                                    >
                                                                        <Trash2 className="w-5 h-5" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            <button
                                                                onClick={addDuty}
                                                                className="flex items-center gap-2 text-sm font-medium text-[#800020] hover:bg-red-50 px-4 py-2 rounded-lg transition-colors border border-dashed border-[#800020]/30 w-full justify-center"
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                                Add Statutory Duty
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        currentData.statutoryDuties && currentData.statutoryDuties.length > 0 ? (
                                                            currentData.statutoryDuties.map((duty, idx) => (
                                                                <div key={idx} className="flex gap-4 items-start bg-gray-50 border border-gray-100 p-5 rounded-xl">
                                                                    <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100 shrink-0 mt-1">
                                                                        <Scale className="w-5 h-5 text-[#800020]" />
                                                                    </div>
                                                                    <p className="text-gray-700 leading-relaxed text-sm">
                                                                        {duty}
                                                                    </p>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                                <Scale className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                                                <h5 className="text-gray-900 font-medium mb-1">No duties specified</h5>
                                                                <p className="text-gray-500 text-sm">Statutory duties for this unit have not been documented yet.</p>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </TabsContent>
                                        </div>

                                        {/* Sticky Footer */}
                                        <div className="border-t border-gray-100 bg-gray-50/80 backdrop-blur-md p-4 px-6 flex items-center justify-between gap-4 mt-auto">
                                            <p className="text-xs text-gray-500">
                                                Last updated: Today at 09:12 AM
                                            </p>
                                            <div className="flex items-center gap-2">
                                                {isAdmin && (
                                                    isEditing ? (
                                                        <>
                                                            <button
                                                                onClick={handleEditToggle}
                                                                disabled={isSaving}
                                                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm text-gray-600 disabled:opacity-50"
                                                            >
                                                                <Ban className="w-4 h-4" />
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={handleSave}
                                                                disabled={isSaving}
                                                                className="flex items-center gap-2 px-4 py-2 bg-[#800020] text-white rounded-lg text-sm font-medium hover:bg-[#600018] transition-colors shadow-sm disabled:opacity-70"
                                                            >
                                                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                                {isSaving ? 'Saving...' : 'Save Changes'}
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={handleEditToggle}
                                                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm text-gray-700"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                            Edit Unit
                                                        </button>
                                                    )
                                                )}

                                                {!isEditing && (
                                                    <>
                                                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                                            <Share2 className="w-4 h-4" />
                                                        </button>
                                                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                                            <Printer className="w-4 h-4" />
                                                        </button>
                                                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                                            <Flag className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </Tabs>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default UnitModal;
