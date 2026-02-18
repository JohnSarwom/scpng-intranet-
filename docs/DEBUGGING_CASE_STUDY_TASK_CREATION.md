# Debugging Case Study: Unit Page Task Categorization

## 1. Problem Description
Users reported that newly created tasks on the Unit Page were defaulting to the **"Uncategorized"** group, despite selecting a valid Project Group (e.g., "IT Operations") during creation.

## 2. Investigation & Debugging Techniques

We employed a systematic, full-stack debugging approach to isolate the issue.

### Phase 1: Frontend UI Analysis (The Race Condition)
**Hypothesis:** The UI might be sending the wrong Project ID.
- **Technique:** We inspected the `handleCreateTask` function in `Unit.tsx`.
- **Finding:** The "Create Task" button was active *before* the Project data had finished loading from SharePoint. This meant the internal lookups for Project IDs were empty when the modal opened.
- **Fix:** We implemented a loading state to disable the button until `isDataLoading` became `false`.
- **Result:** This improved stability but did not solve the specific "Uncategorized" issue for correctly loaded projects.

### Phase 2: Backend Payload Verification
**Hypothesis:** The application is sending the correct ID, but SharePoint is rejecting it.
- **Technique:** We enhanced the `SharePointOpsService` with detailed logging:
  ```typescript
  console.log('📝 [SP Ops] Adding Task Payload:', JSON.stringify(payload, null, 2));
  ```
- **Finding:** The logs confirmed the payload **VALID**:
  ```json
  "RelatedProjectLookupId": 26
  ```
  However, the **RESPONSE** from SharePoint showed the field as missing or `undefined`.
- **Conclusion:** The API was receiving the data but refusing to save it to the column.

### Phase 3: Schema & Column Inspection (The Breakthrough)
**Hypothesis:** The SharePoint column configuration is incorrect (e.g., wrong type, wrong internal name, or broken link).
- **Technique:** We built a custom debug tool `debugListColumns` to fetch the **exact** schema definition from SharePoint API.
  ```typescript
  // Fetch columns with FULL details
  const columns = await client.api(...).get();
  // Log specific lookup details
  if (projCol.lookup) {
      console.log('Target List ID:', projCol.lookup.listId);
  }
  ```
- **Finding:**
  1. The column `RelatedProject` existed and was correctly a `Lookup` type.
  2. **CRITICAL:** The `lookup.listId` (Target List) was `8f4ebb8a...`.
  3. We checked our App Configuration, which expects `Operations_Projects` to be list ID `795c1d24...`.
  4. Querying the list `8f4ebb8a...` returned a **404 Not Found**.

### Phase 4: Root Cause Confirmation
The `RelatedProject` column was pointing to a **deleted or recreated list**. When SharePoint receives a Lookup ID for a list that doesn't exist (or isn't the one linked), it silently validates the ID against the *linked* list. Since the ID "26" didn't exist in the deleted list (or the list itself was gone), the write operation was ignored without throwing an error.

## 3. The Solution
**Manual Remediation:**
1. Deleted the broken `RelatedProject` column in SharePoint `Operations_Tasks` list.
2. Created a new Lookup column pointing specifically to the live `Operations_Projects` list.
3. Verified the fix by creating a task and confirming it persisted in the correct column.

## 4. Future Mitigation Strategies

To prevent this from happening again, we recommend the following:

### A. Infrastructure as Code (IaC)
Avoid manual list creation. Use **PnP PowerShell** or **CLI for Microsoft 365** scripts to provision lists and columns. This ensures that the lookup targets are always programmatically linked to the correct lists during deployment.

### B. Startup Health Checks
Implement a "Health Check" service in the application that runs on startup (admin only):
1. Fetches the column definitions for key lists (`Tasks`, `KRAs`).
2. Compares the `lookup.listId` against the known `Operations_Projects` ID.
3. Alerts the user/admin if there is a mismatch.

### C. Strict Type Definitions in Data Layer
Continue using the robust service pattern (`SharePointOpsService`) we refined today. Ensure that all `LookupId` fields are explicitly mapped and logged during development builds to catch schema drifts early.

### D. Environment Consistency
Ensure that Development, Staging, and Production SharePoint sites use the same deployment scripts to maintain ID consistency where possible, or use "Internal Names" reliably to look up lists dynamically.
