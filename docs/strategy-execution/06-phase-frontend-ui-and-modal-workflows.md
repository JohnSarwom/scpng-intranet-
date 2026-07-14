# Phase 6: Frontend UI and Modal Workflows

## Purpose

This phase defines the improved user experience for strategy execution. The frontend should make relationships visible, make percentages trustworthy, and make linkage mistakes difficult to create.

The UI should no longer treat Strategy, Unit KRAs, KPIs, Tasks, Reports, and Division/Unit tracking as separate experiences. Each surface should expose the same strategy execution model in the right level of detail for its audience.

## Design Principle

Every strategic UI surface should answer three questions:

- What does this item contribute to?
- What work or evidence supports it?
- Why is this the displayed progress percentage?

The graph service from Phase 3 should provide the relationships. The progress engine from Phase 4 should provide the progress value, status band, explanation, and linked-data state.

## Strategy Cards

Strategy cards should become executive entry points into execution evidence, not static summary cards.

Each Strategic Goal card should show:

- Strategic Goal title.
- Progress percentage.
- Progress status band.
- Progress explanation tooltip or hover detail.
- Organisational KRA / Key Deliverable count.
- Linked objective/initiative count.
- Linked Performance KRA count.
- Linked KPI count.
- Linked task count.
- Evidence health.
- Owner or accountable division.
- Linkage warning when child data is missing.

Organisational KRAs / Key Deliverables should be displayed as first-class clickable rows or compact items. Clicking one should open a traceability drawer or detail panel showing:

```text
Strategic Goal
-> Organisational KRA / Key Deliverable
-> Objective / Initiative
-> Performance KRA
-> KPI
-> Task
-> Evidence
```

## Strategy Card `0%` States

Strategy cards must distinguish:

| State | Meaning | UI Behavior |
| --- | --- | --- |
| `0% Not Started` | Linked data exists, but no work has progressed. | Show normal empty progress state. |
| `0% No Linked Data` | No child records exist under the item. | Show neutral empty state and linkage prompt. |
| `0% Broken Linkage` | Child records exist but cannot be connected reliably. | Show warning state and diagnostics entry point. |

The visual percentage badge should never be the only signal.

## Division/Unit Hierarchy

The existing Division/Unit hierarchy should remain, but it should become more diagnostic and evidence-aware.

Each Division row should show:

- Division name.
- Division head or accountable owner.
- Division progress.
- Status band.
- Unit count.
- Objective/initiative count.
- Organisational KRA / Key Deliverable count, where applicable.
- Performance KRA count.
- KPI count.
- Linked task count.
- Overdue strategic task count.
- Unlinked or missing-data count.

Each Unit row should show:

- Unit name.
- Unit head.
- Unit progress.
- Status band.
- Objective/initiative count.
- Performance KRA count.
- KPI count.
- Linked task count.
- Overdue task count.
- Linkage health indicator.

Expanded rows should show the trace:

```text
Strategic Goal / Organisational KRA
-> Key Deliverable / Objective
-> Performance KRA
-> KPI
-> Linked Tasks
```

## Task Modal

The Task modal should make strategic linkage visible before save.

Replace the single visible KPI selector with cascade selectors:

```text
Strategic Goal
Organisational KRA / Key Deliverable
Objective / Initiative
Performance KRA
KPI
```

Required behavior:

- Selecting a parent should filter the next selector.
- Selecting a KPI should infer and display its parent Performance KRA.
- The modal should show a read-only strategic breadcrumb before save.
- Empty selections must normalize to `null`, not `"none"` or invalid lookup IDs.
- A strategically relevant task should warn if no KPI is selected.
- A task can remain non-strategic, but that state should be explicit.

Recommended breadcrumb format:

```text
Strategic Goal > Organisational KRA > Objective / Initiative > Performance KRA > KPI
```

## KRA/KPI Modal

The KRA/KPI modal should make parent relationships explicit and reduce orphan creation.

Required behavior:

- A Performance KRA must show its parent Objective or Key Deliverable.
- A KPI must show its parent Performance KRA.
- KPI calculation type must be clear: manual, checklist, or task-completion.
- Task-completion mode must show linked task count.
- Checklist mode must show checklist completion state.
- Manual mode must show target, actual, and unit/metric.
- KPI review status and review authority should be visible where governance is enabled.
- Save should validate required relationships before calling backend handlers.

## Destructive Actions

Delete actions must show child impact before confirmation.

KRA delete warning should include:

- Child KPI count.
- Linked task count.
- Available actions: cancel, archive, reassign, cascade delete.

KPI delete warning should include:

- Linked task count.
- Evidence count, where available.
- Available actions: cancel, archive, reassign tasks, clear task linkage, cascade delete.

The default action should be cancel.

## Reports UI

Reports should become traceability and evidence views, not only summaries.

Reports UI should include:

- Strategic traceability view.
- Division/Unit progress heatmap.
- Exception panel for unlinked records.
- Evidence panel for completed strategic tasks.
- Overdue strategic task panel.
- Owner accountability panel.
- Scope banner showing personal, unit, division, corporate, or audit mode.
- Progress formula or calculation source note.

Report previews and exports should show hierarchy rows, not only metric totals.

## Analytics UI

Analytics charts should use the same graph and progress engine as the Strategy cards and Reports.

Required behavior:

- Divisional comparison should use the same Division progress values as the Division/Unit hierarchy.
- KRA progress charts should distinguish Organisational KRAs from Performance KRAs.
- Tooltips should show count context: objectives, KRAs, KPIs, tasks, and diagnostics.
- Charts should show no-linked-data states instead of silently rendering zero-value bars.

## Scope And Visibility UI

Every progress-heavy surface should make scope visible.

Required scope labels:

- Personal.
- Unit.
- Division.
- Corporate.
- Audit.

Users should understand whether they are looking at their own assigned work, a unit view, a division view, or a corporate/audit view. This prevents incorrect comparisons between scoped totals.

## Empty And Loading States

Frontend surfaces should distinguish:

- Loading data.
- No records exist.
- Records exist but are not linked.
- Records exist but are hidden by scope.
- Records exist but have broken lookups.
- Records exist but have not started.

These states should not all render as plain `0%`.

## Implementation Order

Recommended frontend order:

1. Add shared UI helpers for progress status bands and linkage states.
2. Update Strategy cards to show clearer labels, counts, and `0%` states.
3. Update Division/Unit hierarchy with counts, linkage health, and scope labels.
4. Update Task modal with cascade selectors and strategic breadcrumb.
5. Update KRA/KPI modal with parent linkage display and validation.
6. Add destructive-action warnings for KRA/KPI delete flows.
7. Update Reports UI with traceability, heatmap, diagnostics, and evidence panels.
8. Update Analytics charts to consume shared graph/progress outputs.

## UX Acceptance Criteria

- Users can see the full strategic chain before creating or saving a strategic task.
- Users can tell why a percentage is `0%`.
- Strategy cards are entry points into execution evidence.
- Division and Unit rows show enough context to identify weak links.
- KRA/KPI modals show parent relationships before save.
- Destructive actions show child impact before confirmation.
- Reports show traceability and evidence, not only summary totals.
- Analytics, Reports, Strategy cards, and Division/Unit hierarchy use consistent progress/status values.
