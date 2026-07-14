# Operational Runbook and Continuous Improvement

## Purpose

This file defines the business-as-usual operating model after the strategy execution system is released and stabilized. The roadmap, sprints, and release plan get the system live; this runbook keeps it trustworthy.

The ongoing goal is to ensure the Strategy page, Task Registry, KRAs, KPIs, Division/Unit hierarchy, reports, exports, scheduled reports, diagnostics, and governance views continue to operate as one connected execution system.

## Operating Objective

Maintain a trusted strategy execution model by:

- reviewing progress and diagnostics on a regular cadence,
- keeping strategy, KRA, KPI, task, and report linkages clean,
- ensuring owners and reviewers act on exceptions,
- maintaining scheduled report health,
- capturing improvement requests,
- updating documentation when rules change,
- and preventing local formulas or disconnected workflows from creeping back into the system.

## Operational Roles

| Role | Responsibility |
| --- | --- |
| Strategy/product owner | Owns the hierarchy, terminology, progress bands, and business interpretation |
| Technical owner | Owns graph, progress engine, SharePoint writes, integrations, and release safety |
| Reporting owner | Owns report definitions, exports, schedules, and reporting accuracy |
| Admin/data steward | Owns diagnostic cleanup, missing linkage review, and data quality routines |
| Division owner | Owns Division progress, Unit performance, and manager accountability |
| Unit manager | Owns Unit objectives, Performance KRAs, KPIs, tasks, evidence, and staff follow-up |
| KPI reviewer/authority | Owns KPI review, approval, return/rejection, and evidence expectations |
| Audit/governance owner | Owns traceability, audit visibility, exception review, and accepted-risk decisions |

Every operational check should have a named owner. A dashboard without an owner becomes decorative very quickly.

## Operating Cadence

| Cadence | Primary Activities | Owner |
| --- | --- | --- |
| Daily | Check critical diagnostics, failed scheduled reports, save errors, and scope/security issues | Technical owner, admin/data steward |
| Weekly | Review Division/Unit progress, overdue strategic tasks, evidence gaps, and unlinked records | Division owners, unit managers, reporting owner |
| Monthly | Run executive traceability, heatmap, owner accountability, and progress variance reviews | Strategy/product owner, reporting owner |
| Quarterly | Review strategy model, KRA/KPI relevance, progress formulas, governance rules, and backlog priorities | Leadership, product, technical, governance owners |
| After each release | Review defects, diagnostics, report accuracy, user feedback, and documentation updates | Project owner, technical owner |

## Daily Operations

Daily checks should focus on integrity and interruption risks.

Review:

- failed or stuck scheduled reports,
- new critical linkage diagnostics,
- strategic tasks saved without valid linkage when marked strategic,
- KPI parent movement errors,
- progress variance above agreed threshold,
- role-scope or access issues,
- SharePoint paging/query errors,
- task/KRA/KPI save errors.

Expected response:

- critical issues are triaged the same business day,
- data integrity issues are assigned to a technical owner,
- cleanup issues are assigned to a data steward or business owner,
- scope/security issues are escalated immediately.

## Weekly Operations

Weekly checks should focus on business execution and accountability.

Review:

- Strategic Goals with no linked execution data,
- Organisational KRAs / Key Deliverables without objectives,
- Performance KRAs without KPIs,
- KPIs without linked tasks where task-completion is expected,
- overdue strategic tasks,
- completed work without evidence,
- Division/Unit rows with `No Linked Data`,
- owner accountability exceptions,
- rejected or returned KPIs awaiting action.

Expected response:

- managers update or repair linkages,
- owners provide evidence or mark accepted gaps,
- overdue strategic tasks are assigned next actions,
- reporting owner confirms weekly report outputs remain aligned with Strategy page values.

## Monthly Operations

Monthly checks should focus on management reporting and formal accountability.

Generate and review:

- Strategic Execution Traceability Report,
- Division/Unit Progress Heatmap,
- KRA/KPI Evidence Report,
- Unlinked Records Report,
- Overdue Strategic Tasks Report,
- Owner Accountability Report,
- Progress Variance Report,
- KPI Review Governance Report where applicable.

Expected response:

- leadership receives a scope-labelled progress view,
- diagnostics are reviewed and assigned,
- progress variance is explained or corrected,
- stale KRAs/KPIs/tasks are archived, repaired, or reassigned,
- report schedule health is confirmed before the next reporting cycle.

## Quarterly Operations

Quarterly checks should focus on whether the model still reflects the institution's strategy.

Review:

- whether Strategic Goals remain current,
- whether Organisational KRAs / Key Deliverables still describe the intended outcomes,
- whether Unit Objectives and Performance KRAs still align,
- whether KPI calculation types remain appropriate,
- whether progress bands need refinement,
- whether evidence rules are being followed,
- whether role scopes are still correct,
- whether new report types or exports are required,
- whether the implementation backlog needs reprioritization.

Expected response:

- business-rule changes are documented before implementation,
- roadmap docs are updated when the model changes,
- old execution records are archived or migrated deliberately,
- new work is added to the backlog with acceptance criteria.

## Diagnostic Triage

Diagnostics should be treated as an operational queue.

| Diagnostic | Default Severity | Default Owner | Expected Action |
| --- | --- | --- | --- |
| Strategic task without KPI | Warning/Error | Unit manager, data steward | Link to KPI or mark non-strategic |
| KPI without Performance KRA | Error | Unit manager, technical owner if systemic | Link to parent KRA or archive |
| Performance KRA without Objective | Warning/Error | Unit manager, strategy owner | Link to objective or mark accepted risk |
| Objective without Strategic Goal | Error | Strategy/product owner | Link to Strategic Goal or revise objective |
| Division with no execution data | Info/Warning | Division owner | Confirm no data expected or create linkage |
| Completed work without evidence | Warning | KPI owner, unit manager | Add evidence or justify exception |
| Cached/calculated progress variance | Warning/Error | Technical owner, reporting owner | Recalculate, repair data, or document formula change |
| Failed scheduled report | Warning/Error | Reporting owner | Fix schedule, delivery, or automation issue |

## Diagnostic States

Use consistent states for diagnostic cleanup:

```text
Open
Assigned
In Review
Resolved
Accepted Risk
Deferred
```

Rules:

- `Resolved` requires evidence or a clear data correction.
- `Accepted Risk` requires owner, rationale, and review date.
- `Deferred` requires a target review period.
- Critical diagnostics should not remain open across reporting cycles without escalation.

## Report Operations

Report maintenance should ensure that reports remain trusted artifacts.

Routine checks:

- report preview values match Strategy page values for the same scope/date,
- CSV exports include hierarchy rows,
- report metadata includes scope, generated time, formula/source, and diagnostic count,
- schedules have valid recipient/scope/frequency,
- `LastSentAt`, `NextSendAt`, and delivery status update correctly,
- failed reports are visible to admin/audit users,
- saved reports do not rely on stale local formulas.

Report owners should keep sample monthly exports as regression evidence.

## Data Stewardship Rules

Data stewards should keep records clean without rewriting business meaning casually.

Rules:

- do not delete strategic records only to hide diagnostics,
- prefer archive/reassign/repair over destructive cleanup,
- preserve evidence where possible,
- record accepted risks with owner and rationale,
- do not merge duplicate KRAs without confirming parent objective context,
- do not reclassify strategic tasks as non-strategic just to reduce warnings,
- review orphan cleanup after each major release.

## Change Management

Any change to hierarchy, progress formulas, report definitions, or required linkages should be treated as a governed change.

Change request should include:

- requested change,
- reason,
- affected users,
- affected SharePoint lists,
- affected UI surfaces,
- affected reports/exports,
- migration or cleanup need,
- test scenarios,
- owner approval,
- rollout timing.

Documentation to update:

- target model,
- graph service contract,
- progress engine contract,
- frontend workflow rules,
- reporting/governance rules,
- testing and acceptance scenarios,
- implementation backlog.

## Continuous Improvement Backlog

Maintain a backlog for:

- recurring diagnostics,
- user feedback,
- report performance issues,
- missing evidence patterns,
- confusing workflow labels,
- scope misunderstandings,
- new executive reporting needs,
- automation opportunities,
- data cleanup automation,
- future export formats,
- governance/audit enhancements.

Each backlog item should include:

- source,
- impact,
- affected role,
- affected surface,
- recommended fix,
- priority,
- acceptance criteria.

## Metrics To Track

Track these over time:

- number of Strategic Goals with complete execution chain,
- number of Organisational KRAs / Key Deliverables with linked objectives,
- number of Performance KRAs with linked KPIs,
- number of strategic tasks linked to KPIs,
- completed strategic tasks with evidence,
- completed strategic tasks without evidence,
- overdue strategic tasks,
- open diagnostics by severity,
- accepted-risk diagnostics,
- progress variance count,
- failed scheduled reports,
- report generation success rate,
- user-reported workflow issues.

These metrics help distinguish actual execution progress from data-quality noise.

## Documentation Maintenance

Update documentation when:

- hierarchy rules change,
- labels change,
- progress formulas change,
- report types change,
- new scope behavior is introduced,
- SharePoint list fields change,
- new workflow validation is added,
- release blockers are revised,
- operational roles change.

The documentation package should remain the source of truth for why the system works the way it does.

## Runbook Completion Signal

The operating model is healthy when:

- diagnostics are reviewed on schedule,
- report outputs match Strategy page values,
- owners act on exceptions,
- scheduled reports are visible and reliable,
- evidence gaps are known and assigned,
- progress variance is explained or resolved,
- business changes are documented before implementation,
- and users trust the Strategy page and Reports as two views of the same execution truth.
