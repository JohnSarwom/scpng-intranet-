import { AI_PROVIDERS, AI_PROVIDER_NAMES, defaultAiModel, isAiProvider, type AiProvider } from '../config/aiProviders.ts';
import { generateGeminiContent } from './geminiClient.ts';
import { generateGroqContent, type AiContentBody } from './groqClient.ts';
import { prepareAiRequest } from './aiRequestPolicy.ts';

export interface AiRequest {
  body: AiContentBody;
  signal?: AbortSignal;
  preferredProvider?: AiProvider;
  /** Override the preferred provider's model for this request. */
  model?: string;
  models?: Partial<Record<AiProvider, string>>;
  timeoutMs?: number;
  /** Administration connection tests can require the named provider to answer. */
  allowFallback?: boolean;
  /** Called before each provider attempt (index 0 is the preferred provider), so the UI can say who is being asked. */
  onAttempt?: (attempt: { provider: AiProvider; model: string; index: number }) => void;
}
export interface AiRoute { provider: AiProvider; model: string; usedFallback: boolean }
interface RouterRequest extends AiRequest {
  keys: Partial<Record<AiProvider, string | null>>;
}
interface ClientRequest { apiKey: string; model: string; body: AiContentBody; signal: AbortSignal }
export type AiClient = (request: ClientRequest) => Promise<Response>;
type Clients = Partial<Record<AiProvider, AiClient>>;
type FailureReason = 'credentials' | 'unavailable' | 'rate-limit' | 'request-size' | 'invalid-response' | 'network' | 'timeout' | 'invalid-request' | 'incomplete-answer' | 'access-denied' | 'recitation';
interface Failure { provider: AiProvider; status: number; reason: FailureReason }
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const abortError = () => new DOMException('The AI request was cancelled.', 'AbortError');
class AiTimeoutError extends Error { constructor() { super('AI provider timed out.'); this.name = 'AiTimeoutError'; } }

const clients: Clients = {
  gemini: request => generateGeminiContent({ ...request, retries: 0, fallbackModels: [] }),
  groq: request => generateGroqContent({ ...request, body: {
    ...request.body,
    generationConfig: { ...request.body.generationConfig, maxOutputTokens: Math.min(request.body.generationConfig?.maxOutputTokens ?? 2048, 2048) },
  } }),
};

async function withDeadline<T>(run: (signal: AbortSignal) => Promise<T>, signal: AbortSignal | undefined, timeoutMs: number): Promise<T> {
  if (signal?.aborted) throw abortError();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  let cancel: () => void;
  const interrupted = new Promise<never>((_, reject) => {
    cancel = () => { reject(abortError()); controller.abort(); };
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => { reject(new AiTimeoutError()); controller.abort(); }, timeoutMs);
  });
  try { return await Promise.race([run(controller.signal), interrupted]); }
  finally { clearTimeout(timer!); signal?.removeEventListener('abort', cancel!); }
}

const safeError = (message: string, status: number, code: string) => Response.json({ error: { message, code } }, { status });
const hasText = (data: Record<string, unknown>) => {
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  const parts = record(record(candidates[0]).content).parts;
  return Array.isArray(parts) && parts.some(part => typeof record(part).text === 'string' && String(record(part).text).trim());
};
const isBlocked = (data: Record<string, unknown>) => {
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  return !!record(data.promptFeedback).blockReason || candidates.some(candidate =>
    ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'].includes(String(record(candidate).finishReason)));
};
/** Gemini refuses to reproduce text it considers published material (here: public legislation). Not a safety refusal, so another provider may answer. */
const isRecitation = (data: Record<string, unknown>) => (Array.isArray(data.candidates) ? data.candidates : [])
  .some(candidate => String(record(candidate).finishReason) === 'RECITATION');

const classify = (status: number, data: Record<string, unknown>): { reason: FailureReason; retry: boolean } => {
  const error = record(data.error);
  const detail = String(error.message ?? '');
  const code = String(error.code ?? error.status ?? '');
  if (['unauthenticated', 'access-denied', 'feature-denied', 'feature-disabled', 'policy-unavailable', 'origin-denied'].includes(code)) return { reason: 'access-denied', retry: false };
  if (status === 401 || status === 403 || /API_KEY_INVALID|UNAUTHENTICATED|PERMISSION_DENIED/.test(code)
    || /api.?key.{0,35}(?:invalid|expired|not valid|rejected)/i.test(detail)) return { reason: 'credentials', retry: true };
  if (status === 413 || code === 'context_length_exceeded' || /context limit|context length|request.{0,15}too large/i.test(detail)) return { reason: 'request-size', retry: true };
  if (status === 429) return { reason: 'rate-limit', retry: true };
  if (code === 'model_unavailable') return { reason: 'unavailable', retry: true };
  if (status === 404 || status === 408 || status >= 500) return { reason: 'unavailable', retry: true };
  return { reason: 'invalid-request', retry: false };
};

/** A shared, in-memory health cache. No keys, requests, or responses are persisted to storage or logs. */
export const createAiRouter = (adapters: Clients = clients, options: { now?: () => number; cooldownMs?: number } = {}) => {
  const now = options.now ?? Date.now;
  const cooldown = options.cooldownMs ?? 60000;
  // Credential references stay in memory only; changed keys/models are immediately eligible again.
  const health = new Map<AiProvider, { key: string; model: string; until: number }>();
  return async ({ keys, preferredProvider = 'gemini', model, models = {}, body, signal, timeoutMs = 20000, allowFallback = true, onAttempt }: RouterRequest): Promise<Response> => {
    if (signal?.aborted) throw abortError();
    if (!body || !Array.isArray(body.contents) || !body.contents.length) {
      return safeError('The AI request has no conversation content.', 400, 'invalid-request');
    }
    try { body = prepareAiRequest(body); }
    catch (error) { return safeError(error instanceof Error ? error.message : 'The AI request is unsupported.', 400, 'invalid-request'); }
    const providers: AiProvider[] = [preferredProvider, ...(allowFallback ? AI_PROVIDERS.filter(provider => provider !== preferredProvider) : [])];
    // Cloudflare is supplied by the server's AI binding, never by a browser account token.
    const configured = providers.filter(provider => !!keys[provider]?.trim() && !!adapters[provider]).map(provider => ({
      provider, key: keys[provider]!.trim(), model: provider === preferredProvider && model ? model : models[provider] || defaultAiModel(provider),
    }));
    if (!configured.length) return safeError('AI is not configured. Check the connection in Admin > API & Integrations.', 503, 'not-configured');
    const cooling = (candidate: typeof configured[number]) => {
      const previous = health.get(candidate.provider);
      return previous?.key === candidate.key && previous.model === candidate.model && previous.until > now();
    };
    const ordered = [...configured.filter(candidate => !cooling(candidate)), ...configured.filter(cooling)];
    const failures: Failure[] = [];
    for (const [index, candidate] of ordered.entries()) {
      if (signal?.aborted) throw abortError();
      try { onAttempt?.({ provider: candidate.provider, model: candidate.model, index }); } catch { /* status display only */ }
      try {
        const { response, data } = await withDeadline(async childSignal => {
          const response = await adapters[candidate.provider]!({ apiKey: candidate.key, model: candidate.model, body, signal: childSignal });
          const data = record(await response.json());
          return { response, data };
        }, signal, timeoutMs);
        if (signal?.aborted) throw abortError();
        // A provider's content refusal is not an outage and must not trigger another provider.
        if (isBlocked(data) || ['content_blocked', 'content_policy_violation', 'content_filter'].includes(String(record(data.error).code))
          || /content policy|prohibited content|safety policy/i.test(String(record(data.error).message ?? ''))) {
          return safeError('The AI provider declined this request. Review the prompt before trying again.', 422, 'content-blocked');
        }
        if (isRecitation(data)) {
          // Question-specific, so the provider is not put into cooldown.
          failures.push({ provider: candidate.provider, status: 422, reason: 'recitation' });
          continue;
        }
        const candidates = Array.isArray(data.candidates) ? data.candidates : [];
        if (response.ok && candidates.some(item => ['MAX_TOKENS', 'length', 'max_tokens'].includes(String(record(item).finishReason)))) {
          failures.push({ provider: candidate.provider, status: 422, reason: 'incomplete-answer' });
          continue;
        }
        if (response.ok && hasText(data)) {
          health.delete(candidate.provider);
          return Response.json(data, { headers: {
            'X-AI-Provider': candidate.provider,
            'X-AI-Model': candidate.model,
            'X-AI-Fallback': String(candidate.provider !== preferredProvider || failures.length > 0),
          } });
        }
        const failure = response.ok ? { reason: 'invalid-response' as const, retry: true } : classify(response.status, data);
        failures.push({ provider: candidate.provider, status: response.ok ? 502 : response.status, reason: failure.reason });
        if (failure.reason === 'access-denied') return safeError('Your account or this feature could not be authorized for the AI connection. Check your Microsoft sign-in and organization access settings.', response.status, 'access-denied');
        if (!failure.retry) return safeError('The AI request could not be processed. Check the input and selected model.', response.status, 'invalid-request');
        if (failure.reason !== 'request-size') health.set(candidate.provider, { key: candidate.key, model: candidate.model, until: now() + cooldown });
      } catch (error) {
        if (signal?.aborted) throw abortError();
        const name = error instanceof Error ? error.name : record(error).name;
        const retryable = ['AiTimeoutError', 'TypeError', 'SyntaxError', 'GroqResponseError', 'CloudflareResponseError'].includes(String(name));
        if (!retryable) return safeError('The AI request could not be prepared. Check that its content is supported.', 400, 'invalid-request');
        const reason = name === 'AiTimeoutError' ? 'timeout' : name === 'TypeError' ? 'network' : 'invalid-response';
        failures.push({ provider: candidate.provider, status: reason === 'timeout' ? 504 : 502, reason });
        health.set(candidate.provider, { key: candidate.key, model: candidate.model, until: now() + cooldown });
      }
    }
    // Staff-facing wording: name the cause and the next step. HTTP codes are omitted because a
    // browser network failure has none, and the API settings page is for administrators only.
    const details = failures.map(failure => `${AI_PROVIDER_NAMES[failure.provider]}: ${failure.reason}`).join('; ');
    if (failures.some(failure => failure.reason === 'incomplete-answer')) return safeError('The AI answer was incomplete and has been withheld. Ask a narrower question or request a shorter answer.', 422, 'incomplete-answer');
    if (failures.some(failure => failure.reason === 'recitation')) return safeError(`The AI service would not reproduce the Act's wording for this question. Ask for a plain-English explanation instead. (${details})`, 422, 'recitation');
    if (failures.length && failures.every(failure => ['network', 'timeout'].includes(failure.reason))) {
      return safeError(`The AI service could not be reached in time. Check your connection, then try again. (${details})`, failures[failures.length - 1]?.status ?? 503, 'providers-unavailable');
    }
    return safeError(`The AI service did not answer this time. Please try again in a minute; if it keeps happening, tell IT. (${details})`, failures[failures.length - 1]?.status ?? 503, 'providers-unavailable');
  };
};

export const generateAiContent = createAiRouter();
/** Adds only an authenticated Cloudflare adapter; legacy provider credentials never go to it. */
export const createAiRouterWithCloudflare = (cloudflare: AiClient) => createAiRouter({ ...clients, cloudflare });

export const readAiRoute = (response: Response): AiRoute | undefined => {
  const provider = response.headers.get('X-AI-Provider');
  if (!isAiProvider(provider)) return undefined;
  return { provider, model: response.headers.get('X-AI-Model') || defaultAiModel(provider), usedFallback: response.headers.get('X-AI-Fallback') === 'true' };
};
