# Task Grouping and Persistence Fix

## 1. Problem Statement

We encountered a significant issue with the Task Board (Kanban) where tasks assigned to **Custom Groups** (buckets) would not persist in those groups.

**Symptoms:**
1.  **Reverting Columns:** Users would create a Custom Group (e.g., "Tech"), move a task into it, but upon refreshing the page, the task would revert to a default column based on its Status (e.g., "To Do" or "In Progress").
2.  **Status Override:** Changing a task's Status (e.g., from "To Do" to "In Progress") would forcibly move the task out of the Custom Group and into the "In Progress" column, effectively making Custom Groups unusable for workflow management.
3.  **Data Loss:** The assignment to the Custom Group was not being saved to the backend (SharePoint).

## 2. Technical Root Causes

### A. SharePoint Schema Limitations
The application uses the `RelatedProjectLookupId` field in the SharePoint `Operations_Tasks` list to store the Group/Project assignment.
*   **Limitation:** SharePoint Lookup columns strictly require a **Numeric ID** that corresponds to an existing item in the target list (Projects).
*   **The Conflict:** Custom Groups created in the UI (like "Tech" or "Backlog") generate **String IDs** (e.g., `bucket-1749283` or simply `Tech`).
*   **Failure:** When the application tried to save `RelatedProjectLookupId: "Tech"`, SharePoint rejected the value or treated it as null because it wasn't a valid number. This meant the group assignment was never saved to the database.

### B. UI Priority Logic
The `TasksTab` component had logic that prioritized **Status** over **Group** assignment to ensure tasks were always visible.
*   **The Conflict:** The code logic said: "If this task has Status 'In Progress', put it in the 'In Progress' column," which overrode any Custom Group assignment.

## 3. The Solution: "Bucket Tags" Strategy & "Strict Decoupling"

To solve this without altering the rigid SharePoint schema, we implemented a workaround called **"Bucket Tags"** and refactored the UI logic to strictly decouple Status from Grouping.

### Strategy Overview
1.  **Persistence Workaround:** Since we cannot save a String ID into the `RelatedProjectLookupId` field, we store it in the **`Tags`** field instead, formatted as `bucket:GroupName`.
2.  **Logic Update:** The Service Layer intercepts the data. If it sees a `bucket:` tag, it treats that as the `projectId` (Group).
3.  **UI Decoupling:** The UI now respects the `projectId` (Group) above all else. Status is purely a visual badge and does not dictate position on the board.

## 4. Implementation Details

### A. Service Layer (`SharePointOpsService.ts`)
We updated the `SharePointOpsService` to handle the transformation transparently.

**1. Reading Tasks (`mapTask`)**
When fetching tasks, we check if `RelatedProjectLookupId` is missing. If it is, we look for a tag starting with `bucket:`.
```typescript
let projectId = f.RelatedProjectLookupId?.toString();
if (!projectId) {
    // If no real Project ID, look for the hidden bucket tag
    projectId = this.getBucketIdFromTags(tags); // e.g., extracts "Tech" from "bucket:Tech"
}
```

**2. Writing Tasks (`addTask` / `updateTask`)**
When saving, we check if the `projectId` is a custom string.
*   If it is a **Number**: We save it to `RelatedProjectLookupId` (Standard behavior).
*   If it is a **String** (Custom Group): We set `RelatedProjectLookupId` to `null` and instead append a `bucket:ID` tag to the `Tags` field.

```typescript
// Helper to manage tags
private updateTagsWithBucketId(tags: string[], bucketId?: string): string[] {
    const cleanTags = tags.filter(t => !t.startsWith('bucket:'));
    if (bucketId && isNaN(Number(bucketId))) { 
        // It's a custom group! Save as tag.
        cleanTags.push(`bucket:${bucketId}`);
    }
    return cleanTags;
}
```

### B. UI Layer (`TasksTab.tsx`)
We refactored the board initialization logic.

**Strict Hierarchy:**
1.  **Check `projectId` first:** If the task has a `projectId` (which now correctly comes from the Service, either from a real project or a bucket tag), place it in that column **immediately**.
2.  **Fallback to Status:** Only if `projectId` is completely missing do we fall back to placing it in a Status column.

```typescript
// Logic in TasksTab.tsx
if (task.projectId) {
    const projectBucket = activeBuckets.find(b => b.id === task.projectId);
    if (projectBucket) {
        newBoardData[projectBucket.id].push(task);
        return; // STOP HERE - Do not check status
    }
}
// ... Fallback to Status ...
```

### C. Drag and Drop Fix
We updated the `onDragEnd` handler to ensure that when a task is moved to a new group, we don't accidentally wipe out its existing tags (which might contain other important metadata).

### D. The Final Bug Fix (`TaskDialog.tsx`)
Even after implementing the above, it wasn't working. We traced this to the `TaskDialog` component.
*   **The Bug:** When submitting the "Edit Task" form, the component was constructing a new payload but **omitting the existing `tags`**.
*   **The Consequence:** The Service received the update request but with `tags: undefined`. Therefore, it couldn't append the `bucket:` tag because it didn't know about the existing tags, or simply didn't process the tag logic correctly because the data was incomplete.
*   **The Fix:** We added `tags: initialData?.tags` to the payload in `handleSubmit`.

```typescript
// TaskDialog.tsx
const taskData: Partial<Task> = {
  // ...
  projectId: groupId, 
  tags: initialData?.tags, // CRITICAL: Pass existing tags so Service can utilize them
  // ...
};
```

## 5. Summary of Workflow Now

1.  **User** moves "Task A" to "Tech" Group.
2.  **UI (`TasksTab`)** calls `updateTask` with `projectId: "Tech"`.
3.  **Dialog (`TaskDialog`)** ensures `tags` are passed if edited via modal.
4.  **Service (`SharePointOpsService`)** sees `projectId` is "Tech" (not a number).
5.  **Service** clears `RelatedProjectLookupId` and adds `bucket:Tech` to the Tags column.
6.  **SharePoint** saves the item.
7.  **Refresh:** Service reads `bucket:Tech` tag -> sets `task.projectId = "Tech"`.
8.  **UI** sees `projectId="Tech"` -> places task in "Tech" column, ignoring its Status.

This ensures complete persistence and flexibility for the Kanban board.
