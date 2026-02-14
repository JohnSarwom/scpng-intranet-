# Kanban Board Scrolling Implementation

## Overview
This document details the layout strategy used for the Kanban board in the "Tasks/Operations" tab. The goal was to provide a **unified scrolling experience** where the entire board scrolls vertically and horizontally within a constrained container, avoiding page-level scrolling.

## Layout Architecture

### 1. Main Container (`TasksTab.tsx`)
The `TasksTab` component uses a specific height calculation to ensure it fits exactly within the user's viewport, subtracting the height of the header, navigation, and tabs.

- **Height Calculation**: `h-[calc(100vh-450px)]`
  - `100vh`: Full viewport height.
  - `-450px`: Approximate height of the top navigation, page title, tabs list, and internal "Tasks/Operations" header.
- **Scrolling**: `overflow-x-auto overflow-y-auto`
  - **Horizontal**: Enabled to show all columns.
  - **Vertical**: Enabled to scroll the entire set of columns down if they contain many tasks.
- **Flexbox**: `flex-1 min-h-0` is used to ensure the container takes up remaining space gracefully.

### 2. Tasks Tab Wrapper (`Unit.tsx`)
The `TabsContent` wrapper in `Unit.tsx` is configured to define the available space for the `TasksTab`.

- **Height**: `h-[calc(100vh-200px)]` gives the tab content area enough nominal height to contain the inner board.
- **Layout**: `flex flex-col gap-4` replaces default stack spacing to ensure tight packing of elements.

### 3. Column Lanes (`BoardLane` in `TasksTab.tsx`)
Individual columns (`BoardLane`) are designed to **expand freely**.

- **No Internal Scroll**: `overflow-y` is removed from the lane itself. This allows the lane to grow as tall as its content (tasks).
- **Behavior**: Because lanes grow infinitely, the **Main Container** handles the scrolling, resulting in a single vertical scrollbar on the right edge of the board, rather than multiple scrollbars inside each column.

## CSS Classes
- `kanban-scrollbar`: Custom class in `index.css` that styles the scrollbars to be sleek and semi-transparent (slate/gray theme).

## Future Considerations
If the header height changes significantly (e.g., adding a new banner), the `calc` values in `TasksTab.tsx` and `Unit.tsx` may need adjustment to prevent the bottom scrollbar from being pushed off-screen.

## Group Management & UX

### 1. Insert Group After
To improve workflow efficiency, users can insert new groups at specific positions rather than always appending to the end.

-   **Mechanism**: A dropdown menu on the column header allows "Insert Group After".
-   **Logic**:
    -   The system identifies the `index` of the triggering column.
    -   The new group is `spliced` into the local `activeBuckets` state at `index + 1`.
    -   The `order` field is calculated (`targetGroup.order + 1`) and sent to the backend to persist the position.
-   **Optimistic Update**: visual feedback is immediate.

### 2. Layout Stability & Crash Prevention
-   **Loader2 Dependency**: The "Save" button in the creation form uses `Loader2` from `lucide-react`. Ensure this is always imported in `TasksTab.tsx` to prevent runtime crashes during the creation flow.
-   **Auto-Scroll**: When a new group is added, `scrollIntoView` is triggered to smoothly scroll the horizontal container to the new column.
