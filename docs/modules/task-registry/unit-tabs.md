# Unit Tabs & Kanban Reference
> [!NOTE]
> **Last Updated:** 2026-03-29 11:49

**Location: `src/components/unit-tabs/`**

The `unit-tabs` directory is the core logic and interface layer for the Task Registry. It handles the rendering of the Task Kanban board, KRAs, Projects, and Overview tabs.

## 🧱 Component Breakdown

### [`TasksTab.tsx`](file:///src/components/unit-tabs/TasksTab.tsx)
The main entry point for the "Tasks & Daily Operations" tab.
- **State Management**: Handles the dragging/dropping of tasks between lanes.
- **Lane Control**: Implements "Move Left/Right", "Rename", and "Insert After" logic for task groups.
- **Glassmorphic UI**: Uses the `PremiumKanban` engine for standardized layout.

### [`TaskCard.tsx`](file:///src/components/unit-tabs/TaskCard.tsx)
The atomic unit of the Kanban board.
- **Design**: Minimalist, glassmorphic card with clear metadata visibility (Assignee, Priority, Status, Dates).
- **Interactions**: Double-click to edit, inline status/priority dropdowns, and drag-and-drop support via `dnd-kit`.
- **Styling**: Uses `font-medium` weights and strictly **neutral** (non-italic) descriptions for a cleaner, modern look.

### [`KRASTab.tsx`](file:///src/components/unit-tabs/KRASTab.tsx)
The performance management interface.
- **Initiatives (Objectives)**: Grouped KRAs under high-level strategic goals.
- **Progress Tracking**: Real-time sync of KRA progress based on linked KPIs and tasks.

## 🛠 Interaction Mechanics

### Group Reordering
Lanes (buckets) are reordered locally in the `activeBuckets` state using horizontal move actions.
- **Boundary Checks**: Disabling "Move Left" for the first column and "Move Right" for the last.
- **Insertion**: Dynamic insertion of new groups using `setInsertAfterGroupId`.

### Task Movements
- **Vertical Sort**: Standard `dnd-kit` vertical sorting for tasks within a lane.
- **Horizontal Move**: Tasks can be moved between lanes, updating the `RelatedTaskGroupLookupId` in SharePoint.

## 🖇 Data Synchronization
Task movements and group reorders are currently handled via:
1.  **Local State Update**: Immediate UI feedback (Optimistic UI).
2.  **SharePoint Sync**: Background POST/PATCH requests to the `Operations_Tasks` list.
