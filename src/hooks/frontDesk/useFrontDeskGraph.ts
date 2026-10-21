import { useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { FrontDeskGraph } from '@/services/frontDesk/frontDeskGraph';

/** Returns a function that gives a signed-in FrontDeskGraph, for React Query queryFns and mutations. */
export function useFrontDeskGraph() {
  const { instance } = useMsal();
  return useCallback(async () => {
    const client = await getGraphClient(instance);
    if (!client) throw new Error('Could not connect to Microsoft 365. Please sign in again.');
    return new FrontDeskGraph(client);
  }, [instance]);
}
