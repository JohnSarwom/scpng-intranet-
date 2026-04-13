# Task Registry Security & Stability Audit

**Date:** April 13, 2026
**Scope:** Full audit of the Task Registry (Kanban board) feature — UI, services, hooks, and utilities.

---

## Summary

A comprehensive audit of the Task Registry identified **20 issues** across the task board codebase. This session addressed the **6 most critical and high-severity issues**, plus a pre-existing group visibility bug. All fixes compile cleanly with zero TypeScript errors.

## Files Modified

| File | Changes |
|------|---------|
| `src/services/sharePointOpsService.ts` | OwnerEmail always written on create; preserved on update; JSON.parse safety; XSS escaping; empty email guards |
| `src/pages/Unit.tsx` | Removed backward-compat filter that showed ownerless groups to all users |
| `src/components/unit-tabs/TasksTab.tsx` | Guard against empty `currentUserEmail` on group creation; optimistic cache cleanup on drag-drop |
| `src/components/unit-tabs/TaskDialog.tsx` | Toast feedback on comment save failure; notification error isolation |

---

## Issues Found (Full List)

### Critical
| # | File | Line(s) | Issue | Status |
|---|------|---------|-------|--------|
| 1 | sharePointOpsService.ts | 2205-2215 | `updateTaskGroup()` drops OwnerEmail on update | **Fixed** |
| 2 | sharePointOpsService.ts | 2801-2865 | `notifyAssignment()` doesn't validate empty assignerEmail | **Fixed** |

### High
| # | File | Line(s) | Issue | Status |
|---|------|---------|-------|--------|
| 3 | TasksTab.tsx | 1145-1232 | Stale task state in drag-and-drop optimistic updates | **Fixed** |
| 4 | TaskDialog.tsx | 444-466 | Comment save/notification failures silent | **Fixed** |
| 5 | sharePointOpsService.ts | 1683-1703 | Unhandled `JSON.parse()` on SubtasksJSON/CommentsJSON | **Fixed** |

### Medium
| # | File | Line(s) | Issue | Status |
|---|------|---------|-------|--------|
| 6 | taskBoardUtils.ts | 31 | No defensive type check on assigneeViewMap | Open |
| 7 | TasksTab.tsx | 1345-1361 | pendingDeletes ref memory leak | Open |
| 8 | sharePointOpsService.ts | 1662-1700 | Inconsistent createdBy/createdByEmail mapping | Open |
| 9 | sharePointOpsService.ts | 2786 | getOrCreateAssignedToMeGroup no uniqueness validation | Open |
| 10 | sharePointOpsService.ts | 2174-2179 | No pagination for TaskGroups (>200 silently truncated) | Open |
| 11 | TasksTab.tsx | 1603-1700 | Race condition: concurrent multi-field updates | Open |
| 12 | sharePointOpsService.ts | 2904 | XSS: unsanitized comment text in email HTML | **Fixed** |
| 13 | TaskCard.tsx | 421 | Missing null check on assignee email | Open |
| 14 | useSharePointOps.ts | 201 | Missing length check before assignees.some() | Open |

### Low
| # | File | Line(s) | Issue | Status |
|---|------|---------|-------|--------|
| 15 | TaskDialog.tsx | 34 | Dead import: `toast` (was unused, now used by fix #4) | **Resolved** |
| 16 | TasksTab.tsx | 1191-1425 | Inconsistent toast feedback on errors | Open |
| 17 | TasksTab.tsx | 272-280 | O(n*m) assignee lookup per task card | Open |
| 18 | TaskDialog.tsx | 97-360 | Task title not trimmed consistently | Open |
| 19 | TasksTab.tsx | 930-1045 | optimisticUpdates ref not in useEffect deps | Open |
| 20 | TaskCard.tsx | 389 | No fallback for missing assignee in selector | Open |

---

## Detailed Fix Descriptions

### Fix 1: OwnerEmail Preservation in updateTaskGroup
**Problem:** When a group was renamed or reordered, `updateTaskGroup()` never wrote `OwnerEmail` to the PATCH payload. This caused ownership to be silently lost.

**Change:** Added `if (updates.ownerEmail !== undefined) fields.OwnerEmail = updates.ownerEmail;` in `updateTaskGroup()`.

### Fix 2: OwnerEmail Always Written on Create + Guard
**Problem:** `addTaskGroup()` had `if (group.ownerEmail) { fields.OwnerEmail = group.ownerEmail; }` — if the email was empty string (falsy), OwnerEmail was never sent to SharePoint. The backward-compat filter in `Unit.tsx` then showed these ownerless groups to everyone.

**Changes:**
- `addTaskGroup()`: `OwnerEmail` is now always included in the fields object (no conditional).
- `TasksTab.tsx`: Added guard — if `currentUserEmail` is empty, group creation is blocked with a toast error.
- `Unit.tsx`: Changed filter from `if (!p.ownerEmail) return true` (show to all) to `if (!p.ownerEmail) return false` (hide orphaned groups).

### Fix 3: JSON.parse Safety for SubtasksJSON/CommentsJSON
**Problem:** `JSON.parse(f.SubtasksJSON)` and `JSON.parse(f.CommentsJSON)` in `mapTask()` had no error handling. One corrupted SharePoint field would crash the entire task list.

**Change:** Wrapped both in IIFE try-catch blocks (matching the existing pattern used for `AssigneeViewMap` and `AttachmentsJSON`). Corrupted data falls back to `[]` with a `console.warn()`.

### Fix 4: XSS Escaping in Email Notifications
**Problem:** User-supplied text (task titles, comment text, names) was interpolated raw into HTML email templates via template literals.

**Changes:**
- Added `escapeHtml()` private method to `SharePointOpsService` (escapes `<`, `>`, `&`, `"`, `'`).
- `notifyComment()`: task title, commenter name, and comment text are now escaped.
- `notifyAssignment()`: task title and assigner name are now escaped.

### Fix 5: Empty Email Guards on Notifications
**Problem:** `notifyAssignment()` and `notifyComment()` could proceed with empty sender emails, producing malformed notifications.

**Change:** Added early-return guards with `console.warn()` at the top of both functions.

### Fix 6: Drag-and-Drop Optimistic Cache Cleanup
**Problem:** After a successful drag-and-drop API call, the optimistic cache entry was never cleared. Stale cached data could override fresh server data on subsequent updates.

**Change:** `optimisticUpdates.current.delete(activeId)` is now called on success. The undo action also clears the cache before reverting.

### Fix 7: Comment Save/Notification Error Handling
**Problem:** Comment save failures only logged to console; user saw the comment disappear with no explanation. Notification errors were fire-and-forget with no isolation from the save flow.

**Changes:**
- Save failures now show a destructive toast: "Failed to save comment. Please try again."
- Notification is now `await`ed inside a separate try-catch so failures are logged without affecting the save confirmation.
- The previously unused `toast` import in TaskDialog.tsx is now actively used.

---

## Manual Data Fix Required

Existing groups in SharePoint `Operations_TaskGroups` with empty `OwnerEmail` must be manually updated:

1. Go to SharePoint site > `Operations_TaskGroups` list
2. For each item with blank `OwnerEmail`, set it to the creator's email address
3. After the fix, these groups will only be visible to their owner

---

## Remaining Work (Medium/Low Priority)

The 13 open issues from the audit are documented in the table above. Recommended next priorities:
1. **#6** — Defensive type check on assigneeViewMap (prevents silent board placement errors)
2. **#10** — TaskGroups pagination (blocks at >200 groups)
3. **#11** — Request queue for rapid multi-field updates (prevents data races)
