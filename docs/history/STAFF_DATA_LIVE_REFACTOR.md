# Staff Data: Live SharePoint Refactor

**Date:** 2026-03-08
**Scope:** Unit page, Division module, all staff-related hooks

---

## Problem

The Unit page (`/unit`) and Division module (`/division`) sourced staff roster data from a **hardcoded static file** (`src/utils/divisionStaffMap.ts`). This meant:

- New staff added to SharePoint would **not appear** in unit/division views until a developer manually updated the static file.
- The Profiles and Contacts pages (which use the live `Strategy_Officer_Profiles` SharePoint list via `useOfficerProfiles`) showed everyone correctly, but the Units/Division pages were always behind.
- Specific case that triggered this fix: **Donald Sinogerel Samson** (IT Unit), **Leah Samuel** (HR Unit), and **Lenome Rex MBalupa** (HR Unit) were missing from the Division module's Units tab and the Unit page's staff metrics because they were in SharePoint but not in the static file.

---

## Root Cause

Two separate, unlinked data sources existed for "staff":

| Source | Used By | Update Method |
|--------|---------|---------------|
| `Strategy_Officer_Profiles` SharePoint list | Profiles & Contacts pages via `useOfficerProfiles` | Live — edit in SharePoint |
| `src/utils/divisionStaffMap.ts` (static TS file) | Unit page, Division module, staff hooks | Manual code change + redeploy |

---

## Fix — Phase 1 (Immediate): Static Map Patch

Added three missing entries to `divisionStaffMap.ts` under `corporate-services-division`:
- `id: "52"` — Donald Sinogerel Samson, IT Hardware Officer, IT Unit
- `id: "53"` — Leah Samuel, Divisional Secretary, Human Resource Unit
- `id: "54"` — Lenome Rex MBalupa, Administrative Driver, Human Resource Unit

---

## Fix — Phase 2 (Architectural): Live Data Refactor

Replaced `DivisionStaffMap` as the **primary** data source with `useOfficerProfiles` across all consumers. `DivisionStaffMap` is kept as a **graceful fallback** only (for when SharePoint is unavailable).

### Data Flow (After)

```
Strategy_Officer_Profiles (SharePoint)
         │
         ▼
  useOfficerProfiles (React Query, 5-min cache)
         │
         ├──▶ useStaffByDepartment  → staffMembers → TasksTab / ProjectsTab / KRAsTab
         │
         ├──▶ useDivisionData.staff → DivisionUnitsTab (staff cards, View Profile)
         │
         ├──▶ useDivisionData.division.unitNames → DivisionHeader staff count
         │
         ├──▶ Unit.tsx derivedUnits → unit selector / KRAsTab units prop
         │
         ├──▶ StaffMetricsTab (fallback tier before static map)
         │
         └──▶ useDivisionStaff → general staff hook
                    │
                    └──▶ DivisionStaffMap (fallback only)
```

### Files Changed

| File | Change |
|------|--------|
| `src/hooks/useStaffByDepartment.ts` | Full rewrite — `useOfficerProfiles` primary, maps to `StaffMember` type, static map fallback |
| `src/hooks/useDivisionData.ts` | Added `useOfficerProfiles`; both `division` memo and `staff` memo now prefer live profiles |
| `src/pages/Unit.tsx` | `derivedUnits` useMemo now reads `officerProfiles`, falls back to static map |
| `src/components/unit-tabs/StaffMetricsTab.tsx` | Added live-profile tier before the existing `DivisionStaffMap` fallback |
| `src/hooks/useDivisionStaff.ts` | Rewritten to use `useOfficerProfiles`, static map fallback |

### Field Mapping: OfficerProfile → StaffMember

| OfficerProfile field | StaffMember field | Notes |
|----------------------|-------------------|-------|
| `name` | `name` | Direct |
| `email` | `email` | Direct |
| `jobTitle` | `jobTitle` | Direct |
| `unit` | `department` | Consumers call the unit field "department" |
| `division` | `officeLocation` / `divisionId` | Division name → location; slugified → id |
| `phone` | `mobile` | Nullable |
| `officeExtension` | `businessPhone` | Nullable |

---

## Fallback Behaviour

If `Strategy_Officer_Profiles` is unavailable (network error, list not yet created in a new environment), every consumer automatically falls back to `divisionStaffMap.ts`. No blank pages or crashes.

---

## Going Forward

**You no longer need to update `divisionStaffMap.ts` when staff changes.**
Add/update people in the `Strategy_Officer_Profiles` SharePoint list — all pages (Profiles, Contacts, Unit, Division) will reflect the change within 5 minutes (React Query cache TTL).

The static file (`divisionStaffMap.ts`) can eventually be deleted once all environments confirm the SharePoint list is fully populated and stable.
