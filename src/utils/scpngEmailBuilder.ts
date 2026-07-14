/**
 * SCPNG Branded Email Builder — Pure HTML Tables
 *
 * No runtime library dependency. Hand-crafted Outlook-safe table HTML so the
 * email body is never undefined. Modern clients (Gmail, Apple Mail) get the
 * full design; Outlook falls back to solid brand colours automatically.
 */

import type { EmailTemplateStage } from '@/types/hr';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailTemplateVars {
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: string | number;
  approverName?: string;
  rejectionReason?: string;
  division?: string;
  unit?: string;
}

export interface ActionRequiredEmailVars extends EmailTemplateVars {
  approverName: string;
  stage: string;
  approveUrl: string;
  declineUrl: string;
}

interface StageConfig {
  statusLabel: string;
  statusBg: string;
  statusBorder: string;
  statusText: string;
  dotColor: string;
  bodyIntro: string;
  showRejectionReason?: boolean;
  showApprover?: boolean;
}

interface BuildOptions {
  title?: string;
  recipientName?: string;
  bodyIntro?: string;
  statusLabel?: string;
  detailRows?: string;
  actionBlock?: string;
  notifyText?: string;
}

// ---------------------------------------------------------------------------
// Brand tokens
// ---------------------------------------------------------------------------

const BURG_DARK  = '#3b0008';
const BURG_MID   = '#5b0b12';
const BURG_LIGHT = '#6d0f18';
const GOLD       = '#c9962a';
const GOLD_LIGHT = '#f0c84b';
const GOLD_WARM  = '#e8c97a';

const LOGO_URL = 'https://scpng.gov.pg/wp-content/uploads/2021/10/SCPNG-OFFICIAL-LOGO.png';

let _cachedLogoDataUri: string | null = null;

async function getLogoDataUri(): Promise<string> {
  if (_cachedLogoDataUri) return _cachedLogoDataUri;
  try {
    const res = await fetch('/images/SCPNG%20Original%20Logo.png');
    if (!res.ok) throw new Error('not found');
    const blob = await res.blob();
    const dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror   = reject;
      reader.readAsDataURL(blob);
    });
    _cachedLogoDataUri = dataUri;
    return dataUri;
  } catch {
    return LOGO_URL;
  }
}

// ---------------------------------------------------------------------------
// Stage configuration
// ---------------------------------------------------------------------------

const STAGE_CONFIG: Record<EmailTemplateStage, StageConfig> = {
  Submission: {
    statusLabel:  'Pending Manager Review',
    statusBg:     '#fffbec',
    statusBorder: GOLD,
    statusText:   '#7a5200',
    dotColor:     GOLD,
    bodyIntro:    'Your leave request has been <strong>submitted successfully</strong> and is currently awaiting manager review. Please find the details of your submission below.',
    showApprover: false,
  },
  'Manager Approved': {
    statusLabel:  'Manager Approved — Awaiting Director Review',
    statusBg:     '#eef5fc',
    statusBorder: '#3b82f6',
    statusText:   '#1e4d8c',
    dotColor:     '#3b82f6',
    bodyIntro:    'Your leave request has been <strong>approved by your Manager</strong> and forwarded to the Director for review.',
    showApprover: true,
  },
  'CEO Approved': {
    statusLabel:  'CEO Approved - Awaiting HR Review',
    statusBg:     '#f3efff',
    statusBorder: '#8b5cf6',
    statusText:   '#4c1d95',
    dotColor:     '#8b5cf6',
    bodyIntro:    'Your leave request has been <strong>approved by the CEO</strong> and forwarded to HR for final review.',
    showApprover: true,
  },
  'Director Approved': {
    statusLabel:  'Director Approved — Awaiting HR Review',
    statusBg:     '#f3efff',
    statusBorder: '#8b5cf6',
    statusText:   '#4c1d95',
    dotColor:     '#8b5cf6',
    bodyIntro:    'Your leave request has been <strong>approved by the Director</strong> and forwarded to HR for final review.',
    showApprover: true,
  },
  'Fully Approved': {
    statusLabel:  'Fully Approved',
    statusBg:     '#ecfdf5',
    statusBorder: '#10b981',
    statusText:   '#065f46',
    dotColor:     '#10b981',
    bodyIntro:    'We are pleased to inform you that your leave request has been <strong>fully approved</strong>. Your leave balance has been updated accordingly.',
    showApprover: false,
  },
  Rejected: {
    statusLabel:  'Leave Request Declined',
    statusBg:     '#fef2f2',
    statusBorder: '#ef4444',
    statusText:   '#7f1d1d',
    dotColor:     '#ef4444',
    bodyIntro:    'We regret to inform you that your leave request has been <strong>declined</strong>. Please see the details and reason below.',
    showRejectionReason: true,
    showApprover: true,
  },
};

// ---------------------------------------------------------------------------
// Detail rows
// ---------------------------------------------------------------------------

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildDetailRows(vars: EmailTemplateVars, cfg: StageConfig): string {
  const rows: [string, string][] = [
    ['Leave Type',     vars.leaveType],
    ['Start Date',     vars.startDate],
    ['End Date',       vars.endDate],
    ['Days Requested', `${vars.days} Working Day${vars.days !== 1 ? 's' : ''}`],
  ];
  if (vars.division)                         rows.push(['Division', vars.division]);
  if (vars.unit)                             rows.push(['Unit', vars.unit]);
  if (cfg.showApprover && vars.approverName) rows.push(['Processed By', vars.approverName]);

  return rows.map(([label, value], i) => `
    <tr style="background:${i % 2 === 1 ? '#fdf8f8' : '#ffffff'};">
      <td width="130" style="padding:8px 14px;border-bottom:1px solid #efe4e4;color:#9a7070;font-size:12px;font-family:'Segoe UI',Arial,sans-serif;white-space:nowrap;mso-line-height-rule:exactly;line-height:16px;">${escapeHtml(label)}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #efe4e4;color:#1a0005;font-size:13px;font-weight:600;font-family:'Segoe UI',Arial,sans-serif;mso-line-height-rule:exactly;line-height:16px;">${escapeHtml(value)}</td>
    </tr>`).join('');
}

function buildActionRequiredRows(vars: ActionRequiredEmailVars): string {
  const rows: [string, string][] = [
    ['Employee', vars.employeeName],
    ['Leave Type', vars.leaveType],
    ['Start Date', vars.startDate],
    ['End Date', vars.endDate],
    ['Days Requested', `${vars.days} Working Day${vars.days !== 1 ? 's' : ''}`],
  ];
  if (vars.division) rows.push(['Division', vars.division]);
  if (vars.unit) rows.push(['Unit', vars.unit]);

  return rows.map(([label, value], i) => `
    <tr style="background:${i % 2 === 1 ? '#fdf8f8' : '#ffffff'};">
      <td width="130" style="padding:8px 14px;border-bottom:1px solid #efe4e4;color:#9a7070;font-size:12px;font-family:'Segoe UI',Arial,sans-serif;white-space:nowrap;mso-line-height-rule:exactly;line-height:16px;">${escapeHtml(label)}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #efe4e4;color:#1a0005;font-size:13px;font-weight:600;font-family:'Segoe UI',Arial,sans-serif;mso-line-height-rule:exactly;line-height:16px;">${escapeHtml(value)}</td>
    </tr>`).join('');
}

function buildActionButtons(approveUrl: string, declineUrl: string): string {
  return `<tr><td style="padding:0 28px 22px 28px;">
    <table border="0" cellpadding="0" cellspacing="0">
      <tr>
        <td bgcolor="#1f7a3a" style="background:#1f7a3a;padding:10px 24px;mso-line-height-rule:exactly;line-height:18px;">
          <a href="${escapeHtml(approveUrl)}" target="_blank" style="display:inline-block;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;font-family:'Segoe UI',Arial,sans-serif;">Approve Request</a>
        </td>
        <td width="10" style="font-size:0;line-height:0;">&nbsp;</td>
        <td bgcolor="${BURG_LIGHT}" style="background:${BURG_LIGHT};padding:10px 24px;mso-line-height-rule:exactly;line-height:18px;">
          <a href="${escapeHtml(declineUrl)}" target="_blank" style="display:inline-block;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;font-family:'Segoe UI',Arial,sans-serif;">Decline Request</a>
        </td>
      </tr>
    </table>
  </td></tr>`;
}

// ---------------------------------------------------------------------------
// Template builder
// ---------------------------------------------------------------------------

function buildHTML(stage: EmailTemplateStage, vars: EmailTemplateVars, logoSrc: string, options: BuildOptions = {}): string {
  const cfg        = STAGE_CONFIG[stage];
  const detailRows = options.detailRows ?? buildDetailRows(vars, cfg);
  const title = options.title ?? `Leave Request &mdash; ${vars.leaveType} | SCPNG HR`;
  const recipientName = options.recipientName ?? vars.employeeName;
  const statusLabel = options.statusLabel ?? cfg.statusLabel;

  const notifyText = options.notifyText ?? (
    stage === 'Fully Approved'
      ? 'Please ensure your handover is completed before your leave commences. Contact HR if you have any queries about your leave balance.'
      : stage === 'Rejected'
      ? 'If you have any questions regarding this decision, please speak to your Manager or contact the HR Unit directly.'
      : 'You will be notified as your request progresses through each approval stage. No further action is required from you at this time.'
  );

  const rejectionBlock = cfg.showRejectionReason && vars.rejectionReason
    ? `<tr><td style="padding:0 28px 16px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-left:3px solid #ef4444;background:#fef2f2;">
          <tr><td style="padding:10px 14px;">
            <p style="margin:0 0 5px 0;font-size:11px;font-weight:700;color:#7f1d1d;text-transform:uppercase;letter-spacing:0.5px;font-family:'Segoe UI',Arial,sans-serif;">Reason for Decline</p>
            <p style="margin:0;font-size:13px;color:#450a0a;line-height:1.6;font-family:'Segoe UI',Arial,sans-serif;">${escapeHtml(vars.rejectionReason)}</p>
          </td></tr>
        </table>
      </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <!--[if !mso]><!-->
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--<![endif]-->
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    body, #bodyTable { margin:0!important; padding:0!important; background:#e8e8e8!important; }
    img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; display:block; }
    a   { text-decoration:none; }
    @media only screen and (max-width:620px) {
      #emailCard { width:100%!important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#e8e8e8;">
<!--[if mso | IE]><table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#e8e8e8"><tr><td><![endif]-->
<table id="bodyTable" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#e8e8e8" style="background:#e8e8e8;">
  <tr><td align="center" style="padding:24px 12px;">

    <table id="emailCard" border="0" cellpadding="0" cellspacing="0" width="600" style="background:#ffffff;">

      <!-- ══ HEADER ══════════════════════════════════════════════════ -->
      <tr>
        <td bgcolor="${BURG_MID}" style="background:${BURG_MID};padding:0;border-bottom:3px solid ${GOLD};">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <!-- Logo cell — no white box, sits directly on burgundy -->
              <td width="88" valign="middle" style="padding:16px 0 16px 22px;">
                <img src="${logoSrc}" width="62" height="72" alt="SCPNG" style="width:62px;height:72px;display:block;" />
              </td>
              <!-- Title cell -->
              <td valign="middle" style="padding:18px 22px 18px 14px;">
                <p style="margin:0 0 2px 0;font-size:14px;font-weight:700;color:${GOLD_LIGHT};font-family:'Segoe UI',Arial,sans-serif;line-height:1.2;">Securities Commission of Papua New Guinea</p>
                <p style="margin:0 0 10px 0;font-size:11.5px;color:${GOLD_WARM};font-family:'Segoe UI',Arial,sans-serif;">Human Resources Department</p>
                <table border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td bgcolor="${BURG_DARK}" style="background:${BURG_DARK};border:1px solid #c8a03066;padding:3px 11px;">
                      <span style="font-size:10px;font-weight:600;color:${GOLD_LIGHT};font-family:'Segoe UI',Arial,sans-serif;letter-spacing:0.3px;">&#9670; Internal Leave Management System</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- ══ GREETING ════════════════════════════════════════════════ -->
      <tr><td style="padding:28px 28px 0 28px;">
        <p style="margin:0 0 12px 0;font-size:15px;color:#1a0005;font-family:'Segoe UI',Arial,sans-serif;">Dear <strong>${escapeHtml(recipientName)}</strong>,</p>
        <p style="margin:0 0 20px 0;font-size:13.5px;color:#4a3035;line-height:1.65;font-family:'Segoe UI',Arial,sans-serif;">${options.bodyIntro ?? cfg.bodyIntro}</p>
        <!-- Status badge — auto-width via inner table, not stretched -->
        <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td bgcolor="${cfg.statusBg}" style="background:${cfg.statusBg};border:1.5px solid ${cfg.statusBorder};padding:7px 18px 7px 14px;white-space:nowrap;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="10" valign="middle" style="padding-right:8px;">
                    <!--[if !mso]><!-->
                    <span style="display:inline-block;width:8px;height:8px;background:${cfg.dotColor};border-radius:50%;"></span>
                    <!--<![endif]-->
                    <!--[if mso]><span style="font-size:8px;color:${cfg.dotColor};">&#9679;</span><![endif]-->
                  </td>
                  <td valign="middle">
                    <span style="font-size:12.5px;font-weight:700;color:${cfg.statusText};font-family:'Segoe UI',Arial,sans-serif;">${escapeHtml(statusLabel)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- ══ DETAILS CARD ════════════════════════════════════════════ -->
      <tr><td style="padding:14px 28px 24px 28px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e0d0d0;">
          <tr bgcolor="${BURG_MID}" style="background:${BURG_MID};">
            <td colspan="2" style="padding:9px 16px;mso-line-height-rule:exactly;line-height:16px;">
              <span style="font-size:10.5px;font-weight:700;color:${GOLD_LIGHT};letter-spacing:1px;text-transform:uppercase;font-family:'Segoe UI',Arial,sans-serif;">&#9632; Leave Request Details</span>
            </td>
          </tr>
          ${detailRows}
        </table>
      </td></tr>

      ${options.actionBlock ?? ''}

      <!-- ══ REJECTION REASON (conditional) ═════════════════════════ -->
      ${rejectionBlock}

      <!-- ══ BODY CLOSE TEXT ══════════════════════════════════════════ -->
      <tr><td style="padding:0 28px 20px 28px;">
        <p style="margin:0 0 16px 0;font-size:13px;color:#555555;line-height:1.65;font-family:'Segoe UI',Arial,sans-serif;">${escapeHtml(notifyText)}</p>
        <p style="margin:0;font-size:13px;color:#4a3035;font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;">
          Regards,<br/>
          <strong style="color:${BURG_LIGHT};font-size:14px;">HR Department</strong><br/>
          <span style="font-size:11px;color:#999999;">Securities Commission of Papua New Guinea</span>
        </p>
      </td></tr>

      <!-- ══ DIVIDER — 3px gold, single line ══════════════════════════ -->
      <tr>
        <td bgcolor="${GOLD}" style="background:${GOLD};padding:0;height:3px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td>
      </tr>

      <!-- ══ SIGNATURE FOOTER — no border-top (divider row above handles it) -->
      <tr>
        <td bgcolor="#fdf5f5" style="background:#fdf5f5;padding:16px 22px 10px 22px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <!-- Footer logo — no white box -->
              <td width="72" valign="middle" style="padding-right:14px;">
                <img src="${logoSrc}" width="52" height="62" alt="SCPNG" style="width:52px;height:62px;display:block;" />
              </td>
              <td valign="middle">
                <p style="margin:0 0 3px 0;font-size:14px;font-weight:700;color:${BURG_MID};font-family:'Segoe UI',Arial,sans-serif;">HR Department</p>
                <p style="margin:0;font-size:12px;color:#7a4050;font-family:'Segoe UI',Arial,sans-serif;">Securities Commission of <strong style="color:${GOLD};">Papua New Guinea</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- ══ CONTACT DETAILS — plain text prefixes, no emoji ══════════ -->
      <tr>
        <td bgcolor="#fdf5f5" style="background:#fdf5f5;padding:2px 22px 12px 22px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding:4px 0;font-size:11.5px;color:#5a3035;font-family:'Segoe UI',Arial,sans-serif;mso-line-height-rule:exactly;line-height:18px;">
                <span style="color:${BURG_LIGHT};font-weight:700;">&#9632;</span>&nbsp;MRDC Haus Lvl 2, Champion Parade, Port Moresby
              </td>
              <td width="155" style="padding:4px 0;font-size:11.5px;color:#5a3035;font-family:'Segoe UI',Arial,sans-serif;white-space:nowrap;mso-line-height-rule:exactly;line-height:18px;">
                <span style="color:${BURG_LIGHT};font-weight:700;">Tel</span>&nbsp;(+675) 321 2224
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:11.5px;color:#5a3035;font-family:'Segoe UI',Arial,sans-serif;mso-line-height-rule:exactly;line-height:18px;">
                <span style="color:${BURG_LIGHT};font-weight:700;">Email</span>&nbsp;tmondaya@scpng.gov.pg
              </td>
              <td style="padding:4px 0;font-size:11.5px;color:#5a3035;font-family:'Segoe UI',Arial,sans-serif;mso-line-height-rule:exactly;line-height:18px;">
                <span style="color:${BURG_LIGHT};font-weight:700;">Web</span>&nbsp;www.scpng.gov.pg
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- ══ LINK PILLS — solid border colour (Outlook ignores alpha hex) -->
      <tr>
        <td bgcolor="#fdf5f5" style="background:#fdf5f5;padding:0 22px 14px 22px;">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td bgcolor="#ffffff" style="background:#ffffff;border:1px solid #9a6060;padding:4px 13px;mso-line-height-rule:exactly;line-height:16px;">
                <a href="https://www.scpng.gov.pg" style="font-size:11px;color:${BURG_MID};font-weight:600;text-decoration:none;font-family:'Segoe UI',Arial,sans-serif;">Official Website</a>
              </td>
              <td width="6" style="font-size:0;line-height:0;">&nbsp;</td>
              <td bgcolor="#ffffff" style="background:#ffffff;border:1px solid #9a6060;padding:4px 13px;mso-line-height-rule:exactly;line-height:16px;">
                <a href="#" style="font-size:11px;color:${BURG_MID};font-weight:600;text-decoration:none;font-family:'Segoe UI',Arial,sans-serif;">HR Leave Policy</a>
              </td>
              <td width="6" style="font-size:0;line-height:0;">&nbsp;</td>
              <td bgcolor="#ffffff" style="background:#ffffff;border:1px solid #9a6060;padding:4px 13px;mso-line-height-rule:exactly;line-height:16px;">
                <a href="#" style="font-size:11px;color:${BURG_MID};font-weight:600;text-decoration:none;font-family:'Segoe UI',Arial,sans-serif;">Staff Portal</a>
              </td>
              <td width="6" style="font-size:0;line-height:0;">&nbsp;</td>
              <td bgcolor="#ffffff" style="background:#ffffff;border:1px solid #9a6060;padding:4px 13px;mso-line-height-rule:exactly;line-height:16px;">
                <a href="mailto:tmondaya@scpng.gov.pg" style="font-size:11px;color:${BURG_MID};font-weight:600;text-decoration:none;font-family:'Segoe UI',Arial,sans-serif;">Contact HR</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- ══ DISCLAIMER + SOCIAL ══════════════════════════════════════ -->
      <tr>
        <td bgcolor="#fdf5f5" style="background:#fdf5f5;border-top:1px solid #d4a62a44;padding:10px 24px 14px 24px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="font-size:10px;color:#aa8888;line-height:1.6;font-family:'Segoe UI',Arial,sans-serif;">
                This communication is intended solely for the named recipient and may contain confidential information belonging to the Securities Commission of Papua New Guinea. If received in error, please notify the sender immediately and delete this message.
              </td>
              <td width="72" align="right" valign="top" style="padding-left:12px;white-space:nowrap;">
                <!-- Social icons: padding-based centering works in Outlook, line-height does not -->
                <table border="0" cellpadding="0" cellspacing="0" style="float:right;">
                  <tr>
                    <td bgcolor="${BURG_LIGHT}" width="26" height="26" align="center" valign="middle" style="background:${BURG_LIGHT};width:26px;height:26px;padding:0 0 0 0;" >
                      <a href="https://www.facebook.com/scpngfb" style="display:block;width:26px;height:26px;text-align:center;text-decoration:none;color:${GOLD_LIGHT};font-size:12px;font-weight:700;font-family:Arial,sans-serif;padding-top:5px;">f</a>
                    </td>
                    <td width="6" style="font-size:0;line-height:0;">&nbsp;</td>
                    <td bgcolor="${BURG_LIGHT}" width="26" height="26" align="center" valign="middle" style="background:${BURG_LIGHT};width:26px;height:26px;padding:0;">
                      <a href="https://www.linkedin.com/company/scpng/?viewAsMember=true" style="display:block;width:26px;height:26px;text-align:center;text-decoration:none;color:${GOLD_LIGHT};font-size:10px;font-weight:700;font-family:Arial,sans-serif;padding-top:6px;">in</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- ══ CONFIDENTIAL STRIP ═══════════════════════════════════════ -->
      <tr>
        <td bgcolor="${BURG_MID}" style="background:${BURG_MID};border-top:1px solid #d4a62a44;padding:9px 24px;">
          <p style="margin:0;font-size:10.5px;color:${GOLD_WARM};letter-spacing:0.3px;font-family:'Segoe UI',Arial,sans-serif;">
            &#9670; Confidential &nbsp;&middot;&nbsp; Securities Commission of Papua New Guinea &nbsp;&middot;&nbsp; Internal Use Only
          </p>
        </td>
      </tr>

    </table>

  </td></tr>
</table>
<!--[if mso | IE]></td></tr></table><![endif]-->
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** For real emails — uses hosted logo URL */
export async function buildSCPNGEmailHTML(
  stage: EmailTemplateStage,
  vars: EmailTemplateVars,
): Promise<string> {
  return buildHTML(stage, vars, LOGO_URL);
}

export async function buildSCPNGActionRequiredEmailHTML(
  vars: ActionRequiredEmailVars,
): Promise<string> {
  return buildHTML('Submission', vars, LOGO_URL, {
    title: `Action Required - Leave Request for ${vars.employeeName}`,
    recipientName: vars.approverName,
    bodyIntro: `A leave request from <strong>${escapeHtml(vars.employeeName)}</strong> has been forwarded to you and requires your review at the <strong>${escapeHtml(vars.stage)}</strong> stage.`,
    statusLabel: `Action Required - ${vars.stage}`,
    detailRows: buildActionRequiredRows(vars),
    actionBlock: buildActionButtons(vars.approveUrl, vars.declineUrl),
    notifyText: 'Please review the request and choose Approve or Decline. If the buttons do not open correctly, sign in to the SCPNG Intranet and open the Approvals section.',
  });
}

/** For the browser preview iframe — embeds logo as data URI */
export async function buildSCPNGPreviewHTML(
  stage: EmailTemplateStage,
  vars: EmailTemplateVars,
): Promise<string> {
  const logoSrc = await getLogoDataUri();
  return buildHTML(stage, vars, logoSrc);
}

export function buildSCPNGEmailSubject(
  stage: EmailTemplateStage,
  vars: Pick<EmailTemplateVars, 'leaveType' | 'days'>,
): string {
  const map: Partial<Record<EmailTemplateStage, string>> = {
    Submission:          `Leave Request Submitted — ${vars.leaveType} (${vars.days} day${vars.days !== 1 ? 's' : ''})`,
    'Manager Approved':  `Leave Request Update — Manager Approved | ${vars.leaveType}`,
    'Director Approved': `Leave Request Update — Director Approved | ${vars.leaveType}`,
    'Fully Approved':    `Leave Request Approved — ${vars.leaveType} (${vars.days} day${vars.days !== 1 ? 's' : ''})`,
    Rejected:            `Leave Request Declined — ${vars.leaveType}`,
  };
  return map[stage] ?? `Leave Request Update - ${stage} | ${vars.leaveType}`;
}

export function buildSCPNGActionRequiredEmailSubject(
  vars: Pick<ActionRequiredEmailVars, 'employeeName' | 'stage'>,
): string {
  return `Action Required - Leave Request for ${vars.employeeName} (${vars.stage})`;
}
