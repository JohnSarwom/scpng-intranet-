import { describe, expect, it } from 'vitest';
import {
  appointmentEvent,
  appointmentFields,
  appointmentsForTab,
  inviteeEmails,
  mapAppointment,
  monthKeys,
  parseAttendees,
  planExpectedVisitors,
  searchAppointments,
  validateAppointmentInput,
  weekKeys,
  type AppointmentInput,
  type FrontDeskAppointment,
} from './appointmentRules';
import type { FrontDeskVisitor } from './visitorRules';

const appt = (over: Partial<FrontDeskAppointment> = {}): FrontDeskAppointment => ({
  id: '5', title: 'Licence review', hostEmail: 'host@scpng.gov.pg', hostName: 'Host Name', location: 'Boardroom',
  startDateTime: '2026-11-10T04:00:00.000Z', endDateTime: '2026-11-10T05:00:00.000Z', status: 'Scheduled',
  attendees: [
    { name: 'Mary K', company: 'Firm A', external: true },
    { name: 'Staff Two', email: 'staff2@scpng.gov.pg', external: false },
  ],
  ...over,
});
const visitor = (over: Partial<FrontDeskVisitor> = {}): FrontDeskVisitor => ({
  id: 'v1', name: 'Mary K', company: 'Firm A', reason: 'Licence review', visitDate: '2026-11-10', status: 'Expected',
  expectedStart: '2026-11-10T04:00:00.000Z', expectedEnd: '2026-11-10T05:00:00.000Z', hostEmail: 'host@scpng.gov.pg', hostName: 'Host Name', appointmentId: '5',
  ...over,
});

describe('periods', () => {
  it('finds the Monday-to-Sunday week and the month of a day', () => {
    expect(weekKeys('2026-11-10')).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    expect(weekKeys('2026-11-15')).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    expect(monthKeys('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
});

describe('mapping', () => {
  it('reads attendees from JSON and drops anything unreadable', () => {
    expect(parseAttendees('[{"name":"A","external":true},{"name":""},7,{"name":"B","email":"B@X.org"}]'))
      .toEqual([{ name: 'A', email: undefined, company: undefined, external: true }, { name: 'B', email: 'b@x.org', company: undefined, external: false }]);
    expect(parseAttendees('not json')).toEqual([]);
  });

  it('maps an item and falls back to Scheduled for an unknown status', () => {
    expect(mapAppointment({ id: '3', fields: { Title: 'T', HostEmail: 'H@x.org', StartDateTime: '2026-11-10T04:00:00Z', Status: 'scheduled' } }))
      .toMatchObject({ id: '3', hostEmail: 'h@x.org', status: 'Scheduled', endDateTime: '2026-11-10T04:00:00.000Z', attendees: [] });
  });

  it('writes attendees as JSON and clears emptied fields on edits', () => {
    const input: AppointmentInput = { ...appt(), location: '', description: undefined };
    const fields = appointmentFields(input, { forUpdate: true });
    expect(JSON.parse(fields.Attendees as string)).toEqual([
      { name: 'Mary K', company: 'Firm A', external: true },
      { name: 'Staff Two', email: 'staff2@scpng.gov.pg', external: false },
    ]);
    expect(fields).toMatchObject({ Location: null, Description: null, Status: 'Scheduled' });
  });
});

describe('validation', () => {
  it('needs a title, a host, both times and an end after the start', () => {
    expect(validateAppointmentInput(appt())).toEqual({});
    expect(validateAppointmentInput({ ...appt(), title: ' ', hostEmail: '', startDateTime: '', endDateTime: '' }))
      .toEqual({ title: expect.any(String), host: expect.any(String), start: expect.any(String), end: expect.any(String) });
    expect(validateAppointmentInput({ ...appt(), endDateTime: appt().startDateTime }).end).toContain('after the start');
  });
});

describe('views', () => {
  it('shows tabs as views over statuses and dates', () => {
    const list = [appt({ id: 'past', startDateTime: '2026-11-01T04:00:00.000Z' }), appt({ id: 'soon' }), appt({ id: 'done', status: 'Completed' }), appt({ id: 'off', status: 'Canceled' })];
    expect(appointmentsForTab(list, 'upcoming', '2026-11-10').map(a => a.id)).toEqual(['soon']);
    expect(appointmentsForTab(list, 'completed', '2026-11-10').map(a => a.id)).toEqual(['done']);
    expect(appointmentsForTab(list, 'canceled', '2026-11-10').map(a => a.id)).toEqual(['off']);
    expect(appointmentsForTab(list, 'all', '2026-11-10')).toHaveLength(4);
  });

  it('searches attendees and their companies too', () => {
    expect(searchAppointments([appt()], 'firm a')).toHaveLength(1);
    expect(searchAppointments([appt()], 'nobody')).toHaveLength(0);
  });
});

describe('planExpectedVisitors', () => {
  it('creates an Expected visitor for each external guest, with company, host and times', () => {
    const plan = planExpectedVisitors(appt(), []);
    expect(plan.create).toEqual([{
      name: 'Mary K', company: 'Firm A', reason: 'Licence review', visitDate: '2026-11-10',
      expectedStart: '2026-11-10T04:00:00.000Z', expectedEnd: '2026-11-10T05:00:00.000Z',
      hostEmail: 'host@scpng.gov.pg', hostName: 'Host Name', appointmentId: '5',
    }]);
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('does not duplicate a guest when the appointment is edited, and moves them with it', () => {
    expect(planExpectedVisitors(appt(), [visitor()])).toEqual({ create: [], update: [], remove: [] });
    const moved = planExpectedVisitors(appt({ startDateTime: '2026-11-11T04:00:00.000Z', endDateTime: '2026-11-11T05:00:00.000Z' }), [visitor()]);
    expect(moved.create).toEqual([]);
    expect(moved.update[0].input).toMatchObject({ visitDate: '2026-11-11', expectedStart: '2026-11-11T04:00:00.000Z' });
  });

  it('removes guests dropped from the list, and all expected guests when canceled, but never arrivals', () => {
    const dropped = appt({ attendees: [] });
    expect(planExpectedVisitors(dropped, [visitor(), visitor({ id: 'v2', name: 'Arrived', status: 'On Site' })]).remove.map(v => v.id)).toEqual(['v1']);
    expect(planExpectedVisitors(appt({ status: 'Canceled' }), [visitor(), visitor({ id: 'v2', status: 'Signed Out' })]).remove.map(v => v.id)).toEqual(['v1']);
  });

  it('ignores visitors linked to other appointments', () => {
    expect(planExpectedVisitors(appt(), [visitor({ appointmentId: '9' })]).create).toHaveLength(1);
  });
});

describe('Outlook event', () => {
  it('invites the host and staff attendees once each, never external guests', () => {
    expect(inviteeEmails({ ...appt(), attendees: [...appt().attendees, { name: 'Host again', email: 'HOST@scpng.gov.pg', external: false }] }))
      .toEqual([{ address: 'host@scpng.gov.pg', name: 'Host again' }, { address: 'staff2@scpng.gov.pg', name: 'Staff Two' }]);
  });

  it('builds the Graph event with UTC times, the location and the guests named in the body', () => {
    const event = appointmentEvent(appt({ description: 'Bring the file.' }));
    expect(event).toMatchObject({
      subject: 'Licence review',
      start: { dateTime: '2026-11-10T04:00:00', timeZone: 'UTC' },
      end: { dateTime: '2026-11-10T05:00:00', timeZone: 'UTC' },
      location: { displayName: 'Boardroom' },
    });
    expect(event.body.content).toContain('Visitors: Mary K (Firm A)');
    expect(event.attendees.map(a => a.emailAddress.address)).toEqual(['host@scpng.gov.pg', 'staff2@scpng.gov.pg']);
  });
});
