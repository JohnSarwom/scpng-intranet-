# Project Documentation Introduction
> [!NOTE]
> **Last Updated:** 2026-03-29 11:48

Welcome to the SCPNG Intranet technical documentation. This guide provides a structured entry point to the system's architecture, feature modules, and UI design patterns.

---

## 📋 Table of Contents

### 1. 🏛 [System Architecture](architecture/system-overview.md)
*Core infrastructure and global patterns.*
- **[System Overview](architecture/system-overview.md)**: Tech stack, RBAC, and Division logic.
- **[SharePoint Data Schema](architecture/sharepoint-schema.txt)**: List definitions and field hierarchies.
- **[Archive & History](architecture/archive-map.md)**: Index of historical logs and one-off fixes.

### 2. 📦 [Feature Modules](modules/)
*Deep dives into specific business units.*
- **[Task Registry Module](modules/task-registry/overview.md)**: Daily operations and workflow engine.
  - **[Unit Tabs Implementation](modules/task-registry/unit-tabs.md)**: Technical spec for `src/components/unit-tabs/`.
- **[Performance Management](modules/performance/)**: Initiatives, KRAs, and KPIs.
- **[Leave Management](modules/leave-application/)**: Leave application and approval workflows.
- **[Time and Attendance](time-attendance/00-master-toc.md)**: Attendance architecture, requirements, SharePoint storage, Power Automate workflows, and rollout plan.

### 3. 🎨 [UI & Component Library](ui/)
*Reusable design system and premium components.*
- **[Premium Kanban Board](ui/premium-kanban.md)**: Standardized task board engine.
- **[Premium Table System](ui/premium-table.md)**: Unified data table framework.
- **[Design Tokens](ui/design-tokens.md)**: Maroon-based glassmorphic styling guide.

### 4. 🛠 [Developer Guides](guides/)
*Operational manuals for the development lifecycle.*
- **[Git Workflow](guides/git-workflow.md)**: Standardized production push process.
- **[Environment Setup](guides/setup.md)**: Local development onboarding.

---

## 🔍 Navigation Tips

- **Search**: Use `Ctrl+P` (VS Code) or the repository search to find specific technical files.
- **Breadcrumbs**: Each module folder contains an `overview.md` which serves as the entry point for that specific feature.
- **History**: For "why" something was changed in the past, consult the **[Archive Map](architecture/archive-map.md)**.
