# UI Patterns & Best Practices

This document records specific UI implementation patterns used in the SCPNG Intranet project to ensure consistent and high-quality user experiences.

## Nested Auto-Scrolling within ScrollArea

### Problem
When working with nested scroll containers (e.g., a comments section inside a modal), using standard `element.scrollIntoView()` can cause the entire modal (and even the page) to scroll to center the target element. This is often disruptive as it moves the modal's header or the user's focus away from the main context.

### Solution
To scroll only a specific Radix UI `ScrollArea` component WITHOUT affecting parent containers, use a dedicated reference to the `ScrollArea` and target its internal viewport element.

#### Implementation Pattern

1. **Define Refs**:
   ```tsx
   const commentsEndRef = useRef<HTMLDivElement>(null);
   const commentsScrollAreaRef = useRef<HTMLDivElement>(null);
   ```

2. **Targeted Scroll Function**:
   ```tsx
   const scrollToBottom = () => {
     setTimeout(() => {
       if (commentsScrollAreaRef.current) {
         // Find the Radix ScrollArea viewport using its specific data attribute
         const viewport = commentsScrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
         if (viewport) {
           viewport.scrollTo({
             top: viewport.scrollHeight,
             behavior: 'smooth'
           });
           return;
         }
       }

       // Fallback with 'nearest' block alignment to minimize outer scroll impact
       if (commentsEndRef.current) {
         commentsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
       }
     }, 150);
   };
   ```

3. **Component Structure**:
   ```tsx
   <ScrollArea ref={commentsScrollAreaRef} className="h-[200px] ...">
     <div className="space-y-3">
       {items.map(item => (
         <Item key={item.id} {...item} />
       ))}
       {/* Anchor for fallback/identification */}
       <div ref={commentsEndRef} />
     </div>
   </ScrollArea>
   ```

### Benefits
- **Scoped Scrolling**: Only the intended container moves.
- **Smooth UX**: Consistent animation without "jumping" parent boundaries.
- **Robustness**: Provides a fallback if the Radix internals are not found.
- **Improved Focus**: Ensures the user stays centered on the modal while seeing fresh content.

---
*Last Updated: 2026-03-17*
