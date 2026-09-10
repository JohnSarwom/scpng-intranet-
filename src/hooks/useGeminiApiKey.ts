import { useCallback } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { useMicrosoftGraph } from '@/hooks/useMicrosoftGraph';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

/**
 * Single, cached resolver for the Gemini API key.
 *
 * The key is managed in one place: the SharePoint list `InternalAppSettings`
 * on the intranet site, item titled "GeminiAPIKey", column "Value".
 * Admins edit it from Admin > API Management or the AI Hub settings panel
 * (both write to that list), or directly in SharePoint.
 *
 * A `VITE_GEMINI_API_KEY` environment variable, when present, overrides the
 * list for local development only.
 *
 * The value is cached in React Query for the session so the lookup happens
 * once, not once per component. It is never persisted to browser storage.
 */
export const GEMINI_API_KEY_QUERY_KEY = ['gemini-api-key'] as const;
export const GEMINI_API_KEY_SETTING_NAME = 'GeminiAPIKey';

export interface GeminiApiKeyState {
  apiKey: string | null;
  /** True once the lookup has finished (successfully or not). */
  isReady: boolean;
  /** True when a non-empty key is available. */
  isConfigured: boolean;
  /** Re-read the key from SharePoint (e.g. after an admin rotates it or a request is rejected). */
  refresh: () => Promise<void>;
}

/** Drop the cached key so the next reader fetches it again. Safe to call from anywhere with a QueryClient. */
export const invalidateGeminiApiKey = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: GEMINI_API_KEY_QUERY_KEY });

export const useGeminiApiKey = (): GeminiApiKeyState => {
  const envKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() || null;
  const { isLoading: isAuthLoading } = useSupabaseAuth();
  const { inProgress: msalInProgress } = useMsal();
  const { getAppSetting } = useMicrosoftGraph();
  const queryClient = useQueryClient();

  const authReady = !isAuthLoading && msalInProgress === 'none';

  const query = useQuery<string | null>({
    queryKey: GEMINI_API_KEY_QUERY_KEY,
    enabled: !envKey && authReady,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    // Never persist the key to storage via the app's persisted query client.
    meta: { persist: false },
    queryFn: async () => {
      try {
        const spKey = await getAppSetting(GEMINI_API_KEY_SETTING_NAME);
        return spKey && spKey.trim() ? spKey.trim() : null;
      } catch {
        return null;
      }
    },
  });

  const refresh = useCallback(async () => {
    await invalidateGeminiApiKey(queryClient);
  }, [queryClient]);

  if (envKey) {
    return { apiKey: envKey, isReady: true, isConfigured: true, refresh };
  }

  const apiKey = query.data ?? null;
  return {
    apiKey,
    isReady: query.isFetched || query.isError,
    isConfigured: !!apiKey,
    refresh,
  };
};
