export const MOCK_OFFICER_PROFILES = [
    {
        name: "James Joshua", jobTitle: "Acting Chief Executive Officer", email: "jjoshua@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-1001", joinedDate: "Jan 2015", division: "Office of the Chairman", unit: "Executive Division",
        summary: "Experienced executive leader overseeing the operations and strategic direction of the Securities Commission of Papua New Guinea. Responsible for regulatory oversight, stakeholder engagement, and organizational governance.",
        skills: ["Executive Leadership", "Regulatory Oversight", "Strategic Planning", "Governance", "Stakeholder Management"],
        reportsTo: null, reportsToTitle: null, directReports: 5, officeExtension: "x1001", timezone: "PGT (GMT+10)",
        statutoryDuty: "Under the Securities Commission Act 2015, the Chief Executive Officer is responsible for:\n\n• The day-to-day administration and management of the operations of the Commission.\n• The implementation of the policies of the Commission.\n• The exercise of such powers and performance of such duties as outlined in section 12(1) and delegated by the Commission.\n• Providing strategic advice to the Chairman and the Board on capital market development."
    },
    {
        name: "Andy Ambulu", jobTitle: "General Counsel", email: "aambulu@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-1002", joinedDate: "Mar 2016", division: "Office of the Chairman", unit: "Secretariat Unit",
        summary: "Senior legal professional providing counsel on regulatory and corporate matters. Advises on legal compliance, policy development, and institutional governance frameworks.",
        skills: ["Legal Advisory", "Corporate Governance", "Regulatory Compliance", "Policy Development"],
        reportsTo: "James Joshua", reportsToTitle: "Acting CEO", directReports: 1, officeExtension: "x1002", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Ninipe Gurumo", jobTitle: "Executive Officer", email: "ngurumo@scpng.gov.pg", phone: null,
        employeeId: "#EMP-1003", joinedDate: "Jun 2018", division: "Office of the Chairman", unit: "Secretariat Unit",
        summary: "Supports executive operations including coordination of meetings, communications, and administrative functions within the Executive Division.",
        skills: ["Executive Support", "Administration", "Communication", "Coordination"],
        reportsTo: "Andy Ambulu", reportsToTitle: "General Counsel", directReports: 0, officeExtension: "x1003", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Sam Taki", jobTitle: "Director Corporate Service", email: "staki@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-2001", joinedDate: "Feb 2014", division: "Corporate Services Division", unit: "Finance Unit",
        summary: "Oversees the Corporate Services Division including finance, IT, and human resource functions. Manages budgeting, financial reporting, and operational planning for the Commission.",
        skills: ["Financial Management", "Budgeting", "Corporate Planning", "Team Leadership", "Reporting"],
        reportsTo: "James Joshua", reportsToTitle: "Acting CEO", directReports: 8, officeExtension: "x2001", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Mercy Tipitap", jobTitle: "Senior Finance Officer", email: "mtipitap@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-2002", joinedDate: "Aug 2016", division: "Corporate Services Division", unit: "Finance Unit",
        summary: "Manages financial operations including accounts payable, receivable, and financial reconciliation. Supports annual budget preparation and audit processes.",
        skills: ["Financial Reporting", "Accounts Management", "Auditing", "Budget Preparation"],
        reportsTo: "Sam Taki", reportsToTitle: "Director Corporate Service", directReports: 2, officeExtension: "x2002", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Anita Kosnga", jobTitle: "Finance Officer", email: "akosnga@scpng.gov.pg", phone: "+675 3212223",
        employeeId: "#EMP-2003", joinedDate: "Jan 2019", division: "Corporate Services Division", unit: "Finance Unit",
        summary: "Handles day-to-day financial transactions, invoice processing, and assists with financial record maintenance and compliance reporting.",
        skills: ["Bookkeeping", "Invoice Processing", "Financial Records", "Compliance"],
        reportsTo: "Mercy Tipitap", reportsToTitle: "Senior Finance Officer", directReports: 0, officeExtension: "x2003", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Laviniah Michael", jobTitle: "Intern - Part-Time", email: "lmichael@scpng.gov.pg", phone: null,
        employeeId: "#EMP-2004", joinedDate: "Jul 2024", division: "Corporate Services Division", unit: "Finance Unit",
        summary: "Part-time intern assisting the Finance Unit with administrative tasks, data entry, and document filing to gain professional experience in financial services.",
        skills: ["Data Entry", "Administration", "Document Management"],
        reportsTo: "Anita Kosnga", reportsToTitle: "Finance Officer", directReports: 0, officeExtension: null, timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Eric Kipongi", jobTitle: "Manager Information Technology", email: "ekipongi@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-2010", joinedDate: "May 2015", division: "Corporate Services Division", unit: "IT Unit",
        summary: "Leads the Information Technology unit responsible for network infrastructure, systems administration, software development, and IT security for the Commission.",
        skills: ["IT Management", "Network Infrastructure", "Systems Administration", "IT Security", "Project Management"],
        reportsTo: "Sam Taki", reportsToTitle: "Director Corporate Service", directReports: 3, officeExtension: "x2010", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "John Sarwom", jobTitle: "Senior IT Database Officer", email: "jsarwom@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-2011", joinedDate: "Oct 2016", division: "Corporate Services Division", unit: "IT Unit",
        summary: "Manages database systems, ensures data integrity, and oversees database security protocols. Supports application development with backend data solutions.",
        skills: ["Database Administration", "SQL", "Data Security", "Backup & Recovery", "Performance Tuning"],
        reportsTo: "Eric Kipongi", reportsToTitle: "Manager IT", directReports: 0, officeExtension: "x2011", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Donald Sinogerel Samson", jobTitle: "IT Hardware Officer", email: "dsamson@scpng.gov.pg", phone: "3212223",
        employeeId: "#EMP-2012", joinedDate: "Mar 2018", division: "Corporate Services Division", unit: "IT Unit",
        summary: "Responsible for hardware procurement, maintenance, and support. Manages office equipment, workstation setup, and technical troubleshooting for all staff.",
        skills: ["Hardware Support", "Network Cabling", "Troubleshooting", "Equipment Procurement"],
        reportsTo: "Eric Kipongi", reportsToTitle: "Manager IT", directReports: 0, officeExtension: "x2012", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Monica Abau-Sapulai", jobTitle: "Senior Systems Analyst Consultant", email: "msapulai@scpng.gov.pg", phone: "+675 81620231",
        employeeId: "#EMP-2013", joinedDate: "Nov 2022", division: "Corporate Services Division", unit: "IT Unit",
        summary: "Provides expert consultation on systems analysis, application architecture, and digital transformation initiatives. Leads software development projects and intranet modernization.",
        skills: ["Systems Analysis", "Software Development", "React", "TypeScript", "Digital Transformation", "UX Design"],
        reportsTo: "Eric Kipongi", reportsToTitle: "Manager IT", directReports: 0, officeExtension: "x2013", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Thomas Mondaya", jobTitle: "Senior HR Officer", email: "tmondaya@scpng.gov.pg", phone: "+675 3212223",
        employeeId: "#EMP-2020", joinedDate: "Apr 2015", division: "Corporate Services Division", unit: "Human Resource Unit",
        summary: "Leads human resource operations including recruitment, performance management, staff welfare, and policy implementation across the Commission.",
        skills: ["HR Management", "Recruitment", "Performance Management", "Policy Development", "Staff Welfare"],
        reportsTo: "Sam Taki", reportsToTitle: "Director Corporate Service", directReports: 5, officeExtension: "x2020", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Lovelyn Karlyo", jobTitle: "Payroll Officer", email: "lkarlyo@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-2021", joinedDate: "Sep 2017", division: "Corporate Services Division", unit: "Human Resource Unit",
        summary: "Manages payroll processing, salary calculations, tax deductions, and ensures timely disbursement of employee compensation and benefits.",
        skills: ["Payroll Processing", "Tax Compliance", "Benefits Administration", "Financial Records"],
        reportsTo: "Thomas Mondaya", reportsToTitle: "Senior HR Officer", directReports: 0, officeExtension: "x2021", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Mark Timea", jobTitle: "Admin Officer", email: "mtimea@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-2022", joinedDate: "Jan 2018", division: "Corporate Services Division", unit: "Human Resource Unit",
        summary: "Provides administrative support including office management, correspondence handling, procurement coordination, and facilities management.",
        skills: ["Office Administration", "Procurement", "Correspondence", "Facilities Management"],
        reportsTo: "Thomas Mondaya", reportsToTitle: "Senior HR Officer", directReports: 0, officeExtension: "x2022", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Leah Samuel", jobTitle: "Divisional Secretary", email: "lsamuel@scpng.gov.pg", phone: "3212223",
        employeeId: "#EMP-2023", joinedDate: "Jun 2019", division: "Corporate Services Division", unit: "Human Resource Unit",
        summary: "Provides secretarial support to the Corporate Services Division including scheduling, minute-taking, correspondence, and document management.",
        skills: ["Secretarial Support", "Scheduling", "Minute Taking", "Document Management"],
        reportsTo: "Thomas Mondaya", reportsToTitle: "Senior HR Officer", directReports: 0, officeExtension: "x2023", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Sophia Marai", jobTitle: "Receptionist", email: "smarai@scpng.gov.pg", phone: "+675 70118699",
        employeeId: "#EMP-2024", joinedDate: "Feb 2020", division: "Corporate Services Division", unit: "Human Resource Unit",
        summary: "Front desk management including visitor reception, call routing, mail distribution, and general enquiry handling for the Commission.",
        skills: ["Reception", "Customer Service", "Call Management", "Mail Distribution"],
        reportsTo: "Thomas Mondaya", reportsToTitle: "Senior HR Officer", directReports: 0, officeExtension: "x2024", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Lenome Rex MBalupa", jobTitle: "Administrative Driver", email: "lrmbalupa@scpng.gov.pg", phone: "3212223",
        employeeId: "#EMP-2025", joinedDate: "Aug 2017", division: "Corporate Services Division", unit: "Human Resource Unit",
        summary: "Provides transportation services for Commission staff and visitors. Responsible for vehicle maintenance, logistics coordination, and safe transport operations.",
        skills: ["Driving", "Vehicle Maintenance", "Logistics", "Safety Compliance"],
        reportsTo: "Thomas Mondaya", reportsToTitle: "Senior HR Officer", directReports: 0, officeExtension: null, timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Leeroy Wambillie", jobTitle: "Senior Licensing Officer", email: "lwambillie@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-3001", joinedDate: "Jul 2016", division: "Licensing, Market & Supervision Division", unit: "Licensing Unit",
        summary: "Manages the licensing process for capital market participants including application review, compliance assessment, and license issuance for securities dealers and investment advisors.",
        skills: ["Licensing", "Regulatory Compliance", "Capital Markets", "Application Assessment"],
        reportsTo: "James Joshua", reportsToTitle: "Acting CEO", directReports: 1, officeExtension: "x3001", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Kylie Karis", jobTitle: "Licensing Officer", email: "kkaris@scpng.gov.pg", phone: "3212223",
        employeeId: "#EMP-3002", joinedDate: "Nov 2019", division: "Licensing, Market & Supervision Division", unit: "Licensing Unit",
        summary: "Supports licensing operations including processing applications, maintaining license registers, and conducting preliminary compliance checks.",
        skills: ["License Processing", "Compliance Checks", "Records Management", "Reporting"],
        reportsTo: "Leeroy Wambillie", reportsToTitle: "Senior Licensing Officer", directReports: 0, officeExtension: "x3002", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Regina Wai", jobTitle: "Senior Supervision Officer", email: "rwai@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-3010", joinedDate: "Mar 2017", division: "Licensing, Market & Supervision Division", unit: "Supervision Unit",
        summary: "Conducts supervisory oversight of licensed entities ensuring compliance with securities regulations, conducts on-site inspections, and monitors market participant activities.",
        skills: ["Supervision", "On-site Inspection", "Regulatory Monitoring", "Risk Assessment", "Compliance"],
        reportsTo: "James Joshua", reportsToTitle: "Acting CEO", directReports: 0, officeExtension: "x3010", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Zomay Apini", jobTitle: "Market Data Manager", email: "zapini@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-3020", joinedDate: "Sep 2015", division: "Licensing, Market & Supervision Division", unit: "Market Data Unit",
        summary: "Manages the collection, analysis, and dissemination of capital market data. Oversees market surveillance and produces statistical reports on market performance.",
        skills: ["Market Analysis", "Data Management", "Statistical Reporting", "Market Surveillance", "Data Visualization"],
        reportsTo: "James Joshua", reportsToTitle: "Acting CEO", directReports: 1, officeExtension: "x3020", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Esther Alia", jobTitle: "Market Data Officer", email: "ealia@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-3021", joinedDate: "Apr 2020", division: "Licensing, Market & Supervision Division", unit: "Market Data Unit",
        summary: "Supports market data operations including data collection, database updates, and preparation of market statistics and performance indicators.",
        skills: ["Data Collection", "Database Management", "Statistics", "Report Preparation"],
        reportsTo: "Zomay Apini", reportsToTitle: "Market Data Manager", directReports: 0, officeExtension: "x3021", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Jacob Kom", jobTitle: "Senior Investigations Officer", email: "jkom@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-3030", joinedDate: "Jan 2017", division: "Licensing, Market & Supervision Division", unit: "Investigations Unit",
        summary: "Leads investigation of suspected securities law violations, market misconduct, and fraud. Conducts evidence gathering, interviews, and prepares investigation reports for enforcement action.",
        skills: ["Investigation", "Evidence Analysis", "Securities Law", "Fraud Detection", "Report Writing"],
        reportsTo: "James Joshua", reportsToTitle: "Acting CEO", directReports: 0, officeExtension: "x3030", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Tyson Yapao", jobTitle: "Legal Manager - Compliance & Enforcement", email: "tyapao@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-4001", joinedDate: "May 2015", division: "Legal Services Division", unit: "Legal Advisory Unit",
        summary: "Manages the legal compliance and enforcement framework. Leads enforcement actions, manages litigation, and advises on regulatory reform and legislative amendments.",
        skills: ["Legal Compliance", "Enforcement", "Litigation", "Regulatory Reform", "Legislative Drafting"],
        reportsTo: "James Joshua", reportsToTitle: "Acting CEO", directReports: 3, officeExtension: "x4001", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Isaac Mel", jobTitle: "Senior Legal Officer", email: "imel@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-4002", joinedDate: "Aug 2017", division: "Legal Services Division", unit: "Legal Advisory Unit",
        summary: "Provides legal advisory services on securities regulation, contract review, and enforcement matters. Assists in drafting legal opinions and regulatory instruments.",
        skills: ["Legal Advisory", "Contract Review", "Securities Regulation", "Legal Drafting"],
        reportsTo: "Tyson Yapao", reportsToTitle: "Legal Manager", directReports: 0, officeExtension: "x4002", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Tony Kawas", jobTitle: "Senior Legal Officer", email: "tkawas@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-4003", joinedDate: "Feb 2018", division: "Legal Services Division", unit: "Legal Advisory Unit",
        summary: "Handles legal research, case preparation, and provides legal support on compliance and enforcement activities. Reviews market participant submissions for legal compliance.",
        skills: ["Legal Research", "Case Preparation", "Compliance Review", "Enforcement Support"],
        reportsTo: "Tyson Yapao", reportsToTitle: "Legal Manager", directReports: 0, officeExtension: "x4003", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Immanuel Minoga", jobTitle: "Legal Officer", email: "iminoga@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-4004", joinedDate: "Oct 2020", division: "Legal Services Division", unit: "Legal Advisory Unit",
        summary: "Supports the legal team with document preparation, legal filing, correspondence, and basic legal research on regulatory matters.",
        skills: ["Legal Support", "Document Preparation", "Filing", "Legal Research"],
        reportsTo: "Tyson Yapao", reportsToTitle: "Legal Manager", directReports: 0, officeExtension: "x4004", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Max Siwi", jobTitle: "Senior Research Officer", email: "msiwi@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-5001", joinedDate: "Jun 2016", division: "Research & Publication Division", unit: "Research Unit",
        summary: "Conducts research on capital market trends, policy analysis, and regulatory impact assessments. Produces research papers and policy briefs to inform Commission decision-making.",
        skills: ["Research", "Policy Analysis", "Capital Markets", "Report Writing", "Data Analysis"],
        reportsTo: "Joy Komba", reportsToTitle: "Director Research & Publication", directReports: 0, officeExtension: "x5001", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Rosie Stevenou", jobTitle: "Publication Officer", email: "rstevenou@scpng.gov.pg", phone: "3212223",
        employeeId: "#EMP-5010", joinedDate: "Dec 2018", division: "Research & Publication Division", unit: "Publication Unit",
        summary: "Manages publication of Commission reports, newsletters, annual reports, and public awareness materials. Coordinates printing, distribution, and digital publishing.",
        skills: ["Publication", "Desktop Publishing", "Content Editing", "Distribution", "Public Awareness"],
        reportsTo: "Joy Komba", reportsToTitle: "Director Research & Publication", directReports: 0, officeExtension: "x5010", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    },
    {
        name: "Joy Komba", jobTitle: "Director Research & Publication", email: "jkomba@scpng.gov.pg", phone: "+675 321 2223",
        employeeId: "#EMP-5000", joinedDate: "Mar 2014", division: "Research & Publication Division", unit: "Director",
        summary: "Directs the Research & Publication Division overseeing all research initiatives, publications, and public communication activities of the Commission.",
        skills: ["Research Management", "Publication Oversight", "Strategic Communication", "Team Leadership", "Policy Research"],
        reportsTo: "James Joshua", reportsToTitle: "Acting CEO", directReports: 2, officeExtension: "x5000", timezone: "PGT (GMT+10)",
        statutoryDuty: null
    }
];
