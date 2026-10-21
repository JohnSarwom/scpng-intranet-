# Newsletter routing administration

Updated 21 October 2026 for **Power Automate + SharePoint**. The admin UI sends creator-owned SharePoint requests; the native processor validates and saves appointments. Generating the implementation does not deploy flows or appoint staff.

## Using the screen

Open **Admin Dashboard → Newsletter Routing** (`/admin?tab=newsletter-routing`). Staff choices come from SCPNG Staff Directory and Employee_Profiles, joined by Entra identity. The organization chart and newsletter rules share canonical division labels.

1. Choose the R&P division, review deadline and optional escalation contact.
2. Add a current staff member and responsibility: divisional approver, editorial reviewer, final publication approver, publisher or specialist clearance reviewer.
3. Give divisional approval an explicit division. Other appointments can cover one division or all divisions.
4. For temporary cover, end the existing appointment exactly when the replacement starts. The UI uses browser-local time and stores UTC timestamps.
5. Enter a reason and **Save appointments**. Power Automate validates the real requester, current staff, dates, scopes, independent approval and the reviewed settings version before writing.

The interface shows missing coverage and author self-review cases. Pilot settings can be saved with coverage gaps; affected submissions remain blocked. A title such as Director or Manager does not automatically create an appointment. Editors may also publish, but cannot give final approval to their own editorial work.

**Reload staff & appointments** reads the latest configuration. Discard a local draft before reload. A conflict retains the draft and requires fresh settings. Power Automate processing is asynchronous; an unconfirmed timeout must be checked before resubmitting a mutation.

## Who can administer appointments

Access follows the existing intranet **UserRoles / PermissionGroups** lists. Accounts with Role `admin` or `super_admin`, or the existing `IsAdmin` flag, qualify automatically. There is no separate newsletter administrator allowlist or hardcoded Automation/John account.

To delegate appointment management without general administrator powers:

1. In **Admin → Roles & Groups**, create a **Newsletter Administrators** group. Under **Newsletter appointments**, select **Manage reviewers and publishers**.
2. In **Admin → Users**, add that group to the person, preserving their other groups and role. John Sarwom can retain his existing manager role.
3. Remove the group or its management permission to revoke this delegation. Delegates receive the newsletter appointment screen; this permission does not grant user/role administration.

Power Automate resolves identity from the request item's SharePoint Author via Office 365 Users, matches the trusted directory UPN to one UserRoles record, and rereads the current role and group permissions for every routing request. It ignores browser admin flags and cached roles. Ambiguous identities, incomplete paged reads and unprotected access lists are rejected. A publisher, manager or editor does not automatically become a routing administrator.

Both access lists must have unique SharePoint permissions with edits restricted to authorized intranet administrators and trusted service operators; ordinary staff need Read only. Unique inheritance is checked by the flow, but the actual permission grants and group membership still require review. The intranet writes these lists as the signed-in user, so each intranet administrator also needs appropriate SharePoint edit rights. Delegates must not receive write access to these lists. Newsletter appointments stay in the separate protected **Newsletter_Routing** item. There is no newsletter external-function endpoint or API secret to configure.

The 21 October tenant review found UserRoles inheriting site permissions, including Edit for SCPNG INTRANET Members and Ninipe Gurumo. The revised processor will reject routing administration until the access lists are protected. Do not activate it after merely breaking inheritance while retaining broad Edit grants. The previously imported processor predates this change and must be replaced or updated before activation.

## Staff changes, pending work and history

The processor reads current synchronized staff and disables departed identities for decisions. Entra/licence changes first need the existing five-day staff sync to reach those lists. End or remove a departed officer's appointment; inactive historical identities remain available for audit.

Existing submissions keep their recorded reviewer. An authorized publisher uses **Refresh Reviewer Assignment**, with a reason, to reroute pending work. Prior approvals and publications remain in history. An author who normally reviews needs a different dated appointment before submitting.

Each save verifies the settings ETag, writes a private before/after file in **NewsletterFiles**, appends an audit reference and commits the settings. A losing conflict can leave an unreferenced snapshot; it cannot replace the winner. Preserve referenced snapshots. If history reaches its size limit, IT must archive it before further saves.

## Activation

Follow [README](README.md) for the three native flow packages, restricted stores, request-list permissions, frontend SharePoint identifiers, connections and pilot acceptance. Keep generated flows disabled until reviewed. Verify a normal user cannot read another user's queue items, private stores or result files; verify an unauthorized user cannot save appointments by crafting a request directly.
