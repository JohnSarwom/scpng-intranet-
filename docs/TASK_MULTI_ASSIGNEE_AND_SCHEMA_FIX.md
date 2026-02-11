# Multi-Assignee Support & Schema Persistence Fix

## Overview
We have extended the Task management system to support assigning multiple users to a single task. This mirrors the functionality already present in the KRA/KPI modules.

## Features

### 1. Multiple Assignees in Task Dialog
- The "Assignee" dropdown in the Task Creation/Edit dialog (`TaskDialog.tsx`) has been upgraded to a multi-select component.
- You can now search for and select multiple staff members.
- **Backward Compatibility**: The system continues to save the *first* selected user to the legacy `assignee` field. This ensures that existing views (like Task Cards) that rely on a single assignee still display correct information without breaking.

### 2. Data Persistence
- **New Column**: A new SharePoint column named `Assignees` (type: Multiple Lines of Text) stores the list of selected users as a JSON string.
- **Service Update**: `SharePointOpsService.ts` has been updated to:
    - Serialize the array of users to JSON when saving/updating.
    - Parse the JSON back into a user array when loading tasks.

### 3. Schema Migration Tool
Since the `Operations_Tasks` list likely already existed without the `Assignees` column, we created a self-service tool to patch the schema.

#### How to use the Schema Fix Tool:
1. Navigate to the **Test Ground** page (Admin access required).
2. Locate the **SharePoint Operations Lists Setup** card.
3. Click the **"Fix Schema: Add 'Assignees' Column"** button.
4. The system will:
    - Find the `Operations_Tasks` list.
    - Check if the `Assignees` column exists.
    - Create it if it is missing.
    - Report success or failure via a toast notification.

## Technical Details

### `Task` Interface Update
```typescript
export interface Task {
  // ... existing fields
  assignee: string;       // Legacy: Single email string
  assignees?: User[];     // New: Array of User objects
  // ...
}
```

### SharePoint List Schema
- **List**: `Operations_Tasks`
- **Field**: `Assignees`
- **Type**: `Note` (Text, Multi-line)
- **Content**: JSON Array of User objects

### File Changes
- `src/types/index.ts`: Updated `Task` interface.
- `src/services/sharePointListSetupService.ts`: Added `Assignees` column definition and `ensureAssigneesColumn` method.
- `src/services/sharePointOpsService.ts`: Added JSON serialization/deserialization logic.
- `src/components/unit-tabs/TaskDialog.tsx`: Implemented multi-select state and logic.
- `src/pages/TestGround.tsx`: Added the Schema Fix UI.
