# Time and Attendance Module - Notification Framework

> Status: Drafted for review  
> Delivery target: Power Automate + Office 365 Outlook  
> Template target: Reuse SCPNG intranet email style where possible  
> Noise principle: notify only when action or management visibility is needed

## 1. Purpose

This document defines the notification framework for the Time and Attendance module. It covers notification triggers, recipients, email content, escalation rules, audit logging, and implementation notes.

The framework must support the confirmed policy:

- Workday starts at 8:30 AM.
- Workday ends at 4:00 PM.
- No grace period.
- Clock-out is mandatory.
- Overtime starts after 4:00 PM.
- Lunch is not tracked.
- Late arrivals are recorded automatically and do not require approval.
- Office-network restriction applies only to attendance recording actions.

## 2. Notification Principles

- Do not send routine emails for every normal clock-in or clock-out unless HR later requests this.
- Ordinary late arrivals should be report-visible, not approval-driven.
- Notify employees when a missing attendance issue needs their attention.
- Notify supervisors/HR when review or visibility is required.
- Use daily summaries to avoid excessive individual emails.
- Avoid duplicate messages from Power Automate reruns.
- Log important notifications to `HR_AttendanceAuditLog`.
- Keep message wording simple and factual.

## 3. Notification Channels

| Channel | Usage |
| --- | --- |
| In-app status | Clock-in/out success, blocked network state, today's attendance status |
| Email | Missing clock-in/out, exception review, HR summaries, escalations |
| SharePoint list views | Admin/HR operational review |
| Future Power BI/dashboard | Management reporting |

Phase 1 should use in-app messages for immediate user feedback and email for workflow/reminder events.

## 4. Trigger Matrix

| Trigger | Recipient | Channel | Required | Notes |
| --- | --- | --- | --- | --- |
| Successful clock-in | Employee | In-app only | Yes | No email by default |
| Successful clock-out | Employee | In-app only | Yes | Show overtime if relevant |
| Late arrival | HR/supervisor reports | In-app/report | Yes | No approval, no email by default |
| Overtime recorded | HR/supervisor reports | In-app/report | Yes | Email optional |
| Missing clock-in detected | Employee, supervisor optional | Email + report | Yes |
| Missing clock-out detected | Employee, supervisor optional | Email + report | Yes |
| Exception reason submitted | Supervisor/HR reviewer | Email | If review required |
| Exception approved/resolved | Employee | Email | If review workflow enabled |
| Exception rejected | Employee | Email | If review workflow enabled |
| Exception overdue | Supervisor/HR | Email | Optional escalation |
| Daily attendance summary | HR recipients | Email | Recommended |
| Settings changed | HR/admin or audit only | Audit/email optional | Recommended audit |
| Network check blocked | Audit/in-app | In-app, audit where possible | Recommended |

## 5. Recipient Rules

### 5.1 Employee

Receives:

- Missing clock-in notification.
- Missing clock-out notification.
- Exception review outcome.
- Escalation reminders where policy requires.

Does not receive by default:

- Routine clock-in email.
- Routine clock-out email.
- Ordinary late arrival email.

### 5.2 Supervisor

Receives:

- Team missing clock-in alerts if enabled.
- Team missing clock-out alerts if enabled.
- Exception review notifications where supervisor review is required.
- Escalation notifications for unresolved team issues.

### 5.3 HR

Receives:

- Daily attendance summary.
- Organization-wide missing attendance summary.
- Overtime summary, either in daily summary or separate email.
- Escalation notifications.
- Settings change notifications if enabled.

### 5.4 ICT/System Administrator

Receives only technical/system alerts, such as:

- Repeated Power Automate flow failure.
- Office public IP not configured.
- Network verification system failure.

## 6. Email Template Standards

Implementation should reuse the existing SCPNG email style from the HR leave workflow where practical.

Recommended implementation direction:

- Reuse `buildSCPNGEmailHTML` and `buildSCPNGEmailSubject` patterns.
- Create attendance-specific template functions only for message content and detail rows.
- Keep templates Outlook-safe.
- Use plain table-based layouts for email compatibility.

Standard email sections:

- SCPNG header.
- Clear status badge/title.
- Short message body.
- Detail table.
- Action link where required.
- Footer with system/source note.

## 7. Template 1 - Missing Clock-In

### Trigger

Power Automate Missing Clock-In Check marks an employee as missing clock-in or absent.

### Recipient

- Employee.
- Supervisor if enabled.
- HR via daily summary.

### Subject

```text
Attendance Alert - Missing Clock-In for {date}
```

### Employee Body

```text
No clock-in was recorded for you today. Please review your attendance record and submit a reason if required by HR.
```

### Detail Rows

| Label | Value |
| --- | --- |
| Employee | `{EmployeeName}` |
| Date | `{AttendanceDate}` |
| Status | `Missing Clock-In` |
| Division | `{Division}` |
| Unit | `{Unit}` |

### Action

Link to:

```text
{appUrl}/time-attendance
```

## 8. Template 2 - Missing Clock-Out

### Trigger

Power Automate Missing Clock-Out Check finds an employee who clocked in but did not clock out.

### Recipient

- Employee.
- Supervisor if review/escalation is enabled.
- HR via daily summary.

### Subject

```text
Attendance Alert - Missing Clock-Out for {date}
```

### Body

```text
You clocked in today, but no clock-out was recorded. Please review the record and submit a reason or contact HR if correction is required.
```

### Detail Rows

| Label | Value |
| --- | --- |
| Employee | `{EmployeeName}` |
| Date | `{AttendanceDate}` |
| Clock In | `{ClockInTime}` |
| Status | `Missing Clock-Out` |
| Division | `{Division}` |
| Unit | `{Unit}` |

### Action

Link to:

```text
{appUrl}/time-attendance
```

## 9. Template 3 - Exception Review Required

### Trigger

An item is created in `HR_AttendanceExceptions` with:

- `ReviewRequired = true`
- `ReviewStatus = Pending`

### Recipient

- Supervisor or HR reviewer based on exception type.

### Subject

```text
Attendance Review Required - {EmployeeName} - {ExceptionType}
```

### Body

```text
An attendance exception requires your review. Please review the details and record your decision in the Time and Attendance module.
```

### Detail Rows

| Label | Value |
| --- | --- |
| Employee | `{EmployeeName}` |
| Date | `{AttendanceDate}` |
| Exception Type | `{ExceptionType}` |
| Reason Category | `{ReasonCategory}` |
| Details | `{ReasonDetails}` |
| Division | `{Division}` |
| Unit | `{Unit}` |

### Action

Link to:

```text
{appUrl}/time-attendance?tab=team
```

or for HR:

```text
{appUrl}/time-attendance?tab=hr
```

## 10. Template 4 - Exception Review Outcome

### Trigger

`HR_AttendanceExceptions.ReviewStatus` changes to:

- `Approved`
- `Rejected`
- `Resolved`

### Recipient

- Employee.

### Subject

```text
Attendance Review Update - {ReviewStatus}
```

### Body - Approved/Resolved

```text
Your attendance exception has been reviewed and marked as {ReviewStatus}.
```

### Body - Rejected

```text
Your attendance exception has been reviewed and rejected. Please contact your supervisor or HR if you need further clarification.
```

### Detail Rows

| Label | Value |
| --- | --- |
| Date | `{AttendanceDate}` |
| Exception Type | `{ExceptionType}` |
| Review Status | `{ReviewStatus}` |
| Reviewed By | `{ReviewedByName}` |
| Comments | `{ReviewComments}` |

## 11. Template 5 - Daily HR Attendance Summary

### Trigger

Scheduled Power Automate flow after close of business.

Recommended time:

- 5:00 PM local time.

### Recipient

- HR attendance recipients configured in `HR_AttendanceSettings`.

### Subject

```text
Daily Attendance Summary - {date}
```

### Summary Metrics

Include:

- Total active employees.
- Total clocked in.
- Total clocked out.
- Late arrivals.
- Missing clock-in.
- Missing clock-out.
- Overtime records.
- Pending exceptions.

### Tables

Include compact tables for:

- Late arrivals.
- Missing clock-in.
- Missing clock-out.
- Overtime.
- Pending exceptions.

### Action

Link to:

```text
{appUrl}/time-attendance?tab=hr
```

## 12. Template 6 - Overtime Summary

### Trigger

Either:

- Included in Daily HR Attendance Summary; recommended for Phase 1.
- Separate scheduled flow if HR wants a dedicated overtime email.

### Recipient

- HR.
- ICT support copy optional.
- Supervisor if enabled.

### Subject

```text
Overtime Summary - {date}
```

### Detail Rows/Table Columns

| Column | Value |
| --- | --- |
| Employee | `{EmployeeName}` |
| Division | `{Division}` |
| Unit | `{Unit}` |
| Clock Out | `{ClockOutTime}` |
| Overtime | `{OvertimeMinutes}` |
| Total Hours | `{TotalHours}` |

## 13. Template 7 - Settings Change Alert

### Trigger

Sensitive setting is changed in `HR_AttendanceSettings`.

### Recipient

- HR Administrator.
- System Administrator if enabled.

### Subject

```text
Attendance Setting Changed - {SettingKey}
```

### Body

```text
An attendance module setting has been changed. Please review the details below.
```

### Detail Rows

| Label | Value |
| --- | --- |
| Setting | `{SettingKey}` |
| Old Value | `{OldValue}` |
| New Value | `{NewValue}` |
| Changed By | `{ActorEmail}` |
| Changed At | `{ActionDateTime}` |

## 14. Escalation Rules

Escalation is optional for Phase 1 and should be confirmed by HR.

Recommended starting rules:

| Event | Escalate To | Timing |
| --- | --- | --- |
| Missing clock-in unresolved | Supervisor, then HR | Same day or next business day |
| Missing clock-out unresolved | Supervisor, then HR | Next business day |
| Exception pending review | HR | After 2 business days |
| Repeated Power Automate failure | ICT/System Admin | After repeated failure |

No escalation for ordinary late arrivals unless HR later requests this.

## 15. Duplicate Prevention

Power Automate flows must avoid sending duplicate emails.

Recommended techniques:

- Check existing `HR_AttendanceAuditLog` for `NotificationSent` with related `AttendanceID`/`ExceptionID`.
- Add sent fields if needed:
  - `MissingClockInNotificationSent`
  - `MissingClockOutNotificationSent`
  - `OutcomeNotificationSent`
  - `SummarySentDate`
- Use flow run date and event type as idempotency keys.

## 16. Audit Logging

Create audit entries for important notifications:

| Notification | Audit Action Type |
| --- | --- |
| Missing clock-in email | `NotificationSent` |
| Missing clock-out email | `NotificationSent` |
| Exception review email | `NotificationSent` |
| Review outcome email | `NotificationSent` |
| Daily HR summary | `NotificationSent` |
| Settings change alert | `NotificationSent` |

Audit details should include:

- Recipient.
- Trigger.
- Related attendance ID.
- Related exception ID.
- Flow name.
- Sent date/time.
- Success/failure status.

## 17. In-App Notification and Toast Rules

Use in-app feedback for immediate actions:

| Action | Message |
| --- | --- |
| Clock-in success | `Clock-in recorded successfully.` |
| Clock-out success | `Clock-out recorded successfully.` |
| Late clock-in | `Clock-in recorded. This attendance has been marked late.` |
| Overtime clock-out | `Clock-out recorded. Overtime has been captured for reporting.` |
| Outside office network | `Attendance recording is available only from the SCPNG office network.` |
| Network check failed | `Unable to verify office network. Please try again.` |
| Duplicate clock-in | `You have already clocked in today.` |
| Duplicate clock-out | `You have already clocked out today.` |

## 18. Configuration Settings

Recommended settings in `HR_AttendanceSettings`:

| Setting Key | Purpose |
| --- | --- |
| `notifications.daily.hr.enabled` | Enable daily HR summary |
| `notifications.daily.hr.recipient` | HR summary recipient: Thomas Mondaya, `tmondaya@scpng.gov.pg` |
| `notifications.ict.support.copy` | ICT/Admin support copy recipient: John Sarwom, `jsarwom@scpng.gov.pg` |
| `notifications.missing.clockin.employee.enabled` | Employee missing clock-in email |
| `notifications.missing.clockin.supervisor.enabled` | Supervisor missing clock-in email |
| `notifications.missing.clockout.employee.enabled` | Employee missing clock-out email |
| `notifications.missing.clockout.supervisor.enabled` | Supervisor missing clock-out email |
| `notifications.overtime.summary.enabled` | Overtime summary email |
| `notifications.exception.review.enabled` | Exception review email |
| `notifications.exception.outcome.enabled` | Review outcome email |
| `notifications.settings.change.enabled` | Sensitive settings change email |

## 19. Open Decisions

- Confirm whether supervisors receive individual missing clock-in/missing clock-out emails or only dashboard visibility.
- Confirm escalation timing for unresolved missing clock-in/out issues.
- Confirm whether settings change alerts should email admins or only create audit logs.
- HR summary recipient confirmed as Thomas Mondaya. ICT/Admin support copy recipient confirmed as John Sarwom.
