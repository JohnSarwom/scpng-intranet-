/**
 * Mock Performance Data Generator
 * Generates realistic KRAs, KPIs, and Tasks for staff members
 * with proper linkages to Strategic Objectives and deliverables
 */

import { Kra, Kpi, Task } from '@/types';

// Staff member interface matching the provided data
export interface StaffMember {
    id: string;
    displayName: string;
    jobTitle: string;
    department: string;
    officeLocation: string;
    mail: string;
    divisionId: string;
}

// Strategic Objective structure
export interface StrategicObjective {
    id: string | number;
    title: string;
    description?: string;
    deliverables?: string[];
    division?: string;
    goalType?: string;
}

// Role-based KRA templates
const KRA_TEMPLATES = {
    'IT': [
        'System Infrastructure Maintenance',
        'Database Performance Optimization',
        'Network Security Enhancement',
        'Software Development & Deployment',
        'IT Support & Help Desk Management',
        'Cloud Services Migration',
        'Cybersecurity Compliance',
        'IT Asset Management',
        'Backup & Disaster Recovery',
        'User Training & Documentation'
    ],
    'Legal': [
        'Contract Review & Drafting',
        'Compliance Monitoring & Reporting',
        'Legal Research & Analysis',
        'Litigation Management',
        'Regulatory Advisory Services',
        'Corporate Governance Support',
        'Intellectual Property Management',
        'Legal Risk Assessment',
        'Policy Development & Review',
        'Stakeholder Legal Consultation'
    ],
    'Finance': [
        'Budget Planning & Analysis',
        'Financial Reporting & Compliance',
        'Audit Preparation & Coordination',
        'Accounts Payable Management',
        'Accounts Receivable Management',
        'Financial Forecasting',
        'Cost Control & Optimization',
        'Treasury Management',
        'Tax Compliance & Planning',
        'Financial Systems Management'
    ],
    'HR': [
        'Recruitment & Onboarding',
        'Performance Management System',
        'Training & Development Programs',
        'Employee Relations Management',
        'Compensation & Benefits Administration',
        'HR Policy Development',
        'Workforce Planning',
        'Employee Engagement Initiatives',
        'HR Compliance & Reporting',
        'Talent Retention Strategies'
    ],
    'Research': [
        'Market Research & Analysis',
        'Policy Research & Recommendations',
        'Data Collection & Analysis',
        'Research Report Writing',
        'Stakeholder Survey Management',
        'Industry Trend Analysis',
        'Research Methodology Development',
        'Academic Partnership Management',
        'Research Publication Management',
        'Knowledge Management Systems'
    ],
    'Publication': [
        'Content Creation & Editing',
        'Publication Schedule Management',
        'Design & Layout Coordination',
        'Digital Publishing Platform',
        'Newsletter Distribution',
        'Media Relations Management',
        'Brand Guidelines Compliance',
        'Publication Quality Assurance',
        'Archive Management',
        'Stakeholder Communication Materials'
    ],
    'Licensing': [
        'License Application Processing',
        'Compliance Verification',
        'License Renewal Management',
        'Regulatory Framework Updates',
        'Stakeholder Consultation',
        'License Database Management',
        'Fee Collection & Reconciliation',
        'License Audit & Review',
        'Policy Implementation',
        'Industry Liaison Management'
    ],
    'Market Data': [
        'Market Data Collection',
        'Data Validation & Quality Control',
        'Market Analysis & Reporting',
        'Database Management',
        'Stakeholder Data Requests',
        'Market Surveillance',
        'Data Visualization & Dashboards',
        'Regulatory Reporting',
        'Data Security & Privacy',
        'Market Trends Analysis'
    ],
    'Supervision': [
        'Regulatory Supervision Activities',
        'Compliance Monitoring',
        'Risk Assessment & Analysis',
        'Inspection & Examination',
        'Supervisory Reporting',
        'Enforcement Action Management',
        'Industry Engagement',
        'Supervisory Framework Development',
        'Market Conduct Review',
        'Prudential Supervision'
    ],
    'Investigations': [
        'Case Investigation Management',
        'Evidence Collection & Analysis',
        'Investigation Report Writing',
        'Stakeholder Interviews',
        'Forensic Analysis',
        'Investigation Database Management',
        'Legal Coordination',
        'Investigation Policy Development',
        'Case File Management',
        'Investigation Training'
    ],
    'Secretariat': [
        'Board Meeting Coordination',
        'Minutes & Documentation',
        'Stakeholder Communication',
        'Calendar Management',
        'Document Control & Filing',
        'Meeting Logistics',
        'Executive Support Services',
        'Information Management',
        'Protocol & Procedures',
        'Correspondence Management'
    ],
    'Executive': [
        'Strategic Planning & Execution',
        'Organizational Leadership',
        'Stakeholder Relationship Management',
        'Policy Direction & Oversight',
        'Performance Monitoring',
        'Risk Management Oversight',
        'Corporate Governance',
        'Change Management',
        'Resource Allocation',
        'Executive Reporting'
    ],
    'Admin': [
        'Office Administration',
        'Facility Management',
        'Procurement & Supplies',
        'Records Management',
        'Reception & Front Desk',
        'Mail & Correspondence',
        'Office Equipment Maintenance',
        'Vendor Management',
        'Administrative Support',
        'Office Coordination'
    ]
};

// KPI templates for each KRA type
const KPI_TEMPLATES = {
    metrics: ['Completion Rate', 'Quality Score', 'Efficiency Rating', 'Compliance Level', 'Stakeholder Satisfaction'],
    units: ['%', 'Score', 'Days', 'Count', 'Rating'],
    targets: [80, 85, 90, 95, 100]
};

// Task templates
const TASK_TEMPLATES = [
    'Review and update documentation',
    'Conduct stakeholder meeting',
    'Prepare monthly report',
    'Complete compliance checklist',
    'Analyze performance data',
    'Coordinate with team members',
    'Submit quarterly review',
    'Update system records',
    'Prepare presentation materials',
    'Conduct quality assurance check'
];

// Status distributions for realistic data
const STATUS_DISTRIBUTION = {
    kra: ['on-track', 'on-track', 'on-track', 'at-risk', 'completed'],
    kpi: ['in-progress', 'in-progress', 'in-progress', 'completed', 'on-track', 'at-risk'],
    task: ['in-progress', 'in-progress', 'todo', 'done', 'in-review']
};

const PRIORITY_DISTRIBUTION = ['high', 'high', 'medium', 'medium', 'medium', 'low'];

/**
 * Determine role category from job title and department
 */
function getRoleCategory(staff: StaffMember): string {
    const title = staff.jobTitle.toLowerCase();
    const dept = staff.department.toLowerCase();

    if (title.includes('it ') || title.includes('information technology') || dept.includes('it ')) return 'IT';
    if (title.includes('legal') || title.includes('counsel') || dept.includes('legal')) return 'Legal';
    if (title.includes('finance') || title.includes('payroll') || dept.includes('finance')) return 'Finance';
    if (title.includes('hr ') || title.includes('human resource') || dept.includes('human resource')) return 'HR';
    if (title.includes('research') || dept.includes('research')) return 'Research';
    if (title.includes('publication') || dept.includes('publication')) return 'Publication';
    if (title.includes('licensing') || dept.includes('licensing')) return 'Licensing';
    if (title.includes('market data') || dept.includes('market data')) return 'Market Data';
    if (title.includes('supervision') || dept.includes('supervision')) return 'Supervision';
    if (title.includes('investigation') || dept.includes('investigation')) return 'Investigations';
    if (title.includes('secretariat') || dept.includes('secretariat')) return 'Secretariat';
    if (title.includes('ceo') || title.includes('executive') || title.includes('director')) return 'Executive';
    if (title.includes('admin') || title.includes('receptionist') || title.includes('driver')) return 'Admin';

    return 'Admin'; // Default
}

/**
 * Get random item from array
 */
function randomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get random number in range
 */
function randomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random date within current year
 */
function randomDate(start: Date, end: Date): string {
    const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return date.toISOString().split('T')[0];
}

/**
 * Generate 10 KRAs for a staff member
 */
export function generateKRAsForStaff(
    staff: StaffMember,
    strategicObjectives: StrategicObjective[],
    startId: number
): Kra[] {
    const roleCategory = getRoleCategory(staff);
    const templates = KRA_TEMPLATES[roleCategory as keyof typeof KRA_TEMPLATES] || KRA_TEMPLATES.Admin;

    // Filter objectives by division if possible
    const divisionObjectives = strategicObjectives.filter(obj =>
        obj.division === staff.officeLocation || obj.goalType === 'Org'
    );

    const objectivesToUse = divisionObjectives.length > 0 ? divisionObjectives : strategicObjectives;

    const kras: Kra[] = [];
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);

    for (let i = 0; i < 10; i++) {
        const objective = objectivesToUse[i % objectivesToUse.length];
        const template = templates[i];

        const startDate = randomDate(yearStart, new Date());
        const endDate = randomDate(new Date(), yearEnd);

        const kra: Kra = {
            id: `MOCK_KRA_${startId + i}`,
            title: `[MOCK] ${template}`,
            description: `Mock KRA for ${staff.displayName} - ${template} (ID:MOCK_KRA_${startId + i})`,
            objective_id: objective?.id || null,
            department: staff.officeLocation,
            unit: staff.department,
            unitId: null,
            startDate,
            start_date: startDate,
            targetDate: endDate,
            target_date: endDate,
            status: randomItem(STATUS_DISTRIBUTION.kra) as any,
            owner: {
                id: staff.id,
                name: staff.displayName,
                email: staff.mail
            },
            ownerId: staff.id,
            unitKpis: [],
            unitObjectives: objective ? { title: objective.title } : null
        };

        kras.push(kra);
    }

    return kras;
}

/**
 * Generate 10 KPIs for a staff member's KRAs
 */
export function generateKPIsForStaff(
    staff: StaffMember,
    kras: Kra[],
    startId: number
): Kpi[] {
    const kpis: Kpi[] = [];

    kras.forEach((kra, index) => {
        const metric = randomItem(KPI_TEMPLATES.metrics);
        const unit = randomItem(KPI_TEMPLATES.units);
        const target = randomItem(KPI_TEMPLATES.targets);
        const actual = randomNumber(0, target);
        const progress = Math.round((actual / target) * 100);

        const kpi: Kpi = {
            id: `MOCK_KPI_${startId + index}`,
            kra_id: kra.id,
            name: `[MOCK] ${metric}`, // Simplified name
            description: `Mock KPI for ${staff.displayName} (ID:MOCK_KPI_${startId + index})`,
            target,
            actual,
            metric,
            unit,
            progress,
            status: randomItem(STATUS_DISTRIBUTION.kpi) as any,
            startDate: kra.startDate,
            start_date: kra.startDate,
            targetDate: kra.targetDate,
            target_date: kra.targetDate,
            assignees: [{
                id: staff.id,
                name: staff.displayName,
                email: staff.mail
            }],
            comments: `Generated mock data for testing`,
            costAssociated: randomNumber(1000, 50000)
        };

        kpis.push(kpi);
    });

    return kpis;
}

/**
 * Generate 10 Tasks for a staff member's KPIs
 */
export function generateTasksForStaff(
    staff: StaffMember,
    kpis: Kpi[],
    startId: number
): Task[] {
    const tasks: Task[] = [];

    kpis.forEach((kpi, index) => {
        const template = randomItem(TASK_TEMPLATES);
        const priority = randomItem(PRIORITY_DISTRIBUTION) as 'low' | 'medium' | 'high' | 'urgent';
        const status = randomItem(STATUS_DISTRIBUTION.task) as 'todo' | 'in-progress' | 'in-review' | 'done';

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + randomNumber(1, 90));

        const task: Task = {
            id: `MOCK_TASK_${startId + index}`,
            title: `[MOCK] ${template}`,
            description: `Mock task for ${staff.displayName} (ID:MOCK_TASK_${startId + index})`,
            status,
            priority,
            assignee: staff.displayName,
            assignedTo: staff.mail,
            dueDate: dueDate.toISOString().split('T')[0],
            startDate: new Date(),
            kpi_id: kpi.id.toString(),
            kra_id: kpi.kra_id?.toString(),
            unit_id: staff.department,
            completionPercentage: status === 'done' ? 100 : randomNumber(0, 90),
            completed: status === 'done',
            tags: ['mock-data', 'testing']
        };

        tasks.push(task);
    });

    return tasks;
}

/**
 * Generate all mock data for all staff members
 */
export function generateAllMockData(
    staffMembers: StaffMember[],
    strategicObjectives: StrategicObjective[]
): {
    kras: Kra[];
    kpis: Kpi[];
    tasks: Task[];
    summary: {
        totalStaff: number;
        totalKRAs: number;
        totalKPIs: number;
        totalTasks: number;
        byDivision: Record<string, { kras: number; kpis: number; tasks: number }>;
    };
} {
    const allKras: Kra[] = [];
    const allKpis: Kpi[] = [];
    const allTasks: Task[] = [];
    const byDivision: Record<string, { kras: number; kpis: number; tasks: number }> = {};

    staffMembers.forEach((staff, staffIndex) => {
        // Generate KRAs
        const kras = generateKRAsForStaff(staff, strategicObjectives, staffIndex * 10);
        allKras.push(...kras);

        // Generate KPIs
        const kpis = generateKPIsForStaff(staff, kras, staffIndex * 10);
        allKpis.push(...kpis);

        // Generate Tasks
        const tasks = generateTasksForStaff(staff, kpis, staffIndex * 10);
        allTasks.push(...tasks);

        // Track by division
        const division = staff.officeLocation;
        if (!byDivision[division]) {
            byDivision[division] = { kras: 0, kpis: 0, tasks: 0 };
        }
        byDivision[division].kras += kras.length;
        byDivision[division].kpis += kpis.length;
        byDivision[division].tasks += tasks.length;
    });

    return {
        kras: allKras,
        kpis: allKpis,
        tasks: allTasks,
        summary: {
            totalStaff: staffMembers.length,
            totalKRAs: allKras.length,
            totalKPIs: allKpis.length,
            totalTasks: allTasks.length,
            byDivision
        }
    };
}

// ============================================================
// SCPNG OFFICER OPERATIONAL DATA — REALISTIC SEEDING
// ============================================================

export const SCPNG_STAFF_DATA: StaffMember[] = [
    { id: '6ffa0467-b3cd-49e5-a672-f02542cce241', displayName: 'Andy Ambulu', jobTitle: 'General Counsel', department: 'Secretariat Unit', officeLocation: 'Executive Division', mail: 'aambulu@scpng.gov.pg', divisionId: 'executive-division' },
    { id: '4172b54b-970b-49c7-ad32-772d010ca186', displayName: 'Anita Kosnga', jobTitle: 'Finance Officer', department: 'Finance Unit', officeLocation: 'Corporate Services Division', mail: 'akosnga@scpng.gov.pg', divisionId: 'corporate-services-division' },
    { id: '0ca1b0dc-b1a0-4117-838f-96e4d5556ed2', displayName: 'Donald Sinogerel Samson', jobTitle: 'IT Hardware Officer', department: 'IT Unit', officeLocation: 'Corporate Services Division', mail: 'dsamson@scpng.gov.pg', divisionId: 'corporate-services-division' },
    { id: 'a854cc0f-4ea7-494f-9533-e28607f60457', displayName: 'Esther Alia', jobTitle: 'Market Data Officer', department: 'Market Data Unit', officeLocation: 'Licensing Market & Supervision Division', mail: 'ealia@scpng.gov.pg', divisionId: 'licensing-market-and-supervision-division' },
    { id: '964b2fa5-6d18-49a9-beb6-0cd76ed15649', displayName: 'Eric Kipongi', jobTitle: 'Manager Information Technology', department: 'IT Unit', officeLocation: 'Corporate Services Division', mail: 'ekipongi@scpng.gov.pg', divisionId: 'corporate-services-division' },
    { id: '4f58c6c5-d256-46a7-8e87-6ed8e8d14a8e', displayName: 'Isaac Mel', jobTitle: 'Senior Legal Officer', department: 'Legal Advisory Unit', officeLocation: 'Legal Services Division', mail: 'imel@scpng.gov.pg', divisionId: 'legal-services-division' },
    { id: '022d27d0-94e2-4475-aa64-fd1e51f3babe', displayName: 'Immanuel Minoga', jobTitle: 'Legal Officer', department: 'Legal Advisory Unit', officeLocation: 'Legal Services Division', mail: 'iminoga@scpng.gov.pg', divisionId: 'legal-services-division' },
    { id: '5054fc13-d2d9-415a-8665-4337f0e9be14', displayName: 'James Joshua', jobTitle: 'Acting Chief Executive Officer', department: 'Executive Division', officeLocation: 'Office of the Chairman', mail: 'jjoshua@scpng.gov.pg', divisionId: 'office-of-the-chairman' },
    { id: 'b7d5a3a0-03f4-4ba6-b523-6ee05268872d', displayName: 'Jacob Kom', jobTitle: 'Senior Investigations Officer', department: 'Investigations Unit', officeLocation: 'Licensing Market & Supervision Division', mail: 'jkom@scpng.gov.pg', divisionId: 'licensing-market-and-supervision-division' },
    { id: 'e0babe2a-9857-4e17-94ea-ff401bc4e67a', displayName: 'Joy Komba', jobTitle: 'Director Research & Publication', department: 'Research & Publication', officeLocation: 'Research & Publication Division', mail: 'jkomba@scpng.gov.pg', divisionId: 'research-and-publication' },
    { id: '9abd00cb-236a-44c9-9159-8e335dd526c4', displayName: 'John Sarwom', jobTitle: 'Senior IT Database Officer', department: 'IT Unit', officeLocation: 'Corporate Services Division', mail: 'jsarwom@scpng.gov.pg', divisionId: 'corporate-services-division' },
    { id: 'd37c360a-d768-4bce-b773-bba3f204421a', displayName: 'Kylie Karis', jobTitle: 'Licensing Officer', department: 'Licensing Unit', officeLocation: 'Licensing Market & Supervision Division', mail: 'kkaris@scpng.gov.pg', divisionId: 'licensing-market-and-supervision-division' },
    { id: '502a77d2-6a4d-4c93-b099-3a568964a10a', displayName: 'Lovelyn Karlyo', jobTitle: 'Payroll Officer', department: 'Human Resource Unit', officeLocation: 'Corporate Services Division', mail: 'lkarlyo@scpng.gov.pg', divisionId: 'corporate-services-division' },
    { id: '2fc6ed38-b2b0-491e-b7e7-d604da7ffaf5', displayName: 'Laviniah Michael', jobTitle: 'Intern - Part-Time', department: 'Finance Unit', officeLocation: 'Corporate Services Division', mail: 'lmichael@scpng.gov.pg', divisionId: 'corporate-services-division' },
    { id: 'e1487d21-b03d-4132-b072-d11f0cfe8827', displayName: 'Lenome Rex MBalupa', jobTitle: 'Administrative Driver', department: 'Human Resource Unit', officeLocation: 'Corporate Services Division', mail: 'lrmbalupa@scpng.gov.pg', divisionId: 'corporate-services-division' },
    { id: '4be2e23e-3155-404e-bdee-3ff1788f8c45', displayName: 'Leah Samuel', jobTitle: 'Divisional Secretary', department: 'Human Resource Unit', officeLocation: 'Corporate Services Division', mail: 'lsamuel@scpng.gov.pg', divisionId: 'corporate-services-division' },
    { id: '63cd73d1-9c61-4243-9374-81c15a950e48', displayName: 'Leeroy Wambillie', jobTitle: 'Senior Licensing Officer', department: 'Licensing Unit', officeLocation: 'Licensing Market & Supervision Division', mail: 'lwambillie@scpng.gov.pg', divisionId: 'licensing-market-and-supervision-division' },
    { id: 'c31d2e4b-3e6e-4c3d-baa1-bacbc26c2559', displayName: 'Monica Abau-Sapulai', jobTitle: 'Senior Systems Analyst Consultant', department: 'IT Unit', officeLocation: 'Corporate Services Division', mail: 'msapulai@scpng.gov.pg', divisionId: 'corporate-services-division' },
    { id: '0f244ff4-b771-4a0f-b7c4-8b9eede9c64a', displayName: 'Max Siwi', jobTitle: 'Senior Research Officer', department: 'Research Unit', officeLocation: 'Research and Publication Division', mail: 'msiwi@scpng.gov.pg', divisionId: 'research-and-publication-division' },
    { id: '6b1fdd2a-3b1d-4f68-963b-ea98821d4492', displayName: 'Mark Timea', jobTitle: 'Admin Officer', department: 'Human Resource Unit', officeLocation: 'Corporate Services Division', mail: 'mtimea@scpng.gov.pg', divisionId: 'corporate-services-division' },
    { id: '7e72f564-a7e3-4080-b71b-ce5e63f0d05a', displayName: 'Mercy Tipitap', jobTitle: 'Senior Finance Officer', department: 'Finance Unit', officeLocation: 'Corporate Services Division', mail: 'mtipitap@scpng.gov.pg', divisionId: 'corporate-services-division' },
    { id: '15c87d01-24ee-489b-b26f-346695bea317', displayName: 'Ninipe Gurumo', jobTitle: 'Executive Officer', department: 'Secretariat Unit', officeLocation: 'Executive Division', mail: 'ngurumo@scpng.gov.pg', divisionId: 'executive-division' },
    { id: '06adbdb2-0558-43ba-8a12-c6ad1db6be70', displayName: 'Rosie Stevenou', jobTitle: 'Publication Officer', department: 'Publication Unit', officeLocation: 'Research and Publication Division', mail: 'rstevenou@scpng.gov.pg', divisionId: 'research-and-publication-division' },
    { id: '8728d5a8-2b0c-46ce-9f68-1be487c12242', displayName: 'Regina Wai', jobTitle: 'Senior Supervision Officer', department: 'Supervision Unit', officeLocation: 'Licensing Market & Supervision Division', mail: 'rwai@scpng.gov.pg', divisionId: 'licensing-market-and-supervision-division' },
    { id: '7b267d84-b375-48c5-905e-6148f4655c9e', displayName: 'Sophia Marai', jobTitle: 'Receptionist', department: 'Human Resource Unit', officeLocation: 'Corporate Services Division', mail: 'smarai@scpng.gov.pg', divisionId: 'corporate-services-division' },
    { id: 'c7150f91-439b-4940-9908-8bb7d8d39870', displayName: 'Sam Taki', jobTitle: 'Director Corporate Service', department: 'Finance Unit', officeLocation: 'Corporate Services Division', mail: 'staki@scpng.gov.pg', divisionId: 'corporate-services-division' },
    { id: 'f126f065-39b4-4d28-b250-d2af8ac70e1e', displayName: 'Tony Kawas', jobTitle: 'Senior Legal Officer', department: 'Legal Advisory Unit', officeLocation: 'Legal Services Division', mail: 'tkawas@scpng.gov.pg', divisionId: 'legal-services-division' },
    { id: '3ba88b66-7a5e-41e3-9ecd-1a7bfa9da321', displayName: 'Thomas Mondaya', jobTitle: 'Senior HR Officer', department: 'Human Resource Unit', officeLocation: 'Corporate Services Division', mail: 'tmondaya@scpng.gov.pg', divisionId: 'corporate-services-division' },
    { id: 'df1cc159-957b-4636-a82e-ce3bebc6b884', displayName: 'Tyson Yapao', jobTitle: 'Legal Manager - Compliance & Enforcement', department: 'Legal Advisory Unit', officeLocation: 'Legal Services Division', mail: 'tyapao@scpng.gov.pg', divisionId: 'legal-services-division' },
    { id: '97df4788-8283-4cb4-b061-84d73462e732', displayName: 'Zomay Apini', jobTitle: 'Market Data Manager', department: 'Market Data Unit', officeLocation: 'Licensing Market & Supervision Division', mail: 'zapini@scpng.gov.pg', divisionId: 'licensing-market-and-supervision-division' },
];

// 2 KRAs per role category — specific to SCPNG units
const OFFICER_KRA_TEMPLATES: Record<string, Array<{ title: string; description: string }>> = {
    'IT': [
        { title: 'Network Infrastructure & Systems Administration', description: 'Maintain, upgrade, and secure SCPNG network infrastructure, servers, and end-user computing environment to ensure high availability and operational continuity.' },
        { title: 'Digital Transformation & Intranet Development', description: 'Develop and enhance SCPNG digital platforms, SharePoint intranet, and automated workflows to improve organisational efficiency and staff productivity.' },
    ],
    'Finance': [
        { title: 'Financial Reporting & Statutory Compliance', description: 'Produce accurate and timely financial reports in compliance with PFMA, IPSAS, and audit requirements across all SCPNG divisions.' },
        { title: 'Budget Management & Expenditure Control', description: 'Plan, monitor, and control SCPNG annual budget to ensure fiscal discipline and optimal allocation of resources across all divisions.' },
    ],
    'HR': [
        { title: 'Workforce Management & HR Compliance', description: 'Manage recruitment, performance appraisal, payroll, and staff welfare programs in line with PNG Government Public Service HR policies and standards.' },
        { title: 'Staff Development & Organisational Capability', description: 'Design and implement training and development programs to build staff capability and support SCPNG strategic objectives across all divisions.' },
    ],
    'Legal': [
        { title: 'Legal Compliance & Enforcement Operations', description: 'Provide timely legal advisory services, manage enforcement matters, and ensure regulatory compliance across SCPNG statutory mandate.' },
        { title: 'Legislative Reform & Regulatory Framework Development', description: 'Lead the review and amendment of the Securities Commission Act and Capital Market Act to strengthen the PNG regulatory framework.' },
    ],
    'Market Data': [
        { title: 'Capital Market Data Management & Surveillance', description: 'Collect, validate, and disseminate capital market data from PNGX and licensed participants, and monitor market activity for unusual trading patterns.' },
        { title: 'Statistical Reporting & Market Analysis', description: 'Produce comprehensive market statistics, quarterly bulletins, and analytical reports to support stakeholder decision-making and regulatory oversight.' },
    ],
    'Licensing': [
        { title: 'License Application Processing & Issuance', description: 'Assess, process, and determine license applications from securities dealers, investment advisors, and fund managers in a timely and consistent manner.' },
        { title: 'Licensee Compliance Monitoring & Register Maintenance', description: 'Monitor ongoing compliance of all licensed entities and maintain the accuracy of the public register of licensed PNG capital market participants.' },
    ],
    'Supervision': [
        { title: 'Market Participant Oversight & Supervisory Review', description: 'Conduct risk-based off-site and on-site reviews of supervised market participants to assess financial soundness and regulatory compliance.' },
        { title: 'Systemic Risk Assessment & Supervisory Framework', description: 'Develop and apply a risk-based supervision framework to identify, assess, and respond to systemic risks across the PNG capital market.' },
    ],
    'Investigations': [
        { title: 'Securities Law Violation Investigation & Enforcement', description: 'Investigate complaints and referrals of securities law violations, insider trading, and market manipulation to support SCPNG enforcement mandate.' },
        { title: 'Market Misconduct Detection & Forensic Analysis', description: 'Conduct proactive surveillance and forensic analysis of trading records to detect and respond to market misconduct in the PNG capital market.' },
    ],
    'Research': [
        { title: 'Capital Market Research & Policy Analysis', description: 'Produce high-quality research papers and policy briefs on PNG capital market development, regulatory impact, and economic trends.' },
        { title: 'International Regulatory Engagement & Knowledge Management', description: 'Engage with international regulatory bodies and ADB/IFC technical assistance programs, and maintain SCPNG regulatory knowledge base.' },
    ],
    'Publication': [
        { title: 'Investor Education Content & Publication Management', description: 'Develop, produce, and distribute investor education materials, commission publications, and regulatory communications to the PNG public.' },
        { title: 'Digital Media & Social Media Expansion Strategy', description: 'Expand SCPNG digital presence across social media platforms targeting 2-3 million followers through the Invest Smart PNG campaign.' },
    ],
    'Secretariat': [
        { title: 'Strategic Planning & Organisational Governance', description: 'Support the development and implementation of SCPNG Strategic Plan 2025-2030 and ensure effective corporate governance and Board operations.' },
        { title: 'Stakeholder Engagement & Board Relations Management', description: 'Manage relationships with the SCPNG Board, government stakeholders, international bodies, and coordinate governance committee activities.' },
    ],
    'Executive': [
        { title: 'Strategic Leadership & Organisational Direction', description: 'Provide strategic leadership and direction to all SCPNG divisions, driving the implementation of the Strategic Plan 2025-2030 and ADB commitments.' },
        { title: 'Regulatory Oversight & Stakeholder Relations', description: 'Oversee SCPNG regulatory mandate, maintain relationships with government, Board, and international regulatory bodies including IOSCO.' },
    ],
    'Admin': [
        { title: 'Office Administration & Facilities Management', description: 'Manage day-to-day office operations, facilities maintenance, procurement, and administrative support services for SCPNG divisions.' },
        { title: 'Records Management & Administrative Compliance', description: 'Maintain compliant records management systems, manage correspondence, and ensure administrative procedures align with government standards.' },
    ],
};

// 4 KPIs per role category (2 per KRA)
const OFFICER_KPI_TEMPLATES: Record<string, Array<{ name: string; description: string; metric: string; target: number; cost: number }>> = {
    'IT': [
        { name: 'System Uptime Rate', description: 'Percentage of time SCPNG core systems are fully operational and available to staff', metric: '%', target: 99, cost: 0 },
        { name: 'IT Support Ticket Resolution Rate', description: 'Percentage of helpdesk tickets resolved within agreed SLA timeframes', metric: '%', target: 90, cost: 0 },
        { name: 'Security Patch Compliance Rate', description: 'Percentage of SCPNG systems with current security patches applied', metric: '%', target: 95, cost: 0 },
        { name: 'Digital Platform Milestones Delivered', description: 'Number of intranet and digital platform features delivered on schedule', metric: 'Count', target: 8, cost: 50000 },
    ],
    'Finance': [
        { name: 'Financial Reports Submitted On Time', description: 'Percentage of monthly and quarterly financial reports submitted by due date', metric: '%', target: 100, cost: 0 },
        { name: 'Budget Utilisation Rate', description: 'Actual expenditure as a percentage of the approved annual budget', metric: '%', target: 95, cost: 0 },
        { name: 'Audit Findings Resolved', description: 'Percentage of prior year audit findings resolved by deadline', metric: '%', target: 90, cost: 0 },
        { name: 'Invoice Processing Time', description: 'Average number of business days to process and approve supplier invoices', metric: 'Days', target: 5, cost: 0 },
    ],
    'HR': [
        { name: 'Recruitment Completion Rate', description: 'Percentage of advertised vacancies filled within the target timeframe', metric: '%', target: 85, cost: 30000 },
        { name: 'Performance Appraisal Completion Rate', description: 'Percentage of staff who complete annual performance appraisals on time', metric: '%', target: 100, cost: 0 },
        { name: 'Payroll Accuracy Rate', description: 'Percentage of monthly payroll processed without errors or adjustments', metric: '%', target: 99, cost: 0 },
        { name: 'Staff Training Hours Delivered', description: 'Total hours of structured training delivered to SCPNG staff in the year', metric: 'Hours', target: 200, cost: 20000 },
    ],
    'Legal': [
        { name: 'Enforcement Matters Resolved', description: 'Number of enforcement matters resolved or formally concluded in the period', metric: 'Count', target: 8, cost: 0 },
        { name: 'Legal Opinion Turnaround Time', description: 'Average business days to deliver legal opinions to requesting divisions', metric: 'Days', target: 7, cost: 0 },
        { name: 'Legislative Amendments Progressed', description: 'Number of legislative amendments progressed through formal drafting stages', metric: 'Count', target: 3, cost: 0 },
        { name: 'Compliance Advisory Requests Fulfilled', description: 'Percentage of internal compliance advisory requests addressed within SLA', metric: '%', target: 95, cost: 0 },
    ],
    'Market Data': [
        { name: 'Market Bulletin Publication Rate', description: 'Percentage of scheduled market bulletins and reports published on time', metric: '%', target: 100, cost: 0 },
        { name: 'Data Collection Accuracy Rate', description: 'Accuracy rate of capital market data collected from licensed participants', metric: '%', target: 98, cost: 0 },
        { name: 'Market Surveillance Alerts Reviewed', description: 'Number of market surveillance alerts reviewed and actioned per year', metric: 'Count', target: 24, cost: 0 },
        { name: 'Stakeholder Data Requests Fulfilled', description: 'Percentage of market data requests fulfilled within agreed timeframes', metric: '%', target: 90, cost: 0 },
    ],
    'Licensing': [
        { name: 'License Application Processing Time', description: 'Average calendar days to process and determine a complete license application', metric: 'Days', target: 30, cost: 0 },
        { name: 'License Register Accuracy Rate', description: 'Accuracy of the public register of licensed capital market participants', metric: '%', target: 100, cost: 0 },
        { name: 'Compliance Assessments Completed', description: 'Percentage of scheduled ongoing compliance assessments completed on time', metric: '%', target: 85, cost: 0 },
        { name: 'License Renewal On-Time Rate', description: 'Percentage of license renewals processed and issued before expiry date', metric: '%', target: 90, cost: 0 },
    ],
    'Supervision': [
        { name: 'On-Site Inspections Completed', description: 'Number of on-site supervisory inspections of market participants completed', metric: 'Count', target: 6, cost: 0 },
        { name: 'Inspection Recommendations Implemented', description: 'Percentage of prior inspection recommendations implemented by supervised entities', metric: '%', target: 80, cost: 0 },
        { name: 'Risk Assessment Reports Produced', description: 'Number of formal risk assessment reports produced for supervised entities', metric: 'Count', target: 8, cost: 0 },
        { name: 'Market Participant Review Coverage', description: 'Percentage of supervised participants subject to formal annual review', metric: '%', target: 100, cost: 0 },
    ],
    'Investigations': [
        { name: 'Investigation Cases Resolved', description: 'Number of investigation cases formally resolved or concluded in the year', metric: 'Count', target: 5, cost: 0 },
        { name: 'Average Investigation Duration', description: 'Average calendar days from case opening to formal resolution', metric: 'Days', target: 120, cost: 0 },
        { name: 'Evidence Collection Success Rate', description: 'Percentage of investigations where sufficient evidence was gathered for action', metric: '%', target: 90, cost: 0 },
        { name: 'Enforcement Actions Initiated', description: 'Number of formal enforcement actions initiated from investigation findings', metric: 'Count', target: 3, cost: 0 },
    ],
    'Research': [
        { name: 'Research Publications Completed', description: 'Number of research papers and analytical reports completed and published', metric: 'Count', target: 4, cost: 10000 },
        { name: 'Policy Brief Turnaround Time', description: 'Average business days to produce a policy brief from request to delivery', metric: 'Days', target: 14, cost: 0 },
        { name: 'Research Dataset Updates Completed', description: 'Number of key research datasets updated with current year data', metric: 'Count', target: 6, cost: 0 },
        { name: 'Stakeholder Research Citations', description: 'Number of times SCPNG research is formally cited by external stakeholders', metric: 'Count', target: 10, cost: 0 },
    ],
    'Publication': [
        { name: 'Publications Produced On Schedule', description: 'Percentage of planned publications and reports produced by target dates', metric: '%', target: 95, cost: 15000 },
        { name: 'Social Media Reach Growth', description: 'Percentage growth in SCPNG social media followers across all platforms', metric: '%', target: 50, cost: 5000 },
        { name: 'Investor Education Materials Distributed', description: 'Number of investor education materials distributed to the public', metric: 'Count', target: 5000, cost: 8000 },
        { name: 'Website Content Update Completion Rate', description: 'Percentage of planned website content updates completed on schedule', metric: '%', target: 90, cost: 0 },
    ],
    'Secretariat': [
        { name: 'Board Meeting Preparedness Rate', description: 'Percentage of Board meetings with complete agenda papers delivered on time', metric: '%', target: 100, cost: 0 },
        { name: 'Strategic Plan Milestones On Track', description: 'Percentage of SCPNG Strategic Plan 2025-2030 milestones on schedule', metric: '%', target: 75, cost: 0 },
        { name: 'Stakeholder Engagement Activities Conducted', description: 'Number of formal stakeholder engagement activities conducted in the year', metric: 'Count', target: 12, cost: 20000 },
        { name: 'Board Resolutions Implemented Rate', description: 'Percentage of Board resolutions implemented within agreed timeframes', metric: '%', target: 95, cost: 0 },
    ],
    'Executive': [
        { name: 'Strategic Objectives Achieved', description: 'Percentage of annual strategic objectives achieved on schedule', metric: '%', target: 80, cost: 0 },
        { name: 'Board Resolutions Implemented', description: 'Percentage of Board resolutions implemented within the agreed timeframe', metric: '%', target: 95, cost: 0 },
        { name: 'Divisional Performance Target Achievement', description: 'Percentage of all division performance targets met or exceeded', metric: '%', target: 85, cost: 0 },
        { name: 'Stakeholder Satisfaction Score', description: 'Average stakeholder satisfaction score from annual survey', metric: 'Score', target: 4, cost: 0 },
    ],
    'Admin': [
        { name: 'Office Supply Procurement On-Time Rate', description: 'Percentage of office supply orders fulfilled within required timeframes', metric: '%', target: 90, cost: 0 },
        { name: 'Facilities Maintenance Requests Resolved', description: 'Percentage of maintenance requests resolved within the agreed SLA', metric: '%', target: 85, cost: 0 },
        { name: 'Administrative Task Turnaround Time', description: 'Average business days to complete routine administrative requests', metric: 'Days', target: 3, cost: 0 },
        { name: 'Records Management Compliance Rate', description: 'Percentage of records filed and managed per the government records policy', metric: '%', target: 90, cost: 0 },
    ],
};

// 20 tasks per role category — specific to SCPNG operations
const OFFICER_TASK_TEMPLATES: Record<string, Array<{ title: string; description: string }>> = {
    'IT': [
        { title: 'Configure Cisco switches for Building B network upgrade', description: 'Install and configure new Cisco switches in Building B as part of the SCPNG network upgrade project.' },
        { title: 'Apply monthly security patches to all Windows servers', description: 'Review, test, and apply Microsoft security patches to production servers for the current patch cycle.' },
        { title: 'Review and update Active Directory user accounts and permissions', description: 'Audit all AD accounts, remove inactive users, and align permissions with current staff roles and access requirements.' },
        { title: 'Set up Microsoft 365 accounts for new staff members', description: 'Provision M365 accounts, configure email, assign licences, and onboard new staff to SCPNG digital tools.' },
        { title: 'Troubleshoot SharePoint connectivity issues reported by Finance team', description: 'Investigate and resolve SharePoint access and performance issues affecting the Finance division.' },
        { title: 'Perform full database backup and restoration test', description: 'Execute scheduled database backup for all SCPNG databases and conduct restoration test to verify data integrity.' },
        { title: 'Update IT asset register with newly procured equipment', description: 'Record all newly received IT hardware and software in the asset management register with serial numbers and locations.' },
        { title: 'Configure multi-factor authentication for all staff accounts', description: 'Enable and enforce MFA across all SCPNG M365 accounts as per cybersecurity policy requirements.' },
        { title: 'Prepare monthly IT operations and system uptime report', description: 'Compile system uptime, helpdesk ticket statistics, and IT performance metrics for the monthly management report.' },
        { title: 'Migrate legacy file server data to SharePoint document libraries', description: 'Transfer departmental files from the old file server to organised SharePoint libraries with appropriate permissions.' },
        { title: 'Review and optimise network bandwidth utilisation across SCPNG office', description: 'Analyse network traffic, identify bandwidth hogs, and implement QoS policies to prioritise critical applications.' },
        { title: 'Conduct vulnerability assessment scan on SCPNG network infrastructure', description: 'Run vulnerability scanning tools on network devices and servers and document findings for remediation.' },
        { title: 'Deploy new intranet module for HR leave management', description: 'Develop and deploy the HR leave application module on the SCPNG intranet for staff self-service leave submission.' },
        { title: 'Coordinate with vendor on server hardware end-of-life replacement', description: 'Engage with IT vendor to quote, procure, and schedule replacement of ageing server hardware reaching end of life.' },
        { title: 'Test and document disaster recovery procedures for critical systems', description: 'Execute full DR test for core SCPNG systems and update DR runbook with any changes to procedures or contacts.' },
        { title: 'Configure VPN access for staff working remotely', description: 'Set up and test VPN client configurations for staff requiring secure remote access to SCPNG systems.' },
        { title: 'Review and optimise SQL database query performance', description: 'Identify slow-running SQL queries in the SCPNG database and optimise with indexing and query restructuring.' },
        { title: 'Prepare IT budget estimates for next financial year', description: 'Develop IT budget submission covering hardware refreshes, software licences, and infrastructure upgrade projects.' },
        { title: 'Update IT support procedures and knowledge base documentation', description: 'Review and update helpdesk procedures, FAQs, and IT knowledge base articles for common staff issues.' },
        { title: 'Conduct user training on Microsoft Teams and SharePoint for all divisions', description: 'Deliver training sessions to all SCPNG staff on effective use of Teams for collaboration and SharePoint for document management.' },
    ],
    'Finance': [
        { title: 'Prepare August 2025 management accounts for Executive review', description: 'Compile and reconcile August financial data and prepare management accounts for review by the Director Corporate Service.' },
        { title: 'Reconcile bank statements with the general ledger', description: 'Perform monthly bank reconciliation for all SCPNG accounts and investigate and resolve any reconciling items.' },
        { title: 'Process vendor payments for office supplies and services contracts', description: 'Review, approve, and process outstanding supplier invoices for goods and services received by SCPNG.' },
        { title: 'Submit quarterly GST return to Internal Revenue Commission', description: 'Compile GST input and output tax data, prepare the GST return, and submit to IRC by the due date.' },
        { title: 'Review and report on departmental budget variances for Q3', description: 'Analyse actual vs budget expenditure for Q3 by division and prepare variance report for management.' },
        { title: 'Update fixed assets register for newly procured equipment', description: 'Add new capital assets to the fixed assets register with purchase date, cost, depreciation rate, and location.' },
        { title: 'Process staff travel advance requests for upcoming conferences', description: 'Review, calculate, and process travel advances for staff attending approved external training and conferences.' },
        { title: 'Prepare annual budget submission for Management and Board approval', description: 'Compile input from all divisions, develop the consolidated SCPNG annual budget, and prepare submission documents.' },
        { title: 'Coordinate with external auditors for document review and sign-off', description: 'Liaise with appointed auditors to provide requested documents and schedule reviews for the annual audit.' },
        { title: 'Prepare monthly expenditure report for Directors and Management', description: 'Produce the monthly financial expenditure report showing actual spending against budget by cost centre.' },
        { title: 'Process payroll adjustments for staff contract renewals and promotions', description: 'Calculate and process payroll changes arising from staff contract renewals, salary increments, and new appointments.' },
        { title: 'Update accounts receivable aging schedule and follow up on outstanding amounts', description: 'Review outstanding receivables, update aging schedule, and issue reminder notices to debtors as required.' },
        { title: 'Review and approve supplier payment vouchers before disbursement', description: 'Verify supporting documentation and approve payment vouchers before submission to the Director for final approval.' },
        { title: 'Prepare cash flow projection for next quarter operations', description: 'Develop a 13-week cash flow projection based on expected receipts and planned expenditure for management planning.' },
        { title: 'Submit Nambawan Super pension deductions for the month', description: 'Calculate and remit monthly superannuation contributions for all eligible SCPNG employees to Nambawan Super.' },
        { title: 'Review and update the finance policy and procedures manual', description: 'Review existing finance procedures against current practice and PFMA requirements and update the manual accordingly.' },
        { title: 'Process petty cash reimbursement claims for the division', description: 'Review petty cash claim forms, verify receipts, and reimburse approved claims within the approved petty cash limit.' },
        { title: 'Prepare year-end financial statements for statutory audit', description: 'Compile all year-end journals, prepare draft financial statements, and package supporting schedules for the external audit.' },
        { title: 'Verify contract amounts against approved budget before commitment', description: 'Review proposed contracts or purchase orders to confirm expenditure is within approved budget before authorisation.' },
        { title: 'Prepare Board finance and budget report for next Board meeting', description: 'Compile financial performance data and prepare the quarterly Board finance report with commentary on variances.' },
    ],
    'HR': [
        { title: 'Advertise vacant Administrative Officer position on government job boards', description: 'Prepare and post the vacancy advertisement for the open Administrative Officer role on DPM and SCPNG platforms.' },
        { title: 'Shortlist candidates for IT Hardware Officer vacancy', description: 'Review all applications received for the IT Hardware Officer role and prepare shortlist for interview panel consideration.' },
        { title: 'Coordinate interview panel for Legal Officer vacancy', description: 'Schedule interview dates, confirm panel members, prepare interview guide, and organise interview logistics.' },
        { title: 'Process August payroll for all SCPNG staff', description: 'Run the August payroll, process all adjustments, verify deductions, and prepare EFT file for payment processing.' },
        { title: 'Update employee personal records for recent contract renewals', description: 'Update HR system records for staff whose employment contracts were recently renewed with new contract details.' },
        { title: 'Prepare and brief supervisors on annual performance appraisal cycle', description: 'Circulate performance appraisal forms, brief division heads on the process, and set deadlines for completion.' },
        { title: 'Prepare employment contract for newly appointed Research Officer', description: 'Draft employment contract terms, obtain Director approval, and prepare the contract package for new officer signature.' },
        { title: 'Process staff separation documentation for resigned staff member', description: 'Complete separation checklist, calculate final pay entitlements, and process departure clearance for the departing employee.' },
        { title: 'Coordinate staff training on Microsoft 365 productivity tools', description: 'Arrange and schedule M365 training sessions with IT for all SCPNG staff including Teams, SharePoint, and OneDrive.' },
        { title: 'Submit monthly headcount report to Management', description: 'Compile staff headcount data by division and employment type and submit the monthly workforce report to management.' },
        { title: 'Process Nambawan Super superannuation contributions for the month', description: 'Calculate employee and employer super contributions, reconcile with payroll, and submit monthly remittance to Nambawan Super.' },
        { title: 'Review and update HR policies and procedures manual', description: 'Review current HR policies against DPM guidelines and SCPNG practice, identify gaps, and update accordingly.' },
        { title: 'Coordinate Q4 staff wellness and team building program', description: 'Plan and organise the Q4 staff wellness program including team building activities, health talks, and social events.' },
        { title: 'Process overtime claims for Supervision and Investigations teams', description: 'Review and verify overtime claims from Supervision and Investigations, calculate payments, and submit for payroll processing.' },
        { title: 'Update organisation chart following recent staff changes', description: 'Revise the SCPNG organisation chart to reflect recent appointments, departures, and reporting line changes.' },
        { title: 'Prepare 2026 workforce recruitment and succession plan', description: 'Assess upcoming vacancies and capability gaps and prepare the 2026 workforce plan for Management and Board review.' },
        { title: 'Process staff leave applications and update leave records', description: 'Review and approve leave applications in the HR system, ensure leave balances are updated for all approved absences.' },
        { title: 'Coordinate annual staff engagement and satisfaction survey', description: 'Design, distribute, and analyse the annual SCPNG staff satisfaction survey and prepare results report for management.' },
        { title: 'Prepare training needs analysis for all SCPNG divisions', description: 'Collect training needs input from all division heads and prepare the consolidated training needs analysis for the year.' },
        { title: 'Process medical insurance claims for staff members', description: 'Receive and verify staff medical claims, liaise with insurer, and process reimbursements through payroll or direct payment.' },
    ],
    'Legal': [
        { title: 'Review licensing application for compliance with fit and proper requirements', description: 'Conduct legal review of securities dealer license application to assess compliance with the Securities Commission Act.' },
        { title: 'Draft enforcement notice for market manipulation matter', description: 'Prepare formal enforcement notice under the Securities Commission Act for issuance to the respondent in the matter.' },
        { title: 'Prepare legal opinion on proposed regulatory amendment', description: 'Research and draft a legal opinion on the validity and implications of a proposed regulatory amendment for management.' },
        { title: 'Research IOSCO guidance on market manipulation and insider trading definitions', description: 'Review current IOSCO standards and guidance on market manipulation to inform SCPNG regulatory review.' },
        { title: 'Review IPO prospectus document for capital market regulatory compliance', description: 'Conduct legal review of prospectus to ensure compliance with Securities Commission Act and prospectus disclosure requirements.' },
        { title: 'Draft Cabinet submission on Securities Commission Act amendment proposal', description: 'Prepare the formal Cabinet submission for the proposed amendment to the Securities Commission Act for government approval.' },
        { title: 'Coordinate with external counsel on litigation file management', description: 'Brief and coordinate with appointed external counsel on active litigation matters and review progress on pending cases.' },
        { title: 'Prepare response to regulatory challenge received from licensed entity', description: 'Research and draft the SCPNG formal legal response to a regulatory challenge filed by a licensed market participant.' },
        { title: 'Review commercial lease agreement for SCPNG office premises renewal', description: 'Conduct legal review of the proposed lease renewal agreement and advise on terms, conditions, and risk exposure.' },
        { title: 'Prepare case summary for Enforcement Committee meeting', description: 'Compile investigation findings and legal analysis and prepare a concise case summary for Enforcement Committee consideration.' },
        { title: 'Update regulatory compliance checklist for all licensed entities', description: 'Review and update the compliance checklist used to assess ongoing compliance of SCPNG licensed market participants.' },
        { title: 'Research Pacific regional regulatory frameworks for comparative analysis', description: 'Review regulatory frameworks of Pacific securities regulators for comparison with PNG regulations.' },
        { title: 'Draft affidavit in support of court proceedings for enforcement action', description: 'Prepare a sworn affidavit setting out the material facts and evidence in support of enforcement court proceedings.' },
        { title: 'Prepare legal briefing note for CEO on recent regulatory developments', description: 'Summarise recent developments in securities law and regulation relevant to SCPNG and prepare a briefing note for the CEO.' },
        { title: 'Review investor complaint for potential legal enforcement action', description: 'Assess an investor complaint received by SCPNG to determine whether it warrants formal investigation or enforcement.' },
        { title: 'Coordinate interagency meeting on financial crime enforcement', description: 'Organise and chair an interagency meeting with BPNG and Police on coordinated response to financial crime referrals.' },
        { title: 'Update legal register with new enforcement matters opened this quarter', description: 'Record and update the SCPNG legal and enforcement matters register with all new matters opened in the quarter.' },
        { title: 'Review draft amendments to licensing regulations for stakeholder consultation', description: 'Review proposed amendments to licensing regulations and prepare a consultation paper for industry stakeholder input.' },
        { title: 'Prepare quarterly enforcement statistics and outcomes report', description: 'Compile and analyse enforcement activities data and prepare the quarterly enforcement statistics report for management.' },
        { title: 'Prepare briefing note on Capital Market Act reform proposals', description: 'Draft a detailed briefing on proposed Capital Market Act amendments for management review before stakeholder consultation.' },
    ],
    'Market Data': [
        { title: 'Collect weekly equity trading data from PNGX', description: 'Obtain, reconcile, and record weekly equity trading volumes, values, and price data from the Port Moresby Stock Exchange.' },
        { title: 'Update listed companies financial disclosure database', description: 'Process and enter newly received listed company financial disclosures into the SCPNG market data database.' },
        { title: 'Prepare monthly securities market bulletin for publication', description: 'Compile monthly trading statistics, market cap data, and commentary for the SCPNG monthly securities market bulletin.' },
        { title: 'Monitor equity price movements for unusual or suspicious trading patterns', description: 'Review daily price and volume data to identify unusual trading patterns that may indicate market manipulation or insider trading.' },
        { title: 'Calculate and publish monthly market capitalisation figures for PNGX', description: 'Calculate total and sectoral market capitalisation based on latest share prices and submit for publication on SCPNG website.' },
        { title: 'Coordinate quarterly data submission from licensed stockbrokers', description: 'Send data request letters to licensed brokers, collect submissions, and follow up on outstanding or incomplete returns.' },
        { title: 'Update bond and fixed income market yield curve data', description: 'Collect and enter Treasury and Inscribed Stock yield data and update the SCPNG fixed income market database.' },
        { title: 'Prepare quarterly capital market statistical report', description: 'Compile comprehensive quarterly statistics on equities, bonds, capital raising, and investor activity for the SCPNG quarterly report.' },
        { title: 'Respond to external stakeholder market data requests', description: 'Process and respond to requests for capital market data from investors, academics, government agencies, and international bodies.' },
        { title: 'Review and validate SCPNG market data for IOSCO annual statistics survey', description: 'Compile, validate, and submit PNG capital market data for the annual IOSCO statistics survey on global securities markets.' },
        { title: 'Develop market data dashboard visualisations for investor portal', description: 'Design and build interactive market data dashboards for the SCPNG public investor portal using current market data.' },
        { title: 'Update foreign investment activity tracker with new data', description: 'Record and analyse foreign portfolio investment activity in PNG equity markets and update the investment tracker database.' },
        { title: 'Prepare market data section for SCPNG Annual Report', description: 'Compile capital market performance data, charts, and commentary for inclusion in the SCPNG Annual Report.' },
        { title: 'Monitor corporate disclosure announcements from PNGX listed companies', description: 'Review and record all corporate announcements from listed companies on PNGX for regulatory compliance and database updates.' },
        { title: 'Update market surveillance alert thresholds and criteria', description: 'Review and update the trading alert criteria used in the SCPNG market surveillance system based on current market conditions.' },
        { title: 'Analyse capital raising trends for Q3 industry analysis report', description: 'Analyse IPO, rights issue, and debt capital raising activity in Q3 and prepare findings for the industry analysis report.' },
        { title: 'Prepare comparative market data report for ADB capital market development review', description: 'Compile PNG capital market data and comparisons with regional markets for the ADB-funded capital market development project.' },
        { title: 'Review broker trading records for pattern anomalies', description: 'Conduct systematic review of broker trading records to identify patterns inconsistent with normal market activity.' },
        { title: 'Update investor protection and complaints statistics database', description: 'Record and update investor complaint and enforcement statistics in the SCPNG investor protection database.' },
        { title: 'Prepare market developments presentation for Board meeting', description: 'Compile key capital market performance indicators and trends and prepare a concise presentation for the SCPNG Board.' },
    ],
    'Licensing': [
        { title: 'Review new securities dealer license application from applicant', description: 'Assess the completeness and compliance of a new securities dealer license application against the Securities Commission Act requirements.' },
        { title: 'Process license renewal application for existing fund manager', description: 'Review and process the annual licence renewal application submitted by a licensed fund manager, including fee collection.' },
        { title: 'Conduct fit and proper assessment of license applicant directors and officers', description: 'Conduct fit and proper checks on proposed directors and officers of a license applicant including criminal and reference checks.' },
        { title: 'Update the public register of licensed market participants', description: 'Update the public register of licensed securities dealers, advisors, and fund managers with new approvals and status changes.' },
        { title: 'Issue additional information request to license applicant', description: 'Prepare and send a formal request for additional information or documents required to complete assessment of a license application.' },
        { title: 'Prepare recommendation report for licensing committee consideration', description: 'Prepare a detailed assessment report with licensing recommendation for presentation to the SCPNG Licensing Committee.' },
        { title: 'Process annual license fee collection and reconciliation', description: 'Issue annual licence fee invoices, follow up on outstanding payments, and reconcile receipts against licence register.' },
        { title: 'Inspect license applicant business premises and systems', description: 'Conduct pre-licensing inspection of applicant office premises, IT systems, and operational capability as part of the assessment.' },
        { title: 'Review capital adequacy position of securities dealer applicant', description: 'Assess the financial position and capital adequacy of a dealer applicant against minimum capital requirements under the Act.' },
        { title: 'Coordinate with PNGX on broker registration and approval process', description: 'Liaise with PNGX regarding the concurrent broker registration process and exchange licensing requirements for new applicants.' },
        { title: 'Draft licence conditions for newly approved market participant', description: 'Prepare the licence conditions schedule to be attached to a new licence covering ongoing compliance and reporting obligations.' },
        { title: 'Review ongoing compliance status of all licensees against quarterly reporting', description: 'Assess quarterly compliance reports submitted by licensees and identify any issues requiring follow-up or escalation.' },
        { title: 'Prepare licensing statistics for quarterly management report', description: 'Compile licensing activity data including applications received, approved, refused, and renewed for the quarterly report.' },
        { title: 'Process collective investment scheme licence application', description: 'Review and process a new licence application from a collective investment scheme under the Unit Trust and Fund Management Code.' },
        { title: 'Coordinate cross-border recognition with ASIC on mutual recognition framework', description: 'Engage with ASIC on progress of the Australia-PNG mutual recognition framework for securities licences.' },
        { title: 'Review investment advisor licence application and prepare assessment', description: 'Review and prepare assessment report for a new investment advisor licence application under the Securities Commission Act.' },
        { title: 'Prepare licensing policy framework update paper for Management', description: 'Review current licensing policy and procedures against IOSCO standards and prepare a policy update paper for management.' },
        { title: 'Conduct follow-up compliance assessment visit to licensed dealer', description: 'Schedule and conduct a follow-up on-site compliance assessment for a licensee with previously identified compliance issues.' },
        { title: 'Prepare and send licence suspension notice to non-compliant licensee', description: 'Prepare the formal licence suspension notice and supporting documentation for a licensee in breach of licence conditions.' },
        { title: 'Prepare licensing committee meeting agenda and supporting papers', description: 'Compile agenda items, assessment reports, and supporting papers for the next SCPNG Licensing Committee meeting.' },
    ],
    'Supervision': [
        { title: 'Conduct off-site review of broker quarterly financial statements', description: 'Perform desk-based review of quarterly financial statements submitted by a supervised broker to assess financial soundness.' },
        { title: 'Schedule and prepare on-site inspection plan for securities firm', description: 'Prepare an on-site inspection plan, notify the supervised entity, and coordinate logistics for the upcoming inspection.' },
        { title: 'Review inspection findings and draft supervisory report', description: 'Analyse on-site inspection findings, identify regulatory breaches, and draft the formal supervisory inspection report.' },
        { title: 'Follow up on previous inspection recommendations with supervised entity', description: 'Contact supervised entity to assess implementation progress on recommendations from the prior inspection report.' },
        { title: 'Monitor compliance with SCPNG regulatory directives issued to licensees', description: 'Review compliance with regulatory directives previously issued to supervised market participants and document outcomes.' },
        { title: 'Review client money handling practices and segregation controls', description: 'Assess whether supervised dealers are maintaining client money segregation requirements under SCPNG regulations.' },
        { title: 'Conduct formal risk assessment of supervised market participants', description: 'Apply SCPNG risk assessment framework to evaluate the risk profile of each supervised market participant this quarter.' },
        { title: 'Conduct thematic review on investor complaint handling procedures', description: 'Conduct a thematic supervisory review of how supervised entities receive, record, and resolve investor complaints.' },
        { title: 'Prepare supervisory activity report for management committee', description: 'Compile all supervision activities, inspection outcomes, and risk assessments for the quarterly management report.' },
        { title: 'Review broker trading records and client position reports', description: 'Assess broker trading records and client position reports submitted for the period against regulatory requirements.' },
        { title: 'Coordinate regulatory college meeting with ASIC on Pacific supervision', description: 'Arrange and participate in a regulatory college meeting with ASIC to discuss supervision of Pacific cross-border entities.' },
        { title: 'Conduct capital adequacy stress test on supervised broker positions', description: 'Apply capital stress tests to assessed broker positions to evaluate whether minimum capital requirements can withstand market stress.' },
        { title: 'Review related party transaction disclosures from supervised entities', description: 'Assess related party transaction disclosures submitted by supervised entities for adequacy and regulatory compliance.' },
        { title: 'Update the supervisory risk assessment framework methodology', description: 'Review and update SCPNG risk-based supervision methodology to incorporate new supervisory guidance and market developments.' },
        { title: 'Monitor leverage and margin lending practices across supervised entities', description: 'Review margin lending data and leverage positions across supervised brokers to identify excessive risk exposure.' },
        { title: 'Review continuous disclosure obligation compliance by supervised listed companies', description: 'Assess whether PNGX-listed companies under SCPNG supervision are meeting their continuous disclosure obligations.' },
        { title: 'Prepare supervisory findings summary for Enforcement Committee referral', description: 'Compile and summarise significant supervisory findings for consideration by the SCPNG Enforcement Committee.' },
        { title: 'Coordinate with Legal division on enforcement referrals from supervision', description: 'Brief the Legal division on supervision findings that may warrant formal enforcement action and coordinate next steps.' },
        { title: 'Update supervision manual and on-site inspection procedures', description: 'Review and update the SCPNG supervision manual and inspection checklists based on current supervisory practice.' },
        { title: 'Review systemic risk indicators across all market participants', description: 'Analyse systemic risk indicators across all supervised entities and prepare a systemic risk assessment for management.' },
    ],
    'Investigations': [
        { title: 'Receive and conduct preliminary assessment of new market misconduct complaint', description: 'Conduct initial review of a new complaint received by SCPNG to determine whether a formal investigation is warranted.' },
        { title: 'Gather and catalogue documentary evidence for ongoing investigation', description: 'Collect, review, and systematically catalogue all documentary evidence relevant to an active investigation matter.' },
        { title: 'Conduct formal witness interview in securities fraud investigation', description: 'Conduct a formal recorded witness interview under SCPNG investigatory powers and document evidence obtained.' },
        { title: 'Analyse trading patterns for insider trading indicators', description: 'Conduct quantitative and qualitative analysis of trading data to identify trading patterns consistent with insider trading.' },
        { title: 'Prepare investigation plan for new referral received from Supervision division', description: 'Develop a formal investigation plan outlining scope, methodology, timelines, and resource requirements for a new matter.' },
        { title: 'Draft investigation report with findings and enforcement recommendations', description: 'Prepare the formal investigation report documenting findings of fact, legal analysis, and recommended enforcement action.' },
        { title: 'Coordinate with PNG Police on joint fraud investigation', description: 'Liaise with RPNGC Financial Crimes Unit on the conduct of a joint investigation involving securities and general criminal fraud.' },
        { title: 'Obtain financial and trading records via formal regulatory powers', description: 'Issue formal notices under SCPNG statutory powers to obtain relevant financial records from the subject of investigation.' },
        { title: 'Conduct forensic analysis of corporate accounts and trading records', description: 'Perform detailed forensic analysis of financial accounts and trading records to identify irregular transactions and patterns.' },
        { title: 'Prepare case brief for Enforcement Committee consideration', description: 'Compile the investigation case brief summarising evidence, legal assessment, and recommended enforcement action for the Committee.' },
        { title: 'Review suspicious transaction reports submitted by licensed brokers', description: 'Assess suspicious transaction reports filed by brokers and determine appropriate investigation or referral action.' },
        { title: 'Liaise with AUSTRAC on suspicious transaction referral from PNG broker', description: 'Contact AUSTRAC to share intelligence and coordinate on a suspicious transaction referral involving cross-border activity.' },
        { title: 'Coordinate with company registrar to verify director identity details', description: 'Verify company officer details and shareholding structures through IPA to support an ongoing investigation.' },
        { title: 'Prepare draft enforceable undertaking for settlement negotiation', description: 'Draft the enforceable undertaking document for negotiation with a respondent as an alternative to litigation.' },
        { title: 'Monitor compliance with enforceable undertaking conditions by respondent', description: 'Review progress reports from a respondent operating under an enforceable undertaking and document compliance status.' },
        { title: 'Update investigation case management register for all active matters', description: 'Update the SCPNG investigation register with current status, key dates, and next actions for all active investigation matters.' },
        { title: 'Prepare evidence brief for referral to RPNGC for prosecution', description: 'Compile and organise evidence brief for matters recommended for criminal prosecution referral to the police.' },
        { title: 'Conduct proactive market surveillance analysis for trading anomalies', description: 'Run scheduled surveillance analysis of all PNGX trading data to proactively identify potential market misconduct.' },
        { title: 'Review and assess whistleblower complaint for investigation action', description: 'Review a whistleblower disclosure received by SCPNG and assess the credibility and sufficiency of the information provided.' },
        { title: 'Prepare quarterly investigation statistics and outcomes report', description: 'Compile investigations activity data, resolution rates, and enforcement outcomes for the quarterly management report.' },
    ],
    'Research': [
        { title: 'Conduct literature review on PNG capital market development challenges', description: 'Review academic and policy literature on capital market development in developing economies relevant to the PNG context.' },
        { title: 'Analyse the impact of interest rate changes on PNG securities market', description: 'Conduct quantitative analysis of the relationship between interest rate movements and PNG equity market performance.' },
        { title: 'Prepare Q3 capital market commentary for investor bulletin', description: 'Write the quarterly capital market commentary covering economic conditions, market performance, and emerging trends.' },
        { title: 'Compile PNG economic indicators dataset for annual research handbook', description: 'Collect, verify, and compile key PNG economic indicators from BPNG, NRI, and NSO for the annual market handbook.' },
        { title: 'Research fintech regulation models applicable to PNG developing market', description: 'Review fintech regulatory frameworks from comparable developing markets and assess applicability to PNG capital markets.' },
        { title: 'Prepare policy brief on SME access to capital market financing in PNG', description: 'Research barriers to SME capital market access in PNG and develop policy recommendations for the Director.' },
        { title: 'Draft research paper on PNG securities market microstructure', description: 'Prepare a research paper analysing PNGX market microstructure, trading mechanisms, and liquidity characteristics.' },
        { title: 'Coordinate investor perception survey on PNG capital market participation', description: 'Design, coordinate, and analyse a survey of retail and institutional investors on PNG capital market participation barriers.' },
        { title: 'Prepare submission to ADB financial sector development review', description: 'Draft SCPNG input to the ADB financial sector review covering capital market development progress and challenges.' },
        { title: 'Analyse corporate governance practices of PNGX listed companies', description: 'Review annual reports and disclosures of listed companies to assess compliance with corporate governance standards.' },
        { title: 'Review and document Pacific island nations regulatory frameworks', description: 'Document securities regulatory frameworks across Pacific nations for comparative analysis with PNG regulations.' },
        { title: 'Prepare Board presentation on capital market development trends', description: 'Compile key research findings and market data to prepare a concise Board-level presentation on capital market trends.' },
        { title: 'Coordinate IFC technical assistance research deliverables', description: 'Manage SCPNG deliverables under the IFC technical assistance project on capital market development.' },
        { title: 'Analyse foreign portfolio investment activity and trends in PNG', description: 'Analyse available data on foreign investor activity in PNG equity and debt markets and document key trends.' },
        { title: 'Prepare technical note on IFRS adoption impact on PNG listed companies', description: 'Research and document the impact of IFRS adoption on financial reporting quality and investor transparency in PNG.' },
        { title: 'Review financial inclusion strategy implications for SCPNG mandate', description: 'Assess how the National Financial Inclusion Strategy objectives intersect with SCPNG capital market development mandate.' },
        { title: 'Update and publish the SCPNG annual market development action plan', description: 'Review progress on prior year action plan, update milestones, and prepare the updated plan for Management approval.' },
        { title: 'Prepare research digest for the quarterly investor bulletin', description: 'Summarise key research findings, publications, and market data for inclusion in the SCPNG quarterly investor bulletin.' },
        { title: 'Conduct peer review of draft research publication before submission', description: 'Conduct internal peer review of a research paper draft and provide structured feedback to the author before publication.' },
        { title: 'Analyse retail investor participation trends in PNG capital markets', description: 'Research retail investor participation data and trends in PNG equity markets and prepare findings for a policy brief.' },
    ],
    'Publication': [
        { title: 'Write and edit content for SCPNG Q3 2025 newsletter', description: 'Draft, review, and finalise all editorial content for the SCPNG quarterly newsletter for Q3 2025 publication.' },
        { title: 'Update SCPNG website with new regulatory publications and decisions', description: 'Upload and correctly categorise new regulatory publications, enforcement notices, and commission decisions on the SCPNG website.' },
        { title: 'Design and layout the SCPNG Annual Report 2025 draft', description: 'Coordinate the design, layout, and production of the draft SCPNG Annual Report 2025 in line with the style guide.' },
        { title: 'Prepare social media content calendar for October-December 2025', description: 'Plan and schedule social media posts across SCPNG platforms for Q4 2025 covering investor education and regulatory updates.' },
        { title: 'Edit and proofread investor education brochure content for accuracy', description: 'Review the investor education brochure for content accuracy, regulatory compliance, and editorial quality before printing.' },
        { title: 'Coordinate printing and distribution of investor awareness materials', description: 'Liaise with printer, approve proofs, and arrange delivery and distribution of investor education materials to target areas.' },
        { title: 'Update investor education portal with new module content', description: 'Upload and publish new investor education content modules to the SCPNG online investor education portal.' },
        { title: 'Prepare press release for regulatory announcement to media', description: 'Draft, obtain approval, and distribute a press release on a SCPNG regulatory decision or enforcement action to PNG media.' },
        { title: 'Design infographic on PNG securities market overview for investor portal', description: 'Design a clear and accurate infographic summarising PNG capital market structure, participants, and investor protections.' },
        { title: 'Upload commission decisions to the public register on the website', description: 'Process and upload all new commission decisions to the SCPNG public register section of the website.' },
        { title: 'Prepare presentation materials for upcoming investor roadshow in the provinces', description: 'Design and produce presentation materials and handouts for the SCPNG investor education roadshow in provincial locations.' },
        { title: 'Update and organise the SCPNG publication archive', description: 'Review, categorise, and update the publication archive ensuring all SCPNG publications are correctly filed and accessible.' },
        { title: 'Coordinate production of investor education video for social media', description: 'Brief, script, and coordinate the production of an investor education video for distribution on SCPNG social media channels.' },
        { title: 'Draft FAQ document on securities market participation for public distribution', description: 'Compile and draft a plain-language FAQ on how to invest in PNG capital markets for public distribution.' },
        { title: 'Update SCPNG Commission mobile app content with new publications', description: 'Add and publish new regulatory updates, publications, and announcements on the SCPNG mobile app platform.' },
        { title: 'Coordinate Tok Pisin translation of investor education materials', description: 'Arrange professional Tok Pisin translation of key investor education documents for distribution in PNG communities.' },
        { title: 'Coordinate media engagement on Invest Smart PNG investor education campaign', description: 'Brief and engage PNG media partners on the Invest Smart PNG campaign including scheduling radio and TV segments.' },
        { title: 'Develop content strategy for SCPNG social media expansion to 2-3 million followers', description: 'Research and develop a social media content and growth strategy to expand SCPNG reach to 2-3 million followers.' },
        { title: 'Prepare Q4 investor awareness campaign materials and plan', description: 'Develop and finalise the materials, distribution plan, and budget for the SCPNG Q4 investor awareness campaign.' },
        { title: 'Update SCPNG corporate communication style guide', description: 'Review and update the SCPNG publication style guide to reflect current branding, tone, and communication standards.' },
    ],
    'Secretariat': [
        { title: 'Prepare Board meeting agenda and information papers for next Board meeting', description: 'Coordinate with Directors to finalise the Board meeting agenda and compile all required information papers for distribution.' },
        { title: 'Draft CEO quarterly performance report to the Chairman', description: 'Compile operational and financial performance data and draft the CEO quarterly performance report for Chairman review.' },
        { title: 'Coordinate the Strategic Plan 2025-2030 progress review meeting', description: 'Schedule, prepare agenda, and coordinate logistics for the quarterly Strategic Plan progress review with the management team.' },
        { title: 'Prepare Cabinet submission on regulatory framework reform proposal', description: 'Draft the formal Cabinet submission for SCPNG regulatory reform proposals requiring government policy approval.' },
        { title: 'Update and present the corporate risk register for Management review', description: 'Review and update the SCPNG corporate risk register and prepare the risk report for the next Management Committee meeting.' },
        { title: 'Coordinate stakeholder consultations on proposed licensing policy changes', description: 'Organise and facilitate stakeholder consultation sessions on proposed SCPNG licensing policy amendments.' },
        { title: 'Prepare the corporate governance section of the SCPNG Annual Report', description: 'Draft and compile the corporate governance narrative for the SCPNG Annual Report including Board activity and attendance.' },
        { title: 'Draft MOU between SCPNG and Department of Treasury on data sharing', description: 'Prepare the draft MOU for formal data sharing arrangements between SCPNG and the Department of Treasury.' },
        { title: 'Coordinate budget preparation process across all SCPNG divisions', description: 'Issue budget preparation guidelines, collect divisional submissions, and coordinate the consolidated budget preparation process.' },
        { title: 'Prepare executive brief on capital market and regulatory developments', description: 'Compile key regulatory and market developments and prepare a concise executive brief for the CEO and Chairman.' },
        { title: 'Review internal audit findings and coordinate management responses', description: 'Review internal audit findings, coordinate management responses from relevant divisions, and track implementation timelines.' },
        { title: 'Coordinate governance and risk committee meeting preparation', description: 'Prepare agenda, papers, and logistics for the next Governance and Risk Management Committee meeting.' },
        { title: 'Manage CEO correspondence including Board and ministerial communications', description: 'Draft, review, and manage CEO correspondence with Board members, the Minister, and key external stakeholders.' },
        { title: 'Review and update SCPNG organisational policies and procedures framework', description: 'Review existing SCPNG corporate policies for currency and compliance, and update outdated policies as required.' },
        { title: 'Coordinate SCPNG participation in IOSCO Annual Conference', description: 'Manage logistics, travel, and documentation for SCPNG representation at the IOSCO Annual Conference and committee meetings.' },
        { title: 'Prepare progress report on ADB capital market development commitments', description: 'Compile SCPNG progress on ADB loan commitments and prepare the quarterly ADB project implementation progress report.' },
        { title: 'Draft Board resolutions for corporate actions requiring Board approval', description: 'Prepare formal Board resolutions for corporate actions including banking authorities, investment approvals, and policy decisions.' },
        { title: 'Coordinate the SCPNG all-staff meeting and prepare briefing materials', description: 'Organise the all-staff meeting, prepare the CEO briefing presentation, and manage logistics for all staff participation.' },
        { title: 'Review regulatory compliance framework update for Management endorsement', description: 'Compile and present updates to the SCPNG regulatory compliance framework for Management Committee endorsement.' },
        { title: 'Prepare ministerial briefing note on capital market developments for the Minister', description: 'Draft a concise ministerial briefing on current PNG capital market conditions and SCPNG regulatory activities.' },
    ],
    'Executive': [
        { title: 'Prepare Board meeting agenda and chair pre-Board management review', description: 'Finalise Board agenda with management team and chair pre-Board briefing to ensure all papers are ready and aligned.' },
        { title: 'Draft CEO quarterly performance report to the Chairman', description: 'Compile performance data from all divisions and draft the quarterly CEO performance report for Chairman submission.' },
        { title: 'Coordinate the Strategic Plan 2025-2030 mid-year review', description: 'Lead the mid-year strategic plan review, assess progress against targets, and present findings to the Board.' },
        { title: 'Prepare Cabinet submission on proposed regulatory amendments', description: 'Draft and finalise Cabinet submission for proposed regulatory changes requiring Ministerial and Cabinet endorsement.' },
        { title: 'Update and present corporate risk register to Management Committee', description: 'Lead the quarterly corporate risk review with the Management Committee and update the risk register with new and emerging risks.' },
        { title: 'Coordinate high-level stakeholder consultations on capital market reform', description: 'Lead stakeholder engagement sessions with industry, government, and international partners on capital market reform proposals.' },
        { title: 'Finalise and present the SCPNG Annual Report to the Board', description: 'Oversee completion of the SCPNG Annual Report and present it to the Board for approval before statutory submission.' },
        { title: 'Negotiate and finalise MOU with regional regulatory body', description: 'Lead negotiations and finalise the formal MOU with a regional regulatory counterpart for information sharing and cooperation.' },
        { title: 'Approve and submit SCPNG annual budget to the Board', description: 'Review and approve the consolidated SCPNG annual budget and present it to the Board for formal approval.' },
        { title: 'Prepare and deliver executive brief to Minister on market developments', description: 'Prepare a comprehensive ministerial brief on PNG capital market conditions and regulatory developments for the Minister of Treasury.' },
        { title: 'Review and approve internal audit findings and management action plan', description: 'Review internal audit report with the Audit Committee, approve management responses, and oversee implementation tracking.' },
        { title: 'Chair the SCPNG Management Committee meeting', description: 'Chair the monthly Management Committee meeting, review division performance updates, and address strategic issues.' },
        { title: 'Deliver CEO address to all staff and present strategic priorities', description: 'Deliver the CEO all-staff briefing on organisational performance, strategic priorities, and key messages for the period.' },
        { title: 'Review and approve corporate policy updates before implementation', description: 'Review updated SCPNG corporate policies, consult with Legal and HR, and approve for implementation.' },
        { title: 'Lead SCPNG delegation to IOSCO Annual Conference', description: 'Lead the SCPNG delegation to the IOSCO Annual Conference, attend committee sessions, and represent PNG regulatory interests.' },
        { title: 'Oversee delivery of ADB capital market development project commitments', description: 'Monitor and report on progress of all SCPNG commitments under the ADB capital market development loan agreement.' },
        { title: 'Approve Board resolutions and execute corporate documents', description: 'Review, approve, and execute Board resolutions, deeds, and other corporate documents requiring CEO authorisation.' },
        { title: 'Present SCPNG strategy update to the Board of Commissioners', description: 'Prepare and deliver a strategic update presentation to the SCPNG Board covering market conditions and regulatory progress.' },
        { title: 'Review and approve the regulatory compliance framework annual report', description: 'Review the annual compliance report across all divisions and present findings to the Board Audit and Risk Committee.' },
        { title: 'Coordinate SCPNG response to government policy consultation', description: 'Lead SCPNG input to government policy consultations on financial sector regulation and capital market development.' },
    ],
    'Admin': [
        { title: 'Order and distribute office stationery and consumables for all divisions', description: 'Assess stock levels, prepare and submit purchase requisition for stationery and consumables, and distribute to divisions.' },
        { title: 'Coordinate building maintenance request with property manager', description: 'Raise and follow up maintenance requests with the building manager for office repairs and facilities issues.' },
        { title: 'Process and route incoming mail to relevant divisions', description: 'Open, record, sort, and deliver incoming mail and courier packages to the correct divisions on a daily basis.' },
        { title: 'Set up and manage meeting room bookings for upcoming week', description: 'Process meeting room booking requests, set up rooms with required equipment, and manage scheduling conflicts.' },
        { title: 'Update and circulate the SCPNG office contact directory', description: 'Review and update the SCPNG internal phone and email directory with current staff details and distribute to all staff.' },
        { title: 'Coordinate SCPNG vehicle scheduling and log maintenance', description: 'Manage the official vehicle booking register, arrange servicing, and maintain vehicle log records for all SCPNG vehicles.' },
        { title: 'Arrange servicing and maintenance of office equipment', description: 'Coordinate scheduled servicing of photocopiers, printers, and other office equipment with service providers.' },
        { title: 'Process and reconcile petty cash claims for the division', description: 'Receive petty cash claims, verify receipts, disburse approved amounts, and reconcile petty cash box at end of period.' },
        { title: 'Manage front desk reception and visitor register for SCPNG office', description: 'Staff the reception desk, receive and direct visitors, manage visitor register, and handle general enquiries.' },
        { title: 'Prepare office supply budget estimate for next quarter', description: 'Review consumption patterns and prepare quarterly office supplies budget estimate for Finance division approval.' },
        { title: 'Organise and maintain divisional filing and archive records', description: 'Review, organise, and update physical and electronic filing systems for the division in line with records management policy.' },
        { title: 'Coordinate catering and logistics for Board meeting', description: 'Arrange catering, set up Board room, prepare materials, and coordinate all logistics for the upcoming Board meeting.' },
        { title: 'Prepare and despatch outgoing correspondence and reports', description: 'Process, package, and despatch outgoing correspondence, reports, and parcels by courier and mail services.' },
        { title: 'Update SCPNG notice board with current staff notices and announcements', description: 'Maintain the office notice board with current HR notices, regulatory updates, and internal staff announcements.' },
        { title: 'Coordinate office cleaning schedule with cleaning contractor', description: 'Review cleaning standards, address any deficiencies with the contractor, and coordinate deep cleaning schedule.' },
        { title: 'Process and reconcile staff telephone expense claims', description: 'Collect, verify, and process staff mobile phone expense claims and prepare the monthly reconciliation for Finance.' },
        { title: 'Manage office access card and key register for security compliance', description: 'Maintain the office access card register, collect keys from departing staff, and report lost access cards to IT.' },
        { title: 'Prepare monthly administrative operations report for Management', description: 'Compile administrative activity data and prepare the monthly operations report for the Director Corporate Service.' },
        { title: 'Coordinate procurement of new office furniture for Division B', description: 'Prepare specifications, obtain quotes, and coordinate procurement and delivery of new office furniture for Division B.' },
        { title: 'Manage kitchen supplies and ensure hygiene standards are maintained', description: 'Order and restock kitchen supplies, monitor hygiene standards in staff kitchen and tea room areas.' },
    ],
};

// Deterministic status and priority arrays aligned by index position (20 entries each)
const KRA_STATUS_CYCLE = ['on-track', 'on-track', 'at-risk', 'on-track', 'completed', 'at-risk', 'on-track', 'on-track', 'behind', 'on-track', 'on-track', 'at-risk', 'on-track', 'completed', 'on-track', 'at-risk', 'on-track', 'on-track', 'behind', 'on-track'] as const;
const KPI_STATUS_CYCLE = ['on-track', 'in-progress', 'at-risk', 'completed', 'on-track', 'in-progress', 'behind', 'on-track', 'completed', 'at-risk', 'on-track', 'in-progress', 'on-track', 'completed', 'at-risk', 'on-track', 'in-progress', 'behind', 'on-track', 'completed'] as const;
const TASK_STATUS_CYCLE: Task['status'][] = ['in-progress', 'todo', 'in-progress', 'done', 'in-review', 'in-progress', 'todo', 'completed', 'in-progress', 'on-hold', 'in-progress', 'done', 'todo', 'in-review', 'in-progress', 'completed', 'todo', 'in-progress', 'done', 'in-progress'];
const TASK_PRIORITY_CYCLE: Task['priority'][] = ['high', 'medium', 'high', 'medium', 'high', 'urgent', 'low', 'medium', 'high', 'medium', 'low', 'high', 'medium', 'medium', 'high', 'low', 'medium', 'high', 'medium', 'urgent'];

// Due date spread: index 0-4 = Feb-Mar 2025, 5-9 = May-Jun, 10-14 = Aug-Sep, 15-19 = Nov-Dec
const TASK_DUE_DATES = [
    '2025-02-15', '2025-02-28', '2025-03-10', '2025-03-20', '2025-03-31',
    '2025-05-08', '2025-05-22', '2025-06-05', '2025-06-18', '2025-06-30',
    '2025-08-07', '2025-08-21', '2025-09-04', '2025-09-18', '2025-09-30',
    '2025-11-06', '2025-11-20', '2025-12-04', '2025-12-15', '2025-12-31',
];

/**
 * Generate 2 KRAs + 4 KPIs + 20 tasks for each SCPNG officer
 * No test labels — data is production-grade seeding
 */
export function generateAllOfficerData(
    staffList: StaffMember[],
    objectives: Array<{ id: string | number; title: string }>
): { kras: Kra[]; kpis: Kpi[]; tasks: Task[] } {
    const allKras: Kra[] = [];
    const allKpis: Kpi[] = [];
    const allTasks: Task[] = [];

    let kraCounter = 1;
    let kpiCounter = 1;
    let taskCounter = 1;

    staffList.forEach((staff) => {
        const roleCategory = getRoleCategory(staff);
        const kraTemplates = OFFICER_KRA_TEMPLATES[roleCategory] || OFFICER_KRA_TEMPLATES['Admin'];
        const kpiTemplates = OFFICER_KPI_TEMPLATES[roleCategory] || OFFICER_KPI_TEMPLATES['Admin'];
        const taskTemplates = OFFICER_TASK_TEMPLATES[roleCategory] || OFFICER_TASK_TEMPLATES['Admin'];

        const staffKraIds: string[] = [];

        // --- 2 KRAs per officer ---
        kraTemplates.slice(0, 2).forEach((kraTemplate) => {
            const kraId = `KRA_${kraCounter}`;
            const objective = objectives.length > 0 ? objectives[kraCounter % objectives.length] : null;

            const kra: Kra = {
                id: kraId,
                title: kraTemplate.title,
                description: kraTemplate.description,
                objective_id: objective?.id || null,
                department: staff.officeLocation,
                unit: staff.department,
                unitId: null,
                startDate: '2025-01-15',
                start_date: '2025-01-15',
                targetDate: '2025-12-31',
                target_date: '2025-12-31',
                status: KRA_STATUS_CYCLE[kraCounter % KRA_STATUS_CYCLE.length] as any,
                owner: { id: staff.id, name: staff.displayName, email: staff.mail },
                ownerId: staff.id,
                unitKpis: [],
                unitObjectives: objective ? { title: objective.title } : null,
            };

            allKras.push(kra);
            staffKraIds.push(kraId);
            kraCounter++;
        });

        // --- 2 KPIs per KRA (4 total per officer) ---
        const staffKpiIds: string[] = [];
        staffKraIds.forEach((kraId, ki) => {
            const kpiPair = kpiTemplates.slice(ki * 2, ki * 2 + 2);
            kpiPair.forEach((kpiTemplate) => {
                const kpiId = `KPI_${kpiCounter}`;
                const target = kpiTemplate.target;
                const actual = Math.min(target, Math.round(target * (0.55 + (kpiCounter % 10) * 0.04)));

                const kpi: Kpi = {
                    id: kpiId,
                    kra_id: kraId,
                    name: kpiTemplate.name,
                    description: kpiTemplate.description,
                    target,
                    actual,
                    metric: kpiTemplate.metric,
                    unit: kpiTemplate.metric,
                    progress: Math.round((actual / target) * 100),
                    status: KPI_STATUS_CYCLE[kpiCounter % KPI_STATUS_CYCLE.length] as any,
                    startDate: '2025-01-15',
                    start_date: '2025-01-15',
                    targetDate: '2025-12-31',
                    target_date: '2025-12-31',
                    assignees: [{ id: staff.id, name: staff.displayName, email: staff.mail }],
                    comments: '',
                    costAssociated: kpiTemplate.cost,
                };

                allKpis.push(kpi);
                staffKpiIds.push(kpiId);
                kpiCounter++;
            });
        });

        // --- 20 tasks per officer ---
        taskTemplates.slice(0, 20).forEach((taskTemplate, ti) => {
            const kpiId = staffKpiIds[ti % staffKpiIds.length];
            const kraId = staffKraIds[ti % staffKraIds.length];
            const status = TASK_STATUS_CYCLE[ti % TASK_STATUS_CYCLE.length];

            const task: Task = {
                id: `TASK_${taskCounter}`,
                title: taskTemplate.title,
                description: taskTemplate.description,
                status,
                priority: TASK_PRIORITY_CYCLE[ti % TASK_PRIORITY_CYCLE.length],
                assignee: staff.displayName,
                assignedTo: staff.mail,
                dueDate: TASK_DUE_DATES[ti % TASK_DUE_DATES.length],
                startDate: new Date('2025-01-06'),
                kpi_id: kpiId,
                kra_id: kraId,
                unit_id: staff.department,
                completionPercentage: (status === 'done' || status === 'completed') ? 100 : (ti * 5) % 85,
                completed: status === 'done' || status === 'completed',
            };

            allTasks.push(task);
            taskCounter++;
        });
    });

    return { kras: allKras, kpis: allKpis, tasks: allTasks };
}
