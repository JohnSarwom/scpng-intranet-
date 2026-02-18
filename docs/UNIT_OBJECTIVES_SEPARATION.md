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
    *   **Source**: `mockStrategyData.unitObjectives` (deprecated fallback).
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
*   **Update (Feb 2026)**: The mock fallback logic was **removed** from `useSharePointObjectives`.
    *   **Reason**: The greedy fallback masked actual data issues. If the backend returned 0 items (validly), the UI would show mock data, confusing users who expected to see their specific (but currently defined as 0) objectives.
    *   **Behavior**: The hook now trusts the service response. If `getObjectives` returns [], the UI shows an empty state, prompting the user to "Add Objective".

### Step 4: Logic Fixes & Context Injection
To ensure data consistency and visibility, the following logic was reinforced:

*   **Context Injection in `addObjective`**:
    *   **Problem**: New objectives were being created with a default or missing 'Division', causing them to be immediately filtered out by the `getObjectives` scope filter (which expects a match with the user's division).
    *   **Fix**: `useSharePointOps.ts` now automatically injects `context.division` as a fallback if the form data doesn't explicitly provide a department.
    *   **Code**: `await service.addObjective(item, department || context?.division);`

*   **Service-Side Filtering (`SharePointOpsService.ts`)**:
    *   The service fetches all items to avoid OData indexing limitations with complex filters.
    *   It then applies an in-memory filter based on `Scope` (Division/Unit/Individual) and `Context` (User's Division/Unit).
    *   **Debug**: If items are missing, check the server-side logs or enable debug logging in `getObjectives` to see why items are being rejected (e.g., "Division mismatch").

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
