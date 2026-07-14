# Time and Attendance Module - Maintenance and Support Procedures

> Status: Drafted for review  
> Support model: HR-owned process with ICT/system administration support  
> Stabilization period: 2 to 4 weeks after production go-live

## 1. Purpose

This document defines the maintenance and support procedures for the Time and Attendance module after deployment. It covers operational ownership, issue triage, monitoring, data corrections, audit reviews, Power Automate support, SharePoint maintenance, user support, and future enhancement handling.

The module must remain reliable without disrupting the rest of the SCPNG Intranet.

## 2. Support Principles

- HR owns attendance policy and business decisions.
- ICT/system administrators own technical configuration and platform support.
- Corrections must be controlled and audited.
- Power Automate flows must be monitored regularly.
- Office-network settings must be kept current.
- Support must preserve existing intranet behavior outside Time and Attendance.
- Issues affecting attendance recording are treated as high priority.

## 3. Ownership Matrix

| Area | Primary Owner | Support Owner |
| --- | --- | --- |
| Attendance policy | HR | Executive/Management if required |
| Office public IP/range | ICT | System Administrator |
| Attendance settings | HR Administrator | System Administrator |
| SharePoint list health | System Administrator | ICT |
| SharePoint permissions | System Administrator | ICT |
| Power Automate flows | ICT/System Administrator | HR for business rules |
| Attendance corrections | HR | System Administrator for technical issues |
| Daily HR summary review | HR | ICT if email/flow fails |
| Audit review | HR | System Administrator |
| User training | HR | ICT |
| Support triage | HR + ICT | System Administrator |

## 4. Stabilization Period

Recommended stabilization:

- 2 to 4 weeks after production go-live.

During stabilization, review daily:

- Clock-in/out success rate.
- Network check failures.
- Missing clock-in records.
- Missing clock-out records.
- Overtime records.
- Power Automate failures.
- HR corrections.
- Daily summary accuracy.
- User support tickets.

After stabilization, move to weekly/monthly review cadence.

## 5. Support Channels

Recommended support intake:

- HR receives business/process questions.
- ICT receives technical/network/platform issues.
- Critical clock-in/out incidents are escalated immediately to HR and ICT.

Support tickets should capture:

- User name and email.
- Date of issue.
- Device/browser if relevant.
- Whether user was in the office.
- Screenshot if available.
- Attendance action attempted.
- Error message.
- SharePoint item ID if known.

## 6. Issue Triage

| Severity | Description | Examples | Target Response |
| --- | --- | --- | --- |
| Critical | Security or module-wide failure | Remote user can clock in; no one can clock in | Same day immediate response |
| High | Major business workflow issue | Overtime calculation wrong; Power Automate not running | Same day |
| Medium | Workaround available | One user's record needs correction; summary email missing optional section | 1 to 2 business days |
| Low | Cosmetic or minor issue | Label wording, minor layout issue | Planned backlog |

## 7. Common Support Scenarios

### 7.1 User Cannot Clock In From Office

Check:

- Is the user authenticated?
- Does the employee profile exist?
- Is the office public IP configured correctly?
- Does the detected public IP match the configured office IP/range?
- Is the public IP lookup service available?
- Is SharePoint reachable?
- Has the user already clocked in?

Action:

- ICT confirms network/public IP.
- HR confirms profile and attendance status.
- HR corrects record if needed with audit reason.

### 7.2 User Cannot Clock Out

Check:

- Does today's clock-in record exist?
- Has the user already clocked out?
- Is the user on the office network?
- Is SharePoint update failing?

Action:

- Ask user to retry from office network.
- HR correction if legitimate clock-out was missed.

### 7.3 User Was Marked Late

Policy:

- Any clock-in after 8:30 AM is late.
- No grace period.
- Ordinary late arrivals do not require approval.

Action:

- HR may review only if the record is technically incorrect.
- Technical correction requires audit reason.

### 7.4 Missing Clock-Out

Check:

- Did the user forget to clock out?
- Did the network check block clock-out?
- Did SharePoint save fail?
- Did Power Automate mark the record correctly?

Action:

- Employee submits reason if required.
- Supervisor/HR reviews if configured.
- HR corrects record where appropriate.

### 7.5 Power Automate Flow Failure

Check:

- Flow run history.
- SharePoint connector status.
- Office 365 Outlook connector status.
- Permissions of flow owner/service account.
- Duplicate prevention conditions.

Action:

- ICT resolves connector/flow issue.
- Re-run flow if safe.
- Confirm no duplicate records or emails were created.

## 8. Attendance Correction Procedure

Corrections are HR-controlled.

Required fields:

- Employee.
- Attendance date.
- Original value.
- Corrected value.
- Correction reason.
- Corrected by.
- Correction date/time.

Rules:

- Correction reason is mandatory.
- Original values must be preserved in audit log.
- Correction should not delete the original attendance record.
- Correction should mark `IsManuallyCorrected = true`.
- Correction should create `HR_AttendanceAuditLog` entry.

## 9. Audit Review Procedure

Recommended cadence:

- Weekly during stabilization.
- Monthly after stabilization.
- On demand for disputes or investigations.

Review:

- HR corrections.
- Settings changes.
- Network block patterns.
- Power Automate job runs.
- Repeated missed clock-outs.
- Duplicate/failed attendance actions.

Audit reports should be restricted to HR and system administrators.

## 10. Power Automate Maintenance

Monitor:

- Missing Clock-In Check.
- Missing Clock-Out Check.
- Daily HR Attendance Summary.
- Exception Notification.
- Exception Review Outcome Notification.
- Settings Change Audit.

Routine tasks:

- Check failed runs.
- Confirm connectors are healthy.
- Confirm flow owner/service account remains active.
- Confirm schedules use `Pacific/Port_Moresby`.
- Confirm duplicate prevention is working.
- Confirm email recipients are current.

When editing flows:

- Document the change.
- Test with a controlled sample record.
- Verify audit log.
- Verify no duplicate emails.

## 11. SharePoint Maintenance

Monitor:

- List item volume.
- Indexed columns.
- Permission drift.
- View performance.
- Accidental direct edits.
- Audit list growth.

Routine tasks:

- Review list thresholds and indexing.
- Archive old records if required by retention policy.
- Confirm `HR_AttendanceSettings` values are current.
- Confirm office public IP/range is current.
- Confirm HR/admin-only access to settings and audit logs.

## 12. Network Configuration Maintenance

ICT must maintain:

- Office public/WAN IP address or range.
  - Confirmed value: `124.240.199.154`.
- Firewall routing assumptions.
- Internal LAN reference: `192.168.7.0/24`.
- Firewall gateway reference: `192.168.7.1`.
- Remote/VPN policy: not allowed for attendance.

When the public IP changes:

1. ICT confirms the new public IP/range.
2. HR/system admin updates `HR_AttendanceSettings`.
3. Settings change is audited.
4. Test office clock-in/out.
5. Test outside-office block.

## 13. Data Retention and Archiving

Retention period needs final HR/legal confirmation.

Recommended baseline:

- Attendance records: 7 years.
- Audit logs: 7 years.
- Exceptions/corrections: same as attendance records.
- Settings change logs: same as audit logs.

Archiving should preserve:

- Employee identity snapshot.
- Date/time values.
- status values.
- correction history.
- audit links where practical.

## 14. Communication Procedures

### Planned Maintenance

Notify users if attendance recording may be unavailable.

Message should include:

- Maintenance window.
- Expected impact.
- HR contact for attendance issues.
- Whether manual attendance records will be accepted.

### Unplanned Outage

Notify HR and ICT immediately.

If clock-in/out is unavailable:

- HR may instruct staff on temporary manual recording.
- ICT investigates root cause.
- HR reconciles records after service restoration.

## 15. Future Enhancement Intake

Potential enhancements:

- Power Automate-controlled clock-in/out write layer.
- Power BI dashboard.
- Teams integration.
- Kiosk mode.
- QR-based office terminal.
- Payroll export.
- Biometric/access-control import.
- Advanced overtime approval.
- Shift schedules.

Enhancement request process:

1. HR or management submits request.
2. ICT/system admin assesses technical impact.
3. HR confirms policy impact.
4. Prioritize into backlog.
5. Update documentation before implementation.

## 16. Maintenance Checklist

Weekly during stabilization:

- Review failed Power Automate runs.
- Review network check failures.
- Review missing clock-out count.
- Review HR corrections.
- Review user support issues.
- Confirm daily HR summary accuracy.

Monthly after stabilization:

- Review audit logs.
- Review settings changes.
- Review SharePoint list performance.
- Review permissions.
- Review reporting accuracy.
- Review enhancement backlog.

Quarterly:

- Confirm office public IP/range.
  - Current value: `124.240.199.154`.
- Confirm retention/archiving needs.
- Review security posture.
- Review whether stronger write hardening is needed.

## 17. Open Support Decisions

- Confirm support contact/channel.
- Confirm HR audit review cadence.
- Confirm who can approve HR corrections.
- Confirm temporary manual attendance procedure for outages.
