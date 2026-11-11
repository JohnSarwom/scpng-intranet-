# Newsletter performance optimization plan

Prepared on 22 October 2026 for the intranet maintainer and authorized tenant administrator. This is a proposed engineering approach, not a record of changes already deployed. It preserves the agreed intranet interface, SharePoint data store and Power Automate workflow ownership. New permissions, licensing, endpoints or flow changes require their own review and controlled acceptance before live use.

## Recommendation

Treat the scheduled command queue as a reliability mechanism rather than the permanent interactive path for every screen read and write. First measure where time is spent and add recovery by original request ID. Then reduce unnecessary work and separate reads from decisions. If licensing, authentication and browser integration permit it, pilot an authenticated immediate Power Automate entry point while keeping SharePoint as the durable command and result store.

Do not promise an instant result from simply enabling parallelism or increasing a timeout. The deployed parallel-read update executed successfully, but one workspace load was still observed within 101 seconds. That is evidence that the speed problem remains open, not evidence of a statistically meaningful before-and-after improvement.

## Measured baseline and its limits

| Observation | Recorded value | Interpretation |
| --- | --- | --- |
| Source recurrence setting | Every one minute | Configured cadence, not a guaranteed dispatch time |
| Drain batch | Up to 50 queued commands | Commands are handled sequentially in the current writer |
| Frontend polling interval | Nominally two seconds | Network and browser scheduling can increase effective delay |
| Frontend polling window | Three minutes after queue creation | A timeout does not establish failure or cancel the flow |
| Post-update live run | 86 seconds | Entire read-only run including its other enabled processing |
| Workspace observation | Loaded within 101 seconds | Upper-bound observation for one signed-in refresh |
| Current definition | 500 actions and eight nesting levels | Limited room for additive edits without restructuring |

The recorded submit request succeeded after the browser timed out. Earlier idle runs commonly displayed roughly 26 to 37 seconds, and multi-request runs lasted several minutes. These are run-history observations with different workloads. They must not be presented as an isolated save benchmark or used to calculate a percentage improvement.

No distribution of repeated samples, connector timing breakdown, verified owner licence inventory or realistic concurrent-user benchmark has been recorded. Treat throttling, connector overhead, scheduling, authentication delays and browser timer behavior as hypotheses until individually measured.

## Current latency path

The browser obtains a Microsoft Graph connection and creates a creator-owned SharePoint command. The scheduled Processor waits for an available run, performs preflight and roster checks, reads a queue batch, processes commands in order, validates the current authority and record version, writes results, and eventually makes them visible to the browser's next poll.

Observed latency is therefore the sum of authentication, command creation, dispatch waiting, backlog, flow validation, action execution, result writing and browser observation. A screen load currently asks for both session data and a record list. A changed draft followed by submission can still require a save command and a submit command. The previous fixes skip redundant saves and reloads but leave this transport architecture in place.

Keeping all operations in one scheduled flow also means that read traffic competes with decisions. Reading the staff roster, list schemas and configuration during idle runs consumes work even when no interactive command is ready. The same Processor includes publication, reminders and email behavior, although scheduling and staff email are disabled for this pilot.

## Proposed performance targets

These are engineering acceptance targets for a pilot design, not promised service levels or results achieved by the current implementation. Confirm feasibility and budget before adopting them operationally.

| Interaction | Proposed target at the 95th percentile | Correctness requirement |
| --- | --- | --- |
| Local field validation or unchanged save | Under one second | No backend command is issued |
| Initial workspace or reader view | Under five seconds | Current user sees only authorized content |
| Receipt of a changed draft command | Under two seconds | A durable request key is visible; receipt is not labelled Saved |
| Confirmed changed draft save | Under ten seconds | Authoritative revision and audit result are committed |
| Confirmed submit or review decision | Under fifteen seconds | Current authority, content version and assignment are checked |
| Recovery of an existing outcome | Under five seconds once available | The same request is read, with no replacement mutation |

Measure initial sign-in separately from an already-authenticated interaction. Report the median and 95th percentile, sample count, failures and maximum, not only the fastest demonstration. Human reviewer response time is a business measure and is not part of the technical decision-write target.

## Phase one establish a trustworthy timing profile

Create a correlation record for each test containing request key, action, submission ID, actor identity reference, record revision and test condition. Record browser start, authentication ready, queue receipt, flow start, request Processing, mutation completion, result available and UI update. Where existing fields cannot supply these timestamps, add minimal protected operational metadata through a reviewed definition change; do not repurpose a business audit timestamp as a queue timing measurement.

For each interaction calculate dispatch wait, queue wait, processing time and delivery delay separately. Use supported run-history action durations without exposing masked content, and record any 429 responses, Retry-After values, retries, connection faults, skipped triggers or capacity warnings. Confirm the actual owner plan in Power Automate and the administrator's usage reports. Microsoft documents that performance profiles and limits depend on the owner's plan, and that connector limits can apply independently. [Microsoft flow limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).

Run a controlled set of at least 20 samples for each key path: workspace read, published read, create, changed save, unchanged save, submit and recovery. Separate empty-queue, small-backlog and planned-concurrency conditions. Use disposable, clearly marked pilot records for write tests; do not repeatedly alter the already-submitted record. Preserve the audit and ledger. Profile the slowest action groups before replacing the flow design.

Acceptance for this phase is a reviewed timing report that explains the dominant delay and distinguishes licensed limits from application work. If evidence does not explain the delay, collect the missing measurements rather than changing security settings speculatively.

## Phase two improve reliability and immediate feedback

Add a first-class pending-operation record to the frontend containing the original request key, queue item ID, action, account context and latest observed status. Keep content and tokens out of this recovery record. If continuity across a reload is required, use a reviewed account-scoped record of identifiers with a defined expiry; clear it on logout and reject account mismatches. A queue item must still be read through SharePoint authorization and checked against the expected request key.

Provide Check status for that original request. A timeout should leave the operation as unconfirmed and prevent a second approval or publication command until its outcome is reconciled. Once Succeeded, apply the confirmed revision to the current in-memory view. Failed and Uncertain require different handling; Uncertain must route to reconciliation rather than automatic replay.

Show distinct states for submitting to SharePoint, queued for the workflow, processing, saved and unconfirmed. Display a request reference and elapsed time. Allow safe reading of the existing record while an operation is pending, but lock conflicting decisions for that record. Do not display Saved when only a queue receipt exists, and do not use a longer spinner timeout as the performance solution.

Bound authentication, individual network operations and overall read waiting deliberately. Aborting a POST or closing a page does not establish that the server did nothing. Resolve a lost create response by the same key and preserve the unique ledger boundary. The current guards for account changes and confirmed results must remain in place.

Also make all selected-record views share a single stable workspace loading context, and add a regression test covering create navigation and account switching with real router behavior. Consider a single trusted workspace read action returning session plus visible records to replace two queued reads. This is a proposed backend contract change; it must include tenant authorization tests and does not itself remove the scheduled wait.

## Phase three remove avoidable backend work

Use the timing profile to select reductions rather than assuming every parallel branch helps. The deployed preflight reads already join before validation, and per-request ledger, configuration and routing reads already run together. Keep those dependency barriers. Microsoft's guidance supports independent parallel operations but cautions that excessive concurrency has overhead and can overwhelm downstream services. [Microsoft parallel execution guidance](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/implement-parallel-execution).

Investigate an inexpensive dispatch check before full preflight on idle cycles. Preserve due background work: an empty interactive queue alone cannot justify skipping scheduled publication or delivery once those features are enabled. A reviewed dispatcher must identify queued work or due background work, with a durable checkpoint and a maximum delay for each category.

Profile repeated schema, directory, profile, folder and configuration reads. A versioned, trusted server-side snapshot may reduce repeated reads, but define who updates it, how freshness is established, how failure blocks processing, and how urgent account or appointment revocation invalidates it. Keep current authorization checks on sensitive actions. A browser cache or an undocumented long TTL must not become the staff source of truth.

Evaluate consolidating pure validation expressions where it demonstrably reduces action overhead. Preserve every predicate, error category and fail-closed dependency, including roster completeness, protected store permissions and creator-only list settings. Test the combined expressions against all invalid cases and the expression-size limit. Do not remove checks merely to shorten a flow.

Separate scheduling, overdue notices, delivery and maintenance from the interactive path when measurements show contention. SharePoint claims, ETags and the private ledger must prevent two workers from acting on the same command or publishing the same revision. Do not run the old and new writers concurrently without an explicit ownership and handoff protocol.

The current native definition has no headroom for additional actions without restructuring. Consider reviewed child flows or smaller action-specific flows, checking solution packaging, connection references, licensing and failure propagation in the tenant. Do not assume a generated child flow is callable merely because an offline test accepts its JSON.

## Phase four pilot an immediate authenticated entry point

The preferred interactive proof of concept is an authenticated Power Automate endpoint that wakes processing after the signed-in app has durably created a SharePoint request. The body carries only the request item ID, key and supported action reference. The flow reads the authoritative request and resolves its real SharePoint creator. It must not accept a client-provided author, administrator flag, reviewer identity or content revision as authority.

The wake endpoint returns a receipt or an already-recorded outcome for that exact command. The existing creator-readable request remains the recovery path. Where a synchronous result is feasible, return the confirmed outcome only after the protected write is committed; fall back to an honest pending response when needed. The ledger prevents replay from repeated wakes, retries or fallback polling.

Microsoft supports restricting HTTP request triggers to authenticated tenant users or specified tenant identities. This capability, regional availability, correct flow-service token audience, required consent, browser cross-origin behavior and the environment's licence entitlement must be verified in a proof of concept. The app's existing Graph token must not be assumed valid for a different audience. Never expose an anonymous signed callback URL or embed a secret in the intranet bundle. [Microsoft HTTP trigger authentication](https://learn.microsoft.com/en-us/power-automate/oauth-authentication).

Validate the authenticated caller against the command creator or an explicitly authorized operator before accepting a wake, and return no private record to an unrelated caller. Keep routing administrators managed by intranet roles rather than a hardcoded endpoint allowlist. Endpoint authentication and business authorization are separate checks.

The existing scheduled flow can be a recovery sweeper only after the worker ownership model is tested. Exactly one path must win the private reservation for a command. Different commands targeting the same record require the existing ETag checks and, if concurrency is introduced, a reviewed per-record serialization or lease design. Current per-run variables must never be shared through an unsafe parallel foreach mutation loop.

A SharePoint item-created trigger is an alternative experiment when the authenticated endpoint is unsuitable. Do not assume it is instantaneous: Microsoft notes that polling triggers and licence plans can affect trigger delay. Establish actual tenant behavior before committing to this alternative. [Microsoft trigger troubleshooting](https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/flow-run-issues/triggers-troubleshoot?tabs=new-designer).

## Read architecture options

| Option | Potential advantage | Main constraint | Recommendation |
| --- | --- | --- | --- |
| Retain all reads in the scheduled command queue | Smallest operational change | Reads still wait and compete with writes | Temporary fallback only |
| Use a separate authenticated read flow | Avoid the mutation queue and its ledger writes for pure reads | Licensing, latency and authentication need proof | Preferred first read-path experiment |
| Use permissioned SharePoint read projections | Normal authenticated reads avoid workflow dispatch | New projection and ACL lifecycle must be correct | Consider after privacy design review |

Do not expose `Newsletter_Submissions`, routing, notifications or private source files broadly to accelerate reading. A browser filter is not an access-control boundary. A published projection must contain only permitted fields and enforce audience membership in SharePoint or a trusted read service. A private workspace projection needs server-managed author and reviewer access, reliable revocation and removal when an appointment changes. The SharePoint connector is a standard connector, but that fact alone does not establish that every proposed trigger, endpoint or child-flow arrangement is covered by this tenant's licence. [Microsoft SharePoint connector reference](https://learn.microsoft.com/en-us/connectors/sharepoint/).

Prefer minimizing returned payloads, indexed server-side filters and supported paging before introducing a cache. Any cache must be scoped to account, endpoint and record version, purged on sign-out, and prevented from driving authorization or showing withdrawn content. The existing in-flight coalescing should remain separate from mutation handling.

## Delivery work packages

| Priority | Work package | Completion evidence |
| --- | --- | --- |
| P0 | Recover status by original request ID | Timeout, reload and account-switch tests cause no duplicate mutation |
| P0 | Capture timing and actual licence profile | Repeatable measurements explain dispatch, processing and delivery delay |
| P1 | Reduce workspace read commands and payload | One authorized read contract with current visibility rules |
| P1 | Restructure costly preflight and background paths | Measured reduction with all invalid cases still rejected |
| P1 | Authenticated immediate-trigger proof of concept | Tenant authentication, consent, CORS and licence checks pass |
| P2 | Isolate read traffic from mutation processing | Ordinary-user read and privacy tests meet proposed targets |
| P2 | Controlled concurrency and load acceptance | Same-record conflicts are safe and unrelated work does not starve |

Assign an IT implementation owner and a tenant administrator before scheduling these packages. John coordinates the business pilot; Sam, Rosie and Joy provide actual-account acceptance. No licence purchase, new broad permission grant or endpoint activation is authorized merely by publishing this plan.

## Benchmark and correctness matrix

Test cold sign-in and warm access separately, then one, five and ten concurrent staff sessions or a smaller approved pilot capacity. Record the chosen capacity before testing. Include empty queue, existing backlog, throttled connector, unavailable roster source, stale configuration, expired delegation and interrupted browser scenarios.

For writes, include simultaneous saves to the same revision, submit after save, repeated wake for the same request, a second command with a reused key, author self-review, removed appointment, mismatched caller and creator, and replay after an unknown result. Exactly one valid transition may commit for a contested revision; rejected or uncertain outcomes must preserve evidence.

For reads, test another person's queue and request parts, unpublished drafts, changed reviewer assignments, restricted source files, published audience restrictions, old download links after withdrawal, and logout followed by another user. Use ordinary staff accounts to prove denial. John and Automation cannot provide that proof alone.

Fault injection must include loss of the create response, mutation commit followed by response failure, flow interruption after a ledger reservation, and email delivery ambiguity if email is later enabled. Keep email disabled in the current benchmark. Do not automatically reset Sending or Uncertain states to manufacture successful timings.

A candidate passes only when the performance targets and correctness tests both pass, with no new TypeScript baseline errors, relevant frontend regressions, native-definition failures or permission regressions. Review request consumption and connector behavior for sustained operation, not only a short demo. Microsoft counts built-in and connector actions toward applicable request limits, so splitting work without reducing its volume is not automatically a capacity improvement. [Microsoft request limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config).

## Deployment and rollback approach

Build a new reviewed candidate alongside the current pilot definition, keep activation explicit and export the current known-good flow. Use the same private stores only after checking request and version contracts. Do not alter the submitted pilot record to test a new save path.

Run a read-only smoke test first, then a separate test draft, then the actual-account decision sequence. Record the original request references and outcomes before changing the active dispatcher. Keep the old dispatcher paused or in a proven recovery-only role while the candidate owns new interactive commands.

If authorization, privacy, duplicate handling or outcome consistency regresses, pause the candidate, reconcile in-flight work and restore the verified previous worker. Preserve the ledger and audit. If correctness passes but latency does not, record the target as unmet and choose the next measured architectural change. A successful import or green build is not performance acceptance.

## Immediate next action

Begin with request-level timing and original-request recovery. Those changes give a reliable way to distinguish a slow action from a completed action whose browser timed out. In parallel, confirm whether the authenticated immediate Power Automate approach is supported and licensed in this environment. Choose the interactive architecture only after that proof, and keep the existing submitted newsletter with Sam for normal business review.

## Related records

- [Implementation record](implementation-record-2026-10-22.md)
- [Operational handover](operational-handover-2026-10-22.md)
- [Live pilot acceptance](pilot-acceptance.md)
- [Native backend source](../../scripts/newsletters/power_automate.py)
