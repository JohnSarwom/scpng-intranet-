# PROJECT PROPOSAL

> **Document Reference:** SCPNG-PP-2026-001
> **Project Title:** Securities Commission of Papua New Guinea — Corporate Intranet System
> **Version:** 1.0
> **Date Prepared:** 30 March 2026
> **Prepared By:** IT Unit, Securities Commission of Papua New Guinea
> **Classification:** Internal — Management Review

---

## 1. INTRODUCTION

### 1.1 Purpose of This Document

This Project Proposal presents the rationale, objectives, approach, and expected outcomes for the design and development of the Securities Commission of Papua New Guinea (SCPNG) Corporate Intranet System. The document is intended for senior management review and approval of the project scope and associated investment.

### 1.2 Background

The Securities Commission of Papua New Guinea is the statutory body responsible for regulating and developing the securities industry in Papua New Guinea. As of January 2026, the Commission's internal operations relied on a combination of:

- **Microsoft 365 tools** (Outlook, SharePoint, Teams) used in an ad-hoc manner without structured workflows
- **Paper-based forms** for leave applications, asset requests, IT support tickets, and meeting records
- **Spreadsheets** for tracking tasks, KPIs, KRAs, and strategic objectives without a unified view
- **No centralised dashboard** for performance monitoring at the division, unit, or officer level
- **No AI or automation tools** to support regulatory analysis or operational decision-making

This fragmented approach created several operational challenges:

1. **Lack of strategic visibility** — No mechanism to cascade organisational strategy into measurable daily actions
2. **Manual, paper-heavy processes** — High administrative burden for routine business operations
3. **Siloed information** — Data stored across multiple unconnected systems with no single source of truth
4. **No intelligent automation** — No AI-driven capability for regulatory research or data analysis
5. **Inconsistent access control** — No systematic approach to division-based data security

---

## 2. PROBLEM STATEMENT

The Securities Commission of Papua New Guinea required a unified digital platform to:

1. **Connect strategy to execution** — Enable a direct, auditable link between the Commission's strategic initiatives and the daily tasks undertaken by officers across all divisions and units.

2. **Eliminate paper-based workflows** — Digitise routine business processes including leave management, asset tracking, meeting documentation, and service desk operations.

3. **Provide intelligent decision support** — Equip officers with AI-powered tools to accelerate regulatory research, interpret analytics data, and access organisational knowledge.

4. **Enforce data governance** — Implement fine-grained access controls ensuring officers can only view and modify data within their authorised divisional scope.

5. **Unify organisational communication** — Centralise internal news, announcements, calendars, and media in a single, accessible platform.

---

## 3. PROPOSED SOLUTION

### 3.1 Solution Overview

We propose the development of a **modern web-based corporate intranet system** built on the following architecture:

- **Frontend:** React 18 with TypeScript, delivered via Vite for high-performance bundling, with a custom "Dark Luxury" glassmorphic design system
- **Backend (Enterprise):** Microsoft SharePoint Online via Microsoft Graph API for data operations, leveraging the Commission's existing Microsoft 365 investment
- **Backend (Database):** Supabase (PostgreSQL) with Row-Level Security for division-scoped data isolation, authentication, and serverless edge functions
- **Authentication:** Microsoft Azure Active Directory (MSAL) providing single sign-on using officers' existing Microsoft 365 credentials
- **AI Integration:** Groq SDK for large language model access (LLaMA 3, Mixtral), deployed through Supabase Edge Functions
- **Deployment:** Vercel for production hosting with optional Electron packaging for desktop distribution

### 3.2 Why This Approach

| Design Decision | Rationale |
|----------------|-----------|
| **Microsoft SharePoint as primary data store** | Leverages the Commission's existing M365 licences. No additional database licensing costs. Data remains within the organisation's existing governance framework. |
| **Supabase as secondary backend** | Provides capabilities SharePoint cannot: Row-Level Security, real-time subscriptions, serverless functions, and PostgreSQL power for complex queries. Free tier covers current usage. |
| **Azure AD authentication** | Officers log in with existing credentials. No additional account management. Automatic profile and photo retrieval from the organisation directory. |
| **React + TypeScript** | Industry-standard frontend framework. Strong type safety reduces bugs. Massive ecosystem of compatible libraries. Large talent pool for future maintenance. |
| **Groq for AI** | High-speed inference at significantly lower cost than OpenAI or Anthropic. Supports open-source models (LLaMA, Mixtral) avoiding vendor lock-in to proprietary model providers. |
| **Custom design system** | A distinctive branded interface differentiates the system from generic enterprise tools, improving officer engagement and adoption. |

### 3.3 Key Features

#### 3.3.1 Strategic Performance Management

The centrepiece of the system is a **strategic cascading framework** that connects every level of organisational activity:

```
Organisational Strategic Initiatives
    └── Division-Level Key Result Areas (KRAs)
            └── Unit-Level Key Performance Indicators (KPIs)
                    └── Individual Officer Tasks
```

This hierarchy enables:
- **Top-down visibility:** Executive leadership can view how strategic initiatives translate into divisional activity
- **Bottom-up accountability:** Individual task completion directly contributes to measurable KPI and KRA outcomes
- **Real-time dashboards:** Traffic light indicators, completion charts, and trend analysis available at every level

#### 3.3.2 Operational Digitisation

All major business processes are moved from paper to digital workflows:

| Process | Current State | Proposed State |
|---------|--------------|----------------|
| Leave Applications | Paper form → Manager signature → HR filing | Digital form → Auto-routed approval → Instant tracking |
| Asset Management | Spreadsheet register | Full lifecycle system with invoices, maintenance, decommission |
| Meeting Minutes | Manual Word document | Structured form → Auto-generated DOCX → Email distribution |
| IT Support Tickets | Email or verbal request | Ticketing system with assignment, priority, SLA tracking |
| Visitor Registration | Paper logbook | Digital visitor management with appointment scheduling |
| Document Storage | SharePoint folders (unstructured) | Categorised document library with metadata and search |

#### 3.3.3 AI-Powered Intelligence

Three specialised AI assistants embedded within the platform:

1. **AI Hub** — General-purpose AI chat with knowledge base upload, multi-model selection, and session management
2. **Regulatory AI** — Specialised assistant for regulatory compliance queries, with pre-built question templates and case context
3. **Analytics AI** — Conversational interface for interpreting website analytics data

#### 3.3.4 Communication & Content

A suite of internal communication tools:

- Internal news publishing with dashboard slideshows
- Digital notice board with time-limited announcements
- Organisational calendar with event management
- Media gallery with album management and lightbox viewing
- Staff contacts directory with Microsoft Graph integration
- Real-time notification system

---

## 4. PROJECT OBJECTIVES

### 4.1 Primary Objectives

| # | Objective | Success Criteria |
|---|-----------|-----------------|
| O1 | Deploy a fully functional intranet accessible to all SCPNG officers | System is live and all officers can authenticate via Azure AD |
| O2 | Implement strategic performance cascade | Tasks link to KPIs → KRAs → Initiatives with drill-down views at each level |
| O3 | Digitise 5+ core business processes | Leave, assets, meetings, tickets, and documents operational in digital form |
| O4 | Deploy AI assistants across 3 domains | AI Hub, Regulatory AI, and Analytics AI functional with streaming responses |
| O5 | Enforce division-scoped access control | Officers see only data from their assigned divisions; verified via RLS policies |

### 4.2 Secondary Objectives

| # | Objective | Success Criteria |
|---|-----------|-----------------|
| O6 | Deliver a premium user experience | Custom design system applied consistently; UAT feedback scores ≥ 4/5 |
| O7 | Integrate with existing Microsoft 365 | SharePoint data operations, Azure AD auth, and Graph API contacts all functional |
| O8 | Provide administrative self-service | Admins can manage users, roles, themes, and system configuration without developer assistance |
| O9 | Establish automated data feeds | Market data syncs daily via Google Apps Script without manual intervention |
| O10 | Create a foundation for future modules | Architecture supports addition of new modules without refactoring core systems |

---

## 5. TARGET AUDIENCE

### 5.1 User Groups

| User Group | Role Description | Primary Modules |
|-----------|-----------------|----------------|
| **Executive Leadership** | Commissioner, Deputy Commissioner | Strategy Dashboard, Division Analytics, Reports |
| **Directors** | Division Heads | Division Overview, KRA Management, Work Plans, Reports |
| **Managers** | Unit Managers | Task Registry, KPI Tracking, Staff Metrics, Unit Management |
| **Officers** | Regulatory Officers, Analysts | Task Execution, AI Hub, Forms, Documents, Service Desk |
| **Support Staff** | Administrative Officers | Service Desk, Calendar, Contacts, Gallery, Forms |
| **IT Administrators** | System Administrators | Admin Console, User Management, API Configuration |

### 5.2 Estimated User Base

| Division | Estimated Officers |
|----------|-------------------|
| All SCPNG Divisions | 80–120 active users |

---

## 6. PROJECT APPROACH

### 6.1 Development Methodology

The project follows an **iterative, module-based development approach**:

1. **Module-by-module delivery** — Each functional module is designed, built, tested, and deployed independently
2. **SharePoint-first data strategy** — All list schemas are defined and provisioned before UI development begins
3. **Component-driven UI development** — A shared design system and global component library (PremiumTable, PremiumKanban) ensure consistency
4. **Continuous integration** — Changes are deployed incrementally to production via Vercel, enabling ongoing feedback

### 6.2 Quality Assurance

- **TypeScript strict mode** — Compile-time type checking across the entire codebase
- **UAT Feedback Widget** — In-app feedback collection throughout the testing period
- **Skeleton Loading** — Full skeleton loader coverage for perceived performance
- **Error Boundaries** — Graceful error handling across all data-fetching operations

---

## 7. ESTIMATED COST

| Module | Cost (PGK) |
|--------|------------|
| Task Registry & Strategic Performance Management | K50,000.00 |
| AI-Powered Intelligence & Automation Suite | K40,000.00 |
| Core Platform Infrastructure & Security | K8,000.00 |
| Business Operations & Workflow Automation | K8,000.00 |
| Communication, Service Desk & Analytics | K7,000.00 |
| Design System, UX Engineering & QA | K7,000.00 |
| **TOTAL** | **K120,000.00** |

---

## 8. EXPECTED TIMELINE

| Phase | Period | Duration |
|-------|--------|----------|
| Phase 1 — Foundation | January 2026 | 4 weeks |
| Phase 2 — Core Modules | January – February 2026 | 4 weeks |
| Phase 3 — AI & Intelligence | February – March 2026 | 4 weeks |
| Phase 4 — Operations | February – March 2026 | 3 weeks |
| Phase 5 — Polish & UAT | March 2026 | 2 weeks |

**Total Duration:** 12 weeks

---

## 9. ASSUMPTIONS

1. The Commission's existing Microsoft 365 E3/E5 licences include SharePoint Online and Azure Active Directory access for all officers.
2. The Supabase free tier is sufficient for current data volumes. Upgrade costs, if required, will be addressed separately.
3. Groq API free-tier rate limits are adequate for current AI usage volumes. Enterprise-tier costs will be evaluated based on actual consumption.
4. All officers have access to a modern web browser (Chrome, Edge, or Firefox) on Commission-provided devices.
5. Divisional structures and officer assignments are provided and maintained by the respective division directors.
6. The Commission's IT infrastructure (network, DNS, firewall) can support access to Vercel-hosted applications and external APIs.

---

## 10. REQUEST FOR APPROVAL

This Project Proposal is submitted for management review and approval. The IT Unit requests:

1. **Approval** of the proposed scope, approach, and costing as described in this document.
2. **Authorisation** to proceed with Phase 5 (Polish & UAT) completion and formal system handover.
3. **Allocation** of the project budget of **K120,000.00** against the appropriate funding line.
4. **Designation** of divisional representatives for formal User Acceptance Testing and sign-off.

---

> **Prepared by:** IT Unit — Securities Commission of Papua New Guinea
> **Date:** 30 March 2026
