import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { getGraphClient } from '@/services/graphService';
import { fetchStaffRoster } from '@/services/staffRosterService';

export function useStaffRoster() {
  const { instance, accounts, inProgress } = useMsal();
  const account = instance.getActiveAccount() || accounts[0];
  return useQuery({
    queryKey: ['syncedStaffRoster', account?.homeAccountId],
    queryFn: async () => {
      const client = await getGraphClient(instance);
      if (!client) throw new Error('Unable to connect to the staff directory');
      return fetchStaffRoster(client);
    },
    enabled: !!account && inProgress === InteractionStatus.None,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: 60_000,
    meta: { persist: false },
  });
}
