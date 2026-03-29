# Meeting Minutes — Errors & Fixes Log

> **Created:** 2026-03-29
> **Last Updated:** 2026-03-29

All errors encountered during development of the Meeting Minutes module, with root cause analysis and resolutions.

---

## ERR-001 — Duplicate Open/Close Tag Error

**Date:** 2026-03-29
**Severity:** Critical — blocked all Word export
**Error Message:**
```
TemplateError: Duplicate open tag, expected one open tag
  xtag: "{{MEET"
  explanation: "The tag beginning with \"{{MEET\" has duplicate open tags"

TemplateError: Duplicate close tag, expected one close tag
  xtag: "MBER}}"
  explanation: "The tag ending with \"MBER}}\" has duplicate close tags"
```

**Root Cause:**
The Word template was built using `{{double braces}}` (e.g. `{{MEETING_NUMBER}}`). docxtemplater uses `{single braces}` as its default delimiter. When it encountered `{{MEETING_NUMBER}}`, it parsed it as:
- First `{` = open tag delimiter
- Second `{` = another open tag delimiter → error: duplicate open tag

The loop tags in the template were already correctly using single braces (`{#attendance}`, `{name}`) — only the flat Section A and F fields were double-braced.

**Fix:**
Opened `SCPNG_Meeting_Minutes_DYNAMIC.docx` in Word and changed all flat field placeholders from `{{double}}` to `{single}`:

| Before | After |
|---|---|
| `{{MEETING_NUMBER}}` | `{MEETING_NUMBER}` |
| `{{MEETING_NAME}}` | `{MEETING_NAME}` |
| `{{MEETING_DATE}}` | `{MEETING_DATE}` |
| `{{START_TIME}}` | `{START_TIME}` |
| `{{END_TIME}}` | `{END_TIME}` |
| `{{FACILITATOR_NAME}}` | `{FACILITATOR_NAME}` |
| `{{VENUE}}` | `{VENUE}` |
| `{{MINUTES_BY}}` | `{MINUTES_BY}` |
| `{{MEETING_OBJECTIVE}}` | `{MEETING_OBJECTIVE}` |
| `{{MEETING_ORDER}}` | `{MEETING_ORDER}` |
| `{{CHAIRPERSON_NAME}}` | `{CHAIRPERSON_NAME}` |
| `{{MINUTE_RECORDER_NAME}}` | `{MINUTE_RECORDER_NAME}` |

Loop tags (`{#attendance}`, `{name}`, etc.) were NOT changed — they were already correct.

---

## ERR-002 — Invisible Placeholder Text in Word Template

**Date:** 2026-03-29
**Severity:** Medium — blocked template authoring
**Symptom:** When typing `{{START_TIME}}` or `{{MINUTES_BY}}` into yellow-background cells in Word, the text appeared invisible (not rendering).

**Root Cause:**
Word was auto-applying the existing paragraph/character style of the cell, which had a **yellow or white font color** — invisible against the `#FFC000` yellow cell background.

**Fix:**
Two options identified:
1. Select the typed text → Home → Font Color → set to **Automatic** or **Black**
2. Copy an existing visible placeholder from another yellow cell (which already has correct font color) and edit just the variable name — color formatting carries over with the copy

Option 2 (copy-paste) was faster in practice.

---

## ERR-003 — Fixed-Slot Template Leaves Blank Rows

**Date:** 2026-03-29
**Severity:** Medium — functional but produces unprofessional output
**Symptom:** When using `SCPNG_Meeting_Minutes_TEMPLATE.docx` (the original fixed-slot template), meetings with fewer than 5 attendees or fewer than 7 discussion topics produced blank rows in the output document.

**Root Cause:**
The original template used numbered fixed slots:
- `ATTENDEE_1_NAME` through `ATTENDEE_5_NAME`
- `DISCUSSION_TOPIC_1_TITLE` through `DISCUSSION_TOPIC_7_TITLE`
- `ACTION_AREA_1` through `ACTION_AREA_9`

Unused slots were replaced with empty strings, leaving empty table rows.

**Fix:**
Built a new template `SCPNG_Meeting_Minutes_DYNAMIC.docx` using docxtemplater loop syntax:
- `{#attendance}` / `{/attendance}` instead of 5 fixed rows
- `{#discussion}` / `{/discussion}` instead of 7 fixed topic blocks
- `{#actionItems}` / `{/actionItems}` instead of 9 fixed action rows
- `{#closingRemarks}` / `{/closingRemarks}` instead of 3 fixed remark lines

The service was updated to pass filtered arrays (empty entries excluded) rather than fixed-length padded arrays. Output now contains exactly as many rows as data entered.

The original template is retained at `public/files/SCPNG_Meeting_Minutes_TEMPLATE.docx` as a backup.

---

## ERR-004 — HTML Preview Font and Color Inaccuracies

**Date:** 2026-03-29
**Severity:** Low — cosmetic, did not affect export
**Symptom:** The HTML preview (`MeetingPreview.tsx`) did not accurately match the original Word document in several areas.

**Root Cause:** Initial implementation made several incorrect styling assumptions.

**Specific Discrepancies Identified:**

| Element | Initial (Wrong) | Correct |
|---|---|---|
| Font family | `font-serif` | `Arial, Helvetica, sans-serif` |
| "Meeting Minutes" label color | `#83002A` (dark maroon) | `#CC0000` (bright red) |
| Section headers (A, B, C…) | Plain `<h4>` tags | Gray-background `<div>` rows (`#C0C0C0`) inside yellow outer container |
| Table borders | `border-gray-400` | `#FFC000` yellow |
| "Minutes By", "Objective", "Order" value cells | White background | `#FFC000` yellow (full row yellow) |
| Attendance header | `#FFC000` + white text | `#BF8F00` (darker amber) + white text |
| Action item column headers | `text-center` | Left-aligned |
| Section C/D/E headings | `italic` | Not italic |
| Overall structure | No outer container | Single yellow-bordered container wrapping all sections A–F |

**Fix:**
Full rewrite of `MeetingPreview.tsx` using inline styles (not Tailwind) for precise pixel control. All colors, borders, and structural elements corrected against the original Word document used as reference.

---

## ERR-005 — `{. }` Trailing Space in Discussion Points Bullet

**Date:** 2026-03-29
**Severity:** High — would cause points loop to fail or render literally
**Symptom:** Template inspection showed the inner points loop bullet as `{#points}{. }{/points}` with a trailing space after the dot.

**Root Cause:**
When typing `{.}` in Word, autocorrect or accidental keystroke introduced a trailing space: `{. }`. docxtemplater's current item accessor is strictly `{.}` — any whitespace inside the braces causes it to not be recognized as the current-item tag and render literally.

**Fix:**
Opened the template in Word, clicked into the bullet paragraph, and manually retyped `{#points}{.}{/points}` — deleted and retyped rather than editing, to ensure no hidden characters. Confirmed clean via close zoom inspection in Word.

---

## ERR-006 — `{#actionItems}` on Separate Line from `{area}`

**Date:** 2026-03-29
**Severity:** Medium — potential paragraph loop misinterpretation
**Symptom:** Initial template version had `{#actionItems}` on its own paragraph line, then `{area}` on the next line within the same cell.

**Root Cause:**
With `paragraphLoop: true` enabled, docxtemplater resolves loop boundaries at the paragraph level. If the open tag `{#actionItems}` is on its own paragraph, it may loop at the paragraph level rather than the table row level, breaking the two-column row structure.

**Fix:**
In Word, merged `{#actionItems}` and `{area}` onto the same line in the left cell: `{#actionItems}{area}`. The close tag `{action}{/actionItems}` was already correctly placed in the right cell on the same row.

---

---

## CHANGE-001 — PDF Export Migrated to Word Template Pipeline

> **Date:** 2026-03-29
> **Type:** Feature Change (not an error fix)

### Background

The original PDF export captured the React HTML preview component (`id="meeting-minutes-document"`) using `html2canvas` + `jsPDF`. The preview is styled with Tailwind dark-mode CSS — not appropriate for an official document PDF.

### Change

PDF export now uses the same Word template pipeline as the `.docx` export:

1. `buildDocxBlob()` generates the filled `.docx` in memory (same as Word export)
2. `docx-preview.renderAsync()` renders the docx into a hidden `794px`-wide off-screen container
3. `html2canvas` captures the rendered container
4. `jsPDF` slices the canvas across A4 pages

### Result

PDF output now reflects the Word template's formatting — official fonts, SCPNG header, branded tables — not the dark-themed UI preview.

### New dependency

```bash
npm install docx-preview  # v0.3.7
```

### Files changed

- `src/services/meetingDocxService.ts` — added `buildDocxBlob()` helper, `generateMeetingPdf()`, `safePdfName()` helper; added `html2canvas` and `jsPDF` imports
- `src/pages/MeetingMinutes.tsx` — `handleDownloadPDF` now calls `generateMeetingPdf()`; removed inline `html2canvas`/`jsPDF` import

---

---

## CHANGE-002 — PDF Export Switched to Print Window (docx-preview)

> **Date:** 2026-03-29 (Session 2)
> **Type:** Architecture change — replaced off-screen html2canvas capture with browser print dialog

### Problem with CHANGE-001 approach

The initial pdf-via-docx-preview approach rendered the docx into a hidden `position:absolute; left:-9999px` container, then used `html2canvas` to capture it. Three issues surfaced:

| Issue | Root Cause |
|---|---|
| SCPNG logo missing | Off-screen elements don't trigger image loads in all Chromium builds |
| Large blank space at top | docx-preview's page wrappers add A4-height padding; `position:fixed` caused coordinate drift in html2canvas |
| Colors stripped in print preview | Browser default print behaviour strips `background-color` unless `print-color-adjust: exact` is set |

### Fix

Replaced off-screen capture entirely with a **print window approach**:

1. `generateMeetingPdf()` opens a new browser tab (`window.open`)
2. `docx-preview.renderAsync()` renders the filled docx into that tab's document — images and fonts load natively in a real window context
3. A dark toolbar with a "Save as PDF" button is injected (hidden in print via CSS)
4. Print CSS is injected **after** `renderAsync` completes so it wins the cascade
5. `win.print()` auto-triggers the browser print dialog — user selects "Save as PDF"

### Why print CSS must be injected after renderAsync

`docx-preview` appends its own stylesheets to `document.head`. Any `@media print` rules written before `renderAsync` get overridden. Injecting a new `<style>` tag after `renderAsync` completes ensures our hide rules are last in the cascade.

### Files changed

- `src/services/meetingDocxService.ts` — `generateMeetingPdf()` fully rewritten; removed `html2canvas`/`jsPDF` imports from service
- `src/pages/MeetingMinutes.tsx` — toast message updated to guide user through print dialog

---

## ERR-007 — Print Toolbar Visible in Print Preview

> **Date:** 2026-03-29 (Session 2)
> **Severity:** Medium — cosmetic but the toolbar text printed into the PDF

**Symptom:** The dark "Save as PDF" toolbar bar appeared in the browser's print preview and was included in the saved PDF.

**Root Cause:** The `@media print { #print-bar { display: none } }` rule was written in the initial `document.write()` call. When `docx-preview.renderAsync()` injected its own stylesheets into `document.head` afterward, they reset cascade priority, leaving the print-hide rule ineffective.

**Fix:** After `renderAsync` completes, append a new `<style>` element to `win.document.head`:

```typescript
const printStyle = win.document.createElement('style');
printStyle.textContent = `
  @media print {
    #print-bar { display: none !important; visibility: hidden !important; height: 0 !important; }
    #doc-root  { margin-top: 0 !important; }
  }
`;
win.document.head.appendChild(printStyle);
```

Being appended last, this style always wins regardless of what docx-preview injected.

---

## ERR-008 — Colors Stripped in Print Preview

> **Date:** 2026-03-29 (Session 2)
> **Severity:** High — yellow tables, orange headers, red text all became greyscale/white

**Symptom:** In the print preview, all yellow table backgrounds, orange header rows, and colored text were stripped to white/greyscale.

**Root Cause:** Chromium-based browsers (Edge, Chrome) suppress `background-color` and `color` in print output by default to save ink. This is the browser's native print behaviour.

**Fix:** Add `print-color-adjust: exact` to force full-fidelity color printing:

```css
* {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
}
```

Applied in both the initial `document.write()` style block and the post-renderAsync injected `<style>` tag to ensure coverage before and after docx-preview's styles.

---

## ERR-009 — Sign-Off Section Split Across Pages

> **Date:** 2026-03-29 (Session 2)
> **Severity:** Medium — sign-off table header ("Minute Recorder:") stranded at bottom of page 1, content on page 2

**Symptom:** In the print preview, the Chairperson/Minute Recorder sign-off table was split at the page boundary. The column headers appeared at the very bottom of page 1 and the body (Name, Sign, Date rows) appeared on page 2.

**Root Cause:** Chromium's print engine uses the modern `break-inside` CSS property, not the legacy `page-break-inside`. The CSS rule `tr { page-break-inside: avoid }` was ignored. Additionally, CSS rules were not overriding docx-preview's inline styles on the table element.

**Fix — two-pronged:**

1. Updated CSS to use both legacy and modern properties:
```css
tr {
  page-break-inside: avoid !important;
  break-inside: avoid !important;
}
```

2. DOM-level inline style on the last table (sign-off section) after rendering, which overrides everything:
```typescript
const allTables = win.document.querySelectorAll('table');
if (allTables.length > 0) {
  const signOff = allTables[allTables.length - 1] as HTMLElement;
  signOff.style.pageBreakInside = 'avoid';
  signOff.style.breakInside = 'avoid';
}
```

The last table in the document is reliably the sign-off section.

---

## ERR-010 — Discussion Points Concatenating on Same Bullet Line

> **Date:** 2026-03-29 (Session 2)
> **Severity:** High — all points for a discussion topic merged onto one bullet line

**Symptom:** Multiple discussion points entered for one topic appeared as a single merged bullet (e.g., `qweqweqwe2. qwewqe`) instead of separate bullet lines.

**Root Cause:** In the Word template, the inner points loop was structured as:

```
• {#points}{.}{/points}
```

All three tags — open, content, close — were on the **same bullet paragraph**. With `paragraphLoop: true`, docxtemplater needs the open and close tags each on their **own separate paragraphs** to repeat the content paragraph per item. With all three on one paragraph, docxtemplater performed inline string concatenation instead of paragraph repetition.

**Fix — Word template restructured to 3 separate paragraphs:**

```
{#points}          ← own paragraph, no bullet (removed by paragraphLoop)
• {.}              ← bullet paragraph — this is what repeats
{/points}          ← own paragraph, no bullet (removed by paragraphLoop)
```

Template file saved and replaced in `public/files/SCPNG_Meeting_Minutes_DYNAMIC.docx`.

---

## ERR-011 — `{/discussion}` Had Soft Return Instead of Paragraph Mark

> **Date:** 2026-03-29 (Session 2)
> **Severity:** High — outer discussion loop not properly closed at paragraph level

**Symptom:** After fixing ERR-010, the discussion topics' numbered headings appeared indented or at wrong indentation level in output. Inspecting with Word's Show Formatting Marks (¶) revealed the issue.

**Root Cause:** The `{/discussion}` tag had a **soft return** (`←`, Shift+Enter) appended instead of a hard paragraph mark (`¶`, Enter). With a soft return, `{/discussion}` and the empty line below it were on the **same paragraph** — meaning `{/discussion}` was NOT recognised as a standalone paragraph by `paragraphLoop`, breaking the outer discussion loop boundary.

**Fix:** In Word:
1. Click at end of `{/discussion}` line
2. Delete the `←` (soft return)
3. Press **Enter** to create a proper `¶` paragraph mark

Confirmed correct final template structure (with Show Formatting Marks on):
```
{#discussion}{index}.·{title}¶     ← outer loop start, left margin
      {#points}¶                   ← inner loop start
   •  →  {.}¶                      ← repeating bullet
      {/points}¶                   ← inner loop end
      {/discussion}¶               ← outer loop end
¶                                  ← single empty paragraph (outside loop, spacing only)
```

---

## Notes on Word Template Editing

- Always use **Show Formatting Marks** (Ctrl+Shift+8) in Word when editing templates — hidden paragraph marks can break loop boundaries
- `←` (soft return / Shift+Enter) is NOT the same as `¶` (paragraph mark / Enter) — docxtemplater's `paragraphLoop` only recognises hard paragraph marks as paragraph boundaries
- After any template edit, **save as the same filename** and hard-refresh the browser before testing (the template is served from `public/files/` and may be cached)
- When a tag renders literally in the output (shows `{tagname}` text), the tag was not recognized — check for: extra spaces, wrong braces, wrong case, autocorrect interference
- For `paragraphLoop: true` to repeat a paragraph per array item: open tag, content, and close tag must each be on **separate paragraphs** — not all on one line
- CSS `page-break-inside` is legacy — Chromium uses `break-inside`. Always specify both when targeting print layout
