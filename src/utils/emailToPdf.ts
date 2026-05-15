/**
 * Converts an HTML email string to a PDF (base64) using html2canvas + jsPDF.
 *
 * html2canvas 1.4.1 requires the element to be inside the viewport to compute
 * real dimensions. We render the container at position (0,0) with opacity:0
 * so the user never sees it but the browser gives it proper layout dimensions.
 */

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

function waitForImages(container: HTMLElement): Promise<void> {
  const imgs = Array.from(container.querySelectorAll('img'));
  if (imgs.length === 0) return Promise.resolve();
  return Promise.all(
    imgs.map(
      img =>
        new Promise<void>(resolve => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
          } else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        }),
    ),
  ).then(() => undefined);
}

export async function htmlToPdfBase64(html: string): Promise<string> {
  const EMAIL_WIDTH = 660;

  // Place the container in the viewport (top-left, invisible).
  // html2canvas needs viewport placement to compute non-zero dimensions.
  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    `width:${EMAIL_WIDTH}px`,
    'opacity:0',
    'pointer-events:none',
    'z-index:99999',
    'background:#f4f4f4',
    'font-family:Segoe UI,Arial,sans-serif',
  ].join(';');

  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  try {
    // Wait for all images (logo data-URIs included)
    await waitForImages(wrapper);

    // Extra tick for layout/paint to settle
    await new Promise(r => setTimeout(r, 300));

    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#f4f4f4',
      logging: false,
      imageTimeout: 15000,
      width: EMAIL_WIDTH,
      scrollX: 0,
      scrollY: 0,
      windowWidth: EMAIL_WIDTH,
      windowHeight: wrapper.scrollHeight,
    });

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('Capture returned an empty canvas — please try again.');
    }

    const A4_WIDTH_MM = 210;
    const pageHeightMm = (canvas.height / canvas.width) * A4_WIDTH_MM;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [A4_WIDTH_MM, pageHeightMm],
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, pageHeightMm);

    return pdf.output('datauristring').split(',')[1];
  } finally {
    document.body.removeChild(wrapper);
  }
}

export function buildPdfFilename(leaveType: string, employeeName: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '');
  return `LeaveRequest_${safe(leaveType)}_${safe(employeeName)}_${date}.pdf`;
}
