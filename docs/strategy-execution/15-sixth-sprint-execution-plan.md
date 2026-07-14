# Sixth Sprint Execution Plan

## Purpose

This file defines the sixth implementation sprint for the strategy execution program. Sprint 5 creates the formal reporting and evidence layer. Sprint 6 turns that reporting layer into governance, audit visibility, release readiness, and post-release monitoring.

The goal is to prove that the strategy execution system is not only functional, but controllable, reviewable, and safe to release.

## Sprint Objective

Complete governance and rollout hardening by:

- adding KPI review governance visibility,
- implementing owner accountability and progress variance reports,
- exposing admin/audit schedule and delivery status views,
- defining a diagnostic cleanup workflow,
- preparing UAT scripts and acceptance evidence,
- creating the release readiness checklist,
- and defining post-release monitoring signals.

## Target Backlog Items

| Backlog ID | Priority | Sprint Treatment |
| --- | --- | --- |
| SE-506 | P2 | Implement Owner Accountability Report |
| SE-508 | P2 | Complete scheduled report lifecycle and admin/audit visibility |
| SE-604 | P1 | Complete report validation scenarios for schedules, role scopes, and exports |
| SE-605 | P1 | Run UAT with staff, manager, division owner, admin, and audit roles |
| SE-606 | P0 | Complete final sign-off checklist |
| Phase 7 governance | P1 | Add KPI review governance and progress variance visibility |
| Phase 8 monitoring | P1 | Add post-release monitoring and release blocker rules |

## Primary Code Areas

| Area | Sprint Purpose |
| --- | --- |
| `src/components/unit-tabs/ReportsTab.tsx` | Governance reports, schedule status, admin/audit report views |
| `src/components/division/tabs/DivisionReportsTab.tsx` | Division reporting consistency and rollout validation |
| `src/services/sharePointOpsService.ts` | Report schedule lifecycle fields, saved report metadata, delivery status updates |
| `src/services/strategyExecutionGraphService.ts` | Diagnostic cleanup queues and audit/admin graph views |
| `src/utils/strategyReportUtils.ts` | Owner accountability, variance, governance, and schedule report row builders |
| `src/types/strategyExecution.ts` | Governance, audit, report status, diagnostic workflow, and sign-off types |
| `src/components/unit-tabs/KRAsTab.tsx` | KPI review status, reviewer/authority visibility, and governance signal consistency |

## Governance Principles

### 1. Governance Is About Trust, Not Extra Decoration

Governance surfaces should answer:

- Who owns this result?
- Who reviewed it?
- What evidence supports it?
- What changed?
- What is missing?
- What needs action before sign-off?

Acceptance:

- Governance information is actionable.
- Reports show next action, not only risk labels.
- Admin/audit users can find records that need cleanup or review.

### 2. KPI Review Must Be Visible

KPI review status should be reportable where review workflows exist.

Minimum states:

```text
Draft
Submitted
Approved
Returned / Rejected
Needs Evidence
Archived
```

Acceptance:

- KPI review state is visible in governance reports.
- Reviewer/authority is visible where available.
- Rejected or returned KPIs include a reason where available.
- Completed KPIs without evidence are flagged.

### 3. Owner Accountability Must Be Traceable

Owner accountability should connect people to outcomes and exceptions.

Acceptance:

- Owner reports show assigned goals, KRAs, KPIs, tasks, overdue items, missing evidence, diagnostics, and next action.
- Report rows include scope so staff, manager, division, corporate, and audit views remain clear.
- Accountability reports do not shame users with misleading totals from outside their scope.

### 4. Progress Variance Must Be Visible

Stored progress and calculated progress may temporarily differ. That difference should be visible.

Acceptance:

- Variance report compares cached/stored progress with graph-calculated progress.
- Differences over an agreed threshold are flagged.
- Variance rows identify entity type, ID, owner, stored value, calculated value, difference, and recommended action.

### 5. Release Requires Evidence

Release readiness should depend on captured evidence, not memory.

Acceptance:

- UAT scenarios have pass/fail records.
- Report exports are retained as sample evidence.
- Critical and high defects are resolved or formally accepted.
- Business, technical, reporting, governance, and release owners sign off.

## Proposed Implementation Order

### Step 1: Add Governance Report Row Builders

Suggested location:

```text
src/utils/strategyReportUtils.ts
```

Suggested builders:

```ts
buildOwnerAccountabilityRows(graph, progressResults)
buildKpiReviewGovernanceRows(graph)
buildProgressVarianceRows(graph, progressResults)
buildScheduleAuditRows(schedules)
buildDiagnosticCleanupRows(graph)
```

Acceptance:

- Governance rows are built from graph/progress/report schedule data.
- Row builders are testable without React.
- Reports tab can render governance sections without duplicating graph traversal.

### Step 2: Implement Owner Accountability Report

Rows should show:

- owner/assignee,
- role or scope,
- Division,
- Unit,
- Strategic Goal,
- Organisational KRA / Key Deliverable,
- Performance KRA,
- KPI,
- linked tasks,
- overdue tasks,
- missing evidence count,
- diagnostic count,
- progress,
- next action.

Acceptance:

- Managers can see who owns blocked, overdue, or missing-evidence work.
- Staff users do not see misleading corporate-level accountability totals.
- Admin/audit users can see cross-scope accountability.

### Step 3: Implement KPI Review Governance Report

Rows should show:

- KPI,
- Performance KRA,
- Objective / Initiative,
- Unit,
- Division,
- owner,
- reviewer/authority,
- review status,
- submitted date where available,
- approved/rejected date where available,
- rejection/return reason where available,
- evidence health,
- next action.

Acceptance:

- Pending and returned KPIs are visible.
- Approved KPIs without evidence are flagged where applicable.
- Review status is not confused with progress status.

### Step 4: Implement Progress Variance Report

Rows should show:

- entity type,
- entity ID,
- title,
- owner,
- scope,
- stored progress,
- calculated progress,
- variance,
- calculation source,
- diagnostic count,
- recommended action.

Acceptance:

- Cached vs calculated mismatches are visible.
- Large differences can be filtered or highlighted.
- Variance report helps identify stale stored progress and formula drift.

### Step 5: Add Admin/Audit Schedule Dashboard

Schedule dashboard should expose:

- all schedules by owner and scope,
- active/inactive schedules,
- due schedules,
- failed schedules,
- last sent,
- next send,
- delivery status,
- delivery error,
- generated but not delivered reports,
- schedules missing `NextSendAt`,
- reports delivered without updated `LastSentAt`.

Acceptance:

- Admin/audit users can identify failed or stuck schedules.
- Schedule metadata is separate from delivery status.
- Failures have enough context for manual recovery.

### Step 6: Add Diagnostic Cleanup Workflow

Diagnostic cleanup queue should group:

- tasks without KPI,
- tasks without KRA,
- KPIs without KRA,
- KRAs without objective,
- objectives without strategic goal,
- divisions/units with no linked execution data,
- cached/calculated progress variance,
- completed work without evidence.

Recommended cleanup states:

```text
Open
Assigned
In Review
Resolved
Accepted Risk
Deferred
```

Acceptance:

- Admin/audit users can see which diagnostics block release.
- Cleanup actions are grouped by severity and owner.
- Some diagnostics can be marked accepted risk with rationale.

### Step 7: Prepare UAT Script

UAT script should include the Phase 8 scenarios:

- full cascade creation,
- task completion progress cascade,
- manual KPI update,
- checklist KPI update,
- task-completion KPI update,
- KPI move between KRAs,
- guarded KRA delete/archive,
- traceability report generation,
- Division/Unit percentage consistency,
- role scope verification,
- zero percent state validation,
- large dataset/pagination validation,
- CSV hierarchy export validation,
- schedule visibility validation.

Acceptance:

- Each scenario has test steps, expected result, tester role, evidence required, and pass/fail outcome.
- UAT can be run by business users without reading implementation code.

### Step 8: Create Release Readiness Checklist

Checklist should cover:

- business model sign-off,
- backend safety sign-off,
- graph/progress sign-off,
- frontend workflow sign-off,
- reporting sign-off,
- governance/audit sign-off,
- data cleanup status,
- unresolved defects,
- rollback plan,
- monitoring plan,
- release owner approval.

Acceptance:

- Release cannot be approved without owners and evidence.
- Critical and high issues are resolved or formally accepted.
- Known risks are visible before production deployment.

### Step 9: Define Post-Release Monitoring

Monitor during the first release window:

- new linkage diagnostics per day,
- orphaned tasks/KPIs/KRAs/objectives,
- progress variance count,
- traceability report generation failures,
- scheduled report delivery failures,
- SharePoint query paging errors,
- user feedback on task and KRA/KPI modal workflows,
- Division/Unit rows showing `No Linked Data`,
- completed work without evidence,
- failed or stuck schedules.

Acceptance:

- Monitoring signals have owners.
- Critical mismatches between Strategy page and report progress block continued rollout.
- There is a clear escalation path for data integrity issues.

## UAT Evidence Requirements

For each UAT case, capture:

- test case ID,
- tester,
- role,
- scope,
- date,
- records created or changed,
- expected result,
- actual result,
- screenshot or exported report evidence where useful,
- defect link if failed,
- retest result,
- sign-off.

Reports and CSV exports generated during UAT should be retained as regression examples.

## Release Blockers

The release should not proceed if any of these remain unresolved:

- Strategy page progress and report progress disagree for the same scope/date.
- Strategic tasks can save with fake linkage values.
- KPI parent moves create duplicate parentage or orphaned KPIs.
- `task-completion` KPIs lose their calculation mode.
- `0% Not Started` and `0% No Linked Data` render identically.
- Traceability reports cannot export hierarchy rows.
- Admin/audit users cannot see failed scheduled reports.
- Role-scoped totals appear as corporate totals.
- Critical diagnostics have no cleanup plan or accepted-risk decision.
- Critical or high UAT defects remain open.

## Sprint 6 Acceptance Criteria

The sprint is complete when:

- Owner Accountability Report exists.
- KPI Review Governance Report exists where review data is available.
- Progress Variance Report exists.
- Admin/audit schedule dashboard or equivalent view exposes failures and lifecycle state.
- Diagnostic cleanup workflow is defined and visible to admin/audit users.
- UAT script is ready and aligned to Phase 8 scenarios.
- Release readiness checklist exists with owners and evidence requirements.
- Post-release monitoring signals are defined.
- Release blockers are explicit.
- `npm run test`, `npm run lint`, and `npm run build` pass or documented failures are triaged.
- Browser validation confirms governance reports, schedule status, and admin/audit views.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Governance views become too broad | Start with report-backed views and prioritized exception queues |
| Review status data is incomplete | Show unknown/not captured states rather than inventing review outcomes |
| Progress variance creates confusion | Explain stored vs calculated progress and provide recommended actions |
| Admin/audit visibility exposes too much to normal users | Gate views by role and clearly label scope |
| UAT becomes informal | Require test IDs, evidence, defects, retests, and sign-off |
| Release blockers are discovered late | Run diagnostic cleanup and parity checks before final UAT |

## Out Of Scope For Sprint 6

- New business strategy model changes.
- Large visual redesign unrelated to governance or release readiness.
- Full historical data remediation unless required for release.
- Building a new external reporting platform.
- Replacing SharePoint lists with a new datastore.

## Handoff Notes For Release

After Sprint 6, the program should move into controlled release:

- run UAT,
- complete data cleanup or accepted-risk decisions,
- finalize sign-offs,
- prepare release notes,
- deploy in a controlled window,
- monitor the first release period,
- triage diagnostics and schedule failures daily,
- and preserve UAT/report exports as regression evidence.

Any post-release defect that causes strategy progress to disagree with report progress should be treated as a high-priority data integrity issue.
