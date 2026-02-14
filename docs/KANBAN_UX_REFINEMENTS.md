# Kanban UX Refinements: Drag-and-Drop & Feedback Loops

**Date**: February 12, 2026
**Components Modified**: `TasksTab.tsx`
**Impact**: Resolved critical "lying UI" issues and drag-and-drop usability defects.

---

## Overview

This update addresses three critical UX findings from the recent audit:
1.  **"Lying" Feedback Loop**: Success toasts appearing even when moves failed (silent rejection).
2.  **"Aiming" Bug**: Dragged items targeting columns "2 steps away" from the actual cursor position.
3.  **Lack of Affordance**: No visual indication of valid drop zones.

---

## 1. Feedback Loop Integrity

### Problem
The "Success" toast was triggered *optimistically* before the backend API call completed. If the API or business logic rejected the move (causing the card to snap back), the user still saw "Task Moved Successfully", creating a state of cognitive dissonance.

### Solution
- **Deferred Toast**: Moved the success notification *inside* the `performUpdate` async function, ensuring it only triggers after a `200 OK` from the server.
- **Contextual Messages**: Toasts now explicitly state: `Moved "[Task Name]" to [Column Name]`.
- **Error Handling**: Failed moves now trigger a red "Move Failed" toast with an explanation, replacing the confusing success message.
- **Undo Action**: Added an "Undo" button to the success toast for quick reversion.

---

## 2. Drag-and-Drop Precision (The "Aiming" Bug)

### Problem
The `closestCorners` collision detection algorithm from `dnd-kit` was struggling with the horizontally scrolling Kanban layout. This caused the system to highlight columns far away from the mouse cursor, leading to unintuitive drops.

### Solution
- **Switched to `pointerWithin`**: Changed the collision detection strategy to `pointerWithin`. This algorithm uses the browser's native hit-testing under the cursor, ignoring complex bounding box calculations and ensuring the target is *exactly* what the user is hovering over.

### Code Change (`TasksTab.tsx`)
```typescript
<DndContext
  sensors={sensors}
  collisionDetection={pointerWithin} // Replaced closestCorners
  onDragEnd={handleDragEnd}
  // ...
>
```

---

## 3. Visual Affordance

### Problem
Valid drop zones (columns) looked identical to invalid areas, violating Fitts's Law and visibility heuristics.

### Solution
Enhanced the `BoardLane` component to provide clear visual feedback when a draggable item is hovering over it.

### Visual Changes
- **Border**: Dashed primary color border (`border-primary border-dashed`)
- **Background**: Accented background (`bg-accent/50`)
- **Ring**: Subtle focus ring (`ring-2 ring-primary/10`)

---

## Verification

### Scenario A: Successful Move
1.  User drags task to "Publications".
2.  "Publications" highlights with dashed border.
3.  User drops.
4.  Card stays (optimistic update).
5.  ~200ms later: Success Toast appears with "Undo" button.

### Scenario B: Failed Move (Constraints)
1.  User drags task to restricted column.
2.  User drops.
3.  Card snaps back to original column.
4.  **No Success Toast**.
5.  **Error Toast** appears: "Cannot move task to this column".

---

## 4. ID Collision Fix (Group Drop Targets)

**Date**: February 12, 2026

### Problem
Dragging tasks to certain custom groups (e.g., "Firewall Upgrade") silently failed. The task would snap back to its original column. This occurred because both **Task IDs** and **Group/Column IDs** are numeric strings sourced from SharePoint (e.g., `"10"`, `"42"`). When a task and a group share the same ID, `dnd-kit`'s collision detection cannot distinguish between "hovering over a task" and "hovering over a column", causing the drop to misfire or be ignored entirely.

### Root Cause
- `BoardLane` passed its raw `id` prop (e.g., `"10"`) directly to `useDroppable({ id })`.
- `TaskCard` (via `useSortable`) also used its raw task `id` (e.g., `"10"`).
- When IDs collided, `dnd-kit` could not resolve the correct droppable target.

### Solution
- **Prefixed Column IDs**: Modified `BoardLane` to register its droppable zone with a prefixed ID: `group-${id}`.
- **Updated `handleDragEnd`**: Added logic to detect and strip the `group-` prefix when determining the destination column.

### Code Changes (`TasksTab.tsx`)

**BoardLane** — Prefixed droppable ID:
```typescript
const dropId = `group-${id}`;
const { setNodeRef, isOver: isDroppableOver } = useDroppable({ id: dropId });
```

**handleDragEnd** — Prefix-aware destination resolution:
```typescript
const isGroupDrop = overId.startsWith('group-');
if (isGroupDrop) {
    destinationColumnId = overId.replace(/^group-/, '');
}

const isOverColumn = isGroupDrop
    || Object.keys(boardData).includes(overId)
    || activeBuckets.some(b => b.id === overId);
```

### Verification

| Scenario | Expected Result |
|---|---|
| Drag task to "Firewall Upgrade" (ID collision) | Task moves successfully, toast confirms |
| Drag task to any other custom group | Works as before |
| Drag task onto another task in a different column | Resolves to that column correctly |

---

## Files Modified
- [`src/components/unit-tabs/TasksTab.tsx`](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/components/unit-tabs/TasksTab.tsx)
