# Strategy fixes, live verification and sign-in cleanup handover

Recorded 10 November 2026, Pacific/Port_Moresby. This record covers work done in one Claude Code session, which grew out of building the Strategy/Task Registry demo copy. The live observations below were made on 10 November against the production site and the SharePoint tenant.

## Delivery status

| Area | Verified outcome | Remaining work |
|---|---|---|
| Report archive checksums (#19) | Merged and live. New archives pass verification after being stored as JSON. | None |
| Saved reports from before the fix | 2 Research Unit archives and their 6 delivery log entries re-sealed. Report history and the Division Reports tab load again. | Any other archive saved before the fix needs the same procedure (see below) |
| KRA division in strategy graphs and reports (#19) | Merged and live. All 18 live KRAs land in their own division's graph. | None |
| Task card dates (#19, #20) | Merged and live. The range and overdue flag use the due date, and a task starting and due on the same day shows one date. | Not yet seen on a live card: no open task had a future due date at the time of checking |
| TypeScript baseline check (#21) | Merged. Passes on `main` and from git worktrees. | Run `npm ci` in the main checkout once the demo work there is finished |
| Division page figures (#7) | Merged and live. The Division page counts only that division's tasks, KPIs and KRAs. | Check another division's counts on the live site |
| Gemini models (#7) | Merged and live. Chats use `gemini-3.8-flash`; Improve with AI uses `gemini-3.5-flash-lite`; busy errors retry and fall back. | Update the Report Scheduler Apps Script by hand; test an AI chat and the admin key test on the live site |
| Azure sign-in redirect addresses | `https://unitopia-hub.vercel.app/` removed from the intranet's app registration. | None |
| Old Vercel project `unitopia-hub` | Left in place: it belongs to a different Vercel login and nothing uses it. | Optional deletion |

## Code changes merged to `main`

### #19: archive checksums, KRA division scope and task card due dates (`a5ee86b`)

These three bugs were found while building and testing the demo copy. Only the fixes were brought to `main`; the demo's mock data was not.

- **Report archive checksums** (`src/services/strategyReportArchiveService.ts`): `canonicalJson()` now follows `JSON.stringify` rules.
  - Object keys whose value is `undefined` are left out.
  - `undefined` array entries become `null`.
  - `toJSON()` is honoured, so Dates become ISO strings.

  Archives are stored as JSON and verified again in `history()`. Snapshots contain missing optional fields and Date task start dates, so before this fix every archive failed with "Stored report N failed its snapshot checksum", and Strategy and Division AI could never read one. Archives that were already plain JSON keep the same checksum.
- **KRA division** (`src/services/strategyExecutionGraphService.ts`): `legacyToPerformanceRecords` now takes a KRA's division from its Division column, falling back to `department` only when Division is empty. `mapKRA` fills `department` from the Unit column, so KRAs had been given their unit name as their division and dropped out of division- and unit-scoped graphs and reports.
- **Task cards** (`src/components/unit-tabs/TaskCard.tsx`): the card accepts `dueDate` and uses it when no `endDate` is passed. `TasksTab` passes the task record, which carries `dueDate`, so the card had fallen back to the start date for both its range and its overdue flag. Every task that had started therefore showed as overdue.
- **Tests:** regression tests were added in `src/tests/strategyReportArchive.test.cjs` and `src/tests/strategyExecutionGraphService.test.ts`. Both fail on the old code.

### #20: single date on same-day task cards (`e2c8441`)

After #19, a task that starts and is due on the same day showed "Apr 13 - Apr 13". The card had compared the raw due-date text with the formatted start date, which never match. The label now comes from `formatTaskDateRange()` in `src/utils/taskBoardUtils.ts`.
- It compares calendar days, and leaves the end off when it is missing, invalid or on the same day.
- Date-only due dates are read as local days.
- Four tests are in `src/tests/taskBoardUtils.test.ts`.

### #21: TypeScript baseline check from a worktree (`f251301`)

`scripts/check-typescript-baseline.mjs` reported two "new" diagnostics even on unmodified `main`. They were baseline errors whose wording had changed, because the main checkout's `node_modules` is newer than `package-lock.json`. The script also couldn't run in a worktree that has no `node_modules` of its own.
- Both errors are fixed in source: `src/components/forms/LeaveApplicationPage.tsx` and `src/pages/MarketData.backup.tsx`.
- The script now finds `tsc` through Node's normal module lookup.
- The baseline file is unchanged.

### #7: Division page figures and Gemini models (`41b29c8`)

- **Division figures** (`src/hooks/useDivisionData.ts`, `src/utils/divisionScope.ts`): the shared readers return the viewer's own or unit tasks, every KPI in the organisation, and, for administrators, every KRA. `scopeRecordsToDivision` narrows these to the division being viewed:
  - a KRA belongs by its Division column, or by its unit when Division is blank;
  - a KPI belongs through its KRA;
  - a task belongs by its unit (the task's `Department` field), or through its KPI or KRA when it has no unit.

  It only removes records, so no viewer gains access to anything. Before this, Corporate Services showed the viewer's 54 IT Unit tasks and "72 KPIs", the organisation-wide count.
- **Gemini models:** `src/config/geminiModels.ts` is now the single place for model IDs. AI Hub and the Strategy, Division, Regulatory and Website Analytics chats use `gemini-3.8-flash`, and Improve with AI uses `gemini-3.5-flash-lite`. `src/services/geminiClient.ts` retries busy (503/429) responses and falls back to another model.
  - According to Google's Gemini API documentation, access to the 2.5 models has been limited since 18 September 2026, and 3.8 Flash or 3.5 Flash-Lite are recommended instead. On 10 November no shutdown date was announced for `gemini-2.5-flash` on the Gemini API.
- **Merge notes:** the PNGX announcements page in this PR was already on `main` through #8, so it added nothing. On 4 November CI had failed on the branch's old base. The branch was updated with `main` (`fb1b1a8`) before merging, and all four checks then passed.

## Live verification on 10 November

**How it was checked:**
- **Before the merges were deployed:** `main` ran on `localhost:8080`, which is a registered sign-in address, against live SharePoint. Checks used the app's own service code and read data only.
- **After deployment:** the production site was checked while signed in as the repository owner.

**Results:**
- **KRAs:** all 18 live KRAs have a Unit value different from their Division value. With the fix, the division-scoped graphs hold Corporate Services 4, Legal Services 2, Licensing, Market & Supervision 3, Office of the Chairman 5 and Research & Publication 4. The old logic put none of them directly in scope.
- **Report archives:** `Performance_Reports` held only two archives (items 4 and 5, Research Unit, saved on 9 November) and six delivery log entries (items 6–11). Both archives failed verification under the fixed code, and because `history()` stops at the first bad record, they blocked all report history.
- **Tasks:** of 70 tasks, 16 were open. 13 of those had no dates, and 3 were genuinely overdue. No open task had a future due date, so the overdue fix had no visible case at the time.
- **Production:** `www.scpngintranet.com` served the latest build of `main`. The Corporate Services Division page showed its 4 KRAs (4.2 to 4.5), and the Reports tab loaded with no checksum error.

## Data repair: `Performance_Reports` items 4–11

**Why it was needed:** the two archives were saved by the old code. Their stored checksum was computed over a form in which Dates hashed as `{}` and missing fields as the text `undefined`. That form can't be rebuilt from the stored JSON, so these archives could never verify, and they stopped report history and Strategy/Division AI from loading.

**Evidence the content was genuine:** both items had a single SharePoint version, created when the report was saved, and had never been edited.

**What changed:** in each of the eight items, only the stored snapshot checksum value inside `ContentJSON` was replaced, with one computed by the fixed code. The two archives are items 4 and 5; their delivery log entries are items 6–11, which carry the same checksum. Nothing else in the items changed.

**Safeguards:**
- **Before writing:** the script checked each archive's expected old checksum and verified the new values with the app's own checks. It then simulated the full archive history.
- **While writing:** each item was re-read and saved with `If-Match`, so a changed item would not be overwritten. A confirmation dialog came before any write.

**Who ran it:** Claude Code's permission system blocked Claude from writing to live SharePoint. The repository owner therefore ran the script in the browser console on `localhost:8080`, signed in under their own account, so the change is recorded under their name.

**Result:** all eight items were updated. Both archives and all six delivery entries then passed verification, report history loaded, and the Division Reports tab listed both reports.

**Rollback:** SharePoint version history keeps each item's previous version (1.0).

**Reuse:** the exact script is kept as a record in [2026-11-10-reseal-report-archives.console.js](2026-11-10-reseal-report-archives.console.js). Its guards stop it from running again on these items. For another pre-fix archive, change `ARCHIVE_IDS` and `EXPECTED_OLD`, then run it the same way. Only archives saved before #19 was deployed (about 04:12 UTC on 10 November) can have this problem.

## Deployment and sign-in findings

- **Staff address:** staff use `www.scpngintranet.com`, and `scpngintranet.com` redirects to it. It is the production domain of the Vercel project `scpng-intranet-`, which deploys every merge to `main` within about a minute.
- **`scpng-intranet.vercel.app`** serves the same build, but Microsoft sign-in fails there (AADSTS50011) because it is not a registered sign-in address. This is expected.
- **`unitopia-hub.vercel.app`** is an older, separate Vercel project under a different Vercel login. Staff don't use it.
- **Azure app registration `spx_data_crud`**, used for intranet sign-in:
  - **Removed:** `https://unitopia-hub.vercel.app/`, so that if the old project's address is ever freed, a new owner can't receive staff sign-ins.
  - **Remaining single-page application addresses:**
    - `https://www.scpngintranet.com/` and `https://www.scpngintranet.com`
    - `http://localhost:8080/`
    - two `scpng-intranet-git-…-johnsarwoms-projects.vercel.app` preview addresses
- **Vercel preview deployments for other branches** aren't registered, so sign-in fails there. Test sign-in flows on `localhost:8080` instead.

## Verification and limits

- **Strategy suite:** passed at every merge (156/156 after #7).
- **Each PR:** its own vitest tests passed, the TypeScript baseline check found no new diagnostics, and the production build succeeded. All CI checks passed before each merge.
- **Existing noise on `main`:**
  - vitest reports "No test suite found" for the strategy suite's `node:test` `.cjs` files, which run under `node --test` instead.
  - Two `csv-helpers` tests fail. Neither comes from this work.
- **Not verified:**
  - an AI chat answering on the live site with the new Gemini models
  - the admin key test
  - a live task card showing the due-date fix
  - Division counts for divisions other than Corporate Services after #7 went live

## Next steps

1. In the Report Scheduler Apps Script editor, change the model to `gemini-3.8-flash`, as in `gas/Code.gs`. That script doesn't deploy from GitHub.
2. On the live site, run the key test under Admin → API Management and ask the AI Hub a question.
3. Open another division's page, for example Executive Division, and check that its task and KPI counts are its own.
4. Once the demo copy work is finished, run `npm ci` in the main checkout. Its installed packages were newer than the lockfile on 10 November: TypeScript 5.9.3 vs 5.6.3, react-hook-form 7.90.0 vs 7.53.1 and chart.js 4.5.1 vs 4.4.9.
5. Optionally, delete the old `unitopia-hub` Vercel project from the login that owns it.
6. Never merge `demo/strategy-task-mock-data` into `main`. It switches the Strategy, Task Registry and Division pages to mock data by default.

**To check what's live:** compare the `/assets/index-*.js` file served by `www.scpngintranet.com` with the build of the latest production deployment for `main`.

**To test `main` against live SharePoint locally:** run Vite on port 8080 with `--strictPort`. In a git worktree, copy the main checkout's `.env` and `.env.local` and use its `node_modules`.

No credentials, tokens or local environment files were committed. No individual staff records are included in this repository.
