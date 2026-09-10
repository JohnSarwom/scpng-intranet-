# Strategy Execution Roadmap

## Developer handoff — start here (10 September 2026)

Read the **[current developer handoff](2026-09-10-developer-handoff.md)** first, then the [9 September consolidated handoff](2026-09-09-developer-handoff.md) for the complete earlier implementation and recovery details. The current handoff adds the scheduler tenant inventory, fail-closed readiness manifest, offline GitHub quality gate, authorized production schema result and locally verified tenant adapters to the reporting, archive, AI, governance and trusted-executor foundation. The older numbered roadmap and sprint documents describe earlier proposals; their phase numbers and completion language must not be treated as the present status.

| Current evidence | Purpose |
|---|---|
| [Developer handoff](2026-09-10-developer-handoff.md) | Primary starting point and current Phase 4F continuation instructions |
| [9 September developer handoff](2026-09-09-developer-handoff.md) | Consolidated Phase 1–4D implementation, recovery and transfer details |
| [Prior developer handoff](2026-09-08-developer-handoff.md) | Detailed Phase 1–2B implementation and source evidence |
| [Remediation phases](2026-09-07-remediation-phases.md) | Phase 1 / 2A / 2B results and remaining Phases 3–5 |
| [Application linkage audit](2026-09-07-task-to-goal-audit.md) | Original 22 findings, code evidence and controlled examples |
| [LIS source alignment audit](2026-09-07-lis-workplan-source-alignment-audit.md) | Planning-model reference; automated import recommendations are superseded |
| [Phase 2B implementation report](2026-09-07-phase-2b-activation.md) | Activation, source metadata, storage and recovery changes |
| [Phase 3 P1B graph integrity](2026-09-08-phase-3-p1b-graph-integrity.md) | Conservation, scoping, exceptions and graph diagnostics |
| [Phase 3 P1C measurement evidence](2026-09-08-phase-3-p1c-measurement-evidence.md) | Specialized KPI definitions, dated evidence and fail-closed calculations |
| [Phase 3 P1D activity retirement](2026-09-09-phase-3-p1d-activity-retirement.md) | Reviewed activated-row retirement/reassignment, impact previews and recovery checkpoints |
| [Phase 3 P1E structure retirement](2026-09-09-phase-3-p1e-structure-retirement.md) | Reviewed goal/source-KRA subtree retirement and reassignment with evidence conservation |
| [Phase 4C governance history](2026-09-09-phase-4c-governance-history.md) | Authorized read-only retirement history, audit evidence and recovery visibility |
| [Phase 4D scheduled-delivery executor](2026-09-09-phase-4d-scheduled-delivery-executor.md) | Archive-bound executor protocol, idempotent retries, leases and legacy-flow quarantine |
| [Phase 4E scheduler tenant readiness](2026-09-10-phase-4e-scheduler-tenant-readiness.md) | GET-only schema/ETag inventory and evidence-gated activation manifest |
| [Phase 4F offline quality gate](2026-09-10-phase-4f-offline-quality-gate.md) | GitHub-ready local regression, TypeScript-baseline and production-build checks |
| [Phase 5 production readiness inventory](2026-09-10-phase-5-production-readiness-inventory.md) | Authenticated GET-only production schema/ETag result and exact blockers |
| [Phase 5A tenant-adapter implementation](2026-09-10-phase-5a-tenant-adapter-implementation.md) | Exact SharePoint archive/journal/checkpoint adapters, idempotent email adapter and controlled-UAT boundary |
| [Handoff evidence](handoff-evidence/README.md) | Preserved validation outputs and file fingerprints |

**Stop point:** Phase 2B, all Phase 3 integrity/lifecycle slices and Phase 4 implementation are complete. GitHub pull request #1 has green quality and Vercel preview checks. The authenticated [Phase 5 production inventory and schema remediation](2026-09-10-phase-5-production-readiness-inventory.md) confirms both required lists, ETags, fields and indexes; `schemaReadyForAdapterImplementation` is `true`. The [Phase 5A tenant adapters](2026-09-10-phase-5a-tenant-adapter-implementation.md) are implemented and locally tested but remain unwired. Service-identity provisioning, provider configuration, capability UAT, email and activation remain gated; no list items or permissions changed, and no merge or production application deployment has occurred. Independently calculated legacy flows remain hard-quarantined. The LIS document is a planning guide only, and the LIS team will enter its own data manually; no automated LIS import is planned.

---

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

Current local implementation evidence: [Phase 4 immutable report archive and generation history](2026-09-09-phase-4-report-archive.md).

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
