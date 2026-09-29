# Phase 5A — Production tenant-adapter implementation

Date: 10 September 2026
Status: server-side adapter code and failure-injection tests complete locally; service identity provisioning, provider configuration and controlled tenant UAT remain gated.

## Result

The trusted scheduled-delivery executor now has concrete adapters for the production schema verified in Phase 5:

- an exact `Performance_Reports` archive reader that requests one storage ID and verifies the immutable snapshot checksum before returning it;
- an append-only delivery journal that filters on indexed `ReportType`, verifies every matching event checksum and exposes only `POST` for new lifecycle records;
- a `Report_Schedules` checkpoint repository that uses the current item ETag and `If-Match` for lease, sent and failed transitions, treating HTTP 412 as a lost claim;
- a server-side Resend email adapter that supplies the deterministic dispatch ID as `Idempotency-Key` and requires the provider's durable email ID;
- a configuration guard that accepts only a service identity restricted through `Lists.SelectedOperations.Selected` to the exact reports and schedules list IDs.

The executor now passes the provider message ID into the sent checkpoint, allowing `LastProviderMessageId` to preserve the same durable ID already written to the immutable delivery event.

Primary paths:

- `src/services/strategyReportTenantAdapters.ts`
- `src/services/strategyReportSchedulerService.ts`
- `src/services/strategyReportArchiveService.ts`
- `src/tests/strategyReportTenantAdapters.test.cjs`
- `src/tests/strategyReportScheduler.test.cjs`

## Safety boundaries

The adapters are not imported by the browser application and no timer, flow, webhook, queue worker or active schedule invokes them. API keys and Microsoft client credentials are constructor inputs for a future server-side host; none are stored in the repository or exposed through Vite variables.

The factory's least-privilege check is a fail-closed configuration guard, not a capability attestation. Activation still requires observed tenant evidence that the configured application has only the intended list access.

Resend currently documents a 24-hour idempotency-key retention window. Controlled UAT must verify duplicate suppression and the operating runbook must require automatic retries inside that window. A dispatch whose provider result remains ambiguous after the window must stop for manual reconciliation; it must not be automatically resent.

No production SharePoint item was read or written during implementation, no permission was granted, no email was sent, and no schedule, flow, merge or deployment was activated.

## Local verification

- Focused archive/executor/readiness/adapter suites: **31/31 passed**.
- Full strategy execution regression: **129/129 passed** across thirteen `.cjs` suites.
- New adapter paths add **zero TypeScript diagnostics**; the combined dirty workspace baseline remains affected by unrelated asset-workstream diagnostics and must not be used to stage those files with this change.

## Next controlled UAT step

Before any test run, an administrator must provision a dedicated application identity with `Lists.SelectedOperations.Selected` and grant write access to exactly the recorded `Performance_Reports` and `Report_Schedules` lists. The email owner must configure a verified Resend sender and secret outside the repository.

A separately approved UAT run then needs exact values for:

1. the inactive schedule item ID;
2. the checksum-verified archive item ID bound to that schedule;
3. the controlled recipient and optional copy recipient;
4. the dedicated application tenant/client credentials supplied through the server-side secret store;
5. the verified Resend sender and API key supplied through the server-side secret store.

The run must preserve evidence for exact archive read, append-only queued/sent/failed events, an ETag race returning busy, sent-checkpoint repair, duplicate suppression using the same idempotency key, durable provider message ID and the effective selected-list grants. Production activation remains a later, separate decision.
