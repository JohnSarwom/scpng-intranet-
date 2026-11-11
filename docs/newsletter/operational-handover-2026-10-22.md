# Newsletter operational handover

Prepared on 22 October 2026 for the incoming intranet maintainer and authorized intranet administrator. This handover provides the system inventory, current pilot position, operating procedures, recovery steps and acceptance work needed to continue safely. It records the last verified state; inspect the tenant again before making a live change.

## Start here

The pilot newsletter is already submitted. Do not recreate it or resubmit it to make the browser appear current. Open its workspace and verify the original request if there is doubt. Sam Taki is the next appointed reviewer. The backend Processor was last verified On following the parallel-read update. Performance is still an open issue, with a fresh workspace reload observed within 101 seconds.

The remaining immediate tasks are to complete actual-account pilot approval, diagnose latency using request timestamps, and reconcile deployment and documentation parity before production release. General staff roles and newsletter appointments must continue to be managed through the intranet's authorized administration.

## System inventory

| Component | Recorded location or identifier |
| --- | --- |
| Production application address | `https://www.scpngintranet.com` |
| Local pilot address | `http://localhost:8093` |
| Existing SharePoint site | `https://scpng1.sharepoint.com/sites/scpngintranet` |
| Power Automate environment | `Default-b173aac7-6781-4d49-a037-d874bd4a09ab` |
| Processor flow | `4c0110ba-7f15-4c8c-b1db-4f9a76da77ed` |
| Maintenance flow | `1422c41a-4704-49d6-9bb2-e1399c93cdd5` |
| Requests list | `6b90b8d1-2ae1-4f37-a74d-245629f68440` |
| Request parts list | `97d4dbd0-fb75-4678-8821-cc08544435ff` |
| Flow connection owner | Automation, `automation@scpng.gov.pg` |

The Graph site identifier consists of the host `scpng1.sharepoint.com`, site collection ID `1615181f-7ac2-458b-8584-8586881c3e4e`, and web ID `62ed622f-af08-4519-8ca9-bd27b464ca65`, joined with commas. These identifiers are configuration values, not authentication credentials.

The app uses `VITE_NEWSLETTER_REQUEST_SITE_ID`, `VITE_NEWSLETTER_REQUEST_LIST_ID` and `VITE_NEWSLETTER_REQUEST_PARTS_LIST_ID`. The release `.env.production` contains these three public identifiers. Do not add connector credentials, bearer tokens or signed callback secrets to Vite variables.

The main and private site settings both refer to the same existing site. The private boundary is enforced through list and library permissions; it does not require a second intranet site.

## Application navigation

| Route | Purpose |
| --- | --- |
| `/news` | Existing news page with links to newsletter reading and workspace |
| `/news/newsletters` | Published newsletter library |
| `/news/newsletters/:id` | Published newsletter reading and permitted downloads |
| `/news/newsletters/workspace` | The signed-in staff member's submissions and applicable work queues |
| `/news/newsletters/workspace/:submissionId` | Create, edit, review or inspect a particular newsletter |
| `/admin?tab=newsletter-routing` | Appointments for authorized routing administrators |

Normal staff use the News sidebar item. Newsletter appointments is a management link with a separate permission check. Do not grant administration merely to make the Create Newsletter button available.

## Pilot record and people

Submission ID: `3297d1d9-28c8-4d30-8ff6-223751ffe1b3`. Author: John Sarwom. Division: Corporate Services Division. Last verified revision: 4. Status: `division_review`, displayed as Pending Divisional Approval. The approved scope has Sam Taki as divisional approver, Rosie Stevenou as editor and publisher, and Joy Komba as final publication approver.

Original successful submission request: `38fb80af-42e8-47f1-aebf-2515576691c3`. Its request-list item was 326. The recorded response assigned the work to Entra object ID `c7150f91-439b-4940-9908-8bb7d8d39870`; confirm the current roster match when Sam signs in rather than treating a stored name as sufficient identity proof.

Appointment audit version: `08e49a12-3370-4240-90d8-6108e663b1a6`. Appointments have Corporate Services scope, no recorded start or end date, and a two-working-day deadline. They remain effective until an authorized administrator changes them.

Automation is the workflow operator, excluded from the eligible staff roster. It is not a substitute for a staff reviewer. John remained an intranet manager, without a recorded direct delegation to manage appointments. His elevated SharePoint rights also make him unsuitable as the only privacy-test account.

## Data stores and access boundaries

### Staff request lists

`Newsletter_Requests` contains action names, request keys, JSON inputs, processing status and returned results. `Newsletter_RequestParts` contains large input segments. Both lists have unique permissions, `ReadSecurity=2`, `WriteSecurity=2` and disabled list attachments. Sam, Rosie and Joy were approved and granted Contribute on these two lists. No grant to all staff is established by this record.

Contribute must not be replaced by Edit or Manage Lists for ordinary staff. A user who can manage the list can bypass ordinary creator-only restrictions. The indexed Title is not unique on these lists. The protected ledger provides the reservation control.

### Protected authoritative stores

| Store | Responsibility |
| --- | --- |
| `Newsletter_Configuration` | Activation, email, scheduling and fixed runtime settings |
| `Newsletter_Routing` | Reviewer and publisher appointments with audit references |
| `Newsletter_Submissions` | Private content, revisions, assignments and decision history |
| `Newsletter_Publications` | Published projections served through authorized requests |
| `Newsletter_Notifications` | Recipient-specific notices and reminder state |
| `Newsletter_Attachments` | Trusted attachment metadata and ownership |
| `Newsletter_RequestLedger` | Unique request reservation and recorded outcomes |
| `NewsletterFiles` | Private attachments, immutable version and routing snapshots |
| `NewsletterDownloads` | Restricted delivery files with requester-specific Read grants |

A check for unique inheritance is not a complete permission audit. Review actual group memberships, direct grants, inherited site administrator powers, sharing links and file access. Do not solve a latency problem by granting broad staff access to these stores.

### Three different kinds of role data

Employment names, titles and organizational placement come from the synchronized staff lists and approved correction mappings. General intranet roles and permissions live in `UserRoles` and `PermissionGroups`. Newsletter responsibilities live separately in `Newsletter_Routing`.

Use Admin Users and Roles and Groups to delegate `newsletter_routing:manage`. The admin screen can then appoint current eligible staff to newsletter duties. Delegation must not grant edit access to the permission stores themselves. Role and group records are reread for routing-management requests, with ambiguous or incomplete matches rejected.

The staff synchronization runs every five days. A source-directory change is not proven to be immediately reflected in newsletter eligibility. Treat the freshness of employment revocation as a security question to verify, not an already-tested property of the interface.

## Repository handover

Original working directory: `C:/Users/IT_UNIT/Desktop/Coding/scpng-intranet`. It contains many unrelated changes and untracked files. Do not stage the entire directory or reset it to make a newsletter release clean.

Release worktree: `C:/Users/IT_UNIT/.codex/worktrees/newsletter-pilot/scpng-intranet`. Branch: `codex/newsletter-pilot`. Remote repository: `https://github.com/JohnSarwom/scpng-intranet-`. Release review: open draft PR 13 targeting main. The release worktree uses a dependency junction to the original node_modules; preserve the target while it is in use. Do not archive the worktree before the handover is accepted.

Relevant implementation commits preceding this documentation pack are `3560b57` for the initial pilot, `238d33a` for applying confirmed records without redundant reads, `43ce010` for submission validation and unchanged-save handling, `d3cb5de` for parallel backend reads and `2d3be91` for live performance evidence. Documentation commits after these may change the branch head.

| Source area | Maintainer purpose |
| --- | --- |
| `src/pages/NewsletterWorkspace.tsx` | Editor, decisions, queue views and progress messages |
| `src/pages/NewsletterReader.tsx` | Reading interface |
| `src/hooks/useNewsletterData.ts` | Account-scoped in-memory view and confirmed-result updates |
| `src/services/newsletterService.ts` | Action methods and coalescing of identical in-flight reads |
| `src/services/newsletterSharePointTransport.ts` | Queue creation, large inputs, result polling and uncertain outcomes |
| `src/lib/newsletters/newsletterDraftActions.ts` | Validation, avoiding unchanged saves and save-then-submit sequencing |
| `src/lib/newsletters/newsletterWorkflow.ts` | Pure validation and policy regression reference, not a hosted API |
| `src/config/newsletterDivisionAliases.json` | Shared canonical routing labels |
| `scripts/newsletters/power_automate.py` | Native Setup, Processor and Maintenance definitions and import packages |
| `scripts/newsletters/test_power_automate.py` | Native expression, dependency, policy and limit checks |

Port 8080 is associated with a separate Front Desk checkout. Do not stop that server or replace its files as part of newsletter work. The local pilot is on 8093. A local server that is not listening should be restarted from the correct working directory; confirm the port owner before stopping any existing process.

## Operating procedures

### Opening an ordinary staff workspace

1. Confirm the current app build and the three queue identifiers. For the local pilot use port 8093; do not treat the production hostname as proof that the draft release has been deployed.
2. Sign in as the intended person and check the displayed account. Use account selection when several Microsoft accounts are signed in. Users complete their own password, PIN and MFA steps.
3. Open News, Newsletter Workspace, then the existing submission. Do not click Create again to recover an already-created draft.
4. If the view waits, inspect Processor status and the original queued request before refreshing repeatedly. A new full load can create additional read commands.

### Changing appointments

1. Sign in as an existing intranet administrator or an explicitly delegated appointment manager.
2. Confirm staff identity and organizational scope from the current trusted roster. Keep Monica unresolved unless the organization approves a placement.
3. Set the responsibility, explicit divisional scope where required, and any cover dates. Avoid overlapping reviewer appointments and preserve editor and final-approval independence.
4. Enter a reason and save once. Check the request outcome and audit snapshot before trying again after an error or timeout.
5. Test removal or expiry with the actual affected account. A routing appointment is not a SharePoint permission grant; review queue access separately.

### Handling a slow or timed out action

1. Preserve the request key shown in the error and the submission ID. Stop repeat clicks. Do not assume the action failed.
2. In the creator-readable request list, locate that exact Title or item ID. Check Status, ErrorMessage and ResponseText. Use a trusted operator for any private ledger or authoritative-record inspection.
3. If Succeeded, reconcile the returned record revision and audit event with the workspace. Refresh the read view rather than sending the original mutation again.
4. If Queued, check whether Processor is On, whether its current run is still draining older commands, and whether connections, licensing or trigger throttling are delaying it.
5. If Processing, Failed or Uncertain, inspect the matching run and ledger. A failed flow or a browser timeout can follow a partial write. Reconcile version files, history, notifications and the record before authorizing a new command.
6. If a request never reached the queue, preserve its key and inspect the uncertain-create lookup. Do not generate a replacement key blindly.

The frontend nominally polls every two seconds for up to three minutes after queue creation. Authentication, individual network calls and browser scheduling can add time; the current transport does not establish an end-to-end hard deadline across all those phases.

### Importing a generated update

1. Generate from reviewed source and settings. Keep a known-good export and record the exact current flow ID, connections, activation setting and runtime configuration. A local ZIP filename is not proof it matches the live version.
2. Run the native tests. Count actions and nesting after generation. The current Processor is at 500 actions and eight levels, so extra nodes can exceed the supported shape.
3. Review the complete queued-command inventory and existing active run. Pause the flow without cancelling a mutation in progress. Wait for active work to finish before replacing its definition.
4. Upload the package and select Update to the exact existing Processor. Select current authorized Automation connections. Do not create an accidental second active Processor.
5. Verify import success, the same flow ID, modified time and Off state. Review Apply_changes. Normal generator output is false; the explicitly labelled controlled pilot ZIP used on 22 October retained true to match the existing pilot activation.
6. Recheck queued actions before enabling. Keep email and scheduling disabled during the controlled pilot. Start the Processor, verify On, and test a harmless fresh read.
7. Confirm both the original request's outcome and the run's final state. Record timings, remaining queue depth and actual user-visible behavior. Preserve evidence and document rollback readiness.

The embedded Power Automate upload picker required manual user selection in this session. Once the user selected the package, the import options and connection mapping could be completed. Do not repeatedly attempt unsupported file-picker workarounds or upload a different package without review.

### Rolling back a faulty update

Pause new processing, preserve every queued, Processing and Uncertain command, and let any safe active operation finish. Inspect partial writes before changing the definition. Restore a verified previous export or supported known-good flow version to the same flow, review activation and connections, then test a read before reopening the pilot. Do not erase request or ledger history, restore old content indiscriminately, or rewind a successful human approval to make the UI match.

If email is ever enabled, reconcile Sending or uncertain deliveries against the sender's Sent Items before resetting any claim. The current pilot does not authorize enabling email as part of a rollback or performance fix.

## Validation handover

The latest focused frontend verification recorded 53 passing tests across five files. Native verification recorded 36 passing tests. Native checks cover resolved references, expressions, action limits, permission and mutation gates, request reservation, ETags and parallel-read joins. They do not establish a complete tenant security review. Existing TypeScript errors remain: 163 unique diagnostics compared with 172 in the accepted baseline, with no new diagnostics in that comparison.

For the current source, run the native suite using `python -m unittest discover -s scripts/newsletters -p test_power_automate.py`. Run the relevant Vitest files for draft actions, workflow, hooks, service and transport, then the repository TypeScript baseline check and a production build when application code changes warrant it. Use the clean release worktree for release checks. Follow the project AGENTS instruction to rebuild Graphify after code edits; the wiki index can be older than the generated report, so confirm the current report before relying on community navigation.

Do not add together historical test totals as if every test was rerun in one final invocation. Do not describe a baseline-aware comparison as a zero-error compiler result.

## Pending acceptance and ownership

| Work | Required participant | Acceptance evidence |
| --- | --- | --- |
| Divisional review | Sam using his own account | Assignment visible and recorded decision on the current revision |
| Editorial review | Rosie using her own account | Editorial outcome and content/version history |
| Final approval | Joy using her own account | Independent decision on the reviewed version |
| Publication | Rosie using her own account | Authorized publication and staff reading result |
| Privacy tests | Ordinary staff plus an operator | Other-user queue, draft and file access denied by the backend |
| Performance work | IT maintainer to be assigned | Measured distribution for views, saves and decisions |
| Licensing and connections | Authorized tenant administrator | Confirmed owner plan, connector health and request allocations |
| Production release | Authorized release owner | Reviewed PR, deployment verification and accepted pilot results |

Self-review, role expiry and removal, stale revisions, parallel edits, attachments, withdrawal, double clicks and uncertain outcomes still need actual-tenant tests. Do not impersonate reviewers or grant Automation their staff identities to obtain a passing result.

## Known gaps for the next maintainer

Performance is not accepted. The last live read-only run took 86 seconds and the workspace was observed loaded within 101 seconds; mutation latency and realistic concurrency remain unmeasured after the update. The service's trigger-concurrency warning is not authorization to remove serialization.

Staff documentation has branch drift. The original folder has corrected organizational text and `docs/newsletter/staff-placement-corrections.md`; the release worktree inspected for this handover still has the older personnel text and lacks that linked file. Review the full staff-correction change separately before claiming it is released. Preserve the user-approved Sophia, Leeroy and Ninipe assignments in that reconciliation.

The duplicate and unmatched role review has no demonstrated closure in the evidence available for this pack. Newsletter delegation to John is not established. Other divisions' appointments are not complete. Maintenance was last recorded Off and has not been re-accepted in this live performance test. Published audience restrictions, retention, source paging beyond 5000 rows, malware controls and department-revocation freshness also remain acceptance items.

## Related records

- [Implementation record](implementation-record-2026-10-22.md)
- [Performance optimization plan](performance-optimization-plan-2026-10-22.md)
- [Pilot acceptance sequence](pilot-acceptance.md)
- [Routing administration](routing-administration.md)
- [Draft PR 13](https://github.com/JohnSarwom/scpng-intranet-/pull/13)
