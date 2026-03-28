# SCPNG Intranet: Architecture Hub

This is the **Single Source of Truth** for the SCPNG Intranet application's architecture. It provides a high-level map for developers and AI assistants.

---

## 🛠 Tech Stack
- **Frontend**: React (Vite), Tailwind CSS, Framer Motion (animations).
- **Backend/Auth**: Supabase (Database, Auth, Storage) + Clerk/MSAL (Azure AD Integration).
- **Data Sources**: Supabase (Core Data) and Microsoft SharePoint (Business Logic Data).
- **State Management**: React Hooks + Context API.

---

## 🔐 Authentication & RBAC
The system uses a hybrid model of Microsoft Azure AD (via MSAL) and Supabase RBAC.

### Core Tables
1. **`roles`**: Defines system roles and JSON-based permissions.
2. **`user_roles`**: Links users to roles and divisions.
3. **`divisions`**: Organizational units (Executive, Corporate, Licensing, Legal, Research, Secretariat).
4. **`user_login_log`**: Audit trail for logins.

### Permission Patterns
- Permissions are stored as JSON: `{ "resource": ["action"] }`.
- Special Wildcard: `"*"` grants all actions.
- Super Admin Token: `"all": ["*"]`.
- **Primary Hook**: `useRoleBasedAuth` (`src/hooks/useRoleBasedAuth.ts`).

---

## 🏢 Division-Based Access Control
Data is filtered globally based on the user's selected division.

- **Storage**: Division IDs are `VARCHAR` (e.g., `executive-division`).
- **RLS**: Supabase policies use `get_user_division_ids(auth.jwt() ->> 'email')` to filter table rows.
- **UI Filtering**: Many components use `useDivisionContext` to filter lists (e.g., Contacts, Tasks).
- **Primary Component**: `DivisionProtectedRoute` handles route-level restriction.

---

## 📊 Business Logic Modules

### 2. UI Standardization Strategy (2026-03)
The application is undergoing a transition to a "Premium Glassmorphic" design system.
- **Standard**: All data tables and registries must use the `PremiumTable` suite.
- **Components**: `PremiumTable`, `PremiumTableHeader`, `PremiumTableBody`, `PremiumTableRow`, `PremiumTableCell`.
- **Location**: `src/components/ui/PremiumTable.tsx`.
- **Philosophy**: Minimize ad-hoc CSS; use standard tokens for glassmorphism, maroon branding, and sticky layouts.

### 2. Staff Data — Single Source of Truth (updated 2026-03-08)
All pages that show staff rosters (Profiles, Contacts, Unit, Division) now read from the **`Strategy_Officer_Profiles` SharePoint list** via `useOfficerProfiles`.

- **Primary hook**: `useOfficerProfiles` (React Query, 5-min cache) — fetches from SharePoint.
- **Consumers**: `useStaffByDepartment` → `TasksTab`/`ProjectsTab`/`KRAsTab` assignee dropdowns; `useDivisionData.staff` → `DivisionUnitsTab` cards; `Unit.tsx derivedUnits`; `StaffMetricsTab`; `useDivisionStaff`.
- **Fallback**: `src/utils/divisionStaffMap.ts` (static file) — used only when SharePoint is unavailable. Do NOT update this file for staff changes; update SharePoint instead.
- **Field mapping**: `OfficerProfile.unit` → `department`; `OfficerProfile.division` → `officeLocation`. See `STAFF_DATA_LIVE_REFACTOR.md` for full mapping table.

### 3. Division Management (`/division`, `/division/:divisionId`)
- **Position**: Sits between Strategy (org-wide) and Unit (team-level) in the hierarchy.
- **Page**: `src/pages/Division.tsx` — 6 tabs: Overview, Units, Work Plans, Reports, Analytics, Settings.
- **Data Hook**: `useDivisionData(divisionId?)` composes all existing SharePoint hooks with `scope='Division'`. No new API calls.
- **Metrics Hook**: `useDivisionMetrics(data)` — pure computation, no API calls. Returns stats, RAG scores, and `UnitComparisonData[]`.
- **Types**: `src/types/division.types.ts`.
- **Components**: `src/components/division/` — header, 6 tab components, overview sub-components.
- **Work Plans**: Currently front-end only with demo data. SharePoint list pending. See `DIVISION_MODULE_IMPLEMENTATION.md` for backend spec.
- **RAG Thresholds**: Green ≥ 70, Amber ≥ 40, Red < 40 (consistent with Unit page).
- **Settings**: Persisted to `localStorage` under key `'division_settings'`.

#### Units Tab — 3 View Modes (added 2026-03-06)
The Units tab (`DivisionUnitsTab`) supports three view modes toggled by icon buttons in the toolbar:
- **Units** (`Building2`): original unit performance cards (Task %, KRA %, overall score).
- **Officers** (`Users`): contact-style profile cards per staff member — photo, name, title, unit badge, mini stats (tasks/KRAs/KPIs), RAG progress bar. Clicking opens `OfficerProfileModal`.
- **Table** (`List`): full officer stats table with inline progress bars — Tasks, Task %, KRAs, KRA Progress, KPIs, Objectives, Score. Each row opens `OfficerProfileModal`.
- **Stats**: `computeOfficerStats(email, data)` matches tasks/KRAs/KPIs by email across all assignment fields. Returns `OfficerPerformanceStats` (exported from `OfficerProfileModal.tsx`).
- **Photos**: batch-loaded via `useEmployeePhotos.getPhotosForEmails()` when entering officer/table modes.

### 3. Officer Profile Modal (`OfficerProfileModal`)
- **File**: `src/components/strategy/OfficerProfileModal.tsx`
- **Shared by**: Strategy OrgChart, Division Units tab (all 3 view modes).
- **Exported types**: `OfficerProfile`, `OfficerPerformanceStats`.
- **Tab nav**: horizontally scrollable (`overflow-x-auto`, hidden scrollbar), `flex-nowrap`.
- **Overview tab** (shown only when `performance` prop is provided, auto-selected on open):
  - Hero banner: overall score %, RAG badge, weighted breakdown (tasks 50% · KRAs 30% · KPIs 20%).
  - 3 metric cards: Tasks (emerald bar), KRAs (purple bar), KPIs (RAG-coloured bar).
  - Task Breakdown stacked bar: 5 distinct statuses — Completed (emerald), In Review (violet), In Progress (blue), On Hold (orange), To Do (gray).
  - Strategic Contribution: KRAs / KPIs Assigned / Objectives Linked grid + summary list.
- **Backward compat**: callers that don't pass `performance` (e.g. OrgChart) open to the About tab unchanged.

### 4. Analytics & Dashboarding
- Real-time views in Supabase for high-performance chart rendering.
- Custom `useAnalytics` hooks for time-filtered data aggregation.

### 5. AI Assistant Integrations
The intranet features embedded, context-aware AI analysts (Gemini-powered). Data is explicitly serialized from local page hooks (e.g., `useDivisionData`) and injected directly into the API context window to provide 100% accurate, live data answers without relying on complex RAG backends.

Refer to **[AI Assistant Integrations](features/ai-assistant-integrations.md)** for component paths, serialization logic, and architecture details for Division, Strategy, and Regulatory analysts.

---

### 6. Custom User Contacts (added 2026-03-28 08:00 PM)
Allows users to manage private contacts stored in SharePoint, isolated by `OwnerEmail`.

- **Primary Hook**: `useSharePointCustomContacts` — Handles CRUD operations for the logged-in user.
- **Setup Service**: `SharePointListSetupService.createCustomContactsList()` — Programmatically provisions the `User_Custom_Contacts` list.
- **UI Tab**: "My Contacts" in `Contacts.tsx`.
- **Isolation**: Filters by `fields/OwnerEmail eq '{userEmail}'`.

---

## 📂 Documentation Map (Spokes)
| Document | Purpose |
| :--- | :--- |
| [AUTH.md](guides/auth.md) | Deep dive into Azure AD + Supabase integration. |
| [SHAREPOINT.md](guides/sharepoint.md) | Schema and Power Automate flow documentation. |
| [CONTACTS.md](features/contacts.md) | **Detailed guide for the Custom Contacts feature.** |
| [CUSTOM_CONTACT_SCHEMA.md](database/user-custom-contacts-schema.md) | **Database schema for the User_Custom_Contacts list.** |
| [UI_PATTERNS.md](guides/ui_patterns.md) | Shared design tokens, modal patterns, and Tailwind rules. |
| [HISTORY_MAP.md](ARCHIVE_MAP.md) | Index of 100+ archived implementation/fix logs. |
