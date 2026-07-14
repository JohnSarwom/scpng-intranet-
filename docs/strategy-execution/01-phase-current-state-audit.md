# Phase 1: Current State Audit

## Purpose

This phase documents what exists today before the target model is designed or implemented. It covers the SharePoint lists, data relationships, frontend surfaces, progress calculations, reporting flow, permission scope, known risks, and acceptance criteria for the audit baseline.

Phase 1 should answer:

- What data exists?
- Where does each object live?
- How are objects currently linked?
- Which UI surfaces show the links?
- How are percentages currently represented?
- Where can progress, reports, or permissions drift?
- What must be fixed before the system can become a trusted execution model?

## Current System Summary

The application already has a working strategy execution foundation. Strategic goals, KRAs, KPIs, tasks, division/unit views, progress bars, and reports are present. The main issue is not absence of capability; it is consistency.

The current implementation has three overlapping layers:

| Layer | Purpose | Current Risk |
| --- | --- | --- |
| Strategy planning | Defines strategic goals, strategic KRAs, deliverables, and initiatives. | Some strategic KRAs exist as text deliverables while others exist as list records. |
| Operational execution | Defines unit objectives, performance KRAs, KPIs, and tasks. | Links exist, but not every UI makes the full chain visible. |
| Reporting and analytics | Summarizes progress, task status, KRA/KPI status, and divisional performance. | Reports do not yet prove full strategy-to-task traceability. |

## Current SharePoint Lists

| List | Current Role | Audit Notes |
| --- | --- | --- |
| `Strategic_Objectives` | Legacy strategic objective source. Can store deliverables/KRAs as text. | Useful, but text-based deliverables are weaker than first-class linked records. |
| `Strategic_Goals` | Corporate-plan strategic goal list. | Should align with the Strategy card model. |
| `Strategic_KRAs` | Corporate-plan KRA list linked to strategic goals. | Represents strategy-level KRAs, not operational performance KRAs. |
| `Strategic_Initiatives` | Corporate-plan initiative list linked to strategic KRAs. | Can support the bridge between strategy and unit execution. |
| `Unit_Objectives` | Operational objectives for divisions and units. Also used in seeded data for goals, key deliverables, and initiatives. | Needs clear goal type semantics and parent linkage rules. |
| `Performance_KRAs` | Execution KRAs linked to unit objectives. | Should be labelled as Performance KRAs in the UI. |
| `Performance_KPIs` | KPIs linked to performance KRAs. | KPI movement, calculation mode, and task linkage need hardening. |
| `Operations_Tasks` | Tasks linked to KRAs and KPIs. | Task creation should show full strategy trace before save. |
| `Report_Schedules` | Saved report schedule metadata. | Scheduling metadata exists; delivery lifecycle and audit state need clearer rules. |

## Current Relationship Map

The intended relationship chain is:

```text
Strategic_Goals / Strategic_Objectives
-> Strategic_KRAs or Deliverables
-> Strategic_Initiatives / Unit_Objectives
-> Performance_KRAs
-> Performance_KPIs
-> Operations_Tasks
-> Reports
```

Current relationship strengths:

- `Performance_KRAs` can link to `Unit_Objectives`.
- `Performance_KPIs` can link to `Performance_KRAs`.
- `Operations_Tasks` can link to KRAs and KPIs.
- Strategy cards and Division/Unit sections already show visual progress.
- Reports can summarize tasks, KRAs, KPIs, and objectives.

Current relationship weaknesses:

- Strategic KRAs/key deliverables are not represented consistently across all strategy sources.
- Some relationships rely on titles or deliverable text instead of stable IDs.
- Task creation does not clearly expose the parent strategy path.
- Reports summarize by category but do not yet output the full hierarchy.
- Broken parent/child links can appear as normal low progress.

## Current Frontend Surfaces

| Surface | Current Role | Audit Notes |
| --- | --- | --- |
| Strategy cards | Show strategic goals, KRA text rows, percentage badges, and progress bars. | Needs clickable first-class KRA rows and clearer progress explanation. |
| Strategy Division/Unit hierarchy | Shows divisions, units, objectives, key deliverables, and progress bars. | Strong visual base; needs linked KRA/KPI/task counts and clearer `0%` states. |
| Unit page | Main execution workspace for tasks, KRAs, KPIs, objectives, reports, and overview. | Should use the same graph and progress outputs as Strategy. |
| Unit KRAs tab | Manages performance KRAs, KPIs, initiatives, and objective grouping. | Should use official naming and parent breadcrumb display. |
| Task modal | Creates and edits tasks, including KPI linkage. | Needs cascade selectors for strategic goal through KPI. |
| KPI modal | Creates and edits KRAs and KPIs, including checklist and review metadata. | Needs explicit parent linkage, validation, and safe delete behavior. |
| Reports tab | Generates summary metrics, export output, and schedule settings. | Needs traceability reports and hierarchy rows. |
| Divisional analytics | Compares objective progress and KRA progress across divisions. | Must use the same calculation engine as Strategy and Reports. |

## Current Progress And Percentage Tracking

The UI already displays progress at multiple levels:

- Strategic Goal card percentage badges.
- Strategic Goal card progress bars.
- Division row progress bars.
- Unit row progress bars.
- Strategic objective group progress bars.
- KRA/KPI progress fields.
- Divisional analytics charts.
- Report summary metrics.

Current progress risk:

```text
The visuals look aligned, but the formulas may not be aligned.
```

The audit baseline must treat progress as a system-wide concern, not a per-component detail.

Required progress audit questions:

- Does Strategy card progress match the same goal in Reports?
- Does Division progress match the Division/Unit hierarchy and divisional analytics chart?
- Does Unit progress come from the same child records in all surfaces?
- Does KRA progress use KPI status, KPI weighted progress, checklist completion, or task completion?
- Does `0%` mean not started, no linked data, or broken linkage?

## Current Reporting Flow

Reports currently support summary-style metrics across selected categories such as tasks, KRAs, KPIs, and objectives.

Current reporting strengths:

- Reports can calculate operational counts and percentages.
- Reports can be generated for time periods.
- CSV/export and schedule functionality exist.
- Report schedule metadata has a SharePoint home.

Current reporting gaps:

- Reports do not yet emit a full strategic trace from goal to evidence.
- CSV/export is summary-first rather than hierarchy-first.
- Report schedules need stronger delivery status and audit behavior.
- Report scope must be more explicit: personal, unit, division, corporate, or audit.
- Report values should be tied to the same progress engine used by Strategy and Unit views.

## Current Permission And Scope Considerations

The system already uses role and context to scope data. This matters because a user may see different task, KPI, KRA, or objective totals depending on role.

Audit scope modes:

| Scope | Meaning |
| --- | --- |
| Personal | User-created or assigned records. |
| Unit | Records belonging to a unit or unit staff. |
| Division | Records belonging to a division. |
| Corporate | Organisation-wide strategy execution view. |
| Audit | Admin/governance view with diagnostics and linkage health. |

Risk:

If the scope is not explicit, a user may compare a personal task total with a division strategy percentage and assume the numbers should match.

Required direction:

- Every progress view and report must show its active scope.
- Audit/admin views must be able to see linkage diagnostics.
- Staff/manager views must remain scoped without corrupting corporate totals.

## Current Strengths

- The key SharePoint lists already exist.
- The Strategy page already shows visual progress and the Division/Unit hierarchy.
- The Unit workspace already manages tasks, KRAs, KPIs, and objectives.
- Tasks can already link to KRAs and KPIs.
- KPIs can already link to KRAs.
- KRAs can already link to unit objectives.
- Progress utilities already exist and can be consolidated.
- Reports and schedule metadata already exist.
- The codebase has enough structure to support a graph service and shared progress engine.

## Gap Register

| Gap | Impact | Required Direction |
| --- | --- | --- |
| Duplicate KRA meanings | Users can confuse strategic KRAs with performance KRAs. | Standardize labels and hierarchy. |
| Strategic deliverables can be text-only | Text rows are harder to trace, report, and validate. | Prefer first-class linked records or graph-normalized nodes. |
| Inconsistent progress formulas | Strategy, Division/Unit, analytics, reports, and backend sync can disagree. | Use one progress engine. |
| `0%` is ambiguous | Missing data can look like no progress. | Add separate `Not Started`, `No Linked Data`, and `Broken Linkage` states. |
| Task modal linkage is shallow | Users link tasks to KPIs without seeing the full strategic chain. | Add cascade selectors and breadcrumbs. |
| Reports are summary-heavy | Reports do not yet prove strategic traceability. | Add traceability and evidence reports. |
| Possible orphan records | Broken links can hide inside normal UI states. | Add linkage diagnostics. |
| Status/schema mismatch | UI statuses and SharePoint choices are not fully aligned. | Normalize status enums and mappings. |
| Role-scoped data affects totals | Different roles can see different totals. | Make scope explicit in every view/report. |
| KPI calculation modes can drift | Manual, checklist, task-completion, and stored progress can disagree. | Preserve calculation type and use shared calculation outputs. |
| Delete behavior is risky | Deleting KRAs can leave child KPIs/tasks unclear. | Add guarded delete/archive/reassign flows. |
| Scheduled reports need execution contract | Schedule metadata exists, but delivery and audit state need rules. | Define report lifecycle and delivery status. |

## Phase 1 Deliverables

Phase 1 should produce:

- Confirmed list inventory.
- Confirmed relationship map.
- Confirmed frontend surface map.
- Confirmed progress calculation inventory.
- Confirmed report flow inventory.
- Confirmed permission/scope notes.
- Gap register approved for Phase 2 design.

## Audit Acceptance Criteria

- All strategic execution data sources are documented.
- Every current UI surface has a stated role and risk note.
- All known relationship, progress, reporting, permission, and UX risks are captured.
- The difference between strategic KRAs and performance KRAs is explicitly documented.
- The difference between `0% Not Started` and `0% No Linked Data` is documented.
- The next implementation phase can use this file as the baseline inventory.
