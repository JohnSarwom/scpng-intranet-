import type { Client } from '@microsoft/microsoft-graph-client';

type GraphEvent = Record<string, unknown>;

/**
 * Outlook events in the signed-in receptionist's own calendar (Calendars.ReadWrite is already
 * granted). Deleting a meeting from the organiser's calendar sends the attendees a cancellation.
 */
export class OutlookEvents {
  constructor(private readonly client: Client) {}

  async create(event: GraphEvent): Promise<string> {
    const created = await this.client.api('/me/events').post(event) as { id?: string };
    if (!created?.id) throw new Error('Outlook did not return the new event.');
    return created.id;
  }

  async update(eventId: string, event: GraphEvent): Promise<void> {
    await this.client.api(`/me/events/${eventId}`).patch(event);
  }

  async remove(eventId: string): Promise<void> {
    await this.client.api(`/me/events/${eventId}`).delete();
  }
}

/** True when the event is not in this receptionist's calendar (it was booked from another desk). */
export const isOtherCalendar = (error: unknown) => {
  const e = error as { statusCode?: number; code?: string } | null;
  return e?.statusCode === 404 || String(e?.code || '').toLowerCase() === 'erroritemnotfound';
};
