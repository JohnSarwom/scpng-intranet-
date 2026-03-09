# Shared Projects Group Logic Fix

**Date:** 2026-02-17  
**Status:** ✅ Completed  
**Related Files:**
- [`src/pages/Unit.tsx`](file:///C:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/pages/Unit.tsx)
- [`src/components/unit-tabs/TasksTab.tsx`](file:///C:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/components/unit-tabs/TasksTab.tsx)
- [`src/services/sharePointOpsService.ts`](file:///C:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/services/sharePointOpsService.ts)

---

## Problem Statement

### Issue
The "Shared Projects" virtual bucket was appearing immediately upon creating a new task, even when the task was created by the current user and assigned to themselves. This behavior was incorrect and confusing.

### Expected Behavior
"Shared Projects" should only appear when:
1. A task is assigned **TO** the current user
2. AND the task was created **BY** someone else (incoming shared task)

### Root Cause
The original `orphanedTasks` filter in `Unit.tsx` did not distinguish between:
- Tasks created by the user (should NOT trigger Shared Projects)
- Tasks assigned to the user from others (SHOULD trigger Shared Projects)

The logic was checking if a task was assigned to the user but not checking who created it, causing self-created tasks to incorrectly populate the "Shared Projects" bucket.

---

## Implementation

### 1. Backend Data Mapping

**File:** `src/services/sharePointOpsService.ts`

The SharePoint service already correctly maps the `Created By` field from SharePoint to the Task type:

```typescript
// Lines 989-1019 in sharePointOpsService.ts
private mapTask(item: any): Task {
  const f = item.fields;
  
  // Extract creator from Graph API response
  const createdByEmail = item.createdBy?.user?.email ||
      item.lastModifiedBy?.user?.email ||
      '';
  const createdByName = item.createdBy?.user?.displayName ||
      item.lastModifiedBy?.user?.displayName ||
      'Unknown';

  return {
    // ... other fields
    createdByEmail: createdByEmail,
    createdBy: createdByName,
    authorEmail: createdByEmail, // Alias for backward compatibility
  };
}
```

**SharePoint Schema:**
- `Created By` (Person or Group) - Automatically populated by SharePoint
- `Assignees` (Multiple lines of text) - JSON string of assigned users

### 2. Frontend Logic Update

#### Unit.tsx - Bucket Visibility Logic

**File:** `src/pages/Unit.tsx` (Lines 620-647)

Updated the `orphanedTasks` filter to exclude self-created tasks:

```typescript
const orphanedTasks = taskState.data?.filter(t => {
  // Orphan condition 1: Has projectId but bucket is missing
  const hasOrphanedProject = t.projectId && !allBucketIds.has(t.projectId) && t.projectId !== 'undefined';

  // Orphan condition 2: From another unit (cross-unit assignment)
  const isCrossUnit = t.unit_id && t.unit_id !== userContext.unit;

  // Orphan condition 3: Assigned to user but no matching project (fallback)
  const isAssignedOrphan = !t.projectId &&
    (t.assignees?.some(a => a.email?.toLowerCase() === userContext.email?.toLowerCase()) ||
      t.assignedTo?.toLowerCase() === userContext.email?.toLowerCase());

  // 🔒 SHARED GROUP FIX:
  // A task is only "Shared" if it is assigned to me BUT NOT created by me.
  const isCreatedByMe = t.createdByEmail?.toLowerCase() === userContext.email?.toLowerCase() ||
    t.authorEmail?.toLowerCase() === userContext.email?.toLowerCase();

  // If I created it, it is NOT an orphan for the purpose of "Shared Projects"
  if (isCreatedByMe) {
    return false;
  }

  const isOrphaned = hasOrphanedProject || isCrossUnit || isAssignedOrphan;
  return isOrphaned;
}) || [];
```

**Key Changes:**
- Added `isCreatedByMe` check using `createdByEmail` and `authorEmail` fields
- Early return `false` if the task was created by the current user
- This prevents self-created tasks from ever being considered "orphaned" for Shared Projects

#### TasksTab.tsx - Task Placement Logic

**File:** `src/components/unit-tabs/TasksTab.tsx`

**Props Update (Lines 528-530):**
```typescript
interface NewTasksTabProps {
  // ... existing props
  currentUserEmail?: string;
  kras: Kra[];
  kpis: Kpi[];
}
```

**Orphaned Project Fallback (Lines 695-702):**
```typescript
// 🚨 Virtual Bucket Fallback:
// If task has a projectId but the bucket is missing (e.g. shared from another unit),
// and we have a 'Shared Projects' virtual bucket, put it there.
// 🔒 SHARED GROUP FIX: Only if NOT created by me
const isCreatedByMe = currentUserEmail && (
  task.createdByEmail?.toLowerCase() === currentUserEmail.toLowerCase() ||
  task.authorEmail?.toLowerCase() === currentUserEmail.toLowerCase()
);

if (newBoardData['shared-tasks-virtual'] && !isCreatedByMe) {
  newBoardData['shared-tasks-virtual'].push(task);
  return;
}
```

**Cross-Unit Task Handling (Lines 707-720):**
```typescript
if (currentUnit && task.unit_id && task.unit_id !== currentUnit) {
  console.log(`🔍 [TasksTab] Shared Task Detected: Task '${task.title}' (ID: ${task.id}) unit '${task.unit_id}' !== current '${currentUnit}'`);
  
  // 🔒 SHARED GROUP FIX: Only if NOT created by me
  const isCreatedByMe = currentUserEmail && (
      task.createdByEmail?.toLowerCase() === currentUserEmail.toLowerCase() ||
      task.authorEmail?.toLowerCase() === currentUserEmail.toLowerCase()
  );

  if (newBoardData['shared-tasks-virtual'] && !isCreatedByMe) {
    newBoardData['shared-tasks-virtual'].push(task);
    return;
  }
}
```

#### Unit.tsx - Prop Passing

**File:** `src/pages/Unit.tsx` (Lines 885-887)

```typescript
<TasksTab
  // ... other props
  currentUserEmail={userContext?.email}
  kras={combinedKrasForTabs}
  kpis={kpiState.data || []}
/>
```

---

## Additional Fixes

### Missing Props for TaskDialog

While implementing the fix, discovered that `kras` and `kpis` were not being passed through to `TaskDialog`, causing lint errors.

**Fixed in:**
- `TasksTab.tsx` - Added `kras` and `kpis` to props interface
- `TasksTab.tsx` (Lines 1591-1593) - Passed props to `TaskDialog`
- `Unit.tsx` (Lines 886-887) - Passed data from parent component

### Type Safety Improvements

**File:** `src/components/unit-tabs/TasksTab.tsx` (Lines 1373-1388)

Fixed TypeScript errors where `status` string was being assigned to `Task['status']` union type:

```typescript
const handleStatusChange = (taskId: string, status: string) => {
  // ...
  const updatedTask = { ...task, status: status as Task['status'] };
  // ...
  editTask(taskId, { status: status as Task['status'] });
};
```

**File:** `src/pages/Unit.tsx` (Line 821)

Fixed onClick handler type mismatch:

```typescript
// Before:
<Button size="sm" onClick={handleCreateTask} disabled={isDataLoading}>

// After:
<Button size="sm" onClick={() => handleCreateTask()} disabled={isDataLoading}>
```

---

## Testing & Verification

### Manual Test Cases

1. **✅ Create Task (Self-Assignment)**
   - Action: Create a new task assigned to yourself
   - Expected: Task appears in its selected Group or "Uncategorized"
   - Expected: "Shared Projects" group does NOT appear

2. **✅ Incoming Shared Task**
   - Action: Have another user assign a task to you from a different unit
   - Expected: Task appears in "Shared Projects" bucket

3. **✅ Existing Tasks**
   - Action: Review existing board after fix
   - Expected: Self-created tasks move from "Shared Projects" to their correct buckets

### Edge Cases Handled

- ✅ Tasks with `projectId` but missing bucket (orphaned projects)
- ✅ Cross-unit tasks (different `unit_id`)
- ✅ Tasks without `projectId` (uncategorized)
- ✅ Tasks with both `createdByEmail` and `authorEmail` fields
- ✅ Case-insensitive email comparison

---

## Known Limitations

1. **Relies on SharePoint Metadata**
   - The fix depends on SharePoint's `Created By` field being correctly populated
   - If this field is missing or incorrect, the logic may not work as expected

2. **No Retroactive Fix**
   - Existing tasks in the database are not modified
   - The fix only affects how tasks are displayed, not the underlying data

3. **Email-Based Comparison**
   - Uses email addresses for user comparison
   - Assumes email addresses are unique and consistent

---

## Related Documentation

- [Task Visibility RBAC](file:///C:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/docs/TASK_VISIBILITY_RBAC.md)
- [Tasks Operations Logic](file:///C:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/docs/tasks_operations_logic.md)
- [User Group Customization](file:///C:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/docs/USER_GROUP_CUSTOMIZATION.md)

---

## Future Improvements

1. **Database Field**
   - Consider adding an explicit `isShared` boolean field to the Task schema
   - Would make the logic more explicit and easier to query

2. **Audit Trail**
   - Add logging for when tasks are moved between buckets
   - Track "Shared Projects" bucket visibility changes

3. **User Preferences**
   - Allow users to customize whether they want to see self-created tasks in a separate view
   - Add toggle for "Show My Tasks in Shared Projects"

4. **Performance Optimization**
   - Consider memoizing the `isCreatedByMe` check
   - Cache user email comparisons to reduce repeated string operations
