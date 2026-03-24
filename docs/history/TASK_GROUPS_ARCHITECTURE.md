# Task Groups Architecture Separation

**Date:** February 26, 2026
**Topic:** Migration of Task Groups out of the `Operations_Projects` list into a dedicated `Operations_TaskGroups` list.

---

## 1. Overview
Previously, the intranet's "Task Groups" (custom buckets in the Tasks Tab) were stored under the generic `Operations_Projects` SharePoint list using a flag (`isCustomGroup: true`). This led to mixed concerns, potential data collision, and overly complex frontend filtering. 

We have now completely decoupled Task Groups into their own standalone SharePoint list: `Operations_TaskGroups`.

## 2. SharePoint List Topology

### New List: `Operations_TaskGroups`
A dedicated list to store column/bucket definitions for the Tasks Board.
- **Title (Text):** The name of the custom group.
- **Description (Note):** Optional detail about the group's purpose.
- **Status (Choice):** `Planned`, `In Progress`, `Completed`, `On Hold`.
- **Department (Text):** The unit/department this group belongs to.
- **Order (Number):** For controlling the display index of the bucket column. `-1` = "Assigned to Me" groups (pinned leftmost).
- **OwnerEmail (Text):** Empty = shared group visible to all. Non-empty = private "Assigned to Me" bucket for that email address. Set once at creation, immutable thereafter.

### Modified List: `Operations_Tasks`
Tasks now link directly to their corresponding group using a native Lookup Column.
- **RelatedTaskGroup (Lookup):** A lookup column pointing to the `Title` field of `Operations_TaskGroups`. Used via `RelatedTaskGroupLookupId` when writing.
- **AssigneeViewMap (Multi-line Text):** JSON map of per-assignee board column placements (e.g. `{"john@scpng.gov.pg":"3"}`). Allows each assignee to see a task in a different group without affecting the creator's placement. Added manually to the list schema.

## 3. Implementation Details

### A. Setup Layer (`sharePointListSetupService.ts`)
- `createTaskGroupsList()`: Creates `Operations_TaskGroups` with all 6 columns (Title, Description, Status, Department, Order, OwnerEmail).
- `setupTaskGroupsList()`: Orchestrates creation + links the `RelatedTaskGroup` lookup on `Operations_Tasks`.
- The setup now **force-recreates** the lookup column if it already exists, to handle stale references after list deletion/recreation (see Bug Fix #1 below).

### B. Service Layer (`sharePointOpsService.ts`)
- **API Endpoints:** Added `getTaskGroups`, `addTaskGroup`, `updateTaskGroup`, and `deleteTaskGroup` fetching directly from `LISTS.TASK_GROUPS`.
- **Mapping (`mapTask`):** Updated task mapping to properly decode `RelatedTaskGroupLookupId` into a clean `groupId` frontend property.
- **Updates (`updateTask` & `addTask`):** Task group assignment writes ONLY to `RelatedTaskGroupLookupId`. `RelatedProjectLookupId` is never written with group IDs (they target different lists — see Bug Fix #2 below).
- **Auto-ensure columns:** `ensureOwnerEmailColumn()` and `ensureAssigneeViewMapColumn()` run fire-and-forget on init to add missing columns.
- **Graceful fallback:** If `AssigneeViewMap` column doesn't exist, `addTask`/`updateTask` retry without it rather than failing the entire operation.

### C. Types Layer (`types/index.ts`)
- Created the explicit `TaskGroup` Interface representing the data shape.
- Extended the `Task` Interface to officially support `groupId`.

### D. Frontend/UI Layer
- **Data Hooks:** Implemented the `useSharePointTaskGroups()` hook to keep group state reactive using `react-query`.
- **`TestGround.tsx`:** Added an independent "Setup Task Groups List" action card for easy admin list initialization.
- **`Unit.tsx` (The Glue):** 
  - Purged the old logic that injected `projectState` data into the `TaskTab` buckets.
  - Sourced the buckets natively from `useSharePointTaskGroups`.
  - Refactored Orphan Task logic to bind dropped tasks accurately utilizing the new `groupId`.
- **`TasksTab.tsx`:** 
  - Updated typing so the column-header management expects `TaskGroup` objects instead of `Project` objects.
  - Patched the Drag-and-Drop (`handleDragEnd`) mechanic to target the task's `groupId` payload during optimistic UI updates and server patch calls.

## 4. Initialization Workflow
If deployed to a fresh SharePoint environment or after wiping lists:
1. Navigate to `/testground` (Admin context required).
2. Locate the **Operations & Strategy** list setup section.
3. Click the **Setup Task Groups List** button.
4. Verify the success toast, which indicates the list and lookup relationships were effectively established.

## 5. UI Enhancements & State Management
Recent improvements have stabilized the UI during group creation and deletion:
- **Optimistic UI Synchronization**: `Unit.tsx` seamlessly propagates new groups using `useMemo` dependencies tied to `React Query` cache. This replaces error-prone local state mutations in `TasksTab.tsx` that previously caused temporary missing groups or form input bypass.
- **Pessimistic Rollbacks**: If a deletion API call fails due to active dependency constraints, the operation is correctly intercepted, throwing the error back to `TasksTab.tsx` to automatically halt UI removal (preventing the "ghost item" bug).
- **Graceful Loading States**: Modals and fast-action text inputs strictly disable during inflight operations (e.g., `<Button disabled={isCreatingGroup}>`). This inherently blocks duplicate POST submissions and accidental keyboard renaming prior to the successful backend response.

## 6. Bug Fixes — March 17, 2026 (9:30 PM PGT)

### Bug Fix #1: Stale Lookup Column after List Recreation
**Symptom:** "Failed to create group" and "One of the provided arguments is not acceptable" errors when creating groups or dragging tasks between groups.

**Root Cause:** The `Operations_TaskGroups` list had been deleted and recreated at some point, giving it a new SharePoint list ID. However, the `RelatedTaskGroup` lookup column on `Operations_Tasks` still pointed to the **old** (now-deleted) list ID. Writing a TaskGroup item ID to `RelatedTaskGroupLookupId` failed because SharePoint validated the ID against the stale target list.

**Fix:**
- `setupTaskGroupsList()` now **force-recreates** the lookup column: it fetches ALL columns from `Operations_Tasks`, finds the `RelatedTaskGroup` lookup by matching both `name` and `lookup` properties (Graph API `$filter` on column name is unreliable — it can return the wrong column, e.g. the built-in Title column), deletes the old lookup, and creates a fresh one pointing to the correct list.
- The `OwnerEmail` column was also missing from the original `createTaskGroupsList()` schema — it was added dynamically at runtime via `ensureOwnerEmailColumn()`. Now included in the creation schema directly.

### Bug Fix #2: Cross-List Lookup ID Conflict
**Symptom:** "One of the provided arguments is not acceptable" when moving tasks between groups via drag-and-drop.

**Root Cause:** `updateTask()` and `addTask()` wrote the group ID to **both** `RelatedProjectLookupId` (lookup to `Operations_Projects`) and `RelatedTaskGroupLookupId` (lookup to `Operations_TaskGroups`). A TaskGroup ID (e.g. `2`) that exists in `Operations_TaskGroups` does not exist in `Operations_Projects`, so SharePoint rejected the write.

**Fix:** Removed all writes of TaskGroup IDs to `RelatedProjectLookupId`. Group assignment now only writes to `RelatedTaskGroupLookupId`. This applies to `addTask()`, `updateTask()` (both the `projectId` and `groupId` code paths).

### Bug Fix #3: AssigneeViewMap Column Missing
**Symptom:** "Field 'AssigneeViewMap' is not recognized" when dragging tasks.

**Root Cause:** The `AssigneeViewMap` column did not exist on the `Operations_Tasks` SharePoint list. The `ensureAssigneeViewMapColumn()` fire-and-forget check during init was not reliably creating it.

**Fix:**
- Column was manually added to `Operations_Tasks` as a multi-line text field.
- `addTask()` and `updateTask()` now have graceful fallback: if writing `AssigneeViewMap` fails with a column-not-recognized error, the operation retries without it, so drag-and-drop still works even if the column is missing.

### Required SharePoint Schema (Operations_Tasks)
For reference, the complete column set required on `Operations_Tasks`:
| Column | Type | Notes |
|---|---|---|
| Title | Single line of text | Task name |
| Description | Multiple lines of text | Task description |
| Status | Choice | Todo, In Progress, On Hold, Review, Done |
| Priority | Choice | Low, Medium, High, Urgent |
| DueDate | Date and Time | |
| StartDate | Date and Time | |
| Department | Single line of text | Unit name |
| SubtasksJSON | Multiple lines of text | JSON array of subtasks |
| CommentsJSON | Multiple lines of text | JSON array of comments |
| Tags | Multiple lines of text | Comma-separated tags |
| Recurrence | Single line of text | none, daily, weekly, monthly |
| Assignees | Multiple lines of text | JSON array of assignee objects |
| AssigneeViewMap | Multiple lines of text | JSON map of per-user group placements |
| IsMockData | Yes/No | |
| CompletionDate | Single line of text | Auto-set when status = Done |
| RelatedProject | Lookup | Points to Operations_Projects |
| RelatedKRA | Lookup | Points to Performance_KRAs |
| RelatedKPI | Lookup | Points to Performance_KPIs |
| RelatedTaskGroup | Lookup | Points to Operations_TaskGroups |
