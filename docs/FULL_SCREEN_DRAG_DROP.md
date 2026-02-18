# Handling Drag-and-Drop in Full-Screen Mode

## The Problem
When using drag-and-drop libraries like `@dnd-kit` in a full-screen application, a common issue arises where the "drag overlay" (the ghost image of the item being dragged) disappears or becomes invisible when the application enters full-screen mode.

This happens because:
1.  **Full-Screen Stacking Context**: The element in full-screen mode creates a new, high-level stacking context.
2.  **Default Portal Behavior**: By default, `dnd-kit`'s `<DragOverlay>` renders into `document.body` (via `createPortal` internally or just by appending).
3.  **Z-Index Obscurity**: Since the full-screen element sits at the very top of the browser's visual stack (conceptually), elements rendered in `document.body` (even with high z-index) are often rendered *behind* the full-screen element.

## The Solution: Portaling into the Full-Screen Container

To fix this, the `<DragOverlay>` must be rendered **inside** the specific DOM element that is currently in full-screen mode. We can achieve this using React's `createPortal`.

### Implementation Pattern

1.  **Reference the Container**: Maintain a `ref` to the element that you request full-screen on.
2.  **Track Full-Screen State**: Use state to know when the app is in full-screen mode.
3.  **Conditional Portaling**:
    -   **Normal Mode**: Render `<DragOverlay>` normally (it will likely portal to body or stay in place).
    -   **Full-Screen Mode**: Manualy wrap `<DragOverlay>` in `createPortal(..., containerRef.current)`.

### Code Example

```tsx
import { createPortal } from 'react-dom';
import { DndContext, DragOverlay } from '@dnd-kit/core';

const KanbanBoard = () => {
    const [isFullScreen, setIsFullScreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeDragItem, setActiveDragItem] = useState(null);

    return (
        <div ref={containerRef} className="board-container">
             <DndContext onDragStart={...} onDragEnd={...}>
                {/* Board Columns */}
                
                {/* Drag Overlay Logic */}
                {isFullScreen && containerRef.current ? (
                    // IN FULL SCREEN: Portal explicitly into the Full-Screen Container
                    createPortal(
                        <DragOverlay>
                            {activeDragItem ? <Card item={activeDragItem} /> : null}
                        </DragOverlay>,
                        containerRef.current
                    )
                ) : (
                    // NORMAL MODE: Default behavior
                    <DragOverlay>
                         {activeDragItem ? <Card item={activeDragItem} /> : null}
                    </DragOverlay>
                )}
             </DndContext>
        </div>
    );
};
```

## Key Considerations

-   **Portal Target**: The target must be the exact DOM node that `requestFullscreen()` was called on.
-   **CSS Context**: When portaled into the container, the overlay inherits styles from that container. Ensure your overlay layout styles (fixed positioning, etc.) still work correctly within this new context.
-   **Z-Index**: Even inside the full-screen container, ensure the overlay has a high z-index to sit above the columns/cards.
