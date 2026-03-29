# Meeting Minutes Module — Overview

> **Created:** 2026-03-29
> **Last Updated:** 2026-03-29
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

---

## Module File Map

```
src/
├── pages/
│   └── MeetingMinutes.tsx          # Page shell, sticky header with Export actions
├── components/meeting/
│   └── MeetingMinutesForm.tsx      # Vertical scrolling form with sticky sidebar nav
├── services/
│   └── meetingDocxService.ts       # Docxtemplater payload builder + download trigger
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
