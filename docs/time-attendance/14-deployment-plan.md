# Time and Attendance Module - Deployment Plan

> Status: Drafted for review  
> Rollout model: Immediate internal testing, then phased production rollout when ready  
> Storage target: SharePoint Lists  
> Workflow target: Power Automate  
> UI target: Existing SCPNG Intranet

## 1. Purpose

This document defines the deployment plan for the Time and Attendance module. It covers prerequisites, rollout phases, SharePoint setup, Power Automate deployment, configuration, testing, training, go-live, rollback, and sign-off.

The deployment must preserve the existing intranet experience. Only Time and Attendance clock-in/clock-out actions should be restricted to office-network users.

## 2. Deployment Principles

- Deploy in phases.
- Use the confirmed pilot group for immediate internal testing before organization-wide rollout.
- Confirm office public IP before enabling enforcement.
- Keep existing modules unchanged.
- Avoid premium Power Automate connectors in Phase 1.
- Use SharePoint Lists as the system of record.
- Validate security, audit, and reporting before go-live.
- Keep rollback simple and documented.

## 3. Deployment Phases

| Phase | Name | Outcome |
| --- | --- | --- |
| 1 | Pre-deployment readiness | Confirm decisions, owners, and technical prerequisites |
| 2 | SharePoint setup | Create lists, settings, indexes, and permissions |
| 3 | UI deployment | Add module route, navigation, and attendance UI |
| 4 | Power Automate deployment | Deploy scheduled and notification flows |
| 5 | Immediate internal testing | Validate rules, security, flows, and reports with confirmed pilot users |
| 6 | Pilot rollout | Continue testing with selected users in real conditions if needed |
| 7 | Production rollout | Enable for all intended staff when HR/ICT decide the module is ready |
| 8 | Stabilization | Monitor issues and support early adoption |

## 4. Pre-Deployment Prerequisites

Required before build/deployment:

- Office public internet/WAN egress IP confirmed: 124.240.199.154.
- HR daily summary recipients confirmed from the employee list and internal staffing update: Thomas Mondaya as HR recipient, with John Sarwom as ICT admin/support copy recipient.
- Overtime confirmed as report-only plus separate overtime summary email.
- Missed clock-in/missed clock-out review confirmed: employee submits reason, supervisor reviews, HR can view.
- Attendance/audit retention confirmed: 7 years.
- Pilot group confirmed from the existing employee list and internal staffing update.
- Power Automate owner/service account confirmed: admin@scpng.gov.pg.
- Confirm SharePoint site and list ownership.
- Nav permission confirmed: new `attendance` resource key.
- Phase 1 write path confirmed: React app writes directly to SharePoint through Microsoft Graph.

## 5. SharePoint Deployment

### 5.1 Lists to Create

Required Phase 1 lists:

- `HR_AttendanceRecords`
- `HR_AttendanceExceptions`
- `HR_AttendanceAuditLog`
- `HR_AttendanceSettings`

Optional/Phase 2:

- `HR_AttendanceSchedules`

### 5.2 Provisioning Approach

Add setup methods to the existing SharePoint setup service pattern:

- `createAttendanceRecordsList()`
- `createAttendanceExceptionsList()`
- `createAttendanceAuditLogList()`
- `createAttendanceSettingsList()`
- `createAttendanceSchedulesList()`
- `setupTimeAttendanceLists()`
- `seedAttendanceSettings()`

Use the existing `createList()` and `ensureColumn()` style already used by the system.

### 5.3 Initial Settings

Seed `HR_AttendanceSettings` with:

| Setting | Value |
| --- | --- |
| Workday start | `08:30` |
| Workday end | `16:00` |
| Grace period | `0` |
| Clock-out required | `true` |
| Lunch tracking | `false` |
| Overtime enabled | `true` |
| Attendance network required | `true` |
| Internal network reference | `192.168.7.0/24` |
| Firewall gateway | `192.168.7.1` |
| Office public IP | `124.240.199.154` |
| Remote attendance | `false` |

### 5.4 Permissions

Validate:

- Employees cannot view other employees' records in the app.
- Supervisors see only team records.
- HR sees organization-wide records.
- Settings are HR/admin only.
- Audit logs are HR/admin only.
- Direct SharePoint edits are limited as far as practical.

## 6. UI Deployment

### 6.1 Files/Areas to Add

Expected implementation areas:

- `src/pages/TimeAttendance.tsx`
- `src/components/time-attendance/`
- `src/hooks/useTimeAttendance.ts`
- `src/services/timeAttendanceSharePointService.ts`
- `src/types/attendance.ts`
- `src/config/navItems.ts`
- `src/App.tsx`

### 6.2 Route

Add:

```tsx
<Route path="/time-attendance" element={<ProtectedRoute><TimeAttendance /></ProtectedRoute>} />
```

Network restriction must be applied inside the module or action area, not globally.

### 6.3 Navigation

Recommended nav item:

- Label: `Attendance`
- Icon: `Clock` or `CalendarClock`
- Path: `/time-attendance`

### 6.4 UI Validation

Before pilot:

- Employee Today view works.
- My History works.
- Team view works for supervisors.
- HR Dashboard works for HR.
- Settings view is restricted.
- Office-network blocked state is clear.
- Other intranet modules still work outside office network.

## 7. Power Automate Deployment

### 7.1 Required Flows

Deploy:

- Missing Clock-In Check.
- Missing Clock-Out Check.
- Daily HR Attendance Summary.
- Exception Notification.
- Exception Review Outcome Notification.
- Settings Change Audit.

Optional:

- Separate Overtime Summary.
- Controlled Clock-In/Clock-Out Write flow for future hardening.

### 7.2 Flow Configuration

Confirm:

- Environment ID.
- SharePoint site connection.
- Office 365 Outlook connection.
- Flow owner/service account.
- Time zone: `Pacific/Port_Moresby`.
- Flow schedules.
- HR recipient settings.
- Duplicate prevention logic.

### 7.3 Flow Validation

Validate:

- Missing clock-in flow creates one record only.
- Missing clock-out flow creates one exception only.
- Daily HR summary counts match SharePoint records.
- Notifications send to correct recipients.
- Flow reruns do not duplicate emails or records.
- Audit entries are created.

## 8. Testing Deployment Gate

Before internal testing:

- `npm run lint` passes.
- `npm run build` passes.
- Relevant tests pass.
- Network tests pass.
- SharePoint integration tests pass.
- Power Automate tests pass.
- Reporting tests pass.
- Role/permission tests pass.
- Regression tests pass.

Before production rollout, when HR/ICT decide to move beyond internal testing:

- All critical/high defects closed.
- Office public IP confirmed.
- Attendance test records validated.
- Power Automate flows tested.
- Notifications tested.
- Role access verified.
- Audit logging verified.
- HR internal testing acceptance recorded.
- ICT/security sign-off completed.

## 9. Internal Testing Rollout

### 9.1 Confirmed Test Group

Confirmed internal test/pilot group:

- HR unit representative.
- ICT representative.
- One supervisor.
- A small group of employees from one division/unit.

Confirmed roster:

| Role | Pilot Participant | Status |
| --- | --- | --- |
| ICT/Admin user | John Sarwom, Admin and ICT Support, `jsarwom@scpng.gov.pg` | Confirmed internal update |
| HR representative | Thomas Mondaya, Senior HR Officer, `tmondaya@scpng.gov.pg` | Confirmed internal update |
| ICT support copy/observer | John Sarwom, Admin and ICT Support, `jsarwom@scpng.gov.pg` | Confirmed internal update |
| Supervisor | Regina Wai, Senior Supervision Officer, `rwai@scpng.gov.pg` | Confirmed from employee list |
| Employee 1 | Titus Angu, Supervision Officer, `tangu@scpng.gov.pg` | Confirmed from employee list |
| Employee 2 | John Saki, Supervision Officer, `jsaki@scpng.gov.pg` | Confirmed from employee list |
| Employee 3 | Kylie Karis, Licensing Officer, `kkaris@scpng.gov.pg` | Confirmed from employee list |
| Employee 4 | Esther Alia, Market Data Officer, `ealia@scpng.gov.pg` | Confirmed from employee list |
| Employee 5 | Jacob Kom, Senior Investigations Officer, `jkom@scpng.gov.pg` | Confirmed from employee list |

Roster source: existing employee data in `src/data/hrImportData.ts` and `src/data/employeeData.ts`, adjusted for confirmed internal role changes. The confirmed operational test group keeps ICT/HR support involved while giving the supervisor/team test coverage inside the Licensing Market & Supervision business area.

### 9.2 Testing Timing

Confirmed:

- No formal UAT period is required at this stage.
- Internal testing can begin as soon as the SharePoint lists, UI, settings, and Power Automate flows are ready.
- Production go-live date is not fixed yet. HR/ICT will decide after internal testing.

### 9.3 Internal Testing Activities

Test users should:

- Clock in daily.
- Clock out daily.
- Test late clock-in.
- Test overtime clock-out.
- Confirm outside-office block.
- Validate history.
- Validate supervisor dashboard.
- Validate HR dashboard.
- Confirm daily HR summary.

### 9.4 Internal Testing Exit Criteria

Internal testing can move toward production rollout when:

- No critical/high defects remain.
- HR accepts report accuracy.
- ICT confirms network behavior.
- Supervisors confirm team visibility.
- Users understand the process.
- Support process is ready.

## 10. Training and Communication

### 10.1 Employee Communication

Explain:

- Attendance is recorded in the intranet.
- Clock-in starts at office arrival.
- Work starts at 8:30 AM.
- Clock-out is mandatory.
- Overtime is captured after 4:00 PM.
- The module works only from the office network for clock-in/out.
- Other intranet modules are not affected.

### 10.2 Supervisor Communication

Explain:

- How to view team attendance.
- How missing clock-in/out appears.
- How to review exceptions where required.
- How reports should be interpreted.

### 10.3 HR Communication

Explain:

- Dashboard use.
- Correction process.
- Audit review.
- Daily summary.
- Settings management.

## 11. Production Go-Live Checklist

Before go-live:

- SharePoint lists created.
- Initial settings seeded.
- Office public IP configured.
- Navigation enabled.
- Power Automate flows enabled.
- Notifications tested.
- Role access verified.
- Reports validated.
- Pilot complete.
- HR sign-off received.
- ICT sign-off received.
- Support contact confirmed.

Go-live actions:

- Enable module for target users.
- Confirm first clock-in from office network.
- Monitor Power Automate runs.
- Monitor SharePoint records.
- Monitor help/support issues.
- Send go-live communication.

## 12. Rollback Plan

If rollout must be paused:

1. Hide or disable the `Attendance` nav item.
2. Disable clock-in/out actions in the UI if needed.
3. Pause Power Automate flows.
4. Preserve SharePoint records created so far.
5. ICT/Admin sends the pause or rollback communication to HR and pilot/production users.
6. Log issues and remediation plan.

Rollback must not delete attendance records unless HR explicitly approves data cleanup.

## 13. Post-Go-Live Stabilization

Recommended stabilization period:

- 2 to 4 weeks after production go-live.

Monitor:

- Clock-in/out success rate.
- Network check failures.
- Missing clock-out frequency.
- Power Automate failures.
- Daily summary accuracy.
- HR corrections.
- User support requests.

## 14. Ownership

| Area | Owner |
| --- | --- |
| Attendance policy | HR |
| Office public IP | ICT |
| SharePoint lists | ICT/System Administrator |
| Power Automate flows | ICT/System Administrator |
| Attendance corrections | HR |
| User training | HR with ICT support |
| Go-live decision | HR + ICT |
| Support triage | HR + ICT |
| Rollback communication | ICT/Admin |

## 15. Open Deployment Decisions

- Production go-live date to be set later after internal testing.
- Confirm whether production rollout should be all staff at once or by division/unit.
