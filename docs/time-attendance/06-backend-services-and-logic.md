# Time and Attendance Module - Backend Services and Logic

Status: Drafted for review.

This document will define the frontend service layer that connects the intranet UI to SharePoint through Microsoft Graph. The implementation should follow the existing service style used by HR and other SharePoint-backed modules.

Initial target service:

- `src/services/timeAttendanceSharePointService.ts`

## Phase 1 Write Path

Confirmed Phase 1 approach:

- The React app will write attendance records directly to SharePoint through the existing Microsoft Graph service pattern.
- The service will follow the same general style as existing SharePoint-backed modules.
- Power Automate will handle scheduled checks, summaries, notifications, and escalations.
- Power Automate-controlled official writes remain a future hardening option.

## Network Validation Boundary

The attendance service must treat office-network validation as part of attendance recording only. It must not alter authentication or routing for the rest of the intranet.

Recommended service responsibilities:

- Load the current employee profile from the existing HR profile source.
- Load today's attendance record for the authenticated employee.
- Create clock-in records only after the Time and Attendance UI has passed the office-network check.
- Update clock-out records only after the Time and Attendance UI has passed the office-network check.
- Store network validation metadata with the attendance action.
- Write audit entries for clock-in, clock-out, blocked attempts where available, corrections, and system updates.
- Prevent users from selecting another employee when recording attendance.

## Write Hardening Options

Phase 1 writes to SharePoint through the React app using the existing Microsoft Graph service pattern. For stronger enforcement, the preferred future hardening path is:

- Restrict ordinary employee permissions on attendance SharePoint lists.
- Let the React app call a Power Automate flow for clock-in and clock-out.
- Let the flow validate required metadata and create the SharePoint record.
- Keep HR/admin correction capability separate and fully audited.

This avoids changing the rest of the intranet while reducing the risk of users bypassing the React network gate and writing directly to the attendance list.

## Permission Key

Confirmed permission approach:

- Use a new `attendance` resource key for the Time and Attendance nav item and route visibility.
- Grant `attendance: read` broadly to staff who should use attendance self-service.
- Continue using role/profile logic for supervisor, HR, and admin tabs/actions.
- Do not reuse `hr`, because that would either hide attendance from normal staff or force broader HR access than needed.
