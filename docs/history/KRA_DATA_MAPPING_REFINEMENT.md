# KRA Data Mapping Refinements & SharePoint Integration

> **Date**: 2026-02-23
> **Status**: Implemented & Verified

This document details the refined technical architecture for Key Result Area (KRA) data mapping, focusing on UI consistency, automatic context population, and robust data persistence in SharePoint.

---

## 1. UI Label Standardization

To align with the organizational logic where Divisions contain Units, all UI labels in the KRA management flow have been standardized to **"Unit"** (formerly "Unit / Department").

### Key Changes
- **Labels**: "Unit / Department *" → **"Unit *"**
- **Placeholders**: "Select a unit/department" → **"Select a unit"**
- **Empty States**: "No units/departments defined." → **"No units defined."**

**File**: `src/components/kpi/KraFormSection.tsx`

---

## 2. SharePoint Schema Alignment

The `Department` column in the `Performance_KRAs` SharePoint list was a misnomer (it held Unit-level values) and has been **deleted**. The system now uses dedicated `Unit` and `Division` columns.

### Mapping Strategy
| App Field | SharePoint Column | Type | Description |
|-----------|-------------------|------|-------------|
| `unit` | `Unit` | Text | Stored as the Unit's display name (e.g., "IT Unit"). |
| `division` | `Division` | Text | Stored as the Division's display name (e.g., "Corporate Services Division"). |
| `department` | (Deleted) | - | Backward compatibility handled in `mapKRA`. |

**File**: `src/services/sharePointOpsService.ts`

---

## 3. Context Auto-Population

To reduce manual data entry, `Unit` and `Division` fields are automatically populated from the logged-in user's context during KRA creation.

### Data Flow
1. **User Context**: `UserContext` provides the current user's division and unit.
2. **KRA Preparation**: `KRAsTab.tsx` merges these values into the `kraPayload`.
3. **Save**: `sharePointOpsService.ts` writes these directly to the new `Unit` and `Division` columns.

```typescript
// Auto-population logic in KRAsTab.tsx
const kraPayload = {
  ...formData,
  unit: formData.unit || userContext?.unit || '',
  division: userContext?.division || '',
};
```

---

## 4. Owner (Lead) Persistence Logic

SharePoint's `Responsible` (Person/Group) field type was incompatible with Azure AD GUIDs used by the app. The system now uses a **Hybrid Persistence Pattern**.

### The "Hybrid Persistence" Pattern
1. **Responsible (Text Column)**: Stores the owner's **Display Name** for easy visibility in the SharePoint list view.
2. **Assignees (JSON Text Column)**: Stored the full owner object (ID, Name, Email) embedded with an `isOwner: true` flag.

### Logic in `sharePointOpsService.ts`
- **Write (`addKRA`/`updateKRA`)**: Rebuilds the `Assignees` JSON to include the owner object with the `isOwner` flag.
- **Read (`mapKRA`)**: 
    - Finds the `isOwner` entry in the `Assignees` JSON to restore the full `owner` object.
    - Uses the `Responsible` text field as a name-only fallback.

---

## 5. Fetching & Filtering (RBAC)

Filtering for KRAs has been updated to use the new `Division` column for division-level scoping, ensuring data visibility aligns with the new schema.

**File**: `src/services/sharePointOpsService.ts` → `getKRAs()`
- **Filter**: `fields/Division eq '${context.division}'`

---

## Related Files
- `src/components/unit-tabs/KRAsTab.tsx`: Payload preparation and grouping.
- `src/components/kpi/KraFormSection.tsx`: UI labels and auto-fill hooks.
- `src/services/sharePointOpsService.ts`: Core persistence and mapping logic.
- `src/types/index.ts`: Updated `KRA` interface.

---

### KRA Progress & Status Architecture (Refined 2026-02-24)

The architecture described below was initially implemented to move towards purely computed progress. However, to support manual completion overrides and ensure data persistence in SharePoint, the logic was refined on **2026-02-24**.

#### Old State (2026-02-23 Implementation)
- **Problem**: `Status` and `Progress` were being omitted from payloads, leading to "stuck" UI states where changes were not saved to SharePoint.
- **Decision**: Initially attempted to remove `Status` usage and rely solely on live KPI counting. This proved inflexible for manually completed KRAs.

---

## 7. Reinforced Persistence & Manual Completion Logic (2026-02-24)

> **Status**: Implemented & Verified

To resolve status persistence issues and support manual work tracking, the following refinements were implemented:

### 1. Manual Completion Override
The progress calculation logic in `kpiUtils.ts` now prioritizes the KRA's own status.

**Rule**: If KRA Status is **'completed'**, **'done'**, or **'closed'**, `calculateKraProgress()` returns **100%** immediately, overriding the count of individual KPIs.

### 2. Payload Persistence Fix
`KRAsTab.tsx` (the submission handler for `KpiModal.tsx`) now explicitly includes the `status` and `progress` fields in the `kraPayload` sent to SharePoint.

```typescript
// Fixed Payload Construction in KRAsTab.tsx
const kraPayload = {
  ...formData,
  status: formData.status || 'open', // Now explicitly persisted
  progress: formData.progress ?? 0,    // Now explicitly persisted
  // ...
};
```

### 3. SharePoint Status Mapping Alignment
`SharePointOpsService.ts` has been updated to handle the broadened "Closed" set. The `updateKRA` and `addKRA` methods now correctly map UI-level statuses:
- **`'completed'`, `'done'`, `'closed'`** → Mapped to **`'Closed'`** in SharePoint.
- **`'in-progress'`** → Mapped to **`'In Progress'`**.
- **Default** → Mapped to **`'Open'`**.

### 4. Summary of Affected Files (2026-02-24)

| File | Change |
|------|--------|
| `src/components/unit-tabs/KRAsTab.tsx` | Fixed `handleKpiFormSubmit` payload to include `status` and `progress`. |
| `src/services/sharePointOpsService.ts` | Aligned `updateKRA`/`addKRA` status mapping to include 'completed' and 'done'. |
| `src/utils/kpiUtils.ts` | `calculateKraProgress()`: Added manual status override for 100% completion. |
| `src/pages/Unit.tsx` | `combinedKrasForOverview`: Aligned UI status mapping for consistency. |

---

## Related Files (Updated)
- `src/components/unit-tabs/KRAsTab.tsx`: Payload preparation and diagnostic logging.
- `src/utils/kpiUtils.ts`: Progress calculation with manual override.
- `src/services/sharePointOpsService.ts`: SharePoint status mapping and persistence.
- `docs/walkthrough.md`: (Internal) Step-by-step verification of these fixes.

