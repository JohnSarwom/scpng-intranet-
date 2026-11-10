# Notice board and staff synchronization handover

Recorded 16 October 2026, Pacific/Port_Moresby. This record covers the work completed in this conversation. Live observations below were last verified on 15 October; committing code does not deploy the intranet or revalidate tenant state.

## Delivery status

| Area | Verified outcome | Remaining work |
|---|---|---|
| Ordinary notices | Separate from news and imported mail; legitimate notice preserved and 17 technical alerts/digests recycled | Deploy updated board reader and popup |
| All Officers email | Exchange copy rule enabled; replacement importer On; To and CC imports passed; replay and unrelated-alert tests passed | Staff access intentionally withheld; app email flag remains off |
| All Staff email | Separate restricted list prepared | Address/alias remains unconfirmed; branch disabled |
| Staff cleanup | Five-day Power Automate job On, changes enabled; both target lists reconciled to 30 eligible staff | Monitor scheduled reports and maintain source profiles |
| News Article Extraction | Safer sequencing protects existing articles; one corrective run created 97 articles | Latest scheduled Google Sheets reads still fail HTTP 429 |
| Home-screen announcement popup | Implemented with themed summaries, full-detail action and per-account dismissal; locally verified | Application deployment and live smoke test |

## Decisions and implementation

### Notice feed

The original board showed Power Automate failure mail instead of intended announcements. The legacy **Add All Staff & Boardroom Emails to Notice Board** flow was switched off. General manual content stays in `Announcements`; articles stay in `NewsArticles`; email imports have their own audience lists with unique permissions and required unique Internet Message IDs.

The user selected **All Officers for the initial rollout**. The active group has 36 members and Automation was already a member/owner. A dedicated security reader group was created and verified against that roster with no missing or extra users. The user then selected **Leave access restricted to site owners**. No staff Read permission or invitation was granted. Reader membership is a manual administrator responsibility; the staff cleanup does not maintain it.

An Exchange rule copies original To/CC All Officers mail to Automation using BCC, except when Automation is already in To/CC. The replacement Inbox flow validates the original recipients, message ID and content, excludes known technical alerts, converts HTML to text and creates only absent items. Trigger concurrency is one and SharePoint uniqueness provides a final duplicate guard. BCC-only group mail does not qualify. No historical mailbox backfill was performed. Attachments stay in mailboxes.

Labelled live To and CC test messages each created one item in the restricted All Officers list. Replaying the first run skipped creation. An Automation-only alert skipped the import branches. The list contained exactly the two test notices, retained as owner-only evidence. Outlook search found the original To test in Automation's Inbox; attachment access and other recipients' search results were not verified by these tests.

### Staff cleanup

The user requested recurring removal of unlicensed or incomplete staff records. The final deployment uses native Power Automate, every five days, rather than a separate server job. Profile reads are combined with `/users/{id}/licenseDetails`; missing licence data from the standard profile action is not interpreted as proof of no licence.

Only `Employee_Profiles` and `SCPNG Staff Directory` are reconciled. Required source fields are full display name, SCPNG mail, department and office location, plus at least one assigned licence. Entra IDs were added for stable matching. Mapped fields update while custom/photo fields survive. Source/schema/identity guards and successful upserts precede version checks and recycling.

On 15 October at 10:53 PNG, the first apply processed 75 source profiles and 30 eligible staff: 44 updates, 16 additions and 10 recycled rows across the two lists. A reviewed bootstrap removal limit of 30 percent was used for that run; the saved normal limit returned to 25 percent. At 10:58 the follow-up confirmed 30 retained in each list, zero writes and zero removals. No individual removed staff roster is included in this repository.

The downloadable native package defaults to preview; the live flow was enabled separately. The builder requires a fresh authorized owner export for connection references. Node/Azure/Windows alternatives remain reference implementations only. No duplicate Azure or Windows schedule was deployed.

### News failure investigation

News Article Extraction was reviewed independently of the notice importer. Google Sheets preflight now occurs before SharePoint deletion; a redundant Sheets call was removed, creation's run-after dependency corrected, concurrency limited to one and bounded retries configured. A corrective 12 October run succeeded with 97 created articles.

Scheduled runs on 13–15 October nevertheless failed at **Get rows 2** for `/The National Articles`, worksheet `newsArticle`, with Google Sheets HTTP 429 after four retries. SharePoint reads and replacement loops were skipped, preserving stored news. The shared connection has twelve flow references, which does not establish which caller exhausts quota or prove concurrent traffic. This incident remains open; investigate actual shared connector usage before further scheduling or connection changes.

### Home-screen popup and reader changes

The popup offers unseen, nonexpired staff-wide manual announcements once after a fresh successful authenticated home-screen fetch. It excludes imported emails, restricted manual audiences, future/invalid dates, blank content and technical notifications. Missing manual audience means staff-wide under the existing general-list contract; this does not confer access to email lists.

The maroon themed modal supports light/dark and mobile layouts, shows a title/date and sanitized text preview, and opens the existing full notice dialog. Continue, close, Escape and outside dismissal acknowledge offered items locally; Read full notice acknowledges only that item. IDs are stored per MSAL account and browser, with memory fallback and no persisted notice bodies. Other devices or cleared storage can show notices again; there is no central read receipt.

The hook scopes queries by account and email feature flag, avoids persistent query caching, and waits for a fresh fetch before popup evaluation. Both announcement readers handle pagination. The email display service and Outlook sender/subject search action are present, but `VITE_ENABLE_EMAIL_NOTICES=false` continues to prevent application email display.

## Verification and limits

- Nine focused frontend tests passed: five popup eligibility/dismissal tests, one manual pagination test and three email-service tests.
- Targeted lint passed. A production build passed with existing font/chunk warnings; subsequent small layout/pagination refinements were checked with focused tests and local preview.
- Local preview checked full-detail navigation, reload suppression, account separation, restricted/expired exclusions, light/dark styling and a 390 by 640 viewport. Test notices were local fixtures; no tenant popup notices were created.
- All twelve offline tests for the historical Node synchronization implementation passed again during commit preparation. These do not replace verification of the native live flow.
- Member/nonmember direct SharePoint tests, staff email visibility, confirmed All Staff routing, recipient attachment search and consistent news-flow recovery remain unverified or intentionally deferred.

## Operational links and next steps

See [notice-board operations](../modules/notice-board-email-feed.md) for exact list, rule, reader group, flow and test-run IDs. See [staff synchronization operations](../modules/staff-list-sync.md) for mappings, schedule, run IDs, recovery and package building. Feature hubs: [notice board](../modules/notice-board/overview.md), [staff directory](../modules/staff-directory/overview.md).

1. Deploy the reviewed application through the project's usual release process and smoke-test ordinary announcement summaries and dismissal. A Git push alone is not confirmation of deployment.
2. Keep imported mail hidden and list permissions owner-only until the user explicitly changes that decision. Any later rollout needs approved reader access and member/nonmember tests, including direct list access.
3. Confirm the All Staff recipient before enabling its routing or import branch.
4. Investigate the shared Google Sheets throttle and verify successful scheduled news runs before closing that incident.
5. Monitor staff-sync reports; use restricted run-history snapshots and SharePoint recycling for recovery. Snapshots expire after 28 days and are not durable backups.

For rollback, disable the relevant new flow/routing rule and leave the email feature flag off. Do not re-enable the legacy importer, mass restore discarded technical alerts, or deploy a second staff reconciler without reviewing the resulting duplicate processing. No credentials, owner export ZIPs, staff snapshots or local configuration should be committed.
