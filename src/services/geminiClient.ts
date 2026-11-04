/**
 * geminiClient
 *
 * One place that sends generateContent requests to the Gemini API, so every
 * caller gets the same handling of Google's temporary failures:
 *
 * - 503 / 500 / 504 (overloaded) and 429 (rate limited) on the first model are
 *   retried after 1s and 2s.
 * - If the first model still fails that way, or returns 404 (model retired or
 *   closed to this key), each fallback model is tried once.
 * - 400 / 401 / 403 (bad request or rejected key) are returned straight away:
 *   another model would fail the same way.
 *
 * Returns the fetch Response, so callers keep their existing `response.ok` /
 * `response.json()` handling. On total failure the last error response is returned.
 */

import { GEMINI_CHAT_FALLBACK_MODELS, GEMINI_CHAT_MODEL } from '@/config/geminiModels';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Statuses worth retrying on the same model after a short wait. */
const RETRY_SAME_MODEL = new Set([429, 500, 503, 504]);
/** Statuses where a different model may succeed. */
const TRY_NEXT_MODEL = new Set([404, 429, 500, 503, 504]);

export interface GeminiRequestOptions {
  apiKey: string;
  /** The generateContent request body (contents, system_instruction, generationConfig...). */
  body: unknown;
  /** Defaults to GEMINI_CHAT_MODEL. */
  model?: string;
  /** Defaults to GEMINI_CHAT_FALLBACK_MODELS. Pass [] to disable fallback. */
  fallbackModels?: readonly string[];
  signal?: AbortSignal;
  /** Extra attempts on the first model for retryable statuses. Defaults to 2. */
  retries?: number;
}

const abortError = () => new DOMException('The request was aborted.', 'AbortError');

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

export const generateGeminiContent = async ({
  apiKey,
  body,
  model = GEMINI_CHAT_MODEL,
  fallbackModels = GEMINI_CHAT_FALLBACK_MODELS,
  signal,
  retries = 2,
}: GeminiRequestOptions): Promise<Response> => {
  const key = apiKey.trim();
  const payload = JSON.stringify(body);
  const models = Array.from(new Set([model, ...fallbackModels]));

  let lastResponse: Response | undefined;

  for (let m = 0; m < models.length; m++) {
    const attempts = m === 0 ? retries + 1 : 1;

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) await wait(1000 * 2 ** (attempt - 1), signal);

      const response = await fetch(`${GEMINI_BASE_URL}/${models[m]}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal,
      });

      if (response.ok) {
        if (m > 0) {
          console.warn(`[Gemini] ${models[0]} unavailable (HTTP ${lastResponse?.status}); answered by ${models[m]}.`);
        }
        return response;
      }

      lastResponse = response;
      if (!RETRY_SAME_MODEL.has(response.status)) break;
    }

    if (!lastResponse || !TRY_NEXT_MODEL.has(lastResponse.status)) break;
  }

  return lastResponse as Response;
};
