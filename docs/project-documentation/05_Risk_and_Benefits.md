# RISK ASSESSMENT & BENEFITS DOCUMENT

> **Document Reference:** SCPNG-RB-2026-001
> **Project Title:** Securities Commission of Papua New Guinea — Corporate Intranet System
> **Version:** 1.0
> **Date Prepared:** 30 March 2026
> **Prepared By:** IT Unit, Securities Commission of Papua New Guinea
> **Classification:** Internal — Management Review

---

## PART A — RISK ASSESSMENT

### 1. PURPOSE

This section identifies the major risks associated with the SCPNG Corporate Intranet System project, assesses their likelihood and impact, and documents the mitigation strategies employed to manage each risk. Risks are categorised across technical, operational, organisational, and external domains.

---

### 2. RISK RATING MATRIX

| | **Low Impact** | **Medium Impact** | **High Impact** |
|---|---|---|---|
| **High Likelihood** | Medium | High | Critical |
| **Medium Likelihood** | Low | Medium | High |
| **Low Likelihood** | Low | Low | Medium |

---

### 3. RISK REGISTER

#### 3.1 Technical Risks

| Risk ID | Risk Description | Likelihood | Impact | Rating | Mitigation Strategy | Status |
|---------|-----------------|-----------|--------|--------|---------------------|--------|
| TR-01 | **SharePoint API Rate Limiting** — Heavy concurrent usage may trigger Microsoft Graph API throttling, causing data operations to fail or slow down. | Medium | High | **High** | Implemented TanStack Query caching with stale-while-revalidate pattern. Batch operations optimised. Retry logic with exponential backoff in SharePoint service layer. | 🟡 Monitored |
| TR-02 | **Supabase Free Tier Limits** — Database storage, edge function invocations, or bandwidth may exceed free-tier allowances as usage grows. | Medium | Medium | **Medium** | Current usage is well within limits. Monitoring dashboard configured. Upgrade path to Pro tier (USD $25/month) identified if needed. | 🟡 Monitored |
| TR-03 | **Groq API Availability & Rate Limits** — AI features depend on Groq's external API. Outages or rate limits would disable AI assistants. | Medium | Medium | **Medium** | AI features are non-critical — core operational modules function independently of AI. Error handling displays graceful fallback messages. Question library available as offline reference. | 🟢 Mitigated |
| TR-04 | **Browser Compatibility Issues** — Custom glassmorphic CSS (backdrop-filter, CSS grid) may render inconsistently across older browsers. | Low | Medium | **Low** | Tested on Chrome, Edge, and Firefox (latest versions). Webkit prefixes applied for backdrop-filter. Minimum browser requirement documented. | 🟢 Mitigated |
| TR-05 | **Data Loss from SharePoint Schema Changes** — Uncontrolled changes to SharePoint list schemas could break application data binding. | Low | High | **Medium** | SharePoint list provisioning is automated via the setup service. Schema changes are managed through code. Admin access to SharePoint list settings should be restricted. | 🟢 Mitigated |
| TR-06 | **Performance Degradation at Scale** — Large datasets (1000+ tasks, many divisions) may cause frontend rendering slowdowns. | Medium | Medium | **Medium** | Virtualised lists (`@tanstack/react-virtual`) implemented for large tables. TanStack Query pagination and caching active. Skeleton loaders mask data loading latency. | 🟢 Mitigated |
| TR-07 | **Single Point of Failure — Developer Knowledge** — The system was developed by a small team. Key architectural knowledge may be concentrated. | Medium | High | **High** | Comprehensive documentation created (docs/ folder with architecture, modules, components, and guides). Code is fully typed with TypeScript. Design system and patterns are standardised and documented. | 🟡 Monitored |

#### 3.2 Operational Risks

| Risk ID | Risk Description | Likelihood | Impact | Rating | Mitigation Strategy | Status |
|---------|-----------------|-----------|--------|--------|---------------------|--------|
| OR-01 | **Low User Adoption** — Officers may resist transitioning from familiar paper-based/email processes to the digital platform. | Medium | High | **High** | Intuitive, premium UI design reduces learning curve. Personal KPI dashboard provides immediate individual value. Phased rollout recommended with divisional champions. Training sessions to be scheduled. | 🟡 Active |
| OR-02 | **Incomplete Data Entry** — Officers may not consistently enter tasks, KPIs, or operational data, reducing system value. | Medium | High | **High** | Dashboard metrics and traffic light indicators create natural accountability. Directors can monitor division-level activity. Strategic cascade ensures data entry is tied to performance visibility. | 🟡 Active |
| OR-03 | **Division Structure Changes** — Organisational restructuring could invalidate existing division/unit configurations and break data relationships. | Low | High | **Medium** | Admin console supports division and unit management. Data relationships use division IDs that can be remapped. The setup wizard can re-run configuration steps. | 🟢 Mitigated |
| OR-04 | **Backlog of UAT Feedback** — Large volumes of change requests from UAT could delay final handover. | Medium | Medium | **Medium** | UAT feedback is categorised by severity. Critical items are addressed immediately. Non-critical items are logged for future enhancement cycles. Scope control is enforced against the requirements document. | 🟢 Mitigated |

#### 3.3 Security Risks

| Risk ID | Risk Description | Likelihood | Impact | Rating | Mitigation Strategy | Status |
|---------|-----------------|-----------|--------|--------|---------------------|--------|
| SR-01 | **Unauthorised Data Access** — Misconfigured RLS policies could allow officers to access data from other divisions. | Low | Critical | **Medium** | Row-Level Security enforced on all division-scoped tables. RLS policies verified against the `get_user_division_ids` function. Division membership strictly controlled via admin panel. | 🟢 Mitigated |
| SR-02 | **API Key Exposure** — Environment variables containing API keys could be accidentally committed to the Git repository. | Low | High | **Medium** | `.env` file is listed in `.gitignore`. API keys are stored in Vercel environment variables for production. `.env.example` provides a template without actual values. | 🟢 Mitigated |
| SR-03 | **AI Prompt Injection** — Users could craft malicious prompts to extract system instructions or bypass AI guardrails. | Low | Medium | **Low** | AI functions operate as stateless chat interfaces without access to system databases or admin functions. Edge functions handle prompt processing server-side. System prompts are not exposed to the client. | 🟢 Mitigated |
| SR-04 | **Session Hijacking** — MSAL tokens could be intercepted if transmitted insecurely. | Low | High | **Medium** | MSAL uses PKCE (Proof Key for Code Exchange) flow. All communications are over HTTPS. Token storage follows MSAL best practices (session storage with fallback). | 🟢 Mitigated |

#### 3.4 External / Dependency Risks

| Risk ID | Risk Description | Likelihood | Impact | Rating | Mitigation Strategy | Status |
|---------|-----------------|-----------|--------|--------|---------------------|--------|
| ER-01 | **Microsoft 365 Service Outage** — Azure AD or SharePoint Online outages would prevent authentication and data operations. | Low | Critical | **Medium** | Microsoft 365 has a 99.9% SLA. Supabase serves as a secondary backend for non-SharePoint data. Critical operations like authentication have retry mechanisms. | 🟢 Accepted |
| ER-02 | **Vercel Platform Issues** — Vercel hosting outages would make the application inaccessible. | Low | High | **Medium** | Electron desktop build available as offline fallback for critical functionality. Vercel has strong uptime SLA. Alternative hosting (Netlify, self-hosted) can be configured if needed. | 🟢 Accepted |
| ER-03 | **Open-Source Dependency Vulnerabilities** — Security vulnerabilities in npm packages could introduce risks. | Medium | Medium | **Medium** | Dependencies are pinned to specific versions. `npm audit` is run periodically. Critical packages (React, Supabase, MSAL) are from well-maintained organisations with active security response. | 🟡 Monitored |
| ER-04 | **Groq API Pricing Changes** — Groq could change their pricing model, making AI features cost-prohibitive. | Low | Medium | **Low** | The AI layer is abstracted behind edge functions. The architecture supports swapping to alternative providers (OpenAI, Anthropic, local models) with minimal code changes. | 🟢 Mitigated |

---

### 4. RISK SUMMARY

| Rating | Count | Risks |
|--------|-------|-------|
| **Critical** | 0 | — |
| **High** | 3 | TR-01 (API Throttling), TR-07 (Developer Knowledge), OR-01 (User Adoption) |
| **Medium** | 8 | TR-02, TR-05, TR-06, OR-02, OR-04, SR-01, SR-04, ER-03 |
| **Low** | 4 | TR-04, SR-03, ER-02, ER-04 |

**Overall Risk Posture:** The project carries a **MEDIUM** overall risk level. The three high-rated risks are actively managed through documentation, design incentives, and technical mitigation. No critical unmitigated risks remain.

---

---

## PART B — BENEFITS & OUTCOMES

### 5. PURPOSE

This section documents the tangible and strategic benefits the SCPNG Corporate Intranet System delivers to the organisation, categorised by benefit type and mapped to specific system capabilities.

---

### 6. STRATEGIC BENEFITS

#### 6.1 Strategic Alignment & Visibility

| Benefit | Description | Enabling Feature |
|---------|-------------|-----------------|
| **Strategy-to-Task Traceability** | Every task performed by every officer is directly linked to a KPI, which links to a KRA, which links to a Strategic Initiative. This creates an unbroken chain of accountability from daily execution to organisational strategy. | Strategic cascade: Initiative → KRA → KPI → Task |
| **Real-Time Performance Monitoring** | Executive leadership can view the current status of all strategic initiatives, KRAs, and KPIs across all divisions in real-time, without waiting for periodic reports. | Traffic light dashboard, KRA insights, performance analytics |
| **Division-Level Accountability** | Directors can monitor their division's contribution to organisational strategy through dedicated division modals with analytics, reports, and work plan tracking. | Division modal (6 tabs), division analytics, work plans |
| **Informed Decision Making** | Data-driven dashboards replace anecdotal reporting, enabling evidence-based resource allocation and strategic adjustment. | Dashboard analytics, KPI trends, task completion metrics |

#### 6.2 Data-Driven Performance Culture

| Benefit | Description | Enabling Feature |
|---------|-------------|-----------------|
| **Personal Accountability** | Each officer sees their own KPI performance on the main dashboard, creating a direct, personal connection to organisational goals. | Personal KPI cards, personal KPI statistics |
| **Team Visibility** | Managers can view their unit's task completion, KRA progress, and officer workload at a glance. | Staff metrics tab, unit modal, task grouping by assignee |
| **Weekly Rhythm** | The weekly review tab establishes a regular cadence of performance reflection without requiring manual report preparation. | Weekly review tab |

---

### 7. OPERATIONAL BENEFITS

#### 7.1 Process Efficiency

| Benefit | Before (Manual) | After (Digital) | Estimated Time Saving |
|---------|-----------------|-----------------|----------------------|
| **Leave Application** | Paper form → physical signature → walk to HR → filing | Digital form → auto-routed → instant tracking → printable PDF | ~60 minutes → ~5 minutes per application |
| **Meeting Minutes** | Manual Word document → formatting → email attachments | Structured form → auto-generated DOCX → one-click email distribution | ~45 minutes → ~10 minutes per meeting |
| **Asset Tracking** | Spreadsheet register → manual lookup → no lifecycle view | Full lifecycle system with invoices, maintenance, and decommission tracking | ~30 minutes → ~5 minutes per inquiry |
| **IT Support Requests** | Email or verbal → no tracking → lost requests | Ticketing system with assignment, priority, SLA, and status tracking | Unmeasured → fully tracked |
| **Document Retrieval** | Navigate SharePoint folders → search by memory | Categorised library with search, preview, and metadata | ~15 minutes → ~2 minutes per retrieval |

#### 7.2 Operational Consolidation

| Benefit | Description |
|---------|-------------|
| **Single Platform** | Officers access one platform for tasks, strategy, documents, forms, calendar, news, gallery, contacts, AI tools, and service desk — replacing 5+ separate tools. |
| **Consistent Data** | All operational data flows through standardised SharePoint lists with defined schemas, eliminating inconsistencies from ad-hoc spreadsheets. |
| **Audit Trail** | Digital workflows create automatic timestamps, status histories, and user attribution that paper processes cannot provide. |
| **Reduced Paper Consumption** | Digital forms, documents, and meeting minutes eliminate the need for physical printing of routine paperwork. |

---

### 8. TECHNOLOGY & INFRASTRUCTURE BENEFITS

| Benefit | Description |
|---------|-------------|
| **Leverages Existing Investment** | Built on the Commission's existing Microsoft 365 licences (Azure AD, SharePoint Online). No new enterprise software licences required. |
| **Cost-Effective AI** | Groq SDK provides access to high-quality open-source LLMs at significantly lower cost than proprietary alternatives (OpenAI, Anthropic). |
| **Zero-Cost Hosting (Current)** | Supabase free tier and Vercel free/Pro tier hosting minimise recurring infrastructure costs. |
| **Extensible Architecture** | The modular, component-driven architecture supports addition of new modules without refactoring core systems. Future modules can reuse the PremiumTable, PremiumKanban, and design system foundations. |
| **Modern Tech Stack** | React 18, TypeScript, and Vite represent current industry standards, ensuring access to a broad talent pool for future maintenance and reducing the risk of technology obsolescence. |
| **Offline Capability** | Electron desktop build provides a fallback for local access during network outages or for restricted environments. |

---

### 9. SECURITY & GOVERNANCE BENEFITS

| Benefit | Description |
|---------|-------------|
| **Division Data Isolation** | Row-Level Security ensures officers can only access data from their assigned divisions, meeting data governance requirements without manual enforcement. |
| **Role-Based Permissions** | The five-tier RBAC system (Admin, Director, Manager, Officer, Staff) ensures appropriate access levels across all system functions. |
| **Centralised User Management** | Admin console provides a single point of control for user accounts, roles, and division assignments, replacing ad-hoc access management. |
| **SSO Security** | Azure AD single sign-on enforces the Commission's existing password policies, multi-factor authentication settings, and conditional access rules without additional configuration. |
| **Audit Logging** | MSAL login events are captured via edge function, creating an authentication audit trail. |

---

### 10. AI & INNOVATION BENEFITS

| Benefit | Description |
|---------|-------------|
| **Accelerated Regulatory Research** | The Regulatory AI assistant provides instant responses to compliance and regulatory queries, reducing the time officers spend on manual research. |
| **Accessible Analytics** | The Website Analytics AI allows non-technical staff to query analytics data using natural language, democratising data access. |
| **Knowledge Preservation** | The Knowledge Base upload system captures institutional knowledge in a queryable format, reducing reliance on individual expertise. |
| **Productivity Enhancement** | The general-purpose AI Hub provides officers with a powerful drafting, research, and analysis tool for everyday work tasks. |
| **Innovation Positioning** | SCPNG becomes an early adopter of AI-powered regulatory technology in the Pacific region, positioning the Commission as a forward-thinking regulator. |

---

### 11. QUANTITATIVE BENEFIT ESTIMATES

| Metric | Estimate | Basis |
|--------|----------|-------|
| **Hours saved per officer per week** (forms, documents, task tracking) | 2–4 hours | Manual process comparisons in Section 7.1 |
| **Estimated weekly hours saved across organisation** (80 officers) | 160–320 hours | Per-officer savings × estimated user base |
| **Estimated annual productivity value** | K200,000–K400,000+ | Based on average officer hourly cost × hours saved per year |
| **Paper/printing cost reduction** | K5,000–K10,000 per year | Elimination of routine form printing |
| **IT support efficiency gain** | 30–50% reduction in lost/untracked requests | Ticketing system vs. email-based requests |

> **Note:** The estimated annual productivity value (K200,000–K400,000+) significantly exceeds the one-time project investment of K120,000, indicating a potential **return on investment within the first 4–7 months** of full adoption.

---

### 12. BENEFIT REALISATION DEPENDENCIES

The benefits described above are contingent upon:

| # | Dependency | Responsible Party |
|---|-----------|------------------|
| 1 | **Active system usage** across all divisions and units | Division Directors |
| 2 | **Consistent data entry** for tasks, KPIs, KRAs, and operational records | All Officers |
| 3 | **User training** to ensure officers understand system capabilities | IT Unit / HR |
| 4 | **Management reinforcement** of digital-first workflows | Senior Management |
| 5 | **Ongoing maintenance** to address bugs, feature requests, and security updates | IT Unit |
| 6 | **Infrastructure stability** (Microsoft 365, network connectivity) | IT Unit |

---

---

## PART C — APPROVAL & SIGN-OFF

### 13. DOCUMENT APPROVAL

This document has been prepared by the IT Unit and is submitted for review and approval by the designated project stakeholders.

---

### 13.1 Approval Signatures

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Project Lead / IT Manager** | _________________________ | _________________________ | ____/____/2026 |
| **Director — Corporate Services** | _________________________ | _________________________ | ____/____/2026 |
| **Commissioner / Deputy Commissioner** | _________________________ | _________________________ | ____/____/2026 |
| **Finance / Budget Authority** | _________________________ | _________________________ | ____/____/2026 |

---

### 13.2 Acceptance Declaration

By signing above, the undersigned confirm that:

1. They have reviewed the **Executive Summary** (SCPNG-ES-2026-001), **Project Proposal** (SCPNG-PP-2026-001), **Scope and Requirements Document** (SCPNG-SRD-2026-001), **Timeline and Budget Document** (SCPNG-TB-2026-001), and this **Risk Assessment & Benefits Document** (SCPNG-RB-2026-001).

2. They accept the **scope of work** as defined in the deliverable tables and acknowledge the **exclusions** documented in Section 5 of the Scope and Requirements Document.

3. They approve the **total project cost of K120,000.00** as detailed in the Budget and Cost Breakdown.

4. They acknowledge the **identified risks** and accept the mitigation strategies as documented in the Risk Register.

5. They accept the **system deliverables** as meeting the functional and non-functional requirements set forth in the project documentation.

---

### 13.3 Post-Approval Actions

Upon approval, the following actions shall be initiated:

| # | Action | Responsible | Target Date |
|---|--------|------------|-------------|
| 1 | Process payment per agreed schedule | Finance | Within 30 days |
| 2 | Schedule user training sessions across all divisions | IT Unit / HR | Within 2 weeks |
| 3 | Complete data migration from legacy spreadsheets | Division Directors | Within 4 weeks |
| 4 | Establish maintenance and support agreement | IT Unit / Management | Within 4 weeks |
| 5 | Conduct 30-day post-launch review | IT Unit / Directors | 30 days post-sign-off |

---

> **Prepared by:** IT Unit — Securities Commission of Papua New Guinea
> **Date:** 30 March 2026
