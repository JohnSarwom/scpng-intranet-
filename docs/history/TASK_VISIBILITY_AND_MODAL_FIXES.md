# TasksTab Fixes: Uncategorized Tasks & Full Screen Modals

**Date:** 2026-04-14
**Component:** `src/components/unit-tabs/TasksTab.tsx`

This document details two critical bug fixes applied to the `TasksTab` component.

## 1. Uncategorized Tasks Board Logic Fix

### Issue
Previously, if a user created a task without assigning it to a group (so the `effectiveProjectId` was either missing or mapped to a non-existent active bucket), the task automatically fell into the `uncategorized-virtual` bucket. However, this bucket was visible to _all_ users viewing the board, meaning users were seeing other people's orphaned tasks. 

### Solution
The board distribution logic was updated to add a creator check before placing any task into the `uncategorized-virtual` bucket.

- A helper calculates `isTaskCreator` by comparing `currentUserEmail` with the task's `createdByEmail` or `authorEmail`.
- If a task has no group (or its group doesn't match any active bucket), it **only** appears in the "Uncategorized" bucket if the current user created it.
- Someone else's ungrouped tasks will now only appear on the creator's board under their own uncategorized column, eliminating clutter for everyone else.

```tsx
// Helper: check if the current user created this task
const normalizedCurrentEmail = (currentUserEmail || '').toLowerCase();
const isTaskCreator =
  task.createdByEmail?.toLowerCase() === normalizedCurrentEmail ||
  task.authorEmail?.toLowerCase() === normalizedCurrentEmail;

// ... Inside fallback logic checks ...
if (isTaskCreator) {
  if (!newBoardData['uncategorized-virtual']) {
    newBoardData['uncategorized-virtual'] = [];
  }
  newBoardData['uncategorized-virtual'].push(task);
}
```

## 2. Full-Screen Modal Visibility Fix (Tasks & Deletions)

### Issue
When the user entered Full-Screen mode on the Kanban board, attempting to Add or Edit a task via the `TaskDialog` would not show the pop-up modal, making the screen appear unresponsive. 

Both `AlertDialog` (for deletions) and `TaskDialog` (for Add/Edit) were placed *outside* of the `containerRef` element. Although both were receiving `container={isFullScreen ? containerRef.current : null}` allowing them to portal inside the React Tree, the Full-Screen API creates a restricted stacking context. `AlertDialog` intermittently worked, but `TaskDialog` was completely masked due to `overflow: hidden` and z-index contexts.

### Solution
Both dialog components were structurally moved **inside** the `containerRef` DOM structure (the div tracking full-screen sizing). 

By ensuring the modals exist directly inside the DOM hierarchy of the Full-Screen wrapper element rather than relying purely on portals to pierce the full-screen boundaries, the stacked components can reliably render in the top layer.

**Structural Update:**
```tsx
<div>
  <main>
    {/* FULL SCREEN CONTAINER */}
    <div ref={containerRef}>
      ... header ...
      ... board ...
      
      {/* MOVED INSIDE containerRef */}
      <AlertDialog ... />
      <TaskDialog ... />
    </div>
  </main>
</div>
```

This structural shift resolved the UI clipping, allowing interactions over the Kanban board without exiting Full-Screen Mode.
