# Strategy Execution Implementation Backlog

## Purpose

This backlog converts the strategy execution roadmap into buildable engineering work. It should be used after the roadmap has been reviewed and before implementation tickets are created in the project tracker.

The backlog is ordered to reduce rework:

1. Lock the model.
2. Harden the data layer.
3. Build the graph and progress foundations.
4. Wire the UI to the shared model.
5. Build traceability reporting.
6. Validate with acceptance tests.

## Priority Legend

| Priority | Meaning |
| --- | --- |
| P0 | Required before any reliable rollout |
| P1 | Required for full user-facing strategy execution |
| P2 | Important enhancement or operational hardening |

## Epic 1: Business Model And Data Contract

Goal: make the official hierarchy, naming, ownership, and required relationships explicit before implementation starts.

| ID | Priority | Work Item | Dependencies | Acceptance |
| --- | --- | --- | --- | --- |
| SE-001 | P0 | Confirm the canonical hierarchy from Strategic Goal to Evidence / Report | Roadmap Phase 2 | Product and technical owners agree on the hierarchy |
| SE-002 | P0 | Confirm KRA naming standard: Organisational KRA / Key Deliverable vs Performance KRA | SE-001 | UI copy and docs use the two labels consistently |
| SE-003 | P0 | Define required lookup fields and nullable linkage rules | SE-001 | No fake values such as `none` are used as saved linkages |
| SE-004 | P0 | Define ownership model across goal, division, unit, KRA, KPI, and task | SE-001 | Reports can identify accountable owner at every level |
| SE-005 | P1 | Define migration behavior for incomplete existing records | SE-003 | Existing records are preserved and diagnostics are produced |

## Epic 2: Backend Linkage Hardening

Goal: make SharePoint writes, updates, deletes, and reads safe enough to support the graph and progress model.

| ID | Priority | Work Item | Dependencies | Acceptance |
| --- | --- | --- | --- | --- |
| SE-101 | P0 | Add shared lookup normalization helper for optional SharePoint lookup fields | SE-003 | Empty, undefined, and `none` values become `null` before writes |
| SE-102 | P0 | Apply lookup normalization to task, KPI, KRA, objective, and report schedule writes | SE-101 | No new records are created with fake parent IDs |
| SE-103 | P0 | Align TypeScript status enums with SharePoint choice values | SE-003 | Create/update operations preserve valid statuses |
| SE-104 | P0 | Fix KPI update flow so a KPI can safely move between Performance KRAs | SE-101 | Old and new parent KRAs both recalculate |
| SE-105 | P0 | Preserve `task-completion` KPI calculation type during create/update/sync | SE-103 | Task-linked KPIs are not converted to checklist |
| SE-106 | P1 | Add guarded delete/archive/reassign behavior for KRAs with child KPIs/tasks | SE-104 | No orphaned KPI/task records remain after destructive actions |
| SE-107 | P1 | Add paged/scoped querying for large task, KPI, KRA, objective, and report datasets | None | Reports and progress totals do not miss SharePoint pages |
| SE-108 | P2 | Replace noisy debug logging with controlled diagnostics | None | Normal usage logs are readable and actionable |

## Epic 3: Strategy Execution Graph Service

Goal: centralize parent/child relationships so every page and report reads the same strategy execution graph.

| ID | Priority | Work Item | Dependencies | Acceptance |
| --- | --- | --- | --- | --- |
| SE-201 | P0 | Create conceptual and TypeScript types for `StrategyExecutionGraph` | SE-001 | Types represent goals, KRAs, objectives, KPIs, tasks, divisions, units, reports, and diagnostics |
| SE-202 | P0 | Implement graph loader that combines existing SharePoint list data | SE-107 | One service returns normalized strategy execution graph data |
| SE-203 | P0 | Implement relationship resolver for goal, KRA, objective, KPI, task, division, and unit links | SE-202 | Consumers do not manually rebuild parent/child relationships |
| SE-204 | P0 | Implement linkage diagnostics | SE-203 | Service reports tasks without KPI, KPIs without KRA, KRAs without objective, objectives without goal, and divisions with no execution data |
| SE-205 | P1 | Add scope-aware graph views for corporate, division, unit, manager, staff, and audit views | SE-203 | Reports and UI can request the same graph with explicit scope |
| SE-206 | P1 | Add strategy-first and division-first graph projections | SE-205 | Strategy cards and Division/Unit rows can use purpose-built views |

## Epic 4: Progress Percentage Engine

Goal: calculate every percentage indicator from one shared engine.

| ID | Priority | Work Item | Dependencies | Acceptance |
| --- | --- | --- | --- | --- |
| SE-301 | P0 | Define `ProgressCalculationResult`, `ProgressScope`, and `ProgressStatusBand` types | SE-201 | Types expose percentage, status band, source, diagnostics, and child counts |
| SE-302 | P0 | Implement KPI progress calculators for manual actual/target, checklist, task-completion, and weighted KPI progress | SE-105, SE-202 | KPI progress matches the selected calculation type |
| SE-303 | P0 | Implement parent roll-up rules from KPI to KRA, Objective, Unit, Division, and Strategic Goal | SE-302 | Parent percentages recalculate from linked children |
| SE-304 | P0 | Implement `0% Not Started` vs `0% No Linked Data` logic | SE-204, SE-303 | UI and reports can distinguish valid zero progress from missing linkage |
| SE-305 | P1 | Add cached-progress comparison or reconciliation diagnostics | SE-303 | Reports can flag variance between stored and calculated progress |
| SE-306 | P1 | Add tests for all progress types and parent roll-ups | SE-302, SE-303 | Test suite catches calculation regressions |

## Epic 5: Frontend Strategy And Execution Workflows

Goal: make the Strategy page and Unit execution screens show the same hierarchy, counts, progress, status, and diagnostics.

| ID | Priority | Work Item | Dependencies | Acceptance |
| --- | --- | --- | --- | --- |
| SE-401 | P1 | Wire Strategy cards to graph and progress engine | SE-206, SE-303 | Cards show progress, status, KRA count, KPI count, task count, owner, and evidence health |
| SE-402 | P1 | Make Strategy card KRAs clickable and traceable | SE-401 | User can move from Strategic Goal to linked KRA/objective execution details |
| SE-403 | P1 | Wire Division/Unit hierarchy rows to shared progress engine | SE-206, SE-303 | Division and Unit percentage bars match reports |
| SE-404 | P1 | Add linked KRA/KPI/task counts to Division and Unit rows | SE-403 | Counts match graph and reports |
| SE-405 | P1 | Add clear visual states for not started, no linked data, broken linkage, in progress, on track, and complete | SE-304 | Users can understand percentage state at a glance |
| SE-406 | P1 | Replace single KPI selector in task modal with cascade selectors | SE-203 | Task linkage follows Strategic Goal -> KRA -> Objective -> Performance KRA -> KPI |
| SE-407 | P1 | Add selected hierarchy breadcrumb to task modal before save | SE-406 | User can verify task linkage before saving |
| SE-408 | P1 | Make KRA/KPI modal parent relationships explicit and validated | SE-203 | User cannot accidentally create untraceable KPIs where linkage is required |
| SE-409 | P2 | Add destructive action warnings with child impact preview | SE-106 | KRA/KPI delete or archive flows explain downstream impact |

## Epic 6: Reporting And Governance

Goal: make reports prove execution, evidence, accountability, scope, and linkage health.

| ID | Priority | Work Item | Dependencies | Acceptance |
| --- | --- | --- | --- | --- |
| SE-501 | P1 | Implement Strategic Execution Traceability Report | SE-205, SE-303 | Report shows hierarchy rows from goal to task/evidence |
| SE-502 | P1 | Implement Division/Unit Progress Heatmap | SE-403, SE-501 | Heatmap values match Division/Unit UI bars |
| SE-503 | P1 | Implement KRA/KPI Evidence Report | SE-501 | Completed work without evidence is flagged |
| SE-504 | P1 | Implement Unlinked Records Report | SE-204 | Broken relationships are listed with recommended next action |
| SE-505 | P1 | Implement Overdue Strategic Tasks Report | SE-203 | Overdue work is grouped by owner, KPI, KRA, Unit, and Division |
| SE-506 | P2 | Implement Owner Accountability Report | SE-205 | Report shows owner, assigned work, progress, overdue items, and diagnostics |
| SE-507 | P1 | Expand CSV export to include hierarchy columns and metadata | SE-501 | CSV exports include hierarchy rows, not only summary totals |
| SE-508 | P2 | Strengthen scheduled report lifecycle and admin/audit visibility | SE-501 | Schedules show last sent, next send, delivery status, and failures |

## Epic 7: Testing, Rollout, And Acceptance

Goal: prove the full system works before release.

| ID | Priority | Work Item | Dependencies | Acceptance |
| --- | --- | --- | --- | --- |
| SE-601 | P0 | Create test data covering complete chains, incomplete chains, orphan records, moved KPIs, empty divisions, and large datasets | SE-001 | Test data supports all Phase 8 scenarios |
| SE-602 | P0 | Add automated tests for graph diagnostics and progress calculations | SE-204, SE-306 | Tests catch broken linkage and incorrect percentage roll-ups |
| SE-603 | P1 | Add UI validation scenarios for Strategy cards, Division/Unit rows, task modal, and KRA/KPI modal | SE-401, SE-409 | Critical workflows pass in browser testing |
| SE-604 | P1 | Add report validation scenarios for traceability, heatmap, exports, schedules, and role scopes | SE-501, SE-508 | Report values match UI values for same scope/date |
| SE-605 | P1 | Run UAT with staff, manager, division owner, admin, and audit roles | SE-603, SE-604 | Role-scoped visibility is accepted |
| SE-606 | P0 | Complete final sign-off checklist | SE-605 | Business, technical, reporting, governance, and release owners approve rollout |

## Recommended First Sprint

The first sprint should avoid visible UI churn and focus on foundations:

1. SE-001: Confirm canonical hierarchy.
2. SE-002: Confirm KRA naming standard.
3. SE-003: Define lookup and nullable linkage rules.
4. SE-101: Add shared lookup normalization helper.
5. SE-103: Align status enums.
6. SE-104: Fix KPI parent movement.
7. SE-105: Preserve task-completion KPI type.
8. SE-201: Define graph types.
9. SE-301: Define progress result types.

This gives the project a stable vocabulary, safer backend writes, and clear interfaces before the Strategy page and modal workflows are rebuilt.

## Release Blockers

The release should not proceed if any of these remain unresolved:

- Strategic tasks can save with fake linkage values.
- KPI parent moves do not recalculate both parent KRAs.
- `task-completion` KPI calculation type is lost during sync.
- Division/Unit percentages do not match reports for the same scope.
- `0% Not Started` and `0% No Linked Data` are visually identical.
- Traceability reports export only summary totals.
- Scheduled reports can fail without visible status.
- Role-scoped report totals are presented as corporate totals.

## Backlog Maintenance Rules

- Keep this backlog aligned with the roadmap phase files.
- Split any work item that cannot be completed and tested in one sprint.
- Add implementation links once tickets or pull requests exist.
- Update acceptance notes when the product owner changes a rule.
- Treat new relationship or progress formulas as architecture decisions, not local page changes.
