import { startOfDay } from 'date-fns';

export type AppointmentTab = 'all' | 'upcoming' | 'completed' | 'canceled';
export type AppointmentStatus = 'scheduled' | 'completed' | 'canceled';

interface FilterableAppointment {
  status: AppointmentStatus;
  dateRange?: { from?: Date };
}

/** Tabs are views over the appointments, not status values: "All" and "Upcoming" never match a status. */
export function filterAppointmentsByTab<T extends FilterableAppointment>(
  appointments: T[],
  tab: AppointmentTab,
  now: Date = new Date(),
): T[] {
  if (tab === 'all') return appointments;
  if (tab === 'upcoming') {
    const today = startOfDay(now);
    return appointments.filter(appt =>
      appt.status === 'scheduled' && !!appt.dateRange?.from && new Date(appt.dateRange.from) >= today);
  }
  return appointments.filter(appt => appt.status === tab);
}

export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 17;

/** Day-view row for an appointment: an hour from 8 to 17, or before/after office hours. */
export type DaySlot = number | 'before' | 'after' | 'untimed';

/** "13:30" → 13; null when the time is missing or not HH:mm. */
export function slotHourForTime(time: string | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((time || '').trim());
  if (!match) return null;
  const hour = Number(match[1]);
  return hour <= 23 && Number(match[2]) <= 59 ? hour : null;
}

export function daySlotForTime(time: string | undefined, startHour = DAY_START_HOUR, endHour = DAY_END_HOUR): DaySlot {
  const hour = slotHourForTime(time);
  if (hour === null) return 'untimed';
  if (hour < startHour) return 'before';
  if (hour > endHour) return 'after';
  return hour;
}
