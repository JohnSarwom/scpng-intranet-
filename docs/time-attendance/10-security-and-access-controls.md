# Time and Attendance Module - Security and Access Controls

> Status: Drafted for review  
> Security boundary: Time and Attendance module only  
> Default enforcement: module-level UI/action gate plus SharePoint/Power Automate hardening  
> Global intranet access changes: none

## 1. Purpose

This document defines the security and access control design for the Time and Attendance module. The most important requirement is that office-network validation must apply only to attendance recording and must not change how users access the rest of the SCPNG Intranet.

The module must support secure attendance capture, role-based visibility, audit logging, and controlled corrections while preserving the current behavior of all other intranet modules.

## 2. Security Principles

- Keep existing intranet authentication unchanged.
- Restrict only attendance recording actions to office-network users.
- Do not apply tenant-wide or app-wide access rules that block unrelated intranet modules.
- Do not allow users to clock in or clock out for another employee.
- Keep SharePoint as the system of record.
- Record key attendance actions in audit logs.
- Treat client-side network checking as Phase 1 enforcement, not as a complete anti-tamper security boundary.
- Use SharePoint permissions and/or Power Automate write paths to reduce bypass risk.

## 3. Scope Boundary

### 3.1 Must Remain Unchanged

The following must continue to work as they do today:

- Existing Microsoft 365/MSAL login.
- Home/dashboard access.
- Apps, News, Strategy, Market Data, Documents, Forms, Approvals, AI Hub, Gallery, Contacts, Task Registry, Division, Assets, HR Profiles, Tickets, Licensing, Regulatory, Analytics, Settings, and admin areas.
- Existing protected routes outside Time and Attendance.
- Existing leave application and approval flows.

### 3.2 Attendance-Only Restrictions

The following actions require office-network validation:

- Clock in.
- Clock out.
- Future official attendance write actions.

The following can remain available outside the office if approved by HR/security:

- Viewing personal attendance history.
- Viewing reports by authorized supervisors/HR.
- Reviewing exceptions.
- Reading settings.

Recommended Phase 1 behavior: outside-office users may open the Attendance page, but clock-in and clock-out buttons are disabled.

## 4. Authentication

Authentication uses the existing Microsoft 365/MSAL setup.

Required identity values:

- User display name.
- User email or user principal name.
- Employee profile lookup.
- Division.
- Unit.
- Supervisor email where available.
- Role/permission information from existing role-based access patterns.

The module must not rely on user-entered employee identity for attendance recording. The authenticated account determines the employee.

## 5. Authorization Model

| Role | Allowed Access |
| --- | --- |
| Employee | Clock in/out for self only, view own attendance history, submit own exception reasons where required |
| Supervisor | View direct/team attendance, review assigned exceptions where required |
| HR Officer | View organization-wide attendance, review exceptions, run reports |
| HR Administrator | Manage settings, schedules, corrections, and HR-level configuration |
| System Administrator | Manage technical configuration, list setup, security troubleshooting, and audit support |

## 6. Office Network Enforcement

### 6.1 Phase 1 Enforcement

Use a module-level React wrapper or hook, tentatively named `OfficeNetworkOnly`.

Responsibilities:

- Run only inside the Time and Attendance module.
- Fetch the user's current public IP address.
- Compare it against the configured office public IP/range.
- Enable clock-in/clock-out only when the check passes.
- Disable clock-in/clock-out when the check fails.
- Show a clear message explaining that attendance recording requires the office network.
- Provide a `Recheck` action.
- Store network metadata with successful attendance records.

### 6.2 Public IP Requirement

Known internal office network:

- Internal LAN range: `192.168.7.1 - 192.168.7.255`.
- CIDR reference: `192.168.7.0/24`.
- Firewall gateway: `192.168.7.1`.

Still required:

- Office public internet/WAN egress IP address or public IP range.
  - Confirmed value: `124.240.199.154`.

Important: a browser public IP lookup service will see the firewall/WAN public IP, not the device's private `192.168.7.x` address.

### 6.3 Recommended Network Metadata

Store on attendance records/audit logs:

- `NetworkCheckRequired`.
- `NetworkCheckPassed`.
- `NetworkCheckProvider`.
- `DetectedPublicIP`.
- `ExpectedOfficeIP`.
- `InternalNetworkRange`.
- `DeviceUserAgent`.
- `TimeZone`.
- `ActionDateTime`.

## 7. Conditional Access Position

Microsoft Entra Conditional Access should not be used as the default enforcement method for this requirement.

Reason:

- Conditional Access commonly applies to the app registration/cloud app level.
- Applying it broadly could block staff from the entire intranet when outside the office.
- The business requirement is to restrict only Time and Attendance recording.

Conditional Access may be reconsidered only if a later architecture can safely scope enforcement to attendance-specific access without affecting unrelated intranet modules.

## 8. SharePoint Permissions

Recommended permission model:

| List | Employee | Supervisor | HR | Admin |
| --- | --- | --- | --- | --- |
| `HR_AttendanceRecords` | Read own records through app; create/update only through approved path | Read team records through app | Read all, correct records | Full control |
| `HR_AttendanceExceptions` | Create own reasons, read own records | Review team exceptions | Review all exceptions | Full control |
| `HR_AttendanceAuditLog` | No direct access, or read own audit only if exposed in app | Read team audit if required | Read all | Full control |
| `HR_AttendanceSettings` | No direct access | Read if needed | Manage policy settings | Full control |
| `HR_AttendanceSchedules` | No direct access | Read if needed | Manage schedules | Full control |

If SharePoint item-level permissions become too complex, enforce visibility in the app for Phase 1 and move writes to a controlled Power Automate path in a hardening phase.

## 9. Bypass Risk and Hardening

### 9.1 Phase 1 Risk

A React-only network check can be bypassed by a technical user because it runs in the browser.

Phase 1 still provides useful control for normal use:

- Users outside the office see clock actions disabled.
- The attendance UI does not allow out-of-office clock-in/out.
- Network metadata is recorded.
- Audit logs support review.

### 9.2 Hardening Path

To reduce bypass risk:

- Do not give employees broad direct edit rights to attendance lists.
- Ensure users cannot manually create another employee's attendance record.
- Add server/workflow-side validation before writing official attendance records where possible.
- Use Power Automate as a controlled write layer if required.
- Consider a SharePoint request-list pattern if premium HTTP-triggered flows are unavailable.

Recommended future hardening pattern:

1. React app creates an attendance action request.
2. Power Automate validates request metadata.
3. Power Automate creates/updates the official attendance record.
4. Power Automate writes an audit log.
5. Request item is marked processed or rejected.

Phase 1 confirmed path:

- The React app writes attendance records directly to SharePoint using Microsoft Graph.
- The module uses the `attendance` permission key for nav/route access.
- Power Automate-controlled writes remain the future hardening path if stronger enforcement is required.

## 10. Audit Controls

Audit logging is required for:

- Clock-in.
- Clock-out.
- Failed or blocked network attempt where technically available.
- Late status assignment.
- Overtime status assignment.
- Missing clock-in marking.
- Missing clock-out marking.
- Exception creation.
- Exception review.
- HR correction.
- Settings changes.
- Notification sent.
- Power Automate scheduled job runs.

Recommended audit fields:

- Audit ID.
- Attendance ID.
- Exception ID.
- Action type.
- Action date/time.
- Actor name.
- Actor email.
- Actor role.
- Employee affected.
- Source: `Intranet`, `PowerAutomate`, `SharePoint`, `HRCorrection`, `System`.
- Old value.
- New value.
- Network check result.
- Detected public IP.
- Details.

## 11. Data Protection

Attendance records contain employment and behavior data. Treat them as sensitive internal HR records.

Controls:

- Limit employee visibility to own records.
- Limit supervisor visibility to assigned staff/team.
- Limit HR/global reporting to HR roles.
- Avoid exposing detailed audit data to normal employees.
- Avoid sending sensitive correction notes in email summaries.
- Use audit logs for corrections and settings changes.
- Retain records according to HR/legal policy.

Recommended retention pending confirmation:

- Attendance records: 7 years.
- Audit logs: 7 years.
- Exceptions and corrections: same period as related attendance record.

## 12. Settings Protection

Sensitive settings:

- `attendance.office.public.ip`.
- `attendance.network.required`.
- `attendance.remote.allowed`.
- `workday.start.time`.
- `workday.end.time`.
- `clockout.required`.
- `overtime.enabled`.

Required controls:

- Only HR administrators/system administrators can change settings.
- Sensitive changes require confirmation in the UI.
- Settings changes create `HR_AttendanceAuditLog` entries.
- Last updated by/date must be visible in the settings UI.

## 13. Network Check Failure Behavior

| Scenario | Behavior |
| --- | --- |
| Outside office public IP | Disable clock-in/out, show office-network-required message |
| Public IP lookup fails | Disable clock-in/out, show retry/recheck option |
| Office public IP not configured | Disable clock-in/out, show admin-facing configuration warning |
| User is on VPN | Treat as not allowed unless the public IP matches approved office egress and policy explicitly allows it |
| User is in office but blocked | ICT verifies public WAN IP, firewall routing, and IP lookup result |

## 14. Operational Responsibilities

| Area | Owner |
| --- | --- |
| Public office IP confirmation | ICT |
| HR attendance policy | HR |
| Attendance settings management | HR Administrator/System Administrator |
| SharePoint list permissions | System Administrator/ICT |
| Power Automate monitoring | ICT/System Administrator |
| Attendance corrections | HR |
| Audit review | HR/System Administrator |

## 15. Security Testing Checklist

Before production rollout:

- Confirm the public office IP/range.
- Verify user in office can clock in.
- Verify user outside office cannot clock in.
- Verify user outside office can still access other intranet modules.
- Verify clock-in/out cannot be submitted for another employee.
- Verify duplicate clock-in is blocked.
- Verify duplicate clock-out is blocked.
- Verify employee can only see own records.
- Verify supervisor can only see team records.
- Verify HR can see all records.
- Verify settings are admin/HR restricted.
- Verify audit log entries are created for clock-in, clock-out, correction, and settings change.
- Verify missing clock-in/out flows do not duplicate records.

## 16. Open Security Decisions

- Confirm whether SharePoint direct employee access should be restricted immediately or in a hardening phase.
- Internal test group confirmed in the deployment plan.
- Production go-live date will be set later after internal testing.
