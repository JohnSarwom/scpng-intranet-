/** Day-view rows for appointments. The tab filter lives in services/frontDesk/appointmentRules.ts. */

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
