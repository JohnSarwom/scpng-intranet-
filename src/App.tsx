import React, { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { supabase, logger } from '@/lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import RoleProtectedRoute from '@/components/auth/RoleProtectedRoute';
import PageLayout from '@/components/layout/PageLayout';
import Index from "./pages/Index";
import News from "./pages/News";
import MarketData from "./pages/MarketData";
import DailyMarketSummary from "./pages/DailyMarketSummary";
import AIHub from "./pages/AIHub";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import Documents from "./pages/Documents";
import Contacts from "./pages/Contacts";

import Strategy from "./pages/Strategy";
import HRProfiles from "./pages/HRProfiles";
import Unit from "./pages/Unit";
import Division from "./pages/Division";
import Calendar from "./pages/Calendar";
import Gallery from "./pages/Gallery";
import Login from "./pages/Login";
import LeaveActionPage from "./pages/LeaveActionPage";
import NotFound from "./pages/NotFound";
import Unauthorized from "./pages/Unauthorized";
import Notes from "./pages/Notes";
import AssetManagementNew from './pages/AssetManagementNew';
import AssetProfilePage from './pages/AssetProfilePage';
import AssetPublicProfilePage from './pages/AssetPublicProfilePage';
import Tickets from './pages/Tickets';
import AdminAssetsPage from './pages/AdminAssetsPage';
import UILibrary from './pages/UILibrary';
import { SupabaseAuthProvider } from '@/hooks/useSupabaseAuth';
import LicensingRegistry from './pages/LicensingRegistry';
import Forms from './pages/Forms';
import FillFormPage from './pages/FillFormPage';
import Approvals from './pages/Approvals';
import EditEmployeeProfile from './pages/EditEmployeeProfile';
import PaymentsPage from './pages/PaymentsPage';
import Apps from './pages/Apps';
import TestGround from './pages/TestGround';
import UATFeedbackPage from './pages/UATFeedbackPage';
import { EmployeesProvider } from '@/contexts/EmployeesContext';
import { SlideshowProvider } from '@/contexts/SlideshowContext';
import RegulatoryIntelligence from './pages/RegulatoryIntelligence';
import WorkPlanBuilderPage from './pages/WorkPlanBuilderPage';
import WebsiteAnalytics from './pages/WebsiteAnalytics';
import MeetingMinutes from './pages/MeetingMinutes';
import TimeAttendance from './pages/TimeAttendance';

// MSAL Imports
import { MsalProvider, useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { MsalAuthProvider } from '@/integrations/microsoft/MsalProvider';
import AppLoadingShell from '@/components/layout/AppLoadingShell';

const CACHE_VERSION = 'v1'; // Bump when SharePoint data schema changes

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,       // 5 min — data considered fresh, no refetch
      gcTime: 1000 * 60 * 60 * 24,     // 24h — keep in memory/localStorage
      refetchOnWindowFocus: false,      // Don't refetch when user tabs back
      retry: 2,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'SCPNG_INTRANET_QUERY_CACHE',
  throttleTime: 1000, // Debounce localStorage writes to 1/sec
});

// Role-based authentication hook - now properly implemented

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  // Use MSAL hooks for authentication status
  const { inProgress, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated(); // Simple boolean check based on accounts
  const location = useLocation();

  // Show loading indicator while MSAL is initializing or interacting
  if (inProgress !== InteractionStatus.None) {
    logger.info('ProtectedRoute: MSAL in progress...', { status: inProgress });
    return <AppLoadingShell message="Checking your Microsoft session..." />;
  }

  // If MSAL is idle and user is NOT authenticated, redirect to login
  if (!isAuthenticated) {
    logger.warn('ProtectedRoute: MSAL user not authenticated, redirecting to login.', { from: location.pathname });
    const returnTo = `${location.pathname}${location.search}`;
    if (returnTo !== '/' && returnTo !== '/login') {
      sessionStorage.setItem('auth_return_to', returnTo);
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If MSAL is idle and user IS authenticated, grant access
  logger.success('ProtectedRoute: MSAL access granted.', { username: accounts[0]?.username });
  return <>{children}</>;
};

// Role-based asset page routing component
const AssetsPageRoute = () => {
  const { isAdmin, hasPermission, loading, user } = useRoleBasedAuth();

  // Only show loading on initial load, not on navigation - wrapped in PageLayout
  if (loading && !user) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-gray-600">Loading...</span>
        </div>
      </PageLayout>
    );
  }

  // Admin users or users with admin asset permissions see AdminAssetsPage
  const canAccessAdminAssets = isAdmin || hasPermission('assets', 'admin');

  logger.info(`[AssetsPageRoute] Rendering assets page. isAdmin: ${isAdmin}, canAccessAdminAssets: ${canAccessAdminAssets}`);

  return canAccessAdminAssets ? <AdminAssetsPage /> : <AssetManagementNew />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/asset-public" element={<AssetPublicProfilePage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Email action deep-link - requires MSAL auth, no role needed */}
      <Route path="/leave-action" element={<ProtectedRoute><LeaveActionPage /></ProtectedRoute>} />

      {/* Basic authenticated routes */}
      <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
      <Route path="/news" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'news', action: 'read' }]}>
          <News />
        </RoleProtectedRoute>
      } />
      <Route path="/market-data" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'market_data', action: 'read' }]}>
          <MarketData />
        </RoleProtectedRoute>
      } />
      <Route path="/market-summary" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'market_data', action: 'read' }]}>
          <DailyMarketSummary />
        </RoleProtectedRoute>
      } />
      <Route path="/apps" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'apps', action: 'read' }]}>
          <Apps />
        </RoleProtectedRoute>
      } />
      <Route path="/contacts" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'contacts', action: 'read' }]}>
          <Contacts />
        </RoleProtectedRoute>
      } />
      <Route path="/gallery" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'gallery', action: 'read' }]}>
          <Gallery />
        </RoleProtectedRoute>
      } />

      {/* Role-based protected routes */}
      <Route path="/documents" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'documents', action: 'read' }]}>
          <Documents />
        </RoleProtectedRoute>
      } />

      <Route path="/forms" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'forms', action: 'read' }]}>
          <Forms />
        </RoleProtectedRoute>
      } />
      <Route path="/forms/fill/:formId" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'forms', action: 'read' }]}>
          <FillFormPage />
        </RoleProtectedRoute>
      } />

      <Route path="/approvals" element={
        <ProtectedRoute>
          <Approvals />
        </ProtectedRoute>
      } />

      <Route path="/time-attendance" element={
        <ProtectedRoute>
          <TimeAttendance />
        </ProtectedRoute>
      } />

      {/* Adjusted to allow full access to all authenticated users */}
      <Route path="/ai-hub" element={
        <ProtectedRoute>
          <AIHub />
        </ProtectedRoute>
      } />

      <Route path="/unit" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'units', action: 'read' }]}>
          <Unit />
        </RoleProtectedRoute>
      } />

      <Route path="/division" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'divisions', action: 'read' }]}>
          <Division />
        </RoleProtectedRoute>
      } />
      <Route path="/division/:divisionId" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'divisions', action: 'read' }]}>
          <Division />
        </RoleProtectedRoute>
      } />
      <Route path="/division/:divisionId/workplan/new" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'divisions', action: 'read' }]}>
          <WorkPlanBuilderPage />
        </RoleProtectedRoute>
      } />
      <Route path="/division/:divisionId/workplan/:planId/edit" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'divisions', action: 'read' }]}>
          <WorkPlanBuilderPage />
        </RoleProtectedRoute>
      } />



      <Route path="/strategy" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'strategy', action: 'read' }]}>
          <Strategy />
        </RoleProtectedRoute>
      } />
      <Route path="/test-ground" element={
        <ProtectedRoute>
          <TestGround />
        </ProtectedRoute>
      } />

      <Route path="/uat-feedback" element={
        <ProtectedRoute>
          <UATFeedbackPage />
        </ProtectedRoute>
      } />

      <Route path="/hr-profiles" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'hr', action: 'read' }]}>
          <HRProfiles />
        </RoleProtectedRoute>
      } />
      <Route path="/hr-profiles/edit/:employeeId" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'hr', action: 'edit' }]}>
          <EditEmployeeProfile />
        </RoleProtectedRoute>
      } />

      <Route path="/tickets" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'tickets', action: 'read' }]}>
          <Tickets />
        </RoleProtectedRoute>
      } />

      <Route path="/licensing-registry" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'licenses', action: 'read' }]}>
          <LicensingRegistry />
        </RoleProtectedRoute>
      } />

      <Route path="/regulatory-intelligence" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'regulatory', action: 'read' }]}>
          <RegulatoryIntelligence />
        </RoleProtectedRoute>
      } />

      {/* Website Analytics */}
      <Route path="/website-analytics" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'analytics', action: 'read' }]}>
          <WebsiteAnalytics />
        </RoleProtectedRoute>
      } />

      {/* Admin-only routes */}
      <Route path="/admin" element={
        <RoleProtectedRoute requiredRole="super_admin">
          <Admin />
        </RoleProtectedRoute>
      } />

      <Route path="/ui-library" element={
        <RoleProtectedRoute requiredRole="super_admin">
          <UILibrary />
        </RoleProtectedRoute>
      } />

      <Route path="/settings" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'settings', action: 'read' }]}>
          <Settings />
        </RoleProtectedRoute>
      } />

      {/* Asset management with role-based access */}
      <Route path="/asset-management" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'assets', action: 'read' }]}>
          <AssetsPageRoute />
        </RoleProtectedRoute>
      } />

      <Route path="/asset-view/:assetId" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'assets', action: 'read' }]}>
          <AssetProfilePage />
        </RoleProtectedRoute>
      } />

      {/* Payments management */}
      <Route path="/payments" element={
        <RoleProtectedRoute requiredPermissions={[{ resource: 'payments', action: 'read' }]}>
          <PaymentsPage />
        </RoleProtectedRoute>
      } />

      {/* Available to all authenticated users */}

      <Route path="/meeting-minutes" element={
        <ProtectedRoute>
          <MeetingMinutes />
        </ProtectedRoute>
      } />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// Main App component wrapper to handle MSAL initialization state
const AppContent = () => {
  const { inProgress } = useMsal();

  if (inProgress !== InteractionStatus.None) {
    return <AppLoadingShell message="Finishing authentication..." />;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24h max cache age
        buster: CACHE_VERSION,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.state.status === 'success',
        },
      }}
    >
      <ThemeProvider attribute="class" defaultTheme="light">
        <TooltipProvider>
          <EmployeesProvider>
            <Toaster />
            <Sonner />
            <SlideshowProvider>
              <AppRoutes />
            </SlideshowProvider>
          </EmployeesProvider>
        </TooltipProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

const AuthenticatedApp = () => (
    <SupabaseAuthProvider>
      <MsalAuthProvider>
        <AppContent />
      </MsalAuthProvider>
    </SupabaseAuthProvider>
);

const AppRouter = () => {
  const location = useLocation();
  const isPublicAssetRoute = location.pathname === '/asset-public';

  if (isPublicAssetRoute) {
    return (
      <ThemeProvider attribute="class" defaultTheme="light">
        <TooltipProvider>
          <AppRoutes />
        </TooltipProvider>
      </ThemeProvider>
    );
  }

  return <AuthenticatedApp />;
};

// BrowserRouter wraps everything so MsalAuthProvider (which registers
// CustomNavigationClient via useNavigate) is inside a Router context.
const App = () => (
  <BrowserRouter>
    <AppRouter />
  </BrowserRouter>
);

export default App;
