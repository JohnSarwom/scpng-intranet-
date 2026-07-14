# Second Sprint Execution Plan

## Purpose

This file defines the second implementation sprint for the strategy execution program. Sprint 1 establishes backend safety and shared contracts. Sprint 2 should turn those contracts into working foundations: the first `StrategyExecutionGraphService`, linkage diagnostics, and shared progress calculation functions.

Sprint 2 should still avoid major UI redesign. Its job is to prove that the application can build one trustworthy strategy execution graph and calculate progress from that graph before Strategy cards, Division/Unit rows, reports, and modals are fully rewired.

## Sprint Objective

Build the first usable graph and progress foundation for the Strategy -> KRA -> KPI -> Task -> Reporting model by:

- loading existing strategy, objective, KRA, KPI, task, division, unit, and report-relevant data into one normalized structure,
- producing linkage diagnostics for missing or broken relationships,
- calculating KPI, KRA, objective, unit, division, organisational KRA, and strategic goal progress from shared rules,
- distinguishing `0% Not Started` from `0% No Linked Data`,
- and creating parity checks between current UI/report values and graph-calculated values.

## Target Backlog Items

| Backlog ID | Priority | Sprint Treatment |
| --- | --- | --- |
| SE-202 | P0 | Implement graph loader that combines existing SharePoint-backed data |
| SE-203 | P0 | Implement relationship resolver for goals, KRAs, objectives, KPIs, tasks, divisions, and units |
| SE-204 | P0 | Implement linkage diagnostics |
| SE-205 | P1 | Add first scope-aware graph views for corporate, division, unit, staff, manager, and audit |
| SE-206 | P1 | Add strategy-first and division-first graph projections |
| SE-302 | P0 | Implement KPI progress calculators |
| SE-303 | P0 | Implement parent roll-up rules |
| SE-304 | P0 | Implement `0% Not Started` vs `0% No Linked Data` logic |
| SE-305 | P1 | Add cached progress comparison diagnostics |
| SE-306 | P1 | Add progress calculation tests |
| SE-602 | P0 | Add automated tests for graph diagnostics and progress calculations |

## Primary Code Areas

| Area | Sprint Purpose |
| --- | --- |
| `src/types/strategyExecution.ts` | Extend or finalize graph, diagnostic, scope, and progress contracts from Sprint 1 |
| `src/services/strategyExecutionGraphService.ts` | New central graph service that normalizes relationships and returns graph views |
| `src/services/strategyService.ts` | Raw strategy data source for goals, objectives, strategic KRAs, initiatives, and hierarchy |
| `src/services/sharePointOpsService.ts` | Raw execution data source for Unit objectives, Performance KRAs, KPIs, tasks, reports, and schedules |
| `src/utils/kpiUtils.ts` | Existing calculation logic to consolidate or wrap during progress engine creation |
| `src/utils/strategyProgressUtils.ts` | Suggested new home for shared progress engine functions if not placed in a service |
| `src/utils/strategyGraphDiagnostics.ts` | Suggested new home for pure diagnostic helpers if separated from the graph service |
| `src/components/unit-tabs/ReportsTab.tsx` | Read-only parity target; do not fully redesign yet |
| `src/pages/Strategy.tsx` | Read-only parity target; do not fully redesign yet |

## Data Inputs To Normalize

The graph service should accept already-fetched records or fetch through existing services. The first implementation should avoid replacing the existing SharePoint services.

| Data | Existing Concept | Sprint 2 Need |
| --- | --- | --- |
| Strategic goals | `Strategic_Goals`, `Strategic_Objectives` | Top-level goal nodes |
| Organisational KRAs / key deliverables | `Strategic_KRAs`, strategy deliverables | Strategy-level result areas under goals |
| Strategic initiatives | `Strategic_Initiatives` | Bridge between strategy and execution where available |
| Unit objectives | `Unit_Objectives` | Division/Unit-owned objective layer |
| Performance KRAs | `Performance_KRAs` | Execution KRAs under objectives |
| KPIs | `Performance_KPIs` | Measurement layer under Performance KRAs |
| Tasks | `Operations_Tasks` | Work and evidence layer under KPIs |
| Divisions and units | Strategy hierarchy, org context, record fields | Aggregation and scope grouping |
| Reports and schedules | `Report_Schedules`, generated report records | Future traceability and scope context |

## Technical Decisions To Lock

### 1. Graph Service Shape

The graph service should be a relationship and normalization layer, not another SharePoint client.

Recommended shape:

```ts
class StrategyExecutionGraphService {
  buildGraph(input: StrategyExecutionGraphInput): StrategyExecutionGraph;
  buildStrategyView(graph: StrategyExecutionGraph): StrategyGoalNode[];
  buildDivisionView(graph: StrategyExecutionGraph): DivisionExecutionNode[];
  getDiagnostics(graph: StrategyExecutionGraph): LinkageDiagnostic[];
}
```

Acceptance:

- Existing services remain responsible for raw fetches.
- The graph service accepts plain data inputs and can be tested without live SharePoint.
- Consumers do not need to rebuild parent/child relationships.

### 2. Diagnostic Severity

Diagnostics should identify whether a broken relationship is informational, warning-level, or blocking.

Recommended levels:

```text
info
warning
error
```

Acceptance:

- Tasks without KPI are at least warning-level when they are strategic tasks.
- KPIs without Performance KRA are error-level for strategy execution.
- KRAs without Objective are warning or error depending on scope.
- Divisions with no linked execution data are informational unless expected to report progress.

### 3. Scope Handling

Scope should filter visibility without corrupting graph totals.

Recommended scope modes:

```text
personal
unit
division
corporate
audit
```

Acceptance:

- Corporate totals are calculated from corporate scope.
- Staff and manager views clearly identify their restricted scope.
- Audit scope can expose diagnostics and governance data.
- Role filtering is treated as a view over the graph, not a different formula.

### 4. Progress Engine Boundary

Progress calculations should be pure functions where possible.

Recommended functions:

```ts
calculateKpiProgress(...)
calculatePerformanceKraProgress(...)
calculateObjectiveProgress(...)
calculateUnitProgress(...)
calculateDivisionProgress(...)
calculateOrganisationalKraProgress(...)
calculateStrategicGoalProgress(...)
getProgressStatusBand(...)
```

Acceptance:

- Progress functions can be unit tested without React or SharePoint.
- The same functions can later serve Strategy cards, Division/Unit rows, analytics, and reports.
- Each result includes value, status band, source, child count, linked-data state, and explanation.

### 5. Cached Progress Comparison

Stored SharePoint progress values should be treated as cached/fallback values, not proof of execution.

Acceptance:

- The engine can compare graph-calculated progress to stored progress.
- Differences are reported as diagnostics or warnings.
- Reports can later explain when a value is calculated, cached, or fallback.

## Proposed Implementation Order

### Step 1: Finalize Graph Input And Node Types

Inputs:

- Sprint 1 `StrategyExecutionGraph` type skeleton.
- Phase 3 graph service documentation.
- Existing project types for tasks, KRAs, KPIs, objectives, and strategy records.

Acceptance:

- Graph input type can represent all raw data needed by the first graph build.
- Node types have stable IDs, source list, title/name, owner, division, unit, parent IDs, children, progress, and diagnostics where relevant.

### Step 2: Build Pure Graph Normalization Helpers

Suggested helpers:

```ts
normalizeId(value: unknown): string | null
indexById<T>(records: T[], getId: (record: T) => unknown): Record<string, T>
attachChild(...)
```

Acceptance:

- Helpers handle numeric and string IDs consistently.
- Missing IDs do not crash graph building.
- Duplicate IDs produce diagnostics.

### Step 3: Implement Relationship Resolver

Initial relationships:

- Strategic Goal -> Organisational KRA / Key Deliverable.
- Organisational KRA / Key Deliverable -> Objective / Initiative.
- Objective / Initiative -> Performance KRA.
- Performance KRA -> KPI.
- KPI -> Task.
- Division -> Unit -> Objectives / KRAs / KPIs / Tasks.

Acceptance:

- A complete chain appears once in the strategy-first view.
- The same chain appears under the correct Division/Unit view.
- A child does not appear under two parents unless source data explicitly supports multiple parentage and the graph marks it.

### Step 4: Implement Linkage Diagnostics

Minimum diagnostics:

- tasks without KPI,
- tasks without KRA,
- KPIs without KRA,
- KRAs without objective,
- objectives without strategic goal,
- organisational KRAs without strategic goal,
- divisions with no linked execution data,
- duplicate IDs,
- parent IDs that point to missing records,
- progress cached value mismatch once progress calculations exist.

Acceptance:

- Diagnostics include ID, record type, title, severity, message, affected parent ID if known, and recommended action.
- Diagnostics are available in flat form from the graph.
- Diagnostics do not prevent graph generation unless data shape is unrecoverable.

### Step 5: Implement KPI Progress Calculators

Supported types:

- manual actual/target,
- checklist,
- task-completion,
- weighted KPI progress where applicable,
- explicit completed status,
- cached fallback,
- no linked data.

Acceptance:

- `task-completion` uses linked tasks and does not behave as checklist unless explicitly configured.
- Manual actual/target is capped and handles missing target safely.
- Checklist progress handles zero checklist items safely.
- Completed/achieved/done status handling is consistent.

### Step 6: Implement Parent Roll-Ups

Roll-up order:

```text
Task
-> KPI
-> Performance KRA
-> Objective / Initiative
-> Unit
-> Division
-> Organisational KRA / Key Deliverable
-> Strategic Goal
```

Acceptance:

- Parents calculate from child progress where linked child data exists.
- Parents with no children return `0% No Linked Data`, not a misleading normal `0%`.
- Parents with children but no completed work return `0% Not Started`.
- Weighted values are used only where weights are present and valid.

### Step 7: Add Scope-Aware Views

Initial scope support:

- corporate,
- division,
- unit,
- personal/staff,
- manager,
- audit.

Acceptance:

- Each graph result includes the active scope.
- Scope filtering is explainable in reports and diagnostics.
- Audit/admin views can include diagnostics that normal users may not need to see.

### Step 8: Add Parity Checks

Compare graph/progress outputs to current known surfaces:

- Strategy page goal/card progress,
- Division/Unit percentage rows,
- KRA/KPI progress in Unit screens,
- Reports tab summary totals.

Acceptance:

- Differences are documented as expected formula changes or defects.
- No UI is fully rewired until parity differences are understood.
- Known formula drift is captured for Sprint 3 or later UI/report integration.

### Step 9: Add Automated Tests

Minimum test scenarios:

- complete chain builds without diagnostics,
- KPI without KRA produces diagnostic,
- task without KPI produces diagnostic,
- objective without strategic goal produces diagnostic,
- `0% Not Started` vs `0% No Linked Data`,
- task-completion KPI progress,
- checklist KPI progress,
- manual actual/target KPI progress,
- parent roll-up averages,
- scope filtering preserves expected totals.

Verification commands:

```bash
npm run test
npm run lint
npm run build
```

## First Graph Acceptance Scenario

Use this scenario as the minimum end-to-end graph proof:

```text
Strategic Goal A
-> Organisational KRA A1
-> Unit Objective A1.1
-> Performance KRA A1.1.1
-> KPI A1.1.1.1
-> Task A1.1.1.1.a
```

Expected result:

- Strategy-first view shows the full chain under Strategic Goal A.
- Division-first view shows the same chain under the correct Division/Unit.
- KPI progress reflects linked task completion.
- Parent progress rolls up to Performance KRA, Objective, Unit, Division, Organisational KRA, and Strategic Goal.
- No diagnostics are produced for the complete chain.
- If the task is removed from the KPI, the graph produces a linkage diagnostic and progress changes to `0% No Linked Data` where appropriate.

## Sprint 2 Acceptance Criteria

The sprint is complete when:

- `StrategyExecutionGraphService` or equivalent graph foundation exists.
- Graph building works from plain data inputs.
- Relationship resolver handles goals, organisational KRAs, objectives, Performance KRAs, KPIs, tasks, divisions, and units.
- Linkage diagnostics are produced for missing or broken relationships.
- Shared progress functions calculate KPI and parent progress.
- `0% Not Started` and `0% No Linked Data` are distinct in the returned result.
- Scope metadata is included in graph/progress outputs.
- Tests cover graph diagnostics and core progress calculations.
- Existing UI is not yet heavily redesigned, but parity checks are documented.
- `npm run test`, `npm run lint`, and `npm run build` pass or documented failures are triaged.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Existing data has inconsistent parent IDs | Normalize IDs and emit diagnostics instead of failing graph generation |
| Existing UI formulas disagree with the new engine | Use parity checks to identify formula drift before rewiring UI |
| Scope filtering changes totals unexpectedly | Keep scope explicit in every result and test corporate vs restricted views separately |
| Graph service becomes too coupled to SharePoint | Accept plain data inputs and keep fetch logic in existing services |
| Progress engine becomes hard to explain | Return explanation, source, child count, and status band with every result |
| Large data slows graph building | Use ID maps and one-pass relationship attachment where possible |

## Out Of Scope For Sprint 2

- Full Strategy card redesign.
- Task modal cascade selector implementation.
- KRA/KPI modal redesign.
- Full traceability report UI.
- Scheduled report delivery redesign.
- Admin/audit governance dashboard.
- Production migration of old records.

These depend on the graph and progress outputs being stable first.

## Handoff Notes For Sprint 3

Sprint 3 should begin wiring the shared graph and progress outputs into visible surfaces:

- Strategy cards,
- Strategic Goal KRA lists,
- Division/Unit hierarchy rows,
- KRA/KPI rows,
- analytics cards,
- and report preview summaries.

Sprint 3 should also begin the UI distinction for `0% Not Started` and `0% No Linked Data`, because by then the progress engine should return the data needed to render those states correctly.
