import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { MeetingData } from '@/components/meeting/MeetingMinutesForm';

const TEMPLATE_PATH = '/files/SCPNG_Meeting_Minutes_DYNAMIC.docx';

const parseLines = (text: string): string[] =>
  text
    .split('\n')
    .map(l => l.replace(/^[•*\-]\s*/, '').trim())
    .filter(Boolean);

const extractName = (s: string): string => s.split(/\s*[–\-]\s*/)[0].trim();

interface DocxPayload {
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
  attendance: { name: string; position: string }[];
  discussion: { index: number; title: string; points: string[] }[];
  actionItems: { area: string; action: string }[];
  closingRemarks: { remark: string }[];
}

const buildPayload = (data: MeetingData): DocxPayload => {
  const p = data.particulars;

  const attendance = data.attendance
    .filter(a => a.name.trim())
    .map(a => ({ name: a.name.trim(), position: a.position.trim() }));

  const discussion = data.discussion
    .filter(d => d.topic.trim())
    .map((d, i) => ({
      index: i + 1,
      title: d.topic.trim(),
      points: d.points ? parseLines(d.points) : [],
    }));

  const actionItems = data.actionItems
    .filter(a => a.area.trim() || a.action.trim())
    .map(a => ({
      area: a.area.trim(),
      action: a.owner
        ? `${a.action.trim()} (${a.owner.trim()})`
        : a.action.trim(),
    }));

  const closingRemarks = data.remarks
    ? parseLines(data.remarks).map(r => ({ remark: r }))
    : [];

  return {
    MEETING_NUMBER: p.meetingId || 'SC-MTG-DRAFT',
    MEETING_NAME: p.name || '',
    MEETING_DATE: p.date || '',
    START_TIME: p.startTime || '',
    END_TIME: p.endTime || '',
    FACILITATOR_NAME: p.facilitator || '',
    VENUE: p.venue || '',
    MINUTES_BY: p.minutesBy || '',
    MEETING_OBJECTIVE: p.objective || '',
    MEETING_ORDER: p.order || '',
    CHAIRPERSON_NAME: extractName(p.facilitator || ''),
    MINUTE_RECORDER_NAME: extractName(p.minutesBy || ''),
    attendance,
    discussion,
    actionItems,
    closingRemarks,
  };
};

export const buildDocxBlob = async (data: MeetingData): Promise<Blob> => {
  const response = await fetch(TEMPLATE_PATH);
  if (!response.ok) {
    throw new Error(`Failed to fetch template: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();

  const zip = new PizZip(arrayBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render(buildPayload(data));

  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
};

const safePdfName = (data: MeetingData) =>
  (data.particulars.name || 'Draft')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .replace(/\s+/g, '_');

export const generateMeetingDocx = async (data: MeetingData): Promise<void> => {
  const blob = await buildDocxBlob(data);

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Meeting_Minutes_${safePdfName(data)}_${data.particulars.date}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const generateMeetingPdf = async (data: MeetingData): Promise<void> => {
  // Build the docx from the Word template
  const blob = await buildDocxBlob(data);

  // Open a print window — this is the only reliable way to get the logo,
  // fonts, and layout from the Word template without a server-side converter.
  // The user selects "Save as PDF" in the browser print dialog.
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    throw new Error('Popup blocked. Please allow popups for this site and try again.');
  }

  const fileName = `Meeting_Minutes_${safePdfName(data)}_${data.particulars.date}`;

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${fileName}</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    body { margin: 0; padding: 0; background: #fff; }
    @media print {
      @page { size: A4; margin: 0; }
      body { margin: 0; }
      #print-bar { display: none !important; }
    }
    #print-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: #1a1a2e; color: #fff; padding: 10px 20px;
      display: flex; align-items: center; justify-content: space-between;
      font-family: system-ui, sans-serif; font-size: 13px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    #print-bar button {
      background: #83002A; color: #fff; border: none; border-radius: 6px;
      padding: 6px 18px; font-size: 13px; font-weight: 700; cursor: pointer;
    }
    #print-bar button:hover { background: #a00035; }
    #doc-root { margin-top: 44px; }
    @media print { #doc-root { margin-top: 0; } }
  </style>
</head>
<body>
  <div id="print-bar">
    <span>Meeting Minutes — ${data.particulars.name || 'Draft'} &nbsp;|&nbsp; Save as PDF: choose <strong>Save as PDF</strong> as the destination</span>
    <button onclick="window.print()">Save as PDF</button>
  </div>
  <div id="doc-root"></div>
</body>
</html>`);
  win.document.close();

  const { renderAsync } = await import('docx-preview');
  await renderAsync(blob, win.document.getElementById('doc-root')!, win.document.head, {
    className: 'docx',
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    breakPages: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    useBase64URL: true,
  });

  // Inject print-hide CSS AFTER docx-preview adds its styles so it wins the cascade
  const printStyle = win.document.createElement('style');
  printStyle.textContent = `
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    @media print {
      #print-bar { display: none !important; visibility: hidden !important; height: 0 !important; overflow: hidden !important; }
      #doc-root  { margin-top: 0 !important; }
      @page { size: A4; }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  `;

  // DOM-level fix: mark the last table (sign-off section) to never split across pages.
  // CSS alone is unreliable for this in Chromium — inline style wins.
  const allTables = win.document.querySelectorAll('table');
  if (allTables.length > 0) {
    const signOff = allTables[allTables.length - 1] as HTMLElement;
    signOff.style.pageBreakInside = 'avoid';
    signOff.style.breakInside = 'avoid';
  }
  win.document.head.appendChild(printStyle);

  // Wait for images (logo, etc.) to fully load before auto-triggering print
  const images = Array.from(win.document.querySelectorAll('img'));
  await Promise.all(
    images.map(img =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>(resolve => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
    )
  );

  // Small render settle delay then auto-open print dialog
  await new Promise(r => setTimeout(r, 400));
  win.print();
};
