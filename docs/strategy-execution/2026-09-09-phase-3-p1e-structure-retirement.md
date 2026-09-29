# Phase 3 P1E — Goal and Source-KRA Retirement

Date: 9 September 2026
Status: implemented and locally validated; tenant schema preparation and live execution were not performed.

## Outcome

Activated work-plan goals and source KRA sections now use the same reviewed lifecycle boundary as activated activities. The work-plan linkage editor exposes retirement actions for an execution-linked goal or KRA, and deletion of a linked goal row is diverted into the review instead of silently removing it.

The operator can:

- retire the complete execution subtree while retaining Task evidence links;
- retire the subtree and clear Task strategy lookups while retaining every Task;
- reassign the complete subtree to a reviewed objective or KRA in the same division.

The dialog defaults to cancellation, requires a reason and approval reference, and shows affected objective, KRA, KPI and Task counts, retained evidence counts, and current/projected parent progress before confirmation.

## Conservation and reassignment contract

Source-KRA retirement covers the linked `Performance_KRAs` item, every active child KPI, and every Task linked through the KRA or one of those KPIs. Goal retirement covers the linked `Unit_Objectives` item and its complete active KRA/KPI/Task execution subtree.

- Retirement keeps every execution ID. KPIs and their parent KRA/objective are marked `IsRetired`; Tasks remain ordinary operational records.
- Clear-links performs the same retirement and clears only `RelatedKPILookupId` and `RelatedKRALookupId` on affected Tasks.
- KRA reassignment moves every existing KPI and Task to the reviewed target KRA, then retires the old KRA.
- Goal reassignment moves every existing KRA under the reviewed target objective. KPI and Task identities and their existing KPI/KRA links do not change; the old objective is retired.

The source goal or KRA is removed from the active `GoalsJSON` only after descendant writes are checkpointed. Its full source snapshot and reviewed impact remain in `RetirementJSON` history. No KPI or Task is deleted, and the workflow does not overwrite measurement definitions, measurement evidence, actuals, calculation modes, statuses, checklists, comments, attachments or assignees.

## Integrity and recovery

The read-only preview reloads the plan and every objective, KRA, KPI and Task through paginated reads. It rejects missing or duplicate sources, already-retired sources or targets, invalid source ancestry, a target outside the work-plan division, same-parent reassignment, stale descendants and a second intent while an earlier retirement is incomplete.

The reviewed signature covers the plan version, action, target and every affected entity version. Execution repeats the preview before acquiring its lease. Conditional writes use ETags and record the operation identity on each changed execution item. Completion checkpoints are stored on the work plan, so retrying the same failed operation recognizes already-applied writes and resumes; a different intent remains blocked.

Old/new KRA and objective rollups are recalculated from active children after the move or retirement. Retired objectives and KRAs are excluded from normal mapping options and active collection reads.

As in P1D, this is a recoverable sequence of conditional SharePoint writes, not a multi-list transaction or automatic compensation. A later failure can leave earlier reviewed writes in place until the same operation resumes.

## UI and service paths

- `WorkPlanStructureRetirementDialog` presents the three actions, complete-subtree impact and mandatory authorization reason.
- `WorkPlanLinkageDialog` exposes goal and KRA retirement entry points; `WorkPlanBuilder` also intercepts linked goal removal.
- `WorkPlanBuilderPage` and `useWorkPlans` route preview/execution through the existing authoritative access boundary and refresh every dependent work-plan, objective, KRA, KPI and Task query.
- `SharePointOpsService` exposes checked structural preview/execution methods and excludes retired objectives and KRAs from active reads.
- `WorkPlanActivationService` owns authoritative impact calculation, stale/scope/ancestry checks, checkpointed execution, audit history and old/new rollup synchronization.

## Validation

- Focused activation/retirement suite: **24 passed**.
- Full strategy/work-plan regression group: **84 passed** (78 inherited through P1D plus 6 P1E regressions).
- Production Vite build: passed.
- TypeScript app check: remains at the inherited **233 diagnostic-line / 165 normalized file-message-pair baseline**. Comparison with the Phase 1 evidence found zero added and zero removed pairs; no P1E production path produced a diagnostic.
- Graphify: refreshed after code changes — **2,819 nodes, 3,306 edges and 637 communities**.

The six P1E regressions cover KRA subtree/evidence conservation, KRA link clearing, goal subtree reassignment, goal link clearing without deletion, stale/cross-division rejection, and retired-target/source-ancestry rejection.

## Remaining work

- Add a dedicated retirement history/governance view and an explicitly authorized reversal workflow if policy requires reversal rather than resume-only recovery.
- Validate schema preparation, access, impact accuracy and interrupted recovery against representative records in a controlled tenant.
- Continue Phase 4 shared reporting/evidence context and Phase 5 source/tenant migration behind their separate review gates.

No live SharePoint data, list schema, deployment, commit or source import was changed during this implementation session.
