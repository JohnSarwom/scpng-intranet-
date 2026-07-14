# Phase 2: Target Strategy Execution Model

## Purpose

This phase defines the official business and product model for strategy execution. It converts the Phase 1 audit into a clear target model that later phases can implement without redefining terminology, ownership, scope, or traceability.

The main decision in this phase is that KRAs exist at two valid levels:

- `Organisational KRA / Key Deliverable`: strategy-level result area.
- `Performance KRA`: execution-level result area owned by a division, unit, manager, officer, or assigned owner.

Both are valid, but they must be labelled and linked differently.

## Target Model Summary

The system should operate as a single strategy execution cascade:

```text
Strategic Goal
-> Organisational KRA / Key Deliverable
-> Division / Unit Objective
-> Performance KRA
-> KPI
-> Task
-> Evidence / Report
```

This model must be used consistently across:

- Strategy page cards.
- Strategy Division/Unit hierarchy.
- Unit workspace.
- KRA/KPI management.
- Task creation and editing.
- Progress indicators.
- Analytics.
- Reports and exports.

## Level Definitions

| Level | Definition | Primary UI Location | Required Behavior |
| --- | --- | --- | --- |
| Strategic Goal | The top-level organisational outcome. | Strategy cards, reports, analytics. | Must show overall progress, status, owner/accountable area, and linked organisational KRAs/key deliverables. |
| Organisational KRA / Key Deliverable | The strategic result area that explains how a strategic goal will be achieved. | Strategy cards, Strategy hierarchy, reports. | Must be traceable to child objectives, initiatives, performance KRAs, KPIs, and tasks. |
| Division / Unit Objective | The division or unit-owned objective that operationalizes strategy. | Strategy hierarchy, Unit page, reports. | Must connect organisational strategy to execution ownership. |
| Performance KRA | The execution-level KRA that operationalizes a division/unit objective. | Unit KRAs tab, KPI modal, reports. | Must own KPIs and roll progress upward. |
| KPI | The measurable indicator attached to a Performance KRA. | KRA/KPI modal, KRAs tab, reports. | Must have a calculation mode and parent Performance KRA. |
| Task | The operational work item that produces execution movement. | Task Registry, Task modal, reports. | Should link to a KPI when the task is strategically relevant. |
| Evidence | Proof that work happened or progress changed. | Task cards, reports, audit views. | Should include completion date, attachment, comment, checklist item, task history, or audit event. |
| Report | The formal evidence and accountability output. | Reports tab, scheduled reports, exports. | Must declare scope, data source, date range, progress formula, and linkage health. |

## Official Naming Standard

Use these labels consistently:

| Context | Use This Label | Avoid |
| --- | --- | --- |
| Strategy cards | `Organisational KRA / Key Deliverable` | `KRA` alone |
| Strategy hierarchy | `Organisational KRA / Key Deliverable` or `Key Deliverable` where space is limited | ambiguous `KRA` |
| Unit workspace | `Performance KRA` | `Strategic KRA` |
| KPI modal | `Parent Performance KRA` | generic `Parent KRA` |
| Task modal | `Linked KPI` and `Strategic Trace` | uncontextualized KPI-only linkage |
| Reports | `Organisational KRA` and `Performance KRA` as separate columns/levels | merged KRA labels |

If a compact UI needs shorter text, use tooltips or supporting labels rather than removing the distinction.

## Ownership Model

| Object | Required Owner | Accountability Question |
| --- | --- | --- |
| Strategic Goal | Executive or organisation-level owner. | Who is accountable for the strategic outcome? |
| Organisational KRA / Key Deliverable | Strategic owner or accountable division. | Who owns delivery of this strategic result area? |
| Division / Unit Objective | Division or unit head. | Which organisational area is responsible for execution? |
| Performance KRA | Manager, officer, or assigned owner. | Who owns the operational result? |
| KPI | KPI owner and review authority. | Who owns measurement and validation? |
| Task | One or more assignees. | Who must do the work? |
| Evidence | User/system action that created or completed the evidence. | What proves the work happened? |
| Report | Report owner or schedule owner. | Who generated or receives the accountability output? |

## Required Traceability Rules

The target model should enforce or diagnose these rules:

- Every KPI must link to a Performance KRA.
- Every Performance KRA should link to a Division / Unit Objective or Key Deliverable.
- Every Division / Unit Objective should link upward to an Organisational KRA / Key Deliverable or Strategic Goal.
- Every strategic task should link to a KPI.
- Every task linked to a KPI should be able to infer its parent Performance KRA.
- Every report must declare the scope it used: personal, unit, division, corporate, or audit.
- Every progress percentage should be traceable to source records and calculation rules.
- Records that fail these rules should appear in linkage diagnostics instead of being silently hidden.

## Scope Modes

| Scope | Meaning | Primary Audience |
| --- | --- | --- |
| Personal | Records created by or assigned to the current user. | Staff and individual officers. |
| Unit | Records owned by a unit or unit staff. | Unit managers. |
| Division | Records owned by a division or selected division. | Division heads and managers. |
| Corporate | Organisation-wide strategy execution data. | Executives and strategy owners. |
| Audit | Admin-visible data used for governance, diagnostics, traceability, and exception reporting. | Admins, governance reviewers, auditors. |

Scope must be visible wherever totals or percentages are shown. A personal view and a corporate view can both be correct while showing different values.

## Progress And Reporting Contract

The target model requires one progress interpretation:

```text
Task progress
-> KPI progress
-> Performance KRA progress
-> Division / Unit Objective progress
-> Organisational KRA / Key Deliverable progress
-> Strategic Goal progress
```

Reports must use the same source hierarchy and calculation rules as the UI. If a report and a Strategy card use the same scope and date range, their progress values should match.

Minimum reporting levels:

- Strategic Goal.
- Organisational KRA / Key Deliverable.
- Division.
- Unit.
- Division / Unit Objective.
- Performance KRA.
- KPI.
- Task.
- Evidence.

## UI Contract

The target model should be visible in the interface:

- Strategy cards must show organisational KRAs/key deliverables as first-class strategy items.
- Division rows must show progress and contribution by units.
- Unit rows must show objective, KRA, KPI, task, and linkage health context.
- Task creation must show the selected strategic trace before save.
- KPI and KRA modals must show parent relationships clearly.
- Reports must show hierarchy rows, not only summary metrics.

## Data Compatibility Rules

The target model should preserve existing SharePoint lists while normalizing their meaning:

- `Strategic_Objectives` can remain a legacy/compatibility source.
- `Strategic_Goals`, `Strategic_KRAs`, and `Strategic_Initiatives` can represent corporate-plan structure.
- `Unit_Objectives` can represent division/unit objectives and seeded bridge items, but goal type and parent linkage must be explicit.
- `Performance_KRAs`, `Performance_KPIs`, and `Operations_Tasks` remain the operational execution spine.
- Future graph normalization should prefer stable lookup IDs over title or text matching.

## Model Acceptance Criteria

- Product copy clearly separates organisational KRAs/key deliverables from performance KRAs.
- Every displayed percentage can be traced back to hierarchy records and a calculation rule.
- Every strategically relevant task can be traced to a KPI or reported as unlinked.
- Every KPI can be traced to a Performance KRA.
- Every Performance KRA can be traced upward to a Division / Unit Objective and then to strategy.
- Every report declares its scope and can show the strategy-to-task path.
- Broken or incomplete relationships are diagnosed rather than hidden.
