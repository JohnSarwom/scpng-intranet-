export type CaseType = 'scam' | 'enquiry' | 'whistleblower' | 'investigation' | 'compliance';
export type CaseRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CaseStatus = 'RECEIVED' | 'UNDER_REVIEW' | 'INVESTIGATING' | 'ESCALATED' | 'CLOSED' | 'RESOLVED';

export interface RegulatoryCase {
    caseId: string;
    type: CaseType;
    category: string;
    risk: CaseRisk;
    status: CaseStatus;
    source?: string;
    anonymous?: boolean;
    title?: string;
    description?: string;
    assignedUnit: string;
    assignedOfficer?: string;
    createdAt: string;
    lastUpdate?: string;
    secureToken?: string; // For whistleblower
    summary?: string;
    reporterName?: string;
    reporterContact?: string;
    attachments?: string;
}

export interface KPIStats {
    totalReports: number;
    openCases: number;
    highRisk: number;
    criticalAlerts: number;
}
