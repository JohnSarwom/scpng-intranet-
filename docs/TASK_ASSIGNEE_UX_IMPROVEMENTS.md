# Task Assignee UX Improvements

This document details the enhancements made to the Task Management UI, specifically focusing on the display and interaction of task assignees in both the List and Board views.

## Overview

The goal was to improve the visibility of task assignees and enable quick assignment directly from the task card. The changes replace text-based names with consistent, interactive avatars across different views.

## Changes Implemented

### 1. Enhanced Avatar Display
We standardized the assignee display to use circular avatars instead of text lists or small icons.

*   **Two-Letter Initials**: The avatar fallback now displays two initials (First Name + Last Name) instead of just one.
    *   *Logic*: `name.split(' ').map((n, i, arr) => (i === 0 || i === arr.length - 1) ? n[0] : '').join('').toUpperCase()`
    *   *Example*: "John Sarwom" → "JS"
*   **Increased Visibility**:
    *   Avatar size increased to `h-8 w-8` (32px).
    *   Text size increased to `text-xs` with `font-medium` weight.
*   **Stacked View for Multiple Assignees**:
    *   Shows up to 3 avatars overlapping.
    *   Displays a "+N" counter for additional assignees.
    *   Tooltip shows the full name on hover.

### 2. List View Updates (`TasksTab.tsx`)
The `TaskListView` component was updated to match the visual style of the Board view.
*   Replaced the comma-separated text column with the stacked avatar component.
*   Ensured consistent sizing and fallback logic.

### 3. Board View Updates (`TaskCard.tsx`)
The `TaskCard` component was updated to mirror the List view's improvements and add interactivity.
*   Applied the same larger avatar styling and two-letter initial logic.
*   **Interactive Selection**: Clicking on an assignee avatar (or the "Unassigned" placeholder) now opens a dropdown menu to select a staff member.

### 4. Interactive Assignment Logic
To support the dropdown selection in the Task Card:
*   **Props Update**: `TaskCard` now accepts an `availableAssignees` prop.
*   **Data Passing**: `TasksTab` passes the full `staffMembers` list down to `BoardLane` and then to `TaskCard`.
*   **Event Handling**: Implemented `handleAssigneeChange` in `TasksTab.tsx` to process selection events from the card and update the task data (currently via `editTask`).

## Modified Files

*   `src/components/unit-tabs/TasksTab.tsx`: Updated list view rendering and implemented assignment handler.
*   `src/components/unit-tabs/TaskCard.tsx`: Updated visual styling and added dropdown logic.

## Verification

### List View
1.  Navigate to **Tasks/Daily Operations**.
2.  Switch to **List View**.
3.  Observe that assignees are shown as circles with two initials (e.g., "JS").
4.  Hover over them to see the full name.

### Board View
1.  Switch to **Board View**.
2.  Observe the same larger avatars with two initials on the cards.
3.  **Click** on an avatar or the unassigned circle.
4.  Select a user from the dropdown list.
5.  Verify that the avatar updates to show the selected user.
