import { useCallback } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { useMicrosoftGraph } from '@/hooks/useMicrosoftGraph';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

export const GROQ_API_KEY_QUERY_KEY = ['groq-api-key'] as const;
export const GROQ_API_KEY_SETTING_NAME = 'GroqAPIKey';
export const invalidateGroqApiKey = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: GROQ_API_KEY_QUERY_KEY });

/** Uses the existing SharePoint credential store; never persists to the query cache. */
export const useGroqApiKey = (enabled = true) => {
  const { isLoading: isAuthLoading } = useSupabaseAuth();
  const { inProgress, accounts } = useMsal();
  const { getAppSetting } = useMicrosoftGraph();
  const queryClient = useQueryClient();
  const query = useQuery<string | null>({
    queryKey: [...GROQ_API_KEY_QUERY_KEY, accounts[0]?.homeAccountId],
    enabled: enabled && !isAuthLoading && inProgress === 'none' && accounts.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    meta: { persist: false },
    queryFn: async () => (await getAppSetting(GROQ_API_KEY_SETTING_NAME))?.trim() || null,
  });
  const refresh = useCallback(async () => { await invalidateGroqApiKey(queryClient); }, [queryClient]);
  return { apiKey: enabled ? query.data ?? null : null, isReady: !enabled || query.isFetched || query.isError, refresh };
};
