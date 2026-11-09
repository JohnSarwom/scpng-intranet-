import { beforeEach, describe, expect, it } from 'vitest';
import { FrontDeskGraph, resetFrontDeskGraphCache } from './frontDeskGraph';
import { InquiriesService, inquiryQueries } from './inquiriesService';
import type { FrontDeskInquiry } from './inquiryRules';
import { fakeGraphClient } from './testing/fakeGraphClient';

const SITE = '/sites/scpng1.sharepoint.com:/sites/scpngintranet';
const LISTS = '/sites/site-1/lists?$select=id,displayName&$top=200';
const ITEMS = '/sites/site-1/lists/list-i/items';
const base = { [SITE]: { id: 'site-1' }, [LISTS]: { value: [{ id: 'list-i', displayName: 'FrontDesk_Inquiries' }] } };
const read = (query: string) => `${ITEMS}?$expand=fields&$top=200${query}`;

function service(responses: Record<string, unknown> = {}, onWrite?: Parameters<typeof fakeGraphClient>[1]) {
  const fake = fakeGraphClient({ ...base, ...responses }, onWrite);
  return { svc: new InquiriesService(new FrontDeskGraph(fake.client)), calls: fake.calls };
}

const inquiry: FrontDeskInquiry = {
  id: '5', eTag: '"i,4"', title: 'Lift stuck', category: 'Facilities', priority: 'High', status: 'In Progress', reportedAt: '2026-11-09T23:00:00.000Z',
};

describe('InquiriesService', () => {
  beforeEach(() => resetFrontDeskGraphCache());

  it('reads a period on the indexed ReportedAt, and open inquiries one indexed status at a time', async () => {
    const { svc } = service({
      [read(inquiryQueries.reportedBetween('2026-11-09T14:00:00.000Z', '2026-11-10T14:00:00.000Z'))]: { value: [{ id: '1', fields: { Title: 'A', Status: 'Resolved' } }] },
      [read(inquiryQueries.withStatus('Open'))]: { value: [{ id: '2', fields: { Title: 'B', Status: 'Open' } }] },
      [read(inquiryQueries.withStatus('In Progress'))]: { value: [{ id: '3', fields: { Title: 'C', Status: 'In Progress' } }] },
    });
    expect((await svc.listReportedBetween('2026-11-09T14:00:00.000Z', '2026-11-10T14:00:00.000Z')).map(i => i.id)).toEqual(['1']);
    expect((await svc.listOpen()).map(i => i.id)).toEqual(['2', '3']);
  });

  it('logs a new inquiry with who logged it', async () => {
    const { svc, calls } = service({}, call => ({ id: '9', fields: (call.body as { fields: object }).fields }));
    const saved = await svc.create({ title: 'Lift stuck', category: 'Facilities', priority: 'High', status: 'Open', reportedAt: '2026-11-09T23:00:00.000Z' }, 'r@scpng.gov.pg');
    expect(calls.find(c => c.method === 'post')?.body).toMatchObject({ fields: { Title: 'Lift stuck', Status: 'Open', LoggedByEmail: 'r@scpng.gov.pg' } });
    expect(saved).toMatchObject({ id: '9', title: 'Lift stuck', status: 'Open' });
  });

  it('saves an edit against the eTag it was loaded with, and deletes with it', async () => {
    const { svc, calls } = service();
    await svc.update(inquiry, { title: 'Lift stuck', category: 'Facilities', priority: 'High', status: 'Resolved', reportedAt: inquiry.reportedAt }, 'r@scpng.gov.pg');
    const patch = calls.find(c => c.method === 'patch');
    expect(patch).toMatchObject({ url: `${ITEMS}/5/fields`, headers: { 'If-Match': '"i,4"' }, body: { Status: 'Resolved' } });
    expect((patch?.body as Record<string, unknown>).ResolvedAt).toEqual(expect.any(String));
    await svc.remove(inquiry);
    expect(calls.find(c => c.method === 'delete')).toMatchObject({ url: `${ITEMS}/5`, headers: { 'If-Match': '"i,4"' } });
  });
});
