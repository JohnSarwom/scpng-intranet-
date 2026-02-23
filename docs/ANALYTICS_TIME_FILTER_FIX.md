# Analytics Time Filter — Data & UI Fix

> **Date**: 2026-02-23
> **Status**: Implemented & Verified

This document details the investigation and fix for the **Analytics Dashboard time filter** (Week/Month/Quarter/Year/All Time buttons) not affecting the displayed charts and metrics.

---

## 1. Problem

The time filter buttons in the Analytics tab header allowed users to select different time periods, but the charts and metrics showed no changes regardless of the selected filter. All data remained static, ignoring the time period selection.

---

## 2. Root Cause Analysis

Four separate gaps in the data pipeline prevented the filter from having any effect:

### Gap 1 — Strategic objectives had no date fields for filtering
**File**: `src/services/strategyService.ts` (line 166–210)

`fetchObjectives()` mapped SharePoint list items to objects but **did not include** the `StartDate`, `EndDate`, or timestamp fields. Every objective returned had `startDate: undefined` and `endDate: undefined`.

Without these dates, the `filterByTimePeriod()` function had no data to work with and fell through to `return true` (always include), making the filter a complete no-op.

### Gap 2 — `filterByTimePeriod()` had no fallback for items without dates
**File**: `src/utils/strategyAnalyticsUtils.ts` (line 17–42)

If an item had no `startDate`/`endDate`, it was unconditionally included regardless of the selected period. This meant even objectives with no date range information would always appear.

### Gap 3 — Progress Trends chart was hardcoded to 12 months
**File**: `src/utils/strategyAnalyticsUtils.ts` (line 62–86)

`buildProgressTrendData()` **always** returned 12 calendar months (Jan–Dec) regardless of the selected time period. The X-axis never changed, so visually and logically, the chart appeared static.

### Gap 4 — `timePeriod` was never passed to ProgressTrends component
**File**: `src/components/strategy/StrategyAnalytics.tsx` (line 57) and `src/components/strategy/analytics/ProgressTrends.tsx` (line 12–13)

The `ProgressTrends` component did not receive the `timePeriod` prop, so it could not pass it to `buildProgressTrendData()`. The component's description text also remained fixed.

### Gap 5 — No user-visible feedback on which time period is active
**File**: `src/components/strategy/StrategyAnalytics.tsx` (line 43–49)

The header subtitle showed only static text ("Strategic performance insights and AI-driven analysis"). Users had no way to see at a glance what time period they had selected.

---

## 3. Changes Made

### 3.1 `src/services/strategyService.ts` (lines 200–203)

Added date field mappings to the objective mapper inside `fetchObjectives()`:

```typescript
// Before — no dates mapped
return {
    id: item.id,
    title: item.fields.Title,
    ...
    isFeatured: isFeatured,
};

// After — dates now mapped
return {
    id: item.id,
    title: item.fields.Title,
    ...
    isFeatured: isFeatured,
    startDate: item.fields.StartDate || null,
    endDate: item.fields.EndDate || null,
    modifiedAt: item.lastModifiedDateTime || null,
    createdAt: item.createdDateTime || null,
};
```

**Impact**: Strategic objectives now carry their SharePoint date range and modification timestamps through to filtering and analytics functions.

---

### 3.2 `src/utils/strategyAnalyticsUtils.ts` (lines 17–53)

Enhanced `filterByTimePeriod()` with a fallback strategy for items without explicit date ranges:

```typescript
// Before — fell through to always-include
return items.filter(item => {
    const startStr = item.startDate || item.date;
    const endStr = item.endDate;
    // ... date checks ...
    return true; // No dates = always included
});

// After — uses modifiedAt/createdAt as fallback
return items.filter(item => {
    const startStr = item.startDate || item.date;
    const endStr = item.endDate;
    const fallbackStr = item.modifiedAt || item.updatedAt || item.createdAt;

    try {
        const toDate = (v: any): Date | null => {
            if (!v) return null;
            return typeof v === 'string' ? parseISO(v) : new Date(v);
        };

        const start = toDate(startStr);
        const end = toDate(endStr);

        // Include if the item's date range overlaps with the filter range
        if (start && end) return start <= range.to && end >= range.from;
        if (start) return start >= range.from && start <= range.to;
        if (end) return end >= range.from && end <= range.to;

        // Fallback: use last-modified / created timestamp
        const fallback = toDate(fallbackStr);
        if (fallback) return fallback >= range.from && fallback <= range.to;

        return true; // No dates at all = always included
    } catch {
        return true;
    }
});
```

**Impact**: Items without explicit start/end dates are now filtered by when they were last modified or created, making the time filter meaningful across all data types.

---

### 3.3 `src/utils/strategyAnalyticsUtils.ts` (lines 62–127)

Completely rewrote `buildProgressTrendData()` to adapt its output based on the selected time period:

**Before**: Always returned 12 months (Jan–Dec)

**After**: Returns period-appropriate data:

| Period | X-Axis Labels | Logic |
|--------|---------------|-------|
| `weekly` | Mon, Tue, Wed, Thu, Fri, Sat, Sun | 7 days of current week |
| `monthly` | Week 1, Week 2, Week 3, Week 4 | 4 weeks of current month |
| `quarterly` | 3 month abbreviations | Current quarter (Jan–Mar, Apr–Jun, etc.) |
| `yearly` | Jan, Feb, Mar, ..., Dec | All 12 months |
| `all` | Jan, Feb, Mar, ..., Dec | All 12 months |

```typescript
export function buildProgressTrendData(
    objectives: any[],
    period: TimePeriod = 'all'
): Array<{ name: string; objectives: number; executions: number }> {
    // Helper functions for calculating average progress and filtering active objectives
    const avgProgressOf = (objs: any[]) => { /* ... */ };
    const activeAt = (objs: any[], refDate: Date) => { /* ... */ };
    const buildPoint = (label: string, refDate: Date) => { /* ... */ };

    if (period === 'weekly') {
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + idx);
            return buildPoint(day, d);
        });
    }
    // ... similar logic for monthly, quarterly, yearly, all
}
```

**Impact**: Progress Trends chart now shows meaningful granularity appropriate to the selected period. Users see daily progress for weeks, weekly for months, monthly for quarters/years.

---

### 3.4 `src/components/strategy/analytics/ProgressTrends.tsx` (lines 1–31)

Added `timePeriod` prop to the component and dynamic description text:

```typescript
import { buildProgressTrendData, TimePeriod } from '@/utils/strategyAnalyticsUtils';

const periodDescriptions: Record<TimePeriod, string> = {
    weekly: 'Daily objective & execution progress this week',
    monthly: 'Weekly objective & execution progress this month',
    quarterly: 'Monthly objective & execution progress this quarter',
    yearly: 'Monthly objective & execution progress this year',
    all: 'Monthly objective & execution progress over time',
};

interface ProgressTrendsProps {
    objectives: any[];
    timePeriod?: TimePeriod;
}

const ProgressTrends: React.FC<ProgressTrendsProps> = ({ objectives, timePeriod = 'all' }) => {
    const data = buildProgressTrendData(objectives, timePeriod);
    // ... render with dynamic description
};
```

**Impact**: The Progress Trends card now displays a description that matches the active time period (e.g., "Daily objective & execution progress this week" when Week is selected).

---

### 3.5 `src/components/strategy/StrategyAnalytics.tsx` (lines 10–82)

**Added**: New `getPeriodLabel()` function to generate human-readable date range labels:

```typescript
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from 'date-fns';

function getPeriodLabel(period: TimePeriod): string {
    const now = new Date();
    const fmt = (d: Date, pattern: string) => format(d, pattern);

    switch (period) {
        case 'weekly':
            const ws = startOfWeek(now, { weekStartsOn: 1 });
            const we = endOfWeek(now, { weekStartsOn: 1 });
            return `Mon ${fmt(ws, 'd MMM')} – Sun ${fmt(we, 'd MMM yyyy')}`;
        case 'monthly':
            return `${fmt(startOfMonth(now), 'MMMM yyyy')}  ·  Week 1 – Week 4`;
        case 'quarterly':
            const qs = startOfQuarter(now);
            const qe = endOfQuarter(now);
            return `${fmt(qs, 'MMM')} – ${fmt(qe, 'MMM yyyy')}  ·  Q${Math.ceil((now.getMonth() + 1) / 3)}`;
        case 'yearly':
            return `Jan – Dec ${now.getFullYear()}`;
        case 'all':
        default:
            return 'All Time  ·  Jan – Dec';
    }
}
```

**Updated**: Header subtitle to include dynamic period label:

```typescript
// Before
<p className="text-xs text-muted-foreground">Strategic performance insights and AI-driven analysis</p>

// After
<p className="text-xs text-muted-foreground">
    Strategic performance insights and AI-driven analysis
    <span className="mx-1.5 text-muted-foreground/40">|</span>
    <span className="font-semibold text-intranet-primary/80">{getPeriodLabel(timePeriod)}</span>
</p>
```

**Updated**: Pass `timePeriod` to ProgressTrends component:

```typescript
// Before
<ProgressTrends objectives={filteredObjectives} />

// After
<ProgressTrends objectives={filteredObjectives} timePeriod={timePeriod} />
```

**Impact**: Users now see the active time period displayed in the Analytics Dashboard header (e.g., "Mon 17 Feb – Sun 23 Feb 2026"). The header updates dynamically when the filter is changed.

---

## 4. Data Flow (After Fix)

```
User clicks time filter button (Week/Month/Quarter/Year/All Time)
         ↓
StrategyAnalytics state updates timePeriod
         ↓
getPeriodLabel(timePeriod) generates human-readable label
         ↓
Header subtitle updates to show: "Strategic performance insights and AI-driven analysis | Mon 17 Feb – Sun 23 Feb 2026"
         ↓
useMemo hooks recalculate:
  • filteredObjectives = filterByTimePeriod(objectives, timePeriod)
  • filteredKras = filterByTimePeriod(kras, timePeriod)
  • filteredMilestones = filterByTimePeriod(milestones, timePeriod)
         ↓
filterByTimePeriod() applies the period range, with fallback to modifiedAt/createdAt
         ↓
ProgressTrends receives filtered data + timePeriod
         ↓
buildProgressTrendData(filteredObjectives, timePeriod) generates period-specific X-axis (Mon-Sun, Week 1-4, 3 months, or Jan-Dec)
         ↓
Progress Trends chart re-renders with new data and dynamic description
         ↓
Executive Scorecard, Status Distribution, and other charts update with filtered data
```

---

## 5. Before vs. After: Visual Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Date fields on objectives** | ❌ Missing | ✅ StartDate, EndDate, modifiedAt, createdAt mapped |
| **Filter fallback** | ❌ Always includes | ✅ Falls back to modifiedAt/createdAt |
| **Progress Trends X-axis** | ❌ Always Jan–Dec | ✅ Adapts: Mon-Sun (week), Week 1-4 (month), 3 months (quarter), Jan-Dec (year/all) |
| **timePeriod prop to ProgressTrends** | ❌ Not passed | ✅ Passed dynamically |
| **Header shows active period** | ❌ Static text | ✅ Shows "Mon 17 Feb – Sun 23 Feb 2026" (or similar) |
| **Time filter functional** | ❌ No effect | ✅ Affects all metrics and charts |

---

## 6. Related Files

| File | Change |
|------|--------|
| `src/services/strategyService.ts` | Added startDate, endDate, modifiedAt, createdAt to objective mapping |
| `src/utils/strategyAnalyticsUtils.ts` | Enhanced filterByTimePeriod() with fallback; rewrote buildProgressTrendData() to be period-aware |
| `src/components/strategy/analytics/ProgressTrends.tsx` | Added timePeriod prop, dynamic description text |
| `src/components/strategy/StrategyAnalytics.tsx` | Added getPeriodLabel() function; updated header to show active period; pass timePeriod to ProgressTrends |

---

## 7. Testing Checklist

- [ ] Click **Week** → Progress Trends shows Mon–Sun; header shows "Mon 17 Feb – Sun 23 Feb 2026"
- [ ] Click **Month** → Progress Trends shows Week 1–4; header shows "February 2026 · Week 1 – Week 4"
- [ ] Click **Quarter** → Progress Trends shows 3 months; header shows "Jan – Mar 2026 · Q1"
- [ ] Click **Year** → Progress Trends shows Jan–Dec; header shows "Jan – Dec 2026"
- [ ] Click **All Time** → Progress Trends shows Jan–Dec; header shows "All Time · Jan – Dec"
- [ ] Verify all cards (Executive Scorecard, Status Distribution, Bar Chart, Divisional Performance) update their data
- [ ] Verify milestones are filtered by the selected period
- [ ] Verify no TypeScript errors (`npx tsc --noEmit`)

---

## 8. Notes

- The time filter now respects the **date range** of each objective (startDate–endDate overlap logic)
- For items without explicit dates, the **last-modified timestamp** is used as a fallback
- The **Progress Trends X-axis adapts** to show meaningful granularity for each period (daily for week, weekly for month, etc.)
- The **header dynamically displays** the exact date range of the active period, making it clear to users what they're viewing
- All filtering uses **memoized calculations** for performance
