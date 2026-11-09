/**
 * Pure rules for Front Desk general inquiries (plan Phase 5A): mapping SharePoint items,
 * the fields a save writes (ResolvedAt and the assignment trail), the register and search.
 */
import {
  INQUIRY_CATEGORIES,
  INQUIRY_STATUSES,
  PRIORITIES,
  type InquiryCategory,
  type InquiryStatus,
  type Priority,
} from './frontDeskConfig';
import type { GraphListItem } from './frontDeskGraph';
import { pngDayRange, shiftDateKey } from './pngTime';

export interface FrontDeskInquiry {
  id: string;
  eTag?: string;
  title: string;
  description?: string;
  category: InquiryCategory;
  priority: Priority;
  status: InquiryStatus;
  assigneeEmail?: string;
  assigneeName?: string;
  /** Free text: a visitor, a staff member or a team. */
  reportedBy?: string;
  /** ISO instant. */
  reportedAt: string;
  resolvedAt?: string;
  escalatedTicketId?: string;
  loggedByEmail?: string;
  assignedAt?: string;
  assignedByEmail?: string;
  acknowledgedAt?: string;
}

export interface InquiryInput {
  title: string;
  description?: string;
  category: InquiryCategory;
  priority: Priority;
  status: InquiryStatus;
  assigneeEmail?: string;
  assigneeName?: string;
  reportedBy?: string;
  reportedAt: string;
}

/** Not yet resolved: always on screen, however old (like uncollected mail). */
export const OPEN_INQUIRY_STATUSES = INQUIRY_STATUSES.filter(s => s !== 'Resolved');

/** Without a date filter the register shows every open inquiry plus this many days of resolved ones. */
export const RECENT_DAYS = 30;

// ─── SharePoint mapping ─────────────────────────────────────────────────────

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const optional = (value: unknown) => text(value) || undefined;
const instant = (value: unknown) => {
  const raw = text(value);
  return raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toISOString() : undefined;
};
const oneOf = <T extends string>(values: readonly T[], value: unknown, fallback: T): T =>
  (values as readonly string[]).includes(text(value)) ? text(value) as T : fallback;
const sameEmail = (a?: string, b?: string) => (a?.trim().toLowerCase() || '') === (b?.trim().toLowerCase() || '');

export function mapInquiry(item: GraphListItem): FrontDeskInquiry {
  const f = item.fields || {};
  return {
    id: String(item.id),
    eTag: item.eTag,
    title: text(f.Title),
    description: optional(f.Description),
    category: oneOf(INQUIRY_CATEGORIES, f.Category, 'General'),
    priority: oneOf(PRIORITIES, f.Priority, 'Medium'),
    status: oneOf(INQUIRY_STATUSES, f.Status, 'Open'),
    assigneeEmail: optional(f.AssigneeEmail)?.toLowerCase(),
    assigneeName: optional(f.AssigneeName),
    reportedBy: optional(f.ReportedBy),
    reportedAt: instant(f.ReportedAt) ?? new Date(0).toISOString(),
    resolvedAt: instant(f.ResolvedAt),
    escalatedTicketId: optional(f.EscalatedTicketId),
    loggedByEmail: optional(f.LoggedByEmail),
    assignedAt: instant(f.AssignedAt),
    assignedByEmail: optional(f.AssignedByEmail),
    acknowledgedAt: instant(f.AcknowledgedAt),
  };
}

/** The input that reproduces an inquiry as stored, for inline changes that alter one field. */
export const inquiryToInput = (inquiry: FrontDeskInquiry): InquiryInput => ({
  title: inquiry.title,
  description: inquiry.description,
  category: inquiry.category,
  priority: inquiry.priority,
  status: inquiry.status,
  assigneeEmail: inquiry.assigneeEmail,
  assigneeName: inquiry.assigneeName,
  reportedBy: inquiry.reportedBy,
  reportedAt: inquiry.reportedAt,
});

/**
 * SharePoint fields for a save. New inquiries leave empty fields out; edits send `null` so a
 * cleared field is cleared. Two fields follow from the change itself:
 * - `ResolvedAt` is stamped when the status becomes Resolved, kept while it stays Resolved,
 *   and cleared when it is reopened (plan P5.1).
 * - A new or changed assignee stamps `AssignedAt` and `AssignedByEmail` and clears
 *   `AcknowledgedAt`; unassigning clears all three (the field half of plan P5.15).
 */
export function inquiryFields(
  input: InquiryInput,
  { previous, actorEmail = '', nowIso = new Date().toISOString() }: { previous?: FrontDeskInquiry; actorEmail?: string; nowIso?: string } = {},
): Record<string, unknown> {
  const forUpdate = !!previous;
  const assigneeEmail = input.assigneeEmail?.trim().toLowerCase();
  const fields: Record<string, unknown> = {
    Title: input.title.trim(),
    Category: input.category,
    Priority: input.priority,
    Status: input.status,
    ReportedAt: input.reportedAt,
  };
  const optionalField = (column: string, value?: string) => {
    if (value?.trim()) fields[column] = value.trim();
    else if (forUpdate) fields[column] = null;
  };
  optionalField('Description', input.description);
  optionalField('ReportedBy', input.reportedBy?.replace(/\s+/g, ' '));
  optionalField('AssigneeEmail', assigneeEmail);
  optionalField('AssigneeName', assigneeEmail ? input.assigneeName : undefined);

  if (input.status === 'Resolved') {
    if (previous?.status !== 'Resolved' || !previous.resolvedAt) fields.ResolvedAt = nowIso;
  } else if (previous?.resolvedAt) {
    fields.ResolvedAt = null;
  }

  if (!sameEmail(assigneeEmail, previous?.assigneeEmail)) {
    if (assigneeEmail) {
      fields.AssignedAt = nowIso;
      fields.AssignedByEmail = actorEmail || null;
      if (forUpdate) fields.AcknowledgedAt = null;
    } else {
      Object.assign(fields, { AssignedAt: null, AssignedByEmail: null, AcknowledgedAt: null });
    }
  }
  if (!forUpdate) for (const key of Object.keys(fields)) if (fields[key] === null) delete fields[key];
  return fields;
}

// ─── Validation ─────────────────────────────────────────────────────────────

export type InquiryErrors = Partial<Record<'title' | 'reportedAt', string>>;

export function validateInquiryInput(input: InquiryInput, nowIso = new Date().toISOString()): InquiryErrors {
  const errors: InquiryErrors = {};
  if (!input.title.trim()) errors.title = 'Enter a title.';
  if (!input.reportedAt || Number.isNaN(Date.parse(input.reportedAt))) errors.reportedAt = 'Enter when it was reported.';
  else if (Date.parse(input.reportedAt) > Date.parse(nowIso) + 5 * 60 * 1000) errors.reportedAt = 'The reported time is in the future.';
  return errors;
}

// ─── The register ───────────────────────────────────────────────────────────

/**
 * What the register reads. With a date filter, only inquiries reported on those PNG days (any
 * status). Without one, the last RECENT_DAYS days plus every open inquiry, however old.
 */
export function inquiryPeriod(todayKey: string, filter?: { from: string; to: string }) {
  if (filter) {
    const [from, to] = filter.from <= filter.to ? [filter.from, filter.to] : [filter.to, filter.from];
    return { from, to, start: pngDayRange(from).start, end: pngDayRange(to).end, includeOpen: false };
  }
  const from = shiftDateKey(todayKey, -(RECENT_DAYS - 1));
  return { from, to: todayKey, start: pngDayRange(from).start, end: pngDayRange(todayKey).end, includeOpen: true };
}

/** Each inquiry once, newest report first. */
export function mergeInquiries(...groups: FrontDeskInquiry[][]): FrontDeskInquiry[] {
  const byId = new Map<string, FrontDeskInquiry>();
  for (const item of groups.flat()) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => (a.reportedAt < b.reportedAt ? 1 : a.reportedAt > b.reportedAt ? -1 : 0));
}

export function searchInquiries(items: FrontDeskInquiry[], query: string): FrontDeskInquiry[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(i => [i.title, i.description, i.category, i.status, i.priority, i.assigneeName, i.reportedBy]
    .some(value => value?.toLowerCase().includes(q)));
}

export const UNASSIGNED = 'unassigned';

export interface InquiryFilters {
  status?: InquiryStatus;
  categories?: InquiryCategory[];
  priorities?: Priority[];
  /** Assignee emails, or UNASSIGNED. */
  assignees?: string[];
}

export function filterInquiries(items: FrontDeskInquiry[], { status, categories = [], priorities = [], assignees = [] }: InquiryFilters) {
  return items.filter(i =>
    (!status || i.status === status)
    && (!categories.length || categories.includes(i.category))
    && (!priorities.length || priorities.includes(i.priority))
    && (!assignees.length || assignees.includes(i.assigneeEmail || UNASSIGNED)));
}
