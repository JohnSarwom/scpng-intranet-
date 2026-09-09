# Phase 4D — Trusted scheduled-delivery executor core

Date: 9 September 2026
Status: provider-neutral executor core implemented and verified locally; tenant adapters, schema verification and deployment remain gated.

Continuation: the [Phase 4E scheduler tenant-readiness layer](2026-09-10-phase-4e-scheduler-tenant-readiness.md) now provides the GET-only inventory and evidence-gated manifest required before tenant adapter work.

## Result

The application now has a provider-neutral scheduled-delivery executor that can consume only a persisted `strategy-report-archive-v1` binding. It has no input for live Tasks, KRAs, KPIs, page totals or independently calculated metrics. The email subject, summary and provenance are rendered exclusively from the checksum-verified immutable dispatch envelope.

The executor protocol is:

1. Validate the schedule request, due time and deterministic dispatch identity.
2. Acquire a conditional schedule lease before reading or sending.
3. Reload the archive by its exact `Performance_Reports` storage ID.
4. Re-verify snapshot identity, SHA-256 checksum and exact scope against the frozen binding.
5. Read only checksum-verified delivery events and detect an already-sent dispatch.
6. Append a `queued` email event before calling the provider.
7. Send with the deterministic dispatch ID as the provider idempotency key.
8. Append `sent` with the provider message ID, then advance the schedule checkpoint.
9. On failure, append a `failed` event where the archive is trusted and leave a recoverable schedule checkpoint.

If a provider accepted an email but the journal or schedule checkpoint failed, a retry uses the same idempotency key. If the `sent` event exists, the executor repairs the schedule checkpoint without sending again. A busy lease returns without archive reads, journal writes or email. A future dispatch fails before claiming the schedule.

## Contracts and quarantine

The deployment contract now additionally requires:

- executor ID `strategy-report-scheduled-delivery-v1`;
- verified conditional schedule lease/checkpoint writes;
- a verified idempotent email provider;
- exact archive storage/checksum fields;
- verified archive reads and append-only delivery-journal writes.

The existing Power Automate flow definitions remain source evidence only. Their deployment methods now call an unconditional legacy-flow quarantine after readiness validation and no longer import or submit the legacy definitions. This prevents a fabricated readiness object from deploying flows that recalculate current Tasks/KRAs/KPIs or use the Google Sheets AI queue.

The tenant adapters are intentionally not implemented without verified list fields, ETag behavior, service identity, ACLs and provider idempotency semantics. No active schedule can be saved through the existing UI, and no deployment or send path was enabled.

Primary paths:

- `src/services/strategyReportSchedulerService.ts`
- `src/services/strategyReportArchiveService.ts`
- `src/services/powerAutomateService.ts`
- `src/tests/strategyReportScheduler.test.cjs`
- `src/tests/strategyReportArchive.test.cjs`

## Validation

- Archive/executor focused gate: **16/16 passed**.
- Full strategy/work-plan suite: **114/114 passed** across eleven `.cjs` suites.
- Production build: **passed**, 5,505 modules transformed.
- TypeScript app check: **233 inherited diagnostic lines**, with zero diagnostics in the scheduler, archive or Power Automate service paths.
- Graphify refreshed successfully: **2,908 nodes, 3,475 edges and 646 communities** across 649 files.
- No email, schedule, SharePoint record, schema, flow, deployment, import, commit or pull request was created.

## Remaining Phase 4D work

In an explicitly approved tenant environment:

1. Run the Phase 4E GET-only inventory and verify the archive-bound schedule columns without creating or changing them implicitly.
2. Verify SharePoint ACLs and the executor service identity for exact archive reads, append-only delivery writes and conditional schedule checkpoint writes.
3. Select an email provider that enforces the supplied idempotency key and returns a durable provider message ID.
4. Implement the three tenant adapters behind the executor interfaces and run controlled failure-injection tests.
5. Activate one non-production schedule only after security, delivery and business-owner UAT sign-off.
