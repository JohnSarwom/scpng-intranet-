# Phase 4: Progress Percentage Engine

## Purpose

This phase defines the trusted percentage model for strategy execution. The goal is to make every progress badge, bar, chart, report, and export use the same interpretation of progress.

The percentage engine should become the shared calculation contract for:

- Strategic Goal cards.
- Organisational KRA / Key Deliverable rows.
- Division rows.
- Unit rows.
- Objective / Initiative rows.
- Performance KRA rows.
- KPI rows.
- Task-linked KPI progress.
- Analytics charts.
- Reports and CSV exports.

## Design Principle

Progress must be calculated from the graph whenever possible.

Stored SharePoint progress values are useful as cached values and fallbacks, but they should not be treated as the only source of truth. A progress value should always be explainable by its source records, calculation method, scope, and timestamp.

## Official Progress Cascade

```text
Task completion
-> KPI progress
-> Performance KRA progress
-> Objective / Initiative progress
-> Unit progress
-> Division progress
-> Organisational KRA / Key Deliverable progress
-> Strategic Goal progress
```

This cascade must align with the graph service from Phase 3.

## Progress Inputs

| Input Type | Used At | Meaning |
| --- | --- | --- |
| Manual actual/target | KPI | Progress is calculated as actual divided by target. |
| Checklist | KPI | Progress is calculated from completed checklist items. |
| Task-completion | KPI | Progress is calculated from completed linked tasks. |
| Weighted KPI progress | Performance KRA, Initiative | Child KPIs contribute based on assigned weight. |
| Simple average | KRA, objective, unit, division, goal | Child progress values are averaged where no weighting exists. |
| Explicit completed status | KPI, KRA, initiative, goal | Completed/achieved/done status can force `100%` when appropriate. |
| Cached SharePoint progress | Any level | Used only as fallback when linked child data is missing. |

## Calculation Order

The engine should calculate progress from the bottom upward:

1. Calculate task completion state.
2. Calculate KPI progress from the selected KPI calculation type.
3. Calculate Performance KRA progress from linked KPI progress.
4. Calculate Objective / Initiative progress from linked Performance KRAs.
5. Calculate Unit progress from unit objectives or initiatives.
6. Calculate Division progress from units or division-owned objectives.
7. Calculate Organisational KRA / Key Deliverable progress from linked objectives/initiatives.
8. Calculate Strategic Goal progress from linked Organisational KRAs / Key Deliverables.

The engine should also return why a value was chosen, not only the percentage.

## KPI Progress Rules

| KPI Calculation Type | Rule |
| --- | --- |
| `manual` | `actual / target * 100`, capped at `100%`. |
| `checklist` | Completed checklist items divided by total checklist items. |
| `task-completion` | Completed linked tasks divided by total linked tasks. |
| no usable data | Return `0%` with `no_linked_data` or `not_started`, depending on whether the linkage exists. |
| completed status | Return `100%` when status is completed, achieved, or done. |

Task-completion must remain distinct from checklist mode. Linking tasks to a KPI must not silently convert the KPI into checklist mode.

## Parent Progress Rules

| Parent Level | Rule |
| --- | --- |
| Performance KRA | Weighted average of linked KPIs when weights exist; otherwise average KPI progress. |
| Objective / Initiative | Average linked Performance KRA progress unless a future weight model is explicitly added. |
| Unit | Average progress of linked unit objectives or initiatives. |
| Division | Average progress of units or division-owned objectives, depending on available graph data. |
| Organisational KRA / Key Deliverable | Average progress of linked objectives or initiatives. |
| Strategic Goal | Average progress of linked Organisational KRAs / Key Deliverables. |

If a parent has no linked child data, the engine should not treat cached progress as proof of execution. It should return a result that clearly identifies fallback or no linked data.

## Conceptual Interfaces

These interfaces are conceptual and should be adapted to existing project types during implementation.

```ts
interface ProgressCalculationResult {
  value: number;
  statusBand: ProgressStatusBand;
  hasLinkedData: boolean;
  source: ProgressCalculationSource;
  scope: ProgressScope;
  calculatedAt: string;
  childCount: number;
  completedChildCount?: number;
  explanation: string;
  warnings?: string[];
}

type ProgressCalculationSource =
  | 'manual'
  | 'checklist'
  | 'task-completion'
  | 'weighted'
  | 'average'
  | 'explicit-status'
  | 'cached'
  | 'no-linked-data';

type ProgressStatusBand =
  | 'no_linked_data'
  | 'not_started'
  | 'behind_or_early'
  | 'in_progress'
  | 'on_track'
  | 'completed';

type ProgressScope = 'personal' | 'unit' | 'division' | 'corporate' | 'audit';
```

## Visual Status Bands

| Condition | Label | Meaning | UI Treatment |
| --- | --- | --- | --- |
| `0%` without linked data | No Linked Data | The relationship chain is missing or incomplete. | Grey/neutral state with diagnostic prompt. |
| `0%` with linked data | Not Started | The chain exists but work has not progressed. | Empty progress bar with normal status label. |
| `1-39%` | Behind / Early Progress | Progress exists but needs attention. | Warning/amber or muted low-progress state. |
| `40-74%` | In Progress | Work is active and moving. | Active/in-progress state. |
| `75-99%` | On Track | Work is near completion or performing well. | Positive/on-track state. |
| `100%` | Completed | The measurable work is complete. | Completed state. |

The UI must not render every `0%` as the same state.

## Cached Progress Policy

SharePoint progress fields should be treated as:

- cache values for display performance,
- fallback values when child records are unavailable,
- values that can be refreshed by backend sync,
- not final proof of execution when the graph has no linked child records.

If cached progress is used, the result should say `source: 'cached'` and include a warning when linked data is missing.

## Scope Policy

Progress is only comparable when it uses the same scope and date/filter context.

Examples:

- A personal progress value should not be compared directly against a corporate progress value.
- A unit report should match the Unit hierarchy for the same unit and date range.
- A corporate Strategy card should match a corporate report using the same data scope.

Every progress result should carry its scope.

## Reporting Contract

Reports must use the same progress calculation outputs as the UI.

Required report fields for progress rows:

- Entity type.
- Entity title.
- Scope.
- Progress value.
- Status band.
- Calculation source.
- Child count.
- Completed child count, where applicable.
- Linked data state.
- Explanation.
- Diagnostics or warnings.

If a report and a UI surface use the same entity, scope, and date range, their progress values should match.

## Required Consumers

The progress engine should eventually power:

- Strategy page card percentages.
- Strategy page card progress bars.
- Division row progress bars.
- Unit row progress bars.
- Strategic objective group progress rows.
- KRA/KPI progress indicators.
- Task-completion KPI rollups.
- Reports and exports.
- Divisional analytics charts.
- Future AI strategy summaries.

## Implementation Notes

Recommended future location:

```text
src/utils/strategyProgressEngine.ts
```

Recommended supporting type location:

```text
src/types/strategyExecution.ts
```

Recommended implementation order:

1. Define `ProgressCalculationResult`, `ProgressStatusBand`, and `ProgressCalculationSource`.
2. Wrap existing KPI/KRA progress utilities with result objects that include source, explanation, and linked-data state.
3. Add graph-aware parent rollups for objective, unit, division, organisational KRA, and strategic goal progress.
4. Add a status-band helper that converts value/linkage state into UI labels.
5. Replace ad hoc Strategy, Reports, and Analytics calculations one surface at a time.
6. Add tests for manual, checklist, task-completion, weighted, cached, and no-linked-data paths.

## Acceptance Criteria

- A Strategic Goal percentage matches the report value for the same goal, scope, and date range.
- A Division percentage matches the Division/Unit heatmap report for the same scope.
- `0% No Linked Data` is visually and semantically different from `0% Not Started`.
- Task-completion KPIs remain task-completion KPIs and are not silently converted to checklist mode.
- Weighted KPI progress is handled consistently in backend sync, UI, analytics, and reports.
- Cached SharePoint progress is clearly marked as cached/fallback when used.
- Task completion can flow into KPI, Performance KRA, Objective, Unit, Division, Organisational KRA, and Strategic Goal progress.
