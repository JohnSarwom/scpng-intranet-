import re

with open(r'c:\Users\IT_UNIT\Desktop\Coding\scpng-intranet\src\services\powerAutomateService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace the actions block inside Process_Each_User
# We will match from "Build_Standard_AI_Prompt" to "Build_Email_Body"
pattern_actions = r'"Build_Standard_AI_Prompt": \{.*?"Build_Email_Body": \{.*?\n\s+inputs: "@if.*?\}'
match = re.search(pattern_actions, content, re.DOTALL)
if match:
    replacement_actions = """
                                // --- Dynamic Labels & Instructions ---
                                "Compute_Period_Label": {
                                    type: "Compose",
                                    runAfter: { 
                                        "Compute_Task_Metrics": ["Succeeded"],
                                        "Filter_Completed_Tasks": ["Succeeded"],
                                        "Filter_InProgress_Tasks": ["Succeeded"],
                                        "Filter_Todo_Tasks": ["Succeeded"],
                                        "Filter_Review_Tasks": ["Succeeded"],
                                        "Compute_KRA_Metrics": ["Succeeded"],
                                        "Filter_Active_KRAs": ["Succeeded"],
                                        "Filter_Completed_KRAs": ["Succeeded"],
                                        "Compute_KPI_Metrics": ["Succeeded"],
                                        "Filter_OnTrack_KPIs": ["Succeeded"],
                                        "Filter_AtRisk_KPIs": ["Succeeded"],
                                        "Filter_Behind_KPIs": ["Succeeded"],
                                        "Get_Objectives": ["Succeeded"],
                                        "Build_Task_List_HTML": ["Succeeded"]
                                    },
                                    inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'quarterly'), concat('Q', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 3), '1', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '2', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 9), '3', '4')))), if(equals(items('Process_Each_User')?['TimePeriod'], 'half-yearly'), concat('H', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '1', '2')), if(equals(items('Process_Each_User')?['TimePeriod'], 'yearly'), formatDateTime(utcNow(), 'yyyy'), items('Process_Each_User')?['TimePeriod'])))"
                                },
                                "Select_AI_Instructions": {
                                    type: "Compose",
                                    runAfter: { "Compute_Period_Label": ["Succeeded"] },
                                    inputs: this.getAIInstructionsExpression()
                                },

                                // --- AI Prompts ---
                                "Build_Snapshot_AI_Prompt": {
                                    type: "Compose",
                                    runAfter: { "Select_AI_Instructions": ["Succeeded"] },
                                    inputs: this.buildSnapshotAIPromptExpression()
                                },
                                "Build_Custom_AI_Prompt": {
                                    type: "Compose",
                                    runAfter: {
                                        "Compute_Custom_Task_Metrics": ["Succeeded"],
                                        "Filter_Custom_Completed_Tasks": ["Succeeded"],
                                        "Filter_Custom_InProgress_Tasks": ["Succeeded"],
                                        "Filter_Custom_Todo_Tasks": ["Succeeded"],
                                        "Filter_Custom_Review_Tasks": ["Succeeded"],
                                        "Compute_Custom_KRA_Metrics": ["Succeeded"],
                                        "Filter_Custom_Active_KRAs": ["Succeeded"],
                                        "Filter_Custom_Completed_KRAs": ["Succeeded"],
                                        "Compute_Custom_KPI_Metrics": ["Succeeded"],
                                        "Filter_Custom_OnTrack_KPIs": ["Succeeded"],
                                        "Filter_Custom_AtRisk_KPIs": ["Succeeded"],
                                        "Filter_Custom_Behind_KPIs": ["Succeeded"],
                                        "Get_Objectives": ["Succeeded"],
                                        "Compute_Custom_Start": ["Succeeded"],
                                        "Compute_Custom_End": ["Succeeded"]
                                    },
                                    inputs: this.buildCustomAIPromptExpression()
                                },
                                "Build_AI_Prompt": {
                                    type: "Compose",
                                    runAfter: {
                                        "Build_Snapshot_AI_Prompt": ["Succeeded"],
                                        "Build_Custom_AI_Prompt": ["Succeeded"]
                                    },
                                    inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'custom'), outputs('Build_Custom_AI_Prompt'), outputs('Build_Snapshot_AI_Prompt'))"
                                },

                                // --- Gemini API Call ---
                                "Call_Gemini_API": {
                                    type: "Http",
                                    runAfter: { "Build_AI_Prompt": ["Succeeded"] },
                                    inputs: {
                                        method: "POST",
                                        uri: "@{concat('https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=', if(greater(length(body('Get_Gemini_API_Key')?['value']), 0), body('Get_Gemini_API_Key')?['value'][0]?['Value'], ''))}",
                                        headers: {
                                            "Content-Type": "application/json"
                                        },
                                        body: {
                                            contents: [
                                                {
                                                    parts: [
                                                        {
                                                            text: "@outputs('Build_AI_Prompt')"
                                                        }
                                                    ]
                                                }
                                            ]
                                        }
                                    }
                                },

                                // Extract AI response text
                                "Extract_AI_Response": {
                                    type: "Compose",
                                    runAfter: { "Call_Gemini_API": ["Succeeded", "Failed", "TimedOut"] },
                                    inputs: "@if(equals(outputs('Call_Gemini_API')['statusCode'], 200), body('Call_Gemini_API')?['candidates']?[0]?['content']?['parts']?[0]?['text'], '')"
                                },

                                // --- Build HTML email body ---
                                "Build_Snapshot_Email": {
                                    type: "Compose",
                                    runAfter: { "Extract_AI_Response": ["Succeeded"] },
                                    inputs: this.buildSnapshotEmailTemplate()
                                },
                                "Build_Custom_Email": {
                                    type: "Compose",
                                    runAfter: {
                                        "Extract_AI_Response": ["Succeeded"],
                                        "Filter_Tasks_InDateRange": ["Succeeded"],
                                        "Filter_Custom_Completed_Tasks": ["Succeeded"],
                                        "Filter_Custom_InProgress_Tasks": ["Succeeded"],
                                        "Filter_Custom_Todo_Tasks": ["Succeeded"],
                                        "Filter_Custom_Review_Tasks": ["Succeeded"],
                                        "Compute_Custom_Task_Metrics": ["Succeeded"],
                                        "Compute_Custom_KRA_Metrics": ["Succeeded"],
                                        "Compute_Custom_KPI_Metrics": ["Succeeded"],
                                        "Filter_Custom_Active_KRAs": ["Succeeded"],
                                        "Filter_Custom_Completed_KRAs": ["Succeeded"],
                                        "Filter_Custom_OnTrack_KPIs": ["Succeeded"],
                                        "Filter_Custom_AtRisk_KPIs": ["Succeeded"],
                                        "Filter_Custom_Behind_KPIs": ["Succeeded"],
                                        "Compute_Custom_Start": ["Succeeded"],
                                        "Compute_Custom_End": ["Succeeded"]
                                    },
                                    inputs: this.buildCustomEmailTemplate()
                                },
                                "Build_Email_Body": {
                                    type: "Compose",
                                    runAfter: {
                                        "Build_Snapshot_Email": ["Succeeded"],
                                        "Build_Custom_Email": ["Succeeded"]
                                    },
                                    inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'custom'), outputs('Build_Custom_Email'), outputs('Build_Snapshot_Email'))"
                                }"""
    content = content[:match.start()] + replacement_actions + content[match.end():]
else:
    print("Could not find actions block")

# 2. Replace all the builder methods logic
pattern_methods = r'    // --- Standard HTML Email Template \(non-daily reports\) ---.*?(?=    // --- Custom Date Range HTML Email Template ---)'
match2 = re.search(pattern_methods, content, re.DOTALL)
if match2:
    replacement_methods = """    // --- Unified Snapshot Instructions ---

    private getAIInstructionsExpression(): string {
        return `@if(equals(items('Process_Each_User')?['TimePeriod'], 'daily'), 'You are a strategic performance analyst for the SCPNG. Review today''s task activity. Provide exactly 3 to 5 concise insights focused on: (1) what was accomplished today, (2) any risks or blockers, and (3) recommended priorities for the next working day.', if(equals(items('Process_Each_User')?['TimePeriod'], 'weekly'), 'You are a strategic performance analyst for the SCPNG. Review the weekly performance data for this unit. Provide exactly 5 concise insights covering: (1) top achievements, (2) challenges and blockers, (3) a productivity observation, (4) recommended priorities, and (5) a brief weekly reflection.', if(equals(items('Process_Each_User')?['TimePeriod'], 'monthly'), 'You are a strategic performance analyst for the SCPNG. Review the monthly performance data. Provide exactly 6 concise insights covering: (1) performance trends, (2) key achievements, (3) systemic bottlenecks, (4) skill growth observations, (5) recommended priorities, and (6) a brief executive reflection.', if(equals(items('Process_Each_User')?['TimePeriod'], 'quarterly'), 'You are a senior strategic performance analyst for the SCPNG. Review the quarterly performance data. Provide exactly 7 impactful insights covering: (1) strategic impact, (2) performance trends, (3) key achievements vs missed targets, (4) systemic bottlenecks, (5) professional growth, (6) forward strategy, and (7) an executive reflection.', if(equals(items('Process_Each_User')?['TimePeriod'], 'half-yearly'), 'You are a senior strategic performance analyst for the SCPNG. Review the half-yearly performance data. Provide exactly 7 impactful insights covering: (1) sustained strategic impact, (2) performance trajectory, (3) major hurdles, (4) trajectory towards annual goals, (5) recommendations for the next 6 months, and (6) an executive reflection.', if(equals(items('Process_Each_User')?['TimePeriod'], 'yearly'), 'You are a senior strategic performance analyst for the SCPNG. Review the annual performance data. Provide exactly 8 impactful insights covering: (1) major strategic wins, (2) key performance trends, (3) objectives accomplished vs missed, (4) systemic organizational challenges, (5) recommendations for next year, and (6) a comprehensive executive summary.', 'You are a strategic performance analyst for the SCPNG. Analyze the following metrics and provide exactly 3 to 5 strategic insights.'))))))` + ' Each insight should be 1-3 sentences. Do NOT use markdown formatting, bullet points, or numbered lists. Separate each insight with the delimiter ||INSIGHT||. Output nothing else.';
    }

    private buildSnapshotAIPromptExpression(): string {
        return `@{concat(
outputs('Select_AI_Instructions'), '

Unit: ', items('Process_Each_User')?['Unit'], '
Division: ', items('Process_Each_User')?['Division'], '
Period: ', outputs('Compute_Period_Label'), '
Date: ', formatDateTime(utcNow(), 'dd MMMM yyyy'), '

TASK METRICS:
- Total Tasks: ', string(outputs('Compute_Task_Metrics')?['totalTasks']), '
- Completed (Done): ', string(length(body('Filter_Completed_Tasks'))), '
- In Progress: ', string(length(body('Filter_InProgress_Tasks'))), '
- To Do: ', string(length(body('Filter_Todo_Tasks'))), '
- In Review: ', string(length(body('Filter_Review_Tasks'))), '

KRA METRICS:
- Total KRAs: ', string(outputs('Compute_KRA_Metrics')?['totalKRAs']), '
- Active: ', string(length(body('Filter_Active_KRAs'))), '
- Completed: ', string(length(body('Filter_Completed_KRAs'))), '

KPI METRICS:
- Total KPIs: ', string(outputs('Compute_KPI_Metrics')?['totalKPIs']), '
- On Track + Completed: ', string(length(body('Filter_OnTrack_KPIs'))), '
- At Risk: ', string(length(body('Filter_AtRisk_KPIs'))), '
- Behind: ', string(length(body('Filter_Behind_KPIs'))), '

OBJECTIVES:
- Total: ', string(length(body('Get_Objectives')?['value'])), '
'
)}`;
    }

    private buildSnapshotEmailTemplate(): string {
        return `@{concat(
'<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:650px;margin:20px auto;">
<tr><td>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#800020;border-radius:12px 12px 0 0;">
<tr><td style="padding:22px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;text-transform:uppercase;">', items('Process_Each_User')?['TimePeriod'], ' Report</td>
<td align="right">
<span style="display:inline-block;font-size:13px;color:#ffffff;background:rgba(255,255,255,0.15);padding:5px 12px;border-radius:4px;text-transform:uppercase;">', outputs('Compute_Period_Label'), '</span>
</td>
</tr>
</table>
</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
<tr><td style="padding:18px 24px;border-bottom:1px solid #eee;">
<p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#333;">', items('Process_Each_User')?['Unit'], ' - ', items('Process_Each_User')?['Division'], '</p>
<p style="margin:0;font-size:13px;color:#777;">Securities Commission of Papua New Guinea</p>
</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
<tr>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Tasks</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', length(body('Filter_Completed_Tasks')), ' / ', outputs('Compute_Task_Metrics')?['totalTasks'], '</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KRAs</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', outputs('Compute_KRA_Metrics')?['totalKRAs'], '</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KPIs</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', outputs('Compute_KPI_Metrics')?['totalKPIs'], '</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Objectives</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', length(body('Get_Objectives')?['value']), '</div>
</td>
</tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f9fa;border:1px solid #e0e0e0;border-top:none;">
<tr>
<td width="33%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#555;">
', outputs('Compute_Task_Metrics')?['totalTasks'], ' Total Tasks
</td>
<td width="34%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#1e8e3e;">
', if(equals(outputs('Compute_Task_Metrics')?['totalTasks'], 0), '0', string(div(mul(length(body('Filter_Completed_Tasks')), 100), outputs('Compute_Task_Metrics')?['totalTasks']))), '% Completion
</td>
<td width="33%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#6a41a4;text-transform:uppercase;">
', outputs('Compute_Period_Label'), ' Summary
</td>
</tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;border-bottom:1px solid #eee;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="55px" valign="top">
<div style="width:46px;height:46px;border-radius:10px;background:#800020;color:#ffffff;font-size:16px;text-align:center;line-height:46px;font-weight:700;box-shadow:0 4px 8px rgba(128,0,32,0.2);text-transform:uppercase;">', substring(outputs('Compute_Period_Label'), 0, if(greater(length(outputs('Compute_Period_Label')), 2), 2, length(outputs('Compute_Period_Label')))) , '</div>
</td>
<td valign="top" style="padding-left:14px;">
<p style="margin:0 0 3px 0;font-size:14px;font-weight:600;color:#333;text-transform:capitalize;">Automated ', items('Process_Each_User')?['TimePeriod'], ' Assessment</p>
<p style="margin:0;font-size:12px;color:#888;">Prepared for ', items('Process_Each_User')?['Title'], '</p>
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
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_Task_Metrics')?['totalTasks'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_Completed_Tasks')), ' Completed</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fef7e0;border:1px solid #fce8b2;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#b08d00;">', length(body('Filter_InProgress_Tasks')), ' In Progress</span>
</td>
</tr>
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">', length(body('Filter_Todo_Tasks')), ' To Do</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e8f0fe;border:1px solid #d2e3fc;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1967d2;">', length(body('Filter_Review_Tasks')), ' Review</span>
</td>
</tr>
</table>
</td>

<td width="4%"></td>

<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">KPI Trajectory</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_KPI_Metrics')?['totalKPIs'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_OnTrack_KPIs')), ' On Track</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fce8e6;border:1px solid #fad2cf;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#d93025;">', length(body('Filter_AtRisk_KPIs')), ' At Risk</span>
</td>
</tr>
<tr>
<td colspan="2" align="center" style="padding:3px;">
<span style="display:inline-block;background:#fce8e6;border:1px solid #fad2cf;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#d93025;">', length(body('Filter_Behind_KPIs')), ' Behind</span>
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
<p style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#333;text-transform:capitalize;">', outputs('Compute_Period_Label'), ' Work Log</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e8e8;">
<tr style="background:#f9f9f9;">
<td style="padding:8px 12px;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Task</td>
<td align="right" style="padding:8px 12px;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Status</td>
</tr>
', outputs('Build_Task_List_HTML'), '
</table>
</td></tr>
</table>

', if(greater(length(string(outputs('Extract_AI_Response'))), 2), concat(
'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:0 24px 22px 24px;border-top:2px dashed #eee;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
<tr><td style="font-size:15px;font-weight:700;color:#800020;padding-bottom:12px;text-transform:capitalize;">', outputs('Compute_Period_Label'), ' Strategic Review <span style="display:inline-block;background:#800020;color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;margin-left:6px;vertical-align:middle;letter-spacing:0.5px;text-transform:none;">GEMINI AI</span></td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fcfcfc;border:1px solid #eee;border-radius:8px;">
<tr><td style="padding:14px 15px;font-size:13px;color:#444;line-height:1.6;border-bottom:1px solid #eee;">',
replace(string(outputs('Extract_AI_Response')), '||INSIGHT||', '</td></tr><tr><td style="padding:14px 15px;font-size:13px;color:#444;line-height:1.6;border-bottom:1px solid #eee;">'),
'</td></tr>
</table>
</td></tr>
</table>'
), ''), '

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td align="center" style="padding:22px 24px;">
<a href="https://unitopia-hub.vercel.app" style="display:inline-block;background:#800020;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-size:14px;font-weight:700;box-shadow:0 4px 6px rgba(128,0,32,0.2);">View Full Context in Unitopia</a>
</td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 12px 12px;">
<tr><td align="center" style="padding:16px 24px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">
Confidential &mdash; ', items('Process_Each_User')?['Unit'], ' &middot; Securities Commission of Papua New Guinea<br/>
<span style="text-transform:none;letter-spacing:normal;">This is an automated report from the SCPNG Intranet system.</span>
</td></tr>
</table>

</td></tr>
</table>
</body>
</html>'
)}`;
    }
"""
    content = content[:match2.start()] + replacement_methods + content[match2.end():]
else:
    print("Could not find methods block")

# 3. Save it
with open(r'c:\Users\IT_UNIT\Desktop\Coding\scpng-intranet\src\services\powerAutomateService.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done refactoring powerAutomateService.ts")
