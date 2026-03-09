# Asset Management Page — Audit & Refactor
**Date:** March 09, 2026

## Overview
A full audit of the Asset Management page (`src/pages/AssetManagementNew.tsx`) and its ecosystem of components was conducted. The audit covered UI behaviour, logic correctness, theme consistency, performance, and code quality. A set of fixes was then implemented across two passes — Quick Wins and Structural Improvements.

---

## Audit Findings Summary

### Bugs (Silent, User-Facing)
| # | Issue | Severity |
|---|-------|----------|
| 1 | `filterAssignedTo` was rendered as an active filter badge but the container row's visibility condition didn't include it — the row never showed when only this filter was active | P1 |
| 2 | Error state for asset loading had no retry mechanism — users were permanently stuck | P1 |
| 3 | "Apply Filters" button in the Sheet footer was a no-op (filters apply reactively) — misleading UX | P1 |
| 4 | Staff loading blocked the entire page with a full-screen spinner even though staff data is only needed inside Add/Edit modals | P1 |

### Performance
| # | Issue | Severity |
|---|-------|----------|
| 5 | Search input had no debounce — `filteredAssets` memo recalculated on every keystroke | P2 |
| 6 | Sort column typed as `string`, enabling silent sort on undefined fields via unsafe `as keyof UserAsset` cast | P2 |

### Code Quality & Maintainability
| # | Issue | Severity |
|---|-------|----------|
| 7 | 6 independent modal state variables (`isAddModalOpen`, `isEditModalOpen`, `isDeleteModalOpen`, `selectedAsset`, `selectedAssetForInfo`, `isQuickInfoModalOpen`) — `handleCloseModals()` had to reset all 6 manually | P2 |
| 8 | `getConditionBadgeClass` defined locally in `AssetCard.tsx` with 4 conditions; `EditAssetModal.tsx` had a separate hardcoded `conditionOptions` array with 6 different conditions; table view used a 3-level inline ternary covering only 3 conditions — three diverging copies | P2 |
| 9 | Hardcoded `bg-white dark:bg-gray-950` on toolbar inputs/buttons instead of semantic `bg-background` — broke dark mode theming | P2 |
| 10 | `DialogTrigger` + `onClick={handleAddClick}` both set `isAddModalOpen(true)` — double-firing | P3 |
| 11 | `handleRefreshStaffMembers` function defined and connected to `refreshStaffMembers` hook but never rendered in the UI — dead code | P3 |

### Theme Inconsistencies
- `AssetInfoModal` used a blue gradient header (`from-blue-600 to-indigo-700`) — no other modal in the app used gradients
- Raw `<table>` used in place of the `<Table>` Radix component (which was imported but unused)
- `AssetCard` used `Card` directly rather than the shared `BaseCard` pattern

---

## Changes Implemented

### Pass 1 — Quick Wins

#### 1. Fixed `filterAssignedTo` active filter row bug
**File:** `src/pages/AssetManagementNew.tsx`

Added `|| filterAssignedTo !== 'all'` to the container row visibility condition so the active filters row correctly appears when only the Assigned To filter is active.

#### 2. Added retry button to asset error state
**File:** `src/pages/AssetManagementNew.tsx`

Replaced the dead-end error `<p>` with a flex column containing the error message and a `Retry` button that calls `refreshAssets()`. Uses the already-imported `RotateCcw` icon.

#### 3. Renamed "Apply Filters" → "Done"
**File:** `src/pages/AssetManagementNew.tsx`

The Sheet footer close button was relabelled. Filters apply reactively as you change them; the button's only purpose is to close the drawer.

#### 4. Added 300ms search debounce
**File:** `src/pages/AssetManagementNew.tsx`

Added `debouncedFilterText` state and a `useEffect` that fires 300ms after `filterText` changes. The raw `filterText` value drives the input (instant feedback); `debouncedFilterText` drives `filteredAssets` memo, `HighlightMatch` components, and the pagination reset `useEffect`. `handleResetFilters` also resets `debouncedFilterText` immediately (bypasses the delay on explicit reset).

#### 5. Replaced hardcoded bg tokens with semantic values
**File:** `src/pages/AssetManagementNew.tsx`

All 6 occurrences of `bg-white dark:bg-gray-950` in the toolbar area (search input, type/unit selects, filter button, toggle group, more-options button) replaced with `bg-background`. Sticky table header/action column uses `bg-white dark:bg-gray-800` intentionally for scroll occlusion — those were left untouched.

#### 6. Removed redundant `onClick={handleAddClick}`
**File:** `src/pages/AssetManagementNew.tsx`

`DialogTrigger` already calls `onOpenChange(true)` on the controlled `Dialog`. The extra `onClick` was firing the same state setter twice. Removed `handleAddClick` entirely.

#### 7. Consolidated condition badge logic into a shared constant
**Files created/modified:**
- `src/constants/assetChoices.ts` — Added `getConditionBadgeClass(condition?)` function covering all 6 SharePoint conditions (`Excellent`, `Good`, `Fair`, `Poor`, `Needs Repair`, `Out of Service`) plus legacy aliases (`New`, `For Disposal`)
- `src/config/assetConditions.ts` — Created as a thin re-export wrapper from `assetChoices.ts` so all import paths resolve
- `src/components/assets/AssetCard.tsx` — Removed local `getConditionBadgeClass` copy; now imports from `@/config/assetConditions`
- `src/components/unit-tabs/modals/EditAssetModal.tsx` — Removed hardcoded `conditionOptions` array; now imports `ASSET_CONDITIONS` from `@/constants/assetChoices`
- `src/pages/AssetManagementNew.tsx` — Replaced 3-case inline ternary in table view condition cell with `getConditionBadgeClass()`; added `border` class to the span so it uses the border colours defined in the badge map

---

### Pass 2 — Structural Improvements

#### 8. Staff loading no longer blocks the page
**File:** `src/pages/AssetManagementNew.tsx`

Removed the `if (staffLoading) { return <PageLayout><Loader2/></PageLayout> }` early return. Staff data loads in the background. The page renders immediately with the asset table. When Add/Edit modals open, their assignee dropdowns are populated — if the data is still loading, the dropdown list will be briefly empty then populate automatically when the hook resolves (React re-renders the modal with the new `staffMembers` prop). Staff errors are logged to `console.warn` only.

Also removed the now-unused `refreshStaffMembers` destructure from `useStaffMembers()` and deleted the dead `handleRefreshStaffMembers` function.

#### 9. Unified modal state — single `activeModal` object
**File:** `src/pages/AssetManagementNew.tsx`

**Before:** 6 independent `useState` calls.

**After:** One typed state object:
```typescript
type ModalType = 'add' | 'edit' | 'delete' | 'info' | null;
const [activeModal, setActiveModal] = useState<{ type: ModalType; asset: UserAsset | null }>({
  type: null,
  asset: null,
});
```

Handler functions collapsed:
```typescript
const handleEditClick   = (asset: UserAsset) => setActiveModal({ type: 'edit',   asset });
const handleDeleteClick = (asset: UserAsset) => setActiveModal({ type: 'delete', asset });
const handleInfoClick   = (asset: UserAsset) => setActiveModal({ type: 'info',   asset });
const handleCloseModals = ()                 => setActiveModal({ type: null,     asset: null });
```

All render conditionals updated:
- `{isEditModalOpen && selectedAsset && ...}` → `{activeModal.type === 'edit' && activeModal.asset && ...}`
- `DeleteModal.onOpenChange` now calls `handleCloseModals()` instead of `setIsDeleteModalOpen` (which previously left `selectedAsset` dangling)
- `AssetInfoModal` no longer needs `selectedAssetForInfo` — uses `activeModal.asset` when `activeModal.type === 'info'`
- Add Asset `Dialog` `onOpenChange` set to: `(open) => setActiveModal(open ? { type: 'add', asset: null } : { type: null, asset: null })`

#### 10. Typed sort column — eliminated unsafe cast
**File:** `src/pages/AssetManagementNew.tsx`

Replaced `useState<string>('name')` with a typed union:
```typescript
type SortableAssetColumn = 'name' | 'id' | 'type' | 'condition' | 'assigned_to' |
  'assigned_to_email' | 'unit' | 'division' | 'description' | 'assigned_date' |
  'purchase_date' | 'last_updated';

const [sortColumn, setSortColumn] = useState<SortableAssetColumn>('name');
```

The `sortedAssets` memo's `a[sortColumn as keyof UserAsset]` cast replaced with `a[sortColumn]` — TypeScript now verifies the key is valid. `handleSort` and `SortIndicator` both updated to accept `SortableAssetColumn` instead of `string`.

---

## Files Modified

| File | Type of Change |
|------|---------------|
| `src/pages/AssetManagementNew.tsx` | Bug fixes, refactoring, performance |
| `src/components/assets/AssetCard.tsx` | Import shared condition function |
| `src/components/unit-tabs/modals/EditAssetModal.tsx` | Import shared condition constants |
| `src/constants/assetChoices.ts` | Added `getConditionBadgeClass` function |
| `src/config/assetConditions.ts` | Created — re-exports from `assetChoices.ts` |

---

## What Was Not Addressed (Future Work)

| Item | Notes |
|------|-------|
| Virtual scrolling for large datasets | Requires `@tanstack/react-virtual` — table renders all paginated rows into DOM |
| Lazy-loaded modals via `React.lazy()` | Code splitting for Add/Edit modals |
| URL state persistence for filters/sort/page | Filters lost on browser refresh |
| Optimistic UI for CRUD operations | UI freezes during save/delete while awaiting API |
| `<Table>` component consistency | Raw `<table>` used instead of the Radix `<Table>` import |
| Filter dot indicator on mobile | Doesn't include Type/Unit on mobile without a `useMediaQuery` hook |
