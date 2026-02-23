# Divisional Performance Chart — Data Linkage Fix

> **Date**: 2026-02-23
> **Status**: Implemented & Verified

This document details the investigation and fix for the **Divisional Performance** chart in the Analytics tab of the Strategy page showing 0% progress for all divisions (LSD, LISD, RPD, CSD, OC).

---

## 1. Problem

The "Divisional Performance" bar chart compares Objective and KRA progress across the five SCPNG divisions. Despite objectives and KRAs existing in SharePoint, every division bar rendered at 0%.

---

## 2. Root Cause Analysis

Three separate gaps in the data pipeline caused the chart to receive no usable data:

### Gap 1 — `fetchObjectives()` dropped the Division field
`StrategyService.fetchObjectives()` mapped SharePoint list items to plain objects but **did not include** the `Division`, `Unit`, or `GoalType` fields. Every returned strategic objective had `division: undefined`.

**File**: `src/services/strategyService.ts`

```typescript
// Before — division/unit/goalType were never mapped
return {
    id: item.id,
    title: item.fields.Title,
    ...
    isFeatured: isFeatured
};

// After — fields are now mapped
return {
    id: item.id,
    title: item.fields.Title,
    ...
    isFeatured: isFeatured,
    division: item.fields.Division || '',
    unit: item.fields.Unit || '',
    goalType: item.fields.GoalType || ''
};
```

### Gap 2 — `buildDivisionalComparisonData()` had no fallback via unit objectives
Even if strategic objectives lacked a `division` tag, **unit-level objectives** (from `Unit_Objectives`) always carry a `division` field and a `parentGoalId` linking back to the strategic objective. The original function only looked at strategic objectives and had no path to use unit objectives as a fallback.

**File**: `src/utils/strategyAnalyticsUtils.ts`

### Gap 3 — `unitObjectives` were never passed to the chart
`StrategyAnalytics` already received `unitObjectives` as a prop (the full list is fetched in `Strategy.tsx`) but never forwarded it to `DivisionalComparison`.

**File**: `src/components/strategy/StrategyAnalytics.tsx`

---

## 3. Changes Made

### 3.1 `src/services/strategyService.ts`
Added `division`, `unit`, and `goalType` field mappings inside `fetchObjectives()` so that strategic objectives carry their SharePoint division tag through to the rest of the application.

### 3.2 `src/utils/strategyAnalyticsUtils.ts`
Rewrote `buildDivisionalComparisonData()` with a three-layer data linkage strategy:

| Layer | Source | Match Method |
|-------|--------|--------------|
| 1 | Strategic objectives | `o.division` matched against division abbr / full name / aliases |
| 2 | Unit-level objectives | `o.division` or `o.unit` matched against same alias list |
| 3 | Strategic objectives (indirect) | Linked via child unit objective's `parentGoalId` |

Also expanded division aliases to match the full official names used in SharePoint:

| Abbr | Full Name | Key Aliases |
|------|-----------|-------------|
| LSD | Legal Services | Legal Services Division, Legal Advisory |
| LISD | Licensing | Licensing, Market & Supervision Division, Supervision Unit, Market Data Unit, Investigations Unit |
| RPD | Research | Research & Publication Division, Publication Unit |
| CSD | Corporate Services | Corporate Services Division, Finance Unit, IT Unit, Human Resource Unit |
| OC | Office of the Chairman | Executive Division, Secretariat Unit |

The function signature changed to accept a third optional parameter:
```typescript
// Before
buildDivisionalComparisonData(objectives, kras)

// After
buildDivisionalComparisonData(objectives, kras, unitObjectives = [])
```

### 3.3 `src/components/strategy/analytics/DivisionalComparison.tsx`
Added `unitObjectives?: any[]` to the component's props interface and passes it through to `buildDivisionalComparisonData()`.

### 3.4 `src/components/strategy/StrategyAnalytics.tsx`
Forwarded the existing `unitObjectives` prop to `<DivisionalComparison>`:
```tsx
// Before
<DivisionalComparison objectives={filteredObjectives} kras={filteredKras} />

// After
<DivisionalComparison objectives={filteredObjectives} kras={filteredKras} unitObjectives={unitObjectives} />
```

---

## 4. Data Flow (After Fix)

```
SharePoint: Strategic_Objectives (with Division field)
SharePoint: Unit_Objectives (with division, unit, parentGoalId)
SharePoint: Performance_KRAs (with objective_id)
         ↓
useStrategySharePoint → fetchObjectives() [now maps Division field]
useSharePointObjectives → allUnitObjectives [already had division]
useSharePointKRAs → allKras [already had objective_id]
         ↓
Strategy.tsx passes: effectiveObjectives, allKras, allUnitObjectives
         ↓
StrategyAnalytics.tsx → DivisionalComparison (unitObjectives now forwarded)
         ↓
buildDivisionalComparisonData()
  → Layer 1: strategic objectives by division tag
  → Layer 2: unit objectives by division/unit tag
  → Layer 3: strategic objectives linked via parentGoalId
         ↓
Recharts BarChart — LSD / LISD / RPD / CSD / OC with real progress values
```

---

## 5. Related Files

- `src/services/strategyService.ts` — Adds division field to fetched objectives
- `src/utils/strategyAnalyticsUtils.ts` — Core data linkage logic
- `src/components/strategy/analytics/DivisionalComparison.tsx` — Chart component
- `src/components/strategy/StrategyAnalytics.tsx` — Analytics dashboard container
- `src/pages/Strategy.tsx` — Top-level data fetching and prop passing

---

## 6. Update: KPI Status-Based KRA Progress (2026-02-23)

> **Status**: Implemented & Verified

### Problem
The KRAs bar in the Divisional Performance chart was reading the stored `Progress` field from `Performance_KRAs` in SharePoint, which was defaulting to `100%` due to the list column's default value. This made the chart inaccurate and disconnected from actual work completion.

### SharePoint Schema Changes
The following columns were removed from the `Performance_KRAs` list to prevent stale/default values polluting the chart:

| Column | Action | Reason |
|--------|--------|--------|
| `Status` | **Deleted** | App was setting `status: 'pending'` on creation; now no status is written |
| `Progress` | Default value cleared | The app no longer reads this for chart calculation |

### New Calculation Rule
KRA progress is now **derived entirely from the completion status of its linked KPIs**. No stored value is used.

```
KRA Progress (%) = (KPIs with status "completed" / "achieved" / "done") ÷ (total KPIs) × 100
```

- A KRA with **0 completed KPIs** → **0%**
- A KRA with **all KPIs completed** → **100%** (counts as "completed" in the dashboard)
- Target/Actual numeric fields on KPIs have **no effect** on progress

### Files Changed

| File | Change |
|------|--------|
| `src/utils/kpiUtils.ts` | `calculateKraProgress()` rewritten to count completed KPIs by status only |
| `src/utils/strategyAnalyticsUtils.ts` | `buildDivisionalComparisonData()` now accepts a `kpis` param and uses `getKraProgressFromKpis()` inline (same rule) |
| `src/components/strategy/analytics/DivisionalComparison.tsx` | Added `kpis?: any[]` prop, passes to `buildDivisionalComparisonData()` |
| `src/components/strategy/StrategyAnalytics.tsx` | Passes `kpis={kpis}` to `<DivisionalComparison>` |
| `src/components/unit-tabs/OverviewTab.tsx` | Dashboard KRA Progress card now calls `calculateKraProgress()` instead of `kra.progress`; "X completed" count based on KPI completion |
| `src/components/kpi/KpiModal.tsx` | Removed `status: 'pending'` from both `setFormData` and `handleSubmit` — no status written to SharePoint on create/edit |

### Consistent Behavior Across UI
Both the **Dashboard Overview KRA Progress card** and the **Strategy Analytics Divisional Performance chart** now use the identical calculation rule, ensuring the numbers are always consistent.

---

## 7. Info Tooltip Added to Divisional Performance Card (2026-02-23)

> **Status**: Implemented & Verified

### Change
An **info button (ⓘ)** was added to the top-right corner of the Divisional Performance card header, appearing on hover — consistent with the info buttons on the Overview dashboard cards.

Clicking the button opens a Dialog modal explaining:

| Element | Description shown to user |
|---------|--------------------------|
| 🟥 Objectives bar | Average progress % of unit-level objectives in that division |
| 🔵 KRAs bar | Live KPI status-based formula — no stored value used |
| Formula callout | `(KPIs with status "Completed" ÷ total KPIs per KRA) × 100`, averaged across all KRAs in the division |
| Actionable note | How to increase the KRA bar (mark KPIs as Completed in KRAs & Objectives tab) |
| Caveat | Target/Actual figures on KPIs have no effect — only KPI status matters |

### File Changed

| File | Change |
|------|--------|
| `src/components/strategy/analytics/DivisionalComparison.tsx` | Wrapped card in `<Dialog>`, added `<DialogTrigger>` info button in header, added `<DialogContent>` with full explanation |
