# Report Scheduler — Google Sheets + GAS Architecture

**Date:** 2026-03-30
**Status:** Design decided, implementation pending

---

## Background

The existing Power Automate flow "SCPNG Intranet — Scheduled Report Dispatcher" was found suspended with the banner:

> "Your premium flows are turned off. Purchase, extend, or renew a Power Automate license."

**Root cause:** The flow contained an `Http` action type to call the Gemini AI API. The `Http` action requires Power Automate Premium. There is no way to call an external API from a Power Automate flow without either `Http` (premium) or a Custom Connector (also premium).

---

## Decision

Replace the single PA flow with a three-part system:

1. **PA Flow 1 — Dispatch** (standard connectors only = free)
2. **Google Apps Script** (free, handles the Gemini AI call)
3. **PA Flow 2 — Send** (standard connectors only = free)

Google Sheets acts as the processing queue/audit layer between the two PA flows. Google Sheets connector in Power Automate is a standard (free) connector — confirmed from the PA UI.

---

## Architecture

```
User saves schedule
  └── SharePoint: Report_Schedules [unchanged]

PA Flow 1 — "Dispatch" (every 30 min)
  ├── Get active schedules from Report_Schedules (SharePoint)
  ├── Filter: NextSendAt <= utcNow() AND IsActive = 'true'
  ├── For each due schedule (concurrent, up to 20):
  │     ├── Fetch Tasks/KRAs/KPIs from SharePoint
  │     └── Insert row → Google Sheets: "AI_Queue" tab
  │           { RunId, UserEmail, Unit, TimePeriod, DataJSON, Status: PENDING }
  └── Done — no waiting

Google Apps Script — Time trigger every 5 minutes
  ├── Read all rows from AI_Queue where Status = PENDING
  ├── For each row (2s delay between calls to stay under Gemini rate limit):
  │     ├── Call Gemini API (UrlFetchApp — free in GAS)
  │     ├── Write AI summary → "AI_Responses" tab { RunId, AISummary, GeneratedAt }
  │     └── Mark AI_Queue row Status → READY
  └── Done

PA Flow 2 — "Send" (every 15 min, offset from Flow 1)
  ├── Read all rows from AI_Queue where Status = READY
  ├── For each row (concurrent):
  │     ├── Get matching AI summary from AI_Responses by RunId
  │     ├── Build full HTML email (embed AI summary into existing template)
  │     ├── Send via Office 365 Outlook (standard connector)
  │     ├── Update NextSendAt in Report_Schedules (SharePoint)
  │     └── Mark AI_Queue row Status → SENT
  └── Done
```

---

## Google Sheet Structure

**Sheet ID:** stored as GAS Script Property `SHEET_ID`

| Tab | Purpose |
|-----|---------|
| `AI_Queue` | Processing queue — PA writes PENDING rows, GAS marks READY, Flow 2 marks SENT |
| `AI_Responses` | Every AI summary keyed by RunId |
| `Run_Log` | Audit trail: timestamp, email, period, sent status, errors |

### AI_Queue columns

| RunId | UserEmail | Unit | TimePeriod | DataJSON | Status | CreatedAt | ProcessedAt |
|-------|-----------|------|------------|----------|--------|-----------|-------------|

### AI_Responses columns

| RunId | AISummary | GeneratedAt |
|-------|-----------|-------------|

**RunId format:** `{UserEmail}_{UnixTimestampMs}`

---

## Scale Characteristics

| Reports | Flow 1 | GAS Processing | Flow 2 | Total |
|---------|--------|----------------|--------|-------|
| 5       | ~10s   | ~15s           | ~10s   | ~35s  |
| 10      | ~15s   | ~25s           | ~15s   | ~1 min |
| 20      | ~20s   | ~50s           | ~20s   | ~2 min |
| 50      | ~30s   | ~2 min         | ~30s   | ~5 min |

GAS free tier allows ~6 hours execution/day. Gemini free tier: 15 req/min, 1500/day. 2s delay between calls keeps well within limits.

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/services/powerAutomate/flowActions.ts` | Split into `buildDispatchFlow()` + `buildSendFlow()`, replace Gemini HTTP with Sheets insert/read |
| `src/services/powerAutomate/connectionManager.ts` | Add `getGoogleSheetsConnection()` lookup |
| `src/services/powerAutomate/types.ts` | Add Google Sheets connection types |
| `src/services/powerAutomateService.ts` | `deployReportSchedulerFlow()` deploys both flows |
| `gas/Code.gs` *(new)* | Full GAS script: queue processor, Gemini caller, sheet writer |

---

## GAS Script Requirements

The `Code.gs` script needs the following Script Properties set:

| Property | Value |
|----------|-------|
| `SHEET_ID` | Google Sheet ID (from URL) |
| `GEMINI_API_KEY` | Gemini API key |
| `AZURE_TENANT_ID` | Azure AD tenant (for SharePoint Graph API token) |
| `AZURE_CLIENT_ID` | App registration client ID |
| `AZURE_CLIENT_SECRET` | App registration client secret |

**Triggers to set up in GAS:**
- `processAIQueue()` — Time-driven, every 5 minutes

**Azure App Registration permissions needed** (app-only, no user sign-in):
- `Sites.Read.All` — read SharePoint lists
- `Sites.ReadWrite.All` — update NextSendAt / AI_Queue status
- `Mail.Send` — send email as automation@scpng.gov.pg (if routing via Graph instead of Office 365 connector)

---

## What Stays Unchanged

- `Report_Schedules` SharePoint list schema — no changes
- Schedule saving logic in `sharePointOpsService.ts` — no changes
- `ReportsTab.tsx` UI — no changes
- Email HTML template logic (8-template architecture) — ported to GAS
- `TimePeriod` values: `daily`, `weekly`, `monthly`, `quarterly`, `half-yearly`, `yearly`, `custom`

---

## Implementation Status

- [x] Architecture designed and agreed
- [ ] `Code.gs` GAS script written
- [ ] `flowActions.ts` rewritten (Flow 1 + Flow 2)
- [ ] `connectionManager.ts` updated
- [ ] `powerAutomateService.ts` updated to deploy both flows
- [ ] Old suspended flow deleted from PA
- [ ] Both new flows deployed via TestGround
- [ ] Google Sheet created and GAS script deployed
- [ ] End-to-end test: schedule → dispatch → GAS → send
