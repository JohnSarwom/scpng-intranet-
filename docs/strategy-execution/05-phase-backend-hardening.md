# Phase 5: Backend Hardening

## Purpose

This phase stabilizes the backend and SharePoint integration before major UI rewiring begins. The goal is to prevent broken relationships, stale progress, unsafe deletes, invalid lookup writes, missing records, and noisy runtime behavior.

Backend hardening should happen before the Strategy page, Task modal, KRA/KPI modal, Reports tab, and Analytics are fully wired to the graph service and progress engine.

## Primary Backend Risk Areas

| Risk Area | Why It Matters |
| --- | --- |
| Linkage normalization | Invalid values such as `"none"` or `NaN` can corrupt SharePoint lookup writes. |
| Status alignment | UI statuses, TypeScript types, service mappers, and SharePoint choices can drift. |
| KPI movement | Moving a KPI between KRAs must update old and new parent progress. |
| Task-completion mode | Task-linked KPIs must not be silently converted into checklist KPIs. |
| Delete/archive behavior | Deleting KRAs or KPIs can create orphaned child records if not guarded. |
| Pagination | Reports and progress sync can miss records if Graph paging is not handled. |
| Progress sync | Backend sync must eventually match the shared progress engine. |
| Logging | High-traffic debug logs make diagnosis harder and can expose noisy operational data. |

## Target Files And Areas

Future implementation should focus on these areas first:

| Area | Main Responsibility |
| --- | --- |
| `sharePointOpsService` | Task, KRA, KPI, objective, report, and schedule CRUD/sync behavior. |
| `sharePointListSetupService` | SharePoint choice columns and schema alignment. |
| Task dialog save payload | Normalizing linkage values before backend writes. |
| KRA/KPI save/delete flows | Guarding destructive behavior and parent progress sync. |
| Reports service paths | Pagination and report schedule lifecycle. |
| Shared status/linkage utilities | Centralized mapping and validation rules. |

## Linkage Normalization

Implement one shared normalization rule before any SharePoint lookup write.

Required rules:

- Convert `"none"` to `null`.
- Convert empty strings to `null`.
- Convert `undefined` to omitted fields when no update is intended.
- Convert valid lookup IDs to numbers only after validation.
- Reject invalid lookup IDs instead of writing `NaN`.
- Preserve explicit `null` when the user intentionally clears a link.

Apply this to:

- Task `kra_id`.
- Task `kpi_id`.
- KPI `kra_id`.
- KPI `initiative_id`.
- KRA `objective_id`.
- Objective `parentGoalId`.
- Any future strategic graph lookup fields.

Recommended future utility:

```text
normalizeLookupId(value): number | null | undefined
```

Behavior:

- `undefined` means "do not update this field".
- `null`, `''`, and `'none'` mean "clear this field".
- numeric strings and numbers become numbers.
- invalid values throw or return a validation error before SharePoint write.

## Status Alignment

Align statuses across TypeScript types, UI controls, service mappers, reports, and SharePoint choice columns.

Minimum status mapping to review:

| Domain | UI / TypeScript Values | SharePoint Values |
| --- | --- | --- |
| Task | `todo`, `in-progress`, `on-hold`, `in-review`, `completed`, `done` | `Todo`, `In Progress`, `Review`, `Done` |
| Performance KRA | `open`, `in-progress`, `closed`, `completed` | `Open`, `In Progress`, `Closed` |
| KPI | `not-started`, `in-progress`, `on-track`, `at-risk`, `behind`, `completed` | `On Track`, `At Risk`, `Behind`, `Completed` |
| Objective | `not-started`, `in-progress`, `on-track`, `at-risk`, `completed` | `Not Started`, `In Progress`, `On Track`, `Needs Attention`, `Completed` |

Required outcome:

- One mapper per domain.
- One reverse mapper per domain.
- Reports use normalized statuses, not raw mixed casing.
- SharePoint setup choices support the values the UI can produce.

## KPI Relationship Safety

KPI updates must safely support moving a KPI from one Performance KRA to another.

Required behavior:

- Fetch the existing KPI before update when parent linkage may change.
- If `kra_id` changes, update `RelatedKRALookupId`.
- Recalculate the old parent KRA after the move.
- Recalculate the new parent KRA after the move.
- Return the refreshed KPI record after update.
- Produce a diagnostic/log entry if either parent cannot be recalculated.

This prevents one KRA retaining stale progress while another receives the moved KPI.

## Task Completion Mode

Preserve `task-completion` as a first-class KPI calculation type.

Required behavior:

- Linking tasks to a KPI must not silently change `CalculationType` to `checklist`.
- Checklist mode may display task-linked checklist items only when the user explicitly chooses checklist behavior.
- Task-completion mode should calculate progress from linked task status.
- Task update/delete flows should resync the linked KPI without overwriting the selected calculation type.

This is required so the future progress engine can distinguish checklist evidence from task-completion evidence.

## Delete, Archive, And Reassign Safety

KRA and KPI deletion must be guarded.

Required KRA options:

- Cancel.
- Archive KRA and preserve children.
- Reassign child KPIs and tasks to another KRA.
- Cascade delete only after explicit confirmation.

Required KPI options:

- Cancel.
- Archive KPI and preserve linked tasks.
- Reassign linked tasks to another KPI.
- Clear task KPI linkage with confirmation.
- Cascade delete only after explicit confirmation.

The default action should be cancel. Destructive actions must state how many child KPIs and tasks are affected.

## Pagination And Querying

Review every large-list fetch used by strategy execution.

Required areas:

- Task fetching.
- KPI fetching.
- KRA fetching.
- Report schedule fetching.
- KPI task sync.
- KRA progress sync.
- Objective progress sync.
- Report generation.

Acceptance rule:

```text
Reports and progress sync must not silently miss records because of Graph API page limits.
```

Where server-side filtering is unreliable for SharePoint lookup columns, fetch all pages and filter client-side with explicit comments.

## Progress Sync Alignment

Backend sync should move toward the shared progress engine defined in Phase 4.

Required direction:

- KRA progress sync should eventually use KPI progress, not only completed KPI count.
- KPI sync should preserve calculation type.
- Objective progress sync should use linked KRA progress.
- Cached SharePoint progress should be refreshed from calculated values.
- Cached values should not override graph-calculated progress in reports.

## Report Schedule Lifecycle

Report schedules need a clearer backend lifecycle.

Required fields/behavior:

- Scope: unit, division, corporate, or audit.
- Categories.
- Time period/date range.
- Manager or recipient email.
- Last sent time.
- Next send time.
- Delivery status.
- Delivery error, if applicable.

Backend hardening should distinguish saving schedule metadata from actually delivering the report.

## Logging And Diagnostics

Replace high-traffic `console.log` debugging with controlled logging.

Required behavior:

- Development diagnostics can remain behind a verbose/debug flag.
- Production paths should log warnings and errors only.
- Normal Strategy, Task, KRA, KPI, and Report rendering should not spam the console.
- Linkage failures should become graph diagnostics where possible, not only console output.

## Implementation Order

Recommended order:

1. Add lookup normalization utility and apply it to task/KPI/KRA/objective writes.
2. Align status mappers and SharePoint choice documentation.
3. Fix KPI parent movement and old/new KRA progress sync behavior.
4. Preserve task-completion calculation mode during task/KPI sync.
5. Add guarded delete/archive/reassign contracts.
6. Add pagination support to KPI/task/report schedule/report generation fetches.
7. Align backend progress sync with the Phase 4 progress engine.
8. Replace noisy logs with controlled logging and diagnostics.

## Acceptance Criteria

- Invalid lookup values never reach SharePoint.
- `none`, empty string, `null`, and `undefined` have documented and tested behavior.
- No orphaned links after create, update, delete, archive, or reassign flows.
- Moving a KPI between KRAs recalculates both old and new parent KRAs.
- Task-completion KPIs keep their selected calculation mode.
- Reports and progress sync do not silently miss records due to paging.
- Backend cached progress can be explained by the shared progress engine.
- Delete flows protect child records and require explicit confirmation.
- High-traffic debug logs are removed or gated behind controlled logging.
