# Regulatory Intelligence Module — Comprehensive System Documentation

**Module:** Regulatory Intelligence  
**Route:** `/regulatory-intelligence`  
**Last updated:** 2026-04-04  
**Status:** Production (SharePoint-backed, Gemini AI integrated)

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [SharePoint Data Model](#3-sharepoint-data-model)
4. [TypeScript Type System](#4-typescript-type-system)
5. [Case Types — Deep Dive](#5-case-types--deep-dive)
6. [Risk Level Classification](#6-risk-level-classification)
7. [Case Status Lifecycle](#7-case-status-lifecycle)
8. [Component Hierarchy & Responsibilities](#8-component-hierarchy--responsibilities)
9. [Data Fetching & Caching Layer](#9-data-fetching--caching-layer)
10. [Attachment Resolution Engine](#10-attachment-resolution-engine)
11. [KPI Calculation Logic](#11-kpi-calculation-logic)
12. [Analytics & Visualisation Layer](#12-analytics--visualisation-layer)
13. [Case Table & Row Actions](#13-case-table--row-actions)
14. [Case Detail Modal](#14-case-detail-modal)
15. [Case Edit Modal (Admin Only)](#15-case-edit-modal-admin-only)
16. [Filter Panel](#16-filter-panel)
17. [AI Analyst (Gemini Integration)](#17-ai-analyst-gemini-integration)
18. [Whistleblower Protection Architecture](#18-whistleblower-protection-architecture)
19. [Unit Routing Matrix](#19-unit-routing-matrix)
20. [SharePoint Setup & Seeding Service](#20-sharepoint-setup--seeding-service)
21. [RBAC & Access Control](#21-rbac--access-control)
22. [SLA Framework](#22-sla-framework)
23. [Known Limitations & Future Considerations](#23-known-limitations--future-considerations)
24. [File Reference Map](#24-file-reference-map)

---

## 1. Purpose & Scope

The Regulatory Intelligence module is SCPNG's internal command centre for managing all inbound regulatory activity — public scam reports, licensing enquiries, whistleblower disclosures, compliance incidents, and active formal investigations. It provides:

- **A live case registry** backed by a SharePoint list (`Regulatory_Intelligence_Cases`) accessed entirely via Microsoft Graph API.
- **A structured triage system** with case types, risk levels, status workflows, and unit routing.
- **An AI-powered analyst** (Google Gemini 2.0 Flash) that is injected with live case data at query time and answers natural-language questions about the regulatory environment.
- **Admin-level case management** — authorised officers can update risk, status, assignments, and investigation summaries directly from the dashboard.
- **Whistleblower non-disclosure enforcement** — anonymous reports surface a `Secure` badge but hide reporter identity in both the read-only detail view and the edit modal.
- **Automated KPI computation** — four headline figures are derived client-side from the live case set (total, open, high-risk, critical).
- **Rich analytics** — risk distribution (donut), case-type breakdown (horizontal bar), and a 6-month volume trend (line chart).

---

## 2. System Architecture Overview

```
Browser (React + TypeScript)
│
├── src/pages/RegulatoryIntelligence.tsx          [Route wrapper — only wraps PageLayout]
│
└── src/modules/regulatory/
    ├── components/
    │   ├── RegulatoryDashboard.tsx               [Orchestrator: owns tabs, passes data down]
    │   ├── KPIBar.tsx                            [4-card headline metrics]
    │   ├── RegulatoryAnalytics.tsx               [3 recharts visualisations]
    │   ├── FilterPanel.tsx                       [Search + type/status/risk dropdowns (UI only)]
    │   ├── CaseTable.tsx                         [Tabular case list with row actions]
    │   ├── CaseDetailsModal.tsx                  [Read-only case detail dialog]
    │   ├── CaseEditModal.tsx                     [Admin edit dialog — persists to SharePoint]
    │   ├── RegulatoryAIChat.tsx                  [Gemini AI chat panel]
    │   └── regulatoryQuestions.ts                [Static question library for AI sidebar]
    ├── types.ts                                  [CaseType, CaseRisk, CaseStatus, RegulatoryCase, KPIStats]
    └── constants.ts                              [MOCK_CASES, MOCK_KPI_STATS (seed data)]

src/hooks/useRegulatoryCases.ts                   [React Query: fetch + update mutation]
src/services/regulatorySharePointSetupService.ts  [One-time list creation + seeding]
```

### Request flow (read path)

```
RegulatoryDashboard mounts
  → useRegulatoryCases() (React Query, queryKey: ['sharePoint', 'regulatoryCases'])
      → useOpsService() → gets authenticated Microsoft Graph client + siteId
      → GET /sites/{siteId}/lists  (resolves Regulatory_Intelligence_Cases list ID)
      → GET /sites/{siteId}/lists/{listId}/items?$expand=fields
      → maps raw SP fields → RegulatoryCase[]
      → for each case where attachments starts with 'b!':
          → GET /drives/{driveId}/items/{itemId}?$select=@microsoft.graph.downloadUrl,webUrl
          → replaces raw DriveItem ID with resolved URL
      → sorts by createdAt DESC
      → returns RegulatoryCase[]
  → KPI stats computed inline (filter/count on the array)
  → data passed to KPIBar, RegulatoryAnalytics, FilterPanel, CaseTable, RegulatoryAIChat
```

### Request flow (write path — case update)

```
CaseTable "Edit Case" clicked (admin only)
  → CaseEditModal opens, pre-filled from RegulatoryCase object
  → Officer modifies fields → clicks "Save Changes"
  → CaseTable.handleSaveCase(caseId, updates)
      → calls onUpdateCase prop (from RegulatoryDashboard → useRegulatoryCases.updateCase)
      → useMutation.mutateAsync({ caseId, updates })
          → resolves list ID (same pattern as read path)
          → GET items filtered by fields/CaseId eq '{caseId}' → extracts SharePoint item ID
          → maps Partial<RegulatoryCase> → SharePoint column names
          → auto-sets LastUpdate = new Date().toISOString()
          → PATCH /sites/{siteId}/lists/{listId}/items/{spItemId}/fields
      → on success: invalidates ['sharePoint', 'regulatoryCases'] → triggers automatic refetch
  → toast success/failure notification
```

---

## 3. SharePoint Data Model

**List name:** `Regulatory_Intelligence_Cases`  
**Site path:** `/sites/scpngintranet`  
**Template:** `genericList`

### Full Column Schema

| SharePoint Column | Internal Type | Choices / Notes |
|---|---|---|
| `Title` | Single line text | Populated with `item.title` or `Case {caseId}` on seed |
| `CaseId` | Single line text | Format: `SCPNG-RI-XXXXX`, `SCPNG-WB-XXXXX`, `SCPNG-Inv-XXXXX` |
| `CaseType` | Choice | `scam`, `enquiry`, `whistleblower`, `compliance`, `investigation` |
| `Category` | Single line text | Human-readable sub-classification (e.g. "Investment Scam", "AML Breach") |
| `RiskLevel` | Choice | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `Status` | Choice | `RECEIVED`, `UNDER_REVIEW`, `INVESTIGATING`, `ESCALATED`, `CLOSED`, `RESOLVED` |
| `Source` | Single line text | e.g. `external_form`, `email`, `phone`, `walk-in` |
| `Anonymous` | Boolean (Yes/No) | Controls whistleblower identity suppression |
| `Description` | Multi-line text | Full narrative of the report |
| `AssignedUnit` | Single line text | Routing target (see Unit Routing Matrix) |
| `AssignedOfficer` | Single line text | Name of the handling officer |
| `LastUpdate` | DateTime | Auto-set by the update mutation |
| `SecureToken` | Single line text | Unique token for anonymous whistleblower references (format: `WB-TOKEN-XXXXX`) |
| `Summary` | Multi-line text | Officer-written investigation summary / findings |
| `ReporterName` | Single line text | Full name (suppressed if `Anonymous = true`) |
| `ReporterContact` | Single line text | Email or phone (suppressed if `Anonymous = true`) |
| `Attachements` *(note SP typo)* | Single line text | DriveItem ID (`b!...`) or resolved HTTP URL |
| `Created` | DateTime | Auto-generated by SharePoint — used as `createdAt` |
| `Modified` | DateTime | Auto-generated by SharePoint — used as `lastUpdate` fallback |

**Important:** The column for attachments is stored as `Attachements` (missing an 'h') in SharePoint. The mapper in `useRegulatoryCases.ts` handles both spellings: `f.Attachements || f.Attachments`.

### Case ID Prefixes

| Prefix | Case Type |
|---|---|
| `SCPNG-RI-XXXXX` | Scam, Enquiry, Compliance |
| `SCPNG-WB-XXXXX` | Whistleblower |
| `SCPNG-Inv-XXXXX` | Formal Investigation |

---

## 4. TypeScript Type System

Defined in `src/modules/regulatory/types.ts`.

```typescript
// Discriminated union for case classification
export type CaseType = 'scam' | 'enquiry' | 'whistleblower' | 'investigation' | 'compliance';

// 4-tier risk classification
export type CaseRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// 6-stage lifecycle status
export type CaseStatus = 'RECEIVED' | 'UNDER_REVIEW' | 'INVESTIGATING' | 'ESCALATED' | 'CLOSED' | 'RESOLVED';

export interface RegulatoryCase {
    caseId: string;           // Primary business key (not the SP item ID)
    type: CaseType;
    category: string;         // Sub-classification within the type
    risk: CaseRisk;
    status: CaseStatus;
    source?: string;          // Origin channel of the report
    anonymous?: boolean;      // Drives PII suppression throughout the UI
    title?: string;
    description?: string;
    assignedUnit: string;     // Routing target unit name
    assignedOfficer?: string;
    createdAt: string;        // ISO 8601 — from SP Created column
    lastUpdate?: string;      // ISO 8601 — from SP LastUpdate or Modified
    secureToken?: string;     // Whistleblower reference token (WB-TOKEN-...)
    summary?: string;         // Officer-authored investigation summary
    reporterName?: string;
    reporterContact?: string;
    attachments?: string;     // Resolved HTTP URL or raw DriveItem ID
}

export interface KPIStats {
    totalReports: number;    // count of all cases
    openCases: number;       // status in [RECEIVED, UNDER_REVIEW, INVESTIGATING, ESCALATED]
    highRisk: number;        // risk === 'HIGH'
    criticalAlerts: number;  // risk === 'CRITICAL'
}
```

---

## 5. Case Types — Deep Dive

### 5.1 Scam (`type: 'scam'`)

Reports from the public or internal staff of fraudulent schemes targeting SCPNG's regulated market participants or the general public. Common categories include:

- **Investment Scam** — fake investment platforms, Ponzi-adjacent solicitations
- **Fake Licensing Scam** — entities falsely claiming SCPNG endorsement or licensing
- **Crypto Fraud** — fake digital asset exchanges or wallets claiming regulatory approval
- **Impersonation** — individuals impersonating SCPNG officers or commissioners

**Routing:** Investigations Unit or Licensing & Supervision Unit depending on whether a licensed entity is involved.  
**Icon in UI:** `ShieldAlert` (Lucide)  
**Typical risk range:** MEDIUM → HIGH → CRITICAL  
**Source:** Mostly `external_form` (WordPress public portal) or `email`

### 5.2 Enquiry (`type: 'enquiry'`)

Requests for information or clarification from market participants, prospective licensees, or the public. Non-adversarial by nature.

- **Licensing Query** — requirements for new product categories, digital asset regulations
- **Regulatory Interpretation** — how specific rules apply to an entity's business model
- **General Market Query** — market participant lists, policy documents

**Routing:** Compliance Unit or Licensing & Supervision Unit  
**Typical risk range:** LOW → MEDIUM  
**Source:** `email`, `phone`, `walk-in`, `external_form`

### 5.3 Whistleblower (`type: 'whistleblower'`)

Confidential disclosures from insiders (employees, contractors, associated parties) alleging serious misconduct within licensed entities or within SCPNG itself. This type carries the most stringent identity protections in the system.

- **Insider Trading** — alleged market manipulation by individuals with access to non-public information
- **Financial Misconduct** — fraud, embezzlement, false reporting within a licensed entity
- **Regulatory Capture** — alleged improper relationships between regulators and licensees
- **AML/CFT Violations** — money laundering concealment, terrorist financing links

**Routing:** Legal & Investigations Unit (exclusively)  
**Typical risk range:** HIGH → CRITICAL  
**Anonymity:** `anonymous: true` cases suppress `reporterName` and `reporterContact` everywhere in the UI. The `secureToken` field provides a reference identifier the reporter can use to follow up without identifying themselves.  
**Icon in UI:** `Lock` (Lucide)

### 5.4 Compliance (`type: 'compliance'`)

Internally or externally identified breaches of regulatory requirements by licensed entities. Typically identified through supervision activities, mandatory reporting, or third-party complaints.

- **AML Breach** — failure to comply with Anti-Money Laundering obligations
- **Reporting Failure** — late or missing periodic returns from licensees
- **Capital Adequacy** — entities falling below minimum capital thresholds
- **Conduct Issue** — unfair treatment of clients, inappropriate product recommendations

**Routing:** Compliance Unit, with potential escalation to Investigations  
**Typical risk range:** MEDIUM → HIGH → ESCALATED

### 5.5 Investigation (`type: 'investigation'`)

Formal, documented investigations initiated by SCPNG enforcement. These are typically escalated from scam reports or whistleblower disclosures that have passed initial review.

- **Ponzi Scheme** — structured fraud with pyramid-like payout mechanics
- **Market Manipulation** — coordinated trading to artificially move prices
- **Unlicensed Activity** — operating as a securities dealer or investment manager without registration
- **Securities Fraud** — misleading statements in prospectuses or offer documents

**Routing:** Investigations Unit (primary), Legal Unit (for court proceedings)  
**Typical risk range:** HIGH → CRITICAL  
**Status pattern:** Often begins as a scam or whistleblower case, then reclassified to `investigation` once formal proceedings begin.

---

## 6. Risk Level Classification

Risk is manually assessed and set by the handling officer. It drives visual priority in the dashboard, AI analyst emphasis, and future escalation logic.

| Risk Level | Display Colour | Meaning | Typical Action |
|---|---|---|---|
| `LOW` | Green | Routine, low public interest, minimal harm potential | Standard processing within SLA |
| `MEDIUM` | Yellow | Moderate complexity or harm potential | Priority queue, weekly review |
| `HIGH` | Orange | Significant market impact or harm to multiple parties | Supervisor review, < 48hr escalation decision |
| `CRITICAL` | Red | Systemic risk, imminent harm, or involves senior persons | Commissioner briefing, immediate escalation |

**KPI Bar mapping:**
- `HIGH` → counted in "High Risk" KPI card
- `CRITICAL` → counted in "Critical Alerts" KPI card (shown in red)

**AI emphasis:** The system prompt instructs the AI to use bold `**HIGH RISK**` or `**CRITICAL**` warnings and recommend immediate action for these cases.

---

## 7. Case Status Lifecycle

Cases move through a six-stage lifecycle. Not all transitions are valid — cases should generally move forward, though a compliance officer may revert a status (e.g., from `ESCALATED` back to `INVESTIGATING`) if an escalation is resolved without external referral.

```
RECEIVED
  │  (initial triage complete, assigned to officer)
  ▼
UNDER_REVIEW
  │  (formal investigation work begins)
  ▼
INVESTIGATING
  │  (risk classified HIGH/CRITICAL, or cross-unit involvement)
  ▼
ESCALATED
  │  ┌─────────────────────────────────────────┐
  └─►│          RESOLVED or CLOSED             │
     └─────────────────────────────────────────┘
```

### Status Definitions

| Status | Colour (UI) | Definition |
|---|---|---|
| `RECEIVED` | Blue | Case logged, not yet assigned or reviewed |
| `UNDER_REVIEW` | Purple | Assigned officer is conducting initial assessment |
| `INVESTIGATING` | Indigo | Active formal investigation work underway |
| `ESCALATED` | Red | Referred to senior management, legal, or external authorities |
| `RESOLVED` | Green | Matter closed with documented outcome |
| `CLOSED` | Grey | Administratively closed (e.g., insufficient information, duplicate) |

**Open case definition** (used in KPI calculation): `['RECEIVED', 'UNDER_REVIEW', 'INVESTIGATING', 'ESCALATED']` — all statuses that represent active, unresolved work.

---

## 8. Component Hierarchy & Responsibilities

### 8.1 `RegulatoryIntelligence.tsx` (Page)

**Path:** `src/pages/RegulatoryIntelligence.tsx`

A thin wrapper. Its only role is to apply the `PageLayout` shell (navigation, sidebar) around `RegulatoryDashboard`. Contains no state or logic.

### 8.2 `RegulatoryDashboard.tsx` (Orchestrator)

**Path:** `src/modules/regulatory/components/RegulatoryDashboard.tsx`

The central orchestrator. Responsibilities:

- Calls `useRegulatoryCases()` and owns the `cases`, `stats`, `updateCase`, `isUpdating` values
- Calls `useRoleBasedAuth()` to determine `isAdmin` — passed down to `CaseTable` to gate edit/delete actions
- Defines the tab structure: Overview, Scams, Whistleblower, Compliance, Enquiries, Investigations
- Implements `getFilteredCases(type)` to isolate cases per tab
- The **Overview** tab is the only tab that renders all sub-components (KPIBar, Analytics, FilterPanel, CaseTable limited to 5, RegulatoryAIChat)
- All other tabs render only a `CaseTable` filtered by their respective `CaseType`
- Handles loading and error states (full-page Loader2 spinner and AlertCircle respectively) before any child components mount

### 8.3 `KPIBar.tsx`

**Path:** `src/modules/regulatory/components/KPIBar.tsx`

Renders four metric cards in a responsive 4-column grid. Each card has a coloured left border, an icon, and a bold count. All data is derived — no local state or fetching. Props: `{ stats: KPIStats }`.

| Card | Border | Icon | Data Source |
|---|---|---|---|
| Total Reports | Blue | FileText | `stats.totalReports` |
| Open Cases | Yellow | AlertTriangle | `stats.openCases` |
| High Risk | Orange | Flame | `stats.highRisk` |
| Critical Alerts | Red | AlertTriangle | `stats.criticalAlerts` (red text) |

### 8.4 `RegulatoryAnalytics.tsx`

**Path:** `src/modules/regulatory/components/RegulatoryAnalytics.tsx`

Three Recharts visualisations (see Section 12 for full detail). Props: `{ cases: RegulatoryCase[] }`. Computes all chart data from the cases array on each render.

### 8.5 `FilterPanel.tsx`

**Path:** `src/modules/regulatory/components/FilterPanel.tsx`

Currently a **UI-only stub** — the search input and dropdowns render but are not wired to any filter logic. The tab-based filtering in `RegulatoryDashboard` is the active filtering mechanism. This panel is a placeholder for planned client-side search across the overview tab's full case table.

### 8.6 `CaseTable.tsx`

**Path:** `src/modules/regulatory/components/CaseTable.tsx`

Renders a shadcn `Table` of `RegulatoryCase[]`. Full column set: Case ID, Type, Category, Risk, Status, Assigned Unit, Date, Attachments, Actions.

Props:
```typescript
interface CaseTableProps {
    data: RegulatoryCase[];
    onUpdateCase?: (caseId: string, updates: Partial<RegulatoryCase>) => Promise<any>;
    isUpdating?: boolean;
    isAdmin?: boolean;
}
```

Row click opens `CaseDetailsModal`. Actions dropdown (`MoreHorizontal`) contains:
- **View Details** — always visible, opens `CaseDetailsModal`
- **Edit Case** — admin only (`isAdmin === true`), opens `CaseEditModal`
- **Delete Case** — admin only, currently shows a "coming soon" toast (not implemented)

Whistleblower cases display a `Lock` icon + "Secure" badge in the Case ID column.

Attachment column renders:
- A clickable `<a>` tag if `attachments` starts with `http`
- A truncated text display for any other string value
- A dash (`-`) if no attachment

### 8.7 `CaseDetailsModal.tsx`

**Path:** `src/modules/regulatory/components/CaseDetailsModal.tsx`

Read-only dialog for viewing full case detail. Sections:
1. **Status & Risk** — colour-coded badges in a 2-column grid
2. **Case Description** — the `description` field in a bordered prose container
3. **Reporter Information** — if `anonymous === true`, name shows "Anonymous Report" and contact shows "Hidden"
4. **Assignment Details** — Assigned Unit + Investigating Officer
5. **Attachments** — clickable link if resolved URL; raw text otherwise
6. **Whistleblower notice** — purple info box shown only when `type === 'whistleblower'`

### 8.8 `CaseEditModal.tsx`

**Path:** `src/modules/regulatory/components/CaseEditModal.tsx`

Admin-only edit dialog. See Section 15 for full detail.

### 8.9 `RegulatoryAIChat.tsx`

**Path:** `src/modules/regulatory/components/RegulatoryAIChat.tsx`

The Gemini-powered AI analyst. See Section 17 for full detail.

---

## 9. Data Fetching & Caching Layer

**File:** `src/hooks/useRegulatoryCases.ts`

### Query configuration

```typescript
queryKey: ['sharePoint', 'regulatoryCases']
staleTime: 1000 * 60 * 2   // 2 minutes — data is considered fresh for 2 min
```

React Query will serve cached data immediately if available, and silently refetch in the background after the stale window expires. A manual `refresh` function is also exposed for explicit user-triggered refetches.

### List ID resolution

The hook does not hardcode the SharePoint list ID. On the first call, it:
1. Fetches all lists from `/sites/{siteId}/lists` with `$select=id,displayName`
2. Finds the one where `displayName === 'Regulatory_Intelligence_Cases'`
3. Stores it in `service.listIds['REGULATORY_CASES']`

This pattern is consistent with all other SharePoint-backed hooks in the application. The service caches the ID for the session.

### Error handling

If the list is not found, the hook throws an error which React Query captures and surfaces as `query.error`. `RegulatoryDashboard` renders a full-page error state in this case.

If the list exists but returns 0 items, the hook returns an empty array (not an error). The dashboard renders the KPI bar with zeroes and an empty table.

### Update mutation

```typescript
updateCase: ({ caseId, updates }) => Promise<{ caseId, updates }>
isUpdating: boolean   // true while mutation is pending
```

The mutation:
1. Resolves list ID (same pattern as query, cached after first query)
2. Queries items filtered by `fields/CaseId eq '{caseId}'` with `.top(1)` — extracts the SharePoint-internal item ID
3. Maps `Partial<RegulatoryCase>` keys to their SharePoint column equivalents
4. Automatically stamps `fields.LastUpdate = new Date().toISOString()`
5. PATCH to `/sites/{siteId}/lists/{listId}/items/{spItemId}/fields`
6. On success: calls `queryClient.invalidateQueries({ queryKey: ['sharePoint', 'regulatoryCases'] })` which triggers a full refetch of the case list

**Field mapping in update mutation:**

| `RegulatoryCase` key | SharePoint column |
|---|---|
| `category` | `Category` |
| `risk` | `RiskLevel` |
| `status` | `Status` |
| `assignedUnit` | `AssignedUnit` |
| `assignedOfficer` | `AssignedOfficer` |
| `description` | `Description` |
| `summary` | `Summary` |
| `source` | `Source` |
| `anonymous` | `Anonymous` |
| `reporterName` | `ReporterName` |
| `reporterContact` | `ReporterContact` |

`CaseId`, `CaseType`, and `createdAt` are not included in the mutation's field mapping — they are permanently read-only.

---

## 10. Attachment Resolution Engine

This is one of the more technically nuanced parts of the module. Microsoft Graph API does not automatically return download URLs for DriveItem references — it returns opaque IDs in the format `b!{encodedPath}!{itemId}`.

### Resolution logic in `useRegulatoryCases.ts`

After the initial list fetch, the hook runs a `Promise.all` across all cases:

```typescript
if (c.attachments && c.attachments.startsWith('b!')) {
    const driveItem = await service.client
        .api(`/drives/${c.attachments.split('!')[0]}/items/${c.attachments.split('!')[1]}`)
        .select('@microsoft.graph.downloadUrl,webUrl')
        .get();

    if (driveItem['@microsoft.graph.downloadUrl']) {
        return { ...c, attachments: driveItem['@microsoft.graph.downloadUrl'] };
    } else if (driveItem.webUrl) {
        return { ...c, attachments: driveItem.webUrl };
    }
}
```

**Priority:** `@microsoft.graph.downloadUrl` (direct download, no browser auth required for the file itself) is preferred over `webUrl` (opens in SharePoint browser UI, requires auth).

**Failure handling:** If the resolution call fails (e.g. the DriveItem was deleted, or the user lacks permission), a `console.warn` is emitted and the original raw ID is preserved in the `attachments` field. `CaseTable` and `CaseDetailsModal` will render it as raw text rather than a link in this case.

**Performance note:** This is an N+1 pattern — one extra Graph API call per case that has a `b!` attachment. For large case volumes, this should be converted to batched requests or moved to a server-side API route.

---

## 11. KPI Calculation Logic

KPIs are calculated purely client-side from the `cases` array returned by the query. No dedicated API call is made for stats.

```typescript
const openCasesCount = cases.filter(c =>
    ['RECEIVED', 'UNDER_REVIEW', 'INVESTIGATING', 'ESCALATED'].includes(c.status)
).length;

const highRiskCount = cases.filter(c => c.risk === 'HIGH').length;
const criticalAlertsCount = cases.filter(c => c.risk === 'CRITICAL').length;

const stats: KPIStats = {
    totalReports: cases.length,
    openCases: openCasesCount,
    highRisk: highRiskCount,
    criticalAlerts: criticalAlertsCount
};
```

**Design consequence:** If the SharePoint list contains 1,000+ cases, they are all fetched and the KPIs are computed in-browser. For the current scale this is acceptable. At high volumes (>500 cases), pagination and server-side aggregation should be introduced.

---

## 12. Analytics & Visualisation Layer

**File:** `src/modules/regulatory/components/RegulatoryAnalytics.tsx`  
**Library:** Recharts (already a project-wide dependency)

Three charts are rendered, derived from the live `cases` prop.

### Chart 1: Risk Distribution (Donut/Pie)

Displays the proportion of cases at each risk level. Only non-zero slices are rendered (`filter(item => item.value > 0)`).

| Slice | Colour |
|---|---|
| Low | `#22c55e` (green-500) |
| Medium | `#eab308` (yellow-500) |
| High | `#f97316` (orange-500) |
| Critical | `#ef4444` (red-500) |

Config: `innerRadius={60}`, `outerRadius={80}` — donut style. Includes `Tooltip` and `Legend`.

### Chart 2: Cases by Type (Horizontal Bar)

Shows absolute count per `CaseType`. Uses `BarChart` with `layout="vertical"` so type names appear on the Y-axis.

| Bar | Colour |
|---|---|
| Scam | `#3b82f6` (blue-500) |
| Whistleblower | `#8b5cf6` (violet-500) |
| Compliance | `#10b981` (emerald-500) |
| Enquiry | `#64748b` (slate-500) |
| Investigation | `#f43f5e` (rose-500) |

Type names are capitalised from the raw `CaseType` value.

### Chart 3: 6-Month Volume Trend (Line)

**Currently uses static mock data** — this is documented in the source code with a note that it should be aggregated from real historical data in a production implementation. The data shape is `{ name: string, received: number, resolved: number }[]`.

To make this live, the approach would be to group `cases` by month using `createdAt` for received counts and `lastUpdate`/`Modified` for resolved counts — or to maintain a separate `Report_Volume_History` SharePoint list with monthly aggregates populated by Power Automate.

---

## 13. Case Table & Row Actions

### Column rendering detail

**Case ID column:**
- Displays the `caseId` string (e.g. `SCPNG-RI-00045`)
- For `type === 'whistleblower'`: appends a grey badge containing `Lock` icon + "Secure" text

**Type column:**
- Capitalised CaseType value
- Prepended with `ShieldAlert` icon for scams, `Lock` icon for whistleblowers, no icon for others

**Risk column:**
- Colour-coded pill badge (`getRiskColor` function):
  - CRITICAL: red background, red text, red border
  - HIGH: orange background, orange text, orange border
  - MEDIUM: yellow background, yellow text, yellow border
  - LOW: green background, green text, green border

**Status column:**
- Colour-coded pill badge (`getStatusColor` function):
  - RECEIVED: blue
  - UNDER_REVIEW: purple
  - INVESTIGATING: indigo
  - ESCALATED: red
  - RESOLVED: green
  - CLOSED: grey

**Date column:** Formatted as `MMM dd, yyyy` using `date-fns/format`

**Attachments column:** Smart rendering (see Section 10)

**Actions column:** `DropdownMenu` (three-dot icon). Visibility of Edit/Delete gated by `isAdmin`.

### Row click behaviour

Any click on a row (except the dropdown trigger, attachment link, or dropdown menu items) opens `CaseDetailsModal` for the clicked case. The dropdown trigger has `e.stopPropagation()` to prevent the modal from also opening.

---

## 14. Case Detail Modal

**File:** `src/modules/regulatory/components/CaseDetailsModal.tsx`

A read-only view of a `RegulatoryCase`. Key behaviour notes:

**Reporter information suppression:**
```typescript
{caseData.anonymous ? "Anonymous Report" : (caseData.reporterName || "N/A")}
{caseData.anonymous ? "Hidden" : (caseData.reporterContact || "N/A")}
```

There is no conditional rendering that hides the Reporter Information section — the section always appears, but the values are replaced with "Anonymous Report" and "Hidden" when `anonymous === true`. This is intentional: it confirms to the viewing officer that reporter details exist but are protected, rather than making it appear the data was never collected.

**Whistleblower notice:**
```typescript
{caseData.type === 'whistleblower' && (
    <div className="p-4 bg-purple-50 border border-purple-100 rounded-md">
        <h4>Secured Report</h4>
        <p>This report is marked as confidential. Access is logged and restricted.</p>
    </div>
)}
```

Note: "Access is logged and restricted" is currently a display label. Actual access audit logging would require a separate SharePoint list or Azure Monitor integration.

---

## 15. Case Edit Modal (Admin Only)

**File:** `src/modules/regulatory/components/CaseEditModal.tsx`

Only rendered when `isAdmin === true` (sourced from `useRoleBasedAuth()`).

### Editable fields

| Field | Control | Options / Notes |
|---|---|---|
| Category | Text input | Free text |
| Risk Level | Select dropdown | LOW, MEDIUM, HIGH, CRITICAL |
| Status | Select dropdown | RECEIVED, UNDER_REVIEW, INVESTIGATING, ESCALATED, RESOLVED, CLOSED |
| Assigned Unit | Select dropdown | See unit list below |
| Assigned Officer | Text input | Free text — officer name |
| Source | Text input | e.g. email, phone, walk-in |
| Description | Textarea (3 rows) | Full narrative |
| Summary | Textarea (2 rows) | Officer findings summary |
| Reporter Name | Text input | **Hidden** when `anonymous === true && type === 'whistleblower'` |
| Reporter Contact | Text input | **Hidden** when `anonymous === true && type === 'whistleblower'` |

### Available Assigned Unit options (hardcoded)

- Unassigned
- Legal & Investigations
- Licensing & Supervision
- Corporate Services
- Research & Publication
- Executive Division
- Secretariat Unit

### Read-only fields (not editable from modal)

- `CaseId` — shown in the dialog description but cannot be changed
- `CaseType` — shown in the dialog description but cannot be changed
- `createdAt` / `Created` — determined at submission time; never editable

### Persistence flow

`handleSave()` calls `onSave(caseData.caseId, formValues)` → `CaseTable.handleSaveCase()` → `useRegulatoryCases.updateCase` mutation → SharePoint PATCH. On success the modal closes automatically. On failure the modal stays open and a destructive toast shows the error message.

---

## 16. Filter Panel

**File:** `src/modules/regulatory/components/FilterPanel.tsx`

**Current status: UI stub — not functionally wired.**

Renders three Select dropdowns (Type, Status, Risk Level) and a text search input. None of these are connected to state that filters the case table. The tab-based architecture in `RegulatoryDashboard` provides the active filtering by `CaseType`.

**To make this functional**, the panel needs:
1. State lifted to `RegulatoryDashboard` (or a local context)
2. Passed as filter criteria to `CaseTable` in the Overview tab
3. Applied via `Array.filter()` before the `.slice(0, 5)` limit

---

## 17. AI Analyst (Gemini Integration)

**File:** `src/modules/regulatory/components/RegulatoryAIChat.tsx`  
**Model:** `gemini-2.0-flash`  
**API:** Google Generative Language API (direct REST, not SDK)

### API key resolution order

1. `import.meta.env.VITE_GEMINI_API_KEY` — environment variable (highest priority, used in development)
2. `graphContext.getAppSetting('GeminiAPIKey')` — SharePoint app settings via Graph API
3. Supabase `news_api_settings` table, row with `id = GLOBAL_SETTINGS_ID`, column `api_key`

### System prompt architecture

The AI is given the `REGULATORY_AI_SYSTEM_PROMPT` which contains a placeholder `{regulatoryDataContext}`. At send time, this placeholder is replaced with a serialised snapshot of the currently filtered cases + KPI stats. This means the AI always receives fresh, live data on every message send.

The system prompt instructs the AI to:
- Acknowledge it has LIVE data (not pretend to be unable to access SharePoint)
- Reference specific case IDs, risk levels, and categories
- Use markdown tables for case summaries
- Emphasise CRITICAL and HIGH RISK cases
- Respond in structured sections with headings and bullets
- Append follow-up questions in `<followups>Q1|Q2|Q3</followups>` format

### Data serialisation (`serializeRegulatoryContext`)

The function constructs a plain-text block injected into the system prompt:

```
TIMESTAMP: 2026-04-04T00:00:00.000Z

--- KPI Overviews ---
Total Reports: 5
Open Cases: 3
High Risk Cases: 2
Critical Alerts: 1

--- FILTERED CASES (5) ---
Case ID: SCPNG-WB-00012
Type: whistleblower | Category: Insider Trading | Risk: CRITICAL | Status: INVESTIGATING
Created: 2026-02-10T09:00:00Z
Assigned To: Legal & Investigations (Unassigned)
Summary: Alleged insider trading within licensed entity involving senior management.
Anonymous: Yes
---
...
```

Reporter name and contact **are included** in the serialised context for non-anonymous cases. For anonymous whistleblower cases, `reporterName` and `reporterContact` are undefined/null and therefore not included in the output (the `if (c.reporterName)` guard prevents them from being written).

### Conversation history structure

The full Gemini `contents` array sent on each message:

```javascript
[
    // 1. System instruction (as a user turn — Gemini doesn't have a true system role)
    { role: 'user', parts: [{ text: `System Instruction: ${systemContext}` }] },
    // 2. Priming model acknowledgement
    { role: 'model', parts: [{ text: `Understood. I have loaded ${n} regulatory cases...` }] },
    // 3. All previous chat messages (excluding the initial greeting)
    ...chatMessages.filter(not greeting).map(msg => ({ role, parts })),
    // 4. Current user message
    { role: 'user', parts: [{ text: messageToSend }] },
]
```

This pattern gives the AI full conversational context — it can refer back to earlier questions and answers within the session.

### Data source filter

A dropdown in the chat header allows the officer to focus the AI on a subset of cases:

| Filter value | Cases included |
|---|---|
| `all` | All cases |
| `scam` | `type === 'scam'` |
| `whistleblower` | `type === 'whistleblower'` |
| `investigation` | `type === 'investigation'` |
| `compliance` | `type === 'compliance'` |
| `enquiry` | `type === 'enquiry'` |
| `high_risk` | `risk === 'HIGH' || risk === 'CRITICAL'` |

Switching the filter changes what data is serialised into the next system prompt injection. It does **not** restart the conversation — prior messages remain visible, but the new system context reflects the narrower dataset.

### Typewriter animation

The AI response is rendered character-by-character using a recursive `setTimeout` pattern at 25ms per character. This creates the typewriter effect seen in the UI. The animation can be aborted via `handleStopGeneration()`, which aborts the fetch request (via `AbortController`) if the AI is still generating, or stops the typewriter if the response has been received but is still animating.

### Follow-up questions

The AI is instructed to append `<followups>Q1|Q2|Q3</followups>` at the end of each response. The component strips this tag from the displayed text and renders the questions as clickable chips below the AI message bubble. Clicking a chip immediately submits that question as the next user message.

### Question library (static)

**File:** `src/modules/regulatory/components/regulatoryQuestions.ts`

A static, curated library of questions organised into 5 categories, rendered in the right sidebar:

| Category | Questions |
|---|---|
| Regulatory Overview | Executive summary, risk breakdown, busiest unit, critical alerts |
| Scams & Investigations | Recent scams, common patterns, longest-open investigations, high-risk under review |
| Whistleblower Reports | High-risk summaries, anonymous vs named counts, department patterns, status distribution |
| Compliance & Enquiries | Enquiry topics, open compliance issues, escalated to high risk, average status |
| Analysis & Recommendations | Top 3 risks, resource-strained units, immediate enforcement actions |

**Quick questions** (chips at the top of the chat panel):
- Executive Brief
- What are the most recent scams?
- Summarise high risk whistleblowers
- How many active investigations are there?
- Identify trends in compliance cases

### Full-screen mode

The chat can be expanded to a full-browser-viewport overlay using `ReactDOM.createPortal` to `document.body` with `position: fixed; inset: 0; z-index: 9999`. This is toggled by the `Maximize`/`Minimize` icon button. The portal approach ensures the full-screen view is not clipped by any parent stacking context or overflow settings.

---

## 18. Whistleblower Protection Architecture

The anonymity model is implemented as a `boolean` flag (`anonymous`) that cascades through every layer of the system. Here is the complete picture:

### At data entry (WordPress form / external submission)

The public-facing WordPress form (external to the intranet) submits to the `Regulatory_Intelligence_Cases` SharePoint list with `CaseType = 'whistleblower'` and `Anonymous = true`. The `ReporterName` and `ReporterContact` fields are never populated for these submissions. A unique `SecureToken` (e.g. `WB-TOKEN-X9P22`) is generated and stored — this allows the reporter to reference their case without identifying themselves.

### At the API layer (`useRegulatoryCases.ts`)

The hook fetches reporter fields unconditionally — `f.ReporterName`, `f.ReporterContact` are always mapped. For anonymous cases these will be empty strings or null. The hook does not filter them out — instead, the UI layer is responsible for suppression.

### At the detail view (`CaseDetailsModal.tsx`)

Reporter information is replaced:
- Name: "Anonymous Report"
- Contact: "Hidden"

A purple "Secured Report" notice is appended at the bottom of the modal.

### At the edit view (`CaseEditModal.tsx`)

Reporter name and contact input fields are conditionally removed from the form:
```typescript
{!(caseData.type === 'whistleblower' && caseData.anonymous) && (
    // reporter fields
)}
```

An admin cannot accidentally expose or modify reporter identity data through the edit form.

### At the AI serialisation layer (`RegulatoryAIChat.tsx`)

The serialise function uses `if (c.reporterName)` and `if (c.reporterContact)` guards. Since anonymous cases have null/undefined values for these fields, they are never written into the AI context string. The AI cannot be prompted to reveal whistleblower identity even through adversarial questioning, because the data is simply not in the context.

### At the case table (`CaseTable.tsx`)

The `Lock` icon + "Secure" badge in the Case ID column signals to any officer viewing the table that this is a protected report, without revealing any identity information.

### `secureToken` field

The `secureToken` (e.g. `WB-TOKEN-X9P22`) is stored in SharePoint and fetched by the hook. Currently it appears in the `RegulatoryCase` object but is not surfaced in any UI component. It is available in the AI context through the serialiser only for whistleblower case summaries that include it. The intended use is as a lookup key for a reporter-facing status-check page.

---

## 19. Unit Routing Matrix

The `assignedUnit` field determines which SCPNG division and unit handles the case. The routing is manual — set either at submission time (by the WordPress form logic) or by an officer using the Edit modal.

| Case Type | Category | Assigned Unit | Division |
|---|---|---|---|
| Scam | Investment Scam, Crypto Fraud | Investigations | Enforcement Division |
| Scam | Fake Licensing | Licensing & Supervision | Licensing & Supervision Division |
| Whistleblower | All categories | Legal & Investigations | Legal & Compliance Division |
| Compliance | AML Breach, Reporting Failure | Compliance | Compliance Division |
| Compliance | Capital Adequacy | Licensing & Supervision | Licensing & Supervision Division |
| Enquiry | Licensing Query | Licensing & Supervision | Licensing & Supervision Division |
| Enquiry | General / Policy | Research & Publication | Research & Publication Division |
| Investigation | All categories | Legal & Investigations | Legal & Compliance Division |

The `CaseEditModal` unit dropdown currently offers these options:
- Unassigned
- Legal & Investigations
- Licensing & Supervision
- Corporate Services
- Research & Publication
- Executive Division
- Secretariat Unit

These are hardcoded strings — not pulled from the `divisionsAndUnits` constant used elsewhere in the app. A future improvement would align these with the canonical division/unit data source.

---

## 20. SharePoint Setup & Seeding Service

**File:** `src/services/regulatorySharePointSetupService.ts`  
**Class:** `RegulatorySharePointSetupService`

This is a one-time infrastructure service, intended to be called from the Admin panel to provision the SharePoint list before the module can operate.

### Methods

#### `checkExistingList(): Promise<boolean>`

Queries `/sites/{siteId}/lists` filtered by `displayName eq 'Regulatory_Intelligence_Cases'`. Returns `true` if the list exists, `false` otherwise.

#### `setupRegulatoryList(): Promise<{ success, message, listId? }>`

1. Calls `checkExistingList()` — returns early with an error message if list already exists (idempotent guard)
2. POSTs to `/sites/{siteId}/lists` with the full column schema (see Section 3)
3. Returns `{ success: true, listId: list.id }` on success

**Note:** The `Attachements` column is not defined in the setup schema — this is either handled by SharePoint's default `Attachments` column or needs to be added manually. The mapper in the hook handles the typo defensively.

#### `seedRegulatoryList(): Promise<{ success, message }>`

1. Resolves the list ID
2. Checks if the list already has items — skips seeding if so (idempotent guard)
3. Iterates over `MOCK_CASES` from `constants.ts` and POSTs each as a new SharePoint list item
4. Maps `RegulatoryCase` fields to the SharePoint field names

#### `deployRegulatoryEngine(): Promise<{ success, message, details? }>`

Orchestrates `setupRegulatoryList()` then `seedRegulatoryList()` in sequence. Returns a combined result. This is the single method to call from the Admin panel to fully initialise the module.

### Mock data (`constants.ts`)

The seed dataset includes 5 representative cases:

| Case ID | Type | Category | Risk | Status |
|---|---|---|---|---|
| SCPNG-RI-00045 | scam | Investment Scam | HIGH | UNDER_REVIEW |
| SCPNG-RI-00046 | enquiry | Licensing Query | LOW | RECEIVED |
| SCPNG-WB-00012 | whistleblower | Insider Trading | CRITICAL | INVESTIGATING |
| SCPNG-RI-00042 | compliance | AML Breach | MEDIUM | ESCALATED |
| SCPNG-Inv-00101 | investigation | Ponzi Scheme | HIGH | RESOLVED |

---

## 21. RBAC & Access Control

### Who can see the Regulatory Intelligence module

Access to the `/regulatory-intelligence` route is controlled by the application's route-level RBAC (enforced in the router configuration). Only users with appropriate roles (typically Compliance officers, Investigators, Legal staff, Admins) should have this route enabled.

### Who can edit cases (`isAdmin`)

The `isAdmin` flag comes from `useRoleBasedAuth()` — derived from the user's role in the Supabase `UserRoles` table (the `IsAdmin` column). Admin users see "Edit Case" and "Delete Case" in the actions dropdown. Non-admin users see only "View Details".

### Whistleblower access logging (aspirational)

The current UI displays "Access is logged and restricted" on whistleblower case detail modals. Actual logging is not implemented. A future implementation would POST to a SharePoint `WhistleblowerAccessLog` list or Azure Monitor on every `CaseDetailsModal` open for a whistleblower case, recording the accessing user's email, timestamp, and case ID.

---

## 22. SLA Framework

The following SLAs are recommended based on SCPNG's regulatory mandate and the risk classification system. These are not currently enforced in the application — they are operational targets.

### Initial Response SLAs (time from `createdAt` to first status change)

| Risk Level | Target | Responsible Party |
|---|---|---|
| CRITICAL | 4 hours | Compliance Officer + Commissioner Brief |
| HIGH | 24 hours | Compliance Officer |
| MEDIUM | 3 business days | Assigned Unit Officer |
| LOW | 5 business days | Assigned Unit Officer |

### Investigation Completion SLAs (time from `INVESTIGATING` to `RESOLVED`)

| Case Type | Target | Notes |
|---|---|---|
| Scam (LOW/MEDIUM) | 20 business days | Standard processing |
| Scam (HIGH/CRITICAL) | 10 business days | Accelerated — potential enforcement action |
| Whistleblower | 30 business days | Extended due to sensitivity and evidence gathering |
| Compliance | 15 business days | Determined by severity of the breach |
| Enquiry | 5 business days | Primarily information-provision |
| Investigation | Case-by-case | Subject to legal proceedings timeline |

### Escalation triggers

A case should be escalated (`ESCALATED` status) when any of the following apply:
- Risk is upgraded to CRITICAL during investigation
- A licensed entity is named and ongoing harm is probable
- Evidence of senior management or officer involvement is found
- Cross-border dimensions are identified
- Legal action or referral to law enforcement is being considered

---

## 23. Known Limitations & Future Considerations

### Active limitations

| Issue | Location | Impact |
|---|---|---|
| `FilterPanel` is not functionally wired | `FilterPanel.tsx` | Overview tab cannot search or filter by attribute |
| Volume trend chart uses static mock data | `RegulatoryAnalytics.tsx` | 6-month chart is not real |
| Attachment N+1 API calls | `useRegulatoryCases.ts` | One extra Graph call per case with a DriveItem ID |
| Unit options are hardcoded | `CaseEditModal.tsx` | Not synced with canonical divisions/units |
| Delete case shows "coming soon" toast | `CaseTable.tsx` | Deletion is not implemented |
| Whistleblower access logging is label-only | `CaseDetailsModal.tsx` | No actual audit trail |
| Case submission (create) not in dashboard | Module-wide | Cases are created externally (WordPress); no internal case creation UI |
| FilterPanel state not lifted | `FilterPanel.tsx` | Search input and dropdowns have no effect on data |
| `SecureToken` not surfaced in UI | `CaseDetailsModal.tsx` | Officers cannot see or copy the token to reference anonymous reporters |
| List ID not hardcoded | `useRegulatoryCases.ts` | One extra Graph call per session to resolve list ID |

### Recommended future improvements

1. **Real volume trend data** — aggregate `createdAt` by calendar month client-side, or maintain a dedicated aggregation list via Power Automate
2. **Internal case creation** — add a "New Case" form to the dashboard for officers to log walk-in or phone reports directly without going through the external form
3. **Batch attachment resolution** — use the Microsoft Graph batch API (`$batch`) to resolve all DriveItem IDs in a single HTTP request
4. **FilterPanel wiring** — lift filter state to `RegulatoryDashboard`, apply to the overview table, and support text search against `caseId`, `title`, `description`, and `category`
5. **Whistleblower audit log** — create a `WhistleblowerAccessLog` SharePoint list; write an entry on every open of a whistleblower `CaseDetailsModal`
6. **Case deletion** — implement soft-delete (set status to `CLOSED` with a `DeletedBy` field) rather than hard SP item deletion
7. **SLA tracking** — add computed `daysOpen` and `isOverSLA` fields to the `RegulatoryCase` type, derived from `createdAt` and the SLA matrix; display overdue cases with a red indicator in the table
8. **Export** — allow compliance officers to export filtered case lists to CSV or Excel for reporting
9. **Notifications** — Power Automate flow to email the assigned officer when a new case is assigned to their unit
10. **SecureToken portal** — a separate public-facing page where a whistleblower can enter their token to see case status without logging in

---

## 24. File Reference Map

| File | Role |
|---|---|
| [src/pages/RegulatoryIntelligence.tsx](src/pages/RegulatoryIntelligence.tsx) | Route page — thin PageLayout wrapper |
| [src/modules/regulatory/components/RegulatoryDashboard.tsx](src/modules/regulatory/components/RegulatoryDashboard.tsx) | Main orchestrator: tabs, data ownership, error/loading states |
| [src/modules/regulatory/components/KPIBar.tsx](src/modules/regulatory/components/KPIBar.tsx) | 4-card headline KPI display |
| [src/modules/regulatory/components/RegulatoryAnalytics.tsx](src/modules/regulatory/components/RegulatoryAnalytics.tsx) | 3 Recharts visualisations |
| [src/modules/regulatory/components/FilterPanel.tsx](src/modules/regulatory/components/FilterPanel.tsx) | UI-only filter bar (not wired to state) |
| [src/modules/regulatory/components/CaseTable.tsx](src/modules/regulatory/components/CaseTable.tsx) | Full case table with badges, actions dropdown |
| [src/modules/regulatory/components/CaseDetailsModal.tsx](src/modules/regulatory/components/CaseDetailsModal.tsx) | Read-only case detail dialog |
| [src/modules/regulatory/components/CaseEditModal.tsx](src/modules/regulatory/components/CaseEditModal.tsx) | Admin-only edit dialog — persists to SharePoint |
| [src/modules/regulatory/components/RegulatoryAIChat.tsx](src/modules/regulatory/components/RegulatoryAIChat.tsx) | Gemini AI analyst with live data injection |
| [src/modules/regulatory/components/regulatoryQuestions.ts](src/modules/regulatory/components/regulatoryQuestions.ts) | Static question library + quick question chips |
| [src/modules/regulatory/types.ts](src/modules/regulatory/types.ts) | CaseType, CaseRisk, CaseStatus, RegulatoryCase, KPIStats |
| [src/modules/regulatory/constants.ts](src/modules/regulatory/constants.ts) | MOCK_CASES seed data, MOCK_KPI_STATS |
| [src/hooks/useRegulatoryCases.ts](src/hooks/useRegulatoryCases.ts) | React Query fetch hook + update mutation |
| [src/services/regulatorySharePointSetupService.ts](src/services/regulatorySharePointSetupService.ts) | One-time list creation, column setup, and seed |
| [docs/modules/regulatory-case-edit.md](docs/modules/regulatory-case-edit.md) | Edit feature implementation detail (shorter reference) |
