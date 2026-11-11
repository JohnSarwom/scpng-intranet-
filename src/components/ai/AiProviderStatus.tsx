import { AI_PROVIDER_NAMES, type AiProvider } from '@/config/aiProviders';
import type { AiRoute } from '@/services/aiService';

export function AiProviderStatus({ preferredProvider, lastRoute }: { preferredProvider: AiProvider; lastRoute?: AiRoute }) {
  return <p className="text-xs text-muted-foreground" role="status">
    Automatic fallback enabled · Preferred: {AI_PROVIDER_NAMES[preferredProvider]}.
    {lastRoute && <> Last answer: {AI_PROVIDER_NAMES[lastRoute.provider]}{lastRoute.usedFallback ? ' (automatic fallback)' : ''}.</>}
  </p>;
}
