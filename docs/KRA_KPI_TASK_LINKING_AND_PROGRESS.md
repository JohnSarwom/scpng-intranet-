# KRA-KPI-Task Linking Logic & Progress Chain

## Document Purpose
This document provides a complete technical reference for the Task-to-KPI-to-KRA-to-Objective progress chain. It covers all changes made across multiple sessions, including the backend sync engine, frontend checklist integration, and dashboard consistency fixes.

**Last Updated:** 2026-02-24

---

## TABLE OF CONTENTS

1. [System Overview](#part-1-system-overview)
2. [Type Definitions & Data Structures](#part-2-type-definitions--data-structures)
3. [Progress Calculation Logic](#part-3-progress-calculation-logic)
4. [Task-to-KPI Checklist Sync Engine (IMPLEMENTED)](#part-4-task-to-kpi-checklist-sync-engine)
5. [Frontend Checklist Integration (IMPLEMENTED)](#part-5-frontend-checklist-integration)
6. [Dashboard Overview Consistency Fixes (IMPLEMENTED)](#part-6-dashboard-overview-consistency-fixes)
7. [Prior Fixes Reference](#part-7-prior-fixes-reference)
8. [SharePoint List Schema](#part-8-sharepoint-list-schema)
9. [Complete File Reference](#part-9-complete-file-reference)
10. [Edge Cases & Testing](#part-10-edge-cases--testing)

---

## PART 1: System Overview

### 1.1 The Full Progress Cascade

The system implements a bottom-up progress chain where daily task completion drives strategic objective progress:

```
Task completed/updated/deleted (Daily Operations)
  |
  v
syncKPIChecklistFromTasks() fires (SharePoint service layer)
  |
  v
KPI checklist items sync with linked tasks
  - New tasks become checklist items (isTaskLinked: true)
  - Completed tasks auto-check their checklist item
  - Deleted/unlinked tasks remove their checklist item
  - Manual checklist items are preserved
  |
  v
All checklist items checked? --> KPI status = "Completed"
  |                               |
  no                              v
  |                         syncKRAProgress() fires
  v                               |
KPI stays at                      v
current status              KRA Progress = (completed KPIs / total KPIs) * 100
                                  |
                                  v
                            calculateStrategicProgress()
                                  |
                                  v
                            Objective Progress = average of linked KRA progress
                                  |
                                  v
                            Dashboard Overview cards & charts update live
```

### 1.2 Reverse Cascade (Task Reopened)

```
Task moved back to "in-progress" or "todo"
  -> syncKPIChecklistFromTasks() fires
    -> Linked checklist item unchecked
      -> KPI status reverts from "Completed" to "In Progress"
        -> syncKRAProgress() recalculates
          -> KRA progress decreases
            -> Objective progress recalculates
```

### 1.3 Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Task-linked + manual checklist items | **Coexist (merged)** | Users can add manual items alongside task-derived items. Keeps flexibility. |
| Distinguish task-derived vs manual items | **`taskId` + `isTaskLinked` fields on ChecklistItem** | Allows identifying which items are auto-synced from tasks vs manually added |
| When to sync task to checklist | **On task save/update/delete in SharePoint service** | Single source of truth, happens regardless of which UI triggers the task change |
| Auto-complete KPI | **When ALL checklist items (both task-derived and manual) are checked** | Consistent behavior -- all work must be done |
| Auto-revert KPI | **When any checklist item is unchecked (and KPI was auto-completed)** | Prevents stale "completed" status |
| KPI calculationType | **Auto-set to 'checklist' when tasks are linked** | Activates checklist-based progress display |
| Dashboard objective progress | **Dynamically calculated from linked KRAs** | Never uses stale stored values; always reflects real-time KPI completion |

---

## PART 2: Type Definitions & Data Structures

### 2.1 ChecklistItem (`src/components/ChecklistSection.tsx`)

```typescript
export interface ChecklistItem {
  id: string;           // Unique identifier (e.g., "item-1709123456" for manual, "task-42" for task-linked)
  text: string;         // Display text (task title for linked items, user text for manual)
  checked: boolean;     // Whether the item is completed
  taskId?: string;      // Links to Operations_Tasks SharePoint item ID (if auto-synced from a task)
  isTaskLinked?: boolean; // Flag to distinguish task-derived items from manual ones
}
```

### 2.2 Kpi (`src/types/index.ts`)

```typescript
export interface Kpi {
  id: string | number;
  kra_id?: string | number | null;   // Links to parent KRA
  name: string;
  description?: string;
  target: number;
  actual?: number;
  startDate?: string;
  targetDate?: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'on-hold' | 'at-risk' | 'on-track' | 'behind';
  comments?: string;
  assignees?: User[];
  progress?: number;
  costAssociated?: number;
  calculationType?: 'manual' | 'checklist';  // KEY: Determines how progress is calculated
  checklist?: ChecklistItem[];                // KEY: Stores checklist items (manual + task-linked)
}
```

### 2.3 Task (`src/types/index.ts`)

```typescript
export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'on-hold' | 'in-review' | 'completed' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee: string;
  assignees?: User[];
  dueDate: string;
  kra_id?: string;     // Links to KRA
  kpi_id?: string;     // Links to KPI (PRIMARY LINKAGE for checklist sync)
  completed?: boolean;
  completionDate?: string;
  subtasks?: { id: string; text: string; completed: boolean }[];
  checklist?: ChecklistItem[];
}
```

### 2.4 KRA (`src/types/index.ts`)

```typescript
export interface KRA {
  id: string;
  title: string;
  objectiveId: string;
  objective_id?: string | number | null;  // Links to parent Objective
  department: string;
  status: 'open' | 'in-progress' | 'closed';
  progress: number;    // Stored in SharePoint; synced by syncKRAProgress()
  kpis: KPI[];
  unitKpis?: Kpi[];    // KPIs fetched separately and attached
  owner?: { id: string; name: string; email: string };
  assignees?: User[];
}
```

---

## PART 3: Progress Calculation Logic

All calculation functions live in `src/utils/kpiUtils.ts`.

### 3.1 KPI Progress (`calculateKpiProgress`)

Used for UI display of individual KPI progress (NOT used for KRA progress).

```
Priority 1: If KPI status is 'completed'/'achieved'/'done' -> return 100%
Priority 2: If calculationType === 'checklist' AND checklist has items:
            -> return (checked items / total items) * 100
Priority 3: If target > 0:
            -> return min(100, (actual / target) * 100)
Default:    -> return 0%
```

### 3.2 KRA Progress (`calculateKraProgress`)

Used by both frontend and backend (SharePoint sync).

```
Priority 1: If KRA status is 'completed'/'closed'/'done' -> return 100%
Priority 2: Filter KPIs belonging to this KRA (by kra_id)
            -> Count KPIs with status 'completed'/'achieved'/'done'
            -> return (completedKPIs / totalKPIs) * 100
Fallback:   If no KPIs found -> return stored kra.progress value
```

**IMPORTANT:** Only KPI *status* affects KRA progress. Target/actual ratios, checklist completion percentages, etc. do NOT affect it. A KPI must be fully "Completed" to count.

### 3.3 Objective Progress (`calculateStrategicProgress`)

```
For each KRA linked to the objective:
  - Calculate its KRA progress (from KPIs if available, else stored value)
Return the average of all linked KRA progress values
```

### 3.4 Objective Status (`calculateObjectiveStatus`)

```
Find all KRAs linked to this objective (via objective_id/objectiveId)
Collect all KPIs from those KRAs
If ALL KPIs have status 'Completed'/'Achieved'/'Done' -> return 'Completed'
Otherwise -> return the objective's existing status
```

### 3.5 Progress Table Summary

| Level | Formula | Source Function |
|-------|---------|----------------|
| **KPI Progress** | Status-based (100%) OR checklist % OR target/actual ratio | `calculateKpiProgress()` |
| **KRA Progress** | `(completed KPIs / total KPIs) * 100` | `calculateKraProgress()` |
| **Objective Progress** | Average of linked KRA progress values | `calculateStrategicProgress()` |
| **Objective Status** | 'Completed' only if ALL linked KPIs are completed | `calculateObjectiveStatus()` |

---

## PART 4: Task-to-KPI Checklist Sync Engine

**Status: FULLY IMPLEMENTED**

This is the core backend engine that bridges daily tasks with strategic KPI progress.

### 4.1 The `syncKPIChecklistFromTasks()` Method

**File:** `src/services/sharePointOpsService.ts`
**Visibility:** `private async`

This method is the heart of the task-to-KPI linking system. When called with a KPI ID, it:

1. **Fetches** the KPI item from SharePoint and parses its existing `ChecklistJSON`
2. **Fetches** all tasks from `Operations_Tasks` and filters for those linked to this KPI (via `RelatedKPILookupId`)
3. **Removes** checklist items whose `taskId` no longer matches any linked task (task was unlinked or deleted)
4. **Updates** existing task-linked checklist items:
   - Syncs the item text to match the task's current title
   - Sets `checked` based on task completion status (`'done'` or `'completed'`)
5. **Adds** new checklist items for newly linked tasks (with `taskId` and `isTaskLinked: true`)
6. **Determines** KPI status:
   - If ALL checklist items are checked -> sets status to `'Completed'`
   - If status was `'Completed'` but items became unchecked -> reverts to `'In Progress'`
7. **Updates** the KPI in SharePoint:
   - Writes the merged `ChecklistJSON`
   - Sets `CalculationType` to `'checklist'` when tasks are linked
   - Updates `Status` if changed
8. **Cascades** by calling `syncKRAProgress()` to update the parent KRA's progress

### 4.2 Hook Points — When Does Sync Fire?

The sync method is called automatically from all three task CRUD operations:

#### `addTask()` — After creating a new task
```typescript
// After the SharePoint API post:
if (task.kpi_id) {
    await this.syncKPIChecklistFromTasks(task.kpi_id.toString());
}
```
**Effect:** When a user creates a task linked to a KPI, that task immediately appears as a checklist item inside the KPI.

#### `updateTask()` — After updating a task
```typescript
// BEFORE the patch: fetch old task to detect KPI re-linking
let oldKpiId: string | null = null;
try {
    const oldTask = await this.client
        .api(`/sites/${this.siteId}/lists/${this.listIds['TASKS']}/items/${id}`)
        .expand('fields').get();
    oldKpiId = oldTask.fields?.RelatedKPILookupId
        ? String(oldTask.fields.RelatedKPILookupId) : null;
} catch { /* proceed without old data */ }

// AFTER the patch:
const newKpiId = task.kpi_id !== undefined
    ? (task.kpi_id ? String(task.kpi_id) : null)
    : oldKpiId;

// If KPI linkage changed, sync BOTH old and new KPIs
if (oldKpiId && newKpiId !== oldKpiId) {
    await this.syncKPIChecklistFromTasks(oldKpiId);  // Remove from old KPI
}
if (newKpiId) {
    await this.syncKPIChecklistFromTasks(newKpiId);   // Add/update in new KPI
}
```
**Effect:** When a task status changes to "completed", its checklist item auto-checks. When a task is re-linked to a different KPI, it's removed from the old one and added to the new one.

#### `deleteTask()` — Before/after deleting a task
```typescript
// BEFORE deletion: fetch the task to get its KPI linkage
let kpiId: string | null = null;
try {
    const taskItem = await this.client
        .api(`/sites/${this.siteId}/lists/${this.listIds['TASKS']}/items/${id}`)
        .expand('fields').get();
    kpiId = taskItem.fields?.RelatedKPILookupId
        ? String(taskItem.fields.RelatedKPILookupId) : null;
} catch { /* proceed with deletion */ }

// AFTER deletion:
await this.client.api(`.../items/${id}`).delete();
if (kpiId) {
    await this.syncKPIChecklistFromTasks(kpiId);  // Remove deleted task's checklist item
}
```
**Effect:** When a task is deleted, its corresponding checklist item is automatically removed from the linked KPI. The KPI re-evaluates its completion status.

---

## PART 5: Frontend Checklist Integration

**Status: FULLY IMPLEMENTED**

### 5.1 ChecklistSection Component (`src/components/ChecklistSection.tsx`)

The UI component that renders checklist items with full support for task-linked items:

- **Manual items:** White background, deletable via trash icon, text editable
- **Task-linked items:** Blue background (`bg-blue-50`), link icon (`Link2`), NOT deletable (read-only), text shows task title
- **Progress bar:** Shows `(checked / total) * 100` percent completion
- **Both types** can be checked/unchecked via checkboxes
- **Both types** count toward the overall completion percentage

### 5.2 KPI Modal Task-Checklist Merge (`src/components/unit-tabs/KRAsTab.tsx`)

When the user opens a KPI for editing via `handleOpenEditKpiModal()`, the system merges linked tasks into the KPI's checklist for **immediate UI display** (without waiting for SharePoint sync):

```typescript
const handleOpenEditKpiModal = (kraId, kpi) => {
  // 1. Find all tasks linked to this KPI
  const linkedTasks = tasks.filter(t => t.kpi_id === kpi.id?.toString());

  // 2. Separate manual and task-linked checklist items
  const manualItems = existingChecklist.filter(item => !item.taskId);
  const existingTaskItems = existingChecklist.filter(item => item.taskId);

  // 3. Update existing task-linked items (sync title + checked status)
  const updatedTaskItems = existingTaskItems
    .filter(item => linkedTasks.some(t => String(t.id) === item.taskId))
    .map(item => {
      const task = linkedTasks.find(t => String(t.id) === item.taskId);
      return { ...item, text: task.title, checked: isTaskDone(task) };
    });

  // 4. Add new task-linked items for tasks not yet in checklist
  const newTaskItems = linkedTasks
    .filter(t => !existingTaskIds.has(String(t.id)))
    .map(t => ({
      id: `task-${t.id}`,
      text: t.title,
      checked: isTaskDone(t),
      taskId: String(t.id),
      isTaskLinked: true,
    }));

  // 5. Merge: manual items + updated task items + new task items
  const mergedChecklist = [...manualItems, ...updatedTaskItems, ...newTaskItems];

  // 6. Auto-set calculationType to 'checklist' when tasks are linked
  const mergedKpi = {
    ...kpi,
    checklist: mergedChecklist,
    calculationType: linkedTasks.length > 0 ? 'checklist' : kpi.calculationType,
  };

  // 7. Open the modal with merged data
  setEditingKpiDetails({ kraId, kpi: mergedKpi });
};
```

### 5.3 KPI Save Payload Fix (`src/components/unit-tabs/KRAsTab.tsx`)

Previously, the KPI save payload in `handleKpiFormSubmit()` was missing `checklist` and `calculationType` fields, causing checklist data to be lost on save. Fixed by adding them:

```typescript
const kpiPayload = {
  // ... existing fields ...
  checklist: kpi.checklist || [],
  calculationType: kpi.calculationType || 'manual',
};
```

### 5.4 KpiInputBlock Measurement Toggle (`src/components/kpi/KpiInputBlock.tsx`)

The KPI edit form provides a toggle between two measurement methods:
- **Manual Input:** User enters target/actual values manually
- **Checklist:** Shows the ChecklistSection component; target auto-sets to 100; actual auto-calculates from checklist completion percentage

When `calculationType === 'checklist'`, the checklist section renders with both manual and task-linked items merged.

---

## PART 6: Dashboard Overview Consistency Fixes

**Status: FULLY IMPLEMENTED**

The Dashboard Overview (`src/components/unit-tabs/OverviewTab.tsx`) was updated to ensure all cards and charts use the same consistent logic as the KRA/KPI/Objective system.

### 6.1 Objectives Summary Card — Data Source Fix

**Problem:** The card showed "0" objectives despite the Objectives tab having 5 objectives.

**Root Cause:** The OverviewTab component ignored the `objectives` prop passed from `Unit.tsx` and instead fetched objectives independently from `useStrategySharePoint()`. This hook returns Strategy-page-level objectives (a different SharePoint list) — NOT the unit-level objectives from `Unit_Objectives` that the user sees in the KRAs & Objectives tab.

**Fix:** Changed the component to use the `objectives` prop from Unit.tsx (which contains the actual unit objectives), falling back to strategy data only if the prop is empty:

```typescript
// BEFORE (broken):
const { strategyData } = useStrategySharePoint();
const objectives = strategyData?.objectives || [];

// AFTER (fixed):
const { strategyData } = useStrategySharePoint();
const objectives = (objectivesFromProps && objectivesFromProps.length > 0)
  ? objectivesFromProps
  : (strategyData?.objectives || []);
```

### 6.2 Objectives Summary Card — Dynamic Progress

**Problem:** The card used the stored `obj.progress` field from SharePoint, which is a static/stale value that never updates when KRAs or KPIs change.

**Fix:** Objective progress is now computed dynamically from linked KRAs in real-time:

```typescript
const objectivesWithDynamicProgress = useMemo(() => {
  return scopedObjectives.map(obj => {
    const linkedKras = scopedKras.filter(kra =>
      String(kra.objective_id) === String(obj.id) ||
      String(kra.objectiveId) === String(obj.id)
    );
    const dynamicProgress = linkedKras.length > 0
      ? calculateStrategicProgress(linkedKras, allKpis)
      : (obj.progress || 0);
    const dynamicStatus = calculateObjectiveStatus(obj, scopedKras);
    return { ...obj, progress: dynamicProgress, status: dynamicStatus };
  });
}, [scopedObjectives, scopedKras, allKpis]);
```

### 6.3 Top Objectives Progress Chart — Dynamic Progress

**Problem:** The horizontal bar chart used stored `obj.progress` values (same static data issue as the card).

**Fix:** Now uses the same `objectivesWithDynamicProgress` computed data, so chart bars reflect real-time KRA/KPI completion status:

```typescript
// BEFORE:
const objectiveChartData = scopedObjectives.map(obj => ({
  title: obj.title,
  progress: obj.progress || 0
}));

// AFTER:
const objectiveChartData = objectivesWithDynamicProgress.map(obj => ({
  title: obj.title,
  progress: obj.progress || 0
}));
```

### 6.4 KRA Status Distribution Chart — Status Mismatch Fix

**Problem:** The donut chart showed "No Data" despite KRAs existing.

**Root Cause:** The chart checked for status values `'on-track'`, `'at-risk'`, `'off-track'`, `'completed'` — but KRA data from SharePoint gets mapped through `combinedKrasForOverview` in Unit.tsx to only `'open'`, `'in-progress'`, `'closed'`. Zero values matched, so the chart showed "No Data".

**Fix:** Updated status matching to recognize all actual KRA status values:

```typescript
// BEFORE (broken - none of these matched actual data):
onTrack: scopedKras.filter(k => k.status === 'on-track').length,
completed: scopedKras.filter(k => k.status === 'completed' || k.status === 'closed').length,

// AFTER (matches actual SharePoint-mapped values):
onTrack: scopedKras.filter(k => {
  const s = k.status?.toLowerCase();
  return s === 'in-progress' || s === 'on-track';
}).length,
completed: scopedKras.filter(k => {
  const s = k.status?.toLowerCase();
  return s === 'completed' || s === 'closed' || s === 'done';
}).length,
open: scopedKras.filter(k => {
  const s = k.status?.toLowerCase();
  return !s || s === 'open' || s === 'pending' || s === 'not-started';
}).length,
```

**KRA Status Mapping Reference:**

| SharePoint Value | Mapped Value (after `mapKRA`) | Dashboard Category | Color |
|-----------------|-------------------------------|-------------------|-------|
| `Open` | `open` | Open | Gray `#94a3b8` |
| `In Progress` | `in-progress` | On Track | Green `#34d399` |
| `On Track` | `on-track` | On Track | Green `#34d399` |
| `At Risk` | `at-risk` | At Risk | Yellow `#fbbf24` |
| `Off Track` | `off-track` | Off Track | Red `#ef4444` |
| `Behind` | `behind` | Off Track | Red `#ef4444` |
| `Completed` | `completed` | Completed | Blue `#3b82f6` |
| `Closed` | `closed` | Completed | Blue `#3b82f6` |
| `Done` | `done` | Completed | Blue `#3b82f6` |

### 6.5 KRA Progress Card — Subtitle Clarity Fix

**Problem:** The card showed "50%" (correct -- 1 of 2 KPIs completed) but said "0 completed" underneath. The "0 completed" counted fully-completed KRAs (where ALL KPIs are done), not individual KPIs. This was technically correct but misleading.

**Fix:** Changed the subtitle to show KPI-level completion since that's what directly drives the percentage:

```typescript
// BEFORE (confusing):
{scopedKras.filter(kra => calculateKraProgress(kra, allKpis) === 100).length} completed

// AFTER (clear):
{kpiStats.completed} of {allKpis.length} KPIs completed
```

Now the card reads: `50%` / `1 of 2 KPIs completed` — which makes the number immediately understandable.

---

## PART 7: Prior Fixes Reference

These changes were made in earlier sessions and remain in place.

### 7.1 KRA Duplicate Prevention Fix

**Problem:** When creating a new KPI and selecting an existing KRA title, a duplicate KRA was created in SharePoint.

**Root Causes:**
1. cmdk library lowercases values in `onSelect` callback
2. No ID-based linking when selecting existing KRA
3. Always called `kraState.add()` without checking for existing ID
4. Temp ID generation (`kra_${Date.now()}`) treated as real SharePoint IDs

**Files Modified:**
- `src/components/kpi/KraFormSection.tsx` — Added `existingKraObjects` prop; rewrote `onSelect` to use original title and ID
- `src/components/kpi/KpiModal.tsx` — Added `existingKraObjects` prop; removed fake temp ID generation
- `src/components/unit-tabs/KRAsTab.tsx` — Added `existingKraObjects` memo; safety-net duplicate check; orphan KRA cleanup on KPI delete

### 7.2 KRA Progress Calculation Fix

**Problem:** KRA progress was calculated by averaging `calculateKpiProgress()` per KPI (target/actual ratios), causing misleading values.

**Fix:** Changed both frontend and backend to use strictly KPI completion status:
- `src/utils/kpiUtils.ts` — `calculateKraProgress()` counts KPIs with 'completed' status
- `src/services/sharePointOpsService.ts` — `syncKRAProgress()` uses identical logic

---

## PART 8: SharePoint List Schema

| List Name | Key Fields | Relationships |
|-----------|-----------|---------------|
| `Unit_Objectives` | Title, Status, Progress, Division, Unit, ParentGoalIdLookupId | Parent objective |
| `Performance_KRAs` | Title, Progress, Status, Division, Unit, UnitObjectiveLookupId, Assignees (JSON) | Links to Unit_Objectives |
| `Performance_KPIs` | Title, TargetValue, ActualValue, Status, CalculationType, ChecklistJSON, RelatedKRALookupId, Assignees (JSON) | Links to Performance_KRAs |
| `Operations_Tasks` | Title, Status, Priority, DueDate, StartDate, CompletionDate, RelatedKRALookupId, RelatedKPILookupId, SubtasksJSON, Assignees (JSON), Tags, Department | Links to KRAs and KPIs |

### 8.1 Key SharePoint Field Details

**ChecklistJSON** (Performance_KPIs):
- Type: Multi-line text
- Content: JSON array of `ChecklistItem` objects
- Example: `[{"id":"task-42","text":"Deploy firewall rules","checked":true,"taskId":"42","isTaskLinked":true},{"id":"item-123","text":"Manual review","checked":false}]`

**CalculationType** (Performance_KPIs):
- Type: Single-line text
- Values: `'manual'` or `'checklist'`
- Auto-set to `'checklist'` when tasks are linked via `syncKPIChecklistFromTasks()`

**RelatedKPILookupId** (Operations_Tasks):
- Type: Lookup (Number)
- Links a task to a specific KPI
- Primary field used for task-to-KPI checklist sync

---

## PART 9: Complete File Reference

### 9.1 Backend (Service Layer)

| File | Method/Function | Purpose |
|------|----------------|---------|
| `src/services/sharePointOpsService.ts` | `syncKPIChecklistFromTasks(kpiId)` | Core sync engine: merges linked tasks into KPI checklist |
| `src/services/sharePointOpsService.ts` | `syncKRAProgress(kraId)` | Recalculates KRA progress from completed KPIs |
| `src/services/sharePointOpsService.ts` | `addTask()` | Creates task; calls `syncKPIChecklistFromTasks` if linked to KPI |
| `src/services/sharePointOpsService.ts` | `updateTask()` | Updates task; fetches old KPI linkage; syncs both old and new KPIs |
| `src/services/sharePointOpsService.ts` | `deleteTask()` | Fetches KPI linkage before deletion; syncs KPI to remove checklist item |
| `src/services/sharePointOpsService.ts` | `addKPI()` | Creates KPI; stores ChecklistJSON; calls `syncKRAProgress` |
| `src/services/sharePointOpsService.ts` | `updateKPI()` | Updates KPI; stores ChecklistJSON; calls `syncKRAProgress` |
| `src/services/sharePointOpsService.ts` | `mapKPI()` | Maps SharePoint fields to Kpi type; parses ChecklistJSON |
| `src/services/sharePointOpsService.ts` | `mapKRA()` | Maps SharePoint fields to KRA type; status normalization |

### 9.2 Progress Calculation (Utilities)

| File | Function | Purpose |
|------|----------|---------|
| `src/utils/kpiUtils.ts` | `calculateKpiProgress(kpi)` | KPI progress: status/checklist/target-actual |
| `src/utils/kpiUtils.ts` | `calculateKraProgress(kra, kpis)` | KRA progress: % of completed KPIs |
| `src/utils/kpiUtils.ts` | `calculateStrategicProgress(kras, kpis)` | Objective progress: average of KRA progress |
| `src/utils/kpiUtils.ts` | `calculateObjectiveStatus(obj, kras)` | Objective status: 'Completed' if all KPIs done |

### 9.3 Frontend Components

| File | Component/Function | Purpose |
|------|-------------------|---------|
| `src/components/ChecklistSection.tsx` | `ChecklistSection` | Renders checklist with task-linked item support (blue styling, link icon, non-deletable) |
| `src/components/kpi/KpiInputBlock.tsx` | `KpiInputBlock` | KPI edit form with measurement toggle (Manual/Checklist) |
| `src/components/kpi/KpiModal.tsx` | `KpiModal` | KRA/KPI creation/editing modal |
| `src/components/unit-tabs/KRAsTab.tsx` | `handleOpenEditKpiModal()` | Merges linked tasks into KPI checklist before opening modal |
| `src/components/unit-tabs/KRAsTab.tsx` | `handleKpiFormSubmit()` | Saves KPI with checklist and calculationType |
| `src/components/unit-tabs/KRAsTab.tsx` | Linked Tasks column | Displays count + popover of tasks linked to each KPI |
| `src/components/unit-tabs/TaskDialog.tsx` | KRA/KPI dropdowns | UI for linking tasks to KRAs and KPIs |

### 9.4 Dashboard Overview

| File | Element | Purpose |
|------|---------|---------|
| `src/components/unit-tabs/OverviewTab.tsx` | KRA Progress card | Shows average KRA progress + KPI completion count |
| `src/components/unit-tabs/OverviewTab.tsx` | Objectives Summary card | Shows objective count + dynamically calculated completion |
| `src/components/unit-tabs/OverviewTab.tsx` | KRA Status Distribution chart | Donut chart with corrected status matching |
| `src/components/unit-tabs/OverviewTab.tsx` | Top Objectives Progress chart | Horizontal bars with dynamic progress from KRAs |
| `src/components/unit-tabs/OverviewTab.tsx` | KPIs card | Stacked bar showing KPI status distribution |
| `src/components/unit-tabs/OverviewTab.tsx` | `objectivesWithDynamicProgress` | Computed objective progress from linked KRAs |
| `src/pages/Unit.tsx` | `combinedKrasForOverview` | Maps KPIs to KRAs, normalizes statuses for dashboard |

### 9.5 Data Flow: Unit.tsx to OverviewTab

```
Unit.tsx
  |-- kraState.data (from SharePoint Performance_KRAs)
  |-- kpiState.data (from SharePoint Performance_KPIs)
  |-- taskState.data (from SharePoint Operations_Tasks)
  |-- objectivesData (from SharePoint Unit_Objectives)
  |
  |-- combinedKrasForOverview = kras + mapped KPIs + status normalization
  |
  v
OverviewTab (props: kras, tasks, objectives)
  |-- scopedKras = filtered by user role/scope
  |-- scopedObjectives = filtered by user role/scope
  |-- allKpis = flatMap of scopedKras' KPIs
  |-- kpiStats = status counts from allKpis
  |-- objectivesWithDynamicProgress = computed from linked KRAs
  |
  |-- KRA Progress card: calculateKraProgress() average
  |-- Objectives Summary: objectivesWithDynamicProgress
  |-- KRA Status Distribution: kraStatusCounts (normalized)
  |-- Top Objectives Progress: objectivesWithDynamicProgress sorted
  |-- KPI Performance: kpiStats
```

---

## PART 10: Edge Cases & Testing

### 10.1 Edge Cases Handled

1. **Task linked to KPI but KPI has no checklist yet** -> Creates checklist with the task as first item, auto-sets `calculationType` to `'checklist'`
2. **Task unlinked from KPI (kpi_id changed)** -> `updateTask()` fetches old KPI linkage, syncs BOTH old and new KPIs
3. **Task deleted** -> `deleteTask()` fetches KPI linkage before deletion, syncs KPI to remove checklist item
4. **KPI deleted** -> Existing orphan cleanup handles this
5. **Manual checklist items alongside task items** -> Both count toward completion. All must be checked for KPI to be "completed"
6. **Task title changes** -> `syncKPIChecklistFromTasks()` updates the checklist item text to match current title
7. **Multiple tasks linked to same KPI** -> Each becomes a separate checklist item
8. **No tasks linked to KPI** -> Checklist operates as purely manual (existing behavior)
9. **KPI with 'Completed' status has items unchecked** -> Auto-reverts to 'In Progress'
10. **Dashboard uses different objective data source** -> Fixed to use Unit.tsx props with strategy data fallback

### 10.2 Testing Checklist

- [x] Create a KPI with no linked tasks -- manual checklist works as before
- [x] Link a task to a KPI -- task appears as checklist item in KPI modal
- [ ] Complete the task in Daily Tasks view -- KPI checklist item auto-checks
- [ ] Complete all tasks -- KPI status auto-sets to "completed"
- [ ] KRA progress updates after KPI becomes completed
- [ ] Reopen a task -- KPI reverts from "completed" to "in-progress"
- [ ] KRA progress decrements after KPI reverts
- [ ] Delete a task -- its checklist item is removed
- [ ] Unlink a task from KPI -- its checklist item is removed from old KPI
- [ ] Re-link a task to a different KPI -- removed from old, added to new
- [x] Add manual checklist items alongside task items -- both count toward completion
- [ ] Edit task title -- checklist item text updates on next sync
- [x] Dashboard KRA Status Distribution shows actual KRA data (not "No Data")
- [x] Dashboard Objectives Summary shows correct count from unit objectives
- [x] Dashboard KRA Progress card shows KPI completion detail
- [x] Dashboard Top Objectives Progress uses dynamic progress from KRAs
- [ ] Task-linked checklist items display with blue styling and link icon
- [ ] Task-linked checklist items cannot be deleted (no trash icon)

### 10.3 Future Work

- [ ] **Bidirectional sync from KPI modal**: When a user checks/unchecks a task-linked item in the KPI modal, update the task's status in SharePoint (completed <-> in-progress)
- [ ] **Objective progress sync to SharePoint**: Currently, objective progress is calculated dynamically on the frontend. Consider syncing it back to SharePoint's `Unit_Objectives.Progress` field for consistency with other consumers
- [ ] **Real-time updates**: Consider using SharePoint webhooks or polling to detect task changes made by other users and update the dashboard in real-time
