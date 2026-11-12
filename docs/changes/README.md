# Change records

Every change to the intranet gets a change record: features, fixes, data changes on SharePoint, and configuration. Read the records to find out what changed, why, where it stands, and how to undo it.

Programmes that span many changes keep a tracker of their own, with their plan, status and decisions:
- [Organisation and approvals](../programmes/org-and-approvals/README.md)

## How to write one

1. Copy [_TEMPLATE.md](_TEMPLATE.md) to `docs/changes/YYYY-MM-DD-short-slug.md`.
   - Use one file per change, so parallel branches never edit the same file.
   - Use the date the work started.
2. Fill in every section. Write "None" rather than deleting a section, so a reader knows it was considered.
3. Add a row at the top of the index below.
4. If the change belongs to a programme, update that programme's "Where we are" and step status.
5. Update the module doc for the feature (under `docs/modules/`) if its behaviour changed.
6. Keep the record current. When the status changes (PR opened, merged, live, data applied on production), change the **Status** line and add a line under **History**.

A pull request isn't ready for review until its change record exists. The PR template asks for it.

## Index

Newest first. A record still on an unmerged branch is listed with its branch.

| Date | Change | Status | Where |
|---|---|---|---|
| 2026-11-13 | [Change records and the programme tracker](2026-11-13-change-documentation.md) | In review | [PR #23](https://github.com/JohnSarwom/scpng-intranet-/pull/23) |
| 2026-11-13 | [Shared org model from the live lists](2026-11-13-shared-org-model.md) | In progress | Branch `claude/clever-lovelace-34f24e` (record written there) |
| 2026-11-12 | [Organisation, reporting and task assignment designs](2026-11-12-org-reporting-task-designs.md) | In review | [PR #23](https://github.com/JohnSarwom/scpng-intranet-/pull/23) |
| 2026-11-12 | [Division metrics: alignment, risk and unit scores](2026-11-12-division-metrics.md) | In progress | Branch `fix/division-headline-metrics` (record written there) |
| 2026-11-12 | [Task KPI picker scoped, with its goal trail](2026-11-12-task-kpi-picker.md) | In progress | Branch `claude/laughing-tharp-cb4136` (record written there) |
| 2026-11-12 | [Work-plan activation writes Strategic Goal links](2026-11-12-work-plan-goal-links.md) | In progress | Branch `claude/optimistic-antonelli-66001c` (record written there) |
| 2026-11-11 | [Workflow Studio](2026-11-11-workflow-studio.md) | In review | [PR #23](https://github.com/JohnSarwom/scpng-intranet-/pull/23) |
| 2026-11-11 | [Shared AI provider routing](2026-11-11-shared-ai-routing.md) | In review | [PR #23](https://github.com/JohnSarwom/scpng-intranet-/pull/23) |
| 2026-11-11 | [Strategic_Goals becomes the goal list](2026-11-11-strategic-goals-link.md) | In review | [PR #23](https://github.com/JohnSarwom/scpng-intranet-/pull/23) |

Changes before 11 November 2026 are recorded in [history/](../history/), [strategy-execution/](../strategy-execution/) and the older changelog files in `docs/`.
