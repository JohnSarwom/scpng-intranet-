# PROJECT TIMELINE & BUDGET DOCUMENT

> **Document Reference:** SCPNG-TB-2026-001
> **Project Title:** Securities Commission of Papua New Guinea — Corporate Intranet System
> **Version:** 1.0
> **Date Prepared:** 30 March 2026
> **Prepared By:** IT Unit, Securities Commission of Papua New Guinea
> **Classification:** Internal — Management Review

---

## 1. PURPOSE

This document provides a detailed implementation timeline, phase-by-phase milestone breakdown, and comprehensive budget allocation for the SCPNG Corporate Intranet System project. It covers the full project period from January 2026 to March 2026.

---

## 2. PROJECT TIMELINE OVERVIEW

### 2.1 High-Level Schedule

| Phase | Start Date | End Date | Duration | Status |
|-------|-----------|----------|----------|--------|
| Phase 1 — Foundation & Infrastructure | 06 Jan 2026 | 31 Jan 2026 | 4 weeks | ✅ Complete |
| Phase 2 — Core Modules | 03 Feb 2026 | 28 Feb 2026 | 4 weeks | ✅ Complete |
| Phase 3 — AI & Intelligence | 10 Feb 2026 | 14 Mar 2026 | 4 weeks | ✅ Complete |
| Phase 4 — Operational Modules | 17 Feb 2026 | 21 Mar 2026 | 3 weeks | ✅ Complete |
| Phase 5 — Polish, UAT & Handover | 17 Mar 2026 | 30 Mar 2026 | 2 weeks | ✅ Complete |

**Total Project Duration:** 12 weeks (06 January 2026 – 30 March 2026)

> **Note:** Phases 3 and 4 ran in parallel with Phase 2 where dependencies allowed, enabling the compressed 12-week timeline.

---

## 3. DETAILED PHASE BREAKDOWN

### PHASE 1 — Foundation & Infrastructure
**Period:** 06 January – 31 January 2026
**Focus:** Core platform setup, authentication, security, and data architecture

#### Week 1–2: Platform Foundation (06 Jan – 17 Jan)

| # | Milestone | Deliverables |
|---|-----------|-------------|
| 1.1 | Project Initialisation | Vite + React 18 + TypeScript scaffolding, TailwindCSS configuration, Radix UI/shadcn setup, ESLint + TypeScript strict mode |
| 1.2 | Authentication System | Microsoft Azure AD MSAL integration, Supabase Auth configuration, Login page with branded SCPNG design |
| 1.3 | Core Layout | Main sidebar navigation, page layout engine, theme toggle, responsive shell |
| 1.4 | Routing Architecture | React Router v6 setup with protected routes, division-protected route wrapper, 404 handling |

#### Week 3–4: Backend & Security (20 Jan – 31 Jan)

| # | Milestone | Deliverables |
|---|-----------|-------------|
| 1.5 | Supabase Database Schema | Division tables, staff members, division memberships, RLS policies, functions |
| 1.6 | RBAC Implementation | Five-tier role hierarchy, `useRoleBasedAuth` hook, `useUIRoles` hook, `useComponentVisibility` hook |
| 1.7 | SharePoint Integration Layer | Microsoft Graph client setup, SharePoint operations service (`sharePointOpsService.ts` — 138KB), base CRUD operations |
| 1.8 | SharePoint List Provisioning | Automated list setup service (`sharePointListSetupService.ts` — 203KB), schema definitions for all lists |
| 1.9 | Division Data Architecture | Division service, unit service, staff service, division context, division selector |

**Phase 1 Completion Criteria:**
- ✅ Officers can authenticate via Azure AD SSO
- ✅ Division-based RLS is enforced on all database tables
- ✅ SharePoint lists are auto-provisioned with correct schemas
- ✅ The base application shell renders with branded sidebar navigation

---

### PHASE 2 — Core Modules
**Period:** 03 February – 28 February 2026
**Focus:** Task Registry, Strategy, Dashboard, and Document Management

#### Week 5–6: Task Registry & Strategy (03 Feb – 14 Feb)

| # | Milestone | Deliverables |
|---|-----------|-------------|
| 2.1 | Task Registry — Kanban Board | Premium Kanban board with `@dnd-kit`, swim lanes, drag-and-drop, glassmorphic task cards |
| 2.2 | Task Registry — CRUD | Task creation/edit modal with multi-field form (title, description, assignee, priority, status, due date, KRA/KPI linkage) |
| 2.3 | Task Registry — Tabs System | Overview, Tasks (Kanban), Projects, KRAs, Risks, Assets, Staff Metrics, Reports, Strategic Alignment, Weekly Review |
| 2.4 | Strategy Module — Core | Strategy page, setup wizard, organisational overview, strategic initiative management |
| 2.5 | Strategy Module — Org Chart | Interactive organisation chart with division/unit hierarchy and click navigation |
| 2.6 | KRA Management | KRA registry, insights tab, timeline visualisation, edit modals |

#### Week 7–8: Performance Management & Dashboard (17 Feb – 28 Feb)

| # | Milestone | Deliverables |
|---|-----------|-------------|
| 2.7 | KPI Engine | KPI definition, target/actual tracking, percentage completion, personal KPI dashboard cards |
| 2.8 | Performance Analytics | Task completion donuts, KRA status charts, KPI performance bars, trend lines, traffic light dashboard |
| 2.9 | Division/Unit Modals | Division detail modal (6 tabs), unit detail modal with officer roster and metrics |
| 2.10 | Main Dashboard | Welcome banner, KPI statistics, task completion charts, organisational overview, quick access, calendar widget, news slideshow, apps section |
| 2.11 | Document Management | SharePoint document library, category management, file upload/preview/download |
| 2.12 | Projects & Risks Tabs | Projects registry and risk registry within the unit tabs system |

**Phase 2 Completion Criteria:**
- ✅ Full Kanban task board operational with SharePoint sync
- ✅ Strategic cascade (Initiative → KRA → KPI → Task) fully functional
- ✅ Main dashboard displays personalised performance data
- ✅ Division and unit drill-down views operational

---

### PHASE 3 — AI & Intelligence
**Period:** 10 February – 14 March 2026
**Focus:** AI Hub, Regulatory AI, Analytics AI, Edge Functions, External Integrations

#### Week 6–7: AI Hub (10 Feb – 21 Feb)

| # | Milestone | Deliverables |
|---|-----------|-------------|
| 3.1 | AI Chat Engine | Multi-model Groq SDK integration, streaming response handler, markdown renderer, session state management |
| 3.2 | AI Hub Interface | Full chat UI (196KB page), message list, input area, model selector, session sidebar |
| 3.3 | Knowledge Base | Document upload modal, file processing, context injection into AI prompts |
| 3.4 | Question Library | Categorised pre-built question templates, sidebar navigation |

#### Week 8–9: Specialised AI & Edge Functions (24 Feb – 07 Mar)

| # | Milestone | Deliverables |
|---|-----------|-------------|
| 3.5 | Supabase Edge Functions | `ai-chat` function, `scrapeWebsite` function, `update-all-news-from-sources` function |
| 3.6 | Personal Data Functions | Seven `get-my-*` edge functions for personalised data endpoints |
| 3.7 | Regulatory AI | Regulatory intelligence dashboard, case management CRUD, regulatory AI chat with pre-built questions, case analytics |
| 3.8 | Website Analytics AI | Analytics dashboard, analytics AI chat interface, pre-built analytics questions |

#### Week 10: External Data Automation (10 Mar – 14 Mar)

| # | Milestone | Deliverables |
|---|-----------|-------------|
| 3.9 | Market Data Integration | Google Apps Script for Sheets sync, market data SharePoint service, market data dashboard with charts |
| 3.10 | Market News | Market news service, capital market news slideshow, daily market summary page |
| 3.11 | Login Auditing | `log-msal-login` edge function for authentication event tracking |

**Phase 3 Completion Criteria:**
- ✅ AI Hub functional with multi-model chat and knowledge base
- ✅ Regulatory AI assistant operational with case management
- ✅ All 13 edge functions deployed to Supabase
- ✅ Market data syncing automatically from Google Sheets

---

### PHASE 4 — Operational Modules
**Period:** 17 February – 21 March 2026
**Focus:** Forms, HR, Assets, Service Desk, Communications

#### Week 7–8: Forms & HR (17 Feb – 28 Feb)

| # | Milestone | Deliverables |
|---|-----------|-------------|
| 4.1 | Forms Engine | Dynamic form renderer, form field components, form layout wrapper, add form/group dialogs |
| 4.2 | Leave Application | Leave application page, paper form, printable PDF, tracker, print modal |
| 4.3 | IT & Training Requests | IT request form with paper view, training request form |
| 4.4 | HR Profiles | HR profiles dashboard, employee profile modal, employee profile editor, photo management |
| 4.5 | HR Data Import | CSV data importer for bulk staff record loading |

#### Week 9–10: Assets, Meetings & Service Desk (03 Mar – 14 Mar)

| # | Milestone | Deliverables |
|---|-----------|-------------|
| 4.6 | Asset Management | Asset dashboard, asset cards, asset info modals, asset table with filters |
| 4.7 | Asset Lifecycle | Invoice management page, maintenance tracking page, decommissioned assets page |
| 4.8 | Meeting Minutes | Meeting minutes form, DOCX generation service, share meeting modal, email distribution |
| 4.9 | Service Desk — Tickets | Ticket manager (72KB), ticket inbox, ticket cards, ticket dialogs |
| 4.10 | Service Desk — Visitors | Visitor management system (105KB), appointment views |
| 4.11 | Service Desk — Mail | Mail and packages tracking, mail/package dialog |

#### Week 11: Communications & Registries (17 Mar – 21 Mar)

| # | Milestone | Deliverables |
|---|-----------|-------------|
| 4.12 | News & Announcements | News page, internal news slideshow, announcements SharePoint service |
| 4.13 | Calendar & Events | Calendar page, add event modal, calendar event modal, calendar service |
| 4.14 | Media Gallery | Gallery page, add/edit photo modals, gallery lightbox with Framer Motion carousel |
| 4.15 | Contacts | Contacts page, add contact dialog, contact details modal, organisational structure view |
| 4.16 | Licensing Registry | Licensing page, registry table, configuration panel, HTML licence preview |
| 4.17 | Payments | Payments page, payment records, add payment modal |
| 4.18 | Application Catalogue | Apps page, add/edit app modals, app details modal, SharePoint provisioning |
| 4.19 | Notice Board | Dashboard notice board component |
| 4.20 | Notifications | Notification panel with real-time updates |

**Phase 4 Completion Criteria:**
- ✅ All forms (leave, IT, training, asset request) operational
- ✅ Meeting minutes generator producing DOCX output
- ✅ Full service desk (tickets, visitors, mail) functional
- ✅ All communication modules live

---

### PHASE 5 — Polish, UAT & Handover
**Period:** 17 March – 30 March 2026
**Focus:** Design refinement, loading states, performance, user testing

#### Week 11–12: Final Polish (17 Mar – 30 Mar)

| # | Milestone | Deliverables |
|---|-----------|-------------|
| 5.1 | Design System Refinement | Final pass on glassmorphic tokens, border consistency, typography weights, colour semantics |
| 5.2 | Skeleton Loading System | Full skeleton loader suite for all major components (dashboard, tables, galleries, forms, market data) |
| 5.3 | PremiumTable Standardisation | Global table component with viewport-responsive height, horizontal scroll, sorted headers, sticky columns |
| 5.4 | Performance Optimisation | TanStack Query persistence, lazy loading, virtualised lists, re-render optimisation |
| 5.5 | Accessibility Pass | Focus-visible rings, keyboard navigation, ARIA labels, contrast checks |
| 5.6 | UAT Feedback System | In-app feedback widget deployment, admin feedback review panel |
| 5.7 | Strategic Terminology Alignment | "Objective" → "Initiative" rebranding across all UI surfaces |
| 5.8 | Gallery Lightbox Upgrade | Framer Motion carousel implementation replacing standard modal viewer |
| 5.9 | Admin Panel Completion | View settings, theme customisation, UAT feedback tab, API management |
| 5.10 | Production Deployment | Vercel production configuration, environment variables, build optimisation |

**Phase 5 Completion Criteria:**
- ✅ All skeleton loaders implemented
- ✅ PremiumTable standardised across all data views
- ✅ UAT feedback collected and critical items addressed
- ✅ Production deployment successful on Vercel

---

## 4. BUDGET & COST BREAKDOWN

### 4.1 Summary Cost Table

| # | Module | Cost (PGK) | % of Total |
|---|--------|------------|------------|
| 1 | Task Registry & Strategic Performance Management | K50,000.00 | 41.7% |
| 2 | AI-Powered Intelligence & Automation Suite | K40,000.00 | 33.3% |
| 3 | Core Platform Infrastructure & Security | K8,000.00 | 6.7% |
| 4 | Business Operations & Workflow Automation | K8,000.00 | 6.7% |
| 5 | Communication, Service Desk & Analytics | K7,000.00 | 5.8% |
| 6 | Design System, UX Engineering & QA | K7,000.00 | 5.8% |
| | **TOTAL PROJECT COST** | **K120,000.00** | **100%** |

---

### 4.2 Detailed Cost Breakdown — Module 1: Task Registry & Strategic Performance Management

| Sub-Module | Cost (PGK) |
|-----------|------------|
| Task Registry Engine (Kanban, CRUD, cards, filtering, weekly review, SharePoint sync) | K18,000.00 |
| Strategic Performance Management (Initiatives, KRAs, KPIs, analytics, traffic light, timeline, alignment) | K20,000.00 |
| Organisational Strategy & Structure (Strategy dashboard, org chart, division/unit/officer modals) | K8,000.00 |
| Work Plan Builder (Generator, division tab, reports) | K4,000.00 |
| **Sub-Total** | **K50,000.00** |

---

### 4.3 Detailed Cost Breakdown — Module 2: AI-Powered Intelligence & Automation Suite

| Sub-Module | Cost (PGK) |
|-----------|------------|
| AI Hub — Central Intelligence Platform (Multi-model chat, knowledge base, question library, sessions) | K20,000.00 |
| Regulatory AI Assistant (Dashboard, case management, AI chat, analytics) | K8,000.00 |
| Website Analytics AI Assistant (Dashboard, AI chat, question templates) | K5,000.00 |
| Supabase Edge Functions (13 functions: ai-chat, scraping, news, personal data, login audit) | K5,000.00 |
| External Data Automation (Google Apps Script, market data dashboard, market news) | K2,000.00 |
| **Sub-Total** | **K40,000.00** |

---

### 4.4 Detailed Cost Breakdown — Module 3: Core Platform Infrastructure & Security

| Sub-Module | Cost (PGK) |
|-----------|------------|
| Authentication & Authorisation (Azure AD SSO, Supabase Auth, RBAC, RLS, component visibility) | K3,000.00 |
| Administration Console (User management, permissions, org structure, SharePoint explorer, API config, themes, views, UAT) | K3,500.00 |
| SharePoint List Provisioning (Automated setup service, setup wizard, strategy migration) | K1,500.00 |
| **Sub-Total** | **K8,000.00** |

---

### 4.5 Detailed Cost Breakdown — Module 4: Business Operations & Workflow Automation

| Sub-Module | Cost (PGK) |
|-----------|------------|
| Document Management System (Library, categories, preview) | K2,000.00 |
| Forms Engine & Leave Management (Dynamic renderer, leave forms, IT/training/asset request forms, printable PDF) | K2,500.00 |
| Meeting Minutes Generator (Form, DOCX export, email distribution) | K1,500.00 |
| Asset Management (Registry, lifecycle, invoices, maintenance, decommission) | K2,000.00 |
| **Sub-Total** | **K8,000.00** |

---

### 4.6 Detailed Cost Breakdown — Module 5: Communication, Service Desk & Analytics

| Sub-Module | Cost (PGK) |
|-----------|------------|
| Ticketing & Service Desk (Ticket manager, visitor management, mail tracking, inquiries, appointments) | K2,500.00 |
| Communications & Content (News, notice board, slideshow, gallery, calendar, notifications) | K2,000.00 |
| HR & People Management (Profiles, editor, photos, contacts directory) | K1,000.00 |
| Registries & Specialised Modules (Licensing, payments, application catalogue, market summary) | K1,500.00 |
| **Sub-Total** | **K7,000.00** |

---

### 4.7 Detailed Cost Breakdown — Module 6: Design System, UX Engineering & QA

| Sub-Module | Cost (PGK) |
|-----------|------------|
| Custom Design System — "Dark Luxury" (Tokens, typography, glassmorphism, colour semantics, responsive engine) | K3,000.00 |
| Premium Component Library (PremiumTable, PremiumKanban, skeleton loaders, modals, forms, charts) | K2,500.00 |
| Quality Assurance (Cross-browser testing, accessibility, performance, error handling, UAT feedback) | K1,500.00 |
| **Sub-Total** | **K7,000.00** |

---

### 4.8 Excluded Costs

The following costs are **not included** in the K120,000.00 project budget and are borne separately under existing organisational arrangements:

| Cost Item | Responsible Party | Notes |
|-----------|------------------|-------|
| Microsoft 365 / Azure AD Licences | SCPNG ICT Budget | Existing enterprise licences |
| Supabase Hosting | SCPNG ICT Budget | Currently on free tier |
| Groq API Usage | SCPNG ICT Budget | Currently on free tier |
| Vercel Hosting | SCPNG ICT Budget | Currently on free/Pro tier |
| Domain / DNS Configuration | SCPNG ICT Budget | Existing infrastructure |
| User Training Delivery | SCPNG HR / ICT | Not scoped in this project |
| Post-Launch Support & Maintenance | TBD | Separate agreement required |

---

## 5. PAYMENT SCHEDULE

| Payment # | Milestone | Amount (PGK) | % of Total | Trigger |
|-----------|-----------|-------------|------------|---------|
| 1 | Phase 1 Completion — Foundation & Infrastructure | K20,000.00 | 16.7% | Authentication, RBAC, and SharePoint integration operational |
| 2 | Phase 2 Completion — Task Registry & Strategy | K40,000.00 | 33.3% | Kanban board, KRA/KPI engine, and strategy dashboard delivered |
| 3 | Phase 3 Completion — AI & Intelligence | K30,000.00 | 25.0% | AI Hub, Regulatory AI, all edge functions deployed |
| 4 | Phase 4 Completion — Operations & Communications | K15,000.00 | 12.5% | All operational modules (forms, assets, service desk) functional |
| 5 | Phase 5 Completion — Polish, UAT & Handover | K15,000.00 | 12.5% | UAT complete, design polish final, production deployment live |
| | **TOTAL** | **K120,000.00** | **100%** | |

---

> **Prepared by:** IT Unit — Securities Commission of Papua New Guinea
> **Date:** 30 March 2026
