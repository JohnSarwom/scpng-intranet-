# Handling Modals in Full-Screen Mode

## The Problem
When an element (like a dashboard, chart, or video player) enters full-screen mode using the Fullscreen API (e.g., `element.requestFullscreen()`), it is allocated a new top-layer stacking context by the browser. 

Traditional React modals (like those from Radix UI, Headless UI, or custom implementations) typically use `React.createPortal` to render the modal content into `document.body` or a specific root element.

However, elements in the top-layer stacking context (the full-screen element) will visually obscure *everything* else in the standard DOM hierarchy, including `document.body`. This means that even if your modal is technically rendered and open, it will be hidden behind the full-screen element.

To make a modal visible in full-screen mode, it must be rendered **inside** the full-screen element itself.

## The Solution
Most modern React component libraries (and `React.createPortal` itself) support rendering into a specific container node. The solution involves:

1.  Getting a reference to the element that will go full-screen.
2.  Tracking whether that element is currently in full-screen mode.
3.  Conditionally passing that element as the `container` for the modal when in full-screen mode.

## Implementation Guide

### 1. Hook for Full-Screen State
First, ensure you have a way to track full-screen state. A custom hook is recommended.

```typescript
// hooks/useFullscreenStatus.ts
import { useState, useEffect, RefObject } from 'react';

export function useFullscreenStatus(ref: RefObject<HTMLElement>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === ref.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [ref]);

  return isFullscreen;
}
```

### 2. Component Implementation
Here is a pattern for a component that supports full-screen mode and contains a modal.

```tsx
import React, { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog'; // Example using Radix UI
import { useFullscreenStatus } from '@/hooks/useFullscreenStatus';

export const DashboardWidget = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isFullscreen = useFullscreenStatus(containerRef);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div ref={containerRef} className="widget-container bg-white p-4">
      <div className="flex justify-between items-center mb-4">
        <h2>Widget Title</h2>
        <div className="space-x-2">
          <button onClick={toggleFullscreen}>
            {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          </button>
          <button onClick={() => setIsModalOpen(true)}>
            Open Settings
          </button>
        </div>
      </div>

      {/* 
        CRITICAL: The container prop determines where the modal portal is rendered.
        If isFullscreen is true, render INSIDE containerRef.current.
        Otherwise, render in document.body (default behavior).
      */}
      <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
        <Dialog.Portal container={isFullscreen ? containerRef.current : document.body}>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-xl">
            <Dialog.Title>Settings</Dialog.Title>
            <Dialog.Description>
              Adjust your widget settings here.
            </Dialog.Description>
            <div className="mt-4 flex justify-end">
              <Dialog.Close asChild>
                <button className="px-4 py-2 bg-gray-200 rounded">Close</button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="content">
        {/* Widget content goes here */}
        <p>This content is visible in both modes.</p>
      </div>
    </div>
  );
};
```

## Key Concept: The `container` Prop
-   **Radix UI**: `<Dialog.Portal container={element} ... />`
-   **Headless UI**: `<Portal element={element} ... />` (or equivalent)
-   **MUI**: `<Modal container={element} ... />`
-   **Raw React**: `createPortal(children, element)`

Always ensure your UI library supports changing the portal target. If it doesn't, you may need to defer rendering the modal until *after* the component has mounted to ensure the ref is populated.

---

## Full-Screen View Switching Issue

### The Problem
When implementing view switching (e.g., Board View ↔ List View) within a component that supports full-screen mode, a critical issue can occur: **switching views causes the browser to exit full-screen mode**.

This happens when:
1. The `ref` used for `requestFullscreen()` is attached to a view-specific container
2. Switching views unmounts that container
3. The browser automatically exits full-screen when the full-screen element is removed from the DOM

### Example of Problematic Code
```tsx
// ❌ BAD: containerRef is only on the Board View
{viewMode === 'board' ? (
  <div ref={containerRef} className="board-container">
    {/* Board View Content */}
  </div>
) : (
  <div className="list-container">
    {/* List View Content */}
  </div>
)}
```

When switching from Board to List, the `div` with `containerRef` is unmounted, forcing the browser to exit full-screen.

### The Solution
**Wrap all views in a common container** that holds the `containerRef`. This ensures the full-screen element persists across view changes.

```tsx
// ✅ GOOD: containerRef wraps all views
<div ref={containerRef} className={cn(
  "view-container",
  isFullScreen && "fullscreen-styles"
)}>
  {/* Common Header - Visible in all views */}
  <div className="header">
    <h2>Title</h2>
    {isFullScreen && (
      <div className="fullscreen-controls">
        {/* View Switcher, Search, etc. */}
      </div>
    )}
    <button onClick={toggleFullscreen}>
      {isFullScreen ? 'Exit' : 'Full Screen'}
    </button>
  </div>

  {/* Content Area - Views switch here */}
  <div className="content">
    {viewMode === 'board' && <BoardView />}
    {viewMode === 'list' && <ListView />}
    {viewMode === 'grid' && <GridView />}
  </div>
</div>
```

### Implementation Checklist
- [ ] Identify the element with the full-screen `ref`
- [ ] Ensure this element wraps **all possible views**
- [ ] Move view-switching logic **inside** the full-screen container
- [ ] Lift common controls (header, view switcher) to the common container
- [ ] Test: Enter full-screen → Switch views → Verify full-screen persists

### Real-World Example: TasksTab Component
In `src/components/unit-tabs/TasksTab.tsx`, the fix involved:

1. **Before**: `containerRef` was only on the Board View container
2. **After**: `containerRef` moved to a parent `div` that wraps all views (Board, List, Grid)
3. **Header**: Moved to the common container so controls persist across views
4. **Result**: Switching between Board and List views in full-screen now works seamlessly

> **Note**: After making structural changes to React components, a full page refresh may be required due to Hot Module Replacement (HMR) limitations.

### Key Takeaway
When implementing full-screen mode with multiple views:
- **The full-screen ref must be on a stable container that never unmounts**
- View-specific content should be children of this stable container
- Common UI elements (headers, controls) should be lifted to the stable container

---

## Performance Optimization for Full-Screen Modals

### The Problem
When modals open in full-screen mode, users may notice a subtle lag (a few milliseconds delay) compared to normal mode. This manifests as a slight "jank" when the overlay and dialog content animate in.

### Root Causes

1.  **`transition-all` on the container**: If the full-screen container has `transition-all duration-300`, every property change (including layout shifts caused by portal insertion) triggers a 300ms CSS transition. This causes the browser to animate unintended properties.

2.  **Missing `will-change` hints**: Without `will-change`, the browser doesn't pre-promote elements to their own compositing layers. When a modal opens with `transform` and `opacity` animations, the browser must create a new layer on the fly, causing a brief stutter.

### The Fix

#### 1. Remove `transition-all` from the full-screen container
```diff
- "flex flex-col bg-background/50 rounded-lg border overflow-hidden transition-all duration-300"
+ "flex flex-col bg-background/50 rounded-lg border overflow-hidden"
```

#### 2. Add `will-change` to `DialogContent`
In `src/components/ui/dialog.tsx`, add `will-change-[transform,opacity]` to `DialogContent`:
```tsx
<DialogPrimitive.Content
  className={cn(
    "fixed left-[50%] top-[50%] ... sm:rounded-lg will-change-[transform,opacity]",
    className
  )}
/>
```

This tells the browser to pre-allocate a compositing layer for the dialog, ensuring smooth `transform` and `opacity` animations without layout recalculation.

### Result
Modals now open with the same responsiveness in both normal and full-screen modes.

---

## Propagating `container` to Child Components

### The Problem
The `container` prop pattern works for top-level modals (`TaskDialog`, `AlertDialog`), but **nested overlays** inside task cards (tooltips, popovers, dropdowns) also render via portals. These child overlays are invisible in full-screen unless they also receive the `container` prop.

### Affected Components

| Component | Overlay Type | Fix Applied |
|-----------|-------------|-------------|
| `GlobalAssigneeSelector` | `PopoverContent` | Added `container` prop |
| `TaskCard` | `TooltipContent` (multiple) | Added `container` prop |
| `TasksTab` Filter Dropdown | `DropdownMenuContent` | Added `container` prop |
| `TaskDialog` Selects | `SelectContent` | Added `container` prop |
| `TaskDialog` DatePicker | `PopoverContent` (via `DateRangePicker`) | Added `container` prop |
| `TaskListView` | `TooltipContent` (multiple) | Added `container` prop |
| `TaskGridView` | Via `TaskCard` | Passed `container` down |
| `BoardLane` | Via `TaskCard` + `DropdownMenuContent` | Passed `container` down |

### Implementation Pattern

#### Step 1: Update UI primitives to accept `container`
Each Radix UI primitive wrapper (`tooltip.tsx`, `popover.tsx`, `dropdown-menu.tsx`) must pass `container` to its `Portal`:

```tsx
// Example: tooltip.tsx
const TooltipContent = React.forwardRef<...>(
  ({ className, sideOffset = 4, container, ...props }, ref) => (
    <TooltipPrimitive.Portal container={container}>
      <TooltipPrimitive.Content ... />
    </TooltipPrimitive.Portal>
  )
)
```

#### Step 2: Add `container` prop to child component interfaces
```tsx
// TaskCard.tsx
interface TaskCardProps {
  // ... existing props
  container?: HTMLElement | null;
}
```

#### Step 3: Pass `container` through the component tree
```
TasksTab (owns containerRef + isFullScreen)
  ├── BoardLane (receives container)
  │   ├── DropdownMenuContent (container={container})
  │   └── TaskCard (container={container})
  │       ├── TooltipContent (container={container})
  │       └── GlobalAssigneeSelector (container={container})
  │           └── PopoverContent (container={container})
  ├── TaskGridView (receives container)
  │   └── TaskCard (container={container})
  └── TaskListView (receives container)
      └── TooltipContent (container={container})
```

#### Step 4: Conditionally set `container` at the top level
```tsx
// In TasksTab.tsx
<TaskGridView
  container={isFullScreen ? containerRef.current : null}
  ...
/>
```

### Key Takeaway
When adding **any new overlay** (tooltip, popover, dropdown, dialog) inside a full-screen-enabled component, always:
1. Accept a `container` prop
2. Pass it to the Radix `Portal`
3. Thread it down from the parent that owns `containerRef`

---

## Full-Screen Support for KRAs / KPIs Tab

**Date**: February 17, 2026

### Overview
Extended the full-screen modal pattern from the Tasks tab to the **KRAs/KPIs** tab (`KRAsTab.tsx`). This tab contains multiple modal types for managing Key Result Areas, KPIs, and Objectives.

### Components Modified

| Component | File | Change |
|-----------|------|--------|
| `KRAsTab` | `KRAsTab.tsx` | Added `containerRef`, `isFullScreen`, `toggleFullscreen()`. Passes `container` to `KpiModal`, `AlertDialog`. |
| `KpiModal` | `KpiModal.tsx` | Accepts `container` prop, passes to `DialogContent`, `KraFormSection`, `KpiInputBlock`. |
| `KraFormSection` | `KraFormSection.tsx` | Accepts `container`, passes to `SelectContent`, `GlobalAssigneeSelector`, `DatePicker`. |
| `KpiInputBlock` | `KpiInputBlock.tsx` | Accepts `container`, passes to `SelectContent`, `GlobalAssigneeSelector`. |

### Prop Threading Pattern
```
KRAsTab (owns containerRef + isFullScreen)
  ├── KpiModal (container={container})
  │   ├── DialogContent (container={container})
  │   ├── KraFormSection (container={container})
  │   │   ├── SelectContent (container={container})
  │   │   ├── GlobalAssigneeSelector (container={container})
  │   │   └── DatePicker (container={container})
  │   └── KpiInputBlock (container={container})
  │       ├── SelectContent (container={container})
  │       └── GlobalAssigneeSelector (container={container})
  ├── AlertDialog (KRA deletion) (container={container})
  └── AlertDialog (KPI deletion) (container={container})
```

### Additional Fixes in KRAsTab
- **Added `deletingKpi` state**: Manages the KPI deletion confirmation workflow.
- **Added `handleDeleteKpiClick` handler**: Sets the KPI to be deleted and opens the confirmation dialog.
- **Added `handleConfirmDeleteKpi` handler**: Executes the deletion and resets state.

---

## Full-Screen Support for Overview Tab

**Date**: February 17, 2026

### Overview
Extended the full-screen modal pattern to the **Overview** tab (`OverviewTab.tsx`). This tab displays dashboard metrics and statistics cards that open detail modals.

### Components Modified

| Component | File | Change |
|-----------|------|--------|
| `OverviewTab` | `OverviewTab.tsx` | Passes `container` to `DialogContent` for KPI and Objectives detail modals. |
| `LocalStorageFallbackNotice` | `LocalStorageFallbackNotice.tsx` | Added optional `onSwitch` prop for an inline "Switch to OneDrive" button. |

### Lint Fixes Applied
- **KPI status filtering**: Added `as any[]` type assertion for `allKpis` to handle mixed KPI array types.
- **KRA status comparison**: Added `as string` type assertions for `kra.status` comparisons.
- **`window.msalInstance`**: Cast to `(window as any).msalInstance` to avoid missing type declarations.

---

## Null Container Regression Fix

**Date**: February 17, 2026

### The Problem
After implementing the `container` prop across all UI components, a **regression** was introduced in the **normal (non-full-screen) view**. Dropdowns, popovers, tooltips, and modals stopped rendering correctly when the page was **not** in full-screen mode.

### Root Cause
When not in full-screen mode, the `container` prop was being passed as `null`:
```tsx
container={isFullScreen ? containerRef.current : null}
```

Radix UI's `Portal` component treats `null` differently from `undefined`:
- **`undefined`** → Default behavior: renders into `document.body` ✅
- **`null`** → Attempts to render into `null`, which can break rendering ❌

### The Fix
Updated **all** Radix UI wrapper components to coerce `null` to `undefined`:

```tsx
// Before (broken in normal view)
<SelectPrimitive.Portal container={container}>

// After (works in both modes)
<SelectPrimitive.Portal container={container || undefined}>
```

### All UI Components Updated

| Component File | Portal Type | Fix Applied |
|----------------|-------------|-------------|
| `select.tsx` | `SelectPrimitive.Portal` | `container={container \|\| undefined}` |
| `popover.tsx` | `PopoverPrimitive.Portal` | `container={container \|\| undefined}` |
| `dialog.tsx` | `DialogPortal` | `container={container \|\| undefined}` |
| `tooltip.tsx` | `TooltipPrimitive.Portal` | `container={container \|\| undefined}` |
| `alert-dialog.tsx` | `AlertDialogPortal` | `container={container \|\| undefined}` |
| `dropdown-menu.tsx` | `DropdownMenuPrimitive.Portal` | `container={container \|\| undefined}` |
| `sheet.tsx` | `SheetPortal` | `container={container \|\| undefined}` |
| `context-menu.tsx` | `ContextMenuPrimitive.Portal` | `container={container \|\| undefined}` |
| `menubar.tsx` | `MenubarPrimitive.Portal` | `container={container \|\| undefined}` |
| `hover-card.tsx` | `HoverCardPrimitive.Portal` | `container={container \|\| undefined}` |

### Key Takeaway
> **Always use `container={container || undefined}`** when passing the container prop to Radix UI Portals. **Never** pass `null` directly, as it will break default rendering behavior.

---

## Complete File Reference

### UI Primitive Components Modified
- [`src/components/ui/dialog.tsx`](../src/components/ui/dialog.tsx)
- [`src/components/ui/select.tsx`](../src/components/ui/select.tsx)
- [`src/components/ui/popover.tsx`](../src/components/ui/popover.tsx)
- [`src/components/ui/tooltip.tsx`](../src/components/ui/tooltip.tsx)
- [`src/components/ui/alert-dialog.tsx`](../src/components/ui/alert-dialog.tsx)
- [`src/components/ui/dropdown-menu.tsx`](../src/components/ui/dropdown-menu.tsx)
- [`src/components/ui/sheet.tsx`](../src/components/ui/sheet.tsx)
- [`src/components/ui/context-menu.tsx`](../src/components/ui/context-menu.tsx)
- [`src/components/ui/menubar.tsx`](../src/components/ui/menubar.tsx)
- [`src/components/ui/hover-card.tsx`](../src/components/ui/hover-card.tsx)

### Feature Components Modified
- [`src/components/unit-tabs/TasksTab.tsx`](../src/components/unit-tabs/TasksTab.tsx)
- [`src/components/unit-tabs/KRAsTab.tsx`](../src/components/unit-tabs/KRAsTab.tsx)
- [`src/components/unit-tabs/OverviewTab.tsx`](../src/components/unit-tabs/OverviewTab.tsx)
- [`src/components/unit-tabs/TaskDialog.tsx`](../src/components/unit-tabs/TaskDialog.tsx)
- [`src/components/unit-tabs/modals/EditProjectModal.tsx`](../src/components/unit-tabs/modals/EditProjectModal.tsx)
- [`src/components/custom/GlobalAssigneeSelector.tsx`](../src/components/custom/GlobalAssigneeSelector.tsx)
- [`src/components/ui/date-picker.tsx`](../src/components/ui/date-picker.tsx)
- [`src/components/ui/DateRangePicker.tsx`](../src/components/ui/DateRangePicker.tsx)
- [`src/components/kra/KpiModal.tsx`](../src/components/kra/KpiModal.tsx)
- [`src/components/kra/KraFormSection.tsx`](../src/components/kra/KraFormSection.tsx)
- [`src/components/kra/KpiInputBlock.tsx`](../src/components/kra/KpiInputBlock.tsx)
- [`src/components/setup-wizard/components/LocalStorageFallbackNotice.tsx`](../src/components/setup-wizard/components/LocalStorageFallbackNotice.tsx)

---

## Testing Checklist

### Full-Screen Mode
- [x] Tasks Tab: Modals, dropdowns, tooltips, assignee selector work in full screen
- [x] KRAs Tab: KPI modal, KRA deletion dialog, KPI status selectors work in full screen
- [x] Overview Tab: Statistics detail modals work in full screen
- [x] View switching (Board ↔ List ↔ Grid) preserves full-screen state

### Normal Mode (Regression Check)
- [x] All Select dropdowns open and render correctly
- [x] All Popover/DatePicker components open correctly
- [x] All Dialog/AlertDialog modals render and are interactive
- [x] All Tooltips display on hover
- [x] All DropdownMenu components function correctly

---

**Updated By**: AI Assistant  
**Last Modified**: February 18, 2026
