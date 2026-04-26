import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { FacebookAnalyticsService } from '@/services/facebookAnalyticsService';

export const useFacebookAnalytics = () => {
    const { instance: msalInstance } = useMsal();

    return useQuery({
        queryKey: ['facebookAnalytics'],
        queryFn: async () => {
            const client = await getGraphClient(msalInstance);
            if (!client) throw new Error('Failed to get Graph client');
            const service = new FacebookAnalyticsService(client);
            return await service.loadAll();
        },
        staleTime: 60_000,
        refetchOnWindowFocus: false,
    });
};
