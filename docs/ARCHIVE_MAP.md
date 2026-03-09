# Documentation Archive Map

This document indexes the 100+ historical documentation files moved to `docs/history/`. These files contain valuable context on specific bug fixes and feature implementations but are archived to keep the primary `ARCHITECTURE.md` clean.

---

## 🔐 Auth & Access Control (RBAC)
- [division-based-access.md](history/division-based-access.md)
- [role-based-authentication-system.md](history/role-based-authentication-system.md)
- [rbac-quick-start-guide.md](history/rbac-quick-start-guide.md)
- [rbac-troubleshooting-cheat-sheet.md](history/rbac-troubleshooting-cheat-sheet.md)
- [KRA_KPI_RBAC_IMPLEMENTATION.md](history/KRA_KPI_RBAC_IMPLEMENTATION.md)

---

## 📊 Strategy & Performance Management
- [STAFF_DATA_LIVE_REFACTOR.md](history/STAFF_DATA_LIVE_REFACTOR.md) ⭐ New (2026-03-08) — `useOfficerProfiles` replaces `DivisionStaffMap` as primary staff source across Unit & Division pages
- [DIVISION_UNITS_OFFICER_VIEWS.md](history/DIVISION_UNITS_OFFICER_VIEWS.md) — 3 view modes added to DivisionUnitsTab (2026-03-06)
- [DIVISION_MODULE_IMPLEMENTATION.md](history/DIVISION_MODULE_IMPLEMENTATION.md)
- [STRATEGY_HIERARCHY_ARCHITECTURE.md](history/STRATEGY_HIERARCHY_ARCHITECTURE.md)
- [STRATEGY_DATA_SOURCE.md](history/STRATEGY_DATA_SOURCE.md)
- [KPI_TASK_SYNC_ARCHITECTURE.md](history/KPI_TASK_SYNC_ARCHITECTURE.md)
- [UNIT_OBJECTIVES_SEPARATION.md](history/UNIT_OBJECTIVES_SEPARATION.md)
- [KRA_KPI_TASK_LINKING_AND_PROGRESS.md](history/KRA_KPI_TASK_LINKING_AND_PROGRESS.md)
- [HYBRID_KPI_FEATURE.md](history/HYBRID_KPI_FEATURE.md)

---

## ☁️ SharePoint Integration
- [APPS_SHAREPOINT_SCHEMA.txt](history/APPS_SHAREPOINT_SCHEMA.txt)
- [APPS_SHAREPOINT_SETUP.md](history/APPS_SHAREPOINT_SETUP.md)
- [SHAREPOINT_API_TROUBLESHOOTING.md](history/SHAREPOINT_API_TROUBLESHOOTING.md)
- [POWER_AUTOMATE_SETUP.md](history/POWER_AUTOMATE_SETUP.md)
- [assets_sharepoint_migration_plan.md](history/assets_sharepoint_migration_plan.md)

---

## 📅 Calendar & Events
- [CALENDAR_INTEGRATION_GUIDE.md](history/CALENDAR_INTEGRATION_GUIDE.md)
- [CALENDAR_TIMEZONE_FIX.md](history/CALENDAR_TIMEZONE_FIX.md)
- [CALENDAR_MULTI_DAY_EVENT_FIX.md](history/CALENDAR_MULTI_DAY_EVENT_FIX.md)

---

## 📈 Market Data & News
- [MARKET_DATA_ARCHITECTURE.md](history/MARKET_DATA_ARCHITECTURE.md)
- [MARKET_NEWS_IMPLEMENTATION_COMPLETE.md](history/MARKET_NEWS_IMPLEMENTATION_COMPLETE.md)
- [INTERNAL_NEWS_SLIDESHOW.md](history/INTERNAL_NEWS_SLIDESHOW.md)

---

## 🤖 AI Hub
- [AI_HUB_ELITE_LEGAL_ANALYSIS_FRAMEWORK.md](history/AI_HUB_ELITE_LEGAL_ANALYSIS_FRAMEWORK.md)
- [AI_HUB_FEATURES.md](history/AI_HUB_FEATURES.md)
- [STRATEGIC_AI_ROADMAP.md](history/STRATEGIC_AI_ROADMAP.md)

---

## 🗂 Asset Management
- [ASSET_MANAGEMENT_AUDIT_REFACTOR.md](history/ASSET_MANAGEMENT_AUDIT_REFACTOR.md) ⭐ New (2026-03-09) — Full audit of `AssetManagementNew.tsx`; 10 bugs/quality issues fixed across two passes (debounce, unified modal state, typed sort column, shared condition constants, staff load unblocked, retry button, filter badge bug)

---

## 🛠 Fixes & UI Improvements
- [UI_BORDER_REFINEMENTS.md](history/UI_BORDER_REFINEMENTS.md)
- [KANBAN_SCROLLING_IMPLEMENTATION.md](history/KANBAN_SCROLLING_IMPLEMENTATION.md)
- [OPTIMISTIC_UI_PATTERN.md](history/OPTIMISTIC_UI_PATTERN.md)
- [SKELETON_LOADERS_IMPLEMENTATION.md](history/SKELETON_LOADERS_IMPLEMENTATION.md)
- [GIT_RESET_AND_PUSH_GUIDE.md](history/GIT_RESET_AND_PUSH_GUIDE.md)

---

> [!NOTE]
> Search for specific files using `grep_search` or `find_by_name` within the `docs/history/` directory if you need to deep-dive into a past implementation.
