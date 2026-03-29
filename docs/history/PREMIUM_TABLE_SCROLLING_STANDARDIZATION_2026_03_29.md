# PremiumTable Scrolling & Responsive Standardization
*Date: 2026-03-29 20:34 AEST (10:34 AM +10:00)*

## Summary
Standardized scrolling behavior, responsive height, and visual styling across all PremiumTable instances and the KRA Timeline view to ensure a consistent, viewport-responsive experience across the intranet.

---

## Changes Made

### 1. Global PremiumTable Default Height
**File:** `src/components/ui/PremiumTable.tsx`
**Change:** Added `max-h-[calc(100vh-200px)]` to the root container's default classes.

**Before:**
```
overflow-auto border dark:border-white/5 rounded-xl text-sm relative kanban-scrollbar bg-white/50 dark:bg-black/20 backdrop-blur-sm
```

**After:**
```
overflow-auto max-h-[calc(100vh-200px)] border dark:border-white/5 rounded-xl text-sm relative kanban-scrollbar bg-white/50 dark:bg-black/20 backdrop-blur-sm
```

**Impact:** All PremiumTable instances now automatically constrain to viewport height with scrolling. Individual consumers can override via `containerClassName`.

---

### 2. Initiatives Table — Inherit Global Defaults
**File:** `src/components/unit-tabs/KRAsTab.tsx` (line ~1260)
**Change:** Removed custom `containerClassName="max-h-[600px] border dark:border-white/10 rounded-xl overflow-hidden relative"` override.

**Before:**
```tsx
<PremiumTable containerClassName="max-h-[600px] border dark:border-white/10 rounded-xl overflow-hidden relative">
```

**After:**
```tsx
<PremiumTable>
```

**Impact:** Initiatives table now inherits the global `max-h-[calc(100vh-200px)]` and all PremiumTable defaults.

---

### 3. Initiatives Table — Horizontal Scroll Fix
**File:** `src/components/unit-tabs/KRAsTab.tsx` (lines ~1263-1270)
**Change:** Converted percentage-based column widths to fixed `min-w-[...]` constraints.

**Before:**
```tsx
<PremiumTableHead className="w-[20%]">Initiative Name</PremiumTableHead>
<PremiumTableHead className="w-[20%]">Strategic Goal</PremiumTableHead>
<PremiumTableHead className="w-[20%]">Key Deliverable</PremiumTableHead>
<PremiumTableHead className="w-[10%]">Goal Type</PremiumTableHead>
<PremiumTableHead>Description</PremiumTableHead>
<PremiumTableHead className="w-[10%]">Status</PremiumTableHead>
<PremiumTableHead className="w-[10%] text-center">Progress</PremiumTableHead>
<PremiumTableHead sticky="right" className="text-right w-[10%]">Actions</PremiumTableHead>
```

**After:**
```tsx
<PremiumTableHead className="min-w-[180px]">Initiative Name</PremiumTableHead>
<PremiumTableHead className="min-w-[180px]">Strategic Goal</PremiumTableHead>
<PremiumTableHead className="min-w-[180px]">Key Deliverable</PremiumTableHead>
<PremiumTableHead className="min-w-[120px]">Goal Type</PremiumTableHead>
<PremiumTableHead className="min-w-[200px]">Description</PremiumTableHead>
<PremiumTableHead className="min-w-[120px]">Status</PremiumTableHead>
<PremiumTableHead className="min-w-[120px] text-center">Progress</PremiumTableHead>
<PremiumTableHead sticky="right" className="text-right min-w-[100px]">Actions</PremiumTableHead>
```

**Impact:** Columns no longer compress on narrow viewports; horizontal scroll activates instead.

---

### 4. KRA Timeline — Responsive Height
**File:** `src/components/KRATimelineTab.tsx` (lines 204-205)
**Change:** Replaced hardcoded `max-h-[800px]` and `h-[700px]` with viewport-responsive `max-h-[calc(100vh-200px)]`.

**Before:**
```tsx
<CardContent className="flex-1 min-h-0 overflow-hidden p-0 max-h-[800px]">
  <div className="overflow-auto h-[700px] border dark:border-white/10 rounded-md kanban-scrollbar" ref={scrollContainerRef}>
```

**After:**
```tsx
<CardContent className="flex-1 min-h-0 overflow-hidden p-0">
  <div className="overflow-auto max-h-[calc(100vh-200px)] border dark:border-white/5 rounded-xl text-sm relative kanban-scrollbar bg-white/50 dark:bg-black/20 backdrop-blur-sm" ref={scrollContainerRef}>
```

---

### 5. KRA Timeline — Global Template Styling Alignment
**File:** `src/components/KRATimelineTab.tsx`
**Changes applied across multiple elements:**

| Element | Before | After |
|---|---|---|
| Header bar | `bg-background dark:bg-gray-950 shadow-sm` | `bg-gray-50/95 dark:bg-black/40 backdrop-blur-md` |
| Header cells | `px-4 py-2 font-medium text-muted-foreground` | `h-12 px-6 font-semibold dark:text-gray-300` |
| Sticky columns | `bg-background dark:bg-gray-950`, `shadow-[2px_0_5px]` | `bg-white/95 dark:bg-gray-900/95 backdrop-blur-md`, `shadow-[4px_0_24px_-12px]` |
| Row hover | `hover:bg-gray-50/50 dark:hover:bg-gray-800/30` | `hover:bg-intranet-primary/[0.04] dark:hover:bg-white/5` |
| Row transition | None | `transition-all duration-300 ease-out` |
| Sticky hover | None | `group-hover:bg-intranet-primary/[0.02] dark:group-hover:bg-white/5` |

---

### 6. KRA Timeline — Header Vertical Centering
**File:** `src/components/KRATimelineTab.tsx` (lines 210-234)
**Change:** Added `h-12 items-center` to the time period container (Q1-Q4, Jan-Dec, W1-W52) and updated font to `font-semibold dark:text-gray-300`.

**Impact:** All timeline column headers (Initiative, KRA Details, Q1-Q4, months, weeks) are now vertically centered at the same `h-12` height.

---

### 7. KRA Timeline — Terminology Update
**File:** `src/components/KRATimelineTab.tsx` (line 208)
**Change:** Renamed the first sticky column header from "Objective" to "Initiative" to align with the standardized project terminology.

---

## Files Modified
| File | Type of Change |
|---|---|
| `src/components/ui/PremiumTable.tsx` | Added default responsive height |
| `src/components/unit-tabs/KRAsTab.tsx` | Initiatives table: removed height override, fixed column widths |
| `src/components/KRATimelineTab.tsx` | Responsive height, global styling, header centering, terminology |
| `docs/components/PremiumTable.md` | Updated component documentation |

## Design Principle
> All data-driven views — whether `PremiumTable`-based or custom layouts like the Timeline Gantt chart — MUST mirror the PremiumTable's visual conventions: glassmorphism, `intranet-primary` hover effects, `backdrop-blur`, `kanban-scrollbar`, and viewport-responsive heights.
