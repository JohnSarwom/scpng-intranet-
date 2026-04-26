# Asset Edit/Delete Permissions — IT & Admin Only

**Date:** 2026-04-14

## Summary

Restricted the Edit and Delete actions on assets in the Asset Registry so that only **IT unit members** and **Admin/SuperAdmin** users can perform them. All other staff can only **View Details**.

## Problem

Previously, all users who could access the Asset Registry page had full Edit and Delete capabilities on every asset. This posed a risk of accidental or unauthorized modifications to asset records by non-IT staff.

## Solution

### Permission Check

A new `isITOrAdmin` flag was added in `AssetManagementNew.tsx`:

```ts
const isITOrAdmin = isAdmin || roleUser?.unit_name?.toLowerCase() === 'it';
```

This checks:
- `isAdmin` — true if the user's roles include `Admin` or `SuperAdmin`
- `unit_name` — true if the user belongs to the "IT" unit (case-insensitive)

### Files Changed

| File | Change |
|------|--------|
| `src/pages/AssetManagementNew.tsx` | Added `isITOrAdmin` flag; wrapped Edit/Delete dropdown items in both table views with `{isITOrAdmin && (...)}` conditional; passes `onEdit`/`onDelete` as `undefined` to `AssetCard` for non-privileged users |
| `src/components/assets/AssetCard.tsx` | Made `onEdit` and `onDelete` props optional; conditionally renders Edit/Delete menu items only when handlers are provided |

### Affected Views

1. **Table view (All Units tab)** — dropdown actions column
2. **Table view (Division tab)** — dropdown actions column
3. **Card view** — hover dropdown on card header

### Behavior by Role

| User Type | View Details | Edit | Delete |
|-----------|:---:|:---:|:---:|
| Admin / SuperAdmin | Yes | Yes | Yes |
| IT Unit staff | Yes | Yes | Yes |
| All other staff | Yes | No | No |

## Notes

- The "Add Asset" button visibility is controlled separately via `useComponentVisibility('Assets', 'Add Asset Button')` and was not changed.
- The `isITOrAdmin` check uses `roleUser.unit_name` from the `UserRoles` SharePoint list (fetched via `useRoleBasedAuth`).
