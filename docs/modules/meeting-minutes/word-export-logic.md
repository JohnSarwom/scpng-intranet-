# Meeting Minutes — Word Export & PDF Export Logic

> **Created:** 2026-03-29
> **Updated:** 2026-03-29 — PDF export migrated to Word-template pipeline
> **Service File:** `src/services/meetingDocxService.ts`
> **Dependencies:** `docxtemplater`, `pizzip`, `docx-preview`, `html2canvas`, `jspdf`

---

## Overview

Both the Word export and PDF export share the same template pipeline. The docx blob is built once via `buildDocxBlob()` and consumed by either export path.

### Word Export Flow

```
Form Data (MeetingData)
    ↓
buildPayload()          — maps MeetingData → DocxPayload
    ↓
fetch(template.docx)    — loads the Word template from public/files/
    ↓
PizZip(arrayBuffer)     — unzips the .docx (which is a ZIP internally)
    ↓
Docxtemplater.render()  — fills all {tags} with payload values
    ↓
doc.getZip().generate() — re-zips back to a .docx blob
    ↓
URL.createObjectURL()   — browser download trigger (.docx)
```

### PDF Export Flow (Print Window Architecture)

```
buildDocxBlob(data)     — fills Word template in memory
    ↓
window.open()           — opens a new browser tab
    ↓
docx-preview.renderAsync()  — renders the .docx into the popup tab
    ↓
Inject Print CSS        — forces colors and hides toolbar
    ↓
win.print()             — auto-triggers browser print-to-PDF dialog
```

The PDF output reflects the **actual Word template formatting** (fonts, tables, headers, branding) with 100% fidelity.

---

## Dependencies

```bash
npm install docxtemplater pizzip docx-preview
```

| Package | Role |
|---|---|
| `pizzip` | Unzips / rezips the `.docx` file (Word files are ZIP archives internally) |
| `docxtemplater` | Parses XML inside the ZIP, finds `{tags}`, replaces with values |
| `docx-preview` | Renders a `.docx` blob into a DOM element as HTML (used for PDF capture) |
| `html2canvas` | Captures a DOM element to a canvas image (pre-existing dep) |
| `jspdf` | Converts canvas image into a multi-page A4 PDF (pre-existing dep) |

---

## Data Interface

```typescript
interface DocxPayload {
  // Flat string fields — Section A + F
  MEETING_NUMBER: string;
  MEETING_NAME: string;
  MEETING_DATE: string;
  START_TIME: string;
  END_TIME: string;
  FACILITATOR_NAME: string;
  VENUE: string;
  MINUTES_BY: string;
  MEETING_OBJECTIVE: string;
  MEETING_ORDER: string;
  CHAIRPERSON_NAME: string;
  MINUTE_RECORDER_NAME: string;

  // Dynamic arrays — Sections B, C, D, E
  attendance:     { name: string; position: string }[];
  discussion:     { index: number; title: string; points: string[] }[];
  actionItems:    { area: string; action: string }[];
  closingRemarks: { remark: string }[];
}
```

---

## buildPayload() Logic

### Filtering
All four array sections are **filtered before mapping** — entries where all fields are empty are excluded. This means:
- 3 attendees entered → 3 rows in the Word doc, no blank rows
- 2 discussion topics → 2 topic blocks, no empty numbered items

### Discussion Points
`MeetingData.discussion[].points` is a textarea string. It is parsed into a `string[]` by splitting on newlines and stripping bullet characters (`•`, `*`, `-`):

```typescript
const parseLines = (text: string): string[] =>
  text.split('\n')
    .map(l => l.replace(/^[•*\-]\s*/, '').trim())
    .filter(Boolean);
```

### Action Item Owner
The form has a separate `owner` field on action items. The service appends it inline to the `action` string:
```typescript
action: item.owner
  ? `${item.action.trim()} (${item.owner.trim()})`
  : item.action.trim()
```
This is because the Word template has a single `{action}` cell, not a separate owner column.

### Name Extraction for Sign-Off
`CHAIRPERSON_NAME` and `MINUTE_RECORDER_NAME` are auto-extracted from `FACILITATOR_NAME` and `MINUTES_BY` respectively, by splitting on ` – ` or ` - `:
```typescript
const extractName = (s: string): string => s.split(/\s*[–\-]\s*/)[0].trim();
```
Example: `"John Sarwom – Senior IT Officer"` → `"John Sarwom"`

---

## Docxtemplater Configuration

```typescript
const doc = new Docxtemplater(zip, {
  paragraphLoop: true,   // Required for table row loops to work correctly
  linebreaks: true,      // Converts \n in values to Word line breaks
});
```

`paragraphLoop: true` is critical — without it, table row loops either fail or produce duplicate rows.

---

## File Naming

Downloaded file name format:
```
Meeting_Minutes_{MeetingName}_{Date}.docx
```
Special characters are stripped from the meeting name before use in the filename.

---

## Entry Points

The service exports two functions, both called from `src/pages/MeetingMinutes.tsx`:

| Function | Called by | Output |
|---|---|---|
| `generateMeetingDocx` | "Export Word" button (toolbar + preview footer) | `.docx` download |
| `generateMeetingPdf` | "Export PDF" button (toolbar + preview footer) | `.pdf` download via Word template |

Both are wrapped in `handleDownloadDocx` / `handleDownloadPDF` handlers in the page, which apply toast loading/success/error states.

### PDF internal function: `generateMeetingPdf` (Print Window Architecture)

> **Note:** An earlier version used off-screen html2canvas capture. This was replaced after the logo failed to load in off-screen containers and coordinate drift caused blank space at the top. See ERR-007 through ERR-009 in `errors-and-fixes.md`.

```typescript
export const generateMeetingPdf = async (data: MeetingData): Promise<void> => {
  const blob = await buildDocxBlob(data);     // 1. Build docx from Word template

  const win = window.open('', '_blank', 'width=900,height=1100');
  // 2. Write initial HTML shell with print CSS + toolbar
  win.document.write(`...`);
  win.document.close();

  const { renderAsync } = await import('docx-preview');
  await renderAsync(blob, win.document.getElementById('doc-root'), win.document.head, {
    // styleContainer = win.document.head ensures CSS scoped to the popup window
    renderHeaders: true, renderFooters: true, useBase64URL: true, breakPages: true,
  });

  // 3. Inject print CSS AFTER renderAsync (must win cascade over docx-preview styles)
  const printStyle = win.document.createElement('style');
  printStyle.textContent = `
    * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
    @media print {
      #print-bar { display: none !important; }
      #doc-root  { margin-top: 0 !important; }
    }
    tr { break-inside: avoid !important; page-break-inside: avoid !important; }
  `;
  win.document.head.appendChild(printStyle);

  // 4. DOM fix: force last table (sign-off section) to not split across pages
  const tables = win.document.querySelectorAll('table');
  if (tables.length > 0) {
    const signOff = tables[tables.length - 1] as HTMLElement;
    signOff.style.breakInside = 'avoid';
  }

  // 5. Wait for images (logo) to load, then trigger print dialog
  await Promise.all(images.map(img => img.complete ? Promise.resolve() : ...));
  await new Promise(r => setTimeout(r, 400));
  win.print();
};
```

Key architectural decisions:
- **Real window** (not off-screen div) — images, fonts, and layout render natively; no html2canvas
- **`styleContainer = win.document.head`** — correct docx-preview API for rendering into a separate document
- **Post-renderAsync style injection** — `print-color-adjust: exact` and toolbar-hide rules must come after docx-preview's styles to win the cascade
- **`break-inside` not `page-break-inside`** — modern Chromium uses the CSS3 property; legacy property is silently ignored
- **DOM inline style on sign-off table** — CSS rules cannot reliably override docx-preview's table styles; inline `style` attribute wins
- **Dynamic import** (`import('docx-preview')`) — loads only when PDF export is triggered, keeps initial bundle lean
