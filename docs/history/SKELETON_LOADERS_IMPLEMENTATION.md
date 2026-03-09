# Skeleton Loaders Implementation
**Date:** March 06, 2026

## Overview
Replaced legacy loading spinners (`Loader2`) with modern skeleton loading components across major pages to improve perceived performance and visual consistency.

## Pages Updated

### 1. News Page (`News.tsx`)
- **Components Created:**
  - `ArticleGridSkeleton.tsx`: Renders a grid of skeletal article cards.
  - `NewsDashboardSkeleton.tsx`: Mimics the landing state of the main news dashboard.
- **Logic:** Updated `renderNewsCards` to conditionally render these skeletons based on the active tab during `isLoading`.

### 2. Apps Page (`AppsSection.tsx`)
- **Component Created:** `AppGridSkeleton.tsx`.
- **Logic:** Replaced the generic "Loading applications..." spinner with a skeletal grid that matches the final app card layout.

### 3. Home Page (`Index.tsx` widgets)
- **Components Created (in `components/dashboard/skeletons/`):**
  - `PersonalKPICardsSkeleton.tsx`: Placeholders for metric cards.
  - `PersonalKPIStatsSkeleton.tsx`: Skeletal chart and goals list.
  - `OrganizationalOverviewSkeleton.tsx`: Skeletal donut chart and metrics.
  - `NoticeBoardSkeleton.tsx`: Skeletal carousel and notice list.
- **Logic:** Integrated into respective widget components (`PersonalKPICards.tsx`, `PersonalKPIStats.tsx`, etc.) to trigger during their internal `isLoading` or `loading` states.

### 4. Strategy Page (`Strategy.tsx`)
- **Components Created (in `components/strategy/skeletons/`):**
  - `StrategyPageSkeleton.tsx`: Overarching page layout skeleton (Hero section, tabs, mission/vision placeholders).
  - `DivisionHierarchySkeleton.tsx`: Specific skeleton for the divisional accordion tree.
- **Logic:** 
  - `isLoading` triggers the full `StrategyPageSkeleton`.
  - `isLoadingHierarchy` triggers the `DivisionHierarchySkeleton` within the Strategy tab.

### 5. Market Data Page (`MarketData.tsx`)
- **Components Created (in `components/market/skeletons/`):**
  - `MarketDataSkeleton.tsx`: Comprehensive component mimicking the full layout (KPI cards, top grid with main chart and volume bars, right-side cards like heatmap and news, and lower chart).
- **Logic:**
  - Integrated into `MarketData.tsx` to handle the `dataLoading` state, completely replacing the legacy generic spinner.

### 6. Documents Page (`Documents.tsx`)
- **Components Created (in `components/documents/skeletons/`):**
  - `DocumentsPageSkeleton.tsx`: Mimics the structural layout including header, search bar, tabs, and folder/list views using grid cards placeholder logic.
- **Logic:**
  - Replaced the legacy `Loading Documents...` spinner within the main tab content area when `isLoading` is true.

  - Integrated into `Forms.tsx` to handle the `loading` state from the `useForms` hook, completely replacing the legacy loading experience.

### 8. AI Hub Page (`AIHub.tsx`)
- **Components Created (in `components/ai-hub/skeletons/`):**
  - `AIHubSkeleton.tsx`: Full-page layout skeleton mimicking the 2-column AI Hub interface.
- **Logic:**
  - Defined `uiIsActuallyLoading` to consolidate authentication and configuration loading states.
  - Replaced legacy `Loader2` spinners with matched skeletons in the document list and admin configuration areas.
  - Added internal skeleton list to `QuestionLibrarySidebar.tsx` for item fetching.

## Technical Implementation Notes
- **Base Component:** All skeletons leverage the shadcn/ui `Skeleton` component (`@/components/ui/skeleton`).
- **Layout Consistency:** Skeletons are designed to match the exact height and padding of the final components to minimize layout shift (CLS).
- **Network Throttling:** Verified using Chrome DevTools "Slow 3G" profiling.

## Files Created/Modified
### New Skeletons
- `src/components/custom/ArticleGridSkeleton.tsx`
- `src/components/dashboard/NewsDashboardSkeleton.tsx`
- `src/components/dashboard/AppGridSkeleton.tsx`
- `src/components/dashboard/skeletons/PersonalKPICardsSkeleton.tsx`
- `src/components/dashboard/skeletons/PersonalKPIStatsSkeleton.tsx`
- `src/components/dashboard/skeletons/OrganizationalOverviewSkeleton.tsx`
- `src/components/dashboard/skeletons/NoticeBoardSkeleton.tsx`
- `src/components/strategy/skeletons/StrategyPageSkeleton.tsx`
- `src/components/strategy/skeletons/DivisionHierarchySkeleton.tsx`
- `src/components/market/skeletons/MarketDataSkeleton.tsx`
- `src/components/documents/skeletons/DocumentsPageSkeleton.tsx`
- `src/components/forms/skeletons/FormsPageSkeleton.tsx`
- `src/components/ai-hub/skeletons/AIHubSkeleton.tsx`

### Modified Pages/Components
- `src/pages/News.tsx`
- `src/components/dashboard/AppsSection.tsx`
- `src/components/dashboard/PersonalKPICards.tsx`
- `src/components/dashboard/PersonalKPIStats.tsx`
- `src/components/dashboard/OrganizationalOverview.tsx`
- `src/components/dashboard/NoticeBoard.tsx`
- `src/pages/Strategy.tsx`
- `src/pages/MarketData.tsx`
- `src/pages/Documents.tsx`
- `src/pages/Forms.tsx`
- `src/pages/AIHub.tsx`
- `src/components/ai-hub/QuestionLibrarySidebar.tsx`
