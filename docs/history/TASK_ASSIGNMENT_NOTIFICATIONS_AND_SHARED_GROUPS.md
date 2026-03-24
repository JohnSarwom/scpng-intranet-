# Task Assignment Notifications & "Assigned to Me" Groups with Independent Views

**Date:** March 17, 2026 (10:29 PM WPST)
**Status:** Partially implemented — core infrastructure complete, pending testing and refinements

---

## 1. Problem Statement

Previously, when a user assigned a task to another person:
- **No notification** was sent (no in-app, no email, no push notification)
- The assignee simply saw the task appear on their board on next refresh
- Cross-unit tasks landed in a virtual `shared-tasks-virtual` bucket (not persisted)
- There was no concept of independent board views — moving a task affected everyone's view

## 2. Requirements

1. **Assignment Notifications**: In-app + email notifications when someone is assigned a task
2. **Per-user "Assigned to Me" Group**: A real, persistent TaskGroup auto-created for each assignee on first assignment
3. **Independent Board Views**: Creator sees the task in their chosen group; assignee sees it in their "Assigned to Me" group (or wherever they moved it). Moving in one view does NOT affect the other.

## 3. Architecture Design

### Core Concept: `assigneeViewMap`

Since a task has only one `projectId` (maps to `RelatedTaskGroupLookupId` in SharePoint), we added a new JSON field `AssigneeViewMap` to store per-assignee group overrides:

```json
{ "john@scpng.gov.pg": "3", "jane@scpng.gov.pg": "5" }
```

- **Creator** sees the task via `projectId` (their chosen group)
- **Assignee** sees the task via `assigneeViewMap[myEmail]` (defaults to their "Assigned to Me" group)
- **Viewer** (neither creator nor assignee) falls through to `projectId`

### "Assigned to Me" Groups

- Real `TaskGroup` entries in `Operations_TaskGroups` SharePoint list
- Identified by `OwnerEmail` column (non-empty = private group for that user)
- `Order: -1` ensures they pin to the leftmost position on the board
- Created lazily via `getOrCreateAssignedToMeGroup()` on first assignment

---

## 4. Files Modified

### A. `src/types/index.ts`
- Added `assigneeViewMap?: Record<string, string>` to `Task` interface (line 126)
- Added `ownerEmail?: string` to `TaskGroup` interface (line 84)

### B. `src/services/sharePointOpsService.ts`

#### New Schema Ensure Methods
- `ensureAssigneeViewMapColumn()` — auto-creates `AssigneeViewMap` (multiline text) on `Operations_Tasks` list. Fire-and-forget on init.
- `ensureOwnerEmailColumn()` — auto-creates `OwnerEmail` (text) on `Operations_TaskGroups` list. Fire-and-forget on init.
- Both called from `initialize()` alongside existing ensure methods.

#### Updated Mappers
- `mapTask()`: Parses `f.AssigneeViewMap` → `assigneeViewMap` (JSON parse with undefined fallback)
- `mapTaskGroup()`: Reads `f.OwnerEmail` → `ownerEmail`

#### Updated Writers
- `addTask()`: Writes `AssigneeViewMap: JSON.stringify(task.assigneeViewMap)` if present. Has graceful fallback — if the column doesn't exist, retries without it.
- `updateTask()`: Conditionally writes `AssigneeViewMap` if `task.assigneeViewMap !== undefined`. Same graceful fallback.
- `addTaskGroup()`: Only includes `OwnerEmail` in payload when `group.ownerEmail` has a value (avoids errors if column doesn't exist yet for regular group creation).

#### New Methods
- **`getOrCreateAssignedToMeGroup(assigneeEmail, department)`**:
  - Fetches all TaskGroups, finds one where `ownerEmail === assigneeEmail`
  - If found, returns it
  - If not, creates a new TaskGroup: name "Assigned to Me", `ownerEmail` set, `order: -1`
  - Returns the group

- **`notifyAssignment(params)`**:
  - Signature: `{ taskId, taskTitle, assignerName, assignerEmail, assignees[] }`
  - Collects unique assignee emails, excludes self-assignment
  - For each recipient: fires `addNotification()` (type: 'task', category: 'task') + `sendEmailNotification()` with styled HTML email
  - Uses `Promise.allSettled()` (fire-and-forget pattern, same as `notifyComment`)
  - Email includes dark red header (#8B0000), task title, assigner name, "View Task" button

### C. `src/components/unit-tabs/TasksTab.tsx`

#### Import Added
- `import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';`

#### Hook Added
- `const { user: authUser } = useRoleBasedAuth();` — used for getting current user's display name for notifications

#### Board Placement Logic (useEffect, ~line 856)
**Replaced** the old `shared-tasks-virtual` routing code with independent view logic:

```
For each task:
  if currentUser is creator → effectiveProjectId = task.projectId
  else if currentUser is assignee → effectiveProjectId = task.assigneeViewMap[myEmail] || task.projectId
  else → effectiveProjectId = task.projectId (viewer fallback)
```

- Uses `effectiveProjectId` instead of `task.projectId` for bucket placement
- Removed all `shared-tasks-virtual` routing code
- Orphaned tasks (bucket not found) go to `uncategorized-virtual`

#### Drag Handler (`handleDragEnd`, ~line 1044)
**Modified** to update the correct field based on who is dragging:

- **Creator (or unknown/old tasks)**: Updates `{ projectId: destinationColumnId }` → writes to `RelatedTaskGroupLookupId` (existing behavior, always safe)
- **Pure assignee** (confirmed not creator AND in assignees list): Updates `{ assigneeViewMap: { ...currentMap, [myEmail]: destinationColumnId } }`
- Default is creator path for safety (handles missing `createdByEmail` on old tasks)
- Undo action respects the same split

**Critical design choice**: `isDragCreator` defaults to `true` when `normalizedCurrentEmail` is empty or `createdByEmail` is missing. This ensures old tasks without creator tracking still use the standard `projectId` path.

#### Submit Handler (`onSubmit`, ~line 2055)

**Edit path**: After `editTask()` succeeds:
1. Detects newly added assignees (compares old vs new)
2. Fire-and-forget async block:
   - Calls `service.notifyAssignment()` for new assignees
   - For each new assignee, calls `service.getOrCreateAssignedToMeGroup(email, unit)`
   - Builds `assigneeViewMap` with each assignee's group ID
   - Cleans up entries for removed assignees
   - Updates task with `editTask(id, { assigneeViewMap }, { suppressToast: true })`
   - Calls `onDataRefresh()` to sync UI

**Create path**: After `addTask()` succeeds:
1. Same fire-and-forget pattern
2. Skips creator's own email in the assigneeViewMap (they use `projectId`)
3. Only updates if there are assigneeViewMap entries

### D. `src/pages/Unit.tsx`

#### Bucket Calculation (`calculatedBuckets` useMemo, ~line 597)
**Replaced** the old logic:

**Removed:**
- `shared-tasks-virtual` bucket creation (orphaned task detection, cross-unit logic)
- Complex orphan filtering (isCreatedByMe checks, isCrossUnit, isAssignedOrphan)

**Added:**
- Filter TaskGroups by `ownerEmail`: if group has `ownerEmail`, only show to that user
- Override display name: groups with `ownerEmail` display as "Assigned to Me" regardless of stored name
- Kept `uncategorized-virtual` bucket for tasks with no effective group

**Updated uncategorized detection:**
- Now checks effective projectId per user (respects assigneeViewMap for assignees)

---

## 5. SharePoint Schema Changes

### Operations_TaskGroups — New Column
| Column | Type | Notes |
|--------|------|-------|
| OwnerEmail | Single line of text | Empty = shared group. Non-empty = private "Assigned to Me" group for that user. Set by `getOrCreateAssignedToMeGroup()`. |

### Operations_Tasks — New Column
| Column | Type | Notes |
|--------|------|-------|
| AssigneeViewMap | Multiple lines of text | JSON map: `{ "email": "groupId" }`. Per-assignee board placement overrides. |

Both columns are auto-created by `ensureOwnerEmailColumn()` and `ensureAssigneeViewMapColumn()` on service initialization.

---

## 6. Data Flow

### When User A assigns a task to User B:

```
1. TaskDialog → onSubmit(taskData) with assignees = [UserB]
2. TasksTab submit handler:
   a. Calls addTask/editTask with taskData (projectId = UserA's chosen group)
   b. Fire-and-forget:
      i.   notifyAssignment() → in-app notification + email to UserB
      ii.  getOrCreateAssignedToMeGroup(UserB.email) → creates/finds ATM group
      iii. editTask(id, { assigneeViewMap: { "userb@email": "atmGroupId" } })
3. User A's board: task appears in their chosen group (projectId)
4. User B's board: task appears in "Assigned to Me" group (assigneeViewMap)
5. User B drags to another group → updates assigneeViewMap[myEmail], projectId unchanged
6. User A's view: unaffected
```

### When User B drags a task:
```
1. handleDragEnd detects isDragAssigneeOnly = true
2. Sends { assigneeViewMap: { ...existing, "userb@email": newGroupId } }
3. updateTask writes AssigneeViewMap to SharePoint
4. User A's projectId is untouched
```

### When User A (creator) drags a task:
```
1. handleDragEnd detects isDragCreator = true (or defaults to true)
2. Sends { projectId: newGroupId }
3. updateTask writes RelatedTaskGroupLookupId to SharePoint
4. User B's assigneeViewMap is untouched
```

---

## 7. Bug Fixes Applied (Same Session)

### Fix: Group creation failing
**Symptom:** Creating a new custom group failed after our changes.
**Root Cause:** `addTaskGroup()` was sending `OwnerEmail: ''` for regular groups. If the column didn't exist yet on SharePoint, the POST was rejected.
**Fix:** Only include `OwnerEmail` in the payload when `group.ownerEmail` has a truthy value.

### Fix: Drag and drop not working
**Symptom:** After implementing independent views, drag-and-drop stopped working for the creator.
**Root Cause:** The drag handler's creator detection (`isDragCreator`) returned `false` when `createdByEmail` was empty/undefined (common for old tasks). This routed to the assignee path, which tried to write `assigneeViewMap` — failing or not moving the task correctly.
**Fix:** Flipped the default — `isDragCreator` defaults to `true` when email is empty or `createdByEmail` is missing. The `assigneeViewMap` path only triggers when the user is **confirmed** as a pure assignee (`isDragAssigneeOnly = !isDragCreator && isInAssigneesList`).

### Alignment with TASK_GROUPS_ARCHITECTURE.md
Verified that all service layer code aligns with the documented bug fixes:
- `RelatedProjectLookupId` is never written with TaskGroup IDs (only `RelatedTaskGroupLookupId`)
- `AssigneeViewMap` has graceful fallback (retry without it if column doesn't exist)
- `setupTaskGroupsList()` force-recreates lookup columns

---

## 8. End-to-End Review & Bug Fixes (March 22, 2026 — 6:30 AM WPST)

A full code review was performed across all files involved in the task assignment system. The following issues were identified and fixed:

### 8.1 Bug Fix: AssigneeViewMap JSON parse crash

**File:** `src/services/sharePointOpsService.ts` (line ~1580)
**Issue:** `JSON.parse(f.AssigneeViewMap)` had no try/catch. A single task with malformed JSON in this column would crash the entire `getTasks()` fetch for all tasks.
**Fix:** Wrapped in a try/catch with `undefined` fallback, matching the pattern used by `SubtasksJSON`, `CommentsJSON`, and `Assignees` parsers.

### 8.2 Refactor: Extracted `getEffectiveGroupId()` shared utility

**File created:** `src/utils/taskBoardUtils.ts`
**Issue:** The creator/assignee/viewer routing logic was duplicated identically in `TasksTab.tsx` (~line 858) and `Unit.tsx` (~line 628). Changes in one required manual sync to the other.
**Fix:** Extracted a single `getEffectiveGroupId(task, currentUserEmail)` function. Both files now import and use this shared helper.

### 8.3 Cleanup: Removed dead `shared-tasks-virtual` references

**File:** `src/components/unit-tabs/OverviewTab.tsx` (lines 269-278)
**Issue:** Code still referenced `shared-tasks-virtual` bucket which no longer exists after the independent views migration. The condition was always `false`, making it dead code.
**Fix:** Removed the dead code block.

### 8.4 Minor: Removed unused dependency in `calculatedBuckets`

**File:** `src/pages/Unit.tsx` (line ~654)
**Issue:** `projectState.data` was listed in the `useMemo` dependency array but never used inside the memo, causing unnecessary recalculations.
**Fix:** Removed from the dependency array.

---

## 9. ATM Column Position & Styling (March 22, 2026 — 6:45 AM WPST)

### 9.1 ATM Column Moved to End of Board

**Previous behavior:** ATM groups had `order: -1`, pinning them to the leftmost position.
**New behavior:** ATM groups now have `order: 999999`, placing them at the far right, just before the "Add New Group" button. This gives precedence to the user's custom groups.

**Files changed:**
- `src/services/sharePointOpsService.ts` — `getOrCreateAssignedToMeGroup()` now sets `order: 999999`
- `src/pages/Unit.tsx` — `calculatedBuckets` mapping overrides ATM group order to `999999` at render time (handles existing ATM groups that still have `order: -1` in SharePoint)

### 9.2 ATM Column Visual Differentiation

Added `isAtm` flag to `Bucket` interface and `BoardLane` component so the ATM column renders with a visually darker background:

| Element | Regular Group | ATM Group |
|---------|--------------|-----------|
| Column body | `bg-muted/30` | `bg-stone-100` (+ `shadow-sm`) |
| Column header | `bg-muted/50` | `bg-stone-200/80` |

**Files changed:**
- `src/components/unit-tabs/TasksTab.tsx` — Added `isAtm` to `Bucket` interface and `BoardLane` props; conditional Tailwind classes applied
- `src/pages/Unit.tsx` — Sets `isAtm: true` on buckets where `ownerEmail` is present

---

## 10. Lovable Branding Removal (March 22, 2026 — 6:50 AM WPST)

All references to the Lovable platform (used during initial project scaffolding) were removed:

| File | Change |
|------|--------|
| `index.html` | Removed `og:image` and `twitter:*` meta tags pointing to `lovable.dev`. Removed `gptengineer.js` script tag. |
| `vite.config.ts` | Removed `lovable-tagger` import and `componentTagger()` plugin usage. |
| `package.json` | Removed `lovable-tagger` dev dependency. |
| `src/config/microsoft-auth.ts` | Removed `lovable.dev` project URL from `approvedRedirectUris` array. |
| `update-local-storage.js` | Replaced `lovable.app` preview URI with `unitopia-hub.vercel.app`. |
| `src/components/dashboard/WelcomeCard.tsx` | Replaced broken `/lovable-uploads/...` image path with `/images/SCPNG Original Logo.png`. |

Ran `npm install` to update `package-lock.json` accordingly.

---

## 11. Pending / TODO

The following items were identified but NOT yet implemented:

1. ~~**End-to-end testing**: Assign a task across units, verify both users see correct views~~ — Code review completed (Section 8), manual testing pending
2. **Inline assignee change notifications**: `handleAssigneesChange` and `handleAssigneeChange` in TasksTab don't yet fire notifications or create ATM groups (only the dialog submit handler does)
3. **TaskGroup refetch after ATM creation**: When a new "Assigned to Me" group is created, the `useSharePointTaskGroups` cache may not reflect it immediately for the assignee. May need to invalidate the taskGroups query key.
4. **Delete "Assigned to Me" group protection**: Users should not be able to delete their auto-created ATM group (or it should auto-recreate)
5. **ATM group visibility for managers/admins**: Admins currently only see their own ATM group. They may need to see all tasks regardless of assigneeViewMap.
6. **Notification deduplication**: If a task is edited multiple times quickly, multiple notifications could be sent
7. **Migration of existing virtual shared tasks**: Old tasks that were in `shared-tasks-virtual` won't have `assigneeViewMap` entries. They'll fall through to `uncategorized-virtual` instead.

---

## 12. Key Code References

| Feature | File | Line(s) |
|---------|------|---------|
| Task interface (assigneeViewMap) | `src/types/index.ts` | ~127 |
| TaskGroup interface (ownerEmail) | `src/types/index.ts` | ~84 |
| Bucket interface (isAtm) | `src/components/unit-tabs/TasksTab.tsx` | ~85 |
| getEffectiveGroupId (shared helper) | `src/utils/taskBoardUtils.ts` | 1-34 |
| ensureAssigneeViewMapColumn | `src/services/sharePointOpsService.ts` | ~166 |
| ensureOwnerEmailColumn | `src/services/sharePointOpsService.ts` | ~185 |
| mapTask (reads AssigneeViewMap) | `src/services/sharePointOpsService.ts` | ~1580 |
| mapTaskGroup (reads OwnerEmail) | `src/services/sharePointOpsService.ts` | ~1814 |
| addTask (writes AssigneeViewMap) | `src/services/sharePointOpsService.ts` | ~512 |
| updateTask (writes AssigneeViewMap) | `src/services/sharePointOpsService.ts` | ~563 |
| addTaskGroup (writes OwnerEmail) | `src/services/sharePointOpsService.ts` | ~1777 |
| getOrCreateAssignedToMeGroup | `src/services/sharePointOpsService.ts` | ~2364 |
| notifyAssignment | `src/services/sharePointOpsService.ts` | ~2382 |
| Board placement (independent views) | `src/components/unit-tabs/TasksTab.tsx` | ~858 |
| BoardLane (isAtm styling) | `src/components/unit-tabs/TasksTab.tsx` | ~103 |
| Drag handler (creator vs assignee) | `src/components/unit-tabs/TasksTab.tsx` | ~1048 |
| Submit handler (notifications + ATM) | `src/components/unit-tabs/TasksTab.tsx` | ~2055 |
| Bucket calculation (filter + order ATM) | `src/pages/Unit.tsx` | ~597 |
