/** React Query keys for the Front Desk. Invalidate `frontDeskKeys.all` to refresh everything. */
export const frontDeskKeys = {
  all: ['front-desk'] as const,
  visitors: (dateKey: string) => ['front-desk', 'visitors', dateKey] as const,
  visitorsOnSite: () => ['front-desk', 'visitors', 'on-site'] as const,
  appointments: () => ['front-desk', 'appointments'] as const,
  appointmentsBetween: (start: string, end: string) => ['front-desk', 'appointments', start, end] as const,
  mailPackages: () => ['front-desk', 'mail-packages'] as const,
  mailInPeriod: (start: string, end: string) => ['front-desk', 'mail-packages', 'period', start, end] as const,
  mailOutstanding: () => ['front-desk', 'mail-packages', 'outstanding'] as const,
  inquiries: () => ['front-desk', 'inquiries'] as const,
  tickets: () => ['front-desk', 'tickets'] as const,
  ticketGroups: () => ['front-desk', 'ticket-groups'] as const,
  ticketComments: (ticketId: string) => ['front-desk', 'ticket-comments', ticketId] as const,
};

/** Busy views (today's visitor log, mail) refetch this often so two desks stay in step (plan P2.7). */
export const FRONT_DESK_LIVE_REFETCH_MS = 30_000;
