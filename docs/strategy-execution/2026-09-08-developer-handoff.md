# Developer handoff: strategy linkage and LIS work-plan alignment

**Prepared:** 8 September 2026, Pacific/Port_Moresby. **Repository:** `scpng-intranet`. **Scope:** the recent Task → KPI → KRA → objective → organizational goal audit and remediation through Phase 2B. This document distinguishes actual implementation, local test evidence, historical proposals, and unfinished work. It does not claim to reconstruct every change made by earlier developers in this repository.

## 1. Exact handoff position

The editor preservation phase (1), identity/access safeguards (2A), and replacement work-plan activation engine (2B) are implemented in the local working tree. Phase 2B passed 37 focused tests and the production build. The repository still has 233 TypeScript diagnostics, unchanged by diagnostic file/message comparison against the Phase 1 baseline. This is a successful build with an existing type-check backlog, not a clean TypeScript project.

**The next implementation work is Phase 3: general Task/KPI synchronization, measurement modes, pagination and lifecycle integrity.** Do not start by importing the entire LIS work plan. The new activation engine avoids the old synchronization path during creation, but subsequent ordinary Task operations can still encounter the audited legacy synchronization defects. Closing that gap precedes production activation.

The user requested this handoff before further development. No Phase 3 code was started for this handoff. No live SharePoint records were read or written during the implementation phases; no tenant schema preparation, actual source import, live activation, deployment, commit or push was performed. No authenticated browser smoke test was completed. Local mocked evidence must not be described as tenant acceptance.

### Delivery status

| Work package | Actual result | Boundary |
|---|---|---|
| Initial application audit | Completed: 22 findings and controlled examples | Code-level audit; actual tenant state still needs inventory |
| LIS source audit | Completed: 12 alignment findings and source discrepancy register | Extracted DOCX structure; no verified rendered page numbers |
| Phase 1 | Editor identity and metadata preservation; source-aware types | User confirmed continuing |
| Phase 2A | Qualified references, cascade/access safeguards, KRA selector identity | User confirmed continuing to 2B |
| Phase 2B | Source-aware activation, mapping dialog, recovery, payload storage, explicit local import | Local validation checkpoint; no deployment acceptance |
| Phase 3 | Pending | General synchronization, measurements, lifecycle and graph integrity |
| Phase 4 | Pending | Scoped reporting, historical evidence, exports and AI consistency |
| Phase 5 | Pending | Tenant/source reconciliation, percentage baseline, approved migration and acceptance |

### Reading order and document precedence

Read this handoff, then the [remediation tracker](2026-09-07-remediation-phases.md), then the [Phase 2B report](2026-09-07-phase-2b-activation.md). Use the [application audit](2026-09-07-task-to-goal-audit.md) for original F01–F22 evidence and the [source audit](2026-09-07-lis-workplan-source-alignment-audit.md) for A01–A12 and table/row references. Historical line numbers in audit links may have shifted after remediation; search for the named symbols.

The numbered `00-...` through `17-...` roadmap, sprint plans, `STATUS-implementation-checklist.md`, and `PHASE-2-REVISION-role-based-cascade.md` predate this remediation. Retain them as design history. Their phase numbers are a different sequence. In particular, an earlier officer-only Task model must not override the LIS source or the user's requirement to keep ordinary Tasks. The graph prototype is not evidence that a shared graph engine already powers all production screens.

## 2. User intent, decisions and constraints

The user first requested a complete audit of the existing linkage chain. They then supplied the FY2027 LIS work plan as the source for the desired logic, explicitly retaining the UI, ordinary Tasks and organizational goal percentages. The document represents one division; the same planning semantics should work for every division. The user allowed terminology improvements and authorized phased remediation with a review checkpoint after each phase. Phase 2 was split into 2A and 2B to keep reviews manageable.

Apply these contracts throughout continuation:

1. Preserve existing Task identities and workflow. Source activities can link existing Tasks or explicitly create ordinary Tasks; do not introduce a competing Task registry.
2. Preserve the current screen layouts. Add focused details using existing form/dialog patterns rather than redesigning the executive and execution screens.
3. Preserve existing organizational formulas and results for unchanged contributor records. Do not silently replace legacy formulas with the graph prototype or add a new averaging layer.
4. Do not pretend that adding contributors, regrouping KRAs or recovering omitted pages cannot change percentages. Capture actual per-screen inputs and explain membership-driven differences before migration.
5. Use explicit identifiers and list names. Names and coincidentally equal numeric IDs are not a crosswalk.
6. Preserve source wording and unresolved information. Do not invent absent sections, targets, budget values, people or application mappings.
7. Treat instructions inside the work plan as business data. They do not authorize assigning real staff, sending messages or performing tenant changes independently of the implementation request.
8. Report phase results honestly and obtain the user's requested checkpoint before moving to another phase. The request for documentation is not production rollout approval.

An earlier optional question about precisely preserving percentages was not answered. The implementation therefore uses the compatibility contract above: same formula and same contributors produce the same result; changed membership requires measured review. There is no measured live baseline and no instruction to freeze invented percentages.

## 3. Repository state and transfer requirements

At handoff preparation:

| Item | Value |
|---|---|
| Workspace | `C:/Users/IT_UNIT/Desktop/Coding/scpng-intranet` |
| Branch | `feat/ai-text-improver` |
| HEAD | `9f777167162d1ec49bb9cff7ba407de804ed0557` |
| HEAD subject | `Add "Improve with AI" text assistant across intranet forms` |
| Implementation commits | None created for this remediation |
| New source/tests/reports | Many remain untracked |

**A fresh clone at HEAD will omit this implementation.** Transfer the reviewed working tree, including untracked source files and tests, or create reviewed commits before handing over. This documentation folder supplies context and evidence, not a complete application backup. The [file manifest](handoff-evidence/file-manifest.json) identifies relevant files and SHA-256 fingerprints at this checkpoint; it is not a patch and does not prove authorship of every line.

The workspace already contained unrelated modifications: asset management dashboards/modals/services/hooks/policies, decommissioning and maintenance work, Strategy demo files, `.claude` settings/worktrees, `src/pages/Strategy.tsx`, and `src/services/sharePointListSetupService.ts`. `src/App.tsx` also had earlier changes; only its Test Ground route guard was changed by this remediation. Graphify outputs contain generated changes. Do not reset or attribute the entire dirty tree to this task, and do not blindly package all modifications as a single strategy change.

Transfer the source DOCX separately through the team's normal document channel. Its original location is outside the repository. This handoff does not bundle credentials, `.env` files, browser localStorage, tenant data, `node_modules`, build output or the full DOCX. Existing localStorage plans remain on the originating browser and require explicit handling; transferring repository files does not transfer those plans.

## 4. Source document: authority, extraction and discrepancies

### Provenance and limits

Source: `C:/Users/IT_UNIT/Downloads/FY2027 LIS ANNUAL WORKPLAN_060820262.docx`.

Title: Licensing and Supervision Division FY2027 Annual Workplan. Period: 1 January–31 December 2027. Recorded size: 542,174 bytes. Recorded modification date: 6 August 2026. SHA-256:

```text
0ba34e4f0801d2a061a2ebc023d26afb3775c388c8283ed7c8b1edf39d41a08f
```

Extraction used Python ZIP/XML processing of the DOCX. The local extraction is at `C:/Users/IT_UNIT/.codex/visualizations/2026/09/06/01a078f0-a689-7110-b5bd-749032224361/lis-workplan-source/extracted.json`. It contains paragraph entries and tables with rows/cells, span and merge information. This machine-specific extraction is not required at runtime and is not included in this folder. Re-extract from the fingerprinted original if it is unavailable.

The document contains 84 tables. Inspection found no nested tables, text boxes, embedded objects, charts, altChunks, headers/footers, comments or tracked insertions/deletions requiring a separate extraction path. Rendering was attempted using the document skill's renderer, but LibreOffice `soffice.exe` was unavailable on PATH. No page-image verification was completed. The Word metadata's page count is not a verified page citation. Audit references use extracted table/row and paragraph ordinals, not asserted page numbers.

### Detailed source inventory

| Detailed goal | KRA sections | Activities | Activity tables |
|---|---:|---:|---|
| SG1 | 3 | 18 | 6–8 |
| SG2 | 3 | 19 | 11–13 |
| SG3 | 4 | 31 | 16–19 |
| SG4 | 4 | 32 | 22–25 |
| SG5 | 4 | 32 | 28–31 |
| SG6 | 4 | 32 | 34–37 |
| SG7 | 4 | 32 | 40–43 |
| SG8 | 4 | 32 | 46–49 |
| SG9 | 4 | 32 | 52–55 |
| SG11 | 4 | 32 | 58–61 |
| SG13 | 4 | 32 | 64–67 |
| SG14 | 4 | 32 | 70–73 |
| SG16 | 4 | 31 | 76–79 |
| SG17 | 3 | 21 | 82–84 |
| **Total** | **53** | **408** | **53 activity tables** |

The 84 tables consist of 3 introductory tables, 14 goal-KPI tables, 14 budget tables and 53 activity tables. There are 140 goal-level KPIs (10 per detailed goal) and 408 activity KPIs. These are different measurement levels. Treating all 548 as equivalent contributors would double-count meaning and change rollups.

The executive summary at paragraph 22 claims 16 goals, 61 KRAs and 488 activities. Paragraph 25 and the master budget cover 20 goals and total PGK 5,582,000. The detailed content only supports the 14/53/408 inventory above. Detailed SG10, SG12, SG15, SG18, SG19 and SG20 are absent; their master allocations total PGK 2,012,000. SG2.3 is absent. SG17.4 is budgeted at table 81 row 5 but has no activity section; the supplied file ends at SG17.3/table 84.

Preserve reference gaps. Examples: SG1 010–012 and 014–016; SG2 005, 009–012 and 017–024; SG3 024; SG16 017; SG17 001–003. Do not renumber or fill them with invented activities.

### Source meaning that the model must retain

Activity tables have 16 columns: Ref, Activity, Deliverable, KPI, Annual Target/Target, Q1, Q2, Q3, Q4, Unit, Officer/Responsible Officer, Supervisor, Resources, Budget, Dependencies and Risk. Quarter ticks mean planned execution, not completed work. An activity reference such as `FY27-SG3-003` identifies the goal, but its KRA comes from the enclosing SG3.1 section. The reference alone cannot reconstruct the KRA.

Targets include counts (1, 4, 12), thresholds (≥95%), population coverage (100%), service levels (≥90% within 20 working days), upper time bounds (≤10 working days), recurrence, milestones, continuous work and work performed as required. A single numeric target of 100 loses their meaning. Keep raw wording plus confirmed operator, quantity, unit, population, frequency and service level when known.

Source responsibility includes directors, managers, officers and all-unit obligations. The staffing list has 17 positions, 8 occupied and 9 vacant. Store positions independently of user accounts. Resolve actual assignees only when there is a verified person; a vacant role is not a fabricated account. Unit aliases still need canonical mapping. One obligation with multiple contributing units must not become several equivalent KPI records merely to represent ownership.

### Budget and target issues requiring source-owner decisions

| Goal | Summary budget (PGK) | Detailed activity total / unresolved item |
|---|---:|---|
| SG5 | 500,000 | 510,000; SG5.4 summary zero versus activity FY27-SG5-028 at 10,000 |
| SG6 | 215,000 | 100,000 |
| SG7 | 310,000 | 290,000 |
| SG8 | 140,000 | 190,000 plus ambiguous `K200.000,00` at FY27-SG8-006, table 46 row 7 |
| SG14 | 640,000 | 990,000 plus Operational entries |
| SG16 | 1,075,000 | 1,875,000 |
| SG17 | 90,000 | 70,000 plus Operational entries |

Six activity budgets say Operational; they are not confirmed zeroes. Keep ambiguous amounts as raw text. The SG1 work-plan implementation threshold (≥95%) and SG13 threshold (≥90%) also require interpretation; neither is the organizational dashboard's progress percentage.

### Examples for the next developer's measurement tests

| Reference and source location | Meaning | Incorrect shortcut to avoid |
|---|---|---|
| FY27-SG1-003; T6 R4; SG1.1 | Monthly divisional management meetings; minutes; annual target 12; all quarters; Director/Director/CEO; K60,000 | One completed Task is not evidence of 12 meetings |
| FY27-SG3-003; T16 R4; SG3.1 | Completeness assessment; ≥95% within 5 working days; Continuous; licensing officers/manager | Continuous is not numeric 100; preserve population and SLA |
| FY27-SG17-012; T83 R5; SG17.2 | High/extreme risk treatment plans; 100%; All Units; unit managers/director | Do not duplicate the obligation for each unit |
| FY27-SG7-017; T42 R2; SG7.3 | Dashboards; 12 monthly updates; Market Data Unit; K20,000 | Scheduled months are not completed updates |
| FY27-SG5-026 | ≥90% within 20 working days | A percentage without the time condition is incomplete |

No actual 408-activity import or production-ready DOCX importer was delivered. The extraction supported the audit. The model, UI and activation engine now have places to retain this information; staging and source-owner reconciliation remain Phase 5.

## 5. Architecture and identity model

The application uses React/TypeScript, Vite, existing shadcn/Radix patterns, React Query and Microsoft Graph-backed SharePoint services. Planning data sits in `Division_WorkPlans`; activated execution records live in the existing operational lists.

```text
Organizational goal reference (list + item ID)
  -> explicit legacy compatibility parent, when necessary
    -> divisional annual goal / Unit_Objectives item
      -> source KRA section / Performance_KRAs item
        -> activity KPI / Performance_KPIs item
          -> one or more existing Operations_Tasks, or an explicit new ordinary Task

Divisional goal measures remain separate plan/objective metadata.
WorkPlan is the planning container, not an additional progress denominator.
```

### Lists and links

| List | Role | Relevant relationship |
|---|---|---|
| `Strategic_Goals` | Corporate organizational goal space | Qualified source alignment; not interchangeable with the legacy list |
| `Strategic_Objectives` | Legacy organizational parent space used by existing execution lookup | `Unit_Objectives.ParentGoalId` must target this list |
| `Unit_Objectives` | Divisional annual execution objective | ParentGoalId lookup to legacy strategic record |
| `Performance_KRAs` | One record per source KRA section | UnitObjective lookup to execution objective |
| `Performance_KPIs` | One activity measure per planned activity | RelatedKRA lookup; optional RelatedInitiative linkage in existing service |
| `Operations_Tasks` | Existing ordinary Tasks | RelatedKPI and RelatedKRA lookups |
| `Division_WorkPlans` | Plan, source metadata and persisted activation checkpoint | GoalsJSON and ActivationJSON |
| `Division_WorkPlanPayloads` | Immutable large-plan goal chunks | Manifest hash/chunk references from GoalsJSON |

Use Graph field names such as `ParentGoalIdLookupId`, `UnitObjectiveLookupId`, `RelatedKRALookupId` and `RelatedKPILookupId` when writing their corresponding lookups. Verify actual tenant column definitions; display names alone do not establish lookup compatibility.

`organizationalGoalRef` carries `{ list: 'Strategic_Goals' | 'Strategic_Objectives', id }`. `executionObjectiveRef` carries `{ list: 'Unit_Objectives', id }`. `linkedObjectiveId` is the execution link. `legacyStrategicObjectiveId` supplies an explicit compatibility parent for a corporate selection. A corporate item `7` and a legacy item `7` are unrelated until an explicit correspondence is selected and validated. The source DOCX does not provide this correspondence. Validation confirms existence, division and actual links, not the business truth of the chosen crosswalk.

### Added planning types

See `src/types/division.types.ts` for the complete contracts. Key additions:

| Type / property | Meaning |
|---|---|
| `WorkPlanSource` | Document name, optional SHA-256, table, row, source reference and unresolved issues |
| `WorkPlanTarget` | Raw text; optional at-least/at-most/equal operator, quantity, unit, population, frequency and service level |
| `WorkPlanMeasure` | Identified goal measure with description, target and source |
| `WorkPlanKra` | Stable local ID, code, title, optional objective, linked KRA ID and source |
| Goal fields | Source/code, strategic objective, expected outcomes, policy alignment, KRA sections, goal measures, qualified parent references |
| Activity fields | Source KRA ID, annual target, planned quarters, positions, contributing unit IDs, original unit text, raw/confirmed budget, dependencies, risk and Task policy |
| `WorkPlan.revision` | SharePoint ETag used for conditional editing |

`taskPolicy` is `link-existing` or `create-task`. Source IDs, application list IDs and local plan IDs serve different purposes; never replace one with another. Metadata not exposed by an input control must survive a save. No automatic parser guesses ambiguous money or composite numeric targets.

## 6. Completed implementation, file by file

Paths below are repository-relative so they remain useful after transfer. The evidence manifest contains exact fingerprints of the checkpoint files.

| File | Change and reason |
|---|---|
| `src/utils/workPlanEditor.ts` — new | Extracts row conversion and preservation logic; original goal/activity snapshots protect hidden fields and IDs |
| `src/components/division/workplan/WorkPlanBuilder.tsx` | Uses preservation utilities; retains table layout; row linkage/details action; preserves stored progress when unchanged |
| `src/types/division.types.ts` | Source-aware planning fields and revision |
| `src/utils/workPlanAccess.ts` — new | Shared division-scoped manager/admin policy |
| `src/utils/workPlanIdentity.ts` — new | Phase 2A legacy identity safeguards; retained, but not the replacement engine's activation loop |
| `src/hooks/useDivisionData.ts` | Strategy editing permission uses scoped work-plan policy |
| `src/hooks/useWorkPlans.ts` | Guards writes, waits for role resolution, propagates query failures, explicit local import instead of migration during reads |
| `src/pages/WorkPlanBuilderPage.tsx` | Loading/access/error handling, mapping loader, admin schema action, local import, persisted draft URL before activation |
| `src/components/division/workplan/WorkPlanLinkageDialog.tsx` — new | Explicit parent/KRA/Task mapping and source target/details entry using existing UI patterns |
| `src/services/workPlanActivationService.ts` — new | Source-aware activation, preflight, unique keys, ETags, journal, checkpoints and retry recovery |
| `src/services/workPlanStorageService.ts` — new | Inline-compatible JSON and immutable large-goal payload chunks with checksums |
| `src/services/sharePointOpsService.ts` | Integrates new services; authoritative identity checks; CRUD/version guards; explicit import; initiative linkage; removes old activation/sync loops |
| `src/components/kpi/KraFormSection.tsx` | KRA selection/search identity and stale-ID clearing |
| `src/components/unit-tabs/KRAsTab.tsx` | Removes title-only reuse that could select/reparent another KRA |
| `src/App.tsx` | Test Ground route receives admin/super-admin guard; other changes in this file predate this work |
| `src/tests/workPlanPreservation.test.cjs` — new | Editor, mapping and legacy progress regression checks |
| `src/tests/workPlanAccessIdentity.test.cjs` — new | Scope, ancestor integrity, selector, CRUD/retry and initiative checks |
| `src/tests/workPlanActivation.test.cjs` — new | Mocked Graph activation, concurrency, storage and preservation checks |

The core organizational calculation utility `src/utils/kpiUtils.ts` and ordinary Task UI were not modified by this remediation. `src/pages/Strategy.tsx` and `src/services/sharePointListSetupService.ts` already had unrelated changes and are not remediation deliverables.

### Editor preservation behavior

`goalsToRows` keeps cloned `originalGoal` and `originalActivity` snapshots. `rowsToGoals` overlays editable cells on preserved data and groups existing goals by their own identity. Two goals with the same name or objective no longer collapse into one. Renaming a goal updates its rows without guessing a new strategic parent from the title.

New rows receive stable UUIDs. Duplicating a row clears the original activity/source/execution IDs and starts planned work at zero progress; source goal membership is retained. Existing activity IDs, descriptions, unit, links, status/progress and unexposed metadata survive unrelated edits. Empty goals survive. Blanking an existing activity title does not silently delete the record. Explicit removal is subject to downstream protection for activated work.

`workPlanProgressUnchanged` retains stored overall progress when membership/status/progress is unchanged. Planned quarters never count as completion. Existing plan-level parents are not overwritten by whichever dropdown option happens to come first.

### Access and service integration

Administrators (`admin`, `super_admin`, or `is_admin`) can manage across divisions. Managers can manage only the normalized exact matching division. Readers, missing roles and unresolved role state do not receive write access. The service rechecks Graph `/me`, resolves the current role through `UserSharePointService`, and checks the persisted plan division plus the requested division. Schema preparation is administrator-only.

These are application checks, not a substitute for SharePoint ACLs. A client-side service cannot establish tenant security by itself. Actual list permissions, direct Graph access and cross-division enforcement need Phase 5 verification. New service classes are designed to be called through the guarded operations service; do not introduce an unguarded UI call to their write methods.

Useful operations-service entry points: `getWorkPlanActivationReadiness`, `getWorkPlanMappingOptions`, `prepareWorkPlanActivationSchema`, `previewWorkPlanActivation`, `importLegacyWorkPlans`, `activateWorkPlan`, `syncWorkPlanToSharePoint`, `assertWorkPlanEditable`, and `decodeWorkPlan`. Search these symbols rather than relying on historical line numbers.

Ordinary updates require a current item version, reject conflicting incoming revisions, and use `If-Match`. They refuse to overwrite interrupted activation, move a plan between divisions, or silently remove activated goals/KRAs/activities/Task links. Deleting a plan uses the same protection. `getWorkPlans` now throws on read failure and decodes both storage forms, but its general list fetch still needs pagination.

KPI create/update/map now carries `RelatedInitiativeLookupId`, including explicit clearing. Unrelated creates omit the optional field when not supplied. Updates refetch if the PATCH response lacks fields. Confirm the actual tenant column before relying on this mapping.

## 7. Activation engine: behavior and recovery contract

### Read-only preparation

The engine discovers actual list IDs by display name and follows continuation links, rejecting repeated links. Required lists must resolve uniquely. Corporate list discovery is optional, but a selected corporate reference cannot validate without the corresponding list and item.

Readiness checks engine text fields, multiline fields, indexed unique keys, base field presence, numeric progress/target fields, status choices, actual lookup targets/cardinality and payload storage. It reports incompatible existing definitions. It does not silently convert a lookup to a different target.

Validation checks plan dates, nonempty goals, unique local identities, unique existing execution record use, key lengths, explicit organizational/execution parents, division and actual ancestry. Every activity needs a source KRA, title, KPI definition, raw target and an existing-Task selection or create policy. Existing conflicting Task links are rejected; one Task cannot be claimed by two activities. Previously activated membership cannot be removed or reparented implicitly.

A changed positive existing numeric KPI target is blocked for percentage-impact review. Existing links must still point through the expected parent chain. This prevents a label edit or stale form from quietly turning into a migration.

### Execution sequence

1. Perform guarded access and schema readiness checks; read the persisted plan and ETag.
2. Reject a stale ordinary activation request, an unexpired running lease, or a different intent while an earlier run remains incomplete.
3. Decode persisted goals and recover previously created execution IDs by stable local IDs. A stale form can resume the same failed intent without losing already-created records.
4. Validate the recovered plan before execution entity writes.
5. Persist a running journal and source checkpoint using `If-Match`. Renew the 120-second lease at checkpoints.
6. Upsert one execution objective per divisional goal, one KRA per source section, one KPI per activity, then associate/create ordinary Tasks.
7. Checkpoint recovered/created IDs as the cascade progresses. Each entity PATCH uses that entity's ETag.
8. Mark the plan active and the journal complete with lease zero only after all steps succeed.
9. On failure, attempt to record failed state, error and recovered IDs conditionally. A stale failure handler must not overwrite a newer plan version.

The journal is stored in `ActivationJSON`:

```json
{
  "version": 1,
  "token": "a-generated-operation-uuid",
  "signature": "sha256-of-canonical-plan-intent",
  "state": "running",
  "leaseUntil": 0
}
```

This example shows shape only; a running operation has an actual future lease timestamp. States are `running`, `failed` and `complete`; an error may be recorded. The signature excludes generated execution IDs and mutable status/progress/update fields, but includes source/planning intent and existing-Task intent. Generated Task IDs for create policy do not turn a retry into a different request.

Created entities use a deterministic unique key:

```text
wp:<persisted-plan-id>:<entity-kind>:<encoded-local-id>
```

Keys must fit 255 characters. A lost POST response triggers lookup by key. If the item exists it is recovered; the engine does not blindly POST again. A journal alone would not prevent duplicates after a lost response, hence the separate server-side unique/indexed constraint. Checkpoints verify the returned journal token and persisted GoalsJSON.

### What the engine writes and preserves

| Record | Creation | Later metadata synchronization |
|---|---|---|
| Execution objective | Division goal, legacy parent, dates/year, Not Started, progress 0 | Title, description, metadata; preserve stored progress/status |
| Source KRA | Correct objective, Open, progress 0 | Title, description, metadata; preserve stored progress/status |
| Activity KPI | Correct KRA; manual mode; actual 0; simple compatible numeric target or null | Title, description, metadata; preserve actual, numeric target, mode, weights and status |
| New Task | Existing Task schema, Not Started, Medium, dates, department, confirmed assignees and links | Recovered by deterministic key |
| Existing Task | No replacement | Only consistent KPI/KRA link fields; preserve title, status, assignees, comments, attachments and other fields |

New target ratios require finite positive quantity, an operator other than at-most, and no service-level/population condition. Complex definitions remain structured metadata rather than a misleading ratio. This is deliberately incomplete measurement support: Phase 3 must implement evidence and calculation semantics. Raw Graph creation avoids invoking the legacy Task synchronization function that can convert a manual KPI into a checklist.

Goal measures remain objective/plan metadata, not additional activity KPI contributors. Full source text stays in metadata/descriptions when titles are shortened for SharePoint. Resolved email identities may be assigned; unresolved positions remain positions.

### Recovery runbook for a developer

| Symptom | Investigation and supported response |
|---|---|
| Activation already running | Read latest plan/journal; allow current lease/run to resolve, then reload. Do not delete the journal to bypass concurrency |
| Stale version / conditional update conflict | Reload authoritative plan and compare intent; do not force `If-Match: *` |
| Failed activation, same intent | Resume from the persisted edit URL; engine recovers checkpoint IDs and unique-key records |
| Failed activation, different intent | Reconcile/finish the interrupted intent first; changing the source under partial execution needs an explicit recovery design |
| Uncertain entity creation | Query the exact unique key and verify parent/metadata before any retry; never manually repeat a create without checking |
| Removal/reparenting blocked | Prepare an explicit migration with old/new ancestors, Task links and percentage impact; do not strip IDs to bypass protection |
| Lookup/schema mismatch | Compare actual column definitions and target list IDs. Do not patch data into a known wrong lookup |
| Payload missing/checksum failure | Inspect manifest and immutable chunks, restore verified data from an authorized backup; do not replace failed decode with an empty plan |

There is no complete retirement/rollback migration UI. Guards intentionally block unsupported destructive reconciliation. Do not describe this as automatic deletion, compensation or a multi-list database transaction: earlier writes may persist after a later failure, and recovery depends on the keys/checkpoints.

## 8. Schema preparation and large-plan storage

Schema inspection is read-only. The explicit admin action adds missing engine fields and appends required choices while preserving existing choices. It reports incompatible existing fields instead of converting them. Preparation was implemented but not run against a tenant.

| Location | Engine field requirements |
|---|---|
| Division_WorkPlans | ActivationJSON multiline; GoalsJSON multiline if absent; LegacyImportKey unique/indexed text |
| Unit_Objectives, Performance_KRAs, Performance_KPIs, Operations_Tasks | WorkPlanOperationKey unique/indexed text; WorkPlanMetadataJSON multiline |
| Performance_KPIs | KpiOwner and Assignees multiline if absent |
| Performance_KRAs | Unit and Division text if absent |
| Operations_Tasks | Assignees multiline if absent |
| Division_WorkPlanPayloads | PayloadKey unique/indexed text; Content multiline |

Required initial choices: objective/KPI/Task `Not Started`, KRA `Open`. Readiness also checks objective/KRA Progress and KPI TargetValue/ActualValue as numbers; it checks the five execution lookups listed earlier as single-value lookups to the actual expected lists. It does not certify all columns used by all other application workflows.

### Storage algorithm and compatibility

`GoalsJSON` remains an inline JSON array when serialization is at most 50,000 JavaScript string units. Larger plans serialize each goal separately, hash its JSON using SHA-256, and store immutable chunks of at most 50,000 UTF-16 units. A split is adjusted to avoid separating a surrogate pair. The key is `<goal-hash>:<zero-based-chunk-index>`.

The plan stores a small manifest:

```json
{
  "format": "work-plan-goals-v1",
  "refs": [
    { "hash": "64-lowercase-hex-characters-in-real-data", "chunks": 2 }
  ]
}
```

This is a structural illustration, not a valid manifest to insert. Readers validate actual hash format, chunk counts from 1 through 10,000, presence and reconstructed checksum. They return cloned goals. Invalid JSON, unsupported format, missing chunks or corruption fail visibly. Per-instance caches reuse unchanged payloads. The manifest itself must fit 50,000 units; excessive goal count is rejected with guidance to split the plan by period.

Chunks are stored before the conditional manifest update. Failed writes may leave unreferenced chunks, which are retained. There is no garbage collector or retention policy yet. Backups must include both plan manifests and referenced payloads. Individual execution metadata fields still have field-size limits; chunking the plan is not a universal solution for arbitrarily large activity descriptions.

**Rollback implication:** once a tenant has manifest-form plans, reverting to an old reader that assumes GoalsJSON is always an array can break reading or lose data. A future rollback must preserve compatible readers or deliberately restore verified inline/previous data. No live manifest was written in this implementation session, so no tenant rollback was needed here.

## 9. UI flow and explicit local-plan import

The existing work-plan table remains. Limited labels distinguish Organizational Alignment from Divisional Annual Goal. A row action opens the linkage/details dialog. It exposes organizational and legacy parents, existing execution objective, source KRA sections and objectives, selected activity KRA, raw/confirmed target, quarters, positions, dependencies, risk, budget, Task choice and goal measures. Other stored source fields survive even when there is no input for them.

Mapping options come from real paginated list reads, not a Strategy demo fallback. Objectives/KRAs are division-filtered; Tasks use known division/unit department names and compatible links. This is not yet canonical unit-ID reconciliation. Existing objectives are filtered by actual legacy parent, KRAs by selected execution objective, and Tasks by compatible KPI linkage. The user still must choose a substantively correct crosswalk.

For a new plan requested as active, the page first persists a draft, remembers its ID, and replaces the URL with the persisted edit route before activation. A refresh or retry after failure therefore continues the same plan. Existing draft activation does not first rewrite the recovery baseline. Save/activation errors remain visible in the editor.

Local import is explicit. The hook reads `scpng_workplans_<divisionId>`, requires a JSON array and applies the write policy. The service validates all source plan IDs/scopes, uses a unique `legacy:<divisionId>:<local-plan-id>` key, creates drafts, recovers uncertain creates by key and retains the browser copy. Repeating import finds already imported records instead of intentionally overwriting them. No local import was actually executed against a tenant. The complete local-import UI/service flow does not have independent end-to-end tenant coverage.

`previewWorkPlanActivation` exists as a service entry point; it is not a complete user-facing migration approval report. Phase 5 still needs per-screen membership/percentage deltas, source issues and recovery state in its preview. Do not equate a count preview with a production migration review.

## 10. Organizational progress: preserved behavior and known defects

The legacy `kpiUtils.ts` behavior is intentionally retained. These are compatibility observations, not recommendations for a new measurement standard.

| Level | Current behavior relevant to continuation |
|---|---|
| KPI | Completed/achieved/done gives 100; checklist uses checked ratio; task-completion uses linked completed Tasks when Tasks are supplied; otherwise actual/target capped at 100 |
| KRA | Closed/completed gives 100; no KPIs uses stored progress; positive weights use weighted KPI progress without supplying Tasks; otherwise uses percentage of completed KPI statuses |
| Objective | Averages KRAs; uses dynamic KRA calculation when the global KPI collection is nonempty, otherwise stored KRA progress |
| Organizational goal | Operational branch averages child objectives; corporate branch averages KRAs/initiatives; both branches present gives 50/50; an early empty-Unit-Objectives path can yield zero even with corporate work |
| Strategy/Home display | A calculated value greater than zero is used; otherwise stored objective progress can reappear. Home and Strategy do not necessarily include the same branches |

Controlled examples retained in the regression evidence include: operational 50 plus corporate 100 yielding Strategy 75 versus Home 50; valid calculated zero falling back to stored 70; corporate work yielding zero with no Unit Objectives but becoming visible with an unrelated Unit Objective; and a completed KRA's result changing when an unrelated KPI makes the global KPI collection nonempty. A manual KPI at 50/100 can still contribute zero to an unweighted KRA based on completed statuses.

Before fixing a calculation defect, record the screen, record IDs, branch membership, statuses, modes, weights, values, denominators, rounding and fallbacks. Distinguish a corrected calculation from newly discovered contributors. Keep source annual targets separate from organizational display percentages. Do not introduce source SGs as new organizational cards or add the 140 goal measures to the activity denominator without an approved model decision.

## 11. Finding-by-finding closure register

The labels below summarize the original audits; consult their detailed evidence before implementing. “Partial” means local safeguards exist but the finding is not closed end to end.

| Finding | Handoff status | Remaining work |
|---|---|---|
| F01 — mixed strategic ID spaces | Partial: qualified references and explicit compatibility parent | Tenant crosswalk and consumer reconciliation |
| F02 — missing initiative mapping | Local service mapping fixed | Verify actual column and tenant behavior |
| F03 — inconsistent progress meanings | Open; formulas preserved | Measurement contract and consumer evidence, Phases 3/4 |
| F04 — empty/reopened work retains completion | Open | Recompute zero-child/reopen lifecycle and ancestors |
| F05 — Task link changes manual KPI mode | Open, production activation blocker | Preserve mode and explicit conversion semantics |
| F06 — first-page synchronization | Open in general operations | Exhaustive pagination without removing valid links |
| F07 — create/delete/reparent/dual links | Partial: work-plan protections | General lifecycle and old/new ancestor reconciliation |
| F08 — editor drops identities | Fixed locally with regression checks | Authenticated editor acceptance |
| F09 — labels and wrong-list IDs | Partial: explicit dialog/validation | Real crosswalk and legacy data reconciliation |
| F10 — title-only KRA reuse | Fixed locally; selector uses identity | Browser acceptance for same-name records |
| F11 — route/write scope | Partial: route, hook and service guards | SharePoint ACL/direct-access verification |
| F12 — optional ancestry/filtered parents | Open | Valid scope and ancestry across general workflows |
| F13 — hidden read/save failures and stale queries | Partial: work-plan failures/version checks | General error propagation and invalidation |
| F14 — division report period/scope | Open | Real scoped period evidence |
| F15 — unit report interval/history | Open | Correct interval inclusion and snapshots |
| F16 — division alignment/risk/health | Open | Actual linkage validation and derived risk/unit health |
| F17 — current values presented as history | Open | Dated observations and real completion events |
| F18 — AI/demo/export provenance | Open | Shared scoped evidence and explicit provenance |
| F19 — graph omits/or mis-scopes nodes | Open | Orphans, cycles, owners and conservation diagnostics |
| F20 — graph ignores evidence/direct Tasks | Open | Checklist/direct Task/no-data/scope semantics |
| F21 — schema/runtime mismatch | Partial: new engine preflight | General service schema and actual tenant validation |
| F22 — retry/concurrency/reconciliation | Partial: new engine keys, ETags and recovery | General operation safety; explicit retirement/migration |

| Source finding | Handoff status | Remaining work |
|---|---|---|
| A01 — source KRA boundaries | New engine groups by source KRA | Stage actual 53 sections; reconcile existing data |
| A02 — target semantics | Raw/structured targets, no universal 100 | Specialized calculations and evidence |
| A03 — goal measures | Separate metadata implemented | Appropriate display/report interpretation |
| A04 — source metadata | Types/preservation/dialog implemented | Actual import completeness and full consumer exposure |
| A05 — identity loss | Editor fixed locally | Tenant/browser acceptance |
| A06 — activity to ordinary Tasks | Explicit association/create implemented | General Task synchronization must preserve it |
| A07 — organizational crosswalk | Explicit qualified model implemented | Business-approved tenant mapping |
| A08 — officer-only restriction | Earlier prototype rule not adopted | Resolve roles/permissions against real source owners |
| A09 — positions and shared units | Metadata retained | Canonical units, vacancies and verified assignees |
| A10 — percentage preservation | Formulas unchanged; fixture evidence | Measured per-screen live comparison |
| A11 — reporting | Open | Phase 4 |
| A12 — inconsistent source | Issues documented, not invented away | Source-owner decisions and Phase 5 staging |

## 12. Validation evidence and reproduction

Preserved outputs are indexed in [handoff-evidence/README.md](handoff-evidence/README.md). They are prior validation runs, copied for portability; documentation preparation did not rerun a live tenant test. The manifest records relevant source/test fingerprints for comparison.

From the repository root in PowerShell:

```powershell
node --test src/tests/workPlanPreservation.test.cjs src/tests/workPlanAccessIdentity.test.cjs src/tests/workPlanActivation.test.cjs
npm run build
npx tsc --noEmit -p tsconfig.app.json
```

| Check | Recorded outcome | Interpretation |
|---|---|---|
| Focused Node suites | 37 passed, 0 failed | Actual TS methods/callbacks exercised with mocked inputs/Graph |
| Production Vite build | Passed; final log reports 3 minutes | Bundles successfully; not proof of clean TypeScript or tenant compatibility |
| TypeScript app check | Exit 1, 233 diagnostics | Same file/message pairs as Phase 1 after ignoring shifted line/column positions |
| Targeted diff whitespace check | Passed for remediation tracked source changes | Excludes unrelated/generated file warnings |
| Graphify rebuild | 638 files; 2,783 nodes; 3,147 edges; 635 communities | Knowledge graph refreshed after code changes |
| Browser / live tenant | Not performed | Required before acceptance |

Tests use the installed TypeScript compiler with Node's built-in test runner and VM/harness contexts. Some tests extract actual methods/callbacks rather than instantiate the entire React application or Graph SDK. They are meaningful local regressions, not full integration/security tests. The package's `npm test` points to Vitest, but Vitest was unavailable and is not declared in the shown dev dependencies; that command previously failed. The focused `.cjs` suites avoid requiring it.

Coverage includes preservation across edits/repeated saves, duplicate labels, stale selector IDs, role/scope denial, invalid ancestry, source KRA grouping, separate goal measures, existing Tasks, uncertain POST recovery, interrupted same-intent retries, competing leases, wrong lookup targets, same-number cross-list IDs, guarded removal, metadata-only progress preservation, initiative clear/update and draft URL identity.

The large-plan fixture uses **14 × 32 = 448 artificial activities** to exercise capacity. It is not an imported version of the source's 408 activities. Unicode chunk handling is also tested. Do not cite that fixture as source completeness evidence.

Build warnings include large chunks, dependency PURE annotations and an unresolved LED font reference. Existing TypeScript examples include missing `businessUnits`, missing `SupabaseDataImporter`, asset type mismatches and missing test tooling. No new/removed diagnostic file/message pairs were found compared with the Phase 1 log; this does not establish a clean pre-project baseline.

Node v24.11.1 was observed. The project has installed dependencies; package.json declares React 18, TypeScript ^5.5.3 and Vite ^5.4.19 among others. Use the repository lockfile for exact dependency reproduction. An isolated build initially failed because esbuild could not read parent configuration paths; the final build succeeded with an approved outside-sandbox retry. This was an environment access issue, not a reported source fix.

### Graphify requirement

Project instructions require reading `graphify-out/GRAPH_REPORT.md` before architecture work and navigating `graphify-out/wiki/index.md` when present. The report is newer than the wiki index's aggregate counts; do not confuse the older wiki metadata with the final rebuild.

After any subsequent code modifications run the instructed rebuild:

```powershell
python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

On this Windows machine `python3` resolved to an unavailable Store alias. The equivalent working command was:

```powershell
py -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

Environment note from handoff preparation: the `py` launcher subsequently returned `No installed Python found!` in the current tool environment. The installed interpreter at `C:/Users/IT_UNIT/AppData/Local/Programs/Python/Python311/python.exe` successfully ran the documentation packaging checks. If launcher discovery fails, use an explicitly verified interpreter and confirm that it has Graphify installed before rebuilding. The successful graph rebuild above is the recorded Phase 2B result, not a fresh handoff-time rebuild.

This handoff changes documentation only; it does not require a fresh code graph rebuild.

## 13. Next developer: prioritized continuation plan

### First working session

1. Obtain the complete working tree and verify the manifest. Review unrelated changes before preparing commits; do not reset them.
2. Read the graph report/wiki, this handoff, source audit and remediation tracker. Confirm the phase-number distinction from older roadmaps.
3. Reproduce the focused tests, build and type-check baseline in the received environment. Record differences rather than suppressing existing errors.
4. Inspect general Task/KPI write/synchronization methods in `sharePointOpsService.ts`, the calculation utilities and their callers. The original application audit supplies entry points for reporting and graph consumers.
5. Plan the first Phase 3 slice around mode preservation and complete pagination. Keep production activation blocked until this interaction is verified.
6. Present the phase scope and retain the user's checkpoint workflow. Do not claim this documentation transfer authorizes a live import.

### Phase 3 acceptance work

| Priority / slice | Concrete work | Minimum evidence before closure |
|---|---|---|
| P0: preserve KPI mode | Stop Task association/sync silently converting manual measurements to checklists; define explicit conversion behavior | Link/update/unlink Tasks around a manual KPI without changing its mode or observed actual; separately test intended checklist/task modes |
| P0: paginate | Follow every relevant continuation for Tasks, KPIs, KRAs, objectives, work plans and consumer fetches | Parents/Tasks on later pages remain linked; no first-page checklist deletion; repeated-link errors visible |
| P0: lifecycle | Reopen, delete, empty-child, dual-link and reparent handling | Correct zero state and old/new ancestors; no dangling or cross-parent links; preserved Task identities |
| P1: specialized measurement | Counts, percentages, at-most time, population/SLA, recurrence, milestones, continuous/as-required work | Source examples in section 4 have explicit evidence and truthful no-data states; planned ticks never become completion |
| P1: general concurrency | Conditional updates/retries and accurate query invalidation outside activation | Concurrent changes do not overwrite newer data; errors do not appear as successful empty results |
| P1: graph integrity | Orphan/cycle detection, record conservation, owner/unit/division scope, direct Task/checklist evidence | Every input record is included or diagnosed; no silent omission; do not replace screen formulas without parity evidence |
| P1: retirement design | Explicit removal/movement review instead of guard bypass | Recorded old/new parents, Task links, retained evidence and percentage deltas; safe interrupted recovery |

Some slices may warrant separate checkpoints. Avoid mixing a global formula replacement with pagination and lifecycle fixes: it becomes difficult to attribute changed percentages. Capture the original results and contributors first, then report the expected effect of each correction.

### Phase 4 acceptance work

Build a shared scoped evidence context for screen, report, export and AI consumers. Respect selected division/unit and real reporting intervals. Use interval overlap and actual completion events, not merely lastModified. Store dated progress observations or frozen report snapshots before presenting historical trends. Fix alignment to validate a real ancestry chain, preserve risk status and calculate unit health from evidence.

Exports and AI input must carry the same filters, identifiers, Tasks, checklists, modes, weights and provenance as the visible report. Label demo/synthetic records. Verify that a historic report does not change just because today's KPI changes. The goal is consistent evidence with explicit formulas, not an unsupported claim that every screen already measures the same thing.

### Phase 5 acceptance work

Start with paginated, read-only tenant inventory: list/column definitions, lookup targets, permissions, record counts and links, duplicate/orphan records, relevant local plans and source provenance. Stage the actual 14/53/408 detailed source content while retaining missing sections and discrepancies. Have source owners decide disputed amounts, targets and missing content. Resolve real organizational/legacy/execution crosswalks and canonical unit/position mappings.

Capture per-screen pre-migration contributor IDs and percentages, including statuses, modes, weights, numeric values, branch selection, fallback and rounding. Preview creates, links, updates, removals and regrouping separately. Regrouping old activity-per-KRA data into actual source sections is a migration with a denominator impact, not a metadata edit. Present expected differences and obtain the required review before changes.

Only then prepare the tenant schema through the admin action, verify payload-list access, test a controlled representative plan and perform authenticated end-to-end acceptance. Define backup/rollback and chunk retention first. Include interrupted activation, concurrent operators, later-page records, same-name parents, composite targets, multi-unit obligations and existing Tasks in the acceptance set. Preserve a before/after record manifest and proof that Task identities and unrelated fields survive.

## 14. Remaining review questions and operational limits

These are follow-up areas, not claims of tested defects in every new path:

- The count-preview service is not a complete migration approval experience; retry/stale-plan preview accuracy still needs review.
- General work-plan listing remains first-page limited. The new engine's paginated reads do not fix every operations-service caller.
- Mapping uses normalized division/unit names for Task options; canonical unit IDs, aliases and actual access need reconciliation.
- Application authorization does not replace tenant ACLs, especially for the new payload list and direct Graph access.
- Local import has guarded/idempotent service logic but no complete live end-to-end acceptance test.
- Unsupported measurements keep their source definition but do not yet calculate evidence-based completion.
- Source metadata is retained; existing report/AI consumers are not all upgraded to use it.
- Interrupted activation and activated removal are protected, but a full operator-facing retirement/migration workflow is unfinished.
- Immutable chunk retention, cleanup and backup policy are not implemented. Do not delete chunks merely because the newest plan no longer references them; prior versions may still need them.
- Existing schema preparation utilities outside the new engine may have different assumptions. The new readiness check is not certification of those utilities.
- Build, fixture compatibility and mocked access checks do not establish real percentage parity, production security or rollout acceptance.

Future progress reports should state implementation status, test scope and remaining tenant work separately. Close findings with evidence, not just a changed function. Preserve this dated handoff as a checkpoint and add later dated results instead of rewriting history to imply the pending phases were already completed.
