# First Sprint Execution Plan

## Purpose

This file turns the roadmap and implementation backlog into the first actionable sprint. The first sprint should establish the foundation for robust strategy execution before major UI changes begin.

The sprint focus is backend safety, shared contracts, and implementation readiness. It deliberately avoids large visual redesign work until the data model, linkage rules, and progress interfaces are stable.

## Sprint Objective

Create a safe technical foundation for the Strategy -> KRA -> KPI -> Task -> Reporting model by:

- confirming the canonical hierarchy and naming rules,
- normalizing optional SharePoint lookup values,
- aligning status values,
- fixing KPI parent movement behavior,
- preserving task-completion KPI calculation mode,
- defining graph and progress contracts,
- and adding the first validation tests around those rules.

## Target Backlog Items

| Backlog ID | Priority | Sprint Treatment |
| --- | --- | --- |
| SE-001 | P0 | Confirm hierarchy and document any final product decisions |
| SE-002 | P0 | Confirm KRA naming standard for UI and reports |
| SE-003 | P0 | Define nullable linkage and lookup rules |
| SE-101 | P0 | Add shared lookup normalization helper |
| SE-102 | P0 | Apply lookup normalization to strategic writes where safe |
| SE-103 | P0 | Align status enum/choice mapping |
| SE-104 | P0 | Fix KPI parent movement and recalculation |
| SE-105 | P0 | Preserve task-completion KPI calculation type |
| SE-201 | P0 | Define `StrategyExecutionGraph` types |
| SE-301 | P0 | Define progress calculation result types |
| SE-602 | P0 | Add early tests for linkage normalization and progress contract behavior |

## Primary Code Areas

| Area | Current Role | Sprint Purpose |
| --- | --- | --- |
| `src/services/sharePointOpsService.ts` | Main operational SharePoint service for tasks, KRAs, KPIs, reports, schedules, and progress sync | Harden writes, relationship updates, calculation type preservation, and status mapping |
| `src/services/strategyService.ts` | Strategy list loader for strategic objectives, goals, KRAs, initiatives, hierarchy, and strategy config | Inform graph service inputs and future strategy-first projections |
| `src/utils/kpiUtils.ts` | Existing KPI/KRA/initiative/goal calculation helpers | Inform future shared progress engine and prevent formula drift |
| `src/pages/Strategy.tsx` | Executive strategy cockpit | Future consumer of graph and progress results |
| `src/components/unit-tabs/KRAsTab.tsx` | Unit execution workspace for KRAs/KPIs/objectives | Future consumer of explicit parent linkage and progress results |
| `src/components/unit-tabs/ReportsTab.tsx` | Current report generation and schedule UI | Future consumer of traceability reports and shared graph/progress totals |
| `src/components/unit-tabs/modals/AddTaskModal.tsx` | Task creation workflow | Future consumer of cascade selectors and normalized linkage |
| `src/components/unit-tabs/modals/EditTaskModal.tsx` | Task editing workflow | Future consumer of cascade selectors and normalized linkage |

## Technical Decisions To Lock

### 1. Lookup Normalization

All optional lookup-like fields should use the same rule before SharePoint writes:

```text
undefined -> null
"" -> null
"none" -> null
"null" -> null
valid numeric/string ID -> original ID or numeric SharePoint ID shape required by the field
```

Acceptance:

- Task, KPI, KRA, objective, and report schedule write paths do not save fake relationship values.
- Existing records with missing linkage remain loadable and produce diagnostics later.

### 2. Status Mapping

Status values should have one shared mapping boundary between application values and SharePoint choice values.

Acceptance:

- Application status values do not drift from SharePoint choices.
- `completed`, `done`, and SharePoint `Completed` behavior is intentional.
- Progress logic does not depend on inconsistent casing or spelling.

### 3. KPI Parent Movement

Moving a KPI between KRAs must be treated as a relationship mutation, not only a field update.

Acceptance:

- The KPI's SharePoint parent lookup changes.
- The old parent KRA recalculates.
- The new parent KRA recalculates.
- Reports and graph diagnostics will later show the KPI under one parent only.

### 4. Task-Completion Calculation Type

`task-completion` is an official KPI calculation mode and should not be silently converted into `checklist`.

Acceptance:

- Create, update, and sync flows preserve the calculation type.
- Linked task completion can update progress without changing the calculation mode.
- Any checklist material generated from tasks is treated as supporting data, not a type conversion.

### 5. Shared Future Types

The first sprint should define conceptual TypeScript-facing contracts without wiring every consumer yet.

Core contracts:

```ts
StrategyExecutionGraph
ProgressCalculationResult
LinkageDiagnostic
ProgressScope
ProgressStatusBand
```

Acceptance:

- Types are placed where future services can import them without circular dependencies.
- The contracts reflect the documentation package.
- No major page is forced to adopt the new types before the graph/progress implementation is ready.

## Proposed Implementation Order

### Step 1: Confirm Business Contract

Inputs:

- `02-phase-target-strategy-execution-model.md`
- `09-implementation-backlog.md`

Output:

- Any final naming or hierarchy decision is captured in the roadmap docs.

Acceptance:

- No ambiguity remains between Organisational KRA / Key Deliverable and Performance KRA.

### Step 2: Add Shared Strategy Execution Types

Suggested location:

```text
src/types/strategyExecution.ts
```

Contents:

- graph type skeletons,
- progress result type skeletons,
- linkage diagnostic types,
- scope and status band types.

Acceptance:

- Types compile.
- Types are not tied to one page component.
- Types can represent Strategy page, Unit page, Task modal, Reports tab, and analytics needs.

### Step 3: Add Lookup Normalization Helper

Suggested location:

```text
src/utils/sharePointLookupUtils.ts
```

Suggested helper:

```ts
normalizeLookupId(value: unknown): string | number | null
```

Acceptance:

- Handles `undefined`, `null`, empty strings, `none`, and valid IDs.
- Unit tests cover expected conversion behavior.

### Step 4: Apply Normalization In SharePoint Writes

Target service:

```text
src/services/sharePointOpsService.ts
```

Initial target methods:

- `addTask`
- `updateTask`
- `addKPI`
- `updateKPI`
- `addKRA`
- `updateKRA`
- `addObjective`
- `updateObjective`
- report schedule save methods where optional lookup/scope fields exist

Acceptance:

- Strategic link fields do not save fake values.
- Existing valid IDs continue to save correctly.
- No unrelated write path changes behavior.

### Step 5: Harden KPI Update Behavior

Target method:

```text
src/services/sharePointOpsService.ts -> updateKPI
```

Acceptance:

- `kra_id` updates propagate to the SharePoint parent lookup.
- Previous KRA ID is detected before update where possible.
- Old and new parent KRAs both run progress sync.
- If either parent is missing, the method does not crash and records a controlled diagnostic/log.

### Step 6: Preserve Task-Completion Mode

Target areas:

- `syncKPIChecklistFromTasks`
- `addKPI`
- `updateKPI`
- any task-to-KPI sync branch

Acceptance:

- `task-completion` remains `task-completion`.
- Task completion updates progress or supporting detail without rewriting the KPI calculation type to checklist.
- Tests cover a task-completion KPI before and after task sync.

### Step 7: Add Early Tests

Minimum test coverage:

- lookup normalization,
- status mapping if exported/testable,
- KPI parent movement behavior with mocked service calls,
- task-completion preservation with mocked task/KPI records,
- type-level compile coverage via `npm run build`.

Verification commands:

```bash
npm run test
npm run lint
npm run build
```

## First Sprint Acceptance Criteria

The sprint is complete when:

- Canonical hierarchy and KRA naming are confirmed.
- Shared strategy execution types exist and compile.
- Optional lookup normalization exists and is tested.
- Strategic SharePoint write paths no longer save fake linkage values.
- KPI parent movement updates the parent lookup and recalculates both affected KRAs.
- Task-completion KPI calculation type is preserved through sync.
- Existing UI behavior is not intentionally redesigned yet.
- `npm run test`, `npm run lint`, and `npm run build` pass or documented failures are clearly triaged.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| SharePoint choice values differ from local status values | Inspect real list choices before final enum changes |
| Lookup fields use different internal names across lists | Keep normalization generic but apply field mappings carefully per method |
| KPI parent movement lacks old parent data | Fetch existing KPI before update when `kra_id` changes |
| Task-completion mode currently shares checklist sync code | Separate progress source from checklist support data |
| Tests are hard to write against the service class | Extract pure helpers first and test those before heavier service tests |
| UI changes creep into foundation sprint | Restrict UI edits to compile fixes unless needed for data contract safety |

## Out Of Scope For Sprint 1

- Full `StrategyExecutionGraphService` implementation.
- Full progress percentage engine implementation.
- Strategy card visual redesign.
- Task modal cascade selectors.
- KRA/KPI modal redesign.
- Traceability report UI.
- Scheduled report lifecycle redesign.
- Role-scope reporting UI.

These are deliberately deferred until the foundation is stable.

## Handoff Notes For Sprint 2

Sprint 2 should begin with:

- implementing the graph loader and diagnostics,
- adding the first progress engine functions,
- proving graph/progress parity with existing strategy and unit data,
- and preparing Strategy page and Reports tab consumers for the shared model.

Sprint 2 should not begin large UI work until graph and progress outputs are testable.
