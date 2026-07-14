# Strategy Execution Roadmap

This package defines the implementation roadmap for turning strategy execution into one connected operating model across the Strategy page, Task Registry, Division/Unit hierarchy, KRAs, KPIs, progress indicators, reporting, and governance.

The target cascade is:

```text
Strategic Goal
-> Organisational KRA / Key Deliverable
-> Division / Unit Objective
-> Performance KRA
-> KPI
-> Task
-> Evidence / Report
```

## How To Use This Package

Start with the introductory summary, then read the phases in order. The sequence is intentional: the model should be agreed before services are built, backend hardening should happen before major UI work, and reporting should be finalized before acceptance testing.

| Order | File | Use It For |
| --- | --- | --- |
| 00 | [Introductory Summary](00-introductory-summary.md) | Executive overview, glossary, diagnosis, and target operating model |
| 01 | [Current State Audit](01-phase-current-state-audit.md) | Existing lists, UI surfaces, linkages, progress behavior, and gaps |
| 02 | [Target Strategy Execution Model](02-phase-target-strategy-execution-model.md) | Official hierarchy, naming, ownership, scope, and traceability rules |
| 03 | [Data Linkage and Graph Service](03-phase-data-linkage-and-graph-service.md) | Future graph service, normalized structures, diagnostics, and consumers |
| 04 | [Progress Percentage Engine](04-phase-progress-percentage-engine.md) | Shared progress cascade, calculation types, visual bands, and consumers |
| 05 | [Backend Hardening](05-phase-backend-hardening.md) | SharePoint linkage safety, status alignment, pagination, deletes, and logging |
| 06 | [Frontend UI and Modal Workflows](06-phase-frontend-ui-and-modal-workflows.md) | Strategy cards, Division/Unit rows, task modal, KRA/KPI modal, and report UI |
| 07 | [Reporting and Governance](07-phase-reporting-and-governance.md) | Traceability reports, heatmaps, evidence, schedules, governance, and exports |
| 08 | [Testing, Rollout, and Acceptance](08-phase-testing-rollout-and-acceptance.md) | Test matrix, rollout stages, sign-off criteria, and post-release monitoring |
| 09 | [Implementation Backlog](09-implementation-backlog.md) | Ticket-sized work items, dependencies, priorities, first sprint, and release blockers |
| 10 | [First Sprint Execution Plan](10-first-sprint-execution-plan.md) | Foundation sprint scope, target files, implementation order, tests, and handoff notes |
| 11 | [Second Sprint Execution Plan](11-second-sprint-execution-plan.md) | Graph service, diagnostics, progress engine foundation, parity checks, and Sprint 3 handoff |
| 12 | [Third Sprint Execution Plan](12-third-sprint-execution-plan.md) | First UI integration for Strategy cards, Division/Unit rows, KRA/KPI rows, analytics, and report previews |
| 13 | [Fourth Sprint Execution Plan](13-fourth-sprint-execution-plan.md) | Workflow integration for task cascades, breadcrumbs, KRA/KPI validation, and destructive-action safeguards |
| 14 | [Fifth Sprint Execution Plan](14-fifth-sprint-execution-plan.md) | Reporting and evidence implementation for traceability, heatmaps, diagnostics, exports, and schedules |
| 15 | [Sixth Sprint Execution Plan](15-sixth-sprint-execution-plan.md) | Governance, audit visibility, UAT, release readiness, release blockers, and post-release monitoring |
| 16 | [Controlled Release and Monitoring Plan](16-controlled-release-and-monitoring-plan.md) | Final UAT, sign-off, deployment, monitoring, escalation, rollback, and stabilization playbook |
| 17 | [Operational Runbook and Continuous Improvement](17-operational-runbook-and-continuous-improvement.md) | Business-as-usual governance cadence, diagnostics, report operations, stewardship, and improvement backlog |

## Recommended Implementation Sequence

1. Confirm the business model in Phase 2 with leadership and operational owners.
2. Lock the graph and progress contracts in Phases 3 and 4 before changing many UI surfaces.
3. Complete the backend hardening work in Phase 5 before relying on progress totals.
4. Upgrade the Strategy page, hierarchy views, and modal workflows in Phase 6.
5. Build the reporting and governance layer in Phase 7.
6. Use Phase 8 as the release gate for UAT, rollout, and sign-off.
7. Use the implementation backlog to create engineering tickets and sprint plans.
8. Use the first sprint execution plan to begin backend safety and shared contract work.
9. Use the second sprint execution plan to build graph/progress foundations before major UI rewiring.
10. Use the third sprint execution plan to begin visible graph/progress integration without destabilizing workflows.
11. Use the fourth sprint execution plan to make task, KRA, and KPI workflows protect the strategy execution chain at save time.
12. Use the fifth sprint execution plan to turn graph/progress/workflow data into formal reports, evidence views, exports, and schedule visibility.
13. Use the sixth sprint execution plan to complete governance, UAT, release readiness, and post-release monitoring.
14. Use the controlled release and monitoring plan as the final operational release playbook.
15. Use the operational runbook to keep strategy execution trustworthy after release.

## Key Product Decisions

- The Strategy page remains the executive cockpit.
- The Unit page remains the execution workspace.
- Reports become the evidence and accountability layer.
- Existing SharePoint lists should be preserved where possible.
- `KRA` language should be separated into:
  - `Organisational KRA / Key Deliverable` for strategy-level outcomes.
  - `Performance KRA` for Unit execution screens.
- Progress percentages should come from one shared model.
- `0% Not Started` and `0% No Linked Data` must be visually and semantically different.

## Implementation Guardrails

- Do not create another local progress formula inside a page or modal once the shared progress engine exists.
- Do not allow strategic tasks to save with fake linkage values such as `none`.
- Do not allow KPI parent moves without recalculating both the old and new parent.
- Do not report summary totals without exposing the hierarchy and scope behind them.
- Do not treat role-scoped totals as corporate totals unless the report clearly states the active scope.
- Do not hide broken linkage; surface it as diagnostics.

## Completion Signal

This roadmap is complete when Strategy cards, Division/Unit rows, KRAs, KPIs, tasks, analytics, and reports all agree on:

- hierarchy,
- ownership,
- progress,
- status band,
- scope,
- evidence,
- and linkage health.
