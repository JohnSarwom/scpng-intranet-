import { Client } from '@microsoft/microsoft-graph-client';
import {
  buildSCPNGActionRequiredEmailHTML,
  buildSCPNGActionRequiredEmailSubject,
  buildSCPNGEmailHTML,
  buildSCPNGEmailSubject,
} from '@/utils/scpngEmailBuilder';
import type { EmailTemplateStage } from '@/types/hr';

export type LeaveEmailStage = EmailTemplateStage;

export interface LeaveEmailParams {
  to: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  division?: string;
  unit?: string;
  stage: LeaveEmailStage;
  rejectionReason?: string;
  approverName?: string;
}

export interface ApproverNotifyParams {
  to: string;
  approverName: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  stage: string;
  division?: string;
  unit?: string;
  requestId?: string;
  appUrl?: string;
  employeeEmail?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOGO = 'https://scpng.gov.pg/wp-content/uploads/2021/10/SCPNG-OFFICIAL-LOGO.png';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(d: string): string {
  try {
    return new Date(d).toLocaleDateString('en-PG', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return d;
  }
}

// Alternating detail rows — uses bgcolor attribute (Outlook-safe)
function buildDetailRows(rows: [string, string][]): string {
  return rows.map(([label, value], i) => `
        <tr bgcolor="${i % 2 === 1 ? '#fdf8f8' : '#ffffff'}">
          <td width="140" style="font-size:12px;color:#9a7070;padding:9px 16px;vertical-align:middle;font-family:Arial,sans-serif;border-bottom:1px solid #f0e4e6;">${label}</td>
          <td style="font-size:13px;color:#2a0008;font-weight:bold;padding:9px 16px;vertical-align:middle;font-family:Arial,sans-serif;border-bottom:1px solid #f0e4e6;">${value}</td>
        </tr>`).join('');
}

// ---------------------------------------------------------------------------
// Stage config
// ---------------------------------------------------------------------------

interface StageConfig {
  subject: string;
  statusText: string;
  statusBg: string;
  statusColor: string;
  statusBorder: string;
  dotBg: string;
  bodyHtml: string;
  closing: string;
}

function stageConfig(p: LeaveEmailParams): StageConfig {
  const { stage, leaveType, days, approverName, rejectionReason } = p;
  switch (stage) {
    case 'Submission':
      return {
        subject: `Leave Request Submitted — ${leaveType} (${days} day${days !== 1 ? 's' : ''})`,
        statusText: 'Pending Manager Review',
        statusBg: '#fff8e6', statusColor: '#7a5200', statusBorder: '#d4a62a', dotBg: '#d4a62a',
        bodyHtml: `Your leave request has been <strong>submitted successfully</strong> and is currently awaiting manager review. Please find the details of your submission below.`,
        closing: 'You will be notified as your request progresses through each approval stage. No further action is required from you at this time.',
      };
    case 'Manager Approved':
      return {
        subject: `Leave Request Update — Forwarded to Director Review`,
        statusText: 'Director Review',
        statusBg: '#eff6ff', statusColor: '#1e3a5f', statusBorder: '#3b82f6', dotBg: '#3b82f6',
        bodyHtml: `Your leave request has been <strong>approved by your Manager</strong>${approverName ? ` (${approverName})` : ''} and forwarded to the Director for review.`,
        closing: 'You will be notified once the Director has reviewed your request.',
      };
    case 'Director Approved':
      return {
        subject: `Leave Request Update — Forwarded to HR Review`,
        statusText: 'HR Review',
        statusBg: '#f5f3ff', statusColor: '#4a1d96', statusBorder: '#8b5cf6', dotBg: '#8b5cf6',
        bodyHtml: `Your leave request has been <strong>approved by the Director</strong>${approverName ? ` (${approverName})` : ''} and forwarded to HR for final review.`,
        closing: 'You will be notified once HR has completed the final review.',
      };
    case 'Fully Approved':
      return {
        subject: `Leave Request Approved — ${leaveType} (${days} day${days !== 1 ? 's' : ''})`,
        statusText: 'Approved',
        statusBg: '#ecfdf5', statusColor: '#065f46', statusBorder: '#10b981', dotBg: '#10b981',
        bodyHtml: `Your leave request has been <strong>fully approved</strong>. Your leave balance has been updated accordingly. Please ensure your handover is completed before your leave commences.`,
        closing: 'No further action is required from you. Enjoy your leave!',
      };
    case 'Rejected':
      return {
        subject: `Leave Request Declined — ${leaveType}`,
        statusText: 'Declined',
        statusBg: '#fef2f2', statusColor: '#7f1d1d', statusBorder: '#ef4444', dotBg: '#ef4444',
        bodyHtml: `We regret to inform you that your leave request has been <strong>declined</strong>${approverName ? ` by ${approverName}` : ''}.${rejectionReason ? `<br><br><strong>Reason:</strong> ${rejectionReason}` : ''}`,
        closing: 'If you have any questions, please contact your Manager or HR directly.',
      };
  }
}

// ---------------------------------------------------------------------------
// Core HTML builder — single flat-table structure, fully Outlook-safe
// No linear-gradient, no flexbox, no border-radius, bgcolor attributes on tds
// ---------------------------------------------------------------------------

function buildEmailHtml(opts: {
  recipientName: string;
  bodyHtml: string;
  statusText: string;
  statusBg: string;
  statusColor: string;
  statusBorder: string;
  dotBg: string;
  rows: [string, string][];
  closing: string;
  actionButtons?: string;
}): string {
  const { recipientName, bodyHtml, statusText, statusBg, statusColor, statusBorder, dotBg, rows, closing, actionButtons } = opts;
  const detailRows = buildDetailRows(rows);

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<style>table{border-collapse:collapse;}td{font-family:Arial,sans-serif;}</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;" bgcolor="#f0f0f0">

<!-- Outer wrapper -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0f0f0" style="background-color:#f0f0f0;">
  <tr>
    <td align="center" style="padding:20px 10px;">

      <!-- Email container -->
      <!--[if mso]><table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0" width="600"><tr><td><![endif]-->
      <table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:600px;background-color:#ffffff;border:1px solid #e0d0b0;">

        <!-- ═══ HEADER ═══ -->
        <tr>
          <td bgcolor="#5b0b12" style="background-color:#5b0b12;padding:18px 22px;border-bottom:3px solid #d4a62a;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#5b0b12">
              <tr>
                <!-- Logo cell — bgcolor must match outer to not bleed white -->
                <td bgcolor="#5b0b12" style="background-color:#5b0b12;padding-right:14px;" valign="middle" width="96">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <!-- White box for logo -->
                      <td bgcolor="#ffffff" style="background-color:#ffffff;border:2px solid #d4a62a;padding:5px 6px;" width="84" height="54">
                        <img src="${LOGO}" width="72" height="44" alt="SCPNG" style="display:block;border:0;outline:none;">
                      </td>
                    </tr>
                  </table>
                </td>
                <!-- Org text cell -->
                <td bgcolor="#5b0b12" style="background-color:#5b0b12;" valign="middle">
                  <p style="margin:0;font-size:14px;font-weight:bold;color:#f0c84b;font-family:Arial,sans-serif;line-height:1.3;">Securities Commission of Papua New Guinea</p>
                  <p style="margin:3px 0 0;font-size:11px;color:#e8c97a;font-family:Arial,sans-serif;">Human Resources Unit</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
                    <tr>
                      <td bgcolor="#3b0008" style="background-color:#3b0008;border:1px solid #d4a62a;padding:3px 10px;">
                        <p style="margin:0;font-size:10px;font-weight:bold;color:#f0c84b;font-family:Arial,sans-serif;">&#9670; Internal Leave Management System</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══ BODY ═══ -->
        <tr>
          <td bgcolor="#ffffff" style="background-color:#ffffff;padding:24px 28px 20px;">

            <!-- Greeting -->
            <p style="margin:0 0 12px 0;font-size:15px;color:#1a0005;font-family:Arial,sans-serif;">Dear <strong>${recipientName}</strong>,</p>

            <!-- Body text -->
            <p style="margin:0 0 18px 0;font-size:13px;color:#4a3035;line-height:1.65;font-family:Arial,sans-serif;">${bodyHtml}</p>

            <!-- Status pill -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
              <tr>
                <td bgcolor="${statusBg}" style="background-color:${statusBg};border:1px solid ${statusBorder};padding:5px 14px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td bgcolor="${dotBg}" width="8" height="8" style="background-color:${dotBg};width:8px;height:8px;font-size:0;line-height:0;">&nbsp;&nbsp;</td>
                      <td style="padding-left:7px;font-size:12px;font-weight:bold;color:${statusColor};font-family:Arial,sans-serif;" nowrap>${statusText}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Leave details card -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;border:1px solid #e0cfa8;">
              <tr>
                <td colspan="2" bgcolor="#5b0b12" style="background-color:#5b0b12;padding:9px 16px;">
                  <p style="margin:0;font-size:10px;font-weight:bold;color:#f0c84b;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;">LEAVE REQUEST DETAILS</p>
                </td>
              </tr>
              ${detailRows}
            </table>

            ${actionButtons ?? ''}

            <!-- Closing text -->
            <p style="margin:0 0 16px 0;font-size:13px;color:#555555;line-height:1.65;font-family:Arial,sans-serif;">${closing}</p>

            <!-- Regards -->
            <p style="margin:0;font-size:13px;color:#4a3035;font-family:Arial,sans-serif;line-height:1.7;">
              Regards,<br>
              <strong style="color:#6d0f18;font-size:14px;">HR Department</strong><br>
              <span style="font-size:11px;color:#999999;">Securities Commission of Papua New Guinea</span>
            </p>

          </td>
        </tr>

        <!-- ═══ GOLD DIVIDER ═══ -->
        <tr>
          <td bgcolor="#d4a62a" height="1" style="background-color:#d4a62a;height:1px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- ═══ FOOTER ═══ -->
        <tr>
          <td bgcolor="#fdf5f5" style="background-color:#fdf5f5;border-top:3px solid #6d0f18;padding:18px 24px 14px;">

            <!-- Sig: logo + name -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
              <tr>
                <td valign="middle" width="60" style="padding-right:12px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #d4a62a;padding:4px 5px;" width="50" height="34">
                        <img src="${LOGO}" width="42" height="28" alt="SCPNG" style="display:block;border:0;outline:none;">
                      </td>
                    </tr>
                  </table>
                </td>
                <td valign="middle">
                  <p style="margin:0;font-size:13px;font-weight:bold;color:#3b0008;font-family:Arial,sans-serif;">HR Department</p>
                  <p style="margin:2px 0 0;font-size:11px;color:#7a4050;font-family:Arial,sans-serif;">Securities Commission of <span style="color:#d4a62a;font-weight:bold;">Papua New Guinea</span></p>
                </td>
              </tr>
            </table>

            <!-- Contact grid -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
              <tr>
                <td width="50%" style="font-size:11px;color:#5a3035;padding-bottom:5px;font-family:Arial,sans-serif;vertical-align:top;">&#128205; MRDC HAUS Lvl 2, Champion Parade, Port Moresby</td>
                <td width="50%" style="font-size:11px;color:#5a3035;padding-bottom:5px;padding-left:8px;font-family:Arial,sans-serif;vertical-align:top;">&#128222; (+675) 321 2224</td>
              </tr>
              <tr>
                <td width="50%" style="font-size:11px;color:#5a3035;font-family:Arial,sans-serif;">&#9993; ask@scpng.gov.pg</td>
                <td width="50%" style="font-size:11px;color:#5a3035;padding-left:8px;font-family:Arial,sans-serif;">&#127760; www.scpng.gov.pg</td>
              </tr>
            </table>

            <!-- Disclaimer -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #d4a62a66;">
              <tr>
                <td style="padding-top:10px;font-size:10px;color:#aa8888;line-height:1.55;font-family:Arial,sans-serif;">
                  This communication is intended solely for the named recipient and may contain confidential information belonging to the Securities Commission of Papua New Guinea. If received in error, please notify the sender immediately and delete this message.
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ═══ CONFIDENTIAL STRIP ═══ -->
        <tr>
          <td bgcolor="#3b0008" style="background-color:#3b0008;padding:7px 24px;">
            <p style="margin:0;font-size:10px;color:#e8c97a;font-family:Arial,sans-serif;">
              &#128274; Confidential &nbsp;&middot;&nbsp; Securities Commission of Papua New Guinea &nbsp;&middot;&nbsp; Internal Use Only
            </p>
          </td>
        </tr>

      </table>
      <!--[if mso]></td></tr></table><![endif]-->

    </td>
  </tr>
</table>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Employee leave notification — uses the branded SCPNG email builder
// ---------------------------------------------------------------------------

async function buildLeaveEmailHtml(p: LeaveEmailParams): Promise<{ subject: string; html: string }> {
  const vars = {
    employeeName:    p.employeeName,
    leaveType:       p.leaveType,
    startDate:       fmt(p.startDate),
    endDate:         fmt(p.endDate),
    days:            p.days,
    approverName:    p.approverName,
    rejectionReason: p.rejectionReason,
    division:        p.division,
    unit:            p.unit,
  };
  const [html, subject] = await Promise.all([
    buildSCPNGEmailHTML(p.stage, vars),
    Promise.resolve(buildSCPNGEmailSubject(p.stage, vars)),
  ]);
  return { subject, html };
}

// ---------------------------------------------------------------------------
// Approver "action required" notification
// ---------------------------------------------------------------------------

function buildActionButtons(approveUrl: string, declineUrl: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
      <tr>
        <td style="padding-right:12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td bgcolor="#1a5e2a" style="background-color:#1a5e2a;border-radius:5px;padding:11px 28px;">
                <a href="${approveUrl}" style="font-size:13px;font-weight:bold;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;" target="_blank">&#10003;&nbsp; Approve</a>
              </td>
            </tr>
          </table>
        </td>
        <td>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td bgcolor="#7a1020" style="background-color:#7a1020;border-radius:5px;padding:11px 28px;">
                <a href="${declineUrl}" style="font-size:13px;font-weight:bold;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;" target="_blank">&#10007;&nbsp; Decline</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function buildLegacyApproverNotifyHtml(p: ApproverNotifyParams): { subject: string; html: string } {
  const rows: [string, string][] = [
    ['Employee', p.employeeName],
    ['Leave Type', p.leaveType],
    ['Start Date', fmt(p.startDate)],
    ['End Date', fmt(p.endDate)],
    ['Days Requested', `${p.days} Working Day${p.days !== 1 ? 's' : ''}`],
    ...(p.division ? [['Division', p.division] as [string, string]] : []),
    ...(p.unit ? [['Unit', p.unit] as [string, string]] : []),
  ];

  const base = p.appUrl ?? 'http://localhost:8080';
  const approveUrl = p.requestId
    ? `${base}/leave-action?requestId=${p.requestId}&action=approve`
    : `${base}/hr-profiles?tab=leave-approvals`;
  const declineUrl = p.requestId
    ? `${base}/leave-action?requestId=${p.requestId}&action=decline`
    : `${base}/hr-profiles?tab=leave-approvals`;

  const actionBlock = buildActionButtons(approveUrl, declineUrl);

  const html = buildEmailHtml({
    recipientName: p.approverName,
    bodyHtml: `A leave request from <strong>${p.employeeName}</strong> has been forwarded to you and requires your review at the <strong>${p.stage}</strong> stage.`,
    statusText: `Action Required — ${p.stage}`,
    statusBg: '#fff8e6',
    statusColor: '#7a5200',
    statusBorder: '#d4a62a',
    dotBg: '#d4a62a',
    rows,
    actionButtons: actionBlock,
    closing: 'If the buttons above do not work, please log in to the SCPNG Intranet and navigate to HR Profiles → Leave Approvals.',
  });

  return {
    subject: `Action Required — Leave Request for ${p.employeeName} (${p.stage})`,
    html,
  };
}

// ---------------------------------------------------------------------------
// Public send functions — non-blocking (failures are warned, not thrown)
// ---------------------------------------------------------------------------

async function buildApproverNotifyHtml(p: ApproverNotifyParams): Promise<{ subject: string; html: string }> {
  const base = p.appUrl ?? 'http://localhost:8080';
  const approveUrl = p.requestId
    ? `${base}/leave-action?requestId=${p.requestId}&action=approve`
    : `${base}/hr-profiles?tab=leave-approvals`;
  const declineUrl = p.requestId
    ? `${base}/leave-action?requestId=${p.requestId}&action=decline`
    : `${base}/hr-profiles?tab=leave-approvals`;

  const html = await buildSCPNGActionRequiredEmailHTML({
    approverName: p.approverName,
    employeeName: p.employeeName,
    leaveType: p.leaveType,
    startDate: fmt(p.startDate),
    endDate: fmt(p.endDate),
    days: p.days,
    division: p.division,
    unit: p.unit,
    stage: p.stage,
    approveUrl,
    declineUrl,
  });

  return {
    subject: buildSCPNGActionRequiredEmailSubject({
      employeeName: p.employeeName,
      stage: p.stage,
    }),
    html,
  };
}

async function sendMail(client: Client, to: string, subject: string, html: string): Promise<void> {
  await client.api('/me/sendMail').post({
    message: {
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: false,
  });
}

export async function sendLeaveEmail(client: Client, params: LeaveEmailParams): Promise<void> {
  try {
    const { subject, html } = await buildLeaveEmailHtml(params);
    await sendMail(client, params.to, subject, html);
    console.log(`✉️ Leave email sent [${params.stage}] → ${params.to}`);
  } catch (e) {
    console.warn('⚠️ Leave email send failed (non-blocking):', e);
  }
}

export async function sendApproverNotification(
  client: Client,
  params: ApproverNotifyParams,
): Promise<void> {
  try {
    const { subject, html } = await buildApproverNotifyHtml(params);
    await sendMail(client, params.to, subject, html);
    console.log(`✉️ Approver notification sent [${params.stage}] → ${params.to}`);
  } catch (e) {
    console.warn('⚠️ Approver notification send failed (non-blocking):', e);
  }
}
