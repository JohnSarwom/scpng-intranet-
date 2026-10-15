# Staff list refresh every five days

## Status

The recurring job is live and **On** in **Power Automate** as **SCPNG Staff Lists - Five Day Sync**, flow ID `c94209f3-84ce-44d3-a3c3-ba73bb638fed`, owned by Automation in the default SCPNG environment. Recurrence is Day, interval 5, starting `2026-10-12T22:00:00Z` (13 October 08:00 Port Moresby). It reuses existing Office 365 Users and SharePoint connections. Apply_changes is Boolean true; the recurring removal limit is 25 percent per list.

The live flow reads directory users (Top 1000, no required search term), profiles and the dedicated `/users/{id}/licenseDetails` endpoint, then both staff lists with pagination threshold 5000. The standard Get user profile action omitted licence data, so it is not used to infer licence status. Each profile is combined with a licence count and eligibility flag. `result('Apply_to_each')` groups results by action: the profile filter must flatten `first(body('Filter_array'))?['outputs']` before checking `item()?['outputs']?['Eligible']`.

The first full apply run on **15 October 2026 at 10:53 PNG** succeeded in **3 minutes 18 seconds** (run `08584095812602522640972937806CU28`). The reviewed plan covered 75 directory users and 30 eligible staff: Employee_Profiles had 27 updates, 3 additions and 4 recycled rows; SCPNG Staff Directory had 17 updates, 13 additions and 6 recycled rows. Both lists therefore reconcile to 30 staff. The recovery snapshot, schema additions, upserts, removal version checks and recycling actions all succeeded. The first cleanup used a reviewed 30-percent limit because the Directory cleanup was 6 of 23 rows; the saved recurring limit was immediately restored to 25 percent.

The owner export was supplied and the completed native package imported successfully. The downloadable package defaults to preview for safe re-import; the live flow has separately been enabled for changes. The Node/Azure sections below are historical reference implementations, not additional deployed jobs or activation requirements. The notice importer is separately active for owner-only backend testing; application email display remains disabled. See [notice-board operations](notice-board-email-feed.md).

A follow-up run on 15 October at 10:58 PNG also **Succeeded** in 5 minutes 2 seconds (run `08584095809485183733434726661CU16`). Its full report confirmed ApplyChanges=true, EligibleStaff=30, Profiles:Keep=30, Directory:Keep=30, WriteCount=0, RemovalCount=0 and RemovalLimitPercent=25. This verifies repeat-run stability and 30 qualifying staff entries in each list. The flow remained On. A transient "Failed to fetch" error in the run viewer cleared after refreshing; the full report was then copied through the viewer and checked.

## Behaviour

The source is Microsoft 365 / Entra user profiles, not the existing SharePoint rows. Each eligible internal member must have:

- At least one assigned licence (any SKU; this does not require a particular product or enabled Exchange service plan).
- A nonblank display name representing the full name.
- A valid `mail` address in `scpng.gov.pg`; a sign-in name alone does not substitute for missing mail.
- A nonblank department and office location. In this intranet, office location represents the division.

Blank and placeholder values such as `N/A` do not qualify. Guest accounts, other email domains, and the configured automation/group addresses are excluded. The script never changes user accounts, licences, groups, HR records, or notice lists.

It reconciles only `Employee_Profiles` and `SCPNG Staff Directory`: keep qualifying entries, update changed metadata, add qualifying users, and remove unlicensed, incomplete, missing-directory and duplicate entries. Updates patch only mapped fields, retaining photo links and other custom fields. Duplicates retain the lowest item ID; review photo metadata before removing duplicates.

## List columns and mappings

The first live apply created the **single line of text** column `EntraUserId` in each list and populated the staff IDs. Subsequent runs use the Microsoft user ID to preserve an entry when the email changes. The Staff Directory's renamed built-in Title column is resolved by its internal name.

| Source | Employee_Profiles | SCPNG Staff Directory |
|---|---|---|
| User ID | EntraUserId | EntraUserId |
| Mail | Title | Email |
| Display name | — | Title |
| Surname | — | Surname |
| Department | Department | — |
| Office location / division | — | Division |
| Job title | Designation | Designation |

Eligibility checks all required source fields even when a list does not store each field. Column display labels with trailing spaces resolve to the actual internal names automatically. A missing/ambiguous mapped column aborts the run; no guessed schema writes occur. Add extra mappings only after confirming their columns exist.

## Historical Node reference: authentication and first preview

Use a dedicated confidential Microsoft Entra application with admin-consented Microsoft Graph application `User.Read.All` and `Sites.Selected`, plus an explicit **write** grant only to the SCPNG intranet site. These permission grants require administrator setup and confirmation. Do not use the browser application's credentials or copy browser sign-in tokens. [User API](https://learn.microsoft.com/en-us/graph/api/user-list?view=graph-rest-1.0), [selected site permissions](https://learn.microsoft.com/en-us/graph/permissions-selected-overview).

On the scheduled Windows account, securely provision environment variables `STAFF_SYNC_TENANT_ID`, `STAFF_SYNC_CLIENT_ID`, and `STAFF_SYNC_CLIENT_SECRET`. Keep the secret out of this repository, frontend environment variables, task arguments, reports and chat. Rotate it before expiry. The current implementation uses client credentials; a managed identity or certificate can be substituted for deployments with that infrastructure.

Use Node 20 or newer. No extra packages are required.

```powershell
Copy-Item scripts/staff-sync/config.example.json scripts/staff-sync/config.json
node scripts/staff-sync/run.mjs --config scripts/staff-sync/config.json
```

Review the generated JSON report (creates, updates, removals and exclusion reasons). Backups contain complete list-item field snapshots; restrict the local reports folder to administrators and the scheduled account. Reports and config are ignored by Git. Windows filesystem permissions must be configured separately; POSIX mode flags do not secure an NTFS folder.

After reviewing a fresh preview:

```powershell
node scripts/staff-sync/run.mjs --config scripts/staff-sync/config.json --apply
```

Removals above 25% of either existing list abort before any writes. If a reviewed first cleanup legitimately exceeds this, use `--max-removal-percent 100` for that single run. Keep the scheduled default at 25%. Items are removed with Microsoft's standard list-item delete endpoint; the saved field backup is not a full backup of attachments, versions or item-level permissions. Confirm the site's normal recycle-bin recovery behaviour during a test before enabling deletion. [Delete list item](https://learn.microsoft.com/en-us/graph/api/listitem-delete?view=graph-rest-1.0).

## Historical alternative: Azure Functions (not deployed)

Deploy `scripts/staff-sync` as the function app project on a **dedicated App Service plan**, Node 22, Functions runtime 4; enable Always On. The timer uses `5.00:00:00` (five elapsed days), `useMonitor: true` and `runOnStartup: false`. Do not substitute a day-of-month `*/5` cron schedule: that is not a continuous five-day interval across months. TimeSpan schedules require an App Service plan. [Microsoft timer documentation](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer).

1. Enable the function app's managed identity. Grant that identity Microsoft Graph `User.Read.All`, `Sites.Selected`, and a write grant to the intranet site. No application client secret is needed in this cloud mode.
2. Configure `AzureWebJobsStorage` for Functions timer state/coordination. Use the supported Azure Functions host-storage configuration and required storage role if using an identity-based connection. This is distinct from the private report container.
3. Create a private Azure Blob container for reports and grant the identity Storage Blob Data Contributor scoped to that container. Block anonymous/public blob access. Set retention according to SCPNG's staff-data policy.
4. Set `FUNCTIONS_WORKER_RUNTIME=node`. Set `STAFF_SYNC_CONFIG_JSON` to the example config plus `reportStorageAccountUrl` (e.g. `https://YOURACCOUNT.blob.core.windows.net`) and `reportContainer`. Set `STAFF_SYNC_APPLY=false` initially. Use `AzureWebJobs.staffListSync.Disabled=true` while provisioning permissions/schema.
5. Run `npm ci` in this folder using its included package lockfile, then package/deploy it using Azure Functions tooling. Do not deploy the frontend's environment files or secrets.
6. After permission/schema setup, temporarily enable and manually invoke the timer for a preview. Inspect the report and backup blobs. Verify normal recovery behaviour on a disposable test item. Set `STAFF_SYNC_APPLY=true` only after reviewing that preview; then manually test one apply and verify both lists.
7. Leave the timer enabled for recurring execution and configure an Azure Monitor job-failure alert to the automation administrator. A failed timer is not automatically retried until its next scheduled occurrence; the alert is needed for timely repair. No alert recipients have been configured or messaged by this implementation.

In cloud mode, every report update is uploaded to private blob storage. The full field backup and initial plan upload must succeed before the script mutates SharePoint. Temporary local files are removed after the job ends. Azure's timer host coordinates a single timer invocation across scaled instances. Do not run another copy of the same cleanup on a separate server simultaneously.

No Azure resources, permissions, deployments, billable hosting or alerts have been created. They are not required by the active native Power Automate flow.

## Optional five-day Windows schedule

After a successful live preview/apply and recovery test, run:

```powershell
./scripts/staff-sync/register-task.ps1 -ConfigPath ./scripts/staff-sync/config.json -Apply
```

Without `-Apply`, the task creates reports only. The task runs every **five days**, starting the following day at **08:00 in the PC's local timezone** (set it to Port Moresby). It runs as the signed-in Windows user, with no password stored. This PC must be on and that user signed in; missed runs start when available. For unattended operation without a signed-in desktop, host the same script on a managed server/cloud job with its own protected identity. Registration does not replace an existing task silently. Check the task's Last Run Result and JSON reports for failures; no email alerts are sent.

## Failure handling and verification

- Fully page all users, list metadata, columns and items before changing any list. Empty users, omitted licence data, repeated pagination links, malformed data or duplicate directory addresses abort cleanup.
- Take field snapshots before mutations. Perform all additions/updates first; a failure stops before cleanup starts. Writes use ETags to stop on concurrent edits. Cross-list updates are not transactional; the report records completed actions so a partial failure can be reviewed and rerun.
- Respect throttling retries. Do not retry an uncertain create after network/server failures; inspect the next report for an existing entry instead. A lock prevents simultaneous local runs. If a process crashes, verify it has stopped before manually removing the lock file.
- Test with a licensed complete user, an unlicensed user, each missing field, changed email, duplicates, an incomplete directory response, and a concurrent edit. Confirm photos stay intact and both target lists reconcile correctly.
- Local tests: `node --test scripts/staff-sync/core.test.mjs scripts/staff-sync/runner.test.mjs`. The runner tests intercept all HTTP in a child process; they exercise preview/apply, complete pagination, backup-before-write and stopping before cleanup on a concurrent edit, without touching the live tenant.

The above identity/host requirements apply only to deploying the unused Node alternative. The native Power Automate flow is already activated with its existing connections.

## Local verification, 12 October 2026

All 12 offline tests passed (eight reconciliation tests and four runner tests). Node syntax checks passed for the runner/cloud entry point; the scheduler PowerShell file parsed without errors. Azure dependencies were installed with lifecycle scripts disabled and a package lockfile generated. The cloud entry point imported successfully outside Azure, where the SDK correctly reports test mode and does not register a live function. No live Microsoft 365 requests or removals were performed by these tests. Cloud timer execution, identity permissions, storage durability, and list recovery still require deployment verification.


## Native Power Automate package implementation

`scripts/staff-sync/build_power_automate.py` builds the native package from the owner export. The generated ZIP is `C:/Users/IT_UNIT/Downloads/SCPNGStaffFiveDaySync-Complete-Preview.zip`. It updates the existing flow, with existing Office 365 Users and SharePoint connections. The original uploaded ZIP is retained as rollback source.

The 79 actions discover column internal names from SharePoint field metadata, validate complete profile/list reads and unique source IDs/emails, prefer existing EntraUserId matches over legacy email matches, and construct a preview plan. An EntraUserId text column is created only in apply mode when absent. Existing records receive patches to mapped fields only. Duplicate rows prefer a stable-ID row and otherwise retain the lowest item ID. Missing/ineligible rows are recycled, not permanently deleted. All upserts must succeed before removal version checks and recycling begin. A removal plan exceeding 25 percent of either list stops apply for review.

Recovery snapshots are kept in the restricted flow run history before writes; they are not a separately deployed durable backup and expire with Power Automate run retention. SharePoint recycled items retain the product's normal recovery period. Updates use captured ETags. Removal candidates have all versions rechecked before recycling and send an If-Match header, but the read/recycle sequence is not an atomic multi-item transaction; concurrent edits during that small interval remain a limitation.

Package checks passed for 79 unique action names, valid action references/runAfter dependencies, balanced expression strings/parentheses and Apply_changes=false. Live verification additionally included the full preview on 15 October at 10:35 PNG and the successful write-enabled run at 10:53 PNG. All ten proposed removals were checked against the source: nine accounts had no assigned licences, and one was the explicitly excluded Automation service account. The normal 25-percent guard remains enabled for future runs.
