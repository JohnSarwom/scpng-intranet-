# Document Management System — Documentation

**File:** `src/pages/Documents.tsx`

---

## Overview

The Document Management System is the central hub for all organisational and personal documents. It provides four primary sections, search, category browsing, folder navigation, and file management — all within a single page backed by Microsoft OneDrive (Graph API) and SharePoint.

---

## Sections (Primary Tabs)

| Tab | Icon | Description |
|-----|------|-------------|
| My Documents | `User` | Personal OneDrive files and folders. Supports folder drill-down navigation. |
| Organisational Shared Documents | `Building` | Company-wide policies, procedures, forms, and other shared resources, organised by category. |
| Team / Unit Documents | `Users` | Documents scoped to the current user's team or division. |
| External Shared Documents | `Globe` | External links and documents shared with parties outside the organisation. |

---

## Key Features

### 1. Tabbed Interface
Switching primary tabs fetches the appropriate data source and adjusts available actions (e.g. "Add Document" vs "Add External Doc/Link"). The active tab persists the secondary navigation state independently.

### 2. Search & Filtering
A search bar in the top navigation row filters the displayed documents/folders client-side based on name. The placeholder text updates to reflect the active tab context.

### 3. Add Document / External Link
A button in the section header row opens a modal:
- **Internal tabs** → `AddDocumentModal` for uploading files to SharePoint.
- **External Shared** → `AddExternalLinkModal` for saving a URL link.
- Visibility is controlled by `canUploadOrg` / `canUploadExt` (admin, or a user explicitly granted upload permission via Admin → Doc Permissions).

See [document-permissions.md](../features/document-permissions.md) for the full permission model.

### 4. Add Category (Admin Only)
On the Organisational Shared Documents tab, admins can add, edit, and delete document categories via `AddCategoryDialog` / `EditCategoryDialog`. Categories are stored in SharePoint via `documentCategoriesService`.

### 5. Folder Navigation (My Documents)
Clicking an OneDrive folder drills into it. A breadcrumb trail shows the current path, and a Back button navigates up. Breadcrumb items are clickable to jump to any ancestor level.

### 6. View Toggle (Grid / List)
Added **2026-04-04**. A toggle in the page header switches the folder section between two layouts:

#### Grid View (default)
- Folders render as `DocumentFolderCard` — a card with a large folder icon, name, description, file count, size, modified date, shared-with avatars, and an org-wide badge.
- Layout: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`

#### List View
- Folders render as `DocumentFolderRow` — a horizontal row with:
  - Small folder icon on the left
  - Name and description (truncated)
  - File count, size, modified date, org-wide badge, and shared-with avatars aligned right
  - Admin edit/delete actions appear on row hover
- Layout: `flex flex-col gap-2`

The toggle applies to **all tabs** (My Documents, Organisational, Team/Unit, External). State is held in `viewMode: 'grid' | 'list'` (default `'grid'`).

**Toggle button location:** Top-right of the page header, between the Info button and the Refresh button.

### 7. Info Dialog
Added **2026-04-04**, extended **2026-04-04**. A small `Info` icon button in the top-right header opens a scrollable dialog (`Dialog` from shadcn/ui) containing three sections:

1. **Sections key** — maps each tab icon to its section name and purpose.
2. **Supported File Types** — a grid mapping every coloured file-type icon to its file type.
3. **Key Risks & Considerations** — colour-coded cards explaining upload size limits, folder delete behaviour, rename extension warnings, auth token expiry handling, and rate limiting. Relevant to My Documents (OneDrive) operations.

### 8. My Documents — Full OneDrive CRUD (2026-04-04)

Upload, create folders, rename, and delete files/folders directly from the My Documents tab.

- **Upload File** button → triggers a hidden `<input type="file" multiple>`. Multi-file supported.
- **New Folder** button → opens an inline dialog with a text input.
- **Drag-and-drop** → drag files anywhere onto the My Files area; a visual overlay prompts "Drop files to upload".
- **Per-item hover actions** (both grid and list): Rename (pencil), Delete (trash). Files also get an Open (external link) button.
- **Progress banner** — shown while an upload is in progress.
- **Auto-refresh** — the current folder view reloads after every mutation.

Full technical details: [document-onedrive-crud.md](../features/document-onedrive-crud.md)

### 9. Org/External Shared — Per-File Delete (2026-04-04)

When a user navigates into a category (files view), individual file cards now show **Open** and **Delete** hover buttons if the user has the appropriate permission (`canDeleteOrg` or `canDeleteExt`). Deleting calls `deleteSharedDocument` from `sharedDocumentsService.ts` and refreshes the documents list.

A separate confirm dialog is shown with the message *"This document will be permanently removed from the shared library."*

### 10. Document Permissions (2026-04-04)

Non-admin users can be granted Upload and/or Delete access per section (Org Shared, External Shared) via **Admin → Doc Permissions**. Admins always have full access. The permission flags `canUploadOrg`, `canDeleteOrg`, `canUploadExt`, `canDeleteExt` gate all relevant toolbar buttons and per-file action buttons.

Full technical details: [document-permissions.md](../features/document-permissions.md)

---

## File Type Icon Reference

| Icon | Colour | File Types |
|------|--------|------------|
| `FolderOpen` | Blue | Folders (OneDrive / category buckets) |
| `FileText` | Blue | Word documents (`.doc`, `.docx`) |
| `FileSpreadsheet` | Green | Spreadsheets (`.xls`, `.xlsx`) |
| `Presentation` | Red | Presentations (`.ppt`, `.pptx`) |
| `File` | Red | PDF files (`.pdf`) |
| `FileImage` | Purple | Images (`.jpg`, `.jpeg`, `.png`, `.gif`) |
| `FileArchive` | Yellow | Archives (`.zip`, `.rar`) |
| `FileCode` | Indigo | Code files (`.js`, `.ts`, `.html`, `.css`) |
| `Video` | Pink | Videos (`.mp4`, `.mov`, `.avi`) |
| `Music` | Teal | Audio (`.mp3`, `.wav`, `.aac`) |
| `FileText` | Gray | Text files, Markdown, and all other types |

Icon mapping functions:
- `getFileIconForDocument(doc)` — used for real OneDrive/SharePoint files (line ~516)
- `getFileTypeIcon(typeName)` — used for grouped file-type category cards (line ~495)
- `createMockDocument → getFileIcon(ext)` — used for mock/demo data (line ~283)

---

## Internal Components

| Component | Type | Description |
|-----------|------|-------------|
| `DocumentFolderCard` | Inline component | Grid-view card for a folder or category. Accepts `showDriveActions`, `onRename`, `onDriveDelete` for My Documents |
| `DocumentFolderRow` | Inline component | List-view row for a folder or category. Same extra props as above |
| `FileCard` | Local component | Card for individual file items |
| `AddDocumentModal` | Imported | Upload documents to SharePoint |
| `AddCategoryDialog` | Imported | Create a new document category |
| `EditCategoryDialog` | Imported | Edit an existing category |
| `DocumentsPageSkeleton` | Imported | Loading skeleton for the full page |
| `DocumentPermissionsTab` | Imported (admin) | Admin table for granting per-user document permissions |

---

## State Reference

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `documents` | `DisplayableDocument[]` | `[]` | Raw documents fetched for active tab |
| `filteredDocuments` | `DisplayableDocument[]` | `[]` | Search-filtered subset of `documents` |
| `searchQuery` | `string` | `''` | Current search input value |
| `authError` | `boolean` | `false` | True if MSAL auth failed for OneDrive |
| `currentPath` | `PathItem[]` | `[]` | Breadcrumb stack for OneDrive folder navigation |
| `activePrimaryTab` | `string` | `'company-wide'` | ID of the active primary tab |
| `activeSecondaryNav` | `string` | `'all-company'` | Active secondary nav item within the tab |
| `viewMode` | `'grid' \| 'list'` | `'grid'` | Controls grid vs list folder layout |
| `isLoading` | `boolean` | `false` | Global loading flag |
| `isUploading` | `boolean` | `false` | True during file upload |
| `dynamicCategories` | `DocumentCategory[]` | `[]` | Categories loaded from SharePoint |
| `categoriesLoaded` | `boolean` | `false` | True once category fetch completes |
| `navigationState` | `NavigationState` | `categories` level | Tracks drill-down level within a tab |
| `isDriveUploading` | `boolean` | `false` | True during any OneDrive CRUD operation |
| `uploadProgress` | `string \| null` | `null` | Message shown in the upload progress banner |
| `isDragOver` | `boolean` | `false` | True while files are dragged over the My Files zone |
| `renameTarget` | `DisplayableDocument \| null` | `null` | Item currently being renamed |
| `renameValue` | `string` | `''` | Current text in the rename input |
| `deleteTarget` | `DisplayableDocument \| null` | `null` | OneDrive item pending delete confirmation |
| `sharedDocDeleteTarget` | `MockDocument \| null` | `null` | Org/External SharePoint item pending delete confirmation |
| `isNewFolderOpen` | `boolean` | `false` | Controls the New Folder dialog |
| `newFolderName` | `string` | `''` | Input value for new folder name |

---

## Services & Data Sources

| Source | Service / Hook | Used For |
|--------|---------------|----------|
| OneDrive (Graph API) | `useMicrosoftGraph` | My Documents files and folders |
| SharePoint `Organizational_Documents` list | `sharedDocumentsService` | Org shared docs, external links |
| SharePoint document categories list | `documentCategoriesService` | Dynamic category management |
| Azure AD / MSAL | `useMsal`, `getGraphClient` | Authentication for Graph calls |
| Supabase | `useSupabaseAuth`, `useRoleBasedAuth` | User identity and admin role checks |

---

## Navigation Architecture

```
categories level  →  documentFolders[] rendered as cards/rows
      ↓  (click a folder)
files level       →  currentCategoryData.sections[].files rendered as FileCards
      ↓  (My Documents only: click an OneDrive folder)
folder drill-down →  currentPath[] updated, new Graph API call, documents[] replaced
```

---

## Recent Changes

### 2026-04-04 — OneDrive CRUD, Document Permissions, Per-File Delete, Info Dialog Update

**My Documents — full OneDrive CRUD**
- Added `uploadToOneDrive`, `createOneDriveFolder`, `renameOneDriveItem`, `deleteOneDriveItem` to `useMicrosoftGraph.tsx`.
- Upload File button + hidden `<input type="file" multiple>` in the My Files toolbar.
- New Folder button + inline dialog.
- Drag-and-drop zone wrapping the My Files grid/list.
- Per-item hover actions (Open, Rename, Delete) on both grid cards and list rows.
- Upload progress banner while operations are in-flight.
- Three inline dialogs: New Folder, Rename, Delete Confirm.
- Auto-refresh after every mutation via `refreshCurrentFolder()`.

**Document Permissions**
- `canUploadOrg`, `canDeleteOrg`, `canUploadExt`, `canDeleteExt` flags derived from `useRoleBasedAuth`.
- Upload/Add toolbar buttons gated by `canUpload*`.
- Created `DocumentPermissionsTab` component for Admin panel.
- Added "Doc Permissions" tab to `Admin.tsx`; updated tab grid to 9 columns.
- Re-enabled `Permissions` field serialisation in `UserSharePointService.updateUser()`.

**Org/External Shared — per-file delete**
- Added `deleteSharedDocument` import from `sharedDocumentsService`.
- Per-file Open + Delete hover buttons in the files view, gated by `canDeleteOrg`/`canDeleteExt`.
- `sharedDocDeleteTarget` state + `handleSharedDocDeleteConfirm` handler + separate confirm dialog.

**Info dialog update**
- Converted hover panel to a proper scrollable `Dialog`.
- Added "Key Risks & Considerations" section with colour-coded risk cards.

### 2026-04-04 — View Toggle & Info Panel
- Added `LayoutGrid`, `LayoutList`, `Info` icon imports from `lucide-react`.
- Added `viewMode` state (`'grid' | 'list'`, default `'grid'`).
- Added `DocumentFolderRow` component for list-view layout.
- Added grid/list toggle button group in the page header (top-right).
- Added `Info` dialog with system description, sections key, and file-type icon key.
- Both `my-documents` and all other tab folder renders are now view-mode-conditional.

### Previous — Add Document Button Relocation
- Moved "Add Document" button from the search bar row into the content header row to reduce clutter.

### Previous — External Link Saving Fix
- `addExternalLink` in `sharedDocumentsService.ts` updated to include `ExternalUrl` in the payload.

### Previous — RBAC Visibility Fix
- `canAddDocument` temporarily set to `isAdmin` (was previously over-restricted).

---

## Future Considerations
- Persist `viewMode` preference to `localStorage` so it survives page refreshes.
- Add list-view support for individual `FileCard` items inside categories (currently only folder-level cards toggle).
- Move/copy OneDrive items: `PATCH /me/drive/items/{id}` with `parentReference.id`.
- Per-category document permissions (grant upload to one category only, not all of Org Shared).
- Bulk permission grant by Division or Unit in the Doc Permissions admin tab.
- Audit log for who granted/revoked document permissions and when.
