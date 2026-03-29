/**
 * useApps Hook
 * React hook for fetching and managing applications from SharePoint
 * Cached via React Query with localStorage persistence
 */

import { useMemo } from 'react';
import { useMsal } from '@azure/msal-react';
import { Client } from '@microsoft/microsoft-graph-client';
import { useQuery } from '@tanstack/react-query';
import { AppsSharePointService, SharePointApp } from '@/services/appsSharePointService';

interface UseAppsReturn {
  apps: SharePointApp[];
  categories: string[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getAppsByCategory: (category: string) => SharePointApp[];
  getAppById: (appId: string) => SharePointApp | undefined;
  addApplication: (app: Omit<SharePointApp, 'id'>) => Promise<SharePointApp>;
}

export const useApps = (): UseAppsReturn => {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  const query = useQuery({
    queryKey: ['sharePointApps', account?.username],
    queryFn: async () => {
      if (!account) {
        throw new Error('No account found. Please sign in.');
      }

      const response = await instance.acquireTokenSilent({
        scopes: ['Sites.Read.All'],
        account: account,
      });

      const client = Client.init({
        authProvider: (done) => {
          done(null, response.accessToken);
        },
      });

      const service = new AppsSharePointService(client);
      await service.initialize();

      const fetchedApps = await service.getApplications();
      const activeApps = fetchedApps.filter(app => app.isActive !== false);

      console.log('✅ [useApps] Successfully fetched', activeApps.length, 'applications');
      return activeApps;
    },
    enabled: !!account,
    staleTime: 1000 * 60 * 30, // 30 minutes — apps change rarely
  });

  const apps = query.data ?? [];

  const categories = useMemo(() => {
    return Array.from(
      new Set(apps.map(app => app.category).filter(Boolean))
    ).sort() as string[];
  }, [apps]);

  const getAppsByCategory = (category: string): SharePointApp[] => {
    return apps.filter(app =>
      app.category?.toLowerCase() === category.toLowerCase()
    );
  };

  const getAppById = (appId: string): SharePointApp | undefined => {
    return apps.find(app => app.appId === appId);
  };

  return {
    apps,
    categories,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: async () => { await query.refetch(); },
    getAppsByCategory,
    getAppById,
    addApplication: async (app: Omit<SharePointApp, 'id'>) => {
      if (!account) throw new Error('No account found');
      
      const response = await instance.acquireTokenSilent({
        scopes: ['Sites.FullControl.All', 'Sites.ReadWrite.All'],
        account: account,
      });

      const client = Client.init({
        authProvider: (done) => {
          done(null, response.accessToken);
        },
      });

      const service = new AppsSharePointService(client);
      return await service.addApplication(app);
    },
  };
};

export default useApps;
