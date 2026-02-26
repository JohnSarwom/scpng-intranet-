# Unit Objectives and Task Modal RBAC Enhancements

**Date Implementation:** February 2026

## Overview

This document outlines the changes made to correctly scope the "Unit Objectives" views and Task creation/editing modals based on user roles and KPI assignments. Previously, staff and managers saw similar views when interacting with KRAs, KPIs, and Unit Objectives, leading to unnecessary UI friction for standard staff members.

## Role-Based Scope Changes

### 1. Unit Objectives Visibility (`KRAsTab.tsx`)
Standard staff users (users with the `staff_member` role) only need to see their KRAs and KPIs without being overwhelmed by broader Unit Objectives setup. 

- **Role Assessment**: `useRoleBasedAuth` was integrated to evaluate the current user's role on the fly.
- **Conditional Titles**: 
    - For `isStaff`: The panel title specifically outputs `KRAs / KPIs`.
    - For Managers/Admins: The panel title outputs `KRAs / KPIs / Objectives`.
- **Conditional Tabs**:
    - The "Objectives" tab `<TabsTrigger value="objectives">` is hidden if the active user possesses the `staff_member` role.

### 2. Task Modal KRA & KPI Links (`TaskDialog.tsx`)
The process around linking Tasks to KRAs and KPIs was clunky due to an extraneous "Link to KRA" dropdown that forced duplicate conceptual selections from the user. Furthermore, standard staff members saw all KPIs instead of only the ones assigned to them.

- **KRA Dropdown Removal**:
    - The "Link to KRA" dropdown was completely removed from the Task Modal interface.
- **KPI Dropdown Filtering (RBAC)**:
    - By utilizing `useRoleBasedAuth`, the "Link to KPI" dropdown now renders a restricted list for standard staff.
    - Specifically, if the user is a `staff_member`, they will only see KPIs where their specific email address exists inside the `kpi.assignees` array.
    - Managers and Admins (`isManagerOrAdmin = true`) continue to have unfiltered access to all KPIs in the list.
- **Automatic KRA Inference**:
    - Because the physical KRA dropdown was excised, the payload generation process (`handleSubmit`) was updated to prevent breaking backend associations. 
    - When a user selects a KPI, the system automatically looks up the parent `kra_id` of that specific KPI, and injects it into the `taskData` payload sent to SharePoint under the surface.

## Summary

These changes significantly streamline the UI for staff-level users by abstracting higher-level strategic elements (Unit Objectives) and reducing data entry decisions (removing KRA selection). The RBAC filtering on the KPI list further tightens the focus, ensuring users are only linking tasks against metrics explicitly assigned to them.
