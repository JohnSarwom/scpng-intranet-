# Time and Attendance Module - Functional Requirements

## 1. Overview

This document defines the user-facing and workflow requirements for the Time and Attendance module. The module will be delivered inside the existing SCPNG Intranet UI and will use SharePoint Lists for storage and Power Automate for workflow automation.

## 2. Employee Functions

### 2.1 Clock In

The system must allow an authenticated employee to clock in for the current workday.

Requirements:

- Display current date and time.
- Display employee name, division, and unit from the authenticated profile.
- Verify the user is eligible to record attendance.
- Verify office-network eligibility before accepting the clock-in.
- Prevent duplicate clock-in for the same employee and date unless HR has reset or corrected the record.
- Save the clock-in timestamp to SharePoint.
- Record status as On Time when clock-in is at or before 8:30 AM.
- Record status as Late when clock-in is after 8:30 AM.
- Do not require approval for late arrivals.
- Show a success confirmation after clock-in.
- Write an audit log entry.

### 2.2 Clock Out

The system must allow an employee with an active clock-in record to clock out.

Requirements:

- Display current attendance status.
- Verify office-network eligibility before accepting the clock-out.
- Save the clock-out timestamp to SharePoint.
- Calculate total time recorded for the day.
- Detect early departure when clock-out occurs before 4:00 PM.
- Detect overtime when clock-out occurs after 4:00 PM.
- Prevent duplicate clock-out unless HR has reset or corrected the record.
- Show a success confirmation after clock-out.
- Write an audit log entry.

### 2.3 View My Attendance

Employees must be able to view their own attendance history.

Requirements:

- Show recent attendance records.
- Show status, clock-in, clock-out, total hours, and exception status.
- Allow filtering by date range.
- Show pending reason or approval status.
- Prevent employees from viewing other employees' attendance records.

### 2.4 Submit Missed Attendance or Correction Reason

Late arrivals are recorded automatically and do not require approval. Employees must be able to submit a reason when required for:

- Missed clock-in.
- Missed clock-out.
- Early departure.
- Attendance correction request.

Requirements:

- Provide reason category.
- Provide free-text explanation.
- Attach supporting document if required in a later phase.
- Submit request for supervisor or HR review where policy requires.
- Notify supervisor or HR where policy requires.
- Track approval status.
- Write audit log entries.

## 3. Supervisor Functions

### 3.1 Team Attendance Dashboard

Supervisors must be able to view attendance for employees under their responsibility.

Requirements:

- Show daily attendance list for direct reports.
- Highlight late, absent, incomplete, overtime, and exception records.
- Filter by date, division, unit, employee, and status.
- Open attendance detail for an employee.
- Export or print summary if required in reporting phase.

### 3.2 Exception Review

Supervisors must be able to approve or reject submitted reasons where policy requires. Ordinary late arrivals do not require approval.

Requirements:

- View employee reason and attendance details.
- Approve with optional comments.
- Reject with required comments.
- Prevent self-approval.
- Notify employee of decision.
- Escalate overdue approvals if configured.
- Write audit log entries.

## 4. HR Functions

### 4.1 Organization Attendance Dashboard

HR must be able to view organization-wide attendance.

Requirements:

- View attendance by date, employee, division, unit, and status.
- View late arrival trends.
- View overtime trends.
- View absenteeism trends.
- View unresolved exception requests.
- View employees missing clock-out.
- Access audit history for attendance records.

### 4.2 Attendance Corrections

HR must be able to correct records where business policy allows.

Requirements:

- Edit clock-in or clock-out values with required reason.
- Mark a record as manually corrected.
- Preserve original values in audit log.
- Notify employee and supervisor if required.
- Restrict correction capability to HR or administrators.

### 4.3 Policy Configuration

HR administrators must be able to configure attendance rules.

Requirements:

- Workday start time.
- Workday end time.
- Grace period.
- Overtime start time.
- Absence detection time.
- Missed clock-out reminder time.
- Escalation timeframes.
- Notification recipients.
- Whether late reason is mandatory.
- Whether clock-out is mandatory.

Initial confirmed settings:

- Workday start time: 8:30 AM.
- Workday end time: 4:00 PM.
- Grace period: 0 minutes.
- Clock-out: mandatory.
- Overtime threshold: after 4:00 PM.
- Lunch/break tracking: disabled.
- Late approval workflow: disabled.
- Remote/VPN attendance: disabled.
- Office public/WAN IP: 124.240.199.154.
- Missed clock-in review: employee reason, supervisor review, HR visibility.
- Missed clock-out review: employee reason, supervisor review, HR visibility.
- Employee history outside office: enabled.

## 5. System Functions

### 5.1 Network Eligibility

The system must prevent attendance recording outside the approved office network.

Requirements:

- Apply the network restriction only to the Time and Attendance module.
- Do not change access behavior for any other intranet module.
- Display an in-app blocked state if the user is not eligible to record attendance.
- Disable clock-in and clock-out when the user is not on the approved office network.
- Keep unrelated intranet pages accessible when the attendance network check fails.
- Store network validation status with each attendance event.
- Record failed attempts in the audit log where technically possible.
- Allow ICT/HR to review configuration status.
- Treat 192.168.7.0/24 as the known internal office LAN range.
- Use 124.240.199.154 as the confirmed office public/WAN IP for the module-level public IP check.

### 5.2 Scheduled Late Detection

Power Automate must detect late or missing attendance.

Requirements:

- Run on configured schedule during business days.
- Identify employees without clock-in after the configured threshold.
- Create absence or missing attendance records.
- Notify employee and supervisor.
- Avoid duplicate notifications.
- Log system action.

### 5.3 Missed Clock-Out Detection

Power Automate must detect employees who clocked in but did not clock out.

Requirements:

- Run after the configured end-of-day threshold.
- Mark records as Missing Clock-Out.
- Notify employee.
- Notify supervisor if unresolved after configured period.
- Allow reason/correction workflow.

### 5.4 Notifications

The system must send email notifications for:

- Successful clock-in if configured.
- Late arrival.
- Overtime recorded.
- Missing clock-in.
- Missing clock-out.
- Reason submitted.
- Approval required.
- Reason approved.
- Reason rejected.
- Escalation overdue.
- Daily or weekly HR summary.

## 6. Reporting Requirements

The system must support:

- Daily attendance register.
- Employee attendance history.
- Late arrivals report.
- Absence report.
- Missing clock-out report.
- Exception approvals report.
- Division/unit attendance summary.
- Monthly attendance summary.
- Audit and correction report.

## 7. Non-Functional Requirements

- The UI must match the existing SCPNG Intranet design patterns.
- The module must work on desktop and mobile browser layouts.
- SharePoint data access must respect user roles.
- Lists must be indexed where needed for performance.
- Audit logs must be append-only from the user perspective.
- Errors must be clear and actionable.
- Power Automate flows must avoid duplicate processing.
- The design must support future migration to Dataverse or payroll integration if required.
