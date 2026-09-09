# Phase 3 P1D — Activated Activity Retirement and Reassignment

Date: 9 September 2026
Status: implemented and locally validated; tenant schema preparation and live execution were not performed.

## Outcome

The work-plan editor no longer treats deletion of an activated activity as an ordinary row edit. Draft/unlinked rows still delete locally. A row with a KPI, KRA or Task execution link opens an operator review that:

- defaults to cancellation unless the operator confirms;
- offers retirement with retained Task links, retirement with cleared strategy links, or reassignment of the KPI and every linked Task to another KRA;
- requires a reason/approval reference;
- shows current and projected old/new KRA percentages and membership counts;
- shows retained Task and KPI measurement-evidence counts;
- does not issue a DELETE for the KPI or any Task.

This closes the interactive activated-activity removal gap. Goal-level and source-KRA-level retirement remain guarded and need their own reviewed workflow; this record does not claim those cases are implemented.

## Integrity contract

### Read-only preview

WorkPlanActivationService.previewActivityRetirement reloads the authoritative plan, activity, KPI, old KRA, optional new KRA, all KPI members and all Tasks using paginated reads. It rejects:

- a missing or duplicate source activity;
- an unactivated activity routed into the workflow;
- a KPI whose current KRA no longer matches the source activity;
- a source or target KRA outside the plan division;
- a same-parent reassignment;
- a recorded Task that now belongs to another KPI;
- a second operation while a different retirement is incomplete.

The preview signature covers plan, KRA, KPI and Task versions. Execution reloads the preview and fails closed when any reviewed version or linkage changed.

### Conserved records and evidence

Retirement sets Performance_KPIs.IsRetired and records RetirementJSON; the KPI remains addressable in SharePoint. Normal KPI collection reads exclude retired KPIs from active strategy consumers, and KRA rollups exclude them as well.

- **Retain links:** Tasks keep both lookup links to the retained KPI/KRA.
- **Clear links:** Tasks remain in place, but both strategy lookup fields are cleared.
- **Reassign:** the existing KPI ID and all existing Task IDs move together to the reviewed target KRA.

The workflow does not rewrite KPI actuals, status, calculation type, checklist, measurement definition or measurement evidence. It does not rewrite Task status, assignees, comments, attachments or other operational evidence.

### Recovery and audit

Division_WorkPlans.RetirementJSON holds the active operation, reviewed impact, source activity snapshot, reason, lease and completed step names. Each entity write uses its current ETag. A retry with the same operation resumes completed steps; already-applied entity writes are recognized by operation identity and desired linkage. A different intent is blocked until the interrupted operation is recovered.

Completion removes only the source activity from GoalsJSON, recalculates the old and optional new KRA plus their objectives, and appends a history record before clearing the active operation. Other work-plan edits and activation are blocked while a retirement operation remains incomplete.

This is a recoverable sequence of conditional writes, not a multi-list transaction or automatic compensation. A failed later step may leave earlier reviewed writes in place until the same operation resumes.

## Schema additions

The existing explicit admin schema-preparation action now includes:

| List | Fields |
| --- | --- |
| Division_WorkPlans | RetirementJSON multiline text |
| Unit_Objectives, Performance_KRAs, Performance_KPIs, Operations_Tasks | RetirementJSON multiline text; IsRetired boolean |

Readiness fails before execution if these fields are missing or incompatible. No schema operation was run against the tenant in this session.

## UI and service paths

- WorkPlanRetirementDialog presents the three actions, impact deltas, evidence counts and mandatory reason.
- WorkPlanBuilder diverts only linked row deletion into the dialog and carries the new plan revision after execution.
- WorkPlanBuilderPage and useWorkPlans route preview/execute through the existing authoritative write-access check and invalidate plan, objective, KRA, KPI and Task caches.
- SharePointOpsService exposes the checked service boundary, decodes retirement history, excludes retired KPIs from active reads and preserves the existing delete guards.

## Validation

- Focused retirement/activation suite: **18 passed**.
- Full strategy/work-plan regression group: **78 passed** (73 inherited plus 5 P1D regressions).
- Production Vite build: passed.
- TypeScript app check: still the inherited **233 diagnostic-line / 165 normalized file-message-pair baseline**. Comparison with the recorded Phase 1 baseline found zero added and zero removed pairs; none of the P1D production paths produced a diagnostic.
- Graphify: refreshed after code changes — **2,813 nodes, 3,279 edges and 636 communities**.

The five P1D regressions cover exact old/new impact, evidence conservation, active-rollup exclusion, link clearing/reassignment, and stale/cross-division rejection.

## Remaining work

- Add reviewed goal and source-KRA retirement/reassignment using the same conservation and checkpoint contract.
- Provide a dedicated audit/history view and an explicitly authorized reversal workflow if governance requires reversal rather than resume-only recovery.
- Validate schema preparation, preview accuracy, interrupted recovery and permissions in a controlled tenant.
- Continue Phase 4 reporting and Phase 5 source/tenant migration only after their separate review gates.

No live SharePoint data, list schema, deployment, commit or source import was changed during this implementation session.
