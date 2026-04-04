# Document Management Permissions

**Date Implemented:** 2026-04-04  
**Author:** IT Unit

---

## Overview

The Document Management System supports a two-tier permission model for the **Organisational Shared Documents** and **External Shared Documents** sections:

1. **Admins and Super Admins** — always have full CRUD access (upload, delete, manage categories).
2. **Non-admin users** — read-only by default. Admins can explicitly grant individual users Upload and/or Delete access per section via the Admin → Doc Permissions tab.

My Documents (OneDrive) is personal to each user; no additional permissions are required — all authenticated users can manage their own files.

---

## Permission Keys

Permissions are stored as a JSON object in the `Permissions` column of the SharePoint `UserRoles` list.

| Permission key | Action | Description |
|----------------|--------|-------------|
| `documents_org` → `upload` | Upload to Org Shared | Can use "Add Document" / "Add External Doc/Link" button |
| `documents_org` → `delete` | Delete from Org Shared | Sees delete button on files in Org Shared categories |
| `documents_external` → `upload` | Upload to External Shared | Can use "Add External Doc/Link" button on External tab |
| `documents_external` → `delete` | Delete from External Shared | Sees delete button on files in External Shared categories |

Example stored JSON:

```json
{
  "documents_org": ["upload", "delete"],
  "documents_external": ["upload"]
}
```

---

## Permission Flags in `Documents.tsx`

Four derived boolean flags are computed at the top of the `Documents` component:

```ts
const canUploadOrg  = isAdmin || hasPermission('documents_org',      'upload');
const canDeleteOrg  = isAdmin || hasPermission('documents_org',      'delete');
const canUploadExt  = isAdmin || hasPermission('documents_external', 'upload');
const canDeleteExt  = isAdmin || hasPermission('documents_external', 'delete');
```

These flags gate:

| Flag | Controls |
|------|---------|
| `canUploadOrg` | "Add Document" / "Add Category" toolbar button on Org Shared and Team/Unit tabs |
| `canDeleteOrg` | Per-file delete (and open) hover buttons inside Org Shared and Team/Unit category views |
| `canUploadExt` | "Add External Doc/Link" toolbar button on External Shared tab |
| `canDeleteExt` | Per-file delete (and open) hover buttons inside External Shared category view |

Category-level Edit and Delete buttons (renaming or removing an entire category folder) remain **admin-only** (`isAdmin || isSuperAdmin`) regardless of document permissions.

---

## Admin Interface — `DocumentPermissionsTab`

**File:** `src/components/admin/DocumentPermissionsTab.tsx`  
**Location in Admin:** Admin → Doc Permissions tab

### What it shows

- An info card explaining that admins always have full access.
- A legend card describing each section and action.
- A searchable user table listing all non-admin users with toggle switches for each section × action combination (4 columns: Org Upload, Org Delete, External Upload, External Delete).

### How toggles work

Each switch calls `handleToggle(user, sectionKey, action, enabled)`:

1. Computes `updatedPermissions` by merging the change into the user's existing `permissions` object.
2. Calls `onUpdateUser(user.user_email, { permissions: updatedPermissions })` — this invokes `handleUpdateUser` in `Admin.tsx` which calls `UserSharePointService.updateUser()`.
3. Mutates the local `user.permissions` reference for instant UI feedback (no refetch needed).
4. Shows a toast: *"Granted upload on Organisational Shared for John Smith"* or *"Revoked delete on External Shared for…"*

### Optimistic local state

The toggle mutates `user.permissions` in-place before the SharePoint call returns. If the call fails, the toast error is shown but the local state is left in the new position (refresh the page to reset). A full refetch after each toggle was avoided to prevent the SharePoint eventual-consistency lag from snapping the toggle back.

---

## SharePoint Storage — `UserRoles` List

The `Permissions` field on the `UserRoles` SharePoint list stores the JSON object described above.

`UserSharePointService.updateUser()` now serialises `permissions` when present:

```ts
if (updates.permissions !== undefined)
  fields.Permissions = JSON.stringify(updates.permissions);
```

`mapFromSharePoint` already parsed it:

```ts
if (fields.Permissions) permissions = JSON.parse(fields.Permissions);
```

So no schema changes to SharePoint are required — the `Permissions` column already exists.

---

## `useRoleBasedAuth` — `hasPermission`

The `hasPermission(resource, action)` function checks the current user's resolved permissions object, which is built by merging:

1. Individual `user.permissions` from the `UserRoles` list item.
2. Group-level permissions from any `PermissionGroup` the user belongs to.

Admins bypass this check entirely — `isAdmin` short-circuits all permission flags.

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/admin/DocumentPermissionsTab.tsx` | New component — searchable user permission table with per-section toggle switches |
| `src/pages/Admin.tsx` | Added `DocumentPermissionsTab` import; added "Doc Permissions" tab trigger and content; updated grid from `grid-cols-8` to `grid-cols-9` |
| `src/services/userSharePointService.ts` | Re-enabled `Permissions` field serialisation in `updateUser()` |
| `src/pages/Documents.tsx` | Added `canUploadOrg`, `canDeleteOrg`, `canUploadExt`, `canDeleteExt` flags; gated toolbar buttons and per-file delete actions behind these flags |

---

## Behaviour Summary by Role

| Role | Org Upload | Org Delete | Ext Upload | Ext Delete | Category Edit/Delete |
|------|-----------|-----------|-----------|-----------|---------------------|
| Super Admin | Yes | Yes | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes | Yes | Yes |
| Manager / Staff (no grant) | No | No | No | No | No |
| Staff (granted Org Upload) | Yes | No | No | No | No |
| Staff (granted Org Delete) | No | Yes | No | No | No |
| Staff (granted all) | Yes | Yes | Yes | Yes | No |

---

## Future Considerations

- Add per-category permissions (e.g. only allow upload to a specific category, not all of Org Shared).
- Expose a "bulk grant" action to apply a permission set to a whole Division or Unit at once.
- Audit log: record who granted/revoked which permission and when.
