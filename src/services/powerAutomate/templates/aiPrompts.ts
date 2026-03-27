export function getAIInstructionsExpression(): string {

        return `@concat(if(equals(items('Process_Each_User')?['TimePeriod'], 'daily'), 'You are a strategic performance analyst for the SCPNG. Review today''s task activity. Provide exactly 3 to 5 concise insights focused on: (1) what was accomplished today, (2) any risks or blockers, and (3) recommended priorities for the next working day.', if(equals(items('Process_Each_User')?['TimePeriod'], 'weekly'), 'You are a strategic performance analyst for the SCPNG. Review the weekly performance data for this unit. Provide exactly 5 concise insights covering: (1) top achievements, (2) challenges and blockers, (3) a productivity observation, (4) recommended priorities, and (5) a brief weekly reflection.', if(equals(items('Process_Each_User')?['TimePeriod'], 'monthly'), 'You are a strategic performance analyst for the SCPNG. Review the monthly performance data. Provide exactly 6 concise insights covering: (1) performance trends, (2) key achievements, (3) systemic bottlenecks, (4) skill growth observations, (5) recommended priorities, and (6) a brief executive reflection.', if(equals(items('Process_Each_User')?['TimePeriod'], 'quarterly'), 'You are a senior strategic performance analyst for the SCPNG. Review the quarterly performance data. Provide exactly 7 impactful insights covering: (1) strategic impact, (2) performance trends, (3) key achievements vs missed targets, (4) systemic bottlenecks, (5) professional growth, (6) forward strategy, and (7) an executive reflection.', if(equals(items('Process_Each_User')?['TimePeriod'], 'half-yearly'), 'You are a senior strategic performance analyst for the SCPNG. Review the half-yearly performance data. Provide exactly 7 impactful insights covering: (1) sustained strategic impact, (2) performance trajectory, (3) major hurdles, (4) trajectory towards annual goals, (5) recommendations for the next 6 months, and (6) an executive reflection.', if(equals(items('Process_Each_User')?['TimePeriod'], 'yearly'), 'You are a senior strategic performance analyst for the SCPNG. Review the annual performance data. Provide exactly 8 impactful insights covering: (1) major strategic wins, (2) key performance trends, (3) objectives accomplished vs missed, (4) systemic organizational challenges, (5) recommendations for next year, and (6) a comprehensive executive summary.', 'You are a strategic performance analyst for the SCPNG. Analyze the following metrics and provide exactly 3 to 5 strategic insights.')))))), ' Each insight should be 1-3 sentences. Do NOT use markdown formatting, bullet points, or numbered lists. Separate each insight with the delimiter ||INSIGHT||. Output nothing else.')`;
    }

export function buildSnapshotAIPromptExpression(): string {

        return `@{outputs('Select_AI_Instructions')}

Unit: @{items('Process_Each_User')?['Unit']}
Division: @{items('Process_Each_User')?['Division']}
Period: @{outputs('Compute_Period_Label')}
Date: @{formatDateTime(utcNow(), 'dd MMMM yyyy')}

TASK METRICS:
- Total Tasks: @{string(outputs('Compute_Task_Metrics')?['totalTasks'])}
- Completed (Done): @{string(length(body('Filter_Completed_Tasks')))}
- In Progress: @{string(length(body('Filter_InProgress_Tasks')))}
- To Do: @{string(length(body('Filter_Todo_Tasks')))}
- In Review: @{string(length(body('Filter_Review_Tasks')))}

KRA METRICS:
- Total KRAs: @{string(outputs('Compute_KRA_Metrics')?['totalKRAs'])}
- Active: @{string(length(body('Filter_Active_KRAs')))}
- Completed: @{string(length(body('Filter_Completed_KRAs')))}

KPI METRICS:
- Total KPIs: @{string(outputs('Compute_KPI_Metrics')?['totalKPIs'])}
- On Track + Completed: @{string(length(body('Filter_OnTrack_KPIs')))}
- At Risk: @{string(length(body('Filter_AtRisk_KPIs')))}
- Behind: @{string(length(body('Filter_Behind_KPIs')))}

OBJECTIVES:
- Total: @{string(length(body('Get_Objectives')?['value']))}`;
    }

export function buildCustomAIPromptExpression(): string {

        return `You are a strategic performance analyst for the Securities Commission of Papua New Guinea (SCPNG). Analyze the following performance data for a specific custom date range window. Provide exactly 5 concise, actionable insights covering: (1) what activity and output occurred within this date range, (2) completion velocity and throughput, (3) risks and items that were active or overdue during this period, (4) any KRA or KPI trend changes visible within this window, and (5) recommendations for the period immediately following this window. Each insight should be 1-2 sentences. Do NOT use markdown formatting, bullet points, or numbered lists. Separate each insight with the delimiter ||INSIGHT||. Output nothing else.

Unit: @{items('Process_Each_User')?['Unit']}
Division: @{items('Process_Each_User')?['Division']}
Date Range: @{formatDateTime(outputs('Compute_Custom_Start'), 'dd MMMM yyyy')} to @{formatDateTime(outputs('Compute_Custom_End'), 'dd MMMM yyyy')}
Window Type: @{if(equals(items('Process_Each_User')?['IsOneTime'], 'true'), 'One-Time Custom Range', concat('Rolling (', if(empty(items('Process_Each_User')?['RollingWindowDays']), '30', items('Process_Each_User')?['RollingWindowDays']), '-day window)'))}

TASK METRICS (items modified/due within date range):
- Total Tasks in Range: @{string(outputs('Compute_Task_Metrics')?['totalTasks'])}
- Completed: @{string(length(body('Filter_Completed_Tasks')))}
- In Progress: @{string(length(body('Filter_InProgress_Tasks')))}
- To Do: @{string(length(body('Filter_Todo_Tasks')))}
- In Review: @{string(length(body('Filter_Review_Tasks')))}

KRA METRICS (items modified within date range):
- Total KRAs in Range: @{string(outputs('Compute_KRA_Metrics')?['totalKRAs'])}
- Active: @{string(length(body('Filter_Active_KRAs')))}
- Completed: @{string(length(body('Filter_Completed_KRAs')))}

KPI METRICS (items modified within date range):
- Total KPIs in Range: @{string(outputs('Compute_KPI_Metrics')?['totalKPIs'])}
- On Track + Completed: @{string(length(body('Filter_OnTrack_KPIs')))}
- At Risk: @{string(length(body('Filter_AtRisk_KPIs')))}
- Behind: @{string(length(body('Filter_Behind_KPIs')))}

OBJECTIVES:
- Total Objectives: @{string(length(body('Get_Objectives')?['value']))}`;
    }