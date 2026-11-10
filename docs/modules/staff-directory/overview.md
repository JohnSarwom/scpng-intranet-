# Staff directory synchronization

Updated 16 October 2026. The [five-day synchronization runbook](../staff-list-sync.md) contains mappings, deployment history, verification runs, recovery and reference scripts.

## Live job

**SCPNG Staff Lists - Five Day Sync** runs in Power Automate every five days, owned by Automation. It reconciles only `Employee_Profiles` and `SCPNG Staff Directory` with Entra profiles and a dedicated licence-details lookup. It does not synchronize `Strategy_Officer_Profiles`, email groups, notice audiences or HR records.

Eligible internal members need an assigned licence, full display name, valid SCPNG mail address, department and office location. Placeholder, guest, service and group entries are excluded. Qualifying users are added or updated; stale, duplicate, incomplete or unlicensed entries are recycled. `EntraUserId` preserves identity across address changes. Unmapped metadata, including photo links, is retained on updates.

## Operations

The job is On with changes enabled and a normal 25-percent removal guard. It validates source completeness, duplicate identities, schema, pagination and item versions before removal. Failed upserts stop removal. Recovery snapshots live in restricted run history for 28 days; removed list items use SharePoint recycling, not permanent deletion. This is not a durable backup service.

The initial apply reconciled both lists to 30 eligible staff. A second apply produced zero writes and removals. Review each run's report; a large rejected cleanup requires investigation rather than raising the guard automatically.

`scripts/staff-sync/build_power_automate.py` builds a preview package from an authorized owner export. Exports and local reports are ignored and must not be committed. The Node, Azure and Windows runners are historical alternatives, not additional live jobs. Do not schedule a second reconciler alongside the active flow.
