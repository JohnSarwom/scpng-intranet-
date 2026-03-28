import React, { useState, useMemo } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from 'framer-motion';
import {
    Target, Flag, Award, Zap, TrendingUp, Users, Heart, Shield, Lightbulb,
    ChevronRight, ArrowDownRight, Layers, LayoutDashboard, Clock, BarChart2,
    Building2, GraduationCap, Globe, ShieldCheck, Rocket
} from 'lucide-react';
import { StrategicItem, mockStrategyData } from '@/mockData/strategyData';
import { useStrategySharePoint } from '@/hooks/useStrategySharePoint';
import { Loader2, Table as TableIcon, BarChart as BarChartIcon, LayoutDashboard as DashboardIcon, Network, Globe as GlobeIcon } from 'lucide-react';
import DonutChart from '@/components/organization/DonutChart';
import BarChart from '@/components/organization/BarChart';
import { TaskCompletionDonut } from '@/components/dashboard/TaskCompletionDonut';
import OrgChart from '@/components/strategy/OrgChart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StrategySetupWizard from '@/components/strategy/StrategySetupWizard';
import { Settings2, Plus, Pencil } from 'lucide-react';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { useComponentVisibility } from '@/hooks/useComponentVisibility';
import EditStrategicObjectiveModal from '@/components/strategy/EditStrategicObjectiveModal';
import StrategyAnalytics from '@/components/strategy/StrategyAnalytics';
import { useSharePointKRAs, useSharePointKPIs, useSharePointObjectives } from '@/hooks/useSharePointOps'; // Import KRA, KPI and Objectives hooks
import { useDivisions } from '@/hooks/useDivisions';
import { useUnits } from '@/hooks/useUnits';
import { useOfficerProfiles } from '@/hooks/useOfficerProfiles';
import { Objective } from '@/types';
import { calculateGoalProgressFromChildren, calculateStrategicProgress, calculateObjectiveStatus } from '@/utils/kpiUtils'; // Import calculation utility
import { StrategyPageSkeleton } from '@/components/strategy/skeletons/StrategyPageSkeleton';
import { DivisionHierarchySkeleton } from '@/components/strategy/skeletons/DivisionHierarchySkeleton';

// Map icon strings to components
const IconMap: Record<string, React.ComponentType<any>> = {
    Award: Award,
    Lightbulb: Lightbulb,
    Shield: Shield,
    Users: Users,
    Heart: Heart,
    TrendingUp: TrendingUp,
    ShieldCheck: ShieldCheck,
    Building2: Building2,
    GraduationCap: GraduationCap,
    Globe: Globe,
    Target: Target,
    Layers: Layers,
    Zap: Zap,
    Rocket: Rocket
};

const strategicObjectives = [
    {
        id: 1,
        title: "Expand Markets & Connectivity",
        description: "Enhance PNGX infrastructure and market accessibility to increase participant engagement.",
        kras: [
            "PNGX Systems: Implement ongoing Trading, Clearing, and Settlement systems.",
            "Market Clean Up: Acquire PNG Registries Ltd and resolve K35 million in undistributed dividends.",
            "Broker Expansion: Amend Business Rules to increase the number of licensed brokers beyond two."
        ],
        icon: TrendingUp,
        progress: 45
    },
    {
        id: 2,
        title: "Regulatory Framework Reform",
        description: "Modernize the legal environment to ensure fair, efficient, and transparent markets.",
        kras: [
            "Legislative Updates: Pass amendments to the SC Act and Capital Market Act by end of 2026.",
            "Thematic Green Bonds: Finalize Green Bond rules with IFC by April 2026.",
            "New Codes: Implement Unit Trust, Trustee Guidelines, and Fund Management Codes by end of 2025."
        ],
        icon: ShieldCheck,
        progress: 30
    },
    {
        id: 3,
        title: "Administrative Fundamentals",
        description: "Strengthen internal governance and complete the transition to the SCPNG identity.",
        kras: [
            "Board Appointment: Appoint new Board Members by April 2026 following parliamentary name change.",
            "Strategic Planning: Finalize the 'Strategic Plan 2025–2030' with ADB and IFC by September 2025.",
            "Policy Finalization: Complete all internal office policies and procedural guides by May 2025."
        ],
        icon: Building2,
        progress: 60
    },
    {
        id: 4,
        title: "Investor Education",
        description: "Empower the public through the 'Invest Smart PNG' campaign and safety awareness.",
        kras: [
            "Digital Reach: Expand social media reach to 2–3 million followers via awareness series.",
            "Investor Bootcamps: Conduct quarterly weekend workshops for first-time investors with PNGX.",
            "Regional Workshops: Execute roadshows and pop-up events in underrepresented regional centers."
        ],
        icon: GraduationCap,
        progress: 25
    },
    {
        id: 5,
        title: "National & International Cooperation",
        description: "Solidify global standing and domestic partnerships for capacity building.",
        kras: [
            "IOSCO MMOU: Finalize assessment and engagement for the MMOU by end of 2026.",
            "Global Partnerships: Maintain ongoing regulatory assistance MOAs with ADB and IFC.",
            "Inter-Agency MOAs: Finalize data access and SME support agreements with the IPA."
        ],
        icon: Globe,
        progress: 40
    },
];

const divisionAlignment = [
    {
        name: "Legal Services Division (LSD)",
        director: "Director Legal Services",
        objectives: [
            {
                title: "Regulatory Framework Reform",
                kras: [
                    "Pass amendments to the SC Act and Capital Market Act by end of 2026.",
                    "Finalize assessment and engagement for IOSCO MMOU by end of 2026.",
                    "Strengthen legal enforcement & compliance protocols."
                ]
            }
        ],
        icon: ShieldCheck,
        color: "border-l-blue-500"
    },
    {
        name: "Licensing, Investigation & Supervision (LISD)",
        director: "Director LIS",
        objectives: [
            {
                title: "Expand Markets & Connectivity",
                kras: [
                    "Implement ongoing Trading, Clearing, and Settlement systems.",
                    "Acquire PNG Registries Ltd and resolve dividend issues.",
                    "Amend Business Rules for broker expansion."
                ]
            },
            {
                title: "Regulatory Framework Reform",
                kras: [
                    "Implement Unit Trust and Fund Management Codes by end of 2025.",
                    "Digitize licensing functions via Centurion Enterprise System."
                ]
            }
        ],
        icon: Zap,
        color: "border-l-yellow-500"
    },
    {
        name: "Research & Publication (RPD)",
        director: "Director R&P",
        objectives: [
            {
                title: "Investor Education",
                kras: [
                    "Expand social media reach to 2–3 million followers.",
                    "Execute quarterly investor bootcamps and regional roadshows.",
                    "Advance 'Invest Smart PNG' awareness series."
                ]
            }
        ],
        icon: GraduationCap,
        color: "border-l-green-500"
    },
    {
        name: "Corporate Services Division (CSD)",
        director: "Director Corporate Services",
        objectives: [
            {
                title: "Administrative Fundamentals",
                kras: [
                    "Complete all internal office policies and procedural guides by May 2025.",
                    "Support internal governance strengthened through HR/Finance modernization.",
                    "Maintain IT infrastructure for secure and efficient operations."
                ]
            }
        ],
        icon: Building2,
        color: "border-l-orange-500"
    },
    {
        name: "Secretariat & Internal Audit Units",
        director: "General Counsel / Manager Audit",
        objectives: [
            {
                title: "Administrative Fundamentals",
                kras: [
                    "Appoint new Board Members by April 2026.",
                    "Finalize the 'Strategic Plan 2025–2030' with ADB and IFC.",
                    "Establish robust internal audit and risk mitigation frameworks."
                ]
            }
        ],
        icon: Shield,
        color: "border-l-purple-500"
    }
];

const Strategy = () => {
    const { strategyData, isLoading, updateStrategy, isUpdating } = useStrategySharePoint();
    const [isWizardOpen, setIsWizardOpen] = useState(false);

    const { isAdmin } = useRoleBasedAuth();
    const { isComponentVisible } = useComponentVisibility();
    const canSeeReports = isComponentVisible('Strategy', 'Reports Tab');
    const { refreshStrategy } = useStrategySharePoint();

    // Fetch ALL KRAs for dynamic progress calculation
    // We use 'All' scope to get KRAs from all units/divisions
    const { data: allKras } = useSharePointKRAs(undefined, 'All', undefined);

    // Fetch ALL KPIs for dynamic KRA progress calculation
    const { data: allKpis } = useSharePointKPIs(undefined, undefined);

    // Fetch ALL unit-level objectives for the live division hierarchy (admin bypass)
    const { data: allUnitObjectives, loading: isLoadingHierarchy } = useSharePointObjectives(
        undefined,
        'All',
        { division: '', unit: '', email: '', name: '', role: 'super_admin' }
    );

    // Fetch Strategy_Divisions, Strategy_Units, and Officer Profiles for AI Chat context
    const { data: allDivisions = [] } = useDivisions();
    const { data: allUnits = [] } = useUnits();
    const { data: allOfficerProfiles = [] } = useOfficerProfiles();

    // Build dynamic Division → Unit → Key Deliverable → Objectives hierarchy from live objectives data
    // IMPORTANT: This useMemo MUST be before any early returns to satisfy Rules of Hooks
    // Scaffold for known Org Structure to ensure hierarchy always renders
    // Default structure as fallback if SharePoint list is empty or hasn't been set up
    const DEFAULT_ORG_STRUCTURE: Record<string, string[]> = {
        'Office of the Chairman': ['Executive Division', 'Secretariat Unit'],
        'Corporate Services Division': ['Finance Unit', 'IT Unit', 'Human Resource Unit'],
        'Licensing, Market & Supervision Division': ['Licensing Unit', 'Supervision Unit', 'Market Data Unit', 'Investigations Unit'],
        'Legal Services Division': ['Legal Advisory Unit'],
        'Research & Publication Division': ['Research Unit', 'Publication Unit']
    };

    // Build dynamic Division → Unit → Key Deliverable → Objectives hierarchy from live objectives data
    // IMPORTANT: This useMemo MUST be before any early returns to satisfy Rules of Hooks
    const divisionHierarchy = useMemo(() => {
        // Use structure from SharePoint if available, else use default
        const currentStructure = (strategyData as any)?.hierarchy && Object.keys((strategyData as any).hierarchy).length > 0
            ? (strategyData as any).hierarchy
            : DEFAULT_ORG_STRUCTURE;

        console.log('🏗️ [Strategy Hierarchy] Using structure:', Object.keys(currentStructure).length > 0 ? 'Dynamic (SharePoint)' : 'Default (Hard-coded)');

        // Initialize hierarchy with structure
        const hierarchy: Record<string, Record<string, Record<string, Objective[]>>> = {};

        // 1. Pre-seed with divisions and units
        Object.keys(currentStructure).forEach(div => {
            hierarchy[div] = {};
            currentStructure[div].forEach((unit: string) => {
                hierarchy[div][unit] = {};
            });
        });

        // 2. Populate with objectives
        const unitObjs = (allUnitObjectives || []).filter((obj: Objective) => {
            const type = (obj.goalType || '').toLowerCase();
            return type !== 'org' && type !== 'strategic' && type !== 'board';
        });

        console.log(`📊 [Strategy Hierarchy] Processing ${unitObjs.length} unit objectives`);

        unitObjs.forEach((obj: Objective) => {
            // Normalize inputs
            let div = (obj.division || '').trim();
            let unit = (obj.unit || '').trim();
            const deliverable = (obj.linkedDeliverable || '').trim() || 'General';

            // Remap legacy 'Executive Division' and 'Secretariat Unit' to 'Office of the Chairman' hierarchy
            if (div === 'Executive Division') {
                div = 'Office of the Chairman';
                // If unit is 'Secretariat Unit', keep it (it's now a sibling unit under Chairman)
                // If unit is empty/General, map it to 'Executive Division' unit
                if (!unit || unit === 'General') {
                    unit = 'Executive Division';
                }
            } else if (div === 'Secretariat Unit') {
                div = 'Office of the Chairman';
                unit = 'Secretariat Unit';
            }


            // Fuzzy matching / Fallback logic
            if (!div) {
                // Try to find if unit exists in known structure to infer division
                if (unit) {
                    const foundDiv = Object.keys(currentStructure).find(d =>
                        currentStructure[d].some((u: string) => u.toLowerCase() === unit.toLowerCase())
                    );
                    if (foundDiv) div = foundDiv;
                }
            }

            // Default to 'General' if still unknown
            if (!div) div = 'General';
            if (!unit) unit = 'General';

            // Ensure path exists (in case of new/unknown divisions coming from data)
            if (!hierarchy[div]) hierarchy[div] = {};
            if (!hierarchy[div][unit]) hierarchy[div][unit] = {};
            if (!hierarchy[div][unit][deliverable]) hierarchy[div][unit][deliverable] = [];

            // DYNAMIC CALCULATION: Override stored progress and status with live KPI data
            const linkedKras = (allKras || []).filter(k =>
                String(k.objective_id) === String(obj.id) ||
                String(k.objectiveId) === String(obj.id)
            );

            const dynamicProgress = calculateStrategicProgress(linkedKras, allKpis || []);
            const dynamicStatus = calculateObjectiveStatus(obj, linkedKras);

            // Add objective to hierarchy with dynamic values
            hierarchy[div][unit][deliverable].push({
                ...obj,
                progress: dynamicProgress,
                status: dynamicStatus
            });
        });

        // 3. (Optional) Prune completely empty divisions if desired, 
        // but for now we keep them to show the structure as requested

        console.log('📊 [Strategy Hierarchy] Built hierarchy keys:', Object.keys(hierarchy));
        return hierarchy;
    }, [allUnitObjectives]);

    // Dynamic state for local overrides (after wizard saves)
    const [localMission, setLocalMission] = useState<string | null>(null);
    const [localVision, setLocalVision] = useState<string | null>(null);
    const [localPillars, setLocalPillars] = useState<any[] | null>(null);
    const [localAlignments, setLocalAlignments] = useState<any[] | null>(null);
    const [localOrganizationValues, setLocalOrganizationValues] = useState<any[] | null>(null);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedObjective, setSelectedObjective] = useState<any>(null);

    const handleWizardSave = async (data: any) => {
        try {
            await updateStrategy(data);
            setLocalMission(data.mission);
            setLocalVision(data.vision);
            setLocalPillars(data.pillars);
            setLocalAlignments(data.alignments);
            setLocalOrganizationValues(data.organizationValues);
            setIsWizardOpen(false);
        } catch (error) {
            console.error('❌ [Strategy] Save failed:', error);
            // Error is already handled by toast in useStrategySharePoint
        }
    };

    if (isLoading) {
        return <StrategyPageSkeleton />;
    }

    const { organization, pillars, objectives, alignments, milestones, risks } = strategyData || {
        organization: mockStrategyData.organization,
        pillars: [],
        objectives: strategicObjectives,
        alignments: divisionAlignment,
        milestones: [],
        risks: []
    };

    const effectiveMission = localMission || (organization.mission.includes("efficient and transparent") ? "To promote and maintain a secure capital market that is fair for and accessible to all stakeholders while supporting capital formation through innovative market development." : organization.mission);
    const effectiveVision = localVision || (organization.vision.includes("leading public service") ? "To ensure Port Moresby becomes the Financial Capital of the Blue Pacific by 2040." : organization.vision);

    // Pillars (The 4 core commitents)
    const effectivePillars = localPillars || (pillars.length > 0 ? pillars : [
        { name: "Protect", description: "Safeguarding investors from scams and market manipulation.", icon: "Shield" },
        { name: "Develop", description: "Encouraging new capital formation and innovative market products.", icon: "TrendingUp" },
        { name: "Regulate", description: "Ensuring all market participants follow the rule of law.", icon: "Award" },
        { name: "Mitigate", description: "Reducing systemic risks within the PNG financial landscape.", icon: "Zap" },
    ]);

    // Strategic Objectives (The implementation cards)
    // DYNAMIC CALCULATION: Override stored progress with aggregated KRA progress
    const baseObjectives = objectives && objectives.length > 0 ? objectives : strategicObjectives;

    const effectiveObjectives = baseObjectives.map((obj: any) => {
        // Calculate progress directly from child unit-level objectives
        const childProgress = calculateGoalProgressFromChildren(obj.id, allUnitObjectives || [], allKras || [], allKpis || []);

        if (childProgress > 0) {
            return { ...obj, progress: childProgress };
        }

        // Fallback to stored/manual progress
        return obj;
    });

    // Overall progress across all strategic objectives
    const totalProgress = effectiveObjectives.reduce((acc: number, obj: any) => acc + (obj.progress || 0), 0);
    const averageProgress = effectiveObjectives.length > 0 ? Math.round(totalProgress / effectiveObjectives.length) : 0;

    // Divisional Alignments (The cascade)
    const effectiveAlignments = alignments && alignments.length > 0 ? alignments : divisionAlignment;

    // Lookup helper: match a division name from objectives to static metadata (icon, director)
    const getDivisionMeta = (divName: string) => {
        const dynamicDetails = (strategyData as any)?.hierarchyDetails || [];

        // Find best match for Division Head based on role hierarchy
        const divStaff = dynamicDetails.filter((d: any) => d.division.toLowerCase() === divName.toLowerCase());

        let headName = '';
        let description = '';

        if (divStaff.length > 0) {
            let bestMatch = null;
            if (divName.toLowerCase().includes('chairman')) {
                bestMatch = divStaff.find((d: any) => d.role?.toLowerCase().includes('ceo') || d.role?.toLowerCase().includes('chairman'));
            } else {
                bestMatch = divStaff.find((d: any) => d.role?.toLowerCase().includes('director'));
                if (!bestMatch) {
                    bestMatch = divStaff.find((d: any) => d.role?.toLowerCase().includes('oic') || d.role?.toLowerCase().includes('officer in charge'));
                }
                if (!bestMatch) {
                    bestMatch = divStaff.find((d: any) => d.role?.toLowerCase().includes('manager'));
                }
            }
            // Fallback to first
            if (!bestMatch) bestMatch = divStaff[0];

            headName = bestMatch.head;
            // Use the division description if available, otherwise just use whatever best match had
            description = bestMatch.description;
        }

        const patterns: Array<{ key: string; director: string; icon: React.ComponentType<any> }> = [
            { key: 'Chairman', director: 'Chairman', icon: Award },
            { key: 'Executive', director: 'Executive Director', icon: Target },
            { key: 'Legal Services', director: 'Director Legal Services', icon: ShieldCheck },
            { key: 'Licensing', director: 'Director LMS', icon: Zap },
            { key: 'Research', director: 'Director R&P', icon: GraduationCap },
            { key: 'Corporate Services', director: 'Director Corporate Services', icon: Building2 },
            { key: 'Secretariat', director: 'General Counsel / Manager Audit', icon: Shield },
        ];
        const lower = divName.toLowerCase();
        const match = patterns.find(p => lower.includes(p.key.toLowerCase()));

        return {
            director: headName || match?.director || 'Division Director',
            icon: match?.icon || LayoutDashboard,
            description: description || ''
        };
    };

    // Lookup helper: match a unit expected head based on role hierarchy
    const getUnitHead = (divName: string, uName: string) => {
        const unitStaff = ((strategyData as any)?.hierarchyDetails || []).filter((d: any) =>
            d.division.toLowerCase() === divName.toLowerCase() &&
            d.unit.toLowerCase() === uName.toLowerCase()
        );
        if (unitStaff.length === 0) return null;

        let match = unitStaff.find((d: any) => d.role?.toLowerCase().includes('manager'));
        if (!match) match = unitStaff.find((d: any) => d.role?.toLowerCase().includes('senior'));
        if (!match) match = unitStaff[0];

        return match.head;
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    return (
        <PageLayout>
            <div className="space-y-8 pb-10">

                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#400010] to-[#800020] text-white shadow-xl p-8 md:p-12 mb-8"
                >
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-4">
                            <Badge variant="outline" className="bg-white/10 text-white border-white/20 backdrop-blur-md px-4 py-1 text-[10px] font-bold tracking-[0.2em] uppercase">
                                <Settings2 className="w-3 h-3 mr-2 inline-block text-intranet-primary-light" />
                                Enterprise Strategy Engine
                            </Badge>
                            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-none">
                                SCPNG Strategy Hub
                            </h1>
                            <p className="text-intranet-primary-light/80 text-lg md:text-xl font-medium max-w-2xl leading-relaxed italic">
                                Our strategic direction, performance metrics and corporate structure — all in one place.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            <div className="hidden md:block p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                                <Target className="w-12 h-12 text-white/90" />
                            </div>
                            {isAdmin && (
                                <Button
                                    onClick={() => setIsWizardOpen(true)}
                                    className="bg-white text-intranet-primary hover:bg-white/90 font-black text-xs uppercase tracking-widest px-6 py-8 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 group h-auto"
                                >
                                    <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
                                    Setup Strategy
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Decorative background elements */}
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-black/20 rounded-full blur-2xl" />
                </motion.div>

                {/* Mission & Vision Section */}
                {/* Content is now organized in Tabs below */}

                {/* Core Values Section (Removed from top, moved into Strategy Tab) */}

                {/* Tabs Section */}
                <Tabs defaultValue="strategy" className="w-full space-y-6">
                    <TabsList className={`bg-card dark:bg-gray-800/50 border dark:border-white/10 shadow-sm p-1 h-auto grid gap-2 grid-cols-2 ${canSeeReports ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                        <TabsTrigger value="strategy" className="py-2.5 px-4 data-[state=active]:bg-intranet-primary data-[state=active]:text-white">
                            <DashboardIcon className="w-4 h-4 mr-2" /> Strategy
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="py-2.5 px-4 data-[state=active]:bg-intranet-primary data-[state=active]:text-white">
                            <BarChartIcon className="w-4 h-4 mr-2" /> Analytics
                        </TabsTrigger>
                        {canSeeReports && (
                            <TabsTrigger value="reports" className="py-2.5 px-4 data-[state=active]:bg-intranet-primary data-[state=active]:text-white">
                                <TableIcon className="w-4 h-4 mr-2" /> Reports
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="org" className="py-2.5 px-4 data-[state=active]:bg-intranet-primary data-[state=active]:text-white">
                            <Network className="w-4 h-4 mr-2" /> Org Structure
                        </TabsTrigger>
                    </TabsList>


                    <TabsContent value="strategy" className="space-y-10 mt-0 outline-none">
                        {/* 1. Mission & Vision (Provided Content) */}
                        <div className="grid grid-cols-1 gap-6">
                            <Card className="relative overflow-hidden border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-white/10">
                                <div className="absolute inset-0 z-0">
                                    <img
                                        src="/images/Vision.jpg"
                                        alt="Vision Background"
                                        className="w-full h-full object-cover object-right opacity-20 md:opacity-100"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-transparent dark:from-gray-800 dark:via-gray-800/90" />
                                </div>
                                <CardHeader className="relative z-10">
                                    <CardTitle className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-lg">
                                        <Target className="w-5 h-5" /> Vision
                                    </CardTitle>
                                </CardHeader>

                                <CardContent className="relative z-10 max-w-2xl">
                                    <p className="text-base font-medium leading-relaxed italic text-gray-700 dark:text-gray-300">
                                        "{effectiveVision}"
                                    </p>
                                    <div className="mt-4 border-t pt-4 border-gray-100 dark:border-gray-800">
                                        <p className="text-xs text-muted-foreground leading-relaxed italic">
                                            This vision reflects a strategic goal for PNG to be a regional capital-raising hub and key player in Pacific capital markets.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="relative overflow-hidden border-l-4 border-l-intranet-primary shadow-sm hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-white/10">
                                <div className="absolute inset-0 z-0">
                                    <img
                                        src="/images/Mission.jpg"
                                        alt="Mission Background"
                                        className="w-full h-full object-cover object-right opacity-20 md:opacity-100"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-transparent dark:from-gray-800 dark:via-gray-800/90" />
                                </div>
                                <CardHeader className="relative z-10">
                                    <CardTitle className="flex items-center gap-2 text-intranet-primary dark:text-intranet-primary-light text-lg">
                                        <Flag className="w-5 h-5" /> Mission
                                    </CardTitle>
                                </CardHeader>

                                <CardContent className="relative z-10 max-w-2xl">
                                    <p className="text-base font-medium leading-relaxed italic text-gray-700 dark:text-gray-300">
                                        "{effectiveMission}"
                                    </p>
                                    <div className="mt-4 space-y-2 border-t pt-4 border-gray-100 dark:border-gray-800">
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Commission Goals:</p>
                                        <ul className="space-y-2">
                                            {[
                                                "Providing a high-quality and competitive market infrastructure for issuers and investors.",
                                                "Supporting innovation and new financial products.",
                                                "Enabling opportunities that make the PNG capital market a premier choice for investors and issuers in PNG and the Pacific."
                                            ].map((point, i) => (
                                                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground italic">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-intranet-primary mt-1 flex-shrink-0" />
                                                    {point}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* 2. Guiding Principles (Provided Content) */}
                        <div className="space-y-6">
                            <div className="text-center md:text-left">
                                <h2 className="text-xl font-semibold px-1 flex items-center justify-center md:justify-start gap-2">
                                    <Award className="w-5 h-5 text-gray-500" />
                                    Core Functions
                                </h2>
                                <p className="text-sm text-muted-foreground mt-1 px-1">
                                    Embedding our mandate and operational focus into core business functions.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {effectivePillars.map((value: any, index: number) => {
                                    const Icon = IconMap[value.icon || value.IconName] || Award;
                                    return (
                                        <motion.div key={index} variants={itemVariants} whileHover={{ scale: 1.02 }} className="cursor-default">
                                            <Card className="h-full bg-card/80 backdrop-blur border-b-4 border-b-intranet-primary/20 hover:border-intranet-primary transition-all duration-300 dark:bg-gray-800/80 dark:border-white/10 dark:hover:border-intranet-primary">
                                                <CardContent className="pt-6 pb-4 flex flex-col items-center gap-3 text-center">
                                                    <div className="p-3 rounded-full bg-intranet-primary/10 text-intranet-primary dark:text-intranet-primary-light">
                                                        <Icon className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-xs uppercase tracking-widest text-intranet-primary dark:text-intranet-primary-light">{value.name || value.title}</h3>
                                                        <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed italic">"{value.description}"</p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    );

                                })}
                            </div>

                            <p className="p-4 rounded-xl bg-intranet-primary/5 text-xs italic leading-relaxed text-muted-foreground border border-dashed border-intranet-primary/20 text-center">
                                These four pillars represent SCPNG’s core commitment to investor protection, market development, rule of law, and risk mitigation.
                            </p>
                        </div>

                        {/* 3. Strategic Goals (Provided Content) */}
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold px-1 flex items-center gap-2">
                                <Zap className="w-5 h-5 text-yellow-500" />
                                Strategic Goals
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {effectiveObjectives.filter((o: any) => !o.isFeatured).map((objective: any, index: number) => {
                                    const Icon = IconMap[objective.icon] || (typeof objective.icon === 'string' ? Target : objective.icon);
                                    return (
                                        <Card key={objective.id} className="relative group overflow-hidden hover:shadow-lg transition-all duration-300 border-t-4 border-t-intranet-primary hover:border-red-500 dark:bg-gray-800 dark:border-white/10 dark:hover:border-red-500">
                                            {/* Edit Button - Admin Only */}
                                            {isAdmin && (
                                                <div className="absolute top-2 right-2 z-10">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setSelectedObjective(objective);
                                                            setIsEditModalOpen(true);
                                                        }}
                                                        className="p-1.5 rounded-md bg-white border border-gray-200 hover:bg-intranet-primary hover:text-white hover:border-intranet-primary transition-all opacity-0 group-hover:opacity-100 dark:bg-gray-900 dark:border-white/10"
                                                        title="Edit objective"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                            <CardContent className="p-5">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="p-2.5 rounded-xl bg-intranet-primary/10 text-intranet-primary dark:text-intranet-primary-light">
                                                        <Icon className="h-6 w-6" />
                                                    </div>
                                                    <Badge variant="outline" className="text-xs font-bold border-intranet-primary/20 text-intranet-primary bg-intranet-primary/10 dark:text-intranet-primary-light dark:border-intranet-primary/30 px-2 py-0.5">
                                                        {objective.progress}%
                                                    </Badge>
                                                </div>


                                                <h3 className="font-bold text-sm md:text-base leading-tight mb-2">{objective.title}</h3>
                                                <p className="text-xs text-muted-foreground leading-relaxed mb-4 line-clamp-2">{objective.description}</p>

                                                <div className="space-y-3">
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-gray-500">
                                                            <span>Progress</span>
                                                            <Clock className="h-3 w-3" />
                                                        </div>
                                                        <Progress value={objective.progress} className="h-1.5" indicatorClassName="bg-[#c4506a]" />
                                                    </div>

                                                    <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                                                        <div className="font-bold text-[10px] mb-2 uppercase tracking-widest text-intranet-primary">Key Result Areas (KRAs):</div>
                                                        <ul className="space-y-2">
                                                            {(objective.kras || []).map((kra: string, idx: number) => (
                                                                <li key={idx} className="flex items-start gap-2 text-[10px] leading-relaxed text-gray-600 dark:text-gray-400">
                                                                    <ChevronRight className="h-3 w-3 mt-0.5 text-intranet-primary flex-shrink-0" />
                                                                    <span>{kra}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}

                                {/* Project Execution (Special Highlight Card) */}
                                {effectiveObjectives.filter((o: any) => o.isFeatured).map((objective: any) => {
                                    const Icon = IconMap[objective.icon] || Rocket;
                                    return (
                                        <Card key={`featured-${objective.id}`} className="overflow-hidden hover:shadow-lg transition-all duration-300 border-2 border-dashed border-intranet-primary/30 bg-intranet-primary/5 md:col-span-1 lg:col-span-1 dark:bg-intranet-primary/10 dark:border-intranet-primary/40">
                                            <CardContent className="p-5 h-full flex flex-col">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="p-2.5 rounded-xl bg-intranet-primary text-white shadow-md">
                                                        <Icon className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-extrabold text-sm uppercase tracking-tight text-intranet-primary dark:text-intranet-primary-light">{objective.title}</h3>
                                                        <p className="text-[10px] text-muted-foreground font-medium italic">Featured Project</p>
                                                    </div>
                                                </div>


                                                <div className="flex-1 space-y-4">
                                                    <div className="bg-white/80 dark:bg-gray-800/80 p-3 rounded-lg border border-intranet-primary/10">
                                                        <h4 className="font-bold text-xs text-gray-800 dark:text-gray-100 mb-1">{objective.title}</h4>
                                                        <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                                                            "{objective.description}"
                                                        </p>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="font-bold text-[10px] uppercase tracking-widest text-intranet-primary flex items-center gap-1">
                                                            <Target className="w-3 h-3" /> Targets & Milestones:
                                                        </div>
                                                        <ul className="space-y-2">
                                                            {(objective.kras || []).map((target: string, idx: number) => (
                                                                <li key={idx} className="flex items-start gap-2 text-[10px] font-medium text-gray-700 dark:text-gray-300">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-intranet-primary mt-1 flex-shrink-0" />
                                                                    {target}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>

                                                <div className="mt-4 pt-3 border-t border-intranet-primary/10 flex justify-between items-center">
                                                    <Badge variant="secondary" className="bg-intranet-primary/10 text-intranet-primary text-[9px]">Roadmap {new Date().getFullYear() + 1}</Badge>
                                                    <div className="flex -space-x-2">
                                                        {[1, 2, 3].map(i => (
                                                            <div key={i} className="w-5 h-5 rounded-full border-2 border-white dark:border-gray-900 bg-gray-200" />
                                                        ))}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 4. Cascading Strategic Goals into KRAs (Simplified Accordion Section) */}
                        <div className="space-y-8 pt-4">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-6">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-intranet-primary mb-1">
                                        <div className="p-1 rounded bg-intranet-primary/10">
                                            <Network className="w-4 h-4" />
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-widest opacity-70">Operational Execution</span>
                                    </div>
                                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                                        Cascading Strategic Goals into KRAs
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        Strategic goals cascaded into divisional Key Result Areas (KRAs).
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isAdmin && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const rawData = {
                                                    divisionHierarchy: divisionHierarchy,
                                                    effectiveAlignments: effectiveAlignments,
                                                    strategyData: strategyData
                                                };
                                                navigator.clipboard.writeText(JSON.stringify(rawData, null, 2));
                                                toast({
                                                    title: "Data Copied",
                                                    description: "Raw SharePoint list data for Cascading Strategic Goals into KRAs copied to clipboard.",
                                                });
                                            }}
                                            className="text-xs h-8 border-intranet-primary/20 hover:bg-intranet-primary/5 text-intranet-primary"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                            Copy Raw Data
                                        </Button>
                                    )}
                                    <Badge variant="secondary" className="font-bold py-1 px-4">2025/26 Cycle</Badge>
                                </div>
                            </div>

                            {/* Loading state */}
                            {isLoadingHierarchy && (
                                <DivisionHierarchySkeleton />
                            )}

                            {/* Dynamic hierarchy: Division → Unit → Key Deliverable → Objectives */}
                            {!isLoadingHierarchy && divisionHierarchy && (
                                <Accordion type="single" collapsible className="w-full space-y-4">
                                    {Object.entries(divisionHierarchy).map(([divisionName, units], divIdx) => {
                                        const meta = getDivisionMeta(divisionName);
                                        const DivIcon = meta.icon;
                                        const allDivObjectives = Object.values(units).flatMap(d => Object.values(d).flat());
                                        const totalObjectives = allDivObjectives.length;

                                        // Calculate Division Progress with status fallback
                                        const divTotalProgress = allDivObjectives.reduce((sum, obj) => {
                                            let p = obj.progress || 0;
                                            if (p === 0 && (obj.status === 'Completed' || obj.status === 'Achieved')) {
                                                p = 100;
                                            }
                                            return sum + p;
                                        }, 0);
                                        const divAvgProgress = totalObjectives > 0 ? Math.round(divTotalProgress / totalObjectives) : 0;

                                        return (
                                            <AccordionItem
                                                key={divisionName}
                                                value={`div-${divIdx}`}
                                                className="border rounded-2xl bg-white dark:bg-gray-800/50 dark:border-white/10 overflow-hidden shadow-sm hover:shadow-md transition-shadow px-0"
                                            >

                                                <AccordionTrigger className="hover:no-underline px-6 py-5 group">
                                                    <div className="w-full flex items-center gap-4 text-left">
                                                        <div className="p-3 rounded-xl bg-intranet-primary/10 text-intranet-primary transition-colors">
                                                            <DivIcon className="w-6 h-6" />
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <div className="font-bold text-base text-gray-900 dark:text-gray-100">{divisionName}</div>
                                                            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{meta.director}</div>
                                                        </div>
                                                        <Badge variant="outline" className="mr-8 text-[10px] ml-4 bg-intranet-primary/10 text-intranet-primary border-intranet-primary/20">
                                                            {Object.keys(units).length} unit{Object.keys(units).length !== 1 ? 's' : ''} · {totalObjectives} objective{totalObjectives !== 1 ? 's' : ''}
                                                        </Badge>

                                                        <div className="flex-1 max-w-[300px] ml-auto mr-4 hidden sm:flex items-center gap-2">
                                                            <Progress value={divAvgProgress} className="h-4 w-full border border-gray-100" indicatorClassName="bg-[#c4506a]" />
                                                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-9 text-right">{divAvgProgress}%</span>
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>

                                                <AccordionContent className="px-6 pb-6 pt-2">
                                                    {meta.description && (
                                                        <div className="mb-6 p-4 rounded-xl bg-intranet-primary/5 border border-dashed border-intranet-primary/20 text-sm italic text-muted-foreground leading-relaxed">
                                                            {meta.description}
                                                        </div>
                                                    )}
                                                    <div className="border-t border-gray-50 dark:border-gray-800 mt-2 pt-5 space-y-3">
                                                        {/* Units */}
                                                        <Accordion type="single" collapsible className="w-full space-y-3">
                                                            {Object.entries(units).map(([unitName, deliverables], unitIdx) => {
                                                                const allUnitObjectives = Object.values(deliverables).flat();
                                                                const unitObjCount = allUnitObjectives.length;

                                                                // Calculate Unit Progress dynamically from children
                                                                const unitTotalProgress = allUnitObjectives.reduce((sum, obj) => sum + (obj.progress || 0), 0);
                                                                const unitAvgProgress = unitObjCount > 0 ? Math.round(unitTotalProgress / unitObjCount) : 0;

                                                                return (
                                                                    <AccordionItem
                                                                        key={unitName}
                                                                        value={`unit-${unitIdx}`}
                                                                        className="border rounded-xl bg-gray-50/60 dark:bg-gray-800/30 dark:border-white/10 overflow-hidden px-0"
                                                                    >

                                                                        <AccordionTrigger className="hover:no-underline px-4 py-3 group">
                                                                            <div className="flex items-center gap-3 text-left w-full">
                                                                                <div className="p-2 rounded-lg bg-intranet-primary/8 text-intranet-primary flex-shrink-0">
                                                                                    <Users className="w-4 h-4" />
                                                                                </div>
                                                                                <div className="flex flex-col text-left">
                                                                                    <span className="font-semibold text-sm text-gray-800 dark:text-gray-200 min-w-[150px]">{unitName}</span>
                                                                                    {(() => {
                                                                                        const unitHead = getUnitHead(divisionName, unitName);
                                                                                        return unitHead && unitHead !== meta.director ? (
                                                                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{unitHead}</span>
                                                                                        ) : null;
                                                                                    })()}
                                                                                </div>

                                                                                <Badge variant="outline" className="text-[9px] border-intranet-primary/20 text-intranet-primary bg-intranet-primary/10 ml-2 flex-shrink-0">
                                                                                    {unitObjCount} objective{unitObjCount !== 1 ? 's' : ''}
                                                                                </Badge>

                                                                                {/* Unit Progress Bar */}
                                                                                {unitObjCount > 0 && (
                                                                                    <div className="flex-1 max-w-[200px] ml-auto mr-4 hidden sm:flex items-center gap-2">
                                                                                        <Progress value={unitAvgProgress} className="h-3.5 border border-gray-100" indicatorClassName="bg-[#c4506a]" />
                                                                                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 w-8 text-right">{unitAvgProgress}%</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </AccordionTrigger>

                                                                        <AccordionContent className="px-4 pb-4 pt-1">
                                                                            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-5">
                                                                                {/* Group objectives by Strategic Objective → Key Deliverable → Objectives */}
                                                                                {(() => {
                                                                                    // Flatten all objectives in this unit
                                                                                    const allObjs = Object.entries(deliverables).flatMap(([del, objs]) =>
                                                                                        objs.map(obj => ({ ...obj, _deliverable: del }))
                                                                                    );

                                                                                    // Group by parentGoalId (strategic objective)
                                                                                    const stratGroups: Record<string, { title: string; objectives: (Objective & { _deliverable: string })[] }> = {};
                                                                                    allObjs.forEach(obj => {
                                                                                        const parentId = obj.parentGoalId ? String(obj.parentGoalId) : 'unlinked';
                                                                                        if (!stratGroups[parentId]) {
                                                                                            // Look up strategic objective title
                                                                                            const stratObj = effectiveObjectives.find((so: any) => String(so.id) === parentId);
                                                                                            stratGroups[parentId] = {
                                                                                                title: stratObj?.title || obj.parentGoalTitle || 'Unlinked Objectives',
                                                                                                objectives: []
                                                                                            };
                                                                                        }
                                                                                        stratGroups[parentId].objectives.push(obj);
                                                                                    });

                                                                                    // Sort: linked strategic objectives first, unlinked last
                                                                                    const sortedEntries = Object.entries(stratGroups).sort(([a], [b]) => {
                                                                                        if (a === 'unlinked') return 1;
                                                                                        if (b === 'unlinked') return -1;
                                                                                        return 0;
                                                                                    });

                                                                                    return sortedEntries.map(([stratId, group]) => {
                                                                                        // Sub-group by deliverable within this strategic objective
                                                                                        const deliverableGroups: Record<string, (Objective & { _deliverable: string })[]> = {};
                                                                                        group.objectives.forEach(obj => {
                                                                                            const del = obj._deliverable || 'General';
                                                                                            if (!deliverableGroups[del]) deliverableGroups[del] = [];
                                                                                            deliverableGroups[del].push(obj);
                                                                                        });

                                                                                        // Calculate progress for this strategic group dynamically
                                                                                        const groupProgress = group.objectives.length > 0
                                                                                            ? Math.round(group.objectives.reduce((sum, obj) => sum + (obj.progress || 0), 0) / group.objectives.length)
                                                                                            : 0;

                                                                                        const stratObj = effectiveObjectives.find((so: any) => String(so.id) === stratId);
                                                                                        const StratIcon = stratObj?.icon ? (IconMap[stratObj.icon] || (typeof stratObj.icon === 'function' ? stratObj.icon : Layers)) : Layers;

                                                                                        return (
                                                                                            <Accordion type="single" collapsible key={stratId} className="space-y-3 w-full">
                                                                                                <AccordionItem value={`strat-${stratId}`} className="border-none w-full">
                                                                                                    {/* Strategic Objective Header */}
                                                                                                    <AccordionTrigger className="hover:no-underline py-0 w-full group">
                                                                                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-intranet-primary/8 to-transparent border border-intranet-primary/15 dark:from-intranet-primary/20 dark:border-white/10 w-full">
                                                                                                            <div className="p-2 rounded-lg bg-intranet-primary/15 text-intranet-primary flex-shrink-0">
                                                                                                                <StratIcon className="w-4 h-4" />
                                                                                                            </div>
                                                                                                            <div className="flex-1 min-w-0 text-left">
                                                                                                                <div className="flex items-center gap-2">
                                                                                                                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-intranet-primary/70">
                                                                                                                        {stratId === 'unlinked' ? 'Unlinked' : 'Strategic Objective'}
                                                                                                                    </span>
                                                                                                                </div>
                                                                                                                <p className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-snug mt-0.5">{group.title}</p>
                                                                                                            </div>
                                                                                                            <div className="flex items-center gap-2 flex-shrink-0 pr-2">
                                                                                                                <div className="w-16 hidden sm:block">
                                                                                                                    <Progress value={groupProgress} className="h-2 border border-gray-100" indicatorClassName="bg-[#c4506a]" />
                                                                                                                </div>
                                                                                                                <span className="text-[10px] font-bold text-intranet-primary">{groupProgress}%</span>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </AccordionTrigger>

                                                                                                    <AccordionContent className="pt-2">
                                                                                                        {/* Key Deliverables under this Strategic Objective */}
                                                                                                        <div className="pl-4 space-y-3 border-l-2 border-intranet-primary/15 ml-5 mt-3">
                                                                                                            {Object.entries(deliverableGroups).map(([deliverable, objs], dIdx) => (
                                                                                                                <Accordion type="single" collapsible key={dIdx} className="space-y-2 w-full">
                                                                                                                    <AccordionItem value={`del-${dIdx}`} className="border-none w-full">
                                                                                                                        {/* Key Deliverable header */}
                                                                                                                        <div className="flex items-center gap-2 mb-1">
                                                                                                                            <div className="h-3 w-0.5 bg-intranet-primary rounded-full flex-shrink-0"></div>
                                                                                                                            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-intranet-primary/60">Key Deliverable</span>
                                                                                                                        </div>
                                                                                                                        <AccordionTrigger className="hover:no-underline py-0 w-full group">
                                                                                                                            <div className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-white/10 shadow-sm w-full text-left">
                                                                                                                                <Target className="w-4 h-4 text-intranet-primary flex-shrink-0 mt-0.5" />
                                                                                                                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 leading-snug flex-1">{deliverable}</p>
                                                                                                                            </div>
                                                                                                                        </AccordionTrigger>

                                                                                                                        <AccordionContent className="pt-2">
                                                                                                                            {/* Objectives under this deliverable */}
                                                                                                                            <div className="pl-3 space-y-2">
                                                                                                                                {objs.map((obj) => {
                                                                                                                                    const statusLower = (obj.status || '').toLowerCase();
                                                                                                                                    const badgeClass =
                                                                                                                                        statusLower === 'completed' ? 'bg-green-100 text-green-700 border-green-200' :
                                                                                                                                            statusLower === 'in progress' || statusLower === 'in-progress' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                                                                                                                'bg-gray-100 text-gray-600 border-gray-200';

                                                                                                                                    return (
                                                                                                                                        <div key={obj.id} className="flex items-start gap-2.5 p-3 rounded-lg bg-white dark:bg-gray-800/70 border border-gray-100/80 dark:border-white/10 shadow-sm">

                                                                                                                                            <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-intranet-primary flex-shrink-0" />
                                                                                                                                            <div className="flex-1 min-w-0">
                                                                                                                                                <div className="flex items-start justify-between gap-2">
                                                                                                                                                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 leading-snug">{obj.title}</span>
                                                                                                                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${badgeClass}`}>
                                                                                                                                                        {obj.status || 'Not Started'}
                                                                                                                                                    </span>
                                                                                                                                                </div>
                                                                                                                                                {obj.description && (
                                                                                                                                                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1 italic">{obj.description}</p>
                                                                                                                                                )}
                                                                                                                                                {obj.goalType && (
                                                                                                                                                    <span className="text-[9px] text-muted-foreground/60 uppercase font-bold tracking-wider">
                                                                                                                                                        {obj.goalType} Level
                                                                                                                                                    </span>
                                                                                                                                                )}
                                                                                                                                            </div>
                                                                                                                                        </div>
                                                                                                                                    );
                                                                                                                                })}
                                                                                                                            </div>
                                                                                                                        </AccordionContent>
                                                                                                                    </AccordionItem>
                                                                                                                </Accordion>
                                                                                                            ))}
                                                                                                        </div>
                                                                                                    </AccordionContent>
                                                                                                </AccordionItem>
                                                                                            </Accordion>
                                                                                        );
                                                                                    });
                                                                                })()}
                                                                            </div>
                                                                        </AccordionContent>
                                                                    </AccordionItem>
                                                                );
                                                            })}
                                                        </Accordion>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    })}
                                </Accordion>
                            )}

                            {/* Static fallback when no live data is available */}
                            {!isLoadingHierarchy && !divisionHierarchy && (
                                <Accordion type="single" collapsible className="w-full space-y-4">
                                    {effectiveAlignments.map((division: any, index: number) => {
                                        const alignedTitle = division.alignedGoal || division.alignedObjectiveTitle || (division.objectives && division.objectives[0]?.title);
                                        const kraList = division.initiatives || division.kras || (division.objectives && division.objectives[0]?.kras) || [];

                                        return (
                                            <AccordionItem
                                                key={index}
                                                value={`div-${index}`}
                                                className="border rounded-2xl bg-white dark:bg-gray-800/50 dark:border-white/10 overflow-hidden shadow-sm hover:shadow-md transition-shadow px-0"
                                            >

                                                <AccordionTrigger className="hover:no-underline px-6 py-5 group">
                                                    <div className="flex items-center gap-4 text-left">
                                                        <div className="p-3 rounded-xl bg-intranet-primary/10 text-intranet-primary transition-colors">
                                                            {(() => {
                                                                const IconComp = IconMap[division.icon] || LayoutDashboard;
                                                                return <IconComp className="w-6 h-6" />;
                                                            })()}
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <div className="font-bold text-base text-gray-900 dark:text-gray-100">{division.name}</div>
                                                            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{division.director}</div>
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-6 pb-8 pt-2">
                                                    <div className="border-t border-gray-50 dark:border-gray-800 mt-2 pt-6 space-y-6">
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-4 w-1 bg-intranet-primary rounded-full"></div>
                                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-intranet-primary/70">Aligned Strategic Goal & Execution</span>
                                                            </div>
                                                            <div className="text-base font-bold text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-white/10 flex items-center gap-3">
                                                                <Target className="w-5 h-5 text-intranet-primary dark:text-intranet-primary-light flex-shrink-0" />
                                                                {alignedTitle}
                                                            </div>

                                                        </div>
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-4 w-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Key Result Areas (KRAs)</span>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-3">
                                                                {kraList.map((kra: string, kraIdx: number) => (
                                                                    <div key={kraIdx} className="flex items-start gap-4 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-white/10 shadow-sm">

                                                                        <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-intranet-primary/5 text-intranet-primary flex items-center justify-center">
                                                                            <ChevronRight className="w-3 h-3" />
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 leading-snug">{kra}</p>
                                                                            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter opacity-60">Target Status: Active Tracking</p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    })}
                                </Accordion>
                            )}
                        </div>

                        {/* 5. Overall Organizational Achievement */}
                        <div className="space-y-8 pt-4">
                            <div className="text-center md:text-left">
                                <h2 className="text-xl font-semibold px-1 flex items-center justify-center md:justify-start gap-2">
                                    <BarChart2 className="w-5 h-5 text-intranet-primary" />
                                    Overall Organizational Achievement
                                </h2>
                                <p className="text-sm text-muted-foreground mt-1 px-1">
                                    Aggregate progress across all strategic goals for the 2025/26 cycle.
                                </p>
                            </div>

                            <Card className="overflow-hidden border dark:border-white/10 shadow-md bg-gradient-to-br from-intranet-primary/5 via-card to-muted/40 dark:bg-gray-800 dark:from-intranet-primary/10 dark:via-gray-800 dark:to-gray-900/40">
                                <CardContent className="p-8 md:p-12">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                                        {/* Large Donut Chart */}
                                        <div className="flex flex-col items-center justify-center gap-6">
                                            <div className="text-center space-y-1">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-intranet-primary/70">2025/26 Work Plan</p>
                                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Strategic Position</h3>
                                            </div>
                                            <TaskCompletionDonut
                                                segments={[
                                                    { value: averageProgress, color: '#5C001E', label: 'Completed' },
                                                    { value: 100 - averageProgress, color: '#e2e8f0', label: 'Remaining' }
                                                ]}
                                                centerLabel={`${averageProgress}%`}
                                                centerSubtext="Overall Status"
                                                size={300}
                                                thickness={24}
                                            />
                                            <div className="flex items-center gap-8 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full bg-intranet-primary" />
                                                    <span className="text-muted-foreground font-medium">Achieved: <strong className="text-gray-800 dark:text-gray-200">{averageProgress}%</strong></span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full bg-slate-200" />
                                                    <span className="text-muted-foreground font-medium">Remaining: <strong className="text-gray-800 dark:text-gray-200">{100 - averageProgress}%</strong></span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Per-Objective Breakdown */}
                                        <div className="space-y-5">
                                            <div className="space-y-1 mb-6">
                                                <h3 className="font-bold text-base text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                                    <Target className="w-4 h-4 text-intranet-primary" />
                                                    Strategic Goals Breakdown
                                                </h3>
                                                <p className="text-xs text-muted-foreground">Individual progress per strategic goal</p>
                                            </div>
                                            {effectiveObjectives.map((objective: any, index: number) => {
                                                const Icon = IconMap[objective.icon] || Target;
                                                const prog = objective.progress || 0;
                                                const statusColor =
                                                    prog >= 75 ? 'text-green-600 bg-green-50 border-green-200' :
                                                    prog >= 40 ? 'text-amber-600 bg-amber-50 border-amber-200' :
                                                    'text-rose-600 bg-rose-50 border-rose-200';
                                                return (
                                                    <div key={objective.id || index} className="space-y-2">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className="p-1.5 rounded-lg bg-intranet-primary/10 text-intranet-primary flex-shrink-0">
                                                                    <Icon className="w-3.5 h-3.5" />
                                                                </div>
                                                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{objective.title}</span>
                                                            </div>
                                                            <Badge variant="outline" className={`text-[10px] font-bold flex-shrink-0 border ${statusColor}`}>
                                                                {prog}%
                                                            </Badge>
                                                        </div>
                                                        <Progress value={prog} className="h-2" indicatorClassName="bg-[#5C001E]" />
                                                    </div>
                                                );
                                            })}

                                            {/* Summary stats row */}
                                            <div className="grid grid-cols-3 gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-800">
                                                {[
                                                    { label: 'Strategic Goals', value: effectiveObjectives.length, icon: Layers },
                                                    { label: 'On Track (≥40%)', value: effectiveObjectives.filter((o: any) => (o.progress || 0) >= 40).length, icon: TrendingUp },
                                                    { label: 'Completed (≥75%)', value: effectiveObjectives.filter((o: any) => (o.progress || 0) >= 75).length, icon: Award },
                                                ].map(({ label, value, icon: StatIcon }, i) => (
                                                    <div key={i} className="flex flex-col items-center p-3 rounded-xl bg-intranet-primary/5 gap-1">
                                                        <StatIcon className="w-4 h-4 text-intranet-primary" />
                                                        <span className="text-lg font-black text-intranet-primary">{value}</span>
                                                        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider text-center">{label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Redundant original "Alignment Cascade" has been removed to simplify the page as requested */}
                    </TabsContent>

                    <TabsContent value="analytics" className="space-y-8 mt-0 outline-none">
                        <StrategyAnalytics
                            objectives={effectiveObjectives}
                            milestones={milestones}
                            kras={allKras || []}
                            kpis={allKpis || []}
                            unitObjectives={allUnitObjectives || []}
                            orgHierarchy={(strategyData as any)?.hierarchyDetails || []}
                            divisions={allDivisions}
                            units={allUnits}
                            officerProfiles={allOfficerProfiles}
                        />
                    </TabsContent>

                    {canSeeReports && (
                    <TabsContent value="reports" className="space-y-8 mt-0 outline-none">
                        {/* 1. Executive Summary & Actions */}
                        <div className="flex flex-col md:flex-row gap-6">
                            <Card className="flex-1 border border-gray-100 dark:border-white/10 shadow-sm bg-gradient-to-br from-intranet-primary/5 to-transparent dark:bg-gray-900 dark:from-intranet-primary/10 dark:to-transparent transition-all duration-300">

                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2 text-intranet-primary font-bold text-xs uppercase tracking-widest">
                                        <DashboardIcon className="w-4 h-4" />
                                        Executive Summary 2025/26
                                    </div>
                                    <CardTitle>Strategy Implementation Status</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        The Commission is currently in the <strong>Operationalization Phase</strong> of the 2025-2026 cycle.
                                        Four of the documented strategic goals and executions are currently "On Track," primarily driven by
                                        Administrative Fundamentals and Cooperation efforts. Legislative reforms and the "Centurion System" execution remain high
                                        priorities for the coming quarters to ensure full alignment with updated market regulations.
                                    </p>
                                    <div className="flex gap-4 mt-6">
                                        <button className="flex items-center gap-2 px-4 py-2 bg-intranet-primary text-white rounded-lg text-xs font-bold hover:bg-intranet-primary/90 transition-colors">
                                            <BarChartIcon className="w-4 h-4" /> Download PDF Report
                                        </button>
                                        <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                            <TableIcon className="w-4 h-4" /> Export Excel
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="md:w-1/3 border-none shadow-sm bg-gray-900 text-white">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2 text-intranet-primary-light font-bold text-xs uppercase tracking-widest">
                                        <Shield className="w-4 h-4 text-orange-400" />
                                        Strategic Risk Register
                                    </div>
                                    <CardTitle className="text-white">Active Priorities</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {(risks && risks.length > 0 ? risks : [
                                        { title: "Legislative Delay", impact: "Medium", context: "Parliamentary cycle timing" },
                                        { title: "Funding Gap", impact: "Low", context: "Acquisition of PNG Registries Ltd" },
                                        { title: "Talent Mobility", impact: "High", context: "Retention of technical legal experts" },
                                    ]).map((risk: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center border-b border-white/10 pb-2">
                                            <div>
                                                <div className="text-xs font-bold">{risk.title}</div>
                                                <div className="text-[10px] text-gray-400">{risk.context}</div>
                                            </div>
                                            <Badge variant="outline" className={`text-[9px] ${risk.impact === 'High' || risk.impact === 'Critical' ? 'text-red-400 border-red-400' : 'text-gray-300 border-white/20'}`}>
                                                {risk.impact}
                                            </Badge>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>

                        {/* 2. Detailed Performance Table */}
                        <Card className="border border-gray-100 dark:border-white/10 shadow-md overflow-hidden bg-white dark:bg-gray-900 transition-all duration-300">
                            <CardHeader className="bg-gray-50/50 dark:bg-gray-950/40 border-b border-gray-100 dark:border-white/10">

                                <div className="flex items-center gap-2">
                                    <Target className="h-5 w-5 text-intranet-primary" />
                                    <CardTitle className="text-lg">Detailed Strategic Goal Alignment & KRA Report</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table className="border-b">

                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="w-[200px] text-[10px] uppercase font-black tracking-widest">Strategic Goal</TableHead>
                                            <TableHead className="text-[10px] uppercase font-black tracking-widest">Primary KRA Focus</TableHead>
                                            <TableHead className="text-[10px] uppercase font-black tracking-widest text-center">Deadline</TableHead>
                                            <TableHead className="text-[10px] uppercase font-black tracking-widest">Execution Status</TableHead>
                                            <TableHead className="text-[10px] uppercase font-black tracking-widest text-right">Progress</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {effectiveObjectives.map((row: any, i: number) => (
                                            <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1 h-3 rounded-full bg-intranet-primary" />
                                                        <span className="font-bold text-xs">{row.title}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground line-clamp-1">{row.description}</TableCell>
                                                <TableCell className="text-xs text-center font-mono">Dec 2026</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="scale-90 font-bold uppercase">{row.status}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="text-[10px] font-bold">{row.progress}%</span>
                                                        <div className="w-24 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                            <div className="h-full bg-intranet-primary" style={{ width: `${row.progress}%` }} />
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {effectiveObjectives.length === 0 && [
                                            { pillar: "Markets & Connectivity", kra: "Trading/Clearing/Settlement Systems", date: "Dec 2026", status: "Active", progress: 45, color: "text-blue-600" },
                                            { pillar: "Regulatory Reform", kra: "SC Act & Capital Market Act Update", date: "Dec 2026", status: "Drafting", progress: 30, color: "text-orange-600" },
                                        ].map((row, i) => (
                                            <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-1 h-3 rounded-full ${row.color.replace('text', 'bg')}`} />
                                                        <span className="font-bold text-xs">{row.pillar}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{row.kra}</TableCell>
                                                <TableCell className="text-xs text-center font-mono">{row.date}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="scale-90 font-bold">{row.status}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="text-[10px] font-bold">{row.progress}%</span>
                                                        <div className="w-24 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                            <div className={`h-full ${row.color.replace('text', 'bg')}`} style={{ width: `${row.progress}%` }} />
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* 3. Divisional Accountability Report */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                            <Card className="border border-gray-100 dark:border-white/10 shadow-sm bg-white dark:bg-gray-900 transition-all duration-300">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                                        <Users className="w-4 h-4" />
                                        Departmental Accountability
                                    </div>
                                    <CardTitle className="text-base text-gray-900 dark:text-gray-100">Divisional Priority Status</CardTitle>

                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {(alignments && alignments.length > 0 ? alignments : [
                                        { name: "Legal Services (LSD)", status: "High Priority", load: "Legal Reforms" },
                                        { name: "Licensing (LISD)", status: "In Progress", load: "Broker Expansion" },
                                        { name: "Research (RPD)", status: "Active", load: "Investor Roadshows" },
                                        { name: "Corporate (CSD)", status: "Ongoing", load: "Policy Finalization" },
                                    ]).map((div: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/20 border border-transparent dark:hover:border-white/5 transition-all">
                                            <div>
                                                <div className="text-xs font-bold">{div.name}</div>
                                                <div className="text-[10px] text-muted-foreground">Alignment: {div.alignedObjectiveTitle || 'Strategic Support'}</div>
                                            </div>
                                            <Badge variant="outline" className="text-[9px] bg-white dark:bg-gray-900 border-intranet-primary/20">{div.status || 'Active'}</Badge>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card className="border dark:border-white/10 shadow-sm bg-intranet-primary text-white">

                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2 text-white/70 font-bold text-xs uppercase tracking-widest">
                                        <Award className="w-4 h-4" />
                                        Strategy Achievement
                                    </div>
                                    <CardTitle className="text-white">Next Performance Gates</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {(milestones && milestones.length > 0 ? [milestones[0]] : [
                                            { date: "May 2025", title: "Completion of Internal Operating Procedures", progress: 60 }
                                        ]).map((gate: any, i: number) => (
                                            <div key={i} className="p-4 rounded-xl bg-white/10 border border-white/10">
                                                <div className="text-[10px] uppercase font-bold text-white/60">Target: {gate.date}</div>
                                                <div className="text-sm font-bold mt-1">{gate.title}</div>
                                                <div className="text-[10px] mt-2 flex items-center gap-2">
                                                    <div className="h-1 flex-1 bg-white/20 rounded-full">
                                                        <div className="h-full bg-white rounded-full" style={{ width: `${gate.progress || 0}%` }} />
                                                    </div>
                                                    {gate.progress || 0}% Ready
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-[10px] font-bold uppercase text-white/60 tracking-widest">Full 2025 Cycle Progress</span>
                                            <span className="text-sm font-black">40%</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                    )}

                    <TabsContent value="org" className="mt-0 outline-none">
                        <OrgChart />
                    </TabsContent>
                </Tabs>

                {/* Strategy Setup Wizard */}
                <StrategySetupWizard
                    isOpen={isWizardOpen}
                    onClose={() => setIsWizardOpen(false)}
                    onSave={handleWizardSave}
                    isSaving={isUpdating}
                />

                <EditStrategicObjectiveModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setSelectedObjective(null);
                    }}
                    onSuccess={() => {
                        refreshStrategy();
                    }}
                    objective={selectedObjective}
                />
            </div>
        </PageLayout>
    );
};

// Recursive Component for Goal Cascade
const GoalCascadeItem = ({ item, level }: { item: StrategicItem, level: number }) => {
    const hasChildren = item.children && item.children.length > 0;

    // Determine colors based on level
    const levelColors = {
        0: 'border-l-intranet-primary bg-card', // Pillar
        1: 'border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/20', // Org Goal
        2: 'border-l-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20', // Div Goal
        3: 'border-l-purple-400 bg-white dark:bg-card', // Unit Objective
    };

    const LevelIcon = [Layers, Zap, TrendingUp, Target][level] || Target;

    return (
        <Card className={`mb-2 overflow-hidden border-l-4 ${levelColors[level as keyof typeof levelColors] || 'border-l-gray-300'} shadow-sm`}>
            {hasChildren ? (
                <Accordion type="single" collapsible>
                    <AccordionItem value="item-1" className="border-none">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-black/5 transition-colors">
                            <div className="flex items-center gap-3 w-full text-left">
                                <LevelIcon className={`w-5 h-5 flex-shrink-0 ${level === 0 ? 'text-intranet-primary' : 'text-muted-foreground'}`} />
                                <div className="flex-1">
                                    <h4 className="font-semibold text-sm md:text-base">{item.title}</h4>
                                    <p className="text-xs text-muted-foreground line-clamp-1 hidden md:block">{item.description}</p>
                                </div>
                                <div className="flex items-center gap-4 mr-2">
                                    <div className="w-24 hidden sm:block">
                                        <div className="flex justify-between text-[10px] mb-1">
                                            <span>Progress</span>
                                            <span>{item.progress}%</span>
                                        </div>
                                        <Progress value={item.progress} className="h-1.5" indicatorClassName="bg-[#c4506a]" />
                                    </div>
                                    <Badge
                                        variant={item.status === 'on-track' ? 'default' : item.status === 'at-risk' ? 'destructive' : 'secondary'}
                                        className="text-[10px] uppercase min-w-[70px] justify-center"
                                    >
                                        {item.status}
                                    </Badge>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 py-2 border-t bg-black/5 dark:bg-white/5 space-y-2">
                            {/* Recursive Rendering of Children */}
                            {hasChildren && item.children!.map((child) => (
                                <GoalCascadeItem key={child.id} item={child} level={level + 1} />
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            ) : (
                // Leaf Node (No Accordion)
                <div className="px-4 py-3 flex items-start gap-3">
                    <ArrowDownRight className="w-4 h-4 mt-1 text-muted-foreground" />
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <h4 className="font-medium text-sm">{item.title}</h4>
                            <Badge
                                variant={item.status === 'completed' ? 'default' : item.status === 'on-track' ? 'outline' : 'destructive'}
                                className="scale-90"
                            >
                                {item.status}
                            </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{item.description}</p>

                        {item.owner && (
                            <div className="mt-2 text-xs font-mono bg-black/5 dark:bg-white/10 inline-block px-1.5 py-0.5 rounded">
                                Owner: {item.owner}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
};

export default Strategy;
