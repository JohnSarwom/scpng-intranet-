# Task Visibility & Dynamic Shared Group Architecture Analysis

## 1. Root Cause Investigation

The reason John Sarwom does not see the task assigned to him by the Admin (under "Tech" group) is due to **Server-Side Filtering Scope**.

### Technical Root Cause
1. **Fetching Scope**: The dashboard uses `useSharePointTasks` with a default scope of `'Unit'` (derived from `Unit.tsx`).
2. **Backend Logic**: In `sharePointOpsService.ts` (`getTasks`), the query strictly filters by the user's unit:
   ```typescript
   // Current Logic
   if (scope === 'Unit' && context?.unit) {
       filter = `fields/Department eq '${context.unit}'`;
   }
   ```
3. **The Disconnect**: 
   * John is in "Operations".
   * The Task is in "Tech".
   * The API query requests `Department eq 'Operations'`.
   * **Result**: The "Tech" task is filtered out *at the server level* before it ever reaches John's browser.
   
The client-side "Direct Visibility" filter (which correctly checks `isAssignee`) never runs because the data is never fetched.

---

## 2. Comparison of Approaches

### Option 1: Direct Task Visibility (Recommended)
*Display the task in its original context (e.g., "Tech"), provided the user has visibility.*

| Aspect | Option 1 (Direct Visibility) | Option 2 (Dynamic Shared Group) |
| :--- | :--- | :--- |
| **Data Model** | **Single Source of Truth**. Task stays in "Tech". | **Virtual Aggregation**. Task stays in "Tech", but UI fakes a group. |
| **UX/UI** | **Contextual**. User sees "Tech > Fix Server". Context is preserved. | **Simplified**. "Shared with Me > Fix Server". Context is flattened. |
| **Backend** | **Complex Fetch**. Requires fetching "My Unit's Tasks" + "Assigned to Me". | **Same Complexity**. Still requires fetching the same hidden tasks. |
| **Scalability** | **High**. As teams grow, cross-unit work is transparent. | **Medium**. A single "Shared" bucket becomes unmanageable with many tasks. |
| **Cognitive Load** | **Medium**. Users see groups (`Tech`, `HR`) they don't own. | **Low**. "Here is stuff others sent me." |

### Feasibility of Dynamic Creation
*   **Backend**: We cannot "create" a dynamic group in SharePoint without polluting the Project list with per-user groups.
*   **Virtual**: We CAN create a virtual group in the UI (React state) easily.

---

## 3. Recommended Architectural Approach

**Recommendation: Option 1 (Direct Visibility) with Virtual Fallback UI**

We should strictly enforce **Direct Visibility** as the architectural model, but use a UI fallback to handle the display of tasks whose parent groups are missing.

### Reasoning
1.  **Preservation of Context**: Knowing a task is from "Tech" vs "HR" provides critical context. Flattening everything to "Shared Tasks" removes this.
2.  **Codebase Alignment**: Your existing `Unit.tsx` logic (lines 552-570) *already attempts* to implement this pattern:
    ```typescript
    // Existing Logic in Unit.tsx
    const hasAssignedTask = taskState.data?.some(t => 
        t.projectId === String(p.id) && t.assignedTo === currentUser ...
    )
    // If I have a task in a group, SHOW that group.
    ```
    This confirms the original architectural intent was Option 1.
3.  **Scalability**: "Virtual Groups" is a UI patch. It often leads to "Why can't I reorganize this shared task?" complaints later.

---

## 4. Implementation Plan

The solution requires a **Backend Query Update** to fix the root cause, and a minor **UI Adjustment**.

### Step 1: Fix the Backend Query (The Blocker)
We need to modify `getTasks` in `sharePointOpsService.ts` to broaden the search scope. 

**Challenge**: Querying `Assignees` (JSON Text) is hard.
**Solution**:
*   **Option A (Backend Change)**: Update `saveTask` to populate the standard `AssignedTo` (Person) column or a new `AssigneeEmails` (Indexed Text) column. This makes filtering efficient.
*   **Option B (Fetch Logic)**: If we can't change schema, we might need to relax the Department filter or run two queries:
    1.  `Department eq 'MyUnit'`
    2.  `Assignees` contains `MyEmail` (if supported via search) OR just fetch *All* tasks (if list < 2000 items) and filter client-side.

**Recommendation**: Update `getTasks` to fetch **ALL tasks** (initially) and filter client-side. This is the safest immediate fix without schema changes, given the likely dataset size. If performance drops, implement Option A (Schema Indexing).

### Step 2: UI Fallback (The "Shared" Concept)
If John has a task from "Tech", but the "Tech" *Project/Bucket* definition is not visible to him:

1.  **Fetch** the "Tech" task (via Step 1).
2.  **Identify Orphan**: The UI sees `projectId='Tech'` but `projects` list doesn't have 'Tech'.
3.  **Virtual Group**: `Unit.tsx` should detect these orphaned tasks and render them under a dynamically created **"Shared Tasks"** bucket in the board view.

**This gives you the best of both worlds:**
*   **Data Integrity**: Task remains in "Tech".
*   **UI Clarity**: User sees the task in a "Shared / External" lane if they can't see the original project.

### Summary Strategy
1.  **Backend**: Broaden `getTasks` scope to allow "Direct Visibility".
2.  **UI**: Implement "Virtual Shared Bucket" for tasks whose real buckets are not visible.
