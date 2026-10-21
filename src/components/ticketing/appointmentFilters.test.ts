import { describe, expect, it } from 'vitest';
import { daySlotForTime, filterAppointmentsByTab, slotHourForTime, type AppointmentStatus } from './appointmentFilters';

const now = new Date(2026, 9, 21, 10, 0);
const appt = (id: string, status: AppointmentStatus, from?: Date) => ({ id, status, dateRange: from ? { from, to: from } : undefined });

const appointments = [
  appt('past-scheduled', 'scheduled', new Date(2026, 9, 20, 9, 0)),
  appt('today-earlier', 'scheduled', new Date(2026, 9, 21, 8, 0)),
  appt('tomorrow', 'scheduled', new Date(2026, 9, 22, 9, 0)),
  appt('done', 'completed', new Date(2026, 9, 1, 9, 0)),
  appt('off', 'canceled', new Date(2026, 9, 23, 9, 0)),
  appt('undated', 'scheduled'),
];

describe('filterAppointmentsByTab', () => {
  it('shows every appointment on the All tab', () => {
    expect(filterAppointmentsByTab(appointments, 'all', now)).toHaveLength(appointments.length);
  });

  it('shows scheduled appointments from the start of today on the Upcoming tab', () => {
    expect(filterAppointmentsByTab(appointments, 'upcoming', now).map(a => a.id)).toEqual(['today-earlier', 'tomorrow']);
  });

  it('matches the status on the Completed and Canceled tabs', () => {
    expect(filterAppointmentsByTab(appointments, 'completed', now).map(a => a.id)).toEqual(['done']);
    expect(filterAppointmentsByTab(appointments, 'canceled', now).map(a => a.id)).toEqual(['off']);
  });

  it('includes a newly created appointment under All and Upcoming', () => {
    const created = [...appointments, appt('new', 'scheduled', new Date(2026, 9, 21, 14, 0))];
    expect(filterAppointmentsByTab(created, 'all', now).map(a => a.id)).toContain('new');
    expect(filterAppointmentsByTab(created, 'upcoming', now).map(a => a.id)).toContain('new');
  });
});

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
