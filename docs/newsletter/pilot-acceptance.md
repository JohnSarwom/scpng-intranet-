# Corporate Services newsletter pilot acceptance

Status: appointments are saved; full staff-account acceptance is not yet complete.

## Approved routing

| Responsibility | Officer | Scope |
| --- | --- | --- |
| Divisional approval | Sam Taki | Corporate Services Division |
| Editorial review | Rosie Stevenou | Corporate Services Division |
| Final approval | Joy Komba | Corporate Services Division |
| Publication | Rosie Stevenou | Corporate Services Division |

The review deadline is two working days. Appointments remain effective until changed. Monica's placement remains unresolved. These appointments do not grant SharePoint queue access or intranet administration.

## Before the pilot

- Use the current newsletter checkout or reviewed release, with the three public SharePoint identifiers configured. The older sample preview is not evidence of backend behavior.
- Keep email and scheduling disabled. Confirm the complete queued-command inventory before a controlled Processor run. Preserve request keys and do not resubmit an uncertain mutation.
- Check effective permissions on Newsletter_Requests and Newsletter_RequestParts. Only approved pilot staff need Contribute; preserve creator-only reads/writes, unique permissions and disabled attachments. Permission grants require separate approval.
- Use the actual staff accounts. Automation is an operator, excluded from the synchronized staff roster. John's elevated SharePoint capabilities cannot establish ordinary-staff privacy.

## Account-based acceptance sequence

1. John (author): sign in, verify workspace/session identity, create a clearly marked pilot draft, save its content, and submit it. Record the request key, submission ID and revision.
2. Sam: confirm the Corporate Services divisional task is visible and approve the reviewed revision. A separate Sam-authored submission must reject Sam's own approval.
3. Rosie: open the editorial task and approve it. Content changes or a return must require the appropriate new review.
4. Joy: confirm final approval is separate from editorial review and approve the exact reviewed content version.
5. Rosie: publish the approved version. Verify the live reader shows the approved content and that no email was sent while email remains disabled.
6. An ordinary staff account: verify published content is readable; another author's unrelated draft, another user's request/result/parts, private routing/submission/notification/attachment/ledger lists and private source/snapshot files must remain inaccessible.
7. Confirm stale revisions, expired/overlapping appointments and unappointed users cannot approve or publish. Reassignment must require its explicit action and reason.
8. Withdraw the pilot publication using a recorded reason and verify new canonical reads/downloads no longer expose its body. Preserve the audit and snapshots; do not clear the ledger or purge history.

Each decision must be made by its actual appointed account. Do not impersonate reviewers or temporarily grant the operator their identities to make a test pass. If someone is unavailable, record that test as pending.

## Release gate

Offline checks cover workflow/routing policy, transport replay handling, shared division labels, request coalescing, navigation, native definitions, staff-roster regressions, the existing strategy suite, the TypeScript baseline and production build. They do not replace the account-based tests above or a realistic concurrency check. Keep the repository release as a draft until the staff pilot and privacy results are recorded. A preview/build is not a live deployment or a go-live approval.

## Observed pilot results — 22 October 2026

- John's submission `3297d1d9-28c8-4d30-8ff6-223751ffe1b3` reached `division_review`, revision 4. Request `38fb80af-42e8-47f1-aebf-2515576691c3` succeeded even though the browser timed out. The refreshed workspace shows Pending Divisional Approval. Do not replay that submission.
- The parallel-read update was imported as Update into existing Processor `4c0110ba-7f15-4c8c-b1db-4f9a76da77ed`, using Automation's existing connections. It remained Off during import and was re-enabled after checking the empty request queue. No approval assignments, permissions or notification settings changed in this deployment.
- Post-update read-only run `08584089770769842372699384454CU22` succeeded in 1 minute 26 seconds. John's signed-in workspace was observed loaded within 101 seconds after a fresh reload; this is an observed upper bound including scheduling and browser polling, not an isolated write-latency measurement. The queue was empty afterward and Processor remained On for the pilot.
- Performance acceptance remains open. This test does not establish a material speed improvement, instant saves, mutation latency, ordinary-staff privacy or multi-user capacity. The scheduled queue still adds waiting time. Keep trigger/request writes serialized while investigating the remaining delay; do not disable concurrency protection merely to clear the service's throttling suggestion.
- Sam, Rosie and Joy's actual-account approval/publication sequence and the ordinary-staff privacy checks remain pending.
