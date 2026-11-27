import { useQuery } from '@tanstack/react-query';
import { supabase, GLOBAL_SETTINGS_ID } from '@/lib/supabaseClient';
import { DEFAULT_AI_HUB_SETTINGS, parseAiHubSettings } from '@/config/aiProviders';

export const AI_HUB_SETTINGS_QUERY_KEY = ['ai-hub-settings'] as const;
export const useAiHubSettings = () => {
  const query = useQuery({
    queryKey: AI_HUB_SETTINGS_QUERY_KEY,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.from('news_api_settings').select('prompts')
        .eq('id', GLOBAL_SETTINGS_ID).single();
      if (error) throw new Error('Could not load AI Hub provider settings.');
      return parseAiHubSettings(data?.prompts);
    },
  });
  return { settings: query.data ?? DEFAULT_AI_HUB_SETTINGS, isLoading: query.isLoading, error: query.error };
};
