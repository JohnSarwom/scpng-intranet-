# SCOPE OF WORK & REQUIREMENTS DOCUMENT

> **Document Reference:** SCPNG-SRD-2026-001
> **Project Title:** Securities Commission of Papua New Guinea — Corporate Intranet System
> **Version:** 1.0
> **Date Prepared:** 30 March 2026
> **Prepared By:** IT Unit, Securities Commission of Papua New Guinea
> **Classification:** Internal — Management Review

---

## 1. PURPOSE

This document defines the complete scope of work, functional requirements, technical requirements, deliverables, exclusions, and assumptions for the SCPNG Corporate Intranet System. It serves as the definitive reference for what was committed, delivered, and excluded from the project.

---

## 2. SCOPE OF WORK

### 2.1 In-Scope Deliverables

The following six (6) modules and their sub-components constitute the full scope of the project:

---

### MODULE 1 — Task Registry & Strategic Performance Management
**Cost Allocation: K50,000.00**

#### 1.1 Task Registry Engine

| ID | Deliverable | Description | Status |
|----|-------------|-------------|--------|
| T1.1.1 | Premium Kanban Board | Drag-and-drop task board with swim lanes (To Do, In Progress, Review, Completed). Built with `@dnd-kit`. Glassmorphic card design with priority indicators, assignee avatars, and due-date badges. | ✅ Delivered |
| T1.1.2 | Task CRUD Operations | Full create, read, update, and delete workflow via multi-step modal dialogs. Fields: title, description, assignee, priority, status, due date, KRA linkage, KPI linkage, strategic initiative alignment. | ✅ Delivered |
| T1.1.3 | Task Card System | Rich task cards with colour-coded priority bands, status badges, assignee display, and contextual action menus. | ✅ Delivered |
| T1.1.4 | Task Filtering & Grouping | Filter by status, priority, assignee, date range. Group by KRA, priority, or assignee with persistent user preferences. | ✅ Delivered |
| T1.1.5 | Weekly Review Tab | Automated weekly summary aggregating task completion rates, overdue items, and team productivity metrics. | ✅ Delivered |
| T1.1.6 | SharePoint Sync | Bidirectional data synchronisation with SharePoint lists via Microsoft Graph API. | ✅ Delivered |

#### 1.2 Strategic Performance Management

| ID | Deliverable | Description | Status |
|----|-------------|-------------|--------|
| T1.2.1 | Strategic Initiatives | Full management of organisational initiatives with hierarchical cascading to divisions and units. Supports create, edit, progress tracking. | ✅ Delivered |
| T1.2.2 | KRA Management | Key Result Area registry with status tracking (Not Started, In Progress, Completed), timeline visualisation, and parent initiative linkage. | ✅ Delivered |
| T1.2.3 | KPI Engine | Key Performance Indicator tracking with target vs. actual measurement, percentage completion, trend analysis, and personal KPI dashboard cards. | ✅ Delivered |
| T1.2.4 | KRA Insights Tab | Analytical dashboard with cross-KRA comparisons, completion heatmaps, and performance trend charts. | ✅ Delivered |
| T1.2.5 | KRA Timeline | Gantt-style timeline showing KRA progress with milestone markers. | ✅ Delivered |
| T1.2.6 | Strategic Alignment Tab | Visual mapping of task-to-KRA-to-initiative relationships. | ✅ Delivered |
| T1.2.7 | Traffic Light Dashboard | Red/Amber/Green status indicators for at-a-glance performance monitoring. | ✅ Delivered |
| T1.2.8 | Performance Analytics | Chart.js charts: task completion donuts, KRA status distributions, KPI performance bars, trend lines. | ✅ Delivered |

#### 1.3 Organisational Strategy & Structure

| ID | Deliverable | Description | Status |
|----|-------------|-------------|--------|
| T1.3.1 | Strategy Dashboard | Executive-level strategy page with organisational overview, initiative progress, division drill-downs, and setup wizard. | ✅ Delivered |
| T1.3.2 | Organisation Chart | Interactive org chart with division/unit hierarchy and click-through navigation. | ✅ Delivered |
| T1.3.3 | Division Modal | Comprehensive division detail view with tabs: overview, units, analytics, reports, work plans, settings. | ✅ Delivered |
| T1.3.4 | Unit Modal | Unit-level modal with officer roster, task metrics, KRA/KPI counts, and per-unit performance. | ✅ Delivered |
| T1.3.5 | Officer Profile Modal | Staff profile in strategy context: task assignments, KPI ownership, role information. | ✅ Delivered |

#### 1.4 Work Plan Builder

| ID | Deliverable | Description | Status |
|----|-------------|-------------|--------|
| T1.4.1 | Work Plan Generator | Structured work plan creation with period selection, activity planning, and milestone tracking. | ✅ Delivered |
| T1.4.2 | Division Work Plans Tab | Management interface for division-level work plans. | ✅ Delivered |
| T1.4.3 | Reports Tab | Reporting engine aggregating task, KRA, KPI, and project data into divisional performance reports. | ✅ Delivered |

---

### MODULE 2 — AI-Powered Intelligence & Automation Suite
**Cost Allocation: K40,000.00**

#### 2.1 AI Hub

| ID | Deliverable | Description | Status |
|----|-------------|-------------|--------|
| T2.1.1 | Multi-Model AI Chat | Full-featured chat supporting multiple LLM models via Groq SDK (LLaMA 3, Mixtral). Streaming responses, markdown rendering, conversation history. | ✅ Delivered |
| T2.1.2 | Knowledge Base Upload | Upload and index documents (PDF, DOCX, TXT) for context-aware AI responses. | ✅ Delivered |
| T2.1.3 | Question Library | Pre-built question templates organised by category for common queries. | ✅ Delivered |
| T2.1.4 | Session Management | Create, rename, archive, delete chat sessions with persistent history. | ✅ Delivered |

#### 2.2 Regulatory AI Assistant

| ID | Deliverable | Description | Status |
|----|-------------|-------------|--------|
| T2.2.1 | Regulatory Dashboard | Case management dashboard with KPI metrics, filter panels, case detail views. | ✅ Delivered |
| T2.2.2 | Regulatory AI Chat | Specialised AI assistant with regulatory context and pre-loaded question library. | ✅ Delivered |
| T2.2.3 | Case Analytics | Distribution charts, status trends, resolution timelines, officer workload analysis. | ✅ Delivered |
| T2.2.4 | Case CRUD | Full case management: create, edit, view, archive with sheet and modal detail views. | ✅ Delivered |

#### 2.3 Website Analytics AI

| ID | Deliverable | Description | Status |
|----|-------------|-------------|--------|
| T2.3.1 | Analytics Dashboard | Website analytics with traffic metrics, page views, bounce rates, visitor demographics. | ✅ Delivered |
| T2.3.2 | Analytics AI Chat | Conversational analytics with natural-language queries about website performance. | ✅ Delivered |

#### 2.4 Supabase Edge Functions

| ID | Deliverable | Description | Status |
|----|-------------|-------------|--------|
| T2.4.1 | `ai-chat` | Chat request handling, model selection, streaming responses. | ✅ Delivered |
| T2.4.2 | `scrapeWebsite` | Web scraping for regulatory intelligence data extraction. | ✅ Delivered |
| T2.4.3 | `update-all-news-from-sources` | Automated news aggregation from external sources. | ✅ Delivered |
| T2.4.4 | Personal Data Functions | Suite: `get-my-tasks`, `get-my-kras`, `get-my-kpis`, `get-my-projects`, `get-my-risks`, `get-my-objectives`, `get-my-assets`. | ✅ Delivered |
| T2.4.5 | `log-msal-login` | Authentication event auditing. | ✅ Delivered |

#### 2.5 External Data Automation

| ID | Deliverable | Description | Status |
|----|-------------|-------------|--------|
| T2.5.1 | Google Apps Script | Market data sync from Google Sheets (exchange rates, commodities, securities). | ✅ Delivered |
| T2.5.2 | Market Data Dashboard | Real-time market data visualisation with historical charts and daily summaries. | ✅ Delivered |
| T2.5.3 | Market News Feed | Capital market news aggregation with categorised display. | ✅ Delivered |

---

### MODULE 3 — Core Platform Infrastructure & Security
**Cost Allocation: K8,000.00**

| ID | Deliverable | Description | Status |
|----|-------------|-------------|--------|
| T3.1 | Azure AD SSO | MSAL-based single sign-on with automatic user profile and photo retrieval. | ✅ Delivered |
| T3.2 | Supabase Auth | Secondary authentication layer with JWT session management. | ✅ Delivered |
| T3.3 | RBAC System | Five-tier role hierarchy with division-scoped permissions. | ✅ Delivered |
| T3.4 | Row-Level Security | RLS policies on all database tables for division data isolation. | ✅ Delivered |
| T3.5 | Component Visibility | Dynamic UI element visibility based on role and division. | ✅ Delivered |
| T3.6 | User Management | Admin CRUD for users with role assignment and division membership. | ✅ Delivered |
| T3.7 | Permission Matrix | Visual role-to-feature mapping grid. | ✅ Delivered |
| T3.8 | Org Structure Admin | Division/unit hierarchy management interface. | ✅ Delivered |
| T3.9 | SharePoint Explorer | Built-in SharePoint list browser for data inspection. | ✅ Delivered |
| T3.10 | API Management | External API key and model configuration interface. | ✅ Delivered |
| T3.11 | Theme Customisation | Admin-controlled themes, colours, banners, display preferences. | ✅ Delivered |
| T3.12 | View Settings | Configurable dashboard layouts per role. | ✅ Delivered |
| T3.13 | SharePoint Provisioning | Automated list creation service for all required lists and columns. | ✅ Delivered |
| T3.14 | Setup Wizard | Multi-step guided first-time system configuration. | ✅ Delivered |

---

### MODULE 4 — Business Operations & Workflow Automation
**Cost Allocation: K8,000.00**

| ID | Deliverable | Description | Status |
|----|-------------|-------------|--------|
| T4.1 | Document Library | SharePoint-backed repository with folder navigation, upload, preview, download. | ✅ Delivered |
| T4.2 | Document Categories | Hierarchical category system with admin-managed taxonomy. | ✅ Delivered |
| T4.3 | Dynamic Forms Renderer | Generic form engine with configurable field types. | ✅ Delivered |
| T4.4 | Leave Application System | Full workflow: submission, approval routing, balance tracking, printable PDF. | ✅ Delivered |
| T4.5 | IT Request Form | Standardised IT support request with categorisation. | ✅ Delivered |
| T4.6 | Training Request Form | Staff training/development request workflow. | ✅ Delivered |
| T4.7 | Asset Request Form | IT asset requisition integrated with asset management. | ✅ Delivered |
| T4.8 | Meeting Minutes Form | Structured meeting recording: agenda, attendees, action items, decisions. | ✅ Delivered |
| T4.9 | DOCX Export | Professional meeting minutes generation with SCPNG-branded template. | ✅ Delivered |
| T4.10 | Meeting Share | Email distribution via Microsoft Graph mail API. | ✅ Delivered |
| T4.11 | Asset Registry | Comprehensive IT asset tracking with grid and card views. | ✅ Delivered |
| T4.12 | Asset Lifecycle | Full lifecycle: procurement, assignment, maintenance, decommission. | ✅ Delivered |
| T4.13 | Invoice Management | Asset-linked invoices with document upload and payment status. | ✅ Delivered |
| T4.14 | Maintenance Tracking | Service history and cost tracking for asset maintenance. | ✅ Delivered |

---

### MODULE 5 — Communication, Service Desk & Analytics
**Cost Allocation: K7,000.00**

| ID | Deliverable | Description | Status |
|----|-------------|-------------|--------|
| T5.1 | Ticket Manager | Service desk with inbox, board, grid views, priority, status, assignment. | ✅ Delivered |
| T5.2 | Visitor Management | Visitor registration, appointment scheduling, badge printing, visitor log. | ✅ Delivered |
| T5.3 | Mail & Packages | Inbound/outbound mail tracking with recipient assignment. | ✅ Delivered |
| T5.4 | General Inquiries | Kanban-style inquiry management with response tracking. | ✅ Delivered |
| T5.5 | News & Announcements | Internal news publishing with rich text and image attachments. | ✅ Delivered |
| T5.6 | Notice Board | Digital notice board with pinned and time-limited items. | ✅ Delivered |
| T5.7 | News Slideshow | Auto-rotating dashboard news carousel. | ✅ Delivered |
| T5.8 | Media Gallery | Photo gallery with albums, upload, and carousel lightbox viewer. | ✅ Delivered |
| T5.9 | Calendar & Events | Organisational calendar with event CRUD and SharePoint sync. | ✅ Delivered |
| T5.10 | Notifications | Real-time notification panel with read/unread and dismissal. | ✅ Delivered |
| T5.11 | HR Profiles | Staff directory with profile cards, search, and division filtering. | ✅ Delivered |
| T5.12 | Employee Profile Editor | Comprehensive profile editing with photo management. | ✅ Delivered |
| T5.13 | Contacts Directory | Microsoft Graph contacts with add, edit, and org structure view. | ✅ Delivered |
| T5.14 | Licensing Registry | Securities licence management with configurable views and HTML licence preview. | ✅ Delivered |
| T5.15 | Payments Registry | Payment record management with SharePoint backend. | ✅ Delivered |
| T5.16 | Application Catalogue | Enterprise software catalogue with add/edit and one-click deploy. | ✅ Delivered |

---

### MODULE 6 — Design System, UX Engineering & Quality Assurance
**Cost Allocation: K7,000.00**

| ID | Deliverable | Description | Status |
|----|-------------|-------------|--------|
| T6.1 | Design Token System | SCPNG Maroon (#83002A), glassmorphic backgrounds, white/10 borders, dark-mode palette. | ✅ Delivered |
| T6.2 | Typography System | Premium font stack with display and body typefaces. | ✅ Delivered |
| T6.3 | Glassmorphic Surface System | Layered translucency with backdrop-filter, gradients, hairline borders. | ✅ Delivered |
| T6.4 | PremiumTable System | Global data table with sortable headers, sticky columns, horizontal scroll, responsive height. | ✅ Delivered |
| T6.5 | Premium Kanban Board | Reusable drag-and-drop board with configurable lanes and card templates. | ✅ Delivered |
| T6.6 | Skeleton Loading System | Animated skeleton loaders for all major components. | ✅ Delivered |
| T6.7 | Modal & Dialog System | Consistent Radix-based modal patterns with SCPNG styling. | ✅ Delivered |
| T6.8 | Form Component Suite | Standardised inputs, selectors, date pickers, file uploaders, validation. | ✅ Delivered |
| T6.9 | Accessibility Baseline | Keyboard navigation, focus rings, ARIA labels, contrast compliance. | ✅ Delivered |
| T6.10 | Performance Optimisation | TanStack Query caching, lazy loading, virtualised lists. | ✅ Delivered |
| T6.11 | UAT Feedback System | In-app feedback widget with admin review panel. | ✅ Delivered |

---

## 3. FUNCTIONAL REQUIREMENTS

### 3.1 Authentication & Access

| Req ID | Requirement | Priority | Status |
|--------|------------|----------|--------|
| FR-01 | Officers shall authenticate using their Microsoft 365 credentials via Azure AD SSO | Critical | ✅ Met |
| FR-02 | The system shall support five (5) role levels: Admin, Director, Manager, Officer, Staff | Critical | ✅ Met |
| FR-03 | Officers shall only see data from divisions they are assigned to | Critical | ✅ Met |
| FR-04 | Admins shall be able to add, edit, deactivate users and assign roles | High | ✅ Met |
| FR-05 | The system shall retrieve user profile information and photos from Azure AD | Medium | ✅ Met |

### 3.2 Strategic Performance Management

| Req ID | Requirement | Priority | Status |
|--------|------------|----------|--------|
| FR-06 | The system shall support creation and management of Strategic Initiatives | Critical | ✅ Met |
| FR-07 | Each Initiative shall support one or more linked KRAs | Critical | ✅ Met |
| FR-08 | Each KRA shall support one or more linked KPIs with target/actual tracking | Critical | ✅ Met |
| FR-09 | Tasks shall be linkable to specific KRAs and KPIs | Critical | ✅ Met |
| FR-10 | The system shall provide traffic light (RAG) status at Initiative, KRA, and KPI levels | High | ✅ Met |
| FR-11 | Performance dashboards shall display completion charts, trends, and comparisons | High | ✅ Met |
| FR-12 | The system shall display an interactive organisation chart | Medium | ✅ Met |
| FR-13 | Officers shall view personalised KPI cards on the main dashboard | High | ✅ Met |

### 3.3 Task Management

| Req ID | Requirement | Priority | Status |
|--------|------------|----------|--------|
| FR-14 | Tasks shall be viewable as a Kanban board with drag-and-drop status changes | Critical | ✅ Met |
| FR-15 | Tasks shall have: title, description, assignee, priority, status, due date | Critical | ✅ Met |
| FR-16 | Tasks shall be filterable by status, priority, assignee, and date | High | ✅ Met |
| FR-17 | Tasks shall be groupable by KRA, priority, or assignee | Medium | ✅ Met |
| FR-18 | The system shall provide a weekly review summary of task activity | Medium | ✅ Met |

### 3.4 AI & Intelligence

| Req ID | Requirement | Priority | Status |
|--------|------------|----------|--------|
| FR-19 | The system shall provide a general-purpose AI chat interface | High | ✅ Met |
| FR-20 | Officers shall be able to upload documents for AI context | High | ✅ Met |
| FR-21 | The system shall provide pre-built question templates by category | Medium | ✅ Met |
| FR-22 | A specialised Regulatory AI assistant shall be available | High | ✅ Met |
| FR-23 | A specialised Website Analytics AI assistant shall be available | Medium | ✅ Met |
| FR-24 | AI responses shall stream in real-time and render markdown | High | ✅ Met |

### 3.5 Business Operations

| Req ID | Requirement | Priority | Status |
|--------|------------|----------|--------|
| FR-25 | Officers shall be able to submit leave applications digitally | High | ✅ Met |
| FR-26 | Leave applications shall be exportable as printable PDF | Medium | ✅ Met |
| FR-27 | The system shall provide a document library with categorised storage | High | ✅ Met |
| FR-28 | Meeting minutes shall be recordable with auto-generated DOCX export | High | ✅ Met |
| FR-29 | The system shall track IT assets through their full lifecycle | High | ✅ Met |
| FR-30 | An IT support ticketing system shall manage service requests | High | ✅ Met |

### 3.6 Communication

| Req ID | Requirement | Priority | Status |
|--------|------------|----------|--------|
| FR-31 | The system shall support internal news publishing with dashboard display | High | ✅ Met |
| FR-32 | An organisational calendar shall manage events across divisions | Medium | ✅ Met |
| FR-33 | A media gallery shall support photo albums with lightbox viewing | Medium | ✅ Met |
| FR-34 | A contacts directory shall integrate with Microsoft Graph | Medium | ✅ Met |
| FR-35 | Real-time notifications shall alert users of relevant system events | Medium | ✅ Met |

---

## 4. NON-FUNCTIONAL REQUIREMENTS

| Req ID | Requirement | Category | Status |
|--------|------------|----------|--------|
| NFR-01 | The system shall load initial page content within 3 seconds on standard connection | Performance | ✅ Met |
| NFR-02 | The system shall display skeleton loaders during all data fetching operations | UX | ✅ Met |
| NFR-03 | The system shall work on Chrome, Edge, and Firefox (latest 2 versions) | Compatibility | ✅ Met |
| NFR-04 | All interactive elements shall be keyboard-accessible | Accessibility | ✅ Met |
| NFR-05 | The system shall enforce RLS on all division-scoped database tables | Security | ✅ Met |
| NFR-06 | API keys and secrets shall be stored in environment variables, not in source code | Security | ✅ Met |
| NFR-07 | The UI shall be responsive and usable on screens ≥1024px width | Responsiveness | ✅ Met |
| NFR-08 | Data fetching shall use TanStack Query with caching and stale-while-revalidate | Performance | ✅ Met |

---

## 5. OUT OF SCOPE / EXCLUSIONS

The following items are explicitly **not included** in the project scope:

| # | Exclusion | Rationale |
|---|-----------|-----------|
| 1 | **Mobile native application** (iOS/Android) | The system is a responsive web application accessible via mobile browsers. A dedicated native app was not scoped. |
| 2 | **Email server configuration** | The system uses the existing Microsoft 365 mail infrastructure. No email server setup or configuration is included. |
| 3 | **Third-party payroll or HRIS integration** | HR profiles are managed internally. No integration with external payroll or HR systems was scoped. |
| 4 | **Financial accounting system integration** | The payments module is a standalone registry. No integration with financial accounting software (e.g., SAP, MYOB) is included. |
| 5 | **Multi-language / i18n support** | The system operates in English only. Internationalisation was not scoped. |
| 6 | **Advanced reporting / BI dashboards** | The system provides operational dashboards. Enterprise BI tools (e.g., Power BI) integration was not scoped. |
| 7 | **Automated workflow approvals** | Forms capture submissions but do not implement automated multi-step approval chains with email notifications. |
| 8 | **SMS notifications** | Notifications are in-app only. SMS or push notification integration was not scoped. |
| 9 | **Data migration from legacy systems** | The system provides import tools, but migration of historical data from legacy spreadsheets or databases is the responsibility of each division. |
| 10 | **Ongoing hosting and subscription costs** | External service costs (Microsoft 365, Supabase, Groq API, Vercel) are not included in the project cost. |

---

## 6. ASSUMPTIONS

| # | Assumption |
|---|-----------|
| 1 | All SCPNG officers have active Microsoft 365 accounts with SharePoint Online access. |
| 2 | The Supabase free tier is sufficient for current data volumes and user load. |
| 3 | Groq API free-tier rate limits accommodate current AI usage volumes. |
| 4 | Officers access the system from Commission-provided devices with modern browsers. |
| 5 | Division structures and officer assignments are maintained by divisional leadership. |
| 6 | Network infrastructure supports access to cloud-hosted services (Vercel, Supabase, Groq). |
| 7 | Feedback and change requests received during UAT are limited to the defined scope. |

---

## 7. CONSTRAINTS

| # | Constraint |
|---|-----------|
| 1 | The system must operate within the existing Microsoft 365 and SharePoint Online environment. |
| 2 | No additional enterprise software licences may be procured without separate approval. |
| 3 | All AI model access must use open-source models (LLaMA, Mixtral) to avoid proprietary vendor lock-in. |
| 4 | The system must be deployable on Vercel's free or Pro tier. |
| 5 | All source code must be maintained in a Git repository with full version history. |

---

> **Prepared by:** IT Unit — Securities Commission of Papua New Guinea
> **Date:** 30 March 2026
