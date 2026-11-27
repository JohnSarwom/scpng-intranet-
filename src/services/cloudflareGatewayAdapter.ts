import type { AiClient, AiRequest } from './aiService.ts';

/** The gateway receives a Microsoft access token and this request's evidence, never provider keys. */
export function createCloudflareGatewayAdapter({ getToken, send }: {
  getToken: () => Promise<string>;
  send: (value: { request: AiRequest; token: string; signal: AbortSignal }) => Promise<Response>;
}): AiClient {
  return async ({ body, model, signal }) => {
    if (signal.aborted) throw new DOMException('Cancelled.', 'AbortError');
    let token: string;
    try { token = await getToken(); }
    catch {
      if (signal.aborted) throw new DOMException('Cancelled.', 'AbortError');
      return Response.json({ error: { code: 'unauthenticated', message: 'Microsoft sign-in could not authorize Cloudflare.' } }, { status: 401 });
    }
    if (signal.aborted) throw new DOMException('Cancelled.', 'AbortError');
    try {
      return await send({ request: { body, model, preferredProvider: 'cloudflare', allowFallback: false }, token, signal });
    } catch {
      if (signal.aborted) throw new DOMException('Cancelled.', 'AbortError');
      throw new TypeError('The Cloudflare connection could not be reached.');
    }
  };
}
