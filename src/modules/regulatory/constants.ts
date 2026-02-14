import { RegulatoryCase, KPIStats } from './types';

export const MOCK_CASES: RegulatoryCase[] = [
    {
        caseId: "SCPNG-RI-00045",
        type: "scam",
        category: "Investment Scam",
        risk: "HIGH",
        status: "UNDER_REVIEW",
        source: "external_form",
        anonymous: false,
        title: "Fake Crypto Investment Scheme",
        description: "Public report about a fake crypto trading group operating on Facebook claiming SCPNG endorsement.",
        assignedUnit: "Investigations",
        assignedOfficer: "Officer T. Manoa",
        createdAt: "2026-02-13T10:15:00Z",
        lastUpdate: "2026-02-13T12:00:00Z",
        reporterName: "John Doe",
        reporterContact: "john.doe@example.com"
    },
    {
        caseId: "SCPNG-RI-00046",
        type: "enquiry",
        category: "Licensing Query",
        risk: "LOW",
        status: "RECEIVED",
        assignedUnit: "Compliance",
        createdAt: "2026-02-13T11:00:00Z",
        title: "Inquiry regarding Digital Asset Exchange license requirements",
        description: "Company asking for clarification on new regulations.",
        reporterName: "Alice Smith (CryptoCorp)",
        reporterContact: "alice@cryptocorp.co"
    },
    {
        caseId: "SCPNG-WB-00012",
        type: "whistleblower",
        category: "Insider Trading",
        risk: "CRITICAL",
        status: "INVESTIGATING",
        anonymous: true,
        secureToken: "WB-TOKEN-X9P22",
        summary: "Alleged insider trading within licensed entity involving senior management.",
        assignedUnit: "Legal & Investigations",
        createdAt: "2026-02-10T09:00:00Z"
    },
    {
        caseId: "SCPNG-RI-00042",
        type: "compliance",
        category: "AML Breach",
        risk: "MEDIUM",
        status: "ESCALATED",
        assignedUnit: "Compliance",
        title: "Potential AML breach at licensed broker",
        createdAt: "2026-02-08T14:30:00Z",
        assignedOfficer: "Sarah K.",
        reporterName: "Jane Compliance",
        reporterContact: "jane@brokerage.com"
    },
    {
        caseId: "SCPNG-Inv-00101",
        type: "investigation",
        category: "Ponzi Scheme",
        risk: "HIGH",
        status: "RESOLVED",
        assignedUnit: "Investigations",
        title: "Resolved Ponzi Scheme Case #88",
        createdAt: "2026-01-20T08:00:00Z",
        lastUpdate: "2026-02-01T10:00:00Z",
        reporterName: "Victim Support Group",
        reporterContact: "support@vsg.org"
    }
];

export const MOCK_KPI_STATS: KPIStats = {
    totalReports: 142,
    openCases: 28,
    highRisk: 5,
    criticalAlerts: 1
};
