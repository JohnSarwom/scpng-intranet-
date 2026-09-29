# Developer Handoff — Strategy Execution Remediation

Date: 9 September 2026
Repository: `scpng-intranet`
Branch: `feat/ai-text-improver`
Recorded HEAD: `9f777167162d1ec49bb9cff7ba407de804ed0557` (`9f77716`)
Status: local implementation through Phase 3 P1E, the Phase 4 reporting foundation, specialized governance presentations, immutable report/delivery history, archived-evidence AI boundary, read-only retirement governance history and trusted scheduled-delivery executor core; no commit, deployment, email, live SharePoint mutation or LIS import has been performed.

## Handoff snapshot

- **Implemented locally:** work-plan preservation and access controls; recoverable activation; synchronization and concurrency hardening; conserved strategy graph; specialized measurement evidence; reviewed activity/KRA/goal retirement and reassignment; shared immutable reporting context, governance presentations and delivery journal for Division and Unit reports; checksum-verified archived evidence for Division and Strategy AI; authorized read-only retirement governance history; provider-neutral archive-bound scheduled-delivery executor core.
- **Latest regression result:** 114 strategy/work-plan tests passed across eleven suites, including 26 reporting/archive/AI/scheduler checks and four governance-history checks.
- **Production build:** passed after 5,505 modules transformed. Existing dependency, font, chunking and Browserslist warnings remain documented below.
- **TypeScript:** exact full reconciliation remains 233 diagnostic lines / 165 normalized file-message pairs, identical to the recorded Phase 1 baseline; no archive/reporting/AI production-file diagnostics.
- **Knowledge graph:** refreshed after Phase 4D — 2,908 nodes, 3,475 edges and 646 communities across 649 files.
- **Repository state:** all remediation remains uncommitted beside unrelated dirty-tree changes. Do not reset, clean or mass-stage the workspace.
- **External-state boundary:** no live SharePoint data/schema, LIS source data, report delivery, deployment, commit or pull request was changed.
- **Next recommended slice:** in an approved non-production tenant, inventory and verify the schedule/archive fields, ACLs, conditional lease writes and idempotent mail-provider behavior needed by the completed executor core. Do not enable schedules or deployment before those adapter gates pass.

## 1. Start here

This is the authoritative continuation document for the September 2026 strategy-execution remediation. Read it before the older roadmap and sprint documents, whose phase numbers and completion language describe proposals rather than the present working tree.

The detailed evidence records remain useful and should be read when changing their respective areas:

- [Original developer handoff](2026-09-08-developer-handoff.md)
- [Remediation phases](2026-09-07-remediation-phases.md)
- [Application linkage audit](2026-09-07-task-to-goal-audit.md)
- [LIS source-alignment audit](2026-09-07-lis-workplan-source-alignment-audit.md)
- [Phase 2B activation](2026-09-07-phase-2b-activation.md)
- [Phase 3 P0 synchronization/lifecycle](2026-09-08-phase-3-p0-integrity.md)
- [Phase 3 P1A concurrency/cache integrity](2026-09-08-phase-3-p1a-concurrency.md)
- [Phase 3 P1B graph integrity](2026-09-08-phase-3-p1b-graph-integrity.md)
- [Phase 3 P1C measurement evidence](2026-09-08-phase-3-p1c-measurement-evidence.md)
- [Phase 3 P1D activity retirement](2026-09-09-phase-3-p1d-activity-retirement.md)
- [Phase 3 P1E goal/source-KRA retirement](2026-09-09-phase-3-p1e-structure-retirement.md)
- [Phase 4 immutable report archive and generation history](2026-09-09-phase-4-report-archive.md)
- [Phase 4C retirement governance history](2026-09-09-phase-4c-governance-history.md)
- [Phase 4D trusted scheduled-delivery executor core](2026-09-09-phase-4d-scheduled-delivery-executor.md)
- [Handoff evidence](handoff-evidence/README.md)

## 2. Current stop point

The local implementation now covers:

1. lossless work-plan editing and stable source/execution identity;
2. fail-closed division-scoped authorization and authoritative role checks;
3. idempotent, resumable work-plan activation with schema readiness checks;
4. pagination, optimistic concurrency, parent rollups and cache invalidation;
5. a conserved, diagnostic strategy graph with fail-closed scope filtering;
6. specialized, dated KPI measurement evidence without replacing existing formulas;
7. reviewed retirement/reassignment for activated activities, source KRAs and goals;
8. an immutable reporting snapshot shared by Division and Unit report previews/exports;
9. specialized traceability, heatmap, exception, accountability, variance and KPI-governance presentations over that snapshot;
10. append-only, checksum-verified, scope-authorized report generation and delivery history persisted through `Performance_Reports`;
11. an archive-ID/checksum schedule binding, deterministic dispatch identity, conditional lease/checkpoint contract and idempotent provider-neutral executor core;
12. a shared archived-evidence boundary for Division and Strategy AI, including exact scope selection, provenance and unsupported-number rejection;
13. an authorized, recursively frozen, read-only retirement governance history with completed/running/failed event evidence and no reversal path;
14. a hard quarantine that prevents the independently calculated legacy Power Automate definitions from being deployed through the application even when passed a fabricated readiness object.

Phase 3 lifecycle work is functionally complete for the supported removal and reassignment levels. Phase 4 now has a reliable reporting context, specialized presentations, local print/CSV delivery history, archived-evidence AI consumers, a dedicated read-only retirement governance view and the trusted scheduled-email executor core. The executor's SharePoint/checkpoint/mail adapters and activation remain gated on approved tenant verification. Reversal is not implemented because its authority and evidence-restoration policy are not approved. Phase 5 live-tenant and source migration work has not started.

## 3. Non-negotiable operating model

The intended cascade is:

```text
Strategic Goal
-> Organisational KRA / Key Deliverable
-> Division / Unit Objective
-> Performance KRA
-> KPI
-> Task
-> Evidence / Report
```

The implementation distinguishes corporate/source IDs, local work-plan IDs and execution-list IDs. Never substitute one for another or fall back to title matching when identity is ambiguous.

All progress consumers should use the shared graph calculation contract. Do not introduce page-local percentages, infer completion from planned quarters, use `createdAt` as reporting evidence, or represent missing linked data as an ordinary zero.

## 4. Completed implementation

### Work-plan preservation, access and activation

- Work-plan row conversions preserve hidden source metadata, stable IDs, execution links and stored progress.
- Duplicate titles remain distinct; duplicate rows receive new local identities and no inherited execution IDs.
- Administrators can manage across divisions. Managers are restricted to an exact normalized division match. Readers, missing roles and failed authoritative role lookup are denied before writes.
- Read-only work-plan queries never perform an implicit migration.
- Activation preflight validates schema, lookup targets, scope, ancestry, target semantics, Task policy and uniqueness before execution writes.
- Deterministic unique keys, ETags, a lease, intent signature, journal and checkpoints make the same interrupted activation resumable without blind duplicate creation.
- Large `GoalsJSON` payloads can be stored as immutable checksummed chunks.
- Existing Task association preserves the Task identity, status, assignees, comments, attachments and operational evidence.
- Metadata synchronization preserves actuals, calculation mode, weights, status and progress.

Primary paths: `src/services/workPlanActivationService.ts`, `src/services/workPlanStorageService.ts`, `src/services/sharePointOpsService.ts`, `src/hooks/useWorkPlans.ts`, `src/utils/workPlanEditor.ts`, `src/utils/workPlanAccess.ts`, `src/utils/workPlanIdentity.ts`, `src/pages/WorkPlanBuilderPage.tsx`, and the Division work-plan components.

### Synchronization, concurrency and cache integrity

- KPI/Task link writes keep direct KPI and KRA ancestry coherent.
- Task movement and unlinking recompute old and new parents.
- Empty KRA and Objective rollups explicitly reopen at zero instead of retaining stale completion.
- Paged readers include continuation pages and reject repeated continuation links rather than returning partial data.
- Stale form revisions and concurrent conditional-write races fail with reload/review guidance.
- Strategy mutations invalidate every dependent objective, KRA, KPI, Task, graph and report query family.

### Conserved strategy graph

- Every input performance record and Task is represented in the hierarchy, lookups or explicit exception collections.
- Integrity counts prove conservation for goals, performance records and Tasks.
- Duplicate IDs cannot overwrite records or attract ambiguous children.
- Cycles, ambiguous links, dual KRA/KPI links, orphan records, scope mismatches and ownership conflicts surface as diagnostics.
- Personal, Unit and Division scopes fail closed when required context is absent.
- Task evidence and direct parent evidence are preserved without silently changing the calculation formula.
- Assignee and creator provenance remain distinct.

Primary paths: `src/services/strategyExecutionGraphService.ts`, `src/hooks/useStrategyExecutionGraph.ts`, and `src/types/strategyExecution.ts`.

### Specialized measurement evidence

- Count, percentage, service-level compliance, population coverage, at-most duration, recurrence, milestone, continuous and as-required measurement definitions are supported.
- Evidence is evaluated against explicit reporting windows and observations.
- Impossible, missing-denominator and demand-free evidence fails closed and is excluded from parent rollups.
- Direct evidence on a parent is retained as evidence but does not silently replace child rollups.
- Activation and KPI mapping round-trip structured measurement definitions and evidence.

### Reviewed retirement and reassignment

- Removing an activated activity, source KRA or goal is diverted into a review workflow.
- Operators can retire while retaining Task links, retire while clearing Task strategy links, or reassign the conserved subtree to an eligible same-division target.
- The preview reloads authoritative descendants, calculates current/projected old and new parent progress, counts retained evidence, and signs every reviewed version/link.
- Execution uses ETags, a lease, operation identity and checkpoints; the same failed intent resumes and a different intent is blocked.
- Retirement keeps execution IDs and evidence. It marks objectives/KRAs/KPIs retired and removes only the reviewed source row from active `GoalsJSON` after descendant writes are checkpointed.
- Reassignment moves existing records; it does not recreate Tasks, KPIs or KRAs.
- Active reads and rollups exclude retired execution records.

Primary UI paths: `WorkPlanRetirementDialog.tsx`, `WorkPlanStructureRetirementDialog.tsx`, `WorkPlanLinkageDialog.tsx`, and `WorkPlanBuilder.tsx` under `src/components/division/workplan/`.

### Read-only retirement governance history

- The Division Work Plans screen exposes completed, running and failed retirement/reassignment journal events to same-Division managers/directors and administrators.
- The SharePoint adapter resolves the authoritative actor before reading and validates both Division ID and name on every returned work-plan row.
- History exposes action/reason, actor when recorded, target, affected hierarchy counts, conserved evidence, reviewed progress impact, checkpoints, warnings, failure details and same-intent recovery guidance.
- Unsupported envelopes, malformed timestamps, duplicate operation IDs, incomplete records and cross-Division rows fail closed.
- New retirement operations persist the authoritative actor into the durable operation and completed record; older records remain visible with a clear legacy-actor notice.
- The projection is recursively cloned/frozen and the dialog has no mutation, recovery or reversal controls. Reversal remains unavailable until policy explicitly defines authority and restoration semantics.

Primary paths: `src/services/workPlanGovernanceService.ts`, `src/hooks/useWorkPlanGovernanceHistory.ts`, `src/components/division/workplan/WorkPlanGovernanceHistoryDialog.tsx`, `src/components/division/tabs/DivisionWorkPlansTab.tsx`, and `src/tests/workPlanGovernance.test.cjs`.

### Phase 4 reporting foundation

- `src/services/strategyReportingService.ts` builds a recursively frozen `StrategyTraceabilityReport` from the conserved strategy graph.
- Generation fails closed for an invalid date range or generation timestamp, missing generator identity, unconserved graph, or missing personal/Unit/Division scope label.
- A date-only end date includes the entire final UTC day.
- Tasks enter the report through planned-interval overlap or an actual completion event. `createdAt` and `lastModified` are not treated as performance evidence.
- Dated KPI measurement windows, observations, milestones and evidence references contribute to evidence counts.
- The snapshot includes scope, scope label, source summary, formula provenance, graph generation time, capture time, integrity counts, hierarchy rows, overdue Tasks, completed-without-evidence warnings, owner accountability and linkage diagnostics.
- CSV export quotes data safely and exports every displayed section from the same frozen snapshot used by the preview.
- Division and Unit report tabs now build their summaries from this shared snapshot. Unit preview includes the traceability hierarchy instead of exporting unseen data.
- Shared report sections render traceability, division/Unit heatmap, unlinked records, evidence warnings, overdue work, owner accountability, progress variance, KPI review governance and graph diagnostics.

The generated snapshot is archived before preview and reloaded as immutable history. Print and CSV actions append checksum-linked queued/sent/failed events and fail closed if the journal cannot be written. The application did not execute a live download, print, email or SharePoint write during validation.

Schedule binding freezes the archive storage ID, snapshot ID/checksum, exact scope and recipients. Dispatch-envelope construction re-verifies all of them. `strategyReportSchedulerService.ts` now implements the provider-neutral executor protocol: deterministic dispatch IDs; a conditional lease before work; exact archive reload; checksum/scope verification; verified prior-event reads; `queued` before send; idempotent provider keys; `sent`/`failed` append-only events; and schedule advancement only after the sent event is durable. A retry repairs a missing schedule checkpoint from an existing sent event without resending.

Active schedule writes remain blocked because the tenant adapters are not verified. Both legacy Power Automate deployment entry points now end in an unconditional quarantine even after deployment-contract validation; they no longer import or submit the definitions that recalculate live metrics and use the Google Sheets AI queue. The deployment contract also requires verified schedule lease/checkpoint writes and verified provider idempotency.

Division and Strategy AI no longer serialize live page arrays or independently calculated UI metrics. `strategyReportAIService.ts` selects from authorized checksum-verified archive history, preserves the frozen scope, serializes report provenance and selected rows, and rejects a model response before display if it introduces a numeric fact absent from that archive context. Division selection is an exact scope match; Strategy selection prefers corporate evidence and otherwise retains the newest narrower scope already authorized to the actor. `useArchivedStrategyAI.ts` is read-only and fails closed when the archive, identity or Graph client is unavailable.

## 5. Validation state

Latest completed local checks:

- Full strategy/work-plan regression command: **114 tests passed** across eleven suites.
- Reporting/archive/AI-focused tests: **20 passed**.
- Archive/scheduled-executor focused tests: **16 passed**.
- Governance/access/retirement-focused tests: **42 passed**.
- Production Vite build: **passed**; 5,505 modules transformed.
- Build warnings remain pre-existing/operational: stale Browserslist data, Rollup annotations in `next-themes`, unresolved runtime LED font, mixed static/dynamic imports, and the large main chunk.
- TypeScript app check remains at the inherited **233 diagnostic lines / 165 normalized file-message pairs**. No diagnostic names the scheduler, archive, Power Automate, governance service, governance hook or governance dialog paths; the three diagnostics in the touched operations service are the same recorded `KRA.level` and `Report.created_at` debt.
- Graphify was refreshed after the Phase 4D code and handoff edits: **2,908 nodes, 3,475 edges and 646 communities** across 649 files.

Regression command:

```powershell
node --test src\tests\workPlanPreservation.test.cjs src\tests\workPlanAccessIdentity.test.cjs src\tests\workPlanActivation.test.cjs src\tests\workPlanGovernance.test.cjs src\tests\strategySynchronization.test.cjs src\tests\strategyGraphIntegrity.test.cjs src\tests\strategyMeasurementEvidence.test.cjs src\tests\strategyReporting.test.cjs src\tests\strategyReportArchive.test.cjs src\tests\strategyReportScheduler.test.cjs src\tests\strategyReportAI.test.cjs
```

Build command:

```powershell
npm run build
```

Graphify command required by `AGENTS.md`:

```powershell
python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

On this Windows host the `python3` alias may fail; the working fallback is:

```powershell
py -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

## 6. Working-tree transfer warning

Everything described above is uncommitted. A clone or checkout of recorded HEAD alone does not contain it.

The tree is also dirty with unrelated asset-management work, `.claude` state and generated Graphify files. Do not reset, clean, mass-stage or commit the whole tree. Review and stage strategy-execution paths deliberately. In particular, do not discard untracked remediation services, dialogs, utilities, tests or documentation.

Important new/untracked implementation paths include:

- `src/services/workPlanActivationService.ts`
- `src/services/workPlanGovernanceService.ts`
- `src/services/workPlanStorageService.ts`
- `src/services/strategyReportingService.ts`
- `src/services/strategyReportAIService.ts`
- `src/services/strategyReportSchedulerService.ts`
- `src/hooks/useArchivedStrategyAI.ts`
- `src/hooks/useWorkPlanGovernanceHistory.ts`
- `src/utils/workPlanAccess.ts`
- `src/utils/workPlanEditor.ts`
- `src/utils/workPlanIdentity.ts`
- `src/components/division/workplan/WorkPlanLinkageDialog.tsx`
- `src/components/division/workplan/WorkPlanRetirementDialog.tsx`
- `src/components/division/workplan/WorkPlanStructureRetirementDialog.tsx`
- `src/components/division/workplan/WorkPlanGovernanceHistoryDialog.tsx`
- the eleven `.cjs` regression files under `src/tests/`, including `strategyReportAI.test.cjs`, `strategyReportScheduler.test.cjs` and `workPlanGovernance.test.cjs`
- the September audit, phase and handoff documents under `docs/strategy-execution/`

Generated `graphify-out/cache/` entries are numerous. Treat them as generated evidence and follow the repository’s chosen Graphify tracking policy rather than staging them blindly.

## 7. Live-system boundary

No live action was performed during this remediation:

- no SharePoint list or column was created or changed;
- no tenant record was activated, retired, reassigned, migrated or deleted;
- no LIS data was imported;
- no report was delivered or scheduled;
- no deployment, commit, branch rewrite or pull request was created.

Schema-preparation and mutation methods exist in the application but must remain behind explicit administrator action and controlled-tenant approval. Client-side role checks are not a replacement for validating SharePoint ACLs and direct Graph access.

## 8. Recovery rules

- On a stale version or conditional-write conflict, reload authoritative state. Never force `If-Match: *`.
- For interrupted activation or retirement, resume the same persisted intent so deterministic keys/checkpoints can recover it. Do not delete the journal or strip IDs to bypass a guard.
- Before repeating an uncertain create, query the exact unique key and validate its parent and metadata.
- A retirement is a recoverable sequence of conditional writes, not an atomic multi-list transaction. Earlier reviewed writes may remain until the same operation resumes.
- If payload decoding or checksum validation fails, restore verified authorized data; never replace a failed decode with an empty work plan.
- Do not run source migration until list inventory, ownership, scope, duplicate handling and rollback have been reviewed against representative tenant data.

## 9. Outstanding work in priority order

### Phase 4 — complete reporting and governance

1. In an approved non-production tenant, verify and implement the SharePoint archive reader, conditional schedule lease/checkpoint store and idempotent email-provider adapters behind the completed executor core. Do not enable active schedules until failure-injection and security UAT pass. The independent legacy definitions remain hard-quarantined.
2. Obtain an explicit governance decision before designing reversal. The dedicated history view is complete and intentionally read-only; interrupted operations use the existing same-intent recovery path.

### Phase 5 — controlled tenant and LIS migration

1. Obtain explicit authority for read-only tenant inventory.
2. Confirm actual list IDs, lookup targets, field types, choices, indexes, uniqueness constraints, ACLs and representative data quality.
3. Resolve the LIS audit’s source-owner decisions, duplicate/ambiguous mappings, budget/target semantics and organizational scope.
4. Prepare a dry-run migration manifest with conservation counts, exception rows, impact previews and rollback/recovery steps.
5. Run controlled UAT with business owners before any production import, schema preparation or activation.

### Release readiness

1. Reconcile or formally accept the inherited 233-diagnostic TypeScript baseline.
2. Address or accept the large-bundle and runtime-font warnings.
3. Perform authenticated browser tests for access, activation recovery, retirement recovery, graph scope, report parity and evidence entry.
4. Separate strategy-execution changes from unrelated dirty-tree edits, review the diff, then commit only with explicit authorization.
5. Deploy only after schema, migration, UAT, rollback and owner sign-off gates pass.

## 10. Recommended next slice

Obtain explicit authority for a read-only non-production tenant inventory of `Report_Schedules` and `Performance_Reports`, including field types, indexes, uniqueness, ETags, ACLs and service identity. Use that evidence to implement the executor's three adapters and idempotent-provider integration; do not create schema implicitly or activate a schedule during inventory. The local retirement/governance history view is complete, and reversal remains blocked on approved policy.

Do not begin Phase 5 imports merely because the local graph and report foundation are green; the unresolved live schema, ownership and source-mapping decisions are intentional release gates.
