# SharePoint Projects List Setup Guide

## Overview
This document details the setup, schema, and management of the `Operations_Projects` list, which powers the Project Management module.

## List Schema
**List Name**: `Operations_Projects`

### Columns

| Display Name | Internal Name | Type | Notes |
| :--- | :--- | :--- | :--- |
| **Title** | `Title` | Text | Project Name |
| **Manager** | `Manager` | Text | Stores Manager Name (e.g., "John Doe"). Setup as `Text` to avoid Person field complexity in mock data. |
| **Assignees** | `Assignees` | Note (Text) | Stores JSON array of assignee objects `[{id, name, email, initials}]`. |
| **Department** | `Department` | Text | Unit ID/Name |
| **Description** | `Description` | Note | Project Description |
| **Status** | `Status` | Choice | Planned, In Progress, Completed, On Hold |
| **StartDate** | `StartDate` | DateTime | |
| **EndDate** | `EndDate` | DateTime | |
| **Budget** | `Budget` | Currency | |
| **BudgetSpent** | `BudgetSpent` | Currency | |
| **Progress** | `Progress` | Number | 0-100 |
| **RisksJSON** | `RisksJSON` | Note | Stores JSON array of risks. |
| **RelatedKRA** | `RelatedKRA` | Lookup | Links to `Performance_KRAs` list. |

## Data Seeding & Reset

### Reset Logic
We have implemented a robust reset mechanism to handle the `Operations_Projects` list independently of other lists.

- **Method**: `recreateProjectsListOnly()` in `SharePointListSetupService`.
- **Logic**:
    1. Checks for `Performance_KRAs` (required dependency).
    2. Deletes existing `Operations_Projects` list if present.
    3. Recreates `Operations_Projects` with the schema above.
    4. Re-adds the `RelatedKRA` lookup column.

### Mock Data
Mock data is seeded from `src/mockData/projects.ts` using `seedProjectsData()`.
- **Manager**: Randomly selected from `mockResourcingData`.
- **Assignees**: Randomly selected subset of staff.

## Troubleshooting

### "Operations_Projects list not found" on Reset
**Cause**: The previous `createOperationsLists` method failed if *any* list existed (e.g., KRAs), aborting before reaching Projects.
**Fix**: Use the dedicated **"Reset & Seed Projects List"** button in **Test Ground**, which uses `recreateProjectsListOnly` to target just this list.
