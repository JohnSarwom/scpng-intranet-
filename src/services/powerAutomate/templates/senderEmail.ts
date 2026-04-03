/**
 * Email templates for the Send flow (Flow 2).
 *
 * These are adapted versions of snapshotEmail / customEmail that reference
 * Google Sheets row fields via items('Process_Ready_Row')?['ColumnName']
 * instead of SharePoint filter outputs.
 */

// Helper alias to keep template strings shorter
const R = (col: string) => `@{items('Process_Ready_Row')?['${col}']}`;

export function buildSenderSnapshotEmailTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:650px;margin:20px auto;">
<tr><td>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#800020;border-radius:12px 12px 0 0;">
<tr><td style="padding:22px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;text-transform:uppercase;">${R('TimePeriod')} Report</td>
<td align="right">
<span style="display:inline-block;font-size:13px;color:#ffffff;background:rgba(255,255,255,0.15);padding:5px 12px;border-radius:4px;text-transform:uppercase;">${R('PeriodLabel')}</span>
</td>
</tr>
</table>
</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
<tr><td style="padding:18px 24px;border-bottom:1px solid #eee;">
<p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#333;">${R('Unit')} - ${R('Division')}</p>
<p style="margin:0;font-size:13px;color:#777;">Securities Commission of Papua New Guinea</p>
</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
<tr>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Tasks</div>
<div style="font-size:24px;font-weight:700;color:#800020;">${R('CompletedTasks')} / ${R('TotalTasks')}</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KRAs</div>
<div style="font-size:24px;font-weight:700;color:#800020;">${R('TotalKRAs')}</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KPIs</div>
<div style="font-size:24px;font-weight:700;color:#800020;">${R('TotalKPIs')}</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Objectives</div>
<div style="font-size:24px;font-weight:700;color:#800020;">${R('TotalObjectives')}</div>
</td>
</tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f9fa;border:1px solid #e0e0e0;border-top:none;">
<tr>
<td width="33%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#555;">
${R('TotalTasks')} Total Tasks
</td>
<td width="34%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#1e8e3e;">
@{if(equals(int(items('Process_Ready_Row')?['TotalTasks']), 0), '0', string(div(mul(int(items('Process_Ready_Row')?['CompletedTasks']), 100), int(items('Process_Ready_Row')?['TotalTasks']))))}% Completion
</td>
<td width="33%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#6a41a4;text-transform:uppercase;">
${R('PeriodLabel')} Summary
</td>
</tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;border-bottom:1px solid #eee;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="55px" valign="top">
<div style="width:46px;height:46px;border-radius:10px;background:#800020;color:#ffffff;font-size:16px;text-align:center;line-height:46px;font-weight:700;box-shadow:0 4px 8px rgba(128,0,32,0.2);text-transform:uppercase;">@{substring(items('Process_Ready_Row')?['PeriodLabel'], 0, if(greater(length(items('Process_Ready_Row')?['PeriodLabel']), 2), 2, length(items('Process_Ready_Row')?['PeriodLabel'])))}</div>
</td>
<td valign="top" style="padding-left:14px;">
<p style="margin:0 0 3px 0;font-size:14px;font-weight:600;color:#333;text-transform:capitalize;">Automated ${R('TimePeriod')} Assessment</p>
<p style="margin:0;font-size:12px;color:#888;">Prepared for ${R('UserName')}</p>
</td>
</tr>
</table>
</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Performance Summary</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">${R('TotalTasks')}</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">${R('CompletedTasks')} Completed</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fef7e0;border:1px solid #fce8b2;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#b08d00;">${R('InProgressTasks')} In Progress</span>
</td>
</tr>
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">${R('TodoTasks')} To Do</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e8f0fe;border:1px solid #d2e3fc;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1967d2;">${R('ReviewTasks')} Review</span>
</td>
</tr>
</table>
</td>

<td width="4%"></td>

<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">KPI Trajectory</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">${R('TotalKPIs')}</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">${R('OnTrackKPIs')} On Track</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fce8e6;border:1px solid #fad2cf;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#d93025;">${R('AtRiskKPIs')} At Risk</span>
</td>
</tr>
<tr>
<td colspan="2" align="center" style="padding:3px;">
<span style="display:inline-block;background:#fce8e6;border:1px solid #fad2cf;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#d93025;">${R('BehindKPIs')} Behind</span>
</td>
</tr>
</table>
</td>
</tr>
</table>
</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;">
<p style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#333;text-transform:capitalize;">${R('PeriodLabel')} Work Log</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e8e8;">
<tr style="background:#f9f9f9;">
<td style="padding:8px 12px;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Task</td>
<td align="right" style="padding:8px 12px;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Status</td>
</tr>
${R('TaskListHTML')}
</table>
</td></tr>
</table>

@{if(greater(length(string(items('Process_Ready_Row')?['AISummary'])), 2), concat('<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;"><tr><td style="padding:0 24px 22px 24px;border-top:2px dashed #eee;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;"><tr><td style="font-size:15px;font-weight:700;color:#800020;padding-bottom:12px;text-transform:capitalize;">', items('Process_Ready_Row')?['PeriodLabel'], ' Strategic Review <span style="display:inline-block;background:#800020;color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;margin-left:6px;vertical-align:middle;letter-spacing:0.5px;text-transform:none;">GEMINI AI</span></td></tr></table><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fcfcfc;border:1px solid #eee;border-radius:8px;"><tr><td style="padding:14px 15px;font-size:13px;color:#444;line-height:1.6;border-bottom:1px solid #eee;">', replace(string(items('Process_Ready_Row')?['AISummary']), '||INSIGHT||', '</td></tr><tr><td style="padding:14px 15px;font-size:13px;color:#444;line-height:1.6;border-bottom:1px solid #eee;">'), '</td></tr></table></td></tr></table>'), '')}

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td align="center" style="padding:22px 24px;">
<a href="https://unitopia-hub.vercel.app" style="display:inline-block;background:#800020;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-size:14px;font-weight:700;box-shadow:0 4px 6px rgba(128,0,32,0.2);">View Full Context in Unitopia</a>
</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 12px 12px;">
<tr><td align="center" style="padding:16px 24px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">
Confidential &mdash; ${R('Unit')} &middot; Securities Commission of Papua New Guinea<br/>
<span style="text-transform:none;letter-spacing:normal;">This is an automated report from the SCPNG Intranet system.</span>
</td></tr>
</table>

</td></tr>
</table>
</body>
</html>`;
}

export function buildSenderCustomEmailTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:650px;margin:20px auto;">
<tr><td>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0052cc;border-radius:12px 12px 0 0;">
<tr><td style="padding:22px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Custom Date Range Report</td>
<td align="right">
<span style="display:inline-block;font-size:13px;color:#ffffff;background:rgba(255,255,255,0.15);padding:5px 12px;border-radius:4px;">${R('CustomStart')} - ${R('CustomEnd')}</span>
</td>
</tr>
</table>
</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
<tr><td style="padding:18px 24px;border-bottom:1px solid #eee;">
<p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#333;">${R('Unit')} - ${R('Division')}</p>
<p style="margin:0;font-size:13px;color:#777;">Securities Commission of Papua New Guinea</p>
</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
<tr>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Tasks</div>
<div style="font-size:24px;font-weight:700;color:#0052cc;">${R('CompletedTasks')} / ${R('TotalTasks')}</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KRAs</div>
<div style="font-size:24px;font-weight:700;color:#0052cc;">${R('TotalKRAs')}</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KPIs</div>
<div style="font-size:24px;font-weight:700;color:#0052cc;">${R('TotalKPIs')}</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Objectives</div>
<div style="font-size:24px;font-weight:700;color:#0052cc;">${R('TotalObjectives')}</div>
</td>
</tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f9fa;border:1px solid #e0e0e0;border-top:none;">
<tr>
<td width="33%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#555;">
${R('TotalTasks')} Total Tasks
</td>
<td width="34%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#1e8e3e;">
@{if(equals(int(items('Process_Ready_Row')?['TotalTasks']), 0), '0', string(div(mul(int(items('Process_Ready_Row')?['CompletedTasks']), 100), int(items('Process_Ready_Row')?['TotalTasks']))))}% Completion
</td>
<td width="33%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#0052cc;">
Custom Date Range
</td>
</tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;border-bottom:1px solid #eee;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="55px" valign="top">
<div style="width:46px;height:46px;border-radius:10px;background:#0052cc;color:#ffffff;font-size:16px;text-align:center;line-height:46px;font-weight:700;box-shadow:0 4px 8px rgba(0,82,204,0.2);">DR</div>
</td>
<td valign="top" style="padding-left:14px;">
<p style="margin:0 0 3px 0;font-size:14px;font-weight:600;color:#333;">Custom Date Range Assessment</p>
<p style="margin:0;font-size:12px;color:#888;">Prepared for ${R('UserName')}</p>
</td>
</tr>
</table>
</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Task Activity</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#0052cc;text-align:center;">${R('TotalTasks')}</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">${R('CompletedTasks')} Completed</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fef7e0;border:1px solid #fce8b2;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#b08d00;">${R('InProgressTasks')} In Progress</span>
</td>
</tr>
</table>
</td>
<td width="4%"></td>
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">KPI Snapshot</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#0052cc;text-align:center;">${R('TotalKPIs')}</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">${R('OnTrackKPIs')} On Track</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fce8e6;border:1px solid #fad2cf;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#d93025;">${R('AtRiskKPIs')} At Risk</span>
</td>
</tr>
</table>
</td>
</tr>
</table>
</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;">
<p style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#333;">Task Activity Log</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e8e8;">
<tr style="background:#f9f9f9;">
<td style="padding:8px 12px;font-size:11px;font-weight:700;color:#0052cc;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Task</td>
<td align="right" style="padding:8px 12px;font-size:11px;font-weight:700;color:#0052cc;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Status</td>
</tr>
${R('TaskListHTML')}
</table>
</td></tr>
</table>

@{if(greater(length(string(items('Process_Ready_Row')?['AISummary'])), 2), concat('<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;"><tr><td style="padding:0 24px 22px 24px;border-top:2px dashed #eee;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;"><tr><td style="font-size:15px;font-weight:700;color:#0052cc;padding-bottom:12px;">Custom Range Strategic Review <span style="display:inline-block;background:#0052cc;color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;margin-left:6px;vertical-align:middle;letter-spacing:0.5px;">GEMINI AI</span></td></tr></table><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fcfcfc;border:1px solid #eee;border-radius:8px;"><tr><td style="padding:14px 15px;font-size:13px;color:#444;line-height:1.6;border-bottom:1px solid #eee;">', replace(string(items('Process_Ready_Row')?['AISummary']), '||INSIGHT||', '</td></tr><tr><td style="padding:14px 15px;font-size:13px;color:#444;line-height:1.6;border-bottom:1px solid #eee;">'), '</td></tr></table></td></tr></table>'), '')}

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td align="center" style="padding:22px 24px;">
<a href="https://unitopia-hub.vercel.app" style="display:inline-block;background:#0052cc;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-size:14px;font-weight:700;box-shadow:0 4px 6px rgba(0,82,204,0.2);">View Full Context in Unitopia</a>
</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 12px 12px;">
<tr><td align="center" style="padding:16px 24px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">
Confidential &mdash; ${R('Unit')} &middot; Securities Commission of Papua New Guinea<br/>
<span style="text-transform:none;letter-spacing:normal;">This is an automated report from the SCPNG Intranet system.</span>
</td></tr>
</table>

</td></tr>
</table>
</body>
</html>`;
}
