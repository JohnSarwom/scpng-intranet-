# UI Terminology & Modal Refinements — 2026-03-29

> **Last Updated:** 2026-03-29 10:01 AEST (GMT+10)
> **Session Date:** 2026-03-29
> **Scope:** KRAs/KPIs/Initiatives Module, Division Module, Add Initiative Modal

---

## Summary

This session introduced three categories of changes:

1. **Modal padding fix** — resolved content clipping in the Add/Edit Initiative modal
2. **Terminology standardization** — renamed labels and helper text across the strategy module
3. **Division page cleanup** — removed the "Open Unit Page" navigation button from the unit drill-down modal

---

## 1. Add Initiative Modal — Padding Fix

**Problem:** The modal header ("Add New Objective") and footer ("Save Objective" / "Cancel" buttons) were clipping against the top and bottom edges of the dialog card, with insufficient breathing room.

**Root Cause:** The `DialogContent` component applied a uniform `p-6` padding, but the scrollable body area (`max-h-[70vh]`) with `px-2` caused content to sit too close to the edges.

**Fix Applied:**

| Element | Before | After |
|---------|--------|-------|
| `DialogContent` | `p-6` (default) | `p-0` (manual control) |
| `DialogHeader` | No explicit padding | `px-6 pt-6 pb-4` |
| Scrollable body | `py-4 max-h-[70vh] px-2` | `py-2 max-h-[60vh] px-6` |
| `DialogFooter` | `pt-4` | `px-6 py-5` |

**Files Modified:**
- `src/components/unit-tabs/KRAsTab.tsx` — Lines 1396–1646

---

## 2. Terminology Standardization

### 2a. Field Label Renames (Modal)

| Field | Before | After |
|-------|--------|-------|
| Dropdown label | Strategic Alignment | **Strategic Goals** |
| Radio group label | Key Deliverable (Execution) | **Organizational KRAs** |

### 2b. Placeholder & Helper Text Updates (Modal)

| Location | Before | After |
|----------|--------|-------|
| Dropdown placeholder | "Align with Strategic Objective..." | "Select a Strategic Goal..." |
| No-selection option | "Standalone (No Alignment)" | "No Strategic Goal" |
| Helper text (Strategic Goals) | "Link this unit objective to a high-level Board/Strategic objective." | "Link this unit initiative to a high-level Strategic Goal." |
| Empty state (Org KRAs) | "Please select a **Strategic Alignment** above to see linked Executions/Deliverables." | "Please select a **Strategic Goal** above to see linked Organizational KRAs." |
| Error state (Org KRAs) | "No key result areas (KRAs) found for the selected objective." | "No Organizational KRAs found for the selected Strategic Goal." |
| Helper text (Org KRAs) | "Select the specific Execution/Deliverable this unit objective contributes to." | "Select the Organizational KRA this unit initiative contributes to." |

### 2c. Table Column Rename

| Table | Before | After |
|-------|--------|-------|
| Initiatives table | "Strategic Alignment" | **"Strategic Goal"** |

### 2d. "Objectives" → "Initiatives" (Global Rename)

All user-facing instances of "Objective" / "Objectives" were renamed to "Initiative" / "Initiatives" across two files.

#### KRAsTab.tsx Changes

| Location | Before | After |
|----------|--------|-------|
| Page title | KRAs / KPIs / Objectives | KRAs / KPIs / Initiatives |
| Subtitle | "manage objectives" | "manage initiatives" |
| Sub-tab label | Objectives | Initiatives |
| Add button label | Add Objective | Add Initiative |
| KRA/KPIs table column | Objective | Initiative |
| Initiatives table column | Objective Name | Initiative Name |
| Empty table message | "No Objectives defined yet..." | "No Initiatives defined yet..." |
| Modal title (Add) | Add New Objective | Add New Initiative |
| Modal title (Edit) | Edit Objective | Edit Initiative |
| Modal description (Add) | "Define a new objective for KRAs." | "Define a new initiative for KRAs." |
| Modal description (Edit) | "Update the objective details." | "Update the initiative details." |
| Save button | Save Objective | Save Initiative |
| Delete confirmation | "delete this objective" | "delete this initiative" |

#### Unit.tsx Changes

| Location | Before | After |
|----------|--------|-------|
| Main tab label | KRAs & Objectives | KRAs & Initiatives |
| Add button | Add Objective | Add Initiative |
| Success toast (save) | "Objective saved to SharePoint." | "Initiative saved to SharePoint." |
| Success toast (delete) | "Objective deleted from SharePoint." | "Initiative deleted from SharePoint." |
| Error toast (save) | "Failed to save objective" | "Failed to save initiative" |
| Error toast (delete) | "Failed to delete objective" | "Failed to delete initiative" |
| Permission denied (edit) | "Only Managers can edit Objectives." | "Only Managers can edit Initiatives." |
| Permission denied (delete) | "Only Managers can delete Objectives." | "Only Managers can delete Initiatives." |
| Error display | "Objectives Error:" | "Initiatives Error:" |

**Important Note:** Only user-facing display text was changed. All variable names, function names, prop names, data field names, and internal identifiers (e.g., `editingObjective`, `handleSaveObjective`, `objectivesData`, `parentGoalId`) remain unchanged to avoid breaking the codebase.

---

## 3. Division Page — "Open Unit Page" Button Removal

**Change:** Removed the "Open Unit Page" button from the unit drill-down modal in the Division > Units view.

**Rationale:** The button navigated to `/unit` which is the user's own unit page, not the selected unit's page, making it contextually incorrect.

**File Modified:**
- `src/components/division/tabs/DivisionUnitsTab.tsx` — Removed lines 558–568

**Before:**
```tsx
<div className="flex justify-end">
  <Button variant="outline" size="sm"
    onClick={() => { setSelectedUnit(null); navigate('/unit'); }}
    className="gap-2">
    <ExternalLink className="h-3.5 w-3.5" />
    Open Unit Page
  </Button>
</div>
```

**After:** Removed entirely. The modal now ends after the `<StaffRoster />` component.

---

## Files Modified (Complete List)

| File | Changes |
|------|---------|
| `src/components/unit-tabs/KRAsTab.tsx` | Modal padding, label renames, placeholder/helper text, Objective→Initiative terminology |
| `src/pages/Unit.tsx` | Tab label, button label, toast messages, error messages — Objective→Initiative |
| `src/components/division/tabs/DivisionUnitsTab.tsx` | Removed "Open Unit Page" button |

---

## Design Decisions

1. **Internal code identifiers preserved** — Variable and function names like `editingObjective`, `handleSaveObjective`, `objectivesData` were deliberately NOT renamed to avoid a high-risk, cascading refactor across ~50+ references in types, hooks, services, and components.

2. **Tab `value` attributes preserved** — The internal tab value `"objectives"` was kept as-is since it serves as a programmatic key, not a user-facing label. Changing it would require updates across parent/child prop chains.

3. **Modal padding architecture** — Switched from uniform `p-6` on `DialogContent` to independent padding per section (header/body/footer) for precise control. This follows a "section-owned spacing" pattern consistent with premium modal design.
