# Time and Attendance Module - Business Requirements

## 1. Background

SCPNG requires a Time and Attendance module that allows staff to record daily attendance through the existing intranet. The module must support secure clock-in and clock-out events, enforce office-network access, provide visibility for supervisors and HR, and preserve reliable records for reporting and compliance.

The module must follow the existing system direction:

- UI is built in the SCPNG Intranet.
- Attendance data is stored in SharePoint.
- Workflow and scheduled processing use Power Automate.
- Authentication uses Microsoft 365/MSAL.
- Integration should reuse existing HR, leave, approval, and notification patterns.

## 2. Business Objectives

The module should:

- Provide a simple and secure way for staff to record attendance.
- Ensure attendance can only be recorded when staff are physically present in the office environment.
- Reduce manual attendance registers and spreadsheet-based reconciliation.
- Give supervisors timely visibility of late arrivals, absences, and missing clock-outs.
- Record late arrivals automatically without requiring approval.
- Allow staff to submit reasons for missed attendance or correction cases where required.
- Give supervisors and HR a structured review process for attendance exceptions other than ordinary late arrivals.
- Support accurate attendance reporting for HR and management.
- Maintain audit logs for compliance, accountability, and dispute resolution.

## 3. Business Scope

### In Scope

- Employee clock-in and clock-out.
- Office network eligibility check.
- Daily attendance status tracking.
- Late arrival detection.
- Overtime detection after official clock-out time.
- Absence detection.
- Missed clock-in and missed clock-out handling.
- Reason submission by staff for missed attendance or correction cases.
- Supervisor/HR review of missed attendance, missed clock-out, and correction exceptions.
- HR visibility and override capability.
- Automated email notifications and escalations.
- SharePoint-backed attendance data.
- Attendance reports and dashboards.
- Audit logging for key user and system actions.

### Out of Scope for Initial Release

- Biometric device integration.
- Payroll system integration.
- Physical access control integration.
- GPS-based mobile attendance.
- Offline attendance capture.
- Complex shift rostering.
- Facial recognition or identity verification beyond Microsoft 365 login.

These can be considered future enhancements after the core module is stable.

## 4. Stakeholders

| Stakeholder | Interest |
| --- | --- |
| Employees | Record attendance, view own attendance history, submit reasons |
| Supervisors | Monitor team attendance, review exceptions where required, receive alerts |
| HR Unit | Configure policy, review records, manage reports, handle disputes |
| ICT Unit | Configure access controls, maintain SharePoint and Power Automate components |
| Executive Management | View summary reporting and compliance trends |
| System Administrators | Manage permissions, settings, and audit access |

## 5. User Roles

| Role | Description |
| --- | --- |
| Employee | Can clock in/out and view own records |
| Supervisor | Can review team attendance and approve/reject exceptions where policy requires |
| HR Officer | Can view organization-wide attendance and manage exception records |
| HR Administrator | Can configure schedules, rules, thresholds, and reporting settings |
| System Administrator | Can manage technical configuration and access controls |

## 6. Business Rules

Confirmed business rules:

- Staff must be authenticated before using the module.
- Staff must be on the approved office network before clock-in or clock-out is accepted.
- Staff may clock in once per workday unless HR corrects the record.
- Staff may clock out once per workday unless HR corrects the record.
- The official workday starts at 8:30 AM and ends at 4:00 PM.
- There is no grace period for late arrival.
- Any clock-in after 8:30 AM is marked late.
- Late arrivals are recorded by the system and do not require approval.
- Staff are required to clock out every workday.
- Any recorded time after 4:00 PM is treated as overtime.
- Lunch and break times are not tracked in the initial release.
- If no clock-in is recorded by a configured time, the staff member is flagged absent or missing attendance.
- Missed attendance, missed clock-out, and correction requests may require supervisor or HR review based on final policy.
- Supervisors cannot approve their own attendance exceptions.
- HR can review, override, or correct records with audit logging.
- All key actions must be logged.
- Remote attendance is not allowed.
- VPN or other remote connections must not count as office presence.
- The known internal office LAN range is 192.168.7.1 to 192.168.7.255. The firewall gateway is 192.168.7.1.
- The confirmed office public/WAN IP for attendance network validation is 124.240.199.154.
- Missed clock-in and missed clock-out records require the employee to submit a reason, supervisor review, and HR visibility.
- Employees may view their attendance history outside the office; only clock-in and clock-out are restricted to the office network.
- Attendance records and audit logs will be retained for 7 years.
- Power Automate flows will run under admin@scpng.gov.pg.
- Phase 1 will use direct SharePoint writes from the React app through the existing Microsoft Graph service pattern.
- The module will use a new `attendance` permission key rather than the existing `hr` key.

## 7. Success Criteria

The module is successful when:

- Employees can clock in and clock out from the intranet while on the approved office network.
- Employees outside the approved network cannot record attendance.
- Attendance records are stored reliably in SharePoint.
- Supervisors receive timely late and absence notifications.
- Late arrivals are recorded without requiring manual approval.
- Employees can submit reasons for missed attendance or correction cases where required.
- Supervisors or HR can approve or reject exception requests where policy requires.
- Overtime after 4:00 PM is captured for reporting.
- HR can generate daily, weekly, monthly, and employee-level attendance reports.
- The system keeps a clear audit trail for every attendance action.
- The module follows the existing SCPNG Intranet architecture and design patterns.

## 8. Assumptions

- Staff have Microsoft 365 accounts and can access the intranet.
- Employee profiles in SharePoint remain the source for staff identity, division, unit, and supervisor data.
- The internal office LAN range is 192.168.7.0/24.
- The office public internet egress IP is 124.240.199.154.
- Power Automate is available for scheduled jobs and email workflows.
- SharePoint Lists are acceptable as the system of record for phase one.
- Attendance reports can be built from SharePoint list data using intranet dashboards and/or Power BI.

## 9. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Office public IP changes | Valid office users may be blocked or remote users may be incorrectly allowed | ICT must notify HR/system admin before or immediately after IP changes |
| Private LAN range is confused with public IP | Network validation may be configured incorrectly | Use 124.240.199.154 for public IP checks and keep 192.168.7.0/24 as internal reference |
| VPN policy is unclear | Staff may record attendance remotely through VPN | VPN attendance is currently not allowed; enforce this in network policy |
| SharePoint location policies affect Power Automate | Flows may fail when accessing restricted SharePoint data | Test policy in audit/pilot mode before production |
| Manual corrections become common | Reduced trust in data | Use exception workflows and audit logs |
| Employees forget to clock out | Incomplete attendance records | Add reminders and missed clock-out workflow |

## 10. Open Questions

- What reports are required by HR and management?
- Should production rollout later be all staff at once or by division/unit?
- What additional HR or management reports are required after internal testing?
