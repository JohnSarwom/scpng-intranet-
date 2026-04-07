# SCPNG Intranet Documentation
> [!NOTE]
> **Last Updated:** 2026-03-29 11:53

Welcome to the SCPNG Intranet documentation repository. This documentation is organized hierarchically to match the application's application architecture and feature sets.

## 🗺 Documentation Map

### 🏛 [Architecture](architecture/system-overview.md)
The source of truth for the application's core systems, tech stack, and data flow.
- **[System Overview](architecture/system-overview.md)**: Core tech stack and RBAC logic.
- **[SharePoint Schema](architecture/sharepoint-schema.txt)**: List definitions and field mappings.
- **[Archive Map](architecture/archive-map.md)**: Index of historical implementation logs and fixes.

### 📦 [Modules](modules/)
Feature-specific documentation and business logic.
- **[Admin Dashboard](modules/admin-dashboard.md)**: User, role, and permission management.
- **[Task Registry](modules/task-registry/overview.md)**: Managing daily tasks and operational workflows.
  - **[Unit Tabs & Kanban](modules/task-registry/unit-tabs.md)**: Deep dive into the `unit-tabs` component layer.
- **[Performance](modules/performance/)**: KRAs, KPIs, and Initiatives.
- **[Leave Application](modules/leave-application/)**: Employee leave management system.
- **[Meeting Minutes](modules/meeting-minutes/overview.md)**: In-browser meeting minutes generator with Word and PDF export.
  - **[Template Structure](modules/meeting-minutes/template-structure.md)**: Placeholder map and loop syntax for the Word template.
  - **[Word Export Logic](modules/meeting-minutes/word-export-logic.md)**: docxtemplater service architecture and payload mapping.
  - **[HTML Preview](modules/meeting-minutes/html-preview.md)**: Live preview component design and PDF export notes.
  - **[Errors & Fixes](modules/meeting-minutes/errors-and-fixes.md)**: Full error log with root causes and resolutions.
  - **[History](modules/meeting-minutes/history.md)**: Chronological development timeline.

### 🎨 [UI Library](ui/)
Documentation for global, reusable premium components.
- **[Premium Kanban](ui/premium-kanban.md)**: The standardized Kanban engine (Board, Column, Card).
- **[Premium Table](ui/premium-table.md)**: The standardized data table system.

### 🛠 [Guides](guides/)
Developer onboarding and operations manuals.
- **[Git Workflow](guides/git-workflow.md)**: Standardized process for pushing to production.
- **[Setup & Deployment](guides/setup.md)**: Local development and CI/CD.

## ✍️ Documentation Rules

1.  **Truth First**: Always update `architecture/system-overview.md` when core patterns change.
2.  **Modular Docs**: New features must have an `overview.md` in a corresponding `modules/` subdirectory.
3.  **Archiving**: Historical logs should be placed in `history/` and indexed in the `Archive Map`.