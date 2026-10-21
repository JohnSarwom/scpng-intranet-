import { beforeEach, describe, expect, it } from 'vitest';
import { FrontDeskGraph, FrontDeskListMissingError, resetFrontDeskGraphCache } from './frontDeskGraph';
import { fakeGraphClient } from './testing/fakeGraphClient';

const SITE = '/sites/scpng1.sharepoint.com:/sites/scpngintranet';
const LISTS = '/sites/site-1/lists?$select=id,displayName&$top=200';

const baseResponses: Record<string, unknown> = {
  [SITE]: { id: 'site-1' },
  [LISTS]: { value: [{ id: 'list-v', displayName: 'FrontDesk_Visitors' }] },
};

describe('FrontDeskGraph', () => {
  beforeEach(() => resetFrontDeskGraphCache());

  it('follows page links and refuses a repeated link', async () => {
    const { client } = fakeGraphClient({
      '/one': { value: [1, 2], '@odata.nextLink': '/two' },
      '/two': { value: [3] },
      '/loop': { value: [1], '@odata.nextLink': '/loop' },
    });
    const graph = new FrontDeskGraph(client);
    expect(await graph.collectPages<number>('/one')).toEqual([1, 2, 3]);
    await expect(graph.collectPages('/loop')).rejects.toThrow('repeated page link');
  });

  it('rejects a page without a value array', async () => {
    const { client } = fakeGraphClient({ '/bad': { error: 'x' } });
    await expect(new FrontDeskGraph(client).collectPages('/bad')).rejects.toThrow('invalid list response');
  });

  it('resolves the site and list once and caches them across instances', async () => {
    const { client, calls } = fakeGraphClient(baseResponses);
    expect(await new FrontDeskGraph(client).resolveListId('FrontDesk_Visitors')).toBe('list-v');
    expect(await new FrontDeskGraph(client).resolveListId('FrontDesk_Visitors')).toBe('list-v');
    expect(calls.filter(c => c.method === 'get')).toHaveLength(2);
  });

  it('names the missing list and points to the setup when a list does not exist', async () => {
    const { client } = fakeGraphClient(baseResponses);
    const error = await new FrontDeskGraph(client).resolveListId('FrontDesk_Inquiries').catch(e => e);
    expect(error).toBeInstanceOf(FrontDeskListMissingError);
    expect(error.message).toContain('FrontDesk_Inquiries');
    expect(error.message).toContain('TestGround');
  });

  it('creates, updates and deletes items on the resolved list', async () => {
    const { client, calls } = fakeGraphClient(baseResponses, call => (call.method === 'post' ? { id: '7' } : {}));
    const graph = new FrontDeskGraph(client);
    expect(await graph.createItem('FrontDesk_Visitors', { Title: 'A Visitor' })).toEqual({ id: '7' });
    await graph.updateFields('FrontDesk_Visitors', '7', { Status: 'On Site' });
    await graph.deleteItem('FrontDesk_Visitors', '7');
    expect(calls.filter(c => c.method !== 'get')).toEqual([
      { method: 'post', url: '/sites/site-1/lists/list-v/items', body: { fields: { Title: 'A Visitor' } } },
      { method: 'patch', url: '/sites/site-1/lists/list-v/items/7/fields', body: { Status: 'On Site' } },
      { method: 'delete', url: '/sites/site-1/lists/list-v/items/7' },
    ]);
  });

  it('reads items with their fields and appends the query', async () => {
    const { client } = fakeGraphClient({
      ...baseResponses,
      "/sites/site-1/lists/list-v/items?$expand=fields&$top=200&$filter=fields/Status eq 'On Site'": {
        value: [{ id: '1', fields: { Title: 'A Visitor' } }],
      },
    });
    const items = await new FrontDeskGraph(client).getItems('FrontDesk_Visitors', "&$filter=fields/Status eq 'On Site'");
    expect(items).toEqual([{ id: '1', fields: { Title: 'A Visitor' } }]);
  });
});
