# Time and Attendance Module - Testing Strategy

> Status: Drafted for review  
> Test scope: UI, SharePoint, Power Automate, security, reporting, internal testing  
> Critical requirement: office-network restriction applies only to Time and Attendance

## 1. Purpose

This document defines the testing strategy for the Time and Attendance module. It describes what must be tested before rollout, who should test it, what evidence should be captured, and what must pass before production release.

The testing strategy is especially focused on:

- Office-network-only clock-in and clock-out.
- No disruption to the rest of the intranet.
- Correct attendance rules for 8:30 AM to 4:00 PM.
- Mandatory clock-out.
- Overtime after 4:00 PM.
- SharePoint list accuracy.
- Power Automate scheduled checks.
- Role-based visibility.
- Audit logging.

## 2. Test Phases

| Phase | Purpose |
| --- | --- |
| Unit/component testing | Validate individual UI components, hooks, and utility functions |
| Service/integration testing | Validate SharePoint service methods and data mapping |
| Workflow testing | Validate Power Automate flows and notification behavior |
| Security testing | Validate network restriction, permissions, and role access |
| Reporting testing | Validate dashboard counts, filters, exports, and summaries |
| Regression testing | Confirm existing intranet modules still work |
| Internal testing | HR, supervisors, and employees validate real-world workflows |

## 3. Test Environments

Recommended environments:

- Local development.
- Test SharePoint lists or clearly marked internal test records.
- Power Automate test flows.
- Pilot group in production-like environment before full rollout.

Avoid testing with live production attendance records until HR approves pilot rollout.

## 4. Core Acceptance Criteria

The module can proceed to pilot only when:

- An office-network user can clock in and clock out.
- An outside-office user cannot clock in or clock out.
- Outside-office users can still use unrelated intranet modules.
- Clock-in after 8:30 AM is marked late.
- Clock-out after 4:00 PM records overtime.
- Missing clock-in and missing clock-out checks work without duplicates.
- Attendance records are written correctly to SharePoint.
- Audit records are created for key actions.
- Employees see only their own records.
- Supervisors see only team records.
- HR sees organization-wide records.
- Reports match source list data.
- Existing leave, approvals, HR profiles, and other modules are not broken.

## 5. UI and Component Tests

### 5.1 Employee Today View

Test cases:

| ID | Scenario | Expected Result |
| --- | --- | --- |
| UI-001 | Page loads for authenticated employee | Employee profile, date, time, and status are visible |
| UI-002 | No attendance record today | `Clock In` is shown |
| UI-003 | Existing clock-in, no clock-out | `Clock Out` is shown |
| UI-004 | Already clocked out | Completed state is shown, no duplicate action |
| UI-005 | Employee profile missing | Clock actions disabled with HR contact message |
| UI-006 | SharePoint load fails | Error state with retry option |

### 5.2 Office Network State

| ID | Scenario | Expected Result |
| --- | --- | --- |
| UI-010 | Network check loading | Shows checking state |
| UI-011 | Network verified | Clock actions enabled where attendance state allows |
| UI-012 | Network blocked | Clock actions disabled, clear office-network message |
| UI-013 | Network check error | Clock actions disabled, recheck option visible |
| UI-014 | Office public IP not configured | Admin-facing warning, employee-safe unavailable message |

### 5.3 Dialogs and Forms

| ID | Scenario | Expected Result |
| --- | --- | --- |
| UI-020 | Clock-in confirmation | Shows employee/date/time/network verified |
| UI-021 | Clock-out confirmation after 4:00 PM | Shows overtime warning |
| UI-022 | HR correction dialog without reason | Save is blocked |
| UI-023 | Exception rejection without comments | Reject is blocked |

## 6. Attendance Rule Tests

| ID | Scenario | Expected Result |
| --- | --- | --- |
| RULE-001 | Clock-in at 8:29 AM | On time, `IsLate = false`, `LateMinutes = 0` |
| RULE-002 | Clock-in at 8:30 AM | On time, `IsLate = false`, `LateMinutes = 0` |
| RULE-003 | Clock-in at 8:31 AM | Late, `IsLate = true`, `LateMinutes = 1` |
| RULE-004 | Clock-out at 4:00 PM | No overtime |
| RULE-005 | Clock-out at 4:01 PM | Overtime, `OvertimeMinutes = 1` |
| RULE-006 | Clock-out before 4:00 PM | Early departure flag if enabled |
| RULE-007 | Duplicate clock-in attempt | Blocked |
| RULE-008 | Duplicate clock-out attempt | Blocked |
| RULE-009 | Clock-out without clock-in | Blocked |

Time zone must be validated against `Pacific/Port_Moresby`.

## 7. Network Security Tests

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NET-001 | User connected from office public IP | Clock-in/out allowed |
| NET-002 | User connected from outside office public IP | Clock-in/out disabled |
| NET-003 | User outside office opens HR Profiles | HR Profiles behavior unchanged |
| NET-004 | User outside office opens Leave Applications | Leave behavior unchanged |
| NET-005 | User outside office opens Approvals | Approvals behavior unchanged |
| NET-006 | Public IP lookup fails | Attendance actions disabled, recheck available |
| NET-007 | VPN user attempts attendance | Blocked unless policy explicitly allows and public IP matches |
| NET-008 | Detected IP metadata saved on successful clock action | Attendance record includes network metadata |

Confirmed network value:

- Office public internet/WAN egress IP: `124.240.199.154`.

## 8. SharePoint Integration Tests

### 8.1 `HR_AttendanceRecords`

| ID | Scenario | Expected Result |
| --- | --- | --- |
| SP-001 | Clock-in creates record | Item created with employee, date, clock-in, status |
| SP-002 | Clock-out updates record | Same item updated with clock-out, total hours |
| SP-003 | Late clock-in | `IsLate`, `LateMinutes`, status fields correct |
| SP-004 | Overtime clock-out | `IsOvertime`, `OvertimeMinutes`, total hours correct |
| SP-005 | Manual correction | Correction fields populated, audit created |
| SP-006 | Query by employee/date | Returns correct single record |

### 8.2 `HR_AttendanceExceptions`

| ID | Scenario | Expected Result |
| --- | --- | --- |
| SP-010 | Missing clock-in exception created | Correct employee/date/type/review status |
| SP-011 | Missing clock-out exception created | Correct attendance link and status |
| SP-012 | Exception approved | Review fields updated |
| SP-013 | Exception rejected | Comments required and saved |

### 8.3 `HR_AttendanceAuditLog`

| ID | Scenario | Expected Result |
| --- | --- | --- |
| SP-020 | Clock-in | Audit item created |
| SP-021 | Clock-out | Audit item created |
| SP-022 | HR correction | Old/new value captured |
| SP-023 | Settings change | Audit item created |
| SP-024 | Notification sent | Audit item created where configured |

## 9. Power Automate Workflow Tests

| ID | Flow | Scenario | Expected Result |
| --- | --- | --- | --- |
| PA-001 | Missing Clock-In Check | Employee has no attendance and no approved leave | Record/exception created once |
| PA-002 | Missing Clock-In Check | Employee has approved leave | Not falsely marked absent |
| PA-003 | Missing Clock-In Check | Flow rerun | No duplicate records/emails |
| PA-004 | Missing Clock-Out Check | Employee clocked in but not out | Missing clock-out status created |
| PA-005 | Missing Clock-Out Check | Flow rerun | No duplicate exception |
| PA-006 | Daily HR Summary | End-of-day run | Email contains correct counts |
| PA-007 | Overtime Summary | Overtime exists | Included in summary |
| PA-008 | Exception Notification | Pending review exception created | Reviewer notified |
| PA-009 | Settings Change Audit | Sensitive setting changed | Audit entry created |

## 10. Notification Tests

| ID | Scenario | Expected Result |
| --- | --- | --- |
| NOTIF-001 | Normal clock-in | In-app success only, no email by default |
| NOTIF-002 | Normal clock-out | In-app success only, no email by default |
| NOTIF-003 | Late clock-in | In-app late message, no approval email |
| NOTIF-004 | Missing clock-in | Employee email sent if enabled |
| NOTIF-005 | Missing clock-out | Employee email sent if enabled |
| NOTIF-006 | Exception submitted | Reviewer email sent |
| NOTIF-007 | Exception outcome | Employee email sent |
| NOTIF-008 | Daily HR summary | HR recipients receive summary |
| NOTIF-009 | Flow rerun | Duplicate email not sent |

## 11. Reporting Tests

| ID | Scenario | Expected Result |
| --- | --- | --- |
| REP-001 | HR daily register | Counts match `HR_AttendanceRecords` |
| REP-002 | Late arrivals filter | Shows only `IsLate = true` |
| REP-003 | Overtime filter | Shows only `IsOvertime = true` |
| REP-004 | Missing clock-out filter | Shows only missing/incomplete records |
| REP-005 | Division filter | Shows correct division data |
| REP-006 | Supervisor team view | Shows only assigned team |
| REP-007 | Employee history | Shows only authenticated employee records |
| REP-008 | Export | Export matches filtered data |

## 12. Permission and Role Tests

| ID | Role | Scenario | Expected Result |
| --- | --- | --- | --- |
| AUTH-001 | Employee | View own history | Allowed |
| AUTH-002 | Employee | View another employee's records | Denied/not visible |
| AUTH-003 | Employee | Access settings | Denied/not visible |
| AUTH-004 | Supervisor | View team records | Allowed |
| AUTH-005 | Supervisor | View unrelated employee records | Denied/not visible |
| AUTH-006 | HR | View organization records | Allowed |
| AUTH-007 | HR | Correct attendance record | Allowed with reason/audit |
| AUTH-008 | Admin | Manage settings | Allowed |

## 13. Regression Tests

The Time and Attendance implementation must not break:

- Login.
- Home page.
- HR Profiles.
- Leave application.
- Leave approvals.
- Approvals route.
- Documents.
- Forms.
- Task Registry.
- Reports/analytics.
- Navigation visibility.

Specific regression requirement:

- Outside-office users must still access all previously available intranet modules except attendance recording actions.

## 14. Internal Testing Scripts

### 14.1 Employee Testing

Steps:

1. Open the intranet and navigate to Attendance.
2. Confirm profile information is correct.
3. Confirm office network status is shown.
4. Clock in.
5. Confirm success message.
6. Confirm today's status is correct.
7. Clock out.
8. Confirm total hours display.
9. View My History.

Pass criteria:

- Employee can complete attendance actions only when office network is verified.
- Data appears correctly in history.

### 14.2 Supervisor Testing

Steps:

1. Open Attendance Team tab.
2. Review daily team summary.
3. Filter late records.
4. Filter missing clock-out records.
5. Open an exception.
6. Approve or reject where required.

Pass criteria:

- Supervisor sees only team records.
- Exception review works and is audited.

### 14.3 HR Testing

Steps:

1. Open HR Attendance Dashboard.
2. Review daily register.
3. Filter by division/unit/status.
4. Review overtime.
5. Review missing clock-in/out.
6. Correct a record with reason.
7. Confirm audit log.
8. Confirm daily summary email content.

Pass criteria:

- HR can manage organization-wide attendance accurately.
- Correction and audit process works.

### 14.4 ICT/Admin Testing

Steps:

1. Confirm office public IP setting.
2. Confirm office user can clock in/out.
3. Confirm remote user cannot clock in/out.
4. Confirm other modules remain accessible remotely.
5. Confirm Power Automate flows run successfully.
6. Confirm settings change audit.

Pass criteria:

- Module-only restriction works.
- No global intranet access regression.

## 15. Test Evidence

Capture:

- Screenshots of key UI states.
- SharePoint item IDs for created records.
- Power Automate run history screenshots.
- Email samples.
- Audit log entries.
- Internal testing notes.
- Defect list and resolution status.

## 16. Defect Severity

| Severity | Description | Example |
| --- | --- | --- |
| Critical | Blocks rollout or violates security | Remote user can clock in |
| High | Major workflow/data issue | Overtime calculation wrong |
| Medium | Workaround exists | Summary email missing one optional metric |
| Low | Cosmetic/minor issue | Label wording or spacing |

## 17. Release Readiness Checklist

Before production:

- All critical/high defects closed.
- Office public IP confirmed: `124.240.199.154`.
- Attendance test records validated.
- Power Automate flows tested.
- Notifications tested.
- Role access verified.
- Audit logging verified.
- Regression tests completed.
- HR internal testing acceptance recorded.
- ICT/security sign-off completed.

## 18. Test Commands

Repository commands available for implementation validation:

```powershell
npm run lint
npm run build
npm run test
```

Additional implementation-time checks may include TypeScript checks and browser-based visual verification when the UI is built.

## 19. Open Testing Decisions

- Internal test group confirmed in the deployment plan.
- No formal UAT period is required at this stage.
- HR testing representative confirmed as Thomas Mondaya.
- Confirm whether Power Automate test flows are separate from production flows.
