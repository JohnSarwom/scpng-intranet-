# Christmas Closing Event 2026: invitation and attendance form on intranet open

| | |
|---|---|
| **Date** | 2026-11-25 |
| **Status** | Live |
| **Programme step** | None |
| **Branch / PR / commits** | `feat/christmas-invitation`, [PR #24](https://github.com/JohnSarwom/scpng-intranet-/pull/24), squash-merged into `main` as 1a5dc79 |
| **Decisions used** | Owner confirmed on 2026-11-25 that the event is 23 December 2026 (the artwork said 2027). |

## Why

The Christmas Event Organising Committee designed a staff attendance and availability form as a single image. The owner asked for:
- a working form that looks exactly like that image, with the official SCPNG logo;
- answers collected in SharePoint;
- the form to be the first thing every staff member sees when they open the intranet, introduced by an animated gold envelope with confetti.

## What changed for users

- On opening the intranet, signed-in staff who have not answered yet see a cinematic invitation:
  - a gold envelope with an SCPNG wax seal flies in, with gold confetti;
  - clicking it opens the envelope and raises the invitation card;
  - the card zooms and fades into the form.
- The form is the committee's artwork with working fields on every drawn box. The placeholder bird at the top is replaced by the real SCPNG logo in a gold-ringed medallion. Name and Division / Unit are pre-filled where the intranet knows them.
- Submitting saves the answers to SharePoint and shows a thank-you card. The invitation does not appear again for that person.
- "Remind me later", "Not now", the close button or Escape hide it until the next time the intranet is opened.
- Adding `?christmas=open` to any intranet address reopens the form with the saved answers so they can be changed.
- Full description: [docs/modules/christmas-event.md](../modules/christmas-event.md).

## Technical changes

| Area | Change |
|---|---|
| `src/modules/christmas-event/` | New module: gate, overlay, envelope, confetti, form, SharePoint store, validation (+ tests), styles, assets. |
| `src/modules/christmas-event/assets/form-artwork.webp` | Committee artwork with the placeholder bird removed (inpainted), and both "2027"s changed to "2026". The artwork has no 6 to copy, so each 7 was erased and a 6 drawn in the closest local typeface: Cambria Italic for the gold title year, Palatino Bold for the date line. Each 6 is coloured row by row from the neighbouring digit, with a matching soft shadow. Otherwise unchanged. |
| `src/modules/christmas-event/assets/scpng-logo.webp` | Official logo trimmed and resized from `public/images/SCPNG Original Logo.png`. |
| `src/lib/screenTakeover.ts` | New shared rule: while a full-screen moment holds the screen, welcome pop-ups wait. A modal dialog disables clicks on the rest of the page, so two at once leaves the top one unclickable. |
| `src/components/dashboard/StaffAnnouncementWelcome.tsx` | The "new announcement" pop-up stays closed while the invitation is deciding or showing, then opens as before. Its notices are not marked read in the meantime. |
| `src/App.tsx` | Mounts `ChristmasEventGate` once, beside the routes. Adds `/dev/christmas-event` (development builds only) to rehearse the sequence without SharePoint. |
| `public/forms/christmas-closing-2027/` | An earlier standalone draft of the form; never committed, replaced by this module. |

No new packages: it uses `framer-motion` and `canvas-confetti`, which were already installed. Display fonts (Cinzel, Great Vibes) load from Google Fonts, with serif fallbacks.

## Data and SharePoint changes

- New list `Christmas_Event_2026_Responses` (columns in the module doc). It is created automatically the first time a site owner or admin opens the intranet after deployment. Staff who cannot create lists do not see the invitation until it exists.
- **Created on production on 2026-11-25** by the Automation account, at the owner's request, by opening the local intranet with this code. Checked in SharePoint: 0 rows, and all 8 columns as designed (StaffEmail indexed, both choice columns with the right options).
- Optional: set the list's item-level permissions so staff only read their own rows (see the module doc).

## How it was checked

- `npx tsc --noEmit -p tsconfig.app.json`: no errors in the new module or `App.tsx`.
- `npx vitest run src/modules/christmas-event`: 5 of 5 validation tests passed (rerun after the 2026 change).
- After the year change, re-recorded the flow: the invitation card and the form both read 2026, and the new 6s were checked close up against the other digits.
- Headless Chrome against the dev server's `/dev/christmas-event`, at 1366 x 768:
  - Recorded the full sequence frame by frame: fly-in, landing confetti, idle float, seal break, flap, card rise, zoom, form, validation, ticks, submit, thank-you, close.
  - No Graph requests were made. Page scroll was restored after closing.
- Frame rate: the first version ran at 22 fps. After removing the backdrop blur, the glow blur and the animated foil background, and shrinking the rays layer, it ran at 58 to 61 fps with and without GPU flags.
- Fixed during testing:
  - The action bar was inside the zooming container, so it scrolled with the page and covered tick boxes. It is now pinned to the screen.
  - The rising card went off the top of 768 px-tall screens.
  - Error messages now update as fields are corrected.
- Live intranet (local dev server, signed in as Automation):
  - The first run showed a real bug: the staff announcement pop-up opened at the same time and disabled clicks on the page, so the envelope could not be opened. It is now fixed (see `screenTakeover.ts`).
  - After the fix, the invitation showed, the announcement stayed closed for the whole time, and the envelope opened into the form.
- Phone (390 x 844) with reduced motion: the envelope fades in, the form opens and the bar stays pinned. Escape closes the overlay.
- **Not checked:**
  - Saving to the real SharePoint list, and what a staff account without list-creation rights sees.
  - Firefox and Safari.
  - Screen readers.
  - Slower office PCs (the frame-rate numbers come from this machine).

## Follow-ups and open items

- The artwork still spells "Deprture" instead of "Departure".
- A site owner or admin should open the intranet once after deployment so the list is created before staff log in.
- Decide whether staff should only see their own rows (list item-level permissions).

## How to undo it

- To switch it off quickly: set `enabled: false` in `src/modules/christmas-event/config.ts` and redeploy.
- To remove it: delete `src/modules/christmas-event/`, remove the two lines that import and render it in `src/App.tsx` plus the dev route, and delete `docs/modules/christmas-event.md`.
- The SharePoint list, once created, can be deleted from Site contents.

## History

- 2026-11-25: record created for the standalone form, then extended to the intranet invitation, SharePoint storage, real logo and envelope intro.
- 2026-11-25: owner confirmed the event is December 2026; artwork, settings, list name and card text changed from 2027 to 2026. Record renamed from `2026-11-25-christmas-closing-2027-form.md`.
- 2026-11-25: committed on `feat/christmas-invitation`, branched from `origin/main`. The index row in `docs/changes/README.md` is still to be added: that index is not on `main` yet (it lives on `feat/strategic-goals-workflow-studio`).
- 2026-11-25: pushed and opened [PR #24](https://github.com/JohnSarwom/scpng-intranet-/pull/24) into `main`.
- 2026-11-25: SharePoint list created on production (Automation account). Fixed the clash with the staff announcement pop-up found during that live check (commit 33fb61e, pushed to PR #24).
- 2026-11-25: PR #24 squash-merged into `main` as 1a5dc79 (all checks passed). Vercel production deploy completed, and www.scpngintranet.com serves the new code (checked in the live bundle). Staff see the invitation on their next visit.
