# Performance Reports Feature

## Overview
The Performance Reports feature allows users to generate, schedule, and view performance reports for the Unit based on KRAs, KPIs, Projects, Tasks, and Risks. It provides a way to snapshot the current state of operations and store it for historical reference.

## Architecture

This feature is built using:
- **Frontend**: A `ReportsTab` component within the Unit page that handles the UI for generating and viewing reports.
- **Backend Service**: `SharePointOpsService` handles all data fetching and saving operations to SharePoint.
- **Storage**: Reports are stored as items in a dedicated SharePoint List named `Performance_Reports`.

### Data Flow
1.  **Generation**: The user selects a template and date range in the UI.
2.  **Fetching**: The app fetches current data (Tasks, Projects, KRAs, Risks) from their respective SharePoint lists via `SharePointOpsService`.
3.  **Processing**: The app filters this data and calculates metrics (e.g., completion rates).
4.  **Serialization**: The report structure is serialized into a JSON object.
5.  **Storage**: The JSON object and metadata are saved to the `Performance_Reports` list.
6.  **Retrieval**: When viewing history, the app fetches the list items and deserializes the JSON content to render the report.

## SharePoint Configuration

The system uses a SharePoint List named **Performance_Reports**.

### List Schema
| Internal Name | Type | Description |
| :--- | :--- | :--- |
| `Title` | Single Line of Text | The name of the report. |
| `ReportType` | Single Line of Text | The template ID (e.g., `kpi-summary`, `project-status`). |
| `GeneratedBy` | Single Line of Text | Email of the user who generated the report. |
| `StartDate` | Date and Time | Start of the reporting period. |
| `EndDate` | Date and Time | End of the reporting period. |
| `ContentJSON` | Multiple Lines of Text | **Crucial**: Stores the entire report data structure (sections, metrics, tables) as a JSON string. |
| `AIAnalysis` | Yes/No | Whether AI analysis was included. |
| `Status` | Choice | Status of the report generation (e.g., 'Generated'). |

> **Note**: The `ContentJSON` column is the most critical part as it allows for flexible report structures without needing complex relational database schemas.

## Key Components

### 1. ReportsTab (`src/components/unit-tabs/ReportsTab.tsx`)
The main interface. It contains tabs for:
- **Generate**: Configuring and creating new reports.
- **History**: Viewing a list of past reports.
- **Weekly Review**: Specific workflow for weekly updates (separate module).
- **Scheduled**: Managing automated reports (UI implemented, backend pending).

### 2. ReportViewerModal (`src/components/reports/ReportViewerModal.tsx`)
A modal component that takes a `Report` object and renders it. It supports multiple section types:
- **Metrics**: Grids of key performace indicators (e.g., "85% Task Completion").
- **Tables**: Lists of items like Projects or Risks with status badges.
- **AI Insights**: A dedicated section for AI-generated text (trends, predictions).

### 3. SharePointOpsService (`src/services/sharePointOpsService.ts`)
Extended to include:
- `createReportsList()`: Ensures the SharePoint list exists.
- `saveReport(report: Report)`: Saves a new report.
- `getReports(limit)`: Fetches recent reports, sorted by creation date.
- `mapReport(item)`: Maps SharePoint list items to the application's `Report` type, safely parsing the `ContentJSON`.

## Data Model (TypeScript)

The `Report` interface (`src/types/reports.ts`) is the core data structure:

```typescript
export interface Report {
  id: string;
  name: string;
  template_id: string;
  created_by: string;
  created_at: string;
  date_range: {
    start_date?: string;
    end_date?: string;
  };
  content: {
    sections: ReportSectionContent[];
    metadata: {
      generated_at: string;
      version: string;
      ai_generated?: boolean;
    };
  };
  ai_analysis?: boolean;
  ai_insights?: {
    trends: string[];
    risks: string[];
    recommendations: string[];
    predictions: string[];
  };
}
```

## Usage Guide

### Generating a Report
1.  Navigate to the **Reports** tab.
2.  Select a **Template** (e.g., "Unit Performance Report").
3.  Enter a **Report Name** and select a **Date Range**.
4.  (Optional) Enable **AI Analysis**.
5.  Click **Generate Report**.
6.  Once successful, the report is saved to SharePoint.

### Viewing a Report
1.  Go to the **History** tab within Reports.
2.  Click **Refresh** to see the latest reports.
3.  Click **View** on any report line item.
4.  The report details will open in a modal dialogue.
