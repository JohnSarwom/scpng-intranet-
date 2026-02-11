/**
 * Mock Performance Data Generator
 * Generates realistic KRAs, KPIs, and Tasks for staff members
 * with proper linkages to Strategic Objectives and deliverables
 */

import { Kra, Kpi, Task, User } from '@/types';

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
    task: ['in-progress', 'in-progress', 'todo', 'done', 'review']
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
        const status = randomItem(STATUS_DISTRIBUTION.task) as 'todo' | 'in-progress' | 'review' | 'done';

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
