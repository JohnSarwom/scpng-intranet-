import type { Client } from '@microsoft/microsoft-graph-client';

export interface FakeCall {
  method: 'get' | 'post' | 'patch' | 'delete';
  url: string;
  body?: unknown;
}

/**
 * Minimal stand-in for the Graph client: GET answers come from `responses` (keyed by URL,
 * or a function for dynamic answers); writes are recorded and answered by `onWrite`.
 */
export function fakeGraphClient(
  responses: Record<string, unknown> | ((url: string) => unknown),
  onWrite: (call: FakeCall) => unknown = () => ({}),
) {
  const calls: FakeCall[] = [];
  const answer = (url: string) => {
    const value = typeof responses === 'function' ? responses(url) : responses[url];
    if (value === undefined) throw new Error(`Unexpected GET ${url}`);
    return value;
  };
  const client = {
    api: (url: string) => ({
      get: async () => { calls.push({ method: 'get', url }); return answer(url); },
      post: async (body: unknown) => { const call = { method: 'post' as const, url, body }; calls.push(call); return onWrite(call); },
      patch: async (body: unknown) => { const call = { method: 'patch' as const, url, body }; calls.push(call); return onWrite(call); },
      delete: async () => { const call = { method: 'delete' as const, url }; calls.push(call); return onWrite(call); },
    }),
  } as unknown as Client;
  return { client, calls };
}
