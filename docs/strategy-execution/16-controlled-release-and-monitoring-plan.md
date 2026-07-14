# Controlled Release and Monitoring Plan

## Purpose

This file defines the controlled release plan for the strategy execution program after the six implementation sprints are complete. It is the operational playbook for UAT, sign-off, deployment, early-life monitoring, escalation, and stabilization.

The release should only proceed when the Strategy page, Task Registry, KRAs, KPIs, Division/Unit hierarchy, progress percentages, reports, exports, governance views, and scheduled reports operate from the same traceable model.

## Release Objective

Release the strategy execution model safely by:

- proving the full Strategy -> KRA -> KPI -> Task -> Evidence chain in UAT,
- confirming progress parity across Strategy, Unit, Analytics, and Reports,
- resolving or accepting critical diagnostics,
- approving release sign-offs,
- deploying in a controlled window,
- monitoring data integrity and scheduled reporting,
- and stabilizing the rollout before wider adoption.

## Release Readiness Gates

| Gate | Required Evidence | Release Decision |
| --- | --- | --- |
| Business model gate | Approved hierarchy, naming standard, ownership model, scope rules | Required before UAT |
| Backend safety gate | Lookup normalization, status mapping, KPI movement, task-completion preservation, guarded delete tests | Required before UAT |
| Graph/progress gate | Graph diagnostics, progress engine tests, parity checks | Required before UAT |
| Frontend workflow gate | Strategy cards, Division/Unit rows, task modal, KRA/KPI modal browser validation | Required before UAT |
| Reporting gate | Traceability report, heatmap, evidence, unlinked records, CSV/export validation | Required before UAT |
| Governance gate | Owner accountability, KPI review, progress variance, schedule status, diagnostic cleanup visibility | Required before release |
| UAT gate | Signed UAT evidence, defect log, retest results | Required before release |
| Monitoring gate | Owners, signals, escalation path, release blocker rules | Required before release |

## UAT Plan

### UAT Participants

UAT should include users who represent the full reporting and execution chain:

- staff user,
- unit manager,
- division owner,
- strategy/product owner,
- reporting owner,
- admin user,
- audit/governance user,
- technical owner.

### UAT Test Data

UAT data should include:

- at least one complete Strategic Goal chain,
- at least one chain with valid `0% Not Started`,
- at least one record with `0% No Linked Data`,
- at least one broken linkage diagnostic,
- at least one manual KPI,
- at least one checklist KPI,
- at least one task-completion KPI,
- at least one overdue strategic task,
- at least one completed task with evidence,
- at least one completed task without evidence,
- at least one scheduled report,
- enough records to prove paging/scoped queries do not drop data.

### UAT Scenarios

| ID | Scenario | Required Roles | Evidence |
| --- | --- | --- | --- |
| UAT-001 | Create full Strategic Goal -> Evidence chain | Admin, manager | Screenshots, traceability report |
| UAT-002 | Complete linked task and verify progress cascade | Staff, manager | Strategy card, KRA/KPI row, report values |
| UAT-003 | Update manual KPI actual/target | Manager | KPI row, report calculation source |
| UAT-004 | Update checklist KPI | Manager | Checklist state, parent progress |
| UAT-005 | Complete task-completion KPI work | Staff, manager | KPI mode preserved, report source |
| UAT-006 | Move KPI between KRAs | Manager/admin | Old and new parent recalculation |
| UAT-007 | Attempt guarded KRA delete/archive | Manager/admin | Child impact warning, no orphan result |
| UAT-008 | Generate traceability report | Reporting owner | Report preview, CSV export |
| UAT-009 | Generate Division/Unit heatmap | Division owner | Heatmap vs Strategy hierarchy comparison |
| UAT-010 | Run role-scope verification | Staff, manager, admin, audit | Scope-labelled screenshots |
| UAT-011 | Verify zero percent states | Product owner | Not Started vs No Linked Data evidence |
| UAT-012 | Validate scheduled report status | Admin/audit | Last sent, next send, failure state |
| UAT-013 | Validate unlinked records report | Admin/audit | Diagnostic cleanup queue |
| UAT-014 | Validate CSV hierarchy export | Reporting owner | Export file retained |

## Defect Triage Rules

| Severity | Meaning | Release Impact |
| --- | --- | --- |
| Critical | Data integrity, wrong progress totals, broken save, security/scope leak, report mismatch | Blocks release |
| High | Major workflow or report failure with no acceptable workaround | Blocks release unless formally accepted |
| Medium | Usability issue or limited workflow defect with workaround | Can release with owner-approved plan |
| Low | Cosmetic or minor wording issue | Can release with backlog item |

Critical examples:

- Strategy page progress disagrees with report progress for the same scope/date.
- Strategic task saves fake linkage values.
- KPI movement creates orphaned or duplicate parent records.
- Role-scoped totals are shown as corporate totals.
- Audit/admin cannot see failed scheduled reports.
- Traceability export drops hierarchy rows.

## Final Sign-Off

| Sign-Off Area | Owner | Required Evidence |
| --- | --- | --- |
| Business model | Strategy/product owner | Approved hierarchy and naming standard |
| Backend safety | Technical lead | Test results for linkage, movement, calculation type, guarded delete, pagination |
| Graph/progress model | Technical and product owners | Progress parity checks and diagnostic results |
| Frontend workflows | Product owner and pilot users | Modal, card, hierarchy, and KRA/KPI screenshots |
| Reporting | Reporting owner | Traceability, heatmap, evidence, CSV/export samples |
| Governance/audit | Admin/audit owner | Diagnostic cleanup, variance, schedule status, audit visibility |
| Release readiness | Project owner | UAT pass summary, unresolved risk log, rollback plan |

No sign-off should be verbal only. Each sign-off should reference evidence or a retained artifact.

## Deployment Plan

### Pre-Deployment

Complete before release window:

- confirm release branch/build,
- confirm environment variables and SharePoint permissions,
- confirm existing SharePoint lists are preserved,
- confirm backup/export of key SharePoint lists where practical,
- freeze strategy execution schema changes during deployment window,
- confirm rollback plan,
- confirm monitoring owners,
- notify pilot users and stakeholders.

### Deployment Window

During release:

1. Deploy application build.
2. Confirm authentication and role access.
3. Confirm Strategy page loads.
4. Confirm Unit workspace loads.
5. Confirm Task modal can create a non-strategic task.
6. Confirm Task modal can create a strategic linked task.
7. Confirm KRA/KPI modal can load and save a safe edit.
8. Confirm traceability report preview generates.
9. Confirm CSV export includes hierarchy rows.
10. Confirm scheduled report view loads.
11. Confirm admin/audit diagnostic view loads.

### Post-Deployment Smoke Test

Run immediately after deployment:

- Strategy card progress check.
- Division/Unit progress check.
- KRA/KPI row progress check.
- Task completion progress cascade check.
- Traceability report generation.
- Heatmap report generation.
- CSV export.
- Role-scope check for staff, manager, admin/audit.
- Schedule status check.

## Monitoring Plan

### Monitoring Window

Monitor closely for:

- first business day,
- first reporting cycle,
- first scheduled report delivery,
- first weekly management review,
- first month-end reporting cycle.

### Monitoring Signals

| Signal | Owner | Trigger |
| --- | --- | --- |
| New linkage diagnostics | Admin/data steward | Daily increase above agreed threshold |
| Orphaned tasks/KPIs/KRAs/objectives | Technical owner | Any new orphan after release |
| Strategy/report progress variance | Technical and reporting owners | Any critical mismatch |
| Scheduled report failures | Reporting owner | Any failed delivery or missing next send |
| SharePoint paging/query errors | Technical owner | Any report or graph truncation |
| Completed work without evidence | Governance owner | Increase above agreed threshold |
| Role-scope confusion | Product owner | User feedback or report misuse |
| Modal save errors | Technical owner | Repeated task/KRA/KPI save failures |
| No Linked Data rows | Strategy/product owner | Unexpected increase by division/unit |

## Escalation Rules

| Issue | First Response | Escalation |
| --- | --- | --- |
| Wrong progress value | Compare graph result, stored value, report output, and scope | Technical lead and reporting owner |
| Broken linkage after save | Inspect saved lookup values and graph diagnostics | Technical lead |
| Role-scope exposure issue | Disable affected view if necessary | Product owner, admin, technical lead |
| Scheduled report failure | Check schedule metadata, delivery status, automation logs | Reporting owner, technical lead |
| Export missing hierarchy rows | Compare preview rows to export rows | Reporting owner, technical lead |
| Widespread diagnostics spike | Pause wider rollout and run cleanup queue | Project owner, admin/audit owner |

## Rollback And Containment

Rollback should be considered if:

- critical progress mismatches cannot be corrected quickly,
- strategic tasks are saving corrupt linkage,
- reports are exporting materially wrong traceability rows,
- role-scoped data is exposed incorrectly,
- deployment blocks normal task/KRA/KPI operations.

Containment options:

- disable new reporting views while preserving core task operations,
- hide admin/audit dashboard if role gating fails,
- temporarily mark scheduled reports inactive,
- revert frontend release while preserving SharePoint data,
- run diagnostic cleanup and re-enable in phases.

Rollback should avoid destructive SharePoint changes unless explicitly approved.

## Stabilization Checklist

The release is considered stable when:

- no critical defects remain open,
- high defects have fixes or approved workarounds,
- Strategy and report progress values match for agreed scopes,
- scheduled reports show correct lifecycle status,
- CSV exports include hierarchy rows,
- diagnostics are trending down or under control,
- pilot users can complete core workflows,
- admin/audit users can see cleanup and schedule status,
- release evidence is stored and accessible.

## Post-Release Review

Hold a post-release review after the first reporting cycle.

Review:

- UAT misses,
- release defects,
- diagnostic trends,
- progress variance trends,
- user feedback,
- report generation performance,
- schedule delivery health,
- remaining data cleanup,
- backlog items for the next hardening cycle.

Output:

- accepted lessons learned,
- updated backlog,
- confirmed monitoring adjustments,
- and any required documentation updates.

## Release Completion Criteria

The controlled release is complete when:

- all required sign-offs are recorded,
- UAT evidence is retained,
- deployment smoke tests pass,
- monitoring window is complete,
- no critical release blockers remain,
- unresolved risks are accepted by named owners,
- and the Strategy page, Task Registry, KRAs, KPIs, Division/Unit hierarchy, Reports, exports, and schedules all operate from the same strategy execution model.
