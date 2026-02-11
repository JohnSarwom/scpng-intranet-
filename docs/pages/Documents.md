# Document Management System Documentation

## Overview
The Document Management System (`src/pages/Documents.tsx`) serves as the central hub for all organizational and personal documents. It organizes content into four primary tabs:
-   **My Documents**: Personal files (OneDrive integration).
-   **Organizational Shared Documents**: Company-wide policies and procedures.
-   **Team / Unit Documents**: Files specific to the user's unit.
-   **External Shared Documents**: Documents and links shared with external parties.

## Key Features

### 1. Tabbed Interface
Users can switch between different document scopes. The active tab determines the content displayed and the options available (e.g., "Add Document" vs "Add External Link").

### 2. Add Document / External Link
A prominent button allows users to add new content.
-   **Location**: The button is located in the **content header row**, aligned with the section title (e.g., "External Documents").
-   **Functionality**:
    -   Internal: Opens a modal to upload documents.
    -   External: Opens a modal to add an external link (`AddExternalLinkModal`).

### 3. Search and Filtering
A search bar at the top allows filtering of documents based on the active tab context.

### 4. Category Browsing
Documents are organized by categories and subcategories, with a dedicated view for browsing.

## Implementation Details

### Components
-   **Page Component**: `src/pages/Documents.tsx`
-   **Services**: `src/services/sharedDocumentsService.ts` (Handles SharePoint list operations).
-   **Modals**: `AddDocumentModal`, `AddExternalLinkModal`.

### Data Source
-   **SharePoint List**: `Organizational_Documents`
-   **OneDrive**: For "My Documents" (via Microsoft Graph).

## Recent Fixes & Improvements (Restoration)

### 1. "Add Document" Button Visibility
-   **Issue**: The button was previously hidden due to strict Role-Based Access Control (RBAC) checking (`isAdmin || isSuperAdmin`).
-   **Fix**: The logic was temporarily relaxed to `const canAddDocument = true;` to ensure all users can see and test the button.
-   **Logic Location**: `Documents.tsx` (Line ~715).

### 2. External Link Saving
-   **Issue**: When adding an external link, the URL was not being saved to the SharePoint list.
-   **Fix**: Updated `addExternalLink` in `sharedDocumentsService.ts` to explicitly include the `ExternalUrl` field in the payload.

### 3. Button Relocation (UI Improvement)
-   **Change**: The "Add Document" button was moved from the search bar row to the **content header row**.
-   **Reason**: To declutter the search area and align the action button with the specific content section it affects.
-   **Implementation**: A flex container was added to the category header section in `Documents.tsx` to position the button to the right of the title.

## Future Considerations
-   **RBAC Re-implementation**: The `canAddDocument` logic should eventually be reverted to checking specific roles (e.g., specific "Contributor" roles) once the permission model is finalized.
-   **SharePoint List Creation**: Ensure the `Organizational_Documents` list exists with all required columns (`ExternalUrl`, `Category`, `SubCategory`, `Tags`).
