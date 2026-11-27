# Troubleshooting: staff can read but not save to a SharePoint list

> First seen: 2026-11-27, Christmas Closing Event form. Change record: [2026-11-27-christmas-save-permissions](../changes/2026-11-27-christmas-save-permissions.md).

Use this guide when an intranet feature works for some staff but not others, especially when saving fails and reading works.

## Symptoms

- Some officers can submit or save; others get an error on the same form.
- The people who fail can still **see** the page, form or data. Only **saving** fails.
- The error may wrongly blame the connection. The Christmas form said "Your response could not be saved. Check your connection and try again." until it was fixed on 2026-11-27.
- In the browser console (F12), the failed request to `graph.microsoft.com` returns **403 Forbidden** (or 401). The Christmas form logs `[ChristmasEvent] save failed`.
- A second, quieter symptom: some staff never see a feature at all. If a feature first has to read a list, and the person has no access to it, the read fails and the feature stays hidden.

## Why it happens

The intranet calls SharePoint (through Microsoft Graph) **as the signed-in person**. Whatever that person may do on the SharePoint site is all the intranet can do for them.

On the intranet site (`/sites/scpngintranet`), most staff can only read. As of 2026-11-27:

| Who | Site permission | Can add list items? |
|---|---|---|
| Owners group | Full Control | Yes |
| Members group | Edit | Yes |
| A few people given Edit directly | Edit | Yes |
| Visitors group | Read | **No** |
| About 20 staff given Read individually | Read | **No** |
| "Everyone except external users" (all staff accounts) | Limited Access only | **No**, and cannot read lists that inherit site permissions |

New lists **inherit the site's permissions** by default. A list created for every staff member to fill in therefore accepts answers only from Owners and Members. Everyone else gets 403.

**Scale (2026-11-27):** of the site's 114 standard lists, 96 inherit the site's permissions. Any feature where ordinary staff save to one of those 96 lists has the same risk.

## How to confirm it

Sign in to the SharePoint site as a site owner (for example the Automation account). Open any page under `https://scpng1.sharepoint.com/sites/scpngintranet/`, press F12, and run these in the Console. Replace `LIST_TITLE`.

```js
const base = '/sites/scpngintranet/_api/';
const H = { headers: { Accept: 'application/json;odata=nometadata' } };
const get = async (u) => (await fetch(base + u, H)).json();

// 1. Does the list have its own permissions, and who saved so far?
await get("web/lists/getbytitle('LIST_TITLE')?$select=ItemCount,HasUniqueRoleAssignments,ReadSecurity,WriteSecurity");

// 2. Who has what on the site (and on the list, if it has its own permissions)?
(await get('web/roleassignments?$expand=Member,RoleDefinitionBindings')).value
  .map(a => [a.Member.Title, a.RoleDefinitionBindings.map(r => r.Name).join('+')]);

// 3. Can a particular person add items? Use their sign-in, e.g. i:0#.f|membership|name@scpng.gov.pg
const login = 'i:0#.f|membership|PERSON@scpng.gov.pg';
const p = await get(`web/lists/getbytitle('LIST_TITLE')/getusereffectivepermissions(@u)?@u='${encodeURIComponent(login)}'`);
({ view: (p.Low & 1) !== 0, addItems: (p.Low & 2) !== 0, editItems: (p.Low & 4) !== 0 });
```

It is this problem if:
- `HasUniqueRoleAssignments` is `false` (the list inherits the site's permissions), and
- the person who failed has `addItems: false`.

## How to fix it (one list at a time)

Give all staff the right to add items **to that list only**. Their access to the rest of the site does not change.

**In the SharePoint web pages:**
1. Open the list, then **Settings** (gear) > **List settings** > **Permissions for this list**.
2. Choose **Stop Inheriting Permissions**. This copies the current permissions, so nobody loses access.
3. Choose **Grant Permissions**, enter **Everyone except external users**, and pick **Contribute**. Untick "send an email invitation".
4. If each person's entries should be private, go back to **List settings** > **Advanced settings** > **Item-level permissions**:
   - Read access: **Read items that were created by the user**.
   - Create and Edit access: **Create items and edit items that were created by the user**.

   Owners and people with Edit still see every item, so a committee or admin can export everything.

**Or from the browser console** (as a site owner, on the site), as used on 2026-11-27:

```js
const base = '/sites/scpngintranet/_api/';
const H = { Accept: 'application/json;odata=nometadata' };
const L = "web/lists/getbytitle('LIST_TITLE')";
const digest = (await (await fetch(base + 'contextinfo', { method: 'POST', headers: H })).json()).FormDigestValue;
const post = (u, init = {}) => fetch(base + u, { method: 'POST', ...init, headers: { ...H, 'X-RequestDigest': digest, ...(init.headers || {}) } });

const everyone = await (await fetch(base + 'web/siteusers/getbyid(8)?$select=Id,Title', { headers: H })).json(); // "Everyone except external users" on this site
const contribute = await (await fetch(base + "web/roledefinitions/getbyname('Contribute')?$select=Id", { headers: H })).json();

await post(L + '/breakroleinheritance(copyRoleAssignments=true,clearSubscopes=true)');
await post(L + `/roleassignments/addroleassignment(principalid=${everyone.Id},roledefid=${contribute.Id})`);

// Optional: each person sees and edits only their own items
await post(L, {
  headers: { 'Content-Type': 'application/json;odata=verbose', Accept: 'application/json;odata=verbose', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' },
  body: JSON.stringify({ __metadata: { type: 'SP.List' }, ReadSecurity: 2, WriteSecurity: 2 }),
});
```

Check that `getbyid(8)` really is "Everyone except external users" before running the rest. The ID can differ on another site.

## Check the fix

1. Re-run check 3 above for one or two people who failed. `addItems` should now be `true`.
2. Save one clearly labelled test item through the real intranet page, then move it to the recycle bin.
3. Ask the officers who failed to try again. The Christmas form keeps their unsaved answers as a draft on their computer, so they only need to press Submit.

## Preventing it next time

- **New list that every staff member writes to** (forms, RSVPs, feedback, requests): set its own permissions as above **when it is created**, before announcing the feature. Creating a list from code (as the Christmas form does on first use) does **not** do this.
- **Show the real error.** Do not tell people to "check your connection" for every failure. Reuse or copy `describeSaveError()` from `src/modules/christmas-event/saveErrors.ts`, which separates no permission (401/403), no reply (-1 or offline), busy (429/503/504) and expired sign-in, and reassures people that nothing is lost.
- **Test as a read-only account** before go-live, or check effective permissions for a read-only staff member (check 3).

## Open risk: other features

On 2026-11-27, 96 of 114 lists inherited site permissions. Features where ordinary staff save data should be checked against this guide; examples include task boards, comments, feedback and requests. Some may already be failing silently for read-only staff. The fix is the same; check one list at a time.
