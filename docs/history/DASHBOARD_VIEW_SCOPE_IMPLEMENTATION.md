# **View Scope Dropdown for Overview Dashboard - Implementation Summary**

## **📋 Original Request**
Extend the "View Scope" dropdown functionality from the Unit page's Insights sub-tab to the **Overview Dashboard**, allowing managers/admins to filter performance data across organizational levels.

**Required Scope Levels:**
- **Individual** - Logged-in user or selected staff member
- **Unit** - Aggregated data for all staff in the unit
- **Division** - Aggregated data across all units in a division

**Role-Based Access:**
- **Staff** → Individual only
- **Unit Managers** → Individual + Unit
- **Division Managers / Admins** → Individual + Unit + Division

---

## **🔍 What Was Discovered During Code Exploration**

### **Project Structure**
- React + TypeScript + Vite app with SharePoint integration
- Key directories: `src/components`, `src/hooks`, `src/pages`, `src/services`, `src/types`
- Authentication via Azure MSAL, data from SharePoint lists

### **Existing Components**
- **Unit page** (`src/pages/Unit.tsx`) - Contains tab structure with Insights sub-tab
- **KRAInsightsTab** (`src/components/KRAInsightsTab.tsx`) - Original View Scope dropdown implementation
- **Overview Dashboard** (`src/components/unit-tabs/OverviewTab.tsx`) - Target component for the feature

### **Data Structure**
- **Organizational hierarchy** - Defined in Strategy page, stored in SharePoint
- **User roles** - `staff_member`, `manager`, `admin`, `super_admin` (from SharePoint UserRoles list)
- **Tasks & KRAs** - Fetched via `useSharePointOps` hooks with role-based filtering

---

## **🚀 What Was Implemented**

### **Phase 1: Core View Scope Functionality**

#### **1. Added View Scope Dropdown to OverviewTab.tsx**
The dashboard now includes a "View Scope" selectable dropdown that triggers a re-calculation of all metrics based on the selected scope. The options are dynamically shown based on the user's role.

#### **2. Data Filtering Logic**
Created scope-based filters for tasks, KRAs, and objectives:
- **Individual Scope:** Matches by user email across creator, owner, and assignee fields.
- **Unit Scope:** Uses a live unit staff roster (emails) to filter for any work involving unit members.
- **Division Scope:** returns all data for the division (unfiltered).

---

### **Phase 2: Unit Staff Performance Section**

Added a **"Unit Staff Performance"** section that appears when the "Unit" scope is selected. This provides a leaderboard-style view of all unit members.

**Performance Score Formula:**
```
Score = (Task completion % × 40%) + (KPI health % × 40%) + (KRA health % × 20%)
```

**Level Thresholds:**
- 80-100% → Green (Excellent)
- 60-79% → Blue (Good)
- 40-59% → Amber (Fair)
- 0-39% → Red (Needs Attention)

---

### **Phase 3: Dynamic Staff Roster (Live SharePoint Data)**

Implemented a roster-first approach to ensure data accuracy and ease of maintenance.

#### **Solution: `useUnitRoster` Hook**
Created a new hook (`src/hooks/useUnitRoster.ts`) that fetches live data from the SharePoint **UserRoles** list. 
- **Dynamic Updates:** Automatically reflects additions or removals made in the Admin console.
- **Graceful Degradation:** Falls back to the static `DivisionStaffMap.ts` if SharePoint is unavailable.
- **Performance:** Uses `useQuery` for efficient caching and background updates.

---

## **🐛 Bugs Fixed During Implementation**

1.  **Task Type Mismatch:** Updated `StatusType` in `types/index.ts` to include `'done'` and other legacy status strings returned by SharePoint.
2.  **Manager Task Filtering:** Corrected the `useSharePointTasks` hook to allow managers to see all departmental tasks instead of just their own.
3.  **KRA Unit Field Missing:** Switched to email-based filtering for KRAs since the `unit` field was inconsistent in the backend.
4.  **Staff Discovery:** The "Roster-First" approach ensures all employees appear on the dashboard, even if they haven't been assigned any tasks yet.

---

## **📁 Key Files Modified**

- `src/components/unit-tabs/OverviewTab.tsx`: Core dashboard and performance logic.
- `src/hooks/useSharePointOps.ts`: Updated data fetching with manager-level visibility.
- `src/hooks/useUnitRoster.ts`: **New** hook for live synchronization.
- `src/pages/Unit.tsx`: State orchestration and data passing.
- `src/types/index.ts`: Type definition refinements.

---

## **✅ Final Behavior**

The Overview Dashboard now respects role-based permissions, allowing users to see exactly what they need based on their corporate level. Managers have high-velocity visibility into their entire team's performance, and the data is always in sync with the live SharePoint roster.
