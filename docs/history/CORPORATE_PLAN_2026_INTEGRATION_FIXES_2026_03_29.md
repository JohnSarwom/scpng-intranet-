# Corporate Plan 2026-2028 Integration Fixes

**Date**: 2026-03-29
**Time**: 09:23 AM – 10:15 AM
**Module**: Strategy Hub / Unit Page / Corporate Plan 2026-2028
**Status**: Resolved / Deployed

---

## Overview

This session resolved a chain of bugs blocking the full integration of the new Corporate Plan 2026-2028 SharePoint schema (Strategic_Goals → Strategic_KRAs → Strategic_Initiatives) with the Unit page's Add Objective modal. Four distinct issues were identified and fixed in sequence.

---

## Issue 1 — Migration Failed: "Field 'ParentGoalIdLookupId' is not recognized"

**Time**: ~09:23 AM
**Trigger**: Clicking "Migrate Legacy Data" in the Corporate Plan 2026-2028 Schema Setup section (Admin → TestGround)

### Root Cause

`strategyMigrationService.ts` (line 147) attempted to write `ParentGoalIdLookupId` to `Strategic_Initiatives` items during migration. However, the `Strategic_Initiatives` list was created with only one lookup column — `ParentKRAId` (pointing to `Strategic_KRAs`). No `ParentGoalId` column was ever added to that list.

The `Strategic_KRAs` list correctly has `ParentGoalId` (line 806 of `sharePointListSetupService.ts`), so writing `ParentGoalIdLookupId` to KRAs at line 131 was valid. Only the Initiatives payload was wrong.

### Fix

**File**: `src/services/strategyMigrationService.ts`

Removed the orphan field from the Initiatives creation payload:

```typescript
// BEFORE
fields: {
    Title: itemTitle,
    Description: fields.Description || "",
    Status: fields.Status || "Not Started",
    Progress: fields.Progress || 0,
    ParentGoalIdLookupId: Number(goalId),   // ← column does not exist on Initiatives
    ParentKRAIdLookupId: Number(kraId),
}

// AFTER
fields: {
    Title: itemTitle,
    Description: fields.Description || "",
    Status: fields.Status || "Not Started",
    Progress: fields.Progress || 0,
    ParentKRAIdLookupId: Number(kraId),     // hierarchy: Initiative → KRA → Goal
}
```

The full chain (Initiative → KRA → Goal) is still intact via `ParentKRAId → ParentGoalId`. No schema changes were needed.

---

## Issue 2 — Add Objective Modal: Strategic Goals Dropdown Empty / No KRAs Found

**Time**: ~09:35 AM
**Trigger**: Opening "Add New Objective" modal on the Unit page. Strategic Alignment dropdown showed wrong/duplicate goals. "Key Deliverable" section showed "No key result areas (KRAs) found."

### Root Cause (layered — resolved in two steps)

**Step A — wrong field name**: `Unit.tsx` (line 237) built the `strategicObjectives` memo from `strategyData.objectives` but mapped `(obj as any).goals || []` as `deliverables`. The field `goals` does not exist on the objectives data; the correct field is `.kras` (mapped from the `Deliverables` SharePoint column in `fetchObjectives()`, line 230 of `strategyService.ts`).

**Step B — wrong list (initially overcorrected)**: A first attempt switched the data source to `strategyData.strategicGoals` + `strategyData.strategicKRAs` (the new Corporate Plan 2026-2028 lists). These contained duplicate goals from multiple migration runs and were not the data source used by the Strategy Hub. The Strategy Hub reads from the OLD `Strategic_Objectives` list — which has the correctly structured goals (Policy Development, Enforcement and Compliance, etc.) with their numbered KRAs stored in the `Deliverables` column.

### Fix

**File**: `src/pages/Unit.tsx` — `strategicObjectives` memo (lines 232–239)

```typescript
// BEFORE (broken field name)
const strategicObjectives = useMemo(() => {
  return (strategyData.objectives || []).map(obj => ({
    id: obj.id,
    title: obj.title,
    description: obj.description,
    deliverables: (obj as any).goals || []   // .goals doesn't exist
  }));
}, [strategyData.objectives]);

// AFTER (correct field: .kras)
const strategicObjectives = useMemo(() => {
  return (strategyData.objectives || []).map(obj => ({
    id: obj.id,
    title: obj.title,
    description: obj.description,
    deliverables: (obj as any).kras || []    // .kras is the correct mapped field
  }));
}, [strategyData.objectives]);
```

**Why `.kras`**: `fetchObjectives()` in `strategyService.ts` reads the `Deliverables` SharePoint text column (comma-separated KRA strings), splits it, and maps to `kras: string[]`. The Strategy Hub renders these same KRA strings. The modal now reads from the same source, so both views are in sync.

### Mock Data Update

**File**: `src/mockData/strategyData.ts`

Added `strategicGoals` and `strategicKRAs` to the `StrategyData` interface and `mockStrategyData` fallback (used when SharePoint is offline), seeded with the 4 Corporate Plan goals to keep dev/offline mode functional.

---

## Issue 3 — Backend Save Failure: ParentGoalIdLookupId Type Mismatch

**Time**: ~09:50 AM
**Trigger**: Saving a new objective with a Strategic Goal selected. SharePoint rejected the write.

### Root Cause

In `sharePointOpsService.ts`, `ParentGoalIdLookupId` was written as `objective.parentGoalId` directly. Since `parentGoalId` is stored as a **string** in the form state (React Select's `onValueChange` always returns a string), SharePoint received a string value for a lookup field. SharePoint lookup fields require a **numeric integer** ID.

Evidence from `sharePointListSetupService.ts` line 691 where lookups are correctly written using `parseInt()`.

### Fix

**File**: `src/services/sharePointOpsService.ts` — both `addObjective` and `updateObjective`

```typescript
// addObjective (line 319) — BEFORE
ParentGoalIdLookupId: objective.parentGoalId,

// AFTER
ParentGoalIdLookupId: objective.parentGoalId ? Number(objective.parentGoalId) : null,

// updateObjective (line 353) — BEFORE
if (objective.parentGoalId !== undefined) fields.ParentGoalIdLookupId = objective.parentGoalId;

// AFTER
if (objective.parentGoalId !== undefined) fields.ParentGoalIdLookupId = objective.parentGoalId ? Number(objective.parentGoalId) : null;
```

**Note**: The `Unit_Objectives` list has a `ParentGoalId` lookup column pointing to `Strategic_Objectives` (set up at line 515 of `sharePointListSetupService.ts`). Writing a numeric item ID from `Strategic_Objectives` as `ParentGoalIdLookupId` is valid because the column was configured to reference that list.

---

## Issue 4 — Saved Objective Not Appearing in Objectives Tab

**Time**: ~10:00 AM
**Trigger**: After saving a new objective, the success toast appeared but the new item did not appear in the Objectives tab table.

### Root Cause (two factors)

**Factor A — Division filter mismatch**

`getObjectives()` in `sharePointOpsService.ts` filters items with `GoalType: 'Division'` by checking `f.Division === context.division`. The form's `division` field is auto-filled from the selected Owner via `getEmployeeDetails()`. If no owner is selected, or the owner lookup fails, `newObjectiveData.division` stays `''`. The `addObjective` fallback then uses `department` (from `targetDepartment = currentUserDepartment`), while the filter reads `context.division` (from `graphProfile?.officeLocation`). If these two values differ, the newly saved item is excluded from the result.

**Factor B — SharePoint eventual consistency**

`query.refetch()` was called without `await` in the hook's `add` function. The `add` returns `true` before the refetch completes. More critically, SharePoint's Graph API has an eventual consistency window — a GET immediately after a POST may not yet include the new item, causing the refetch to return stale data.

### Fixes

**File 1**: `src/components/unit-tabs/KRAsTab.tsx` — `handleSaveObjective` (line 913)

Explicitly stamp `userContext.division` and `userContext.unit` as fallbacks in the payload, guaranteeing the saved Division matches the filter's expected value:

```typescript
// BEFORE
division: newObjectiveData.division,
unit: newObjectiveData.unit,

// AFTER
division: newObjectiveData.division || userContext?.division || '',
unit: newObjectiveData.unit || userContext?.unit || '',
```

**File 2**: `src/hooks/useSharePointOps.ts` — `useSharePointObjectives.add`

Added `queryClient.setQueryData` to optimistically insert the new item into the React Query cache immediately after the SharePoint write, before the background refetch completes:

```typescript
// BEFORE
query.refetch();
return true;

// AFTER
const newItem = await service.addObjective(item, department || context?.division);
// Insert optimistically — UI updates instantly without waiting for SharePoint's eventual consistency
queryClient.setQueryData(objectivesQueryKey, (prev: Objective[] | undefined) => {
    if (!prev) return [newItem];
    return [...prev, newItem];
});
// Background refetch to confirm server state
query.refetch();
return true;
```

Also extracted a stable `objectivesQueryKey` constant (used in both `useQuery` and `setQueryData`) and added `useQueryClient()` at the top of the hook function.

---

## Files Changed

| File | Change |
|---|---|
| `src/services/strategyMigrationService.ts` | Removed `ParentGoalIdLookupId` from Strategic_Initiatives migration payload |
| `src/pages/Unit.tsx` | Fixed `strategicObjectives` memo to use `obj.kras` instead of `obj.goals` |
| `src/mockData/strategyData.ts` | Added `strategicGoals`/`strategicKRAs` to `StrategyData` interface + mock fallback |
| `src/services/sharePointOpsService.ts` | Wrapped `ParentGoalIdLookupId` with `Number()` in add and update paths |
| `src/components/unit-tabs/KRAsTab.tsx` | Added `userContext` fallback for `division` and `unit` in objective payload |
| `src/hooks/useSharePointOps.ts` | Added `queryClient`, stable query key, and optimistic insert in `add` |

---

## Architecture Notes

### List Separation (important for future reference)

| List Name | Service | Purpose |
|---|---|---|
| `Strategic_Objectives` | `strategyService.ts` | Board-level strategic goals shown in Strategy Hub. Also used as the source for the Strategic Alignment dropdown in Add Objective modal. |
| `Unit_Objectives` | `sharePointOpsService.ts` | Unit-level operational objectives. Written to and read from by the Add Objective modal save/display flow. |
| `Strategic_Goals` | `strategyService.ts` | New Corporate Plan 2026-2028 top-level goals (from migration). NOT used as the modal dropdown source. |
| `Strategic_KRAs` | `strategyService.ts` | New Corporate Plan 2026-2028 KRAs linked to Strategic_Goals via `ParentGoalId`. |
| `Strategic_Initiatives` | `strategyService.ts` | New Corporate Plan 2026-2028 initiatives linked to Strategic_KRAs via `ParentKRAId`. |

### Lookup Column Reference

| Column | On List | Points To | Type |
|---|---|---|---|
| `ParentGoalId` | `Unit_Objectives` | `Strategic_Objectives` | Lookup (cross-list) |
| `ParentGoalId` | `Strategic_Objectives` | `Strategic_Objectives` | Lookup (self-referencing) |
| `ParentGoalId` | `Strategic_KRAs` | `Strategic_Goals` | Lookup (cross-list) |
| `ParentKRAId` | `Strategic_Initiatives` | `Strategic_KRAs` | Lookup (cross-list) |
| `LinkedDeliverable` | `Unit_Objectives` | — | Text (KRA title string) |

### Optimistic Update Pattern

This session introduced the optimistic update pattern for `addObjective`. The same pattern (`queryClient.setQueryData` + background `refetch`) should be applied to other `add` functions in the hook (`addKRA`, `addKPI`, `addTask`, `addProject`) if similar "item not appearing after save" issues arise. See also `docs/history/OPTIMISTIC_UI_PATTERN.md`.
