# Bug Fix: Task Creation — Board Not Refreshing After Save

**Date:** 2026-02-23
**Affected Files:**
- `src/hooks/useSharePointOps.ts`
- `src/components/unit-tabs/TasksTab.tsx`
- `src/components/unit-tabs/modals/EditTaskModal.tsx`

---

## 1. Problem Description

Users reported that after adding a new task on the Unit Page Tasks board, the task showed a **"success" toast but never appeared on the board**. The board remained unchanged until a full page reload.

Additionally, the browser console showed date format warnings:
```
The specified value "2026-01-29T00:00:00Z" does not conform to the required format, "yyyy-MM-dd".
```

---

## 2. Root Cause Analysis

### Bug 1 — `query.refetch()` was NOT awaited (Primary Cause)

**File:** `src/hooks/useSharePointOps.ts` — `useSharePointTasks` hook

The `add`, `update`, and `remove` functions all called `query.refetch()` **without `await`**:

```typescript
// ❌ BEFORE — refetch fired but not waited for
add: async (item: Partial<Task>) => {
    await service.addTask(item, department);
    query.refetch();           // <-- NOT awaited, function returned immediately
    toast({ title: "Success" });
    return true;
}
```

**What this caused:**
1. Task saved to SharePoint ✅
2. Refetch triggered but NOT awaited — function returned immediately
3. Success toast fired
4. Dialog closed
5. Board never re-rendered because the Promise from refetch was silently discarded

The React Query cache never received the updated data synchronously from the caller's perspective, so `tasks` prop in `TasksTab` was never updated.

### Bug 2 — SharePoint Indexing Delay

Even when awaited, SharePoint's Graph API has a small propagation delay (~500–800ms) after a POST before the new item appears in a subsequent GET/list query. Without a delay, the refetch would complete successfully but return the **old list** (before the new task was indexed), resulting in the new task still not appearing.

### Bug 3 — Date Format Warning (`yyyy-MM-ddTHH:mm:ssZ` → `<input type="date">`)

**File:** `src/components/unit-tabs/modals/EditTaskModal.tsx`

The `startDate` input only handled `Date` instances:

```typescript
// ❌ BEFORE — string dates fell through to empty string
value={editedTask.startDate instanceof Date
  ? editedTask.startDate.toISOString().split('T')[0]
  : ''}
```

When `startDate` arrived as a string (e.g., `"2026-01-29T00:00:00Z"` — the raw format SharePoint returns before mapping), the `instanceof Date` check failed, and the value silently became `''`. The browser warned because React had previously set the full ISO string on the DOM element before the guard ran.

### Bug 4 — Duplicate Toast Notifications

**File:** `src/components/unit-tabs/TasksTab.tsx`

Both the hook and `TasksTab.onSubmit` were showing toasts:

```typescript
// Hook fires:       "Task added successfully"
// TasksTab fires:   "New task created successfully."
// = Two toasts for every single save
```

---

## 3. Fixes Applied

### Fix 1 — Await `query.refetch()` + Add indexing delay

**File:** `src/hooks/useSharePointOps.ts`

```typescript
// ✅ AFTER
add: async (item: Partial<Task>) => {
    const service = await getService();
    await service.addTask(item, department);
    // Wait for SharePoint to index the new item before refetching
    await new Promise(resolve => setTimeout(resolve, 800));
    await query.refetch();   // <-- now properly awaited
    toast({ title: "Success", description: "Task added successfully" });
    return true;
},
```

The same `await` fix was applied to `update` and `remove` (no delay needed for those since the item already exists).

### Fix 2 — Handle string dates in EditTaskModal

**File:** `src/components/unit-tabs/modals/EditTaskModal.tsx`

```typescript
// ✅ AFTER — handles both Date objects and ISO strings
value={
  editedTask.startDate instanceof Date
    ? editedTask.startDate.toISOString().split('T')[0]
    : typeof editedTask.startDate === 'string' && editedTask.startDate
      ? editedTask.startDate.split('T')[0]
      : ''
}
```

### Fix 3 — Remove duplicate toasts from TasksTab

**File:** `src/components/unit-tabs/TasksTab.tsx`

Removed the redundant `toast(...)` calls from `onSubmit`. The hook (`useSharePointTasks`) already handles user-facing success/error notifications.

```typescript
// ✅ AFTER — only one toast fires (from the hook)
onSubmit={async (taskData) => {
  if (editingTask) {
    await editTask(editingTask.id, taskData);
  } else {
    await addTask({ ...taskData, unit_id: currentUnit });
  }
  setIsDialogOpen(false);
}}
```

---

## 4. Data Flow (After Fix)

```
User submits TaskDialog
        │
        ▼
TasksTab.onSubmit
        │
        ▼
useSharePointTasks.add(task)
        │
        ├── await service.addTask(...)   → POST to SharePoint ✅
        │
        ├── await delay(800ms)           → Allow SharePoint indexing ✅
        │
        ├── await query.refetch()        → GET updated task list ✅
        │
        └── toast("Task added")          → Single success notification ✅
                                                        │
                                                        ▼
                                         React Query cache updated
                                                        │
                                                        ▼
                                         tasks prop in TasksTab updated
                                                        │
                                                        ▼
                                         Board re-renders with new task ✅
```

---

## 5. Related Files & Context

| File | Role |
|------|------|
| `src/hooks/useSharePointOps.ts` | React Query wrapper — owns data fetching and mutation |
| `src/services/sharePointOpsService.ts` | Low-level Graph API calls (POST/PATCH/DELETE) |
| `src/components/unit-tabs/TasksTab.tsx` | Board UI — renders buckets and calls `addTask` |
| `src/components/unit-tabs/TaskDialog.tsx` | Form modal for creating/editing tasks |
| `src/components/unit-tabs/modals/EditTaskModal.tsx` | Inline task edit modal |

---

## 6. Notes for Future Developers

- **Always `await query.refetch()`** after mutations. Not awaiting it means the board renders stale data.
- **SharePoint indexing delay:** A short delay (500–1000ms) before refetching is recommended for `add` operations. SharePoint's Graph API list endpoint may not return a newly created item immediately after the POST resolves.
- **Date fields from SharePoint** arrive as full ISO strings (`"2026-01-29T00:00:00Z"`). The `mapTask` function in `sharePointOpsService.ts` normalises `dueDate` via `.split('T')[0]`, but `startDate` is mapped to a `Date` object. Any component that receives `startDate` from task props should handle both `Date` instances and string fallbacks.
- **Toast notifications** should only fire from the hook layer (`useSharePointTasks`). UI components like `TasksTab` should not add extra toasts for the same event.
