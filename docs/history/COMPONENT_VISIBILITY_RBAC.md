# Component Visibility RBAC — Implementation Log

**Feature:** Role-based component visibility control, configurable by admin via UI
**Status:** Fix 1 ✅ Fix 2 ✅ Fix 3 ✅ Fix 4 ✅
**Started:** 2026-03-10

---

## Background & Motivation

The admin requested the ability to control which sections/tabs/components of each page are visible to different user roles (Admin, Manager, Staff Member). The immediate need was to hide the **Reports Tab** on the Strategy page from both Managers and Staff — only Admins should see it.

The solution was designed to be:
- **Admin-configurable via UI** (no code changes required to toggle visibility)
- **Centralized** (settings stored in SharePoint, apply to all users org-wide)
- **Fast** (localStorage cache for instant first-render, no flicker)
- **Extensible** (any page component can be registered and controlled)

---

## Roles Reference

Roles are stored in the `UserRoles` SharePoint list under the `Role` column (`role_name` in TypeScript).

| Role value | Description | `is_admin` flag |
|---|---|---|
| `super_admin` | Full system access | `true` |
| `admin` | Admin access | `true` |
| `manager` | Manager-level access | `false` |
| `staff_member` | Normal staff (default) | `false` |

> **Rule:** Users with `is_admin === true` OR `role_name === 'super_admin'` OR `role_name === 'admin'` always see everything, regardless of any visibility setting. (All three conditions are checked after Fix 3.)

---

## Architecture Overview

```
Admin UI (ViewSettingsTab)
    └── useComponentVisibilityAdmin hook
            ├── Reads from: SharePointOpsService.getComponentVisibilitySettings()
            ├── Writes to:  SharePointOpsService.updateComponentVisibilitySetting()
            ├── Adds to:    SharePointOpsService.addComponentVisibilitySetting()
            └── Deletes:    SharePointOpsService.deleteComponentVisibilitySetting()

Page Components (e.g. Strategy.tsx, Unit.tsx)
    └── useComponentVisibility hook
            ├── Reads: localStorage cache (instant, no flicker)
            └── Revalidates: SharePoint in background on mount

SharePoint List: System_Component_Visibility
    └── Columns: Title (settingKey), PageName, ComponentName, Description, VisibleTo (JSON array)
```

---

## Files Created / Modified

### New Files

| File | Purpose |
|---|---|
| `src/hooks/useComponentVisibility.ts` | Core hook — visibility logic, cache, admin CRUD |

### Modified Files

| File | What Changed |
|---|---|
| `src/services/sharePointOpsService.ts` | Added `COMPONENT_VISIBILITY` list config, `resetOpsServiceCache()`, 4 new methods, pagination fix in `resolveListIds` |
| `src/services/sharePointListSetupService.ts` | Added `createComponentVisibilityList()` with default seed data (7 entries) |
| `src/components/admin/ViewSettingsTab.tsx` | Component Visibility card with table, checkboxes, Add form, Delete button, page filter tabs, loading overlay |
| `src/hooks/useRoleBasedAuth.ts` | `isAdmin` and `hasPermission` now check `is_admin` flag + `role_name` fallback |
| `src/components/auth/RoleProtectedRoute.tsx` | Role guards use `isAdmin` from hook instead of `user.is_admin` directly |
| `src/pages/Strategy.tsx` | Applied `canSeeReports` to Reports tab (trigger + content) |
| `src/pages/Unit.tsx` | Replaced hardcoded `canViewStaffMetrics` with `useComponentVisibility` |
| `src/pages/AssetManagementNew.tsx` | Applied `canAddAsset` to Add Asset button |

---

## Fix 1 — SharePoint Backend ✅

**Problem:** Settings were originally in `localStorage` only — each browser had its own copy, admin changes wouldn't propagate to other users.

**Solution:** Created a dedicated SharePoint list `System_Component_Visibility` backed by the existing `SharePointOpsService` pattern.

### SharePoint List: `System_Component_Visibility`

| Column | Type | Notes |
|---|---|---|
| `Title` | Text | Setting key, e.g. `strategy-reports` |
| `PageName` | Text | e.g. `Strategy` |
| `ComponentName` | Text | e.g. `Reports Tab` |
| `Description` | Multi-line Text | Human-readable description |
| `VisibleTo` | Multi-line Text | JSON array of role_name strings, e.g. `["admin","super_admin"]` |

### Key: `COMPONENT_VISIBILITY` in `OPS_CONFIG.LISTS`

```typescript
// sharePointOpsService.ts
COMPONENT_VISIBILITY: 'System_Component_Visibility'
```

This is auto-resolved by the existing `resolveListIds()` during `initialize()` — no other wiring needed.

### `resetOpsServiceCache()`

```typescript
// sharePointOpsService.ts — exported top-level function
export const resetOpsServiceCache = () => {
    cachedListIds = {};
    globalInitializationPromise = null;
};
```

Called after `createComponentVisibilityList()` so the new list ID is picked up immediately without requiring a page reload.

### New Service Methods

```typescript
// sharePointOpsService.ts
getComponentVisibilitySettings(): Promise<ComponentVisibilitySetting[]>
updateComponentVisibilitySetting(itemId, visibleTo): Promise<void>
addComponentVisibilitySetting(entry): Promise<ComponentVisibilitySetting>
deleteComponentVisibilitySetting(itemId): Promise<void>
```

### Hook: `useComponentVisibility` (for page components)

```typescript
const { isComponentVisible } = useComponentVisibility();
const canSeeReports = isComponentVisible('Strategy', 'Reports Tab');
```

- **Instant**: reads from `localStorage` cache (`scpng_component_visibility_v3`) on first render
- **Self-healing**: fetches from SharePoint in background on mount, updates cache
- **Admin bypass**: `is_admin === true` OR `role_name === 'super_admin'` always returns `true`
- **Safe default**: if no setting found for a page/component, defaults to `true` (visible)

### Hook: `useComponentVisibilityAdmin` (for Admin UI only)

```typescript
const { settings, loading, initializing, updateSetting, addSetting, deleteSetting, initializeList, refresh } = useComponentVisibilityAdmin();
```

- `updateSetting(id, role, enabled)` — toggling a checkbox saves to SharePoint instantly
- `addSetting(entry)` — creates new entry in SharePoint + updates cache
- `deleteSetting(id)` — removes from SharePoint + updates cache
- `initializeList()` — creates the SharePoint list if it doesn't exist, then calls `resetOpsServiceCache()` + reloads

### First-time Setup

Navigate to **Admin → View Settings → Component Visibility → "Initialize List"**. This creates the `System_Component_Visibility` list in SharePoint and seeds all defaults. Only needs to be done once.

---

## Fix 2 — Extended Component Registry ✅

**Problem:** Only 1 component was registered (`Strategy > Reports Tab`). No way to add new ones from the UI.

**Solution:** Pre-registered 6 components across 4 pages, added an inline "Add Component" form and a delete button per row.

### Default Component Registry

| Setting Key | Page | Component | Default Visibility |
|---|---|---|---|
| `strategy-reports` | Strategy | Reports Tab | Admin / Super Admin |
| `strategy-analytics` | Strategy | Analytics Tab | Admin / Super Admin / Manager |
| `unit-staff-metrics` | Unit | Staff Metrics Tab | Admin / Super Admin / Manager |
| `hr-stats-panel` | HR Profiles | Stats Panel | Admin / Super Admin / Manager |
| `hr-delete-employee` | HR Profiles | Delete Employee | Admin / Super Admin |
| `market-admin-controls` | Market Data | Admin Controls | Admin / Super Admin |
| `assets-add-button` | Assets | Add Asset Button | Admin / Super Admin / Manager |

> These are seeded into SharePoint when "Initialize List" is clicked. Re-initializing a list that already exists is safe — the setup service checks for existence first.

### Admin UI — "Add Component" Inline Form

Located at top of the Component Visibility card. Fields:
- **Page name** — free text (e.g. `Strategy`)
- **Component name** — free text (e.g. `Reports Tab`)
- **Description** — optional
- **Also visible to: Manager** — checkbox
- **Also visible to: Staff Member** — checkbox

Admin always has the column set to checked + disabled. On save, the entry is written to SharePoint immediately.

### Admin UI — Delete Button

Each row has a trash icon. Clicking it calls `deleteComponentVisibilitySetting()` on SharePoint and removes from the local state and cache.

### Applied in Pages

**Strategy.tsx** — Reports Tab:
```typescript
const { isComponentVisible } = useComponentVisibility();
const canSeeReports = isComponentVisible('Strategy', 'Reports Tab');

// In JSX:
{canSeeReports && (<TabsTrigger value="reports">...</TabsTrigger>)}
{canSeeReports && (<TabsContent value="reports">...</TabsContent>)}

// Tab grid also adjusts dynamically:
className={`grid ${canSeeReports ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}
```

**Unit.tsx** — Staff Metrics Tab:
```typescript
// Before (hardcoded):
const canViewStaffMetrics = useMemo(() => {
    const role = roleUser?.role_name?.toLowerCase();
    return roleUser?.is_admin || role === 'super_admin' || role === 'admin' || role === 'manager';
}, [roleUser]);

// After (admin-controlled):
const { isComponentVisible } = useComponentVisibility();
const canViewStaffMetrics = isComponentVisible('Unit', 'Staff Metrics Tab');
```

---

## Fix 3 — Role Detection Consistency ✅

**Problem:** The `is_admin` flag should be the authoritative source for admin detection, but `role_name === 'admin'` or `role_name === 'super_admin'` without `is_admin === true` would be treated as regular staff. This meant a data-entry mistake (setting the role name but forgetting the flag) could silently strip admin access.

**Solution:** Made `isAdmin` and `hasPermission` in `useRoleBasedAuth` check both the flag AND the role name. Updated `RoleProtectedRoute` to use the hook's `isAdmin` instead of `user.is_admin` directly.

### Files Changed

| File | Change |
|---|---|
| `src/hooks/useRoleBasedAuth.ts` | `isAdmin` and `hasPermission` now include role_name fallback |
| `src/components/auth/RoleProtectedRoute.tsx` | Role guards use `isAdmin` from hook, not `user.is_admin` |

### Changes in Detail

**`useRoleBasedAuth.ts` — `hasPermission` function:**
```typescript
// Before
if (user.is_admin) { return true; }

// After
if (user.is_admin || user.role_name === 'super_admin' || user.role_name === 'admin') { return true; }
```

**`useRoleBasedAuth.ts` — return value:**
```typescript
// Before
isAdmin: user?.is_admin || false,

// After
isAdmin: user?.is_admin || user?.role_name === 'super_admin' || user?.role_name === 'admin' || false,
```

**`RoleProtectedRoute.tsx` — role guards:**
```typescript
// Before — used user.is_admin directly (bypassed hook's consistent check)
const { user, loading, error, hasPermission } = useRoleBasedAuth();
if (requiredRole && user.role_name !== requiredRole && !user.is_admin) { ... }
if (allowedRoles.length > 0 && !allowedRoles.includes(user.role_name) && !user.is_admin) { ... }

// After — uses isAdmin from hook
const { user, loading, error, hasPermission, isAdmin } = useRoleBasedAuth();
if (requiredRole && user.role_name !== requiredRole && !isAdmin) { ... }
if (allowedRoles.length > 0 && !allowedRoles.includes(user.role_name) && !isAdmin) { ... }
```

### Audit Findings (no change needed)

After a full codebase audit, the following locations already correctly handle both `is_admin` flag AND `role_name` check, so no changes were needed:

| File | Pattern (already correct) |
|---|---|
| `src/pages/Unit.tsx:242` | `roleUser?.is_admin \|\| role === 'super_admin' \|\| role === 'admin'` |
| `src/components/unit-tabs/TaskDialog.tsx:115` | `authUser?.is_admin \|\| authUser?.role_name === 'admin' \|\| authUser?.role_name === 'super_admin'` |
| `src/hooks/useDivisionData.ts:238` | `roleUser?.is_admin \|\| role === 'super_admin' \|\| role === 'admin'` |
| `src/hooks/useComponentVisibility.ts:122` | `isAdmin \|\| user.role_name === 'super_admin'` (redundant but safe) |
| `src/pages/AdminAssetsPage.tsx` | `isAdmin \|\| userRole === 'super_admin'` (redundant post-fix, but harmless) |

---

## Fix 4 — Settings Cache Refresh for Other Users ✅

**Problem:** When an admin changes a visibility setting, other users' sessions still served the old settings from their `localStorage` cache. They wouldn't see the change until clearing the cache or browser data.

**Solution:** Added a **5-minute TTL** to the cache. When the cache is older than 5 minutes it is treated as expired — `getCachedSettings()` falls back to `DEFAULT_VISIBILITY_SETTINGS`, and the background SharePoint fetch (which runs on every component mount) immediately provides the current values.

No extra SharePoint calls or version-tracking fields were needed.

### Files Changed

| File | Change |
|---|---|
| `src/hooks/useComponentVisibility.ts` | `CacheEnvelope` interface, TTL check in `getCachedSettings`, timestamp write in `setCachedSettings`, cache key bumped to `v3` |

### Changes in Detail

```typescript
// New cache key (v2 format incompatible — bump prevents parse errors)
export const VISIBILITY_CACHE_KEY = 'scpng_component_visibility_v3';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEnvelope {
    data: ComponentVisibilitySetting[];
    cachedAt: number;
}

// getCachedSettings — expires after TTL
export const getCachedSettings = (): ComponentVisibilitySetting[] => {
    try {
        const stored = localStorage.getItem(VISIBILITY_CACHE_KEY);
        if (stored) {
            const envelope: CacheEnvelope = JSON.parse(stored);
            if (Date.now() - envelope.cachedAt < CACHE_TTL_MS) {
                return envelope.data;        // ✅ fresh — use it
            }
            // expired — fall through so the background fetch runs fresh
        }
    } catch { /* ignore */ }
    return DEFAULT_VISIBILITY_SETTINGS;    // safe default: everything visible
};

// setCachedSettings — stores with timestamp
export const setCachedSettings = (settings: ComponentVisibilitySetting[]) => {
    const envelope: CacheEnvelope = { data: settings, cachedAt: Date.now() };
    localStorage.setItem(VISIBILITY_CACHE_KEY, JSON.stringify(envelope));
};
```

### Propagation behaviour

| Scenario | Latency for other users to see the change |
|---|---|
| User navigates to a new page (remount) | Instant — background fetch runs on every mount |
| User stays on the same page | ≤ 5 minutes — next TTL expiry forces a fresh fetch on next mount |
| User refreshes the browser | Instant |

---

## How to Add Visibility Control to a New Page/Component

### Step 1 — Register the component (Admin UI)
Go to **Admin → View Settings → Add Component**, fill in Page, Component, Description, and role checkboxes. Click Save.

OR, add it to `DEFAULT_VISIBILITY_SETTINGS` in `useComponentVisibility.ts` and `createComponentVisibilityList()` in `sharePointListSetupService.ts` for it to be seeded automatically on initialization.

### Step 2 — Apply the check in the page
```typescript
import { useComponentVisibility } from '@/hooks/useComponentVisibility';

const { isComponentVisible } = useComponentVisibility();
const canSeeX = isComponentVisible('PageName', 'Component Name');

// In JSX:
{canSeeX && <YourComponent />}
```

That's it. The hook handles caching, SharePoint revalidation, and admin bypass automatically.

---

## Post-Fix Updates (Session 2 — 2026-03-10)

### Admin UI — Page Filter Tabs

**Change:** `src/components/admin/ViewSettingsTab.tsx`

The Component Visibility table was extended with page filter tabs above the table, so the admin sees only the components for the selected page rather than the full list.

- Tabs are **dynamically built** from the unique page names in the loaded settings — adding a new component to a new page automatically creates a new tab.
- Each tab badge shows the component count: e.g., `Strategy (2)`.
- An `All` tab is always shown first to display the full list.
- When a specific page tab is selected, the **Page column is hidden** (it's redundant when every row is the same page).
- State: `selectedPage` (default `'All'`), `pageNames`, `filteredSettings` — all computed via `useMemo`.

```typescript
// ViewSettingsTab.tsx additions
const [selectedPage, setSelectedPage] = useState<string>('All');
const pageNames = useMemo(() => ['All', ...new Set(visibilitySettings.map(s => s.page))], [visibilitySettings]);
const filteredSettings = useMemo(() =>
    selectedPage === 'All' ? visibilitySettings : visibilitySettings.filter(s => s.page === selectedPage),
    [visibilitySettings, selectedPage]
);
```

---

### Bug Fix — `resolveListIds` Pagination

**File:** `src/services/sharePointOpsService.ts`

**Problem:** The Graph API `/sites/{id}/lists` endpoint returns a paginated response. The original code called `.get()` once and stopped — if `System_Component_Visibility` was beyond the first page (common when a SharePoint site has many built-in system lists), the list ID was never resolved. `getComponentVisibilitySettings()` would return `[]`, the admin hook would keep `DEFAULT_VISIBILITY_SETTINGS` (all `id: ''`), and every checkbox in the Admin UI was permanently disabled.

**Fix:** `resolveListIds` now follows `@odata.nextLink` until all pages are exhausted.

```typescript
// Before — single page fetch
private async resolveListIds() {
    const lists = await this.client.api(`/sites/${this.siteId}/lists`).select('id,displayName').get();
    lists.value.forEach(...);
}

// After — paginated fetch
private async resolveListIds() {
    const normalize = ...;
    const configMap = ...;

    let nextUrl: string | null = `/sites/${this.siteId}/lists?$select=id,displayName`;
    while (nextUrl) {
        const response = await this.client.api(nextUrl).get();
        (response.value || []).forEach((list: any) => { /* match and store */ });
        nextUrl = response['@odata.nextLink'] ?? null;
    }
}
```

---

### Bug Fix — Loading Overlay for Stale Cache

**File:** `src/components/admin/ViewSettingsTab.tsx`

**Problem:** When `useComponentVisibilityAdmin` initialised, it immediately set state from `getCachedSettings()` (which returns `DEFAULT_VISIBILITY_SETTINGS` when the v3 cache is empty). The `DEFAULT_VISIBILITY_SETTINGS` have 7 items, so `visibilitySettings.length > 0` was true — the old spinner condition `visibilityLoading && visibilitySettings.length === 0` was never triggered. The admin saw what looked like loaded data but all checkboxes were disabled (because the default settings have `id: ''`).

**Fix:** When `visibilityLoading` is `true` and settings are already showing (stale defaults), the table is dimmed with `opacity-50 pointer-events-none` and a "Loading from SharePoint…" badge appears. Once the async fetch completes with real SharePoint IDs, the overlay disappears and all checkboxes become interactive.

```tsx
<div className={`relative transition-opacity ${visibilityLoading ? 'opacity-50 pointer-events-none' : ''}`}>
    {visibilityLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex items-center gap-2 bg-background/80 px-3 py-1.5 rounded-md text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading from SharePoint…
            </div>
        </div>
    )}
    <Table>...</Table>
</div>
```

---

### New Component — Assets > Add Asset Button

**Files changed:**
- `src/hooks/useComponentVisibility.ts` — added to `DEFAULT_VISIBILITY_SETTINGS`
- `src/services/sharePointListSetupService.ts` — added to seed data
- `src/pages/AssetManagementNew.tsx` — applied visibility check

Default visibility: **Admin / Super Admin / Manager** (Staff Members cannot see or click the button).

```typescript
// AssetManagementNew.tsx
const { isComponentVisible } = useComponentVisibility();
const canAddAsset = isComponentVisible('Assets', 'Add Asset Button');

// In JSX:
{canAddAsset && (
    <Dialog open={...} onOpenChange={...}>
        <DialogTrigger asChild>
            <Button className="h-9"><Plus className="mr-2 h-4 w-4" /> Add Asset</Button>
        </DialogTrigger>
        ...
    </Dialog>
)}
```

The entry is included in the seed data so it appears when "Initialize List" is clicked. It can also be added manually via **Admin → View Settings → Add Component**.

---

## Post-Fix Updates (Session 3 — 2026-03-10)

### New Component — Strategy > Strategy Intelligence (AI Chat)

**Files changed:**
- `src/hooks/useComponentVisibility.ts` — added `strategy-ai-chat` to `DEFAULT_VISIBILITY_SETTINGS`
- `src/services/sharePointListSetupService.ts` — added to seed data + upsert fix (see below)
- `src/components/strategy/StrategyAnalytics.tsx` — imported `useComponentVisibility`, applied visibility check

Default visibility: **Admin / Super Admin / Manager** (Staff Members cannot see the AI panel).

```typescript
// StrategyAnalytics.tsx
import { useComponentVisibility } from '@/hooks/useComponentVisibility';

const { isComponentVisible } = useComponentVisibility();
const canSeeStrategyAI = isComponentVisible('Strategy', 'Strategy Intelligence');

// In JSX:
{canSeeStrategyAI && (
    <StrategyAIChat
        objectives={objectives}
        kras={kras}
        kpis={kpis}
        milestones={milestones}
        unitObjectives={unitObjectives}
        orgHierarchy={orgHierarchy}
        divisions={divisions}
        units={units}
        officerProfiles={officerProfiles}
    />
)}
```

The entry is registered in the Admin UI under **Admin → View Settings → Strategy tab** once Initialize List is run.

---

### Bug Fix — `createComponentVisibilityList` Upsert for Existing Lists

**File:** `src/services/sharePointListSetupService.ts`

**Problem:** When `createComponentVisibilityList()` was called on a SharePoint site where the list already existed, it returned immediately (`return check.value[0]`) without checking whether new default entries (added in later code updates) were missing. Clicking "Initialize List" after a code update would silently do nothing — the new component would never appear in the Admin UI.

**Fix:** When the list already exists, the method now:
1. Fetches all existing items (`expand('fields($select=Title)')`)
2. Builds a `Set` of existing `Title` (settingKey) values
3. POSTs only the entries whose `Title` is not already present

```typescript
// Before — early return, no upsert
if (check.value && check.value.length > 0) return check.value[0];

// After — upsert missing defaults
if (check.value && check.value.length > 0) {
    const list = check.value[0];
    const existing = await this.client
        .api(`/sites/${this.siteId}/lists/${list.id}/items`)
        .expand('fields($select=Title)')
        .get();
    const existingKeys = new Set<string>((existing.value || []).map((i: any) => i.fields?.Title));
    for (const item of defaults) {
        if (!existingKeys.has(item.fields.Title)) {
            await this.client.api(`/sites/${this.siteId}/lists/${list.id}/items`).post(item);
        }
    }
    return list;
}
```

> **Note:** A previous iteration of this fix used `.select('fields/Title').expand('fields($select=Title)')` which caused a Graph API OData parse error (`Found a path with multiple navigation properties`). The `.select()` call was removed — `expand` alone is sufficient to project field values.

This makes "Initialize List" safe to click at any time. It is now idempotent: running it on a fully-seeded list is a no-op; running it after a code update that adds new defaults will only insert the missing rows.

---

### Updated Component Registry

| Setting Key | Page | Component | Default Visibility |
|---|---|---|---|
| `strategy-reports` | Strategy | Reports Tab | Admin / Super Admin |
| `strategy-analytics` | Strategy | Analytics Tab | Admin / Super Admin / Manager |
| `strategy-ai-chat` | Strategy | Strategy Intelligence | Admin / Super Admin / Manager |
| `unit-staff-metrics` | Unit | Staff Metrics Tab | Admin / Super Admin / Manager |
| `hr-stats-panel` | HR Profiles | Stats Panel | Admin / Super Admin / Manager |
| `hr-delete-employee` | HR Profiles | Delete Employee | Admin / Super Admin |
| `market-admin-controls` | Market Data | Admin Controls | Admin / Super Admin |
| `assets-add-button` | Assets | Add Asset Button | Admin / Super Admin / Manager |

---

## Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| Checkboxes disabled in Admin UI | `System_Component_Visibility` list ID not resolved (pagination issue — now fixed) OR list not yet created | Should auto-resolve after pagination fix; if still broken, click "Initialize List" |
| Table shows "Loading from SharePoint…" overlay | `visibilityLoading` is true — real IDs are being fetched from SP | Wait 1-3 seconds for the fetch to complete |
| Settings not updating for other users | localStorage cache stale | Cache expires automatically in ≤ 5 min; refresh browser for instant update |
| "Component Visibility list not found" error | List doesn't exist in SharePoint | Go to Admin → View Settings → "Initialize List" |
| Admin user can't see a component | `is_admin` flag not set in UserRoles, AND `role_name` is not `admin` or `super_admin` | Check user record in Admin → Users tab; ensure either `is_admin = true` or `role_name` is `admin`/`super_admin` |
| New component not showing in Admin UI | Not registered in SP | Add via "Add Component" form or re-initialize list |
| Add Asset button missing for a user | `assets-add-button` setting restricts their role | Check Admin → View Settings → Assets tab; toggle Staff Member checkbox if needed |
| Strategy Intelligence AI panel missing for a user | `strategy-ai-chat` setting restricts their role | Check Admin → View Settings → Strategy tab; toggle Manager/Staff Member checkbox if needed |
| "Initialize List" silently does nothing after a code update | Old code returned early when list existed — now fixed with upsert | Click "Initialize List" again; new entries will be added without duplicating existing ones |
| OData error "Found a path with multiple navigation properties" on Initialize List | `.select('fields/Title')` combined with `.expand(...)` is invalid in Graph API | Fixed — `.select()` call removed; `expand` alone is used to project field values |
