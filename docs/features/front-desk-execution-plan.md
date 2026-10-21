# Front Desk Ticketing System — Execution Plan

Prepared 2026-10-21. Source: [Front Desk Ticketing Audit](../history/FRONT_DESK_TICKETING_AUDIT_2026_10_21.md).

Every task in this plan closes one or more audit findings, cited in brackets:

- **B1–B12** — bugs
- **M1–M8** — minor issues
- **G1–G9** — cross-cutting gaps
- **L1–L6** — paper Visitors Log Sheet comparison (audit section 8)

Nothing is in scope that the audit did not raise. Appendix B maps every finding to the tasks that close it.

---

## 1. Summary

| Phase | Name | Closes | Est. dev-days | What you get at the end |
|---|---|---|---|---|
| 0 | Decisions & scope | G8, G9, L4, B5, B12 (decisions) | 0.5–1 | Signed-off decision log |
| 1 | Stabilise the prototype | B1, B2, B3, B4, B6, B7, B8 (partial), B5, B12, B13, B14, G9, M2, M5 (partial), M6 | 2–3 | Every visible control works; nothing fake is shown |
| 2 | Foundation | G1, G3, G4 | 3–4 | SharePoint lists, service layer, signed-in identity, permission checks |
| 3 | Visitor Log | L1–L6, B11, M1, M3, B2 (permanent) | 5–6 | Saved visitor log that replaces the paper sheet |
| 4 | Mail & Packages and Appointments | M4, M5, B1/B4 (on saved data), G6 (appointment → visitor) | 4–5 | Both tabs saved and shared between desks |
| 5 | Inquiries & Tickets | B3 (saved), B8, B9, B10, M6, G6 (inquiry → ticket), G8 | 5–7 | All tabs saved |
| 6 | Notifications | G5 | 2–3 | Hosts, mail recipients and assignees are notified |
| 7 | Reporting & exports | G7, L5, M4 | 3–4 | Printable daily log, on-site list, registers, exports |
| 8 | Clean-up & documentation | G1, G2, G4, M7, M8, G9 | 1–2 | Accurate docs, no dead code or fake data |
| | **Total** | | **26–35** | |

Estimates assume one developer who knows this codebase. They are ranges, not commitments.

### Milestones

- **After Phase 1 — honest demo.** Every tab and button shown on the page works within a session.
- **After Phase 3 — paper retired.** Reception logs every visitor in the module.
- **After Phase 5 — fully saved.** No tab loses data on refresh.
- **After Phase 7 — reporting live.** Daily log sheet, evacuation list and registers can be printed.

### Order and dependencies

```
P0 ─► P1 ─► P2 ─► P3 ─┬─► P4 ─┬─► P6 ─► P7 ─► P8
                      └─► P5 ─┘
```

- Phases 4 and 5 touch different files and lists, so they can run in parallel once Phase 3 is merged.
- Phase 6 needs the saved data from Phases 3–5.
- Phase 7 needs Phases 3 and 4.

### Changes from the audit's suggested order

1. **Permissions move into the Phase 2 foundation.** The audit put them in its Phase 4. Once records are saved, an unrestricted Delete button destroys real data (G4), so permission checks must exist before the first saved record.
2. **The audit's single persistence phase is split into three** (Visitors → Mail & Appointments → Inquiries & Tickets). This lets the paper log sheet be retired as early as possible.

---

## 2. Ground rules (apply to every phase)

### Conventions to follow (already used in this codebase)

| Concern | Rule | Reference |
|---|---|---|
| Data store | SharePoint lists on `scpng1.sharepoint.com:/sites/scpngintranet` via Microsoft Graph, **only**. Supabase is being removed from the whole application (decision of 2026-10-21, below). No front-desk code may import `@/lib/supabaseClient`, `@/config/supabase` or `src/integrations/supabase`. | `src/services/sharePointOpsService.ts:45–63` |
| Service shape | One small class per list, plus exported pure mapping functions. Follow page links (`@odata.nextLink`) and validate input in the mappers. Do **not** add to the 3,500-line `sharePointOpsService.ts`. | `src/services/pngxAnnouncementsSharePointService.ts` |
| Graph client | `getGraphClient(instance)` | `src/pages/PNGXAnnouncements.tsx:30–37` |
| Server state | React Query `useQuery` / `useMutation`. Query keys start with `['front-desk', …]`; invalidate them on every mutation. | same |
| Dates | Store ISO 8601 in SharePoint `dateTime` columns. Display in `Pacific/Port_Moresby`. Compute "today" with `getPNGDateKey()`. Never store `"MMM d"` strings (B9). | `src/utils/pngPublicHolidays.ts:52` |
| People | Store staff as email + display-name text columns (the same convention as `OwnerEmail` and `RecipientEmail`). Pick staff only from `useStaffMembers()`; no hard-coded names (B8, M6). | `src/hooks/useStaffMembers.ts` |
| Permissions | `useRoleBasedAuth().hasPermission('tickets', action)`. Define new actions as `extraActions` in Role Management. | `src/hooks/useRoleBasedAuth.ts:109`, `src/components/admin/RoleManagement.tsx:20–55` |
| Exports | `exceljs`, plus `jspdf` and `jspdf-autotable` | `src/services/attendanceReportExportService.ts` |
| Notifications | `addNotification` (in-app) and `sendEmailNotification` (Graph `/me/sendMail`) | `src/services/sharePointOpsService.ts:3193`, `:3229` |
| File upload | `useSharePointUpload().uploadFile(file, sitePath, library, folder)` | `src/hooks/useSharePointUpload.ts:58` |
| List setup | Idempotent "ensure" functions: check what exists and create only what is missing. Run them from TestGround. | `src/services/feedbackService.ts:109`, `src/pages/TestGround.tsx:1108` |
| Tests | New front-desk tests are Vitest `*.test.ts` files on logic, with a fake Graph client. No component-test library is installed, so keep logic in pure functions. The repo also has `node:test` suites (`*.test.cjs`, `*.test.mjs`) that only run under `node --test`. | `src/services/pngxAnnouncementsSharePointService.test.ts` |

### Definition of Done (every task)

1. **Tests:** no new failures compared with the baseline below, and any new pure logic has Vitest tests.
   - `npx vitest run --exclude ".claude/**"` fails only on the two baseline files.
   - `node --test src/tests/*.test.cjs scripts/staff-sync/*.test.mjs` stays at zero failures.
   - Plain `npm test` is not a usable signal yet (see the baseline).
2. **Lint and build:** the touched files have no more lint problems than at the baseline, and `npm run build` succeeds. P8.2 brings the ticketing folder to zero.
3. The change is checked in the dev server while signed in. From Phase 2 on, it is also checked with a non-admin account that holds only the front-desk role.
4. The knowledge graph is rebuilt, as CLAUDE.md requires:
   `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`
   On the Windows dev machine, `python3` is not installed; run the same command with `py` instead.
5. Each phase (or sub-phase) gets one branch and one PR into `main`, and is reviewed before merge.

### Backend decision (2026-10-21)

The product owner confirmed that **Supabase is being removed from the whole application, and SharePoint is the only back end**, as in the rest of the app. For this plan that means:

- Every front-desk record lives in the SharePoint lists in Appendix A. Nothing is written to Supabase, even temporarily.
- Staff data comes from the SharePoint staff roster (`useStaffRoster` / `staffRosterService`), never the Supabase `staff_members` table. This is why the staff-roster work must reach `main` before Phase 1 (option 1 below, chosen 2026-10-21).
- Roles and permissions already come from the SharePoint `UserRoles` list (`useRoleBasedAuth` → `UserSharePointService`), so P2.6 needs no Supabase work.
- The documentation that describes a Supabase ticket schema (G2) is removed rather than updated (P8.4).
- The ~40 other files that still reference Supabase belong to the app-wide removal, not to this plan.

### Baseline (2026-10-21)

Measured on the working tree of `fix/division-scoped-figures`, with its uncommitted changes, before any Phase 1 work.

| Check | Result |
|---|---|
| `npx vitest run --exclude ".claude/**"` | 21 test files pass. **2 genuine failures:** `src/tests/csv-helpers.test.ts` (2 assertions) and `src/tests/csv-sync.test.ts` (`localStorage is not defined`; it needs a browser-like environment). The other 19 "failed" files are `node:test` suites that Vitest cannot run. |
| `node --test src/tests/*.test.cjs scripts/staff-sync/*.test.mjs` | **167 / 167 pass.** |
| Plain `npm test` | Also runs stale copies of the suites inside `.claude/worktrees/focused-bose` and `.claude/worktrees/infallible-torvalds`, so its totals are inflated and mixed. |
| `npx eslint src/components/ticketing src/pages/Tickets.tsx` | **14 problems** (13 errors, 1 warning): AppointmentView 2, MailAndPackages 1, TicketManager 2 (one is B13), VisitorManagement 9. |
| `npm run build` | **Succeeds.** One warning: the main chunk is 9 MB. The build took 21 minutes while the test suite ran alongside it. |
| Browser | A dev server for this folder is already running at `http://127.0.0.1:8080`. The app's browser pane is **not signed in**: `/tickets` redirects to `/login`. Someone must click **Sign in with Microsoft** in the pane before UI checks. Claude cannot enter credentials. |

### Prerequisite before Phase 1

The working tree on `fix/division-scoped-figures` has uncommitted edits to four ticketing files:

- `AppointmentView.tsx`
- `TicketCard.tsx`
- `TicketManager.tsx`
- `VisitorManagement.tsx`

They replace hard-coded names with `useStaffMembers()`. These edits caused B2, and Phase 1 builds on them.

**Where they stand.** The edits are part of a much larger uncommitted change on that branch: roughly 85 modified and 50 new `src/` files, covering the staff roster, newsletters, memos, assets and slideshows.

- In the working tree, `useStaffMembers()` reads the new SharePoint-synced staff roster (`useStaffRoster.ts`, `staffRosterService.ts`, `staffDirectory.ts`). All three files are untracked.
- On `main`, `useStaffMembers()` has the **same interface** but reads the older Supabase `staff_members` table.
- So the four ticketing edits compile against `main` on their own. On `main`, though, the staff list comes from the older table.

**Ways to land them (the branch owner's choice):**

1. **Recommended — chosen 2026-10-21:** commit and merge the staff-roster work as its own PR, including these four files, then branch Phase 1 from `main`. History stays clean, and the staff list uses SharePoint roster data instead of Supabase.
2. Branch Phase 1 from `main` and carry only the four ticketing edits. Phase 1 can start at once, and the staff source switches automatically when the roster PR lands, since the hook interface is the same. The roster PR must then leave out these four files to avoid conflicts.
3. Branch from the current working tree. Not recommended: the Phase 1 PR would carry all the unrelated uncommitted work.

**Status (2026-10-21):** option 1 is done. [PR #10](https://github.com/JohnSarwom/scpng-intranet-/pull/10) was squash-merged into `main` as `89f33cd`, and Phase 1 branched from that commit as `fix/front-desk-stabilise`. The details below describe PR #10.

- **Contents:** `origin/main` plus 14 files — the roster reader and its helpers, the new `useStaffMembers`, two tests, and the four ticketing files.
- **Also includes P1.3 (the B2 fix).** Without it, merging would put the empty New Visitor host list onto `main`.
- **Checks:** no new test failures, type errors or lint problems against `main`, and the build succeeds.
- **Browser check (2026-10-21, signed in at `localhost:8080`):** the Visitor host pickers and the Asset Registry's "Assigned To" picker each list the same 30 roster staff, and no roster errors or warnings were logged.
- **Next:** Phase 1 branches from `main` once PR #10 is merged.

---

## Phase 0 — Decisions & scope

**Goal:** settle what the audit left open, so nothing is built twice.
**People:** product owner, the receptionists, IT.
**Code:** none.
**Effort:** 0.5–1 day.

**Decisions recorded 2026-10-21:** the product owner accepted every recommendation as written. D7 had no single recommendation, so it is recorded in the reading consistent with D4 (photo is an optional field) and D9 (restricted access).

| ID | Decision | Options | Recommendation | Finding | Agreed |
|---|---|---|---|---|---|
| D1 | Which tabs do receptionists need? | Keep or remove each of the 9 tabs | **Keep:** Visitors, Appointments, Mail & Packages, General Inquiries, Ticket Manager. **Remove** Employee Support, Event Prep and Feedback & Complaints until someone writes requirements for them. | G9 | **Accepted.** Keep 5 tabs; remove the 3 placeholder tabs. |
| D2 | Ticket Inbox | Remove; or rebuild later as a conversation view over ticket comments | Remove now. Revisit after Phase 5, when ticket comments exist. | B5 | **Accepted.** Remove the Ticket Inbox. |
| D3 | Where tickets are stored | (a) reuse `Operations_Tasks` / `Operations_TaskGroups`; (b) new `FrontDesk_Tickets` lists | **(b).** The Division page counts every unit's tasks from the shared task readers (commit `3ba5342`, `src/utils/divisionScope.ts`), so front-desk requests stored there would inflate reception's task figures. Reuse the task board's *patterns* (groups, comments), not its list. | G8 | **Accepted.** (b) New FrontDesk_Tickets lists. |
| D4 | Minimum fields for a walk-in visitor | — | **Required:** Name, Reason. **Optional:** Company, Host, Phone, Email, Badge No, Photo. This matches the paper sheet. | L4 | **Accepted.** Name and Reason required; all else optional. |
| D5 | Who gets which permission | — | **Receptionist:** create, update. **Front-desk supervisor:** also delete, manage ticket groups, export. **Everyone else:** no access to `/tickets`. | G4 | **Accepted.** As recommended. |
| D6 | Notification channel | In-app, email, or both | Both, sent from the receptionist's mailbox (`/me/sendMail`), the same way the rest of the app sends email. | G5 | **Accepted.** In-app and email. |
| D7 | Visitor photos | Keep (in a restricted library) or drop | Decide on privacy grounds. If kept, use a dedicated document library with restricted access. | M3 | **Accepted.** Keep photos as an optional field (consistent with D4), stored in a restricted FrontDesk_VisitorPhotos library (D9). |
| D8 | QR self check-in | Remove; or build a public kiosk page | Remove the button in Phase 1. A self-service page needs anonymous write access to SharePoint, which is a separate security design. | B12 | **Accepted.** Remove the QR button and modal. |
| D9 | SharePoint list access | Leave site-level access; or restrict the front-desk lists | Restrict. Hiding buttons in the app does not stop anyone with site access from opening the lists in SharePoint and reading visitor phone numbers and photos. | G4 | **Accepted.** Restrict the FrontDesk_ lists and photo library. |

**Exit gate:** decision table agreed, and the audit has been walked through with the receptionists.

**Status (2026-10-21):** decision table agreed. The walk-through with the receptionists has **not** happened yet. Phase 1 can start without it, because Phase 1 only fixes bugs and hides unfinished features. Hold the walk-through before Phase 3 starts, since Phase 3 builds the screen they will use every day.

**What the decisions settle elsewhere in this plan:**

| Decision | Settles |
|---|---|
| D1 | P1.7 removes Employee Support, Event Prep and Feedback & Complaints. P5.3 does not wire in `InquiryBoardLane` / `InquiryGridView`; P8.1 deletes them. |
| D2 | P1.7 removes the Ticket Inbox tab. P5.13 is not done. |
| D3 | Phase 5B uses the `FrontDesk_Tickets`, `FrontDesk_TicketGroups` and `FrontDesk_TicketComments` lists (Appendix A). |
| D4 | P3.3 and P3.6 require only Name and Reason. |
| D5 | P2.6 creates the Front Desk role with create + update for receptionists, and delete + manage + export for the supervisor. |
| D6 | P6.1 sends both in-app and email notices. |
| D7 | P2.3 creates `FrontDesk_VisitorPhotos`; P3.7 follows the "If kept" path. |
| D8 | P1.7 removes the Check-In QR button and modal. No kiosk page is built. |
| D9 | P2.4 restricts the lists and library in SharePoint. |

---

## Phase 1 — Stabilise the prototype

**Goal:** every control on the page works within a session, and nothing broken or fake is shown. Data is still in memory.
**Why first:** it gives an honest demo, and it gets the logic right before that logic is moved onto SharePoint. Put each fix in a pure helper function so Phases 3–5 can reuse it.
**Branch:** `fix/front-desk-stabilise`
**Effort:** 2–3 days.

### P1.1 Appointments tab filter [B1]
- `AppointmentView.tsx:315`: replace `appt.status === activeAppointmentFilter` with a helper `filterAppointmentsByTab(appointments, tab, now)`:
  - `all` → every appointment
  - `upcoming` → status `scheduled` and starting on or after the start of today (PNG time)
  - `completed` / `canceled` → status matches
- Put the helper in `src/components/ticketing/appointmentFilters.ts`, with tests.
- **Accept:**
  - The default "All" tab lists the sample appointments.
  - A newly created appointment appears under All and Upcoming.
  - A past scheduled appointment does not appear under Upcoming.

### P1.2 Appointments Day view [B4, M4 header]
- Lines 616–619: remove the second filter on `new Date()`. `filteredAppointments` is already limited to `currentDisplayDate`.
- Line 624: bucket by hour.
  - Add a pure helper `slotHourForTime('13:30') → 13`.
  - Generate slots as 24-hour integers 8–17.
  - Appointments before 08:00 or after 17:00 go into "Before 8 AM" / "After 5 PM" rows. They must not disappear.
- Delete the dead `getAppointmentsForSlot` (line 387).
- Header (line 527): show the full date in Day view and the date range in Week view, not just the month.
- **Tests:** `09:00 → 9`, `13:30 → 13`, `07:30 → before`, `18:00 → after`.
- **Accept:**
  - The next/previous arrows show that day's appointments.
  - A 1 PM appointment appears only in the 1:00 PM row.

### P1.3 New Visitor host list [B2]
- `VisitorManagement.tsx:2309` (modal) and `:1730` (list view): build the options from `allStaffMembers` (from `useStaffMembers()`), not `uniqueHosts`.
- Keep `uniqueHosts` only for the host *filter* (line 2065), where it is correct.
- **Accept:** once the staff roster loads, the Host dropdown lists all staff and a visitor can be saved.
- **Status:** done in PR #10 (lines 1730 and 2309). Checked in the browser on 2026-10-21 at `localhost:8080`, signed in:
  - New Visitor → Host lists 30 roster staff (unique, alphabetical, no made-up names) and keeps the selection.
  - The list-view host picker shows the same 30.
  - Nothing was saved during the check.

### P1.4 General Inquiries create / edit / delete [B3, M6]
- New `src/components/ticketing/InquiryDialog.tsx`, laid out like `MailPackageDialog.tsx`, with these fields:
  - Title* (required)
  - Description
  - Category (from `potentialCategories`)
  - Priority
  - Status
  - Assignee (`useStaffMembers()`)
  - Reported by (text)
  - Reported at (date and time, default now)
- Wire up `handleCreateInquiry` and `handleEditInquiry` (`GeneralInquiries.tsx:206–214`), and render the dialog where line 621 is commented out.
- Store `reportedAt` as ISO and format it for display. This makes the date-range filter (line 131) work [M6].
- Add a delete confirmation using the same `AlertDialog` pattern as `MailAndPackages.tsx:746–764` [M6].
- Replace `potentialAssignees` (lines 75–82) with `useStaffMembers()`. The assignee shape becomes `{ name, email, initials }` [M6].
- Show validation errors inline, not with `alert()`.
- **Accept:**
  - An inquiry can be logged, edited, and deleted after confirming.
  - The date filter narrows the new records.

### P1.5 Mail dialog [B6, M5]
- `MailPackageDialog.tsx`: remove the separate `receivedDate` state (line 61) and submit `formData.receivedDate ?? new Date()` (line 121).
- Add a **Sender** field bound to `from`; the list already shows "From:" [M5].
- Replace `alert()` (line 113) with inline field errors [M5].
- **Accept:** changing the received date on an existing item shows the new date in the list.

### P1.6 Filter reset [B7]
- `MailAndPackages.tsx:168–187`: update filters immutably (map to new objects), as `TicketManager.tsx` now does.
- Turn `initialFilters` into a factory `createInitialFilters()` in both files, so Reset always gets fresh objects.
- **Accept:** tick Type = Mail, press Reset → the box is unticked and the list is unfiltered.

### P1.7 Hide what does not work [G9, B5, B12]
- `Tickets.tsx`:
  - Remove the tabs D1 drops.
  - Remove Ticket Inbox per D2.
  - Remove `PlaceholderContent` and the unused `TicketCategory` members.
- `VisitorManagement.tsx`: remove the Check-In QR button (2085–2088) and its modal (2358–2377), per D8.
- `AppointmentView.tsx:537–542`: hide Print / Export until Phase 7.
- `TicketDialog.tsx:259–269`: hide the inert Add File / Add Link buttons.
- **Accept:** there is no tab or button on the page that does nothing.

### P1.8 Visitor pagination [M2]
- Reset `currentPage` to 1 whenever the tab, search text or any filter changes.

### P1.9 Ticket edit keeps its data [B8, in-session part]
- `TicketDialog.tsx:249–257`: bind Assignee to the staff list and pass it in `ticketData`.
- `TicketManager.tsx:989–999`: on edit, merge onto the existing card, so `assignee`, `commentsCount` and comments survive.
- Saving comments to SharePoint and the real author name come in P2.5 and P5.9.

### P1.10 List view hook in a loop [B13]
- `TicketManager.tsx:599`: `useMemo` is called inside `allTickets.map(...)` in `ListView`. Move the overdue check into a plain function (or a small `ListRow` component that owns the hook).
- **Accept:**
  - In List view, typing in search, adding a ticket and deleting a ticket all work without a React error.
  - The `react-hooks/rules-of-hooks` lint error is gone.

### P1.11 Ticket form resets on every keystroke [B14]
- `TicketDialog.tsx`: move the default `statuses` to a module-level constant, so the reset effect only runs when the dialog opens or its inputs really change.
- **Accept:** a title typed into New Ticket stays; the ticket can be created and edited.

### P1.12 Layout fixes found during the browser check [M9, M10, M11]
- `AppointmentView.tsx`: stop the filter-tab container shrinking to zero width (`min-w-0` / `shrink-0`, or wrap the tabs onto their own row), so the tabs show at about 950px.
- `TicketManager.tsx`: give the search box a usable minimum width (e.g. `min-w-[12rem]`), or let the toolbar wrap.
- `MailPackageDialog.tsx`: open the calendar on the item's month (`defaultMonth={formData.receivedDate}`).
- **Accept:** at the browser pane's normal width (~950px), the Appointments tabs are visible and clickable, and the ticket search box can be clicked and typed into.
- **Status:** done. Checked in the browser at 956px:
  - The four Appointments tabs show on their own row, and a real click on Upcoming switches the tab.
  - The ticket search box is 209px wide; a click on its icon focuses it, and typing filters the board.
  - The Mail date picker opens on April 2023 with the 15th selected.

### Phase 1 status (2026-10-21)
All tasks P1.1–P1.11 are implemented on `fix/front-desk-stabilise`. P1.3 shipped earlier in PR #10.

- **New helpers, with tests:** `appointmentFilters.ts` and `inquiryOptions.ts` (10 tests).
- **Lint:** 11 problems in the ticketing folder, down from 14.
- **Types:** the same 235 errors as `main`, so none added.
- **Tests:** Vitest fails only on the two baseline CSV files, and `node --test` passes 164/164.
- **Browser check (2026-10-21, Phase 1 branch served on `localhost:8080`, signed in):** P1.1–P1.11 all pass. Test records lived only in page memory.
  - **Tabs:** 5 tabs; the Ticket Inbox and placeholder tabs are gone.
  - **Tickets:** typing a New Ticket title stays. The Assignee field lists "Unassigned" plus 30 staff. An edit keeps the assignee and adds a comment (the card shows "1" and "AA"). List view search goes from 5 rows to 1 and back with no hook error. Ticket and Mail filters untick on Reset.
  - **Visitors:** the QR button is gone, a New Visitor with a staff host saves, and a search from page 2 lands on page 1.
  - **Appointments:** the Day view header shows the date, 9:00 and 11:00 are in their own rows, the arrows reach 24 Oct with the 1 PM appointment in the 1:00 PM row, and Print/Export are gone. Tab counts are All 10, Upcoming 4, Completed 4, Canceled 2, and a new appointment appears under All (11) and Upcoming.
  - **Mail:** inline errors replace the pop-up, Sender is shown, and an edited date saves with its time kept.
  - **Inquiries:** an inquiry can be logged, edited (status changed in place) and deleted after confirmation; the assignee list is the roster, and the date filter works.
- **P1.12:** the three layout problems found during the check (M9–M11) are fixed and checked in the browser.

**Not in Phase 1:** B9 (ticket dates) and B10 (status vs groups). Their fix is the new ticket data model in Phase 5, so fixing them in memory now would be done twice.

**Exit gate:** all acceptance criteria pass, the receptionists click through every remaining tab, and the PR is merged.

---

## Phase 2 — Foundation

**Goal:** everything the later phases need: the lists exist, a service layer, signed-in identity, and permission checks.
**Branch:** `feat/front-desk-foundation`
**Effort:** 3–4 days.

### P2.1 Config [G1]
- New `src/services/frontDesk/frontDeskConfig.ts`, containing:
  - the site path
  - the list names (Appendix A)
  - the photo library name (if D7 keeps photos)
  - every choice value as an `as const` array
- The UI and the list setup both read these arrays. One source for status values prevents a repeat of B1, where the tab values and the status values never matched.

### P2.2 Shared Graph helper [G1]
- New `src/services/frontDesk/frontDeskGraph.ts`:
  - `resolveSiteId()` and `resolveListId(name)`, both cached. A missing list throws a clear error: *"List FrontDesk_Visitors not found — run Front Desk setup in TestGround"*.
  - `collectPages()`: the PNGX version, including its repeated-link guard.
  - `createItem`, `updateFields`, `deleteItem` wrappers.
- **Tests:** paging, missing-list error, repeated `nextLink`.

### P2.3 List setup [G1]
- New `src/services/frontDesk/frontDeskListSetup.ts`, exporting `ensureFrontDeskLists(client)`. It is idempotent:
  - creates missing lists with the Appendix A columns
  - adds missing columns to lists that already exist (the pattern in `sharePointOpsService.ts:275–330`)
  - creates the photo library if D7 keeps photos
- Mark `VisitDate`, `Status`, `ReceivedAt`, `StartDateTime`, `ReportedAt` and `TicketId` as `indexed: true`. Once a list passes 5,000 items, SharePoint rejects filtered queries on non-indexed columns, and the visitor list grows every day.
- Add a **Front Desk lists** card to `src/pages/TestGround.tsx`, next to the Task Groups setup (around line 1108). It shows each list as present or missing, with a **Create / repair** button.
- **Tests:** when some columns already exist, only the missing ones are posted.

### P2.4 Restrict list access [G4, D9]
- If D9 = restrict: break permission inheritance on the `FrontDesk_*` lists and the photo library in SharePoint, and grant access only to the front-desk group and admins.
- This is a manual SharePoint step, not code. Record the exact steps in the Phase 8 feature doc.

### P2.5 Signed-in identity [G3]
- New `src/hooks/frontDesk/useFrontDeskActor.ts`: returns `{ email, name }` from `useMsal().accounts[0]`, with the email lower-cased.
- Every create writes `LoggedByEmail` / `CreatedByEmail`, and sign-out writes `SignedOutByEmail`. SharePoint's own Created By / Modified By remain the full history.
- Replace the hard-coded "Current User" / "CU" in `TicketDialog.tsx:144` and `:301` [B8].

### P2.6 Permissions [G4, D5]
- `RoleManagement.tsx:53`: rename "IT Tickets" to **"Front Desk"** and add `extraActions`:
  - `create` — log visitors, mail, appointments, inquiries, tickets
  - `update` — edit records, sign visitors in and out
  - `delete` — delete records
  - `manage` — manage ticket groups
  - `export` — print and export logs
- `PermissionMatrix.tsx:76`: add the same actions to the `tickets` resource.
- New `src/hooks/frontDesk/useFrontDeskPermissions.ts`: returns `{ canCreate, canUpdate, canDelete, canManage, canExport }` from `hasPermission('tickets', …)`.
- Gate every New / Edit / Delete / group / export control in the seven components. Hide controls the user cannot use; do not just disable them.
- In Admin → Role Management, create the **Front Desk** role group per D5 and assign the receptionists.
- The route itself stays `tickets:read` (`App.tsx:294`).
- **Tests:** the permission-mapping helper.

### P2.7 Shared hook conventions
- New `src/hooks/frontDesk/frontDeskQueryKeys.ts`, plus a `useFrontDeskClient()` hook that returns a cached Graph client.
- One standard error toast for failed mutations. This replaces the `// TODO: toast` notes in `MailAndPackages.tsx:237`, `:256`, `:277`.
- Today's visitor log and the mail list refetch every 30 seconds, so two desks stay in step.

**Exit gate:**
- Running setup on the live site creates every list and column, and running it again changes nothing.
- A receptionist (non-admin) account can open `/tickets` and sees only the controls its role allows.

### Phase 2 status (2026-10-21)

Coded on `feat/front-desk-foundation`, based on `main` after PR #11.

**Built:**

| Task | Files |
|---|---|
| P2.1 | `services/frontDesk/frontDeskConfig.ts` |
| P2.2 | `services/frontDesk/frontDeskGraph.ts` |
| P2.3 | `services/frontDesk/frontDeskListSetup.ts`, plus the TestGround **Front Desk Lists Setup** card (`components/frontDesk/FrontDeskSetupCard.tsx`) |
| P2.5 | `hooks/frontDesk/useFrontDeskActor.ts`; ticket comments now carry the signed-in user |
| P2.6 | Role Management and Permission Matrix show **Front Desk** with create / update / delete / manage / export; `hooks/frontDesk/useFrontDeskPermissions.ts` |
| P2.7 | `hooks/frontDesk/frontDeskQueryKeys.ts`, `useFrontDeskGraph.ts`, `frontDeskToasts.ts`; the Mail TODO toasts are replaced |

**How the five tabs are gated (P2.6):**
- New buttons are hidden without `create`, and Delete without `delete`.
- Ticket groups (add, rename, delete) are hidden without `manage`.
- Edit, the inline pickers and drag-and-drop need `update`. The pickers still show their values but do not open, and dragged cards snap back.
- The visitor card pickers are gated in place. They are fully replaced in Phase 3.

**Checks:**
- **Tests:** 15 new Vitest tests (Graph helper, list setup, permissions); the full suite fails only on the two baseline CSV files.
- **Types:** the same 235 errors as `main`.
- **Lint:** no new problems.
- **Browser:**
  - The setup card's read-only **Check** reaches the live site and reports all 7 lists and the photo library as missing, with their column counts.
  - As an admin, every Tickets control is still shown.
  - A ticket comment shows the signed-in user instead of "Current User".

**Live site (2026-10-21):**
- With the product owner's go-ahead, **Create / repair** created all 7 lists and the `FrontDesk_VisitorPhotos` library on the scpngintranet site.
- Every list has its Appendix A columns. The indexes are on Visitors `VisitDate` and `Status`, Appointments `StartDateTime`, MailPackages `ReceivedAt`, Inquiries `ReportedAt` and TicketComments `TicketId`.
- **Check** then reported all 8 as **Ready**.
- The run took about 95 seconds, and the card shows only a spinner until the end.

**Still open:**
- P2.4: restrict the new lists and library in SharePoint (manual).
- Creating the Front Desk role group in Admin → Role Management and assigning the receptionists (manual).
- The non-admin browser check, which needs a receptionist account.

---

## Phase 3 — Visitor Log (replace the paper sheet)

**Goal:** reception stops using the paper Visitors Log Sheet. This is the highest-value phase.
**Branch:** `feat/front-desk-visitor-log`
**Effort:** 5–6 days.

**Status model:**

| New status | Meaning | Replaces |
|---|---|---|
| Expected | Pre-booked, not yet arrived | `scheduled` |
| On Site | Signed in; `TimeIn` set | `checked-in` |
| Signed Out | Left; `TimeOut` set | `checked-out` |
| No Show | Pre-booked, never arrived | `no-show` |

### P3.1 Visitors service [G1]
- New `src/services/frontDesk/visitorsService.ts`, with these methods:
  - `listByDate(dateKey)` — filters on the indexed `VisitDate`
  - `listOnSite()` — `Status = On Site`, any date [M1]
  - `create`, `update`
  - `signIn(id, at)`, `signOut(id, at, by)`, `markNoShow(id)`
  - `delete`
- `mapVisitor(item)` tolerates missing optional fields and trims names.
- **Tests:** mapping, the filter each method builds, sign-out time validation.

### P3.2 Hooks
- `useVisitorLog(dateKey)`, `useVisitorsOnSite()`, and `useVisitorMutations()`.
- Sign-in and sign-out update the screen immediately (optimistic update), then roll back if SharePoint rejects the change.

### P3.3 Quick walk-in sign-in [L1, L4, L6]
- A compact **Sign in a visitor** bar at the top of the Visitors tab, with:
  - **Name\*** — one field; a first name with only an initial is allowed [L4]
  - Company
  - **Reason\***
  - Host (optional staff picker)
  - Badge No (optional)
  - **[Sign in]** button
- Date and Time In fill in automatically with the current PNG date and time [L1].
- **Same group** [L6]: after a sign-in, an **"Add another from ⟨Company⟩"** button pre-fills Company, Reason and Host and shares a `GroupRef`. This replaces the paper "✓ same as above" marks.
- Enter submits, and focus returns to Name so the next visitor can be typed straight away.
- **Accept:** a walk-in can be signed in with only a name and a reason, without opening a dialog.

### P3.4 Real Time In / Time Out [B11, L2, L3]
- Each On Site row gets a **Sign out** button. It sets `TimeOut = now`, `Status = Signed Out` and `SignedOutByEmail`.
- For a pre-booked visitor, arrival sets `TimeIn` and leaves `ExpectedStart` untouched. This fixes the overwrite at `VisitorManagement.tsx:1043–1045`.
- Duration is calculated from `TimeIn` / `TimeOut`. Remove the free-text duration editor (`onDurationChange`) and the time quick-pick that wrote text.
- Users with `update` permission can correct either time. `TimeOut` must not be earlier than `TimeIn`.

### P3.5 Daily Log view [L5, M1, G7]
- Add a new default **Log** view: a table with exactly the paper columns, in the same order:

  **Date · Visitor's Name · Company · Reason for Visit · Time In · Time Out**

  plus Host and a Sign out action. A date picker opens any past day.
- An **On site now** count and filter. It includes visitors still signed in from earlier days, flagged *"Not signed out — ⟨date⟩"* [M1].
- The Today tab is defined by `VisitDate` (PNG day), so multi-day visits stay visible [M1].
- The existing board, grid and list views read the same saved data. Dragging a card changes its status through a mutation, and dropping it on Signed Out signs the visitor out.

### P3.6 Full visitor form (pre-booking and edits) [L1, L4, B2]
- Rework the Add/Edit modal:
  - required fields per D4 only
  - one Name field
  - a `VisitDate` with optional expected start and end times, replacing the date range [L1]
  - host chosen from staff (the permanent fix for B2)
- Pre-booked visitors are saved as **Expected** and appear in that day's log.

### P3.7 Photos [M3, D7]
- **If kept:**
  - Upload with `uploadFile(file, '/sites/scpngintranet', 'FrontDesk_VisitorPhotos', 'YYYY/MM')`.
  - Rename the file to `⟨visitorId⟩-⟨timestamp⟩.⟨ext⟩` first. `uploadFile` uses `file.name` as the path, so duplicate names would overwrite each other.
  - Store the returned `webUrl` in `PhotoUrl`. Never store base64.
- **If dropped:** remove the photo UI.
- Either way, remove the sample paths under `/images/visitors/`, which do not exist.

### P3.8 Remove sample visitors [M8]
- Delete `sampleVisitors` (lines 123–200). The empty state reads *"No visitors signed in today."*

### P3.9 Pilot (exit gate)
- Run the module alongside the paper sheet at reception for one working week.
- Each day, compare the module's log with the paper sheet.
- Collect issues through the existing UAT page (`/uat-feedback`).
- **Exit:**
  - Every paper entry for the week exists in the module with a Time In and Time Out.
  - The receptionists agree to retire the paper sheet. Optionally keep it only as a fallback for network outages.

---

## Phase 4 — Mail & Packages and Appointments

**Branch:** `feat/front-desk-mail-appointments` (or two branches, 4A and 4B)
**Effort:** 4–5 days.

### 4A — Mail & Packages

#### P4.1 Service and hooks [G1]
- `src/services/frontDesk/mailPackagesService.ts` and `useMailPackages()`.
- The date presets filter on the indexed `ReceivedAt` column.
- The B7 immutable-filter fix carries over.

#### P4.2 Recipient from the staff directory [M5]
- A recipient picker that fills `RecipientEmail`, `RecipientName` and `RecipientUnit` (from the staff record's unit).
- An **"Other (not in directory)"** choice keeps free text for non-staff recipients.

#### P4.3 Collection record [M5]
- Moving an item to Delivered opens a small prompt:
  - **Collected by** — defaults to the recipient, editable
  - **Collected at** — defaults to now
- Moving an item back out of Delivered clears both, as `MailAndPackages.tsx:259–278` does today.

#### P4.4 Remove sample mail [M8]
- Delete `initialMailItems` (US carriers, 2023 dates).

### 4B — Appointments

#### P4.5 Service and hooks [G1]
- `src/services/frontDesk/appointmentsService.ts`.
- `StartDateTime` / `EndDateTime` replace the separate `dateRange`, `startTime` and `endTime` strings.

#### P4.6 Form [M4]
- Attendees:
  - staff picker (stores emails), plus free-text external names with company
  - bound to state, replacing the unbound input at lines 948–955
- Date and both times are required, and End must be after Start.
- **Delete** with confirmation, gated by the `delete` permission.

#### P4.7 Views on saved data [B1, B4]
- Reuse the P1.1 and P1.2 helpers for tabs and slots.
- The week and month views keep their current layout.

#### P4.8 Appointment → expected visitors [G6]
- External attendees on an appointment appear in that day's Visitor Log as **Expected**, linked by `AppointmentId`, with company and host pre-filled.
- Signing one in uses that record, so the visitor is not typed twice.
- **Tests:** generating expected visitors from attendees, with no duplicates when the appointment is edited.

#### P4.9 Remove sample appointments [M8]
- Delete `sampleAppointments`.

**Exit gate:**
- Two receptionists on different PCs see the same mail and appointments within 30 seconds.
- An appointment's external visitor can be signed in from the log without retyping.

---

## Phase 5 — Inquiries & Tickets

**Branch:** `feat/front-desk-inquiries-tickets` (or two branches, 5A and 5B)
**Effort:** 5–7 days.

### 5A — General Inquiries

#### P5.1 Service and hooks [G1, B3, M6]
- `src/services/frontDesk/inquiriesService.ts`. The P1.4 dialog now saves to SharePoint.
- `ReportedAt` is stored as ISO.
- `ResolvedAt` is set when the status becomes Resolved and cleared if it is reopened.

#### P5.2 Escalate to ticket [G6]
- An **Escalate to ticket** action creates a `FrontDesk_Tickets` item. It copies title, description, priority and assignee, and sets `SourceInquiryId`.
- The inquiry then shows *"Escalated → ⟨ticket⟩"*, and the ticket links back to it.

#### P5.3 Orphaned components
- `InquiryBoardLane.tsx` and `InquiryGridView.tsx`: wire them in as Board / Grid toggles only if the receptionists asked for them in D1. Otherwise they are deleted in P8.1.

#### P5.4 Remove sample inquiries [M8]
- Delete `initialInquiries`.

### 5B — Ticket Manager (with D3 = separate lists)

#### P5.5 New data model [B9, B10]
- `Status` (New / In Progress / Done) is a field, independent of the column a ticket sits in.
- Columns are groups (`GroupId`).
- Dates are ISO `StartDate` / `DueDate`. This removes the `"MMM d"` round-trip that produced the year 2001.
- New fields: `SortOrder`, `Completed`, `CompletedAt`.

#### P5.6 Saved groups [B10]
- Groups are stored in `FrontDesk_TicketGroups`.
- Deleting a group that still has tickets must ask whether to move them to another group or delete them. No silent loss (`TicketManager.tsx:1239–1253`).
- Gated by the `manage` permission.

#### P5.7 Status no longer moves tickets [B10]
- The card and list status menus (`TicketManager.tsx:1400–1429`) only change the `Status` field. Tickets never jump columns or vanish.
- The status filter reads the field, not the column.

#### P5.8 Reordering [B10]
- Implement the TODO at `TicketManager.tsx:1212`: reorder within a column with `arrayMove`.
- Cross-column drops honour the drop position already worked out in `dropTargetInfo`.
- Save `SortOrder`, renumbering the affected column on each drop.

#### P5.9 Comments [B8, G3]
- Comments are stored in `FrontDesk_TicketComments`, with the author taken from `useFrontDeskActor`.
- `commentsCount` is derived from the stored comments.

#### P5.10 Edits keep every field [B8]
- The dialog loads and saves assignee, comments, dates, group and status.
- **Test:** an edit that only changes the title leaves every other field unchanged.

#### P5.11 Date filter [B9]
- Date presets compare against ISO `DueDate`.
- **Tests:** today, last week, last month, custom range.

#### P5.12 Remove sample tickets [M8]
- Delete `initialBoardData`.

#### P5.13 Ticket Inbox [B5, D2]
- Only if D2 chose to rebuild it: a read-and-reply view over tickets and their comments. Otherwise it stays removed.

**Exit gate:**
- Tickets and inquiries survive a refresh and appear on a second PC.
- An escalated inquiry links to its ticket in both directions.
- Deleting a group never loses tickets without confirmation.

---

## Phase 6 — Notifications [G5]

**Branch:** `feat/front-desk-notifications`
**Effort:** 2–3 days.

### P6.1 Notification helper
- New `src/services/frontDesk/frontDeskNotifications.ts`, exposing `notify({ recipientEmail, title, message, actionUrl })`.
- It sends both, per D6:
  - in-app, through `addNotification` (`System_Notifications`, `sharePointOpsService.ts:3193`)
  - email, through `sendEmailNotification` (`:3229`)
- Failures are logged and shown as a small warning toast. They never block the sign-in or save that triggered them.

### P6.2 Visitor arrived
- On sign-in of a visitor who has a `HostEmail`, the host receives: *"Your visitor ⟨name⟩ (⟨company⟩) has arrived at reception."*

### P6.3 Mail waiting
- On logging an item with a `RecipientEmail`, the recipient receives: *"A ⟨letter / parcel⟩ is waiting for you at reception."* If the item needs a signature, the message says so.
- `NotifiedAt` is stored so the message is not repeated.

### P6.4 Assignment
- When an inquiry or ticket is assigned or reassigned, the new assignee is notified.

### P6.5 Message content
- Plain SCPNG wording.
- Never include a visitor's phone number or email address in an email.

### P6.6 Fire only on changes
- A pure helper decides whether to notify: only when the status changes *to* On Site, or the assignee changes. Plain edits do not notify.
- **Tests:** that helper.

**Exit gate:**
- A test host receives both the in-app and the email notice.
- With email failing on purpose, the visitor is still signed in.

---

## Phase 7 — Reporting & exports [G7, L5, M4]

**Branch:** `feat/front-desk-reports`
**Effort:** 3–4 days.

### P7.1 Daily Visitor Log PDF [L5]
- Reproduces the paper **SCPNG Visitors Log Sheet** for any date:
  - SCPNG header
  - columns: Date · Visitor's Name · Company · Reason for Visit · Time In · Time Out
- Built with `jspdf-autotable`, following `attendanceReportExportService.ts:489`.

### P7.2 Visitor log Excel [L5, G7]
- Any date range, built with `exceljs` (`attendanceReportExportService.ts:406`).

### P7.3 On site now — evacuation list [G7]
- One-click print, large type.
- Includes every visitor currently On Site (from `listOnSite`) with company and host.

### P7.4 Mail register [G7]
- Excel or PDF, filtered by date range and status, including collection details.

### P7.5 Appointments print / export [M4]
- Re-enable the buttons hidden in P1.7 for the visible day, week or month.

### P7.6 Permission
- Every export is gated by `canExport`.

**Tests:** build every report's rows in a pure function (records → rows), and test those functions.

**Exit gate:** reception can print yesterday's log sheet and a live evacuation list.

---

## Phase 8 — Clean-up & documentation

**Branch:** `chore/front-desk-cleanup`
**Effort:** 1–2 days.

| Task | Action | Finding |
|---|---|---|
| P8.1 | Delete `InquiryBoardLane.tsx` and `InquiryGridView.tsx` unless P5.3 wired them in | — (orphaned, audit §2) |
| P8.2 | Remove the fake `UserNav` (`TicketManager.tsx:92–121`) and the unused imports across the ticketing folder; lint clean | M7 |
| P8.3 | Confirm no sample or non-PNG data remains: search the folder for "Acme", "USPS", "FedEx", "lorem", "Laudantium" | M8 |
| P8.4 | Rewrite `docs/pages/tickets/README.md` and `docs/ui/ticketing/README.md` to describe the real system. Archive `docs/architecture/database/tickets.md`, which documents a Supabase schema that was never built, with a pointer to Appendix A. | G2 |
| P8.5 | Supabase `tickets` / `ticket_messages` types: Supabase is being removed app-wide, so these go with the rest of `src/integrations/supabase` in that removal. If that removal hasn't happened by Phase 8, delete the two table entries from `types.ts` here. Then confirm `grep -rn supabase src/components/ticketing src/pages/Tickets.tsx src/services/frontDesk src/hooks/frontDesk` returns nothing. | G1 |
| P8.6 | `AppUIRole.RECEPTIONIST` (`useUIRoles.ts:58`) is unused: remove it, or document that front-desk access comes from the Role Management group (P2.6) | G4 |
| P8.7 | New `docs/features/front-desk.md`: lists and columns, setup steps, D9 access steps, permissions, notifications, reports | G2 |
| P8.8 | Placeholder tabs removed in D1 come back only with written requirements and a new plan; they are out of scope here | G9 |

---

## Appendix A — SharePoint lists

Column types are given as Graph column definitions, for example:

- `dateTime: { format: 'dateOnly' }`
- `choice: { choices: [...] }`
- `text: { allowMultipleLines: true }`

"Indexed" means `indexed: true`. Every list keeps SharePoint's built-in Created, Modified, Created By and Modified By.

### FrontDesk_Visitors

| Column | Type | Req. | Notes | Finding |
|---|---|---|---|---|
| Title | text | yes | Visitor's full name, one field | L4 |
| Company | text | | | |
| Reason | text, multi-line | yes | Reason for Visit | |
| VisitDate | dateTime (date only), **indexed** | yes | PNG calendar day | L1, M1 |
| ExpectedStart | dateTime | | Pre-booked arrival time | B11 |
| ExpectedEnd | dateTime | | | |
| Status | choice: Expected, On Site, Signed Out, No Show — **indexed** | yes | | B11 |
| TimeIn | dateTime | | Set on sign-in | L2 |
| TimeOut | dateTime | | Set on sign-out | L3 |
| HostEmail | text | | Staff email | B2, G5 |
| HostName | text | | | |
| Phone | text | | Optional | L4 |
| Email | text | | Optional | L4 |
| BadgeNo | text | | | audit §7 |
| PhotoUrl | text | | Library webUrl, only if D7 keeps photos | M3 |
| Notes | text, multi-line | | | |
| GroupRef | text | | Shared by visitors who arrive together | L6 |
| AppointmentId | text | | `FrontDesk_Appointments` item id | G6 |
| LoggedByEmail | text | | Receptionist who signed the visitor in | G3 |
| SignedOutByEmail | text | | | G3 |

### FrontDesk_Appointments

| Column | Type | Req. | Notes | Finding |
|---|---|---|---|---|
| Title | text | yes | | |
| HostEmail / HostName | text | yes | Staff | |
| Location | text | | | |
| StartDateTime | dateTime, **indexed** | yes | | M4 |
| EndDateTime | dateTime | yes | Must be after Start | M4 |
| Attendees | text, multi-line (JSON) | | `[{ name, email?, company?, external }]` | M4, G6 |
| Status | choice: Scheduled, Completed, Canceled | yes | | B1 |
| Description | text, multi-line | | | |
| CreatedByEmail | text | | | G3 |

### FrontDesk_MailPackages

| Column | Type | Req. | Notes | Finding |
|---|---|---|---|---|
| Title | text | yes | Description or subject | |
| ItemType | choice: Mail, Package | yes | | |
| Sender | text | | | M5 |
| Carrier | text | | | audit §7 |
| Tracking | text | | | |
| RecipientEmail / RecipientName / RecipientUnit | text | yes (name) | From the staff directory, or "Other" | M5 |
| ReceivedAt | dateTime, **indexed** | yes | | B6 |
| Status | choice: Received, Pending Pickup, Signature Required, Delivered | yes | | |
| CollectedAt / CollectedBy | dateTime / text | | Set on Delivered | M5 |
| Notes | text, multi-line | | | |
| LoggedByEmail | text | | | G3 |
| NotifiedAt | dateTime | | Prevents repeat notices | G5 |

### FrontDesk_Inquiries

| Column | Type | Req. | Notes | Finding |
|---|---|---|---|---|
| Title | text | yes | | |
| Description | text, multi-line | | | |
| Category | choice: Facilities, IT Support, Supplies, Parking, Food Service, HR, General | yes | Today's `potentialCategories` | |
| Priority | choice: High, Medium, Low | yes | | |
| Status | choice: Open, In Progress, Resolved | yes | | |
| AssigneeEmail / AssigneeName | text | | Staff | M6, G5 |
| ReportedBy | text | | | |
| ReportedAt | dateTime, **indexed** | yes | | M6 |
| ResolvedAt | dateTime | | | |
| EscalatedTicketId | text | | | G6 |
| LoggedByEmail | text | | | G3 |

### FrontDesk_Tickets

| Column | Type | Req. | Notes | Finding |
|---|---|---|---|---|
| Title | text | yes | | |
| Description | text, multi-line | | | |
| Priority | choice: High, Medium, Low | yes | | |
| Status | choice: New, In Progress, Done | yes | Independent of the group | B10 |
| GroupId | text | yes | `FrontDesk_TicketGroups` item id | B10 |
| SortOrder | number | | Position within the group | B10 |
| StartDate / DueDate | dateTime | | ISO, never "MMM d" | B9 |
| AssigneeEmail / AssigneeName | text | | | B8 |
| Completed / CompletedAt | boolean / dateTime | | | |
| SourceInquiryId | text | | | G6 |
| CreatedByEmail | text | | | G3 |

### FrontDesk_TicketGroups

| Column | Type | Notes |
|---|---|---|
| Title | text | Group (column) name |
| SortOrder | number | Column order |

### FrontDesk_TicketComments

| Column | Type | Notes |
|---|---|---|
| TicketId | text, **indexed** | |
| Body | text, multi-line | |
| AuthorEmail / AuthorName | text | From `useFrontDeskActor` (G3) |

### FrontDesk_VisitorPhotos (document library, only if D7 keeps photos)

- Folders by `YYYY/MM`.
- Files named `⟨visitorId⟩-⟨timestamp⟩.⟨ext⟩`.
- Access restricted per D9.

---

## Appendix B — Traceability (every audit finding → tasks)

| Finding | Summary | Closed by |
|---|---|---|
| B1 | Appointments tab filter never matches | P1.1, P4.7 |
| B2 | New Visitor host dropdown empty | P1.3, P3.6 |
| B3 | No create or edit for inquiries | P1.4, P5.1 |
| B4 | Day view ignores navigation; wrong hour rows | P1.2, P4.7 |
| B5 | Ticket Inbox is a static mock | D2, P1.7, P5.13 |
| B6 | Mail received date discarded | P1.5 |
| B7 | Filter checkboxes stick after Reset | P1.6 |
| B8 | Ticket edit wipes assignee and comments; fake author | P1.9, P2.5, P5.9, P5.10 |
| B9 | Ticket dates resolve to 2001 | P5.5, P5.11 |
| B10 | Status vs groups; silent loss; no reordering | P5.5, P5.6, P5.7, P5.8 |
| B11 | Check-in overwrites time; no timestamps | P3.4 |
| B12 | Fake QR check-in | D8, P1.7 |
| B13 | List view calls a hook inside a loop | P1.10 |
| B14 | Ticket form resets on every keystroke | P1.11 |
| M1 | Today tab and multi-day visits | P3.1, P3.5 |
| M2 | Pagination not reset | P1.8 |
| M3 | Base64 photos; missing sample paths | D7, P3.7 |
| M4 | Appointment attendees, validation, delete, header, print | P1.2, P4.6, P4.7, P7.5 |
| M5 | Mail: sender, collection, recipient, alert() | P1.5, P4.2, P4.3 |
| M6 | Inquiries: delete confirm, date filter, fake assignees | P1.4, P5.1 |
| M7 | Dead `UserNav`, unused imports | P8.2 |
| M9 | Appointment tabs vanish at ~950px | P1.12 |
| M10 | Ticket search box squeezed to 46px | P1.12 |
| M11 | Mail calendar opens on the wrong month | P1.12 |
| M8 | Non-PNG, stale sample data | P3.8, P4.4, P4.9, P5.4, P5.12, P8.3 |
| G1 | No persistence; unused Supabase types | P2.1, P2.2, P2.3, P2.7, P3.1, P3.2, P4.1, P4.5, P5.1, P5.5, P8.5 |
| G2 | Docs describe a non-existent system | P8.4, P8.7 |
| G3 | No identity or audit trail | P2.5, P5.9 |
| G4 | No action-level permissions; "IT Tickets" label; unused role | D5, D9, P2.4, P2.6, P8.6 |
| G5 | No notifications | D6, P6.1–P6.6 |
| G6 | No links between tabs | P4.8, P5.2 |
| G7 | No reporting | P3.5, P7.1–P7.6 |
| G8 | Overlap with the Task board | D3 |
| G9 | Placeholder tabs advertised | D1, P1.7, P8.8 |
| L1 | No single visit date | P3.3, P3.6 |
| L2 | Time In overwritten | P3.4 |
| L3 | No Time Out | P3.4 |
| L4 | Form heavier than paper; single names rejected | D4, P3.3, P3.6 |
| L5 | No log-sheet view or print | P3.5, P7.1, P7.2 |
| L6 | No "same as above" / group entry | P3.3 |
| §2 | Orphaned `InquiryBoardLane` / `InquiryGridView` | P5.3, P8.1 |
| §8 | Module cannot replace the paper sheet | P3.9 (pilot and sign-off) |

---

## Appendix C — Risks and mitigations

| Risk | Effect | Mitigation | Where |
|---|---|---|---|
| SharePoint 5,000-item list view threshold | Filtered visitor queries start failing after a year or two | Index the filter columns; always query by an indexed date | P2.3, P3.1 |
| Visitor personal data readable by anyone with site access | Privacy exposure (phones, photos) | Restrict the lists and library (D9); keep phone and email out of notification emails | P2.4, P6.5 |
| `/me/sendMail` needs Mail.Send consent for receptionist accounts | Email notices fail | Other services already use it. Confirm with a receptionist account in the Phase 6 exit test; in-app notices still arrive. | P6.1 |
| Two desks editing the same record | Last write wins | 30-second refetch on busy views; edits update by item id; show who last changed a record | P2.7, P2.5 |
| Network or Microsoft 365 outage at reception | Visitors cannot be logged | Keep the paper sheet as an outage fallback after the pilot | P3.9 |
| Uncommitted ticketing edits on `fix/division-scoped-figures` | Phase 1 builds on a branch without them, or conflicts | Land them first (see the prerequisite in section 2) | §2 |
| Scope creep into the placeholder tabs | Plan slips | Out of scope until written requirements exist | D1, P8.8 |
