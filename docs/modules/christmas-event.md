# Christmas Closing Event invitation

Code: `src/modules/christmas-event/`. Change record: [2026-11-25](../changes/2026-11-25-christmas-closing-2026-invitation.md).

## What staff see

1. Staff sign in and open the intranet. About a second later the screen dims behind a dark maroon backdrop, with letterbox bars and slow gold light rays.
2. A gold foil envelope flies in, sealed with a red wax seal that carries the SCPNG emblem. It lands with a burst of gold confetti, then floats while a light glitter falls.
3. Clicking (or tapping, or pressing Enter on) the envelope breaks the seal and opens the flap. The invitation card rises out, then zooms toward the viewer and dissolves into the form.
4. The form looks exactly like the committee's artwork. The real SCPNG logo sits in a gold-ringed medallion where the artwork had a placeholder bird. Name and Division / Unit are filled in from the staff member's intranet profile where known.
5. **Submit response** checks the answers, then saves them to SharePoint. A thank-you card appears with more confetti, and the overlay closes after a few seconds or on **Continue to the intranet**.

While the invitation is deciding or showing, the intranet's "new announcement" pop-up waits, then opens as usual once the invitation closes (`src/lib/screenTakeover.ts`).

**Remind me later**, **Not now**, the close button and Escape all close the invitation for the rest of the browser session. It appears again the next time the intranet is opened, until the person has submitted. Unfinished answers are kept as a draft on that device.

To change an answer later, add `?christmas=open` to any intranet address (for example `/?christmas=open`). The form opens with the saved answers, and the button reads **Update response**.

People who prefer reduced motion (an operating system setting) get a short fade, with no flight, floating or confetti.

## Rules

- Required: full name, Division / Unit, one attendance tick, one Christmas period arrangement.
- "Travelling out of Port Moresby" and "Taking leave and travelling" also need a destination.
- Any leave or travel arrangement needs both dates, and the end date cannot be before the start date.
- Rules live in `validation.ts`, with tests in `validation.test.ts`.

## Where answers go

SharePoint list **`Christmas_Event_2026_Responses`** on the intranet site, one row per staff member (a resubmission updates the same row):

| Column | Type | Holds |
|---|---|---|
| Title | Text | Full name |
| StaffEmail | Text (indexed) | Sign-in email, lower case; used to find the person's row |
| DivisionUnit | Text | Division / Unit as typed |
| Attendance | Choice | Attending, Not attending, To be confirmed |
| Arrangement | Choice | The five section 03 options |
| Destination | Text | Travel destination |
| LeaveStart, LeaveEnd | Date only | Departure / leave start and return / leave end |
| Comments | Multi-line text | Additional comments |

The committee can open the list in SharePoint and use **Export to Excel**, or filter and group it there.

**Status:** created on production on 2026-11-25.

**Setup.** The list is created automatically the first time someone allowed to create lists (a site owner or admin) opens the intranet. Until then, staff who cannot create it simply do not see the invitation, so nobody fills in a form that cannot be saved. Staff need permission to add and edit items on the site, which is already required for other intranet lists.

**Privacy.** By default anyone with access to the site can read the list. To limit staff to their own rows, open the list settings, go to **Advanced settings**, and set item-level permissions to "Read items that were created by the user" and "Create items and edit items that were created by the user". Site owners and the committee (given Full Control on the list) still see every row.

## Settings

Everything is in `config.ts`:

- `enabled` switches the invitation off.
- `showUntil` is the last day it appears (currently 23 December 2026).
- `listName` sets the SharePoint list.
- `id` names the browser storage keys; change it for a new event so everyone is asked again.
- `year` and `eventDateLabel` set the text on the invitation card.
- The field positions on the artwork are also in `config.ts`, in artwork pixels (1055 x 1491).

## Developer preview

In development builds only, `/dev/christmas-event` plays the whole sequence without signing in. Answers stay in memory there and nothing is sent to SharePoint. **Play again** restarts it.

## Files

| File | Role |
|---|---|
| `ChristmasEventGate.tsx` | Decides whether to show the invitation (signed in, not already submitted, not dismissed this session, list available) |
| `InvitationOverlay.tsx` | The cinematic overlay and its stages: intro, envelope, opening, zoom, form, thank-you |
| `GoldenEnvelope.tsx` | Envelope, flap, wax seal and card animations (framer-motion) |
| `goldConfetti.ts` | Gold confetti bursts, side cannons and falling glitter (canvas-confetti) |
| `ChristmasEventForm.tsx` | The pixel-exact form over the artwork |
| `christmasEventService.ts` | SharePoint store (create list, find my row, save) and the in-memory preview store |
| `christmasEvent.css` | All styles, prefixed `xmas-` |
| `assets/form-artwork.webp` | The committee's artwork with the placeholder bird removed and the year changed from 2027 to 2026 |
| `assets/scpng-logo.webp` | The official logo, trimmed and resized from `public/images/SCPNG Original Logo.png` |
