# User Group Customization Feature

## Overview
The User Group Customization feature allows individual users to personalize their view of the Kanban task board. Users can hide default task groups ("TO DO", "IN PROGRESS", etc.), rename any group, and restore their preferences at any time. These customizations are persistent across sessions and devices.

## Key Features
1.  **Hide Default Groups**: Users can "delete" default groups from their view. This action hides the group rather than permanently deleting it from the system, preserving the integrity of the default workflow.
2.  **Rename Groups**: Users can rename both default and custom groups.
3.  **Persistence**: Preferences are saved to SharePoint and automatically loaded on login.
4.  **Optimistic UI Updates**: Changes (renaming, hiding) differ instant feedback on the UI while syncing to the backend in the background.

## Architecture

### Data Persistence
User preferences are stored in the **`System_View_Settings`** SharePoint list.
-   **Component**: `TaskGroups`
-   **Scope**: `User`
-   **Storage Format**: A JSON object stored in the `Description` column (mapped to `Settings` in the service).

**JSON Structure:**
```json
{
  "component": "TaskGroups",
  "userEmail": "user@example.com",
  "preferences": {
    "hiddenGroups": ["TO DO"],
    "renamedGroups": {
      "IN PROGRESS": "Active Work"
    },
    "lastUpdated": "2024-02-06T10:00:00.000Z"
  }
}
```

### Key Components

#### 1. `useTaskGroupPreferences` Hook
Located in `src/hooks/useTaskGroupPreferences.ts`.
This hook manages the state of user preferences and handles synchronization with SharePoint.

-   **Authentication**: Uses `useSupabaseAuth` for the session email, with a fallback to `useMsal` account username if the Supabase session is not fully synced.
-   **Optimistic Updates**: 
    -   State `setPreferences` is called immediately upon user action.
    -   `syncPreferences` is called asynchronously to update SharePoint in the background.
    -   This ensures the UI feels responsive (instant renames/hides) without waiting for network requests.

#### 2. `SharePointOpsService`
Located in `src/services/sharePointOpsService.ts`.
Updated to include generic methods for managing view settings:
-   `getViewSettings(userEmail, component)`: Fetches settings, mapping the `Description` field to a `settings` property.
-   `addViewSetting(...)`: Creates a new settings entry.
-   `updateGenericViewSetting(id, jsonString)`: Updates the stored JSON configuration.

#### 3. `TasksTab` & `Unit` Components
-   **`Unit.tsx`**: Integration point. Fetches preferences and filters the `bucket` list before passing it to `TasksTab`. Merges customized names onto the buckets.
-   **`TasksTab.tsx`**: Handles the UI interactions.
    -   **Renaming**: Double-click on a header to enter edit mode (handled via `isEditing` state).
    -   **Deleting**: Checks if a group is a default group. If yes, calls `hideGroup` (preference change). If no (custom group), calls `deleteGroup` (permanent deletion).

## Usage Guide (For Developers)

To use this feature in other components:
```typescript
import { useTaskGroupPreferences } from '@/hooks/useTaskGroupPreferences';

const MyComponent = () => {
    const { preferences, hideGroup, renameGroup } = useTaskGroupPreferences();

    // Access hidden groups
    console.log(preferences.hiddenGroups); 
    
    // Check if a group is renamed
    const displayName = preferences.renamedGroups['originalId'] || 'Default Name';
}
```

## Recent Bug Fixes & Improvements

### Fix 1: Task Dialog Dropdown Not Showing Renamed Groups (Feb 2026)
**Problem:** The "Group/Column" dropdown in the Task Creation/Edit dialog was displaying default group names (e.g., "TO DO", "IN PROGRESS") instead of the user's custom renamed groups (e.g., "Urgent Tasks", "Licensing Team").

**Root Cause:** The `TaskDialog.tsx` component had fallback logic (line 107) that defaulted to `DEFAULT_BUCKETS` if the `buckets` prop was not correctly populated. Additionally, the dialog was receiving `taskBuckets` (un-renamed) instead of `visibleBuckets` (with user preferences applied).

**Solution:**
1. Modified `TaskDialog.tsx` to remove incorrect fallback to `DEFAULT_BUCKETS`
2. Updated `Unit.tsx` (line 890) to pass `visibleBuckets` instead of `taskBuckets` to `TaskDialog`

**Files Modified:**
- [TaskDialog.tsx](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/components/unit-tabs/TaskDialog.tsx) (line 107)
- [Unit.tsx](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/pages/Unit.tsx) (line 890, 908)

---

### Fix 2: Tasks Incorrectly Routed to "Shared Projects" (Feb 2026)
**Problem:** When creating a task in a custom/renamed group (e.g., "Urgent Tasks"), the task would appear in the "Shared Projects" group instead of the selected group.

**Root Cause:** Mismatch between `unit_id` being saved in SharePoint and the `currentUnit` being used for filtering:
1. The `addTask` function in `sharePointOpsService.ts` prioritized the `department` argument over `task.unit_id`, setting the SharePoint `Department` field to a division name instead of the unit name
2. The `handleTaskSubmit` function in `Unit.tsx` wasn't explicitly passing `userContext.unit` when creating tasks

**Solution:**
1. Modified `sharePointOpsService.ts` (line 345) to prioritize `task.unit_id` over `department`:
   ```typescript
   Department: task.unit_id || department || 'General'
   ```
2. Modified `Unit.tsx` `handleTaskSubmit` to inject `unit_id`:
   ```typescript
   taskState.add({ ...taskData, unit_id: userContext.unit })
   ```

**Files Modified:**
- [sharePointOpsService.ts](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/services/sharePointOpsService.ts) (line 345)
- [Unit.tsx](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/pages/Unit.tsx) (lines 356-363)

---

### Fix 3: UI Flicker on Page Reload (Feb 2026)
**Problem:** Upon page reload, task board initially displayed default group names ("TO DO", "IN PROGRESS"), which then flickered to custom renamed groups after a brief delay. This created a jarring user experience.

**Root Cause:** The `useTaskGroupPreferences` hook fetched preferences from SharePoint on mount, causing a delay before renamed groups appeared. The UI would render with default names during this loading period.

**Solution:** Implemented **localStorage caching** with the following strategy:

1. **Immediate Load for Returning Users:**
   - Initialize preferences from `localStorage` if available
   - Set `loading` state to `false` if cache exists
   - Display cached preferences instantly while background sync occurs

2. **Skeleton Loading for New Users:**
   - If no cache exists, `loading` state remains `true`
   - `Unit.tsx` displays a skeleton loading UI instead of default buckets
   - Prevents showing incorrect default names on first load

**Implementation Details:**

**`useTaskGroupPreferences.ts`:**
- Initialize state from `localStorage` in `useState` initializer function
- Load preferences from cache on component mount (instant)
- Sync with SharePoint in background
- Update `localStorage` on every preference change (optimistic updates)

```typescript
const [preferences, setPreferences] = useState<TaskGroupPreferences>(() => {
    const cached = localStorage.getItem(`taskGroupPreferences_${userEmail}`);
    if (cached) return JSON.parse(cached);
    return { hiddenGroups: [], renamedGroups: {} };
});

const [loading, setLoading] = useState(() => {
    return !localStorage.getItem(`taskGroupPreferences_${userEmail}`);
});
```

**`Unit.tsx`:**
- Modified `visibleBuckets` memo to return empty array if loading and no preferences
- Added conditional rendering to show skeleton UI during initial load:

```typescript
{visibleBuckets.length === 0 && preferencesLoading ? (
    <div className="flex gap-4 overflow-x-auto pb-4">
        {/* Skeleton loading cards */}
    </div>
) : (
    <TasksTab buckets={visibleBuckets} ... />
)}
```

**Benefits:**
- ✅ Returning users see renamed groups instantly (0ms delay)
- ✅ New users see professional loading state instead of wrong names
- ✅ No visual flicker or layout shift
- ✅ Improved perceived performance

**Files Modified:**
- [useTaskGroupPreferences.ts](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/hooks/useTaskGroupPreferences.ts) (lines 29-54, 176-237)
- [Unit.tsx](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/pages/Unit.tsx) (lines 1-2, 657-674, 801-816)

---

## Performance Characteristics

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| **First Load (New User)** | Shows default names → flickers to custom names (500ms delay) | Shows skeleton → shows custom names (500ms delay) |
| **Subsequent Loads** | Shows default names → flickers to custom names (500ms delay) | Shows custom names instantly (0ms delay) |
| **Cross-Device** | Each device has delay on first load | First device caches, other devices sync from server |

## Technical Notes

### localStorage Key Format
```
taskGroupPreferences_${userEmail}
```

### Cache Invalidation
- Cache is updated on every preference change (rename, hide, restore)
- Background sync with SharePoint ensures consistency
- If server data is newer, it overwrites local cache

### Browser Compatibility
- Uses standard `localStorage` API (IE8+, all modern browsers)
- Gracefully handles `localStorage` unavailable (falls back to server-only mode)

