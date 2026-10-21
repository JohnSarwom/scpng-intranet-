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
