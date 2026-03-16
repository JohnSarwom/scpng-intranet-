# Notification System — Power Automate Setup Guide

## Overview

The notification system uses a **SharePoint List** (`System_Notifications`) as the data store. The frontend polls this list every 30 seconds to show notifications in the bell icon dropdown.

**Power Automate** is responsible for **creating** notification items in this list when events happen in Microsoft 365 (emails, SharePoint changes, schedules). The frontend only **reads** and **marks as read**.

## SharePoint List Schema

List name: `System_Notifications` (auto-created by the app on first load)

| Column | Type | Description |
|---|---|---|
| Title | Single line text | Notification headline |
| Message | Multi-line text | Detail/description |
| RecipientEmail | Single line text | Target user's email (lowercase) |
| Type | Single line text | `info`, `warning`, `task`, `approval`, `system` |
| Category | Single line text | `kra`, `kpi`, `task`, `project`, `document`, `admin` |
| ActionUrl | Single line text | App route to navigate to (e.g., `/units/finance`) |
| IsRead | Boolean | `false` when created, `true` when user reads it |
| CreatedBy_Custom | Single line text | Who/what created the notification |

---

## Power Automate Flows to Create

### Flow 1: Task Assigned Notification

**Trigger:** When an item is created — SharePoint list `Operations_Tasks`

**Condition:** New item has an Assignees field with email(s)

**Action:** Create item in `System_Notifications`:
```
Title: "New task assigned: [Task Title]"
Message: "You have been assigned a new task by [Created By]"
RecipientEmail: [Assignee Email - lowercase]
Type: "task"
Category: "task"
ActionUrl: "/units/[Unit Name]"
IsRead: false
CreatedBy_Custom: [Created By Name/Email]
```

**Note:** If multiple assignees, use an **Apply to each** loop to create one notification per assignee.

---

### Flow 2: KRA Status Change Notification

**Trigger:** When an item is modified — SharePoint list `Performance_KRAs`

**Condition:** Status field has changed (use a trigger condition or compare old/new)

**Action:** Create item in `System_Notifications`:
```
Title: "KRA status updated: [KRA Title]"
Message: "Status changed to [New Status]"
RecipientEmail: [Owner Email - lowercase]
Type: "info"
Category: "kra"
ActionUrl: "/units/[Unit Name]"
IsRead: false
CreatedBy_Custom: "System"
```

---

### Flow 3: Overdue Task Alerts (Daily)

**Trigger:** Recurrence — Daily at 8:00 AM

**Action 1:** Get items from `Operations_Tasks` where:
- `DueDate` is less than today
- `Status` is not `Completed`

**Action 2:** For each overdue task, create item in `System_Notifications`:
```
Title: "Overdue task: [Task Title]"
Message: "This task was due on [Due Date]"
RecipientEmail: [Assignee Email - lowercase]
Type: "warning"
Category: "task"
ActionUrl: "/units/[Unit Name]"
IsRead: false
CreatedBy_Custom: "System - Daily Check"
```

---

### Flow 4: Email Broadcast to Notification (Extend Existing)

You already have a Power Automate flow for `allstaff@scpng.gov.pg` → Announcements list.

**Add a parallel branch** after the condition to also create notifications:

**Action:** Get all users from `UserRoles` list, then for each user:
```
Title: "[Email Subject]"
Message: "New announcement from [Sender]"
RecipientEmail: [User Email - lowercase]
Type: "system"
Category: "admin"
ActionUrl: "/news"
IsRead: false
CreatedBy_Custom: [Sender Email]
```

---

### Flow 5: Project Status Change

**Trigger:** When an item is modified — SharePoint list `Operations_Projects`

**Condition:** Status field changed

**Action:** Create item in `System_Notifications`:
```
Title: "Project update: [Project Title]"
Message: "Status changed to [New Status]"
RecipientEmail: [Project Lead Email - lowercase]
Type: "info"
Category: "project"
ActionUrl: "/units/[Unit Name]"
IsRead: false
CreatedBy_Custom: "System"
```

---

## Tips

### Avoiding Duplicate Notifications
- Use trigger conditions in Power Automate to only fire when specific fields change
- For the "When an item is modified" trigger, add a condition: `@not(equals(triggerOutputs()?['body/Status'], triggerOutputs()?['body/{OldStatus}']))` (pseudo — actual syntax depends on your column names)

### RecipientEmail Must Be Lowercase
The frontend filters by lowercase email. Always use `toLower()` in Power Automate expressions:
```
toLower(items('Apply_to_each')?['Email'])
```

### Notification Cleanup (Optional)
Create a scheduled flow (weekly/monthly) to delete notifications older than 30 days:
- **Trigger:** Recurrence — Weekly
- **Action:** Get items from `System_Notifications` where `Created` < 30 days ago
- **Action:** Delete each item

### Testing
1. Create the Power Automate flow
2. Manually create a test task in the Operations_Tasks SharePoint list
3. Wait for the flow to trigger and create a notification
4. Check the bell icon in the app — the notification should appear within 30 seconds

---

## RBAC Considerations

- **Notifications are user-scoped**: Each notification targets a specific `RecipientEmail`. Users only see their own.
- **Admin broadcast**: For system-wide notifications, Power Automate loops through all users in the `UserRoles` list and creates one notification per user.
- **Division/Unit targeting**: Power Automate can filter `UserRoles` by Division or Unit to send targeted notifications to specific groups.
- **No admin UI needed for PA flows**: Power Automate flows are managed in the Power Automate portal, not in the app.
