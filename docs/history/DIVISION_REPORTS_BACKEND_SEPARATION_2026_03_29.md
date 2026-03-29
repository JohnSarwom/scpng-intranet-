# Division Reports — Backend Separation from Unit Reports

**Date:** 2026-03-29
**Status:** Complete

---

## Problem Statement

The Division Reports tab (`/division` → Reports tab) was sharing the exact same backend — the same SharePoint `Report_Schedules` list, the same service methods, and the same lookup logic — as the Unit Reports tab (`/unit` → Reports tab, accessed via Task Registry).

This created three concrete problems:

1. **Silent data collision:** A division manager saving a report schedule would find or overwrite an existing unit-level schedule for the same email address, because `getReportSchedule` filtered only by `UserEmail` with no scope distinction.

2. **Wrong `unit` field value:** `DivisionReportsTab.tsx` was incorrectly writing `unit: data.division?.name` — using the division name as the unit name. This was a copy-paste error from `ReportsTab.tsx`.

3. **No semantic separation:** The Power Automate flow and any future reporting logic had no way to distinguish "this schedule is for a division manager reviewing all their units" from "this schedule is for an individual staff member reviewing their own work."

---

## Root Cause Analysis

`DivisionReportsTab.tsx` was copied from `ReportsTab.tsx` and both called identical service methods:

```ts
// Both tabs were calling the same method with no scope distinction
const existing = await opsService.getReportSchedule(userContext.email);
await opsService.saveReportSchedule({ ... });
```

`getReportSchedule` used an OData filter on `UserEmail` which is not indexed in SharePoint, causing intermittent 400 errors. The `saveReportSchedule` lookup also found the first matching email regardless of scope, causing overwrite collisions.

---

## Solution: Scope Differentiation via `Unit` Field

Rather than adding a new SharePoint column (which failed due to field name conflicts with reserved system fields `Scope` and permission restrictions on column creation), the solution uses the **existing `Unit` column** as the scope differentiator:

| Schedule Type | `Unit` field value |
|---|---|
| Unit-level (individual staff) | The user's unit name (e.g. `"IT Unit"`) |
| Division-level (manager/director) | Empty string `""` |

This works because:
- Division-level reports don't belong to a specific unit — empty `Unit` is semantically correct
- The `Unit` column already exists on the live list — no schema changes needed
- The distinction is unambiguous: a unit name is always non-empty for valid unit records

---

## Files Changed

### `src/services/sharePointOpsService.ts`

**1. `getReportSchedule(userEmail, scope?)` — updated signature and filtering**

Added optional `scope?: 'unit' | 'division'` parameter. Removed the OData filter (which failed on non-indexed columns) and replaced with fetch-all + JavaScript-side filtering:

```ts
async getReportSchedule(userEmail: string, scope?: 'unit' | 'division'): Promise<any | null> {
    // Fetch all records — avoids OData non-indexed column restrictions
    const response = await this.client
        .api(`/sites/${this.siteId}/lists/${listId}/items`)
        .expand('fields')
        .top(500)
        .get();

    const items = (response.value || []).map(item => ({ id: item.id, ...item.fields }));

    const match = items.find(item => {
        const emailMatch = (item.UserEmail || '').toLowerCase() === userEmail.toLowerCase();
        if (!emailMatch) return false;
        // Division schedules have Unit=''; unit schedules have a Unit value
        if (scope === 'division') return !item.Unit;
        if (scope === 'unit') return !!item.Unit;
        return true;
    });

    return match || null;
}
```

**2. `saveReportSchedule()` — added `scope` param, updated internal lookup**

Added `scope?: 'unit' | 'division'` to the parameter interface. The internal lookup now passes scope to `getReportSchedule` so a division manager's existing unit schedule is never overwritten by a division save:

```ts
// Before: found first match by email regardless of scope
const existing = await this.getReportSchedule(schedule.userEmail);

// After: scoped lookup prevents cross-contamination
const existing = await this.getReportSchedule(schedule.userEmail, schedule.scope || 'unit');
```

**3. Fixed broken `Report` type import**

`import { Report } from '@/types/reports'` referenced a deleted file. Replaced with an inline interface definition so `saveReport()` / `getReports()` methods continue to compile:

```ts
interface Report {
    id: string;
    name: string;
    template_id: string;
    created_by: string;
    date_range: { start_date: string; end_date: string };
    content: Record<string, any>;
}
```

---

### `src/components/division/tabs/DivisionReportsTab.tsx`

**Schedule load — passes `'division'` scope:**
```ts
// Before
const existing = await opsService.getReportSchedule(userContext.email);

// After
const existing = await opsService.getReportSchedule(userContext.email, 'division');
```

**Schedule save — passes `scope: 'division'` and fixes `unit` field bug:**
```ts
// Before (bug: using division name as unit name)
division: data.division?.name || userContext.division || '',
unit: data.division?.name || '',

// After (correct: division schedules have no unit)
division: data.division?.name || userContext.division || '',
unit: '',
scope: 'division',
```

---

### `src/components/unit-tabs/ReportsTab.tsx`

**Schedule load — passes `'unit'` scope:**
```ts
const existing = await opsService.getReportSchedule(userContext.email, 'unit');
```

**Schedule save — passes `scope: 'unit'`:**
```ts
division: userContext.division || '',
unit: userContext.unit || '',
scope: 'unit',
```

---

## Failed Approaches (Documented for Reference)

### Attempt 1: Add `Scope` column to SharePoint
**Failed because:** `Scope` is a reserved internal SharePoint field name. Writing to it returns `Field 'Scope' is not recognized`.

### Attempt 2: Add `ReportScope` column via Graph API
**Failed because:** The service account does not have permissions to create new columns on existing SharePoint lists via Graph API. `ensureScopeColumn()` silently succeeded (returning `true`) but the column was never actually created, so the subsequent item write failed.

### Attempt 3: OData filter on `UserEmail` with scope compound filter
**Failed because:** `UserEmail` is not indexed in the SharePoint list. OData filters on non-indexed columns return 400 with: `Field 'UserEmail' cannot be referenced in filter or orderby as it is not indexed`.

**Resolution:** Fetch all records and filter in JavaScript. Safe for `Report_Schedules` which is a small list (one record per user per scope).

---

## Power Automate Flow Impact

**No redeployment required.** The existing flow continues to function correctly because:
- Division manager schedules now have `Unit = ''` and `Division = <division name>`
- Unit staff schedules have `Unit = <unit name>` and `Division = <division name>`
- The flow reads both `Division` and `Unit` when building its email data — division schedules will naturally pull division-scoped data since `Unit` is empty

**Future enhancement (deferred):** When a division manager's schedule is processed, the flow should explicitly branch on `Unit == ''` to generate an aggregated cross-unit report rather than a unit-specific one. This is a flow update, not a data or schema change, and should be done when division managers begin using the scheduled reports feature in production.

---

## SharePoint List Schema (Report_Schedules — unchanged)

No schema changes were made to the live list. The `Unit` column already existed and is now used as the scope differentiator.

| Column | Type | Division Schedule | Unit Schedule |
|---|---|---|---|
| `Title` | Text | Manager name | Staff name |
| `UserEmail` | Text | Manager email | Staff email |
| `Division` | Text | Division name | Division name |
| `Unit` | Text | `""` (empty) | Unit name |
| `TimePeriod` | Text | daily/weekly/etc | daily/weekly/etc |
| `Categories` | Text (JSON) | `["tasks","kras",...]` | `["tasks","kras",...]` |
| `IsActive` | Text | `"true"/"false"` | `"true"/"false"` |
| `PreferredTime` | Text | e.g. `"07:00"` | e.g. `"07:00"` |
| `PreferredDay` | Text | e.g. `"Monday"` | e.g. `"Monday"` |
| `NextSendAt` | DateTime | calculated | calculated |
| `ManagerEmail` | Text | optional CC | optional CC |
