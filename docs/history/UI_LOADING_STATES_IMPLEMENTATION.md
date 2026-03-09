# UI Loading States Implementation

## Overview
This document outlines the implementation of loading states across various modals and forms within the SCPNG Intranet to improve user experience and prevent accidental double-click submissions.

## Components Updated

### 1. Task Management (`TaskDialog.tsx`)
- **State Added:** `isSubmitting`
- **Behavior:** 
  - The `onSubmit` method within `TasksTab.tsx` inherently returns a `Promise`, allowing `TaskDialog` to await the completion of the save operation.
  - When `isSubmitting` is true, the main form container receives `opacity: 0.6` and `pointer-events: none`, effectively disabling all inner interactive elements securely.
  - Action buttons ("Cancel", "Save Changes", "Create Task") are explicitly disabled.
  - The primary action button displays a `Loader2` spinner and updates text to "Saving..." or "Creating...".

### 2. Admin Settings
- **User Management (`UserManagement.tsx`)**
  - **State Leveraged:** Existing `isProcessing` state.
  - **Behavior:** During `saveUserChanges` and `saveNewUser` operations, all `Input`, `Select`, `Checkbox`, and action buttons (`Cancel`, `Save`) are explicitly disabled. A `Loader2` spinner is added to the "Save" buttons.

- **Role Management (`RoleManagement.tsx`)**
  - **State Leveraged:** Existing `isProcessing` state.
  - **Behavior:** During `saveNewGroup`, all `Input`, `Select`, `Checkbox`, and action buttons (`Cancel`, `Save Changes`, `Create Group`, `Edit`, `Delete`) are explicitly disabled. A `Loader2` spinner is added to the save actions.

### 3. Unit Page Strategy Management
- **Objective Dialog (`KRAsTab.tsx`)**
  - **State Added:** `isSavingObjective`
  - **Behavior:** The `handleSaveObjective` function manages the loading state. All input fields (`Input`, `Select`, `RadioGroup`, `Popover`) and action buttons (`Cancel`, `Save Objective`) within the dialog are disabled during the save process. A `Loader2` spinner replaces the save icon.

- **KRA / KPI Modal (`KpiModal.tsx`, `KraFormSection.tsx`, `KpiInputBlock.tsx`)**
  - **Type Update:** Re-typed the `onSubmit` prop in `KpiModalProps` to `(formData: Kra) => Promise<void>` to support asynchronous loading states.
  - **State Added:** `isSubmitting` in `KpiModal.tsx`.
  - **Prop Propagation:** A new `disabled` prop was added to `KraFormSection`, `KpiInputBlock`, `ChecklistSection`, and `GlobalAssigneeSelector`. 
  - **Behavior:** The `isSubmitting` state is passed down as `disabled={isSubmitting}`. All inputs, textareas, dropdowns, and buttons inside these components are disabled while saving, preventing mid-save edits. The primary submit button displays an animated spinner and updates its label.

## Best Practices Established
- **Robust State Reversion:** Always use `try...finally` blocks around asynchronous `onSubmit` calls to ensure loading states are reset (`setIsSubmitting(false)`) even if an error occurs.
- **Deep Disabling:** For complex modals with nested forms, propagate a `disabled` prop down to all child components to ensure every interactive element is locked during submission.
- **Visual Feedback:** Pair disabled states with a loading spinner (e.g., `Loader2` from `lucide-react`) and descriptive button text (e.g., "Saving...") to provide clear context to the user.
