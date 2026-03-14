# KRA Assignees Not Saving — Complete Bug Fix Report

**Date:** 2026-03-15
**Status:** RESOLVED
**Severity:** High — data loss (assignees silently dropped on save)

---

## Summary

When adding or editing a KRA, selecting staff in the "Additional Assignees" field and saving
appeared to succeed, but reopening the KRA showed an empty Assignees field. This was caused
by multiple interacting bugs, with the **primary root cause** being the owner-assignee merge
logic that silently overwrote assignee entries.

---

## Primary Root Cause

The `addKRA` and `updateKRA` functions in `sharePointOpsService.ts` merge all assignees and
the owner into a single JSON array stored in SharePoint's `Assignees` text column.

**The old merge logic:**
```typescript
const mergedAssignees = [...kra.assignees];
if (kra.owner) {
    const ownerIdx = mergedAssignees.findIndex(a => a.id === kra.owner.id);
    if (ownerIdx !== -1) {
        // BUG: Overwrites the assignee entry with isOwner flag
        mergedAssignees[ownerIdx] = { ...mergedAssignees[ownerIdx], isOwner: true };
    } else {
        mergedAssignees.push({ ...kra.owner, isOwner: true });
    }
}
```

If the user added the same person as both Owner (Lead) and Additional Assignee (common in
small teams), the merge found the matching ID and **set `isOwner: true` on that entry**.

On read, `mapKRA` separates them:
```typescript
regularAssignees = assignees.filter(a => !a.isOwner);  // Returns [] !
```

The person was filtered out because they were marked as owner, leaving `assignees: []`.

**The fix:**
```typescript
// Strip stale isOwner flags — regular assignees are never owners
const cleanAssignees = (kra.assignees || []).map(a => {
    const { isOwner, ...rest } = a;
    return rest;
});
const mergedAssignees = [...cleanAssignees];
// Owner is always a SEPARATE entry
if (kra.owner) {
    mergedAssignees.push({ ...kra.owner, isOwner: true });
}
```

Now if the same person is both owner and assignee, they get **two entries** in the JSON array:
one without `isOwner` (appears in "Additional Assignees") and one with `isOwner: true`
(appears in "Owner/Lead"). `mapKRA` correctly separates them.

---

## All Bugs Fixed (8 total)

| # | Bug | File | Impact |
|---|-----|------|--------|
| 1 | Form reset during async data load | `KpiModal.tsx` | Assignees wiped while modal open |
| 2 | PATCH response has no field values | `sharePointOpsService.ts` | Cache updated with empty data |
| 3 | POST response missing expanded fields | `sharePointOpsService.ts` | New KRAs cached without assignees |
| 4 | ADD case: cache not immediately updated | `useSharePointOps.ts` | New KRAs not visible until refetch |
| 5 | Assignees column not auto-provisioned | `sharePointOpsService.ts` | Column silently missing on lists |
| 6 | **Owner-assignee merge overwrites entry** | `sharePointOpsService.ts` | **Primary cause — assignees filtered out** |
| 7 | Immediate refetch race condition | `KRAsTab.tsx` | Stale data overwrites optimistic cache |
| 8 | Null safety crash in Unit.tsx | `Unit.tsx` | White page when KPI target is null |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/services/sharePointOpsService.ts` | Bugs 2, 3, 5, 6: PATCH→GET pattern, expand fields, auto-ensure column, owner-assignee separation |
| `src/hooks/useSharePointOps.ts` | Bug 4: setQueryData for add case, refetch diagnostics |
| `src/components/kpi/KpiModal.tsx` | Bug 1: modalInitializedRef prevents async reset |
| `src/components/unit-tabs/KRAsTab.tsx` | Bug 7: delayed onDataRefresh (5s) |
| `src/pages/Unit.tsx` | Bug 8: null-safe `k.target?.toString()` |
| `src/services/sharePointListSetupService.ts` | Bug 5: ensureAssigneesColumn checks all lists |

---

## SharePoint Schema Reference

The `Assignees` column on `Performance_KRAs` (and other lists) is a **multi-line text** field
storing a JSON array:

```json
[
  { "id": "aad-guid-1", "name": "Jane Doe", "email": "jane@org.com", "initials": "JD" },
  { "id": "aad-guid-2", "name": "John Smith", "email": "john@org.com", "isOwner": true }
]
```

- Regular assignees: no `isOwner` flag
- Owner: separate entry with `isOwner: true`
- On read: `mapKRA` splits via `filter(a => !a.isOwner)` and `find(a => a.isOwner)`

The column is auto-provisioned during `SharePointOpsService.initialize()` via
`ensureAssigneesColumnOnKRAs()` (fire-and-forget, non-blocking).

---

## Diagnostic Logging

Console logs are in place for future debugging (can be removed after confidence period):

- `📝 [SP Ops] Updating KRA ... Payload:` — PATCH payload with Assignees JSON
- `🔍 [SP Ops] GET after PATCH — Assignees raw:` — what SharePoint actually stored
- `🚨 [SP Ops] ASSIGNEES COLUMN LIKELY MISSING!` — auto-detected missing column
- `🔍 [Refetch] KRA ... assignees:` — what each refetch returns from cache
- `✅ [SP Ops] Assignees column exists on ...` — startup column check results

---

## Lessons Learned

1. **Never merge identity-based entries by overwriting** — when the same entity can have
   multiple roles (assignee + owner), store them as separate entries with role flags.
2. **SharePoint Graph API silently drops unknown fields** — always verify columns exist
   before assuming PATCH/POST will persist data.
3. **Optimistic cache updates + immediate refetches conflict** — if you use `setQueryData`
   for instant UI updates, delay any background refetches to avoid overwriting good data.
4. **Always null-guard `.toString()` calls** — SharePoint returns `null` for empty number
   fields, which crashes `toString()`.
