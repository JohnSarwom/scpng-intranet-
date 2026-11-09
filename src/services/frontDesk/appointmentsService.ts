import {
  appointmentDateKey,
  appointmentEvent,
  appointmentFields,
  mapAppointment,
  planExpectedVisitors,
  type AppointmentInput,
  type FrontDeskAppointment,
} from './appointmentRules';
import { FRONT_DESK_LISTS } from './frontDeskConfig';
import type { FrontDeskGraph } from './frontDeskGraph';
import { isOtherCalendar, OutlookEvents } from './outlookEvents';
import { VisitorsService } from './visitorsService';

const LIST = FRONT_DESK_LISTS.appointments;

/** The filter uses the indexed StartDateTime, so the calendar keeps working past 5,000 appointments. */
export const appointmentQueries = {
  startingBetween: (start: string, end: string) => `&$filter=fields/StartDateTime ge '${start}' and fields/StartDateTime lt '${end}'`,
};

export type InviteResult = 'created' | 'updated' | 'canceled' | 'none' | 'other-calendar';

/** The FrontDesk_Appointments list, its expected visitors (P4.8) and Outlook invites (P4.10). */
export class AppointmentsService {
  private readonly visitors: VisitorsService;
  private readonly events: OutlookEvents;

  constructor(private readonly graph: FrontDeskGraph, deps: { visitors?: VisitorsService; events?: OutlookEvents } = {}) {
    this.visitors = deps.visitors ?? new VisitorsService(graph);
    this.events = deps.events ?? new OutlookEvents(graph.client);
  }

  async listBetween(start: string, end: string): Promise<FrontDeskAppointment[]> {
    return (await this.graph.getItems(LIST, appointmentQueries.startingBetween(start, end))).map(mapAppointment);
  }

  async create(input: AppointmentInput, actorEmail: string): Promise<FrontDeskAppointment> {
    const fields = appointmentFields(input);
    if (actorEmail) fields.CreatedByEmail = actorEmail;
    return mapAppointment(await this.graph.createItem(LIST, fields));
  }

  async update(appointment: FrontDeskAppointment, input: AppointmentInput): Promise<FrontDeskAppointment> {
    await this.graph.updateFields(LIST, appointment.id, appointmentFields(input, { forUpdate: true }), appointment.eTag);
    return { ...appointment, ...input, eTag: undefined };
  }

  async remove(appointment: FrontDeskAppointment): Promise<void> {
    await this.graph.deleteItem(LIST, appointment.id, appointment.eTag);
  }

  /**
   * Brings the visitor log in line with the appointment's external guests. Reads the indexed
   * VisitDate (the appointment's day, and its old day when the date changed) rather than the
   * un-indexed AppointmentId column.
   */
  async syncExpectedVisitors(appointment: FrontDeskAppointment, actorEmail: string, previousDateKey?: string) {
    const days = [...new Set([appointmentDateKey(appointment), previousDateKey].filter(Boolean) as string[])];
    const linked = (await Promise.all(days.map(day => this.visitors.listByDate(day)))).flat()
      .filter(v => v.appointmentId === appointment.id);
    const plan = planExpectedVisitors(appointment, linked);
    const now = new Date().toISOString();
    for (const input of plan.create) await this.visitors.create(input, 'Expected', actorEmail, now);
    for (const { visitor, input } of plan.update) await this.visitors.update(visitor, input);
    for (const visitor of plan.remove) await this.visitors.remove(visitor);
    return { created: plan.create.length, updated: plan.update.length, removed: plan.remove.length };
  }

  /**
   * Creates, updates or cancels the appointment's Outlook event. The event lives in the calendar
   * of the receptionist who created it; another desk cannot change it ('other-calendar').
   */
  async syncInvite(appointment: FrontDeskAppointment, { sendInvite }: { sendInvite: boolean }): Promise<InviteResult> {
    try {
      if (appointment.outlookEventId && appointment.status === 'Canceled') {
        await this.events.remove(appointment.outlookEventId);
        await this.graph.updateFields(LIST, appointment.id, { OutlookEventId: null });
        return 'canceled';
      }
      if (appointment.outlookEventId) {
        await this.events.update(appointment.outlookEventId, appointmentEvent(appointment));
        return 'updated';
      }
      if (sendInvite && appointment.status === 'Scheduled') {
        const eventId = await this.events.create(appointmentEvent(appointment));
        await this.graph.updateFields(LIST, appointment.id, { OutlookEventId: eventId });
        return 'created';
      }
      return 'none';
    } catch (error) {
      if (isOtherCalendar(error)) return 'other-calendar';
      throw error;
    }
  }

  /** Cancels the invite and removes guests who never arrived; used when an appointment is deleted. */
  async cleanUpAfterDelete(appointment: FrontDeskAppointment, actorEmail: string) {
    const canceled: FrontDeskAppointment = { ...appointment, status: 'Canceled' };
    const visitors = await this.syncExpectedVisitors(canceled, actorEmail);
    let invite: InviteResult = 'none';
    if (appointment.outlookEventId) {
      try { await this.events.remove(appointment.outlookEventId); invite = 'canceled'; } catch (error) {
        if (!isOtherCalendar(error)) throw error;
        invite = 'other-calendar';
      }
    }
    return { visitors, invite };
  }
}
