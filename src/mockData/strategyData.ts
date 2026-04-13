export interface GoalLink {
    id: string;
    name: string;
}

export interface KpiTarget {
    metric: string;
    targetValue: string | number;
    currentValue: string | number;
    unit: string;
    status: 'on-track' | 'at-risk' | 'behind' | 'completed';
}

export interface StrategicItem {
    id: string;
    title: string;
    description: string;
    progress: number; // 0-100
    owner?: string;
    status: 'on-track' | 'at-risk' | 'behind' | 'completed';
    children?: StrategicItem[];
    kpis?: KpiTarget[];
    parentId?: string;
    icon?: string;
    sortOrder?: number;
    deliverables?: string[];
    isFeatured?: boolean;
}

export interface StrategyMilestone {
    id: string;
    title: string;
    date: string;
    status: 'Upcoming' | 'Planning' | 'On-Track' | 'Critical';
    context: string;
    color: string;
}

export interface StrategyRisk {
    id: string;
    title: string;
    impact: 'Low' | 'Medium' | 'High' | 'Critical';
    context: string;
}

export interface DivisionalAlignment {
    id: string;
    name: string;
    director: string;
    kras: string[];
    icon: string;
    alignedObjectiveId: string;
    alignedObjectiveTitle?: string;
    contributionWeight?: number;
}

export interface StrategyData {
    organization: {
        mission: string;
        vision: string;
        values: { name: string; description: string; icon: string }[];
        executiveSummary?: string;
    };
    pillars: StrategicItem[];
    objectives?: StrategicItem[];
    unitObjectives?: StrategicItem[];
    alignments?: DivisionalAlignment[];
    milestones?: StrategyMilestone[];
    risks?: StrategyRisk[];
    strategicGoals?: Array<{ id: string; title: string; description?: string }>;
    strategicKRAs?: Array<{ id: string; goalId: string | null; title: string; description?: string }>;
}

export const mockStrategyData: StrategyData = {
    organization: {
        mission: "To promote and maintain a secure capital market that is fair for and accessible to all stakeholders while supporting capital formation through innovative market development.",
        vision: "Papua New Guinea's capital market will be secure, inclusive, and growing -built on fairness, integrity, and accessibility-supporting investor trust and national prosperity by 2050.",
        executiveSummary: "The SCPNG Strategy Hub 2025–2030 outlines our path to modernizing PNG's capital markets through regulation, development, and international cooperation.",
        values: [
            { name: "Protect", description: "Safeguarding investors from scams and market manipulation.", icon: "Shield" },
            { name: "Develop", description: "Encouraging new capital formation and innovative market products.", icon: "TrendingUp" },
            { name: "Regulate", description: "Ensuring all market participants follow the rule of law.", icon: "Award" },
            { name: "Mitigate", description: "Reducing systemic risks within the PNG financial landscape.", icon: "Zap" },
        ]
    },
    pillars: [
        {
            id: "pillar-1",
            title: "Protect",
            description: "Safeguarding investors from scams and market manipulation.",
            icon: "Shield",
            sortOrder: 1,
            progress: 75,
            status: "on-track",
            children: []
        },
        {
            id: "pillar-2",
            title: "Develop",
            description: "Encouraging new capital formation and innovative market products.",
            icon: "TrendingUp",
            sortOrder: 2,
            progress: 45,
            status: "at-risk",
            children: []
        },
        {
            id: "pillar-3",
            title: "Regulate",
            description: "Ensuring all market participants follow the rule of law.",
            icon: "Award",
            sortOrder: 3,
            progress: 60,
            status: "on-track",
            children: []
        },
        {
            id: "pillar-4",
            title: "Mitigate",
            description: "Reducing systemic risks within the PNG financial landscape.",
            icon: "Zap",
            sortOrder: 4,
            progress: 90,
            status: "on-track",
            children: []
        }
    ],
    objectives: [
        {
            id: "obj-1",
            title: "Expand Markets & Connectivity",
            description: "Enhance PNGX Infrastructure and market accessibility to increase participant engagement.",
            progress: 45,
            icon: "TrendingUp",
            status: "on-track",
            deliverables: [
                "PNGX Systems: Implement ongoing Trading, Clearing, and Settlement systems.",
                "Market Clean Up: Acquire PNG Registries Ltd and resolve K35 million in undistributed dividends.",
                "Broker Expansion: Amend Business Rules to increase the number of licensed brokers beyond two."
            ]
        },
        {
            id: "obj-2",
            title: "Regulatory Framework Reform",
            description: "Modernize the legal environment to ensure fair, efficient, and transparent markets.",
            progress: 30,
            icon: "ShieldCheck",
            status: "on-track",
            deliverables: [
                "Legislative Updates: Pass amendments to the SC Act and Capital Market Act by end of 2026.",
                "Thematic Green Bonds: Finalize Green Bond rules with IFC by April 2026.",
                "New Codes: Implement Unit Trust, Trustee Guidelines, and Fund Management Codes by end of 2025."
            ]
        },
        {
            id: "obj-3",
            title: "Administrative Fundamentals",
            description: "Strengthen Internal governance and complete the transition to the SCPNG Identity.",
            progress: 60,
            icon: "Building2",
            status: "on-track",
            deliverables: [
                "Board Appointment: Appoint new Board Members by April 2026 following parliamentary name change.",
                "Strategic Planning: Finalize the 'Strategic Plan 2025–2030' with ADB and IFC by September 2025.",
                "Policy Finalization: Complete all Internal office policies and procedural guides by May 2025."
            ]
        },
        {
            id: "obj-4",
            title: "Investor Education",
            description: "Empower the public through the 'Invest Smart PNG' campaign and safety awareness.",
            progress: 25,
            icon: "GraduationCap",
            status: "at-risk", // Needs Attention mapped to at-risk
            deliverables: [
                "Digital Reach: Expand social media reach to 2–3 million followers via awareness series.",
                "Investor Bootcamps: Conduct quarterly weekend workshops for first-time investors with PNGX.",
                "Regional Workshops: Execute roadshows and pop-up events in underrepresented regional centers."
            ]
        },
        {
            id: "obj-5",
            title: "National & International Cooperation",
            description: "Solidify global standing and domestic partnerships for capacity building.",
            progress: 40,
            icon: "Globe",
            status: "on-track",
            deliverables: [
                "IOSCO MMOU: Finalize assessment and engagement for the MMOU by end of 2026.",
                "Global Partnerships: Maintain ongoing regulatory assistance MOAs with ADB and IFC.",
                "Inter-Agency MOAs: Finalize data access and SME support agreements with the IPA."
            ]
        },
        {
            id: "obj-6",
            title: "Centurion Enterprise System",
            description: "Digitizing regulatory functions.",
            progress: 15,
            icon: "Rocket",
            status: "on-track",
            deliverables: ["Licensing Module", "Additional Core Modules"],
            isFeatured: true
        }
    ],
    unitObjectives: [
        {
            id: "unit-obj-1",
            title: "Process Q1 Licensing Batch",
            description: "Review and approve pending broker license renewals.",
            progress: 70,
            icon: "FileText",
            status: "on-track",
            owner: "Licensing Team",
            deliverables: ["Review 15 applications", "Issue renewal notices"]
        },
        {
            id: "unit-obj-2",
            title: "Annual Audit Preparation",
            description: "Prepare financial statements for external audit review.",
            progress: 30,
            icon: "ClipboardCheck",
            status: "at-risk",
            owner: "Internal Audit",
            deliverables: ["Consolidate statements", "Pre-audit meeting"]
        },
        {
            id: "unit-obj-3",
            title: "IT Network Upgrade",
            description: "Upgrade core switches and firewall infrastructure.",
            progress: 50,
            icon: "Server",
            status: "on-track",
            owner: "IT Unit",
            deliverables: ["Procure hardware", "Schedule downtime", "Install & Config"]
        },
        {
            id: "unit-obj-4",
            title: "Recruitment Drive: Legal Officers",
            description: "Fill 3 vacant senior legal officer positions.",
            progress: 20,
            icon: "Users",
            status: "on-track",
            owner: "HR Division",
            deliverables: ["Advertise roles", "Shortlist candidates", "Interviews"]
        }
    ],
    alignments: [
        {
            id: "align-1",
            name: "Legal Services Division (LSD)",
            director: "Director Legal Services",
            icon: "ShieldCheck",
            contributionWeight: 25,
            kras: ["Pass amendments", "IOSCO MMOU", "Legal protocols"],
            alignedObjectiveId: "obj-2",
            alignedObjectiveTitle: "Regulatory Framework Reform"
        },
        {
            id: "align-2",
            name: "LISD Division",
            director: "Director LIS",
            icon: "Zap",
            contributionWeight: 35,
            kras: ["Centurion Deployment", "Unit Trust Codes", "Broker licensing"],
            alignedObjectiveId: "obj-1",
            alignedObjectiveTitle: "Expand Markets & Connectivity"
        },
        {
            id: "align-3",
            name: "Research & Publication (RPD)",
            director: "Director R&P",
            icon: "GraduationCap",
            contributionWeight: 15,
            kras: ["Digital Awareness", "Investor Workshops", "Roadmap events"],
            alignedObjectiveId: "obj-4",
            alignedObjectiveTitle: "Investor Education"
        },
        {
            id: "align-4",
            name: "Corporate Services Division (CSD)",
            director: "Director Corporate Services",
            icon: "Building2",
            contributionWeight: 20,
            kras: ["Policy guides", "IT Modernization", "HR Framework"],
            alignedObjectiveId: "obj-3",
            alignedObjectiveTitle: "Administrative Fundamentals"
        },
        {
            id: "align-5",
            name: "Internal Audit Unit",
            director: "Manager Audit",
            icon: "Shield",
            contributionWeight: 10,
            kras: ["Strategic Plan 2030", "Audit frameworks", "Risk monitoring"],
            alignedObjectiveId: "obj-5",
            alignedObjectiveTitle: "National & International Cooperation"
        }
    ],
    milestones: [
        { id: "m-1", title: "Internal Policy Finalization", context: "CSD Operations", date: "2025-05-15", status: "On-Track", color: "#0066cc" },
        { id: "m-2", title: "Strategic Plan 2025–2030", context: "Executive Board", date: "2025-09-01", status: "Planning", color: "#7c3aed" },
        { id: "m-3", title: "Centurion Licensing Module", context: "LISD Digitalization", date: "2026-01-10", status: "Upcoming", color: "#d97706" }
    ],
    risks: [
        { id: "r-1", title: "Legislative Delay", impact: "High", context: "Parliamentary backlog may delay SC Act amendments." },
        { id: "r-2", title: "Resource Constraints", impact: "Medium", context: "Limited specialized headcount for IOSCO compliance." },
        { id: "r-3", title: "Cyber Security Threat", impact: "Critical", context: "Digital transformation increases attack surface on market data." }
    ],
    strategicGoals: [
        { id: "mock-goal-1", title: "Markets & Connectivity", description: "Rebuilding our digital markets and strengthening international connectivity to attract investment." },
        { id: "mock-goal-2", title: "Regulatory Reform", description: "Updating the legal landscape to adapt to modern and digital economic realities." },
        { id: "mock-goal-3", title: "Digitisation", description: "Embracing technology to digitize internal processes and establish an e-registry platform." },
        { id: "mock-goal-4", title: "Administrative Fundamentals & Cooperation", description: "Building a high-performance culture, optimizing resources, and enhancing inter-agency collaboration." }
    ],
    strategicKRAs: []
};
