# Division Module Implementation
**Date:** March 06, 2026

## Overview
Built a full **Divisional Management Module** — a new page and component hierarchy that sits hierarchically between the org-wide **Strategy** page and the team-level **Unit** page. Directors and divisional managers can now view a consolidated performance dashboard, manage work plans, generate reports, and access AI-driven analytics scoped to their division.

---

## Architecture

### Route
```
/division               → Auto-resolves user's own division (from profile)
/division/:divisionId   → View a specific division (admins/directors)
```
Both wrapped in `RoleProtectedRoute` with `{ resource: 'divisions', action: 'read' }`.

### Nav Item
`Building2` icon added to `mainNavItems` in `src/config/navItems.ts`, positioned after "Unit".

### Hierarchy Position
```
Strategy (org-wide) → Division (division-wide) → Unit (team-level)
```

---

## New Files Created

### Types
| File | Purpose |
|------|---------|
| `src/types/division.types.ts` | All TypeScript interfaces for the module |

**Key types:** `WorkPlan`, `WorkPlanGoal`, `WorkPlanActivity`, `WorkPlanStatus`, `WorkPlanTimePeriod`, `ReportConfig`, `GeneratedReport`, `ReportSection`, `AIInsight`, `InsightCategory`, `InsightSeverity`, `PredictionData`, `BottleneckData`, `UnitComparisonData`, `DivisionMetrics`, `RAGStatus`, `RAGMetric`, `DivisionSettingsConfig`

### Hooks
| File | Purpose |
|------|---------|
| `src/hooks/useDivisionData.ts` | Composes existing SharePoint hooks with `scope='Division'` |
| `src/hooks/useDivisionMetrics.ts` | Pure computation hook — no API calls |

**`useDivisionData` design pattern:** Composes `useSharePointTasks`, `useSharePointKRAs`, `useSharePointKPIs`, `useSharePointObjectives`, `useSharePointProjects` — all called with `scope='Division'`. Resolves `DivisionInfo` from `DivisionStaffMap` and `staticDivisions`. Exports `UseDivisionDataReturn` with: `division`, `userContext`, `tasks`, `projects`, `kras`, `kpis`, `objectives`, `combinedKras`, `staff`, `loading`, `error`, `canEditStrategy`, `canViewStaffMetrics`, `refresh`.

**`useDivisionMetrics` design pattern:** Takes `UseDivisionDataReturn`, returns `DivisionMetrics` with computed stats, RAG scores, and per-unit comparisons. `unitComparisons: UnitComparisonData[]` built by filtering tasks/KRAs per unit name from staff map.

### Page Shell
| File | Purpose |
|------|---------|
| `src/pages/Division.tsx` | Main entry — mirrors `Unit.tsx` pattern exactly |

Features: `useParams<{ divisionId?: string }>()`, 6-tab layout, loading skeleton (stat card + RAG panel skeletons), "Division not found" empty state with `AlertTriangle`, `TabsList` with `overflow-x-auto flex-nowrap` for mobile.

### Components — Header
| File | Purpose |
|------|---------|
| `src/components/division/DivisionHeader.tsx` | Maroon gradient banner with division name, director, staff count, unit count, division code badge; quick stats (task completion %, KPI on track %, overall performance %) on the right |

### Components — Overview Tab
| File | Purpose |
|------|---------|
| `src/components/division/tabs/DivisionOverviewTab.tsx` | Assembles all 4 overview zones |
| `src/components/division/overview/DivisionStatsRow.tsx` | 6 stat cards: Total Tasks, Active KRAs, KPI On Track, Active Projects, Staff, Strategic Alignment |
| `src/components/division/overview/DivisionTrafficLightPanel.tsx` | 4 RAG cards: Strategic Alignment, Operational Health, Project Delivery, Staff Performance |
| `src/components/division/overview/DivisionPerformanceTrends.tsx` | Recharts `LineChart` using `calculateTaskTrends(tasks, 6)` — two series: Completed (green) and Added (maroon) |
| `src/components/division/overview/DivisionUnitComparison.tsx` | Recharts horizontal `BarChart` comparing units by Task Completion % and KRA Progress % |
| `src/components/division/overview/DivisionObjectivesAlignment.tsx` | Groups KRAs by linked objective, shows objective → KRA cascade with progress bars |

### Components — Units Tab
| File | Purpose |
|------|---------|
| `src/components/division/tabs/DivisionUnitsTab.tsx` | Unit comparison grid + drill-down modal + staff roster |

Sub-components (inline):
- `UnitPerformanceCard`: RAG-colored left border, task completion + KRA progress bars, overall score
- `StaffRoster`: Table filtered by `unitName`, shows Avatar + name + title + email
- Drill-down `Dialog`: quick stats grid (3 cards) + staff roster + "Open Unit Page" nav button

### Components — Work Plans Tab
| File | Purpose |
|------|---------|
| `src/components/division/tabs/DivisionWorkPlansTab.tsx` | Work plan list, cascade tree, Gantt timeline, creation wizard |

Sub-components (inline):
- `WorkPlanCard`: Status badge, progress bar, date range, linked objective
- `CascadeTree`: Collapsible tree — Work Plan → Goals → Activities, color-coded by status
- `WorkPlanTimeline`: Gantt-style bars with time-progress dashed overlay line using Recharts
- `CreateWorkPlanModal`: 3-step local-state wizard (Basic Info → Goals → Review)
- `generateDemoWorkPlans()`: Demo data for initial visualization (no SharePoint list yet)

### Components — Reports Tab
| File | Purpose |
|------|---------|
| `src/components/division/tabs/DivisionReportsTab.tsx` | Report generator + printable preview + export + history |

Features:
- 3 Select dropdowns: Time Period (daily/weekly/monthly/quarterly), Scope Level (individual/unit/division), Report Type
- `ReportPreview`: Maroon header + sections (Executive Summary, Task Performance, KRA & KPI Status, Unit Comparison)
- CSV export via `Blob` + `URL.createObjectURL`
- Print via `window.print()`
- Report history list (last 10, clickable to re-view)

### Components — Analytics Tab
| File | Purpose |
|------|---------|
| `src/components/division/tabs/DivisionAnalyticsTab.tsx` | AI insights + predictive trends + bottleneck detector + efficiency score |

Sub-components (inline):
- `InsightCard`: Category badge, confidence %, title, description, recommendation, dismiss button
- `generateInsights()`: Derives `AIInsight[]` from metrics (overdue tasks, KPI achievement, at-risk KRAs, task completion, strategic alignment) — no external AI call required
- `PredictiveTrends`: Extends `calculateTaskTrends` with 3-month projected dashed line + Recharts `ReferenceLine` "Now" marker
- `BottleneckDetector`: Pipeline visualization — Created → In Progress → Review → Completed, highlights stuck stages
- `EfficiencyScore`: Letter grade (A–F), weighted composite of 4 dimensions with individual progress bars

### Components — Settings Tab
| File | Purpose |
|------|---------|
| `src/components/division/tabs/DivisionSettingsTab.tsx` | Notification + display preferences |

Preferences persisted to `localStorage` under key `'division_settings'`. Includes: Daily Summary, Weekly Digest, Alert on Risk, Alert on Overdue switches; Default Tab and Default Time Period dropdowns; Show AI Insights toggle.

---

## Files Modified

| File | Change |
|------|--------|
| `src/App.tsx` | Added `Division` import + `/division` and `/division/:divisionId` routes |
| `src/config/navItems.ts` | Added `Building2` import + Division nav item after Unit |

---

## Key Design Decisions

### Hook Composition (No Duplication)
Rather than creating new SharePoint query functions, `useDivisionData` composes all existing hooks passing `scope='Division'`. This leverages all existing caching, RBAC filtering, and error handling at zero cost.

### `combinedKras` Pattern
Mirrors the exact KRA + KPI + Objective merging logic from `Unit.tsx` lines 541–584, ensuring consistency across the Unit and Division views.

### Demo Work Plans
Since no SharePoint list for Work Plans exists yet, `generateDemoWorkPlans()` provides realistic demo data. When the SharePoint list is ready, replace this with a proper `useDivisionWorkPlans` hook calling `useSharePointOps`.

### RAG Thresholds
- **Green**: score ≥ 70
- **Amber**: score ≥ 40
- **Red**: score < 40

These match the thresholds used in the Unit page's KRA/KPI visualizations.

### Settings Persistence
Division display/notification preferences are stored in `localStorage` (not SharePoint or Supabase) as they are purely client-side preferences.

---

## Tab Permissions
| Tab | Gated by |
|-----|---------|
| Overview | All authenticated division members |
| Units | All authenticated division members |
| Work Plans | All authenticated division members |
| Reports | All authenticated division members |
| Analytics | All authenticated division members |
| Settings | `canEditStrategy` (Directors/Admins only) |

---

## SharePoint Backend — Pending
The Work Plans feature is currently front-end only with demo data. To complete the backend:
1. Create a `WorkPlans` SharePoint list with columns: `Title`, `Description`, `DivisionId`, `Status`, `TimePeriod`, `StartDate`, `EndDate`, `Goals` (JSON), `LinkedObjectiveId`, `OverallProgress`
2. Create a `WorkPlanActivities` list for activity-level tracking
3. Replace `generateDemoWorkPlans()` in `DivisionWorkPlansTab.tsx` with a `useDivisionWorkPlans(divisionId)` hook using `useSharePointOps`
