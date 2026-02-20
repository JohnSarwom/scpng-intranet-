# Strategy Page — Division Hierarchy Architecture

> **Document Version:** 1.0  
> **Last Updated:** 2026-02-20  
> **Scope:** Full end-to-end documentation of how the Strategy page's "Division Alignment & KRAs" section works — from SharePoint data source, through the service/hook layers, to the rendered accordion UI.

---

## Table of Contents

1. [Overview](#1-overview)
2. [High-Level Architecture (ASCII)](#2-high-level-architecture)
3. [Organizational Structure](#3-organizational-structure)
4. [Data Pipeline — End to End](#4-data-pipeline--end-to-end)
   - 4.1 [SharePoint Data Source](#41-sharepoint-data-source)
   - 4.2 [Service Layer — SharePointOpsService](#42-service-layer--sharepointopsservice)
   - 4.3 [Hook Layer — useSharePointObjectives](#43-hook-layer--usesharepointobjectives)
   - 4.4 [Page Layer — Strategy.tsx useMemo](#44-page-layer--strategytsx-usememo)
   - 4.5 [Metadata Lookup — getDivisionMeta](#45-metadata-lookup--getdivisionmeta)
   - 4.6 [Rendering — Nested Accordion](#46-rendering--nested-accordion)
5. [Data Entry — Objective Modal Pre-fill](#5-data-entry--objective-modal-pre-fill)
6. [Hybrid Scaffold Strategy](#6-hybrid-scaffold-strategy)
7. [Fuzzy Matching & Fallback Logic](#7-fuzzy-matching--fallback-logic)
8. [Integration with Existing Systems](#8-integration-with-existing-systems)
9. [Data Type Definitions](#9-data-type-definitions)
10. [Debugging & Console Logs](#10-debugging--console-logs)
11. [Future Considerations](#11-future-considerations)

---

## 1. Overview

The Strategy page is the central hub for displaying the organization's strategic direction. The **"Division Alignment & KRAs"** section provides a cascading view of operational execution:

```
Division → Unit → Key Deliverable → Objectives
```

This hierarchy is built dynamically from live SharePoint data (the `Unit_Objectives` list), scaffolded by a hardcoded organizational structure to guarantee completeness even when SharePoint data is sparse.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           STRATEGY PAGE HIERARCHY                               │
│                        Full Data Flow (End-to-End)                               │
└─────────────────────────────────────────────────────────────────────────────────┘

  ┌────────────────────┐
  │   SHAREPOINT SITE  │   Cloud / Microsoft 365
  │  scpng1.sharepoint │
  │  .com/sites/       │
  │  scpngintranet     │
  └────────┬───────────┘
           │
           │  Microsoft Graph API
           │  GET /sites/{siteId}/lists/{Unit_Objectives}/items
           │  ?expand=fields&$top=500
           │
  ┌────────▼───────────────────────────────────────────────────────────────────┐
  │                                                                           │
  │   SERVICE LAYER — sharePointOpsService.ts                                 │
  │                                                                           │
  │   ┌─────────────────────┐     ┌──────────────────────────────────────┐    │
  │   │ OPS_CONFIG.LISTS    │     │ getObjectives(scope, context)        │    │
  │   │ OBJECTIVES:         │────►│  → Fetches from Unit_Objectives list │    │
  │   │ 'Unit_Objectives'   │     │  → Calls mapObjective()             │    │
  │   └─────────────────────┘     │  → Returns Objective[]              │    │
  │                               └────────────────┬─────────────────────┘    │
  │                                                │                          │
  │   ┌────────────────────────────────────────────▼─────────────────────┐    │
  │   │ mapObjective(item)                                               │    │
  │   │  → item.fields.Title        → obj.title                         │    │
  │   │  → item.fields.Division     → obj.division    ◄── KEY FIELD     │    │
  │   │  → item.fields.Unit         → obj.unit         ◄── KEY FIELD    │    │
  │   │  → item.fields.GoalType     → obj.goalType                      │    │
  │   │  → item.fields.Owner        → obj.owner                         │    │
  │   │  → item.fields.LinkedDeliverable → obj.linkedDeliverable        │    │
  │   │  → item.fields.Status       → obj.status                        │    │
  │   │  → item.fields.Progress     → obj.progress                      │    │
  │   └──────────────────────────────────────────────────────────────────┘    │
  │                                                                           │
  └───────────────────────────────────────┬───────────────────────────────────┘
                                          │
                                          │  Returns Objective[]
                                          │
  ┌───────────────────────────────────────▼───────────────────────────────────┐
  │                                                                           │
  │   HOOK LAYER — useSharePointOps.ts                                        │
  │                                                                           │
  │   useSharePointObjectives(department?, scope, context?)                    │
  │                                                                           │
  │   ┌────────────────────────────────────────────────────────────────┐      │
  │   │ Called from Strategy.tsx with:                                  │      │
  │   │   scope = 'All'                                                │      │
  │   │   context = { role: 'super_admin', ... }   ◄── ADMIN BYPASS   │      │
  │   │                                                                │      │
  │   │ React Query caching:                                           │      │
  │   │   queryKey: ['sharePoint','objectives', dept, scope, ...]      │      │
  │   │                                                                │      │
  │   │ Role-based filtering:                                          │      │
  │   │   super_admin/admin → sees ALL objectives                      │      │
  │   │   staff_member     → sees ONLY owned objectives                │      │
  │   └────────────────────────────────────────────────────────────────┘      │
  │                                                                           │
  └───────────────────────────────────────┬───────────────────────────────────┘
                                          │
                                          │  { data: allUnitObjectives, loading }
                                          │
  ┌───────────────────────────────────────▼───────────────────────────────────┐
  │                                                                           │
  │   PAGE LAYER — Strategy.tsx                                               │
  │                                                                           │
  │   ┌─────────────────────────────────────────────────────────────────┐     │
  │   │  ORG_STRUCTURE (Hardcoded Scaffold)                             │     │
  │   │  ┌─────────────────────────────────────────────────────────┐    │     │
  │   │  │ 'Office of the Chairman'     → ['Executive Division']   │    │     │
  │   │  │ 'Executive Division'         → ['Secretariat Unit']     │    │     │
  │   │  │ 'Corporate Services Division'→ ['Finance','IT','HR']    │    │     │
  │   │  │ 'Licensing, Market & Supv.'  → ['Licensing','Supv',..] │    │     │
  │   │  │ 'Legal Services Division'    → ['Legal Advisory Unit']  │    │     │
  │   │  │ 'Research & Publication Div.'→ ['Research','Publication']│    │     │
  │   │  └─────────────────────────────────────────────────────────┘    │     │
  │   └────────────────────────────────────────────────────┬────────────┘     │
  │                                                        │                  │
  │   ┌────────────────────────────────────────────────────▼────────────┐     │
  │   │  useMemo → divisionHierarchy                                    │     │
  │   │                                                                 │     │
  │   │  1. Pre-seed hierarchy from ORG_STRUCTURE                       │     │
  │   │  2. Filter objectives (exclude org/strategic/board goalTypes)    │     │
  │   │  3. For each objective:                                         │     │
  │   │     ├── Read obj.division, obj.unit, obj.linkedDeliverable      │     │
  │   │     ├── Fuzzy-match unit → division (if division is empty)      │     │
  │   │     ├── Fallback to 'General' if still unknown                  │     │
  │   │     └── Push into hierarchy[div][unit][deliverable]             │     │
  │   │  4. Return complete hierarchy object                            │     │
  │   │                                                                 │     │
  │   │  Output Type:                                                   │     │
  │   │  Record<Division, Record<Unit, Record<Deliverable, Objective[]>>>│     │
  │   └────────────────────────────────────────────────────┬────────────┘     │
  │                                                        │                  │
  │   ┌────────────────────────────────────────────────────▼────────────┐     │
  │   │  getDivisionMeta(divisionName)                                  │     │
  │   │                                                                 │     │
  │   │  Provides icon + director label for each division.              │     │
  │   │  Uses keyword matching (case-insensitive .includes())           │     │
  │   │                                                                 │     │
  │   │  'Chairman'          → Award icon,  'Chairman'                  │     │
  │   │  'Executive'         → Target icon, 'Executive Director'       │     │
  │   │  'Legal Services'    → ShieldCheck, 'Director Legal Services'  │     │
  │   │  'Licensing'         → Zap icon,    'Director LMS'             │     │
  │   │  'Research'          → GraduationCap,'Director R&P'            │     │
  │   │  'Corporate Services'→ Building2,   'Director Corp. Services'  │     │
  │   │  default fallback    → LayoutDashboard, 'Division Director'    │     │
  │   └────────────────────────────────────────────────────┬────────────┘     │
  │                                                        │                  │
  └────────────────────────────────────────────────────────┼──────────────────┘
                                                           │
  ┌────────────────────────────────────────────────────────▼──────────────────┐
  │                                                                           │
  │   RENDERING — Nested Accordion (4 Levels)                                 │
  │                                                                           │
  │   ┌─────────────────────────────────────────────────────────────────────┐ │
  │   │ Level 1: DIVISION ACCORDION                                         │ │
  │   │ ┌─────────────────────────────────────────────────────────────────┐ │ │
  │   │ │  [Icon] Corporate Services Division                             │ │ │
  │   │ │  Director Corporate Services    3 units · 5 objectives          │ │ │
  │   │ │                                                                 │ │ │
  │   │ │  Level 2: UNIT ACCORDION                                        │ │ │
  │   │ │  ┌────────────────────────────────────────────────────────────┐  │ │ │
  │   │ │  │  [Users] Finance Unit         2 objectives                 │  │ │ │
  │   │ │  │                                                            │  │ │ │
  │   │ │  │  Level 3: KEY DELIVERABLE                                  │  │ │ │
  │   │ │  │  ┌─────────────────────────────────────────────────────┐   │  │ │ │
  │   │ │  │  │  [Target] "Budget Management Review"                │   │  │ │ │
  │   │ │  │  │                                                     │   │  │ │ │
  │   │ │  │  │  Level 4: OBJECTIVES                                │   │  │ │ │
  │   │ │  │  │  ┌──────────────────────────────────────────────┐   │   │  │ │ │
  │   │ │  │  │  │  > "Complete Q1 budget audit" [In Progress]  │   │   │  │ │ │
  │   │ │  │  │  │    Division Level                            │   │   │  │ │ │
  │   │ │  │  │  │  > "Implement cost tracking" [Not Started]   │   │   │  │ │ │
  │   │ │  │  │  │    Unit Level                                │   │   │  │ │ │
  │   │ │  │  │  └──────────────────────────────────────────────┘   │   │  │ │ │
  │   │ │  │  └─────────────────────────────────────────────────────┘   │  │ │ │
  │   │ │  └────────────────────────────────────────────────────────────┘  │ │ │
  │   │ └─────────────────────────────────────────────────────────────────┘ │ │
  │   └─────────────────────────────────────────────────────────────────────┘ │
  │                                                                           │
  └───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Organizational Structure

The Securities Commission of Papua New Guinea (SCPNG) has the following structure. This is hardcoded as a scaffold in `Strategy.tsx`:

```
Securities Commission of Papua New Guinea (SCPNG)
│
├── Office of the Chairman
│   └── Executive Division
│
├── Executive Division
│   └── Secretariat Unit
│
├── Corporate Services Division
│   ├── Finance Unit
│   ├── IT Unit
│   └── Human Resource Unit
│
├── Licensing, Market & Supervision Division
│   ├── Licensing Unit
│   ├── Supervision Unit
│   ├── Market Data Unit
│   └── Investigations Unit
│
├── Legal Services Division
│   └── Legal Advisory Unit
│
└── Research & Publication Division
    ├── Research Unit
    └── Publication Unit
```

### Source of Truth

```
File: src/pages/Strategy.tsx
Lines: 226–233 (ORG_STRUCTURE constant)
```

```typescript
const ORG_STRUCTURE: Record<string, string[]> = {
    'Office of the Chairman': ['Executive Division'],
    'Executive Division': ['Secretariat Unit'],
    'Corporate Services Division': ['Finance Unit', 'IT Unit', 'Human Resource Unit'],
    'Licensing, Market & Supervision Division': ['Licensing Unit', 'Supervision Unit', 'Market Data Unit', 'Investigations Unit'],
    'Legal Services Division': ['Legal Advisory Unit'],
    'Research & Publication Division': ['Research Unit', 'Publication Unit']
};
```

---

## 4. Data Pipeline — End to End

### 4.1 SharePoint Data Source

| Property         | Value                                           |
|------------------|-------------------------------------------------|
| **Site**         | `scpng1.sharepoint.com/sites/scpngintranet`     |
| **List Name**    | `Unit_Objectives`                                |
| **Config Key**   | `OPS_CONFIG.LISTS.OBJECTIVES`                    |
| **API Endpoint** | `GET /sites/{siteId}/lists/{listId}/items`       |

#### Key SharePoint Columns

| SharePoint Column      | Maps To (TypeScript)       | Purpose                           |
|------------------------|----------------------------|-----------------------------------|
| `Title`                | `obj.title`                | Objective name                    |
| `Description`          | `obj.description`          | Objective description             |
| **`Division`**         | **`obj.division`**         | **Division name for grouping**    |
| **`Unit`**             | **`obj.unit`**             | **Unit name for grouping**        |
| `GoalType`             | `obj.goalType`             | Level: Division, Unit, Strategic  |
| `Owner`                | `obj.owner`                | Responsible person                |
| `LinkedDeliverable`    | `obj.linkedDeliverable`    | Key Deliverable text              |
| `Status`               | `obj.status`               | Current status                    |
| `Progress`             | `obj.progress`             | Percentage (0–100)                |
| `Year`                 | `obj.year`                 | Fiscal year                       |
| `ParentGoalIdLookupId` | `obj.parentGoalId`         | Parent objective reference        |

> **Critical**: The `Division` and `Unit` columns are what drive the hierarchy grouping. If these are empty on a SharePoint item, the objective falls into a "General" bucket.

---

### 4.2 Service Layer — SharePointOpsService

```
File: src/services/sharePointOpsService.ts
```

#### Config (Lines 12–27)

```typescript
const OPS_CONFIG = {
    SITE_DOMAIN: 'scpng1.sharepoint.com',
    SITE_PATH: '/sites/scpngintranet',
    LISTS: {
        OBJECTIVES: 'Unit_Objectives',    // ← This is the list
        KRAS: 'Performance_KRAs',
        KPIS: 'Performance_KPIs',
        TASKS: 'Operations_Tasks',
        PROJECTS: 'Operations_Projects',
        ...
    }
};
```

#### getObjectives() Method

```
Fetches all items from Unit_Objectives via Microsoft Graph API.
Applies scope-based filtering (All, Division, Unit, Individual).
Maps each raw SharePoint item through mapObjective().
```

#### mapObjective() (Lines 824–846)

This is the **field mapping** function that transforms raw SharePoint `item.fields` into typed `Objective` objects:

```typescript
private mapObjective(item: any): Objective {
    const f = item.fields;
    return {
        id:                 item.id,
        title:              f.Title,
        description:        f.Description || '',
        status:             f.Status,
        progress:           f.Progress,
        year:               f.Year,
        goalType:           f.GoalType,
        division:           f.Division,          // ◄── KEY: Maps directly from SP column
        unit:               f.Unit,              // ◄── KEY: Maps directly from SP column
        owner:              f.Owner,
        parentGoalId:       f.ParentGoalIdLookupId,
        parentGoalTitle:    f.ParentGoalIdLookupValue,
        linkedDeliverable:  f.LinkedDeliverable  // ◄── Used for "Key Deliverable" grouping
    };
}
```

---

### 4.3 Hook Layer — useSharePointObjectives

```
File: src/hooks/useSharePointOps.ts
Lines: 31–78
```

#### Signature

```typescript
export function useSharePointObjectives(
    department?: string,
    scope: FilterScope = 'Division',
    context?: UserContext
)
```

#### How Strategy.tsx Calls It

```typescript
// In Strategy.tsx (lines 217–221):
const { data: allUnitObjectives, loading: isLoadingHierarchy } = useSharePointObjectives(
    undefined,       // No department filter
    'All',           // Fetch ALL objectives across all divisions
    {                // Admin bypass context
        division: '', unit: '', email: '', name: '',
        role: 'super_admin'   // ◄── Bypasses individual filtering
    }
);
```

#### Role-Based Filtering Logic

```
┌──────────────────────────────────────────┐
│       useSharePointObjectives            │
│                                          │
│  context.role === 'super_admin'?         │
│       │                                  │
│       ├── YES → Return ALL objectives    │
│       │         (no filtering)           │
│       │                                  │
│       └── NO (staff_member) →            │
│           Filter by owner match:         │
│           obj.owner === context.name     │
│           OR                             │
│           obj.ownerEmail === context.email│
│                                          │
└──────────────────────────────────────────┘
```

> **Note:** The Strategy page always uses `super_admin` context to show the full organizational view. Individual pages (Unit tabs) use the actual user's context for scope-restricted views.

---

### 4.4 Page Layer — Strategy.tsx useMemo

```
File: src/pages/Strategy.tsx
Lines: 237–292
```

This is the **core hierarchy builder**. It uses a **Hybrid Scaffold** approach:

```
Step 1: Pre-seed hierarchy from ORG_STRUCTURE
        ┌─────────────────────────────────────────────┐
        │  hierarchy = {                               │
        │    'Corp Services Div': {                    │
        │      'Finance Unit': {},                     │
        │      'IT Unit': {},                          │
        │      'HR Unit': {}                           │
        │    },                                        │
        │    'Legal Services Div': {                   │
        │      'Legal Advisory Unit': {}               │
        │    },                                        │
        │    ...                                       │
        │  }                                           │
        └─────────────────────────────────────────────┘

Step 2: Filter objectives (exclude org/strategic/board types)
        ┌─────────────────────────────────────────────┐
        │  allUnitObjectives                           │
        │    .filter(goalType !== 'org')                │
        │    .filter(goalType !== 'strategic')          │
        │    .filter(goalType !== 'board')              │
        │  = unitObjs                                  │
        └─────────────────────────────────────────────┘

Step 3: For each objective, place into hierarchy
        ┌─────────────────────────────────────────────┐
        │  obj.division → div                          │
        │  obj.unit     → unit                         │
        │  obj.linkedDeliverable → deliverable         │
        │                                              │
        │  if div is empty AND unit exists:             │
        │    → fuzzy match unit against ORG_STRUCTURE   │
        │    → infer division from unit                 │
        │                                              │
        │  if still empty: fallback to 'General'        │
        │                                              │
        │  hierarchy[div][unit][deliverable].push(obj)  │
        └─────────────────────────────────────────────┘

Step 4: Return hierarchy (never null — scaffold ensures structure)
```

#### Output Data Shape

```typescript
type DivisionHierarchy = Record<
    string,                      // Division name
    Record<
        string,                  // Unit name
        Record<
            string,              // Key Deliverable text
            Objective[]          // Objectives under this deliverable
        >
    >
>;
```

---

### 4.5 Metadata Lookup — getDivisionMeta

```
File: src/pages/Strategy.tsx
Lines: 378–391
```

Maps division names to UI metadata (icons and director titles) using keyword matching:

```typescript
const getDivisionMeta = (divName: string) => {
    const patterns = [
        { key: 'Chairman',          director: 'Chairman',                    icon: Award },
        { key: 'Executive',         director: 'Executive Director',          icon: Target },
        { key: 'Legal Services',    director: 'Director Legal Services',     icon: ShieldCheck },
        { key: 'Licensing',         director: 'Director LMS',               icon: Zap },
        { key: 'Research',          director: 'Director R&P',               icon: GraduationCap },
        { key: 'Corporate Services',director: 'Director Corporate Services', icon: Building2 },
        { key: 'Secretariat',       director: 'General Counsel / Mgr Audit', icon: Shield },
    ];
    const lower = divName.toLowerCase();
    const match = patterns.find(p => lower.includes(p.key.toLowerCase()));
    return match ?? { director: 'Division Director', icon: LayoutDashboard };
};
```

#### Match Table

| Division Name (ORG_STRUCTURE)            | Matched Key        | Icon         | Director Label               |
|------------------------------------------|--------------------|--------------|------------------------------|
| Office of the Chairman                   | `Chairman`         | `Award`      | Chairman                     |
| Executive Division                       | `Executive`        | `Target`     | Executive Director            |
| Corporate Services Division              | `Corporate Services`| `Building2` | Director Corporate Services   |
| Licensing, Market & Supervision Division | `Licensing`        | `Zap`        | Director LMS                  |
| Legal Services Division                  | `Legal Services`   | `ShieldCheck`| Director Legal Services       |
| Research & Publication Division          | `Research`         | `GraduationCap`| Director R&P               |

---

### 4.6 Rendering — Nested Accordion

```
File: src/pages/Strategy.tsx
Lines: 701–843
```

The hierarchy is rendered using the shadcn/ui `<Accordion>` component in 4 nested levels:

```
<Accordion>  ←────── Level 1: Divisions
│
├── <AccordionItem>
│   ├── <AccordionTrigger>
│   │     [DivIcon]  Division Name
│   │     Director Title    X units · Y objectives
│   │
│   └── <AccordionContent>
│       │
│       └── <Accordion>  ←────── Level 2: Units
│           │
│           ├── <AccordionItem>
│           │   ├── <AccordionTrigger>
│           │   │     [Users]  Unit Name    Z objectives
│           │   │
│           │   └── <AccordionContent>
│           │       │
│           │       ├── Key Deliverable Header  ←── Level 3: Key Deliverables
│           │       │   [Target] "Deliverable Text"
│           │       │
│           │       └── Objectives List  ←── Level 4: Objectives
│           │           ├── > "Objective Title"  [Status Badge]
│           │           │     Description (if present)
│           │           │     GoalType Level
│           │           │
│           │           └── > "Another Objective"  [Status Badge]
│           │
│           └── <AccordionItem>
│               └── ...
│
└── <AccordionItem>
    └── ...
```

#### Status Badge Color Logic

| Status                      | Badge Class                              |
|-----------------------------|------------------------------------------|
| `completed`                 | `bg-green-100 text-green-700`            |
| `in progress` / `in-progress` | `bg-blue-100 text-blue-700`           |
| Everything else             | `bg-gray-100 text-gray-600`              |

---

## 5. Data Entry — Objective Modal Pre-fill

```
File: src/components/unit-tabs/KRAsTab.tsx
Lines: 679–700
```

When a user opens the "Add New Objective" modal, the form fields are **automatically pre-filled** from their user context (the same data shown in the avatar dropdown in the top-right navigation).

### Data Flow for Pre-fill

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  User Profile Data  │     │    userContext Prop   │     │  Modal Form State   │
│  (Employee_Profiles │────►│  (Passed to KRAsTab) │────►│  (newObjectiveData) │
│   SP List / Auth)   │     │                      │     │                     │
│                     │     │  .division            │     │  .division          │
│  division: "CSD"    │     │  .unit                │     │  .unit              │
│  unit: "IT Unit"    │     │  .name                │     │  .owner             │
│  name: "John Doe"   │     │  .email               │     │  .status: 'Not..'  │
│                     │     │  .role                 │     │  .goalType: 'Div'  │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
```

### Code

```typescript
const handleOpenAddObjectiveModal = () => {
    setEditingObjective(undefined);

    // Pre-fill from userContext (logged-in user's profile info)
    const ownerName    = userContext?.name     || user?.user_metadata?.full_name || '';
    const userDivision = userContext?.division || user?.user_metadata?.division  || '';
    const userUnit     = userContext?.unit     || user?.user_metadata?.unit      || '';

    setNewObjectiveData({
        title: '',
        description: '',
        status: 'Not Started',
        progress: 0,
        year: new Date().getFullYear().toString(),
        goalType: 'Division',
        division: userDivision,    // ◄── Auto-filled
        unit: userUnit,            // ◄── Auto-filled
        owner: ownerName,          // ◄── Auto-filled
        parentGoalId: '',
        linkedDeliverable: ''
    });
    setIsObjectiveModalOpen(true);
};
```

### Why This Matters

Before this fix, new objectives were created with **empty** `Division` and `Unit` fields, causing them to fall into the `General` bucket in the Strategy hierarchy. Now:

1. User opens "Add Objective" → fields are pre-filled
2. Objective is saved to SharePoint with correct Division/Unit
3. Strategy page fetches it → placed into correct hierarchy branch
4. The accordion displays it under the right Division → Unit → Deliverable

---

## 6. Hybrid Scaffold Strategy

The **Hybrid Scaffold** is the core design pattern that ensures the hierarchy always renders all divisions and units, even when SharePoint data is incomplete.

### Problem (Before Fix)

```
SharePoint Data:
  Obj1: { division: "",        unit: "",        title: "Test Objective" }
  Obj2: { division: "General", unit: "General", title: "Another Test"   }

Result:
  hierarchy = {
    'General': {
      'General': {
        'General': [Obj1, Obj2]    ← Everything lumped together
      }
    }
  }

  UI shows: Only "General" division with no real structure
```

### Solution (After Fix)

```
ORG_STRUCTURE (hardcoded scaffold) +  SharePoint Data (live objectives)

Result:
  hierarchy = {
    'Office of the Chairman': {
      'Executive Division': {}                  ← Always visible, even with 0 objectives
    },
    'Corporate Services Division': {
      'Finance Unit': {},                       ← Always visible
      'IT Unit': {
        'General': [Obj1]                       ← Objective placed here (user is IT)
      },
      'Human Resource Unit': {}                 ← Always visible
    },
    'General': {
      'General': {
        'General': [Obj2]                       ← Unmatched objectives go here
      }
    },
    ...
  }

  UI shows: Full organizational structure with objectives placed correctly
```

---

## 7. Fuzzy Matching & Fallback Logic

When an objective's `Division` field is empty but `Unit` is populated, the system attempts to **infer the division** from the unit name:

```
┌────────────────────────────────────────────────────────┐
│  Fuzzy Matching Logic (inside useMemo)                 │
│                                                        │
│  Input: obj = { division: "", unit: "Finance Unit" }   │
│                                                        │
│  Step 1: div is empty → enter fuzzy match              │
│  Step 2: Search ORG_STRUCTURE for "finance unit"       │
│          (case-insensitive)                             │
│  Step 3: Found in 'Corporate Services Division'        │
│  Step 4: div = 'Corporate Services Division'           │
│                                                        │
│  Result: obj placed under                              │
│    Corporate Services Division → Finance Unit → General │
└────────────────────────────────────────────────────────┘
```

### Fallback Chain

```
1. Use obj.division    (if populated)
2. Infer from obj.unit (fuzzy match against ORG_STRUCTURE)
3. Default to 'General' (last resort)
```

---

## 8. Integration with Existing Systems

### How This Connects to Other Features

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SYSTEM INTEGRATION MAP                               │
│                                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────────────────┐   │
│  │ Employee     │    │ User Avatar  │    │ KRAsTab.tsx                  │   │
│  │ Profiles     │───►│ Dropdown     │───►│ (Add Objective Modal)        │   │
│  │ (SP List)    │    │ (TopNav)     │    │ Pre-fills Division/Unit/Owner│   │
│  └─────────────┘    └──────────────┘    └──────────────┬───────────────┘   │
│                                                        │                    │
│                                                        │ Creates new        │
│                                                        │ Objective in SP    │
│                                                        ▼                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     Unit_Objectives (SharePoint List)                 │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │ Fields: Title, Division, Unit, GoalType, Owner, Status, ...   │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────┬───────────────────────────────────────────┘   │
│                             │                                               │
│              ┌──────────────┼──────────────┐                                │
│              │              │              │                                │
│              ▼              ▼              ▼                                │
│  ┌───────────────┐ ┌──────────────┐ ┌──────────────────┐                   │
│  │ Strategy.tsx  │ │ KRAsTab.tsx  │ │ Performance      │                   │
│  │ (Division     │ │ (Unit-level  │ │ Dashboard        │                   │
│  │  Hierarchy)   │ │  Objectives  │ │ (Progress Calc)  │                   │
│  │               │ │  Table)      │ │                  │                   │
│  └───────┬───────┘ └──────────────┘ └──────────────────┘                   │
│          │                                                                  │
│          │ Linked via StrategyGoalLookupId                                  │
│          ▼                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │              Performance_KRAs (SharePoint List)                       │  │
│  │  Each KRA links to an Objective via objective_id / objectiveId       │  │
│  │                                                                       │  │
│  │  Strategy.tsx calculates dynamic progress:                            │  │
│  │    effectiveObjectives → linkedKras → calculateStrategicProgress()    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │              Performance_KPIs (SharePoint List)                       │  │
│  │  Each KPI links to a KRA                                              │  │
│  │  Used in calculateStrategicProgress() for accurate % calculation     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Related SharePoint Lists

| List Name               | Purpose                                  | Relationship                        |
|--------------------------|------------------------------------------|-------------------------------------|
| `Unit_Objectives`        | Stores all objectives                    | **Primary** — feeds the hierarchy   |
| `Performance_KRAs`       | Key Result Areas                         | Linked to objectives via lookup     |
| `Performance_KPIs`       | Key Performance Indicators               | Linked to KRAs for progress calc    |
| `Employee_Profiles`      | Staff details (name, division, unit)     | Provides user context for pre-fill  |
| `Strategic_Objectives`   | Org-level strategic goals                | Separate from unit objectives       |
| `Divisional_Alignment`   | Static alignment config                  | Fallback when no live data exists   |

### Related Components

| Component / File                          | Role                                         |
|-------------------------------------------|-----------------------------------------------|
| `src/pages/Strategy.tsx`                  | Main page — hierarchy rendering               |
| `src/components/unit-tabs/KRAsTab.tsx`    | Objective CRUD modal with pre-fill            |
| `src/services/sharePointOpsService.ts`    | SharePoint API communication                  |
| `src/hooks/useSharePointOps.ts`           | React Query hook for data fetching            |
| `src/types/index.ts`                      | TypeScript type definitions (Objective, etc.) |
| `src/utils/kpiUtils.ts`                   | `calculateStrategicProgress()` utility        |
| `src/components/layout/TopNav.tsx`        | User avatar dropdown (source of profile data) |

---

## 9. Data Type Definitions

### Objective Type

```typescript
// From src/types/index.ts
interface Objective {
    id: string;
    title: string;
    description: string;
    status: string;                // 'Not Started', 'In Progress', 'Completed'
    progress: number;              // 0–100
    year: string;                  // e.g. '2025'
    startDate?: Date;
    endDate?: Date;
    goalType: string;              // 'Division', 'Unit', 'Strategic', 'Org', 'Board'
    division: string;              // ◄── Division name (e.g. 'Corporate Services Division')
    unit: string;                  // ◄── Unit name (e.g. 'IT Unit')
    owner: string;                 // Person's name
    parentGoalId?: string;         // Lookup to parent objective
    parentGoalTitle?: string;
    icon?: string;
    isFeatured?: boolean;
    deliverables?: string[];
    linkedDeliverable?: string;    // ◄── Key Deliverable text for grouping
}
```

### UserContext Type

```typescript
interface UserContext {
    division: string;    // User's division (e.g. 'Corporate Services Division')
    unit: string;        // User's unit (e.g. 'IT Unit')
    email: string;       // User's email
    name: string;        // User's display name
    role: string;        // 'super_admin' | 'admin' | 'staff_member'
}
```

### FilterScope Type

```typescript
type FilterScope = 'All' | 'Division' | 'Unit' | 'Individual';
```

---

## 10. Debugging & Console Logs

The system includes strategic console logging for debugging hierarchy issues:

| Log Message                                        | Location           | Purpose                              |
|----------------------------------------------------|--------------------|--------------------------------------|
| `✅ [useSharePointOps] Loaded Objectives: N`       | Hook layer         | Confirms data fetch count            |
| `📊 [Strategy Hierarchy] Processing N objectives`  | useMemo            | Shows how many pass the filter       |
| `📊 [Strategy Hierarchy] Built hierarchy keys: [...]` | useMemo         | Shows final division names           |
| `✅ [Individual Filter] Staff sees Objective: ...`  | Hook (staff mode)  | Individual filtering debug           |
| `⛔ [Individual Filter] Hiding Objective: ...`      | Hook (staff mode)  | Shows filtered-out objectives        |

### How to Debug

1. Open browser DevTools → Console
2. Navigate to the Strategy page
3. Look for `📊 [Strategy Hierarchy]` logs
4. Check:
   - Are objectives being loaded? (`Loaded Objectives: N`)
   - How many pass the goalType filter? (`Processing N`)
   - What division keys appear? (`Built hierarchy keys`)
   - If a division is missing, check if its objectives have the correct `Division` field value

---

## 11. Future Considerations

### Potential Improvements

1. **Admin Config for ORG_STRUCTURE**: Instead of hardcoding the org structure, allow admins to configure it through the Strategy Setup Wizard. This would read from a SharePoint list (e.g., `Departments`) or a config list.

2. **Division/Unit Dropdown Validation**: Add dropdowns in the Objective modal that only allow valid division/unit combinations from `ORG_STRUCTURE`, preventing typos and data inconsistency.

3. **Bulk Data Fix**: Create a utility to backfill empty `Division`/`Unit` fields on existing SharePoint objectives based on owner profile data.

4. **Progressive Disclosure**: Add "Show Empty Divisions" toggle to let users hide divisions with no objectives, reducing visual clutter while maintaining data completeness.

5. **Director Name Config**: Pull director names from the `Employee_Profiles` list dynamically rather than hardcoding them in `getDivisionMeta`.

---

> **End of Document**
