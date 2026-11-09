/**
 * Pure rules for the Front Desk mail and parcel register (plan Phase 4A): mapping SharePoint
 * items, the received-date periods, collection records and validation.
 */
import { MAIL_ITEM_TYPES, MAIL_STATUSES, type MailItemType, type MailStatus } from './frontDeskConfig';
import type { GraphListItem } from './frontDeskGraph';
import { DAY_MS, formatPngDateTime, pngDateKey, pngDayRange, shiftDateKey } from './pngTime';

export interface FrontDeskMailItem {
  id: string;
  eTag?: string;
  itemType: MailItemType;
  /** Subject (mail) or description (parcel). */
  title: string;
  sender?: string;
  carrier?: string;
  tracking?: string;
  /** Set when the recipient was picked from the staff directory; empty for "Other". */
  recipientEmail?: string;
  recipientName: string;
  recipientUnit?: string;
  /** ISO instant. */
  receivedAt: string;
  status: MailStatus;
  collectedAt?: string;
  collectedBy?: string;
  notes?: string;
  loggedByEmail?: string;
  notifiedAt?: string;
}

export interface MailInput {
  itemType: MailItemType;
  title: string;
  sender?: string;
  carrier?: string;
  tracking?: string;
  recipientEmail?: string;
  recipientName: string;
  recipientUnit?: string;
  receivedAt: string;
  status: MailStatus;
  notes?: string;
  collectedAt?: string;
  collectedBy?: string;
}

/** Still at reception: shown whatever the period, so old uncollected items are never hidden. */
export const OUTSTANDING_STATUSES = MAIL_STATUSES.filter(s => s !== 'Delivered');

export const MAIL_STATUS_LABELS: Record<MailStatus, string> = {
  Received: 'Received',
  'Pending Pickup': 'Pending pickup',
  'Signature Required': 'Signature required',
  Delivered: 'Collected',
};

// ─── Periods ────────────────────────────────────────────────────────────────

export type MailPeriod = 'today' | 'last-7-days' | 'last-30-days' | 'custom';

/** The received-date range of a period, as PNG days (inclusive) and a half-open UTC range. */
export function periodRange(period: MailPeriod, todayKey: string, custom?: { from: string; to: string }) {
  const days: Record<Exclude<MailPeriod, 'custom'>, number> = { today: 0, 'last-7-days': 6, 'last-30-days': 29 };
  const from = period === 'custom' ? custom?.from || todayKey : shiftDateKey(todayKey, -days[period]);
  const to = period === 'custom' ? custom?.to || from : todayKey;
  const [first, last] = from <= to ? [from, to] : [to, from];
  return { from: first, to: last, start: pngDayRange(first).start, end: pngDayRange(last).end };
}

/** Whole days an item has been waiting at reception. */
export const daysWaiting = (item: FrontDeskMailItem, nowIso = new Date().toISOString()) =>
  Math.max(0, Math.floor((Date.parse(nowIso) - Date.parse(item.receivedAt)) / DAY_MS));

// ─── SharePoint mapping ─────────────────────────────────────────────────────

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const optional = (value: unknown) => text(value) || undefined;
const instant = (value: unknown) => {
  const raw = text(value);
  return raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toISOString() : undefined;
};
const oneOf = <T extends string>(values: readonly T[], value: unknown, fallback: T): T =>
  (values as readonly string[]).includes(text(value)) ? text(value) as T : fallback;

export function mapMailItem(item: GraphListItem): FrontDeskMailItem {
  const f = item.fields || {};
  return {
    id: String(item.id),
    eTag: item.eTag,
    itemType: oneOf(MAIL_ITEM_TYPES, f.ItemType, 'Mail'),
    title: text(f.Title),
    sender: optional(f.Sender),
    carrier: optional(f.Carrier),
    tracking: optional(f.Tracking),
    recipientEmail: optional(f.RecipientEmail)?.toLowerCase(),
    recipientName: text(f.RecipientName),
    recipientUnit: optional(f.RecipientUnit),
    receivedAt: instant(f.ReceivedAt) ?? new Date(0).toISOString(),
    status: oneOf(MAIL_STATUSES, f.Status, 'Received'),
    collectedAt: instant(f.CollectedAt),
    collectedBy: optional(f.CollectedBy),
    notes: optional(f.Notes),
    loggedByEmail: optional(f.LoggedByEmail),
    notifiedAt: instant(f.NotifiedAt),
  };
}

const OPTIONAL_COLUMNS: Record<'sender' | 'carrier' | 'tracking' | 'recipientEmail' | 'recipientUnit' | 'notes', string> = {
  sender: 'Sender', carrier: 'Carrier', tracking: 'Tracking', recipientEmail: 'RecipientEmail', recipientUnit: 'RecipientUnit', notes: 'Notes',
};

/**
 * SharePoint fields for an input. New items leave empty fields out; edits send `null` so a
 * cleared field is cleared. The collection record is written only for collected items.
 */
export function mailFields(input: MailInput, { forUpdate = false } = {}): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    Title: input.title.trim(),
    ItemType: input.itemType,
    RecipientName: input.recipientName.trim().replace(/\s+/g, ' '),
    ReceivedAt: input.receivedAt,
    Status: input.status,
  };
  for (const [key, column] of Object.entries(OPTIONAL_COLUMNS) as [keyof typeof OPTIONAL_COLUMNS, string][]) {
    const value = input[key]?.trim();
    if (value) fields[column] = key === 'recipientEmail' ? value.toLowerCase() : value;
    else if (forUpdate) fields[column] = null;
  }
  if (input.status === 'Delivered') {
    fields.CollectedBy = input.collectedBy?.trim() || null;
    fields.CollectedAt = input.collectedAt || null;
  } else if (forUpdate) {
    fields.CollectedBy = null;
    fields.CollectedAt = null;
  }
  return fields;
}

// ─── Validation ─────────────────────────────────────────────────────────────

export type MailErrors = Partial<Record<'title' | 'recipientName' | 'receivedAt' | 'collectedBy' | 'collectedAt', string>>;

/** A collection needs a name and a time no earlier than the item arrived (plan P4.3). */
export function collectionErrors(receivedAt: string, collectedBy?: string, collectedAt?: string): MailErrors {
  const errors: MailErrors = {};
  if (!collectedBy?.trim()) errors.collectedBy = 'Enter who collected it.';
  if (!collectedAt) errors.collectedAt = 'Enter when it was collected.';
  else if (Date.parse(collectedAt) < Date.parse(receivedAt)) {
    errors.collectedAt = `It cannot be collected before it arrived (${formatPngDateTime(receivedAt)}).`;
  }
  return errors;
}

export function validateMailInput(input: MailInput, nowIso = new Date().toISOString()): MailErrors {
  const errors: MailErrors = {};
  if (!input.title.trim()) errors.title = input.itemType === 'Mail' ? 'Enter the subject.' : 'Describe the parcel.';
  if (!input.recipientName.trim()) errors.recipientName = 'Choose or enter the recipient.';
  if (!input.receivedAt || Number.isNaN(Date.parse(input.receivedAt))) errors.receivedAt = 'Enter when it arrived.';
  else if (Date.parse(input.receivedAt) > Date.parse(nowIso) + 5 * 60 * 1000) errors.receivedAt = 'The received time is in the future.';
  if (input.status === 'Delivered' && !errors.receivedAt) Object.assign(errors, collectionErrors(input.receivedAt, input.collectedBy, input.collectedAt));
  return errors;
}

/** The fields a status change writes. Moving to Collected records who and when; moving back clears both. */
export function mailStatusFields(item: FrontDeskMailItem, target: MailStatus, collection?: { collectedBy: string; collectedAt: string }) {
  if (target === 'Delivered') {
    const errors = collectionErrors(item.receivedAt, collection?.collectedBy, collection?.collectedAt);
    const first = Object.values(errors)[0];
    if (first) throw new Error(first);
    return { Status: target, CollectedBy: collection!.collectedBy.trim(), CollectedAt: collection!.collectedAt };
  }
  return item.status === 'Delivered' ? { Status: target, CollectedBy: null, CollectedAt: null } : { Status: target };
}

// ─── The register ───────────────────────────────────────────────────────────

/** The period's items plus everything still waiting, newest first, each item once. */
export function mergeRegister(inPeriod: FrontDeskMailItem[], outstanding: FrontDeskMailItem[]): FrontDeskMailItem[] {
  const byId = new Map<string, FrontDeskMailItem>();
  for (const item of [...outstanding, ...inPeriod]) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : a.receivedAt > b.receivedAt ? -1 : 0));
}

export function searchMail(items: FrontDeskMailItem[], query: string): FrontDeskMailItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(i => [i.title, i.sender, i.carrier, i.tracking, i.recipientName, i.recipientUnit, i.notes, i.collectedBy]
    .some(value => value?.toLowerCase().includes(q)));
}

/** True when the item arrived on an earlier PNG day and is still waiting. */
export const isOverdue = (item: FrontDeskMailItem, todayKey: string) =>
  item.status !== 'Delivered' && pngDateKey(item.receivedAt) < todayKey;
