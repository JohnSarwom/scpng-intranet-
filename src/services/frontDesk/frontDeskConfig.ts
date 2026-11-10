/**
 * Front Desk configuration: the one place list names and choice values are defined.
 * The UI and the SharePoint list setup both read these, so tab values can never drift
 * from stored status values again (audit B1).
 */

export const FRONT_DESK_SITE_PATH = '/sites/scpng1.sharepoint.com:/sites/scpngintranet';

export const FRONT_DESK_LISTS = {
  visitors: 'FrontDesk_Visitors',
  appointments: 'FrontDesk_Appointments',
  mailPackages: 'FrontDesk_MailPackages',
  inquiries: 'FrontDesk_Inquiries',
  tickets: 'FrontDesk_Tickets',
  ticketGroups: 'FrontDesk_TicketGroups',
  ticketComments: 'FrontDesk_TicketComments',
  routingRules: 'FrontDesk_RoutingRules',
} as const;

export type FrontDeskListKey = keyof typeof FRONT_DESK_LISTS;
export type FrontDeskListName = typeof FRONT_DESK_LISTS[FrontDeskListKey];

/** Document library for visitor photos (plan decision D7: photos kept, access restricted per D9). */
export const FRONT_DESK_PHOTO_LIBRARY = 'FrontDesk_VisitorPhotos';

export const VISITOR_STATUSES = ['Expected', 'On Site', 'Signed Out', 'No Show'] as const;
export const APPOINTMENT_STATUSES = ['Scheduled', 'Completed', 'Canceled'] as const;
export const MAIL_ITEM_TYPES = ['Mail', 'Package'] as const;
export const MAIL_STATUSES = ['Received', 'Pending Pickup', 'Signature Required', 'Delivered'] as const;
export const INQUIRY_CATEGORIES = ['Facilities', 'IT Support', 'Supplies', 'Parking', 'Food Service', 'HR', 'General'] as const;
export const INQUIRY_STATUSES = ['Open', 'In Progress', 'Resolved'] as const;
export const PRIORITIES = ['High', 'Medium', 'Low'] as const;
export const TICKET_STATUSES = ['New', 'In Progress', 'Done'] as const;
/** Which list a comment's `TicketId` points to; comments serve both tickets and inquiries (BE7). Empty means Ticket. */
export const COMMENT_PARENT_KINDS = ['Ticket', 'Inquiry'] as const;

/** Permission resource for the Front Desk page; `read` opens /tickets, the actions below gate controls (plan D5). */
export const FRONT_DESK_RESOURCE = 'tickets';

export const FRONT_DESK_ACTIONS = [
  { id: 'create', label: 'Log visitors, mail, appointments, inquiries and tickets' },
  { id: 'update', label: 'Edit records and sign visitors in and out' },
  { id: 'delete', label: 'Delete records' },
  { id: 'manage', label: 'Manage ticket groups' },
  { id: 'export', label: 'Print and export logs' },
] as const;

export type FrontDeskAction = typeof FRONT_DESK_ACTIONS[number]['id'];

export type VisitorStatus = typeof VISITOR_STATUSES[number];
export type AppointmentStatus = typeof APPOINTMENT_STATUSES[number];
export type MailItemType = typeof MAIL_ITEM_TYPES[number];
export type MailStatus = typeof MAIL_STATUSES[number];
export type InquiryCategory = typeof INQUIRY_CATEGORIES[number];
export type InquiryStatus = typeof INQUIRY_STATUSES[number];
export type Priority = typeof PRIORITIES[number];
export type TicketStatus = typeof TICKET_STATUSES[number];
export type CommentParentKind = typeof COMMENT_PARENT_KINDS[number];
