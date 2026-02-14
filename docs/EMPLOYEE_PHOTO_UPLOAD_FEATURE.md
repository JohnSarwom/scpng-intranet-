# Employee Photo Upload Feature

## Overview

This document describes the implementation of the employee photo upload feature for the SCPNG Intranet Contacts module. The feature allows users to upload and manage two types of photos for employee contacts:

1. **Profile Photo**: Displayed on contact cards and in the contact details modal avatar
2. **Modal Photo**: Used as a background image in the left panel of the contact details modal

## Architecture

### Components

#### 1. Service Layer (`employeePhotosService.ts`)

The `EmployeePhotosService` class handles all photo-related operations with SharePoint:

**Key Methods:**
- `initialize()`: Sets up the service by discovering SharePoint site and list IDs
- `getEmployeePhotos(email)`: Fetches both profile and modal photo URLs for a given email
- `uploadPhoto(file, email, type)`: Uploads a photo to SharePoint and updates the Employee_Profiles list
- `getPhotoUrl(email)`: Legacy method for backward compatibility (returns only profile photo)

**SharePoint Configuration:**
```typescript
const SITE_PATH = '/sites/scpngintranet';
const SITE_DOMAIN = 'scpng1.sharepoint.com';
const ASSET_LIBRARY_NAME = 'Asset Images';
const PHOTO_LIBRARY_NAME = 'Employee_Photos';
const PROFILE_IMAGES_FOLDER = 'ProfileImages';
const PROFILES_LIST_NAME = 'Employee_Profiles';
```

**Upload Flow:**
1. File is uploaded to `Asset Images/ProfileImages/` folder
2. Filename format: `{email}_{type}_{timestamp}.{extension}`
3. SharePoint list item is updated with the new photo URL
4. Returns the full URL to the uploaded photo

#### 2. Service Logic: Performance & Security

To ensure images load instantly and securely, we implemented a **Blob Fetching** pattern instead of using direct image URLs.

**The Problem:**
- Direct SharePoint URLs (e.g., `https://scpng1.sharepoint.com/.../photo.jpg`) require authentication.
- Standard HTML `<img>` tags cannot pass authentication headers.
- This results in 401 Unauthorized errors or redirects to a login page, causing broken images.

**The Solution: Secure Blob Fetching**
1. **Fetch Content**: The service uses the authenticated Microsoft Graph Client to download the *file content* as a Blob (binary large object).
2. **Create Local URL**: It uses `URL.createObjectURL(blob)` to create a temporary local URL (e.g., `blob:http://localhost:3000/...`).
3. **Display**: This local URL is passed to the `<img>` tag, which can render it instantly without needing further authentication.

**Caching Strategy:**
- **Initialization Cache**: Site ID, Drive ID, and List ID are stored in `static` class variables. This ensures the service only "dials home" to find the SharePoint libraries *once* per session, eliminating a 1-3 second delay on every subsequent call.

#### 3. Hook Layer (`useEmployeePhotos.ts`)

The `useEmployeePhotos` hook provides a React-friendly interface to the service:

**Exported Functions:**
- `getPhotoUrl(email)`: Get profile photo URL
- `getEmployeePhotos(email)`: Get both profile and modal photo URLs
- `uploadPhoto(file, email, type)`: Upload a photo
- `getPhotosForEmails(emails)`: Batch fetch photos for multiple emails
- `isInitialized`: Boolean indicating service readiness

**Initialization:**
- Service is instantiated immediately when Graph client is available
- Background initialization runs asynchronously
- Methods can be called before full initialization completes

#### 4. UI Components

**ContactDetailsModal.tsx:**
- Displays contact information in a modal dialog
- Two photo upload zones:
  1. **Avatar (Profile Photo)**: Circle avatar in the left panel
  2. **Background (Modal Photo)**: Full background of the left panel with dark overlay
- **Optimistic UI**: When a user selects a file to upload, the component immediately displays the selected file using `URL.createObjectURL(file)` *before* the upload completes. This makes the interface feel instant.
- Toast notifications for success/error feedback

**Contacts.tsx:**
- Main contacts page
- Fetches both photo types when a contact is clicked
- Passes `modalPhotoUrl` to the modal component

## SharePoint Setup

### Required Lists and Libraries

#### 1. Asset Images Library
- **Type**: Document Library
- **Location**: `/sites/scpngintranet/Asset Images`
- **Folder Structure**:
  ```
  Asset Images/
  └── ProfileImages/
  	├── user1@scpng.gov.pg_profile_1234567890.jpg
  	├── user1@scpng.gov.pg_modal_1234567891.jpg
  	└── ...
  ```

#### 2. Employee_Profiles List
- **Type**: SharePoint List
- **Location**: `/sites/scpngintranet/Employee_Profiles`
- **Required Columns**:
  - `Title` (Single line of text) - Stores employee email
  - `ProfilePhoto` (Hyperlink or Picture) - URL to profile photo
  - `ModalPhoto` (Hyperlink or Picture) - URL to modal background photo

**Important Notes:**
- The `Title` column must have the `HonorNonIndexedQueriesWarningMayFailRandomly` header set for filtering
- Photos are stored as URLs, not as file attachments
- The service handles both string URLs and object formats (`{ Url: "..." }`)

### Permissions

Users need the following permissions:
- **Read** access to `Asset Images` library
- **Write** access to `Asset Images/ProfileImages` folder
- **Read/Write** access to `Employee_Profiles` list

## Implementation Details

### Photo Upload Process

1. User clicks pencil icon on avatar or left panel background
2. File input dialog opens
3. User selects an image file
4. Upload handler:
   - Sets loading state
   - **Optimistic UI**: Sets local preview immediately
   - Calls `uploadPhoto(file, email, type)`
   - Service uploads file to SharePoint
   - Service updates `Employee_Profiles` list
   - Returns new photo URL
   - Shows success toast
5. Photo displays immediately without page refresh

### State Management

**ContactDetailsModal:**
```typescript
// Profile photo state
const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | undefined>(initialPhotoUrl);

// Modal photo state
const [modalPhoto, setModalPhoto] = useState<string | undefined>(props.modalPhotoUrl);
const [isUploadingModal, setIsUploadingModal] = useState(false);

// Sync with props when contact changes
React.useEffect(() => {
	setModalPhoto(props.modalPhotoUrl);
}, [props.modalPhotoUrl]);
```

**Contacts.tsx:**
```typescript
const handleContactClick = async (contact: MicrosoftContact) => {
	setSelectedContact(contact);
	const email = contact.emailAddresses?.[0]?.address || contact.mail;
	if (email) {
		const photos = await getEmployeePhotos(email);
        // Correctly pass both URLs to modal
        // ...
	}
};
```

## Troubleshooting

### Common Issues

#### 1. "Field 'Title' cannot be referenced in filter"
**Error:**
```
Field 'Title' cannot be referenced in filter or orderby as it is not indexed.
```

**Solution:**
Add the `Prefer` header to Graph API requests:
```typescript
.header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
```

#### 2. "Rendered more hooks than during the previous render"
**Cause:** Hooks were placed after a conditional return statement

**Solution:** Move all hooks to the top of the component, before any conditional returns.

#### 3. Upload fails silently
**Possible Causes:**
- Service not initialized
- Missing permissions
- Invalid email format
- Network error

**Debug Steps:**
1. Check console for error logs
2. Verify `isInitialized` is true
3. Check SharePoint permissions
4. Verify email format matches SharePoint list

#### 4. Photos not displaying (Broken Image)
**Possible Causes:**
- **Authentication Issue**: `<img>` tag trying to load a protected SharePoint URL directly.
- **Missing File**: The file referenced in the list item doesn't exist in the drive.

**Solution (Already Implemented):**
- Ensure `getEmployeePhotos` is using the `URL.createObjectURL(blob)` pattern.
- Check that `EmployeePhotosService.assetsDriveId` is correctly populated.

## Performance Optimization & Caching

To further enhance user experience and reduce network load, a multi-layer caching and optimization strategy has been implemented.

### 1. Persistent Client-Side Caching (IndexedDB)
*   **Service**: `PhotoCacheService` (wraps IndexedDB)
*   **Mechanism**:
    *   Photo blobs are stored in the browser's IndexedDB.
    *   **Read**: Before making a network request, the service checks IndexedDB.
    *   **Validation**: Each cache entry includes a `modified` timestamp. The service compares this against the SharePoint item's `Modified` field. If the server version is newer, the cache is invalidated and updated.
    *   **Write**: Successful network fetches and uploads are immediately stored in IndexedDB.
*   **Benefit**: Instant photo loading on page refreshes and subsequent visits, even after browser restarts.

### 2. Batch Fetching & Parallel Processing
*   **Refactored Method**: `getEmployeePhotos` and `getPhotosForEmails`
*   **Batching**: Instead of one API call per employee, the service fetches metadata for batches of emails (e.g., 15 at a time) using a single filtered query.
*   **Parallelism**: Image blobs for the batch are fetched in parallel using `Promise.all`.
*   **Thumbnails**: For profile photos, the service prioritizes fetching thumbnails (medium size) which are significantly smaller and faster to load than full resolution images.
*   **Benefit**: Drastically reduced loading time for the Contacts grid (e.g., 30 profiles in < 1 second).

### 3. Performance Logging
*   **Telemetry**: The service logs detailed timing metrics to the console prefixed with `⏱️ [PhotoPerf]`.
*   **Metrics Tracked**:
    *   Cache Hits/Misses
    *   Network Fetch Duration
    *   Cache Write Duration
    *   Batch Processing Time

## Testing Checklist

- [x] Upload profile photo for a contact
- [x] Upload modal photo for a contact
- [x] Verify photos persist after page refresh
- [x] **Verify images load instantly (Blob Fetch)**
- [x] **Verify no broken image icons (Secure Auth)**
- [x] **Verify Client-Side Caching (IndexedDB)**
- [x] **Verify Batch Fetching Performance**
- [ ] Test with different image formats (JPG, PNG, GIF)
- [ ] Test with large image files (>5MB)
- [ ] Verify error handling for failed uploads
- [ ] Test permissions (read-only users should not see upload buttons)
- [x] Verify photos display correctly in contact cards
- [x] Verify photos display correctly in modal
- [x] Test switching between contacts (photos should update)

## Future Enhancements
(See original list)
