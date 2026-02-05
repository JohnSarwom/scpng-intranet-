# Unit Objectives Separation & Implementation Guide

## 1. Overview
This document details the architectural change to separate **Unit Objectives** (operational, team-specific goals) from **Strategic Objectives** (organization-wide, board-level goals). Previously, the application relied on a single source or hardcoded connections; the new implementation introduces a dedicated SharePoint list and distinct data flow for Unit Objectives.

## 2. Architecture Changes

### Data Separation
We moved from a unified/ambiguous objective model to two distinct entities:

1.  **Strategic_Objectives (List)**:
    *   **Scope**: High-level organizational goals (Board/Executive).
    *   **Goal Type**: 'Org'.
    *   **Owned By**: Division Directors / Executives.
    *   **Source**: `mockStrategyData.objectives`.

2.  **Unit_Objectives (List) [NEW]**:
    *   **Scope**: Operational execution goals (Departments/Units).
    *   **Goal Type**: 'Unit'.
    *   **Owned By**: Unit Managers / Leads.
    *   **Source**: `mockStrategyData.unitObjectives`.
    *   **Lookup**: Can optionally link back to a parent `Strategic_Objective`.

### Service Layer Updates
*   **SharePointListSetupService**: Updated to provision the new `Unit_Objectives` list with a specific schema (GoalType, Division, Unit, Progress, etc.) and seed it with realistic mock data.
*   **SharePointOpsService**: The `getObjectives` method was updated to fetch from the `Unit_Objectives` list instead of reusing the Strategic list.

---

## 3. Implementation Details

### Step 1: Mock Data (`src/mockData/strategyData.ts`)
We added a specific `unitObjectives` array to the mock data.
```typescript
unitObjectives: [
    {
        id: "unit-obj-1",
        title: "Process Q1 Licensing Batch",
        goalType: "Unit",
        owner: "Licensing Team",
        // ...
    },
    // ...
]
```

### Step 2: List Provisioning (`SharePointListSetupService.ts`)
We added a `createUnitObjectivesList` method that defines the SharePoint schema:
*   **Columns**: GoalType (Choice), Division (Text), Unit (Text), Progress (Number), Status (Choice), Dates (DateTime).
*   **Seeding**: The `seedStrategyHubUnitObjectives` method populates this list. It **infers** the Division and Unit columns based on the 'Owner' field (e.g., "IT Unit" -> "IT Division") to ensure filters work correctly during testing.

### Step 3: Frontend Integration (`Unit.tsx` & `useSharePointOps.ts`)
*   The **Unit Page** (`Unit.tsx`) calls `useSharePointObjectives`.
*   We modified `useSharePointOps.ts` to fallback to `mockStrategyData.unitObjectives` (instead of Strategic ones) if the live list is empty or fails to load. This ensures that even in a dev/offline environment, the UI displays contextually relevant "Unit" data.

---

## 4. Admin Visibility & Verification

### Admin Privileges
Users with the `admin` or `super_admin` role bypass standard Division/Unit filters.
*   **Admin View**: Sees ALL items in the `Unit_Objectives` list.
*   **Regular User**: Sees only items matching their Division/Unit profile.

### Verification Checklist
1.  **Deploy Engine**: Go to "Test Ground" -> "Deploy Strategy Engine". This creates/resets the lists.
2.  **Check SharePoint**: Verify a new list named `Unit_Objectives` exists and contains items like "Process Q1 Licensing Batch".
3.  **Check UI**:
    *   Go to **Unit Page** -> **Objectives Tab**.
    *   Verify the table shows "Unit" in the **Goal Type** column (Grey badge), NOT "Org" (Red badge).
    *   If you see "Unit", the separation is successful.

---

## 5. Troubleshooting
*   **Problem**: I still see "Strategic Objectives" on the Unit Page.
    *   **Cause**: The application might be falling back to the wrong mock data source, or your backend list still contains old data.
    *   **Fix**: Ensure `useSharePointOps.ts` fallback is pointing to `unitObjectives`. Run "Reset Strategy Engine" and then "Deploy Strategy Engine" again to flush old data.
