import { beforeEach, describe, expect, it } from 'vitest';
import type { FrontDeskAppointment } from './appointmentRules';
import { appointmentQueries, AppointmentsService } from './appointmentsService';
import { FrontDeskGraph, resetFrontDeskGraphCache } from './frontDeskGraph';
import { fakeGraphClient, type FakeCall } from './testing/fakeGraphClient';
import { visitorQueries } from './visitorsService';

const SITE = '/sites/scpng1.sharepoint.com:/sites/scpngintranet';
const LISTS = '/sites/site-1/lists?$select=id,displayName&$top=200';
const APPTS = '/sites/site-1/lists/list-a/items';
const VISITORS = '/sites/site-1/lists/list-v/items';
const base: Record<string, unknown> = {
  [SITE]: { id: 'site-1' },
  [LISTS]: { value: [{ id: 'list-a', displayName: 'FrontDesk_Appointments' }, { id: 'list-v', displayName: 'FrontDesk_Visitors' }] },
};

const appointment: FrontDeskAppointment = {
  id: '5', eTag: '"a,1"', title: 'Licence review', hostEmail: 'host@scpng.gov.pg', hostName: 'Host Name',
  startDateTime: '2026-11-10T04:00:00.000Z', endDateTime: '2026-11-10T05:00:00.000Z', status: 'Scheduled',
  attendees: [{ name: 'Mary K', company: 'Firm A', external: true }],
};

function service(responses: Record<string, unknown> = {}, onWrite: (call: FakeCall) => unknown = () => ({})) {
  const fake = fakeGraphClient({ ...base, ...responses }, onWrite);
  return { svc: new AppointmentsService(new FrontDeskGraph(fake.client)), calls: fake.calls };
}
const writes = (calls: FakeCall[]) => calls.filter(c => c.method !== 'get').map(c => [c.method, c.url]);

describe('AppointmentsService', () => {
  beforeEach(() => resetFrontDeskGraphCache());

  it('reads a period on the indexed StartDateTime', async () => {
    const { svc } = service({
      [`${APPTS}?$expand=fields&$top=200${appointmentQueries.startingBetween('a', 'b')}`]: { value: [{ id: '1', fields: { Title: 'T', StartDateTime: '2026-11-10T04:00:00Z' } }] },
    });
    expect((await svc.listBetween('a', 'b')).map(a => a.id)).toEqual(['1']);
  });

  it('creates the expected visitor for a guest, then leaves it alone when nothing changed', async () => {
    const day = `${VISITORS}?$expand=fields&$top=200${visitorQueries.byDate('2026-11-10')}`;
    const first = service({ [day]: { value: [] } }, call => (call.method === 'post' ? { id: 'v1', fields: (call.body as { fields: object }).fields } : {}));
    expect(await first.svc.syncExpectedVisitors(appointment, 'r@scpng.gov.pg')).toEqual({ created: 1, updated: 0, removed: 0 });
    expect(first.calls.find(c => c.method === 'post')?.body).toMatchObject({
      fields: { Title: 'Mary K', Company: 'Firm A', Reason: 'Licence review', Status: 'Expected', AppointmentId: '5', HostEmail: 'host@scpng.gov.pg' },
    });

    resetFrontDeskGraphCache();
    const linked = { id: 'v1', fields: { Title: 'Mary K', Company: 'Firm A', Reason: 'Licence review', VisitDate: '2026-11-10T00:00:00Z', Status: 'Expected', ExpectedStart: '2026-11-10T04:00:00Z', ExpectedEnd: '2026-11-10T05:00:00Z', HostEmail: 'host@scpng.gov.pg', AppointmentId: '5' } };
    const again = service({ [day]: { value: [linked] } });
    expect(await again.svc.syncExpectedVisitors(appointment, 'r@scpng.gov.pg')).toEqual({ created: 0, updated: 0, removed: 0 });
    expect(writes(again.calls)).toEqual([]);
  });

  it('creates an Outlook event and stores its id, updates it on edits, and cancels it when the appointment is canceled', async () => {
    const created = service({}, call => (call.url === '/me/events' ? { id: 'evt-1' } : {}));
    expect(await created.svc.syncInvite(appointment, { sendInvite: true })).toBe('created');
    expect(created.calls.find(c => c.url === '/me/events')?.body).toMatchObject({ subject: 'Licence review', attendees: [{ emailAddress: { address: 'host@scpng.gov.pg' } }] });
    expect(created.calls.find(c => c.method === 'patch')).toMatchObject({ url: `${APPTS}/5/fields`, body: { OutlookEventId: 'evt-1' } });

    resetFrontDeskGraphCache();
    const updated = service();
    expect(await updated.svc.syncInvite({ ...appointment, outlookEventId: 'evt-1' }, { sendInvite: true })).toBe('updated');
    expect(writes(updated.calls)).toEqual([['patch', '/me/events/evt-1']]);

    resetFrontDeskGraphCache();
    const canceled = service();
    expect(await canceled.svc.syncInvite({ ...appointment, outlookEventId: 'evt-1', status: 'Canceled' }, { sendInvite: true })).toBe('canceled');
    expect(writes(canceled.calls)).toEqual([['delete', '/me/events/evt-1'], ['patch', `${APPTS}/5/fields`]]);
  });

  it('sends nothing when the invite is not wanted, and reports an event booked from another desk', async () => {
    const none = service();
    expect(await none.svc.syncInvite(appointment, { sendInvite: false })).toBe('none');
    expect(writes(none.calls)).toEqual([]);

    resetFrontDeskGraphCache();
    const other = service({}, () => { throw Object.assign(new Error('Not found'), { statusCode: 404 }); });
    expect(await other.svc.syncInvite({ ...appointment, outlookEventId: 'evt-9' }, { sendInvite: true })).toBe('other-calendar');
  });
});
