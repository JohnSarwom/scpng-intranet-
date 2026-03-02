export interface MockDivisionData {
    id: string;
    divisionName: string;
    branch: string;
    primaryContact: { label: string; email: string };
    location: string;
    totalStaff: number;
    director: { quote: string; name: string };
    missionStatement: string;
    subDepartments: { name: string; description: string; icon: string }[];
    achievements: { title: string; date: string; description: string; icon: string }[];
    statutoryDuties?: string[];
}

export interface MockUnitData {
    id: string;
    unitName: string;
    parentDivision: string;
    primaryContact: { label: string; email: string };
    location: string;
    totalStaff: number;
    manager: { quote: string; name: string };
    missionStatement: string;
    coreFunctions: { name: string; description: string; icon: string }[];
    achievements: { title: string; date: string; description: string; icon: string }[];
    statutoryDuties?: string[];
}

export const MOCK_DIVISIONS_DATA: Record<string, MockDivisionData> = {
    "Office of the Chairman": {
        id: "oc",
        divisionName: "Office of the Chairman",
        branch: "Executive Branch",
        primaryContact: { label: "Primary Contact", email: "chairman@scpng.gov.pg" },
        location: "HQ - Level 5, Executive Suite",
        totalStaff: 15,
        director: { quote: "Leading with vision and integrity to foster a robust capital market.", name: "James Joshua (CEO)" },
        missionStatement: "To provide strategic direction and leadership to the Securities Commission, ensuring effective regulation and development of Papua New Guinea's capital markets.",
        subDepartments: [
            { name: "Executive Division", description: "Strategic leadership", icon: "briefcase" },
            { name: "Secretariat Unit", description: "Administrative support", icon: "book" }
        ],
        achievements: [
            { title: "Strategic Plan 2024-2028", date: "Q4 2023", description: "Launched the new 5-year strategic plan for market development.", icon: "rocket" }
        ]
    },
    "Corporate Services Division": {
        id: "csd",
        divisionName: "Corporate Services Division",
        branch: "Operations Branch",
        primaryContact: { label: "Primary Contact", email: "staki@scpng.gov.pg" },
        location: "HQ - 4th Floor, East Wing",
        totalStaff: 48,
        director: { quote: "Streamlining excellence through global synergy and innovative resourcing.", name: "Director Sam Taki" },
        missionStatement: "To streamline organizational processes through innovative strategies and efficient resource management, ensuring excellence across all departments. We strive to create a seamless operational framework that empowers our teams.",
        subDepartments: [
            { name: "Finance Unit", description: "Financial planning & reporting", icon: "trending" },
            { name: "IT Unit", description: "Systems & infrastructure", icon: "network" },
            { name: "Human Resource Unit", description: "Talent & organizational culture", icon: "briefcase" }
        ],
        achievements: [
            { title: "ERP Migration", date: "Q3 2023", description: "Successfully migrated to the new integrated financial system ahead of schedule.", icon: "rocket" },
            { title: "Digital Transformation", date: "Q2 2023", description: "Completed phase 1 of the IT infrastructure upgrade.", icon: "award" }
        ],
        statutoryDuties: [
            "Manage the financial affairs and accounts of the Commission.",
            "Oversee human resource development, recruitment, and staff welfare.",
            "Maintain and upgrade the Commission's information technology infrastructure."
        ]
    },
    "Licensing, Market & Supervision Division": {
        id: "lmsd",
        divisionName: "Licensing, Market & Supervision Division",
        branch: "Regulatory Branch",
        primaryContact: { label: "Primary Contact", email: "lwambillie@scpng.gov.pg" },
        location: "HQ - 3rd Floor, North Wing",
        totalStaff: 62,
        director: { quote: "Ensuring market integrity through vigilant supervision and fair licensing.", name: "Senior Officer Leeroy Wambillie" },
        missionStatement: "To regulate and supervise capital market participants, ensuring compliance with statutory requirements and fostering a fair, efficient, and transparent market environment for all investors.",
        subDepartments: [
            { name: "Licensing Unit", description: "Participant registration & licensing", icon: "search" },
            { name: "Supervision Unit", description: "Ongoing compliance monitoring", icon: "shield" },
            { name: "Market Data Unit", description: "Market analytics & reporting", icon: "trending" },
            { name: "Investigations Unit", description: "Enforcement & inquiries", icon: "alert" }
        ],
        achievements: [
            { title: "Revised Licensing Framework", date: "Q1 2024", description: "Implemented the new streamlined licensing process for brokers.", icon: "rocket" }
        ],
        statutoryDuties: [
            "Regulate and supervise the activities of stock exchanges, clearing houses, and central depositories.",
            "License and supervise capital market intermediaries, including brokers, dealers, and investment advisors.",
            "Enforce compliance with the Capital Market Act and related regulations to protect investors."
        ]
    },
    "Legal Services Division": {
        id: "lsd",
        divisionName: "Legal Services Division",
        branch: "Advisory Branch",
        primaryContact: { label: "Primary Contact", email: "tyapao@scpng.gov.pg" },
        location: "HQ - 5th Floor, West Wing",
        totalStaff: 24,
        director: { quote: "Upholding the rule of law to build trust in our financial systems.", name: "Legal Manager Tyson Yapao" },
        missionStatement: "To provide robust legal advisory services, draft regulatory frameworks, and represent the Commission in legal matters to ensure solid legal grounding for all regulatory actions.",
        subDepartments: [
            { name: "Legal Advisory Unit", description: "Internal counsel & drafting", icon: "scale" }
        ],
        achievements: [
            { title: "Capital Market Act Revision", date: "Q4 2023", description: "Successfully drafted amendments to the Capital Market Act.", icon: "award" }
        ],
        statutoryDuties: [
            "Provide legal advice to the Commission on statutory interpretations and regulatory actions.",
            "Draft, review, and recommend amendments to capital market laws and regulations.",
            "Represent the Commission in legal proceedings and enforcement actions."
        ]
    },
    "Research & Publication Division": {
        id: "rpd",
        divisionName: "Research & Publication Division",
        branch: "Strategy Branch",
        primaryContact: { label: "Primary Contact", email: "jkomba@scpng.gov.pg" },
        location: "HQ - 2nd Floor, South Wing",
        totalStaff: 18,
        director: { quote: "Empowering decisions through data-driven insights and market intelligence.", name: "Director Joy Komba" },
        missionStatement: "To conduct comprehensive research on market trends, publish informative reports, and drive investor education initiatives to foster a well-informed investing public.",
        subDepartments: [
            { name: "Research Unit", description: "Market research & economic analysis", icon: "search" },
            { name: "Publication Unit", description: "Investor education & reports", icon: "book" }
        ],
        achievements: [
            { title: "Annual Market Report 2023", date: "Q1 2024", description: "Published the comprehensive annual overview of the PNG capital market.", icon: "rocket" }
        ],
        statutoryDuties: [
            "Conduct research and publish periodic reports on the performance and development of the capital market.",
            "Develop and implement strategic plans for capital market growth and innovation.",
            "Promote investor education and awareness programs."
        ]
    }
};

export const MOCK_UNITS_DATA: Record<string, MockUnitData> = {
    "Secretariat Unit": {
        id: "sec",
        unitName: "Secretariat Unit",
        parentDivision: "Office of the Chairman",
        primaryContact: { label: "Primary Contact", email: "secretariat@scpng.gov.pg" },
        location: "HQ - Level 5",
        totalStaff: 4,
        manager: { quote: "Facilitating seamless executive operations and board management.", name: "Manager John Doe" },
        missionStatement: "To ensure the efficient operation of the Board and executive leadership by providing robust administrative and structural support.",
        coreFunctions: [
            { name: "Board Administration", description: "Meeting organization and minutes", icon: "book" },
            { name: "Executive Support", description: "Direct assistance to the Chairman", icon: "briefcase" }
        ],
        achievements: [
            { title: "Digital Board Portal", date: "Q2 2023", description: "Implemented a paperless board meeting system.", icon: "rocket" }
        ],
        statutoryDuties: [
            "Maintain official records of all Commission proceedings.",
            "Facilitate the legal and administrative duties of the executive board."
        ]
    },
    "Licensing Unit": {
        id: "lic",
        unitName: "Licensing Unit",
        parentDivision: "Licensing, Market & Supervision Division",
        primaryContact: { label: "Primary Contact", email: "licensing@scpng.gov.pg" },
        location: "HQ - Target 3rd Floor",
        totalStaff: 12,
        manager: { quote: "Gatekeepers of market integrity through rigorous assessment.", name: "Manager Jane Smith" },
        missionStatement: "To rigorously assess and register all capital market participants to uphold the highest standards of market entry.",
        coreFunctions: [
            { name: "Applicant Assessment", description: "Reviewing licensing applications", icon: "search" },
            { name: "Registry Management", description: "Maintaining the public register", icon: "shield" }
        ],
        achievements: [
            { title: "E-Licensing Portal", date: "Q1 2024", description: "Launched the online application and renewal portal.", icon: "rocket" }
        ],
        statutoryDuties: [
            "Process applications for capital market licenses.",
            "Maintain the official register of licensed intermediaries."
        ]
    }
};
