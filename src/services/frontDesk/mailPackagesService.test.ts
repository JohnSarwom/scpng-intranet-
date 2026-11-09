import { beforeEach, describe, expect, it } from 'vitest';
import { FrontDeskGraph, resetFrontDeskGraphCache } from './frontDeskGraph';
import { MailPackagesService, mailQueries } from './mailPackagesService';
import type { FrontDeskMailItem } from './mailRules';
import { fakeGraphClient } from './testing/fakeGraphClient';

const SITE = '/sites/scpng1.sharepoint.com:/sites/scpngintranet';
const LISTS = '/sites/site-1/lists?$select=id,displayName&$top=200';
const ITEMS = '/sites/site-1/lists/list-m/items';
const base = { [SITE]: { id: 'site-1' }, [LISTS]: { value: [{ id: 'list-m', displayName: 'FrontDesk_MailPackages' }] } };
const read = (query: string) => `${ITEMS}?$expand=fields&$top=200${query}`;

function service(responses: Record<string, unknown> = {}, onWrite?: Parameters<typeof fakeGraphClient>[1]) {
  const fake = fakeGraphClient({ ...base, ...responses }, onWrite);
  return { svc: new MailPackagesService(new FrontDeskGraph(fake.client)), calls: fake.calls };
}

const waiting: FrontDeskMailItem = {
  id: '3', eTag: '"m,2"', itemType: 'Package', title: 'Box', recipientName: 'Mary K', receivedAt: '2026-11-09T23:00:00.000Z', status: 'Pending Pickup',
};

describe('MailPackagesService', () => {
  beforeEach(() => resetFrontDeskGraphCache());

  it('reads a period on the indexed ReceivedAt, and outstanding items one indexed status at a time', async () => {
    const { svc } = service({
      [read(mailQueries.receivedBetween('2026-11-09T14:00:00.000Z', '2026-11-10T14:00:00.000Z'))]: { value: [{ id: '1', fields: { Title: 'A', Status: 'Delivered' } }] },
      [read(mailQueries.withStatus('Received'))]: { value: [{ id: '2', fields: { Title: 'B', Status: 'Received' } }] },
      [read(mailQueries.withStatus('Pending Pickup'))]: { value: [] },
      [read(mailQueries.withStatus('Signature Required'))]: { value: [{ id: '3', fields: { Title: 'C', Status: 'Signature Required' } }] },
    });
    expect((await svc.listReceivedBetween('2026-11-09T14:00:00.000Z', '2026-11-10T14:00:00.000Z')).map(i => i.id)).toEqual(['1']);
    expect((await svc.listOutstanding()).map(i => i.id)).toEqual(['2', '3']);
  });

  it('logs a new item with who logged it', async () => {
    const { svc, calls } = service({}, call => ({ id: '9', fields: (call.body as { fields: object }).fields }));
    await svc.create({ itemType: 'Mail', title: 'Letter', recipientName: 'Mary K', receivedAt: '2026-11-09T23:00:00.000Z', status: 'Received' }, 'r@scpng.gov.pg');
    expect(calls.find(c => c.method === 'post')?.body).toMatchObject({ fields: { Title: 'Letter', LoggedByEmail: 'r@scpng.gov.pg' } });
  });

  it('records the collection with the eTag, and refuses one without a name before writing', async () => {
    const { svc, calls } = service();
    await svc.changeStatus(waiting, 'Delivered', { collectedBy: 'Mary K', collectedAt: '2026-11-10T01:00:00.000Z' });
    expect(calls.filter(c => c.method === 'patch')).toEqual([{
      method: 'patch', url: `${ITEMS}/3/fields`, headers: { 'If-Match': '"m,2"' },
      body: { Status: 'Delivered', CollectedBy: 'Mary K', CollectedAt: '2026-11-10T01:00:00.000Z' },
    }]);
    await expect(svc.changeStatus(waiting, 'Delivered', { collectedBy: ' ', collectedAt: '2026-11-10T01:00:00.000Z' })).rejects.toThrow('who collected');
    expect(calls.filter(c => c.method === 'patch')).toHaveLength(1);
  });
});
