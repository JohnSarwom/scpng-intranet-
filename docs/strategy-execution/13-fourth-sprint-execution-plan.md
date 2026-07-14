# Fourth Sprint Execution Plan

## Purpose

This file defines the fourth implementation sprint for the strategy execution program. Sprint 3 makes graph and progress data visible in the UI. Sprint 4 turns that visibility into safer workflows: users should be guided into creating properly linked strategic tasks, KRAs, and KPIs, and warned before actions that would break the execution chain.

Sprint 4 is the point where the application starts preventing bad strategy execution data at the source.

## Sprint Objective

Upgrade the key create/edit/delete workflows by:

- replacing the single KPI task selector with strategy cascade selectors,
- showing a strategic breadcrumb before task save,
- making strategic vs non-strategic task state explicit,
- validating KRA/KPI parent relationships before save,
- preserving task-completion KPI behavior in the modal experience,
- warning before destructive KRA/KPI actions,
- and ensuring all workflow saves use normalized linkage values.

## Target Backlog Items

| Backlog ID | Priority | Sprint Treatment |
| --- | --- | --- |
| SE-406 | P1 | Replace single KPI selector in task modal with cascade selectors |
| SE-407 | P1 | Add selected hierarchy breadcrumb to task modal before save |
| SE-408 | P1 | Make KRA/KPI modal parent relationships explicit and validated |
| SE-409 | P2 | Add destructive action warnings with child impact preview |
| SE-102 | P0 | Confirm workflow saves use lookup normalization from Sprint 1 |
| SE-405 | P1 | Reuse shared visual states for no linked data and broken linkage |
| SE-603 | P1 | Add browser/UI validation scenarios for modal workflows |

## Primary Code Areas

| Area | Sprint Purpose |
| --- | --- |
| `src/components/unit-tabs/modals/AddTaskModal.tsx` | Add strategy cascade selectors and pre-save breadcrumb for new tasks |
| `src/components/unit-tabs/modals/EditTaskModal.tsx` | Add strategy cascade selectors and preserve existing task linkage during edits |
| `src/components/unit-tabs/TaskDialog.tsx` | Check whether shared task dialog patterns also need cascade/breadcrumb support |
| `src/components/unit-tabs/KRAsTab.tsx` | Improve KRA/KPI parent display, validation, and destructive-action warnings |
| `src/services/strategyExecutionGraphService.ts` | Provide selector options, parent/child filtering, and breadcrumb source data |
| `src/utils/strategyProgressUi.ts` | Reuse shared linkage/status labels in modal warnings |
| `src/utils/sharePointLookupUtils.ts` | Ensure modal save payloads normalize optional lookup values |
| `src/services/sharePointOpsService.ts` | Confirm backend write behavior protects against fake IDs and orphaned updates |

## Workflow Principles

### 1. Make Strategic Linkage Explicit

A user creating a strategic task should see the hierarchy before saving:

```text
Strategic Goal
-> Organisational KRA / Key Deliverable
-> Objective / Initiative
-> Performance KRA
-> KPI
```

Acceptance:

- Users no longer choose a KPI without seeing where that KPI belongs.
- The selected hierarchy is visible before save.
- If a user clears a strategic parent, dependent child selections clear safely.

### 2. Allow Non-Strategic Tasks Deliberately

Not every operational task needs to be strategic, but that state should be explicit.

Acceptance:

- Task modal has a clear strategic/non-strategic mode or equivalent state.
- Non-strategic tasks do not pretend to contribute to strategy.
- Strategic tasks warn when no KPI is selected.
- Non-strategic tasks save with `null` strategy linkage, not fake IDs.

### 3. Validate Before Save, Normalize Before Write

Frontend validation should guide users, while backend normalization remains the final safety net.

Acceptance:

- Empty cascade selections normalize to `null`.
- `"none"` and empty strings are not sent as lookup IDs.
- Required parent relationships are validated before save.
- Existing valid task/KPI/KRA updates remain supported.

### 4. Do Not Hide Parent Relationships In KRA/KPI Workflows

KRA and KPI modals should show users exactly where the item belongs.

Acceptance:

- Performance KRA save flow shows parent Objective / Initiative.
- KPI save flow shows parent Performance KRA.
- KPI calculation type is visible.
- Task-completion mode shows linked task count where available.

### 5. Destructive Actions Must Show Child Impact

Users should understand the consequence before deleting or archiving strategy execution records.

Acceptance:

- KRA delete warning shows linked KPI count and linked task count.
- KPI delete warning shows linked task count and evidence impact where available.
- Default destructive dialog action is cancel.
- Supported actions are clear: cancel, archive, reassign, clear linkage, or cascade delete where permitted.

## Proposed Implementation Order

### Step 1: Create Selector View Models From The Graph

Suggested output shapes:

```ts
interface StrategyCascadeOption {
  id: string;
  label: string;
  parentId?: string;
  disabled?: boolean;
  diagnosticCount?: number;
}

interface StrategyBreadcrumb {
  strategicGoal?: StrategyCascadeOption;
  organisationalKra?: StrategyCascadeOption;
  objective?: StrategyCascadeOption;
  performanceKra?: StrategyCascadeOption;
  kpi?: StrategyCascadeOption;
}
```

Acceptance:

- Task modal can request selector options without manually rebuilding the graph.
- Options can be filtered by parent selection.
- Options can show disabled or diagnostic states where useful.

### Step 2: Add Cascade Selectors To Add Task Modal

Target:

```text
src/components/unit-tabs/modals/AddTaskModal.tsx
```

Required selector order:

```text
Strategic Goal
Organisational KRA / Key Deliverable
Objective / Initiative
Performance KRA
KPI
```

Acceptance:

- Selecting a parent filters the next selector.
- Selecting a KPI infers the parent path when possible.
- Clearing a parent clears invalid child selections.
- Save payload contains normalized KPI/KRA/objective references.
- Non-strategic mode is explicit.

### Step 3: Add Cascade Selectors To Edit Task Modal

Target:

```text
src/components/unit-tabs/modals/EditTaskModal.tsx
```

Required behavior:

- Existing task linkage preselects the known path.
- Broken existing linkage shows a warning and available repair action.
- Changing a KPI updates the breadcrumb.
- Clearing strategic linkage is deliberate and normalizes to `null`.

Acceptance:

- Editing a task does not accidentally lose valid strategic linkage.
- Broken linkage can be seen and repaired.
- The old single KPI selector no longer hides the hierarchy.

### Step 4: Add Strategic Breadcrumb Before Save

Targets:

```text
src/components/unit-tabs/modals/AddTaskModal.tsx
src/components/unit-tabs/modals/EditTaskModal.tsx
```

Breadcrumb format:

```text
Strategic Goal > Organisational KRA / Key Deliverable > Objective / Initiative > Performance KRA > KPI
```

Acceptance:

- Breadcrumb appears before save for strategic tasks.
- Missing optional levels are shown clearly without implying a false chain.
- Broken parentage shows `Broken Linkage` label instead of blank text.

### Step 5: Add KRA/KPI Parent Validation

Target:

```text
src/components/unit-tabs/KRAsTab.tsx
```

Required behavior:

- Performance KRA creation/editing requires a parent Objective / Initiative where applicable.
- KPI creation/editing requires a parent Performance KRA.
- Existing KRA reuse by title must not create ambiguous parent relationships.
- Duplicate prevention must respect parent context, not only title.

Acceptance:

- Users cannot unknowingly create orphaned KPIs.
- Existing duplicate-prevention logic does not attach KPIs to the wrong KRA.
- Parent relationship appears in the modal before save.

### Step 6: Preserve KPI Calculation Mode In UI

Target:

```text
src/components/unit-tabs/KRAsTab.tsx
```

Required behavior:

- Manual KPIs show target, actual, and metric/unit.
- Checklist KPIs show checklist completion.
- Task-completion KPIs show linked task count.
- Changing linked tasks does not visually imply the KPI became checklist-based.

Acceptance:

- Users can distinguish manual, checklist, and task-completion modes.
- Task-completion mode is preserved in save payloads.
- KPI progress explanation matches the shared progress engine.

### Step 7: Add Child Impact Warnings

Targets:

```text
src/components/unit-tabs/KRAsTab.tsx
```

KRA warning should show:

- child KPI count,
- linked task count,
- parent objective,
- affected reports/progress note,
- available action.

KPI warning should show:

- linked task count,
- evidence count where available,
- affected KRA progress note,
- available action.

Acceptance:

- Delete/archive dialogs show child impact before confirmation.
- Cancel remains the safest and most prominent default path.
- Destructive flows do not silently orphan tasks.

### Step 8: Add Workflow Validation Tests

Minimum scenarios:

- create strategic task with full cascade,
- create non-strategic task with null strategic linkage,
- edit task and move it to a different KPI,
- edit task with broken existing linkage,
- create KPI under selected Performance KRA,
- prevent KPI save without required parent KRA,
- warn before deleting KRA with child KPIs/tasks,
- warn before deleting KPI with linked tasks,
- preserve task-completion calculation type from UI save payload.

Verification commands:

```bash
npm run test
npm run lint
npm run build
```

Use browser validation for Add Task, Edit Task, Add/Edit KRA, Add/Edit KPI, and delete warning flows.

## Modal UX Requirements

### Cascade Selector Behavior

- Each selector should have a clear empty state.
- A child selector should be disabled until the parent selection is sufficient.
- If there is only one valid child option, the UI may suggest it but should not hide the hierarchy.
- Broken or diagnostic-heavy options should show a warning indicator.
- Loading states should not collapse the modal layout.

### Breadcrumb Behavior

- Breadcrumb should be read-only.
- Breadcrumb should update immediately when selections change.
- Breadcrumb should show official labels, not raw list names.
- Long breadcrumb text should wrap cleanly on smaller screens.
- Missing linkage should be explicit.

### Validation Messaging

Use concise validation messages:

| Case | Message Intent |
| --- | --- |
| Strategic task without KPI | Select a KPI or mark this task as non-strategic. |
| KPI without KRA | Select the Performance KRA this KPI measures. |
| KRA without parent objective | Select the Objective / Initiative this Performance KRA supports. |
| Broken existing task link | This task has a saved link that no longer resolves. Select a valid KPI to repair it. |
| Delete KRA with children | This KRA has linked KPIs and tasks. Choose how to handle them before continuing. |

## Sprint 4 Acceptance Criteria

The sprint is complete when:

- Add Task modal supports the strategy cascade and breadcrumb.
- Edit Task modal preloads, repairs, and saves strategic linkage safely.
- Strategic vs non-strategic task state is explicit.
- Empty linkage values save as `null`, not fake IDs.
- KRA/KPI modals show parent relationships before save.
- KPI parent validation prevents accidental orphan creation.
- KPI calculation mode remains visible and preserved.
- KRA/KPI destructive actions show child impact.
- Existing workflows remain usable for normal task/KRA/KPI creation and editing.
- `npm run test`, `npm run lint`, and `npm run build` pass or documented failures are triaged.
- Browser validation confirms modal layout, text fit, and save behavior.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Cascade selectors feel too heavy for quick task entry | Provide explicit non-strategic mode and sensible disabled/empty states |
| Existing tasks have incomplete linkage | Preload what can be resolved and show repair prompts for broken links |
| Duplicate KRA title logic attaches KPIs to the wrong parent | Include parent objective context in duplicate prevention |
| Modal layout becomes crowded | Use compact selectors, clear grouping, and wrapping breadcrumb text |
| Backend and frontend validation diverge | Keep backend normalization as final safety and use shared constants/types |
| Delete warnings block legitimate cleanup | Offer archive/reassign/clear-linkage options where backend supports them |

## Out Of Scope For Sprint 4

- Full report export rebuild.
- Scheduled report lifecycle redesign.
- Admin/audit governance dashboard.
- Full production data cleanup.
- Large visual redesign of the Strategy page.
- Replacing all legacy report calculations.

## Handoff Notes For Sprint 5

Sprint 5 should move into reporting and evidence:

- Strategic Execution Traceability Report,
- Division/Unit Progress Heatmap,
- KRA/KPI Evidence Report,
- Unlinked Records Report,
- Overdue Strategic Tasks Report,
- expanded CSV/export hierarchy rows,
- and schedule lifecycle/admin visibility.

Sprint 5 should rely on the graph, progress, and workflow validation work from Sprints 2 through 4, not recreate relationship logic inside reports.
