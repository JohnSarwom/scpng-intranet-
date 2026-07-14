# Phase 8: Testing, Rollout, and Acceptance

## Purpose

This phase turns the strategy execution roadmap into a verifiable implementation and rollout checklist. The work is only complete when the full cascade can be created, updated, reported, audited, and trusted across the Strategy page, Unit workspace, Task Registry, percentage indicators, analytics, and scheduled reports.

The acceptance standard is simple: the same execution data must produce the same relationships, progress values, status bands, diagnostics, and report totals everywhere it appears.

## Test Strategy

Testing should prove five things:

1. The hierarchy is linked correctly from Strategic Goal to Evidence.
2. Progress percentages are calculated consistently across all surfaces.
3. Broken or missing relationships are visible as diagnostics.
4. Reports can prove execution, evidence, ownership, and scope.
5. Role-based views show the right data without changing the underlying totals incorrectly.

Testing should not rely only on happy paths. It must include incomplete chains, orphaned data, moved records, deleted records, empty states, large datasets, and role-scoped views.

## Test Environments

| Environment | Purpose | Required Data |
| --- | --- | --- |
| Local development | Developer validation before pull request | Seed or mocked strategy execution data |
| Test SharePoint site | Integration testing against real list behavior | Controlled copy of strategy, KRA, KPI, task, and report data |
| UAT environment | Business validation with managers/admins | Representative Division/Unit structure and active users |
| Production | Controlled rollout after sign-off | Existing SharePoint lists preserved |

Production rollout should be phased. The backend hardening and graph/progress services should land before major visual workflow changes are enabled for all users.

## Core End-to-End Test Scenarios

### 1. Full Cascade Creation

Create the complete chain:

```text
Strategic Goal
-> Organisational KRA / Key Deliverable
-> Objective / Initiative
-> Performance KRA
-> KPI
-> Task
-> Evidence / Report
```

Acceptance:

- Every record saves successfully to the correct SharePoint list.
- Every record appears in the correct UI surface.
- The graph traces from Strategic Goal to Task without missing links.
- The Task modal displays the selected hierarchy breadcrumb before save.
- The KRA/KPI modal shows the required parent relationship.
- No linkage diagnostics are produced for the newly created chain.
- A traceability report includes the full hierarchy row.

### 2. Task Completion Progress Cascade

Complete a strategic task linked to a KPI.

Acceptance:

- Task status and completion date update correctly.
- KPI progress recalculates according to its calculation type.
- Performance KRA progress recalculates.
- Objective/Initiative progress recalculates.
- Unit progress recalculates.
- Division progress recalculates.
- Strategic Goal progress recalculates.
- Strategy cards, Division/Unit rows, KPI rows, analytics cards, and reports show matching values for the same scope and date range.

### 3. Manual KPI Progress Update

Update a KPI that uses manual actual/target progress.

Acceptance:

- Actual value, target value, and calculated percentage are preserved.
- Percentage is clamped to valid bounds where required.
- Parent KRA and parent Objective recalculate.
- The progress source is shown as manual actual/target in reports.
- Audit metadata identifies who changed the progress and when.

### 4. Checklist KPI Progress Update

Update a KPI that uses checklist progress.

Acceptance:

- Checklist item completion updates KPI progress.
- Partial completion produces the expected percentage.
- Parent KRA, Unit, Division, and Strategic Goal progress recalculate.
- Reports identify the calculation source as checklist.
- Completed checklist items can be used as evidence where appropriate.

### 5. Task-Completion KPI Progress

Create a KPI whose progress type is task-completion.

Acceptance:

- The calculation type remains task-completion after create, update, and sync.
- Completed linked tasks increase KPI progress.
- Incomplete linked tasks keep KPI progress below 100%.
- Reports identify the calculation source as task-completion.
- The backend does not silently convert the KPI to checklist.

### 6. KPI Move Between KRAs

Move a KPI from one Performance KRA to another.

Acceptance:

- KPI parent lookup updates in SharePoint.
- Old parent KRA recalculates downward or to no linked data if empty.
- New parent KRA recalculates upward based on the moved KPI.
- Reports show the KPI under the new parent only.
- Graph diagnostics do not show duplicate parentage.
- The change is visible in audit/governance history where supported.

### 7. Guarded KRA Delete Or Archive

Attempt to delete or archive a Performance KRA with child KPIs and tasks.

Acceptance:

- User sees the child impact before confirming.
- User can cancel.
- User can choose a supported safe action: reassign children, archive, or explicit cascade delete if permitted.
- No orphaned KPIs or tasks remain after the action.
- Reports and diagnostics reflect the selected action.

### 8. Strategic Execution Traceability Report

Generate a traceability report for a selected scope and date range.

Acceptance:

- Report includes hierarchy rows, not only summary totals.
- Report includes Strategic Goals, Organisational KRAs, Objectives, Performance KRAs, KPIs, Tasks, owners, progress, status bands, evidence health, and diagnostics.
- Report states the active scope.
- Report states the generation time.
- Report states the progress formula.
- CSV/export includes the hierarchy columns required in Phase 7.
- Report values match the Strategy page for the same scope and date range.

### 9. Division/Unit Percentage Consistency

Compare Strategy page Division/Unit hierarchy with reports and analytics.

Acceptance:

- Division percentage bars match report totals.
- Unit percentage bars match report totals.
- KRA/KPI/task counts match report counts.
- Status bands match across surfaces.
- `0% Not Started` is visually distinct from `0% No Linked Data`.
- Empty Division/Unit records do not distort corporate totals.

### 10. Role Scope Verification

Verify staff, manager, division owner, admin, and audit visibility.

Acceptance:

- Staff users see assigned/personal execution data.
- Unit managers see appropriate Unit-level execution data.
- Division owners see appropriate Division-level execution data.
- Admin users can see corporate execution data and diagnostics.
- Audit users can see governance and traceability data.
- Report totals clearly state the active role scope.
- Restricted views do not cause misleading corporate totals.

### 11. Zero Percent And Empty State Validation

Create both cases:

```text
Case A: Valid linked chain with no completed work.
Case B: Record with missing child links or broken parent linkage.
```

Acceptance:

- Case A renders as `0% Not Started`.
- Case B renders as `0% No Linked Data` or `Broken Linkage`.
- Reports separate these states.
- Analytics cards separate these states.
- Empty states provide a clear next action without hiding the issue.

### 12. Large Dataset And Pagination Validation

Run the graph, progress, and report flows against datasets larger than a single SharePoint page.

Acceptance:

- Tasks, KPIs, KRAs, objectives, and report schedules are not silently truncated.
- Progress totals include all scoped records.
- Generated reports include all expected hierarchy rows.
- UI remains responsive with loading and error states.
- Logs do not expose noisy debug output in normal operation.

## Regression Test Matrix

| Area | Minimum Regression Coverage |
| --- | --- |
| Backend linkage | Create, update, move, delete/archive, orphan detection |
| Progress engine | Manual, checklist, task-completion, weighted KPI progress |
| Strategy page | Strategic Goal cards, KRA counts, progress bands, evidence health |
| Division/Unit hierarchy | Percent bars, counts, expanded Unit rows, no-linked-data state |
| Task modal | Cascade selectors, breadcrumb, validation, save behavior |
| KRA/KPI modal | Parent linkage, calculation type, warnings, guarded delete |
| Reports | Traceability, heatmap, evidence, overdue tasks, owner accountability |
| Scheduled reports | Save, edit, delete, next send, last sent, failure state |
| Role scopes | Staff, manager, division owner, admin, audit |
| Exports | CSV hierarchy rows, metadata, progress formula, diagnostics |

## Rollout Plan

### Stage 1: Documentation And Alignment

Deliverables:

- Strategy execution documentation package reviewed.
- Business language agreed: Organisational KRA / Key Deliverable vs Performance KRA.
- Progress bands agreed.
- Report types agreed.
- Acceptance scenarios approved by product, leadership, and technical owners.

Exit criteria:

- No unresolved disagreement on the target hierarchy.
- No unresolved disagreement on progress formulas.
- No unresolved disagreement on reporting scope.

### Stage 2: Backend Hardening

Deliverables:

- Linkage normalization.
- Status enum alignment.
- Safe KPI parent updates.
- Preservation of task-completion calculation type.
- Guarded delete/archive behavior.
- Pagination/scoped querying for large lists.
- Controlled logging.

Exit criteria:

- Backend tests prove no orphaned records after create/update/delete.
- Backend progress sync matches frontend calculation rules.
- Reports do not silently miss paged records.

### Stage 3: Graph And Progress Services

Deliverables:

- `StrategyExecutionGraphService` implementation.
- Shared progress percentage engine.
- Linkage diagnostics.
- Scope-aware progress calculations.

Exit criteria:

- Strategy page, Unit page, Task modal, Reports tab, and analytics can consume the same graph model.
- One calculation engine produces the values for all percentage indicators.

### Stage 4: Frontend Workflow Upgrade

Deliverables:

- Strategy card enhancements.
- Division/Unit percentage and count enhancements.
- Task modal cascade selectors and breadcrumb.
- KRA/KPI modal parent validation.
- No-linked-data and not-started visual distinction.

Exit criteria:

- Users can create and verify the full hierarchy from the UI.
- Users can understand why a percentage is 0%.
- Users can see broken linkage without opening developer tools or raw SharePoint records.

### Stage 5: Reporting And Governance Upgrade

Deliverables:

- Strategic Execution Traceability Report.
- Division/Unit Progress Heatmap.
- Evidence report.
- Unlinked records report.
- Overdue strategic tasks report.
- Owner accountability report.
- Schedule lifecycle and admin/audit views.

Exit criteria:

- Reports prove the same values shown on the Strategy page.
- Reports include hierarchy rows and diagnostic context.
- Scheduled reports clearly show last sent, next send, delivery status, and failure state.

### Stage 6: UAT And Controlled Release

Deliverables:

- UAT script based on this Phase 8 file.
- Representative test data by Division and Unit.
- Stakeholder review of cards, modals, progress bars, and reports.
- Defect log and resolution tracking.
- Release checklist.

Exit criteria:

- All critical and high defects resolved.
- Business owners accept the reporting structure.
- Technical owner signs off backend data safety.
- Admin/audit owner signs off governance visibility.

## Acceptance Evidence To Capture

For each major acceptance test, capture:

- Test case identifier.
- Tester name.
- Test date.
- Role used.
- Scope used.
- Records created or modified.
- Expected result.
- Actual result.
- Screenshots or exported report evidence where useful.
- Defect link if failed.
- Retest result.
- Final sign-off.

The evidence package should be stored somewhere accessible to administrators and implementation owners. Reports generated during acceptance should be retained as examples for future regression testing.

## Definition Of Done

The strategy execution program is ready when:

- One hierarchy model powers strategy execution.
- One progress model powers all percentage indicators.
- Strategy cards, Division/Unit rows, KRAs, KPIs, tasks, analytics, and reports agree.
- Broken relationships are visible as diagnostics.
- Reports prove execution, evidence, accountability, and scope.
- Existing SharePoint lists remain compatible.
- Role-scoped data is correct and clearly labelled.
- CSV/export includes hierarchy rows, not only summary totals.
- Scheduled reports expose last sent, next send, delivery status, and failures.
- Future engineers can implement and maintain the model without redefining the business rules.

## Final Sign-Off Checklist

| Sign-Off Area | Owner | Required Evidence |
| --- | --- | --- |
| Business model | Strategy/product owner | Approved hierarchy and naming standard |
| Backend safety | Technical lead | Linkage, pagination, status, and guarded delete test results |
| Progress model | Product and technical owners | Cross-surface percentage comparison results |
| Frontend workflows | Product owner and pilot users | Task modal, KRA/KPI modal, cards, hierarchy screenshots |
| Reporting | Reporting owner | Traceability report, heatmap, exports, schedule evidence |
| Governance | Admin/audit owner | Audit visibility, diagnostics, evidence rules |
| Release readiness | Project owner | UAT pass summary and unresolved risk log |

## Post-Release Monitoring

For the first release window, monitor:

- New linkage diagnostics per day.
- Orphaned tasks, KPIs, KRAs, and objectives.
- Progress variance between cached values and graph-calculated values.
- Report generation failures.
- Scheduled report delivery failures.
- SharePoint query paging errors.
- User feedback on task and KRA/KPI modal workflows.
- Division/Unit rows showing `No Linked Data`.

Any critical mismatch between Strategy page progress and report progress should be treated as a release blocker until the shared calculation source is confirmed.
