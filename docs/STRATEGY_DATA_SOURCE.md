# Strategy Hub Data Source Documentation

## Overview
This document details the source of truth for the **Enterprise Strategy Hub** data, specifically for **Strategic Objectives** and their **Key Deliverables**.

It describes where the data lives in the codebase, how it maps to SharePoint, and how to update it.

## Source of Truth
The master data for the Strategy Hub is located in the local codebase:

- **File Path:** [`src/mockData/strategyData.ts`](../src/mockData/strategyData.ts)
- **Object:** `mockStrategyData.objectives`

This file contains the hardcoded list of Strategic Objectives, including their Titles, Descriptions, Progress, Status, and **Deliverables**.

### Data Structure Example
```typescript
{
    id: "obj-1",
    title: "Expand Markets & Connectivity",
    description: "Enhance PNGX Infrastructure...",
    progress: 45,
    icon: "TrendingUp",
    status: "on-track",
    deliverables: [
        "PNGX Systems: Implement ongoing Trading...",
        "Market Clean Up: Acquire PNG Registries Ltd...",
        "Broker Expansion: Amend Business Rules..."
    ]
}
```

## SharePoint Provisioning
The data is pushed to SharePoint via the **Test Ground** page using the **Deploy Strategy Engine** feature.

- **Service File:** [`src/services/sharePointListSetupService.ts`](../src/services/sharePointListSetupService.ts)
- **Function:** `setupStrategyHubEngine()` -> `seedStrategyHubObjectives()`

### Field Mapping
When deploying the engine, the code maps the typescript object to SharePoint columns as follows:

| SharePoint Column | Source Field (`strategyData.ts`) | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| **Title** | `title` | Text | Primary Identifier |
| **Description** | `description` | Note | |
| **Progress** | `progress` | Number | 0-100 |
| **Icon** | `icon` | Text | Lucid React Icon Name |
| **Status** | `status` | Choice | 'at-risk' maps to 'Needs Attention' |
| **Deliverables** | `deliverables` | Note (Multi-line) | **Joined by comma** into a single string |
| **IsFeatured** | `isFeatured` | Boolean | True/False |

## How to Update Data
To update the Strategic Objectives or Deliverables in the application:

1.  **Edit the Code:**
    *   Open `src/mockData/strategyData.ts`.
    *   Modify the `objectives` array (change descriptions, add/remove deliverables, update progress).
    *   Save the file.

2.  **Deploy Changes:**
    *   Navigate to the **Test Ground** page in the application.
    *   Locate the **Enterprise Strategy Hub Backend Setup** card.
    *   Click **Deploy Objectives Only** (if available) or **Deploy Strategy Engine** (Full Reset).
    *   *Note: A Full Reset will delete existing lists and recreate them, ensuring all data matches the code.*

## Key Deliverables Feature
The **Key Deliverables** feature in the "Add New Objective" modal consumes this data.
*   The `Deliverables` text column in SharePoint (e.g., "Item 1, Item 2") is parsed back into an array by the frontend.
*   This array populates the Radio Button selection for user alignment.
