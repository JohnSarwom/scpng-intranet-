# Report Scheduler & Power Automate Integration

**Created:** 2026-03-25 | **Last Updated:** 2026-03-27 14:30 PGT

---

## Overview

Automated recurring report system that allows each user to configure their own report schedule (period, categories, preferred time/day) via the intranet UI. A single Power Automate flow owned by `automation@scpng.gov.pg` reads these preferences from a SharePoint list and sends branded HTML email reports on schedule.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  SharePoint List: Report_Schedules                      │
│  (one row per user's report subscription)               │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
┌──────────────────┐      ┌──────────────────────────────┐
│  Intranet UI     │      │  Power Automate (1 flow)     │
│  (ReportsTab)    │      │  Owner: automation@scpng     │
│                  │      │                              │
│  User toggles    │      │  Recurrence: Daily 7AM PGT   │
│  schedule on/off │      │  1. Get all active rows      │
│  Writes to list  │      │  2. Filter: NextSendAt <= now│
│                  │      │  3. For each due user:       │
│                  │      │     - Query SP data          │
│                  │      │     - Build HTML report      │
│                  │      │     - Send email             │
│                  │      │     - Update NextSendAt      │
└──────────────────┘      └──────────────────────────────┘
```

## SharePoint List: Report_Schedules

**List name:** `Report_Schedules`
**Config key:** `OPS_CONFIG.LISTS.REPORT_SCHEDULES`

| Column | Type | Description |
|---|---|---|
| `Title` | Text | User display name |
| `UserEmail` | Text | e.g., `ekipongi@scpng.gov.pg` |
| `Division` | Text | e.g., `Corporate Services Division` |
| `Unit` | Text | e.g., `IT Unit` |
| `TimePeriod` | Text | `daily`, `weekly`, `monthly`, `quarterly`, `half-yearly`, `yearly` |
| `Categories` | Text (multiline) | JSON array e.g., `["tasks","kras","kpis","objectives"]` |
| `IsActive` | Text | `"true"` or `"false"` |
| `PreferredTime` | Text | 24hr format e.g., `"07:00"`, `"14:00"` |
| `PreferredDay` | Text | For weekly: `"Monday"`, `"Tuesday"`, etc. Empty otherwise |
| `PreferredDayOfMonth` | Text | For monthly+: `"1"`, `"15"`, etc. Empty for daily/weekly |
| `LastSentAt` | DateTime | When the last report was sent |
| `NextSendAt` | DateTime | When the next report is due |
| `ManagerEmail` | Text | Optional CC for manager |

**Design decisions:**
- `TimePeriod` and `IsActive` are Text (not Choice/Boolean) for simpler Graph API read/write
- `Categories` stored as JSON string for flexibility
- One row per user (upsert pattern in `saveReportSchedule`)

## Files

### Service Layer

**`src/services/sharePointOpsService.ts`**
- `createReportSchedulesList()` — creates the SP list with all columns
- `getReportSchedule(userEmail)` — fetches a user's existing schedule row
- `saveReportSchedule(schedule)` — creates or updates (upsert) a user's schedule
- `calculateNextSendAt(period, time, day, dayOfMonth)` — computes the next send date based on user preferences

**`src/services/powerAutomateService.ts`**
- `getFlowToken()` — acquires token for `https://service.flow.microsoft.com//.default` (separate from Graph API tokens)
- `listFlows()` — list all flows in the environment
- `listConnections()` — find SharePoint and Office 365 Outlook connector connections
- `findExistingReportFlow()` — check if the scheduler flow already exists
- `deployReportSchedulerFlow()` — builds and POSTs the full Logic Apps workflow definition
- `deleteFlow(flowName)` — remove a flow
- `buildReportSchedulerDefinition(connections)` — constructs the workflow JSON
- `buildStandardEmailTemplate()` — Power Automate expression for the fallback email (unknown periods)
- `buildDailyEmailTemplate()` — daily report email (table-based, card-style, work log, daily AI)
- `buildWeeklyEmailTemplate()` — weekly report email (date range header, vitals strip, 2x2 metrics, work log, weekly AI)
- `buildMonthlyEmailTemplate()` — monthly report email (month/year header, vitals strip, 2x2 metrics, work log, strategic AI)
- `buildQuarterlyEmailTemplate()` — quarterly report email (dynamic Q# badge, elevated styling, executive AI)
- `buildHalfYearlyEmailTemplate()` — half-yearly report email (dynamic H1/H2 badge, trajectory styling, strategic AI)
- `buildYearlyEmailTemplate()` — annual report email (dynamic year badge, gold AI accent #d4af37, "FY" avatar, "Annual Executive Assessment", "Annual KPI Achievement" labels)
- `buildStandardAIPromptExpression()` — Gemini prompt for fallback reports (3-5 general strategic insights)
- `buildDailyAIPromptExpression()` — Gemini prompt for daily (3-5 insights: accomplishments, blockers, next-day priorities)
- `buildWeeklyAIPromptExpression()` — Gemini prompt for weekly (5 insights: achievements, challenges, productivity, priorities, reflection)
- `buildMonthlyAIPromptExpression()` — Gemini prompt for monthly (6 insights: trends, achievements, bottlenecks, growth, priorities, reflection)
- `buildQuarterlyAIPromptExpression()` — Gemini prompt for quarterly (7 insights: strategic impact, trends, wins vs misses, bottlenecks, growth, forward strategy, executive reflection)
- `buildHalfYearlyAIPromptExpression()` — Gemini prompt for half-yearly (7 insights: sustained impact, trajectory, achievements vs gaps, capability growth, systemic challenges, forward strategy, mid-year reflection)
- `buildYearlyAIPromptExpression()` — Gemini prompt for yearly (8 insights: strategic impact, yearly trends, achievements vs misses, professional growth, systemic insights, forward strategy, annual executive reflection 5-6 sentences, legacy statement)

### UI Layer

**`src/components/unit-tabs/ReportsTab.tsx`**
- Report Generator card (existing) — instant on-demand report with preview, CSV export, print
- **Schedule Recurring Reports card (new)** — toggle switch, frequency selector, preferred time/day pickers, category checkboxes, CC manager email, save button
- Loads existing schedule on mount via `getReportSchedule()`
- Shows green banner with next scheduled send date when active

**`src/pages/TestGround.tsx`**
- "Initialize Report Schedules List" button — creates the SP list
- "Check Connections" button — verifies SharePoint + Outlook connectors exist for automation account
- "List Flows" button — validates Flow API auth
- "Deploy Report Scheduler Flow" button — one-click flow deployment

### Unit Page Integration

**`src/pages/Unit.tsx`**
- `ReportsTab` imported and rendered as the "Reports" tab
- Props: `tasks`, `kras`, `kpis`, `objectives`, `userContext`

## Power Automate Configuration

**Environment ID:** `Default-b173aac7-6781-4d49-a037-d874bd4a09ab`
**Flow API Base:** `https://api.flow.microsoft.com`
**Flow Owner:** `automation@scpng.gov.pg`
**Flow Name:** `SCPNG Intranet — Scheduled Report Dispatcher`

### Azure App Registration Permissions (Flow API)

These are configured on app `648a96d7-e3f5-4e13-8084-ba0b74dbb56f`:

| Permission | Type |
|---|---|
| `Flows.Manage.All` | Delegated |
| `Flows.Read.All` | Delegated |
| `Flows.Read.Plans` | Delegated |
| `Flows.Write.Plans` | Delegated |
| `Activity.Read.All` | Delegated |
| `Approvals.Manage.All` | Delegated |
| `Approvals.Read.All` | Delegated |
| `User` | Delegated (base) |

### Required Connector Connections

The automation@scpng.gov.pg account must have these connections established in Power Automate before deploying the flow:

1. **SharePoint** (`shared_sharepointonline`) — for querying lists
2. **Office 365 Outlook** (`shared_office365`) — for sending emails

If missing, create a simple test flow manually in Power Automate portal to establish them.

### Flow Logic

```
Trigger: Recurrence (Daily, 7:00 AM, Pacific/Port_Moresby timezone)
  │
  ├─► Get Items: Report_Schedules (filter: IsActive eq 'true')
  ├─► Get Items: InternalAppSettings (filter: Title eq 'GeminiAPIKey') [parallel]
  │
  ├─► Filter Array: NextSendAt <= utcNow()
  │
  └─► For Each due user:
        │
        ├─► Get Items: Operations_Tasks (filter by Unit)        ──┐
        ├─► Get Items: Performance_KRAs (filter by Unit)           │  [parallel data fetch]
        ├─► Get Items: Performance_KPIs (filter by Unit)           │
        ├─► Get Items: Unit_Objectives (filter by Unit)         ──┘
        │
        ├─► Compute_Task_Metrics, Filter_Completed/InProgress/Todo/Review_Tasks
        ├─► Compute_KRA_Metrics, Filter_Active/Completed_KRAs
        ├─► Compute_KPI_Metrics, Filter_OnTrack/AtRisk/Behind_KPIs
        │
        ├─► Select_Task_HTML: map tasks → HTML <tr> rows        ──┐  [all period templates]
        ├─► Build_Task_List_HTML: join() into single string     ──┘
        │
        ├─► Build_Standard_AI_Prompt (fallback insights)        ──┐
        ├─► Build_Daily_AI_Prompt (daily-focused, 3-5)             │
        ├─► Build_Weekly_AI_Prompt (weekly, 5 insights)            │  [all 7 built in parallel]
        ├─► Build_Monthly_AI_Prompt (monthly, 6 insights)          │
        ├─► Build_Quarterly_AI_Prompt (quarterly, 7 insights)      │
        ├─► Build_HalfYearly_AI_Prompt (half-yearly, 7 insights)   │
        ├─► Build_Yearly_AI_Prompt (yearly, 8 insights)            │
        ├─► Build_AI_Prompt (7-way selector)                    ──┘
        │
        ├─► HTTP: Call Gemini API (gemini-2.0-flash)
        ├─► Extract_AI_Response (graceful fallback on failure)
        │
        ├─► Build_Standard_Email (fallback template)            ──┐
        ├─► Build_Daily_Email (card-style daily)                   │
        ├─► Build_Weekly_Email (date range, vitals strip)          │  [all 7 built in parallel]
        ├─► Build_Monthly_Email (month/year, strategic)            │
        ├─► Build_Quarterly_Email (Q# badge, executive)            │
        ├─► Build_HalfYearly_Email (H# badge, trajectory)         │
        ├─► Build_Yearly_Email (FY badge, gold accent, annual)     │
        ├─► Build_Email_Body (7-way selector)                   ──┘
        │
        ├─► Send Email V2
        │   From: automation@scpng.gov.pg
        │   To: user's email
        │   Subject: "{period} Report — {unit} — {date}"
        │
        ├─► Calculate_Next_Send
        │   daily → +1 day, weekly → +7 days, monthly → +30 days
        │   quarterly → +90 days, half-yearly → +182 days, yearly → +365 days
        │
        └─► Update_Schedule: Report_Schedules
            LastSentAt = utcNow()
            NextSendAt = calculated date
```

### NextSendAt Calculation (Client-side, on schedule save)

| Period | Logic |
|---|---|
| `daily` | Tomorrow at PreferredTime |
| `weekly` | Next [PreferredDay] at PreferredTime |
| `monthly` | [PreferredDayOfMonth] of next month at PreferredTime |
| `quarterly` | [PreferredDayOfMonth] of next quarter start (Jan/Apr/Jul/Oct) |
| `half-yearly` | [PreferredDayOfMonth] of next half (Jan/Jul) |
| `yearly` | [PreferredDayOfMonth] of next January |
| `custom` (one-time) | Send once, then `'DEACTIVATE'` → sets `IsActive = 'false'` |
| `custom` (rolling) | `addDays(utcNow(), CustomIntervalDays)` |

## Email Templates

The flow uses an **8-template architecture** (expanded 2026-03-27): each report period gets a unique, progressively richer email template. An 8-way `@if()` selector picks the right template based on `TimePeriod`. All templates use table-based HTML with inline styles for maximum email client compatibility.

### Standard Template (fallback for unknown periods)

Method: `buildStandardEmailTemplate()` | Used by: `Build_Standard_Email` action

- **Header:** SCPNG maroon (#83002A) background with period, unit, division, date
- **Sections:** Task Performance, Key Result Areas, KPIs, Objectives — each with metric cards using CSS flexbox
- **AI Strategic Insights:** Conditional section with maroon left-border, gradient background, and "GEMINI AI" badge
- **CTA:** "View Full Report in Intranet" button
- **Footer:** Confidentiality notice + SCPNG branding
- **CSS approach:** Uses `<style>` block + class-based styling (simpler but less email-client compatible)

### Daily Report Template

Method: `buildDailyEmailTemplate()` | Used by: `Build_Daily_Email` action

Card-style design adapted for email (no JavaScript, table-based layout, all inline styles). Sections:

1. **Maroon Header** (`#800020`) — "Automated Daily Report" label, "Daily Report" title, unit/division, full date with day name (e.g., "Thursday, 26 March 2026")
2. **Sender Bar** (darker maroon `#6b001a`) — "Automated Intranet System" left, "Prepared for {Name}" right
3. **Summary Stats Bar** — 4-column layout: Tasks, KRAs, KPIs, Objectives (large maroon numbers)
4. **Metrics Detail Grid** — 2x2 table of metric boxes:
   - **Task Performance:** Done (green), In Progress (blue), Review (amber), To Do (grey) — color-coded counts
   - **Key Result Areas:** Active (blue), Completed (green)
   - **Key Performance Indicators:** On Track (green), At Risk (amber), Behind (red)
   - **Objectives:** Total count
5. **Work Log** — Direct task list table with maroon header row
6. **AI Strategic Analysis** — `#fdf5f7` background, `4px solid #800020` left border, "GEMINI AI" badge
7. **CTA Button** — "View Full Report in Intranet"
8. **Footer** — "Confidential — {Unit} — Securities Commission of Papua New Guinea"

### Weekly Report Template

Method: `buildWeeklyEmailTemplate()` | Used by: `Build_Weekly_Email` action | Added: 2026-03-27 ~12:00 PGT

1. **Maroon Header** (`#800020`) — "Weekly Report" title, date range (e.g., "21–27 March 2026") computed via `addDays(utcNow(), -6)`
2. **Department Bar** — Unit - Division, "Securities Commission of Papua New Guinea"
3. **Summary Stats** — 4-column: Tasks (completed/total), KRAs, KPIs, Objectives
4. **Weekly Vitals Strip** — 3-column: Total Tasks, computed Completion % (green), In Progress count
5. **Sender Info** — "W" icon avatar, "Automated Weekly Aggregation", "Prepared for {Name}"
6. **2x2 Metrics Grid** — Task Volume, Key Result Areas, KPI Status, Objectives Progress — with color-coded breakdown badges (green=good `#e6f4ea`, amber=warn `#fef7e0`, red=bad `#fce8e6`)
7. **Weekly Work Log** — Full task list table
8. **AI Weekly Performance Analysis** — Dashed border separator, "GEMINI AI" badge, insights as styled table rows
9. **CTA** — "View Full Weekly Report"
10. **Footer** — Automated weekly report notice

### Monthly Report Template

Method: `buildMonthlyEmailTemplate()` | Used by: `Build_Monthly_Email` action | Added: 2026-03-27 ~12:30 PGT

1. **Maroon Header** — "Monthly Report" title, month name + year (e.g., "March 2026")
2. **Department Bar** — Unit - Division
3. **Summary Stats** — 4-column: Tasks (completed/total), KRAs, KPIs, Objectives
4. **Monthly Vitals Strip** — Total Tasks, Completion %, "{Month} Summary" (blue text)
5. **Sender Info** — "M" icon avatar, "Automated Monthly Aggregation", "Prepared for {Name}"
6. **2x2 Metrics Grid** — Monthly Task Volume, Key Result Areas, KPI Performance, Objectives Progress — color-coded badges
7. **Monthly Work Log** — Full task list table
8. **AI Strategic Performance & Impact Analysis** — "GEMINI AI" badge, insights as styled rows
9. **CTA** — "View Monthly Executive Summary"
10. **Footer** — Automated monthly report notice

### Quarterly Report Template

Method: `buildQuarterlyEmailTemplate()` | Used by: `Build_Quarterly_Email` action | Added: 2026-03-27 ~13:00 PGT

Elevated executive styling with larger padding, shadows, and uppercase headers.

1. **Maroon Header** — "QUARTERLY REPORT" (uppercase), dynamic Q# pill badge (e.g., "Q1 2026") computed from current month
2. **Department Bar** — Unit - Division
3. **Summary Stats** — 4-column with larger padding
4. **Quarterly Vitals Strip** — Total Tasks, Completion %, "Q# Summary" (purple text `#6a41a4`)
5. **Sender Info** — Maroon "Q" avatar with box-shadow, "Quarterly Strategic Assessment", "Prepared for {Name}"
6. **2x2 Metrics Grid** — Quarterly Volume, Key Result Areas, Q# KPI Status, Strategic Objectives — color-coded badges including blue "Review" (`#e8f0fe` / `#1967d2`)
7. **Quarterly Work Log** — Full task list table
8. **AI Q# Executive Review** — "GEMINI AI" badge, insights as styled rows with extra line-height
9. **CTA** — "View Complete Q# Dossier" (with box-shadow)
10. **Footer** — Uppercase confidential notice

**Dynamic Q# computation:** `if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 3), '1', if(...6..., '2', if(...9..., '3', '4')))`

### Half-Yearly Report Template

Method: `buildHalfYearlyEmailTemplate()` | Used by: `Build_HalfYearly_Email` action | Added: 2026-03-27 ~14:00 PGT

Trajectory-focused executive styling matching the quarterly elevated design.

1. **Maroon Header** — "HALF-YEARLY REPORT" (uppercase), dynamic H1/H2 pill badge (e.g., "H1 2026")
2. **Department Bar** — Unit - Division
3. **Summary Stats** — 4-column with larger padding
4. **Half-Yearly Vitals Strip** — Total Tasks, Completion %, "H# Performance Review" (blue text `#0052cc`)
5. **Sender Info** — Maroon "H1"/"H2" text avatar with box-shadow, "H# Strategic Assessment", "Prepared for {Name}"
6. **2x2 Metrics Grid** — H# Task Volume, Key Result Areas, H# KPI Trajectory, Strategic Objectives — color-coded badges including blue "Review"
7. **H# Work Log** — Full task list table
8. **AI H# Strategic Performance & Trajectory** — "GEMINI AI" badge, insights with extra line-height
9. **CTA** — "View Complete H# Performance Dossier" (with box-shadow)
10. **Footer** — Uppercase confidential notice

**Dynamic H# computation:** `if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '1', '2')`

### Yearly (Annual) Report Template

Method: `buildYearlyEmailTemplate()` | Used by: `Build_Yearly_Email` action | Added: 2026-03-27

The most elevated template with gold accent AI section and comprehensive annual styling.

1. **Maroon Header** — "ANNUAL REPORT" (uppercase), dynamic year badge (e.g., "2026")
2. **Department Bar** — Unit - Division
3. **Summary Stats** — 4-column: Tasks (completed/total), KRAs, KPIs, Objectives
4. **Annual Vitals Strip** — Total Tasks, Overall Completion % (green), "{Year} Annual Review" (gold text `#d4af37`)
5. **Sender Info** — Maroon "FY" avatar with box-shadow, "Annual Executive Assessment", "Prepared for {Name}"
6. **2x2 Metrics Grid** — Annual Task Volume, Key Result Areas, Annual KPI Achievement, Strategic Objectives — color-coded badges
7. **{Year} Work Log** — Full task list table
8. **AI Annual Strategic Performance & Impact** — Gold accent styling (`background:#fdfaf0`, `border-left:4px solid #d4af37`, `border:1px solid #f6eacc`), "GEMINI AI" badge, insights with gold separators
9. **CTA** — "View Complete {Year} Annual Dossier" (with box-shadow, larger padding 18px 36px)
10. **Footer** — "Confidential Annual Review Document" uppercase notice

**Key design distinctions from half-yearly:**
- Gold accent (`#d4af37`) on vitals strip and AI section (vs blue for half-yearly)
- "FY" avatar text (vs "H1"/"H2")
- Gold-tinted AI insight background (`#fdfaf0`) with gold left border and separators
- "Annual Executive Assessment" title (vs "H# Strategic Assessment")
- Larger CTA button padding

### Custom Date Range Report Template

Method: `buildCustomEmailTemplate()` | Used by: `Build_Custom_Email` action | Added: 2026-03-27

Dedicated template for user-defined date windows (one-time or rolling).

1. **Maroon Header** — "CUSTOM DATE RANGE REPORT", date range badge (e.g., "15 Feb – 20 Mar 2026")
2. **Department Bar** — Unit - Division
3. **Summary Stats** — 4-column from custom date-filtered metrics
4. **Custom Vitals Strip** — Tasks in Range, Completion %, Window Type ("One-Time Report" or "Rolling Window")
5. **Sender Info** — Maroon "DR" avatar, "Custom Date Range Analysis", "Prepared for {Name}"
6. **2x2 Metrics Grid** — Task Volume, Key Result Areas, KPI Performance, Strategic Objectives — from `Filter_Custom_*` actions
7. **Work Log** — Tasks within date range
8. **AI Custom Date Range Analysis** — Blue accent (`background:#f0f4ff`, `border-left:4px solid #0052cc`), 5 window-focused insights
9. **CTA** — "View Full Date Range Report"
10. **Footer** — Confidential notice

**19 new flow actions** support this template (date-range filters, custom status filters, custom metrics) — zero impact on existing actions.

### Template Selection Logic

```
Build_Email_Body.inputs =
  @if(equals(TimePeriod, 'daily'), outputs('Build_Daily_Email'),
    if(equals(TimePeriod, 'weekly'), outputs('Build_Weekly_Email'),
      if(equals(TimePeriod, 'monthly'), outputs('Build_Monthly_Email'),
        if(equals(TimePeriod, 'quarterly'), outputs('Build_Quarterly_Email'),
          if(equals(TimePeriod, 'half-yearly'), outputs('Build_HalfYearly_Email'),
            if(equals(TimePeriod, 'yearly'), outputs('Build_Yearly_Email'),
              if(equals(TimePeriod, 'custom'), outputs('Build_Custom_Email'),
                outputs('Build_Standard_Email')
              )
            )
          )
        )
      )
    )
  )
```

All 8 templates are built in parallel Compose actions. The `Build_Email_Body` selector picks one based on `TimePeriod`. `Send_Report_Email` always references `outputs('Build_Email_Body')`.

**CSS approach (all custom templates):** Fully inline styles, table-based layout, `cellpadding`/`cellspacing`/`border` attributes for maximum email client compatibility (Outlook, Gmail, Apple Mail).

### AI Integration

**API Key:** Fetched at runtime from SharePoint `InternalAppSettings` list (key: `GeminiAPIKey`)
**Model:** `gemini-2.0-flash` via `generativelanguage.googleapis.com/v1/models/`
**Graceful degradation:** If key not found, API fails, or times out, the email sends without the AI section

#### Standard AI Prompt (`buildStandardAIPromptExpression`)
- Role: "strategic performance analyst for SCPNG"
- Input: all computed metrics (counts only)
- Output: 3-5 general strategic insights separated by `||INSIGHT||`
- Focus: patterns, risks, strengths, recommendations

#### Daily AI Prompt (`buildDailyAIPromptExpression`)
- Output: 3-5 daily-focused insights separated by `||INSIGHT||`
- Focus: (1) what was accomplished today, (2) risks/blockers/overdue items, (3) recommended priorities for next working day

#### Weekly AI Prompt (`buildWeeklyAIPromptExpression`)
- Output: exactly 5 insights separated by `||INSIGHT||`
- Input includes: computed completion rate percentage
- Focus: (1) top achievements, (2) challenges/blockers, (3) productivity observation from completion rate, (4) next-week priorities, (5) weekly reflection

#### Monthly AI Prompt (`buildMonthlyAIPromptExpression`)
- Output: exactly 6 insights separated by `||INSIGHT||`
- Input includes: computed completion rate percentage
- Focus: (1) performance trends, (2) key achievements & strategic impact, (3) systemic bottlenecks, (4) skill growth/development, (5) next-month priorities, (6) executive reflection (2-3 sentences)

#### Quarterly AI Prompt (`buildQuarterlyAIPromptExpression`)
- Output: exactly 7 insights separated by `||INSIGHT||`
- Input includes: dynamic Q# period label, completion rate
- Focus: (1) strategic contributions & organizational impact, (2) 3-month performance trends, (3) achievements vs missed targets, (4) organizational bottlenecks, (5) professional growth & leadership, (6) next-quarter forward strategy, (7) executive reflection (3-4 sentences)

#### Half-Yearly AI Prompt (`buildHalfYearlyAIPromptExpression`)
- Output: exactly 7 insights separated by `||INSIGHT||`
- Input includes: dynamic H# period label, completion rate
- Focus: (1) sustained strategic impact & major deliverables, (2) Q-over-Q performance trajectory, (3) achievements vs gaps, (4) capability & role growth, (5) systemic challenges persisting across the half-year, (6) next-half forward strategy, (7) mid-year executive reflection (4-5 sentences)

#### Yearly AI Prompt (`buildYearlyAIPromptExpression`)
- Output: exactly 8 insights separated by `||INSIGHT||`
- Input includes: "Full Year {yyyy}" period label, completion rate
- Focus: (1) strategic impact & major value creation with measurable business impact, (2) yearly performance trends across all 4 quarters, (3) key achievements vs missed targets, (4) professional growth & leadership development, (5) systemic organizational insights & persistent challenges, (6) forward strategy for next year (scale, optimize, culture), (7) comprehensive annual executive reflection (5-6 sentences), (8) single-sentence legacy statement defining the year's ultimate contribution

#### Custom AI Prompt (`buildCustomAIPromptExpression`)
- Output: exactly 5 insights separated by `||INSIGHT||`
- Input includes: custom metrics from `Compute_Custom_*` actions, date window start/end, window type (one-time vs rolling)
- Focus: (1) activity and output within window, (2) velocity and throughput, (3) risks and overdue items, (4) KRA/KPI trends, (5) recommendations for next period

#### Prompt Selection Logic
```
Build_AI_Prompt.inputs =
  @if(equals(TimePeriod, 'daily'), outputs('Build_Daily_AI_Prompt'),
    if(equals(TimePeriod, 'weekly'), outputs('Build_Weekly_AI_Prompt'),
      if(equals(TimePeriod, 'monthly'), outputs('Build_Monthly_AI_Prompt'),
        if(equals(TimePeriod, 'quarterly'), outputs('Build_Quarterly_AI_Prompt'),
          if(equals(TimePeriod, 'half-yearly'), outputs('Build_HalfYearly_AI_Prompt'),
            if(equals(TimePeriod, 'yearly'), outputs('Build_Yearly_AI_Prompt'),
              if(equals(TimePeriod, 'custom'), outputs('Build_Custom_AI_Prompt'),
                outputs('Build_Standard_AI_Prompt')
              )
            )
          )
        )
      )
    )
  )
```

All 8 prompts are built in parallel Compose actions. The `Build_AI_Prompt` selector picks one. `Call_Gemini_API` always references `outputs('Build_AI_Prompt')`.

#### Insight Count by Period

| Period | Insights | Reflection Length |
|---|---|---|
| Daily | 3-5 | N/A |
| Weekly | 5 | 1-2 sentences |
| Monthly | 6 | 2-3 sentences |
| Quarterly | 7 | 3-4 sentences |
| Half-Yearly | 7 | 4-5 sentences |
| Yearly | 8 | 5-6 sentences + 1-sentence legacy statement |
| Custom | 5 | N/A (window-focused insights) |
| Standard (fallback) | 3-5 | N/A |

### Work Log (Daily Only)

Two new flow actions build the direct task list for the daily email:

1. **`Select_Task_HTML`** (Select action) — Maps each task from `Get_Tasks` to an HTML `<tr>` row:
   ```
   @concat('<tr><td style="...">', item()?['Title'], '</td>
           <td align="right" style="...">', item()?['Status'], '</td></tr>')
   ```
   Uses Power Automate's doubled single-quote escaping (`''`) for HTML attributes inside expression strings.

2. **`Build_Task_List_HTML`** (Compose action) — `@join(body('Select_Task_HTML'), '')` to flatten the string array into a single HTML string.

Referenced in the daily email template as `outputs('Build_Task_List_HTML')` inside the work log `<table>`.

## UI Schedule Options

### Time Options
6:00 AM, 7:00 AM, 8:00 AM, 9:00 AM, 10:00 AM, 12:00 PM, 2:00 PM, 4:00 PM, 5:00 PM

### Conditional Fields
| Period | Shows Time | Shows Day of Week | Shows Day of Month |
|---|---|---|---|
| Daily | Yes | -- | -- |
| Weekly | Yes | Yes (Mon-Fri) | -- |
| Monthly | Yes | -- | Yes (1-28) |
| Quarterly | Yes | -- | Yes (1-28) |
| Half-yearly | Yes | -- | Yes (1-28) |
| Yearly | Yes | -- | Yes (1-28) |

## Setup Procedure

1. Log in as `automation@scpng.gov.pg`
2. Go to TestGround page
3. Click **"Initialize Report Schedules List"** — creates the SharePoint list
4. Click **"Check Connections"** — verify SharePoint + Outlook connections exist
5. Click **"List Flows"** — verify Flow API auth works
6. Click **"Deploy Report Scheduler Flow"** — deploys the master flow
7. Verify in Power Automate portal: `make.powerautomate.com/environments/Default-b173aac7-6781-4d49-a037-d874bd4a09ab/flows`

## Organization Users (32 staff)

The system supports all SCPNG staff across divisions:
- **Executive Division:** James Joshua (Acting CEO), Andy Ambulu, Ninipe Gurumo
- **Corporate Services Division:** Sam Taki (Director), Eric Kipongi, John Sarwom, Donald Samson, Mercy Tipitap, Anita Kosnga, Thomas Mondaya, Lovelyn Karlyo, Sophia Marai, Mark Timea, Leah Samuel, Lenome Rex MBalupa, Laviniah Michael
- **Legal Services Division:** Tyson Yapao, Isaac Mel, Immanuel Minoga, Tony Kawas
- **Licensing Market & Supervision Division:** Zomay Apini, Esther Alia, Jacob Kom, Kylie Karis, Leeroy Wambillie, Regina Wai, Harold Mek Kape, Enly Yakop
- **Research & Publication Division:** Joy Komba, Max Siwi, Rosie Stevenou
- **IT Consultant:** Monica Abau-Sapulai

## Deployment Notes

After any changes to `powerAutomateService.ts`:
1. The existing flow must be **deleted** first (TestGround "Delete Flow" button, or Power Automate portal)
2. Then **redeployed** via "Deploy Report Scheduler Flow" button
3. The deploy checks for an existing flow and returns early if found — always delete first

### InternalAppSettings Prerequisite
The `InternalAppSettings` SharePoint list must have a row with:
- `Title` = `GeminiAPIKey`
- `Value` = your Google Gemini API key

Without this, the AI sections will silently skip (graceful fallback).

## Changelog

### 2026-03-27 — Custom Date Range Reports (8th Template)

**Time:** ~17:00–18:30 PGT | **Files:** `powerAutomateService.ts`, `sharePointOpsService.ts`, `division.types.ts`, `ReportsTab.tsx`

**What changed:**
Added the 8th report template for custom date ranges. Users can schedule one-time reports (fixed start/end dates, auto-deactivates after send) or rolling window reports (last N days, recurring every M days). 19 new flow actions handle date-range filtering — zero impact on existing templates.

**New SharePoint columns** on `Report_Schedules`: `CustomStartDate`, `CustomEndDate`, `RollingWindowDays`, `CustomIntervalDays`, `IsOneTime`

**New flow actions (19):**
- `Compute_Custom_Start`, `Compute_Custom_End` — date window computation
- `Filter_Tasks_InDateRange`, `Filter_KRAs_InDateRange`, `Filter_KPIs_InDateRange` — date-scoped data filtering
- 9 custom status filters (`Filter_Custom_*`)
- 3 custom metrics (`Compute_Custom_*`)
- `Build_Custom_AI_Prompt`, `Build_Custom_Email`

**UI additions:** One-Time vs Rolling Window toggle, date pickers (one-time), window/interval inputs (rolling), live preview text, admin table shows "Custom (One-Time)" or "Custom (Rolling)" badges.

**Selectors:** Both `Build_AI_Prompt` and `Build_Email_Body` updated to 8-way: `daily → weekly → monthly → quarterly → half-yearly → yearly → custom → standard`

---

### 2026-03-27 — 7-Template Architecture (Weekly, Monthly, Quarterly, Half-Yearly, Yearly)

**Time:** ~12:00–16:00 PGT | **File:** `src/services/powerAutomateService.ts`

**What changed:**
The Power Automate flow was expanded from a dual-template architecture (daily + standard) to a full **7-template architecture**. Each report period now receives a unique, progressively richer email template with period-specific AI prompts. The templates scale in complexity and insight depth from daily (3-5 insights) through yearly (8 insights with 5-6 sentence reflections and a legacy statement).

**New flow actions added (inside `Process_Each_User` foreach loop):**

| Action | Type | Purpose |
|---|---|---|
| `Build_Weekly_AI_Prompt` | Compose | Weekly-focused prompt (5 insights: achievements, challenges, productivity, priorities, reflection) |
| `Build_Monthly_AI_Prompt` | Compose | Monthly strategic prompt (6 insights: trends, achievements, bottlenecks, growth, priorities, reflection) |
| `Build_Quarterly_AI_Prompt` | Compose | Quarterly executive prompt (7 insights: strategic impact, trends, wins vs misses, bottlenecks, growth, forward strategy, reflection) |
| `Build_HalfYearly_AI_Prompt` | Compose | Half-yearly trajectory prompt (7 insights: sustained impact, Q-over-Q trajectory, gaps, capability growth, systemic challenges, forward strategy, reflection) |
| `Build_Yearly_AI_Prompt` | Compose | Annual executive prompt (8 insights: strategic impact, yearly trends, achievements vs misses, professional growth, systemic insights, forward strategy, annual reflection, legacy statement) |
| `Build_Weekly_Email` | Compose | Weekly card-style email template |
| `Build_Monthly_Email` | Compose | Monthly strategic email template |
| `Build_Quarterly_Email` | Compose | Quarterly executive email template |
| `Build_HalfYearly_Email` | Compose | Half-yearly trajectory email template |
| `Build_Yearly_Email` | Compose | Annual executive email template with gold accent AI section |

**Selectors updated:**
- `Build_AI_Prompt` — now 7-way: `daily → weekly → monthly → quarterly → half-yearly → yearly → standard`
- `Build_Email_Body` — now 7-way: same branching order

**Methods added:**
- `buildWeeklyEmailTemplate()` — date range header, dept info, 4-col stats, vitals strip with completion %, 2x2 color-coded badges, work log, AI weekly analysis
- `buildWeeklyAIPromptExpression()` — 5 insights covering achievements, challenges, productivity, priorities, reflection
- `buildMonthlyEmailTemplate()` — month/year header, vitals strip, "M" icon avatar, 2x2 metrics, work log, AI strategic analysis
- `buildMonthlyAIPromptExpression()` — 6 insights with executive reflection
- `buildQuarterlyEmailTemplate()` — uppercase header, dynamic Q# pill badge, elevated styling (shadows, larger padding), maroon "Q" avatar, blue Review badges, work log, AI executive review
- `buildQuarterlyAIPromptExpression()` — 7 insights with 3-4 sentence executive reflection
- `buildHalfYearlyEmailTemplate()` — uppercase header, dynamic H1/H2 badge, "H#" text avatar, "H# KPI Trajectory" labels, work log, AI strategic trajectory analysis
- `buildHalfYearlyAIPromptExpression()` — 7 insights with 4-5 sentence mid-year reflection
- `buildYearlyEmailTemplate()` — uppercase header, dynamic year badge, "FY" avatar, gold accent AI section (#d4af37), "Annual KPI Achievement" labels, larger CTA
- `buildYearlyAIPromptExpression()` — 8 insights with 5-6 sentence annual reflection + 1-sentence legacy statement

**Design decisions:**
- Each template progressively elevates in visual weight: daily (standard maroon) → weekly (card-style) → monthly (strategic) → quarterly/half-yearly (executive with shadows, uppercase, pill badges) → yearly (gold accent, largest CTA)
- Dynamic period labels (Q1-Q4, H1-H2, FY year) computed at runtime via Power Automate expressions using `formatDateTime(utcNow(), 'M')` and `lessOrEquals(int(...))` branching
- All templates include the work log (`Build_Task_List_HTML`) for consistency
- AI insight count scales with period scope: 3-5 (daily/standard) → 5 (weekly) → 6 (monthly) → 7 (quarterly/half-yearly) → 8 (yearly)
- Yearly template uses gold accent (#d4af37) for AI section to distinguish from half-yearly's blue — gold connotes "ultimate annual value"
- Yearly AI prompt uniquely requests a "legacy statement" (insight #8) as a single defining sentence
- Half-yearly prompts ask for Q-over-Q trajectory comparison; quarterly prompts ask for wins-vs-misses analysis
- Color-coded badges use consistent semantic palette: green (`#e6f4ea`/`#1e8e3e`), amber (`#fef7e0`/`#b08d00`), red (`#fce8e6`/`#d93025`), blue (`#e8f0fe`/`#1967d2`)
- All 7 email templates and all 7 AI prompts are built in parallel Compose actions — the selectors pick the right one, avoiding complex If/Else branching in Power Automate

**Updated action dependency graph:**
```
Get_Tasks → Select_Task_HTML → Build_Task_List_HTML ─────────────────────────────┐
         → Filter_*/Compute_* metrics ──────────────────────────────────────────┤
                                                                                 │
    ┌── Build_Standard_AI_Prompt ──┐                                             │
    ├── Build_Daily_AI_Prompt ─────┤                                             │
    ├── Build_Weekly_AI_Prompt ────┤  [all 7 parallel]                           │
    ├── Build_Monthly_AI_Prompt ───┤                                             │
    ├── Build_Quarterly_AI_Prompt ─┤                                             │
    ├── Build_HalfYearly_AI_Prompt ┤                                             │
    ├── Build_Yearly_AI_Prompt ────┤                                             │
    └──────────────────────────────┘                                             │
                  │                                                              │
                  ▼                                                              │
           Build_AI_Prompt (7-way selector)                                      │
                  │                                                              │
                  ▼                                                              │
           Call_Gemini_API → Extract_AI_Response ────────────────────────────────┤
                                                                                 │
    ┌── Build_Standard_Email ──┐                                                 │
    ├── Build_Daily_Email ─────┤                                                 │
    ├── Build_Weekly_Email ────┤  [all 7 parallel, depend on AI + Task List]     │
    ├── Build_Monthly_Email ───┤◄────────────────────────────────────────────────┘
    ├── Build_Quarterly_Email ─┤
    ├── Build_HalfYearly_Email ┤
    ├── Build_Yearly_Email ────┤
    └──────────────────────────┘
                  │
                  ▼
           Build_Email_Body (7-way selector) → Send_Report_Email
```

---

### 2026-03-26 — Daily Report Card Template & Dual-Template Architecture

**Time:** ~21:41 PGT | **File:** `src/services/powerAutomateService.ts`

**What changed:**
The Power Automate flow was updated from a single email template to a dual-template architecture. Daily reports now receive a richer, card-style email with a direct work log and daily-focused AI insights. All other report periods continue using the original template.

**New flow actions added (inside `Process_Each_User` foreach loop):**
| Action | Type | Purpose |
|---|---|---|
| `Select_Task_HTML` | Select | Maps each task to an HTML `<tr>` row (title + status) |
| `Build_Task_List_HTML` | Compose | `join()` flattens the array into one HTML string |
| `Build_Standard_AI_Prompt` | Compose | Existing prompt, renamed from `Build_AI_Prompt` |
| `Build_Daily_AI_Prompt` | Compose | New daily-focused prompt (accomplishments, blockers, next-day priorities) |
| `Build_AI_Prompt` | Compose | Selector: `@if(TimePeriod == 'daily', daily, standard)` |
| `Build_Standard_Email` | Compose | Existing template, renamed from `Build_Email_Body` |
| `Build_Daily_Email` | Compose | New card-style daily email template |
| `Build_Email_Body` | Compose | Selector: `@if(TimePeriod == 'daily', daily, standard)` |

**Methods added:**
- `buildDailyEmailTemplate()` — table-based, inline-style HTML email (640px max-width, maroon branding, 2x2 metrics grid, work log table, AI analysis section, CTA, footer)
- `buildDailyAIPromptExpression()` — daily-focused Gemini prompt asking about accomplishments, blockers, and next-day priorities

**Methods renamed (no logic change):**
- `buildEmailHtmlTemplate()` → `buildStandardEmailTemplate()`
- `buildAIPromptExpression()` → `buildStandardAIPromptExpression()`

**Design decisions:**
- Email uses tables + inline styles (not CSS Grid/flexbox) for maximum email client compatibility
- The user's original interactive card design (JS toggle, CSS transitions) was adapted to a flat, fully-expanded email layout since email clients don't support JavaScript
- Both templates are built in parallel Compose actions; a selector picks the right one — avoids complex If/Else branching in Power Automate
- Work log uses `Select` action (not `Apply to Each` + variable) to keep the flow definition simpler
- HTML attribute quotes use Power Automate's doubled single-quote escaping (`''`) inside expression strings to avoid JSON escaping conflicts
- AI prompt for daily reports uses the same `||INSIGHT||` delimiter format as standard reports for consistent parsing

**Action dependency graph (daily path):**
```
Get_Tasks → Select_Task_HTML → Build_Task_List_HTML ─────┐
         → Filter_*/Compute_* metrics ──────────────────┤
                                                         ├─► Build_Daily_AI_Prompt ──┐
                                                         ├─► Build_Standard_AI_Prompt │
                                                         │                           ├─► Build_AI_Prompt
                                                         │                           │     → Call_Gemini_API
                                                         │                           │       → Extract_AI_Response
                                                         │                           │         ├─► Build_Daily_Email ──┐
                                                         │                           │         ├─► Build_Standard_Email │
                                                         │                           │         │                       ├─► Build_Email_Body
                                                         │                           │         │                       │     → Send_Report_Email
```

### 2026-03-25 — Initial Implementation

Initial report scheduler with Power Automate flow deployment, single email template, Gemini AI integration, and ReportsTab schedule UI. See full doc above for original architecture.

## Related Documentation

- [Task Attachments](./task-attachments.md) — file upload patterns
- [Task Groups Architecture](../history/TASK_GROUPS_ARCHITECTURE.md) — board/group system
- [UI Patterns](../guides/ui-patterns.md) — component conventions
- [Power Automate API Integration Guide](../guides/power-automate-api-integration.md) — API errors, JSON format, diagrams
