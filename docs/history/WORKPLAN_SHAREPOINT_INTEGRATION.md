# Division WorkPlan → SharePoint Integration

**Date:** March 15, 2026
**Scope:** Connect Division WorkPlans to the real KRA/KPI/Objective chain so progress flows from Unit pages up to the Strategy Hub.

---

## Problem

Division managers could create WorkPlans with goals and activities, but these lived entirely in **browser localStorage** — they never became real items in SharePoint. This meant:

- Unit staff never saw assigned work from the WorkPlan
- WorkPlan progress was self-calculated from row statuses, completely isolated from the real KRA/KPI progress chain
- The Strategy Hub had no visibility into division-level planning
- Data was lost if the browser cache was cleared
- Two parallel progress systems existed that never connected

## Solution

**Principle:** WorkPlan activation CREATES real Objectives, KRAs, and KPIs in SharePoint. The existing cascade (`Tasks → KPIs → KRAs → Objectives → Strategy Hub`) handles all progress rollup automatically. No changes needed to Unit page or Strategy Hub.

### Architecture

```
Division Manager (WorkPlan)                    Unit Staff (Unit Page)
─────────────────────────────                  ──────────────────────

1. Creates WorkPlan
2. Links to Strategic Objective
3. Adds Goal → creates Unit Objective ─────→  Sees objective on their page
4. Adds Activity → creates KRA ────────────→  Sees KRA assigned to them
5. Adds KPI on Activity → creates KPI ─────→  Sees KPI with target
                                               6. Updates KPI actual/checklist
                                               7. Completes tasks
                                                        │
        ┌───────────────────────────────────────────────┘
        ↓
8. WorkPlan shows real progress (from KPIs)
9. Division Overview shows aggregated metrics
10. Strategy Hub shows everything rolled up
```

### Data Flow

```
WorkPlan Goal
  → Unit Objective (Unit_Objectives list)
    - GoalType: 'Unit'
    - ParentGoalIdLookupId → Strategic Objective
    - Division / Unit fields set

WorkPlan Activity
  → KRA (Performance_KRAs list)
    - UnitObjectiveLookupId → the Goal's Objective
    - Unit / Division / Owner fields set

Activity KPI Description
  → KPI (Performance_KPIs list)
    - RelatedKRALookupId → the Activity's KRA
    - Target: 100, Metric: '%'
```

---

## Files Modified

### 1. `src/services/sharePointOpsService.ts`

**Added to `OPS_CONFIG.LISTS`:**
```typescript
WORKPLANS: 'Division_WorkPlans'
```

**New CRUD methods:**
- `getWorkPlans(divisionId)` — Fetches all work plans for a division, filtered by `DivisionId`
- `addWorkPlan(plan)` — Creates a new work plan in SharePoint
- `updateWorkPlan(id, plan)` — Updates an existing work plan (PATCH then GET pattern)
- `deleteWorkPlan(id)` — Deletes a work plan

**New cascade methods:**
- `activateWorkPlan(plan)` — The core method. For each goal/activity:
  1. Creates a Unit Objective via `addObjective()` (if `!goal.linkedObjectiveId`)
  2. Creates a KRA via `addKRA()` (if `!activity.linkedKraId`)
  3. Creates a KPI via `addKPI()` (if `activity.kpiDescription && !activity.linkedKpiId`)
  4. Stores the returned SharePoint IDs back on the plan's `GoalsJSON`
  5. Updates the plan status to `'active'`
  - **Idempotent:** Checks linked IDs before creating — safe to call multiple times

- `syncWorkPlanToSharePoint(plan)` — For editing already-activated plans:
  - Items with linked IDs → `updateObjective` / `updateKRA` / `updateKPI`
  - Items without linked IDs (newly added) → creates them like activation

**New helper methods:**
- `buildWorkPlanFields(plan)` — Constructs SharePoint field payload from WorkPlan object
- `mapWorkPlan(item)` — Maps SharePoint list item to typed `WorkPlan` (parses `GoalsJSON`)

### 2. `src/hooks/useWorkPlans.ts`

**Full rewrite** — replaced localStorage with React Query + SharePoint.

**Query key:** `['sharePoint', 'workplans', divisionId]`

**Exposed methods:**
- `workPlans` — Array of WorkPlan objects (from SharePoint)
- `loading` — React Query loading state
- `addWorkPlan(plan)` — Creates in SharePoint, optimistic cache update
- `updateWorkPlan(id, updates)` — Updates in SharePoint, optimistic cache update
- `deleteWorkPlan(id)` — Deletes from SharePoint, optimistic cache update
- `activateWorkPlan(plan)` — Calls `service.activateWorkPlan()`, then invalidates `objectives`, `kras`, `kpis` caches so Unit page and Strategy Hub see new items immediately
- `syncWorkPlan(plan)` — Calls `service.syncWorkPlanToSharePoint()`, invalidates dependent caches
- `getWorkPlan(id)` — Finds a plan by ID from cache

**localStorage migration:** On first query, if SharePoint returns 0 plans but localStorage has data, it migrates them to SharePoint and clears localStorage. One-time, transparent to user.

### 3. `src/pages/WorkPlanBuilderPage.tsx`

**`handleSave` is now async** with branching logic:

| Scenario | Action |
|----------|--------|
| New plan, status = `'active'` | `addWorkPlan` as draft → `activateWorkPlan` |
| Existing draft → `'active'` | `updateWorkPlan` → `activateWorkPlan` |
| Existing active → still active | `syncWorkPlan` (updates linked items) |
| Draft → stays draft | `updateWorkPlan` only |

**New state:** `saving` boolean passed to `WorkPlanBuilder` to disable buttons during async operations.

### 4. `src/components/division/workplan/WorkPlanBuilder.tsx`

- `onSave` prop type changed to `(plan: WorkPlan) => void | Promise<void>`
- New `saving?: boolean` prop
- Save Draft button: disabled during save, shows "Saving..."
- Save & Activate button: disabled during save, shows "Activating..."
- Both top-bar and bottom-bar save buttons updated

### 5. `src/components/division/tabs/DivisionWorkPlansTab.tsx`

**Added `enrichedPlans` useMemo** — for active plans, cross-references:
- `goal.linkedObjectiveId` → `data.objectives` (fetched by `useDivisionData`)
- `activity.linkedKraId` → `data.combinedKras`

Overrides `goal.progress`, `activity.progress`, and `plan.overallProgress` with live values from SharePoint. No extra API calls needed — uses data already fetched by the division page.

Draft plans continue showing self-calculated progress (unchanged).

### 6. `src/pages/TestGround.tsx`

**Added "Create Division_WorkPlans List" button** that:
1. Creates the `Division_WorkPlans` SharePoint list (or skips if exists)
2. Adds all 21 columns (text, multiline, choice, number, dateTime)
3. Skips columns that already exist (safe to click multiple times)
4. Resets the service cache so the app picks up the new list

---

## SharePoint List: `Division_WorkPlans`

### Columns

| Column | Type | Notes |
|--------|------|-------|
| `Title` | Single line text | Built-in, work plan title |
| `Description` | Multi-line text | Short description |
| `DivisionId` | Single line text | Division identifier for filtering |
| `DivisionName` | Single line text | Human-readable division name |
| `Status` | Choice | `draft`, `active`, `completed`, `archived` |
| `TimePeriod` | Choice | `Q1`–`Q4`, `H1`, `H2`, `annual`, `custom` |
| `Year` | Number | Fiscal year |
| `StartDate` | DateTime | Plan start date |
| `EndDate` | DateTime | Plan end date |
| `GoalsJSON` | Multi-line text | JSON blob storing full `WorkPlanGoal[]` array including linked IDs |
| `LinkedStrategicObjectiveId` | Single line text | ID of linked strategic objective |
| `LinkedStrategicObjectiveTitle` | Single line text | Title of linked strategic objective |
| `Organization` | Single line text | Organization name |
| `PreparedBy` | Single line text | Who prepared the plan |
| `PlanningPeriodLabel` | Single line text | Display label for planning period |
| `Mandate` | Multi-line text | Division mandate text |
| `MonitoringAndReporting` | Multi-line text | M&R description |
| `ReviewFrequency` | Single line text | How often the plan is reviewed |
| `ReportingTo` | Single line text | Who the plan reports to |
| `OverallProgress` | Number | Calculated progress (0-100) |
| `CreatedByName` | Single line text | Creator's display name |
| `CreatedByEmail` | Single line text | Creator's email |

### Design Decision: GoalsJSON

Goals, activities, and their linked IDs are stored as a single JSON blob rather than separate SharePoint lists. This avoids:
- 2 extra SharePoint lists (WorkPlan_Goals, WorkPlan_Activities)
- Complex multi-list joins via Graph API
- Pagination issues on nested queries

Trade-off: Cannot query individual goals/activities server-side. Not needed — they are always read/written as a unit with the parent plan.

---

## What Did NOT Change

| Component | Why |
|-----------|-----|
| **Unit page** (`Unit.tsx`) | Created items are real SharePoint entries with correct Division/Unit fields — they appear automatically via existing queries |
| **Strategy Hub** (`Strategy.tsx`) | `calculateGoalProgressFromChildren()` already reads from Unit Objectives linked via `ParentGoalIdLookupId` |
| **Progress utils** (`kpiUtils.ts`) | Already calculates KPI→KRA→Objective progress live |
| **Analytics** (`strategyAnalyticsUtils.ts`) | Already aggregates by division from real SharePoint data |
| **Type definitions** (`division.types.ts`) | `linkedObjectiveId`, `linkedKraId`, `linkedKpiId` already existed on the types |

---

## Testing Checklist

1. **Test Ground:** Click "Create Division_WorkPlans List" → verify list and columns created in SharePoint
2. **Draft save:** Create a WorkPlan as draft → verify it appears in SharePoint `Division_WorkPlans` list → verify NO new objectives/KRAs/KPIs created
3. **Activation:** Activate the draft → verify Unit Objectives created with correct `ParentGoalIdLookupId` → verify KRAs created with correct `UnitObjectiveLookupId` → verify KPIs created with correct `RelatedKRALookupId`
4. **Unit page:** Navigate to the assigned unit → verify the new KRAs/KPIs appear in the KRAs tab
5. **Progress flow:** Complete a KPI on the Unit page → verify KRA progress updates → verify Objective progress updates → verify WorkPlan detail view shows updated progress → verify Strategy Hub reflects the change
6. **Edit after activation:** Edit an activated plan (change activity title) → verify the linked KRA title updates in SharePoint
7. **Idempotency:** Activate the same plan twice → verify no duplicate items created
8. **Migration:** If localStorage has demo plans from before this change, they should auto-migrate to SharePoint on first load
