/**
 * SCPNG Strategic Performance Framework — Seed Service
 *
 * Deletes all existing Unit_Objectives, Performance_KRAs, and Performance_KPIs
 * then recreates the full 5-Goal / 18-KRA / 72-KPI framework from the official
 * "KPIs & KRAs.xlsx" document, including division-level bridge objectives so
 * the Strategy cascade page hierarchy populates correctly per division/unit.
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { SharePointOpsService } from './sharePointOpsService';

// ─── TYPE DEFINITIONS ─────────────────────────────────────────────────────────

interface GoalRecord {
    id: string;
    title: string;
    outcome: string;
}

interface KraRecord {
    id: string;
    goalId: string;
    title: string;
    division: string;
    unit: string;
    responsibleOfficer: string;
}

interface KpiRecord {
    kraId: string;
    title: string;
    description: string;
    annualTarget: string;
    target: number;
    metric: string;
    assignedOfficer: string;
}

export interface SeedResult {
    success: boolean;
    message: string;
    stats: { goals: number; bridgeObjectives: number; kras: number; kpis: number };
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────

const STRATEGIC_GOALS: GoalRecord[] = [
    {
        id: 'G1',
        title: 'Strategic Goal 1 — Policy Development',
        outcome: 'The capital market regulatory environment suits the PNG economy, provides clear rules about appropriate behavior, and encourages additional products into the market.',
    },
    {
        id: 'G2',
        title: 'Strategic Goal 2 — Enforcement & Compliance',
        outcome: 'Capital market participants are properly licensed, monitored, and compliant; breaches are sanctioned effectively; and investor confidence in market integrity is strengthened.',
    },
    {
        id: 'G3',
        title: 'Strategic Goal 3 — Education & Awareness',
        outcome: 'Providers of regulated services and investors in financial markets understand the rules, processes, and opportunities, and what to expect when they engage with the SCPNG.',
    },
    {
        id: 'G4',
        title: 'Strategic Goal 4 — Institutional Performance',
        outcome: 'Demonstrate strong governance and leadership, improve capability and capacity, and be recognised as an independent and expert body.',
    },
    {
        id: 'G5',
        title: 'Strategic Goal 5 — International & Inter-Agency Cooperation',
        outcome: 'SCPNG maintains strong national and international partnerships that enhance regulatory capability, information sharing, SME support, and global credibility.',
    },
];

// Division names match the actual org hierarchy exactly
const DIV = {
    CEO:       'Office of the Chairman',
    CORP:      'Corporate Services Division',
    LISD:      'Licensing, Market & Supervision Division',
    LEGAL:     'Legal Services Division',
    RP:        'Research & Publication Division',
};

const UNIT = {
    EXEC:      'Executive Division',
    SECRETARIAT: 'Secretariat Unit',
    FINANCE:   'Finance Unit',
    IT:        'IT Unit',
    HR:        'Human Resource Unit',
    LICENSING: 'Licensing Unit',
    SUPERVISION: 'Supervision Unit',
    MARKET:    'Market Data Unit',
    INVEST:    'Investigations Unit',
    LEGAL_ADV: 'Legal Advisory Unit',
    RESEARCH:  'Research Unit',
    PUBLISH:   'Publication Unit',
};

const KRAS: KraRecord[] = [
    // ── Goal 1: Policy Development ───────────────────────────────────────────
    { id: 'KRA-1.1', goalId: 'G1', division: DIV.CEO,   unit: UNIT.SECRETARIAT, responsibleOfficer: 'Andy Ambulu',   title: 'KRA 1.1: Seek changes to the legislative frameworks to suit the PNG economy' },
    { id: 'KRA-1.2', goalId: 'G1', division: DIV.LEGAL, unit: UNIT.LEGAL_ADV,   responsibleOfficer: 'Tyson Yapao',   title: 'KRA 1.2: Draft the regulations and codes required to support the legislation' },
    { id: 'KRA-1.3', goalId: 'G1', division: DIV.RP,    unit: UNIT.RESEARCH,    responsibleOfficer: 'Joy Komba',     title: 'KRA 1.3: Establish a regulatory framework to support new products and digital assets' },
    { id: 'KRA-1.4', goalId: 'G1', division: DIV.CEO,   unit: UNIT.EXEC,        responsibleOfficer: 'James Joshua',  title: 'KRA 1.4: Contribute to improving investment in PNG capital markets' },
    // ── Goal 2: Enforcement & Compliance ────────────────────────────────────
    { id: 'KRA-2.1', goalId: 'G2', division: DIV.LISD,  unit: UNIT.LICENSING,   responsibleOfficer: 'Zomay Apini',   title: 'KRA 2.1: License providers of regulated services' },
    { id: 'KRA-2.2', goalId: 'G2', division: DIV.LISD,  unit: UNIT.SUPERVISION, responsibleOfficer: 'Zomay Apini',   title: 'KRA 2.2: Supervise the behavior of license holders' },
    { id: 'KRA-2.3', goalId: 'G2', division: DIV.LISD,  unit: UNIT.INVEST,      responsibleOfficer: 'Zomay Apini',   title: 'KRA 2.3: Investigate breaches and initiate sanctions' },
    // ── Goal 3: Education & Awareness ───────────────────────────────────────
    { id: 'KRA-3.1', goalId: 'G3', division: DIV.RP,    unit: UNIT.PUBLISH,     responsibleOfficer: 'Joy Komba',     title: 'KRA 3.1: Develop and implement a stakeholder engagement strategy' },
    { id: 'KRA-3.2', goalId: 'G3', division: DIV.RP,    unit: UNIT.PUBLISH,     responsibleOfficer: 'Joy Komba',     title: 'KRA 3.2: Develop and implement SME engagement strategy' },
    { id: 'KRA-3.3', goalId: 'G3', division: DIV.RP,    unit: UNIT.PUBLISH,     responsibleOfficer: 'Joy Komba',     title: 'KRA 3.3: Improve transparency via SCPNG website' },
    // ── Goal 4: Institutional Performance ───────────────────────────────────
    { id: 'KRA-4.1', goalId: 'G4', division: DIV.CEO,   unit: UNIT.EXEC,        responsibleOfficer: 'James Joshua',  title: 'KRA 4.1: Strengthen governance and leadership' },
    { id: 'KRA-4.2', goalId: 'G4', division: DIV.CORP,  unit: UNIT.HR,          responsibleOfficer: 'Sam Taki',      title: 'KRA 4.2: Develop and enhance capability and capacity' },
    { id: 'KRA-4.3', goalId: 'G4', division: DIV.CORP,  unit: UNIT.IT,          responsibleOfficer: 'Sam Taki',      title: 'KRA 4.3: Develop and improve IT infrastructure and systems' },
    { id: 'KRA-4.4', goalId: 'G4', division: DIV.CORP,  unit: UNIT.HR,          responsibleOfficer: 'Sam Taki',      title: 'KRA 4.4: Develop and implement internal operational and administrative policies' },
    { id: 'KRA-4.5', goalId: 'G4', division: DIV.CORP,  unit: UNIT.FINANCE,     responsibleOfficer: 'Sam Taki',      title: 'KRA 4.5: Ensure financial sustainability' },
    // ── Goal 5: International & Inter-Agency Cooperation ────────────────────
    { id: 'KRA-5.1', goalId: 'G5', division: DIV.LEGAL, unit: UNIT.LEGAL_ADV,   responsibleOfficer: 'Andy Ambulu',   title: 'KRA 5.1: IOSCO MOU compliance' },
    { id: 'KRA-5.2', goalId: 'G5', division: DIV.CEO,   unit: UNIT.EXEC,        responsibleOfficer: 'James Joshua',  title: 'KRA 5.2: Global partnerships' },
    { id: 'KRA-5.3', goalId: 'G5', division: DIV.CEO,   unit: UNIT.EXEC,        responsibleOfficer: 'James Joshua',  title: 'KRA 5.3: Inter-agency cooperation' },
];

const KPIS: KpiRecord[] = [
    // ── KRA 1.1 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-1.1', title: 'Legislative review completed', description: 'Completion of a comprehensive review of existing capital market legislation to identify gaps, inconsistencies, and areas requiring amendment to suit the PNG economic context.', annualTarget: 'Legislative review completed and formally documented', target: 1, metric: 'Yes/No', assignedOfficer: 'Andy Ambulu' },
    { kraId: 'KRA-1.1', title: 'Number of amendment proposals submitted', description: 'The total number of formal legislative amendment proposals prepared and submitted to the Minister, NEC, or relevant authorities within the reporting year.', annualTarget: 'At least 3 amendment proposals submitted', target: 3, metric: 'Narrative', assignedOfficer: 'Andy Ambulu' },
    { kraId: 'KRA-1.1', title: 'Number of stakeholder consultations conducted', description: '', annualTarget: 'Minimum of 5 stakeholder consultations conducted', target: 5, metric: '#', assignedOfficer: 'Andy Ambulu' },
    { kraId: 'KRA-1.1', title: 'Timeliness of submissions to Minister/NEC', description: '', annualTarget: 'All submissions delivered within approved timelines', target: 1, metric: '#', assignedOfficer: 'James Joshua' },
    // ── KRA 1.2 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-1.2', title: 'Number of regulations/codes drafted', description: '', annualTarget: 'At least 4 regulations or codes drafted', target: 4, metric: '#', assignedOfficer: 'Tyson Yapao' },
    { kraId: 'KRA-1.2', title: 'Number of regulations gazetted', description: '', annualTarget: 'At least 2 regulations gazetted', target: 2, metric: '#', assignedOfficer: 'Tyson Yapao' },
    { kraId: 'KRA-1.2', title: 'Number of guidelines or practice notes issued', description: '', annualTarget: 'Minimum of 3 guidelines or practice notes issued', target: 3, metric: '#', assignedOfficer: 'Tyson Yapao' },
    { kraId: 'KRA-1.2', title: 'Stakeholder compliance clarity rating', description: '', annualTarget: 'Clear and improved compliance understanding demonstrated by stakeholders', target: 1, metric: 'Yes/No', assignedOfficer: 'Tyson Yapao' },
    // ── KRA 1.3 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-1.3', title: 'Number of new product frameworks approved', description: '', annualTarget: 'At least 2 new product frameworks approved', target: 2, metric: '#', assignedOfficer: 'Joy Komba' },
    { kraId: 'KRA-1.3', title: 'Research papers completed', description: '', annualTarget: 'Minimum of 3 research papers completed', target: 3, metric: '#', assignedOfficer: 'Joy Komba' },
    { kraId: 'KRA-1.3', title: 'Market consultations conducted', description: '', annualTarget: 'At least 4 market consultations conducted', target: 4, metric: '#', assignedOfficer: 'Joy Komba' },
    { kraId: 'KRA-1.3', title: 'Time taken to approve new frameworks', description: '', annualTarget: 'Frameworks approved within agreed internal timeframes', target: 1, metric: 'Narrative', assignedOfficer: 'Joy Komba' },
    // ── KRA 1.4 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-1.4', title: 'SCPNG inputs to FSDS submitted', description: '', annualTarget: 'All requested FSDS inputs submitted', target: 100, metric: '#', assignedOfficer: 'Ninipe Gurumo' },
    { kraId: 'KRA-1.4', title: 'Participation in FSC meetings (%)', description: '', annualTarget: 'At least 90% participation rate', target: 90, metric: '%', assignedOfficer: 'James Joshua' },
    { kraId: 'KRA-1.4', title: 'Number of inter-agency initiatives supported', description: '', annualTarget: 'Minimum of 3 initiatives supported', target: 3, metric: '#', assignedOfficer: 'James Joshua' },
    { kraId: 'KRA-1.4', title: 'Evidence of SCPNG recommendations adopted', description: '', annualTarget: 'At least 2 SCPNG recommendations adopted', target: 2, metric: '#', assignedOfficer: 'James Joshua' },
    // ── KRA 2.1 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-2.1', title: 'Number of licences issued or renewed', description: '', annualTarget: 'All eligible licence applications processed', target: 100, metric: '#', assignedOfficer: 'Zomay Apini' },
    { kraId: 'KRA-2.1', title: 'Average licence processing time', description: '', annualTarget: 'Applications processed within prescribed timelines', target: 100, metric: '#', assignedOfficer: 'Zomay Apini' },
    { kraId: 'KRA-2.1', title: 'Percentage of applications processed electronically', description: '', annualTarget: 'At least 75% processed electronically', target: 75, metric: '%', assignedOfficer: 'Zomay Apini' },
    { kraId: 'KRA-2.1', title: 'Licensing compliance rate', description: '', annualTarget: 'Minimum 90% compliance rate', target: 90, metric: '%', assignedOfficer: 'Zomay Apini' },
    // ── KRA 2.2 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-2.2', title: 'Number of inspections conducted', description: '', annualTarget: 'At least 10 inspections conducted', target: 10, metric: '#', assignedOfficer: 'Zomay Apini' },
    { kraId: 'KRA-2.2', title: 'Percentage of licensees reviewed annually', description: '', annualTarget: 'At least 80% of licensees reviewed', target: 80, metric: '%', assignedOfficer: 'Zomay Apini' },
    { kraId: 'KRA-2.2', title: 'Compliance issues identified', description: '', annualTarget: 'Compliance issues identified and documented', target: 1, metric: 'Narrative', assignedOfficer: 'Zomay Apini' },
    { kraId: 'KRA-2.2', title: 'Time taken to close supervisory findings', description: '', annualTarget: 'Findings closed within agreed timelines', target: 100, metric: '%', assignedOfficer: 'Zomay Apini' },
    // ── KRA 2.3 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-2.3', title: 'Investigations initiated', description: '', annualTarget: 'All suspected breaches assessed and actioned', target: 100, metric: '#', assignedOfficer: 'Zomay Apini' },
    { kraId: 'KRA-2.3', title: 'Investigations completed within timeframe', description: '', annualTarget: 'At least 85% completed within timeframe', target: 85, metric: '%', assignedOfficer: 'Zomay Apini' },
    { kraId: 'KRA-2.3', title: 'Sanctions imposed', description: '', annualTarget: 'Sanctions applied where breaches are substantiated', target: 100, metric: '#', assignedOfficer: 'Zomay Apini' },
    { kraId: 'KRA-2.3', title: 'Repeat breach reduction rate', description: '', annualTarget: 'Reduction in repeat breaches demonstrated', target: 100, metric: '%', assignedOfficer: 'Zomay Apini' },
    // ── KRA 3.1 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-3.1', title: 'Engagement strategy approved', description: '', annualTarget: 'Stakeholder engagement strategy approved', target: 1, metric: 'Narrative', assignedOfficer: 'Joy Komba' },
    { kraId: 'KRA-3.1', title: 'Outreach events conducted', description: '', annualTarget: 'At least 10 outreach events conducted', target: 10, metric: '#', assignedOfficer: 'Joy Komba' },
    { kraId: 'KRA-3.1', title: 'Number of stakeholders reached', description: '', annualTarget: 'Minimum of 1,000 stakeholders reached', target: 1000, metric: '#', assignedOfficer: 'Joy Komba' },
    { kraId: 'KRA-3.1', title: 'Satisfaction rating from engagements', description: '', annualTarget: 'Positive stakeholder feedback recorded', target: 1, metric: 'Narrative', assignedOfficer: 'Joy Komba' },
    // ── KRA 3.2 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-3.2', title: 'SME engagement strategy approved', description: '', annualTarget: 'SME engagement strategy approved', target: 1, metric: 'Narrative', assignedOfficer: 'Joy Komba' },
    { kraId: 'KRA-3.2', title: 'SME outreach campaigns delivered', description: '', annualTarget: 'At least 5 SME outreach campaigns delivered', target: 5, metric: '#', assignedOfficer: 'Joy Komba' },
    { kraId: 'KRA-3.2', title: 'SMEs engaged', description: '', annualTarget: 'Minimum of 300 SMEs engaged', target: 300, metric: '#', assignedOfficer: 'Joy Komba' },
    { kraId: 'KRA-3.2', title: 'SME product uptake indicators', description: '', annualTarget: 'Improved SME participation indicators demonstrated', target: 1, metric: 'Narrative', assignedOfficer: 'Joy Komba' },
    // ── KRA 3.3 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-3.3', title: 'Percentage of website content updated', description: '', annualTarget: 'At least 80% of website content updated', target: 80, metric: '%', assignedOfficer: 'Joy Komba' },
    { kraId: 'KRA-3.3', title: 'Number of educational materials published', description: '', annualTarget: 'Minimum of 12 educational materials published', target: 12, metric: '#', assignedOfficer: 'Joy Komba' },
    { kraId: 'KRA-3.3', title: 'Website usage analytics', description: '', annualTarget: 'Increased website usage demonstrated', target: 1, metric: 'Narrative', assignedOfficer: 'Joy Komba' },
    { kraId: 'KRA-3.3', title: 'Frequency of content updates', description: '', annualTarget: 'Content updated at least monthly', target: 12, metric: '#', assignedOfficer: 'Joy Komba' },
    // ── KRA 4.1 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-4.1', title: 'Board and Permanent CEO appointed', description: '', annualTarget: 'Board and CEO appointed', target: 1, metric: 'Yes/No', assignedOfficer: 'James Joshua' },
    { kraId: 'KRA-4.1', title: 'Board meetings held', description: '', annualTarget: 'All scheduled Board meetings held', target: 1, metric: 'Yes/No', assignedOfficer: 'Joy Komba' },
    { kraId: 'KRA-4.1', title: 'Percentage of Board resolutions implemented', description: '', annualTarget: 'At least 90% of resolutions implemented', target: 90, metric: '%', assignedOfficer: 'James Joshua' },
    { kraId: 'KRA-4.1', title: 'Governance policies approved', description: '', annualTarget: 'All priority governance policies approved', target: 100, metric: '#', assignedOfficer: 'James Joshua' },
    // ── KRA 4.2 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-4.2', title: 'Percentage of critical positions filled', description: '', annualTarget: 'At least 85% of critical positions filled', target: 85, metric: '%', assignedOfficer: 'Sam Taki' },
    { kraId: 'KRA-4.2', title: 'Staff trained annually', description: '', annualTarget: 'At least 75% of staff trained', target: 75, metric: '%', assignedOfficer: 'Sam Taki' },
    { kraId: 'KRA-4.2', title: 'Training hours per staff', description: '', annualTarget: 'Minimum of 20 training hours per staff', target: 20, metric: '#', assignedOfficer: 'Sam Taki' },
    { kraId: 'KRA-4.2', title: 'Staff retention rate', description: '', annualTarget: 'Minimum 90% staff retention rate', target: 90, metric: '%', assignedOfficer: 'Sam Taki' },
    // ── KRA 4.3 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-4.3', title: 'Centurion modules completed (%)', description: '', annualTarget: 'At least 80% of planned modules completed', target: 80, metric: '%', assignedOfficer: 'Sam Taki' },
    { kraId: 'KRA-4.3', title: 'Regulatory processes digitized', description: '', annualTarget: 'Minimum of 5 processes digitized', target: 5, metric: '#', assignedOfficer: 'Sam Taki' },
    { kraId: 'KRA-4.3', title: 'System uptime (%)', description: '', annualTarget: 'At least 95% system uptime', target: 95, metric: '%', assignedOfficer: 'Sam Taki' },
    { kraId: 'KRA-4.3', title: 'Processing time reduction', description: '', annualTarget: 'Demonstrable reduction in processing times', target: 1, metric: 'Yes/No', assignedOfficer: 'Sam Taki' },
    // ── KRA 4.4 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-4.4', title: 'Internal policies developed', description: '', annualTarget: 'Minimum of 6 internal policies developed', target: 6, metric: '#', assignedOfficer: 'Sam Taki' },
    { kraId: 'KRA-4.4', title: 'Percentage of policies approved', description: '', annualTarget: '100% of developed policies approved', target: 100, metric: '%', assignedOfficer: 'Sam Taki' },
    { kraId: 'KRA-4.4', title: 'Staff compliance awareness rate', description: '', annualTarget: 'High staff awareness demonstrated', target: 1, metric: 'Yes/No', assignedOfficer: 'Sam Taki' },
    { kraId: 'KRA-4.4', title: 'Internal audit findings resolved', description: '', annualTarget: 'At least 90% of findings resolved', target: 90, metric: '%', assignedOfficer: 'Sam Taki' },
    // ── KRA 4.5 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-4.5', title: 'Cost-recovery framework approved', description: '', annualTarget: 'Cost-recovery framework approved', target: 1, metric: 'Narrative', assignedOfficer: 'Sam Taki' },
    { kraId: 'KRA-4.5', title: 'Budget execution rate', description: '', annualTarget: 'At least 95% budget execution rate', target: 95, metric: '%', assignedOfficer: 'Sam Taki' },
    { kraId: 'KRA-4.5', title: 'Timeliness of financial reports', description: '', annualTarget: 'All financial reports submitted on time', target: 1, metric: 'Yes/No', assignedOfficer: 'Sam Taki' },
    { kraId: 'KRA-4.5', title: 'Audit issues resolved', description: '', annualTarget: 'All audit issues resolved', target: 1, metric: 'Yes/No', assignedOfficer: 'Sam Taki' },
    // ── KRA 5.1 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-5.1', title: 'IOSCO assessment completed', description: '', annualTarget: 'IOSCO assessment completed', target: 1, metric: 'Narrative', assignedOfficer: 'Andy Ambulu' },
    { kraId: 'KRA-5.1', title: 'MOU status achieved', description: '', annualTarget: 'MOU status achieved or maintained', target: 1, metric: 'Narrative', assignedOfficer: 'Andy Ambulu' },
    { kraId: 'KRA-5.1', title: 'Percentage of gaps addressed', description: '', annualTarget: 'At least 80% of gaps addressed', target: 80, metric: '%', assignedOfficer: 'Andy Ambulu' },
    { kraId: 'KRA-5.1', title: 'Timeliness against IOSCO roadmap', description: '', annualTarget: 'All roadmap milestones met on time', target: 100, metric: 'Narrative', assignedOfficer: 'James Joshua' },
    // ── KRA 5.2 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-5.2', title: 'Active MOAs maintained', description: '', annualTarget: 'All existing MOAs maintained', target: 100, metric: '#', assignedOfficer: 'James Joshua' },
    { kraId: 'KRA-5.2', title: 'Technical assistance activities delivered', description: '', annualTarget: 'Minimum of 5 TA activities delivered', target: 5, metric: '#', assignedOfficer: 'James Joshua' },
    { kraId: 'KRA-5.2', title: 'Capacity-building outputs achieved', description: '', annualTarget: 'All agreed outputs delivered', target: 100, metric: 'Narrative', assignedOfficer: 'James Joshua' },
    { kraId: 'KRA-5.2', title: 'Partner performance reviews conducted', description: '', annualTarget: 'At least 2 partner reviews conducted', target: 2, metric: '#', assignedOfficer: 'James Joshua' },
    // ── KRA 5.3 ──────────────────────────────────────────────────────────────
    { kraId: 'KRA-5.3', title: 'Number of Memoranda of Agreement signed with national agencies', description: '', annualTarget: 'Minimum of 3 MOAs signed', target: 3, metric: '#', assignedOfficer: 'James Joshua' },
    { kraId: 'KRA-5.3', title: 'Data-sharing mechanisms operational', description: '', annualTarget: 'Data-sharing mechanisms operational', target: 1, metric: 'Narrative', assignedOfficer: 'James Joshua' },
    { kraId: 'KRA-5.3', title: 'Joint SME initiatives supported', description: '', annualTarget: 'At least 3 joint SME initiatives supported', target: 3, metric: '#', assignedOfficer: 'Joy Komba' },
    { kraId: 'KRA-5.3', title: 'Inter-agency engagements conducted', description: '', annualTarget: 'Minimum of 6 inter-agency engagements conducted', target: 6, metric: '#', assignedOfficer: 'James Joshua' },
];

// ─── SERVICE CLASS ────────────────────────────────────────────────────────────

export class KraKpiSeedService {
    private opsService: SharePointOpsService;

    constructor(client: Client) {
        this.opsService = new SharePointOpsService(client);
    }

    /**
     * Deletes ALL items in Unit_Objectives, Performance_KRAs, Performance_KPIs
     * then recreates the full SCPNG Strategic Performance Framework:
     *   • 5 org-level Strategic Goals (visible on Strategy overview)
     *   • 18 division-level bridge objectives (visible in the cascade hierarchy per division)
     *   • 18 KRAs linked to their bridge objectives
     *   • 72 KPIs linked to their KRAs
     */
    async resetAndSeed(onProgress?: (line: string) => void): Promise<SeedResult> {
        const log = (line: string) => {
            console.log(`[KraKpiSeed] ${line}`);
            onProgress?.(line);
        };

        log('Initializing SharePoint connection...');
        await this.opsService.initialize();

        // ── 1. DELETE all KPIs ─────────────────────────────────────────────
        log('Fetching existing KPIs to delete...');
        const existingKpis = await this.opsService.getKPIs();
        log(`Found ${existingKpis.length} KPIs — deleting...`);
        for (let i = 0; i < existingKpis.length; i++) {
            await this.opsService.deleteKPI(String(existingKpis[i].id));
            if ((i + 1) % 10 === 0 || i === existingKpis.length - 1) {
                log(`  Deleted KPI ${i + 1}/${existingKpis.length}`);
            }
        }

        // ── 2. DELETE all KRAs ─────────────────────────────────────────────
        log('Fetching existing KRAs to delete...');
        const existingKras = await this.opsService.getKRAs('Division', { role: 'super_admin' } as any);
        log(`Found ${existingKras.length} KRAs — deleting...`);
        for (let i = 0; i < existingKras.length; i++) {
            await this.opsService.deleteKRA(String(existingKras[i].id));
            if ((i + 1) % 10 === 0 || i === existingKras.length - 1) {
                log(`  Deleted KRA ${i + 1}/${existingKras.length}`);
            }
        }

        // ── 3. DELETE all Objectives ───────────────────────────────────────
        log('Fetching existing Objectives to delete...');
        const existingObjs = await this.opsService.getObjectives('Division', { role: 'super_admin' } as any);
        log(`Found ${existingObjs.length} Objectives — deleting...`);
        for (let i = 0; i < existingObjs.length; i++) {
            await this.opsService.deleteObjective(String(existingObjs[i].id));
            if ((i + 1) % 10 === 0 || i === existingObjs.length - 1) {
                log(`  Deleted Objective ${i + 1}/${existingObjs.length}`);
            }
        }

        // ── 4. CREATE org-level Strategic Goals ───────────────────────────
        log('Creating 5 Strategic Goals (Org level)...');
        const goalIdMap: Record<string, string> = {};

        for (const goal of STRATEGIC_GOALS) {
            const created = await this.opsService.addObjective({
                title: goal.title,
                description: goal.outcome,
                goalType: 'Org',
                status: 'Not Started',
                progress: 0,
                year: '2025/26',
            });
            goalIdMap[goal.id] = String(created.id);
            log(`  Created: ${goal.title}`);
        }

        // ── 5. CREATE division-level bridge objectives (one per KRA) ───────
        // These are goalType='Division' with division+unit set so they appear
        // in the Strategy cascade hierarchy under the correct division/unit.
        // linkedDeliverable groups them under their strategic goal in the UI.
        log(`Creating ${KRAS.length} division-level bridge objectives...`);
        const bridgeIdMap: Record<string, string> = {};

        for (const kra of KRAS) {
            const parentGoalSpId = goalIdMap[kra.goalId];
            const goalRecord = STRATEGIC_GOALS.find(g => g.id === kra.goalId)!;

            const bridge = await this.opsService.addObjective({
                title: kra.title,
                description: goalRecord.outcome,
                goalType: 'Division',
                division: kra.division,
                unit: kra.unit,
                owner: kra.responsibleOfficer,
                status: 'Not Started',
                progress: 0,
                year: '2025/26',
                parentGoalId: parentGoalSpId,
                linkedDeliverable: goalRecord.title,
            });
            bridgeIdMap[kra.id] = String(bridge.id);
            log(`  Created bridge: [${kra.division} / ${kra.unit}] ${kra.title}`);
        }

        // ── 6. CREATE KRAs linked to their bridge objectives ───────────────
        log(`Creating ${KRAS.length} KRAs...`);
        const kraIdMap: Record<string, string> = {};

        for (const kra of KRAS) {
            const objectiveId = bridgeIdMap[kra.id];
            const created = await this.opsService.addKRA({
                title: kra.title,
                division: kra.division,
                unit: kra.unit,
                objective_id: objectiveId,
                status: 'pending' as any,
                progress: 0,
                owner: { id: '', name: kra.responsibleOfficer, email: '' },
                assignees: [],
                description: '',
            });
            kraIdMap[kra.id] = String(created.id);
            log(`  Created KRA: ${kra.title}`);
        }

        // ── 7. CREATE KPIs linked to their KRAs ───────────────────────────
        log(`Creating ${KPIS.length} KPIs...`);
        let kpiCount = 0;

        for (const kpi of KPIS) {
            const kraId = kraIdMap[kpi.kraId];
            if (!kraId) {
                log(`  WARN: KRA not found for KPI "${kpi.title}" (kraId=${kpi.kraId}) — skipping`);
                continue;
            }
            await this.opsService.addKPI({
                name: kpi.title,
                description: kpi.description
                    ? `${kpi.description}\n\nAnnual Target: ${kpi.annualTarget}`
                    : `Annual Target: ${kpi.annualTarget}`,
                target: kpi.target,
                actual: 0,
                metric: kpi.metric,
                status: 'on-track',
                kra_id: kraId,
                assignees: [{ id: '', name: kpi.assignedOfficer, email: '', displayName: kpi.assignedOfficer }],
                calculationType: 'manual',
            });
            kpiCount++;
            if (kpiCount % 10 === 0 || kpiCount === KPIS.length) {
                log(`  Created KPI ${kpiCount}/${KPIS.length}`);
            }
        }

        const summary = `Reset complete: ${STRATEGIC_GOALS.length} Strategic Goals, ${KRAS.length} bridge objectives, ${KRAS.length} KRAs, ${kpiCount} KPIs created successfully.`;
        log(summary);

        return {
            success: true,
            message: summary,
            stats: {
                goals: STRATEGIC_GOALS.length,
                bridgeObjectives: KRAS.length,
                kras: KRAS.length,
                kpis: kpiCount,
            },
        };
    }
}
