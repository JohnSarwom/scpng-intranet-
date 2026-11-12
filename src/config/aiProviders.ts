import { GEMINI_CHAT_MODEL, GEMINI_LITE_MODEL } from './geminiModels.ts';

export type AiProvider = 'gemini' | 'groq' | 'cloudflare';
export const AI_PROVIDERS: readonly AiProvider[] = ['gemini', 'groq', 'cloudflare'];
export const isAiProvider = (value: unknown): value is AiProvider => AI_PROVIDERS.includes(value as AiProvider);
export const AI_PROVIDER_NAMES: Record<AiProvider, string> = { gemini: 'Google Gemini', groq: 'Groq', cloudflare: 'Cloudflare Workers AI' };
export const GROQ_CHAT_MODEL = 'openai/gpt-oss-20b';
export const CLOUDFLARE_CHAT_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
export const AI_PROVIDER_MODELS: Record<AiProvider, readonly { value: string; label: string }[]> = {
  gemini: [
    { value: GEMINI_CHAT_MODEL, label: 'Gemini Flash' },
    { value: GEMINI_LITE_MODEL, label: 'Gemini Flash-Lite' },
  ],
  // Production models: https://console.groq.com/docs/models
  groq: [
    { value: GROQ_CHAT_MODEL, label: 'GPT OSS 20B (fast)' },
    { value: 'openai/gpt-oss-120b', label: 'GPT OSS 120B' },
  ],
  cloudflare: [{ value: CLOUDFLARE_CHAT_MODEL, label: 'Qwen3 30B' }],
};

export interface AiHubSettings { provider: AiProvider; model: string }
export const DEFAULT_AI_HUB_SETTINGS: AiHubSettings = { provider: 'gemini', model: GEMINI_CHAT_MODEL };
export const defaultAiModel = (provider: AiProvider) => AI_PROVIDER_MODELS[provider][0].value;

/** Legacy rows without provider settings continue to use Gemini. */
export const parseAiHubSettings = (prompts: unknown): AiHubSettings => {
  const p = (prompts && typeof prompts === 'object' ? prompts : {}) as Record<string, unknown>;
  const provider: AiProvider = isAiProvider(p.ai_hub_provider) ? p.ai_hub_provider : 'gemini';
  const model = AI_PROVIDER_MODELS[provider].some(option => option.value === p.ai_hub_model)
    ? p.ai_hub_model as string : defaultAiModel(provider);
  return { provider, model };
};
