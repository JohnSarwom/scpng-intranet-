# Task Behavioural UX Fixes

**Date**: March 3, 2026
**Components Modified**: `TaskCard.tsx`, `TasksTab.tsx`
**Impact**: Resolved 10 behavioural UX issues affecting user trust, interaction patterns, and feedback consistency across board, list, and grid views.

---

## Overview

A behavioural UX audit identified 13 issues in how the task management system responds to user actions — timing, feedback loops, state consistency, and interaction patterns. This update addresses 10 of those issues (the remaining 3 were already handled or require backend changes).

---

## Fix 1 — Card Body Click Opens Edit Dialog

### Problem
Task cards had a hover effect (shadow elevation) making them appear clickable, but clicking the card body did nothing. Users had to locate the tiny 14px pencil icon to open a task. This contradicts the visual affordance — every major task tool (Trello, Jira, Asana) treats the entire card as a click target.

### Solution
Added `onClick={() => onEditTask(task.id)}` to all `TaskCard` instances in BoardLane (incomplete + completed tasks) and GridView. The existing `BaseCard` component already prevents card clicks from firing when interacting with buttons or links via `e.target.closest('button, a')`.

### Files Changed
- `TasksTab.tsx` — BoardLane incomplete tasks, BoardLane completed tasks, TaskGridView

---

## Fix 2 — Removed Premature Success Toasts on Inline Updates

### Problem
The `applyTaskUpdate` function fired a success toast **immediately** before the API call resolved. If the API then failed, the user saw "Priority Updated" followed by "Update Failed... Changes reverted." — a contradictory double-notification that erodes trust.

### Solution
Removed the instant `toast(successMessage)` call from `applyTaskUpdate`. The visual optimistic change on the card (badge colour/text update) is now the primary feedback. Only failure/rollback toasts are shown. This matches the industry standard pattern used by Trello and Notion — silent success, loud failure.

### Files Changed
- `TasksTab.tsx` — `applyTaskUpdate()` function

---

## Fix 3 — Soft-Delete with Genuine Undo

### Problem
When deleting a task, the "Undo" button in the toast only restored the task to local `boardData` state. It did **not** cancel or reverse the API deletion. The user would click "Undo", see the task reappear, but on next page refresh the task was gone permanently.

### Solution
Implemented a soft-delete pattern with a 5-second grace period:

1. Task is removed from the UI immediately (optimistic).
2. The actual `deleteTask()` API call is **delayed** by 5 seconds using `setTimeout`.
3. A `pendingDeletes` ref (`Map<string, TimeoutId>`) tracks pending deletions.
4. The "Undo" button in the toast calls `clearTimeout()` to cancel the pending API delete, then restores the task to `boardData`.
5. If the timeout fires without undo, the API delete proceeds normally with error rollback.
6. The toast `duration` matches the grace period so the undo button remains visible for the full window.

### Files Changed
- `TasksTab.tsx` — `pendingDeletes` ref, `confirmDeleteItem()` function

---

## Fix 4 — Same-Column Drag Clarification

### Problem
Dragging a task within the same column appeared to work (card lifts, follows cursor) but then snapped back with no feedback. Users expected reordering behaviour.

### Solution
This is intentionally disabled — implementing within-column reordering requires an `order` field on tasks (backend change). Clarified the code comment to explain this is a known limitation, not a bug.

### Files Changed
- `TasksTab.tsx` — `handleDragEnd()` same-column branch comment

---

## Fix 5 — Recurring Task Rescheduled Feedback

### Problem
When a recurring task was marked complete, the code silently created a new task with the next occurrence date via `addTask()`. There was no toast, no visual indication, and no animation. Users saw a new task appear with no explanation of why — leading them to think their task "uncompleted itself."

### Solution
Added a toast notification after the recurring task is created: `"Recurring Task Rescheduled — Next occurrence scheduled for {formatted date}"`.

### Files Changed
- `TasksTab.tsx` — `handleToggleComplete()` recurrence branch

---

## Fix 6+7 — Replaced Custom Dropdowns with Radix DropdownMenu

### Problem
The status and priority inline dropdowns on task cards were implemented as custom `absolute`-positioned `<div>` elements. Inside a scrollable kanban column, these dropdowns got **clipped** by the column's overflow. Additionally, the click-outside handler had a logic bug — it used `&&` across all three refs, meaning it only closed dropdowns when clicking outside **all three simultaneously**. If a ref was `null` (dropdown not rendered), the condition short-circuited to `false` and clicking outside did not close the open dropdown.

### Solution
- Replaced custom dropdown divs with `DropdownMenu` / `DropdownMenuContent` / `DropdownMenuItem` from the existing Radix UI library. These portal to the document body and are never clipped by parent overflow.
- Removed all custom dropdown state (`showPriorityDropdown`, `showStatusDropdown`, `showAssigneeDropdown`).
- Removed all manual refs (`priorityDropdownRef`, `assigneeDropdownRef`, `statusDropdownRef`).
- Removed the buggy `useEffect` click-outside handler entirely — Radix handles this natively.

### Files Changed
- `TaskCard.tsx` — imports, state cleanup, footer content status/priority dropdowns

---

## Fix 8 — Formatted Due Date in List View

### Problem
The list view table rendered the raw `task.dueDate` value, displaying ISO strings like `2026-03-15T00:00:00.000Z` instead of a human-readable date. The board view formatted dates correctly, but the list view was missed.

### Solution
- Replaced `{task.dueDate}` with `format(new Date(task.dueDate), 'MMM d, yyyy')` using date-fns.
- Added overdue styling (red text + bold) when the due date is in the past and the task is not completed.
- Added graceful fallback (`—`) for missing or invalid dates.

### Files Changed
- `TasksTab.tsx` — imports (`format`, `isBefore`, `isValid` from date-fns), `TaskListView` due date cell

---

## Fix 9+10 — Inline Editing and Multi-Assignee in List View

### Problem
The list view rendered status and priority as **static badges** with no click handlers. Users had to open the full edit dialog for every change — a significant productivity gap compared to the board view where these are clickable inline dropdowns. Additionally, the `TaskListView` component interface was missing `onAssigneesChange` (plural), so multi-assignee updates were impossible.

### Solution
- Replaced static `<Badge>` elements for priority and status with `DropdownMenu` triggers that call `onPriorityChange` and `onStatusChange` respectively.
- Added a new "Status" column to the table header.
- Added colour-coded status and priority maps (`statusColorsMap`, `statusLabelsMap`, `priorityColorsMap`) for the list view.
- Added `onAssigneesChange` to the `TaskListView` props interface and wired it through from the parent `TasksTab` component.

### Files Changed
- `TasksTab.tsx` — `TaskListView` interface, table header, status/priority cells, parent call site

---

## Fix 12 — Filter Panel Stays Open for Multi-Select

### Problem
The filter panel used `DropdownMenu` which **closes on any item interaction** by default (Radix behaviour). When a user clicked a priority checkbox, the entire filter dropdown closed. Selecting multiple filters required reopening the dropdown for each selection.

### Solution
Replaced the filter `DropdownMenu` / `DropdownMenuTrigger` / `DropdownMenuContent` with `Popover` / `PopoverTrigger` / `PopoverContent`. The Popover component stays open on internal clicks by default, allowing users to check/uncheck multiple filters in a single interaction.

### Files Changed
- `TasksTab.tsx` — filter panel (Priority, Status, Groups, Assignees sections)

---

## Verification Checklist

- [ ] Board view: Click card body → opens edit dialog
- [ ] Board view: Click status/priority badge → dropdown appears above scroll overflow, not clipped
- [ ] Board view: Change status/priority → no success toast, only failure toast on error
- [ ] Board view: Delete task → click Undo within 5s → task persists after refresh
- [ ] Board view: Complete a recurring task → see "Recurring Task Rescheduled" toast
- [ ] List view: Due date shows formatted date (e.g. "Mar 15, 2026"), red if overdue
- [ ] List view: Click priority/status badges → inline dropdown appears
- [ ] List view: Status column visible in table header
- [ ] Grid view: Click card body → opens edit dialog
- [ ] Filter button: Click multiple checkboxes → panel stays open between selections
- [ ] Drag task within same column → snaps back (no change, expected behaviour)
