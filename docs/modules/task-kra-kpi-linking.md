# Task, KRA, and KPI Linking Feature

## Overview

This feature enables seamless linking of daily tasks with strategic Key Result Areas (KRAs) and Key Performance Indicators (KPIs). When tasks are linked to KPIs, they automatically become checklist items inside the KPI, creating a live progress cascade from daily operations to strategic objectives.

**Full documentation:** See [KRA_KPI_TASK_LINKING_AND_PROGRESS.md](../KRA_KPI_TASK_LINKING_AND_PROGRESS.md) for the complete technical reference including backend sync engine, progress calculations, dashboard fixes, and edge cases.

## Key Features

### 1. Linking Tasks to KRAs/KPIs
- When creating or editing a task, users can link it to a specific KRA and KPI via dropdown selectors in the Task Dialog
- The "Link to KPI" dropdown is dynamically filtered based on the selected KRA
- Linking is optional -- standalone daily tasks continue to work as before

### 2. Task-to-KPI Checklist Sync (Automatic)
- **When a task is linked to a KPI**, it automatically appears as a checklist item inside that KPI
- **When a task is completed**, its checklist item auto-checks, advancing KPI progress
- **When a task is reopened**, its checklist item unchecks, reverting KPI progress
- **When a task is deleted or unlinked**, its checklist item is removed from the KPI
- Manual checklist items can coexist alongside task-linked items

### 3. Progress Cascade
```
Task completed --> KPI checklist item checked
  --> All items checked? --> KPI status = "Completed"
    --> KRA Progress = % of completed KPIs
      --> Objective Progress = average of KRA progress
        --> Dashboard cards & charts update live
```

### 4. Visibility in KRA/KPI Tab
- The KRA/KPI table has a "Linked Tasks" column showing a count badge
- Clicking the badge reveals a popover listing all linked task titles
- When editing a KPI, linked tasks appear as blue-highlighted, non-deletable checklist items with a link icon

### 5. Dashboard Consistency
- All dashboard cards (KRA Progress, Objectives Summary, KPIs) and charts (KRA Status Distribution, Top Objectives Progress) use the same calculation logic
- Objective progress is computed dynamically from linked KRAs (not stored values)

## Technical Architecture

### Backend: SharePoint Service (`src/services/sharePointOpsService.ts`)
- `syncKPIChecklistFromTasks(kpiId)` -- Core sync engine
- Hooked into `addTask()`, `updateTask()`, `deleteTask()`
- Cascades to `syncKRAProgress()` automatically

### Frontend: Checklist UI (`src/components/ChecklistSection.tsx`)
- Supports both manual and task-linked items
- Task-linked items have blue styling, link icon, and are non-deletable
- Progress bar shows combined completion percentage

### Calculations: Progress Utils (`src/utils/kpiUtils.ts`)
- `calculateKpiProgress()` -- Status/checklist/target-actual based
- `calculateKraProgress()` -- Strictly % of completed KPIs
- `calculateStrategicProgress()` -- Average of KRA progress
- `calculateObjectiveStatus()` -- All KPIs completed = Objective completed

### Dashboard: Overview Tab (`src/components/unit-tabs/OverviewTab.tsx`)
- Uses dynamic progress calculations (not stored values)
- KRA status matching handles all SharePoint status variants
- Objectives sourced from Unit.tsx props (unit-level objectives)

## Files Modified

| File | Changes |
|------|---------|
| `src/services/sharePointOpsService.ts` | Added `syncKPIChecklistFromTasks()`; modified `addTask()`, `updateTask()`, `deleteTask()` |
| `src/components/ChecklistSection.tsx` | Extended `ChecklistItem` with `taskId` and `isTaskLinked` fields |
| `src/components/unit-tabs/KRAsTab.tsx` | Task-checklist merge on KPI edit; checklist/calculationType in save payload |
| `src/components/kpi/KpiInputBlock.tsx` | Renders task-linked checklist items; measurement method toggle |
| `src/components/unit-tabs/OverviewTab.tsx` | Fixed objective data source, KRA status matching, dynamic progress |
| `src/utils/kpiUtils.ts` | Progress calculation functions (unchanged but documented) |
| `src/types/index.ts` | Task interface with `kra_id` and `kpi_id` fields |
