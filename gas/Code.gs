/**
 * SCPNG Intranet — AI Queue Processor
 * Google Apps Script
 *
 * This script reads PENDING rows from the AI_Queue sheet, calls the Gemini API
 * to generate AI summaries, and writes the result back as Status=READY for
 * the Power Automate Send flow to pick up and email.
 *
 * ONE-TIME SETUP:
 *   1. Open this project in the Apps Script editor.
 *   2. Go to Project Settings > Script Properties and add:
 *        SPREADSHEET_ID  — The Google Sheets file ID (from the URL).
 *        GEMINI_API_KEY  — Your Gemini API key.
 *   3. Run setupScript() once from the editor to create the time trigger and sheet headers.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const PROPS          = PropertiesService.getScriptProperties();
const GEMINI_API_KEY = PROPS.getProperty('GEMINI_API_KEY');

/**
 * Returns the bound spreadsheet.
 * Because this script was opened from within the sheet (container-bound),
 * getActiveSpreadsheet() always resolves to the correct file — no
 * SPREADSHEET_ID Script Property needed.
 */
function _getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}
const GEMINI_URL     = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const QUEUE_HEADERS = [
  'RunId', 'UserEmail', 'UserName', 'ManagerEmail', 'Unit', 'Division',
  'TimePeriod', 'PeriodLabel',
  'TotalTasks', 'CompletedTasks', 'InProgressTasks', 'TodoTasks', 'ReviewTasks',
  'TotalKRAs', 'ActiveKRAs', 'CompletedKRAs',
  'TotalKPIs', 'OnTrackKPIs', 'AtRiskKPIs', 'BehindKPIs',
  'TotalObjectives', 'TaskListHTML',
  'ScheduleItemID', 'IsOneTime', 'CustomIntervalDays', 'CustomStart', 'CustomEnd',
  'Status', 'AISummary', 'CreatedAt', 'ProcessedAt',
];

const LOG_HEADERS = ['Timestamp', 'RunId', 'UserEmail', 'Unit', 'Period', 'Success', 'Error'];

// ─── Setup ───────────────────────────────────────────────────────────────────

/**
 * Run once from the Apps Script editor to create the 5-minute trigger and
 * initialise the AI_Queue / Run_Log sheet tabs.
 *
 * This script is container-bound to the SCPNG Report Scheduler spreadsheet
 * (ID: 1QC0x7LGONaLX1hm2BXYj23qUp1z9wlfxRm6se7XQy3Y) — no Script
 * Properties required beyond GEMINI_API_KEY.
 */
function setupScript() {
  // Clear existing triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // Fire every 5 minutes
  ScriptApp.newTrigger('processAIQueue')
    .timeBased()
    .everyMinutes(5)
    .create();

  const ss = _getSpreadsheet();
  _ensureSheet(ss, 'AI_Queue', QUEUE_HEADERS);
  _ensureSheet(ss, 'Run_Log',  LOG_HEADERS);

  Logger.log('Setup complete. 5-minute trigger created, sheets initialised.');
}

// ─── Main Processor ──────────────────────────────────────────────────────────

/**
 * Main entry point — runs every 5 minutes via time trigger.
 * Reads all PENDING rows, calls Gemini, writes AISummary + Status=READY.
 */
function processAIQueue() {
  const ss     = _getSpreadsheet();
  const qSheet = ss.getSheetByName('AI_Queue');
  if (!qSheet) { Logger.log('AI_Queue sheet not found.'); return; }

  const data = qSheet.getDataRange().getValues();
  if (data.length < 2) return; // Only headers — nothing to do

  const col         = _buildColMap(data[0]);
  const pendingRows = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][col['Status']] === 'PENDING') {
      pendingRows.push({ rowNum: i + 1, row: data[i] }); // rowNum is 1-based
    }
  }

  if (pendingRows.length === 0) { Logger.log('No PENDING rows.'); return; }
  Logger.log(`Processing ${pendingRows.length} PENDING row(s).`);

  for (let p = 0; p < pendingRows.length; p++) {
    const { rowNum, row } = pendingRows[p];
    const runId     = row[col['RunId']];
    const userEmail = row[col['UserEmail']];
    const unit      = row[col['Unit']];
    const division  = row[col['Division']];
    const timePeriod = row[col['TimePeriod']];
    const periodLabel = row[col['PeriodLabel']];

    try {
      const metrics = {
        totalTasks:      Number(row[col['TotalTasks']])      || 0,
        completedTasks:  Number(row[col['CompletedTasks']])  || 0,
        inProgressTasks: Number(row[col['InProgressTasks']]) || 0,
        todoTasks:       Number(row[col['TodoTasks']])       || 0,
        reviewTasks:     Number(row[col['ReviewTasks']])     || 0,
        totalKRAs:       Number(row[col['TotalKRAs']])       || 0,
        activeKRAs:      Number(row[col['ActiveKRAs']])      || 0,
        completedKRAs:   Number(row[col['CompletedKRAs']])   || 0,
        totalKPIs:       Number(row[col['TotalKPIs']])       || 0,
        onTrackKPIs:     Number(row[col['OnTrackKPIs']])     || 0,
        atRiskKPIs:      Number(row[col['AtRiskKPIs']])      || 0,
        behindKPIs:      Number(row[col['BehindKPIs']])      || 0,
        totalObjectives: Number(row[col['TotalObjectives']]) || 0,
        isOneTime:       row[col['IsOneTime']] === 'true',
        customStart:     String(row[col['CustomStart']] || ''),
        customEnd:       String(row[col['CustomEnd']]   || ''),
      };

      const prompt    = _buildPrompt(timePeriod, unit, division, periodLabel, metrics);
      const aiSummary = _callGemini(prompt);

      // Write result back to sheet
      qSheet.getRange(rowNum, col['AISummary']   + 1).setValue(aiSummary);
      qSheet.getRange(rowNum, col['Status']       + 1).setValue('READY');
      qSheet.getRange(rowNum, col['ProcessedAt']  + 1).setValue(new Date().toISOString());

      _logRun(ss, runId, userEmail, unit, timePeriod, true, '');
      Logger.log(`OK  RunId=${runId}  user=${userEmail}`);

    } catch (e) {
      qSheet.getRange(rowNum, col['Status']      + 1).setValue('ERROR');
      qSheet.getRange(rowNum, col['AISummary']   + 1).setValue('');
      qSheet.getRange(rowNum, col['ProcessedAt'] + 1).setValue(new Date().toISOString());

      _logRun(ss, runId, userEmail, unit, timePeriod, false, e.message);
      Logger.log(`ERR RunId=${runId}  ${e.message}`);
    }

    // 4-second gap between Gemini calls — stays under the 15 req/min free-tier limit
    if (p < pendingRows.length - 1) Utilities.sleep(4000);
  }

  // Housekeeping: delete SENT rows older than 14 days
  _cleanupOldRows(qSheet, col);
}

// ─── Prompt Builder ──────────────────────────────────────────────────────────

function _buildPrompt(timePeriod, unit, division, periodLabel, metrics) {
  const today = Utilities.formatDate(new Date(), 'Pacific/Port_Moresby', 'dd MMMM yyyy');

  if (timePeriod === 'custom') {
    return [
      'You are a strategic performance analyst for the Securities Commission of Papua New Guinea (SCPNG).',
      'Analyze the following performance data for a specific custom date range window.',
      'Provide exactly 5 concise, actionable insights covering:',
      '(1) what activity and output occurred within this date range,',
      '(2) completion velocity and throughput,',
      '(3) risks and items that were active or overdue during this period,',
      '(4) any KRA or KPI trend changes visible within this window, and',
      '(5) recommendations for the period immediately following this window.',
      'Each insight should be 1-2 sentences. Do NOT use markdown, bullet points, or numbered lists.',
      'Separate each insight with the delimiter ||INSIGHT||. Output nothing else.',
      '',
      `Unit: ${unit}`,
      `Division: ${division}`,
      `Date Range: ${metrics.customStart} to ${metrics.customEnd}`,
      `Window Type: ${metrics.isOneTime ? 'One-Time Custom Range' : 'Rolling Window'}`,
      '',
      'TASK METRICS (modified/due within date range):',
      `- Total Tasks: ${metrics.totalTasks}`,
      `- Completed: ${metrics.completedTasks}`,
      `- In Progress: ${metrics.inProgressTasks}`,
      `- To Do: ${metrics.todoTasks}`,
      `- In Review: ${metrics.reviewTasks}`,
      '',
      'KRA METRICS:',
      `- Total KRAs: ${metrics.totalKRAs}`,
      `- Active: ${metrics.activeKRAs}`,
      `- Completed: ${metrics.completedKRAs}`,
      '',
      'KPI METRICS:',
      `- Total KPIs: ${metrics.totalKPIs}`,
      `- On Track + Completed: ${metrics.onTrackKPIs}`,
      `- At Risk: ${metrics.atRiskKPIs}`,
      `- Behind: ${metrics.behindKPIs}`,
      '',
      'OBJECTIVES:',
      `- Total: ${metrics.totalObjectives}`,
    ].join('\n');
  }

  const instructions = _getInstructions(timePeriod);

  return [
    instructions,
    '',
    `Unit: ${unit}`,
    `Division: ${division}`,
    `Period: ${periodLabel}`,
    `Date: ${today}`,
    '',
    'TASK METRICS:',
    `- Total Tasks: ${metrics.totalTasks}`,
    `- Completed (Done): ${metrics.completedTasks}`,
    `- In Progress: ${metrics.inProgressTasks}`,
    `- To Do: ${metrics.todoTasks}`,
    `- In Review: ${metrics.reviewTasks}`,
    '',
    'KRA METRICS:',
    `- Total KRAs: ${metrics.totalKRAs}`,
    `- Active: ${metrics.activeKRAs}`,
    `- Completed: ${metrics.completedKRAs}`,
    '',
    'KPI METRICS:',
    `- Total KPIs: ${metrics.totalKPIs}`,
    `- On Track + Completed: ${metrics.onTrackKPIs}`,
    `- At Risk: ${metrics.atRiskKPIs}`,
    `- Behind: ${metrics.behindKPIs}`,
    '',
    'OBJECTIVES:',
    `- Total: ${metrics.totalObjectives}`,
  ].join('\n');
}

function _getInstructions(timePeriod) {
  const suffix = ' Each insight should be 1-3 sentences. Do NOT use markdown formatting, bullet points, or numbered lists. Separate each insight with the delimiter ||INSIGHT||. Output nothing else.';
  const map = {
    daily:        "You are a strategic performance analyst for the SCPNG. Review today's task activity. Provide exactly 3 to 5 concise insights focused on: (1) what was accomplished today, (2) any risks or blockers, and (3) recommended priorities for the next working day.",
    weekly:       "You are a strategic performance analyst for the SCPNG. Review the weekly performance data for this unit. Provide exactly 5 concise insights covering: (1) top achievements, (2) challenges and blockers, (3) a productivity observation, (4) recommended priorities, and (5) a brief weekly reflection.",
    monthly:      "You are a strategic performance analyst for the SCPNG. Review the monthly performance data. Provide exactly 6 concise insights covering: (1) performance trends, (2) key achievements, (3) systemic bottlenecks, (4) skill growth observations, (5) recommended priorities, and (6) a brief executive reflection.",
    quarterly:    "You are a senior strategic performance analyst for the SCPNG. Review the quarterly performance data. Provide exactly 7 impactful insights covering: (1) strategic impact, (2) performance trends, (3) key achievements vs missed targets, (4) systemic bottlenecks, (5) professional growth, (6) forward strategy, and (7) an executive reflection.",
    'half-yearly':"You are a senior strategic performance analyst for the SCPNG. Review the half-yearly performance data. Provide exactly 7 impactful insights covering: (1) sustained strategic impact, (2) performance trajectory, (3) major hurdles, (4) trajectory towards annual goals, (5) recommendations for the next 6 months, and (6) an executive reflection.",
    yearly:       "You are a senior strategic performance analyst for the SCPNG. Review the annual performance data. Provide exactly 8 impactful insights covering: (1) major strategic wins, (2) key performance trends, (3) objectives accomplished vs missed, (4) systemic organizational challenges, (5) recommendations for next year, and (6) a comprehensive executive summary.",
  };
  return (map[timePeriod] || "You are a strategic performance analyst for the SCPNG. Analyze the following metrics and provide exactly 3 to 5 strategic insights.") + suffix;
}

// ─── Gemini API ───────────────────────────────────────────────────────────────

function _callGemini(prompt) {
  const url     = `${GEMINI_URL}?key=${GEMINI_API_KEY}`;
  const payload = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });

  const response = UrlFetchApp.fetch(url, {
    method:          'post',
    contentType:     'application/json',
    payload,
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  const json = JSON.parse(response.getContentText());

  if (code !== 200) {
    throw new Error(`Gemini ${code}: ${json?.error?.message || 'Unknown error'}`);
  }

  return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function _logRun(ss, runId, userEmail, unit, period, success, error) {
  const logSheet = ss.getSheetByName('Run_Log');
  if (logSheet) {
    logSheet.appendRow([new Date().toISOString(), runId, userEmail, unit, period, success, error]);
  }
}

/** Deletes SENT rows older than 14 days to keep the sheet clean. */
function _cleanupOldRows(qSheet, col) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const data     = qSheet.getDataRange().getValues();
  const toDelete = [];

  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][col['Status']] === 'SENT') {
      const processedAt = new Date(data[i][col['ProcessedAt']]);
      if (!isNaN(processedAt) && processedAt < cutoff) toDelete.push(i + 1);
    }
  }

  toDelete.forEach(rowNum => qSheet.deleteRow(rowNum));
  if (toDelete.length > 0) Logger.log(`Cleaned up ${toDelete.length} old SENT row(s).`);
}

/** Ensures a named sheet exists with the given headers frozen in row 1. */
function _ensureSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Converts the header row into a { headerName: columnIndex } map (0-based). */
function _buildColMap(headers) {
  const map = {};
  headers.forEach((h, i) => { map[String(h)] = i; });
  return map;
}
