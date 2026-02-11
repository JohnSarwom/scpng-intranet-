# Chart.js Migration and Dashboard Overhaul

**Date:** February 7, 2026
**Summary:** This document outlines the major updates made to the Unit Dashboard, specifically the migration from Recharts to Chart.js, the introduction of new visualization components, and significant layout reordering for better data readability.

## 1. Migration to Chart.js

We have fully migrated the dashboard charting library from **Recharts** to **Chart.js**. This provides a more consistent, responsive, and performance-optimized charting experience across the application.

### Dependencies
- **Added**: `chart.js`, `react-chartjs-2`
- **Removed**: `recharts` usage in dashboard components.

## 2. New Dashboard Components

Several reusable components were created to modularize the dashboard logic. These are located in `src/components/dashboard/`.

### A. Charts
1.  **`TaskCompletionDonut.tsx`**
    *   **Type**: Doughnut Chart.
    *   **Purpose**: Replaces the custom SVG donut. Shows the breakdown of tasks by status (Todo, In Progress, Review, Done).
    *   **Features**: Centered text showing completion percentage.

2.  **`TaskTrendsLine.tsx`**
    *   **Type**: Line Chart.
    *   **Purpose**: Visualizes task completion vs. new tasks added over time (monthly).

3.  **`KPIPerformanceBar.tsx`**
    *   **Type**: Vertical Bar Chart.
    *   **Purpose**: Displays the count of KPIs in different statuses (On Track, Completed, At Risk, Behind).

4.  **`KRAStatusChart.tsx`**
    *   **Type**: Doughnut Chart.
    *   **Purpose**: Shows the distribution of Key Result Areas (KRAs) by health status.

5.  **`ObjectivesProgressChart.tsx`**
    *   **Type**: Horizontal Bar Chart.
    *   **Purpose**: Lists the top objectives and their completion percentage.

### B. Structural Components
1.  **`TaskGroupList.tsx`**
    *   **Purpose**: Displays specific task buckets (e.g., "Urgent Tasks", "Licensing", "Team A") as a vertical list of horizontal cards.
    *   **Usage**: Replaces the previous bar chart in the top-right quadrant of the dashboard.

2.  **`TrafficLightCard.tsx`**
    *   **Purpose**: A reusable component for "Performance Pulse" style metrics (Score, Trend, Status).
    *   **Location**: Added to the **UI Library** (`src/pages/UILibrary.tsx`) in the Cards section.

## 3. Overview Tab Layout Changes

The `OverviewTab.tsx` layout was significantly restructured to accommodate more data and improve flow.

### Final Layout Structure
*   **Row 1 (Stats Cards)**: 4 cards showing high-level counts:
    *   Tasks/Daily Operations
    *   KPIs
    *   KRA Progress
    *   **Objectives Summary** (New Card)
*   **Row 2 (Task Execution)**:
    *   **Left**: Task Completion Donut.
    *   **Right**: Task Groups List (Custom buckets).
*   **Row 3 (History)**: Task Trends Line Chart (Full Width).
*   **Row 4 (Performance)**: KPI Performance Bar Chart (Full Width).
*   **Row 5 (Strategy)**:
    *   **Left**: KRA Status Distribution.
    *   **Right**: Top Objectives Progress.

### Removals
*   **Performance Pulse Cards**: The "Strategic Alignment", "Operational Health", and "Projects" cards were removed from the main dashboard to reduce clutter. The component logic was preserved in the UI Library.

## 4. Future Reference

*   **Custom Groups**: Task groups are dynamically derived from Projects marked as `isCustomGroup`.
*   **Data Flow**: Data is passed down from `Unit.tsx` -> `OverviewTab.tsx` -> Individual Chart Components.
*   **Theming**: All charts use the application's Tailwind color palette (slate, amber, emerald, blue, red) via hex codes matching `tailwindcss` tokens.

## 5. UI Polish & Enhancements (Feb 7, 2026)

### A. Standardized Tab Headers
*   **Goal**: Ensure visual consistency across all Unit Tabs (Overview, Projects, Tasks, Reports, KRAs).
*   **Implementation**: Applied a standard pattern of **Title (H2)** + **Subtitle (muted text)** to all tabs.
*   **Overview Tab**: Wrapped the entire content (Header + Widgets) in a bordered container (`border-gray-200 rounded-lg p-6`) to match the visual "card" style of other tabs.

### B. Chart Polish
1.  **Interactive Donut Chart (`TaskCompletionDonut`)**:
    *   **Legend**: Clicking a legend item toggles segment visibility. Hidden items are now visually dimmed (low opacity, grayscale) and strikethrough.
    *   **Dynamic Statistics**: The center text ("X% Completed") dynamically recalculates based on the *currently visible* segments. For example, hiding "To Do" items will recalculate the completion percentage based on the remaining visible tasks.
    
2.  **Rounded Bars**:
    *   Updated `KPIPerformanceBar` and `ObjectivesProgressChart` datasets to include `borderSkipped: false` and `borderRadius: 4`. This ensures bars are fully rounded (pill shape) rather than just rounded on top, providing a softer, more modern aesthetic.

3.  **Visual Fixes**:
    *   Resolved z-index issues where Donut Chart center text overlapped with tooltips by implementing a custom Chart.js plugin to draw text directly on the canvas *before* tooltips are rendered.

