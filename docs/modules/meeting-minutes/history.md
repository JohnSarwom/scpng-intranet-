# Meeting Minutes — Development History

> **Created:** 2026-03-29
> **Module:** Meeting Minutes Generator

Chronological log of all work done on this module.

---

## 2026-03-29 — Initial Build & Iteration

### Session Start: ~10:00 AM

**Context:**
User identified the need to replace manual Word document editing for meeting minutes with a structured in-browser tool. The SCPNG Meeting Minutes document has a strict branded format with yellow tables, gray section headers, SCPNG logo, and a specific multi-section structure.

---

### Phase 1 — Document Analysis (10:00–10:30)

User provided screenshots of the official SCPNG Meeting Minutes document (`SC-003/2025`). A detailed visual analysis was performed covering:

- Page dimensions: A4, ~15-20mm margins
- Header: SCPNG logo (centered), "SECURITIES COMMISSION" (bold black), "OF PAPUA NEW GUINEA" (gray, letter-spaced)
- "Meeting Minutes" label: bright red (`#CC0000`), bold
- Meeting ID bar: gray background (`#C0C0C0`), bold black text
- Overall body: single yellow-bordered outer container (`#FFC000`)
- Section headers (A–F): gray-background rows inside container
- Table borders throughout: `#FFC000` yellow (not gray)
- Label cells (Section A): `#FFC000` yellow background, bold
- Full yellow rows: Minutes By, Meeting Objective, Meeting Order
- Attendance header: darker amber (`#BF8F00`), white text
- Sign-off section: cream background (`#FFF2CC`), 2-column layout
- Font: sans-serif (Arial), NOT serif

---

### Phase 2 — HTML Preview Implementation (10:30–11:00)

**File created:** `src/components/meeting/MeetingPreview.tsx`

**First iteration issues:**
- Used `font-serif` — wrong
- "Meeting Minutes" label was `#83002A` (dark maroon) — wrong
- Section headers were plain `<h4>` tags — wrong
- Table borders used Tailwind `border-gray-400` — wrong
- No yellow outer container
- Some value cells incorrect background color
- Section C/D/E headings had `italic` style — wrong
- Attendance header used `#FFC000` instead of `#BF8F00`

**Full rewrite performed.** Key architectural change: switched from Tailwind classes to inline `React.CSSProperties` for pixel-precise color and layout control. All issues corrected per the visual analysis.

---

### Phase 3 — Word Template Strategy Decision (11:00–11:30)

**Decision point:** HTML-to-PDF via `html2canvas`/`jsPDF` was producing acceptable output but would always have limitations (no real pagination, fonts may differ). User observed that matching the Word document pixel-for-pixel in HTML/CSS was impractical.

**Decision:** Adopt `docxtemplater` + `pizzip` approach — fill the actual `.docx` template programmatically. This preserves all original Word formatting exactly.

**Template approach considered:**

Option A — Fixed numbered slots (`ATTENDEE_1` through `ATTENDEE_5`)
- Pro: Simple service code
- Con: Blank rows for unused slots, rigid — max 5 attendees, max 7 topics

Option B — Dynamic loops (`{#attendance}` ... `{/attendance}`)
- Pro: Exactly as many rows as data entered, no blanks, no artificial limits
- Con: Template must use loop syntax, slightly more complex service

**Decision: Option B (dynamic loops)** — user confirmed meetings vary significantly in size.

---

### Phase 4 — Package Installation (11:30)

```bash
npm install docxtemplater pizzip --legacy-peer-deps
```

Installed successfully.

---

### Phase 5 — Service Implementation v1 (Fixed Slots) (11:30–12:00)

**File created:** `src/services/meetingDocxService.ts`

First version used fixed-slot approach targeting `SCPNG_Meeting_Minutes_TEMPLATE.docx`. Payload builder mapped `ATTENDEE_1_NAME` through `ATTENDEE_5_NAME`, `DISCUSSION_TOPIC_1` through `DISCUSSION_TOPIC_7`, etc.

**"Export Word" button added** to `MeetingMinutes.tsx` — both in top toolbar and preview footer.

---

### Phase 6 — Template Strategy Upgraded to Dynamic (12:00–12:30)

User presented a new JSON schema for the dynamic template structure:

```json
{
  "attendance": [{ "{name}": "", "{position}": "" }],
  "discussion": [{ "{index}": 0, "{title}": "", "{points}": [""] }],
  "actionItems": [{ "{area}": "", "{action}": "" }],
  "closingRemarks": [{ "{remark}": "" }]
}
```

User also created `SCPNG_Meeting_Minutes_DYNAMIC.docx` with loop tags.

**Service rewritten** to:
- Target new `SCPNG_Meeting_Minutes_DYNAMIC.docx`
- Pass filtered arrays (empty entries excluded)
- Parse discussion points textarea into `string[]`
- Append action item owner inline to action text
- Auto-extract first name portion for sign-off fields

---

### Phase 7 — Template Verification (12:30–13:00)

User provided zoomed screenshots of the Word template for verification. Identified issues:

1. **Section C bullet** — `{. }` had trailing space after dot → should be `{.}`
2. **Section D** — `{#actionItems}` was on separate line from `{area}` → merged to same line
3. **Flat fields** — appeared to use `{{double braces}}` which would conflict with docxtemplater
4. **`{{START_TIME}}`** — appeared to have space `{{START  TIME}}` → confirmed underscore after zoom

User fixed items 1 and 2 in Word. Item 3 confirmed after zoom — all were correctly `{{double}}` which led to next phase.

---

### Phase 8 — Critical Error: Duplicate Tag (13:00–13:30)

**First test of Export Word button:**

```
TemplateError: Duplicate open tag, expected one open tag
xtag: "{{MEET"
explanation: "The tag beginning with \"{{MEET\" has duplicate open tags"
```

**Root cause diagnosed:** `{{double braces}}` are parsed by docxtemplater as two consecutive open-tag delimiters. docxtemplater uses single braces by default.

**Fix:** All flat field placeholders in Word template changed from `{{TAG}}` to `{TAG}`. Loop tags were already single-brace and correct.

Full error analysis documented in [errors-and-fixes.md](./errors-and-fixes.md).

---

### Phase 9 — Documentation (End of Session)

This documentation set created:

| File | Content |
|---|---|
| `overview.md` | Module purpose, design decisions, file map, navigation |
| `template-structure.md` | All placeholders, loop syntax, field descriptions |
| `word-export-logic.md` | Service architecture, data flow, payload builder logic |
| `html-preview.md` | Preview component design, color palette, PDF export notes |
| `errors-and-fixes.md` | All 6 errors with root cause and fix |
| `history.md` | This file — chronological development log |

History entry added to `docs/history/MEETING_MINUTES_MODULE_2026_03_29.md`.
README updated to include Meeting Minutes module link.

---

## Status at End of Session 1: 2026-03-29

| Component | Status |
|---|---|
| HTML preview (`MeetingPreview.tsx`) | Complete — accurate SCPNG branding |
| Form (`MeetingMinutesForm.tsx`) | Complete — 5 tabs, auto-save, draft recovery |
| Word export service (`meetingDocxService.ts`) | Complete — dynamic arrays, filtered output |
| Word template (`SCPNG_Meeting_Minutes_DYNAMIC.docx`) | Complete — loop tags, single-brace delimiters |
| PDF export | Complete — html2canvas + jsPDF on HTML preview |
| Navigation & routing | Complete — `/meeting-minutes`, all authenticated users |
| End-to-end test | Pending — template brace fix applied at end of session |

---

## 2026-03-29 — Session 2: PDF Pipeline Overhaul & Template Fixes

---

### Phase 10 — PDF Export Migrated to Word Template (Session 2 Start)

**Decision:** User requested PDF export use the Word template instead of the HTML preview. The HTML preview is styled with Tailwind dark-mode CSS — not appropriate for an official document PDF.

**First approach — off-screen docx-preview + html2canvas:**

```
buildDocxBlob() → docx-preview.renderAsync() [off-screen div] → html2canvas → jsPDF
```

New dependency installed:
```bash
npm install docx-preview  # v0.3.7
```

`buildDocxBlob()` extracted as a shared helper used by both Word and PDF export paths. `generateMeetingPdf()` added to `meetingDocxService.ts`. `html2canvas`/`jsPDF` imports removed from `MeetingMinutes.tsx` and moved to service.

---

### Phase 11 — Off-Screen Capture Failures (ERR-007 precursor)

**First test results:**
- SCPNG logo missing from PDF
- Large blank space at top of page 1
- Content layout shifted

**Diagnosed causes:**
1. `position:fixed` on hidden container caused html2canvas coordinate drift
2. Off-screen elements don't trigger `<img>` load events in Chromium — logo never loaded
3. docx-preview's A4-height page wrappers created blank space at top

**Attempted fixes (did not fully resolve):**
- Changed `position:fixed` → `position:absolute`
- Added `ignoreHeight: true` + `breakPages: false` to docx-preview options to remove page-height constraints
- Added `Promise.all` image loading wait before canvas capture
- Added `scrollX: 0, scrollY: 0` to html2canvas options

All attempts failed to reliably capture the logo. Root cause: off-screen elements in Chromium do not fully render external images regardless of position type.

---

### Phase 12 — Switched to Print Window Architecture

**Decision:** Abandoned off-screen html2canvas approach entirely. Switched to browser print window which renders natively — images, fonts, and layout all work correctly in a real window context.

**New flow:**
1. `window.open()` opens a new tab
2. `docx-preview.renderAsync()` renders the filled docx into that tab
3. A dark toolbar with "Save as PDF" button injected (hidden in print)
4. `win.print()` auto-triggers after images load and a 400ms settle delay
5. User selects "Save as PDF" in browser print dialog → automatic download

**Files changed:**
- `src/services/meetingDocxService.ts` — `generateMeetingPdf()` rewritten as print window; removed `html2canvas`/`jsPDF` imports
- `src/pages/MeetingMinutes.tsx` — toast updated to "Print window opened — select Save as PDF"

---

### Phase 13 — Print Toolbar Bleeding into Preview (ERR-007)

**Symptom:** The dark "Save as PDF" toolbar appeared in the print preview and would have been included in the saved PDF.

**Root cause:** Print-hide CSS written before `renderAsync` was overridden by docx-preview's injected stylesheets.

**Fix:** Inject a new `<style>` tag into `win.document.head` **after** `renderAsync` completes — guaranteed last in cascade.

---

### Phase 14 — Colors Stripped in Print (ERR-008)

**Symptom:** Yellow tables, orange headers, red text all rendered as greyscale/white in print preview.

**Root cause:** Chromium's default print behaviour suppresses background colors.

**Fix:** Added to both pre- and post-renderAsync style blocks:
```css
* {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
}
```

---

### Phase 15 — Sign-Off Table Split Across Pages (ERR-009)

**Symptom:** "Minute Recorder:" header stranded at bottom of page 1; Chairperson/Minute Recorder body content on page 2.

**Root cause:** CSS `page-break-inside: avoid` is a legacy property ignored by modern Chromium. Must use `break-inside: avoid`. Additionally CSS couldn't override docx-preview's table styles — needed DOM-level inline style.

**Fix:**
```typescript
// CSS: both legacy and modern
tr { page-break-inside: avoid !important; break-inside: avoid !important; }

// DOM: target last table (sign-off section) directly
const allTables = win.document.querySelectorAll('table');
const signOff = allTables[allTables.length - 1] as HTMLElement;
signOff.style.breakInside = 'avoid';
```

---

### Phase 16 — Discussion Points Concatenating (ERR-010)

**Symptom:** Multiple discussion points appeared merged on one bullet: `qweqweqwe2. qwewqe`

**Root cause:** Word template had `{#points}{.}{/points}` all on **one bullet paragraph**. `paragraphLoop: true` requires each loop tag on its own separate paragraph to trigger paragraph-level repetition. With all three inline, docxtemplater concatenated values as strings.

**Fix — Word template restructured:**

Before:
```
• {#points}{.}{/points}
• {/discussion}
```

After:
```
{#points}          ← plain paragraph (removed by paragraphLoop)
• {.}              ← bullet that repeats
{/points}          ← plain paragraph (removed by paragraphLoop)
{/discussion}      ← plain paragraph (removed by paragraphLoop)
```

---

### Phase 17 — `{/discussion}` Soft Return Bug (ERR-011)

**Symptom:** After ERR-010 fix, discussion topic headings had incorrect indentation in output.

**Root cause:** `{/discussion}` had a soft return (`←`, Shift+Enter) appended — NOT a paragraph mark (`¶`, Enter). With a soft return, `{/discussion}` was NOT on its own paragraph in docxtemplater's view, breaking the outer loop boundary.

**Diagnosed via:** Word's Show Formatting Marks (¶) mode — visible difference between `←` and `¶`.

**Fix:** Deleted the soft return, pressed Enter to create a proper `¶`.

**Confirmed final template structure:**
```
{#discussion}{index}.·{title}¶     ← outer loop start
      {#points}¶
   •  →  {.}¶
      {/points}¶
      {/discussion}¶               ← outer loop end (proper ¶ confirmed)
¶                                  ← single empty paragraph outside loop
```

---

## Status at End of Session 2: 2026-03-29

| Component | Status |
|---|---|
| HTML preview (`MeetingPreview.tsx`) | Complete |
| Form (`MeetingMinutesForm.tsx`) | Complete |
| Word export (`generateMeetingDocx`) | Complete |
| PDF export (`generateMeetingPdf`) | Complete — print window, full fidelity, colors preserved |
| Word template loop structure | Fixed — points loop 3-paragraph structure, soft return resolved |
| Page break handling | Fixed — `break-inside: avoid` + DOM inline style on sign-off table |
| Navigation & routing | Complete |
| End-to-end test | Confirmed working — logo renders, colors print, layout correct |
