# Division Units Tab — 3-View Mode & Officer Performance Modal
**Date:** March 06, 2026
**Builds on:** [DIVISION_MODULE_IMPLEMENTATION.md](DIVISION_MODULE_IMPLEMENTATION.md)

---

## Overview

Extended the Division page's **Units tab** with three distinct view modes that give directors and managers multiple ways to understand their division's people and performance. Simultaneously enhanced the `OfficerProfileModal` with a rich **Overview / Performance tab** that shows each officer's contribution stats in one glance.

---

## Part 1 — Units Tab: 3 View Modes

### File Modified
`src/components/division/tabs/DivisionUnitsTab.tsx`

### View Toggle
Three icon buttons sit inline with the search bar:

| Icon | Mode key | Shows |
|------|----------|-------|
| `Building2` | `units` | Unit performance cards (original view) |
| `Users` | `officers` | Officer profile cards (photo + stats) |
| `List` | `table` | Full officer stats table |

Switching views resets the search query. The count label updates accordingly ("3 units" vs "10 officers").

---

### View 1 — Unit Cards (unchanged)
The original `UnitPerformanceCard` grid. Each card shows unit name, staff count, Task Completion bar, KRA Progress bar, and an overall score. Clicking opens the existing unit drill-down dialog (staff roster + stats + "Open Unit Page" button).

---

### View 2 — Officer Profile Cards

Design mirrors the **Contacts** page card style:
- Maroon gradient banner header
- Floating circular avatar (`-mt-8`) with photo from `useEmployeePhotos`, falls back to initials on `bg-[#800020]`
- RAG status dot in banner top-right corner (green/amber/red based on overall score)
- Name, job title, unit `Badge`
- **Mini stats strip** (3 columns): `completed/total` Tasks · KRAs count · `on-track/total` KPIs
- Overall score progress bar with RAG-coloured percentage label
- Top border is `border-t-4` coloured by RAG status

Clicking any card opens `OfficerProfileModal` with full profile data + performance stats.

**Photo loading:** `useEmployeePhotos.getPhotosForEmails()` is called via `useEffect` when viewMode switches to `'officers'` or `'table'`, batch-fetching all division staff emails at once.

---

### View 3 — Officers Table

A full-width `<Table>` wrapped in a `<Card>` with columns:

| Column | Notes |
|--------|-------|
| Officer | Avatar + Name + Title |
| Unit | Badge |
| Tasks | `done / total` |
| Task % | Inline progress bar + number |
| KRAs | Count |
| KRA Prog. | Inline progress bar + number |
| KPIs | `on-track / total` |
| Objectives | Count |
| Score | Bold % with RAG colour |

Every row is `cursor-pointer hover:bg-muted/50` — clicking opens `OfficerProfileModal`.

---

### Per-Officer Stats Computation

`computeOfficerStats(email, data): OfficerPerformanceStats` (module-level function, runs outside React render):

```ts
// Task matching — checks all assignment fields
tasks where assignee | assignedTo | createdByEmail | assignees[].email === email

// Status breakdown
completedTasks  → status === 'completed' | 'done'
inProgressTasks → status === 'in-progress'
inReviewTasks   → status === 'in-review'
onHoldTasks     → status === 'on-hold'
todoTasks       → status === 'todo'

// KRA matching
combinedKras where owner.email | ownerId === email
kraProgress = avg(kra.progress)

// KPI matching
kpis where owner.email | ownerId === email
onTrackKPIs = count where status === 'on-track' | 'completed'

// Objectives
objectives where owner.email | responsible === email

// Weighted score
overallScore = taskCompletion × 0.5 + kraProgress × 0.3 + kpiPct × 0.2
```

Stats are pre-computed into a `Map<email, OfficerPerformanceStats>` via `useMemo` so card/row renders are pure lookups.

---

### State Flow

```
handleOfficerClick(staffMember)
  └── finds matched OfficerProfile from useOfficerProfiles (by email)
  └── gets photos from photoUrls Map
  └── setSelectedOfficer(profile)       ← OfficerProfile (for modal left panel + About/Contact tabs)
  └── setSelectedOfficerStats(stats)    ← OfficerPerformanceStats (for Overview tab)

onClose
  └── setSelectedOfficer(null)
  └── setSelectedOfficerStats(null)
```

The `OfficerProfileModal` receives both as separate props:
```tsx
<OfficerProfileModal
  officer={selectedOfficer}
  open={!!selectedOfficer}
  onClose={...}
  performance={selectedOfficerStats ?? undefined}
/>
```

---

## Part 2 — OfficerProfileModal: Overview / Performance Tab

### File Modified
`src/components/strategy/OfficerProfileModal.tsx`

### Exported Type

```ts
export interface OfficerPerformanceStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  inReviewTasks: number;   // ← status === 'in-review'
  onHoldTasks: number;     // ← status === 'on-hold'
  todoTasks: number;       // ← status === 'todo'
  taskCompletion: number;  // percentage (0-100)
  totalKRAs: number;
  kraProgress: number;     // avg % (0-100)
  totalKPIs: number;
  onTrackKPIs: number;
  totalObjectives: number;
  overallScore: number;    // weighted (0-100)
}
```

This is the **single source of truth** — `DivisionUnitsTab` imports and uses this type directly (`type OfficerStats = OfficerPerformanceStats`).

---

### Scrollable Tab Nav

Changed `TabsList` from `flex-wrap` (tabs would wrap to second line when there are 6) to:
```
flex-nowrap overflow-x-auto [&::-webkit-scrollbar]:hidden
```
Each trigger has `whitespace-nowrap flex-shrink-0` so tabs stay on one line and the nav scrolls horizontally on narrow widths.

---

### Tab Order

The **Overview** tab is only injected when `performance` prop is provided, and is always first:

```ts
const tabs = [
  ...(performance ? [{ value: 'overview', label: 'Overview', icon: TrendingUp }] : []),
  { value: 'about',          label: 'About',          icon: User      },
  { value: 'contact',        label: 'Contact',         icon: AtSign    },
  { value: 'experience',     label: 'Experience',      icon: Briefcase },
  { value: 'activity',       label: 'Activity',        icon: Activity  },
  { value: 'statutory-duty', label: 'Statutory Duty',  icon: FileText  },
];
```

Active tab resets to `'overview'` (if performance) or `'about'` (if not) every time the modal opens:
```ts
useEffect(() => {
  if (open) setActiveTab(performance ? 'overview' : 'about');
}, [open, performance]);
```

This means the OrgChart usage (no performance data) is **completely unaffected** — it still opens to "About".

---

### Overview Tab Layout

#### 1. Hero Banner
Dark maroon gradient (`from-[#500015] via-[#700020] to-[#900030]`) with decorative circles. Shows:
- Large `XX%` overall score (left)
- RAG status badge — `On Track` / `At Risk` / `Off Track` (top-right)
- Mini breakdown: "Tasks X% · KRAs X% · KPIs X%" (right column)
- Full-width RAG-coloured progress bar at bottom

#### 2. Three Metric Cards (Tasks | KRAs | KPIs)
Each card: icon + label, primary number, per-metric progress bar, secondary stat.

| Card | Primary | Bar | Secondary |
|------|---------|-----|-----------|
| Tasks | `completed / total` | Emerald — completion % | "X in progress" (amber, if >0) |
| KRAs | count `areas` | Purple — avg progress % | "X% avg progress" |
| KPIs | `on-track / total` | Emerald/Amber/Red — RAG | "X% on track" |

#### 3. Task Breakdown (stacked bar + legend)
Only shown when `totalTasks > 0`. All 5 task statuses rendered as distinct colour segments:

| Status | Colour | Tailwind |
|--------|--------|---------|
| Completed | Emerald green | `bg-emerald-500` |
| In Review | Violet | `bg-violet-400` |
| In Progress | Blue | `bg-blue-500` |
| On Hold | Orange | `bg-orange-400` |
| To Do | Light grey | `bg-gray-200` |

Legend is a 2-column grid showing all 5 always. Zero-count entries are `opacity-40` (dimmed but visible) so the layout is stable regardless of which statuses are present.

#### 4. Strategic Contribution
3-up grid: KRAs · KPIs Assigned · Objectives Linked
Plus a summary list: Tasks in progress / Tasks completed / KPIs on track.

---

### Backward Compatibility

| Caller | Performance prop | Behaviour |
|--------|-----------------|-----------|
| `DivisionUnitsTab` — officer cards | ✅ passed | Opens to Overview tab |
| `DivisionUnitsTab` — table rows | ✅ passed | Opens to Overview tab |
| `OrgChart.tsx` (Strategy page) | ❌ not passed | Opens to About tab (unchanged) |
| Any future caller without stats | ❌ not passed | Opens to About tab (unchanged) |

---

## RAG Colour Reference (consistent across all views)

| Score | Status | Border/Dot | Text |
|-------|--------|------------|------|
| ≥ 70 | On Track | Green | `text-green-600` |
| 40–69 | At Risk | Amber | `text-amber-600` |
| < 40 | Off Track | Red | `text-red-600` |

Thresholds match the existing Unit page and Division Overview conventions.

---

## Key Files

| File | Change |
|------|--------|
| `src/components/division/tabs/DivisionUnitsTab.tsx` | 3 view modes, officer cards, table, `computeOfficerStats`, photo batch-loading |
| `src/components/strategy/OfficerProfileModal.tsx` | Exported `OfficerPerformanceStats`, scrollable nav, Overview tab |
