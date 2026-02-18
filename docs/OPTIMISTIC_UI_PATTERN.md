# Optimistic UI Pattern

## Overview
This project uses an **Optimistic UI** pattern for task operations to provide instant feedback to the user, mimicking the responsiveness of a local application. Instead of waiting for the server to confirm an action, the UI updates immediately.

## The Pattern

The standard pattern for all task modifications (completion, assignment, priority, status) follows these 5 steps:

1.  **Capture State**: Find the current task object to use as a fallback.
2.  **Optimistic UI Update**:
    *   Create an updated task object.
    *   Update the `optimisticUpdates` ref (used to prevent stale data overwrites during re-renders).
    *   Update the local React state (`boardData`) immediately.
3.  **User Feedback**:
    *   Trigger an immediate **Success Toast** (e.g., "Task Completed") so the user knows the action was registered.
4.  **Background Persistence**:
    *   Call the API (e.g., `editTask`) with `{ suppressToast: true }` to avoid double notifications.
5.  **Error Handling & Rollback**:
    *   Wrap the API call in a `Promise`.
    *   If it fails (`.catch()`), **revert** the content to the original state.
    *   Show a destructive **Error Toast** informing the user that the change couldn't be saved.

## Code Example

```typescript
const handleModification = (taskId: string, newValue: any) => {
  // 1. Find current task for rollback
  const originalTask = findTask(taskId);
  if (!originalTask) return;

  // 2. Prepare Optimistic Update
  const updatedTask = { ...originalTask, field: newValue };
  
  // Track pending update
  optimisticUpdates.current.set(taskId, updatedTask);
  
  // Update UI immediately
  setBoardData(prev => updateTaskInBoard(prev, updatedTask));

  // 3. Immediate Success Feedback
  toast({
    title: "Action Successful",
    description: "The task has been updated."
  });

  // 4. Persist to Server (Background)
  Promise.resolve(api.update(taskId, newValue, { suppressToast: true }))
    .catch(error => {
      // 5. Rollback on Fail
      console.error("Update failed", error);
      
      // Cleanup ref
      optimisticUpdates.current.delete(taskId);
      
      // Revert UI
      setBoardData(prev => updateTaskInBoard(prev, originalTask));
      
      // Notify User
      toast({
        title: "Update Failed",
        description: "Could not save changes. Reverted.",
        variant: "destructive"
      });
    });
};
```

## Benefits
*   **Zero Latency**: Users see the result of their action instantly.
*   **Confidence**: Success toasts confirm the action was registered.
*   **Safety**: Automatic rollback ensures the UI doesn't stay out of sync with the server if errors occur.
