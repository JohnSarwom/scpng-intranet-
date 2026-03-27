# Power Automate Flow Deployment — Troubleshooting Log

**Date:** 2026-03-25
**Goal:** Deploy the Report Scheduler flow programmatically via the Flow Management API from the intranet's TestGround page.

---

## Setup Context

The intranet has a `powerAutomateService.ts` that builds a Power Automate flow definition (Logic Apps JSON) and POSTs it to the Flow Management API. The flow:
- Triggers daily at 7 AM PGT
- Reads the `Report_Schedules` SharePoint list for active subscriptions
- Queries Tasks, KRAs, KPIs, Objectives for each due user
- Computes metrics, builds a branded HTML email, sends it
- Updates `LastSentAt` / `NextSendAt`

**Flow Owner:** `automation@scpng.gov.pg`
**Azure App:** `648a96d7-e3f5-4e13-8084-ba0b74dbb56f` (spx_data_crud)
**Environment:** `Default-b173aac7-6781-4d49-a037-d874bd4a09ab`

---

## Pre-Deployment: Manual Connection Setup

### What Was Needed
Power Automate connector connections (saved credentials) must exist before a flow can reference them. The automation account had never used SharePoint or Outlook connectors.

### What We Did
1. Logged into [make.powerautomate.com](https://make.powerautomate.com) as `automation@scpng.gov.pg`
2. Created a manual test flow ("Test Automations Permissions") with:
   - **Get lists** action (SharePoint connector) — pointed to `https://scpng1.sharepoint.com/sites/scpngintranet`
   - **Send an email (V2)** action (Office 365 Outlook connector) — dummy recipient
3. Saved the flow (this created the connector connections behind the scenes)
4. The test flow can be deleted afterward — the connections persist independently

---

## Error 1: Check Connections — 404 on Flow API

### Error
```
api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/{envId}/connections?api-version=2016-11-01
404: "No HTTP resource was found that matches the request URI"
```

### Cause
The connections API does **not** exist on `api.flow.microsoft.com`. Flows and connections are managed by different APIs:
- **Flows:** `api.flow.microsoft.com` (Flow Management API)
- **Connections:** `api.powerapps.com` (Power Apps API)

### Solution
1. Added `POWERAPPS_API_BASE: 'https://api.powerapps.com'` to config
2. Added `POWERAPPS_SCOPES: ['https://service.powerapps.com//.default']` for token acquisition
3. Created `getPowerAppsToken()` method (separate from `getFlowToken()`)
4. Created `powerAppsFetch()` method using the Power Apps base URL
5. Changed `listConnections()` to call:
   ```
   GET https://api.powerapps.com/providers/Microsoft.PowerApps/connections?api-version=2020-06-01&$filter=environment eq '{envId}'
   ```

---

## Error 2: Check Connections — AADSTS650057 Invalid Resource

### Error
```
AADSTS650057: Invalid resource. The client has requested access to a resource which is not listed
in the requested permissions in the client's application registration.
Client app ID: 648a96d7-e3f5-4e13-8084-ba0b74dbb56f(spx_data_crud).
Resource value from request: https://service.powerapps.com/
```

### Cause
The Azure app registration only had Flow API permissions (`https://service.flow.microsoft.com`). It did not have Power Apps API permissions (`https://service.powerapps.com`).

### Solution
1. Azure Portal → App registrations → `spx_data_crud` (`648a96d7-...`)
2. API permissions → Add a permission
3. **APIs my organization uses** tab → searched "PowerApps"
4. Selected **PowerApps Service** (`475226c6-020e-4fb2-8a90-7a972cbfc1d4`) — NOT "PowerApps Runtime Service" or "PowerApps-Advisor"
5. Delegated permissions → checked **User** ("Access the PowerApps Service API")
6. Clicked **Add permissions** → **Grant admin consent**

After this, Check Connections returned 21 connections (8 active).

---

## Error 3: List Flows — Success

No issues. The Flow API (`api.flow.microsoft.com`) with existing `Flows.Manage.All` permissions worked. Returned 11 flows.

---

## Error 4: Deploy — Missing `$authentication` Parameter

### Error
```
{"code":"InvalidPowerFlow","message":"The provided flow definition with a recurrent trigger
is missing the required parameter '$authentication'."}
```

### Cause
Power Automate flows with recurrence triggers require a `$authentication` parameter declared in the definition's `parameters` section.

### Solution
Added to the flow definition's `parameters`:
```json
"$authentication": {
    "defaultValue": {},
    "type": "SecureObject"
}
```

---

## Error 5: Deploy — Missing `$connections` Parameter

### Error
```
{"code":"InvalidPowerFlow","message":"The provided flow definition with a recurrent trigger
is missing the required parameter '$connections'."}
```

### Cause
Same pattern — the `$connections` parameter is also required.

### Solution
Added to the flow definition's `parameters`:
```json
"$connections": {
    "defaultValue": {},
    "type": "Object"
}
```

---

## Error 6: Deploy — Invalid `filter()` Arrow Function Syntax

### Error
```
{"code":"TemplateValidationError","message":"The template language expression
'length(filter(body('Get_Tasks')?['value'], item => or(equals(item?['Status'], 'completed'),
equals(item?['Status'], 'done'))))' is not valid: the string character '=' at position '48'
is not expected."}
```

### Cause
Power Automate's expression language does **not** support JavaScript-style arrow functions (`item => ...`). The `filter()` function with arrow syntax is not valid in Logic Apps / Power Automate workflow definitions.

### Solution
Replaced all inline `filter()` expressions with separate **Query** (Filter Array) actions using `item()` syntax:

**Before (invalid):**
```json
"completedTasks": "@length(filter(body('Get_Tasks')?['value'], item => equals(item?['Status'], 'completed')))"
```

**After (valid):**
```json
"Filter_Completed_Tasks": {
    "type": "Query",
    "runAfter": { "Get_Tasks": ["Succeeded"] },
    "inputs": {
        "from": "@body('Get_Tasks')?['value']",
        "where": "@or(equals(item()?['Status'], 'completed'), equals(item()?['Status'], 'done'))"
    }
}
```

Then in the email template, reference the filter results:
```
length(body('Filter_Completed_Tasks'))
```

Created separate Query actions for each metric filter:
- `Filter_Completed_Tasks`, `Filter_InProgress_Tasks`, `Filter_Todo_Tasks`, `Filter_OnHold_Tasks`
- `Filter_Active_KRAs`, `Filter_Completed_KRAs`
- `Filter_OnTrack_KPIs`, `Filter_AtRisk_KPIs`, `Filter_Behind_KPIs`

---

## Error 7: Deploy — `authentication` Property Not Allowed on Action Inputs

### Error
```
{"code":"InvalidOpenApiFlow","message":"The 'inputs' of workflow run action 'Get_Active_Schedules'
of type 'OpenApiConnection' should not have the property 'authentication'."}
```

### Cause
After adding `$authentication` as a parameter, we also added `authentication: "@parameters('$authentication')"` to each OpenApiConnection action's `inputs`. The Flow API rejected this — the `authentication` property should NOT be on individual action inputs. It's handled automatically via `connectionReferences`.

### Solution
Removed `authentication: "@parameters('$authentication')"` from all OpenApiConnection action inputs. The `$authentication` parameter declaration in the definition is sufficient — the runtime injects it via connection references.

---

## Error 8: Deploy — Missing `host.connectionReferenceName`

### Error
```
{"code":"InvalidOpenApiFlow","message":"The 'inputs' of workflow run action 'Get_Active_Schedules'
of type 'OpenApiConnection' is not valid. Property 'host.connectionReferenceName' is missing."}
```

### Cause
The `host` object in each OpenApiConnection action used `connectionName` (the actual connection GUID). The Flow API expects `connectionReferenceName` instead, which maps to the key in the `connectionReferences` object.

### Solution
Changed all action host objects from:
```json
"host": {
    "apiId": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline",
    "connectionName": "abc-123-guid",
    "operationId": "GetItems"
}
```
To:
```json
"host": {
    "apiId": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline",
    "connectionReferenceName": "shared_sharepointonline",
    "operationId": "GetItems"
}
```

The `connectionReferenceName` value (`shared_sharepointonline`, `shared_office365`) must match the keys in the `connectionReferences` section of the flow definition, where the actual connection GUIDs are stored.

**Status:** This is where we currently are — awaiting the next deploy attempt.

---

## Summary: Required Flow Definition Structure

```
properties:
  displayName: "Flow Name"
  state: "Started"
  definition:
    $schema: "...Logic/schemas/2016-06-01/workflowdefinition.json#"
    contentVersion: "1.0.0.0"
    parameters:
      $connections: { defaultValue: {}, type: "Object" }         # REQUIRED
      $authentication: { defaultValue: {}, type: "SecureObject" } # REQUIRED for recurrence
    triggers: { ... }
    actions:
      SomeAction:
        type: "OpenApiConnection"
        inputs:
          host:
            apiId: "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"
            connectionReferenceName: "shared_sharepointonline"  # Maps to connectionReferences key
            operationId: "GetItems"
          parameters: { ... }
          # NO 'authentication' property here
    outputs: {}
  connectionReferences:
    shared_sharepointonline:
      connectionName: "actual-connection-guid"  # From listConnections()
      source: "Invoker"
      id: "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"
    shared_office365:
      connectionName: "actual-connection-guid"
      source: "Invoker"
      id: "/providers/Microsoft.PowerApps/apis/shared_office365"
```

## Azure App Permissions Required

| API | Permission | Type | Purpose |
|-----|-----------|------|---------|
| Flow Service (`service.flow.microsoft.com`) | `Flows.Manage.All` | Delegated | Create/manage flows |
| Flow Service | `Flows.Read.All` | Delegated | List flows |
| PowerApps Service (`service.powerapps.com`) | `User` | Delegated | List connections |

## Related Files

- `src/services/powerAutomateService.ts` — Flow deployment service
- `src/pages/TestGround.tsx` — Admin UI for testing deployment
- `docs/features/report-scheduler-powerautomate.md` — Feature overview
