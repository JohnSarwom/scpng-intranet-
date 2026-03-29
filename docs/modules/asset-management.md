# Asset Management: Architecture & Data Logic

> **Last updated:** March 09, 2026
> See [`history/ASSET_MANAGEMENT_AUDIT_REFACTOR.md`](../history/ASSET_MANAGEMENT_AUDIT_REFACTOR.md) for the full audit and refactor implementation log.

---

## Component Architecture (Current)

### Primary File
`src/pages/AssetManagementNew.tsx` — the main page component (~1,600 lines).

### Key Design Decisions (as of March 2026)

#### Unified Modal State
All modal open/close state and the currently-selected asset are managed through a single `activeModal` state object. Only one modal can be active at a time.

```typescript
type ModalType = 'add' | 'edit' | 'delete' | 'info' | null;
const [activeModal, setActiveModal] = useState<{ type: ModalType; asset: UserAsset | null }>({
  type: null, asset: null,
});
```

Handlers: `handleEditClick`, `handleDeleteClick`, `handleInfoClick`, `handleCloseModals` all call `setActiveModal(...)`.

#### Typed Sort Column
Sort state uses a typed union instead of `string` to prevent unsafe key access:
```typescript
type SortableAssetColumn = 'name' | 'id' | 'type' | 'condition' | 'assigned_to' |
  'assigned_to_email' | 'unit' | 'division' | 'description' | 'assigned_date' |
  'purchase_date' | 'last_updated';
const [sortColumn, setSortColumn] = useState<SortableAssetColumn>('name');
```

#### Search Debounce
`filterText` drives the input value (instant). `debouncedFilterText` (300ms delay) drives `filteredAssets`, `HighlightMatch` highlights, and the pagination reset effect. `handleResetFilters` clears both immediately.

#### Staff Data Loading
`useStaffMembers()` loads in the background — the page renders immediately. Staff data populates Add/Edit modal assignee dropdowns once resolved. The page-level `staffLoading` block was removed.

#### Data Source Feature Flag
The page conditionally uses either the SharePoint hook or Supabase hook based on the `VITE_USE_SHAREPOINT_ASSETS` env var:
```typescript
const USE_SHAREPOINT_ASSETS = import.meta.env.VITE_USE_SHAREPOINT_ASSETS === 'true';
const { assets, loading, error, add, update, remove, refresh } =
  USE_SHAREPOINT_ASSETS ? sharePointHook : { ...supabaseHook mapped to same interface };
```

#### Condition Badge Constants
All condition colours and option lists live in `src/constants/assetChoices.ts` (the authoritative SharePoint-aligned source). `src/config/assetConditions.ts` re-exports from it. Import the function/constants from either path:
```typescript
import { getConditionBadgeClass, ASSET_CONDITIONS } from '@/constants/assetChoices';
// or:
import { getConditionBadgeClass, ASSET_CONDITIONS } from '@/config/assetConditions';
```

### Component Map

| Component | Path | Purpose |
|-----------|------|---------|
| `AssetManagementNew` | `src/pages/AssetManagementNew.tsx` | Main page — filtering, sorting, pagination, view mode |
| `AddAssetModal` | `src/components/unit-tabs/modals/AddAssetModal.tsx` | Create new asset; uses `GlobalAssigneeSelector` |
| `EditAssetModal` | `src/components/unit-tabs/modals/EditAssetModal.tsx` | Edit existing asset; includes image/invoice upload |
| `DeleteModal` | `src/components/unit-tabs/modals/DeleteModal.tsx` | Generic confirmation dialog |
| `AssetInfoModal` | `src/components/assets/AssetInfoModal.tsx` | Read-only asset detail view |
| `AssetCard` | `src/components/assets/AssetCard.tsx` | Card view tile with hover action menu |
| `assetChoices.ts` | `src/constants/assetChoices.ts` | Canonical condition/type/unit/division lists + badge colours |

### View Modes
The page supports three view modes toggled via `ToggleGroup`:
- **Table** (`List` icon) — sortable columns, sticky header and actions column, 15 items per page
- **Card** (`LayoutGrid` icon) — responsive grid, image-first with hover dropdown
- **Detailed List** (`Rows` icon) — wide horizontal table with all fields including financials

### Filtering
Seven simultaneous filters:
- `filterText` (debounced) — searches across name, ID, type, condition, vendor, unit, division, assigned\_to, notes, description
- `filterType`, `filterCondition`, `filterUnit`, `filterDivision`, `filterVendor`, `filterAssignedTo` — exact-match dropdowns

Type and Unit are shown inline on desktop (≥ md). All filters are accessible in the Sheet drawer. Active filters display as removable badges below the toolbar.

---

# Asset Management: My Assets Page Data Requirements & Logic

## Overview

This document outlines how data is retrieved and filtered for the "My Assets" page within the Asset Management feature. This page is designed to show users the assets currently assigned to them.

## Data Source

The primary data source is the `public.assets` table in the Supabase database.

## Data Retrieval and Filtering

Data for the "My Assets" page is fetched dynamically via the `get-my-assets` Supabase Edge Function. This function is typically invoked by the `useAssetsData` hook (or similar data-fetching logic) within the frontend component (`src/pages/AssetManagement.tsx`).

The Edge Function implements role-based access control logic:

1.  **Non-Admin Users:**
    *   The frontend sends the logged-in user's email (`user_email`) to the function.
    *   The function executes a database query to select assets where the `assigned_to_email` column **exactly matches** the provided `user_email`.
    *   **Result:** The user sees only the assets directly assigned to their email address.

2.  **Admin Users:**
    *   The function checks if the provided `user_email` exists in a hardcoded `ADMIN_EMAILS` list within the function's code.
    *   If the email is found in the list, the function executes a database query to select **all** assets (`SELECT *`) from the `public.assets` table, regardless of the `assigned_to_email` value.
    *   **Result:** Users designated as admins see a complete list of all assets in the system.

**Important Note on Authentication:** The `get-my-assets` function currently uses the `SUPABASE_SERVICE_ROLE_KEY`. This means the function itself bypasses any Row Level Security (RLS) policies when it executes its queries. The filtering logic described above is implemented entirely within the function's code.

## Row Level Security (RLS) Policy

While the Edge Function bypasses RLS, there is typically an RLS policy configured on the `public.assets` table itself for added security (defense-in-depth). A common policy for the `SELECT` operation is:

```sql
-- Policy Name: Allow users to view their own assigned assets
CREATE POLICY "Allow users to view their own assigned assets"
ON public.assets
FOR SELECT
USING (auth.jwt()->>'email' = assigned_to_email);
```

This policy ensures that if a user were to attempt to query the `assets` table directly using their own authentication token (JWT), they would still only be able to see assets assigned to their email address.

## Edge Function Details: `get-my-assets`

*   **Location:** `supabase/functions/get-my-assets/index.ts`
*   **Purpose:** To serve asset data based on the requesting user's role (admin or non-admin).
*   **Authentication:** Uses Supabase Admin client (`SERVICE_ROLE_KEY`), bypassing RLS.
*   **Input:** Expects a POST request with a JSON body containing `{ "user_email": "user@example.com" }`.
*   **Core Logic Snippet (Simplified):**

    ```typescript
    // Simplified logic within the function
    const ADMIN_EMAILS = [
      "admin@scpng.gov.pg", 
      // ... other admin emails
    ];

    const body = await req.json(); 
    const user_email = body?.user_email;

    // ... (Error handling for missing email) ...

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, { /* ... */ });
    
    let query = supabaseAdmin.from("assets").select("*"); 

    const isAdmin = ADMIN_EMAILS.includes(user_email.toLowerCase());

    if (isAdmin) {
      // Admin: No additional filtering, query remains SELECT *
      console.log(`Admin user (${user_email}) detected. Fetching all assets.`);
    } else {
      // Non-Admin: Filter by assigned_to_email
      console.log(`Non-admin user (${user_email}). Filtering assets by assigned_to_email.`);
      query = query.eq("assigned_to_email", user_email);
    }

    // Execute the query
    const { data, error } = await query;

    // ... (Error handling for query execution) ...

    // Return data
    return new Response(JSON.stringify(data || []), { /* ... headers ... */ }); 
    ```

*   **Error Handling:** Includes checks for missing email in input, missing Supabase environment variables, database query errors, and malformed JSON input.
*   **CORS:** Handles preflight OPTIONS requests.

## Frontend Interaction

*   The `useAssetsData` hook (or equivalent) in the frontend is responsible for:
    *   Getting the current user's email (e.g., from MSAL).
    *   Calling the `get-my-assets` Edge Function with the user's email.
    *   Managing loading, error, and data states.
*   The `AssetManagement.tsx` component uses the data returned by the hook to render the table or card view of the assets. 

## Realtime Updates

To ensure the displayed asset data (including values updated by processes like the depreciation cron job) is current without requiring a manual page refresh, the application utilizes Supabase Realtime subscriptions.

1.  **Database Configuration:**
    *   Realtime functionality must be enabled for the `public.assets` table within the Supabase project dashboard (Database -> Replication). Specifically, the table needs to be part of the `supabase_realtime` publication (or another publication configured for Realtime) and broadcast `UPDATE` events.

2.  **Frontend Subscription (`src/pages/AssetManagement.tsx`):**
    *   A `useEffect` hook within the `AssetManagement` component establishes a Realtime subscription when the component mounts.
    *   This subscription listens specifically for `UPDATE` events on the `public.assets` table.
    *   When an `UPDATE` event is received from Supabase (indicating a row in the `assets` table has changed), the callback function triggers the `refresh()` function provided by the `useAssetsData` hook.
    *   Calling `refresh()` causes the hook to re-fetch the latest asset data from the `get-my-assets` Edge Function.
    *   The updated data is then reflected in the component's state, automatically re-rendering the UI with the latest information (e.g., the updated `depreciated_value`).
    *   The subscription is cleaned up (removed) when the component unmounts to prevent memory leaks.

This mechanism ensures that changes made to assets in the database (by any means, including background jobs) are reflected in the user interface in near real-time. 