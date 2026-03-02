# Editable Org Structure Modals Implementation

## 1. Objective
The goal of this implementation is to provide administrators with the ability to edit the content of Divisions and Units directly from the Strategy organizational chart view. This involves integrating an "Edit" mode into the existing `DivisionModal` and `UnitModal` components, substituting read-only text fields with active inputs, and saving changes directly to the assigned SharePoint lists.

## 2. Requirements & UI/UX Specifications
*   **Role-Based Access Control (RBAC):** The editing tools and "Edit" button must be strictly limited to administrative users.
*   **In-Place Editing:** Modals should smoothly transition between a read-only "View Mode" and an interactive "Edit Mode" without requiring a separate page navigation.
*   **Optimistic UI / Live Updating:** After saving edits, the backend is updated, and the main `OrgChart` data must be refreshed immediately to reflect changes.
*   **Comprehensive Field Access:** Administrators must be able to edit specific fields such as the mission statement, location, manager/director quotes, contact information, and dynamically manage statutory duties (adding/removing items from a list).

## 3. Implementation Details

### 3.1. Authentication and Authorization (`useRoleBasedAuth`)
The application utilizes a custom hook `useRoleBasedAuth` to fetch the current user's role from a designated SharePoint list via Microsoft Graph. 
*   In `DivisionModal.tsx` and `UnitModal.tsx`, the hook is invoked: `const { isAdmin } = useRoleBasedAuth();`
*   The "Edit Division" or "Edit Unit" buttons in the sticky footer are conditionally rendered based on this `isAdmin` flag.

### 3.2. Modal State Management
State was introduced directly into both modals to manage the editing lifecycle.
```typescript
const [isEditing, setIsEditing] = useState(false);
const [isSaving, setIsSaving] = useState(false);
const [formData, setFormData] = useState<MockDivisionData | MockUnitData | null>(null);
```
*   When a user clicks "Edit", a deep copy of the currently passed `division` or `unit` prop is created and assigned to `formData`. `isEditing` is set to `true`.
*   A derived state `currentData` dynamically decides whether to show the active `formData` (if editing) or the stable `division/unit` prop (if viewing).

### 3.3. Dynamic Form Handling
The modals were refactored to conditionally render layout elements:
*   **Text Inputs & Textareas:** Imported from `shadcn/ui`, `Input` and `Textarea` replace standard `<p>` tags during edit mode.
*   **Nested Object Handlers:** `manager`, `director`, and `primaryContact` are nested objects requiring precise state updates. A `handleNestedChange` utility function ensures safe, immutable updates.
*   **Array Handlers:** The `statutoryDuties` required specific array manipulation functions (`handleDutyChange`, `addDuty`, `removeDuty`) allowing admins to directly type into specific array elements or delete them outright using a trash icon.

### 3.4. SharePoint Services Layer Integration
Both `DivisionService.ts` and `UnitService.ts` implement `updateDivision(id, payload)` and `updateUnit(id, payload)` methods using the Microsoft Graph Client.
*   The lists (`Strategy_Divisions`, `Strategy_Units`) receive PATCH requests targetting the individual item's `/fields` endpoint.
*   The save handler (`handleSave`) wraps the API call in a try/catch block, sets `isSaving` to provide visual feedback (a spinner on the save button), and fires a toast notification upon success or error.

### 3.5. React Query Data Invalidation
To ensure the `OrgChart` parent component reflects the changes immediately after saving, the Tanstack React Query hooks (`useDivisions` and `useUnits`) manage the data cache.
*   Upon successful save, `queryClient.invalidateQueries({ queryKey: ["strategyDivisions"] })` (or `strategyUnits`) is called.
*   This forces the queries to refetch from SharePoint in the background and update the UI seamlessly.

## 4. Challenges Addressed
*   **Deep State Mutations:** Managing nested objects (like `manager.name`) requires careful state-setting logic to prevent data loss across other fields.
*   **Complex Types:** Ensuring seamless serialization of JSON string arrays (like `statutoryDuties`) between the frontend form arrays and the SharePoint string fields. Tested to ensure edits map securely.
*   **Role Security:** Making sure non-administrators absolutely cannot access the editing elements. The UI completely hides the triggers, and backend mutations require Graph tokens validating the patch action.

## 5. Next Steps / Future Enhancements
*   Consider implementing a full revisions history tab on the modals to track edit patterns.
*   Extend the edit capability to dynamically add, edit, or remove the `subDepartments` or `coreFunctions` arrays similar to the `statutoryDuties` implementation.
