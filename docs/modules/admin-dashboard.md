# Admin Dashboard: User & Role Management

This document details the recent updates and architectural decisions made for the Admin Dashboard, specifically focusing on User Management and Role Management.

## Overview
The Admin Dashboard gives administrators the ability to manage user profiles, assign users to permission groups, and define specific groups that control access to various parts of the SCPNG Intranet.

## 1. User Management
The User Management component (`UserManagement.tsx`) manages the `UserRoles` SharePoint list. 

### Recent Updates:
- **Modal-Based Interface**: Replaced the inline table-editing structure with a clean, centralized pop-up `Dialog` modal for both Adding and Editing staff members. This provides a focused UI similar to the Task Registry.
- **Removed Hardcoded Defaults**: The "Seed Users" function previously assigned a hardcoded `"IT Group"`. This was replaced with dynamic parsing to draw from `availableGroups`.
- **Orphaned Group Self-Healing**: 
  - Sub-groups are mapped as string arrays in the user profile. If a Permission Group is deleted or renamed, users might retain the old invalid string (orphaned group).
  - The UI now transparently highlights any orphaned groups with a red `destructive` badge and an `(Invalid)` flag directly in the table.
  - When an admin clicks **Edit** on an affected user, the modal automatically strips the invalid groups from their state. Pressing **Save** permanently cleans the user's profile, providing a simple self-healing mechanism.

## 2. Role Management
The Role Management component (`RoleManagement.tsx`) interfaces with the `PermissionGroup` layer.

### Recent Updates:
- **Group Duplication**: Added a **Duplicate** button to permission group cards. This copies the group's title (appending a distinctive `(Copy)` or `(Copy X)` suffix to prevent naming collisions) and description, facilitating rapid onboarding of similar roles.
- **Automatic User Sync**: The root handler in `Admin.tsx` was fundamentally updated so that:
  - When a group is **Renamed**, the module iterates through all users who possessed the old group name and updates their `groups` array to reflect the new name.
  - When a group is **Deleted**, the module iterates through all users and removes the deleted group from their respective `groups` array.
  - This solves the orphaned string issue at the core going forward, ensuring the synchronization of users and roles without leaving stale data.

## Best Practices
- **Never Hardcode Groups**: Because group names are dynamically user-defined and subject to renaming, components must refer against the dynamically fetched `availableGroups` list.
- **Handling Denormalized Data**: Group memberships are stored as a denormalized array of strings on the user. Relying on cascading updates (like the new ones in `Admin.tsx`) is essential to keep the system state synchronized rather than depending purely on SharePoint's relational linkages on the frontend.
