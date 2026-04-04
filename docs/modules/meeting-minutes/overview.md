# Meeting Minutes Module — Overview

> **Created:** 2026-03-29
> **Last Updated:** 2026-04-04
> **Author:** John Sarwom (Senior IT Officer)
> **Status:** Active / Production Ready

---

## Purpose

The Meeting Minutes module provides SCPNG staff with a high-fidelity, single-view vertical form to:

1. **Structured Data Entry**: Fill a rebranded, glassmorphic vertical form with section-based sticky navigation.
2. **Direct Export**: Generate official **Word (.docx)** and **PDF** documents directly from the form view via a fixed top action bar.
3. **Consistency**: Guarantee that all meeting records match the official SCPNG reporting standards and branding.

The module eliminates the multi-stage "wizard" flow in favor of a fast, "Form-at-a-glance" experience with "Dark Luxury" aesthetics.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Vertical Form Layout** | Replaces tabs to allow users to see all data at once, improving referencing and speed. |
| **Sticky Navigation Sidebar** | Provides a "Table of Contents" that stays with the user as they scroll, showing section completion counts. |
| **Action Bar Fixed on Top** | Export buttons (Word/PDF) are always accessible regardless of scroll position. |
| **Dark Luxury Rebrand** | Uses SCPNG Maroon (`#83002A`), `backdrop-blur-xl`, and high-contrast glassmorphism to align with the intranet's premium UI. |
| `docxtemplater` + `pizzip` | Client-side Word generation that preserves complex templating and loop logic. |
| **PDF via Print Pipeline** | Uses the browser's native print engine for pixel-perfect PDF conversion of the rendered Word template. |
| **Auto-save to `localStorage`** | Prevents data loss during long meeting sessions. |
| **SharePoint History** | Saved meetings fetched from `Meeting_Minutes_Registry` on mount, filtered by `createdBy.user.email` (built-in SP field — no extra column needed). |
| **Unit-Based Meeting ID** | Sequential IDs generated from the logged-in user's unit (e.g. `SCPNGMIDIT001`). Sequence derived by scanning all existing `MeetingID` values in SP. |
| **`MeetingDataJSON` column** | Full form data serialized to SP for complete restoration when loading from history. |
| **Themed Confirm Dialogs** | All `window.confirm` / `window.alert` calls replaced with Shadcn `AlertDialog` to maintain app theme consistency. |
| **Live Progress Bar** | 7-checkpoint formula drives the sidebar progress bar in real time as fields are filled. |
| **Module Summary in Header** | Attendees / Topics / Directives counts moved to the sticky header so they're always visible. |
| **Multi-select Action Item Owners** | `owner: string` replaced with `owners: string[]` — uses `GlobalAssigneeSelector` in `multiple` mode. |
| **History Delete on Hover** | Trash icon revealed on hover per history entry, with confirm dialog before removal. |

---

## Module File Map

```
src/
├── pages/
│   └── MeetingMinutes.tsx          # Page shell, sticky header, SP history fetch, ID generation
├── components/meeting/
│   ├── MeetingMinutesForm.tsx      # Vertical form, sidebar nav, live progress bar, history panel
│   └── ShareMeetingModal.tsx       # Collaborative sharing flow (upload, register, email)
├── services/
│   ├── meetingDocxService.ts       # Docxtemplater payload builder + download trigger
│   ├── meetingShareService.ts      # Graph API: upload draft, register metadata, send notifications
│   └── sharePointListSetupService.ts  # List schema incl. MeetingDataJSON + MeetingID columns
├── components/common/
│   └── GlobalAssigneeSelector.tsx  # Reusable staff picker (single/multiple mode)
│
├── components/meeting/             # [DEPRECATED]
│   └── MeetingPreview.tsx          # (Removed in March 2026 Overhaul)
```

---

## Related Docs

- [Template Structure](./template-structure.md) — placeholder map, loop syntax, field descriptions
- [Word Export Logic](./word-export-logic.md) — service architecture, payload builder, single-view flow
- [HTML Preview](./html-preview.md) — **(DISCONTINUED)** Previous HTML-based preview component notes
- [Errors & Fixes](./errors-and-fixes.md) — full error log with root causes and resolutions
- [History Log](./history.md) — chronological development timeline
