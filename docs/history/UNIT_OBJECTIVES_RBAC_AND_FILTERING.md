# Unit Objectives: RBAC & Data Filtering Integration

**Date:** February 2026
**Focus:** Enforcing Role-Based Access Control (RBAC) and data isolation across the Unit Objectives ecosystem (KRAs, Projects, and Insights).

## Core Objectives
1. **KRA/KPI Table:** Allow staff to view KPI details safely without editing access.
2. **Projects Page:** Constrain project visibility for staff members while allowing full visibility for managers.
3. **Insights Page:** Enforce individual-only analytics for all users, removing aggregate unit/organization views from the personal dashboard.

---

## 1. KRA/KPI Table View Action (Staff Read-Only)
**Goal:** Prevent staff from editing KPIs while preserving their ability to view instructions and data.

### Implementation Details:
- **`KRAsTab.tsx`:** 
  - Modified the actions column for the KRA/KPI table.
  - When a user does not have edit permissions (`!canEdit`), an "Eye" icon replaces the standard "Edit" and "Delete" icons.
  - Clicking this icon triggers the same `handleOpenEditKpiModal` function but passes an `isReadOnly={!canEdit}` flag down to the modal.
- **`KpiModal.tsx` & `KpiInputBlock.tsx`:**
  - Extended the prop interfaces to accept `isReadOnly`.
  - Conditioned the modal title and description to display "View KPI" instead of "Edit KPI".
  - Passed the `isReadOnly` flag down through all input components (`Input`, `Select`, `Textarea`, `Switch`, etc.), safely `disabled`ing them from user interaction.
  - Replaced the "Cancel" and "Save Changes" footer buttons with a single "Close" button when `isReadOnly` is active.

---

## 2. Projects Page Filtering (Staff Assignment Matching)
**Goal:** Staff members should seamlessly see only the projects attached to them, preserving data privacy and reducing clutter.

### Implementation Details:
- **`ProjectsTab.tsx`:**
  - Integrated the `useSupabaseAuth` hook to retrieve the current user's payload (`role` and `email`).
  - Evaluated `isStaff = user?.user_metadata?.role === 'staff_member'`.
  - Intercepted the `displayProjects` mapping logic to introduce a hard filter:
    - If `isStaff` is true, a project is only rendered if the logged-in user's email exists inside the project's `assignees` array.
    - If `isStaff` is false (e.g., manager or admin), the filter is bypassed entirely, displaying all projects associated with that unit.

---

## 3. Individualized KRA Insights
**Goal:** The Insights tab on the Unit Objectives view must strictly display "My" data. Staff and managers should not be able to toggle scope to view aggregate data in this specific interface to maintain focus.

### Implementation Details:
- **`KRAsTab.tsx`:**
  - Removed instances of the "View Scope" select dropdown that allowed users to toggle between "My Data", "Department", and "Organization".
  - Set the active scope state to permanently default to `'my'`.
- **`KRAInsightsTab.tsx`:**
  - Overhauled the `activeKras` and `activeKpis` aggregations.
  - **KRA Filter:** Enforced `k.ownerId === user.id`.
  - **KPI Filter:** Enforced a deep check against `kpi.assignees` ensuring the `user.email` exists within it.
  - Removed all fallback UI buttons pointing to "View Organization Stats".
  - Hardcoded textual labels for all dashboard charts, replacing dynamic `scopeLabel` references with "My" (e.g., "My KRA Status Overview", "My KPI Distribution by Objective"). This explicitly communicates to the user that this view focuses solely on them.

---

## Summary of architectural principles maintained:
By re-using existing modal architectures (`KpiModal`) and leveraging the localized component state to evaluate Supabase payloads (`useSupabaseAuth`), the system was tightened securely on the frontend without requiring complex backend route adjustments or destructive schema modifications.
