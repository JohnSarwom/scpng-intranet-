# EXECUTIVE SUMMARY

> **Document Reference:** SCPNG-ES-2026-001
> **Project Title:** Securities Commission of Papua New Guinea — Corporate Intranet System
> **Version:** 1.0
> **Date Prepared:** 30 March 2026
> **Prepared By:** IT Unit, Securities Commission of Papua New Guinea
> **Classification:** Internal — Management Review

---

## 1. PROJECT OVERVIEW

The Securities Commission of Papua New Guinea (SCPNG) commissioned the design, development, and deployment of a modern corporate intranet system to replace fragmented internal processes with a unified, intelligent digital platform. The system centralises strategic performance management, daily operations, artificial intelligence capabilities, and communication tools into a single browser-based application accessible to all SCPNG officers.

The platform was developed over a **three-month engagement period** (January 2026 to March 2026) and is built on an enterprise-grade technology foundation comprising React 18 (TypeScript), Microsoft Azure Active Directory, Microsoft SharePoint Online, Supabase (PostgreSQL), and Groq-powered AI services.

---

## 2. PROJECT GOALS

The SCPNG Intranet was developed to achieve the following strategic goals:

| # | Goal | Description |
|---|------|-------------|
| 1 | **Centralise Strategic Performance Management** | Establish a direct, traceable link between daily task execution and the organisation's strategic initiatives through a cascading hierarchy of Initiatives → KRAs → KPIs → Tasks. |
| 2 | **Digitise Core Business Operations** | Replace paper-based and manual workflows for leave applications, asset management, meeting minutes, document management, and service desk operations. |
| 3 | **Integrate Artificial Intelligence** | Provide SCPNG officers with AI-powered assistants for regulatory analysis, website analytics interpretation, and general knowledge queries using large language models. |
| 4 | **Unify Organisational Communication** | Deliver a single platform for internal news, announcements, notice boards, calendar events, media galleries, and staff directories. |
| 5 | **Enforce Data Security & Access Control** | Implement division-scoped data isolation using Row-Level Security (RLS) and a five-tier Role-Based Access Control (RBAC) system integrated with the existing Microsoft 365 ecosystem. |
| 6 | **Deliver a Premium User Experience** | Build a distinctive, modern interface using a custom "Dark Luxury" glassmorphic design system that reinforces the SCPNG brand identity. |

---

## 3. KEY DELIVERABLES

The project delivered **six (6) major modules** across approximately **41 pages/views**, **180+ components**, **56 custom hooks**, and **32 service modules**:

### Module 1 — Task Registry & Strategic Performance Management
The operational backbone of the system. Features a drag-and-drop Kanban board, full task lifecycle management, and a strategic cascade linking individual tasks to organisational KPIs, KRAs, and Strategic Initiatives. Includes division and unit drill-down views, officer profiles, work plan builder, traffic light dashboards, and comprehensive reporting.

### Module 2 — AI-Powered Intelligence & Automation Suite
A multi-model AI chat hub (AI Hub) powered by Groq SDK (LLaMA 3, Mixtral), a Regulatory AI Assistant with case management, a Website Analytics AI Assistant, 13 serverless edge functions, and automated external data feeds including Google Sheets market data synchronisation.

### Module 3 — Core Platform Infrastructure & Security
Microsoft Azure AD single sign-on, Supabase authentication, division-based RBAC with Row-Level Security, a full administration console (user management, permissions, themes, API configuration, SharePoint explorer), and automated SharePoint list provisioning.

### Module 4 — Business Operations & Workflow Automation
Document management system, dynamic forms engine (leave applications, IT requests, training requests), meeting minutes generator with DOCX export and email distribution, and a full IT asset management system with invoice and maintenance tracking.

### Module 5 — Communication, Service Desk & Analytics
Service desk with ticket management, visitor management, mail and packages tracking, and general inquiries. Internal news publishing, notice board, media gallery with lightbox viewer, organisational calendar, contacts directory, licensing registry, payments registry, application catalogue, and market data dashboard.

### Module 6 — Design System, UX Engineering & Quality Assurance
Custom "Dark Luxury" glassmorphic design system with branded tokens (SCPNG Maroon #83002A), PremiumTable and PremiumKanban global component libraries, full skeleton loading system, accessibility baseline, and performance optimisation with TanStack Query caching.

---

## 4. BENEFITS SUMMARY

| Benefit Area | Expected Outcome |
|-------------|-----------------|
| **Strategic Alignment** | Every task performed by every officer is traceable to a strategic initiative, enabling real-time performance visibility at all organisational levels. |
| **Operational Efficiency** | Elimination of paper-based workflows for leave, assets, meeting minutes, and service desk operations, reducing processing time and manual errors. |
| **Decision Intelligence** | AI-powered assistants provide instant access to regulatory knowledge, analytics insights, and organisational data, reducing research time. |
| **Data Security** | Division-scoped data isolation ensures officers can only access information relevant to their assigned divisions, meeting regulatory compliance requirements. |
| **Unified Communication** | A single platform replaces fragmented communication channels (email, physical notice boards, shared drives) with structured digital alternatives. |
| **Cost Avoidance** | Built on the existing Microsoft 365 and Supabase infrastructure, avoiding the need for separate enterprise software licences. |

---

## 5. PROJECT TIMELINE

| Phase | Period | Duration | Key Milestone |
|-------|--------|----------|---------------|
| Phase 1 — Foundation | January 2026 | 4 weeks | Core platform, authentication, RBAC, SharePoint integration |
| Phase 2 — Core Modules | Jan – Feb 2026 | 4 weeks | Task Registry, Strategy module, Dashboard, Documents |
| Phase 3 — AI & Intelligence | Feb – Mar 2026 | 4 weeks | AI Hub, Regulatory AI, Edge Functions, Knowledge Base |
| Phase 4 — Operations | Feb – Mar 2026 | 3 weeks | Service Desk, HR, Assets, Forms, Licensing, Payments |
| Phase 5 — Polish & UAT | March 2026 | 2 weeks | Design refinement, skeleton loaders, UAT feedback |

**Total Project Duration:** 12 weeks (January – March 2026)

---

## 6. TOTAL COST

| Module | Cost (PGK) |
|--------|------------|
| Task Registry & Strategic Performance Management | K50,000.00 |
| AI-Powered Intelligence & Automation Suite | K40,000.00 |
| Core Platform Infrastructure & Security | K8,000.00 |
| Business Operations & Workflow Automation | K8,000.00 |
| Communication, Service Desk & Analytics | K7,000.00 |
| Design System, UX Engineering & QA | K7,000.00 |
| **TOTAL** | **K120,000.00** |

> **Note:** External service costs (Microsoft 365 subscriptions, Supabase hosting, Groq API usage, Vercel deployment) are not included in this figure and are covered under existing organisational arrangements.

---

## 7. RECOMMENDATION

The SCPNG Intranet system has been fully developed, tested through internal UAT, and deployed to the production environment. The system delivers comprehensive coverage of the Commission's operational and strategic management needs on a modern, secure, and extensible technology platform.

It is recommended that:

1. **Formal acceptance** of the system be completed by relevant divisional directors.
2. **User training** sessions be scheduled across all divisions to ensure adoption.
3. **A maintenance and support agreement** be established for ongoing system updates, bug fixes, and feature enhancements beyond the initial project period.
4. **Data migration** from any remaining legacy systems or spreadsheets be completed within the first quarter post-launch.

---

> **Prepared by:** IT Unit — Securities Commission of Papua New Guinea
> **Date:** 30 March 2026
