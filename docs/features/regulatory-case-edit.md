# Regulatory Case Edit Feature

## 1. Overview

This document covers the implementation of the Edit Case functionality for the Regulatory Intelligence module. Users can edit any regulatory case (Whistleblower, Scam, Compliance, Enquiry, Investigation) directly from the case table via the actions dropdown menu. Changes are persisted to the `Regulatory_Intelligence_Cases` SharePoint list.

## 2. SharePoint List Details

- **Site Path:** `/sites/scpngintranet`
- **List Name:** `Regulatory_Intelligence_Cases`
- **Editable Column Mapping:**

| SharePoint Column | RegulatoryCase Field | Type |
|---|---|---|
| `Category` | `category` | Text |
| `RiskLevel` | `risk` | Choice (LOW, MEDIUM, HIGH, CRITICAL) |
| `Status` | `status` | Choice (RECEIVED, UNDER_REVIEW, INVESTIGATING, ESCALATED, RESOLVED, CLOSED) |
| `AssignedUnit` | `assignedUnit` | Text |
| `AssignedOfficer` | `assignedOfficer` | Text |
| `Description` | `description` | Multi-line Text |
| `Summary` | `summary` | Multi-line Text |
| `Source` | `source` | Text |
| `Anonymous` | `anonymous` | Boolean |
| `ReporterName` | `reporterName` | Text |
| `ReporterContact` | `reporterContact` | Text |
| `LastUpdate` | (auto-set on save) | DateTime |

**Note:** `CaseId`, `CaseType`, and `CreatedAt` are read-only and cannot be edited.

## 3. Architecture

### Data Flow

```
User clicks "Edit Case" in CaseTable dropdown
  -> CaseEditModal opens pre-filled with current case data
  -> User modifies fields and clicks "Save Changes"
  -> CaseTable.handleSaveCase() calls onUpdateCase prop
  -> RegulatoryDashboard passes useRegulatoryCases().updateCase
  -> updateCase mutation:
      1. Resolves SharePoint list ID
      2. Finds SharePoint item by CaseId field (filter query)
      3. Maps RegulatoryCase fields to SharePoint column names
      4. PATCHes the item fields
      5. Invalidates React Query cache -> auto-refetches table
  -> Toast notification on success/failure
```

### Files Modified/Created

| File | Change |
|---|---|
| `src/hooks/useRegulatoryCases.ts` | Added `updateCase` mutation (useMutation) and `isUpdating` state |
| `src/modules/regulatory/components/CaseEditModal.tsx` | **New file** - Edit form modal component |
| `src/modules/regulatory/components/CaseTable.tsx` | Wired edit button to open CaseEditModal, accepts `onUpdateCase` prop |
| `src/modules/regulatory/components/RegulatoryDashboard.tsx` | Passes `updateCase` and `isUpdating` to all CaseTable instances |

## 4. Component: CaseEditModal

**Path:** `src/modules/regulatory/components/CaseEditModal.tsx`

### Props

```typescript
interface CaseEditModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    caseData: RegulatoryCase | null;
    onSave: (caseId: string, updates: Partial<RegulatoryCase>) => Promise<any>;
    isSaving?: boolean;
}
```

### Form Fields

- **Category** - Text input
- **Risk Level** - Dropdown (LOW, MEDIUM, HIGH, CRITICAL)
- **Status** - Dropdown (RECEIVED, UNDER_REVIEW, INVESTIGATING, ESCALATED, RESOLVED, CLOSED)
- **Assigned Unit** - Dropdown (Unassigned, Legal & Investigations, Licensing & Supervision, Corporate Services, Research & Publication, Executive Division, Secretariat Unit)
- **Assigned Officer** - Text input
- **Source** - Text input
- **Description** - Textarea
- **Summary** - Textarea
- **Reporter Name** - Text input (hidden for anonymous whistleblower cases)
- **Reporter Contact** - Text input (hidden for anonymous whistleblower cases)

### Behavior

- Form pre-fills with current case data when opened
- Reporter fields are hidden when the case is an anonymous whistleblower report (`type === 'whistleblower' && anonymous === true`)
- Save button shows a loading spinner while the mutation is in progress
- Modal closes automatically on successful save
- On error, a destructive toast is shown and the modal remains open

## 5. Hook: useRegulatoryCases (Update Mutation)

**Path:** `src/hooks/useRegulatoryCases.ts`

### New Exports

```typescript
{
    // ...existing exports
    updateCase: (args: { caseId: string; updates: Partial<RegulatoryCase> }) => Promise<any>,
    isUpdating: boolean,
}
```

### Mutation Logic

1. Resolves the `Regulatory_Intelligence_Cases` list ID (cached after first call)
2. Queries SharePoint for the item matching `fields/CaseId eq '{caseId}'`
3. Maps the `Partial<RegulatoryCase>` updates to SharePoint column names
4. Sets `LastUpdate` to the current timestamp automatically
5. PATCHes `/sites/{siteId}/lists/{listId}/items/{spItemId}/fields`
6. On success, invalidates the `['sharePoint', 'regulatoryCases']` query key to trigger a refetch

## 6. Component: CaseTable (Updated)

**Path:** `src/modules/regulatory/components/CaseTable.tsx`

### New Props

```typescript
interface CaseTableProps {
    data: RegulatoryCase[];
    onUpdateCase?: (caseId: string, updates: Partial<RegulatoryCase>) => Promise<any>;
    isUpdating?: boolean;
}
```

### Changes

- "Edit Case" dropdown item now opens `CaseEditModal` instead of showing a "coming soon" toast
- `handleEditCase` receives the full `RegulatoryCase` object (not just the ID)
- `handleSaveCase` wraps `onUpdateCase` with success/error toast notifications
- `CaseEditModal` is rendered alongside the existing `CaseDetailsModal`

## 7. Testing Checklist

- [ ] Click "Edit Case" from the actions dropdown on any case row
- [ ] Verify the modal opens with pre-filled data matching the selected case
- [ ] Change risk level and status, verify dropdowns work
- [ ] Change assigned unit, verify dropdown works
- [ ] Save changes, verify success toast appears
- [ ] Verify the table refreshes and shows updated values
- [ ] Test on a whistleblower case with `anonymous: true` — reporter fields should be hidden
- [ ] Test save failure (e.g., network disconnect) — error toast should appear, modal stays open
- [ ] Verify "Cancel" closes the modal without saving
