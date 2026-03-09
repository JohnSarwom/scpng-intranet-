# Key Deliverables Feature Documentation

## Overview
This document details the implementation of the "Key Deliverables" selection feature within the "Add New Objective" modal on the **Unit > KRAs & Objectives** page.

The goal of this feature is to enforce a strict link between Unit Objectives and Strategic Objectives by requiring users to select a specific **Key Deliverable** from the parent Strategic Objective.

## User Interface

### 1. Positioning
The "Key Deliverables" selection has been prioritized in the UI. It now appears at the **very top** of the "Add New Objective" modal, immediately following the "Strategic Alignment" field.

**Field Order:**
1.  **Strategic Alignment** (Dropdown): User selects the parent Strategic Objective.
2.  **Key Deliverable** (Radio Buttons): Appears dynamically based on the alignment selection.
3.  **Name**: The name of the new Unit Objective.
4.  *(Other fields follow)*

### 2. Interaction Design
- **Strategic Alignment**: A standard dropdown listing all Strategic Objectives.
- **Key Deliverable**:
    - Implemented as **Radio Buttons** to ensure clear, single-choice selection.
    - **Dynamic Population**: The options are fetched directly from the `deliverables` array of the selected Strategic Objective.
    - **Visibility**: This section is hidden until a Strategic Alignment is selected.
    - **Empty State**: If the selected Strategic Objective has no deliverables, a message "No key deliverables found for this objective" is displayed.

## Technical Implementation

### Frontend Components

#### `KRAsTab.tsx`
- **State Management**: Added `linkedDeliverable` to the `newObjectiveData` state.
- **Logic**:
    - `handleObjectiveFormChange` updates the state.
    - When `parentGoalId` (Strategic Alignment) changes, `linkedDeliverable` is reset to ensure consistency.
- **UI Logic**:
    - Used `RadioGroup` and `RadioGroupItem` capabilities from `shadcn/ui`.
    - Implemented conditional rendering to show/hide the radio group based on `parentGoalId`.

### Data Layer

#### `src/types/index.ts`
- Updated the `Objective` interface to include the optional `linkedDeliverable` property.
```typescript
export interface Objective {
  // ... existing properties
  linkedDeliverable?: string;
}
```

#### `src/services/sharePointOpsService.ts`
- **Mapping**: Updated `mapObjective` to map the SharePoint column `LinkedDeliverable` to the frontend property `linkedDeliverable`.
- **CRUD Operations**:
    - `addObjective`: Included `LinkedDeliverable` in the payload sent to SharePoint.
    - `updateObjective`: Included `LinkedDeliverable` in the update payload.

### SharePoint Integration
- **Column Requirement**: This feature relies on a Text column named `LinkedDeliverable` existing in the `Objectives` SharePoint list.
- **Data Source**: The list of available deliverables is sourced from the `keyDeliverables` (mapped to `Deliverables` column) of the *parent* Strategic Objective.
    - For more details on the data source and field mapping, see [Strategy Hub Data Source](./STRATEGY_DATA_SOURCE.md).

## Workflow Summary
1.  User opens "Add New Objective".
2.  User selects a **Strategic Alignment** (e.g., "Expand Markets").
3.  The system looks up "Expand Markets", finds its list of deliverables (e.g., "PNGX", "Market Clean Up").
4.  The system renders these deliverables as a **Radio Button Group** immediately below the dropdown.
5.  User selects one radio button (e.g., "PNGX").
6.  User fills out the rest of the form and saves.
7.  The new Objective is saved with `parentGoalId` pointing to "Expand Markets" and `linkedDeliverable` set to "PNGX".
