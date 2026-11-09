import { describe, expect, it } from 'vitest';
import { daySlotForTime, slotHourForTime } from './appointmentFilters';

describe('day view slots', () => {
  it('reads the hour from HH:mm times', () => {
    expect(slotHourForTime('09:00')).toBe(9);
    expect(slotHourForTime('13:30')).toBe(13);
    expect(slotHourForTime('9:05')).toBe(9);
    expect(slotHourForTime('')).toBeNull();
    expect(slotHourForTime('25:00')).toBeNull();
    expect(slotHourForTime('9 AM')).toBeNull();
  });

  it('puts appointments outside office hours in their own rows instead of dropping them', () => {
    expect(daySlotForTime('09:00')).toBe(9);
    expect(daySlotForTime('13:30')).toBe(13);
    expect(daySlotForTime('17:45')).toBe(17);
    expect(daySlotForTime('07:30')).toBe('before');
    expect(daySlotForTime('18:00')).toBe('after');
    expect(daySlotForTime(undefined)).toBe('untimed');
  });

  it('never confuses 1 PM with 10 or 11 AM', () => {
    expect(['10:00', '11:00', '13:00'].map(t => daySlotForTime(t))).toEqual([10, 11, 13]);
  });
});
