# Christmas form: staff could not save answers (permissions) and a misleading error

| | |
|---|---|
| **Date** | 2026-11-27 |
| **Status** | In review. The SharePoint permission fix is already applied on production; the message fix is in review. |
| **Programme step** | None |
| **Branch / PR / commits** | `fix/christmas-save-errors` (from `origin/main`) |
| **Decisions used** | Owner approved on 2026-11-27: let all staff add answers to the Christmas list only, each seeing only their own answer; save and delete one test answer; ship clearer error messages. |

## Why

Some officers who filled in the Christmas Closing Event form got "Your response could not be saved. Check your connection and try again." Their answers never reached SharePoint.

The cause was permissions, not their connection. The list inherited the intranet site's permissions, and most staff are only allowed to read the site:
- Owners (6) and Members (5) have full control or edit.
- One person has edit directly.
- Visitors (6) and about 20 staff given access individually are read-only.

Read-only officers could see the invitation, because reading worked, but SharePoint refused to add their answer.

Two other things were found at the same time:
- Staff with no site access at all (only in "Everyone except external users") could not read the list, so the invitation never appeared for them.
- The form blamed the connection for every kind of failure.

## What changed for users

- Every staff member can now save their Christmas answer. Officers who got the error only need to open the intranet again and press Submit; their draft is still on their computer.
- Staff who never saw the invitation will now see it on their next visit.
- Each officer can only see and change their own answer in the list. Site owners and editors still see every answer, so the committee can still export them.
- If a save ever fails, the form now says why: no permission, the connection, SharePoint being busy, an expired sign-in, or an error code. It always adds that the answers are kept on the computer.

## Technical changes

| Area | Change |
|---|---|
| `src/modules/christmas-event/saveErrors.ts` | New `describeSaveError()`, which turns a failed save (Graph `statusCode`, MSAL errors, offline) into a message an officer can act on. |
| `src/modules/christmas-event/saveErrors.test.ts` | 6 tests: permission (403), no reply (-1 / offline), busy (429), expired sign-in, list not set up, and other codes. |
| `src/modules/christmas-event/ChristmasEventForm.tsx` | The save failure message now comes from `describeSaveError()` instead of always blaming the connection. |
| `docs/modules/christmas-event.md` | The privacy and permissions settings are now described as done. |

## Data and SharePoint changes

All applied on production on 2026-11-27 by the Automation account, with the owner's approval:

- **List `Christmas_Event_2026_Responses`:**
  - Permission inheritance broken, with the existing assignments copied (Owners Full Control, Members Edit, Visitors Read, plus the individual users).
  - **"Everyone except external users" added with Contribute**, on this list only. Site permissions are unchanged.
- **Item-level permissions:** Read access is "Read items that were created by the user" (`ReadSecurity` 2), and Create and Edit access is "Create items and edit items that were created by the user" (`WriteSecurity` 2). People with Manage Lists rights (owners and editors) still see all items.
- **Test answer:** one test answer with leave dates was saved through the live form, checked, and moved to the site recycle bin. It will be purged automatically. The list holds the same 8 real answers as before.

## How it was checked

- **Permissions:** for 5 read-only staff (individual Read users and Visitors), SharePoint's effective permissions on the list now show view, add and edit. Two of them still cannot add items elsewhere on the site, which confirms the change is limited to this list.
- **Live form, signed in as Automation:**
  - Opened the envelope and submitted "To be confirmed" with "Taking leave and travelling", a destination and dates 24/12/2026 to 05/01/2027.
  - It saved in 1.3 s.
  - SharePoint shows the dates as 24/12/2026 and 05/01/2027, so dated answers save correctly.
- `tsc --noEmit -p tsconfig.app.json`: no errors in the module.
- `vitest run src/modules/christmas-event`: 14 of 14 passed (6 new).
- **Not checked:**
  - A real save by a read-only officer's own account (checked through effective permissions instead).
  - Which officers failed before the fix, since no failure log exists.

## Follow-ups and open items

- Let the officers who got the error know they can submit again.
- The index row in `docs/changes/README.md` is still to be added on `main` (the index is on `feat/strategic-goals-workflow-studio`).

## How to undo it

- **Permissions:** in the list's settings, open Permissions for this list, then remove "Everyone except external users" or choose "Delete unique permissions" to inherit from the site again. Then set Advanced settings > Item-level permissions back to "Read all items" and "Create and edit all items".
- **Code:** revert this change's commit.

## History

- 2026-11-27: SharePoint permission fix applied on production and checked; test answer saved and recycled; record created.
