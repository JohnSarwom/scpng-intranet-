
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Building2, Users, Mail, Phone, Maximize, Minimize, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import OfficerProfileModal, { type OfficerProfile } from './OfficerProfileModal';

// Using a distinct color palette based on the user's image
// Dark Maroon: #600018 (Approximate from previous code, adjusting to match image)
// Lighter Maroon/Red: #800020
// Highlight Cream: #FDF5E6 (Old Lace) or similar
// Connector Color: #E5E7EB (Gray 200) or lighter

const OrgNode = ({
    title,
    type = 'default',
    className = ''
}: {
    title: string;
    type?: 'ceo' | 'division' | 'unit' | 'highlight';
    className?: string;
}) => {
    const baseStyles = "flex items-center justify-center text-center px-4 py-3 rounded-md shadow-sm transition-all border w-full max-w-[220px] z-10 relative";

    let variantStyles = "";

    switch (type) {
        case 'ceo':
            variantStyles = "bg-[#600018] border-[#400010] text-white font-bold text-lg min-w-[280px] py-4 shadow-md";
            break;
        case 'division':
            variantStyles = "bg-[#800020] border-[#600018] text-white font-semibold text-sm h-16 shadow-md"; // Fixed height for alignment
            break;
        case 'highlight':
            // The Secretariat Unit style
            variantStyles = "bg-[#FFF8E7] border-amber-300 text-[#600018] font-bold text-sm shadow-md";
            break;
        case 'unit':
        default:
            variantStyles = "bg-[#901025] border-[#800020] text-white font-medium text-xs hover:bg-[#800020] shadow-sm";
            break;
    }

    return (
        <div className={`${baseStyles} ${variantStyles} ${className}`}>
            {title}
        </div>
    );
};

const CHAIRMAN_OFFICE = {
    divisionName: "Office of the Chairman",
    units: [
        { unitName: "Executive Division" },
        { unitName: "Secretariat Unit", isHighlight: true }
    ]
};

const ORG_DIVISIONS = [
    {
        divisionName: "Corporate Services Division",
        units: [
            { unitName: "Finance Unit" },
            { unitName: "IT Unit" },
            { unitName: "Human Resource Unit" }
        ]
    },
    {
        divisionName: "Licensing, Market & Supervision Division",
        units: [
            { unitName: "Licensing Unit" },
            { unitName: "Supervision Unit" },
            { unitName: "Market Data Unit" },
            { unitName: "Investigations Unit" }
        ]
    },
    {
        divisionName: "Legal Services Division",
        units: [
            { unitName: "Legal Advisory Unit" }
        ]
    },
    {
        divisionName: "Research & Publication Division",
        units: [
            { unitName: "Research Unit" },
            { unitName: "Publication Unit" }
        ]
    }
];

interface ProfileUnit {
    unitName: string;
    officers: OfficerProfile[];
}

interface ProfileDivision {
    divisionName: string;
    units: ProfileUnit[];
}

const CEO_OFFICER: OfficerProfile = {
    name: "James Joshua", jobTitle: "Acting Chief Executive Officer", email: "jjoshua@scpng.gov.pg", phone: "+675 321 2223",
    employeeId: "#EMP-1001", joinedDate: "Jan 2015", division: "Office of the Chairman", unit: "Executive Division",
    summary: "Experienced executive leader overseeing the operations and strategic direction of the Securities Commission of Papua New Guinea. Responsible for regulatory oversight, stakeholder engagement, and organizational governance.",
    skills: ["Executive Leadership", "Regulatory Oversight", "Strategic Planning", "Governance", "Stakeholder Management"],
    reportsTo: null, directReports: 5, officeExtension: "x1001", timezone: "PGT (GMT+10)"
};

const CHAIRMAN_OFFICE_PROFILE = {
    divisionName: "Office of the Chairman",
    executiveDivision: { unitName: "Executive Division" },
    secretariatUnit: {
        unitName: "Secretariat Unit",
        officers: [
            {
                name: "Andy Ambulu", jobTitle: "General Counsel", email: "aambulu@scpng.gov.pg", phone: "+675 321 2223",
                employeeId: "#EMP-1002", joinedDate: "Mar 2016", division: "Executive Division", unit: "Secretariat Unit",
                summary: "Senior legal professional providing counsel on regulatory and corporate matters. Advises on legal compliance, policy development, and institutional governance frameworks.",
                skills: ["Legal Advisory", "Corporate Governance", "Regulatory Compliance", "Policy Development"],
                reportsTo: { name: "James Joshua", title: "Acting CEO" }, directReports: 1, officeExtension: "x1002", timezone: "PGT (GMT+10)"
            },
            {
                name: "Ninipe Gurumo", jobTitle: "Executive Officer", email: "ngurumo@scpng.gov.pg", phone: null,
                employeeId: "#EMP-1003", joinedDate: "Jun 2018", division: "Executive Division", unit: "Secretariat Unit",
                summary: "Supports executive operations including coordination of meetings, communications, and administrative functions within the Executive Division.",
                skills: ["Executive Support", "Administration", "Communication", "Coordination"],
                reportsTo: { name: "Andy Ambulu", title: "General Counsel" }, directReports: 0, officeExtension: "x1003", timezone: "PGT (GMT+10)"
            }
        ] as OfficerProfile[]
    }
};

const PROFILE_DIVISIONS: ProfileDivision[] = [
    {
        divisionName: "Corporate Services Division",
        units: [
            {
                unitName: "Finance Unit",
                officers: [
                    {
                        name: "Sam Taki", jobTitle: "Director Corporate Service", email: "staki@scpng.gov.pg", phone: "+675 321 2223",
                        employeeId: "#EMP-2001", joinedDate: "Feb 2014", division: "Corporate Services Division", unit: "Finance Unit",
                        summary: "Oversees the Corporate Services Division including finance, IT, and human resource functions. Manages budgeting, financial reporting, and operational planning for the Commission.",
                        skills: ["Financial Management", "Budgeting", "Corporate Planning", "Team Leadership", "Reporting"],
                        reportsTo: { name: "James Joshua", title: "Acting CEO" }, directReports: 8, officeExtension: "x2001", timezone: "PGT (GMT+10)"
                    },
                    {
                        name: "Mercy Tipitap", jobTitle: "Senior Finance Officer", email: "mtipitap@scpng.gov.pg", phone: "+675 321 2223",
                        employeeId: "#EMP-2002", joinedDate: "Aug 2016", division: "Corporate Services Division", unit: "Finance Unit",
                        summary: "Manages financial operations including accounts payable, receivable, and financial reconciliation. Supports annual budget preparation and audit processes.",
                        skills: ["Financial Reporting", "Accounts Management", "Auditing", "Budget Preparation"],
                        reportsTo: { name: "Sam Taki", title: "Director Corporate Service" }, directReports: 2, officeExtension: "x2002", timezone: "PGT (GMT+10)"
                    },
                    {
                        name: "Anita Kosnga", jobTitle: "Finance Officer", email: "akosnga@scpng.gov.pg", phone: "+675 3212223",
                        employeeId: "#EMP-2003", joinedDate: "Jan 2019", division: "Corporate Services Division", unit: "Finance Unit",
                        summary: "Handles day-to-day financial transactions, invoice processing, and assists with financial record maintenance and compliance reporting.",
                        skills: ["Bookkeeping", "Invoice Processing", "Financial Records", "Compliance"],
                        reportsTo: { name: "Mercy Tipitap", title: "Senior Finance Officer" }, directReports: 0, officeExtension: "x2003", timezone: "PGT (GMT+10)"
                    },
                    {
                        name: "Laviniah Michael", jobTitle: "Intern - Part-Time", email: "lmichael@scpng.gov.pg", phone: null,
                        employeeId: "#EMP-2004", joinedDate: "Jul 2024", division: "Corporate Services Division", unit: "Finance Unit",
                        summary: "Part-time intern assisting the Finance Unit with administrative tasks, data entry, and document filing to gain professional experience in financial services.",
                        skills: ["Data Entry", "Administration", "Document Management"],
                        reportsTo: { name: "Anita Kosnga", title: "Finance Officer" }, directReports: 0, officeExtension: null, timezone: "PGT (GMT+10)"
                    }
                ]
            },
            {
                unitName: "IT Unit",
                officers: [
                    {
                        name: "Eric Kipongi", jobTitle: "Manager Information Technology", email: "ekipongi@scpng.gov.pg", phone: "+675 321 2223",
                        employeeId: "#EMP-2010", joinedDate: "May 2015", division: "Corporate Services Division", unit: "IT Unit",
                        summary: "Leads the Information Technology unit responsible for network infrastructure, systems administration, software development, and IT security for the Commission.",
                        skills: ["IT Management", "Network Infrastructure", "Systems Administration", "IT Security", "Project Management"],
                        reportsTo: { name: "Sam Taki", title: "Director Corporate Service" }, directReports: 3, officeExtension: "x2010", timezone: "PGT (GMT+10)"
                    },
                    {
                        name: "John Sarwom", jobTitle: "Senior IT Database Officer", email: "jsarwom@scpng.gov.pg", phone: "+675 321 2223",
                        employeeId: "#EMP-2011", joinedDate: "Oct 2016", division: "Corporate Services Division", unit: "IT Unit",
                        summary: "Manages database systems, ensures data integrity, and oversees database security protocols. Supports application development with backend data solutions.",
                        skills: ["Database Administration", "SQL", "Data Security", "Backup & Recovery", "Performance Tuning"],
                        reportsTo: { name: "Eric Kipongi", title: "Manager IT" }, directReports: 0, officeExtension: "x2011", timezone: "PGT (GMT+10)"
                    },
                    {
                        name: "Donald Sinogerel Samson", jobTitle: "IT Hardware Officer", email: "dsamson@scpng.gov.pg", phone: "3212223",
                        employeeId: "#EMP-2012", joinedDate: "Mar 2018", division: "Corporate Services Division", unit: "IT Unit",
                        summary: "Responsible for hardware procurement, maintenance, and support. Manages office equipment, workstation setup, and technical troubleshooting for all staff.",
                        skills: ["Hardware Support", "Network Cabling", "Troubleshooting", "Equipment Procurement"],
                        reportsTo: { name: "Eric Kipongi", title: "Manager IT" }, directReports: 0, officeExtension: "x2012", timezone: "PGT (GMT+10)"
                    },
                    {
                        name: "Monica Abau-Sapulai", jobTitle: "Senior Systems Analyst Consultant", email: "msapulai@scpng.gov.pg", phone: "+675 81620231",
                        employeeId: "#EMP-2013", joinedDate: "Nov 2022", division: "Corporate Services Division", unit: "IT Unit",
                        summary: "Provides expert consultation on systems analysis, application architecture, and digital transformation initiatives. Leads software development projects and intranet modernization.",
                        skills: ["Systems Analysis", "Software Development", "React", "TypeScript", "Digital Transformation", "UX Design"],
                        reportsTo: { name: "Eric Kipongi", title: "Manager IT" }, directReports: 0, officeExtension: "x2013", timezone: "PGT (GMT+10)"
                    }
                ]
            },
            {
                unitName: "Human Resource Unit",
                officers: [
                    {
                        name: "Thomas Mondaya", jobTitle: "Senior HR Officer", email: "tmondaya@scpng.gov.pg", phone: "+675 3212223",
                        employeeId: "#EMP-2020", joinedDate: "Apr 2015", division: "Corporate Services Division", unit: "Human Resource Unit",
                        summary: "Leads human resource operations including recruitment, performance management, staff welfare, and policy implementation across the Commission.",
                        skills: ["HR Management", "Recruitment", "Performance Management", "Policy Development", "Staff Welfare"],
                        reportsTo: { name: "Sam Taki", title: "Director Corporate Service" }, directReports: 5, officeExtension: "x2020", timezone: "PGT (GMT+10)"
                    },
                    {
                        name: "Lovelyn Karlyo", jobTitle: "Payroll Officer", email: "lkarlyo@scpng.gov.pg", phone: "+675 321 2223",
                        employeeId: "#EMP-2021", joinedDate: "Sep 2017", division: "Corporate Services Division", unit: "Human Resource Unit",
                        summary: "Manages payroll processing, salary calculations, tax deductions, and ensures timely disbursement of employee compensation and benefits.",
                        skills: ["Payroll Processing", "Tax Compliance", "Benefits Administration", "Financial Records"],
                        reportsTo: { name: "Thomas Mondaya", title: "Senior HR Officer" }, directReports: 0, officeExtension: "x2021", timezone: "PGT (GMT+10)"
                    },
                    {
                        name: "Mark Timea", jobTitle: "Admin Officer", email: "mtimea@scpng.gov.pg", phone: "+675 321 2223",
                        employeeId: "#EMP-2022", joinedDate: "Jan 2018", division: "Corporate Services Division", unit: "Human Resource Unit",
                        summary: "Provides administrative support including office management, correspondence handling, procurement coordination, and facilities management.",
                        skills: ["Office Administration", "Procurement", "Correspondence", "Facilities Management"],
                        reportsTo: { name: "Thomas Mondaya", title: "Senior HR Officer" }, directReports: 0, officeExtension: "x2022", timezone: "PGT (GMT+10)"
                    },
                    {
                        name: "Leah Samuel", jobTitle: "Divisional Secretary", email: "lsamuel@scpng.gov.pg", phone: "3212223",
                        employeeId: "#EMP-2023", joinedDate: "Jun 2019", division: "Corporate Services Division", unit: "Human Resource Unit",
                        summary: "Provides secretarial support to the Corporate Services Division including scheduling, minute-taking, correspondence, and document management.",
                        skills: ["Secretarial Support", "Scheduling", "Minute Taking", "Document Management"],
                        reportsTo: { name: "Thomas Mondaya", title: "Senior HR Officer" }, directReports: 0, officeExtension: "x2023", timezone: "PGT (GMT+10)"
                    },
                    {
                        name: "Sophia Marai", jobTitle: "Receptionist", email: "smarai@scpng.gov.pg", phone: "+675 70118699",
                        employeeId: "#EMP-2024", joinedDate: "Feb 2020", division: "Corporate Services Division", unit: "Human Resource Unit",
                        summary: "Front desk management including visitor reception, call routing, mail distribution, and general enquiry handling for the Commission.",
                        skills: ["Reception", "Customer Service", "Call Management", "Mail Distribution"],
                        reportsTo: { name: "Thomas Mondaya", title: "Senior HR Officer" }, directReports: 0, officeExtension: "x2024", timezone: "PGT (GMT+10)"
                    },
                    {
                        name: "Lenome Rex MBalupa", jobTitle: "Administrative Driver", email: "lrmbalupa@scpng.gov.pg", phone: "3212223",
                        employeeId: "#EMP-2025", joinedDate: "Aug 2017", division: "Corporate Services Division", unit: "Human Resource Unit",
                        summary: "Provides transportation services for Commission staff and visitors. Responsible for vehicle maintenance, logistics coordination, and safe transport operations.",
                        skills: ["Driving", "Vehicle Maintenance", "Logistics", "Safety Compliance"],
                        reportsTo: { name: "Thomas Mondaya", title: "Senior HR Officer" }, directReports: 0, officeExtension: null, timezone: "PGT (GMT+10)"
                    }
                ]
            }
        ]
    },
    {
        divisionName: "Licensing, Market & Supervision Division",
        units: [
            {
                unitName: "Licensing Unit",
                officers: [
                    {
                        name: "Leeroy Wambillie", jobTitle: "Senior Licensing Officer", email: "lwambillie@scpng.gov.pg", phone: "+675 321 2223",
                        employeeId: "#EMP-3001", joinedDate: "Jul 2016", division: "Licensing, Market & Supervision Division", unit: "Licensing Unit",
                        summary: "Manages the licensing process for capital market participants including application review, compliance assessment, and license issuance for securities dealers and investment advisors.",
                        skills: ["Licensing", "Regulatory Compliance", "Capital Markets", "Application Assessment"],
                        reportsTo: { name: "James Joshua", title: "Acting CEO" }, directReports: 1, officeExtension: "x3001", timezone: "PGT (GMT+10)"
                    },
                    {
                        name: "Kylie Karis", jobTitle: "Licensing Officer", email: "kkaris@scpng.gov.pg", phone: "3212223",
                        employeeId: "#EMP-3002", joinedDate: "Nov 2019", division: "Licensing, Market & Supervision Division", unit: "Licensing Unit",
                        summary: "Supports licensing operations including processing applications, maintaining license registers, and conducting preliminary compliance checks.",
                        skills: ["License Processing", "Compliance Checks", "Records Management", "Reporting"],
                        reportsTo: { name: "Leeroy Wambillie", title: "Senior Licensing Officer" }, directReports: 0, officeExtension: "x3002", timezone: "PGT (GMT+10)"
                    }
                ]
            },
            {
                unitName: "Supervision Unit",
                officers: [
                    {
                        name: "Regina Wai", jobTitle: "Senior Supervision Officer", email: "rwai@scpng.gov.pg", phone: "+675 321 2223",
                        employeeId: "#EMP-3010", joinedDate: "Mar 2017", division: "Licensing, Market & Supervision Division", unit: "Supervision Unit",
                        summary: "Conducts supervisory oversight of licensed entities ensuring compliance with securities regulations, conducts on-site inspections, and monitors market participant activities.",
                        skills: ["Supervision", "On-site Inspection", "Regulatory Monitoring", "Risk Assessment", "Compliance"],
                        reportsTo: { name: "James Joshua", title: "Acting CEO" }, directReports: 0, officeExtension: "x3010", timezone: "PGT (GMT+10)"
                    }
                ]
            },
            {
                unitName: "Market Data Unit",
                officers: [
                    {
                        name: "Zomay Apini", jobTitle: "Market Data Manager", email: "zapini@scpng.gov.pg", phone: "+675 321 2223",
                        employeeId: "#EMP-3020", joinedDate: "Sep 2015", division: "Licensing, Market & Supervision Division", unit: "Market Data Unit",
                        summary: "Manages the collection, analysis, and dissemination of capital market data. Oversees market surveillance and produces statistical reports on market performance.",
                        skills: ["Market Analysis", "Data Management", "Statistical Reporting", "Market Surveillance", "Data Visualization"],
                        reportsTo: { name: "James Joshua", title: "Acting CEO" }, directReports: 1, officeExtension: "x3020", timezone: "PGT (GMT+10)"
                    },
                    {
                        name: "Esther Alia", jobTitle: "Market Data Officer", email: "ealia@scpng.gov.pg", phone: "+675 321 2223",
                        employeeId: "#EMP-3021", joinedDate: "Apr 2020", division: "Licensing, Market & Supervision Division", unit: "Market Data Unit",
                        summary: "Supports market data operations including data collection, database updates, and preparation of market statistics and performance indicators.",
                        skills: ["Data Collection", "Database Management", "Statistics", "Report Preparation"],
                        reportsTo: { name: "Zomay Apini", title: "Market Data Manager" }, directReports: 0, officeExtension: "x3021", timezone: "PGT (GMT+10)"
                    }
                ]
            },
            {
                unitName: "Investigations Unit",
                officers: [
                    {
                        name: "Jacob Kom", jobTitle: "Senior Investigations Officer", email: "jkom@scpng.gov.pg", phone: "+675 321 2223",
                        employeeId: "#EMP-3030", joinedDate: "Jan 2017", division: "Licensing, Market & Supervision Division", unit: "Investigations Unit",
                        summary: "Leads investigation of suspected securities law violations, market misconduct, and fraud. Conducts evidence gathering, interviews, and prepares investigation reports for enforcement action.",
                        skills: ["Investigation", "Evidence Analysis", "Securities Law", "Fraud Detection", "Report Writing"],
                        reportsTo: { name: "James Joshua", title: "Acting CEO" }, directReports: 0, officeExtension: "x3030", timezone: "PGT (GMT+10)"
                    }
                ]
            }
        ]
    },
    {
        divisionName: "Legal Services Division",
        units: [
            {
                unitName: "Legal Advisory Unit",
                officers: [
                    {
                        name: "Tyson Yapao", jobTitle: "Legal Manager - Compliance & Enforcement", email: "tyapao@scpng.gov.pg", phone: "+675 321 2223",
                        employeeId: "#EMP-4001", joinedDate: "May 2015", division: "Legal Services Division", unit: "Legal Advisory Unit",
                        summary: "Manages the legal compliance and enforcement framework. Leads enforcement actions, manages litigation, and advises on regulatory reform and legislative amendments.",
                        skills: ["Legal Compliance", "Enforcement", "Litigation", "Regulatory Reform", "Legislative Drafting"],
                        reportsTo: { name: "James Joshua", title: "Acting CEO" }, directReports: 3, officeExtension: "x4001", timezone: "PGT (GMT+10)"
                    },
                    {
                        name: "Isaac Mel", jobTitle: "Senior Legal Officer", email: "imel@scpng.gov.pg", phone: "+675 321 2223",
                        employeeId: "#EMP-4002", joinedDate: "Aug 2017", division: "Legal Services Division", unit: "Legal Advisory Unit",
                        summary: "Provides legal advisory services on securities regulation, contract review, and enforcement matters. Assists in drafting legal opinions and regulatory instruments.",
                        skills: ["Legal Advisory", "Contract Review", "Securities Regulation", "Legal Drafting"],
                        reportsTo: { name: "Tyson Yapao", title: "Legal Manager" }, directReports: 0, officeExtension: "x4002", timezone: "PGT (GMT+10)"
                    },
                    {
                        name: "Tony Kawas", jobTitle: "Senior Legal Officer", email: "tkawas@scpng.gov.pg", phone: "+675 321 2223",
                        employeeId: "#EMP-4003", joinedDate: "Feb 2018", division: "Legal Services Division", unit: "Legal Advisory Unit",
                        summary: "Handles legal research, case preparation, and provides legal support on compliance and enforcement activities. Reviews market participant submissions for legal compliance.",
                        skills: ["Legal Research", "Case Preparation", "Compliance Review", "Enforcement Support"],
                        reportsTo: { name: "Tyson Yapao", title: "Legal Manager" }, directReports: 0, officeExtension: "x4003", timezone: "PGT (GMT+10)"
                    },
                    {
                        name: "Immanuel Minoga", jobTitle: "Legal Officer", email: "iminoga@scpng.gov.pg", phone: "+675 321 2223",
                        employeeId: "#EMP-4004", joinedDate: "Oct 2020", division: "Legal Services Division", unit: "Legal Advisory Unit",
                        summary: "Supports the legal team with document preparation, legal filing, correspondence, and basic legal research on regulatory matters.",
                        skills: ["Legal Support", "Document Preparation", "Filing", "Legal Research"],
                        reportsTo: { name: "Tyson Yapao", title: "Legal Manager" }, directReports: 0, officeExtension: "x4004", timezone: "PGT (GMT+10)"
                    }
                ]
            }
        ]
    },
    {
        divisionName: "Research & Publication Division",
        units: [
            {
                unitName: "Research Unit",
                officers: [
                    {
                        name: "Max Siwi", jobTitle: "Senior Research Officer", email: "msiwi@scpng.gov.pg", phone: "+675 321 2223",
                        employeeId: "#EMP-5001", joinedDate: "Jun 2016", division: "Research & Publication Division", unit: "Research Unit",
                        summary: "Conducts research on capital market trends, policy analysis, and regulatory impact assessments. Produces research papers and policy briefs to inform Commission decision-making.",
                        skills: ["Research", "Policy Analysis", "Capital Markets", "Report Writing", "Data Analysis"],
                        reportsTo: { name: "Joy Komba", title: "Director Research & Publication" }, directReports: 0, officeExtension: "x5001", timezone: "PGT (GMT+10)"
                    }
                ]
            },
            {
                unitName: "Publication Unit",
                officers: [
                    {
                        name: "Rosie Stevenou", jobTitle: "Publication Officer", email: "rstevenou@scpng.gov.pg", phone: "3212223",
                        employeeId: "#EMP-5010", joinedDate: "Dec 2018", division: "Research & Publication Division", unit: "Publication Unit",
                        summary: "Manages publication of Commission reports, newsletters, annual reports, and public awareness materials. Coordinates printing, distribution, and digital publishing.",
                        skills: ["Publication", "Desktop Publishing", "Content Editing", "Distribution", "Public Awareness"],
                        reportsTo: { name: "Joy Komba", title: "Director Research & Publication" }, directReports: 0, officeExtension: "x5010", timezone: "PGT (GMT+10)"
                    }
                ]
            },
            {
                unitName: "Director",
                officers: [
                    {
                        name: "Joy Komba", jobTitle: "Director Research & Publication", email: "jkomba@scpng.gov.pg", phone: "+675 321 2223",
                        employeeId: "#EMP-5000", joinedDate: "Mar 2014", division: "Research & Publication Division", unit: "Director",
                        summary: "Directs the Research & Publication Division overseeing all research initiatives, publications, and public communication activities of the Commission.",
                        skills: ["Research Management", "Publication Oversight", "Strategic Communication", "Team Leadership", "Policy Research"],
                        reportsTo: { name: "James Joshua", title: "Acting CEO" }, directReports: 2, officeExtension: "x5000", timezone: "PGT (GMT+10)"
                    }
                ]
            }
        ]
    }
];

const OfficerCard = ({ officer, onClick }: { officer: OfficerProfile; onClick?: (officer: OfficerProfile) => void }) => {
    const initials = officer.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return (
        <div
            className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow w-full cursor-pointer"
            onClick={() => onClick?.(officer)}
        >
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#600018] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {initials}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{officer.name}</p>
                    <p className="text-xs text-[#800020] font-medium truncate">{officer.jobTitle}</p>
                    <div className="flex items-center gap-1 mt-1">
                        <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="text-[10px] text-gray-500 truncate">
                            {officer.email}
                        </span>
                    </div>
                    {officer.phone && (
                        <div className="flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="text-[10px] text-gray-500">{officer.phone}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const StructureView = () => (
    <>
        {/* CEO Node */}
        <div className="flex flex-col items-center relative mb-12">
            <OrgNode title="Chief Executive Officer (CEO)" type="ceo" />
            <div className="w-px h-8 bg-gray-300 absolute -bottom-8 left-1/2 -translate-x-1/2"></div>
        </div>

        {/* Office of the Chairman - intermediate tier */}
        <div className="flex flex-col items-center relative mb-12">
            <OrgNode title={CHAIRMAN_OFFICE.divisionName} type="division" className="mb-6" />
            {/* Units under Chairman */}
            <div className="flex flex-col items-center w-full gap-3 relative">
                <div
                    className="absolute top-0 bottom-4 left-1/2 -translate-x-1/2 w-px bg-gray-300 z-0"
                    style={{ height: `calc(100% - 20px)` }}
                ></div>
                {CHAIRMAN_OFFICE.units.map((unit, uIndex) => (
                    <div key={uIndex} className="relative z-10 w-full flex justify-center">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-gray-300"></div>
                        <OrgNode
                            title={unit.unitName}
                            type={unit.isHighlight ? 'highlight' : 'unit'}
                            className="w-[90%]"
                        />
                    </div>
                ))}
            </div>
            {/* Vertical line down to divisions */}
            <div className="w-px h-8 bg-gray-300 mt-4"></div>
        </div>

        {/* Divisions row */}
        <div className="flex justify-center items-start w-full">
            {ORG_DIVISIONS.map((division, index) => {
                const isFirst = index === 0;
                const isLast = index === ORG_DIVISIONS.length - 1;

                return (
                    <div key={index} className="flex flex-col items-center relative flex-1 min-w-[180px] px-2 lg:px-4">
                        {!isFirst && <div className="absolute -top-4 left-0 w-1/2 h-px bg-gray-300"></div>}
                        {!isLast && <div className="absolute -top-4 right-0 w-1/2 h-px bg-gray-300"></div>}
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 h-4 w-px bg-gray-300"></div>

                        <OrgNode
                            title={division.divisionName}
                            type="division"
                            className="mb-6 w-full"
                        />

                        <div className="flex flex-col items-center w-full gap-3 relative">
                            {division.units.length > 0 && (
                                <>
                                    <div
                                        className="absolute top-0 bottom-4 left-1/2 -translate-x-1/2 w-px bg-gray-300 z-0"
                                        style={{ height: `calc(100% - 20px)` }}
                                    ></div>
                                    {division.units.map((unit, uIndex) => (
                                        <div key={uIndex} className="relative z-10 w-full flex justify-center">
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-gray-300"></div>
                                            <OrgNode
                                                title={unit.unitName}
                                                type={'unit'}
                                                className="w-[90%]"
                                            />
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    </>
);

const ProfilesView = ({ onOfficerClick }: { onOfficerClick: (officer: OfficerProfile) => void }) => (
    <>
        {/* CEO Node + James Joshua card */}
        <div className="flex flex-col items-center relative mb-12">
            <OrgNode title="Chief Executive Officer (CEO)" type="ceo" />
            <div className="w-px h-4 bg-gray-300"></div>
            <div className="w-[260px]">
                <OfficerCard officer={CEO_OFFICER} onClick={onOfficerClick} />
            </div>
            <div className="w-px h-8 bg-gray-300 absolute -bottom-8 left-1/2 -translate-x-1/2"></div>
        </div>

        {/* Office of the Chairman - intermediate tier */}
        <div className="flex flex-col items-center relative mb-12">
            <OrgNode title={CHAIRMAN_OFFICE_PROFILE.divisionName} type="division" className="mb-4" />
            {/* Executive Division on top, then Secretariat Unit below */}
            <div className="flex flex-col items-center gap-3 relative">
                <div
                    className="absolute top-0 bottom-4 left-1/2 -translate-x-1/2 w-px bg-gray-300 z-0"
                    style={{ height: `calc(100% - 20px)` }}
                ></div>

                {/* Executive Division */}
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-px h-3 bg-gray-300"></div>
                    <div className="bg-[#901025] border border-[#800020] text-white font-medium text-xs rounded-md px-3 py-2 text-center min-w-[180px] shadow-sm">
                        {CHAIRMAN_OFFICE_PROFILE.executiveDivision.unitName}
                    </div>
                </div>

                {/* Secretariat Unit with officers */}
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-px h-3 bg-gray-300"></div>
                    <div className="bg-[#FFF8E7] border border-amber-300 text-[#600018] font-bold text-xs rounded-md px-3 py-2 text-center min-w-[180px] shadow-sm mb-2">
                        {CHAIRMAN_OFFICE_PROFILE.secretariatUnit.unitName}
                    </div>
                    <div className="w-[220px] flex flex-col gap-1.5">
                        {CHAIRMAN_OFFICE_PROFILE.secretariatUnit.officers.map((officer, oIndex) => (
                            <OfficerCard key={oIndex} officer={officer} onClick={onOfficerClick} />
                        ))}
                    </div>
                </div>
            </div>
            {/* Vertical line down to divisions */}
            <div className="w-px h-8 bg-gray-300 mt-4"></div>
        </div>

        {/* Divisions row with officer profiles */}
        <div className="flex justify-center items-start w-full">
            {PROFILE_DIVISIONS.map((division, index) => {
                const isFirst = index === 0;
                const isLast = index === PROFILE_DIVISIONS.length - 1;

                return (
                    <div key={index} className="flex flex-col items-center relative flex-1 min-w-[220px] px-2 lg:px-3">
                        {!isFirst && <div className="absolute -top-4 left-0 w-1/2 h-px bg-gray-300"></div>}
                        {!isLast && <div className="absolute -top-4 right-0 w-1/2 h-px bg-gray-300"></div>}
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 h-4 w-px bg-gray-300"></div>

                        <OrgNode
                            title={division.divisionName}
                            type="division"
                            className="mb-6 w-full"
                        />

                        <div className="flex flex-col items-center w-full gap-4 relative">
                            {division.units.length > 0 && (
                                <>
                                    <div
                                        className="absolute top-0 bottom-4 left-1/2 -translate-x-1/2 w-px bg-gray-300 z-0"
                                        style={{ height: `calc(100% - 20px)` }}
                                    ></div>
                                    {division.units.map((unit, uIndex) => (
                                        <div key={uIndex} className="relative z-10 w-full flex flex-col items-center">
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-gray-300"></div>
                                            <div className="bg-[#901025] border border-[#800020] text-white font-medium text-xs rounded-md px-3 py-2 text-center w-[90%] shadow-sm mb-2">
                                                {unit.unitName}
                                            </div>
                                            <div className="w-[95%] flex flex-col gap-1.5">
                                                {unit.officers.map((officer, oIndex) => (
                                                    <OfficerCard key={oIndex} officer={officer} onClick={onOfficerClick} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    </>
);

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;

const OrgChart = () => {
    const [view, setView] = useState<'structure' | 'profiles'>('structure');
    const [zoom, setZoom] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [selectedOfficer, setSelectedOfficer] = useState<OfficerProfile | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleZoomIn = useCallback(() => {
        setZoom(prev => Math.min(prev + ZOOM_STEP, ZOOM_MAX));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom(prev => Math.max(prev - ZOOM_STEP, ZOOM_MIN));
    }, []);

    const handleResetZoom = useCallback(() => {
        setZoom(1);
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return;

        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }, []);

    useEffect(() => {
        const handleChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleChange);
        return () => document.removeEventListener('fullscreenchange', handleChange);
    }, []);

    const zoomPercent = Math.round(zoom * 100);

    return (
        <div
            ref={containerRef}
            className={`w-full overflow-auto p-8 min-h-[600px] flex flex-col items-center ${isFullscreen ? 'bg-white' : 'bg-transparent'
                }`}
        >
            {/* Title + Controls Row */}
            <div className="w-full flex items-start justify-between mb-12">
                <div className="flex-1" />
                <h2 className="text-[#600018] text-2xl font-sans font-bold uppercase tracking-widest text-center flex-1">
                    Securities Commission of Papua New Guinea
                </h2>
                <div className="flex-1 flex justify-end items-center gap-2">
                    {/* View Toggle */}
                    <div className="inline-flex rounded-lg border border-gray-300 bg-gray-100 p-0.5 shadow-sm">
                        <button
                            onClick={() => setView('structure')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'structure'
                                    ? 'bg-[#600018] text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                }`}
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            Structure
                        </button>
                        <button
                            onClick={() => setView('profiles')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'profiles'
                                    ? 'bg-[#600018] text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                }`}
                        >
                            <Users className="w-3.5 h-3.5" />
                            Profiles
                        </button>
                    </div>

                    {/* Zoom Controls */}
                    <div className="inline-flex items-center rounded-lg border border-gray-300 bg-gray-100 p-0.5 shadow-sm">
                        <button
                            onClick={handleZoomOut}
                            disabled={zoom <= ZOOM_MIN}
                            className="p-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Zoom out"
                        >
                            <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={handleResetZoom}
                            className="px-1.5 py-1 text-[10px] font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-md transition-all min-w-[40px] text-center"
                            title="Reset zoom"
                        >
                            {zoomPercent}%
                        </button>
                        <button
                            onClick={handleZoomIn}
                            disabled={zoom >= ZOOM_MAX}
                            className="p-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Zoom in"
                        >
                            <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Fullscreen Button */}
                    <button
                        onClick={toggleFullscreen}
                        className="inline-flex items-center p-1.5 rounded-lg border border-gray-300 bg-gray-100 shadow-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-all"
                        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>

            {/* Zoomable chart content */}
            <div
                className="w-full flex flex-col items-center origin-top transition-transform duration-200"
                style={{ transform: `scale(${zoom})` }}
            >
                {view === 'structure' ? <StructureView /> : <ProfilesView onOfficerClick={setSelectedOfficer} />}
            </div>

            {/* Officer Profile Modal */}
            <OfficerProfileModal
                officer={selectedOfficer}
                open={!!selectedOfficer}
                onClose={() => setSelectedOfficer(null)}
            />
        </div>
    );
};

export default OrgChart;
