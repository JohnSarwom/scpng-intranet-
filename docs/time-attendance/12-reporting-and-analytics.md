# Time and Attendance Module - Reporting and Analytics

> Status: Drafted for review  
> Reporting target: Intranet dashboards first, Power BI optional later  
> Data source: SharePoint Lists  
> Primary users: Employees, supervisors, HR, management

## 1. Purpose

This document defines the reporting and analytics design for the Time and Attendance module. It covers operational dashboards, HR reports, supervisor views, employee history, management summaries, SharePoint views, and optional Power BI reporting.

The reporting model must support the confirmed attendance policy:

- Workday starts at 8:30 AM.
- Workday ends at 4:00 PM.
- No grace period.
- Clock-out is mandatory.
- Overtime begins after 4:00 PM.
- Lunch is not tracked.
- Late arrivals are recorded automatically and do not require approval.
- Time and Attendance is the only module with office-network attendance recording restrictions.

## 2. Reporting Principles

- The intranet is the primary reporting experience for Phase 1.
- SharePoint Lists are the system of record.
- Reports must support daily HR operations first.
- Supervisors should see only their team/direct reports.
- Employees should see only their own records.
- HR should see organization-wide records.
- Management summaries should focus on trends, not individual sensitive notes.
- Detailed audit/correction data should be restricted to HR/admin users.
- Power BI can be added later for richer management dashboards.

## 3. Reporting Data Sources

| Source | Reporting Use |
| --- | --- |
| `HR_AttendanceRecords` | Main attendance metrics, daily register, late, overtime, missing clock-out |
| `HR_AttendanceExceptions` | Missed attendance reasons, review queues, resolved/rejected exceptions |
| `HR_AttendanceAuditLog` | Corrections, settings changes, system job logs, compliance review |
| `HR_AttendanceSettings` | Policy values shown in reports and calculations |
| Employee profile source | Active staff count, division, unit, supervisor mapping |
| Staff Leave Requests | Approved leave exclusion/status |

## 4. Key Metrics

### 4.1 Daily Metrics

| Metric | Definition |
| --- | --- |
| Active Employees | Active employees expected to record attendance |
| Clocked In | Employees with `ClockInTime` for selected date |
| Clocked Out | Employees with `ClockOutTime` for selected date |
| On Time | Clock-in at or before 8:30 AM |
| Late Arrivals | `IsLate = true` or clock-in after 8:30 AM |
| Missing Clock-In | No clock-in after scheduled check and no approved leave |
| Missing Clock-Out | Clock-in exists but clock-out missing after end-of-day check |
| Overtime Records | `IsOvertime = true` or clock-out after 4:00 PM |
| Overtime Minutes | Sum of `OvertimeMinutes` |
| Early Departures | `IsEarlyDeparture = true` |
| Pending Exceptions | Exception records with `ReviewStatus = Pending` |
| Corrected Records | Records where `IsManuallyCorrected = true` |

### 4.2 Trend Metrics

| Metric | Purpose |
| --- | --- |
| Late count by week/month | Identify lateness patterns |
| Overtime count/minutes by week/month | Monitor overtime volume |
| Missing clock-out rate | Detect compliance or usability issues |
| Absence/missing clock-in rate | HR monitoring |
| Exception resolution time | Supervisor/HR workflow performance |
| Corrections count | Data quality and process review |

## 5. Employee Reporting

### 5.1 My Attendance History

Audience:

- Employee only.

Filters:

- Date range.
- Status.
- Exception status.

Columns:

| Column | Description |
| --- | --- |
| Date | Attendance date |
| Status | Badge |
| Clock In | Local clock-in time |
| Clock Out | Local clock-out time |
| Late Minutes | Minutes after 8:30 AM |
| Overtime Minutes | Minutes after 4:00 PM |
| Total Hours | Calculated total hours |
| Exception | None/Pending/Resolved |

### 5.2 Employee Summary Cards

Recommended cards:

- This month present days.
- This month late arrivals.
- This month overtime hours.
- Pending issues.

Confirmed notification/reporting behavior: overtime appears in reports and a separate overtime email is enabled. Employee-facing overtime visibility remains a UI display decision.

## 6. Supervisor Reporting

### 6.1 Team Attendance Dashboard

Audience:

- Supervisors/managers.

Filters:

- Date.
- Employee.
- Status.
- Exception status.
- Overtime only.
- Late only.

Summary cards:

- Team members.
- Clocked in.
- Late.
- Missing clock-in.
- Missing clock-out.
- Overtime.
- Pending exceptions.

Table columns:

| Column | Description |
| --- | --- |
| Employee | Name and unit |
| Status | Badge |
| Clock In | Time |
| Clock Out | Time |
| Late | Minutes |
| Overtime | Minutes |
| Exception | Review status |
| Action | View/review |

### 6.2 Supervisor Trend Views

Recommended Phase 2 charts:

- Late arrivals by employee.
- Overtime by employee.
- Missing clock-out by employee.
- Team attendance completion rate.

## 7. HR Reporting

### 7.1 Daily Attendance Register

Audience:

- HR officers and HR administrators.

Purpose:

- Daily operational attendance review.

Filters:

- Date.
- Division.
- Unit.
- Employee.
- Status.
- Late only.
- Overtime only.
- Missing clock-out only.
- Exception status.

Columns:

| Column | Description |
| --- | --- |
| Employee | Name/email |
| Division | Snapshot from profile |
| Unit | Snapshot from profile |
| Supervisor | Supervisor name/email |
| Status | Badge |
| Clock In | Time |
| Clock Out | Time |
| Late Minutes | Number |
| Overtime Minutes | Number |
| Total Hours | Number |
| Network Verified | Yes/No |
| Exception Status | Badge |
| Corrected | Yes/No |

### 7.2 HR Summary Cards

Recommended cards:

- Active employees.
- Clocked in.
- Clocked out.
- Late arrivals.
- Missing clock-in.
- Missing clock-out.
- Overtime records.
- Pending exceptions.

### 7.3 HR Charts

Recommended charts:

| Chart | Type | Purpose |
| --- | --- | --- |
| Attendance by Status | Bar/donut | Daily status breakdown |
| Late Arrivals by Division | Bar | Identify division-level trends |
| Overtime Minutes by Division | Bar | Monitor overtime distribution |
| Missing Clock-Out Trend | Line/bar | Track compliance |
| Exceptions by Type | Bar | See top exception categories |
| Corrections by Month | Bar | Monitor manual correction frequency |

## 8. Management Reporting

Management reports should use aggregated data unless individual names are required.

Recommended metrics:

- Monthly attendance completion rate.
- Late arrival trend.
- Overtime trend.
- Absence/missing clock-in trend.
- Division/unit comparison.
- Exception resolution trend.

Recommended views:

- Monthly executive summary.
- Division/unit attendance scorecard.
- Overtime monitoring summary.

Do not include detailed employee reasons or correction notes in management summaries unless HR explicitly approves it.

## 9. Compliance and Audit Reporting

Audience:

- HR.
- System administrators.
- Audit/compliance users if authorized.

Reports:

- HR corrections report.
- Settings changes report.
- Network validation failures where recorded.
- Audit log by employee.
- Audit log by actor.
- Power Automate job run history.

Audit report filters:

- Date range.
- Action type.
- Actor email.
- Employee email.
- Source.
- Network check result.

## 10. SharePoint Views

Recommended SharePoint list views support admin troubleshooting. The intranet remains the primary user experience.

### `HR_AttendanceRecords`

Views:

- Today Attendance.
- Late Today.
- Overtime Today.
- Missing Clock-Out.
- Missing Clock-In.
- HR Monthly Review.
- Corrected Records.

### `HR_AttendanceExceptions`

Views:

- Pending Review.
- My Submitted Exceptions.
- Supervisor Queue.
- HR Queue.
- Rejected Exceptions.
- Resolved Exceptions.

### `HR_AttendanceAuditLog`

Views:

- Recent Audit.
- Corrections.
- Settings Changes.
- Notifications Sent.
- Network Blocks.
- Power Automate Runs.

## 11. Daily HR Email Summary

The daily HR summary is defined in the notification and Power Automate documents.

Recommended content:

- Summary metrics.
- Late arrivals table.
- Missing clock-in table.
- Missing clock-out table.
- Overtime table.
- Pending exceptions table.
- Link to HR Attendance Dashboard.

Recommended schedule:

- Business days at 5:00 PM.
- Time zone: `Pacific/Port_Moresby`.

## 12. Optional Power BI Model

Power BI can be introduced after Phase 1 if HR/management needs richer analytics.

### 12.1 Data Tables

Recommended model:

- Attendance Records fact table.
- Attendance Exceptions fact table.
- Employee dimension.
- Date dimension.
- Division/unit dimension.

### 12.2 Measures

Potential measures:

- Attendance count.
- Late count.
- Late rate.
- Missing clock-in count.
- Missing clock-out count.
- Overtime hours.
- Average clock-in time.
- Average clock-out time.
- Exception approval rate.
- Average exception resolution days.

### 12.3 Refresh

Recommended initial refresh:

- Daily after 5:30 PM.

If near-real-time reporting is needed later, revisit refresh strategy and licensing.

## 13. Data Quality Rules

Reports should account for:

- A record can be both late and overtime.
- `Status` alone may not capture all reporting flags; use boolean fields such as `IsLate` and `IsOvertime`.
- Approved leave should prevent false missing clock-in/absence counts.
- Manual corrections should be visible to HR but not overemphasized in employee-facing summaries.
- Missing clock-out records should not count as completed attendance until resolved.
- Time calculations should use Papua New Guinea local time.

## 14. Export Requirements

Phase 1 recommended exports:

- HR daily register CSV/export.
- Monthly attendance summary export.
- Overtime export.
- Missing attendance export.

Export access:

- HR only for organization-wide exports.
- Supervisors only for team exports.
- Employees only for own history export if enabled.

## 15. Privacy and Access Rules

| Report | Employee | Supervisor | HR | Management |
| --- | --- | --- | --- | --- |
| Own attendance history | Own only | No | Yes | No |
| Team dashboard | No | Own team | Yes | Aggregated only |
| HR daily register | No | No | Yes | Optional aggregate |
| Overtime summary | Own if enabled | Team | Yes | Aggregate |
| Audit log | No | Limited if required | Yes | No |
| Management monthly summary | No | Optional | Yes | Yes, aggregate |

## 16. Implementation Notes

Frontend implementation should reuse existing patterns:

- Stat cards similar to HR analytics.
- Badges for statuses.
- Filters with `Select`, `Input`, and date controls.
- Tables for records and exceptions.
- Charts using existing chart libraries if already available.
- React Query hooks backed by `timeAttendanceSharePointService`.

Recommended new components:

- `AttendanceSummaryCards`.
- `AttendanceStatusChart`.
- `AttendanceRecordsTable`.
- `AttendanceExceptionsTable`.
- `OvertimeSummaryTable`.
- `AttendanceAuditTable`.

## 17. Open Decisions

- Confirm whether employees can see overtime immediately.
- Confirm whether management reports should be individual-level or aggregate-only.
- Confirm Power BI requirement and timing.
- Confirm export formats required by HR.
- Confirm whether approved leave appears as its own dashboard count.
- HR summary recipient confirmed as Thomas Mondaya. ICT/Admin support copy recipient confirmed as John Sarwom.
