# Seed Users Feature

**Date:** 2026-03-22 (Saturday)
**File:** `src/components/admin/UserManagement.tsx`

## Overview

Added a "Seed Users" button to the Admin Dashboard > Users tab that bulk-creates all SCPNG staff accounts in a single click. Each user is added as `staff_member` role with `IT Group` membership, placed in their correct division and unit.

## How It Works

1. Click the **Seed Users** button (next to Add User)
2. A confirmation dialog shows how many users will be added and how many already exist (skipped)
3. Users are created one-by-one with a live progress counter (e.g., "12/29")
4. Existing users (matched by email, case-insensitive) are automatically skipped
5. A toast notification reports the final result

## User List (32 users)

| Name | Email | Division | Unit |
|------|-------|----------|------|
| Andy Ambulu | aambulu@scpng.gov.pg | Executive Division | Secretariat Unit |
| Anita Kosnga | akosnga@scpng.gov.pg | Corporate Services Division | Finance Unit |
| Donald Sinogerel Samson | dsamson@scpng.gov.pg | Corporate Services Division | IT Unit |
| Esther Alia | ealia@scpng.gov.pg | Licensing Market & Supervision Division | Market Data Unit |
| Eric Kipongi | ekipongi@scpng.gov.pg | Corporate Services Division | IT Unit |
| Enly Yakop | eyakop@scpng.gov.pg | Licensing Market & Supervision Division | Investigations Unit |
| Harold Mek Kape | hkape@scpng.gov.pg | Licensing Market & Supervision Division | Supervision Unit |
| Isaac Mel | imel@scpng.gov.pg | Legal Services Division | Legal Advisory Unit |
| Immanuel Minoga | iminoga@scpng.gov.pg | Legal Services Division | Legal Advisory Unit |
| James Joshua | jjoshua@scpng.gov.pg | Executive Division | Executive Unit |
| Jacob Kom | jkom@scpng.gov.pg | Licensing Market & Supervision Division | Investigations Unit |
| Joy Komba | jkomba@scpng.gov.pg | Research & Publication Division | Research Unit |
| John Sarwom | jsarwom@scpng.gov.pg | Corporate Services Division | IT Unit |
| Kylie Karis | kkaris@scpng.gov.pg | Licensing Market & Supervision Division | Licensing Unit |
| Lovelyn Karlyo | lkarlyo@scpng.gov.pg | Corporate Services Division | Human Resources Unit |
| Laviniah Michael | lmichael@scpng.gov.pg | Corporate Services Division | Finance Unit |
| Lenome Rex MBalupa | lrmbalupa@scpng.gov.pg | Corporate Services Division | Human Resources Unit |
| Leah Samuel | lsamuel@scpng.gov.pg | Corporate Services Division | Human Resources Unit |
| Leeroy Wambillie | lwambillie@scpng.gov.pg | Licensing Market & Supervision Division | Licensing Unit |
| Monica Abau-Sapulai | msapulai@scpng.gov.pg | Corporate Services Division | IT Unit |
| Max Siwi | msiwi@scpng.gov.pg | Research & Publication Division | Research Unit |
| Mark Timea | mtimea@scpng.gov.pg | Corporate Services Division | Human Resources Unit |
| Mercy Tipitap | mtipitap@scpng.gov.pg | Corporate Services Division | Finance Unit |
| Ninipe Gurumo | ngurumo@scpng.gov.pg | Executive Division | Secretariat Unit |
| Rosie Stevenou | rstevenou@scpng.gov.pg | Research & Publication Division | Media & Publication Unit |
| Regina Wai | rwai@scpng.gov.pg | Licensing Market & Supervision Division | Supervision Unit |
| Sophia Marai | smarai@scpng.gov.pg | Corporate Services Division | Human Resources Unit |
| Sam Taki | staki@scpng.gov.pg | Corporate Services Division | Finance Unit |
| Tony Kawas | tkawas@scpng.gov.pg | Legal Services Division | Legal Advisory Unit |
| Thomas Mondaya | tmondaya@scpng.gov.pg | Corporate Services Division | Human Resources Unit |
| Tyson Yapao | tyapao@scpng.gov.pg | Legal Services Division | Legal Advisory Unit |
| Zomay Apini | zapini@scpng.gov.pg | Licensing Market & Supervision Division | Market Data Unit |

## Default Values for All Seeded Users

- **Role:** `staff_member`
- **Groups:** `['IT Group']`

## Technical Details

- Seed data is defined as a `seedUsers` constant array in `UserManagement.tsx`
- Uses the existing `onAddUser` callback for each user (same as manual Add User)
- Duplicate detection via case-insensitive email comparison against existing `users` prop
- Progress state tracked with `isSeeding` and `seedProgress` (current/total)
- Button uses the `DatabaseZap` icon from lucide-react
