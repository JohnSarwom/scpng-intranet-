# Custom User Contacts Feature Guide

**Date:** 2026-03-28
**Time:** 07:59 PM (19:59:45+10:00)

## Overview
The "Custom User Contacts" feature allows users to maintain a private list of contacts within the Organization Directory. These contacts are stored in a dedicated SharePoint list and are only visible to the user who created them.

## Key Features

### 1. My Contacts Tab
A new tab has been added to the Organization Directory page specifically for managing personal contacts.

### 2. Private Storage Initialization (Admins Only)
Administrators can programmatically provision the `User_Custom_Contacts` SharePoint list using the **"Initialize Private Contacts Storage"** button. This ensures the backend infrastructure is correctly configured with the required schema.

### 3. Contact Management
Users can add, edit, and delete their own private contacts. The UI provides a glassmorphic dialog for managing contact details, including:
- Display Name
- Job Title
- Department
- Email
- Phone
- Company
- Office Location

### 4. Data Isolation & Privacy
Privacy is maintained by scoping all SharePoint queries to the user's email address using the `OwnerEmail` field. Only items matching the currently authenticated user's email are fetched and displayed in the "My Contacts" tab.

## Technical Implementation

### Services
- **`SharePointListSetupService`**: Handles the creation of the `User_Custom_Contacts` list.
- **`SharePointOpsService`**: Provides CRUD methods specifically for custom contacts.

### Hooks
- **`useSharePointCustomContacts`**: Manages the state and operations for the private contact list.
- **`useSharePointSetup`**: Triggers the list initialization process.

## Usage Scenarios
- **Initialization**: An admin clicks "Initialize Private Contacts Storage" once during system setup.
- **Personal Use**: A staff member navigates to "My Contacts" to store clients or external partners who are not part of the standard organizational directory.
