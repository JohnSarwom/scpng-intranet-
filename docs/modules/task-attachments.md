# Task Attachments Feature

**Date Implemented:** 2026-03-24 @ 16:30 (PGT)
**Author:** IT Unit

## Overview

Task attachments allow users to upload files (any type) when creating or editing tasks on the Unit page. Files are stored in a dedicated SharePoint document library with an organized folder structure based on the user's division and unit.

## Architecture

### Storage

- **Document Library:** `Task_Registry_Attachements` on SharePoint site `scpngintranet`
- **Folder Structure:** `{Division}/{Unit}/{TaskTitle}/`
  - Example: `Corporate Services Division/IT Unit/Upgrade Firewall Policies/scpng logo.png`
  - Folders are auto-created by SharePoint when the first file is uploaded to a path
  - Folder names are sanitized (special characters `#%*:<>?/\|"` are stripped)

- **Metadata Storage:** `AttachmentsJSON` column on `Operations_Tasks` list (Multiple lines of text, Plain text)
  - Stores a JSON array of attachment references:
    ```json
    [
      {
        "name": "scpng logo.png",
        "url": "https://scpng1.sharepoint.com/sites/scpngintranet/Task_Registry_Attachements/Corporate%20Services%20Division/IT%20Unit/Upgrade%20Firewall%20Policies/scpng%20logo.png",
        "size": 158198
      }
    ]
    ```

### Data Flow

```
User selects files in TaskDialog
  -> Files staged locally as pendingFiles (not uploaded yet)
  -> User clicks "Create Task" / "Save Changes"
  -> Files upload to SharePoint: Task_Registry_Attachements/{Division}/{Unit}/{TaskTitle}/
  -> Upload returns webUrls
  -> Attachment metadata (name, url, size) saved to task's AttachmentsJSON field
  -> On re-open, existing attachments display as clickable links
```

### Creator Tracking

The task creator is automatically captured by SharePoint's built-in `Created By` field. The app reads this via `item.createdBy.user.email` and `item.createdBy.user.displayName`, mapped to `task.createdByEmail` and `task.createdBy`. Displayed in the top-right of the TaskDialog header.

## Files Modified

| File | Change |
|------|--------|
| `src/types/index.ts` | Added `attachments?: { name: string; url: string; size?: number }[]` to `Task` interface |
| `src/services/sharePointOpsService.ts` | `mapTask()` reads `AttachmentsJSON`; `addTask()` and `updateTask()` write `AttachmentsJSON`; graceful fallback if column missing |
| `src/components/unit-tabs/TaskDialog.tsx` | Replaced placeholder "Add File"/"Add Link" buttons with drag-and-drop file upload UI; uploads on submit; displays existing attachments as links |
| `src/components/unit-tabs/TasksTab.tsx` | Added `currentDivision` prop, forwarded to TaskDialog |
| `src/pages/Unit.tsx` | Passes `currentDivision={userContext?.division}` to TasksTab |

## SharePoint Prerequisites

1. **Document Library:** `Task_Registry_Attachements` (already created)
   - URL: `https://scpng1.sharepoint.com/sites/scpngintranet/Task_Registry_Attachements/`
   - No special columns needed; folders are auto-created on upload

2. **List Column:** `AttachmentsJSON` on `Operations_Tasks` list
   - Type: Multiple lines of text (Plain text)
   - Stores JSON array of attachment metadata per task

## UI Behavior

- **Upload area:** Dashed border drop zone with "Click or drag files here to attach" prompt
- **Pending files:** Shown in blue-tinted rows with paperclip icon, file name, size, and remove button
- **Existing attachments:** Shown in muted rows with file icon, clickable link (opens in new tab), size, and remove button
- **Submit button:** Shows "Uploading files..." spinner while files upload, then transitions to "Saving..."/"Creating..."
- **Error handling:** If upload fails, task still saves without attachments; toast notification shown
- **Graceful fallback:** If `AttachmentsJSON` column doesn't exist yet, the service retries without it (task saves, but attachment metadata is not persisted until column is created)

## Permissions

No new permissions required. The existing `useSharePointUpload` hook uses:
- `Sites.ReadWrite.All`
- `Files.ReadWrite.All`

These are already configured in the MSAL auth scopes.
