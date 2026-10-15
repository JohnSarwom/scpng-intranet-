# Notice board

Updated 16 October 2026. See the [deployment and operations runbook](../notice-board-email-feed.md) for flow IDs, list schemas, routing, live tests and recovery details, and the [session handover](../../history/2026-10-16-notice-board-staff-sync-handover.md) for delivery status.

## Content and access

- `Announcements` holds ordinary manually published notices. News articles remain in `NewsArticles`.
- Imported mail has separate `EmailAnnouncements_AllStaff` and `EmailAnnouncements_AllOfficers` lists. SharePoint permissions enforce access; a browser filter does not provide security.
- Only All Officers routing/import is active. Both email lists remain restricted to site owners, following the user's decision. The application email feature flag is off.
- The legacy notice importer is off. Technical flow alerts were removed while the legitimate notice was preserved.

## Home-screen popup

`StaffAnnouncementWelcome.tsx` offers unseen, active, staff-wide manual announcements after the signed-in user's fresh successful home-screen fetch. It uses maroon styling, light/dark themes, title, date, plain-text summary and full-detail navigation. Imported emails and restricted manual audiences are excluded.

Dismissals store item IDs per account and browser, with memory fallback. They are not centrally tracked read receipts. Existing active announcements may appear on first use; another browser or cleared storage may show them again. Background refetches do not interrupt an open session.

`useNoticeBoard.ts` scopes queries by account and feature flag and disables persistent query caching. Readers paginate all items, normalize previews and suppress known technical notification content. The email service retains case-sensitive Internet Message IDs for deduplication and supplies an Outlook sender/subject search action; attachments remain in recipients' mailboxes.

## Deployment

The popup and reader changes are implemented and locally verified, but have not been deployed to the live intranet. Keep `VITE_ENABLE_EMAIL_NOTICES=false` until an approved audience grant and member/nonmember access tests are completed. Do not enable it to bypass the owner-only decision.
