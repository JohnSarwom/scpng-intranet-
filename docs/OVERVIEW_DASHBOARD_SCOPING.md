# Overview Dashboard: View Scope & Staff Performance Analysis

This document outlines the implementation of the dynamic **View Scope** filtering and the **Staff Performance Analysis** section within the Overview Dashboard.

## 1. Objective
To provide managers and admins with a unified interface to switch between individual, unit-level, and division-level performance metrics, while introducing deep visibility into individual staff member performance within a unit.

> [!NOTE]
> For a full summary of the final implementation, see the [Implementation Summary](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/docs/DASHBOARD_VIEW_SCOPE_IMPLEMENTATION.md).

## 2. Feature Architecture

### A. View Scope Mechanism
The dashboard now includes a "View Scope" dropdown (top-right of the Overview tab) that triggers a re-calculation of all metrics.

| Scope | Data Source Logic |
| :--- | :--- |
| **My Data** | Filters data where the current user is the owner, creator, or primary assignee. |
| **Unit** | Filters data where the owner/creator/assignee belongs to the user's unit (via `DivisionStaffMap`). |
| **Division** | Shows all data available to the user's division (Manager view) or entire org (Admin view). |

### B. Hierarchical Data Flow (ASCII Diagram)

```text
+-----------------------+      +-----------------------------------------+
|   SharePoint Lists    |      |        useSharePointOps Hooks           |
| (Tasks, KRAs, KPIs)   | <--> | (Server-side fetch + Client-side RBAC)  |
+-----------------------+      +-----------------------------------------+
                                                |
                                                v
                               +-----------------------------------------+
                               |         OverviewTab Component           |
                               | (Receives raw props: tasks, kras, obj)  |
                               +-----------------------------------------+
                                                |
                                                | [useMemo: Scoping Logic]
                                                v
               +-----------------------------------------------------------------------+
               |                                                                       |
      [Individual Scope]                [Unit Scope]                      [Division Scope]
      Match: User Email              Match: Unit Roster Emails            Match: All/Division
               |                               |                               |
               v                               v                               v
      +---------------------------------------------------------------------------------+
      |                 Shared Computation Engine (Overview Performance)                |
      |          (Task Completion%, KRA Health, KPI Status, Metric Cards)               |
      +---------------------------------------------------------------------------------+
                                                |
                                                | (If ViewScope == 'Unit')
                                                v
                               +-----------------------------------------+
                               |     Unit Staff Performance Section      |
                               | (Individual cards with Weighted Scores) |
                               +-----------------------------------------+
```

## 3. Staff Performance Scoring Logic

When the **Unit Scope** is active, a performance card is generated for every member of the unit's roster (derived from `DivisionStaffMap`).

### The Formula
Individual performance is computed using a weighted average of three primary work streams:
- **Daily Tasks (40%)**: `Completed Tasks / (Total Active + Completed)`
- **KPI Health (40%)**: `(Achieved + On Track) / Total KPIs`
- **KRA Progress (20%)**: `(Completed + On Track) / Total KRAs`

### Performance Thresholds
- **80% - 100%**: 🟢 Excellent
- **60% - 79%**: 🔵 Good
- **40% - 59%**: 🟠 Fair
- **0% - 39%**: 🔴 Needs Attention

## 4. Implementation Details

### Files Modified
1. **`src/hooks/useSharePointOps.ts`**:
   - Updated `useSharePointTasks` to allow Managers to see all tasks belonging to their unit's roster, bypassing the "Personal Only" filter applied to regular staff.
2. **`src/components/unit-tabs/OverviewTab.tsx`**:
   - Integrated `DivisionStaffMap` for robust email-based roster matching.
   - Implemented `scopedTasks`, `scopedKras`, and `scopedObjectives` memos.
   - Added the rendering logic for Staff Performance cards.
3. **`src/pages/Unit.tsx`**:
   - Passed the global `userContext` down to the dashboard.

### Robustness & Security
- **Email-Based Matching**: Transitioned away from string-based unit names (e.g., "IT Unit") for filtering, as strings can vary between platforms. We now anchor on email addresses which are definitive.
- **Service Account Filtering**: Automatically excludes system accounts (e.g., Facility, IT Service) from performance analytics to ensure data accuracy.
- **RBAC Enforcement**: The "View Scope" dropdown is hidden for standard staff members, ensuring they only ever interact with their own personal performance data.

## 5. Summary of Roles

| Role | Available Scopes | UI Behavior |
| :--- | :--- | :--- |
| **Staff Member** | Individual | Dropdown Hidden. |
| **Unit Manager** | Individual, Unit | Dropdown Visible. Unit view shows team roster. |
| **Admin / Super** | Individual, Unit, Division | Full access to all levels. |
