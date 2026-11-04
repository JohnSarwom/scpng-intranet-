/**
 * Gemini model IDs used across the intranet. Change them here only.
 *
 * Checked against Google's model list on 2026-11-04
 * (https://aistudio.google.com/docs/models and /docs/deprecations):
 * - gemini-3.8-flash       current stable Flash (GA 2026-09-02)
 * - gemini-3.5-flash-lite  current stable Flash-Lite (GA 2026-07-21)
 *
 * The 2.5 models are closed to new API keys (since 2026-09-18) and
 * gemini-2.5-flash shuts down from 2026-12-01, so a new key gets
 * HTTP 404 "no longer available to new users" on them.
 */

/** Chat assistants (AI Hub, Strategy, Division, Regulatory, Website Analytics). */
export const GEMINI_CHAT_MODEL = 'gemini-3.8-flash';

/** Light text work such as the Improve with AI button. */
export const GEMINI_LITE_MODEL = 'gemini-3.5-flash-lite';

/**
 * Tried in order when the chat model stays overloaded (503) or is unavailable (404).
 * gemini-3.6-flash is the previous-generation stable Flash; Flash-Lite is the last resort.
 */
export const GEMINI_CHAT_FALLBACK_MODELS: readonly string[] = ['gemini-3.6-flash', GEMINI_LITE_MODEL];

/** Tried when the Flash-Lite model is overloaded or unavailable. */
export const GEMINI_LITE_FALLBACK_MODELS: readonly string[] = [GEMINI_CHAT_MODEL];

/**
 * Model IDs that are retired, closed to new keys, or no longer offered in the
 * admin dropdown, mapped to the model to use instead. Applied to saved settings
 * so an old value never reaches Google.
 */
export const GEMINI_MODEL_REPLACEMENTS: Record<string, string> = {
  'gemini-2.5-flash': GEMINI_CHAT_MODEL,
  'gemini-2.5-flash-lite': GEMINI_LITE_MODEL,
  'gemini-2.0-flash': GEMINI_CHAT_MODEL,
  'gemini-2.0-flash-lite': GEMINI_LITE_MODEL,
  'gemini-3.7-flash': GEMINI_CHAT_MODEL,
  // Moving alias whose target Google does not publish; pinned to a known model instead.
  'gemini-flash-latest': GEMINI_CHAT_MODEL,
};
