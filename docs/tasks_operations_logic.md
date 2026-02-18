# Tasks/Operations Logic Documentation

This document outlines the core logic implemented for the Tasks/Operations module (`TasksTab.tsx`, `TaskCard.tsx`, `TaskDialog.tsx`) to ensure reliable UI updates, data persistence, and smooth user interactions.

## 1. Optimistic UI Updates (`TasksTab.tsx`)

To provide instant feedback to the user, we implement optimistic updates for Priority and Status changes. This means the UI updates immediately upon user interaction, without waiting for the server response.

### Implementation Details:
- **`optimisticUpdates` Ref**: A `useRef` map stores pending updates (`Map<taskId, updatedTask>`).
- **`setBoardData` Update**: When `handlePriorityChange` or `handleStatusChange` is called:
  1. The optimistic value is stored in the ref.
  2. `setBoardData` is called to force an immediate re-render of the local state with the new value.
  3. The `editTask` function is called to persist the change to the backend (SharePoint via `useSharePointOps`).
- **Reconciliation (useEffect)**:
  - The main `useEffect` hook that syncs props (`tasks`) to state `boardData` includes logic to respect these optimistic updates.
  - Unlike a simple overwrite, it checks if the server data matches the optimistic data.
  - **In-Place Updates**: If the task remains in the same column (e.g., changing priority), the logic verifies if the server's `priority` matches the optimistic `priority`. If not, it re-applies the optimistic value to prevent the UI from "snapping back" to the old value during the server latency period.

## 2. Event Handling & Drag-and-Drop (`TaskCard.tsx`)

The `TaskCard` component is draggable (using `dnd-kit`). This introduces a conflict where clicking interactive elements inside the card (like dropdowns) can be interpreted as a drag initiation.

### Logic Fix:
- **Stop Propagation**: We explicitly stop the propagation of `pointerdown` events on interactive elements to prevent `dnd-kit` from capturing them.
- **Code Pattern**:
  ```tsx
  <div 
    className="..."
    onPointerDown={(e) => e.stopPropagation()} // Prevents drag start
    onClick={(e) => e.stopPropagation()}      // Keeps click local
  >
    {/* Dropdown Content */}
  </div>
  ```
- **Affected Elements**:
  - Status Dropdown
  - Priority Dropdown
  - Assignee Dropdown
  - Action Buttons (Edit, Delete, Complete)

## 3. Data Persistence (`useSharePointOps.ts`)

- **`editTask`**: This function is passed down from `Unit.tsx`.
- **`updateTask`**: The underlying service call updates the SharePoint list item.
- **Refetch**: After a successful update, `React Query` refetches the data to ensure the application state eventually becomes consistent with the server.

## 4. Task Modal Logic (`TaskDialog.tsx`)

### Status Initialization
The `TaskDialog` initializes its status based on the `initialData` or `defaultStatus` prop.
- **Normalization**: It normalizes status strings (e.g., "To Do" -> "todo") to match the internal IDs used by the `Select` component.
- **Default Statuses**: The dialog uses a predefined list of statuses.
  - **Critical**: Ensure `DEFAULT_STATUSES` includes all valid statuses used in the app (e.g., 'todo', 'review', 'done'). Missing statuses will cause the dropdown to appear empty for tasks with those values.

## 5. Board Data Structure

- **`BoardData`**: An object where keys are column IDs (e.g., 'todo', 'in-progress', or custom Group IDs) and values are arrays of `Task` objects.
- **Grouping Logic**:
  - **Project-Based**: Tasks with a `projectId` are grouped into their respective project columns.
  - **Shared Projects Logic (Custom Groups)**:
    - **Creators & Admins**: See the original custom group (e.g., "Project Alpha").
    - **Assignees**: If an assignee is NOT the creator, they do *not* see the custom group folder. Instead, the task falls back to the **"Shared Projects"** virtual bucket.
    - **Data Integrity**: The underlying `projectId` remains unchanged; this is purely a visual grouping rule for the Board View.
  - **Status-Based**: Tasks without a project (or in Status view) fall back to status-based columns.
  - **Virtual Buckets**: 'Uncategorized' or 'Shared' buckets catch tasks that don't match active columns.

## 6. Task Group Auto-Selection

### Feature Overview
When a user clicks the "+" (Add Task) button on a specific task group column (e.g., "IT", "Finance"), the "Create New Task" modal automatically pre-selects that group in the "Group/Column" dropdown.

### Implementation Details:
1.  **State Management (`Unit.tsx`)**:
    -   A new state `defaultGroupId` is introduced to track the group ID where the "+" button was clicked.
    -   This state is passed down to `TasksTab` (setter) and `TaskDialog` (value).

2.  **Event Handling (`TasksTab.tsx`)**:
    -   The `handleCreateTask` function now accepts an optional `groupId`.
    -   When `BoardLane` renders the header, it passes the current column's ID to `handleCreateTask`.
    -   If a `groupId` is provided, `TasksTab` calls `setPreselectedGroup` (from props) to update the `defaultGroupId` state in `Unit.tsx`.

3.  **Modal Initialization (`TaskDialog.tsx`)**:
    -   The `TaskDialog` component receives `defaultGroup` as a prop.
    -   On initialization (or when the modal opens), it checks for `defaultGroup`.
    -   If `initialData` (editing mode) is present, it prioritizes the task's existing project.
    -   If creating a new task, it sets the form's `group` field to `defaultGroup`.
    -   If `defaultGroup` is null, it falls back to the default bucket (usually "To Do") or matches the default status.

## 7. Full-Screen Mode Feature Parity

### Overview
The Tasks/Operations tab supports a full-screen mode that provides an immersive, distraction-free workspace. As of the latest update, full-screen mode now has complete feature parity with normal view, ensuring users have access to all core task management controls regardless of display mode.

### Full-Screen Controls
When in full-screen mode, the header includes the following controls:

1. **Search Input**
   - Allows real-time filtering of tasks by title, description, or assignee
   - Implemented with local state management within `TasksTab.tsx`
   - Filters are applied during the `useEffect` that processes tasks into `boardData`
   - Search query is added to the dependency array to trigger re-filtering

2. **View Mode Toggles**
   - **Board View**: Displays tasks in a Kanban-style board layout
   - **List View**: Displays tasks in a table/list format
   - Active view is highlighted with a `secondary` variant
   - Clicking a toggle calls `setViewMode` (passed as prop from `Unit.tsx`)

3. **Add Task Button**
   - Opens the task creation dialog without exiting full-screen mode
   - Calls `handleCreateTask()` with no group pre-selection
   - Maintains consistent styling with normal view (small size, with icon)

4. **Full-Screen Toggle**
   - Switches between full-screen and normal view
   - Icon changes between `Maximize2` and `Minimize2` based on state

5. **Create from Template**
   - Opens the group template dialog for batch task creation
   - Available in both normal and full-screen modes

### Implementation Details

#### Search Filtering Logic
```tsx
// In TasksTab.tsx useEffect
let tasksToProcess = tasks;
if (searchQuery.trim()) {
  const query = searchQuery.toLowerCase();
  tasksToProcess = tasks.filter(t => 
    t.title?.toLowerCase().includes(query) || 
    t.description?.toLowerCase().includes(query) ||
    t.assignee?.toLowerCase().includes(query) ||
    t.assignees?.some(a => a.name?.toLowerCase().includes(query) || a.email?.toLowerCase().includes(query))
  );
}
```

#### Props Threading
- `setViewMode` is passed from `Unit.tsx` to `TasksTab.tsx` to enable view switching from within the component
- This allows full-screen mode to control the view mode without requiring parent component interaction

#### UI Layout
The full-screen header uses conditional rendering to show controls only when `isFullScreen` is true:
```tsx
{isFullScreen && (
  <>
    <Input placeholder="Search tasks..." ... />
    <div className="flex items-center gap-1 border-r pr-2 mr-2">
      <Button variant={viewMode === 'board' ? 'secondary' : 'ghost'} ... />
      <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} ... />
    </div>
    <Button size="sm" onClick={() => handleCreateTask()}>
      <Plus className="mr-2 h-3.5 w-3.5" />
      Task
    </Button>
  </>
)}
```

### User Experience Benefits
- **Consistency**: Users don't lose functionality when entering full-screen mode
- **Efficiency**: All core actions (search, view switching, task creation) remain accessible
- **Focus**: Full-screen mode provides maximum workspace while maintaining control access
- **Discoverability**: Controls are positioned in the same location as normal view, reducing cognitive load

