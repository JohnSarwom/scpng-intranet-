import { beforeEach, describe, expect, it } from 'vitest';
import { ensureFrontDeskLists, FRONT_DESK_SCHEMAS } from './frontDeskListSetup';
import { resetFrontDeskGraphCache } from './frontDeskGraph';
import { fakeGraphClient } from './testing/fakeGraphClient';

const SITE = '/sites/scpng1.sharepoint.com:/sites/scpngintranet';
const LISTS = '/sites/site-1/lists?$select=id,displayName&$top=200';
const VISITOR_COLUMNS = '/sites/site-1/lists/list-v/columns?$select=id,name,indexed&$top=200';
const visitorSchema = FRONT_DESK_SCHEMAS.find(s => s.name === 'FrontDesk_Visitors')!;

/** The visitors list exists without BadgeNo/PhotoUrl and with VisitDate not yet indexed. */
function partlySetUp() {
  const columns = [
    { id: 'c-title', name: 'Title', indexed: false },
    ...visitorSchema.columns
      .filter(c => c.name !== 'BadgeNo' && c.name !== 'PhotoUrl')
      .map(c => ({ id: `c-${c.name}`, name: c.name, indexed: c.name === 'VisitDate' ? false : !!c.indexed })),
  ];
  return {
    [SITE]: { id: 'site-1' },
    [LISTS]: { value: [{ id: 'list-v', displayName: 'FrontDesk_Visitors' }] },
    [VISITOR_COLUMNS]: { value: columns },
  };
}

describe('ensureFrontDeskLists', () => {
  beforeEach(() => resetFrontDeskGraphCache());

  it('only reports in check mode and writes nothing', async () => {
    const { client, calls } = fakeGraphClient(partlySetUp());
    const results = await ensureFrontDeskLists(client, { dryRun: true });
    expect(calls.filter(c => c.method !== 'get')).toEqual([]);
    expect(results.find(r => r.name === 'FrontDesk_Visitors')).toMatchObject({
      status: 'needs-update', addedColumns: ['BadgeNo', 'PhotoUrl'], indexedColumns: ['VisitDate'],
    });
    expect(results.filter(r => r.status === 'missing').map(r => r.name)).toEqual([
      'FrontDesk_Appointments', 'FrontDesk_MailPackages', 'FrontDesk_Inquiries',
      'FrontDesk_Tickets', 'FrontDesk_TicketGroups', 'FrontDesk_TicketComments', 'FrontDesk_VisitorPhotos',
    ]);
  });

  it('adds only missing columns and indexes, and creates missing lists with all their columns', async () => {
    let created = 0;
    const { client, calls } = fakeGraphClient(partlySetUp(), call =>
      call.method === 'post' && call.url === '/sites/site-1/lists' ? { id: `new-${++created}` } : {});
    const results = await ensureFrontDeskLists(client);

    const writes = calls.filter(c => c.method !== 'get');
    const visitorWrites = writes.filter(c => c.url.startsWith('/sites/site-1/lists/list-v/'));
    expect(visitorWrites.map(c => [c.method, c.url, (c.body as { name?: string }).name ?? c.body])).toEqual([
      ['post', '/sites/site-1/lists/list-v/columns', 'BadgeNo'],
      ['post', '/sites/site-1/lists/list-v/columns', 'PhotoUrl'],
      ['patch', '/sites/site-1/lists/list-v/columns/c-VisitDate', { indexed: true }],
    ]);

    const appointments = FRONT_DESK_SCHEMAS.find(s => s.name === 'FrontDesk_Appointments')!;
    const listCreate = writes.find(c => c.url === '/sites/site-1/lists' && (c.body as { displayName: string }).displayName === 'FrontDesk_Appointments');
    expect(listCreate?.body).toMatchObject({ list: { template: 'genericList' } });
    const appointmentListId = `new-${writes.filter(c => c.url === '/sites/site-1/lists').indexOf(listCreate!) + 1}`;
    expect(writes.filter(c => c.url === `/sites/site-1/lists/${appointmentListId}/columns`).map(c => (c.body as { name: string }).name))
      .toEqual(appointments.columns.map(c => c.name));

    expect(writes.find(c => (c.body as { displayName?: string })?.displayName === 'FrontDesk_VisitorPhotos')?.body)
      .toMatchObject({ list: { template: 'documentLibrary' } });
    expect(results.map(r => r.status)).toEqual(['updated', 'created', 'created', 'created', 'created', 'created', 'created', 'created']);
  });

  it('leaves a complete, indexed list untouched', async () => {
    const responses = partlySetUp();
    responses[VISITOR_COLUMNS] = {
      value: visitorSchema.columns.map(c => ({ id: `c-${c.name}`, name: c.name, indexed: !!c.indexed })),
    };
    const { client, calls } = fakeGraphClient(responses, () => { throw new Error('should not write to visitors'); });
    const results = await ensureFrontDeskLists(client, { dryRun: true });
    expect(results[0]).toMatchObject({ name: 'FrontDesk_Visitors', status: 'ok', addedColumns: [], indexedColumns: [] });
    expect(calls.filter(c => c.method !== 'get')).toEqual([]);
  });

  it('reports a failing list and still sets up the others', async () => {
    let created = 0;
    const { client } = fakeGraphClient(partlySetUp(), call => {
      if (call.url === '/sites/site-1/lists' && (call.body as { displayName: string }).displayName === 'FrontDesk_MailPackages') {
        throw Object.assign(new Error('Access denied'), { code: 'accessDenied' });
      }
      return call.url === '/sites/site-1/lists' ? { id: `new-${++created}` } : {};
    });
    const results = await ensureFrontDeskLists(client);
    expect(results.find(r => r.name === 'FrontDesk_MailPackages')).toMatchObject({ status: 'failed', error: 'Access denied' });
    expect(results.find(r => r.name === 'FrontDesk_Inquiries')?.status).toBe('created');
  });

  it('indexes the columns the app filters on', () => {
    const indexedNames = FRONT_DESK_SCHEMAS.flatMap(s => s.columns.filter(c => c.indexed).map(c => `${s.name}.${c.name}`));
    expect(indexedNames).toEqual([
      'FrontDesk_Visitors.VisitDate', 'FrontDesk_Visitors.Status', 'FrontDesk_Appointments.StartDateTime',
      'FrontDesk_MailPackages.ReceivedAt', 'FrontDesk_Inquiries.ReportedAt', 'FrontDesk_TicketComments.TicketId',
    ]);
  });
});
