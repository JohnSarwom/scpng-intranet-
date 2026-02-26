# KPI Automation Logic Flow

This document outlines the strict automated logic flow implemented to ensure data integrity across KPIs, KRAs, Unit Objectives, and Strategic Goals. 

The core philosophy is that progress and status are **mathematically derived** from the ground up (the KPI level) and roll upwards. Manual overrides of "Status" are disabled at all levels to prevent artificial progress inflation.

## 1. System Logic Flow diagram

The following ASCII diagram illustrates how a user's action at the KPI level mathematically cascades all the way up to the Strategic Business Goal.

```text
[ USER INPUT ] 
      |
      v
+---------------------------------------------------+
|                  KPI LEVEL                        |
|                                                   |
|  Method 1: Manual        Method 2: Checklist      |
|  Target = 10           [x] Task A                 |
|  Actual = 5            [ ] Task B                 |
|                                                   |
|   (5/10) = 50%           (1/2) = 50%              |
|          \                   /                    |
|           v                 v                     |
|  +-----------------------------------+            |
|  |     AUTO STATUS CALCULATION       |            |
|  |   = 0%   -> Not Started           |            |
|  |   > 0%   -> In Progress           |            |
|  |   = 100% -> Completed             |            |
|  +-----------------------------------+            |
+---------------------------------------------------+
                          |
                          | (Rolls up to parent KRA)
                          v
+---------------------------------------------------+
|                  KRA LEVEL                        |
|                                                   |
|  KPI 1 = 'Completed'                              |
|  KPI 2 = 'In Progress'                            |
|                                                   |
|  Total Progress = (1/2 Completed) = 50%           |
|                                                   |
|  +-----------------------------------+            |
|  |     AUTO STATUS CALCULATION       |            |
|  |   = 0%   -> Open                  |            |
|  |   > 0%   -> In Progress           |            |
|  |   = 100% -> Closed                |            |
|  +-----------------------------------+            |
+---------------------------------------------------+
                          |
                          | (Rolls up to parent Objective)
                          v
+---------------------------------------------------+
|               UNIT OBJECTIVE                      |
|                                                   |
|  KRA 1 = 50% Progress                             |
|  KRA 2 = 100% Progress                            |
|                                                   |
|  Total Progress = Average(50, 100) = 75%          |
|                                                   |
|  +-----------------------------------+            |
|  |     AUTO STATUS CALCULATION       |            |
|  |   = 0%   -> Not Started           |            |
|  |   > 0%   -> In Progress           |            |
|  |   = 100% -> Completed             |            |
|  +-----------------------------------+            |
+---------------------------------------------------+
                          |
                          | (Rolls up to parent Goal)
                          v
+---------------------------------------------------+
|               STRATEGIC GOAL                      |
|                                                   |
|  Obj 1 = 75% Progress                             |
|  Obj 2 = 25% Progress                             |
|                                                   |
|  Total Progress = Average(75, 25) = 50%           |
+---------------------------------------------------+
```

---

## 2. Actual Code Implementation (KPI Level)

To ensure that the manual and checklist calculations remain isolated and the user cannot bypass the logic, the status is a derived read-only state.

```tsx
// src/components/kpi/KpiInputBlock.tsx

// 1. We derive the status dynamically whenever the user types a number or clicks a checkbox.
const derivedStatus = React.useMemo(() => {
  if (formData.calculationType === 'checklist') {
    const items = formData.checklist || [];
    if (items.length === 0) return 'not-started';
    const allChecked = items.every(item => item.checked);
    const anyChecked = items.some(item => item.checked);
    
    if (allChecked) return 'completed';
    if (anyChecked) return 'in-progress';
    return 'not-started';
  } else {
    // Manual input logic
    const target = Number(formData.target) || 0;
    const actual = Number(formData.actual) || 0;

    if (target > 0 && actual >= target) return 'completed';
    if (actual > 0) return 'in-progress';
    return 'not-started';
  }
}, [formData.calculationType, formData.checklist, formData.target, formData.actual]);

// 2. We silently enforce this true status directly into the form data.
useEffect(() => {
  if (formData.status !== derivedStatus) {
    onChange('status', derivedStatus as any);
  }
}, [derivedStatus, formData.status, onChange]);

// 3. We show it to the user as a read-only field so they understand it's automated.
<Input
  id={`kpi-status-${kpiIndex}`}
  value={derivedStatus.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
  readOnly
  className="bg-muted text-muted-foreground"
  title="Status is automatically calculated from Target and Actual values."
/>
```

---

## 3. Relational Database Flow

Below is the database relationship structure showing how the tables connect. Notice that the `Status` and `Progress` fields exist at every level but are continually updated by the data flowing `up` from the `KPIs` table.

```text
+----------------------+       +----------------------+
|  Strategic_Goals     |       |  Unit_Objectives     |
+----------------------+       +----------------------+
| PK: Goal_ID          |<--+   | PK: Objective_ID     |
| Title: String        |   |   | Title: String        |
| Description: Text    |   +---| FK: Parent_Goal_ID   |
| Progress: Math(Avg)  |       | Progress: Math(Avg)  |
| Status: Auto_String  |       | Status: Auto_String  |
+----------------------+       +----------------------+
                                         ^
                                         |
+----------------------+       +---------+------------+
|  KPIs (The Engine)   |       |  KRAs                |
+----------------------+       +----------------------+
| PK: KPI_ID           |   +-->| PK: KRA_ID           |
| Title: String        |   |   | Title: String        |
| CalcType: Enum       |   |   | FK: Objective_ID     |
| Target: Numeric      |   |   | Progress: Math(Avg)  |
| Actual: Numeric      |   |   | Status: Auto_String  |
| FK: KRA_ID           |---+   +----------------------+
| Status: Auto_String  |
+----------------------+
```

### Explanation of the Tables for Non-Technical Context:
- **KPIs (The Engine)**: This is the lowest level where actual work is done. Users input real numbers here (like "5 out of 10 tasks done" or checking off checklist items). You cannot fake a status here; it strictly calculates based on the math of Actual vs Target.
- **KRAs**: A KRA is essentially a bucket of KPIs. It looks at all the KPIs assigned to it. If 2 out of 4 KPIs are "Completed", the KRA knows it is exactly 50% done. Its status automatically updates to "In Progress".
- **Unit Objectives**: This is a bucket of KRAs. It looks at the percentage score of all its KRAs and averages them. If it averages to 75%, it automatically marks itself as "In Progress".
- **Strategic Goals**: The highest level. It simply looks down at the Unit Objectives linked to it and averages their mathematical completion percentage, completely ignoring any old "human-typed" statuses.
