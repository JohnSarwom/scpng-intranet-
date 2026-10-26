import type { Client } from '@microsoft/microsoft-graph-client';

export interface FakeCall {
  method: 'get' | 'post' | 'patch' | 'delete';
  url: string;
  body?: unknown;
  /** Only present when the request set headers, e.g. `If-Match`. */
  headers?: Record<string, string>;
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
    api: (url: string) => {
      const headers: Record<string, string> = {};
      const record = (call: FakeCall) => {
        if (Object.keys(headers).length) call.headers = { ...headers };
        calls.push(call);
        return call;
      };
      const request = {
        header: (name: string, value: string) => { headers[name] = value; return request; },
        get: async () => { record({ method: 'get', url }); return answer(url); },
        post: async (body: unknown) => onWrite(record({ method: 'post', url, body })),
        patch: async (body: unknown) => onWrite(record({ method: 'patch', url, body })),
        delete: async () => onWrite(record({ method: 'delete', url })),
      };
      return request;
    },
  } as unknown as Client;
  return { client, calls };
}
