# Regulatory Intelligence: External Reporting System

This document outlines the architecture and setup for the external reporting form (Scams/Whistleblowers) that feeds into the SCPNG Intranet.

## Architecture Overview

The system uses a serverless architecture to capture external reports and securely transport them to the intranet's data tables.

```ascii
+-------------------+       +-----------------------+       +-----------------------+
|   Web App Form    |       |     Google Sheet      |       |    Power Automate     |
| (Apps Script-Host)| ----> | (Data Storage & Sync) | ----> |  (Flow Triggering)   |
| SC PNG Themed UI  |       |                       |       |                       |
+-------------------+       +-----------------------+       +-----------|-----------+
                                                                        |
                                                                        v
                                                            +-----------------------+
                                                            |   Internal Tables     |
                                                            | (SharePoint/Database) |
                                                            |   Investigation Log   |
                                                            +-----------------------+
```

## Power Automate Workflow Logic

The Power Automate workflow is designed to be highly reliable and automated.

```ascii
TRIGGER: Recurrence or "When a row is added to Google Sheet"
  |
  v
ACTION: Get New Row Data
  |
  v
ACTION: Data Validation & Formatting
  | (Ensure email is valid, risk level is mapped)
  v
ACTION: Insert Record into Internal Table
  | (SharePoint List or SQL Table)
  v
ACTION: Send Notification to Compliance Unit
  | (Optional: Email or Teams Alert)
  v
ACTION: Mark Row as "Processed" in Google Sheet
```

## Google Apps Script Setup

### 1. Create the Google Sheet
- Create a new Google Sheet named `Regulatory_Reports`.
- Set the first row headers to: `Timestamp`, `Reporter Name`, `Email`, `Report Type` (Scam/Whistleblower), `Category`, `Title`, `Description`, `Risk Level`.

### 2. Add the Script
- Go to `Extensions` > `Apps Script`.
- Replace the contents of `Code.gs` with the provided backend code.
- Create a new file named `Index.html` and paste the provided frontend code.

### 3. Deploy as Web App
- Click `Deploy` > `New Deployment`.
- Select `Web App`.
- Set `Execute as` to `Me`.
- Set `Who has access` to `Anyone` (or appropriate restriction).
- Copy the Web App URL for distribution.
