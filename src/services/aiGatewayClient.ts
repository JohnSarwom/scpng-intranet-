import { AI_GATEWAY_URL } from '@/config/aiConnection';
import type { AiRequest } from './aiService';

export type AiFeature = 'ai-hub' | 'strategy' | 'division' | 'regulatory' | 'analytics' | 'writing';
export async function requestAiGateway({ request, feature, token, signal, endpoint = AI_GATEWAY_URL }: {
  request?: AiRequest; feature: AiFeature; token: string; signal?: AbortSignal; endpoint?: string;
}): Promise<Response> {
  if (!endpoint) throw new Error('The secure AI service is not configured.');
  const url = new URL(endpoint);
  if (!request) url.searchParams.set('feature', feature);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('The secure AI service requires HTTPS.');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) throw new DOMException('Cancelled.', 'AbortError');
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 65000);
  try {
    const response = await fetch(url.toString(), {
      method: request ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, ...(request && { 'Content-Type': 'application/json' }) },
      body: request ? JSON.stringify({ feature, body: request.body, preferredProvider: request.preferredProvider, model: request.model, models: request.models, allowFallback: request.allowFallback }) : undefined,
      signal: controller.signal,
    });
    // Consume under the same deadline; never return an unbounded streaming body.
    const data = await response.json();
    return Response.json(data, { status: response.status, headers: response.headers });
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Cancelled.', 'AbortError');
    if (controller.signal.aborted) throw new Error('The secure AI service timed out. Try a narrower question.');
    throw new Error('The secure AI service could not be reached. No direct provider connection was attempted.');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
