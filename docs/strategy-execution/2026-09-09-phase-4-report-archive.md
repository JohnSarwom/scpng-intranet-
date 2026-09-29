# Phase 4 — Immutable report archive, generation history and AI evidence boundary

Date: 9 September 2026
Status: implemented locally; tenant schema/ACL verification remains a Phase 5 gate.

## Result

Division and Unit report generation now persists the exact conserved graph snapshot before displaying it. Preview, print and CSV read the stored snapshot; they do not recalculate history from current Tasks or performance records. Both screens load authorized persisted history from `Performance_Reports` and reopen the archived snapshot. The same frozen rows now drive traceability, division/Unit heatmap, unlinked-record, evidence-warning, overdue, owner-accountability, progress-variance and KPI-review-governance presentations.

Division and Strategy AI now use the same archive boundary. A shared read-only loader obtains history through the authoritative archive service, which verifies every checksum and filters by the signed-in actor's exact scope. Division AI requires an exact matching Division archive and never falls back across Divisions. Strategy AI prefers a corporate archive and otherwise uses only the newest archive already authorized to that actor, retaining and displaying that narrower frozen scope.

The model context contains the archive storage ID, snapshot ID, SHA-256 checksum, exact scope, reporting window, graph capture time, date basis, data-source statement, progress formula, frozen summary and selected frozen report rows. It accepts no live page metrics. Prompts prohibit recalculation and scope widening, and a response guard withholds model output if it contains a numeric fact absent from the serialized archive context. The Division and Strategy panels also derive their teaser figures and evidence-filter counts from the selected archive rather than current page arrays.

`StrategyReportArchiveService` provides the storage-independent governance boundary:

- append-only archive records; no update or delete path;
- recursive cloning/freezing before and after persistence;
- SHA-256 checksum verification on every history load;
- exact personal, Unit and Division scope identities;
- authoritative actor/role resolution through `/me` and `UserRoles` before archive writes or reads;
- Division generation restricted to same-division managers/directors or administrators;
- corporate/audit access restricted to administrators;
- retention set to `hold-until-policy-approved`, so the application does not invent a deletion period;
- append-only, separately checksummed queued/sent/failed delivery events linked to the archived snapshot checksum;
- fail-closed print and CSV delivery journaling, with the hydrated delivery history visible beside the archived report.

The existing SharePoint adapter stores the full envelope under template `strategy-report-archive-v1`. Report generation fails closed if `Performance_Reports` is unavailable; it no longer creates that list implicitly. Schema preparation and ACL changes remain explicit administrator/Phase 5 work.

The scheduler now has a typed `strategy-report-archive-v1` / `strategy-report-delivery-v1` deployment contract. A schedule binding freezes the archive storage ID, snapshot ID, SHA-256 checksum, exact scope and recipients; dispatch-envelope construction re-verifies them before exposing the frozen snapshot. The [Phase 4D executor core](2026-09-09-phase-4d-scheduled-delivery-executor.md) adds deterministic dispatch IDs, conditional schedule leases, queue-before-send journaling, idempotent provider keys, sent/failed records and retry-safe checkpoint repair. Active schedule saves remain blocked until the tenant adapters are verified. Both old Power Automate deployment entry points are unconditionally quarantined after contract validation and no longer import or submit the independently calculated flow definitions.

The dedicated [retirement governance history](2026-09-09-phase-4c-governance-history.md) is also complete locally. Authorized managers/directors can inspect only their exact Division and administrators can inspect across Divisions. Completed and interrupted retirement journals expose affected records, conserved evidence, reviewed progress impacts, actors, checkpoints and recovery information through a recursively frozen read-only projection. The UI intentionally provides no reversal action while reversal policy remains unapproved.

## Validation

- Full strategy/work-plan suite: **114/114 passed** across eleven suites.
- Reporting/archive/AI-focused suite: **20/20 passed**, covering immutable checksummed storage, authorization-before-write, scoped history, snapshot and delivery tamper rejection, append-only delivery hydration, specialized governance rows, CSV parity, schedule binding/deployment gates, SharePoint envelope round-trip, exact Division selection, corporate preference without scope widening, archive provenance serialization and unsupported-number rejection.
- Governance/access/retirement focused suite: **42/42 passed**.
- Archive/scheduled-executor focused suite: **16/16 passed**.
- Production build: **passed**, 5,505 modules transformed. Previously recorded Browserslist, dependency annotation, runtime font, mixed-import and large-chunk warnings remain.
- TypeScript: **233 diagnostic lines / 165 normalized file-message pairs**, exactly equal to the recorded Phase 1 baseline. No added or removed normalized diagnostics; no archive/reporting/AI production-file diagnostics.
- No live report, list, schema, schedule, email, SharePoint record, import, deployment or commit was created by these checks.

## Remaining Phase 4 work

1. In an approved non-production tenant, verify and implement the SharePoint archive-read, conditional schedule checkpoint and idempotent email-provider adapters behind the completed executor core. The quarantined legacy flows cannot be deployed through the application.
2. Obtain an explicit governance decision before designing reversal. The completed history view remains read-only; interrupted operations continue to use same-intent recovery.
