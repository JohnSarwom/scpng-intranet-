# Regulatory Intelligence & Reporting Module

## Overview

The **Regulatory Intelligence & Reporting** module is a comprehensive case management system designed for monitoring, tracking, and managing regulatory compliance issues, investigations, scams, whistleblower reports, enquiries, and compliance-related cases for SCPNG.

**Version:** 1.0  
**Route:** `/regulatory-intelligence`  
**Permissions Required:** `regulatory:read`

---

## Features

### 1. Dashboard Overview
- **KPI Bar**: Real-time statistics showing Total Reports, Open Cases, High Risk cases, and Critical Alerts
- **Tabbed Navigation**: Organized views for Overview, Scams, Whistleblower, Compliance, Enquiries, and Investigations
- **Interactive Charts**: Visual analytics for risk distribution, case type breakdown, and volume trends

### 2. Case Management Table
- **Comprehensive Case Display**: Shows Case ID, Type, Category, Risk Level, Status, Assigned Unit, and Date
- **Color-Coded Status & Risk**: Visual indicators for quick assessment
- **Secure Case Labels**: Special markers for whistleblower cases
- **Row Click Interaction**: Click anywhere on a row to view full details
- **Action Menu**: 3-dot dropdown for View, Edit, and Delete operations

### 3. Analytics & Visualizations
Built with Recharts library, providing:
- **Risk Distribution (Donut Chart)**: Breakdown of cases by risk level (Low, Medium, High, Critical)
- **Case Type Breakdown (Bar Chart)**: Volume comparison across different case types
- **6-Month Volume Trend (Line Chart)**: Historical trend of received vs. resolved cases

### 4. Case Details Modal
Comprehensive view of individual cases including:
- Case ID, Date, Status, and Risk Level
- Full case description
- Reporter information (Name, Contact, Date Reported)
- Assignment details (Unit and Investigating Officer)
- Secure report indicators for whistleblower cases

### 5. Filtering & Search
- **Search Functionality**: Search by case ID, category, or description
- **Tab-Based Filtering**: Quick access to specific case types
- **Filter Panel**: Advanced filtering options (placeholder for future enhancement)

### 6. Document Attachments (Added 2026-03-09)
- **Attachment Resolution**: Automatically resolves Microsoft Graph DriveItem IDs (e.g., `b!...`) from SharePoint into direct `downloadUrl` or `webUrl` links.
- **Direct Graph Access**: Leverages the Graph API (`/drives/{drive-id}/items/{item-id}`) within the `useRegulatoryCases.ts` hook for seamless rendering of case attachments.
- **UI Integration**: Included within the Case Details Modal and Case Management Table as clickable view links.

---

## Architecture

### Component Structure

```
src/modules/regulatory/
├── components/
│   ├── RegulatoryDashboard.tsx    # Main dashboard container
│   ├── RegulatoryAnalytics.tsx    # Charts and visualizations
│   ├── CaseTable.tsx               # Case listing table
│   ├── CaseDetailsModal.tsx        # Detailed case view
│   ├── KPIBar.tsx                  # Key metrics display
│   └── FilterPanel.tsx             # Search and filter UI
├── pages/
│   └── RegulatoryIntelligence.tsx  # Page wrapper with layout
├── types.ts                         # TypeScript interfaces
└── constants.ts                      # Mock data and defaults
```

### Key Components

#### RegulatoryDashboard
- Main orchestrator component
- Manages tab state and case filtering
- Integrates KPIBar, Analytics, FilterPanel, and CaseTable

#### RegulatoryAnalytics
- Renders three primary charts using Recharts
- Processes raw case data for visualization
- Maintains consistent color schemes

#### CaseTable
- Interactive table with row click handlers
- Dropdown menus for actions (View, Edit, Delete)
- Color-coded badges for status and risk
- Special handling for whistleblower cases

#### CaseDetailsModal
- Dialog-based modal (not side sheet)
- Displays comprehensive case information
- Respects anonymity settings for whistleblower cases
- Includes reporter information section

---

## Data Models

### RegulatoryCase Interface

```typescript
export interface RegulatoryCase {
    caseId: string;
    type: CaseType;
    category: string;
    risk: CaseRisk;
    status: CaseStatus;
    source?: string;
    anonymous?: boolean;
    title?: string;
    description?: string;
    assignedUnit: string;
    assignedOfficer?: string;
    createdAt: string;
    lastUpdate?: string;
    secureToken?: string;
    summary?: string;
    reporterName?: string;
    reporterContact?: string;
}
```

### Type Definitions

- **CaseType**: `'scam' | 'enquiry' | 'whistleblower' | 'investigation' | 'compliance'`
- **CaseRisk**: `'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'`
- **CaseStatus**: `'RECEIVED' | 'UNDER_REVIEW' | 'INVESTIGATING' | 'ESCALATED' | 'CLOSED' | 'RESOLVED'`

### KPIStats Interface

```typescript
export interface KPIStats {
    totalReports: number;
    openCases: number;
    highRisk: number;
    criticalAlerts: number;
}
```

---

## Routing & Access Control

### Route Configuration

```typescript
// In App.tsx
<Route
  path="/regulatory-intelligence"
  element={
    <RoleProtectedRoute requiredPermissions={['regulatory:read']}>
      <RegulatoryIntelligence />
    </RoleProtectedRoute>
  }
/>
```

### Navigation

The module is accessible via the main sidebar:
- **Icon**: Shield
- **Label**: "Regulatory"
- **Permission Gate**: `regulatory:read`

---

## UI/UX Patterns

### Color Schemes

#### Risk Levels
- **Critical**: Red (bg-red-100, text-red-800)
- **High**: Orange (bg-orange-100, text-orange-800)
- **Medium**: Yellow (bg-yellow-100, text-yellow-800)
- **Low**: Green (bg-green-100, text-green-800)

#### Case Status
- **Received**: Blue (bg-blue-50, text-blue-700)
- **Under Review**: Purple (bg-purple-50, text-purple-700)
- **Investigating**: Indigo (bg-indigo-50, text-indigo-700)
- **Escalated**: Red (bg-red-50, text-red-700)
- **Resolved**: Green (bg-green-50, text-green-700)
- **Closed**: Gray (bg-gray-50, text-gray-700)

#### Chart Colors
- **Scam**: Blue (#3b82f6)
- **Whistleblower**: Violet (#8b5cf6)
- **Compliance**: Emerald (#10b981)
- **Enquiry**: Slate (#64748b)
- **Investigation**: Rose (#f43f5e)

### Interaction Patterns

1. **Row Click**: Opens case details modal
2. **Dropdown Menu**: Prevents row click propagation (stopPropagation)
3. **Anonymous Cases**: Hides reporter information, shows "Anonymous Report"
4. **Whistleblower Cases**: Shows secure token and confidentiality notice

---

## Dependencies

### UI Components (shadcn/ui)
- `Card`, `CardContent`, `CardHeader`, `CardTitle`
- `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
- `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`
- `Badge`, `Button`, `Input`, `Select`
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`
- `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuTrigger`

### External Libraries
- **recharts**: Data visualization (`PieChart`, `BarChart`, `LineChart`)
- **lucide-react**: Icons
- **date-fns**: Date formatting
- **react-router-dom**: Navigation

---

## Future Enhancements

### Phase 1 (Current)
- ✅ Basic dashboard and KPI display
- ✅ Case table with filtering by type
- ✅ Risk Distribution, Case Type Breakdown, and Volume Trend charts
- ✅ Case details modal
- ✅ Reporter information display

### Phase 2 (Planned)
- [ ] **Backend Integration**: Connect to Supabase for real-time data
- [ ] **Advanced Search**: Multi-field search with filters
- [ ] **Case Creation**: Form for submitting new cases
- [ ] **Edit Functionality**: In-place editing of case details
- [ ] **Delete Confirmation**: Modal with cascade warning
- [ ] **Additional Charts**:
  - Status Timeline (Gantt)
  - Assignment Workload (Stacked Bar)
  - Resolution Time Analysis (Heatmap)

### Phase 3 (Advanced)
- [ ] **Workflow Management**: Case status transitions with approval flows
- [ ] **Document Attachments**: File upload and management
- [ ] **Audit Logs**: Complete history of case changes
- [ ] **Notifications**: Real-time alerts for critical cases
- [ ] **Export Functionality**: PDF/CSV reports
- [ ] **Advanced Analytics**: Predictive analytics and trend forecasting

---

## Testing Considerations

### Manual Testing Checklist
- [ ] Verify all tabs filter cases correctly
- [ ] Test row click opens modal
- [ ] Verify dropdown menu actions work independently
- [ ] Check anonymous cases hide reporter info
- [ ] Verify whistleblower cases show secure labels
- [ ] Test chart responsiveness on different screen sizes
- [ ] Verify date formatting is consistent
- [ ] Test edge cases (empty data, single case, etc.)

### Automated Testing (Future)
- Unit tests for data transformation functions
- Integration tests for component interactions
- E2E tests for complete workflows

---

## Known Issues & Limitations

### Current Limitations
1. **Mock Data**: All data is currently static (constants.ts)
2. **Edit/Delete**: Placeholder functionality (shows toast notifications)
3. **Filter Panel**: Basic implementation, needs advanced filters
4. **Pagination**: Not implemented (will be needed with real data)
5. **Real-time Updates**: Not available without backend integration

### Browser Compatibility
- Tested on: Chrome, Edge, Firefox
- Minimum supported: Modern browsers with ES6 support

---

## Deployment Notes

### Environment Setup
No additional environment variables required for the frontend-only implementation.

### Backend Integration (When Ready)
Required Supabase tables:
- `regulatory_cases`
- `regulatory_kpi_stats`
- `regulatory_case_history` (for audit logs)

Required permissions in RBAC:
- `regulatory:read` - View cases
- `regulatory:write` - Create/Edit cases
- `regulatory:delete` - Delete cases
- `regulatory:admin` - Full admin access

---

## Support & Maintenance

### Code Owners
- Primary: IT Unit Development Team
- Module: Regulatory Intelligence & Reporting

### Related Documentation
- [UI Improvements](./UI_IMPROVEMENTS_USER_DROPDOWN_KANBAN_SCROLLBAR.md)
- [Task Multi-Assignee Schema](./TASK_MULTI_ASSIGNEE_AND_SCHEMA_FIX.md)

### Change Log

#### v1.1.0 (2026-03-09)
- **Attachment Url Resolution**: Added seamless conversion of Microsoft Graph DriveItem IDs (`b!...`) into clickable download/web URLs via `@microsoft.graph.downloadUrl` in `useRegulatoryCases.ts`.
- **Exposed Graph Client**: Updated `SharePointOpsService` to expose the Graph `client` for more flexible API querying within hooks.
- **Attachment UI**: Added an "Attachments" column to the `CaseTable` and an "Attachments" section to the `CaseDetailsModal`.

#### v1.0.0 (2026-02-13)
- Initial implementation
- Dashboard with tabbed navigation
- Three primary analytics charts
- Case table with interactive row clicks
- Case details modal with reporter information
- Mock data for demonstration

---

## Quick Start Guide

### For Developers

1. **Navigate to module**:
   ```
   /src/modules/regulatory/
   ```

2. **View the page**:
   Visit `/regulatory-intelligence` (requires `regulatory:read` permission)

3. **Add mock data**:
   Edit `constants.ts` to add more cases

4. **Modify components**:
   - Dashboard layout: `components/RegulatoryDashboard.tsx`
   - Charts: `components/RegulatoryAnalytics.tsx`
   - Table: `components/CaseTable.tsx`
   - Modal: `components/CaseDetailsModal.tsx`

### For End Users

1. **Access**: Click "Regulatory" in the sidebar
2. **Browse Cases**: Use tabs to filter by case type
3. **View Details**: Click on any row to see full case information
4. **Use Actions**: Click the 3-dot menu for View/Edit/Delete options
5. **Analyze Trends**: Review the charts in the Overview tab

---

## Troubleshooting

### Common Issues

**Issue**: Can't access the Regulatory page  
**Solution**: Ensure your user has `regulatory:read` permission

**Issue**: Charts not rendering  
**Solution**: Check browser console for errors; ensure Recharts is installed

**Issue**: Modal not opening  
**Solution**: Check for console errors; verify `Dialog` component is properly imported

**Issue**: Anonymous reporter info showing  
**Solution**: Verify `anonymous` field is set to `true` in case data

---

**Last Updated**: March 09, 2026  
**Document Version**: 1.1  
**Module Version**: 1.1
