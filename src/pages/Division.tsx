import React, { useState, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

import { useDivisionData } from '@/hooks/useDivisionData';
import { useDivisionMetrics } from '@/hooks/useDivisionMetrics';

import { DivisionHeader } from '@/components/division/DivisionHeader';
import { DivisionOverviewTab } from '@/components/division/tabs/DivisionOverviewTab';
import { DivisionUnitsTab } from '@/components/division/tabs/DivisionUnitsTab';
import { DivisionWorkPlansTab } from '@/components/division/tabs/DivisionWorkPlansTab';
import { DivisionReportsTab } from '@/components/division/tabs/DivisionReportsTab';
import { DivisionAnalyticsTab } from '@/components/division/tabs/DivisionAnalyticsTab';
import { DivisionSettingsTab } from '@/components/division/tabs/DivisionSettingsTab';

const Division = () => {
  const { divisionId } = useParams<{ divisionId?: string }>();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<string>(() => {
    const state = location.state as { activeTab?: string } | null;
    return state?.activeTab || 'overview';
  });

  // Fetch all division-scoped data
  const divisionData = useDivisionData(divisionId);
  const metrics = useDivisionMetrics(divisionData);

  // Permissions
  const canEditWorkPlans = useMemo(() => {
    const role = divisionData.userContext.role?.toLowerCase();
    return divisionData.canEditStrategy;
  }, [divisionData]);

  const canViewSettings = useMemo(() => {
    const role = divisionData.userContext.role?.toLowerCase();
    return divisionData.canEditStrategy;
  }, [divisionData]);

  // Loading skeleton
  if (divisionData.loading && !divisionData.division) {
    return (
      <PageLayout>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-10 w-96 rounded-lg" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        </div>
      </PageLayout>
    );
  }

  // If no division resolved and not loading
  if (!divisionData.loading && !divisionData.division) {
    return (
      <PageLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <p className="text-sm font-medium">Division not found</p>
            <p className="text-xs text-center max-w-sm">
              Your profile does not appear to be linked to a division, or the specified division could not be found.
              Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {/* Division Header */}
      <DivisionHeader
        division={divisionData.division}
        metrics={metrics}
        loading={divisionData.loading}
      />

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="overflow-x-auto flex-nowrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
          <TabsTrigger value="workplans">Work Plans</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          {canViewSettings && (
            <TabsTrigger value="settings">Settings</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <DivisionOverviewTab data={divisionData} metrics={metrics} />
        </TabsContent>

        <TabsContent value="units" className="mt-0">
          <DivisionUnitsTab data={divisionData} metrics={metrics} />
        </TabsContent>

        <TabsContent value="workplans" className="mt-0">
          <DivisionWorkPlansTab data={divisionData} canEdit={canEditWorkPlans} />
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <DivisionReportsTab data={divisionData} metrics={metrics} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-0">
          <DivisionAnalyticsTab data={divisionData} metrics={metrics} />
        </TabsContent>

        {canViewSettings && (
          <TabsContent value="settings" className="mt-0">
            <DivisionSettingsTab
              divisionId={divisionData.division?.id || ''}
              canEdit={canEditWorkPlans}
              onRefresh={divisionData.refresh}
            />
          </TabsContent>
        )}
      </Tabs>
    </PageLayout>
  );
};

export default Division;
