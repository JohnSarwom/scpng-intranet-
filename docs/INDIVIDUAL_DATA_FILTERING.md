# Individual Data Filtering Documentation

## Overview

This document provides comprehensive documentation for the **Individual Data Filtering** feature implemented in the SCPNG Intranet system. This feature ensures that staff members only see data (KRAs, KPIs, Tasks, and Objectives) that is specifically assigned to them, while managers and administrators see all data within their division or unit scope.

---

## Table of Contents

1. [Background & Context](#background--context)
2. [System Architecture](#system-architecture)
3. [Data Storage Structure](#data-storage-structure)
4. [Filtering Logic](#filtering-logic)
5. [Implementation Details](#implementation-details)
6. [Role Hierarchy](#role-hierarchy)
7. [Testing Guide](#testing-guide)
8. [Troubleshooting](#troubleshooting)

---

## Background & Context

### Problem Statement

The SCPNG Intranet uses **shared SharePoint lists** for storing performance management data. All users (regardless of role or division) write to and read from the same lists:

- `Performance_KRAs` - Key Result Areas
- `Performance_KPIs` - Key Performance Indicators  
- `Unit_Tasks` - Tasks
- `Unit_Objectives` - Objectives

**Challenge**: How do we ensure staff members only see their assigned data while managers see all division/unit data?

### Solution Approach

**Frontend Filtration** - After fetching all data from SharePoint, apply client-side filtering based on:
1. User's role (`staff_member`, `manager`, `admin`)
2. Individual assignment fields in each data type

**Why Frontend Filtering?**
- ✅ Simpler implementation (no complex SharePoint OData queries)
- ✅ Faster performance (fetch once, filter in memory)
- ✅ More flexible (can combine multiple filter criteria)
- ✅ Better UX (instant filtering without server round-trips)

---

## System Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│           SharePoint Lists (Shared Storage)             │
│  - Performance_KRAs                                     │
│  - Performance_KPIs                                     │
│  - Unit_Tasks                                           │
│  - Unit_Objectives                                      │
└─────────────────────────────────────────────────────────┘
                          ↓
                 Microsoft Graph API
                          ↓
┌─────────────────────────────────────────────────────────┐
│         SharePointOpsService.ts (Backend Service)       │
│  - getKRAs()                                            │
│  - getKPIs()                                            │
│  - getTasks()                                           │
│  - getObjectives()                                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│         useSharePointOps.ts (React Hooks)               │
│  - useSharePointKRAs()    🔒 FILTERING HAPPENS HERE     │
│  - useSharePointKPIs()    🔒 FILTERING HAPPENS HERE     │
│  - useSharePointTasks()   🔒 FILTERING HAPPENS HERE     │
│  - useSharePointObjectives() 🔒 FILTERING HAPPENS HERE  │
└─────────────────────────────────────────────────────────┘
                          ↓
        ┌─────────────────┴─────────────────┐
        ↓                                   ↓
┌──────────────────┐              ┌──────────────────┐
│  Staff Member    │              │  Manager/Admin   │
│  (Filtered Data) │              │  (All Data)      │
└──────────────────┘              └──────────────────┘
```

### User Context Flow

```typescript
// 1. User logs in via Microsoft Authentication (MSAL)
const account = msalInstance.getActiveAccount();
const userEmail = account.username; // e.g., "john@scpng.com"

// 2. Fetch user role from SharePoint UserRoles list
const userRole = await userService.getUser(userEmail);
// Returns: { role_name: 'staff_member', division_name: 'Corporate Services', ... }

// 3. Create user context
const userContext = {
  email: userEmail,
  name: userRole.user_name,
  role: userRole.role_name,
  division: userRole.division_name,
  unit: userRole.unit_name
};

// 4. Pass context to data hooks
const { data: kras } = useSharePointKRAs(department, scope, userContext);
// Filtering happens inside the hook based on userContext.role
```

---

## Data Storage Structure

### SharePoint List Schemas

#### 1. Performance_KRAs
| Column Name | Type | Description |
|-------------|------|-------------|
| `Title` | Text | KRA title |
| `ResponsibleLookupId` | Number | Owner's user ID |
| `Assignees` | Text (JSON) | Array of assigned users `[{email, name}]` |
| `Department` | Text | Division or Unit name |

#### 2. Performance_KPIs
| Column Name | Type | Description |
|-------------|------|-------------|
| `Title` | Text | KPI name |
| `KRA_ID` | Number | Parent KRA ID |
| `Assignees` | Text (JSON) | Array of assigned users `[{email, name}]` |
| `Department` | Text | Division or Unit name |

#### 3. Unit_Tasks
| Column Name | Type | Description |
|-------------|------|-------------|
| `Title` | Text | Task title |
| `AssignedToLookupId` | Number | Assignee's user ID |
| `Department` | Text | Division or Unit name |

#### 4. Unit_Objectives
| Column Name | Type | Description |
|-------------|------|-------------|
| `Title` | Text | Objective title |
| `Owner` | Text | Owner's name |
| `OwnerEmail` | Text | Owner's email |
| `Department` | Text | Division or Unit name |

### TypeScript Interfaces

```typescript
export interface KRA {
  id: string | number;
  title: string;
  owner?: User | null;
  ownerId?: string | number | null;
  assignees?: User[];
  // ... other fields
}

export interface Kpi {
  id: string | number;
  name: string;
  kra_id?: string | number;
  assignees?: User[];
  // ... other fields
}

export interface Task {
  id: string;
  title: string;
  assignee: string;
  assignedTo?: string;
  // ... other fields
}

export interface Objective {
  id: string | number;
  title: string;
  owner?: string;
  ownerEmail?: string;
  // ... other fields
}

export interface UserContext {
  email: string;
  name: string;
  role: string; // 'staff_member', 'manager', 'admin', 'super_admin'
  division?: string;
  unit?: string;
}
```

---

## Filtering Logic

### Filtration Metrics by Entity

| Entity | SharePoint Field | Frontend Filter Field | Filter Condition |
|--------|------------------|----------------------|------------------|
| **KRAs** | `ResponsibleLookupId` | `owner.email` or `ownerId` | Email or ID match |
| **KPIs** | `Assignees` (JSON array) | `assignees[]` | Array contains user email |
| **Tasks** | `AssignedToLookupId` | `assignedTo` | Email match |
| **Objectives** | `Owner`, `OwnerEmail` | `owner` or `ownerEmail` | Name or email match |

### Filter Implementation

#### KRAs Filter
```typescript
// File: src/hooks/useSharePointOps.ts
// Lines: 153-169

const isStaff = context?.role === 'staff_member';
const isAdmin = context?.role === 'admin' || context?.role === 'super_admin';

if (isStaff && !isAdmin && context?.email) {
    krasWithKpis = krasWithKpis.filter(kra => {
        // Filter by owner email or owner ID
        const ownerMatch = kra.owner?.email?.toLowerCase() === context.email.toLowerCase() ||
                         String(kra.ownerId) === String(context.email);
        
        if (ownerMatch) {
            console.log(`✅ [Individual Filter] Staff ${context.email} sees KRA: ${kra.title}`);
        }
        return ownerMatch;
    });
    console.log(`🔒 [Individual Filter] Filtered KRAs for staff ${context.email}: ${krasWithKpis.length} items`);
}
```

#### KPIs Filter
```typescript
// File: src/hooks/useSharePointOps.ts
// Lines: 246-258

if (isStaff && !isAdmin && context?.email) {
    data = data.filter(kpi => {
        // Check if user is in assignees array
        const isAssigned = kpi.assignees?.some(assignee => 
            assignee.email?.toLowerCase() === context.email.toLowerCase()
        );
        
        if (isAssigned) {
            console.log(`✅ [Individual Filter] Staff ${context.email} sees KPI: ${kpi.name}`);
        }
        return isAssigned;
    });
    console.log(`🔒 [Individual Filter] Filtered KPIs for staff ${context.email}: ${data.length} items`);
}
```

#### Tasks Filter
```typescript
// File: src/hooks/useSharePointOps.ts
// Lines: 357-375

if (isStaff && !isAdmin && context?.email) {
    data = data.filter(task => {
        // Filter by assignedTo email
        const isAssigned = task.assignedTo?.toLowerCase() === context.email.toLowerCase();
        
        if (isAssigned) {
            console.log(`✅ [Individual Filter] Staff ${context.email} sees Task: ${task.title}`);
        }
        return isAssigned;
    });
    console.log(`🔒 [Individual Filter] Filtered Tasks for staff ${context.email}: ${data.length} items`);
}
```

#### Objectives Filter
```typescript
// File: src/hooks/useSharePointOps.ts
// Lines: 62-80

if (isStaff && !isAdmin && context?.email) {
    data = data.filter(obj => {
        // Filter by owner name or email
        const ownerMatch = obj.owner?.toLowerCase() === context.name?.toLowerCase() ||
                         obj.ownerEmail?.toLowerCase() === context.email.toLowerCase();
        
        if (ownerMatch) {
            console.log(`✅ [Individual Filter] Staff ${context.email} sees Objective: ${obj.title}`);
        }
        return ownerMatch;
    });
    console.log(`🔒 [Individual Filter] Filtered Objectives for staff ${context.email}: ${data.length} items`);
}
```

---

## Implementation Details

### Modified Files

#### 1. [useSharePointOps.ts](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/hooks/useSharePointOps.ts)

**Changes Made:**
- Updated `useSharePointKRAs()` hook (lines 124-209)
- Updated `useSharePointKPIs()` hook (lines 211-275)
- Updated `useSharePointTasks()` hook (lines 306-370)
- Updated `useSharePointObjectives()` hook (lines 31-122)

**Key Additions:**
1. Role detection logic
2. Client-side filtering for staff members
3. Console logging for debugging
4. Updated query keys to include `context.email` and `context.role`

### No Changes Required

The following files **do not require changes** because filtering happens at the hook level:

- ✅ `SharePointOpsService.ts` - Backend service unchanged
- ✅ `Unit.tsx` - Page component unchanged
- ✅ `KRAsTab.tsx` - UI component unchanged
- ✅ `TasksTab.tsx` - UI component unchanged

---

## Role Hierarchy

### Role Definitions

| Role | `role_name` Value | Data Access | Use Case |
|------|------------------|-------------|----------|
| **Staff Member** | `'staff_member'` | Only assigned items | Regular employees |
| **Manager** | `'manager'` | All division/unit items | Team leads, supervisors |
| **Admin** | `'admin'` | All items (no filtering) | Department heads |
| **Super Admin** | `'super_admin'` | All items (no filtering) | System administrators |

### Role Detection Logic

```typescript
const isStaff = context?.role === 'staff_member';
const isAdmin = context?.role === 'admin' || context?.role === 'super_admin';

if (isStaff && !isAdmin && context?.email) {
    // Apply individual filtering
} else {
    // Show all data (manager/admin)
}
```

### Division/Unit Context

**Staff members do NOT need division/unit filtering** because:
1. Individual assignment already implies division/unit membership
2. If a manager assigns a KRA to a staff member in Division A, that staff is already in Division A
3. Simpler logic = fewer bugs

**Managers and Admins** still use division/unit filtering (existing behavior):
- Controlled by `scope` parameter: `'Division'` or `'Unit'`
- Filtered by `Department` field in SharePoint

---

## Testing Guide

### Prerequisites

1. **Test Accounts**: Create test users in SharePoint `UserRoles` list with different roles:
   - `staff1@scpng.com` - `role_name: 'staff_member'`
   - `manager1@scpng.com` - `role_name: 'manager'`
   - `admin1@scpng.com` - `role_name: 'admin'`

2. **Test Data**: Create sample KRAs, KPIs, Tasks, and Objectives assigned to different users

### Test Scenarios

#### Scenario 1: Staff Member Login

**Steps:**
1. Login as `staff1@scpng.com`
2. Navigate to Unit page → KRAs & Objectives tab
3. Open browser console (F12)

**Expected Results:**
- ✅ Only see KRAs where `owner.email = staff1@scpng.com`
- ✅ Only see KPIs where `assignees` includes `staff1@scpng.com`
- ✅ Console shows: `🔒 [Individual Filter] Filtered KRAs for staff staff1@scpng.com: X items`

**Console Output Example:**
```
✅ [useSharePointOps] Loaded KRAs: 15
✅ [Individual Filter] Staff staff1@scpng.com sees KRA: Improve Sales
✅ [Individual Filter] Staff staff1@scpng.com sees KRA: Customer Service
🔒 [Individual Filter] Filtered KRAs for staff staff1@scpng.com: 2 items
```

#### Scenario 2: Manager Login

**Steps:**
1. Login as `manager1@scpng.com`
2. Navigate to Unit page

**Expected Results:**
- ✅ See ALL KRAs, KPIs, Tasks, Objectives for their division/unit
- ✅ No individual filter logs in console
- ✅ Data count matches total items in division/unit

**Console Output Example:**
```
✅ [useSharePointOps] Loaded KRAs: 15
✅ [useSharePointOps] Loaded KPIs: 45
✅ [useSharePointOps] Loaded Tasks: 120
```

#### Scenario 3: Admin Login

**Steps:**
1. Login as `admin1@scpng.com`
2. Navigate to Unit page

**Expected Results:**
- ✅ See ALL data across all divisions/units
- ✅ No filtering applied
- ✅ No individual filter logs

#### Scenario 4: Data Leakage Test

**Steps:**
1. Login as `staff1@scpng.com`
2. Create a KRA assigned to `staff2@scpng.com`
3. Refresh the page

**Expected Results:**
- ❌ Staff1 should NOT see the KRA assigned to Staff2
- ✅ Only Staff2 sees their assigned KRA

### Verification Checklist

- [ ] Staff members only see their assigned KRAs
- [ ] Staff members only see KPIs where they are in assignees
- [ ] Staff members only see tasks assigned to them
- [ ] Staff members only see objectives they own
- [ ] Managers see all division/unit data
- [ ] Admins see all data (no filtering)
- [ ] No data leakage between staff members
- [ ] Console logs show correct filtering counts
- [ ] Performance is acceptable (no lag)

---

## Troubleshooting

### Issue: Staff Member Sees No Data

**Possible Causes:**
1. User's email in `UserRoles` doesn't match email in assignment fields
2. No items are actually assigned to the user
3. Assignment fields are empty or malformed

**Debug Steps:**
1. Check console for filter logs: `🔒 [Individual Filter] Filtered KRAs for staff...`
2. Verify user's email in `UserRoles` list matches exactly (case-insensitive)
3. Check SharePoint list to confirm items are assigned to the user
4. Verify `owner.email`, `assignees`, `assignedTo` fields are populated

**Solution:**
```typescript
// Add debug logging before filtering
console.log('User email:', context.email);
console.log('KRAs before filter:', krasWithKpis.map(k => ({ 
  title: k.title, 
  ownerEmail: k.owner?.email 
})));
```

### Issue: Staff Member Sees Other Users' Data

**Possible Causes:**
1. User role is not `'staff_member'` (check `UserRoles` list)
2. Filtering logic is not being applied
3. Email comparison is failing (case sensitivity, whitespace)

**Debug Steps:**
1. Check console for role detection: `const isStaff = context?.role === 'staff_member'`
2. Verify `context.role` value in browser console
3. Check if filtering block is being entered

**Solution:**
```typescript
// Add debug logging
console.log('User role:', context?.role);
console.log('Is staff?', isStaff);
console.log('Is admin?', isAdmin);
console.log('Should filter?', isStaff && !isAdmin && context?.email);
```

### Issue: Manager Sees Filtered Data

**Possible Causes:**
1. Manager's role is set to `'staff_member'` instead of `'manager'`
2. Role detection logic is incorrect

**Debug Steps:**
1. Check `UserRoles` SharePoint list for manager's role
2. Verify `context.role` in browser console

**Solution:**
Update user's role in `UserRoles` list to `'manager'`

### Issue: Performance Degradation

**Possible Causes:**
1. Too many items being fetched (1000+ items)
2. Filtering is slow due to complex logic
3. Multiple re-renders

**Debug Steps:**
1. Check network tab for API response times
2. Check console for item counts: `Loaded KRAs: X`
3. Profile React component renders

**Solution:**
```typescript
// Add useMemo for expensive filtering
const filteredKRAs = useMemo(() => {
  if (isStaff && !isAdmin && context?.email) {
    return krasWithKpis.filter(/* ... */);
  }
  return krasWithKpis;
}, [krasWithKpis, isStaff, isAdmin, context?.email]);
```

### Issue: Console Logs Not Appearing

**Possible Causes:**
1. Console is filtered (check console filter settings)
2. Data is being cached (no refetch happening)
3. Filtering logic is not being executed

**Debug Steps:**
1. Clear browser cache and refresh
2. Check React Query DevTools for cache status
3. Force refetch: `query.refetch()`

---

## Best Practices

### For Managers Assigning Data

1. **Always set owner/assignee fields** when creating KRAs, KPIs, Tasks, or Objectives
2. **Use correct email format** matching the user's Microsoft account
3. **Verify assignments** by logging in as the staff member to test

### For Developers

1. **Always pass `userContext`** to SharePoint hooks
2. **Include `context.email` and `context.role`** in query keys for proper cache invalidation
3. **Add console logging** for debugging filter logic
4. **Test with multiple roles** before deploying

### For System Administrators

1. **Ensure `UserRoles` list is up to date** with correct role assignments
2. **Use consistent email formats** across all SharePoint lists
3. **Monitor console logs** for filtering issues in production

---

## Future Enhancements

### Potential Improvements

1. **Server-Side Filtering** (Optional)
   - Implement OData filters in SharePoint queries
   - Reduce data transfer for large datasets
   - Trade-off: More complex queries, potential performance issues

2. **Caching Optimization**
   - Cache filtered results separately for staff vs managers
   - Reduce re-filtering on component re-renders

3. **Audit Logging**
   - Log when staff members access their data
   - Track data access patterns for compliance

4. **Bulk Assignment UI**
   - Admin interface to assign multiple items to staff at once
   - Verify assignments before saving

---

## Related Documentation

- [SharePoint Operations Service](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/services/sharePointOpsService.ts)
- [User Role Management](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/services/userSharePointService.ts)
- [Role-Based Authentication](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/hooks/useRoleBasedAuth.ts)

---

## Changelog

### Version 1.0 (2026-02-05)
- ✅ Initial implementation of individual data filtering
- ✅ Added filtering for KRAs, KPIs, Tasks, and Objectives
- ✅ Role-based access control (staff, manager, admin)
- ✅ Console logging for debugging
- ✅ Comprehensive documentation

---

## Support

For questions or issues related to individual data filtering:
1. Check console logs for filter debug messages
2. Verify user roles in SharePoint `UserRoles` list
3. Review this documentation for troubleshooting steps
4. Contact the development team for assistance
