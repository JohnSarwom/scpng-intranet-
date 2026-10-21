import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IPublicClientApplication } from '@azure/msal-browser';
const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('./graphService', () => ({ getGraphClient: async () => ({}) }));
vi.mock('./newsletterSharePointTransport', () => ({
  NewsletterSharePointTransport: class { execute = mocks.execute; },
}));
import { NewsletterService } from './newsletterService';

function context() {
  let identity = 'first';
  const msal = { getActiveAccount: () => ({ homeAccountId: identity, tenantId: 'tenant' }) } as unknown as IPublicClientApplication;
  return { msal, changeIdentity: () => { identity = 'second'; } };
}
describe('newsletter read queue pressure', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_NEWSLETTER_REQUEST_SITE_ID', 'site');
    vi.stubEnv('VITE_NEWSLETTER_REQUEST_LIST_ID', 'requests');
    vi.stubEnv('VITE_NEWSLETTER_REQUEST_PARTS_LIST_ID', 'parts');
    mocks.execute.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());
  it('joins concurrent identical reads across consumers, then fetches anew after completion', async () => {
    let finish!: (value: unknown) => void;
    mocks.execute.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { msal } = context();
    const first = new NewsletterService(msal).routingSettings();
    const second = new NewsletterService(msal).routingSettings();
    await Promise.resolve();
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    finish({ roster: [] });
    expect(await first).toEqual(await second);
    mocks.execute.mockResolvedValue({ roster: [] });
    await new NewsletterService(msal).routingSettings();
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });
  it('never joins different accounts, records, or mutations', async () => {
    mocks.execute.mockResolvedValue({});
    const ctx = context();
    const service = new NewsletterService(ctx.msal);
    const requests = [service.request('notifications'), service.get('one'), service.get('two'), service.create(), service.create()];
    ctx.changeIdentity();
    requests.push(service.request('notifications'));
    await Promise.all(requests);
    expect(mocks.execute).toHaveBeenCalledTimes(6);
  });
  it('clears failed reads so an explicit refresh can check again', async () => {
    mocks.execute.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce([]);
    const service = new NewsletterService(context().msal);
    await expect(service.request('notifications')).rejects.toThrow('Unavailable');
    await expect(service.request('notifications')).resolves.toEqual([]);
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });
});
