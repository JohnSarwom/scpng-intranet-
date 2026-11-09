import { beforeEach, describe, expect, it } from 'vitest';
import { FrontDeskGraph, resetFrontDeskGraphCache } from './frontDeskGraph';
import { fakeGraphClient } from './testing/fakeGraphClient';
import { visitorQueries, VisitorsService } from './visitorsService';
import type { FrontDeskVisitor } from './visitorRules';

const SITE = '/sites/scpng1.sharepoint.com:/sites/scpngintranet';
const LISTS = '/sites/site-1/lists?$select=id,displayName&$top=200';
const ITEMS = '/sites/site-1/lists/list-v/items';
const base = {
  [SITE]: { id: 'site-1' },
  [LISTS]: { value: [{ id: 'list-v', displayName: 'FrontDesk_Visitors' }, { id: 'list-p', displayName: 'FrontDesk_VisitorPhotos' }] },
};
const now = '2026-10-26T02:00:00.000Z';

function service(responses: Record<string, unknown> = {}, onWrite?: Parameters<typeof fakeGraphClient>[1]) {
  const fake = fakeGraphClient({ ...base, ...responses }, onWrite);
  return { svc: new VisitorsService(new FrontDeskGraph(fake.client)), calls: fake.calls };
}

describe('VisitorsService', () => {
  beforeEach(() => resetFrontDeskGraphCache());

  it('reads a day by the indexed VisitDate range, and on-site visitors by the indexed Status', async () => {
    expect(visitorQueries.byDate('2026-10-26'))
      .toBe("&$filter=fields/VisitDate ge '2026-10-25T14:00:00.000Z' and fields/VisitDate lt '2026-10-26T14:00:00.000Z'");
    const { svc } = service({
      [`${ITEMS}?$expand=fields&$top=200${visitorQueries.byDate('2026-10-26')}`]: { value: [{ id: '1', fields: { Title: 'A', VisitDate: '2026-10-25T14:00:00Z' } }] },
      [`${ITEMS}?$expand=fields&$top=200${visitorQueries.onSite()}`]: { value: [] },
    });
    expect((await svc.listByDate('2026-10-26')).map(v => [v.id, v.visitDate])).toEqual([['1', '2026-10-26']]);
    expect(await svc.listOnSite()).toEqual([]);
  });

  it('creates a walk-in On Site with Time In now and who logged them', async () => {
    const { svc, calls } = service({}, call => ({ id: '9', fields: (call.body as { fields: object }).fields }));
    const created = await svc.create({ name: 'Mary K', reason: 'Delivery', visitDate: '2026-10-26' }, 'On Site', 'r@scpng.gov.pg', now);
    expect(calls.find(c => c.method === 'post')?.body).toEqual({
      fields: { Title: 'Mary K', VisitDate: '2026-10-26T00:00:00Z', Reason: 'Delivery', Status: 'On Site', LoggedByEmail: 'r@scpng.gov.pg', TimeIn: now },
    });
    expect(created).toMatchObject({ id: '9', status: 'On Site', timeIn: now });
  });

  it('signs out with the eTag, and refuses a sign-out before anyone signed in', async () => {
    const { svc, calls } = service();
    const onSite: FrontDeskVisitor = { id: '3', eTag: '"e,2"', name: 'A', company: '', reason: 'R', visitDate: '2026-10-26', status: 'On Site', timeIn: '2026-10-26T01:00:00.000Z' };
    await svc.changeStatus(onSite, 'Signed Out', now, 'r@scpng.gov.pg');
    expect(calls.filter(c => c.method === 'patch')).toEqual([{
      method: 'patch', url: `${ITEMS}/3/fields`, headers: { 'If-Match': '"e,2"' },
      body: { Status: 'Signed Out', TimeOut: now, SignedOutByEmail: 'r@scpng.gov.pg' },
    }]);
    await expect(svc.changeStatus({ ...onSite, status: 'Expected', timeIn: undefined }, 'Signed Out', now, '')).rejects.toThrow('Sign the visitor in');
    expect(calls.filter(c => c.method === 'patch')).toHaveLength(1);
  });

  it('corrects times on edit but never sets or clears them', async () => {
    const { svc, calls } = service();
    const out: FrontDeskVisitor = { id: '4', name: 'A', company: '', reason: 'R', visitDate: '2026-10-26', status: 'Signed Out', timeIn: '2026-10-26T01:00:00.000Z', timeOut: now };
    await svc.update(out, { name: 'A', reason: 'R', visitDate: '2026-10-26', timeIn: '2026-10-26T00:30:00.000Z', timeOut: '' });
    expect(calls.find(c => c.method === 'patch')?.body).toMatchObject({ TimeIn: '2026-10-26T00:30:00.000Z', TimeOut: now });
    await expect(svc.update(out, { name: 'A', reason: 'R', visitDate: '2026-10-26', timeIn: '2026-10-26T03:00:00.000Z' }))
      .rejects.toThrow('cannot be earlier');

    const expected: FrontDeskVisitor = { ...out, id: '5', status: 'Expected', timeIn: undefined, timeOut: undefined };
    await svc.update(expected, { name: 'A', reason: 'R', visitDate: '2026-10-26', timeIn: now });
    expect(calls.filter(c => c.method === 'patch').at(-1)?.body).not.toHaveProperty('TimeIn');
  });

  it('uploads a photo to the library folder and stores only its link', async () => {
    const { svc, calls } = service({ '/sites/site-1/lists/list-p/drive': { id: 'drive-p' } },
      call => (call.method === 'put' ? { id: 'f1', webUrl: 'https://scpng1.sharepoint.com/photo.jpg' } : {}));
    const file = new File(['x'], 'cam.jpg', { type: 'image/jpeg' });
    expect(await svc.attachPhoto('12', file, new Date('2026-10-26T01:02:03Z'))).toBe('https://scpng1.sharepoint.com/photo.jpg');
    expect(calls.filter(c => c.method !== 'get').map(c => [c.method, c.url, c.headers])).toEqual([
      ['put', '/drives/drive-p/root:/2026/10/12-20261026010203.jpg:/content', { 'Content-Type': 'image/jpeg' }],
      ['patch', `${ITEMS}/12/fields`, undefined],
    ]);
  });
});
