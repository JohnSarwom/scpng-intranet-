# Time and Attendance Module - Phase 1 SharePoint Setup Build Checklist

> Status: Ready for implementation planning  
> Phase: SharePoint foundation setup  
> Storage target: SharePoint Lists  
> Implementation target: Existing `SharePointListSetupService` pattern

## 1. Purpose

This checklist defines the exact SharePoint setup work required before the Time and Attendance UI and Power Automate flows are built.

The goal is to create the storage foundation first, using the existing intranet approach:

- Add list provisioning methods to `src/services/sharePointListSetupService.ts`.
- Store all attendance data in SharePoint Lists.
- Seed policy and network settings from the confirmed requirements.
- Keep the restriction scoped to the Time and Attendance module only.
- Avoid changing any existing intranet module behavior.

## 2. Confirmed Setup Inputs

| Area | Confirmed Value |
| --- | --- |
| Workday start | `08:30` |
| Workday end | `16:00` |
| Grace period | `0` minutes |
| Clock-out required | `true` |
| Overtime threshold | After `16:00` |
| Lunch tracking | `false` |
| Remote attendance | `false` |
| Internal LAN reference | `192.168.7.0/24` |
| Firewall gateway | `192.168.7.1` |
| Office public IP | `124.240.199.154` |
| HR recipient | Thomas Mondaya, `tmondaya@scpng.gov.pg` |
| ICT/Admin support copy | John Sarwom, `jsarwom@scpng.gov.pg` |
| Power Automate owner | `admin@scpng.gov.pg` |
| Permission resource key | `attendance` |
| Initial rollout | Immediate internal testing with confirmed roster |

## 3. Lists to Provision

Provision these lists in this order:

| Order | List | Required Now | Purpose |
| --- | --- | --- | --- |
| 1 | `HR_AttendanceSettings` | Yes | Policy, network, recipient, and module configuration |
| 2 | `HR_AttendanceRecords` | Yes | Daily attendance records |
| 3 | `HR_AttendanceExceptions` | Yes | Missed clock-in/out reasons and supervisor review |
| 4 | `HR_AttendanceAuditLog` | Yes | Append-style action and compliance audit |
| 5 | `HR_AttendanceSchedules` | No | Future schedule variation support |

`HR_AttendanceSchedules` should be documented but not required for the first build because all staff currently use the same 8:30 AM to 4:00 PM workday.

## 4. Implementation Targets

Add these methods to the existing setup service:

| Method | Responsibility |
| --- | --- |
| `createAttendanceSettingsList()` | Create or verify `HR_AttendanceSettings` |
| `createAttendanceRecordsList()` | Create or verify `HR_AttendanceRecords` |
| `createAttendanceExceptionsList()` | Create or verify `HR_AttendanceExceptions` |
| `createAttendanceAuditLogList()` | Create or verify `HR_AttendanceAuditLog` |
| `createAttendanceSchedulesList()` | Optional Phase 2 setup |
| `seedAttendanceSettings()` | Insert/update confirmed default settings |
| `setupTimeAttendanceLists()` | Orchestrate all required list creation and seeding |

Implementation should follow the current service pattern:

- Check whether each list already exists before creating it.
- Return `{ success, message, details }` results.
- Use Microsoft Graph list creation with `list: { template: 'genericList' }`.
- Use single line text columns for IDs, emails, names, keys, and status helpers.
- Use date/time columns for action timestamps.
- Use choice columns for controlled statuses.
- Use yes/no columns for booleans.
- Use multiline text columns for reason details, notes, user agent, and JSON snapshots.

## 5. Required Initial Settings

Seed `HR_AttendanceSettings` with the following records:

| Setting Key | Setting Value | Type | Category |
| --- | --- | --- | --- |
| `workday.start.time` | `08:30` | Time | Policy |
| `workday.end.time` | `16:00` | Time | Policy |
| `late.grace.minutes` | `0` | Number | Policy |
| `clockout.required` | `true` | Boolean | Policy |
| `lunch.tracking.enabled` | `false` | Boolean | Policy |
| `overtime.enabled` | `true` | Boolean | Policy |
| `attendance.network.required` | `true` | Boolean | Network |
| `attendance.internal.network` | `192.168.7.0/24` | IPRange | Network |
| `attendance.firewall.gateway` | `192.168.7.1` | Text | Network |
| `attendance.office.public.ip` | `124.240.199.154` | IPRange | Network |
| `attendance.remote.allowed` | `false` | Boolean | Security |
| `late.approval.required` | `false` | Boolean | Policy |
| `missing.clockin.review.required` | `true` | Boolean | Policy |
| `missing.clockout.review.required` | `true` | Boolean | Policy |
| `daily.hr.summary.enabled` | `true` | Boolean | Reporting |
| `notifications.daily.hr.recipient` | `tmondaya@scpng.gov.pg` | Email | Notification |
| `notifications.ict.support.copy` | `jsarwom@scpng.gov.pg` | Email | Notification |
| `notifications.overtime.summary.enabled` | `true` | Boolean | Notification |
| `retention.years` | `7` | Number | Security |

Seeding must be idempotent. If a setting already exists, update the value only when the setup action is explicitly intended to refresh defaults.

## 6. Column Validation Checklist

Before moving to UI build, confirm each required list has the required columns from [05-sharepoint-schema-design.md](05-sharepoint-schema-design.md).

Minimum Phase 1 validation:

| List | Must Have |
| --- | --- |
| `HR_AttendanceSettings` | `SettingKey`, `SettingValue`, `SettingValueLong`, `SettingType`, `Category`, `IsActive`, `Description`, `LastUpdatedBy`, `LastUpdatedDateTime` |
| `HR_AttendanceRecords` | `AttendanceID`, `AttendanceDate`, `AttendanceDateKey`, `EmployeeID`, `EmployeeName`, `EmployeeEmail`, `Division`, `Unit`, `SupervisorName`, `SupervisorEmail`, `ClockInTime`, `ClockOutTime`, `Status`, `IsLate`, `LateMinutes`, `IsOvertime`, `OvertimeMinutes`, `NetworkCheckPassed`, `DetectedPublicIP`, `ExpectedOfficeIP`, `DeviceUserAgent`, `TimeZone`, `ExceptionStatus` |
| `HR_AttendanceExceptions` | `ExceptionID`, `AttendanceID`, `AttendanceDate`, `EmployeeName`, `EmployeeEmail`, `SupervisorEmail`, `ExceptionType`, `ReasonCategory`, `ReasonDetails`, `ReviewRequired`, `ReviewStatus`, `ReviewedByName`, `ReviewedByEmail`, `ReviewedDateTime`, `ReviewComments` |
| `HR_AttendanceAuditLog` | `AuditID`, `AttendanceID`, `ExceptionID`, `ActionType`, `ActionDateTime`, `ActorName`, `ActorEmail`, `ActorRole`, `EmployeeName`, `EmployeeEmail`, `Source`, `OldValue`, `NewValue`, `NetworkCheckPassed`, `DetectedPublicIP`, `Details` |

## 7. Index Checklist

Create indexes for query-heavy columns before internal testing:

| List | Indexes |
| --- | --- |
| `HR_AttendanceSettings` | `SettingKey`, `Category`, `IsActive` |
| `HR_AttendanceRecords` | `EmployeeEmail`, `AttendanceDate`, `AttendanceDateKey`, `Status`, `Division`, `Unit`, `SupervisorEmail`, `IsLate`, `IsOvertime`, `ExceptionStatus` |
| `HR_AttendanceExceptions` | `EmployeeEmail`, `AttendanceDate`, `ExceptionType`, `ReviewStatus`, `SupervisorEmail`, `Division`, `Unit` |
| `HR_AttendanceAuditLog` | `ActionDateTime`, `ActionType`, `EmployeeEmail`, `ActorEmail`, `AttendanceID`, `ExceptionID`, `Source` |

If any indexes cannot be created through the Microsoft Graph setup path, create them manually in SharePoint list settings and record that step in the deployment notes.

## 8. Permission Checklist

Initial setup should preserve broad technical access for ICT/Admin while the app enforces user-facing visibility.

Before internal testing, confirm:

- John Sarwom has admin/setup access.
- Thomas Mondaya has HR review/report access.
- Employees cannot access attendance settings through the UI.
- Employees can only see their own attendance records in the app.
- Supervisor views are filtered to team records in the app.
- Audit logs are not exposed to ordinary employees.
- Direct SharePoint list access is limited as much as practical without breaking the existing Graph service model.

## 9. Smoke Test Checklist

After provisioning:

1. Confirm all four required SharePoint lists exist.
2. Confirm seeded settings are present and active.
3. Confirm `notifications.daily.hr.recipient` is `tmondaya@scpng.gov.pg`.
4. Confirm `notifications.ict.support.copy` is `jsarwom@scpng.gov.pg`.
5. Create one manual test attendance record, then delete it or clearly mark it as test data.
6. Confirm date and email filters work on `HR_AttendanceRecords`.
7. Confirm exception records can link to attendance records by `AttendanceID`.
8. Confirm audit log records can be created.
9. Confirm no existing intranet lists or modules were modified.

## 10. Phase 1 Exit Criteria

Phase 1 is complete when:

- Required SharePoint lists are created or verified.
- Required columns are present.
- Required settings are seeded.
- Required indexes are created or documented for manual creation.
- Admin/HR ownership is confirmed.
- Test records can be created, queried, and removed/marked.
- The setup method can be safely rerun without duplicating lists or settings.

After this phase, proceed to the Time and Attendance service layer and UI build.
