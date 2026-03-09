# Improvement: Task Creation — Optimistic UI (Instant Board Update)

**Date:** 2026-02-23
**Affected Files:**
- `src/hooks/useSharePointOps.ts`
- `src/components/unit-tabs/TasksTab.tsx`

---

## 1. Problem Description

Even after the previous bug fix (see `TASK_CREATION_REFRESH_BUG_FIX.md`), users still experienced a **noticeable delay** between pressing "Save" on the Task dialog and seeing the new task appear on the board.

The sequence was:
1. User clicks Save
2. Dialog stays open — UI is frozen/unresponsive
3. SharePoint POST completes (~500ms)
4. 800ms artificial delay (waiting for SharePoint indexing)
5. Refetch GET completes (~500ms)
6. Dialog closes
7. Task appears on board

**Total wait: ~1.5–2 seconds of blocked UI**, which felt broken to users.

---

## 2. Root Cause

The `addTask` function in `useSharePointTasks` was **fully awaited** before the dialog was allowed to close:

```typescript
// ❌ BEFORE — everything blocked until SharePoint fully confirmed
add: async (item: Partial<Task>) => {
    await service.addTask(item, department);
    await new Promise(resolve => setTimeout(resolve, 800)); // blocking delay
    await query.refetch();                                  // blocking refetch
    toast({ title: "Success" });
    return true;
}
```

And in `TasksTab.onSubmit`:

```typescript
// ❌ BEFORE — dialog waited for the full chain above
await addTask({ ...taskData, unit_id: currentUnit });
setIsDialogOpen(false); // only closed AFTER everything above finished
```

---

## 3. Solution: Optimistic UI for Task Creation

The same **optimistic update pattern** already used throughout `TasksTab` for drag-and-drop, toggle complete, priority changes, assignee changes, and status changes was extended to cover task creation.

### Fix 1 — Hook returns created task immediately, refetches in background

**File:** `src/hooks/useSharePointOps.ts`

```typescript
// ✅ AFTER — POST resolves, task returned immediately, refetch is fire-and-forget
add: async (item: Partial<Task>) => {
    try {
        const service = await getService();
        const createdTask = await service.addTask(item, department);
        // Return immediately. Refetch in background to sync the cache.
        setTimeout(async () => {
            try { await query.refetch(); } catch { /* silent */ }
        }, 1200);
        return createdTask;
    } catch (error: any) {
        toast({ title: "Error", description: error.message || "Failed to add Task", variant: "destructive" });
        throw error;
    }
},
```

Key changes:
- The 800ms blocking delay is **removed**.
- `query.refetch()` is moved into a `setTimeout` (1.2s) so it runs entirely in the background.
- The hook now returns the created `Task` object (from the POST response) instead of `true`.

### Fix 2 — TasksTab closes dialog and shows task instantly

**File:** `src/components/unit-tabs/TasksTab.tsx`

```typescript
// ✅ AFTER — close dialog and show task immediately, API call is fire-and-forget
onSubmit={async (taskData) => {
  if (editingTask) {
    await editTask(editingTask.id, taskData);
    setIsDialogOpen(false);
  } else {
    // 1. Close dialog immediately — no waiting
    setIsDialogOpen(false);

    // 2. Build a temporary optimistic task with a temp ID
    const tempId = `temp-${Date.now()}`;
    const optimisticTask: Task = {
      ...newTaskData,
      id: tempId,
      completed: false,
    };

    // 3. Add to the board instantly
    setBoardData(prev => {
      const next = { ...prev };
      if (next[columnId]) {
        next[columnId] = [...next[columnId], optimisticTask];
      }
      return next;
    });

    // 4. Show success toast immediately
    toast({ title: "Success", description: "Task added successfully" });

    // 5. Fire API call in the background
    try {
      await addTask(newTaskData);
      // Hook's background refetch (~1.2s) replaces temp task with real SharePoint data
    } catch (error) {
      // 6. Rollback on failure — remove optimistic task, show error
      setBoardData(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          next[key] = next[key].filter(t => t.id !== tempId);
        });
        return next;
      });
      toast({ title: "Failed to Create Task", description: "Could not save the task.", variant: "destructive" });
    }
  }
}}
```

---

## 4. Data Flow (After Fix)

```
User clicks Save
        │
        ▼
Dialog closes immediately ✅
        │
        ▼
Optimistic task added to board with temp ID ✅
        │
        ▼
Success toast shown ✅
        │
        ├── (background) service.addTask() → POST to SharePoint
        │
        └── (background, ~1.2s later) query.refetch() → GET updated list
                                                │
                                                ▼
                                 React Query cache updated
                                                │
                                                ▼
                                 Temp task replaced by real task ✅

On POST failure:
        │
        ▼
Optimistic task removed from board (rollback) ✅
        │
        ▼
Error toast shown ✅
```

---

## 5. Prop Type Update

`NewTasksTabProps.addTask` was updated to reflect the new return type:

```typescript
// BEFORE
addTask: (task: Omit<Task, 'id'>) => void;

// AFTER
addTask: (task: Omit<Task, 'id'>) => Promise<Task | boolean | void> | void;
```

This is backwards-compatible — callers that don't use the return value are unaffected.

---

## 6. UX Before vs After

| | Before | After |
|---|---|---|
| Dialog closes | ~1.5–2s after Save | Immediately |
| Task appears on board | ~1.5–2s after Save | Immediately |
| Success toast | ~1.5–2s after Save | Immediately |
| API failure handling | N/A (was blocking) | Rollback with error toast |
| Perceived speed | Sluggish / broken | Instant / snappy |

---

## 7. Notes for Future Developers

- **Temp IDs** use the format `temp-{Date.now()}`. These are replaced by real SharePoint IDs when the background refetch completes. Do not persist or rely on temp IDs beyond the immediate render cycle.
- **The background refetch delay is 1.2s**. This is intentionally longer than the previous 800ms to give SharePoint more time to index the item before we query for it, reducing the chance of the refetch returning stale data that would flicker the optimistic task away.
- **This pattern is consistent** with the optimistic updates already implemented for drag-and-drop (`handleDragEnd`), toggle complete (`handleToggleComplete`), priority (`handlePriorityChange`), assignee (`handleAssigneeChange`), and status (`handleStatusChange`).
- **Always rollback on failure**. Any optimistic update must have a corresponding rollback in its `catch` block to prevent ghost tasks from persisting in the UI.
