# Division Image Backdrop Implementation

## 1. Objective
Add a full-backdrop image feature to the `DivisionModal` left sidebar, allowing users to upload and display a cover image for each division. The image covers the entire sidebar panel with a dark overlay for text readability, and a pencil icon appears on hover to upload or change the image. This mirrors the existing photo upload pattern used on the Contacts page (`ContactDetailsModal`).

## 2. Architecture Overview

```
SharePoint List (Strategy_Divisions)          SharePoint Library (Asset Images)
┌─────────────────────────────────┐          ┌──────────────────────────────────┐
│ DivisionImage: "filename.jpg"   │ ───────> │ DivisionImages/filename.jpg      │
│ (Single line of text column)    │          │ (Actual image file)              │
└─────────────────────────────────┘          └──────────────────────────────────┘
         │                                              │
         ▼                                              ▼
   DivisionService.mapFromSharePointItem()    DivisionService.getDivisionImageUrl()
         │                                              │
         ▼                                              ▼
   useDivisions() hook (React Query)          Graph API blob download
         │                                              │
         ▼                                              ▼
   OrgChart → selectedDivision.divisionImage   URL.createObjectURL(blob)
         │                                              │
         ▼                                              ▼
   DivisionModal useEffect ──────────────────> divisionImageUrl state
                                                        │
                                                        ▼
                                               <img> backdrop in sidebar
```

## 3. SharePoint Configuration

### 3.1. Strategy_Divisions List
A new column was added to the existing `Strategy_Divisions` SharePoint list:

| Column Name    | Type                 | Purpose                                      |
|----------------|----------------------|----------------------------------------------|
| DivisionImage  | Single line of text  | Stores the filename of the uploaded image     |

The column stores only the **filename** (e.g., `corporate_services_division_1709394821000.jpg`), not a full URL.

### 3.2. Asset Images Library
Images are stored in the existing `Asset Images` document library under a dedicated subfolder:

```
Asset Images/
└── DivisionImages/
    ├── corporate_services_division_1709394821000.jpg
    ├── licensing__market___supervision_division_1709394835000.jpg
    └── ...
```

The SharePoint library URL:
`https://scpng1.sharepoint.com/sites/scpngintranet/Asset%20Images/Forms/AllItems.aspx?id=%2Fsites%2Fscpngintranet%2FAsset%20Images%2FDivisionImages`

## 4. Files Modified

### 4.1. `src/components/strategy/DivisionModal.tsx`

#### Interface Change
Added `divisionImage` to the `MockDivisionData` interface:
```typescript
export interface MockDivisionData {
    // ... existing fields ...
    statutoryDuties?: string[];
    divisionImage?: string;  // NEW: filename of the division backdrop image
}
```

#### New Imports
```typescript
import React, { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { compressImage } from '@/lib/utils';
```

#### New State Variables
```typescript
const [divisionImageUrl, setDivisionImageUrl] = useState<string | null>(null);
const [isUploadingImage, setIsUploadingImage] = useState(false);
```

#### Image Loading (useEffect)
When the modal opens and `division.divisionImage` is set, the effect:
1. Creates a `DivisionService` instance via the MSAL Graph client
2. Calls `getDivisionImageUrl(filename)` to fetch the image blob
3. Converts the blob to a browser-usable `blob:` URL via `URL.createObjectURL`
4. Sets state → image renders as backdrop

```typescript
useEffect(() => {
    if (!isOpen || !division?.divisionImage) {
        setDivisionImageUrl(null);
        return;
    }
    let cancelled = false;
    const loadImage = async () => {
        const graphClient = await getGraphClient(msalInstance);
        const service = new DivisionService(graphClient);
        const url = await service.getDivisionImageUrl(division.divisionImage!);
        if (!cancelled) setDivisionImageUrl(url);
    };
    loadImage();
    return () => { cancelled = true; };
}, [isOpen, division?.divisionImage, msalInstance]);
```

#### Image Upload Handler
```typescript
const handleImageUpload = async (event) => {
    // 1. Compress image (max 1280px, 70% quality)
    const compressedFile = await compressImage(file, 1280, 0.7);

    // 2. Optimistic UI: show image immediately from local blob
    setDivisionImageUrl(URL.createObjectURL(compressedFile));

    // 3. Upload to SharePoint
    await service.uploadDivisionImage(division.id, compressedFile, division.divisionName);

    // 4. Invalidate React Query cache to refresh data
    queryClient.invalidateQueries({ queryKey: ['strategyDivisions'] });
};
```

#### Sidebar Layout Structure
The sidebar uses a **two-layer approach** to ensure the image covers the full panel:

```
Outer wrapper (overflow-hidden, relative)
├── Background layer (z-0):
│   ├── <img> — absolute inset-0, object-cover (fills entire sidebar)
│   └── <div> — absolute inset-0, bg-black/50 (dark overlay)
├── Pencil icon (z-50, absolute top-right, opacity-0 → visible on hover)
└── Scrollable content layer (z-10, overflow-y-auto):
    ├── Building2 icon + division name + branch
    ├── Primary contact, location, total staff
    ├── Quote box (bg-black/20 + backdrop-blur)
    └── ID code
```

This ensures:
- The image and dark overlay are **fixed behind** the scrollable content
- Content scrolls independently while the image stays pinned
- No horizontal scrollbar (overflow-x-hidden)
- The pencil icon stays fixed in the top-right corner

### 4.2. `src/services/divisionService.ts`

#### New Constants
```typescript
const SITE_DOMAIN = 'scpng1.sharepoint.com';
const SITE_PATH = '/sites/scpngintranet';
const ASSET_LIBRARY_NAME = 'Asset Images';
const DIVISION_IMAGES_FOLDER = 'DivisionImages';
```

#### New Static Property
```typescript
private static assetsDriveId: string | null = null;
```
Caches the Asset Images drive ID across service instances.

#### Updated `initialize()`
Now also resolves the Asset Images library drive ID alongside the Strategy_Divisions list ID.

#### Updated Field Mappings

**`mapToSharePointItem()`** — writes `DivisionImage` field:
```typescript
DivisionImage: division.divisionImage || null
```

**`mapFromSharePointItem()`** — reads `DivisionImage` field:
```typescript
divisionImage: item.fields.DivisionImage || undefined
```

#### New Method: `getDivisionImageUrl(filename)`
Fetches the image blob from SharePoint and returns a browser-usable URL.

**Strategy:**
1. Try fetching a **large thumbnail** first (faster, smaller payload):
   ```
   GET /drives/{driveId}/root:/DivisionImages/{filename}:/thumbnails/0/large/content
   ```
2. Fallback to **full content** if thumbnail fails:
   ```
   GET /drives/{driveId}/root:/DivisionImages/{filename}:/content
   ```
3. Convert blob → `URL.createObjectURL(blob)`

#### New Method: `uploadDivisionImage(divisionId, file, divisionName)`
Uploads a new image and updates the list item.

**Steps:**
1. **Generate filename:** `{safe_division_name}_{timestamp}.{ext}`
   Example: `corporate_services_division_1709394821000.jpg`
2. **Cleanup old images:** Lists files in `DivisionImages/`, deletes any matching `{safe_name}_*` prefix
3. **Upload new file:** `PUT /drives/{driveId}/root:/DivisionImages/{fileName}:/content`
4. **Update list item:** `PATCH /lists/{listId}/items/{id}/fields` with `{ DivisionImage: fileName }`

## 5. Data Flow

### 5.1. Initial Load (Modal Opens)
```
1. User clicks division node in OrgChart
2. handleDivisionClick() finds division from rawDivisions (useDivisions hook)
3. rawDivisions data includes divisionImage field from SharePoint
4. setSelectedDivision({ ...divData }) → DivisionModal receives division prop
5. useEffect detects division.divisionImage is set
6. DivisionService.getDivisionImageUrl(filename) fetches blob via Graph API
7. URL.createObjectURL(blob) → setDivisionImageUrl() → image renders
```

### 5.2. Image Upload
```
1. User hovers sidebar → pencil icon appears
2. User clicks pencil → file picker opens
3. User selects image → handleImageUpload fires
4. compressImage(file, 1280, 0.7) compresses client-side
5. URL.createObjectURL(compressed) → optimistic preview shown immediately
6. DivisionService.uploadDivisionImage() uploads to SharePoint
7. queryClient.invalidateQueries(['strategyDivisions']) → data refetch
8. Toast notification confirms success/failure
```

## 6. UI Behavior

| State               | Sidebar Appearance                                           |
|----------------------|--------------------------------------------------------------|
| No image uploaded    | Solid `#800020` background, Building2 watermark, pencil on hover |
| Image uploaded       | Full backdrop image, `bg-black/50` overlay, pencil on hover  |
| Uploading in progress| Spinner replaces pencil icon, optimistic image preview shown |
| Upload failed        | Error toast, previous state preserved                        |

## 7. Image Compression
Before upload, images are compressed client-side using the `compressImage()` utility from `src/lib/utils.ts`:
- **Max width:** 1280px (landscape images preserved well)
- **Quality:** 0.7 (70% JPEG quality)
- **Output format:** Always JPEG
- Uses HTML Canvas API for resizing

## 8. Comparison with Contacts Page Photo Upload

| Aspect                | Contacts Page                          | Division Modal                        |
|------------------------|----------------------------------------|---------------------------------------|
| Storage folder         | `Asset Images/ProfileImages/`          | `Asset Images/DivisionImages/`        |
| Metadata list          | `Employee_Profiles` (separate list)    | `Strategy_Divisions` (same list)      |
| Metadata field         | `ProfilePhoto` / `ModalPhoto`          | `DivisionImage`                       |
| Service                | `EmployeePhotosService`                | `DivisionService`                     |
| Hook                   | `useEmployeePhotos`                    | Direct service call in useEffect      |
| Caching                | IndexedDB via `photoCacheService`      | None (fetched on modal open)          |
| Compression            | 400px (avatar) / 1280px (modal)        | 1280px                                |
| Upload trigger         | Pencil icon on hover                   | Pencil icon on hover                  |

## 9. Future Enhancements
- Add IndexedDB caching for division images (reuse `photoCacheService` pattern) to speed up repeat views
- Extend the same image backdrop feature to `UnitModal`
- Add image cropping/positioning controls
- Support multiple images (gallery/carousel) per division
