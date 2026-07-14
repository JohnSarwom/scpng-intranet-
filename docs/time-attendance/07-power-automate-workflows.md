# Time and Attendance Module - Power Automate Workflows

> Status: Drafted for review  
> Workflow target: Power Automate cloud flows  
> Storage target: SharePoint Lists  
> Premium connector assumption: Avoid premium connectors for Phase 1

## 1. Purpose

This document defines the Power Automate workflows required for the Time and Attendance module. The workflows support scheduled attendance checks, reminders, summaries, exception notifications, and audit updates.

Clock-in and clock-out are primarily user actions in the intranet UI. Power Automate supports the process around those actions. If stronger write enforcement is later required, Power Automate can become the controlled write layer for clock-in and clock-out.

## 2. Design Principles

- Keep the rest of the intranet unchanged.
- Apply office-network logic only to Time and Attendance actions.
- Use SharePoint Lists as the system of record.
- Avoid premium connectors in Phase 1.
- Use SharePoint and Office 365 Outlook connectors where possible.
- Make scheduled flows idempotent so reruns do not create duplicate records or duplicate emails.
- Log important system actions to `HR_AttendanceAuditLog`.
- Keep late arrivals report-only; do not create approval tasks for ordinary late arrivals.

## 3. Flow Inventory

| Flow | Type | Frequency/Trigger | Phase 1 |
| --- | --- | --- | --- |
| Missing Clock-In Check | Scheduled | Daily after configured threshold | Yes |
| Missing Clock-Out Check | Scheduled | Daily after 4:00 PM plus buffer | Yes |
| Daily HR Attendance Summary | Scheduled | Daily after close of business | Yes |
| Overtime Summary | Scheduled or combined with daily summary | Yes |
| Exception Notification | Automated | When exception item is created | Yes |
| Exception Review Outcome Notification | Automated | When exception review status changes | Yes |
| Settings Change Audit | Automated | When settings item is modified | Recommended |
| Clock-In/Clock-Out Controlled Write | Instant HTTP/manual trigger alternative | Future hardening | Optional later |

## 4. Shared Data Sources

| List | Usage |
| --- | --- |
| `HR_AttendanceRecords` | Main attendance records, late status, overtime, missing clock-out |
| `HR_AttendanceExceptions` | Missed attendance reasons and review status |
| `HR_AttendanceAuditLog` | Flow run logs, notification logs, system-generated status changes |
| `HR_AttendanceSettings` | Workday, notification, network, and policy settings |
| Employee profile source | Active employee list, email, division, unit, supervisor |
| Staff Leave Requests | Approved leave check to avoid false absence records |

## 5. Common Configuration Values

Initial values from `HR_AttendanceSettings`:

| Setting Key | Value |
| --- | --- |
| `workday.start.time` | `08:30` |
| `workday.end.time` | `16:00` |
| `late.grace.minutes` | `0` |
| `clockout.required` | `true` |
| `overtime.enabled` | `true` |
| `lunch.tracking.enabled` | `false` |
| `late.approval.required` | `false` |
| `missing.clockin.review.required` | `true` proposed |
| `missing.clockout.review.required` | `true` proposed |
| `daily.hr.summary.enabled` | `true` |
| `notifications.overtime.summary.enabled` | `true` |
| `attendance.office.public.ip` | `124.240.199.154` |

Confirmed missing clock-in and missing clock-out review rules: employee submits a reason, supervisor reviews, and HR can view.

## 6. Flow 1 - Missing Clock-In Check

### 6.1 Purpose

Detect active employees who have not clocked in by the configured attendance threshold.

Late arrivals are already marked by the UI when the employee clocks in after 8:30 AM. This flow focuses on employees with no attendance record at all.

### 6.2 Trigger

Scheduled recurrence.

Recommended initial schedule:

- Business days.
- Run at `9:00 AM` local time.
- Time zone: `Pacific/Port_Moresby`.

The 9:00 AM run time gives staff a short operational window while still enforcing no grace period for late status. The system still marks any clock-in after 8:30 AM as late.

### 6.3 Inputs

- Active employee profiles.
- `HR_AttendanceRecords`.
- Approved leave records from Staff Leave Requests.
- `HR_AttendanceSettings`.

### 6.4 Logic

1. Load active employees.
2. For each active employee, check if an attendance record exists for today's `AttendanceDateKey`.
3. Check if the employee has approved leave for today.
4. If approved leave exists, skip absence/missing clock-in marking or mark as `ApprovedLeave` if HR wants reporting visibility.
5. If no attendance record exists and no approved leave exists:
   - Create a `HR_AttendanceRecords` item with `Status = MissingClockIn` or `Absent`.
   - Set `ClockOutRequired = true`.
   - Set `NetworkCheckRequired = true`.
   - Create an audit log entry with `ActionType = MissingClockInMarked`.
   - Optionally create a `HR_AttendanceExceptions` item if review is required.
   - Notify the employee and supervisor if enabled.

### 6.5 Duplicate Prevention

Before creating a missing clock-in record, query:

- `EmployeeEmail`
- `AttendanceDateKey`

If a record already exists, update only if the current status allows it and do not send duplicate notifications.

Recommended duplicate marker fields:

- `Status`
- Audit log `ActionType`
- Exception `ReviewStatus`

### 6.6 Notifications

Recommended employee email:

- Subject: `Attendance Missing Clock-In Recorded`
- Message: The system did not detect a clock-in for today and has recorded the attendance status for HR review/reporting.

Recommended supervisor email:

- Subject: `Team Attendance Alert - Missing Clock-In`
- Message: One or more direct reports have not clocked in.

Notification content should include:

- Employee name.
- Date.
- Division/unit.
- Status.
- Link to the intranet attendance dashboard when available.

## 7. Flow 2 - Missing Clock-Out Check

### 7.1 Purpose

Detect employees who clocked in but did not clock out after the official workday end.

### 7.2 Trigger

Scheduled recurrence.

Recommended initial schedule:

- Business days.
- Run at `4:30 PM` local time.
- Time zone: `Pacific/Port_Moresby`.

The 4:30 PM run gives employees time to clock out after 4:00 PM and still captures overtime where clock-out happened after 4:00 PM.

### 7.3 Inputs

- `HR_AttendanceRecords`.
- `HR_AttendanceSettings`.

### 7.4 Logic

1. Query today's attendance records where:
   - `ClockInTime` is not empty.
   - `ClockOutTime` is empty.
   - `Status` is not already `MissingClockOut`, `Absent`, or `Corrected`.
2. For each matching record:
   - Set `Status = MissingClockOut` or `Incomplete`.
   - Set `ExceptionStatus = Pending` if review is required.
   - Create `HR_AttendanceExceptions` item if missing clock-out review is required.
   - Create audit entry with `ActionType = MissingClockOutMarked`.
   - Notify employee.
   - Notify supervisor if escalation or review is required.

### 7.5 Duplicate Prevention

Before creating an exception, query `HR_AttendanceExceptions` by:

- `AttendanceID`
- `ExceptionType = MissingClockOut`
- `ReviewStatus` not equal to `Resolved`

If one exists, update it only if needed and do not create a duplicate.

## 8. Flow 3 - Daily HR Attendance Summary

### 8.1 Purpose

Send HR a daily summary of attendance after close of business.

### 8.2 Trigger

Scheduled recurrence.

Recommended initial schedule:

- Business days.
- Run at `5:00 PM` local time.
- Time zone: `Pacific/Port_Moresby`.

### 8.3 Summary Metrics

Include:

- Total active employees.
- Total clocked in.
- Total clocked out.
- Total late arrivals.
- Total absent/missing clock-in.
- Total missing clock-out.
- Total overtime records.
- Total pending exceptions.
- Division/unit breakdown.

### 8.4 Inputs

- `HR_AttendanceRecords`.
- `HR_AttendanceExceptions`.
- Employee profile source.
- `HR_AttendanceSettings`.

### 8.5 Output

Send email to configured HR recipients.

Recommended subject:

`Daily Attendance Summary - {date}`

Recommended content:

- High-level metrics.
- Late arrivals table.
- Missing clock-in table.
- Missing clock-out table.
- Overtime table.
- Link to intranet HR attendance dashboard when available.

### 8.6 Audit Logging

Create `HR_AttendanceAuditLog` item:

- `ActionType = NotificationSent`
- `Source = PowerAutomate`
- `Details = Daily HR Attendance Summary sent`

## 9. Flow 4 - Overtime Summary

### 9.1 Purpose

Summarize overtime records for HR/supervisor visibility.

This may be a separate flow or part of the Daily HR Attendance Summary.

### 9.2 Trigger

Recommended Phase 1 option:

- Include overtime in the Daily HR Attendance Summary.
- Send a separate overtime summary email when overtime records exist.

Separate flow option:

- Run daily at `5:15 PM`.
- Send only when overtime records exist.

### 9.3 Logic

Query `HR_AttendanceRecords` where:

- `AttendanceDateKey = today`
- `IsOvertime = true`

Group by:

- Division.
- Unit.
- Supervisor.

Include:

- Employee name.
- Clock-out time.
- Overtime minutes.
- Total hours.

## 10. Flow 5 - Exception Notification

### 10.1 Purpose

Notify the right reviewer when an exception record is created and review is required.

Ordinary late arrivals are excluded because they do not require approval.

### 10.2 Trigger

SharePoint trigger:

- When an item is created in `HR_AttendanceExceptions`.

### 10.3 Conditions

Run only when:

- `ReviewRequired = true`.
- `ReviewStatus = Pending`.

### 10.4 Logic

1. Read exception item.
2. Determine reviewer:
   - Supervisor email from exception item, or
   - HR recipient from settings, depending on exception type.
3. Send review notification email.
4. Create audit entry with `ActionType = NotificationSent`.

### 10.5 Reviewer Routing

Recommended initial routing:

| Exception Type | Reviewer |
| --- | --- |
| `MissedClockIn` | Supervisor, HR copied or summarized |
| `MissedClockOut` | Supervisor, HR copied or summarized |
| `Absent` | Supervisor and HR |
| `EarlyDeparture` | Supervisor |
| `ManualCorrection` | HR |
| `SystemError` | HR/ICT |

This routing is proposed and needs confirmation.

## 11. Flow 6 - Exception Review Outcome Notification

### 11.1 Purpose

Notify the employee when an exception review is approved, rejected, or resolved.

### 11.2 Trigger

SharePoint trigger:

- When an item is modified in `HR_AttendanceExceptions`.

### 11.3 Conditions

Run only when:

- `ReviewStatus` changed to `Approved`, `Rejected`, or `Resolved`.

### 11.4 Logic

1. Read updated exception item.
2. Send notification to employee.
3. Update related `HR_AttendanceRecords.ExceptionStatus`.
4. Create audit entry with `ActionType = ExceptionReviewed` or `NotificationSent`.

### 11.5 Duplicate Prevention

Use a field or audit lookup to avoid sending multiple outcome emails for the same status.

Recommended future field if needed:

- `OutcomeNotificationSent`
- `OutcomeNotificationSentDateTime`

## 12. Flow 7 - Settings Change Audit

### 12.1 Purpose

Track changes to attendance policy and network settings.

### 12.2 Trigger

SharePoint trigger:

- When an item is modified in `HR_AttendanceSettings`.

### 12.3 Logic

1. Capture setting key, old/new value if available, modified by, and timestamp.
2. Create `HR_AttendanceAuditLog` item with `ActionType = SettingsChanged`.
3. Optionally notify HR/system administrators for sensitive settings:
   - `attendance.office.public.ip`
   - `attendance.network.required`
   - `workday.start.time`
   - `workday.end.time`
   - `clockout.required`

## 13. Optional Future Flow - Controlled Clock-In/Clock-Out Write

### 13.1 Purpose

Improve security by moving SharePoint write operations from the React client to Power Automate.

This is not required for the initial UI design but is the preferred hardening path if management wants stronger protection against users bypassing client-side checks.

### 13.2 Possible Trigger Options

Options:

- Power Automate instant flow triggered from Power Apps/Power Automate button.
- HTTP-triggered flow if premium licensing is available.
- SharePoint request list pattern where the app creates a request and the flow validates/processes it.

Given the environment's preference to avoid premium connectors, the SharePoint request list pattern is the most practical non-premium option.

### 13.3 SharePoint Request List Pattern

Future list:

- `HR_AttendanceActionRequests`

Flow:

1. React app creates request item with action type, employee email, timestamp, detected public IP, and network check result.
2. Power Automate validates the request.
3. Power Automate creates or updates `HR_AttendanceRecords`.
4. Power Automate writes audit log.
5. Power Automate marks request as processed or rejected.

This pattern keeps the rest of the intranet unchanged and strengthens attendance-specific writes.

## 14. Email Template Guidelines

All attendance emails should follow existing SCPNG intranet email style where possible.

Recommended fields:

- Clear subject line.
- Employee name.
- Attendance date.
- Attendance status.
- Clock-in/clock-out time where relevant.
- Supervisor or HR action required where relevant.
- Link to the intranet attendance page or dashboard.

Avoid:

- Sensitive private notes in summary emails.
- Overly long audit detail in employee-facing messages.
- Sending duplicate emails from rerun flows.

## 15. Error Handling

Each flow should:

- Catch failed SharePoint operations where possible.
- Log failures to `HR_AttendanceAuditLog` with `ActionType = SystemJobRun` or a failure detail.
- Avoid partial duplicate updates on retry.
- Use clear run names including date and flow type.
- Notify ICT/admin if a critical scheduled flow fails repeatedly.

## 16. Testing Scenarios

Minimum test cases:

- Employee clocks in before 8:30 AM; no late status.
- Employee clocks in after 8:30 AM; late status recorded with no approval.
- Employee clocks out after 4:00 PM; overtime recorded.
- Employee clocks in but does not clock out; missing clock-out flow marks record.
- Employee does not clock in; missing clock-in flow marks record.
- Employee is on approved leave; missing clock-in flow does not falsely mark absent.
- Daily HR summary includes correct counts.
- Exception notification sends only once.
- Settings change creates audit entry.
- Flow rerun does not duplicate records or emails.

## 17. Open Decisions

- Confirm whether approved leave should show as a separate attendance status or simply be excluded from absence checks.
- HR summary recipient confirmed as Thomas Mondaya. ICT support copy recipient confirmed as John Sarwom.
