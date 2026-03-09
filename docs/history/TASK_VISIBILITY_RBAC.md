# Task Visibility & RBAC Implementation

## Overview

This document details the role-based access control (RBAC) and visibility rules for the Tasks/Operations module. The implementation ensures users only see tasks relevant to them while maintaining security and data integrity.

## Visibility Rules

### Core Principle

**Users see tasks they created OR are assigned to, regardless of role.**

### Rule Matrix

| User Role | Visibility |
|-----------|------------|
| **Admin/Super Admin** | All tasks (no filtering) |
| **Manager** | Tasks they created OR tasks assigned to them |
| **Staff Member** | Tasks they created OR tasks assigned to them |

### Key Features

1. **Creator-Based Visibility**: Users always see tasks they created, even if not assigned
2. **Assignee-Based Visibility**: Users see tasks assigned to them, regardless of creator
3. **Role-Agnostic**: Same filtering logic applies to all non-admin users
4. **Admin Bypass**: Administrators see all tasks for oversight

## Implementation Details

### Backend Data Structure

#### Task Type Definition

```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: string;              // Legacy single assignee (email)
  assignees?: User[];             // Multiple assignees array
  createdBy: string;              // Display name of creator
  createdByEmail: string;         // Email of creator (primary key)
  authorEmail: string;            // Alias for createdByEmail
  // ... other fields
}
```

#### SharePoint Data Mapping

**File**: `src/services/sharePointOpsService.ts`

The `mapTask` method extracts creator information from SharePoint's built-in `Author` field via Microsoft Graph API:

```typescript
private mapTask(item: any): Task {
  const f = item.fields;
  
  // Extract creator from Graph API response
  const createdByEmail = item.createdBy?.user?.email || 
                        item.lastModifiedBy?.user?.email || '';
  const createdByName = item.createdBy?.user?.displayName || 
                       item.lastModifiedBy?.user?.displayName || 'Unknown';

  return {
    id: item.id,
    title: f.Title,
    // ... other field mappings
    assignees: this.parseAssignees(f.Assignees),
    createdByEmail: createdByEmail,
    createdBy: createdByName,
    authorEmail: createdByEmail,
  };
}
```

**Key Points:**
- Uses SharePoint's built-in `Author` field (no custom schema needed)
- Populates `createdByEmail` and `createdBy` from Graph API metadata
- Falls back to `lastModifiedBy` if `createdBy` is unavailable

### Frontend Filtering

**File**: `src/hooks/useSharePointOps.ts`

The `useSharePointTasks` hook applies visibility filtering:

```typescript
export const useSharePointTasks = (scope: 'unit' | 'global') => {
  return useQuery({
    queryKey: ['sharepoint-tasks', scope],
    queryFn: async () => {
      let data = await service.getTasks(scope, context);
      
      // 🔒 ROLE-AGNOSTIC FILTERING
      const isAdmin = context?.role === 'admin' || context?.role === 'super_admin';

      if (!isAdmin && context?.email) {
        data = data.filter(task => {
          const userEmail = context.email!.toLowerCase();

          // Check 1: Is user the creator?
          const isCreator = task.createdByEmail?.toLowerCase() === userEmail ||
                           task.authorEmail?.toLowerCase() === userEmail;

          // Check 2: Is user an assignee?
          const isAssigned = task.assignees?.some(a => 
            a.email?.toLowerCase() === userEmail
          );

          return isCreator || isAssigned;
        });
      }

      return data;
    }
  });
};
```

**Filtering Logic:**
- ✅ Admins bypass all filters
- ✅ Non-admins filtered by: `isCreator OR isAssigned`
- ✅ Case-insensitive email comparison
- ✅ Handles both single and multiple assignees

## UI Features

### "Created By" Display in Task Modal

**File**: `src/components/unit-tabs/TaskDialog.tsx`

When editing a task, the modal header displays the creator's name:

```tsx
<DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
  <div className="flex justify-between items-start">
    <div>
      <DialogTitle>Edit Task</DialogTitle>
      <DialogDescription>Update the details of the task.</DialogDescription>
    </div>
    {initialData?.createdBy && (
      <div className="flex flex-col items-end">
        <span className="text-xs text-muted-foreground uppercase">Created by</span>
        <span className="text-sm font-medium">{initialData.createdBy}</span>
      </div>
    )}
  </div>
</DialogHeader>
```

**Purpose:**
- Clarifies task ownership when assignees differ from creator
- Reduces confusion about visibility ("Why do I see this task?")
- Provides audit trail visibility

## Cross-Unit Task Visibility

### Overview

The application supports **cross-organizational unit task assignment**, enabling tasks to be shared between different departments while maintaining visibility and security. This feature implements a "Direct Visibility" model with a virtual "Shared Projects" bucket for tasks assigned from other units.

### Architecture

#### The Problem

Previously, tasks were filtered by the user's `Department` field at the server level, blocking cross-unit collaboration:

```typescript
// ❌ OLD: Server-side filter prevented cross-unit visibility
const filter = `fields/Department eq '${context.unit}'`;
```

**Impact:**
- User in "IT Unit" assigned a task by "Tech" unit → Task invisible to assignee
- No mechanism to view tasks from other organizational units
- Blocked cross-departmental collaboration workflows

#### The Solution: Direct Visibility + Virtual Bucket

**Phase 1: Remove Server-Side Filters**

**File**: `src/services/sharePointOpsService.ts`

```typescript
// ✅ NEW: No department filter for tasks
// Fetches ALL tasks, client-side filtering handles visibility
async getTasks(scope: FilterScope, context?: UserContext): Promise<Task[]> {
  let query = this.client
    .api(`/sites/${this.siteId}/lists/${this.listIds['TASKS']}/items`)
    .expand('fields')
    .select('id,fields,createdBy,lastModifiedBy,createdDateTime,lastModifiedDateTime');
  
  // No Department filter applied
  const response = await query.get();
  // ...
}
```

**Phase 2: Client-Side Filtering (Creator OR Assignee)**

**File**: `src/hooks/useSharePointOps.ts`

Tasks are filtered by the existing `isCreator` OR `isAssigned` logic:

```typescript
if (!isAdmin && context?.email) {
  data = data.filter(task => {
    const userEmail = context.email!.toLowerCase();
    
    // Check 1: Is user the creator?
    const isCreator = task.createdByEmail?.toLowerCase() === userEmail ||
                     task.authorEmail?.toLowerCase() === userEmail;
    
    // Check 2: Is user an assignee?
    const isAssigned = task.assignees?.some(a => 
      a.email?.toLowerCase() === userEmail
    );
    
    return isCreator || isAssigned; // ✅ Cross-unit tasks pass this check
  });
}
```

**Result**: Tasks from other units are now fetched and visible to assignees.

**Phase 3: Virtual "Shared Projects" Bucket**

**Problem**: Cross-unit tasks may reference projects/groups that don't exist in the assignee's unit.

**Example**:
- Admin (Tech Unit) creates task in "Tech Infrastructure" project
- Assigns to John (IT Unit)
- John's dashboard doesn't have "Tech Infrastructure" bucket → orphaned task

**Solution**: Create a virtual bucket to catch these tasks.

**File**: `src/pages/Unit.tsx`

```typescript
// Detect orphaned/cross-unit tasks
const allBucketIds = new Set(uniqueBuckets.map(b => b.id));
const orphanedTasks = taskState.data?.filter(t => 
  // Orphan condition 1: Has projectId but bucket is missing
  (t.projectId && !allBucketIds.has(t.projectId) && t.projectId !== 'undefined') ||
  // Orphan condition 2: From another unit (cross-unit assignment)
  (t.unit_id && t.unit_id !== userContext.unit)
) || [];

if (orphanedTasks.length > 0) {
  // Add virtual "Shared Projects" bucket
  uniqueBuckets.push({
    id: 'shared-tasks-virtual',
    title: 'Shared Projects',
    isCustom: true
  });
}
```

**File**: `src/components/unit-tabs/TasksTab.tsx`

```typescript
tasks.forEach(task => {
  // Priority 0: External Unit Tasks (Shared)
  // Catch tasks from other units FIRST, even if they have no Project ID
  if (currentUnit && task.unit_id && task.unit_id !== currentUnit) {
    if (newBoardData['shared-tasks-virtual']) {
      newBoardData['shared-tasks-virtual'].push(task);
      return;
    }
  }

  // Priority 1: Explicit Group (Project ID) assignment
  if (task.projectId) {
    const projectBucket = activeBuckets.find(b => b.id === task.projectId);
    if (projectBucket && newBoardData[projectBucket.id]) {
      newBoardData[projectBucket.id].push(task);
      return;
    }

    // Fallback: Orphaned project (same unit, missing bucket)
    if (newBoardData['shared-tasks-virtual']) {
      newBoardData['shared-tasks-virtual'].push(task);
      return;
    }
  }

  // Priority 2: Status-based assignment (normal workflow)
  // ... (existing logic)
});
```

### Task Routing Priority

```
┌─────────────────────────────────────────────────────┐
│ Task Routing Decision Tree                         │
└─────────────────────────────────────────────────────┘

Task arrives → Check conditions in order:

1. ❓ Is task.unit_id !== currentUserUnit?
   └─ YES → Route to "Shared Projects" (cross-unit task)
   └─ NO  → Continue to step 2

2. ❓ Does task have projectId?
   └─ YES → Does projectId bucket exist?
      ├─ YES → Route to that project bucket
      └─ NO  → Route to "Shared Projects" (orphaned project)
   └─ NO  → Continue to step 3

3. 📊 Route by Status
   └─ Route to: "To Do" | "In Progress" | "Review" | "Done"
```

### Use Cases

#### Use Case 1: Cross-Unit Task Without Project

**Scenario:**
- Admin (Tech Unit) creates task "Server Maintenance"
- Assigns to John Sarwom (IT Unit)
- Does NOT select a project (generic task)

**Data:**
```json
{
  "title": "Server Maintenance",
  "unit_id": "Tech",
  "projectId": null,
  "assignees": [{"email": "jsarwom@scpng.gov.pg", "name": "John Sarwom"}]
}
```

**Behavior:**
1. ✅ Fetched by `getTasks` (no department filter)
2. ✅ Passes client filter (`isAssigned = true`)
3. ✅ `unit_id` ("Tech") ≠ John's unit ("IT")
4. ✅ Routed to **"Shared Projects"** bucket
5. ✅ John sees task on his dashboard

---

#### Use Case 2: Cross-Unit Task With Project

**Scenario:**
- Admin (Tech Unit) creates task "Update Documentation"
- Links to project "Tech Infrastructure" (id: `tech-infra-001`)
- Assigns to John Sarwom (IT Unit)

**Data:**
```json
{
  "title": "Update Documentation",
  "unit_id": "Tech",
  "projectId": "tech-infra-001",
  "assignees": [{"email": "jsarwom@scpng.gov.pg"}]
}
```

**Behavior:**
1. ✅ Fetched and passes client filter
2. ✅ `unit_id` ("Tech") ≠ John's unit ("IT")
3. ✅ Routed to **"Shared Projects"** (even though projectId exists)
4. ✅ John doesn't see "Tech Infrastructure" bucket (not his unit)
5. ✅ Virtual bucket prevents task from being lost

---

#### Use Case 3: Same-Unit Orphaned Task

**Scenario:**
- User creates task in "Finance Q1 Report" project
- Project gets deleted or hidden
- Task still assigned to user

**Data:**
```json
{
  "title": "Review Budget",
  "unit_id": "Finance",
  "projectId": "finance-q1",
  "assignees": [{"email": "user@scpng.gov.pg"}]
}
```

**Behavior:**
1. ✅ `unit_id` matches user's unit (not cross-unit)
2. ✅ `projectId` exists BUT bucket `finance-q1` not found
3. ✅ Routed to **"Shared Projects"** (orphaned fallback)
4. ✅ User can still see and complete task

### Visual Example

**Admin's View (Tech Unit)**
```
┌─────────────┬──────────────┬─────────────┐
│ Tech Infra  │ Things to Do │ Done        │
├─────────────┼──────────────┼─────────────┤
│ • Update    │ • Server     │             │
│   Docs      │   Maint.     │             │
│   [Assigned │              │             │
│   to John]  │              │             │
└─────────────┴──────────────┴─────────────┘
```

**John's View (IT Unit)**
```
┌──────────────┬──────────────┬──────────────┐
│ Shared       │ Urgent Tasks │ IT Support   │
│ Projects     │              │              │
├──────────────┼──────────────┼──────────────┤
│ • Update     │ • Fix Email  │ • Deploy     │
│   Docs       │   Server     │   Patch      │
│   (Tech)     │              │              │
│              │              │              │
│ • Server     │              │              │
│   Maint.     │              │              │
│   (Tech)     │              │              │
└──────────────┴──────────────┴──────────────┘
         ↑
    Virtual bucket for cross-unit tasks
```

### Configuration

**Props Required**: `TasksTab.tsx` requires `currentUnit` prop:

```tsx
<TasksTab
  tasks={taskState.data || []}
  // ... other props
  currentUnit={userContext?.unit} // ← Pass user's unit for filtering
/>
```

**Bucket Interface**: Updated to support virtual buckets:

```typescript
export interface Bucket {
  id: string;
  title: string;
  isCustom?: boolean; // ← Virtual buckets set this to true
}
```

### Testing Scenarios

**Test 1: Cross-Unit Assignment**
1. Login as Admin (Tech Unit)
2. Create task "Test Cross-Unit"
3. Assign to user from IT Unit
4. Do NOT select a project
5. ✅ Verify: IT Unit user sees task in "Shared Projects"

**Test 2: Orphaned Project Task**
1. Create task in "Project Alpha"
2. Delete "Project Alpha" bucket
3. ✅ Verify: Task moves to "Shared Projects" (not lost)

**Test 3: Virtual Bucket Visibility**
1. Login as user with NO cross-unit tasks
2. ✅ Verify: "Shared Projects" bucket does NOT appear
3. Assign a cross-unit task
4. Refresh dashboard
5. ✅ Verify: "Shared Projects" bucket appears dynamically

## Security Considerations

### Data Integrity

1. **SharePoint Author Field**: Cannot be spoofed; set automatically by SharePoint
2. **Client-Side Filtering**: Prevents accidental data leakage in UI
3. **Graph API Validation**: Creator email sourced from Microsoft's authentication

### Best Practices

- ✅ No custom "Creator" field needed in SharePoint schema
- ✅ Leverages built-in SharePoint security
- ✅ Filtering applied post-fetch (considers future server-side optimization)
- ✅ Case-insensitive comparisons prevent bypass attacks

## Edge Cases

### Orphaned Tasks
**Scenario**: Creator account deleted or email changed  
**Behavior**: 
- `createdByEmail` retains original value
- Task remains visible if user is assignee
- Admins can reassign or update

### No Creator Data
**Scenario**: Legacy tasks or Graph API failure  
**Behavior**:
- Falls back to `lastModifiedBy`
- If both unavailable: `createdBy = 'Unknown'`, `createdByEmail = ''`
- Task still visible if user is assignee

### Multiple Assignees
**Scenario**: Task assigned to team  
**Behavior**:
- Any assignee sees the task
- Creator sees the task even if not in assignees list
- All co-assignees are visible in task details

## Testing Checklist

### Basic Visibility Tests
- [ ] Staff member sees tasks they created (not assigned)
- [ ] Staff member sees tasks assigned to them (not creator)
- [ ] Staff member sees tasks where they are both creator and assignee
- [ ] Manager sees only their created/assigned tasks
- [ ] Admin sees all tasks
- [ ] "Created By" displays correct name in modal
- [ ] Case-insensitive email matching works
- [ ] Multiple assignees handled correctly

### Cross-Unit Visibility Tests
- [ ] User in Unit A assigned task by Unit B → sees task in "Shared Projects"
- [ ] Cross-unit task without projectId → routed to "Shared Projects"
- [ ] Cross-unit task with projectId → routed to "Shared Projects" (orphaned bucket)
- [ ] "Shared Projects" bucket only appears when orphaned tasks exist
- [ ] Same-unit orphaned task → routed to "Shared Projects"
- [ ] User with no cross-unit tasks → "Shared Projects" bucket hidden

## Related Documentation

- [KRA/KPI RBAC Implementation](./KRA_KPI_RBAC_IMPLEMENTATION.md) - Similar visibility patterns for KRAs/KPIs
- [Individual Data Filtering](./INDIVIDUAL_DATA_FILTERING.md) - General data filtering approach
- [RBAC Quick Start Guide](./rbac-quick-start-guide.md) - System-wide RBAC overview

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-10 | System | Initial implementation of creator/assignee visibility |
| 2026-02-10 | System | Added "Created By" display in Task Modal |
| 2026-02-10 | System | Implemented cross-unit task visibility with virtual "Shared Projects" bucket |
