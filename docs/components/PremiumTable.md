# PremiumTable Component
*Last Updated: 2026-03-28 18:57*

The `PremiumTable` is a specialized wrapper around the standard HTML table elements, enhanced for the SCPNG Intranet's high-end, glassmorphic aesthetic.

## File Location
`src/components/ui/PremiumTable.tsx`

## Components in the Suite

### `PremiumTable`
The main container. Automatically applies:
- `backdrop-blur-sm`
- Rounded corners (`rounded-xl`)
- Smooth scrollbars (`kanban-scrollbar`)
- `bg-white/50` (Light) or `bg-black/20` (Dark)
- **Ample Edge Padding**: Internal cells and headers now feature `px-6` with `first:pl-8` and `last:pr-8` to prevent content from sticking to the container edges.

### `PremiumTableHeader`
Standardized header with `sticky top-0` positioning and distinct `bg-gray-50/95` / `bg-black/40` coloring.

### `PremiumTableHead`
Header cell with built-in hover effects and support for `sticky="left"` or `sticky="right"` props.

### `PremiumTableRow`
Table row with standardized `border-b` visibility (`border-gray-200` / `border-white/10`) and `hover:bg-intranet-primary/[0.04]` interactions.

### `PremiumTableCell`
Data cell with support for `sticky` props and optional `glass` styling.

## Best Practices
1. **Sticky Offsets**: When using multiple sticky columns, pass custom `left-[px]` classes via `className` alongside the `sticky="left"` prop.
2. **Container Height**: Use `containerClassName="h-[calc(100vh-offset)]"` on the root `PremiumTable` to enable vertical scrolling while keeping the header fixed.
3. **Consistency**: Always use all members of the suite together to ensure proper `border-collapse` and alignment.
