# Front Desk Ticketing System — Audit (2026-10-21)

Scope: the receptionist module at `/tickets` ("Front Desk Ticketing System").
Method: static review of every file in the module, its route, permissions and data layer, against the working tree on branch `fix/division-scoped-figures` (including uncommitted edits). Not exercised in a live browser (the route needs an MSAL sign-in).

## 1. Verdict

The module is a **UI prototype, not a working system**. All nine tabs render, but:

- **Nothing is saved.** Every tab keeps its data in React `useState`, seeded with hard-coded sample records. A page refresh wipes everything, and two receptionists never see each other's entries.
- **There is no backend.** No SharePoint list, no service, no React Query hook exists for any front-desk record. The rest of the intranet stores data in SharePoint via Graph; this module was never connected.
- **Several core actions are broken even as a demo** — you cannot register a new visitor, newly created appointments are invisible, and you cannot log a new inquiry (details in section 4).
- **3 of 9 tabs are empty placeholders**, and the Ticket Inbox is a static mock-up with lorem-ipsum content.

Estimated completeness for real front-desk use: roughly 15–20% (layout and interaction design exist; data, identity, workflow, permissions and reporting do not).

## 2. Inventory

| File | Lines | Role |
|---|---|---|
| `src/pages/Tickets.tsx` | 153 | Page shell, 9 tabs |
| `src/components/ticketing/TicketManager.tsx` | 1,895 | Kanban/grid/list ticket board |
| `src/components/ticketing/TicketDialog.tsx` | 333 | Create/edit ticket modal |
| `src/components/ticketing/TicketCard.tsx` | 495 | Ticket card |
| `src/components/ticketing/TicketInbox.tsx` | 450 | Email-style inbox (static mock) |
| `src/components/ticketing/VisitorManagement.tsx` | 2,515 | Visitor register, board/grid/list |
| `src/components/ticketing/AppointmentView.tsx` | 1,011 | Day/week/month/list calendar |
| `src/components/ticketing/MailAndPackages.tsx` | 769 | Mail & parcel register |
| `src/components/ticketing/MailPackageDialog.tsx` | 301 | Mail/parcel modal |
| `src/components/ticketing/GeneralInquiries.tsx` | 625 | Inquiry list |
| `src/components/ticketing/InquiryCard.tsx` | 149 | Inquiry card |
| `src/components/ticketing/InquiryBoardLane.tsx` | 169 | **Orphaned** — never imported |
| `src/components/ticketing/InquiryGridView.tsx` | 48 | **Orphaned** — never imported |

Route: `src/App.tsx:293` — `/tickets`, guarded by `RoleProtectedRoute` with `tickets:read`.
Nav: `src/config/navItems.ts:75` — "Tickets".
Git history: 3 commits total (initial commit, a strategy update, the AI-assist sweep). The module has never had dedicated development.

## 3. Tab-by-tab scorecard

| Tab | Renders | Create | Edit | Delete | Saved | Real staff list | Status |
|---|---|---|---|---|---|---|---|
| Ticket Manager | Yes | Yes (session) | Partly — loses assignee, comments, year | Yes (session) | No | Card picker yes; dialog no | Prototype |
| Ticket Inbox | Yes | No | No | No | No | No | **Static mock** |
| Visitor Management | Yes | **Blocked** (bug B2) | Inline only | Yes (session) | No | Cards yes; modal no | Prototype, broken |
| Appointments | Yes | Appears to work, but record is **invisible** (B1) | Yes (session) | No | No | Yes | Prototype, broken |
| Mail & Packages | Yes | Yes (session) | Yes, but date edits lost (B5) | Yes (session) | No | No (free text) | Prototype |
| General Inquiries | Yes | **Stub** (console.log) | **Stub** | Yes, no confirm | No | No (fake names) | Prototype, broken |
| Employee Support | Placeholder text | — | — | — | — | — | Not started |
| Event Prep | Placeholder text | — | — | — | — | — | Not started |
| Feedback & Complaints | Placeholder text | — | — | — | — | — | Not started |

## 4. Bugs (ranked)

### Blocking — the feature cannot be used even in-session

**B1. Appointments: default tab shows nothing; new appointments never appear.**
`AppointmentView.tsx:315` filters `appt.status === activeAppointmentFilter`. The tabs are `all | upcoming | completed | canceled`, but statuses are `scheduled | completed | canceled`. So "All Appointments" (the default) and "Upcoming" always match zero records, and a newly created appointment (status `scheduled`, line 288) matches **no tab at all**.

**B2. Visitor Management: a new visitor cannot be saved.** *(Regression from the uncommitted working-tree edit.)*
Host is required (`VisitorManagement.tsx:957`), but the modal's Host dropdown is built from `uniqueHosts` (line 2309), which is derived from the hosts on existing visitors (lines 906–912). The uncommitted "remove mock staff names" edit blanked every sample visitor's `host`, so the dropdown is now empty and validation can never pass. The list-view host picker (line 1730) has the same problem. The card-level pickers were correctly switched to `useStaffMembers()`; the modal and list view were missed.

**B3. General Inquiries: no way to create or edit an inquiry.**
`handleCreateInquiry` and `handleEditInquiry` (`GeneralInquiries.tsx:206–214`) only `console.log`. The `InquiryDialog` they would open does not exist (commented out at line 621).

**B4. Appointments Day view is wrong in two ways.**
- Line 616–619 re-filters by `new Date()` instead of `currentDisplayDate`, so the previous/next arrows always show an empty day.
- Line 624 assigns appointments to hour rows with `startTime.startsWith(slot.split(':')[0])`. Slot "9:00 AM" becomes `"9"`, which never matches `"09:00"`; slot "1:00 PM" becomes `"1"`, which matches `10:00`, `11:00`, `13:00`… Appointments land in the wrong rows or nowhere. (`getAppointmentsForSlot`, line 387, is dead code with a different broken match.)

**B5. Ticket Inbox is entirely non-functional.**
Hard-coded lorem-ipsum tickets and conversations (`TicketInbox.tsx:34–96`), a fixed "To: Allison Westervelt" recipient, `capacity.com` addresses, and a fixed "Created 11/14/22" header. Clicking a ticket does not move the highlight (it reads a static `selected` flag). Every button (Send, Add to KB, attachments, priority, assignee, tags, linked tickets, history) is a no-op.

**B13. Ticket Manager List view breaks when the number of rows changes.** *(Found 2026-10-21 by the Phase 1 lint baseline.)*
`ListView` calls `useMemo` inside `allTickets.map(...)` (`TicketManager.tsx:599`). React requires the same number of hook calls on every render. Typing in search, adding a ticket or deleting one while in List view changes the row count, so React throws a hooks-order error and the tab fails to render. ESLint reports this as `react-hooks/rules-of-hooks`.

**B14. Ticket Manager: the New / Edit Ticket form cannot be typed into.** *(Found 2026-10-21 during Phase 1 and confirmed in the browser: typing "Test title" left the field empty.)*
`TicketDialog` gives `statuses` a default array literal (`TicketDialog.tsx:75–79`), so the prop is a new array on every render. The form-reset effect lists `statuses` as a dependency (line 122), so it runs after every render and puts every field back to its initial value. Keystrokes are wiped, and no ticket can be created or renamed.

### Data-loss and correctness

**B6. Mail & Packages: edited "Received" date is discarded.**
The date picker writes to `formData.receivedDate` (`MailPackageDialog.tsx:105`), but submit overwrites it with a separate `receivedDate` state that is only set when the dialog opens (line 121).

**B7. Mail & Packages: filter checkboxes stick after Reset.**
`handleFilterChange` mutates the filter array in place (`MailAndPackages.tsx:174`), which mutates the module-level `initialFilters` constant. "Reset Filters" then restores the mutated object, so boxes stay ticked while `activeFilters` is empty — the UI says a filter is on but nothing is filtered. (The same bug in TicketManager was fixed by the uncommitted edit; this copy was not.)

**B8. Ticket Manager: editing a ticket wipes its assignee and comments.**
`handleTicketSubmit` rebuilds the card from dialog fields only (`TicketManager.tsx:989–999`), dropping `assignee` and `commentsCount`. The dialog's Assignee select is hard-coded "User One / User Two" and not bound to state (`TicketDialog.tsx:249–257`). Comments typed in the dialog are kept in local state and thrown away on save. The comment author is hard-coded "Current User / CU" (line 144).

**B9. Ticket Manager: dates lose their year.**
Dates are stored as `"MMM d"` strings (line 994–995) and parsed back with `new Date("Jul 25")` (line 872), which V8 resolves to **2001**. The edit dialog therefore opens in July 2001, and the date filter (line 940) compares 2001 dates against "today / last week / last month", so those presets never match.

**B10. Ticket Manager: status and groups conflict.**
The card status menu only offers `todo / inprogress / done`, and choosing one moves the ticket into the column with that id (lines 1410–1420). A ticket in a custom group gets pulled out into a built-in column; if that column was deleted, the ticket moves into a key that is never rendered and disappears. Deleting a group silently deletes its tickets. Reordering within a column is unimplemented (`console.log("TODO…")`, line 1212), and cross-column drops ignore the drop indicator and always append.

**B11. Visitor check-in overwrites the scheduled time.**
Changing status to checked-in replaces `time` with the current time (`VisitorManagement.tsx:1043–1045`). There are no separate checked-in / checked-out timestamps, and "duration" is a free-text field, not computed. Without timestamps there is no reliable visitor log.

**B12. Visitor QR check-in is fake.**
The QR image is `/api/placeholder/200/200` (does not exist), the URL shown is `https://yourcompany.com/visitor-checkin`, and Download/Print do nothing (lines 2358–2377). No self-check-in page exists.

### Minor

- **M1.** Visitors "Today" tab only matches `visitStartDate`, so multi-day visits disappear after day one; sample visitors have no dates, so the tab is always empty (line 1147–1151).
- **M2.** Visitor pagination is not reset when filters change, so you can land on an empty page.
- **M3.** Visitor photos are stored as base64 data URLs in state (line 979); sample photo paths (`/images/visitors/…`) do not exist in `public/`.
- **M4.** Appointments: Attendees input is not bound to state (line 948–955); "Date Range*" is labelled required but not enforced; no end-after-start check; no delete; header always shows month/year even in Day view; Print/Export buttons do nothing (lines 537–542).
- **M5.** Mail dialog has no Sender field even though the list shows "From"; no "picked up by" capture; recipient is free text, not linked to the staff directory; validation uses `alert()`.
- **M6.** General Inquiries: delete has no confirmation (line 216); date-range filter cannot work because `reportedAt` is a time-only string like `"10:15 AM"` (line 139); assignees are a hard-coded list of fictional names (lines 75–82) — missed by the mock-data sweep; `handleToggleComplete` is unused.
- **M7.** Ticket Manager: an unused `UserNav` component with fake account menu (lines 92–121); ~20 unused imports across the module.
- **M9.** *(Found during Phase 1 browser checks.)* The Appointments filter tabs (All / Upcoming / Completed / Canceled) collapse to zero width when the content area is about 950px wide (e.g. a laptop with the sidebar open). They cannot be seen or clicked; at 1440px they appear. Cause: the `overflow-x-auto` tab container inside the `md:flex-row md:justify-between` header row in `AppointmentView.tsx` can shrink to nothing.
- **M10.** *(Found during Phase 1 browser checks.)* The Ticket Manager search box is squeezed to about 46px by the crowded toolbar. Clicks land on its search icon, so it is very hard to type into. Cause: the `flex-1` wrapper in the `TicketManager.tsx` toolbar.
- **M11.** *(Found during Phase 1 browser checks.)* The Mail received-date calendar opens on the current month, not the month of the item's date. `MailPackageDialog.tsx` does not set `defaultMonth` on its `Calendar`.
- **M8.** Sample data is non-PNG and stale: US carriers (USPS/FedEx/UPS), "Bank of America", "State Tax Department", 2023 dates, Acme-style company names.

## 5. Cross-cutting gaps

**G1. Persistence / backend.** No storage at all. Note that `src/integrations/supabase/types.ts:603–710` declares `tickets` and `ticket_messages` tables, but nothing in `src/` queries them and there is no migration for them in `supabase/migrations/`. The app's live data store is SharePoint, so these types are leftovers.

**G2. Documentation describes a system that does not exist.** `docs/architecture/database/tickets.md` documents eight Supabase tables, RLS policies, triggers and a migration history dated 2023. `docs/pages/tickets/README.md` lists Ticket Inbox reply threads, attachments, tags and related items as features. None of this is implemented. These docs should be corrected or archived before anyone relies on them.

**G3. Identity and audit trail.** No record captures who created or changed it, or when. The module never reads the signed-in user (no `useMsal` / auth hook anywhere in `components/ticketing`).

**G4. Permissions.** The route checks only `tickets:read` (`App.tsx:294`). `PermissionMatrix.tsx:76` defines a single "Access" action, so anyone who can open the page can create, edit and delete everything. `RoleManagement.tsx:53` labels the same resource "IT Tickets", which conflicts with the page's front-desk purpose. A `Receptionist` role exists in `useUIRoles.ts:58` but nothing maps to or uses it.

**G5. Notifications.** Nobody is told anything: hosts are not notified when their visitor arrives, staff are not notified when mail or a parcel is waiting, assignees are not notified of tickets or inquiries. The codebase already has Graph `sendMail` helpers (`hrEmailService.ts`, `meetingShareService.ts`, `sharePointOpsService.ts`) that could be reused.

**G6. No links between tabs.** An appointment does not create an expected visitor; an inquiry cannot be escalated to a ticket; mail recipients are not linked to staff records.

**G7. Reporting.** No daily visitor log, no "who is in the building now" list (needed for evacuation roll-call), no mail register export. Every Print/Export button is inert.

**G8. Overlap with the Task board.** The Ticket Manager re-implements a kanban that already exists, persisted, in the Unit Task board (`Operations_Tasks` + `Operations_TaskGroups`, with groups, assignees, comments and attachments). Reusing that model may be cheaper than building a second board.

**G9. Unbuilt tabs are advertised.** Employee Support, Event Prep and Feedback & Complaints render only "X Content" placeholders (`Tickets.tsx:84–100`), and the Ticket Inbox (B5) looks real but does nothing.

## 6. What does work today (session-only)

- Ticket Manager: create, drag between columns, mark complete, inline priority/assignee changes, add/rename/delete groups, search and filters (except date presets).
- Visitor Management: status changes via card menu, drag between status columns, inline host/assignee/time edits, search and filters, grid/list/board views.
- Mail & Packages: add, edit (except date), delete with confirmation, status changes, tabs, search.
- General Inquiries: inline status/category/assignee changes, status tabs, search, category/priority/assignee filters.
- Appointments: create/edit modal, week and month views (once B1 is fixed).

## 7. Recommended path to completion

**Phase 0 — scope decision.** Confirm with the receptionists which tabs they actually need. Hide or remove the three placeholder tabs and the Ticket Inbox mock until they are built, so the page does not advertise features that do nothing.

**Phase 1 — fix the blocking bugs (small, can ship now).** B1, B2, B3, B4, B6, B7, and swap the remaining hard-coded staff lists (General Inquiries, TicketDialog) for `useStaffMembers()`.

**Phase 2 — persistence on SharePoint**, following the existing `sharePointOpsService` + React Query hook pattern. Suggested lists:

| List | Key columns |
|---|---|
| `FrontDesk_Visitors` | FirstName, LastName, Company, Email, Phone, Purpose, HostEmail, Status, ExpectedStart, ExpectedEnd, CheckedInAt, CheckedOutAt, BadgeNo, PhotoUrl, Notes, AppointmentLookup |
| `FrontDesk_Appointments` | Title, HostEmail, Location, Start, End, Attendees (JSON), Status, Notes |
| `FrontDesk_MailPackages` | Type, Description, Sender, Carrier, Tracking, RecipientEmail, RecipientUnit, ReceivedAt, Status, CollectedAt, CollectedBy, Notes |
| `FrontDesk_Inquiries` | Title, Description, Category, Priority, Status, AssigneeEmail, ReportedBy, ReportedAt, ResolvedAt |
| Tickets | Reuse `Operations_Tasks` / `Operations_TaskGroups`, or a `FrontDesk_Tickets` list plus comments |

Visitor photos go to a document library via the existing `useSharePointUpload` hook. Every record stores created-by / modified-by (SharePoint provides these).

**Phase 3 — workflow.** Real check-in / check-out timestamps; email the host on arrival and the recipient when mail arrives (reuse Graph `sendMail`); appointments generate expected-visitor entries; inquiries can be escalated to tickets.

**Phase 4 — permissions.** Add create / update / delete actions to the `tickets` resource in `PermissionMatrix`, rename the "IT Tickets" label, and grant the receptionist role the right set.

**Phase 5 — reporting.** Daily visitor log, live "on site now" list for evacuations, mail register, CSV/print exports. Then build the placeholder tabs if Phase 0 confirmed they are wanted.

**Phase 6 — clean-up.** Delete the orphaned `InquiryBoardLane.tsx` / `InquiryGridView.tsx` (or wire them in as a board view), dead code and unused imports; correct `docs/architecture/database/tickets.md` and `docs/pages/tickets/README.md`; drop the unused Supabase ticket types if SharePoint is confirmed as the store.

## 8. Addendum — paper Visitors Log Sheet comparison

The receptionists currently keep a paper "SCPNG Visitors Log Sheet" with six columns: **Date, Visitor's Name, Company, Reason for Visit, Time In, Time Out.** Compared with the Visitor Management tab:

| Paper column | Module | Finding |
|---|---|---|
| Date | Required visit date *range*, no single visit date | **L1** |
| Visitor's Name | First + Last name, both required | covered (but see L4) |
| Company | Optional field | covered |
| Reason for Visit | "Purpose of Visit", required | covered |
| Time In | Single `time` field, overwritten on check-in (B11) | **L2** |
| Time Out | Not recorded; "Duration" is free text (B11) | **L3** |

- **L1.** No single visit date; the form demands a start–end range.
- **L2.** Time In is not reliably captured: the scheduled time is overwritten at check-in.
- **L3.** Time Out is never captured.
- **L4.** The form is heavier than the paper: it requires email, phone, host, a date range and a time. Walk-ins often cannot or will not supply these, and the paper asks for none of them. Entries with just a first name and an initial are common on the sheet, but Last Name is required.
- **L5.** No log-sheet view: the list view shows Visitor, Status, Time, Host, Company, Duration — no Reason, no Time Out — and the day's log cannot be printed or exported.
- **L6.** Receptionists tick "same as above" for repeated dates and companies (e.g. two visitors arriving together from the same organisation). The module has no quick way to log a group or repeat the previous entry.

Conclusion: the module cannot replace the paper sheet today (no persistence, B2 blocks new visitors, L1–L6).
