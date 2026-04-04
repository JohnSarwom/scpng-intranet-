# OneDrive CRUD Operations — My Documents

**Date Implemented:** 2026-04-04  
**Author:** IT Unit

---

## Overview

The My Documents section of the Document Management System now supports a full suite of file management operations backed by the Microsoft Graph OneDrive API:

| Operation | Trigger | Graph API |
|-----------|---------|-----------|
| Upload file(s) | Upload button or drag-and-drop | `PUT /me/drive/items/{parent}:/{name}:/content` (≤4 MB) or upload session (>4 MB) |
| Create folder | New Folder button | `POST /me/drive/items/{parent}/children` |
| Rename file or folder | Pencil hover button | `PATCH /me/drive/items/{id}` |
| Delete file or folder | Trash hover button | `DELETE /me/drive/items/{id}` |

All operations are scoped to the current user's personal OneDrive and respect the folder the user has navigated into.

---

## Files Modified

| File | Change |
|------|--------|
| `src/hooks/useMicrosoftGraph.tsx` | Added `uploadToOneDrive`, `createOneDriveFolder`, `renameOneDriveItem`, `deleteOneDriveItem` functions and exposed them in the hook return value |
| `src/pages/Documents.tsx` | Added upload/folder toolbar, drag-and-drop zone, per-item hover actions, CRUD state variables, handlers, dialogs, and progress banner |

---

## Hook Functions (`useMicrosoftGraph.tsx`)

### `uploadToOneDrive(file, parentId)`

- **Small files (≤ 4 MB):** Uses a simple `PUT` to `/me/drive/items/{parentId}:/{fileName}:/content`.
- **Large files (> 4 MB):** Creates an upload session via `/me/drive/items/{parentId}:/{fileName}:/createUploadSession` and uploads in 5 MB chunks.
- Both paths pass `@microsoft.graph.conflictBehavior: 'rename'` so duplicates are auto-renamed (e.g. `file (1).docx`) instead of failing.
- Returns a `DisplayableDocument` on success, `null` on failure.

### `createOneDriveFolder(name, parentId)`

- `POST` to `/me/drive/items/{parentId}/children` with `folder: {}` and `@microsoft.graph.conflictBehavior: 'rename'`.
- Returns a `DisplayableDocument` on success.

### `renameOneDriveItem(itemId, newName)`

- `PATCH` to `/me/drive/items/{itemId}` with body `{ name: newName }`.
- Returns `true` on success.

### `deleteOneDriveItem(itemId)`

- `DELETE` to `/me/drive/items/{itemId}` — moves item to the user's OneDrive recycle bin (recoverable for 30 days).
- Returns `true` on success.

---

## UI Additions (`Documents.tsx`)

### Toolbar — My Files header

Two buttons appear in the section heading row when `activePrimaryTab === 'my-documents'`:

- **Upload File** — triggers a hidden `<input type="file" multiple>` via `fileInputRef`. Supports multi-file selection.
- **New Folder** — opens the New Folder inline dialog.

### Drag-and-Drop Zone

The entire My Files grid/list is wrapped in a drag-and-drop receiver:

- `onDragOver` — sets `isDragOver: true`, shows a "Drop files to upload" overlay with a large `Upload` icon.
- `onDragLeave` — clears `isDragOver`.
- `onDrop` — extracts `event.dataTransfer.files` and calls `handleFileUpload` for each.

### Per-Item Hover Actions

Both grid (`DocumentFolderCard`) and list (`DocumentFolderRow`) views expose action buttons that appear on hover:

**Folders:**

| Button | Icon | Action |
|--------|------|--------|
| Rename | `Pencil` | Opens the Rename dialog pre-filled with current name |
| Delete | `Trash2` | Opens the Delete Confirm dialog |

**Files (grid):**

| Button | Icon | Action |
|--------|------|--------|
| Open | `ExternalLink` | Opens `doc.url` in a new tab |
| Rename | `Pencil` | Opens the Rename dialog |
| Delete | `Trash2` | Opens the Delete Confirm dialog |

**Files (list):**

Same three buttons, displayed inline on the right side of the row.

### Upload Progress Banner

While `isDriveUploading` is true, a tinted banner shows below the toolbar with a spinning `RefreshCw` icon and the current `uploadProgress` string (e.g. `"Uploading report.docx (1/3)…"`).

---

## Dialogs

### New Folder Dialog

- Inline modal (fixed overlay).
- Text input with `autoFocus`, Enter key confirms, Escape cancels.
- Calls `handleCreateFolder()` → `createOneDriveFolder(name, currentParentId)`.

### Rename Dialog

- Pre-filled with the current item name.
- Enter confirms, Escape cancels.
- Calls `handleRenameConfirm()` → `renameOneDriveItem(target.id, newName)`.

### Delete Confirm Dialog

- Shows item name and a contextual description:
  - Folder: *"This folder and all its contents will be moved to your OneDrive recycle bin."*
  - File: *"This file will be moved to your OneDrive recycle bin."*
- Calls `handleDeleteConfirm()` → `deleteOneDriveItem(target.id)`.

---

## State Variables Added

| Variable | Type | Purpose |
|----------|------|---------|
| `isDriveUploading` | `boolean` | Disables buttons during any CRUD operation |
| `uploadProgress` | `string \| null` | Message shown in the progress banner |
| `isDragOver` | `boolean` | Controls drag-and-drop visual overlay |
| `fileInputRef` | `RefObject<HTMLInputElement>` | Programmatically triggers file picker |
| `renameTarget` | `DisplayableDocument \| null` | Item currently being renamed |
| `renameValue` | `string` | Current value in rename input |
| `deleteTarget` | `DisplayableDocument \| null` | Item pending delete confirmation |
| `isNewFolderOpen` | `boolean` | Controls New Folder dialog |
| `newFolderName` | `string` | Input value for new folder name |

---

## Refresh Behaviour

After every successful mutation the app calls `refreshCurrentFolder()`:

```
if (currentPath.length > 0) → getFolderContents(currentFolderId)
else                         → fetchPersonalDocumentsRoot()
```

This keeps the view in sync without a full page reload.

---

## Key Risks & Considerations

| Risk | Mitigation |
|------|-----------|
| Files over 4 MB with simple PUT will fail | `uploadToOneDrive` detects `file.size > 4 * 1024 * 1024` and automatically switches to a chunked upload session |
| Deleting a folder with contents | Graph API handles recursively. User is warned in the confirm dialog that the folder and **all its contents** will move to the recycle bin |
| Renaming and changing the file extension | The file is renamed exactly as typed. If the extension is removed or changed the file may become unreadable. The user should verify the extension before confirming |
| Auth token expiry mid-upload (large files) | `getGraphClient` handles silent re-authentication with a popup fallback |
| Rate limiting on large batches | Not a concern for single-item user-driven operations |

---

## Permissions Required

No new Azure AD app permissions are needed. The following scopes are already configured:

- `Files.ReadWrite` — read, upload, rename, delete personal OneDrive files
- `Files.ReadWrite.All` — access files in any OneDrive the user has access to

---

## Future Considerations

- Move / copy items: `PATCH /me/drive/items/{id}` with `parentReference.id`
- Show recycle bin contents and allow restore
- Upload progress percentage (requires chunked upload session response parsing)
- Toast notification with "Undo" shortcut for deletes (calls restore from recycle bin)
