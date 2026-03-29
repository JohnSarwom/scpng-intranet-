# PremiumTable Component — Canonical Design Standard
*Last Updated: 2026-03-29 20:34 AEST*

The `PremiumTable` is the **single, mandatory global template** for all data tables in the SCPNG Intranet. Never implement a raw `<table>` or ad-hoc flex grid for tabular data. Using `PremiumTable` ensures consistency of borders, sticky columns, shadows, and dark-mode theming across the entire application.

---

## File Location
`src/components/ui/PremiumTable.tsx`

---

## Component Suite

### `PremiumTable` — Root Container
Wraps the `<table>` in a scroll container. Applies the following automatically:
- `border-separate border-spacing-0` — **critical**: prevents sticky column borders from collapsing and disappearing during horizontal scroll.
- `overflow-auto` with `kanban-scrollbar` styling.
- **Responsive viewport height**: `max-h-[calc(100vh-200px)]` — constrains the table to fill the viewport with scrolling. Individual consumers can override via `containerClassName`.
- Rounded corners (`rounded-xl`), glassmorphic `bg-white/50 dark:bg-black/20` + `backdrop-blur-sm`.
- Outer border: `border dark:border-white/5`.

**Props:**
| Prop | Type | Description |
|---|---|---|
| `containerClassName` | `string` | Applied to the scroll wrapper `<div>`. Overrides default height (e.g., `max-h-[600px]` for sub-tables). |
| `className` | `string` | Applied to the inner `<table>` element. |

**Default Container Classes (built-in):**
```
overflow-auto max-h-[calc(100vh-200px)] border dark:border-white/5 rounded-xl text-sm relative kanban-scrollbar bg-white/50 dark:bg-black/20 backdrop-blur-sm
```

**Usage:**
```tsx
// Uses global defaults — viewport-responsive height, scrollbar, glassmorphism
<PremiumTable>
  ...
</PremiumTable>

// Override height for a sub-table
<PremiumTable containerClassName="max-h-[600px]">
  ...
</PremiumTable>
```

---

### `PremiumTableHeader` — Sticky Header Section
The `<thead>` wrapper. Applies:
- `sticky top-0 z-50` — keeps the header pinned during vertical scroll.
- Background: `bg-gray-50/95 dark:bg-black/40` + `backdrop-blur-md`.
- **Separator line**: `border-b dark:border-white/10` (subtle, 1px). This line is drawn on the individual `<th>` cells, NOT at the `<thead>` level, to ensure it renders correctly under `border-separate`.

---

### `PremiumTableHead` — Header Cell
Individual `<th>` element. Applies the following by default:
- Padding: `px-6 first:pl-8 last:pr-8`.
- Height: `h-12`.
- **Bottom line**: `border-b border-gray-200 dark:border-white/10` — ensures all headers get the separator line.
- **Vertical dividers**: `border-r border-gray-200/50 dark:border-white/[0.03] last:border-r-0` — ultra-subtle column separators for non-sticky columns only.
- Hover: `hover:bg-gray-100/80 dark:hover:bg-white/5`.

**`sticky` Prop:**

| Value | Behaviour |
|---|---|
| `"left"` | Pins to the left. Applies own `bg-gray-50/95 dark:bg-gray-950/95`, `border-r dark:border-white/10`, and `shadow-[4px_0px...]`. |
| `"right"` | Pins to the right. Applies own `bg-gray-50/95 dark:bg-gray-950/95`, `border-l dark:border-white/10`, and `shadow-[-4px_0px...]`. |

> [!IMPORTANT]
> When using **multiple left-sticky columns**, you MUST pass an explicit `left-[px]` offset via `className` (e.g., `className="left-[150px]"`). The component will use `left-0` as a fallback only if no `left-` class is detected.

> [!IMPORTANT]
> **Horizontal scroll requirement:** Always use `min-w-[...]` (e.g., `min-w-[180px]`) on header columns instead of percentage widths (`w-[20%]`). Percentage widths compress columns instead of triggering horizontal scroll on narrow viewports.

**Usage:**
```tsx
// Single sticky column
<PremiumTableHead sticky="left" className="w-[200px] min-w-[200px]">Name</PremiumTableHead>

// Multiple sticky columns (must provide explicit left offsets)
<PremiumTableHead sticky="left" className="w-[150px] min-w-[150px]">Col 1</PremiumTableHead>
<PremiumTableHead sticky="left" className="w-[180px] min-w-[180px] left-[150px]">Col 2</PremiumTableHead>

// Non-sticky scrollable columns — use min-w, NOT percentage w-[%]
<PremiumTableHead className="min-w-[180px]">Description</PremiumTableHead>
<PremiumTableHead className="min-w-[120px]">Status</PremiumTableHead>
```

---

### `PremiumTableBody` — Body Section
Standard `<tbody>` wrapper. No special overrides required.

---

### `PremiumTableRow` — Table Row
Applies standardized row styling:
- `border-b border-gray-200 dark:border-white/10` — horizontal row divider.
- Hover: `hover:bg-intranet-primary/[0.04] dark:hover:bg-white/5`.
- Transition: `transition-all duration-300`.

> [!WARNING]
> Never add `border-none` to a `PremiumTableRow` inside a `PremiumTableHeader`. Doing so suppresses the header separator line. The row inside `PremiumTableHeader` should use only `hover:bg-transparent` to disable the hover effect.

**Correct pattern for header row:**
```tsx
<PremiumTableHeader>
  <PremiumTableRow className="hover:bg-transparent">
    <PremiumTableHead>...</PremiumTableHead>
  </PremiumTableRow>
</PremiumTableHeader>
```

---

### `PremiumTableCell` — Data Cell
Individual `<td>` element. Applies by default:
- Padding: `px-6 py-4 first:pl-8 last:pr-8`.
- `border-b border-gray-200 dark:border-white/10` — row divider.

**Props:**

| Prop | Type | Description |
|---|---|---|
| `sticky` | `"left" \| "right"` | Pins the cell. Applies `bg-white/95 dark:bg-gray-900/95`, matching border, and a box-shadow. The `group-hover` background updates automatically. |
| `glass` | `boolean` | Applies `backdrop-blur-sm bg-white/5` for a glassmorphic cell effect. |

---

## Card Container Standard

When wrapping a `PremiumTable` in a `<Card>`, use the following reduced shadow to avoid visual clutter and let the table stand out:

```tsx
<Card className="dark:bg-gray-900/70 dark:backdrop-blur-xl dark:border-white/10 shadow-md border-none">
```

> [!CAUTION]
> Do **not** use `shadow-2xl` on the table container card. Reserve `shadow-2xl` for elevated floating surfaces such as Dialogs, Modals, and Drawers.

---

## Non-PremiumTable Views (Timeline)

The `KRATimelineTab` uses a custom flex layout (Gantt chart), not `PremiumTable`. However, its styling MUST mirror PremiumTable conventions:

| Element | Required Styling |
|---|---|
| Scroll container | `bg-white/50 dark:bg-black/20 backdrop-blur-sm`, `kanban-scrollbar`, `max-h-[calc(100vh-200px)]`, `rounded-xl` |
| Header bar | `bg-gray-50/95 dark:bg-black/40 backdrop-blur-md`, `h-12` |
| Header text | `font-semibold dark:text-gray-300` |
| Sticky columns | `bg-white/95 dark:bg-gray-900/95 backdrop-blur-md`, `shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]` |
| Row hover | `hover:bg-intranet-primary/[0.04] dark:hover:bg-white/5` |
| Transitions | `transition-all duration-300 ease-out` |

---

## Complete Usage Example (ProjectsTab Pattern)

```tsx
<Card className="dark:bg-gray-900/70 dark:backdrop-blur-xl dark:border-white/10 shadow-md border-none">
  <CardHeader>...</CardHeader>
  <CardContent>
    <PremiumTable>
      <PremiumTableHeader>
        <PremiumTableRow className="hover:bg-transparent">
          <PremiumTableHead sticky="left" className="w-[200px] min-w-[200px]">Name</PremiumTableHead>
          <PremiumTableHead className="min-w-[120px]">Status</PremiumTableHead>
          <PremiumTableHead sticky="right" className="text-right min-w-[100px]">Actions</PremiumTableHead>
        </PremiumTableRow>
      </PremiumTableHeader>
      <PremiumTableBody>
        <PremiumTableRow>
          <PremiumTableCell sticky="left">Row content</PremiumTableCell>
          <PremiumTableCell>...</PremiumTableCell>
          <PremiumTableCell sticky="right" className="text-right">
            {/* Action buttons */}
          </PremiumTableCell>
        </PremiumTableRow>
      </PremiumTableBody>
    </PremiumTable>
  </CardContent>
</Card>
```
