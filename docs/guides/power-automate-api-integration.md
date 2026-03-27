# Power Automate Flow Management API — Complete Integration Guide

**Created:** 2026-03-25 | **Status:** Working (Deployed Successfully)
**Project:** SCPNG Intranet | **File:** `src/services/powerAutomateService.ts`

---

## Table of Contents

1. [Important: API Support Status](#important-api-support-status)
2. [Overview](#overview)
3. [Architecture Diagram](#architecture-diagram)
4. [API Landscape](#api-landscape)
5. [Azure App Registration Setup](#azure-app-registration-setup)
6. [Pre-Deployment: Manual Connection Setup](#pre-deployment-manual-connection-setup)
7. [Authentication & Token Acquisition](#authentication--token-acquisition)
8. [Flow Definition JSON Structure (The Correct Format)](#flow-definition-json-structure-the-correct-format)
9. [OpenApiConnection Action Anatomy](#openapiconnection-action-anatomy)
10. [Connection References — How They Work](#connection-references--how-they-work)
11. [The Deploy Request](#the-deploy-request)
12. [Debugging Technique: Inspect Existing Flow](#debugging-technique-inspect-existing-flow)
13. [Complete Error Log & Resolutions](#complete-error-log--resolutions)
14. [Working Code Reference](#working-code-reference)
15. [Quick Reference Card](#quick-reference-card)
16. [External References](#external-references)

---

## Important: API Support Status

> **WARNING:** Microsoft's official documentation explicitly states that the API at
> `api.flow.microsoft.com` **is not supported**. The recommended approach is to use
> the Dataverse Web APIs instead.
>
> Source: [Work with cloud flows using code — Microsoft Learn](https://learn.microsoft.com/en-us/power-automate/manage-flows-with-code)
>
> *"The API at api.flow.microsoft.com isn't supported. Customers should instead use the
> Dataverse Web APIs for Power Automate. [...] Customers can use the unsupported APIs at
> api.flow.microsoft.com at their own risk. These APIs are subject to change, so breaking
> changes could occur."*

### Why We Use It Anyway

The Dataverse API approach requires:
- A Dataverse environment with the workflow table accessible
- Solution-aware flows (flows must be inside a Dataverse solution)
- Different authentication (Dataverse org URL, not Flow Service scope)
- Different JSON structure (`clientdata` as an escaped JSON string, `runtimeSource: "embedded"`, `connectionReferenceLogicalName`)

Our intranet runs purely on SharePoint + Azure AD with no Dataverse setup. The Flow
Management API at `api.flow.microsoft.com` works for our use case (non-solution "My Flows")
and is the only REST API that can manage flows outside of Solutions.

### Key Differences Between the Two APIs

```
 FLOW MANAGEMENT API                     DATAVERSE API
 (api.flow.microsoft.com)                ({org}.crm.dynamics.com)
 ─────────────────────────               ─────────────────────────
 UNSUPPORTED by Microsoft                SUPPORTED, documented
 Works with "My Flows"                   Only works with Solution flows
 No Dataverse required                   Requires Dataverse environment
 JSON payload as object                  Flow def as escaped string in "clientdata"
 connectionReferences at properties      connectionReferences inside clientdata
   level with connectionName + source      with runtimeSource + api.name
 Authentication on actions:              Authentication on actions:
   X-MS-APIM-Tokens expression             @parameters('$authentication')
 Our approach ✓                          Not applicable to our setup
```

### Risk Mitigation

Since this API is unsupported and could break:
1. The flow only needs to be deployed once (it's a single master flow)
2. If the API breaks, the flow can be recreated manually in the Power Automate portal
3. The `getFlowDefinition()` inspect method lets us verify the format if the API changes
4. This document captures every detail needed to recreate the flow manually

---

## Overview

This document covers how to programmatically create Power Automate cloud flows from a
React/TypeScript web application using the **Flow Management REST API**. It captures every
error encountered during development, the exact JSON structures that work, and the
architectural decisions behind the integration.

**What we built:** A single Power Automate flow that runs daily, reads a SharePoint list of
report subscriptions, queries multiple SharePoint lists for metrics, builds branded HTML
emails, and sends them to subscribed users.

**Key insight:** The Flow Management API (`api.flow.microsoft.com`) is undocumented by
Microsoft and differs significantly from both the ARM-based Logic Apps API and the
Dataverse-based flow management API. The correct JSON format was discovered by inspecting
an existing working flow's definition via the API itself.

---

## Architecture Diagram

```
                         SCPNG INTRANET — POWER AUTOMATE INTEGRATION
 ========================================================================================

   REACT APP (Browser)                    MICROSOFT CLOUD
   ~~~~~~~~~~~~~~~~~~~~                   ~~~~~~~~~~~~~~~~

   +---------------------------+
   | TestGround.tsx            |
   | (Admin UI)                |
   |                           |
   | [Check Connections]  ─────────► api.powerapps.com
   | [List Flows]         ─────────► api.flow.microsoft.com
   | [Inspect Flow]       ─────────► api.flow.microsoft.com (GET)
   | [Deploy Flow]        ─────────► api.flow.microsoft.com (POST)
   +---------------------------+
              │
              │ uses
              ▼
   +---------------------------+          +-------------------------------+
   | PowerAutomateService.ts   |          |  Azure AD / MSAL             |
   |                           |          |                               |
   | getFlowToken()  ──────────────────►  |  Token for:                   |
   |   scope: service.flow     |          |  service.flow.microsoft.com   |
   |                           |          |                               |
   | getPowerAppsToken() ──────────────►  |  Token for:                   |
   |   scope: service.powerapps|          |  service.powerapps.com        |
   +---------------------------+          +-------------------------------+
              │
              │ builds & sends
              ▼
   +-----------------------------------------------------------------------+
   |  FLOW DEFINITION (JSON)                                               |
   |                                                                       |
   |  properties:                                                          |
   |    displayName: "SCPNG Intranet — Scheduled Report Dispatcher"        |
   |    state: "Started"                                                   |
   |    definition:                                                        |
   |      parameters: { $connections, $authentication }                    |
   |      triggers: { Daily_Check (Recurrence) }                           |
   |      actions:                                                         |
   |        Get_Active_Schedules ──► SharePoint: Report_Schedules          |
   |        Filter_Due_Schedules ──► Query: NextSendAt <= now              |
   |        Process_Each_User (Foreach) ──►                                |
   |          Get_Tasks ──────────► SharePoint: Operations_Tasks           |
   |          Get_KRAs ───────────► SharePoint: Performance_KRAs           |
   |          Get_KPIs ───────────► SharePoint: Performance_KPIs           |
   |          Get_Objectives ─────► SharePoint: Unit_Objectives            |
   |          Filter_* (x10) ─────► Query actions for metrics              |
   |          Build_Email_Body ───► Compose: branded HTML                  |
   |          Send_Report_Email ──► Office 365: SendEmailV2                |
   |          Calculate_Next_Send ► Compose: date math                     |
   |          Update_Schedule ────► SharePoint: PatchItem                  |
   |    connectionReferences:                                              |
   |      shared_sharepointonline: { connectionName: "guid-..." }          |
   |      shared_office365:        { connectionName: "guid-..." }          |
   +-----------------------------------------------------------------------+
              │
              │ POST to
              ▼
   +-----------------------------------------------------------------------+
   |  POWER AUTOMATE RUNTIME                                               |
   |                                                                       |
   |  Environment: Default-b173aac7-6781-4d49-a037-d874bd4a09ab            |
   |  Flow Owner:  automation@scpng.gov.pg                                 |
   |                                                                       |
   |  Connections (pre-created):                                           |
   |    shared-sharepointonl-cedadbf9-fb17-4fa7-9e63-000cc725478c          |
   |    shared-office365-597cc844-31d6-4dc7-9816-322ca7238f82              |
   |                                                                       |
   |  Runs daily at 7:00 AM PGT                                           |
   |  Reads Report_Schedules list                                          |
   |  Sends branded HTML emails                                            |
   +-----------------------------------------------------------------------+
```

---

## API Landscape

**CRITICAL:** Microsoft has THREE different APIs that touch Power Automate. They are NOT
interchangeable. Using the wrong one produces confusing errors.

```
 +-----------------------------------+-----------------------------------+-----------------------------------+
 |  FLOW MANAGEMENT API              |  POWER APPS API                   |  DATAVERSE WEB API                |
 +-----------------------------------+-----------------------------------+-----------------------------------+
 |  Base: api.flow.microsoft.com     |  Base: api.powerapps.com          |  Base: {org}.crm.dynamics.com     |
 |                                   |                                   |                                   |
 |  Purpose:                         |  Purpose:                         |  Purpose:                         |
 |  - Create/update/delete flows     |  - List connections               |  - Manage solution-aware flows    |
 |  - List flows                     |  - List environments              |  - Connection references          |
 |  - Get flow definitions           |  - Manage Power Apps              |  - Solution components            |
 |                                   |                                   |                                   |
 |  Token scope:                     |  Token scope:                     |  Token scope:                     |
 |  service.flow.microsoft.com       |  service.powerapps.com            |  {org}.crm.dynamics.com           |
 |  //.default                       |  //.default                       |  //.default                       |
 |                                   |                                   |                                   |
 |  We use for:                      |  We use for:                      |  We do NOT use this.              |
 |  - POST /flows (create)           |  - GET /connections (find GUIDs)  |  (Would require Dataverse setup)  |
 |  - GET /flows (list/inspect)      |                                   |                                   |
 |  - DELETE /flows/{id}             |                                   |                                   |
 +-----------------------------------+-----------------------------------+-----------------------------------+

 KEY RULE: Connections live on the Power Apps API.
           Flows live on the Flow Management API.
           NEVER call /connections on api.flow.microsoft.com (404).
           NEVER call /flows on api.powerapps.com (not supported).
```

### API URL Patterns

```
FLOW MANAGEMENT (api.flow.microsoft.com):
  List flows:
    GET /providers/Microsoft.ProcessSimple/environments/{envId}/flows?api-version=2016-11-01

  Get flow definition:
    GET /providers/Microsoft.ProcessSimple/environments/{envId}/flows/{flowId}?api-version=2016-11-01

  Create flow:
    POST /providers/Microsoft.ProcessSimple/environments/{envId}/flows?api-version=2016-11-01

  Delete flow:
    DELETE /providers/Microsoft.ProcessSimple/environments/{envId}/flows/{flowId}?api-version=2016-11-01


POWER APPS (api.powerapps.com):
  List connections:
    GET /providers/Microsoft.PowerApps/connections?api-version=2020-06-01&$filter=environment eq '{envId}'
```

---

## Azure App Registration Setup

**App Name:** `spx_data_crud`
**App (Client) ID:** `648a96d7-e3f5-4e13-8084-ba0b74dbb56f`
**Tenant ID:** `b173aac7-6781-4d49-a037-d874bd4a09ab`

### Required API Permissions

Navigate to: Azure Portal > App registrations > spx_data_crud > API permissions

```
 +------------------------------+-----------------------------+----------+---------------------------+
 |  API                         |  Permission                 |  Type    |  Purpose                  |
 +------------------------------+-----------------------------+----------+---------------------------+
 |  Flow Service                |  Flows.Manage.All           |  Deleg.  |  Create/update/delete     |
 |  (service.flow.microsoft.com)|  Flows.Read.All             |  Deleg.  |  List flows               |
 |                              |  User                       |  Deleg.  |  Base access              |
 +------------------------------+-----------------------------+----------+---------------------------+
 |  PowerApps Service           |  User                       |  Deleg.  |  List connections         |
 |  (service.powerapps.com)     |                             |          |                           |
 +------------------------------+-----------------------------+----------+---------------------------+
 |  Microsoft Graph             |  (existing permissions      |  Deleg.  |  SharePoint, Mail, etc.   |
 |                              |   for intranet app)         |          |                           |
 +------------------------------+-----------------------------+----------+---------------------------+
```

### How to Add Flow Service Permissions

1. Azure Portal > App registrations > `spx_data_crud`
2. API permissions > Add a permission
3. Tab: **APIs my organization uses**
4. Search: `"Flow Service"` (NOT "Power Automate" — that name doesn't appear)
5. Select: **Flow Service** (ID varies by tenant)
6. Choose: **Delegated permissions**
7. Check: `Flows.Manage.All`, `Flows.Read.All`
8. Click: **Add permissions**
9. Click: **Grant admin consent for SCPNG**

### How to Add PowerApps Service Permissions

1. Same path as above
2. Search: `"PowerApps"` (in APIs my organization uses)
3. Select: **PowerApps Service** (`475226c6-020e-4fb2-8a90-7a972cbfc1d4`)
   - WARNING: Do NOT select "PowerApps Runtime Service" or "PowerApps-Advisor"
4. Delegated permissions > Check **User**
5. Add permissions > Grant admin consent

---

## Pre-Deployment: Manual Connection Setup

Before a flow can be created via API, the **connector connections** (saved credentials) must
exist for the account that will own the flow.

```
 WHAT ARE CONNECTIONS?
 =====================

 A "connection" in Power Automate is a saved OAuth credential that links a user account
 to a specific connector (SharePoint, Outlook, etc.). Think of it as:

   Connection = User Account + Connector Type + Saved OAuth Token

 Example:
   shared-sharepointonl-cedadbf9-fb17-4fa7-9e63-000cc725478c
     = automation@scpng.gov.pg + SharePoint connector + OAuth token

 These are created automatically when a user creates their first flow using that connector
 in the Power Automate portal. They CANNOT be created via API (as of March 2026).
```

### Steps to Create Connections

1. Log into [make.powerautomate.com](https://make.powerautomate.com) as `automation@scpng.gov.pg`
2. Create a new instant cloud flow (button trigger)
3. Add a **"Get lists"** action (SharePoint connector)
   - Site: `https://scpng1.sharepoint.com/sites/scpngintranet`
4. Add a **"Send an email (V2)"** action (Office 365 Outlook connector)
   - To: any valid email
5. Save the flow
6. The connections are now created and persist independently
7. The test flow can be deleted — connections survive

### Verifying Connections

Use the "Check Connections" button on TestGround, or call `listConnections()`:

```typescript
const paService = new PowerAutomateService(msalInstance);
const connections = await paService.listConnections();
const active = connections.filter(c => c.status === 'Connected');
// Look for: shared_sharepointonline and shared_office365
```

---

## Authentication & Token Acquisition

The service acquires two separate tokens via MSAL (one per API):

```
 TOKEN ACQUISITION FLOW
 ======================

 ┌──────────────┐     acquireTokenSilent()      ┌──────────────────┐
 │  MSAL         │ ──────────────────────────►  │  Azure AD         │
 │  Instance     │     scope: service.flow...    │                   │
 │               │ ◄──────────────────────────  │  Returns: JWT     │
 │               │     accessToken               │  for Flow API     │
 │               │                               │                   │
 │               │     acquireTokenSilent()      │                   │
 │               │ ──────────────────────────►  │                   │
 │               │     scope: service.powerapps  │  Returns: JWT     │
 │               │ ◄──────────────────────────  │  for PowerApps    │
 └──────────────┘                               └──────────────────┘

 IMPORTANT: These are DIFFERENT tokens. You cannot use a Flow token to call PowerApps API
 or vice versa. Each API requires its own token with the correct audience.

 If silent acquisition fails (e.g., token expired, no cached token), MSAL falls back to
 acquireTokenPopup() which opens a browser popup for interactive consent.
```

### Token Scopes

```typescript
// Flow Management API
FLOW_SCOPES: ['https://service.flow.microsoft.com//.default']

// Power Apps API (for connections only)
POWERAPPS_SCOPES: ['https://service.powerapps.com//.default']

// Note the double-slash "//" before .default — this is correct MSAL syntax
// for first-party Microsoft APIs using the /.default scope pattern.
```

---

## Flow Definition JSON Structure (The Correct Format)

This is the EXACT JSON structure that successfully creates a flow via POST to the Flow
Management API. Every field shown here is required unless marked optional.

```
 CORRECT FLOW DEFINITION — TOP-LEVEL STRUCTURE
 ================================================

 {
   "properties": {                              // <-- Everything lives under "properties"
     "displayName": "Flow Name",                // Display name in Power Automate portal
     "state": "Started",                        // "Started" = active, "Stopped" = paused
     "definition": {                            // <-- The Logic Apps workflow definition
       "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
       "contentVersion": "1.0.0.0",
       "parameters": {                          // <-- REQUIRED parameters section
         "$connections": {
           "defaultValue": {},
           "type": "Object"
         },
         "$authentication": {                   // <-- REQUIRED for recurrence triggers
           "defaultValue": {},
           "type": "SecureObject"
         }
       },
       "triggers": { ... },                     // <-- One trigger
       "actions": { ... },                      // <-- All workflow actions
       "outputs": {}                            // <-- Required, can be empty
     },
     "connectionReferences": {                  // <-- SIBLING of "definition", NOT inside it
       "shared_sharepointonline": {
         "connectionName": "shared-sharepointonl-xxxx-xxxx-xxxx",   // Actual connection GUID
         "source": "Invoker",
         "id": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"
       },
       "shared_office365": {
         "connectionName": "shared-office365-xxxx-xxxx-xxxx",
         "source": "Invoker",
         "id": "/providers/Microsoft.PowerApps/apis/shared_office365"
       }
     }
   }
 }


 WHERE THINGS GO — VISUAL MAP
 =============================

 {
   properties ─────────────────────────────┐
   │                                        │
   ├── displayName                          │
   ├── state                                │
   │                                        │
   ├── definition ──────────────────┐       │
   │   │                            │       │
   │   ├── $schema                  │       │
   │   ├── contentVersion           │       │
   │   ├── parameters               │       │  DEFINITION and
   │   │   ├── $connections         │       │  CONNECTION_REFERENCES
   │   │   └── $authentication      │       │  are SIBLINGS under
   │   ├── triggers                 │       │  "properties"
   │   ├── actions                  │       │
   │   └── outputs                  │       │
   │                                │       │
   ├── connectionReferences ────────┘───────┘
   │   ├── shared_sharepointonline
   │   └── shared_office365
   │
   └───────────────────────────────────────┘
 }
```

---

## OpenApiConnection Action Anatomy

Every action that calls a connector (SharePoint, Outlook, etc.) is of type `OpenApiConnection`.
The format is strict and every field matters.

```
 CORRECT OpenApiConnection ACTION
 ==================================

 "Action_Name": {
   "type": "OpenApiConnection",                 // Always this exact string
   "runAfter": { ... },                          // Dependency declaration
   "inputs": {
     "host": {
       "apiId": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline",
       "connectionName": "shared_sharepointonline",     // <-- KEY in connectionReferences
       "operationId": "GetItems"                         // <-- Connector operation
     },
     "parameters": {
       "dataset": "https://scpng1.sharepoint.com/sites/scpngintranet",
       "table": "List_Name",
       "$filter": "fields/Column eq 'value'",
       "$top": 500
     },
     "authentication": {                                 // <-- REQUIRED on every action
       "value": "@json(decodeBase64(triggerOutputs().headers['X-MS-APIM-Tokens']))['$ConnectionKey']",
       "type": "Raw"
     }
   }
 }
```

### Field-by-Field Breakdown

```
 host.apiId
 ──────────
 Format: /providers/Microsoft.PowerApps/apis/{connector_name}

 Common values:
   SharePoint:  /providers/Microsoft.PowerApps/apis/shared_sharepointonline
   Outlook:     /providers/Microsoft.PowerApps/apis/shared_office365


 host.connectionName
 ────────────────────
 This is the KEY that maps to the connectionReferences object at the top level.
 NOT the actual connection GUID — that goes in connectionReferences.connectionName.

 Example mapping:
   Action's host.connectionName = "shared_sharepointonline"
                                        │
                                        ▼
   connectionReferences["shared_sharepointonline"] = {
     connectionName: "shared-sharepointonl-cedadbf9-...",  // <-- Actual GUID here
     source: "Invoker",
     id: "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"
   }


 host.operationId
 ─────────────────
 The specific connector operation to invoke.

 SharePoint operations:
   GetItems     — Read multiple items from a list
   GetItem      — Read a single item by ID
   PatchItem    — Update an existing item (requires item/Title)
   PostItem     — Create a new item
   DeleteItem   — Delete an item
   GetTables    — List all lists on a site

 Office 365 Outlook operations:
   SendEmailV2  — Send an email


 authentication (on inputs)
 ──────────────────────────
 EVERY OpenApiConnection action MUST include this authentication block:

   "authentication": {
     "value": "@json(decodeBase64(triggerOutputs().headers['X-MS-APIM-Tokens']))['$ConnectionKey']",
     "type": "Raw"
   }

 This expression extracts the connection key from the trigger's APIM token headers.
 Power Automate injects these headers at runtime for all trigger types (recurrence, button, etc.).

 WARNING: Do NOT use "@parameters('$authentication')" here.
          That was tried and produced Error 7 (see error log below).
          The correct value is the X-MS-APIM-Tokens expression shown above.
```

### Email Action Parameter Format

```
 CORRECT email parameters (flat slash-separated keys):

   "parameters": {
     "emailMessage/To": "@items('Process_Each_User')?['UserEmail']",
     "emailMessage/Subject": "Subject text",
     "emailMessage/Body": "@outputs('Build_Email_Body')",
     "emailMessage/Importance": "Normal"
   }

 WRONG (nested object — will be rejected):

   "parameters": {
     "emailMessage": {
       "To": "...",
       "Subject": "...",
       "Body": "..."
     }
   }
```

### PatchItem (Update) Requires Title

```
 CORRECT PatchItem parameters:

   "parameters": {
     "dataset": "https://scpng1.sharepoint.com/sites/scpngintranet",
     "table": "List_Name",
     "id": "@items('Loop')?['ID']",
     "item": {
       "Title": "@items('Loop')?['Title']",     // <-- REQUIRED even if not changing it
       "FieldToUpdate": "new value"
     }
   }

 The SharePoint PatchItem operation ALWAYS requires item/Title to be present,
 even if you're only updating other fields. Pass the existing Title value through.
```

---

## Connection References — How They Work

```
 CONNECTION REFERENCE RESOLUTION CHAIN
 ======================================

 When Power Automate processes an OpenApiConnection action, it resolves the
 connection through a two-step lookup:

 Step 1: Action → connectionReferences key
 ──────────────────────────────────────────

   Action "Get_Active_Schedules"
     inputs.host.connectionName = "shared_sharepointonline"
                                         │
                                         │ lookup key
                                         ▼

 Step 2: connectionReferences key → actual connection GUID
 ──────────────────────────────────────────────────────────

   properties.connectionReferences = {
     "shared_sharepointonline": {                           ◄── matches key
       "connectionName": "shared-sharepointonl-cedadbf9-...",  ◄── actual GUID
       "source": "Invoker",
       "id": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"
     }
   }
                   │
                   │ resolves to
                   ▼

 Step 3: GUID → actual saved connection in Power Automate
 ────────────────────────────────────────────────────────

   Power Automate looks up the connection GUID in the environment's
   connection store to find the saved OAuth credentials.

   Connection: shared-sharepointonl-cedadbf9-fb17-4fa7-9e63-000cc725478c
     Owner:    automation@scpng.gov.pg
     Type:     SharePoint Online
     Status:   Connected
     Site:     https://scpng1.sharepoint.com/sites/scpngintranet


 NAMING CONVENTION
 =================

 The key in connectionReferences is arbitrary but by convention matches
 the connector's API name:

   Connector              Key                        API ID suffix
   ─────────              ───                        ─────────────
   SharePoint             shared_sharepointonline     shared_sharepointonline
   Office 365 Outlook     shared_office365            shared_office365
   Common Data Service    shared_commondataservice    shared_commondataservice

 The key just needs to be consistent between:
   - host.connectionName in each action
   - the key in connectionReferences
```

---

## The Deploy Request

```
 FULL DEPLOY HTTP REQUEST
 =========================

 POST https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/Default-b173aac7-6781-4d49-a037-d874bd4a09ab/flows?api-version=2016-11-01

 Headers:
   Authorization: Bearer {flow-api-token}
   Content-Type: application/json

 Body:
   {
     "properties": {
       "displayName": "SCPNG Intranet — Scheduled Report Dispatcher",
       "state": "Started",
       "definition": { ... },
       "connectionReferences": { ... }
     }
   }

 Success Response: 201 Created
   Body contains the created flow's full definition including:
   - name: flow GUID
   - id: full resource path
   - properties.state: "Started"

 Error Response: 400 Bad Request
   Body: { "error": { "code": "...", "message": "..." } }
```

---

## Debugging Technique: Inspect Existing Flow

When the deploy fails with a cryptic error about JSON structure, the most reliable fix is
to inspect a working flow's definition and compare it against your payload.

### How to Inspect

1. Go to TestGround page
2. Click **"Inspect Flow"** button
3. Open browser DevTools > Console
4. Look for `[TestGround] connectionReferences:` and `[TestGround] First action:`
5. Compare against `[PowerAutomate] Deploy payload connectionReferences:` (logged on deploy)

### What to Compare

```
 FROM WORKING FLOW (Inspect):             FROM YOUR PAYLOAD (Deploy):
 ─────────────────────────────            ─────────────────────────────

 host:                                     host:
   apiId: "/providers/..."                   apiId: "/providers/..."     ✓ same
   connectionName: "shared_sharepointonline" connectionName: "shared_..." ✓ same
   operationId: "GetTables"                  operationId: "GetItems"     ✓ (different op is fine)

 authentication:                           authentication:
   value: "@json(decodeBase64(...))"         value: "@json(decodeBase64(...))"  ✓ same
   type: "Raw"                               type: "Raw"                        ✓ same

 connectionReferences:                     connectionReferences:
   connectionName: "shared-sharepointonl-"   connectionName: "shared-sharepointonl-" ✓ same format
   source: "Invoker"                         source: "Invoker"                       ✓ same
   id: "/providers/.../shared_..."           id: "/providers/.../shared_..."         ✓ same
```

### Code for Inspect

```typescript
// In PowerAutomateService:
async getFlowDefinition(flowId: string): Promise<any> {
    const envPath = `/providers/Microsoft.ProcessSimple/environments/${FLOW_CONFIG.ENVIRONMENT_ID}`;
    return this.flowFetch(`${envPath}/flows/${flowId}?api-version=2016-11-01`);
}

// In TestGround handler:
const flows = await paService.listFlows();
const flowDef = await paService.getFlowDefinition(flows[0].name);
console.log('connectionReferences:', JSON.stringify(flowDef?.properties?.connectionReferences, null, 2));
console.log('First action:', JSON.stringify(Object.entries(flowDef?.properties?.definition?.actions || {})[0], null, 2));
```

---

## Complete Error Log & Resolutions

### Error 1: 404 on Connections API

```
Request:  GET api.flow.microsoft.com/.../connections?api-version=2016-11-01
Response: 404 "No HTTP resource was found that matches the request URI"

Root cause: Connections API does NOT exist on api.flow.microsoft.com
Fix:        Use api.powerapps.com for connections (different API, different token)

             WRONG: api.flow.microsoft.com/connections
             RIGHT: api.powerapps.com/providers/Microsoft.PowerApps/connections
```

### Error 2: AADSTS650057 Invalid Resource

```
Request:  Token acquisition for https://service.powerapps.com//.default
Response: AADSTS650057: Invalid resource. Resource value: https://service.powerapps.com/

Root cause: Azure app registration missing PowerApps Service API permission
Fix:        Add permission: PowerApps Service > Delegated > User
            Then: Grant admin consent

            Azure Portal path:
            App registrations > spx_data_crud > API permissions > Add a permission
            > APIs my organization uses > search "PowerApps"
            > Select "PowerApps Service" (475226c6-020e-4fb2-8a90-7a972cbfc1d4)
            > Delegated > User > Add > Grant admin consent
```

### Error 3: List Flows — Worked

```
No issues. Flow API with Flows.Read.All permission returned 11 flows.
```

### Error 4: Missing $authentication Parameter

```
Request:  POST .../flows (create flow with recurrence trigger)
Response: {"code":"InvalidPowerFlow","message":"...missing required parameter '$authentication'"}

Root cause: Recurrence-triggered flows require $authentication in definition.parameters
Fix:        Add to definition.parameters:
            "$authentication": { "defaultValue": {}, "type": "SecureObject" }
```

### Error 5: Missing $connections Parameter

```
Request:  POST .../flows
Response: {"code":"InvalidPowerFlow","message":"...missing required parameter '$connections'"}

Root cause: Same pattern as Error 4
Fix:        Add to definition.parameters:
            "$connections": { "defaultValue": {}, "type": "Object" }
```

### Error 6: Invalid filter() Arrow Function Syntax

```
Response: {"code":"TemplateValidationError","message":"...filter(..., item => ...)...
           string character '=' at position '48' is not expected."}

Root cause: Power Automate expressions do NOT support JavaScript arrow functions.
            filter(array, item => condition) is invalid.
Fix:        Replace inline filter() with separate "Query" (Filter Array) actions
            using item() syntax:

            WRONG:  "@length(filter(body('X')?['value'], item => equals(item?['Status'], 'done')))"
            RIGHT:  Separate Query action:
                    { "type": "Query", "inputs": {
                        "from": "@body('X')?['value']",
                        "where": "@equals(item()?['Status'], 'done')"
                    }}
                    Then reference: "@length(body('Filter_Action_Name'))"
```

### Error 7: 'authentication' Property Not Allowed (MISLEADING)

```
Response: {"code":"InvalidOpenApiFlow","message":"...should not have the property 'authentication'"}

Context: We had added authentication: "@parameters('$authentication')" to each action.

Root cause: The VALUE was wrong, not the property itself.
            "@parameters('$authentication')" is NOT valid for action-level authentication.

Fix:        Use the correct authentication expression:
            WRONG:  "authentication": "@parameters('$authentication')"
            RIGHT:  "authentication": {
                      "value": "@json(decodeBase64(triggerOutputs().headers['X-MS-APIM-Tokens']))['$ConnectionKey']",
                      "type": "Raw"
                    }

NOTE: At the time, we misinterpreted this error and removed authentication entirely,
      which led to Error 8. The correct fix was to use the right authentication value.
```

### Error 8: Missing host.connectionReferenceName

```
Response: {"code":"InvalidOpenApiFlow","message":"...Property 'host.connectionReferenceName' is missing"}

Context: After removing authentication (Error 7), the host object only had connectionName.

Root cause: Without the authentication block, the API interprets the action differently
            and expects connectionReferenceName instead of connectionName.

Fix:        This error was resolved by adding connectionReferenceName, but then Error 9
            appeared. The REAL fix was to add both connectionName AND authentication
            (see Error 9).
```

### Error 9: connectionReferenceName Value is Null

```
Response: {"code":"InvalidOpenApiFlow","message":"...'host.connectionReferenceName' property value
           is of type 'Null'. The value must be a literal string."}

Context: We had connectionReferenceName: "shared_sharepointonline" but NO authentication block.

Root cause: Without the authentication block, the API cannot resolve the connection reference
            and reports it as null.

DEFINITIVE FIX: Use connectionName (NOT connectionReferenceName) AND include the authentication block:
                {
                  "host": {
                    "apiId": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline",
                    "connectionName": "shared_sharepointonline",        // <-- connectionName
                    "operationId": "GetItems"
                  },
                  "parameters": { ... },
                  "authentication": {                                    // <-- MUST be present
                    "value": "@json(decodeBase64(triggerOutputs().headers['X-MS-APIM-Tokens']))['$ConnectionKey']",
                    "type": "Raw"
                  }
                }

This was discovered by inspecting a working flow's definition (the "Test Automations
Permissions" flow created manually in the portal).
```

### Error 10: PatchItem Missing item/Title

```
Response: {"code":"InvalidOpenApiFlow","message":"...API operation 'PatchItem' is missing
           required property 'item/Title'"}

Root cause: SharePoint's PatchItem connector operation always requires Title in the item payload.
Fix:        Add Title: "@items('Loop')?['Title']" to the item object (pass-through existing value).
```

### Error Resolution Summary

```
 Error  Problem                           Fix
 ─────  ──────────────────────────────    ─────────────────────────────────────────
   1    Connections on wrong API           Use api.powerapps.com (not api.flow)
   2    Missing PowerApps permission       Add PowerApps Service > User permission
   3    (none)                             Worked
   4    Missing $authentication param      Add to definition.parameters
   5    Missing $connections param         Add to definition.parameters
   6    JS arrow functions in expressions  Use Query actions with item() syntax
   7    Wrong authentication value         Use X-MS-APIM-Tokens expression
   8    Missing connectionReferenceName    (Intermediate — see Error 9 for real fix)
   9    connectionReferenceName is null    Use connectionName + authentication block
  10    PatchItem missing Title            Add Title pass-through to item payload
```

---

## Working Code Reference

### powerAutomateService.ts — Key Sections

```typescript
// CONFIG
const FLOW_CONFIG = {
    ENVIRONMENT_ID: 'Default-b173aac7-6781-4d49-a037-d874bd4a09ab',
    API_BASE: 'https://api.flow.microsoft.com',
    POWERAPPS_API_BASE: 'https://api.powerapps.com',
    SHAREPOINT_SITE: 'https://scpng1.sharepoint.com/sites/scpngintranet',
    FLOW_SCOPES: ['https://service.flow.microsoft.com//.default'],
    POWERAPPS_SCOPES: ['https://service.powerapps.com//.default'],
    REPORT_FLOW_NAME: 'SCPNG Intranet — Scheduled Report Dispatcher',
};

// AUTHENTICATION BLOCK (used on every OpenApiConnection action)
const authBlock = {
    value: "@json(decodeBase64(triggerOutputs().headers['X-MS-APIM-Tokens']))['$ConnectionKey']",
    type: "Raw"
};

// SharePoint "Get Items" ACTION TEMPLATE
const spGetItems = (table, filter, runAfter = {}) => ({
    type: "OpenApiConnection",
    runAfter,
    inputs: {
        host: {
            apiId: "/providers/Microsoft.PowerApps/apis/shared_sharepointonline",
            connectionName: "shared_sharepointonline",
            operationId: "GetItems"
        },
        parameters: {
            dataset: FLOW_CONFIG.SHAREPOINT_SITE,
            table,
            "$filter": filter,
            "$top": 500
        },
        authentication: authBlock,
    }
});

// CONNECTION REFERENCES (at properties level, sibling of definition)
connectionReferences: {
    shared_sharepointonline: {
        connectionName: connections.sharepoint,     // GUID from listConnections()
        source: "Invoker",
        id: "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"
    },
    shared_office365: {
        connectionName: connections.office365,       // GUID from listConnections()
        source: "Invoker",
        id: "/providers/Microsoft.PowerApps/apis/shared_office365"
    }
}
```

---

## Quick Reference Card

```
 ╔══════════════════════════════════════════════════════════════════════════╗
 ║  POWER AUTOMATE FLOW MANAGEMENT API — QUICK REFERENCE                  ║
 ╠══════════════════════════════════════════════════════════════════════════╣
 ║                                                                         ║
 ║  CREATE FLOW:                                                           ║
 ║    POST api.flow.microsoft.com/.../environments/{env}/flows             ║
 ║    ?api-version=2016-11-01                                              ║
 ║    Token: service.flow.microsoft.com//.default                          ║
 ║                                                                         ║
 ║  LIST CONNECTIONS:                                                      ║
 ║    GET api.powerapps.com/providers/Microsoft.PowerApps/connections      ║
 ║    ?api-version=2020-06-01&$filter=environment eq '{env}'               ║
 ║    Token: service.powerapps.com//.default                               ║
 ║                                                                         ║
 ║  REQUIRED PARAMETERS IN DEFINITION:                                     ║
 ║    $connections:    { defaultValue: {}, type: "Object" }                ║
 ║    $authentication: { defaultValue: {}, type: "SecureObject" }          ║
 ║                                                                         ║
 ║  HOST OBJECT IN ACTIONS:                                                ║
 ║    apiId:          /providers/Microsoft.PowerApps/apis/{connector}      ║
 ║    connectionName: key in connectionReferences (NOT the GUID)           ║
 ║    operationId:    GetItems | PatchItem | SendEmailV2 | etc.            ║
 ║                                                                         ║
 ║  AUTHENTICATION ON EVERY ACTION:                                        ║
 ║    authentication: {                                                    ║
 ║      value: "@json(decodeBase64(triggerOutputs().headers                ║
 ║              ['X-MS-APIM-Tokens']))['$ConnectionKey']",                 ║
 ║      type: "Raw"                                                        ║
 ║    }                                                                    ║
 ║                                                                         ║
 ║  CONNECTION REFERENCES (sibling of definition):                         ║
 ║    connectionName: actual connection GUID from listConnections()        ║
 ║    source:         "Invoker"                                            ║
 ║    id:             /providers/Microsoft.PowerApps/apis/{connector}      ║
 ║                                                                         ║
 ║  PATCHITEM REQUIRES: item/Title (always include it)                     ║
 ║  EMAIL PARAMS USE:   slash notation (emailMessage/To, not nested)       ║
 ║  FILTER EXPRESSIONS: Use Query actions with item(), NOT arrow functions ║
 ║                                                                         ║
 ╚══════════════════════════════════════════════════════════════════════════╝
```

---

## Related Files

| File | Purpose |
|------|---------|
| `src/services/powerAutomateService.ts` | Flow deployment service (all API calls) |
| `src/pages/TestGround.tsx` | Admin UI for deploy/inspect/debug |
| `src/components/unit-tabs/ReportsTab.tsx` | User-facing schedule configuration UI |
| `src/services/sharePointOpsService.ts` | SharePoint list CRUD (Report_Schedules) |
| `docs/features/report-scheduler-powerautomate.md` | Feature overview and architecture |
| `docs/history/POWER_AUTOMATE_DEPLOYMENT_TROUBLESHOOTING.md` | Original error log (superseded by this doc) |

---

## External References

### Official Microsoft Documentation

- **[Work with cloud flows using code — Microsoft Learn](https://learn.microsoft.com/en-us/power-automate/manage-flows-with-code)**
  The official (and only) Microsoft documentation on managing flows programmatically. Covers
  the **Dataverse API** approach (not our Flow Management API). Important because:
  - Explicitly warns that `api.flow.microsoft.com` is **unsupported**
  - Shows the Dataverse JSON format with `clientdata`, `runtimeSource: "embedded"`, and
    `authentication: "@parameters('$authentication')"` — these do NOT work on the Flow
    Management API
  - Only supports solution-aware flows (not "My Flows")
  - Relevance: **High** — critical context for understanding API support boundaries

### Community Resources

- **[Understanding the Power Automate Definition — DEV Community](https://dev.to/wyattdave/understanding-the-power-automate-definition-42po)**
  Breaks down the JSON anatomy of a Power Automate flow definition including `connectionReferences`,
  `host.connectionName` mapping, and action structure. Based on *reading* flow definitions via
  API/export, not creating them. The `connectionReferences` format shown matches what the Flow
  Management API returns (and expects):
  ```json
  "connectionReferences": {
    "shared_sharepointonline": {
      "connectionName": "shared-sharepointonl-xxxx-xxxx",
      "source": "Invoker",
      "id": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"
    }
  }
  ```
  Relevance: **High** — confirmed the correct JSON structure for our approach

- **[Creating Power Automate Using Web API — M365 SharePoint Blog](https://m365sharepoint.wordpress.com/2022/03/30/creating-power-automate-using-power-automate-web-api/)**
  Step-by-step guide for creating flows via the **Dataverse API** using PowerShell. Uses a
  different `connectionReferences` format:
  ```json
  "connectionReferences": {
    "shared_sharepointonline": {
      "runtimeSource": "invoker",
      "connection": { "connectionReferenceLogicalName": "new_shared..." },
      "api": { "name": "shared_sharepointonline" }
    }
  }
  ```
  This format is for the **Dataverse API only** and does NOT work with our Flow Management API.
  Relevance: **Medium** — useful for understanding the alternative approach, but applying this
  format to `api.flow.microsoft.com` will produce errors

### Key Takeaway from External Research

There are two fundamentally different approaches to creating flows programmatically, and they
use **incompatible JSON formats**:

```
 APPROACH 1: Flow Management API (what we use)
 ──────────────────────────────────────────────
 - POST to api.flow.microsoft.com
 - connectionReferences: { connectionName, source, id }
 - Actions use: host.connectionName + authentication (X-MS-APIM-Tokens)
 - Unsupported by Microsoft
 - Works with non-solution "My Flows"

 APPROACH 2: Dataverse API (Microsoft-recommended)
 ──────────────────────────────────────────────────
 - POST to {org}.crm.dynamics.com/api/data/v9.2/workflows
 - connectionReferences: { runtimeSource, connection, api }
 - Actions use: authentication = "@parameters('$authentication')"
 - Fully supported and documented
 - Only works with solution-aware flows
 - Requires Dataverse environment

 MIXING FORMATS BETWEEN APPROACHES WILL PRODUCE CRYPTIC ERRORS.
 Always match the JSON format to the API you're calling.
```
