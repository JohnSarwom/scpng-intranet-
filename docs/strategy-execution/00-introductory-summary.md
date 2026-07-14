# Strategy Execution Roadmap: Introductory Summary

## Purpose

This roadmap defines how the Strategy page, Task Registry, KRAs, KPIs, percentage indicators, Division/Unit hierarchy, and Reports should operate as one connected strategy execution system.

The current application already contains the right building blocks: strategic goals, organisational KRAs, unit objectives, performance KRAs, KPIs, operational tasks, progress bars, divisional hierarchy views, and report scheduling. The next step is to make those parts behave as one trusted operating model rather than a set of adjacent features.

## Problem Statement

The system is currently linked, but the meaning of those links is not yet consistent across all areas of the product.

The Strategy page can show strategic goals and KRAs. The Unit workspace can manage performance KRAs, KPIs, and tasks. Reports can summarize tasks, KRAs, KPIs, and objectives. However, the rules that connect these objects are spread across several services, hooks, utilities, and UI components.

This creates a practical management risk: the same strategic goal can show progress in one place, a division can show another percentage in the lower hierarchy, and a report can summarize the data differently. When that happens, users may see attractive progress indicators without being able to fully trust what each percentage means.

## Strategic Importance

This work is important because the platform is not only tracking tasks. It is becoming a strategy execution and accountability system.

For leadership, the Strategy page should answer:

- Which strategic goals are progressing?
- Which organisational KRAs or key deliverables are driving that progress?
- Which divisions and units are contributing?
- Where is progress stalled or unsupported by evidence?

For managers and staff, the Unit workspace should answer:

- What KRAs and KPIs are we responsible for?
- Which tasks support those KPIs?
- What work is overdue, blocked, completed, or missing evidence?
- How does daily work contribute to the strategic plan?

For governance and reporting, Reports should answer:

- Can we prove the strategy is being executed?
- Which owner, division, unit, KRA, KPI, or task is responsible for progress?
- Which records are unlinked, stale, overdue, or unsupported by evidence?
- Are the progress percentages consistent across the UI and reports?

## Target Operating Model

The official strategy execution cascade is:

```text
Strategic Goal
-> Organisational KRA / Key Deliverable
-> Division / Unit Objective
-> Performance KRA
-> KPI
-> Task
-> Evidence / Report
```

This cascade must become the shared mental model, data model, UI model, and reporting model.

## Executive Summary

The Strategy page should become the executive cockpit. It should show the strategic goals, organisational KRAs/key deliverables, percentage indicators, and division/unit contribution view.

The Unit page should become the execution workspace. It should show the operational KRAs, KPIs, tasks, owners, assignments, due dates, evidence, and progress details that support the strategy.

The Reports area should become the evidence and accountability layer. It should convert the same execution graph into traceability reports, heatmaps, exception reports, schedule reports, and owner accountability reports.

The percentage indicators across all areas must come from one shared progress model. A progress bar on a strategic goal should mean the same thing as the progress shown for its divisions, units, KRAs, KPIs, linked tasks, and reports.

## Current Diagnosis

The current implementation is close, but several gaps need to be addressed before the system can be treated as a fully trusted execution model:

- A KRA can mean a strategic deliverable in one place and an operational performance KRA in another.
- Strategic goal cards, division rows, unit rows, analytics, reports, and backend sync can calculate progress differently.
- Tasks can link to KPIs, but the task modal does not yet show the full strategy chain before save.
- Reports summarize operational data but do not yet prove full strategy-to-task traceability.
- Broken or missing links can appear as `0%` progress even when the real issue is missing data.
- Role-based scope can affect what records are visible and therefore what totals are shown.
- SharePoint progress fields can become stale if they are treated as the only source of truth.

## North Star Outcome

The completed program should deliver a strategy execution operating system with:

- One canonical strategy execution hierarchy.
- One shared progress calculation engine.
- One graph layer for linking goals, organisational KRAs, objectives, performance KRAs, KPIs, tasks, divisions, units, and reports.
- Clear UI labels that separate strategic KRAs from performance KRAs.
- Percentage indicators that distinguish no progress from no linked data.
- Division and Unit tracking that visually explains how each part of the organisation contributes to strategy.
- Reports that show evidence, accountability, scope, progress formulas, and linkage health.
- Diagnostics for orphaned, unlinked, stale, or incomplete records.

## Implementation Phases

1. Current State Audit: document existing SharePoint lists, relationships, UI surfaces, calculations, reports, permissions, and gaps.
2. Target Strategy Execution Model: lock the business hierarchy, ownership model, naming standard, and traceability rules.
3. Data Linkage and Graph Service: define the central relationship layer used by Strategy, Unit, Task, KRA/KPI, Reports, and Analytics surfaces.
4. Progress Percentage Engine: standardize progress rules, status bands, `0%` states, and shared calculation outputs.
5. Backend Hardening: fix linkage normalization, status mapping, pagination, delete safety, KPI movement, task-completion behavior, and logging.
6. Frontend UI and Modal Workflows: improve cards, hierarchy rows, cascade selectors, breadcrumbs, validation, and destructive-action warnings.
7. Reporting and Governance: create traceability reports, heatmaps, unlinked-record reports, owner accountability reports, schedules, and audit rules.
8. Testing, Rollout, and Acceptance: verify the full cascade from strategic goal to task evidence and confirm UI/report consistency.

## Glossary

| Term | Meaning |
| --- | --- |
| Strategic Goal | The top-level organisational outcome shown on the Strategy page. |
| Organisational KRA / Key Deliverable | A strategic result area or deliverable that explains how a strategic goal will be achieved. |
| Division / Unit Objective | A division or unit-level objective that operationalizes an organisational KRA or key deliverable. |
| Performance KRA | An execution-level KRA owned by a division, unit, manager, officer, or assigned owner. |
| KPI | A measurable indicator attached to a performance KRA. |
| Task | Operational work linked to a KPI and used as evidence of execution. |
| Evidence | Attachments, completion dates, comments, checklist items, task history, or audit events that prove work happened. |
| Progress Indicator | A percentage and status label derived from the shared progress model. |
| Traceability Report | A report that shows the chain from strategic goal to task evidence. |
| Linkage Health | A measure of whether records are properly connected across the strategy execution cascade. |

## Default Decisions

- Preserve the existing SharePoint lists and harden their relationships before adding new lists.
- Use `Organisational KRA / Key Deliverable` on Strategy-level surfaces.
- Use `Performance KRA` in Unit execution surfaces.
- Treat SharePoint progress fields as cached values, not the only source of truth.
- Make the future graph service and progress engine the shared foundation for Strategy, Unit, Task, KRA/KPI, Reports, and Analytics surfaces.
- Make progress scope explicit wherever totals are displayed: personal, unit, division, corporate, or audit.
