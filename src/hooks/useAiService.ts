import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { useQuery } from '@tanstack/react-query';
import { USE_AI_GATEWAY, AI_GATEWAY_URL, AI_GATEWAY_SCOPE, USE_CLOUDFLARE_GATEWAY, CLOUDFLARE_GATEWAY_URL, CLOUDFLARE_GATEWAY_SCOPE } from '@/config/aiConnection';
import { requestAiGateway, type AiFeature } from '@/services/aiGatewayClient';
import { prepareAiRequest } from '@/services/aiRequestPolicy';
import { useGeminiApiKey } from '@/hooks/useGeminiApiKey';
import { useGroqApiKey } from '@/hooks/useGroqApiKey';
import { useAiHubSettings } from '@/hooks/useAiHubSettings';
import { createAiRouterWithCloudflare, readAiRoute, type AiRequest, type AiRoute } from '@/services/aiService';
import { createCloudflareGatewayAdapter } from '@/services/cloudflareGatewayAdapter';
import { isAiProvider } from '@/config/aiProviders';

/** The credential resolver and automatic provider policy shared by every active AI feature. */
export const useAiService = (feature: AiFeature = 'ai-hub') => {
  const { instance, accounts, inProgress } = useMsal();
  const account = accounts[0];
  const gatewayUrl = USE_AI_GATEWAY ? AI_GATEWAY_URL : CLOUDFLARE_GATEWAY_URL;
  const gatewayScope = USE_AI_GATEWAY ? AI_GATEWAY_SCOPE : CLOUDFLARE_GATEWAY_SCOPE;
  const getToken = useCallback(async () => {
    if (!account) throw new Error('Sign in to use the secure AI service.');
    if (!gatewayScope) throw new Error('The secure AI sign-in permission has not been configured.');
    try {
      const result = await instance.acquireTokenSilent({ account, scopes: [gatewayScope] });
      if (!result.accessToken) throw new Error('Missing API access token.');
      return result.accessToken;
    } catch { throw new Error('Your Microsoft session could not authorize the secure AI service. Sign in again after its API permission has been approved.'); }
  }, [instance, account, gatewayScope]);
  const hybridRouter = useMemo(() => createAiRouterWithCloudflare(createCloudflareGatewayAdapter({ getToken,
    send: value => requestAiGateway({ ...value, feature, endpoint: CLOUDFLARE_GATEWAY_URL }),
  })), [getToken, feature]);
  const gateway = useQuery({
    queryKey: ['ai-gateway-health', account?.homeAccountId, feature, gatewayUrl, gatewayScope],
    enabled: (USE_AI_GATEWAY || USE_CLOUDFLARE_GATEWAY) && !!account && inProgress === 'none',
    staleTime: 60000, retry: false, meta: { persist: false },
    queryFn: async () => {
      const response = await requestAiGateway({ feature, token: await getToken(), endpoint: gatewayUrl });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'The secure AI service is unavailable.');
      return { configured: data.configured === true && Array.isArray(data.features) && data.features.includes(feature),
        providers: Array.isArray(data.providers) ? data.providers.filter(isAiProvider) : [] };
    },
  });
  const cloudflareAvailable = (USE_AI_GATEWAY || USE_CLOUDFLARE_GATEWAY) && !gateway.isError
    && gateway.data?.configured === true && gateway.data.providers.includes('cloudflare');
  const { apiKey: geminiApiKey, isReady: geminiReady, refresh: refreshGemini } = useGeminiApiKey(!USE_AI_GATEWAY);
  const { apiKey: groqApiKey, isReady: groqReady, refresh: refreshGroq } = useGroqApiKey(!USE_AI_GATEWAY);
  const { settings, isLoading: isSettingsLoading, error: settingsError } = useAiHubSettings();
  const [lastRoute, setLastRoute] = useState<AiRoute>();
  const clearRoute = useCallback(() => setLastRoute(undefined), []);
  const mounted = useRef(true);
  const requests = useRef(new Set<AbortController>());
  const accountId = account?.homeAccountId || account?.username;
  useEffect(() => {
    mounted.current = true;
    setLastRoute(undefined);
    const active = requests.current;
    return () => { mounted.current = false; active.forEach(controller => controller.abort()); active.clear(); };
  }, [accountId]);
  const generateContent = useCallback(async (request: AiRequest) => {
    if (!mounted.current || request.signal?.aborted) throw new DOMException('Cancelled.', 'AbortError');
    const controller = new AbortController();
    const cancel = () => controller.abort();
    request.signal?.addEventListener('abort', cancel, { once: true });
    requests.current.add(controller);
    try {
    const options = {
      ...request,
      body: prepareAiRequest(request.body),
      signal: controller.signal,
      preferredProvider: request.preferredProvider ?? settings.provider,
      models: { [settings.provider]: settings.model, ...request.models },
    };
    const response = USE_AI_GATEWAY
      ? await requestAiGateway({ request: options, feature, token: await getToken(), signal: controller.signal })
      : await hybridRouter({ ...options, keys: { gemini: geminiApiKey, groq: groqApiKey, cloudflare: cloudflareAvailable ? 'authenticated-gateway' : null } });
    const route = readAiRoute(response);
    if (controller.signal.aborted || !mounted.current) throw new DOMException('Cancelled.', 'AbortError');
    if (mounted.current && response.ok && route) setLastRoute(route);
    return response;
    } finally { requests.current.delete(controller); request.signal?.removeEventListener('abort', cancel); }
  }, [settings.provider, settings.model, geminiApiKey, groqApiKey, feature, getToken, hybridRouter, cloudflareAvailable]);
  const refreshGateway = gateway.refetch;
  const refresh = useCallback(async () => {
    if (USE_AI_GATEWAY) { await refreshGateway(); return; }
    await Promise.all([refreshGemini(), refreshGroq(), ...(USE_CLOUDFLARE_GATEWAY ? [refreshGateway()] : [])]);
  }, [refreshGemini, refreshGroq, refreshGateway]);
  return {
    generateContent, refresh, clearRoute, lastRoute, settings, isSettingsLoading, settingsError,
    isConfigured: USE_AI_GATEWAY ? gateway.data?.configured === true && !gateway.isError : !!geminiApiKey || !!groqApiKey || cloudflareAvailable,
    connectionError: gateway.error, secureGateway: USE_AI_GATEWAY,
    cloudflareAvailable,
    isReady: USE_AI_GATEWAY ? !gateway.isLoading && !isSettingsLoading : geminiReady && groqReady && (!USE_CLOUDFLARE_GATEWAY || !gateway.isLoading) && !isSettingsLoading,
  };
};
