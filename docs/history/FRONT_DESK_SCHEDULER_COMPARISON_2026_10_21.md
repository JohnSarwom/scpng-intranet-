# Scheduled jobs: Power Automate vs Azure Functions

**Date:** 2026-10-21
**Decision (2026-10-21):** the product owner chose **Power Automate under a new dedicated, non-admin account**. D12 and P6B.1 in the execution plan are updated to match. Azure Functions remains the fallback (section 1).
**Question:** Phase 6B of `docs/features/front-desk-execution-plan.md` puts the seven scheduled Front Desk jobs in Power Automate (decision D12). Would Azure Functions be better?

**Scope:** only the scheduled jobs, P6B.2–P6B.8:
- FD-Backstop
- FD-EndOfDay
- FD-MailReminders
- FD-SLA
- FD-DailyDigest
- FD-Retention
- Notifications-Cleanup

Everything in Phases 2–6 (notices on save, routing, "Assigned to me", markers) is app code either way.

**How this was checked (read-only):**
- Microsoft Graph, through the signed-in intranet session: directory roles, tenant licences, the service account.
- The Azure portal, opened in the browser pane. It stopped at an Authenticator prompt and the tab was closed without signing in, so **whether an Azure subscription exists is not confirmed.**
- Microsoft and Vercel documentation (sources at the end).

---

## 1. Summary

**Recommendation: keep Power Automate for Phase 6B, but not under `automation@scpng.gov.pg` as it is today.**

**The reasons:**
- **Nothing new to buy, host or secure.** The tenant's Microsoft 365 Business Premium licences (35 assigned, including the service account) include Power Automate with standard connectors. That allows 6,000 requests per user per day; the seven jobs need roughly 1,000–1,500.
- **Azure is not set up.** No Azure subscription was confirmed, and buying one from Papua New Guinea is not verified. Azure Functions also needs a few admin steps that are new here: per-site SharePoint grants, and Exchange "RBAC for Applications" to scope sending.
- **The jobs are simple.** Each one is "query a list, then send an email or update a field". That suits Power Automate, especially with the logic kept thin.

**Choose Azure Functions instead if** any of these become true:
1. SCPNG gets an Azure subscription for other reasons.
2. The jobs grow real logic that deserves automated tests.
3. You want every scheduled job reviewed as code in this repo.

It is the stronger engineering option: least-privilege identity, no shared password, code review and tests. It costs about two more days and adds Azure to look after.

**Whichever is chosen, fix the service account first (section 5).** `automation@scpng.gov.pg` holds **Global Administrator plus 47 other admin roles**. It should not own scheduled flows or be used for everyday testing.

---

## 2. What each option needs here

### Power Automate

| Need | Status in this tenant |
|---|---|
| Account to own the flows | `automation@scpng.gov.pg` exists, is enabled, has a mailbox, and holds Business Premium + Power Automate Free. **But it is a Global Administrator** (section 5). A dedicated non-admin account is recommended; there is **one spare Business Premium licence** (35 of 36 assigned). |
| Licence for standard connectors | Included in Business Premium. 6,000 requests per 24 hours per user; limits do not pool. |
| Connections | SharePoint, Office 365 Outlook and Office 365 Users, created once under the owning account |
| Admin consent | None |
| Billing | None new |
| Access to the restricted lists | Add the owning account to the front-desk SharePoint group (P2.4) |
| Tools | A browser |
| Lead time | Same day |

**Microsoft's own guidance** is to own critical flows with a **service principal** inside a solution, not a shared user account. A service-principal owner draws on the tenant's unlicensed pool of 25,000 requests a day. That needs solution-aware flows, so treat it as a later upgrade, not a blocker.

### Azure Functions

| Need | Status in this tenant |
|---|---|
| Azure subscription | **Not confirmed.** The portal needs the account's MFA, so it could not be checked. If none exists, a pay-as-you-go subscription needs a card, and availability from Papua New Guinea is **not verified**; check the Azure sign-up page or your Microsoft 365 licensing partner. |
| Hosting plan | **Flex Consumption** (Linux), Microsoft's recommended serverless plan. The Linux Consumption plan retires on 30 September 2028. Nearest region: Australia East. |
| Extra resources | A storage account (required); Application Insights for logs and failure alerts (optional, billed by data volume) |
| Identity | A **system-assigned managed identity**. No app registration and no secret to rotate. A separate app registration with a certificate would only be needed if the code ran outside Azure, for example on Vercel. |
| SharePoint permission | `Sites.Selected` (whole site) or `Lists.SelectedOperations.Selected` (single lists). The identity starts with **no** access. An admin then grants it per site or per list (`POST /sites/{id}/permissions` or `/lists/{id}/permissions`), using a tool that holds `Sites.FullControl.All`, for example PnP PowerShell. List-level grants break inheritance on that list. |
| Mail permission | `Mail.Send` scoped to **one mailbox**, for example the reception mailbox, through **Exchange RBAC for Applications**, which replaces application access policies. Do **not** also grant tenant-wide `Mail.Send` in Entra: the two are additive, so the tenant-wide grant would cancel the scope. |
| Admin consent | Needs a Global Administrator or Privileged Role Administrator. **Available:** the admin account used here is a Global Administrator. |
| Code | A new `functions/` package in this repo (TypeScript, timer triggers). It reuses the pure helpers from `src/services/frontDesk/`, bundled with esbuild because the app uses `@/` path aliases. |
| Schedules | Written in UTC. PNG is UTC+10 with no daylight saving, so 17:30 PNG is always 07:30 UTC. No time-zone setting is needed. |
| Deployment | GitHub Actions (`Azure/functions-action`) with an OIDC federated credential, so no deployment secret. The repo already has a workflow (`.github/workflows/strategy-execution-quality.yml`). |
| Tools to install on this PC | Azure CLI, Azure Functions Core Tools, and the PowerShell modules Microsoft.Graph, ExchangeOnlineManagement and PnP.PowerShell. None is installed today. |
| Running cost | Flex Consumption includes a monthly free grant; check the current pricing page, because Microsoft's pages quote different execution counts. These jobs run a few hundred times a day, well inside it. Expect storage and logging to be the only charges, in the order of a few US dollars a month. |
| Lead time | About 2–3 days of set-up before the first job runs, plus waiting for the subscription |

### Vercel cron (ruled out)

The app is already deployed on Vercel, but this option is ruled out:
- On the free Hobby plan, cron jobs run **at most once a day**, at an imprecise time within the hour. The 15-minute and hourly jobs need Pro.
- It also needs an app registration with a stored secret.

Azure Functions does everything Vercel cron would, with a managed identity instead of a secret.

---

## 3. Side by side

| Criterion | Power Automate | Azure Functions |
|---|---|---|
| New platform to run | None (the tenant already has 20 flows, 10 of them switched on) | Azure subscription, function app, storage, optional App Insights |
| Up-front set-up | Hours | 2–3 days, plus the subscription |
| Build effort, seven jobs | 4–6 days (as planned) | 4–5 days of code and tests on top of the set-up: **6–8 days** |
| Running cost | Nothing new | A few US dollars a month (estimate) |
| Admin steps | Create the account and connections; add it to the SharePoint group | Graph app roles for the identity; per-site or per-list grant; Exchange RBAC scope for mail; subscription billing |
| Identity | A user account with a password and MFA | Managed identity: no password, nothing to leak |
| Least privilege | Coarse: the flow can do anything the account can, and **flow co-owners can use its connections** | Fine-grained: only the granted site or lists, and only the scoped mailbox |
| Version control and review | Exported flow packages in `docs/flows/` (P6B.9). They are records, not reviewable diffs. | Normal code: pull requests, review, history |
| Automated tests | None; manual runs in test mode | Vitest on the same pure helpers the app uses |
| Reuse of app logic | Re-implemented in flow expressions (risk of drift, e.g. SLA maths) | Imports the app's helpers directly |
| Monitoring | Run history (28 days); the failure branch emails the owners | Application Insights alerts; logs searchable |
| Debugging | In the designer, one run at a time | Run locally against test data; breakpoints |
| Limits | 6,000 requests/day for the owning user | Effectively none at this volume |
| Bus factor | Anyone with Power Automate skills; co-owners | Needs someone who can read TypeScript and use Azure |
| Fit with the "Microsoft 365 / SharePoint only" direction | Stays inside Microsoft 365 | Adds Azure, still Microsoft, but a new bill and console |
| Track record here | Designer-built standard flows work (staff sync, notice-board import). The API-deployed Report Scheduler did not: premium HTTP action, connection references. | No history in this project |

---

## 4. What the email looks like to staff

| | Power Automate | Azure Functions |
|---|---|---|
| Sender | The owning account (e.g. "SCPNG Automation") | Any one mailbox the scope allows, e.g. **the reception shared mailbox itself** |
| Replies | Set reply-to the reception mailbox (D11) | Go straight to reception |

---

## 5. Security finding: the service account is a Global Administrator

`automation@scpng.gov.pg` holds **48 directory roles**, including:
- Global Administrator
- Privileged-level roles such as Security, Exchange, SharePoint, Application, Billing, Power Platform and Compliance Administrator

It is also the account currently signed in to the intranet in the development browser pane, and the report-scheduler documents use it for flow connections.

**Why it matters:**
1. Anyone who knows its password and holds its Authenticator has full control of the tenant.
2. In Power Automate, **co-owners of a flow can use the flow's connections**, so a co-owner effectively acts as this account inside that flow.
3. Testing the intranet as a Global Administrator hides permission bugs. The Phase 2 non-admin check is still outstanding for this reason.

**Recommended, regardless of the scheduler choice:**
- **Power Automate path:** create a dedicated, non-admin account for the Front Desk flows (the spare Business Premium licence). Give it only:
  - membership of the front-desk SharePoint group
  - its own mailbox
- **Azure path:** the managed identity replaces the user account entirely.
- **In both cases:**
  - Keep administration on a separate, named admin account.
  - Use an ordinary staff account for day-to-day testing.
  - Review who knows the `automation@` credentials.

**This changes D12.** "Service account `automation@scpng.gov.pg`" becomes "a dedicated non-admin account", or "a managed identity" if Azure Functions is chosen.

---

## 6. What changes in the plan, by choice

**If Power Automate (recommended):**
- D12: owner is a new dedicated non-admin account with a named co-owner, not `automation@`.
- P6B.1: create that account, assign the spare licence, add it to the front-desk SharePoint group.
- Everything else in Phase 6B stays as written.

**If Azure Functions:**
- D12: owner is the function app's managed identity.
- P2.4: grant the identity write access to the site (`Sites.Selected`) or to the specific lists, instead of group membership.
- D11: scheduled mail is sent *as* the reception mailbox, using the Exchange RBAC scope. Browser notices still use reply-to.
- **Phase 6B becomes code:**
  - **P6B.1** Subscription, Flex Consumption app (Australia East), managed identity, Graph and Exchange grants, GitHub Actions deployment.
  - **P6B.2–P6B.8** The same seven jobs as timer-triggered functions in `functions/`, with Vitest tests on their decision logic.
  - **P6B.9** Failure alerts in Application Insights.
- Effort for Phase 6B rises from 4–6 to 6–8 days.

---

## 7. Checks only you can do

1. **Azure subscription:** sign in to portal.azure.com → Subscriptions with an admin account. Is there one, and who pays for it?
2. **If there is none:** confirm with the Azure sign-up page, or the partner that sells your Microsoft 365 licences, that a subscription can be bought and billed from Papua New Guinea.
3. **`automation@`:** who knows its credentials, and which existing flows depend on its admin roles? Staff sync and the notice-board import appear to need only ordinary user rights.

---

## Sources

- [Power Platform request limits and allocations](https://learn.microsoft.com/en-us/power-platform/admin/api-request-limits-allocations)
- [Power Automate licensing FAQ](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs)
- [Understand flow ownership and access](https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/understand-access-to-flows)
- [Support for service principal owned flows](https://learn.microsoft.com/en-us/power-automate/service-principal-support)
- [Azure Functions Flex Consumption plan](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan)
- [Azure Functions pricing](https://azure.microsoft.com/en-us/pricing/details/functions/)
- [Migrate Consumption plan apps to Flex Consumption](https://learn.microsoft.com/en-us/azure/azure-functions/migration/migrate-plan-consumption-to-flex)
- [Deploy to Azure Functions with GitHub Actions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-how-to-github-actions)
- [Selected permissions in OneDrive and SharePoint](https://learn.microsoft.com/en-us/graph/permissions-selected-overview)
- [Role Based Access Control for Applications in Exchange Online](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac)
- [Vercel cron jobs: usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
