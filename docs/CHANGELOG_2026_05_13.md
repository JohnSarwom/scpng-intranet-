# Changelog — May 13, 2026

## Release: MSAL Deep-Link Authentication Fix & Email-Based Leave Approvals

### What Changed

**Problem:** Email approval links redirected users to login and never returned them to the approval page. Additionally, approval chain notifications were silently failing.

**Solution:** Implemented Microsoft's official `CustomNavigationClient` pattern (prevents full page reloads during auth) + lightweight email action page (`/leave-action`) + fixed email persistence in SharePoint + decoupled approver notifications from employee email.

---

## Files Modified

| File | Change | Lines |
|---|---|---|
| `src/integrations/microsoft/CustomNavigationClient.ts` | **NEW** — Hooks MSAL navigation to React Router | 27 |
| `src/integrations/microsoft/msalConfig.ts` | Set `navigateToLoginRequestUrl: true` | 1 |
| `src/integrations/microsoft/MsalProvider.tsx` | Register CustomNavigationClient before auth | +10 |
| `src/pages/LeaveActionPage.tsx` | **NEW** — Lightweight approval confirmation UI | 207 |
| `src/App.tsx` | Move BrowserRouter up; add `/leave-action` route | +4, -15 |
| `src/services/hrEmailService.ts` | Two Approve/Decline buttons instead of one | +15 |
| `src/services/hrSharePointService.ts` | Store EmployeeEmail; split approval notifications | +10 |
| `src/hooks/useLeaveApprovals.ts` | Always pass emailCtx for chain notifications | +10 |

**Total:** 8 files, ~290 lines changed/added

---

## Breaking Changes

None. All changes are backward compatible.

- Old requests without EmployeeEmail still work (chain continues via approver notification)
- Dashboard approval still works (routes through same code)
- Email buttons gracefully degrade (fallback message included)

---

## Key Features

✅ **Deep-link preservation** — Email links return user to correct approval page after login  
✅ **No page reloads** — CustomNavigationClient keeps React/MSAL context alive  
✅ **Email action page** — Lightweight `/leave-action` page (no dashboard confusion)  
✅ **Chain notifications** — Next approver **always** gets notified (dashboard or email)  
✅ **Decline with reason** — Action page requires reason for declinations  

---

## Testing Priority

1. **CRITICAL:** Email button → login → lands on approval page (not stuck at login)
2. **HIGH:** Approval from email button → Director gets next-stage email
3. **HIGH:** Approval from dashboard → Director gets next-stage email
4. **MEDIUM:** Decline path works with reason requirement
5. **MEDIUM:** Already-approved request shows "not found" gracefully

---

## Deployment Checklist

- [ ] Code reviewed
- [ ] TypeScript compiles: `npx tsc --noEmit` ✓
- [ ] Manual testing on staging
- [ ] Email HTML renders correctly
- [ ] Button URLs point to correct environment
- [ ] SharePoint list has EmployeeEmail column
- [ ] Workflow approvers configured (all divisions/units)
- [ ] Production URLs registered in Azure App Registration (if needed)
- [ ] Staff notified about new email button feature

---

## Rollback Plan

Git revert (all 8 files). No schema changes. No data loss.

---

## Related Docs

- **Full details:** `docs/features/MSAL_DEEPLINK_FIX_AND_EMAIL_APPROVAL.md`
- **Testing guide:** Same document, "Testing Checklist" section
- **Limitations:** Same document, "Known Limitations" section
- **Future work:** Outlook Actionable Messages (separate roadmap)

---

## Questions?

Reference the full documentation linked above, or check:
- `src/pages/LeaveActionPage.tsx` — approval page implementation
- `src/integrations/microsoft/CustomNavigationClient.ts` — MSAL integration
- `src/services/hrEmailService.ts` — email template (two buttons)
