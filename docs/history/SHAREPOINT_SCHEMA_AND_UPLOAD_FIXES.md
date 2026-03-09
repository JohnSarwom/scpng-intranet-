# SharePoint Schema & Upload Logic Fixes
**Date**: 2026-02-06
**Related Components**: `SharePointListSetupService.ts`, `mockDataMapper.ts`, `TestGround.tsx`

## Overview
This document details the fixes and improvements made to resolve `400 Bad Request` errors during Mock Data Uploads. The primary issues stemmed from schema mismatches (Field Internal Names vs. Display Names) and SharePoint search indexing latency causing lookup failures.

## 1. Schema Standardization
To ensure the UI (`Unit.tsx`) and Backend (`SharePoint Lists`) are synchronized, the following fields were verified and ensured in `SharePointListSetupService.ts`.

### Performance_KPIs List
| Display Name | Internal Name (Fixed) | Type | Notes |
| :--- | :--- | :--- | :--- |
| **IsMockData** | `IsMockData` | Boolean | Used for filtering/cleanup. |
| **RelatedKRA** | `RelatedKRA` | Lookup (KRAs) | Links KPI -> KRA. |
| **Assignees** | `Assignees` | Note (JSON) | Stores multiple user objects as JSON string. |
| **Cost** | `CostAssociated` | Currency | New field added to schema. |

### Unit_Tasks List
| Display Name | Internal Name (Fixed) | Type | Notes |
| :--- | :--- | :--- | :--- |
| **RelatedKPI** | `RelatedKPI` | Lookup (KPIs) | Links Task -> KPI. |
| **AssignedTo** | `AssignedTo` | Person | Assigned user. |
| **Department** | `Department` | Text | Captured from user profile. |

## 2. Key Fixes Implemented

### Fix A: "Bad Request" on KPI Upload (Conflicting Keys)
**Issue:** The `mapKpiToSharePoint` function was hardcoding `RelatedKRAId`, while `uploadMockKPIs` was dynamically resolving the field name (e.g., to `RelatedKRALookupId`). This caused the payload to contain both (or the wrong one), leading to a schema error.
**Resolution:**
Updated `uploadMockKPIs` to actively remove the hardcoded key before applying the dynamically resolved one.
```typescript
// sharePointListSetupService.ts
if ('RelatedKRAId' in mappedKPI.fields) {
    delete mappedKPI.fields.RelatedKRAId;
}
const fields = {
    ...mappedKPI.fields,
    [effectiveRelatedKraKey]: parseInt(kraId)
};
```

### Fix B: "Mapped 0 KPIs for Linkage" (Indexing Latency)
**Issue:** `uploadMockTasks` was attempting to find the just-uploaded KPIs by filtering with `IsMockData eq true`. Since SharePoint search indexing can take minutes, the query returned 0 results immediately after upload. This caused Tasks to fail because they couldn't find their parent KPIs.
**Resolution:**
Changed the fetch strategy to retrieve the **most closely created items** instead of relying on the search index.
```typescript
// sharePointListSetupService.ts
// OLD (Failed): .filter(`fields/IsMockData eq true`)
// NEW (Fixed):
const uploadedKPIs = await this.client.api(...)
    .orderby('createdDateTime desc') // Sort by newest
    .top(500)
    .get();
```

### Fix C: Task Schema Alignment
**Issue:** Tasks were missing the `Department` field and correct `RelatedKPI` lookup.
**Resolution:**
1. Added `Department` to the `createTasksList` schema definition.
2. Updated `mockDataMapper` to map `unit_id` to `Department`.
3. Added dynamic lookup creation for `RelatedKPI` if it doesn't exist.

## 3. How to Verify
If issues reoccur, follow this reset procedure using the **TestGround** page:
1. Click **"Reset / Delete Operations Lists"** (Deletes `Unit_Tasks`, `Performance_KPIs`, `Performance_KRAs`).
2. Refresh the page.
3. Click **"Generate Mock Data"** (Creates local objects).
4. Click **"Upload Mock Data"** (Recreates Lists & Uploads Items).
5. Check Console Logs for:
   - `✓ Found column: 'RelatedKPI'`
   - `Mapped X KPIs for linking` (Must be > 0)

## 4. Further Troubleshooting
For issues related to API updates, "TypeError" crashes on save, or other integration patterns, please refer to:
- [SHAREPOINT_API_TROUBLESHOOTING.md](./SHAREPOINT_API_TROUBLESHOOTING.md)
