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
- **Order (Number):** For controlling the display index of the bucket column.
- **Department (Text):** The unit/department this group belongs to.

### Modified List: `Operations_Tasks`
Tasks now link directly to their corresponding group using a native Lookup Column.
- **[NEW] RelatedTaskGroup `LookupId`:** A lookup column pointing natively to the `Title` field of `Operations_TaskGroups`.

## 3. Implementation Details

### A. Setup Layer (`sharePointListSetupService.ts`)
- Introduced a new setup method `setupTaskGroupsList()`. 
- Ensures that running the setup creates `Operations_TaskGroups` from scratch.
- Programmatically adds the `RelatedTaskGroup` lookup definition to `Operations_Tasks`.

### B. Service Layer (`sharePointOpsService.ts`)
- **API Endpoints:** Added `getTaskGroups`, `addTaskGroup`, `updateTaskGroup`, and `deleteTaskGroup` fetching directly from `LISTS.TASK_GROUPS`.
- **Mapping (`mapTask`):** Updated task mapping to properly decode `RelatedTaskGroupLookupId` into a clean `groupId` frontend property.
- **Updates (`updateTask` & `addTask`):** Ensured that moving a task into a custom bucket securely patches the destination group's ID into `RelatedTaskGroupLookupId` rather than the `projectId` lookup.

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

