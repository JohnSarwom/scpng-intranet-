/** Public endpoint only. Provider secrets must never be placed in a VITE_ variable. */
export const AI_GATEWAY_URL = (import.meta.env.VITE_AI_GATEWAY_URL as string | undefined)?.trim() || '';
export const USE_AI_GATEWAY = !!AI_GATEWAY_URL;
export const AI_GATEWAY_SCOPE = (import.meta.env.VITE_AI_GATEWAY_SCOPE as string | undefined)?.trim() || '';
/** Optional Cloudflare-only connection; existing Gemini/Groq routing stays available. */
export const CLOUDFLARE_GATEWAY_URL = (import.meta.env.VITE_CLOUDFLARE_GATEWAY_URL as string | undefined)?.trim() || '';
export const CLOUDFLARE_GATEWAY_SCOPE = (import.meta.env.VITE_CLOUDFLARE_GATEWAY_SCOPE as string | undefined)?.trim() || '';
export const USE_CLOUDFLARE_GATEWAY = !USE_AI_GATEWAY && !!CLOUDFLARE_GATEWAY_URL;
