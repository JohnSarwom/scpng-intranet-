# UI Improvements: User Dropdown & Kanban Scrollbar

**Date**: February 12, 2026  
**Components Modified**: `PageLayout.tsx`, `TasksTab.tsx`, `index.css`  
**Impact**: Enhanced user experience with visible organizational hierarchy and improved board navigation

---

## Overview

This update addresses two critical UI/UX issues:
1. **User Dropdown Information** - Division and Unit information now reliably displays in the user dropdown menu
2. **Kanban Board Scrollbars** - Horizontal and vertical scrollbars are now clearly visible for better navigation

---

## 1. User Dropdown Division/Unit Display

### Problem
Division and unit information was not appearing in the user dropdown menu after being moved from the main header. The `roleUser` data from SharePoint was not reliably populated with these fields.

### Solution
Integrated Microsoft Graph Profile API as the primary data source for division and unit information, with SharePoint as a fallback.

### Changes Made

#### `PageLayout.tsx`
- **Added**: `useGraphProfile` hook import and integration
- **Logic**: 
  ```typescript
  const { profile: graphProfile, loading: graphLoading } = useGraphProfile();
  
  // Derive Display Values with Graph Profile as primary source
  const displayDivision = graphProfile?.officeLocation || roleUser?.division_name;
  const displayUnit = graphProfile?.department || roleUser?.unit_name;
  ```
- **UI Update**: Updated dropdown menu to use `displayDivision` and `displayUnit` with loading state checks

#### Data Source Mapping
- **Division**: `graphProfile.officeLocation` → Azure AD "Office Location" field
- **Unit**: `graphProfile.department` → Azure AD "Department" field
- **Fallback**: `roleUser.division_name` / `roleUser.unit_name` from SharePoint

### Benefits
- ✅ More reliable data source (Azure AD is canonical for organizational structure)
- ✅ Immediate availability (no SharePoint list dependencies)
- ✅ Graceful fallback to SharePoint data
- ✅ Proper loading states to prevent flicker

---

## 2. Kanban Board Scrollbar Visibility

### Problem
Users could not see scrollbars on the Kanban board, making it difficult to navigate horizontally between task groups and vertically within columns. The scrollbars were either too subtle or positioned off-screen.

### Solution
Implemented high-contrast, always-visible scrollbars with proper layout constraints to ensure they remain on-screen.

### Changes Made

#### `index.css` - Enhanced Scrollbar Styling
```css
/* Kanban Board Custom Scrollbar */
.kanban-scrollbar {
  scrollbar-width: auto; /* Firefox */
  scrollbar-color: #64748b rgba(0, 0, 0, 0.1); /* Firefox: thumb track */
}

.kanban-scrollbar::-webkit-scrollbar {
  height: 14px; /* Increased for visibility */
  width: 14px;
}

.kanban-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1); /* Visible track */
  border-radius: 7px;
}

.kanban-scrollbar::-webkit-scrollbar-thumb {
  background-color: #64748b; /* slate-500 - High contrast */
  border-radius: 7px;
  border: 3px solid transparent;
  background-clip: content-box;
}

.kanban-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #475569; /* slate-600 - Darker on hover */
}

/* Dark mode variants */
.dark .kanban-scrollbar {
  scrollbar-color: #94a3b8 rgba(255, 255, 255, 0.1);
}

.dark .kanban-scrollbar::-webkit-scrollbar-thumb {
  background-color: #94a3b8; /* slate-400 */
}

.dark .kanban-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #cbd5e1; /* slate-300 */
}
```

#### `TasksTab.tsx` - Layout Adjustments
1. **Horizontal Scroll Container**:
   - Changed `max-h-[calc(100vh-220px)]` → `max-h-[calc(100vh-280px)]` to prevent scrollbar from being pushed off-screen
   - Changed `overflow-x-auto` → `overflow-x-scroll` to force scrollbar visibility
   - Added `kanban-scrollbar` class to horizontal scroll container

2. **Vertical Scroll (BoardLane)**:
   - Added `kanban-scrollbar` class to the task list container within each column
   - Ensures consistent scrollbar styling across both axes

### Technical Details

#### Scrollbar Specifications
- **Size**: 14px × 14px (increased from default 10px)
- **Track**: Semi-transparent background for subtle contrast
- **Thumb**: Solid slate color with 3px transparent border
- **Hover**: Darker shade for interactive feedback
- **Border Radius**: 7px for modern, rounded appearance

#### Cross-Browser Support
- **Chrome/Edge/Safari**: `-webkit-scrollbar` pseudo-elements
- **Firefox**: `scrollbar-width` and `scrollbar-color` properties
- **Fallback**: Browser default if custom styles fail

### Benefits
- ✅ **Always Visible**: `overflow-x-scroll` ensures scrollbar is always rendered
- ✅ **High Contrast**: Easy to see in both light and dark themes
- ✅ **On-Screen**: Adjusted height calculation keeps scrollbar within viewport
- ✅ **Consistent**: Same styling for horizontal and vertical scrolling
- ✅ **Accessible**: Large enough to click/drag easily

---

## Files Modified

### Components
- [`src/components/layout/PageLayout.tsx`](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/components/layout/PageLayout.tsx)
- [`src/components/unit-tabs/TasksTab.tsx`](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/components/unit-tabs/TasksTab.tsx)

### Styles
- [`src/index.css`](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/index.css)

### Hooks
- [`src/hooks/useGraphProfile.ts`](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/src/hooks/useGraphProfile.ts) (referenced)

---

## Testing Recommendations

### User Dropdown
1. ✅ Verify Division and Unit appear in dropdown for all users
2. ✅ Check loading states don't show "undefined"
3. ✅ Confirm fallback to SharePoint data works if Graph API fails
4. ✅ Test in both light and dark themes

### Kanban Scrollbars
1. ✅ Verify horizontal scrollbar appears at bottom of board
2. ✅ Verify vertical scrollbar appears in each task column
3. ✅ Test scrolling with mouse wheel and drag
4. ✅ Confirm scrollbars remain visible in both themes
5. ✅ Check scrollbar visibility on different screen sizes

---

## Future Improvements

### User Dropdown
- Consider adding user avatar/photo from Graph API
- Add role badge or permission indicator
- Implement quick profile edit link

### Kanban Scrollbars
- Add smooth scroll animation on programmatic scroll
- Implement keyboard navigation (arrow keys for columns)
- Add scroll position persistence on page reload

---

## Related Documentation
- [UI Border Refinements](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/docs/UI_BORDER_REFINEMENTS.md)
- [Role-Based Authentication System](file:///c:/Users/IT_UNIT/Desktop/Coding/scpng-intranet/docs/role-based-authentication-system.md)

---

**Updated By**: AI Assistant  
**Last Modified**: February 12, 2026
