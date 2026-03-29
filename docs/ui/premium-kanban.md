# Premium Kanban Engine
> [!NOTE]
> **Last Updated:** 2026-03-29 11:55

**Location: `src/components/ui/PremiumKanban.tsx`**

The `PremiumKanban` engine provides the standardized visual identity and layout for all task-based boards within the SCPNG Intranet. It is built to achieve a "Dark Luxury / Glassmorphic" look with a focus on performant, responsive interactions.

## 🛠 Component Components

### `PremiumKanbanBoard`
The root horizontal scroll container.
- **Scrolling**: Implements `overflow-auto` for both axes.
- **Glassmorphism**: Provides the backdrop for all child lanes.

### `PremiumKanbanColumn`
The architectural "Lane" container.
- **Structure**: Rounded-2x boundaries, translucent background (`bg-white/70` in light mode, `bg-black/60` in dark mode).
- **Header**: Standardized uppercase titles (`font-medium`, 70% opacity) with optional action slots.
- **Counter**: Built-in badge for item counts.

### `PremiumKanbanCard`
The individual item container.
- **States**: Hover effects, shadow transitions, and "active" state indication.
- **Visuals**: Border-less focus, using subtle background colors from `BaseCard`.

## 🎨 Design Tokens

- **Accents**: Maroon (#83002A) used for primary interactions.
- **Weights**: Strictly **unbolded** sub-elements (lane titles, task titles), using `font-medium` for a cleaner visual hierarchy.
- **Opacities**: Extensive use of reduced opacity (20%-70%) to create layers of information.

## 🏃 Performance & Interaction

### Dnd Context
The engine is agnostic to the drag-and-drop implementation but is optimized for `dnd-kit`.
- **Vertical Sorting**: Standard column-level sortable contexts.
- **Horizontal Scrolling**: Optimized for touch and mouse-wheel scrolling.

## 📈 Future Extensions
The `PremiumKanban` engine is designed to be easily extensible for:
- **Projects Board**: Timeline-based task management.
- **Asset Lifecycle**: Tracking IT asset status from acquisition to disposal.
- **Workplans**: Unit-level objective tracking.
