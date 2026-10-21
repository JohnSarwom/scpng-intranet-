# Newsletter workspace — Power Automate and SharePoint

The newsletter backend is **Power Automate + SharePoint**. The former external function endpoint, function deployment entry, API-key header and newsletter API-token configuration have been removed. Shared TypeScript files under `src/lib/newsletters/` are UI validation and offline regression references; they are not a hosted backend.

## Application paths

- `/news/newsletters`: published newsletter library and archive.
- `/news/newsletters/:id`: staff reading page and authenticated downloads.
- `/news/newsletters/workspace`: submissions, reviews, publishing queue and calendar.
- `/admin?tab=newsletter-routing`: staff appointments, division scopes and cover dates.

## How requests work

1. The signed-in intranet uses its existing Microsoft Graph connection to create a request in **Newsletter_Requests** on the main intranet site. SharePoint records the real creator. Large inputs are split into creator-owned **Newsletter_RequestParts** rows before the request is queued.
2. The native **SCPNG Newsletters - Processor** flow drains up to 50 queued requests each minute, sequentially. It resolves the request's SharePoint Author through Office 365 Users, matches the synchronized staff roster, and checks protected routing. Browser-supplied identities, admin flags and staff rosters do not grant authority.
3. Every state change, approval, publication and routing edit is validated by native Power Automate actions and expressions. A private request ledger reserves each request before execution. Reusing its key does not execute a decision twice. SharePoint ETags protect authoritative record updates.
4. The flow writes a creator-readable result to the request. Large results and downloads use a restricted temporary file with read access granted only to that requester. The frontend polls for a confirmed result for up to three minutes. A timeout is an **unknown outcome**, not permission to replay a mutation.
5. Scheduled publication, overdue reminders and staff email run in the same serialized processor. The maintenance flow recycles expired delivery files and old completed/orphan input parts; it preserves workflow records, version files, routing audit and the idempotency ledger.

The queue design avoids exposing a signed HTTP-trigger URL or credentials in the browser. Requests can take a polling interval plus queue time; the UI fixture's immediate responses are not live timing measurements. Measure Power Automate request capacity and latency against the tenant's actual plan before activation. The one-minute processor performs connector reads even while idle; do not assume an included Microsoft 365 allocation is sufficient for sustained use.

## SharePoint stores and permissions

| Location | Store | Purpose / access |
|---|---|---|
| Main intranet | Newsletter_Requests | Commands and results. Staff receive **Contribute**, with ReadSecurity=2 and WriteSecurity=2, so they access their own items. Do not grant Edit/Manage Lists to ordinary users. |
| Main intranet | Newsletter_RequestParts | Large request inputs, with the same creator-only settings. |
| Main intranet | NewsletterDownloads library | Restricted by default; each delivery file grants Read only to its authenticated requester. |
| Main intranet — restricted store | Newsletter_Configuration | Owner-managed activation, fixed email audience and scheduler settings. Appointment administrators come from current UserRoles / PermissionGroups. |
| Main intranet — restricted store | Newsletter_Routing | Appointments and audit references, edited through the admin UI after authorization. |
| Main intranet — restricted store | Newsletter_Submissions | Authoritative private content, revisions, decisions and history. |
| Main intranet — restricted store | Newsletter_Publications | Published projections, delivered through authorized requests. No direct broad staff access is needed. |
| Main intranet — restricted store | Newsletter_Notifications | Recipient-specific workflow notices and overdue reminders. |
| Main intranet — restricted store | Newsletter_Attachments | Trusted file ownership/metadata. |
| Main intranet — restricted store | Newsletter_RequestLedger | Immutable request reservation/outcome history. Never clear it to retry a decision blindly. |
| Main intranet — restricted store | NewsletterFiles library | Version snapshots, private attachments and routing before/after snapshots. |

Setup creates new stores with inheritance broken and access restricted to the connection owner. It does not grant staff access automatically or modify existing staff/notice lists. Site collection administrators retain their normal SharePoint powers. Runtime checks verify restricted inheritance and creator-only list settings; actual group memberships and direct-file denial still require tenant acceptance tests.

## Native flow packages

`scripts/newsletters/power_automate.py` generates **new** Setup, Processor and Maintenance flows. All start with **Apply_changes=false**. It can use an authorized owner's exported ZIP or its extracted directory as the package shell. Missing standard connector references are explicit selections during import, never copied credentials. The processor uses SharePoint, Office 365 Users and Office 365 Outlook connectors; setup/maintenance use SharePoint.

```powershell
python scripts/newsletters/power_automate.py --definitions tmp/newsletter-power-automate
python scripts/newsletters/power_automate.py --settings <reviewed-settings.json> --definitions tmp/newsletter-power-automate --owner-export <authorized-owner-export.zip>
```

Set both `mainSite` and `privateSite` to the existing intranet SharePoint site in a local copy of `scripts/newsletters/deployment.example.json`. `privateSite` identifies where protected stores live; it does not require a separate site. Privacy comes from unique permissions on each workflow list and library, not a separate staff-facing website. Review the generated definitions and connections before import. Packages in `tmp/newsletter-power-automate/` are review artifacts, not proof of tenant deployment.

For a reviewed update to an existing, disabled Processor, add `--allow-processor-update`. Only processor.zip then offers Update during import; select the existing newsletter Processor explicitly and verify its identity and Off status before and after import. Setup and Maintenance remain new-only packages. The update resets Apply_changes to false and does not grant access or activate processing.

Review `directoryFields` against the synchronized staff directory's internal column names. In the live SCPNG list, Division is `field_3` and Email is `field_5` (verified in Test Ground's Schema & Columns). These mappings select existing staff data; they do not change staff roles or assignments. Omitted mappings default to standard internal names `Division` and `Email`. The native roster preflight rejects an empty eligible roster before draining any requests.

1. Verify connection-owner access to the existing intranet site and restricted permissions on the new stores; import each package as a **new** flow.
2. Review the Setup flow, set its deployment sites, deliberately enable its Apply_changes value, and run it once. It refuses to alter an existing newsletter store by default. For the specific interrupted setup that created an empty Newsletter_Requests list before adding any workflow fields, an operator can set resumeEmptyRequestListId in deployment.local.json to its reviewed GUID. Recovery verifies that exact list is empty, uniquely restricted, versioned, creator-only and has attachments disabled; it also requires all workflow fields still to be absent. It does not recreate the list or change its permissions. Other existing stores still stop setup. Any different partial failure requires a fresh inspection rather than a blind rerun.
3. Grant the verified intranet staff group **Contribute** on the two request lists only. Keep creator-only ReadSecurity/WriteSecurity and restricted inheritance. Keep private stores and download-library root restricted. Test a normal staff account against other users' rows and all private stores/files.
4. Protect UserRoles and PermissionGroups with unique list permissions: ordinary staff Read, authorized intranet administrators/trusted operators Edit. Check effective access, including group membership. Routing access uses current intranet administrator roles or the `newsletter_routing:manage` group permission; see [routing administration](routing-administration.md). In Newsletter_Configuration, create `Title=settings`, `Payload=` a reviewed copy of [runtime-configuration.example.json](runtime-configuration.example.json), with the real main intranet Graph site ID. Keep email disabled until sender/audience acceptance; the Outlook connection determines the sender. `enabled` and `schedulingEnabled` are explicit activation controls.
5. Configure the frontend's three public identifiers and rebuild:

```text
VITE_NEWSLETTER_REQUEST_SITE_ID=<main intranet Graph site ID>
VITE_NEWSLETTER_REQUEST_LIST_ID=<Newsletter_Requests list GUID>
VITE_NEWSLETTER_REQUEST_PARTS_LIST_ID=<Newsletter_RequestParts list GUID>
```

6. Review capacity, flow limits and connection permissions. Enable Apply_changes in Processor only after configuration and privacy checks, then turn it on. Confirm it processes a harmless session request. Enable Maintenance after verifying its retention behavior.
7. Use **Admin → Newsletter Routing** to appoint the real divisional approvers, editors, final approvers, publishers and cover dates. No recommended person is appointed automatically. See [routing administration](routing-administration.md).
8. Run the pilot with separate staff/reviewer/publisher accounts, browsers closed during scheduled tests, and a restricted email test audience before any all-staff broadcast.

## Workflow and recovery

- Outside R&P: author → divisional approval → editorial review → optional specialist clearance → independent final approval → publication.
- R&P: author → independent editorial review → optional clearance → independent final approval → publication.
- Authors cannot review their own submissions. Editorial reviewer and final approver must differ. Appointments must be current, explicitly scoped and non-overlapping. General UserRoles permissions do not create these appointments.
- Content changes repeat approval. Publication is bound to the approved content version. Returns, rejections, reassignment, corrections, archiving and withdrawal require reasons.
- Each saved version and routing update retains a private snapshot. Existing tasks keep their recorded reviewer until a publisher uses Refresh Reviewer Assignment.
- Staff membership comes from the same two synchronized lists used by the app, matched by stable Entra identity. The existing five-day staff sync remains separate and unchanged.
- On withdrawal the flow hides the published projection before committing the private state. Newly requested canonical links/downloads are denied or show the withdrawal notice. Prior downloads, emailed links and previously delivered temporary copies cannot be recalled.
- Email is claimed as `sending` before a single no-retry Outlook action. A failure/interruption can leave `sending`; reconcile the sender's Sent Items before changing it. Never reset sending/uncertain work blindly.
- After a partial mutation the request reports Uncertain where possible. Its private reservation prevents replay; check authoritative records, the private ledger and restricted flow history before issuing another command. A caller timeout likewise does not prove failure.
- Maintenance recycles temporary delivery files after one day and request parts older than seven days only when no queued, processing or unresolved request needs them. It does not delete workflow history or source/version files.

## Verification and practical limits

Run `python -m unittest discover -s scripts/newsletters -p test_power_automate.py`, the focused Vitest suite, frontend build and typecheck. Native-definition tests enforce Power Automate's 500-action and eight-level limits, unique action names, resolved references, no variable self-assignment, mutation gates, trusted creator resolution, ETags and email claims. They also evaluate emitted WDL role/date/scope rules. These tests do **not** replace Power Automate import/connector validation.

Tenant acceptance must cover forged client identities, unauthorized admin saves, self-review, expired/overlapping appointments, stale revisions, duplicate delivery, file upload/download ownership, creator-only queue privacy, routing edits, corrections, withdrawal, scheduled processing and uncertain email outcomes. Validate actual connector schemas, binary file behavior, approval deadlines, throughput and recovery in that tenant before calling this live-ready.

Content supports Markdown, an HTTPS cover image and up to five 3 MB attachments. Use organizational malware controls; a content declaration is not automated screening. JSON records stop before 60,000 characters rather than truncating history. Source/inventory reads currently stop if a 5,000-item page is incomplete; indexed paging/archive scaling is a production acceptance item for larger deployments. No flow is imported, enabled or granted access by generating packages.

## Microsoft references

- [SharePoint ReadSecurity: creator-only reads](https://learn.microsoft.com/en-us/sharepoint/dev/schema/readsecurity-element)
- [Power Automate limits and concurrency](https://make.powerautomate.com/documentation/limits-and-config/)
- [SharePoint connector](https://learn.microsoft.com/en-us/connectors/sharepoint/)

### Run-history privacy

Connector steps mask inputs and outputs; Compose steps use supported secure inputs, which also masks their outputs. Built-in variable actions do not support these history settings, so restrict flow ownership and run-history access to authorized operators. SharePoint list permissions remain the content-access boundary.

### Creator-only queues and duplicate commands

SharePoint rejects unique-value fields on lists configured for creator-only reads. Newsletter_Requests and Newsletter_RequestParts therefore index their Title fields without enforcing uniqueness. The uniquely keyed private Newsletter_RequestLedger is the authoritative reservation boundary: an existing key only returns its recorded response when both the request item ID and SharePoint Author ID match; any different request using that key is rejected before execution. Private record lists retain their unique Title constraints.

### Division labels and request pressure — 21 October 2026

Newsletter routing and native flow generation share src/config/newsletterDivisionAliases.json. Finance Unit maps to Corporate Services Division; Supervision Unit maps to Licensing, Market & Supervision Division; Legal Advisory Unit/Division maps to Legal Services Division, matching the documented organizational hierarchy. These are routing labels, not edits to synchronized staff records. Unknown labels are preserved. Monica Abau-Sapulai's organization-wide division label remains unresolved at the user's explicit request; routing displays a warning rather than assigning her to a division. Division selectors and trusted appointment-scope validation admit recognized organizational divisions only.

The notification bell now requests newsletter updates when first opened and on explicit Refresh, rather than every minute on every page. Ordinary notifications keep their existing polling, and remain visible while newsletter updates load. The unread badge includes newsletter results only after that explicit load; it is not a continuous newsletter push indicator. Identical in-flight read requests are joined within the same signed-in context and endpoint configuration. Results are not persisted or cached after completion; different accounts, records and mutation requests remain independent. The native Processor stays serialized for authoritative writes. This removes the idle traffic source, but does not prove multi-user production throughput.
