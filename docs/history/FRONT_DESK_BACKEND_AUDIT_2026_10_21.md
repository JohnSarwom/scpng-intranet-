# Front Desk back-end audit: notifications, automation and assignment

**Date:** 2026-10-21
**Scope:** everything the Front Desk module needs behind the screen: emails, in-app notices, reminders, scheduled jobs, assignment and routing, sender identity and data upkeep.
**Builds on:**
- `docs/history/FRONT_DESK_TICKETING_AUDIT_2026_10_21.md` (the UI audit)
- `docs/features/front-desk-execution-plan.md` (the phased plan; Phase 6 is notifications)

**Method:**
- Read the code on `main` plus the Phase 2 branch.
- Ran read-only checks against the live tenant on 2026-10-21:
  - the Power Automate flow list
  - the `System_Notifications` list contents and indexes
  - SharePoint versioning, permissions and site time zone on the new `FrontDesk_` lists

Findings are numbered **BE1–BE12**. The decisions they need are numbered **D10–D15**, continuing the plan's D1–D9.

---

## 1. Summary

**What the plan already covers.** Phase 6 sends a notice from the receptionist's browser at the moment something happens:
- visitor arrived (to the host)
- mail waiting (to the recipient)
- ticket or inquiry assigned (to the assignee)

That is the right tool for those three events: the receptionist is on the page when they happen, and the app already sends task and leave emails this way.

**What nothing covers yet:**
1. **Anyone outside the front desk who is assigned work cannot act on it (BE1).** The accepted access rules (D5, D9) keep everyone else out of `/tickets` and the lists. So an IT Support inquiry assigned to IT staff produces an email with a link they cannot open, and an item they cannot update.
2. **Nothing runs on a timer (BE2).** A web page cannot send anything when nobody has it open. So these do not exist:
   - mail-collection reminders
   - overdue or SLA alerts
   - an end-of-day "still on site" check
   - no-show marking
   - data clean-up

   The task module has the same gap: the "overdue tasks" flow described in `docs/history/NOTIFICATION_POWER_AUTOMATE_SETUP.md` was never built.
3. **Browser-sent notices can be lost without trace (BE3).** They come from whoever is signed in, from their personal mailbox (BE4). The notification bell will not scale to front-desk volume (BE5).
4. **There are no routing rules and only a thin assignment lifecycle (BE6, BE7).**

**Recommended shape.** Two layers, with no new server and no premium licence:

| Layer | Runs | Does |
|---|---|---|
| Browser (exists) | when a receptionist saves | in-app notice, email, then writes a "notified" marker on the record |
| Power Automate, standard connectors, under a service account | on a schedule | reminders, SLA and overdue alerts, end-of-day sweep, daily digest, retention, and a backstop for notices the browser failed to send |

The tenant already runs flows that use exactly these connectors: SharePoint, Office 365 Outlook, Office 365 Users, Approvals and Recurrence (section 3).

---

## 2. What exists today

| Mechanism | Where | Used by | Notes |
|---|---|---|---|
| In-app notices | `System_Notifications` list. `addNotification` in `sharePointOpsService.ts:3193`. Bell: `useNotifications.ts` (polls every 30 s) and `NotificationPanel.tsx`. | Tasks only (assignment and comments, `notifyAssignment` :3276, `notifyComment` :3348) | **Live:** 38 items (Mar–Sep 2026), 7 recipients, 28 unread, all category `task`. **No indexed columns.** Readable by every site member. |
| Email | Graph `/me/sendMail`, sent from the signed-in user's own mailbox | Tasks (`sharePointOpsService.ts:3229`), leave (`hrEmailService.ts:476`, with approve/decline links to `/leave-action`), meeting minutes share (`meetingShareService.ts:147`), workflow admin test mail (`useWorkflowAdmin.ts:26`) | Task and leave mail use `saveToSentItems: false`, so there is no record of what was sent. Failures are logged to the console only. |
| Email templates | `utils/scpngEmailBuilder.ts` (`buildSCPNGEmailHTML`, MJML) | HR | Reusable for front-desk mail. |
| Calendar | `calendarService.ts:307` creates events in `/me/calendar`, with an optional Teams meeting | Dashboard "Add event" | `Calendars.ReadWrite` is already granted. |
| Routing configuration | `HR_WorkflowApprovers` list and Workflow Admin UI (`hrSharePointService.ts:2192`) | Leave approvals | A working pattern for "who handles what". |
| Optimistic concurrency | eTag + `If-Match` in `sharePointOpsService.ts:387–417` | Strategy/work-plan writes | Not used by `frontDeskGraph.ts` (BE8). |
| Scheduled jobs | Power Automate (section 3). Google Apps Script `gas/Code.gs` (AI queue, time trigger). | Reports, staff sync, news, market data | Vercel serves the static app only (`vercel.json` has rewrites, no `api/`). None of the Supabase edge functions send email, and Supabase is being removed. |
| Granted Graph scopes | `config/microsoft-auth.ts`, `graphService.ts:32` | — | `Mail.Send`, `Calendars.ReadWrite`, `Sites.ReadWrite.All`, `User.Read.All` and others. **No** `Mail.Send.Shared` (needed to send as a shared mailbox) and **no** Teams chat or channel scopes. |
| Audit history | SharePoint versioning | All lists | **Live:** on for the new `FrontDesk_` lists (50 versions) and the photo library (500). Every change is already kept. |
| Site time zone | SharePoint regional settings | — | **Live:** (UTC+10:00) Guam, Port Moresby. Flows must use "West Pacific Standard Time". |

---

## 3. Power Automate inventory (live, 2026-10-21)

These are the 20 flows visible to the signed-in account:

| State | Flows |
|---|---|
| **Started, on a schedule** | SCPNG Staff Lists – Five Day Sync · News Article Extraction · Market_Data_Flow · **SCPNG Intranet — Report Send** |
| **Started, email-triggered** | SCPNG Notice Board Group Email Import |
| **Started, manual/request-triggered** | Button -> Get rows · Test Automations Persmissions · Market_Data_Extraction_test · marketNewsWorkflow · newArticle |
| **Stopped** | SCPNG Newsletters (Processor, Maintenance, Setup, Setup Recovery) · Leave Request Deduction Logic · Staff Leave Ruquest · Add All Staff & Boardroom Emails to Notice Board |
| **Suspended** | **SCPNG Intranet — Report Dispatch** · Announcements · "Recurrence -> Get items, Apply to each, Delete item" |

**What this shows:**
- **None of the notification flows in `NOTIFICATION_POWER_AUTOMATE_SETUP.md` exist.** That guide describes task assigned, KRA status change, daily overdue tasks, project status and weekly clean-up. In-app task notices come from the browser instead, so overdue alerts and notification clean-up have never run.
- **Report Dispatch is Suspended, but Report Send still runs on its schedule.** Send has nothing to send. Fix Dispatch (see the report-scheduler memory notes) or stop Send.
- **Test flows are still switched on:** "Test Automations Persmissions", "Button -> Get rows" and "Market_Data_Extraction_test". Turn them off or delete them.
- **The connectors in working flows are all standard:**
  - SharePoint: get, create and update items, and item created/modified triggers
  - Office 365 Outlook: send email, and the new-email trigger
  - Office 365 Users
  - Approvals
  - Recurrence

  Every Front Desk job in section 5 can be built from these.
- **Ownership:** these flows are visible to one account. Confirm who owns them and add a co-owner. The report-scheduler docs mention a service account, `automation@scpng.gov.pg`, which is the right home for Front Desk flows (D12).

---

## 4. Findings

| ID | Severity | Finding |
|---|---|---|
| BE1 | **High** | Assignees outside the front desk cannot open or update what they are assigned |
| BE2 | **High** | No scheduled automation: no reminders, SLA/overdue alerts, end-of-day sweep, no-show marking or clean-up |
| BE3 | Medium | Browser-sent notices can be lost silently, with no record or retry |
| BE4 | Medium | Mail comes from whoever is signed in, from their personal mailbox |
| BE5 | Medium | The notification bell scans the whole list every 30 s per user; front-desk volume will hit the 5,000-item limit |
| BE6 | Medium | No routing rules: every inquiry needs a manual assignee |
| BE7 | Medium | Thin assignment lifecycle: no acknowledgement, no assignment trail, and the requester is not told when the item is resolved |
| BE8 | Low–Medium | No concurrency check on Front Desk updates (last write wins) |
| BE9 | Low | Appointments do not reach the host's Outlook calendar |
| BE10 | Low | Email links point at whatever origin sent them (a dev session sends `localhost:8080` links) |
| BE11 | Low | No Teams notices (no scopes; would need Power Automate) |
| BE12 | Low | Flows will lose access once P2.4 restricts the lists, unless the flow account is included |

### BE1 — Assignees outside the front desk cannot act (High)

**Why it happens:**
- D5: "Everyone else: no access to `/tickets`". The route is guarded by `tickets:read` (`App.tsx:284`).
- D9: restrict the `FrontDesk_` lists in SharePoint.
- Plan P6.4 emails the assignee a link, and inquiry categories include IT Support, Facilities, HR and Supplies, which are handled by other units.

**Result:** the assignee receives a link that bounces, and cannot mark the item In Progress or Resolved. Reception becomes a go-between for every update.

**Options:**
- **A. Split D9 by sensitivity (recommended).**
  - Restrict the lists that hold visitor personal data: `FrontDesk_Visitors`, `FrontDesk_Appointments` (external attendee names), `FrontDesk_VisitorPhotos` and `FrontDesk_MailPackages`.
  - Leave `FrontDesk_Inquiries`, `FrontDesk_Tickets`, `FrontDesk_TicketComments` and `FrontDesk_TicketGroups` editable by site members. They hold internal work items only. Guidance: no visitor phone numbers or emails in inquiry text.
  - Add an **Assigned to me** view that any signed-in staff member can open. It shows only items where `AssigneeEmail` is them, with **Acknowledge**, **Add note** and **Resolve**. The app allows these three actions to the assignee even without the `tickets` permission.
- **B. Keep every list locked.** Assignees respond by email: a Power Automate Approvals flow ("Done" / "Need help") runs under the service account and updates the item. Lists stay closed, but this is slower, harder to test, and leaves the assignee no in-app view.

**This must be decided (D10) before P2.4 is carried out**, because P2.4 is the step that locks the lists.

### BE2 — Nothing runs on a timer (High)

The browser can only act while someone has the page open. These jobs need a scheduler. Proposed defaults (D13) are in brackets:

| Job | When (PNG time) | What it does | Reads (indexed) |
|---|---|---|---|
| End-of-day sweep | 17:30 working days | Emails reception and the supervisor a list of visitors still **On Site**. Marks today's **Expected** visitors with no Time In as **No Show**. | Visitors `VisitDate`, `Status` |
| Mail reminders | 09:00 working days | Uncollected items older than [2] working days: reminds the recipient. Older than [5]: tells the supervisor. Signature-required items are flagged. | MailPackages `ReceivedAt` (+ `Status`, see below) |
| Inquiry and ticket SLA | Hourly, 08:00–17:00 | Unassigned for more than [1 h]: alerts reception. Open past SLA ([High 4 h / Medium 1 working day / Low 3 working days]): reminds the assignee and copies the supervisor. Tickets due tomorrow or overdue: reminds the assignee. | Inquiries `ReportedAt`, `Status`; Tickets `Status`, `DueDate` |
| Daily digest | 07:45 working days | Sends the supervisor yesterday's visitor count, open inquiries by age, and uncollected mail. | as above |
| Retention | Monthly | Deletes photos after [30 days]. Removes or anonymises visitor records after [24 months] (D14). | Visitors `VisitDate`; photo library |
| Notification clean-up | Weekly | Deletes read `System_Notifications` items older than [90 days]. | `System_Notifications` `IsRead`, Created |
| Backstop | Every 15 min | Sends notices the browser failed to send (BE3). | "notified" markers |

**Build notes:**
- Use standard connectors only, with a Recurrence trigger in "West Pacific Standard Time".
- Filter only on indexed columns, or Get items fails once a list passes 5,000 items. Create/repair should add indexes on: MailPackages `Status`, Inquiries `Status`, Tickets `Status` and `DueDate`, and `System_Notifications` `RecipientEmail`.

### BE3 — Lost notices (Medium)

Today's senders fire emails with `Promise.allSettled` and only log failures (`sharePointOpsService.ts:3344`, `hrEmailService.ts:493`). If any of these happen, the notice is gone and nobody knows:
- the tab closes
- the token expires
- the mailbox has no licence
- Graph throttles the request

`saveToSentItems: false` also removes the only trace. Only MailPackages has a `NotifiedAt` column.

**Fix:**
- Add marker columns:
  - Visitors: `HostNotifiedAt`
  - Inquiries and Tickets: `AssigneeNotifiedAt` and `NotifiedAssigneeEmail` (so a reassignment is detected)
- The browser writes the marker after a successful send.
- The backstop flow sends anything still unmarked after 10 minutes, then sets the marker.

### BE4 — Sender identity (Medium)

Front Desk mail would come from whichever receptionist is signed in. Replies such as "I'll collect it tomorrow" go to that person, who may be off shift, and nothing is kept in Sent Items.

**Options:**
- **Now, no new consent:** set `replyTo` on every Front Desk message to a reception shared mailbox. Graph's `message.replyTo` needs no extra scope.
- **Later:** send *as* the shared mailbox, via `/users/{reception}/sendMail`. This needs the `Mail.Send.Shared` scope (admin consent) and Send As rights in Exchange.
- **Scheduled and backstop mail** comes from the flow's service account anyway.

### BE5 — Notification bell will not scale (Medium)

**How the bell reads today** (`getNotifications`, `sharePointOpsService.ts:3108`):
- It reads the newest 50 items for *all* users.
- It filters them in the browser, then keeps paging until it has 50 of the current user's.
- For anyone with few notices, every poll walks the whole list. Every signed-in user polls every 30 s.
- `RecipientEmail` is not indexed, and nothing cleans the list.

**What Front Desk adds:** at an assumed 30 hosted visitors, 15 mail items and 10 assignments a working day, about 55 notices a day, or roughly 1,200 a month. The list would pass the 5,000-item view threshold in about four months, and each poll would scan thousands of rows.

**Fix (app-wide, small):**
- Index `RecipientEmail`.
- Query with `$filter=fields/RecipientEmail eq '<me>'`.
- Add the weekly clean-up flow.

**Privacy:** the list is readable by every site member, so a front-desk notice is visible to anyone who opens the list in SharePoint. P6.5 already keeps phone numbers and emails out of the text. Whether the visitor's name may appear is part of D10.

### BE6 — No routing rules (Medium)

Inquiry categories are Facilities, IT Support, Supplies, Parking, Food Service, HR and General. None has a default owner, so reception picks an assignee every time and unassigned items wait.

**Fix:**
- Add a `FrontDesk_RoutingRules` list with: Category, DefaultAssigneeEmail, BackupAssigneeEmail, SLA hours per priority, and EscalationEmail.
- Admin screen modelled on Workflow Admin (`HR_WorkflowApprovers`).
- New inquiries pre-fill the assignee, which stays editable.
- The SLA job (BE2) reads its hours from this list.
- IT Support could also link to the existing IT Request form (`components/forms/ITRequestPage.tsx`) where that is the proper channel.

### BE7 — Thin assignment lifecycle (Medium)

**Today:**
- Inquiries go Open → In Progress → Resolved.
- `ReportedBy` is free text with no email, so the person who raised the item is never told it was resolved.
- There is no record of who assigned whom, or when.
- Nothing shows that the assignee has seen the item.

**Fix:**
- Add `ReportedByEmail`, `AssignedAt`, `AssignedByEmail` and `AcknowledgedAt` to Inquiries and Tickets.
- Notify the reporter on **Resolved**, if they are staff.
- Write a short system comment on reassignment and status change. Tickets have `FrontDesk_TicketComments`; inquiries can use the same list keyed by inquiry.
- SharePoint version history (on, 50 versions) already keeps the raw history if it is ever needed.

### BE8 — Concurrent edits (Low–Medium)

`frontDeskGraph.updateFields` (`frontDeskGraph.ts:98`) patches with no eTag. Two receptionists signing out the same visitor, or editing the same ticket, overwrite each other silently.

**Fix:**
- Pass the item's eTag as `If-Match`, the same way as `sharePointOpsService.ts:404`.
- On `412`, reload the item and show "Someone else changed this; reloaded".

### BE9 — Appointments do not reach Outlook (Low)

P4.8 turns external attendees into Expected visitors, but the host gets no calendar entry and no reminder.

`calendarService` can already create events (`Calendars.ReadWrite` is granted):
- Create the event with the host as attendee, and keep its `EventId` on the appointment so edits and cancellations follow.
- **Trade-off:** the receptionist's calendar becomes the organiser.

Optional (D15).

### BE10 — Email links (Low)

Links are built from `window.location.origin` (`sharePointOpsService.ts:3314`, `hrSharePointService.ts:1151`). Mail sent from a dev session therefore points at `http://localhost:8080`.

**Fix:** add a configured base URL (`VITE_APP_BASE_URL`, defaulting to the production domain). Front Desk notices use it from the start.

### BE11 — Teams (Low)

The app has no Teams scopes. If Teams messages are wanted (for example "Visitor at reception" as a chat message), send them from the Power Automate flows using the standard Microsoft Teams connector, not from the browser.

### BE12 — Flows and locked lists (Low)

Once P2.4 restricts the lists, a flow's SharePoint connection can only see them if its account has access. Add the service account (D12) to the restricted lists' permissions as part of P2.4.

---

## 5. Recommended architecture

```
Receptionist saves ──► FrontDesk_ list item
        │
        ├─► in-app notice (System_Notifications, RecipientEmail indexed)
        ├─► email via /me/sendMail (replyTo = reception mailbox, links = VITE_APP_BASE_URL)
        └─► writes HostNotifiedAt / AssigneeNotifiedAt / NotifiedAt

Power Automate (service account, standard connectors, West Pacific Standard Time)
        ├─ FD-Backstop        every 15 min   unmarked notices older than 10 min
        ├─ FD-EndOfDay        17:30          on-site list; Expected → No Show
        ├─ FD-MailReminders   09:00          uncollected mail
        ├─ FD-SLA             hourly 08–17   unassigned / past SLA / due / overdue
        ├─ FD-DailyDigest     07:45          supervisor summary
        ├─ FD-Retention       monthly        photos, old visitor records
        └─ Notifications-Cleanup  weekly     read notices > 90 days

Assignees outside the front desk ──► "Assigned to me" view (Acknowledge / Note / Resolve)
                                     on the Inquiries/Tickets lists (D10 option A)
```

**Building the flows:**
- Build them in the Power Automate designer under the service account first, and keep exported definitions in `docs/flows/front-desk/` for the record.
- The repo's API-based flow deployment (`powerAutomateService.ts`) has been fragile: connection references, and the suspended Report Dispatch. Automate deployment only once the flows are stable.

---

## 6. Decisions

**Status (2026-10-21):** the product owner accepted every recommendation. They are recorded as D10–D15 in the execution plan's Phase 0.

| # | Question | Options | Recommendation | Agreed |
|---|---|---|---|---|
| D10 | How do assignees outside the front desk act, and what may notices contain? | A: split D9 by sensitivity + "Assigned to me" view · B: keep all lists locked, Approvals by email | **A.** Visitor names may appear in in-app notices; phone and email never. | Accepted |
| D11 | Who do front-desk emails come from? | Receptionist + reply-to shared mailbox · Send As shared mailbox (admin consent) | **Reply-to now**; Send As later if wanted | Accepted |
| D12 | Which account owns the flows? | A personal account · service account | **`automation@scpng.gov.pg`**, with a named co-owner | Accepted |
| D13 | Reminder timings and SLA hours | — | The bracketed defaults in BE2 (SLA: High 4 h, Medium 1 working day, Low 3 working days), adjustable in `FrontDesk_RoutingRules` | Accepted |
| D14 | Retention | — | Photos 30 days; visitor records 24 months, then anonymise. **Management to confirm.** | Accepted, pending management confirmation |
| D15 | Calendar invites for appointments | Yes · No | **Yes**, organised by reception | Accepted |

---

## 7. Changes to the plan

**Applied to `docs/features/front-desk-execution-plan.md` on 2026-10-21.** The task numbers below are the ones used there. The original proposal is kept here for the record.

| Plan task | Closes |
|---|---|
| P2.4 (rewritten), P2.8, P2.9 | BE1, BE8, BE12; the columns for BE2, BE3, BE6, BE7, BE9 |
| P4.10 | BE9 |
| P5.14, P5.15, P5.16 | BE6, BE7, BE1 |
| P6.1 (rewritten), P6.4–P6.8 | BE3, BE4, BE5, BE10, BE11, BE1 |
| Phase 6B: P6B.1–P6B.9 | BE2, BE3, BE5, BE12 |
| P8.7 (extended), P8.9 | §3 housekeeping |

The original proposal:

| Where | Add | Findings |
|---|---|---|
| **Before P2.4** | Take D10 and D12. Then restrict only the sensitive lists (if A), and include the service account. | BE1, BE12 |
| Phase 2 follow-up (small) | `If-Match` in `frontDeskGraph.updateFields`. New columns and indexes via Create/repair: Visitors `HostNotifiedAt`; Inquiries `ReportedByEmail`, `AssignedAt`, `AssignedByEmail`, `AcknowledgedAt`, `AssigneeNotifiedAt`, `NotifiedAssigneeEmail`; Tickets the same assignment columns; MailPackages `ReminderCount`, `LastRemindedAt`. Indexes on MailPackages `Status`, Inquiries `Status`, Tickets `Status` and `DueDate`. | BE3, BE7, BE8, BE2 |
| Phase 5 | Routing rules list and admin screen; acknowledgement, assignment trail and resolve notice; the "Assigned to me" view | BE6, BE7, BE1 |
| Phase 6 | `replyTo`, base URL and notified markers in `frontDeskNotifications.ts`. Bell fix: index plus server-side filter. Teams only via flows. | BE4, BE10, BE3, BE5, BE11 |
| **New Phase 6B — Scheduled automation** (about 4–6 days) | The seven flows in section 5. They are tested on the live site with clearly marked test records, and each flow's run history is checked before sign-off. | BE2, BE3, BE5, BE12 |
| Phase 4 (optional) | Outlook event for appointments | BE9 |
| Outside Front Desk | Stop Report Send or fix Dispatch. Switch off the test flows. Add a co-owner to all flows. | §3 |

**Order:** Phase 3 (Visitor Log) does not depend on any of this and is still the highest-value next step. D10 and D12 only need settling before anyone carries out P2.4. Phase 6B fits after Phase 6, once the lists hold real data.
