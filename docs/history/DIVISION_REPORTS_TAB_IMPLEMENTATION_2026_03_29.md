# Division Reports Tab — Full Implementation & System Investigation
**Date:** 2026-03-29

---

## Overview

This session covered two major activities:

1. **Full system investigation** of the existing Reports feature in the Unit (Task Registry) page — from SharePoint data, to React UI, to the Power Automate flow definition and TestGround deployment panel.
2. **Implementation** of a fully feature-equivalent Reports tab for the Division page, bringing it to parity with the Unit's Reports tab.

---

## Part 1 — Reports System Investigation (Unit / Task Registry)

### What Was Investigated

A complete end-to-end audit of the Reports system was performed across all layers.

---

### 1.1 UI Layer — `ReportsTab` Component

**File:** `src/components/unit-tabs/ReportsTab.tsx`

Three collapsible cards:

| Card | Purpose |
|------|---------|
| **Report Generator** | On-demand report — select time period + data categories, computes metrics locally from SharePoint data, renders preview with CSV / print export |
| **Schedule Recurring Reports** | Per-user schedule saved to `Report_Schedules` SharePoint list. Configures frequency, preferred time, day, categories, optional manager CC. Supports all 7 period types including custom one-time and rolling windows |
| **Manage Report Schedules** | Admin-only collapsible table — view, edit, delete all org-wide schedules |

**Schedule periods supported:** `daily`, `weekly`, `monthly`, `quarterly`, `half-yearly`, `yearly`, `custom`

**Custom period modes:**
- **One-Time** — fixed start/end date range, auto-deactivates after sending
- **Rolling Window** — sends every N days covering the last N days

**State managed locally:**
- All schedule fields (period, time, day, day-of-month, categories, manager email)
- Custom date range fields (start, end, rolling window days, interval days, one-time toggle)
- Admin panel state (all schedules list, editing context, deletion tracking)

---

### 1.2 SharePoint Data Layer — `Report_Schedules` List

**Queried via:** `SharePointOpsService` (`src/services/sharePointOpsService.ts`)

**List columns:**

| Column | Type | Notes |
|--------|------|-------|
| Title | Text | User display name |
| UserEmail | Text | e.g., `user@scpng.gov.pg` |
| Division | Text | e.g., `Corporate Services Division` |
| Unit | Text | e.g., `IT Unit` |
| TimePeriod | Text | `daily` / `weekly` / `monthly` / `quarterly` / `half-yearly` / `yearly` / `custom` |
| Categories | Text (JSON) | `["tasks","kras","kpis","objectives"]` |
| IsActive | Text | `"true"` or `"false"` |
| PreferredTime | Text | `"07:00"` |
| PreferredDay | Text | For weekly — e.g., `"Monday"` |
| PreferredDayOfMonth | Text | For monthly+ — e.g., `"15"` |
| LastSentAt | DateTime | Timestamp of last send |
| NextSendAt | DateTime | Timestamp of next scheduled send |
| ManagerEmail | Text | Optional CC |
| CustomStartDate | DateTime | Custom one-time: range start |
| CustomEndDate | DateTime | Custom one-time: range end |
| IsOneTime | Text | `"true"` = fire once then deactivate |
| RollingWindowDays | Text | Days back to include for rolling window |
| CustomIntervalDays | Text | Recurrence interval for rolling window |

**Service methods:**
- `getReportSchedule(userEmail)` — fetch user's existing row
- `saveReportSchedule(...)` — create or update, auto-computes `NextSendAt`
- `getAllReportSchedules()` — admin: all org schedules
- `deleteReportSchedule(itemId)` — remove row
- `createReportSchedulesList()` — one-time provisioning (called from TestGround)

---

### 1.3 Power Automate Flow

**Flow name:** `SCPNG Intranet — Scheduled Report Dispatcher`
**Owner account:** `automation@scpng.gov.pg`
**Environment ID:** `Default-b173aac7-6781-4d49-a037-d874bd4a09ab`
**Trigger:** Daily recurrence at hours `6, 7, 8, 9, 10, 12, 14, 16, 17` (Pacific/Port_Moresby timezone)

**Action chain** (`src/services/powerAutomate/flowActions.ts`):

```
Get_Active_Schedules  ─┐  (parallel)
Get_Gemini_API_Key    ─┘
        ↓
Filter_Due_Schedules (NextSendAt <= utcNow())
        ↓
Process_Each_User (foreach)
├── Get_Tasks / Get_KRAs / Get_KPIs / Get_Objectives
├── Compute_Custom_Start / Compute_Custom_End
├── Filter_Tasks/KRAs/KPIs_InDateRange  (custom period only)
├── Compute_Base_Tasks/KRAs/KPIs        (branches: custom vs standard)
├── Filter_Completed/InProgress/Todo/Review_Tasks
├── Filter_Active/Completed_KRAs
├── Filter_OnTrack/AtRisk/Behind_KPIs
├── Select_Task_HTML + Build_Task_List_HTML
├── Compute_Period_Label                (Q1/Q2/H1/H2/year/etc.)
├── Select_AI_Instructions             (period-specific prompt context)
├── Build_Snapshot_AI_Prompt / Build_Custom_AI_Prompt
├── Build_AI_Prompt                    (selector: custom vs snapshot)
├── Call_Gemini_API                    (gemini-2.0-flash)
├── Extract_AI_Response
├── Build_Snapshot_Email / Build_Custom_Email
├── Build_Email_Body                   (selector)
├── Send_Report_Email                  (Office365 SendEmailV2)
├── Calculate_Next_Send                (or "DEACTIVATE" for one-time custom)
└── Update_Schedule                    (LastSentAt, NextSendAt, IsActive)
```

**Email template variants (period-specific HTML):**

| Period | Style |
|--------|-------|
| Daily | Compact task-log with status table |
| Weekly | Date-range header, productivity metrics |
| Monthly | Month badge, comprehensive metrics |
| Quarterly | Q1/Q2/Q3/Q4 badge, elevated styling |
| Half-Yearly | H1/H2 badge, trajectory analysis, uppercase header |
| Yearly | Gold accent `#d4af37`, Annual Executive Assessment, legacy statement |
| Custom | Date-range badge, blue accent `#0052cc`, one-time or rolling window |

**AI integration:**
- Gemini API key fetched at runtime from `InternalAppSettings` SharePoint list
- Period-specific prompts produce 3–8 strategic insights per email
- AI call is fault-tolerant: `Extract_AI_Response` runs on `Succeeded`, `Failed`, or `TimedOut`

---

### 1.4 Power Automate Service Layer

**Files:**

| File | Role |
|------|------|
| `src/services/powerAutomateService.ts` | Facade — orchestrates auth, client, connection manager |
| `src/services/powerAutomate/config.ts` | Environment ID, API URLs, flow name, OAuth scopes |
| `src/services/powerAutomate/auth.ts` | MSAL token acquisition for Flow and PowerApps scopes |
| `src/services/powerAutomate/flowClient.ts` | HTTP calls to Flow Management API |
| `src/services/powerAutomate/connectionManager.ts` | Discovers SharePoint + O365 connection IDs from PowerApps API |
| `src/services/powerAutomate/flowActions.ts` | Full Logic Apps JSON definition builder |
| `src/services/powerAutomate/templates/snapshotEmail.ts` | HTML email for all standard periods |
| `src/services/powerAutomate/templates/customEmail.ts` | HTML email for custom date-range reports |
| `src/services/powerAutomate/templates/aiPrompts.ts` | Period-specific Gemini AI prompt expressions |

**`deployReportSchedulerFlow()` logic:**
1. Checks if flow named `SCPNG Intranet — Scheduled Report Dispatcher` already exists → returns early if found (delete first to redeploy)
2. Discovers SharePoint + O365 connection IDs via PowerApps API
3. Calls `buildReportSchedulerDefinition(connections)` to produce the Logic Apps JSON
4. POSTs to `api.flow.microsoft.com` to create the flow

---

### 1.5 TestGround Deployment Panel

**File:** `src/pages/TestGround.tsx` (lines ~3820–3960)

Two report-related admin cards:

**Card 1 — Initialize Report Schedules List** (pink border)
- Button: `handleSetupReportSchedulesList()`
- Calls `opsService.createReportSchedulesList()` to provision the `Report_Schedules` SharePoint list + all custom columns

**Card 2 — Power Automate Report Scheduler Flow** (violet border)
- **Check Connections** → `handleListConnections()` — lists active SharePoint + O365 connections (console output)
- **List Flows** → `handleListFlows()` — lists all deployed flows in the environment
- **Inspect Flow** → `handleInspectFlow()` — logs full flow JSON + connectionReferences to browser console
- **Delete Flow** → `handleDeleteReportFlow()` — removes the existing flow (required before redeploy)
- **Deploy Report Scheduler Flow** → `handleDeployReportFlow()` — calls `PowerAutomateService.deployReportSchedulerFlow()`

**Deployment order (fresh environment):**
1. TestGround → **Initialize Report Schedules List** — creates list + all columns
2. TestGround → **Check Connections** — verify SharePoint + O365 connections exist
3. TestGround → **Deploy Report Scheduler Flow** — creates the Power Automate flow
4. Users → Unit → Reports tab → configure schedule → saved to `Report_Schedules`
5. Flow runs daily at each hour, picks up due schedules, sends AI-enhanced emails, updates `NextSendAt`

---

### 1.6 Unit Page Integration

**File:** `src/pages/Unit.tsx`

```tsx
<TabsContent value="reports">
  <ReportsTab
    tasks={taskState.data || []}
    kras={(kraState.data || []) as any}
    kpis={(kpiState.data || []) as any}
    objectives={objectivesData || []}
    userContext={userContext}
  />
</TabsContent>
```

All data is loaded by `Unit.tsx` from SharePoint via React Query hooks and passed down as props.

---

## Part 2 — Division Reports Tab Implementation

### What Was Done

The `DivisionReportsTab` component was rewritten to add full scheduling feature parity with the Unit's `ReportsTab`.

**File changed:** `src/components/division/tabs/DivisionReportsTab.tsx`

---

### 2.1 What Existed Before

The Division Reports tab had only:
- Basic report generator (Time Period, Scope Level, Report Type selectors)
- Generated report preview using `DivisionMetrics`
- In-session report history (click to re-view)

**Missing:** Schedule Recurring Reports card, Manage Report Schedules card, all scheduling logic.

---

### 2.2 What Was Added

#### New imports
```tsx
import { useEffect } from 'react';                          // for schedule load on mount
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Bell, Save, Mail, Pencil, Trash2,
         ChevronDown, ChevronUp, Info, RotateCw } from 'lucide-react';
import { ReportDataCategory } from '@/types/division.types';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { SharePointOpsService } from '@/services/sharePointOpsService';
import { toast } from 'sonner';
import useRoleBasedAuth from '@/hooks/useRoleBasedAuth';
```

#### New constants
- `ALL_CATEGORIES` — `tasks`, `kras`, `kpis`, `objectives` with labels
- `TIME_PERIOD_OPTIONS` — all 7 periods including custom
- `TIME_OPTIONS` — 6 AM to 5 PM hourly options
- `DAY_OPTIONS`, `DAY_OF_MONTH_OPTIONS`

#### New state (mirroring Unit's ReportsTab)
```tsx
// Schedule form
const [isScheduleExpanded, setIsScheduleExpanded]
const [scheduleActive, setScheduleActive]
const [schedulePeriod, setSchedulePeriod]
const [scheduleCategories, setScheduleCategories]
const [scheduleTime, setScheduleTime]
const [scheduleDay, setScheduleDay]
const [scheduleDayOfMonth, setScheduleDayOfMonth]
const [scheduleSaving, setScheduleSaving]
const [scheduleLoading, setScheduleLoading]
const [scheduleNextSend, setScheduleNextSend]
const [scheduleManagerEmail, setScheduleManagerEmail]

// Custom date range
const [customStartDate, setCustomStartDate]
const [customEndDate, setCustomEndDate]
const [isOneTime, setIsOneTime]
const [rollingWindowDays, setRollingWindowDays]
const [customIntervalDays, setCustomIntervalDays]

// Manage schedules admin panel
const [allSchedules, setAllSchedules]
const [schedulesLoading, setSchedulesLoading]
const [schedulesExpanded, setSchedulesExpanded]
const [deletingId, setDeletingId]
const [editingScheduleId, setEditingScheduleId]
const [editingScheduleEmail, setEditingScheduleEmail]
const [editingScheduleName, setEditingScheduleName]
```

#### New handlers
- `loadSchedule()` — `useEffect` on mount: loads user's existing schedule from `Report_Schedules`
- `handleSaveSchedule()` — saves/updates the schedule; Division-specific: stores `division = data.division?.name`, `unit = data.division?.name`
- `loadAllSchedules()` — fetches all org-wide schedules (admin management panel)
- `handleDeleteSchedule(itemId, userName)` — removes a schedule with confirmation
- `handleEditSchedule(schedule)` — populates the schedule form with an existing schedule's data, scrolls to the form
- `toggleScheduleCategory(key)` — checkbox toggle for report categories

#### Updated UI

1. **Report Generator card** — made collapsible (click header to expand/collapse), identical pattern to Unit version. Period options expanded to all 7 (was 4).

2. **Schedule Recurring Reports card** (new)
   - Toggle switch in header (Active/Inactive)
   - Frequency selector (all 7 periods)
   - Preferred Time selector (conditional — hidden for custom period)
   - Day of Week selector (weekly only)
   - Day of Month selector (monthly, quarterly, half-yearly, yearly)
   - Custom Date Range sub-section:
     - One-Time / Rolling Window tab toggle
     - One-time: Start Date + End Date pickers + amber info banner
     - Rolling Window: window days + interval days inputs + info banner
   - Report Categories checkboxes
   - CC Manager Email input (optional)
   - Save Schedule button (default style when active, outline when inactive)

3. **Manage Report Schedules card** (new)
   - Lazy-loads on first expand
   - Table columns: User, Unit/Division, Frequency, Time, Status, Next Send, Actions
   - Edit button → populates schedule form, scrolls to it
   - Delete button → confirmation prompt, removes row

---

### 2.3 Division-Specific Differences vs Unit

| Aspect | Unit ReportsTab | Division ReportsTab |
|--------|----------------|---------------------|
| Data source | `tasks[]`, `kras[]`, `kpis[]`, `objectives[]` raw arrays | `DivisionMetrics` (pre-aggregated) + `DivisionMetrics.unitComparisons[]` |
| Report preview | Computes metrics locally from filtered arrays | Uses `DivisionMetrics` directly |
| Scope selector | Fixed to `unit` | `division`, `unit`, `individual` |
| Report types | Fixed to `operations` | `operations`, `performance`, `strategic` |
| Schedule unit field | `userContext.unit` | `data.division?.name` |
| `isAdmin` check | Used for "Copy List Metadata" button | Imported but available for future use |
| Card accent colour | `text-intranet-primary` | `text-[#83002A]` (explicit hex, consistent with existing Division styling) |
| Manage schedules — Unit column label | "Unit" | "Unit / Division" |
| Schedule form anchor id | `schedule-form-card` | `div-schedule-form-card` |

---

### 2.4 Division Page Integration

**File:** `src/pages/Division.tsx` — no changes required.

The `DivisionReportsTab` already receives `data` (type `UseDivisionDataReturn`) and `metrics` (type `DivisionMetrics`). `userContext` is accessed via `data.userContext` inside the component.

```tsx
// Division.tsx — unchanged
<TabsContent value="reports">
  <DivisionReportsTab data={divisionData} metrics={metrics} />
</TabsContent>
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/division/tabs/DivisionReportsTab.tsx` | Full rewrite — added scheduling, manage schedules, collapsible generator, all new imports/state/handlers |

## Files Unchanged (referenced for investigation only)

| File | Purpose |
|------|---------|
| `src/components/unit-tabs/ReportsTab.tsx` | Source of scheduling implementation patterns |
| `src/services/sharePointOpsService.ts` | `Report_Schedules` CRUD methods |
| `src/services/powerAutomateService.ts` | Flow deployment facade |
| `src/services/powerAutomate/flowActions.ts` | Logic Apps JSON definition |
| `src/services/powerAutomate/config.ts` | Environment + API config |
| `src/services/powerAutomate/templates/` | Email HTML + AI prompt templates |
| `src/pages/TestGround.tsx` | Admin deployment panel (no changes) |
| `src/pages/Division.tsx` | Division page router (no changes) |
| `src/hooks/useDivisionData.ts` | Division data hook (no changes) |
| `src/types/division.types.ts` | `DivisionMetrics`, `ReportConfig`, `ReportDataCategory` etc. (no changes) |
