# KPI and Task Synchronization Architecture

This document outlines the technical architecture, known challenges, and implemented solutions for the bidirectional synchronization between **Key Performance Indicators (KPIs)** and **Tasks** within the SCPNG Intranet.

## 1. Executive Summary

The system maintains a bidirectional link between Daily Tasks and KPI Checklist items. Completion of a task should automatically update its parent KPI, and conversely, checking an item in the KPI Modal should update the underlying task status.

Due to the distributed nature of the SharePoint Graph API and its background indexing processes, simple "save and refetch" patterns are insufficient. We employ a **Triple-Layer Strategy** (Backend Overrides, Optimistic UI, and Delayed Reconsolidation) to ensure data integrity and a smooth user experience.

---

## 2. Technical Challenges

### A. SharePoint Indexing Lag (Read-After-Write Consistency)
When a task is updated via a `PATCH` request, SharePoint's indexer may take 500ms to 3 seconds to reflect that change in `GET` requests.
*   **The Bug:** If the backend or frontend tries to "Sync" or "Fetch" immediately after an update, it receives the **stale** (old) data, effectively overwriting the new change with old values.

### B. Cascading State Transitions
A KPI's status is derived from its checklist.
*   **0% Complete:** Status = `Not Started` or `Open`
*   **1% - 99% Complete:** Status = `In Progress` or `On Track`
*   **100% Complete:** Status = `Completed`
*   **The Bug:** Previously, the system would often fail to transition from `Not Started` to `In Progress` when the first task was checked, or would stay "Completed" even if a task was unchecked.

---

## 3. Synchronization Flow

```mermaid
sequenceDiagram
    participant User as User (UI)
    participant Hook as useTaskState / useSharePointUpdates
    participant SP as SharePoint (Graph API)
    participant Sync as syncKPIChecklist (Service)

    User->>Hook: Toggle Task Complete
    Hook->>SP: PATCH Task Status
    activate SP
    SP-->>Hook: Success (New ID/Status)
    deactivate Hook

    Note over Sync: Race Condition Triggered!
    Hook->>Sync: Trigger Sync (with Override Data)
    activate Sync
    Sync->>SP: GET All Tasks for KPI (STALE)
    SP-->>Sync: Return Stale Task List
    Sync->>Sync: Apply Override (Force New Status)
    Sync->>SP: PATCH KPI ChecklistJSON & Status
    Sync-->>User: Refresh UI (Delayed)
    deactivate Sync
```

---

## 4. Implementation Details

### Layer 1: Backend Sync with Override
Located in `sharePointOpsService.ts` within `syncKPIChecklistFromTasks`.

The service accepts an `updatedTaskData` object. When it fetches linked tasks from SharePoint, it performs a lookup. If a fetched task ID matches the "freshly updated" task, it ignores the status from the API and uses the local override:

```typescript
// sharePointOpsService.ts snippet
const activeStatus = isUpdatedTask && updatedTaskData.status
    ? updatedTaskData.status
    : matchingTask.fields.Status; // Use API data only if not just updated
```

### Layer 2: Frontend Optimistic UI
Located in `useSharePointOps.ts` hooks (`useSharePointKPIs`).

To prevent the UI from "flickering" back to a stale state while the background refresh happens, we manually update the React Query cache:

```typescript
// useSharePointOps.ts
queryClient.setQueryData(queryKey, (oldData) => {
    return oldData.map(kpi => kpi.id === id ? { ...kpi, ...updates } : kpi);
});
```

### Layer 3: Controlled Refresh Delay
Located in `TasksTab.tsx`.

When a task update completes, we do not call `onDataRefresh()` (which fetches everything) immediately. We introduce a **2500ms delay** to allow SharePoint's indexers to finish processing the change.

---

## 5. State Transition Logic

The following truth table is implemented in both `KpiInputBlock.tsx` (Frontend) and `sharePointOpsService.ts` (Backend) to ensure consistent behavior:

| Checklist State | Current Status | New Status |
| :--- | :--- | :--- |
| All Checked | Any | `Completed` |
| Some Checked | `Not Started` / `Completed` | `In Progress` |
| None Checked | `Completed` | `In Progress` |
| None Checked | `In Progress` | `In Progress` (Manual Override remains) |

---

## 6. How to Extend

1.  **Adding new status types:** Ensure you update the `TASK_DONE_STATUSES` array and the `mapStatusToDbFormat` utility in `KRAsTab.tsx`.
2.  **Modifying calculation types:** If adding a new calculation type (e.g., "Weight-based"), you must update the `calculateKpiProgress` utility in `strategyAnalyticsUtils.ts` to ensure consistency between the Dashboard and the Unit views.
