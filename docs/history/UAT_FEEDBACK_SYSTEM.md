# UAT Feedback System

## Overview

The **UAT Feedback System** is a floating survey widget that appears on every page of the SCPNG Intranet, allowing staff to submit comments, ratings, and screenshots during User Acceptance Testing (UAT). Feedback is stored directly in a SharePoint list with file attachments uploaded to a dedicated SharePoint document library folder. Admins can review, filter, and manage all submissions from a dedicated page.

**Version:** 1.0
**Date Introduced:** 2026-03-10
**Feedback Route (Admin):** `/uat-feedback`
**Sidebar Entry:** Admin-only — labelled **UAT** with `MessageSquareText` icon
**Permissions Required:** Admin role only (for review page); visible to all authenticated users (for widget)

---

## Architecture

### Files Created / Modified

| File | Type | Purpose |
|------|------|---------|
| `src/services/feedbackService.ts` | Service | `FeedbackSharePointService` class — CRUD against `UAT_Feedback` SharePoint list; static `createList()` for bootstrapping |
| `src/components/feedback/FeedbackWidget.tsx` | Component | Floating survey widget (FAB) rendered on every page |
| `src/components/admin/UATFeedbackTab.tsx` | Component | Admin review panel — stats, filters, status management, deletion |
| `src/pages/UATFeedbackPage.tsx` | Page | Standalone admin page wrapping `UATFeedbackTab` |
| `src/components/layout/PageLayout.tsx` | Modified | Added `<FeedbackWidget />` — renders when `hideNavAndFooter` is false |
| `src/config/navItems.ts` | Modified | Added UAT nav item to `adminNavItems` |
| `src/App.tsx` | Modified | Registered `/uat-feedback` route |
| `src/pages/TestGround.tsx` | Modified | Added "Create UAT_Feedback List" setup card and handler |

---

## SharePoint Backend

### List: `UAT_Feedback`

Created via the **Test Ground** page using the "Create UAT_Feedback List" button.

| Column | Type | Notes |
|--------|------|-------|
| `Title` | Single line of text | Page name (e.g. "Dashboard") |
| `PageRoute` | Single line of text | URL path (e.g. "/market-data") |
| `UserName` | Single line of text | Display name from MSAL |
| `UserEmail` | Single line of text | Email from MSAL |
| `Rating` | Number (1–5) | Staff rating of the page |
| `Category` | Choice | Bug Report, UI/UX Issue, Feature Request, General Comment, Performance Issue |
| `Comment` | Multiple lines of text | Main feedback body (max 2000 chars) |
| `Status` | Choice | New (default), Reviewed, Resolved |
| `AttachmentUrl` | Single line of text | SharePoint webUrl of uploaded file |

### File Uploads

Attachments (screenshots, PDFs, etc.) are uploaded to:

```
Asset Images / FeedBackFiles
https://scpng1.sharepoint.com/sites/scpngintranet/Asset%20Images/FeedBackFiles
```

- Uploaded via the existing `useSharePointUpload` hook
- Filename is prefixed with a Unix timestamp (e.g. `1741651234567_screenshot.png`) to prevent name collisions
- The returned `webUrl` is stored in the `AttachmentUrl` column of the list item

---

## Widget — Survey UI

The floating action button appears in the **bottom-right corner** of every page (z-index 200, above all other content).

### Survey Fields (in order)

1. **What type of feedback is this?** — 5 visual icon cards in a 3×2 grid
   - Bug Report (`Bug` icon, red)
   - UI/UX Issue (`Paintbrush` icon, purple)
   - Feature Request (`Lightbulb` icon, amber)
   - General Comment (`MessageCircle` icon, sky)
   - Performance Issue (`Gauge` icon, orange)

2. **Describe your experience** — Textarea, max 2000 characters

3. **Attach a screenshot** *(optional)* — File picker (images, PDF, Word docs). Uploads to SharePoint on submit.

4. **How would you rate this page?** — 5-star rating (at the bottom), labelled Poor → Excellent

### Submission Flow

1. User fills out the survey and clicks **Submit Feedback**
2. If a file is attached, it is uploaded first to `Asset Images/FeedBackFiles`
3. The returned file URL + all form fields are posted to the `UAT_Feedback` SharePoint list
4. A success screen is shown for ~2.8 seconds, then the widget closes

### Height Constraint

The panel uses `max-height: calc(100vh - 110px)` to ensure it never clips above the page header, regardless of screen size.

---

## Admin Review Page — `/uat-feedback`

### Stats Row
- **Total Submissions** — all records in the list
- **Unreviewed** — items with status `New`
- **Avg. Rating** — mean star rating across all submissions

### Filters
- By page name
- By category
- By status (New / Reviewed / Resolved)
- Refresh button to reload from SharePoint

### Per-Entry Actions
- **Status dropdown** — change between New, Reviewed, Resolved (updates SharePoint immediately)
- **View attachment** — external link to the uploaded file in SharePoint
- **Delete** — removes the record from the SharePoint list

---

## Setup Instructions

### Step 1 — Create the SharePoint List
1. Navigate to **Test Ground** (`/test-ground`)
2. Scroll to the **UAT Feedback List Setup** card
3. Click **Create UAT_Feedback List**
4. Wait for the success toast

> This only needs to be done once. If the list already exists the button will report it gracefully.

### Step 2 — Verify the Upload Folder Exists
Ensure the folder `FeedBackFiles` exists inside the `Asset Images` document library in SharePoint:
```
https://scpng1.sharepoint.com/sites/scpngintranet/Asset%20Images/FeedBackFiles
```
If it does not exist, create it manually in SharePoint before staff start testing.

### Step 3 — Begin UAT Testing
The widget is now live on every page. Staff can submit feedback immediately.

---

## Accessing Feedback (Admin)

- Via the sidebar: **UAT** menu item (admin-only)
- Via the Admin dashboard: **UAT Feedback** tab
- Direct URL: `/uat-feedback`

---

## Future Enhancements (Suggested)

- Export feedback to Excel / CSV
- Email notification to admin when new feedback is submitted (Power Automate)
- Aggregate analytics — most-reported pages, category breakdown charts
- Toggle to disable the widget after UAT phase ends
