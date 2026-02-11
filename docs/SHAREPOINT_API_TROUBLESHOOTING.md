# SharePoint API & Integration Troubleshooting Guide

**Last Updated:** 2026-02-06
**Related Components:** `sharePointOpsService.ts`, `SharePointListSetupService.ts`

This document serves as a repository for common errors, gotchas, and solutions encountered when integrating with the Microsoft Graph API for SharePoint Lists.

---

## 1. "Cannot read properties of undefined (reading 'Title')" on Update

### 🔴 The Issue
When updating an item (KRA, Task, Objective) using the Graph API, the application crashes immediately after the update with:
`TypeError: Cannot read properties of undefined (reading 'Title')`

### 🔍 Root Cause
The `create` and `update` methods in the service were using different API endpoints that return different data structures.

- **The Problematic Endpoint:** `.../items/{id}/fields`
    - When performing a `PATCH` on this endpoint, the API returns **only the fields that were modified**, in a flat structure.
    - It **does NOT** return the full item object or the specific `item.fields` nesting that our mappers (`mapKRA`, `mapTask`) expect.

- **The Expected Structure:** Our mappers expect the standard Graph API Item response:
    ```json
    {
      "id": "1",
      "fields": {
        "Title": "...",
        "Status": "..."
      }
    }
    ```

### ✅ The Fix
**Always use the `/items/{id}` endpoint for updates if you need the full object back.**

Change your implementation from:
```typescript
// ❌ WRONG: Returns incomplete data
const response = await this.client
    .api(`/sites/${siteId}/lists/${listId}/items/${id}/fields`)
    .patch(fields);
```

To:
```typescript
// ✅ CORRECT: Returns full item with fields
const response = await this.client
    .api(`/sites/${siteId}/lists/${listId}/items/${id}`)
    .patch({ fields }); // Note: Payload must be wrapped in 'fields' property
```

---

## 2. "Bad Request" (400) on Mock Data Upload

### 🔴 The Issue
Upload fails with a `400 Bad Request` error, often citing invalid fields.

### 🔍 Root/Common Causes
1. **Schema Mismatch:** The field name in your payload (e.g., `RelatedKRAId`) does not match the internal name in SharePoint (e.g., `RelatedKRALookupId` or `RelatedKRA`).
2. **Hidden System Fields:** Attempting to write to read-only system fields will fail.
3. **Lookup Latency:** Trying to link to an item that was *just* uploaded but hasn't been indexed by search yet (if using search-based retrieval).

### ✅ The Fixes
- **Use `LookupId` Suffix:** For lookup columns, always append `LookupId` to the internal name (e.g., `StrategyGoal` -> `StrategyGoalLookupId`).
- **Check Internal Names:** Use the browser URL or `/_api/web/lists/getbytitle('List')/fields` to verify the *actual* internal name, which can differ from the Display Name.
- **Direct Linkage:** When uploading linked data (e.g., Tasks -> KPIs), upload parents first, get their IDs, and use those precise IDs for child creation immediately. Do not rely on Search API (`/search/query`) for instant consistency.

---

## 3. General Patterns & Best Practices

| Action | Recommended Endpoint | Valid Payload Structure | Notes |
| :--- | :--- | :--- | :--- |
| **Get Item** | `/items/{id}?expand=fields` | N/A | Always expand fields. |
| **Create Item** | `/items` | `{ fields: { ... } }` | Returns full item + custom fields. |
| **Update Item** | `/items/{id}` | `{ fields: { ... } }` | Returns full item. Use this over `/fields` endpoint. |
| **Delete Item** | `/items/{id}` | N/A | Returns 204 No Content. |
