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

## 6. KRA Progress & Status Architecture (2026-02-23)

> **Status**: Implemented & Verified

### Problem
Two sources of inaccuracy were identified in how KRA progress was tracked:

1. **Stored `Progress` field defaulted to 100%** — The `Performance_KRAs` SharePoint list had a column default value of `100`, meaning every new KRA appeared as fully complete regardless of actual work done.
2. **Status field conflict** — `KpiModal.tsx` was writing `status: 'pending'` to SharePoint on every creation/edit, creating a discrepancy against SharePoint's own column default of `Open`.

### SharePoint Changes

| Column | Action |
|--------|--------|
| `Status` | **Deleted** from `Performance_KRAs` list |
| `Progress` | Default value **cleared** (column retained for backward compatibility) |

### New Progress Calculation Rule

KRA progress is now **computed live** from the completion status of its linked KPIs. No stored field is used.

```
KRA Progress (%) = (# of KPIs with status "completed" / "achieved" / "done")
                   ÷ (total KPIs in that KRA) × 100
```

This calculation is implemented in `calculateKraProgress()` in `src/utils/kpiUtils.ts` and is the **single source of truth** used by:
- The **Dashboard Overview KRA Progress card** (`OverviewTab.tsx`)
- The **Strategy Analytics Divisional Performance chart** (`strategyAnalyticsUtils.ts` → `DivisionalComparison.tsx`)

### KRA Creation Change

`KpiModal.tsx` no longer sends a `status` or `progress` value to SharePoint during KRA creation or editing. The form data no longer includes these fields:

```typescript
// Before
const completeFormData = {
  ...formData,
  status: formData.status || 'pending',  // ← removed
};

// After
const completeFormData = {
  ...formData,
  // no status field
};
```

### Summary of Affected Files

| File | Change |
|------|--------|
| `src/utils/kpiUtils.ts` | `calculateKraProgress()`: KPI status-based count only |
| `src/utils/strategyAnalyticsUtils.ts` | `buildDivisionalComparisonData()`: uses same rule via `getKraProgressFromKpis()` |
| `src/components/unit-tabs/OverviewTab.tsx` | KRA Progress card reads `calculateKraProgress()` not `kra.progress` |
| `src/components/kpi/KpiModal.tsx` | Removed `status: 'pending'` from form init and submit |
| `src/components/strategy/analytics/DivisionalComparison.tsx` | Added `kpis` prop |
| `src/components/strategy/StrategyAnalytics.tsx` | Passes `kpis` to `DivisionalComparison` |
