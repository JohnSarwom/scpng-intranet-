# SharePoint List Schema: User_Custom_Contacts

**Date:** 2026-03-28
**Time:** 08:00 PM (2026-03-28T20:00:15+10:00)

## List Definition
- **Display Name**: `User_Custom_Contacts`
- **Internal Name**: `User_Custom_Contacts`
- **Template**: `genericList`

## Columns

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `Title` | `Text` | Maps to the contact's **Display Name**. |
| `JobTitle` | `Text` | The contact's job title or position. |
| `Department` | `Text` | The contact's department or organizational unit. |
| `Email` | `Text` | The primary email address for the contact. |
| `Phone` | `Text` | The primary contact number (mobile or business). |
| `Company` | `Text` | The contact's company or organization. |
| `OfficeLocation` | `Text` | The physical office or branch location. |
| `OwnerEmail` | `Text` | **CRITICAL**: The email address of the user who owns this contact. Used for data isolation. |

## Data Isolation Mechanism
All queries to the `User_Custom_Contacts` list MUST include a filter on the `OwnerEmail` field to ensure that users only see their own private contacts.

**Graph API Filter Example:**
```http
GET /sites/{site-id}/lists/User_Custom_Contacts/items?$expand=fields&$filter=fields/OwnerEmail eq '{user_email}'
```

## List Provisioning
The list is provisoned programmatically via the `SharePointListSetupService.createCustomContactsList()` method, which sets up the necessary columns and verification checks.
