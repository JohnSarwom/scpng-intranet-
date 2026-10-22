# Newsletter implementation record

Prepared on 22 October 2026 for John Sarwom, intranet administrators and the incoming maintainer. This record describes the implementation and observed pilot results. It is a snapshot of the work recorded in this session, not a claim that every related staff, security or production issue has been closed. UI event times below are Port Moresby time where the source displayed that timezone.

## Current position

The newsletter feature has been built into the existing intranet, with SharePoint holding the data and native Power Automate handling trusted workflow decisions. A Corporate Services pilot newsletter has been created, saved and submitted successfully. Its last verified state is **Pending Divisional Approval**, revision **4**. The next business step is Sam Taki's review using his own account.

The backend update that runs independent reads in parallel was imported into the existing Processor and verified with a live read-only test. The test flow succeeded in **1 minute 26 seconds**; the workspace was observed loaded within **101 seconds** of a fresh reload. These are different measurements. They do not establish a material speed improvement or measure a changed-content save. Performance acceptance remains open.

The application release is in open **draft PR 13**, on `codex/newsletter-pilot`, targeting `main`. No merge or production application rollout is established by this record. A working local site, a live backend flow and a Vercel preview are separate deployment states.

## Agreed scope and decisions

The user asked for a newsletter process that staff outside Research and Publication could use, while retaining divisional approval and central editorial and publication control. The user also required appointment management in the intranet because the people holding those responsibilities can change.

The agreed implementation uses the existing intranet as the staff interface and the existing SharePoint intranet site as the backend location. A separate staff-facing website was not required. The newsletter-specific Supabase backend approach was removed. This statement concerns the newsletter feature; it does not mean that every unrelated legacy Supabase reference in the wider repository was removed.

General intranet access, staff employment information and newsletter appointments are distinct. An intranet administrator can delegate management of newsletter appointments through the existing Users and Roles and Groups screens. John was not hardcoded as an administrator or automatically delegated appointment management.

The pilot appointments were explicitly approved for Corporate Services only. Other divisions must receive their own approved coverage before their submissions can pass the relevant stages. Monica Abau-Sapulai's organizational placement remains unresolved at the user's instruction.

## Business workflow

| Stage | Pilot responsibility | Last verified position |
| --- | --- | --- |
| Create and submit | John Sarwom as author | Completed for the recorded pilot |
| Divisional approval | Sam Taki | Awaiting actual-account review |
| Editorial review | Rosie Stevenou | Not yet exercised in this pilot |
| Final publication approval | Joy Komba | Not yet exercised in this pilot |
| Publish | Rosie Stevenou | Not yet exercised in this pilot |
| Staff reading and privacy checks | Ordinary staff account | Not yet accepted end to end |

All four appointments are scoped to Corporate Services Division, with no recorded start or end date. They remain effective until changed. The configured review deadline is two working days. The recorded pilot UI showed review due on 26 October 2026; that is a recorded display result, not independent verification of a public-holiday calendar.

## Implementation sequence

### Staff identity and organizational records

The user corrected three organizational assignments: Sophia Marai is the divisional secretary in Research and Publication; Leeroy Wambillie is the Senior Licensing Officer in Licensing and Supervision; Ninipe Gurumo is the Research Manager in Research and Publication. The application's canonical label for Leeroy's division is Licensing, Market and Supervision Division, displayed with an ampersand in the implementation.

The working checkout contains these approved placement mappings and corrected organizational documentation. The historical cleanup message confirmed that two cached role entries were cleared and browser staff data refreshed. It explicitly said no staff, role or permission records were deleted. Duplicate and unmatched role review was requested, but this pack does not establish that every such finding was resolved. The referenced download `staff-correction-cleanup-review.json` was not available at its stated path during preparation of this pack.

The documented staff source is Microsoft 365 and Entra, synchronized into `SCPNG Staff Directory` and `Employee_Profiles` by the existing five-day flow. The app combines the lists by Entra identity. Live schema investigation found that the directory's internal Division and Email names are `field_3` and `field_5`; the native newsletter mapping was corrected to read those fields. A preflight guard rejects an empty eligible roster instead of proceeding with unverified identities.

Shared division aliases were introduced for routing. Finance Unit maps to Corporate Services; Supervision Unit maps to Licensing, Market and Supervision; Legal Advisory Unit and Division map to Legal Services. These mappings do not rewrite employment records or resolve Monica's placement.

### Intranet screens and appointment control

The implementation added published newsletter reading, a newsletter workspace, editing, review and publication views, and an administrative routing screen. The current sidebar entry is **News**. Users open News, then Newsletter Workspace, then Create Newsletter. A separate Newsletter appointments entry is restricted to authorized appointment managers.

The authorization model follows `UserRoles` and `PermissionGroups`. An `admin`, `super_admin`, or an account with the existing `IsAdmin` flag qualifies for routing management. A delegated group can grant `newsletter_routing:manage` without granting general user administration. A job title, publisher appointment or manager role does not itself confer this permission.

The user first considered an Automation and John allowlist, then clarified that control must come from the intranet's existing administration. The final design follows that clarification. The Newsletter Administrators group definition was prepared; John remained a manager and was not directly appointed as its delegate in the recorded work.

### SharePoint and native workflow setup

The setup created request lists, protected workflow lists and restricted libraries on the existing SharePoint intranet site. Setup recovery addressed a partially created, empty request list under explicit identity and privacy checks. It did not justify recreating existing populated stores.

The request lists use creator-only read and write settings. SharePoint did not permit unique-value enforcement on their Title columns with those settings, so request Titles are indexed and duplicate protection is supplied by the uniquely keyed private request ledger. Private workflow records retain their own unique keys and version checks.

Native definition generation was corrected to use the nonempty expression `@concat('','')` for empty variable resets because the cloud designer dropped a bare empty-string expression. Imports use generated, tested packages; the designer's handling of the multi-variable initialization action was not reliable evidence that a previously running definition had become invalid.

Runtime configuration was set for the existing site, with processing enabled and both staff email and scheduled publishing disabled for the pilot. The standard connections run under Automation. Browser requests do not contain an external function API key or a shared secret for a newsletter backend.

### Appointments and access were applied separately

After explicit approval, the four Corporate Services appointments were saved through the real admin process. Queue item 290, a `routing_admin_save` command, was processed in a controlled run. Independent inspection of `Newsletter_Routing/settings` and the routing snapshot confirmed the saved scope and audit reference.

Appointment configuration version: `08e49a12-3370-4240-90d8-6108e663b1a6`. Snapshot file: `newsletter-routing-08e49a12-3370-4240-90d8-6108e663b1a6.json`.

The reviewers initially had no effective access to the two request lists. After a separate explicit permission approval, Sam, Rosie and Joy were granted Contribute on `Newsletter_Requests` and `Newsletter_RequestParts` only. The saved assignments were checked after reloading SharePoint. Creator-only read and write settings and disabled list attachments were checked again. Invitation emails were unchecked and were not sent by these grants.

John has elevated SharePoint capabilities. His successful access cannot demonstrate that an ordinary staff member is denied another person's requests or private files. The actual-account privacy tests remain mandatory.

### Local verification and release preparation

A clean managed worktree was created for the newsletter release, rather than staging the many unrelated changes in the original working folder. The release retained the existing News article upload behavior and merged Front Desk work. It was pushed as draft PR 13 and attached to this chat.

The local pilot used port 8093. Port 8080 belongs to another checkout and must not be repurposed as part of this handover. Earlier sample previews were not evidence of the real backend. Sign-in was adjusted to redirect logout and explicit account selection; John and Automation then completed their own browser sign-ins.

The changed frontend path was checked with 53 focused tests across draft orchestration, hook state, service coalescing, transport behavior and workflow rules. The latest backend changes passed 36 native-definition tests. The TypeScript comparison retained 163 unique existing diagnostics against a 172-diagnostic baseline, with no new diagnostics in the compared release. This is not a clean, zero-error typecheck. Earlier release build and preview checks passed; those results do not constitute production acceptance.

### Loading incidents and frontend corrections

One prolonged loading incident occurred because the Processor had been left Off after controlled tests. Requests accumulated while the page continued waiting. The flow was restarted after queued commands were reviewed, and the backlog drained. Directing the user to the workspace before restarting the flow was an operational mistake.

The workspace originally discarded a confirmed create or save result and queued another complete workspace load. It was changed to apply the returned authoritative record to the current account's in-memory view. New drafts therefore open from the confirmed result, and successful saves or decisions do not automatically request the entire workspace again. Account and semantic-key guards prevent a late response being inserted into a different signed-in view. Workflow content is not persisted in the generic browser query cache.

Submission initially saved the draft before discovering missing mandatory fields or an unchecked sensitive-information declaration. It now validates those requirements before sending either request. An unchanged draft skips a redundant save, and the UI distinguishes Saving your draft from Submitting your newsletter for approval. In-browser checks demonstrated immediate feedback for an unchanged save and an unchecked declaration.

These corrections remove avoidable requests and misleading feedback. They do not remove the latency of a genuine changed-content save or approval request in the scheduled backend.

### Submission succeeded after a browser timeout

The pilot was created as `3297d1d9-28c8-4d30-8ff6-223751ffe1b3`. Revision 2 held the initial content. Revision 3 saved the sensitive-information declaration. The approval request `38fb80af-42e8-47f1-aebf-2515576691c3` timed out in the browser while the backend continued working.

Direct inspection of that original SharePoint request showed `Succeeded`. Its response recorded revision 4, `division_review`, and a final `submit` event. The refreshed intranet showed Pending Divisional Approval. The submit event was displayed at 10:30:31 on 22 October 2026. No second submission was needed to obtain that result.

### Backend optimization was installed and tested

The Processor was already at its tested limits of 500 actions and eight nesting levels. The update rearranged independent GETs without adding actions or nesting. Seventeen preflight reads now run after the deployment prerequisite and join before policy validation. The per-request ledger, configuration and routing reads run together after the trusted request has been read from SharePoint. Shared state updates, permission validation and authoritative writes remain ordered.

The tested package was uploaded manually because the browser automation session could not control the embedded upload picker. The import explicitly selected Update for existing Processor `4c0110ba-7f15-4c8c-b1db-4f9a76da77ed`. The queue was empty, the flow was paused, its active run completed, and the current Automation connections were selected. Power Automate reported that all package resources were imported successfully. The flow was then restarted and last verified On.

The first recorded post-update read-only acceptance run was `08584089770769842372699384454CU22`, shown at 10:43 on 22 October. It succeeded in 1 minute 26 seconds. The workspace was observed loaded within 101 seconds and still showed the correct submitted record. The queue was empty after the test.

This single test does not establish a material speed improvement. It is not comparable with an isolated save or submission test, and no write-latency benefit should be inferred from it. The performance plan in this pack explains the next work.

## Evidence and limits

| Evidence | What it supports | What it does not establish |
| --- | --- | --- |
| Original submit request and response | Submission succeeded once and reached revision 4 | Reviewers have approved it |
| Refreshed intranet view | Pending Divisional Approval is visible | Production site has the same app version |
| Import success screen and existing flow link | Update targeted the existing Processor | Instant save performance |
| Successful 86 second read-only run | New flow executed successfully | Mutation latency or concurrent-user capacity |
| Permission pages and own-item settings | Approved grants and settings were saved | Ordinary-account privacy by itself |
| Native and frontend regression results | Specified local rules and state behavior passed | Full tenant end-to-end acceptance |

Evidence images are retained under the local `tmp/newsletter-power-automate` folder, including `john-newsletter-submitted-revision4.png`, `parallel-reads-import-succeeded.png`, `parallel-reads-first-live-run-succeeded.png`, `parallel-reads-live-workspace-verified.png`, `pilot-requests-access-saved.png` and `pilot-parts-access-saved.png`. These are local evidence artifacts, not a durable organization-wide archive. Move approved evidence to a controlled records location before relying on long-term retention.

## Outstanding work

Sam's actual-account review, Rosie's editorial action, Joy's final approval and Rosie's publication remain pending. Ordinary staff privacy, stale-version rejection, negative authorization cases, attachments, withdrawal and multi-user capacity still need tenant acceptance. Staff email and scheduled publishing remain disabled until separately tested and approved.

Performance remains unresolved at an acceptable interactive level. Licensing and actual connector throttling have not been fully diagnosed. The source definition requests a one-minute cadence; that is not a guaranteed maximum wait under backlog, concurrency limits, throttling or tenant licensing.

There is also documentation and branch drift. The original working checkout has corrected `Divisions_Units.md` and a staff-placement correction runbook. The release worktree inspected for this pack still contained the old personnel text and lacked that linked runbook. Do not infer that all staff-correction code or documentation has been included in PR 13 or deployed to production. The current synchronized roster and approved corrections require a separate parity review.

## Related records

- [Operational handover](operational-handover-2026-10-22.md)
- [Performance optimization plan](performance-optimization-plan-2026-10-22.md)
- [Pilot acceptance record](pilot-acceptance.md)
- [Newsletter implementation overview](README.md)
- [Draft PR 13](https://github.com/JohnSarwom/scpng-intranet-/pull/13)
