# Global Scrollbar Implementation

**Date:** 2026-04-30

## Summary

Fixed missing/broken scrollbars on Radix UI Select dropdowns (KPI, Group/Column, Repeat, etc.) and applied a consistent thin scrollbar style globally across the entire application.

---

## Problems Fixed

### 1. KPI Dropdown — No Scrollbar, No Mouse-Wheel Scroll
- `SelectContent` in `TaskDialog.tsx` had no `max-h` or overflow constraints.
- Radix Select's internal `Viewport` uses chevron scroll buttons instead of native scroll.
- Mouse-wheel events were intercepted by Radix, preventing native scroll.

### 2. Group/Column Dropdown — Same Issue
- Same Radix `SelectContent` pattern without overflow constraints.

### 3. All Select Dropdowns — Chevron Arrows Instead of Scrollbar
- Shadcn's `select.tsx` renders `SelectScrollUpButton` and `SelectScrollDownButton` (chevron arrows) inside every `SelectContent`.
- These do not look like the Assignees popover's native scrollbar.

---

## Changes Made

### `src/components/ui/select.tsx`
- Removed `<SelectScrollUpButton />` and `<SelectScrollDownButton />` from inside `SelectContent`.
- Removed `max-h-96 overflow-hidden` from `SelectPrimitive.Content` class string.
- Added inline `style={{ maxHeight: "240px", overflowY: "auto" }}` directly on `SelectPrimitive.Viewport` — inline styles override any Radix-injected CSS.
- Added `onWheel={(e) => e.stopPropagation()}` on the Viewport so mouse-wheel events are not swallowed by Radix's internal handlers.

### `src/components/unit-tabs/TaskDialog.tsx`
- Removed the manually added `max-h-60 overflow-y-auto` classes from the KPI and Group/Column `SelectContent` instances (now handled globally in `select.tsx`).

### `src/index.css`
- Added a global `*` scrollbar rule covering all scrollable elements in the app.
- Also added explicit `[data-radix-select-viewport]` selectors with `!important` to ensure styles are not overridden by Radix's internal styles.
- Scrollbar style: 8px wide, `rgba(156, 163, 175, 0.6)` thumb with rounded corners and `background-clip: content-box` for padding effect.
- Dark mode handled with `rgba(75, 85, 99, 0.7)` thumb color.

---

## Architecture Notes

- **Assignees** uses `Popover` + `Command` (cmdk) — a completely different component from Radix Select. It has native scrollbar support out of the box via `CommandList` which uses `overflow-y: auto` internally.
- **All other dropdowns** (KPI, Group/Column, Status, Priority, Repeat) use Radix `Select` which required the custom fix above.
- The global `*::-webkit-scrollbar` rule applies to **every** scrollable container: modals, cards, tables, sidebars — not just dropdowns.
- Existing utility classes (`scrollbar-thin`, `kanban-scrollbar`, `sidebar-scrollable`, `horizontal-scrollbar-fade`) remain and take precedence where explicitly applied.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/ui/select.tsx` | Replaced chevron scroll buttons with native viewport scroll |
| `src/components/unit-tabs/TaskDialog.tsx` | Removed redundant per-instance overflow classes |
| `src/index.css` | Added global `*` + `[data-radix-select-viewport]` scrollbar rules |
