# Strategy linkage remediation

The user authorized implementation on 7 September 2026, with confirmation after each phase. Keep the existing UI and ordinary Tasks workflow. Preserve organizational percentage formulas and results for unchanged existing contributors. The LIS work plan is a guide for planning semantics, applicable to every division; it does not supply application parent IDs or resolve its own missing sections and inconsistent budgets. As clarified on 10 September 2026, the LIS team will manually enter its data and no automated LIS import or migration is required.

## Delivery phases

| Phase | Deliverable and audit coverage | Status |
|---|---|---|
| 1 | Preserve work-plan identities and hidden metadata through editing; add source-aware planning types; protect loading and display save failures. F08; preservation portion of F09/F13; foundations for A03–A05/A09/A10. | Implemented; user confirmed proceeding |
| 2A | Separate strategic references from execution IDs in editing; reject unverified cascade links; enforce work-plan access and Test Ground route permissions; remove title-only KRA reuse. Safeguards for F01/F09/F11; F10 selector correction. | Implemented; user confirmed proceeding |
| 2B | Explicit crosswalk validation and schema readiness; source KRA grouping/raw targets; goal measures; ordinary Task associations; durable activation; explicit local-plan import. Safeguards/implementation for F01/F02/F09/F21/F22 and A01–A09/A12. Actual tenant mapping, specialized measurements and retirement migrations remain later phases. | Implemented locally; validation checkpoint |
| 3 | Paginated synchronization; preserve KPI modes; lifecycle, deletion and reparenting integrity; retries/version handling; accurate cache invalidation; graph conservation, cycles, scope and calculation evidence. F03–F07/F12/F13/F19/F20/F22; A10. | Implemented locally through reviewed activity, source-KRA and goal retirement/reassignment |
| 4 | Consistent scoped UI/report/export/AI evidence; true report periods and frozen historical results; correct division alignment/risk; completion events; demo provenance. F14–F18 plus consumer portions of F03/F12/F13; A11. | Snapshot, specialized presentations, immutable delivery history, archived-evidence AI, governance history, trusted scheduler core and GET-only readiness inventory implemented locally; verified tenant adapters and activation remain gated |
| 5 | Read-only tenant/schema inventory, measured per-screen production baseline comparison, approved activation and end-to-end acceptance. LIS data remains manually owned and entered by the LIS team. | Pending |

These are work packages, not a claim that all findings are already fixed. If a later phase is too broad it should be split into additional review checkpoints. No source document discrepancy can be resolved by inventing records, people, targets or money.

## Phase 1 result

- Extracted the editor conversion into `src/utils/workPlanEditor.ts`. Each editable row retains complete original goal/activity data. Saving retains goal/activity IDs, descriptions, unit ownership, Task/KRA/KPI associations and source metadata.
- Existing goals are grouped by their own identity. Identical names or shared objective IDs no longer merge separate existing goals. A goal label edit renames all its rows together without resolving a different parent by title. Cross-list selection/reparenting remains Phase 2.
- New rows use UUIDs; existing activity IDs remain untouched. Duplicates start as new planned work without copied source references or execution links. Empty goals survive editing; clearing an activity's text does not silently remove its linked record. The explicit row-delete action still removes the planned row; downstream retirement/reconciliation remains Phase 2/3.
- Unchanged activity progress and goal status/progress survive edits. Unchanged membership/status/progress preserves the plan's stored overall progress. The existing calculation utilities, Task workflow and organizational screens have not been changed.
- Existing plan-level strategic parent values are retained rather than overwritten by the first selected option during unrelated editing. Legacy ambiguities already stored in those fields remain unresolved until the crosswalk is introduced.
- Added optional source-aware types for KRA sections, goal measures, raw annual targets, quarters, responsible/supervisor positions, contributor units, budgets, dependencies, risk and unresolved evidence. Nested fields travel through the existing `GoalsJSON` field; this phase adds no SharePoint columns and imports no LIS records. Metadata is not an extra progress contributor.
- Existing-plan editing waits for the plan query. A missing/unavailable plan displays an error instead of mounting a blank editable form. Save failures appear in the page. Service read-error propagation and authorization are still open.

## Validation

`node --test src/tests/workPlanPreservation.test.cjs`: **10 tests passed**. Checks cover repeated unchanged saves, visible edits, duplicate goal labels/parents, goal renames, row duplication, quarter-vs-completion semantics, blank activity text, stable new IDs, actual SharePoint JSON mapper round trips and legacy progress examples.

The regression suite uses the installed TypeScript compiler with Node's built-in test runner. It does not require the currently unavailable Vitest runner. SharePoint mapper methods are exercised without a network connection; no live records are read or written.

`npm run build`: **passed**, after retrying outside the sandbox because esbuild could not read the project configuration. Vite reports large chunks, dependency annotation warnings and an unresolved LED font reference; those remain outside Phase 1.

`npx tsc --noEmit -p tsconfig.app.json`: **not clean**; 233 diagnostics in the repository, with no diagnostics naming the Phase 1 changed files. Examples include absent `businessUnits`, missing `SupabaseDataImporter` and unrelated asset type mismatches. This is not a claim that the repository passes type checking. Diagnostic log: `phase1-typecheck.log`.

Organizational percentages have fixture-level compatibility checks, not a tenant snapshot comparison. No source regrouping, activation or live-data mutation was performed. No browser interaction test was performed in this phase.

Graphify rebuilt successfully using the Windows `py` launcher after `python3` resolved to the unavailable Store alias: 633 files, 2,735 nodes, 3,056 edges and 630 communities. The graph and report were updated.

## Checkpoint before Phase 2

Review the editor preservation changes and confirm proceeding to the linkage/activation phase. Keep organizational formulas in place while introducing source-qualified references. Do not activate the source-aware plan with the legacy activity-per-KRA implementation. The new optional metadata is groundwork, not an already enabled importer or activation engine.

Before any later fix changes contributor membership (including restoring missing pagination), capture per-screen membership, status, weights, rounding and fallbacks. Report the expected numeric differences. Do not silently substitute a canonical graph formula or freeze invented percentages merely to make before/after displays match.

Source audits: [implementation audit](2026-09-07-task-to-goal-audit.md) and [LIS alignment audit](2026-09-07-lis-workplan-source-alignment-audit.md).

## Phase 2A result

Phase 2 was split into identity/access safeguards (2A) and source-aware activation/recovery (2B) to make each checkpoint reviewable. The user authorized Phase 2; this is its first completed subphase, not completion of the activation engine.

- Added a shared work-plan access policy: administrators retain cross-division access; managers can manage their own division; other roles do not gain work-plan writes through read access. The division's visible editing controls, builder save path and all five hook mutations use that policy.
- All five work-plan service mutation entry points resolve `/me` and fetch the current user role through the authenticated Graph client before writing. Update/delete check the persisted plan's division; updates also check any requested destination division. Missing identity/role lookup fails closed. These are application-level checks; SharePoint item/list permissions remain the external enforcement boundary and require tenant verification in Phase 5.
- Test Ground now uses the administrator route guard. Direct work-plan editor visits display access denial for users outside the editing policy. Existing Tasks permissions were not changed.
- Removed automatic localStorage-to-SharePoint migration from the work-plan query. Reading plans no longer triggers that migration, and the existing localStorage data is retained. Explicit migration, reconciliation and retry handling belong to 2B. Service query failures now propagate instead of returning a successful empty array.
- New editor rows store `organizationalGoalRef` with a list name. They never store the strategic dropdown's ID as `linkedObjectiveId`. Goal creation uses each goal's own strategic reference instead of applying the first selected plan-level parent to every goal. Execution IDs created by the service receive a separate `executionObjectiveRef` identifying `Unit_Objectives`.
- Cascade preflight rejects unqualified legacy objective links, mismatched execution references, corporate IDs requiring a crosswalk, and new goals lacking an explicit parent. It reads existing execution objectives/KRAs/KPIs and verifies their division and parent chain before the first cascade write.
- The legacy activation engine rejects source-aware plans, preserving them for the replacement engine. This prevents accidental creation of one KRA per source activity and forced 100-percent targets while 2B remains unfinished.
- Removed title-only KRA reuse in the save handler. The KRA selector identifies options and selected state by ID, distinguishes same-named records, and clears a previously selected ID when typing a new title in creation mode.

**Temporary behavior to review:** existing plans with ambiguous legacy IDs can still be saved as drafts, but activation/synchronization reports that their execution mapping must be verified. Corporate goal references and source-aware plans likewise cannot activate through the old engine. No automatic crosswalk or data migration has been run. Explicit legacy verification, durable partial-failure recovery, schema readiness and the new source activation engine are still open in 2B.

**Validation:** `node --test src/tests/workPlanPreservation.test.cjs src/tests/workPlanAccessIdentity.test.cjs` passed 21 checks. These include all five hook and service write paths rejecting readers, cross-division denial, missing-role denial, invalid ancestor chains, same-name KRA selection, stale ID clearing, read-only queries and Phase 1 preservation/progress regressions. Actual service methods and selector callbacks are exercised with mocked inputs, without live network writes.

No organizational calculation utility or Task workflow was changed. No tenant records were read or written by this implementation session. Production/browser permissions and live percentage baselines are not asserted from these local checks.

Final Phase 2A build passed. Type checking reports the same 233 diagnostics as Phase 1, comparing file and diagnostic text independently of shifted line numbers: no added or removed diagnostics. Graphify rebuilt 635 files into 2,741 nodes, 3,068 edges and 632 communities. The user confirmed proceeding to 2B before the final checkpoint response.

## Phase 2B checkpoint

See [Phase 2B implementation and limits](2026-09-07-phase-2b-activation.md). The previous activation loops have been replaced, and source linkage/details can be entered through the existing work-plan screen. The 37 focused checks pass. No live schema or work-plan activation has been performed.

Final production build passed. The final TypeScript check still reports 233 diagnostics: no added or removed diagnostic file/message pairs compared with Phase 1. Graphify rebuilt successfully: 638 files, 2,783 nodes, 3,147 edges and 635 communities. Build warnings include the existing large chunks, dependency annotations and unresolved LED font reference.

Do not treat these application changes as closure of tenant-data findings. Specialized KPI measurement, general synchronization/lifecycle fixes and approved movement/removal remain Phase 3; reporting remains Phase 4; tenant verification, measured production compatibility and controlled acceptance remain Phase 5. LIS source import is no longer part of Phase 5.

## Phase 4 immutable report archive checkpoint

See [Phase 4 immutable report archive and generation history](2026-09-09-phase-4-report-archive.md). Division and Unit preview, specialized governance sections, print, CSV and persisted history now consume the same checksum-verified frozen graph snapshot. Print/CSV lifecycle events use a separate append-only journal linked to that checksum. Schedule bindings freeze the archive identity/checksum, while active schedule writes and the legacy flow deployment paths fail closed until the trusted executor contract is verified. The full suite passes 100 tests, the production build passes and the compiler remains exactly at the 233-line / 165-pair inherited baseline. No tenant or delivery action was performed.
