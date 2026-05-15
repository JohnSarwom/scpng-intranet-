# Developer Guide — Leave Approval System (Updated May 2026)

Quick reference for developers working with the leave approval workflow.

---

## File Map

```
src/integrations/microsoft/
├── CustomNavigationClient.ts      ← MSAL hook (prevents full reload on auth)
├── MsalProvider.tsx               ← Register client, handle redirect
└── msalConfig.ts                  ← navigateToLoginRequestUrl: true

src/pages/
├── LeaveActionPage.tsx            ← Email action page (/leave-action)
└── Login.tsx                       ← (unchanged, but benefits from fix)

src/services/
├── hrEmailService.ts              ← Email templates (two-button approval)
└── hrSharePointService.ts         ← Core logic (submit, approve, reject)

src/hooks/
└── useLeaveApprovals.ts           ← Mutations (useApproveLeave, useRejectLeave)

src/components/hr/
└── LeaveApprovalDashboard.tsx     ← Dashboard UI (unchanged pattern)

src/App.tsx                         ← Routes (BrowserRouter moved up)
```

---

## Key Hooks

### `useLeaveApprovals()` — Fetch pending requests
```typescript
const { data: requests = [], isLoading } = useLeaveApprovals();
// Returns LeaveRequest[] with employeeEmail, division, unit, etc.
```

### `useApproveLeave()` — Approve a request
```typescript
const approveMutation = useApproveLeave();

approveMutation.mutate({
  itemId: String(req.id),
  currentStage: req.stage,        // "Manager Review" | "Director Review" | "HR Review"
  approverName: user.name,         // From MSAL account
  approverEmail: user.email,       // From MSAL account
  employeeId: req.employeeId,
  leaveType: req.leaveType,        // "Annual" | "Sick" | "Unpaid" etc.
  daysRequested: req.daysRequested,
  employeeEmail: req.employeeEmail, // ← Critical: enables chain notifications
  employeeName: req.employeeName,
  startDate: req.startDate,
  endDate: req.endDate,
  division: req.division,          // ← Critical: looks up next approver
  unit: req.unit,                  // ← Critical: looks up next approver
});
```

### `useRejectLeave()` — Reject a request
```typescript
const rejectMutation = useRejectLeave();

rejectMutation.mutate({
  itemId: String(req.id),
  currentStage: req.stage,
  approverName,
  approverEmail,
  employeeId: req.employeeId,
  reason: "Budget constraints",    // ← Required
  leaveType: req.leaveType,
  daysRequested: req.daysRequested,
  employeeEmail: req.employeeEmail,
  employeeName: req.employeeName,
  startDate: req.startDate,
  endDate: req.endDate,
  division: req.division,
  unit: req.unit,
});
```

---

## Service Methods

### HRSharePointService.approveLeaveRequest()

```typescript
async approveLeaveRequest(
  itemId: string,
  currentStage: string,       // e.g., "Manager Review"
  approverName: string,
  approverEmail: string,
  employeeId: string,
  leaveType: string,
  daysRequested: number,
  comments?: string,
  emailCtx?: {
    employeeEmail: string;    // ← Employee status email sent here
    employeeName: string;
    startDate: string;        // ← Next approver lookup uses these
    endDate: string;
    division: string;
    unit: string;
  }
): Promise<void>
```

**What it does:**
1. Advances stage: Manager Review → Director Review → HR Review → Approved
2. **If `emailCtx?.employeeEmail`:** Sends status email to employee
3. **If `emailCtx` AND `nextStage !== 'Approved'`:** Looks up next approver, sends action email
4. If final approval (HR): Deducts leave balance

**Critical:** The `division` and `unit` are passed in `emailCtx` so the next-stage approver can be looked up via `getApproverForStage(division, unit, nextStage)`.

### HRSharePointService.rejectLeaveRequest()

```typescript
async rejectLeaveRequest(
  itemId: string,
  currentStage: string,
  approverName: string,
  approverEmail: string,
  employeeId: string,
  reason: string,             // ← Required, included in email
  leaveType: string,
  daysRequested: number,
  emailCtx?: { ... }          // ← Reverses pending balance, notifies employee
): Promise<void>
```

**What it does:**
1. Sets status to "Rejected"
2. Reverses the pending balance that was incremented on submission
3. Sends rejection email to employee (with reason)

---

## Email Flow

### Email Templates (hrEmailService.ts)

**sendLeaveEmail()** — Employee status updates
- Used for: Submission confirmation, Manager Approved, Director Approved, Fully Approved, Rejected
- Triggered by: `leaveRequest.submitLeaveRequest()` or `approveLeaveRequest()`/`rejectLeaveRequest()` if `emailCtx?.employeeEmail`

**sendApproverNotification()** — Action emails to next stage
- Used for: "Action Required" emails to Manager, Director, HR
- Triggered by: Submission or approval if `nextStage !== 'Approved'` and `emailCtx` exists
- Contains: [Approve] and [Decline] buttons linking to `/leave-action?requestId=X&action=...`

**Button URLs in Email:**
```
[✓ Approve] → {appUrl}/leave-action?requestId=42&action=approve
[✗ Decline] → {appUrl}/leave-action?requestId=42&action=decline

appUrl = window.location.origin (http://localhost:8080 or production URL)
```

---

## LeaveActionPage Component

**Route:** `/leave-action`  
**Protection:** `<ProtectedRoute>` (MSAL auth only, no role check)  
**URL Params:**
- `requestId` — ID of the leave request
- `action` — "approve" or "decline"

**States:**
```
"loading"          → Fetching request details
"confirm"          → Show details + action button
"processing"       → Mutation in progress
"done"             → Success! Show result
"error"            → Something went wrong
"already-actioned" → Request not in pending list (already processed)
```

**Workflow:**
1. Fetch request via `useLeaveApprovals().data`
2. Find request by `requestId`
3. If action="approve": Show "Confirm Approval" button
4. If action="decline": Show reason input + "Confirm Decline" button
5. On confirm: Call `useApproveLeave` or `useRejectLeave`
6. Show result or error

---

## Data Model

### LeaveRequest Interface (types/hr.ts)

```typescript
interface LeaveRequest {
  id: string | number;
  employeeId: string;
  employeeName?: string;
  leaveType: LeaveType;              // "Annual" | "Sick" | "Unpaid" | ...
  startDate: string;                 // ISO date: "2026-05-20"
  endDate: string;
  daysRequested: number;
  reason?: string;
  status: LeaveRequestStatus;        // "Pending" | "Approved" | "Rejected" | ...
  stage?: string;                    // "Submitted" | "Manager Review" | "Director Review" | "HR Review" | "Approved" | "Rejected"
  approverManager?: string;          // Name of manager who approved
  approverDirector?: string;
  approverHR?: string;
  approvedBy?: string;               // Final approver name
  approvedDate?: string;
  employeeEmail?: string;            // ← CRITICAL: Stored on submission (FIX)
  division?: string;                 // ← CRITICAL: Used for approver lookup
  unit?: string;                     // ← CRITICAL: Used for approver lookup
}
```

### Workflow Stage Progression

```
Submitted
    ↓ (employee submits)
Manager Review
    ├─ [Approve] → Director Review
    └─ [Reject] → Rejected (terminal)
    ↓
Director Review
    ├─ [Approve] → HR Review
    └─ [Reject] → Rejected (terminal)
    ↓
HR Review
    ├─ [Approve] → Approved (terminal, balance deducted)
    └─ [Reject] → Rejected (terminal)
```

---

## Common Pitfalls

### 1. Forgetting to Pass `division` and `unit`

❌ **Wrong:**
```typescript
await approveMutation.mutateAsync({
  itemId, currentStage, approverName, approverEmail, employeeId, ...
  // Missing: division, unit
});
```

✅ **Right:**
```typescript
await approveMutation.mutateAsync({
  itemId, currentStage, approverName, approverEmail, employeeId, ...,
  division: req.division,
  unit: req.unit,
});
```

**Why:** `division` and `unit` are used to look up the next-stage approver via `getApproverForStage()`. Without them, the chain breaks silently.

### 2. Assuming `employeeEmail` Always Exists

❌ **Wrong:**
```typescript
const emailCtx = {
  employeeEmail: req.employeeEmail,  // Could be "" if old request
  ...
};
if (emailCtx.employeeEmail) {
  // Entire chain gated here!
}
```

✅ **Right:**
```typescript
// Send employee status email only if we have their email
if (emailCtx?.employeeEmail) { /* ... */ }

// But next-approver notification is independent
if (nextStage !== 'Approved' && emailCtx) {
  // This runs even if employeeEmail is ""
}
```

### 3. Missing `appUrl` in Email Notifications

❌ **Wrong:**
```typescript
sendApproverNotification(client, {
  to: approverEmail,
  employeeName: req.employeeName,
  // Missing: appUrl
  requestId: itemId,
});
```

✅ **Right:**
```typescript
sendApproverNotification(client, {
  to: approverEmail,
  employeeName: req.employeeName,
  appUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
  requestId: itemId,
});
```

**Why:** `appUrl` is used to build the action button URLs in the email. Without it, buttons point to undefined/localhost.

---

## Testing Checklist

### Unit-Like Tests

```typescript
// Test that approval advances stage
const result = await service.approveLeaveRequest(
  itemId, "Manager Review", "John Doe", "john@example.com", ...
);
// Assert: SharePoint item now has Stage = "Director Review"

// Test that rejection reverses balance
const result = await service.rejectLeaveRequest(...);
// Assert: PendingBalance restored

// Test that emailCtx constructs with division/unit even if no email
const emailCtx = (division || unit) ? { division, unit, ... } : undefined;
// Assert: emailCtx is not undefined
```

### Integration Tests

```typescript
// Test the complete chain
1. submitLeaveRequest() → Manager gets email
2. approveLeaveRequest('Manager Review') → Employee gets "Approved", Director gets email
3. approveLeaveRequest('Director Review') → Employee gets "Approved", HR gets email
4. approveLeaveRequest('HR Review') → Employee gets "Fully Approved", balance deducted
```

### Manual Testing

```typescript
// From LeaveActionPage
1. Open /leave-action?requestId=123&action=approve (not logged in)
2. Confirm login → returns to same URL
3. Confirm approval
4. Check emails: employee + next approver

// From Dashboard
1. Open /hr-profiles?tab=leave-approvals
2. Click [Approve] on a request
3. Check emails: same as above
```

---

## Debugging Tips

### "Approval worked but next approver didn't get email"

**Check:**
1. Is `division` and `unit` passed to `approveLeaveRequest`?
2. Do they match exactly (case-sensitive) the workflow approver config?
3. Run: `service.getApproverForStage(division, unit, nextStage)`
   - If returns null, approver not configured

### "Employee didn't get status update email"

**Check:**
1. Does the `LeaveRequest` have `employeeEmail` populated?
2. Was it stored in SharePoint on submission? (Check SharePoint list directly)
3. Is `emailCtx?.employeeEmail` truthy when passed to `approveLeaveRequest`?

### "Email button returns to /login instead of approval page"

**Check:**
1. Is `navigateToLoginRequestUrl: true` in `msalConfig.ts`?
2. Does `MsalAuthProvider` register `CustomNavigationClient` BEFORE `handleRedirectPromise()`?
3. Is `BrowserRouter` wrapping `MsalAuthProvider` in `App.tsx`?
4. Check console: any MSAL navigation errors?

### "Email buttons in approval email don't work"

**Check:**
1. Are the button URLs correct? (Should be `/leave-action?requestId=X&action=approve`)
2. Does `appUrl` in email params resolve to correct domain?
3. Is the `/leave-action` route registered in `App.tsx`?
4. Is `LeaveActionPage` component imported?

---

## Performance Notes

- `useLeaveApprovals()` fetches **all pending** requests (up to 500)
  - Polls every 60 seconds
  - Good for dashboard, could be slow if 1000+ requests pending
- `approveLeaveRequest()` is non-blocking (async)
  - Emails sent after mutation returns
  - Balance deduction happens synchronously
- Email sending is non-blocking (try-catch, warn, continue)
  - Approval succeeds even if email fails

---

## References

- Full doc: `docs/features/MSAL_DEEPLINK_FIX_AND_EMAIL_APPROVAL.md`
- Workflow diagram: `docs/WORKFLOW_DIAGRAM.txt`
- Changelog: `docs/CHANGELOG_2026_05_13.md`

---

*Last updated: May 13, 2026*
