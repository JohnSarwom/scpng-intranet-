# SCPNG Intranet Documentation

Welcome to the SCPNG Intranet documentation repository. To ensure efficient communication with AI assistants and clear onboarding for developers, we use a **Hub-and-Spoke** documentation model.

## 🗺 Where to Start?

1.  **[ARCHITECTURE.md](ARCHITECTURE.md) (The Hub)**: Read this first. It contains the "Current Source of Truth" for the entire application, including the Tech Stack, Auth/RBAC logic, and Division filtering.
2.  **[ARCHIVE_MAP.md](ARCHIVE_MAP.md)**: If you are looking for context on a specific past bug fix, feature implementation, or historical "log," this map will point you to the correct file in the `history/` folder.

## 📂 Folder Structure

-   `guides/`: Persistent, in-depth technical manuals for core systems (Auth, SharePoint, etc.).
-   `history/`: Archive of 100+ implementation logs and one-off fixes. **Do not read these for current architectural truth.**
-   `database/`: SQL migration scripts and schema definitions.
-   `features/`: Feature-specific documentation and design notes.

## ✍️ Documentation Rules

-   **Updates**: When completing a major feature or fix, update `ARCHITECTURE.md` or a relevant file in `guides/`.
-   **Archival**: One-off implementation logs and specific bug-fix notes should be placed in `history/` and indexed in `ARCHIVE_MAP.md`.