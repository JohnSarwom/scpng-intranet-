import { useQuery } from '@tanstack/react-query';
import { supabase, GLOBAL_SETTINGS_ID } from '@/lib/supabaseClient';
import { DEFAULT_IMPROVE_MODEL } from '@/services/aiTextService';

/**
 * Org-wide settings for the "Improve with AI" button, stored by admins in the
 * `prompts` JSON column of the Supabase `news_api_settings` row
 * (managed on the Admin > API Management page).
 *
 *   prompts.text_improver_enabled  boolean  default true
 *   prompts.text_improver_model    string   default gemini-2.5-flash-lite
 */
export const AI_TEXT_ASSIST_SETTINGS_QUERY_KEY = ['ai-text-assist-settings'] as const;

export const AI_TEXT_ASSIST_MODEL_OPTIONS = [
  { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (fastest, cheapest)' },
  { value: 'gemini-flash-latest', label: 'Gemini Flash (latest) - follows Google\'s newest Flash release' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (same as the chat assistants)' },
] as const;

/** Models Google has retired for new keys, mapped to their replacement. */
const RETIRED_MODEL_REPLACEMENTS: Record<string, string> = {
  'gemini-2.5-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash-lite': 'gemini-3.5-flash-lite',
};

export interface AiTextAssistSettings {
  enabled: boolean;
  model: string;
}

export const DEFAULT_AI_TEXT_ASSIST_SETTINGS: AiTextAssistSettings = {
  enabled: true,
  model: DEFAULT_IMPROVE_MODEL,
};

/** Normalise whatever is in the prompts JSON into a settings object. */
export const parseAiTextAssistSettings = (prompts: unknown): AiTextAssistSettings => {
  const p = (prompts && typeof prompts === 'object' ? prompts : {}) as Record<string, unknown>;
  const enabled = typeof p.text_improver_enabled === 'boolean' ? p.text_improver_enabled : DEFAULT_AI_TEXT_ASSIST_SETTINGS.enabled;
  const stored =
    typeof p.text_improver_model === 'string' && p.text_improver_model.trim()
      ? p.text_improver_model.trim()
      : DEFAULT_AI_TEXT_ASSIST_SETTINGS.model;
  const model = RETIRED_MODEL_REPLACEMENTS[stored] ?? stored;
  return { enabled, model };
};

export const useAiTextAssistSettings = () => {
  const query = useQuery<AiTextAssistSettings>({
    queryKey: AI_TEXT_ASSIST_SETTINGS_QUERY_KEY,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_api_settings')
        .select('prompts')
        .eq('id', GLOBAL_SETTINGS_ID)
        .single();
      if (error) return DEFAULT_AI_TEXT_ASSIST_SETTINGS;
      return parseAiTextAssistSettings(data?.prompts);
    },
  });

  return {
    settings: query.data ?? DEFAULT_AI_TEXT_ASSIST_SETTINGS,
    isLoading: query.isLoading,
  };
};
