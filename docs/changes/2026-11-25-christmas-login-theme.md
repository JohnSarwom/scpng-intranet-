# Christmas sign-in page: festive backdrop and interactive snow

| | |
|---|---|
| **Date** | 2026-11-25 |
| **Status** | In review |
| **Programme step** | None |
| **Branch / PR / commits** | `feat/christmas-login-theme` (from `origin/main` at 232f8d9) |
| **Decisions used** | None |

## Why

The owner asked for the intranet's sign-in page to match the Christmas look of the new invitation: a supplied Christmas backdrop behind the sign-in card, and snow in the background that reacts to the mouse. The owner supplied sample code for the snow.

## What changed for users

- Until 5 January 2027, the sign-in page shows a Christmas backdrop (pine branches, ornaments, ribbons and a gift on deep maroon) behind the existing sign-in card. The card gets rounder corners and a deeper shadow.
- Soft white snow falls across the backdrop, behind the card. Snow near the mouse, or near a finger on touch screens, is pushed away from it.
- People who have reduced motion turned on in their device settings see the backdrop without falling snow.
- After 5 January 2027 the page returns to its usual plain maroon by itself.
- On phones the wide backdrop is cropped to its centre, so mostly the maroon middle shows, with a little greenery in a corner.

## Technical changes

| Area | Change |
|---|---|
| `src/modules/christmas-event/ChristmasSnowfall.tsx` | New canvas snow component, adapted to TypeScript from the owner's sample. Snow can repel, attract or swirl around the pointer (this page uses repel). It is frame-rate independent, sharp on high-density screens (capped at 2x), takes no clicks, and draws nothing under reduced motion. |
| `src/modules/christmas-event/assets/login-backdrop.webp` | The supplied backdrop (1672 x 941), unchanged apart from WebP compression. |
| `src/modules/christmas-event/config.ts` | New settings `loginTheme` (on/off) and `loginThemeUntil` ('2027-01-05'). New helpers `isOnOrBefore` and `isChristmasLoginThemeOn`. |
| `src/modules/christmas-event/config.test.ts` | Tests that the decorations run through the last day and stop the day after. |
| `src/pages/Login.tsx` | While the theme is on: the backdrop behind the page, the snow canvas (`z-index` 1) behind the card (`z-index` 10), and a deeper card shadow. Otherwise unchanged. |

## Data and SharePoint changes

None.

## How it was checked

- `tsc --noEmit -p tsconfig.app.json`: no errors in the changed files.
- `vitest run src/modules/christmas-event`: 8 of 8 tests passed (3 new).
- Branch dev server (port 8081), sign-in page:
  - It looks like the owner's mockup, with snow falling.
  - **Pointer test:** with the pointer held still, the snow within 50 px of it dropped from 1,539 drawn pixels to 0 (sampled 12 times each).
- Headless Chrome (GPU):
  - 60 fps at 1920 x 1080, and 61 fps at 390 x 844 with no page errors.
  - With reduced motion: no snow drawn, backdrop still shown.
- **Not checked:** the signed-in redirect flow from this page (unchanged code), Firefox and Safari, and slower office PCs.

## Follow-ups and open items

- The index row in `docs/changes/README.md` is still to be added on `main`; that index is not on `main` yet (it is on `feat/strategic-goals-workflow-studio`).
- Optional: a portrait crop of the backdrop for phones.

## How to undo it

- Set `loginTheme: false` in `src/modules/christmas-event/config.ts` and redeploy, or revert this change's commit.

## History

- 2026-11-25: record created.
- 2026-11-25: committed and pushed for review.
