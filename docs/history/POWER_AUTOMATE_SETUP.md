# Power Automate Setup for Notice Board

This document provides a comprehensive guide on setting up the automated integration between Outlook emails and the SCPNG Intranet Notice Board. It covers the automatic list creation, the Power Automate flow configuration (including robust error handling), and the frontend logic for distinct content rendering.

## 1. SharePoint List Setup (Automated)

You do **not** need to create the SharePoint list manually. The Intranet application can create it for you.

1.  **Test Ground Method**:
    *   Navigate to `/test-ground` in the application.
    *   Find the **Announcements Setup** card.
    *   Click **Deploy Announcements List**.
    *   This will check for the "Announcements" list and create it with the correct schema if it's missing.

2.  **Schema Verification**:
    The list includes the following columns:
    *   `Title` (Single line of text) - Stores Email Subject
    *   `Content` (Multiple lines, Rich Text) - Stores Email Body (HTML)
    *   `Category` (Choice) - 'Announcement', 'Event', 'Update', 'Alert'
    *   `IsPinned` (Boolean) - For manual pinning
    *   `ExpiryDate` (Date & Time) - Optional
    *   `SourceEmail` (Single line of text) - Stores Sender Address

---

## 2. Power Automate Flow Setup

This flow monitors specific email boxes and creates items in the SharePoint list.

### Step-by-Step Configuration

1.  **Create Flow**:
    *   Go to [Power Automate](https://make.powerautomate.com/).
    *   Create an **Automated cloud flow**.
    *   Name: "Add All Staff & Boardroom Emails to Notice Board".
    *   Trigger: **When a new email arrives (V3)** (Office 365 Outlook).

2.  **Configure Trigger**:
    *   **Folder**: Inbox
    *   **Include Attachments**: No (unless required)
    *   **To**: Leave empty (we filter in the next step).
    *   **Important**: This ensures the flow triggers for every email, and we filter specifically for our targets.

3.  **Add Condition (The Filter)**:
    *   Add a **Condition** action.
    *   We need to check if the email is sent TO or CC'd to our target groups (`allstaff` or `boardroom`).
    *   **Robust Formula**: Because the "CC" field can be null (causing flow failures), we use `coalesce` to handle empty values.
    *   Use the **OR** logic for these checks:
        *   `To` contains `allstaff@scpng.gov.pg`
        *   `To` contains `boardroom@scpng.gov.pg`
        *   `CC` (null-safe) contains `allstaff@scpng.gov.pg`
        *   `CC` (null-safe) contains `boardroom@scpng.gov.pg`

    *Note: In the Condition builder, you can just use the "contains" operator. The "CC" field might need the following expression if you encounter "Null" errors:*
    `coalesce(triggerOutputs()?['body/ccRecipients'], '')`

4.  **Configure "If Yes" Branch**:
    *   Add **Create item** (SharePoint) action.
    *   **Site Address**: Select SCPNG Intranet site.
    *   **List Name**: Announcements.

    **Field Mappings**:
    *   **Title**: `Subject` (from Dynamic Content)
    *   **Content**: `Body` (This captures the HTML content)
    *   **SourceEmail**: `From` (from Dynamic Content)
    *   **Category**: **CRITICAL STEP**
        *   Use the following Expression to automatically set "Event" for Boardroom emails and "Announcement" for others.
        *   It handles missing CC fields safely.
        
        ```javascript
        if(or(contains(coalesce(triggerOutputs()?['body/toRecipients'], ''), 'boardroom'), contains(coalesce(triggerOutputs()?['body/ccRecipients'], ''), 'boardroom')), 'Event', 'Announcement')
        ```
        
    *   **IsPinned**: No (Default)

5.  **Save and Turn On**:
    *   Your flow is now ready to catch emails and post them to SharePoint.

---

## 3. Frontend Logic (NoticeBoard.tsx)

The application frontend (`src/components/dashboard/NoticeBoard.tsx`) has specific logic to handle these email-generated announcements.

### HTML Sanitization
*   **Library**: `isomorphic-dompurify` (or `dompurify`)
*   **Purpose**: Since the email body is saved as raw HTML, we must sanitize it before rendering to prevent XSS attacks while preserving formatting (Bold, Links, Lists).
*   **Implementation**:
    ```typescript
    const sanitizeContent = (content: string) => {
      // Logic to strip Body tags if nested
      // Uses DOMPurify.sanitize(content, { USE_PROFILES: { html: true } })
    };
    ```

### Intelligent Signature Stripping
*   **Problem**: Emails often contain long signatures ("Best Regards", "Sent from Outlook") which clutter the Notice Board.
*   **Solution**: A Regex-based filter removes these automatically.
*   **Logic**:
    *   It looks for markers like `Best Regards`, `Kind Regards`, `Sent from my`, `From:`.
    *   It handles variations with HTML tags (e.g., `Best<br>Regards`).
    *   It explicitly **ignores** polite closings like "Thank you" to preserve the message tone.
    *   It truncates purely the signature block at the end of the content.

### Category Display
*   items via "Boardroom" -> Display with **Green** "Event" badge.
*   items via "All Staff" -> Display with **Blue** "Announcement" badge.

---

## Troubleshooting

*   **Flow fails on "Null"**:
    *   Use the `coalesce(..., '')` function in your expressions. Power Automate hates null values in string functions.
*   **Raw HTML showing in Notice Board**:
    *   Ensure the frontend code uses `dangerouslySetInnerHTML` combined with the `sanitizeContent` function.
    *   If you see `<html>` tags, the sanitizer is working but the rendering mechanism might be treating it as plain text.
*   **Signatures still showing**:
    *   The Regex might need tuning if a unique signature format is used (e.g., "Warmly" instead of "Regards"). Check `NoticeBoard.tsx` > `stripSignature`.
