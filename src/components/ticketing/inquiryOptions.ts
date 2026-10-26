import { endOfDay, format, startOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  INQUIRY_CATEGORIES,
  INQUIRY_STATUSES,
  PRIORITIES,
  type InquiryStatus,
  type Priority,
} from '@/services/frontDesk/frontDeskConfig';

// The SharePoint choice values are the source of truth (frontDeskConfig).
export const inquiryCategories: string[] = [...INQUIRY_CATEGORIES];
export const inquiryStatuses = INQUIRY_STATUSES;
export const inquiryPriorities = PRIORITIES;

export type { InquiryStatus };
export type InquiryPriority = Priority;

export interface InquiryAssignee {
  name: string;
  email?: string;
  initials: string;
}

export const initialsFor = (name: string) =>
  name.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase();

export const toAssignee = (staff: { name: string; email?: string }): InquiryAssignee =>
  ({ name: staff.name, email: staff.email, initials: initialsFor(staff.name) });

/** reportedAt is ISO 8601; anything else is shown as stored. */
export function formatReportedAt(reportedAt: string): string {
  const date = new Date(reportedAt);
  return Number.isNaN(date.getTime()) ? reportedAt : format(date, 'd MMM yyyy, h:mm a');
}

/** A range with only a start date means that single day. Unparseable dates never match. */
export function reportedWithin(reportedAt: string, range: DateRange | undefined): boolean {
  if (!range?.from) return true;
  const date = new Date(reportedAt);
  if (Number.isNaN(date.getTime())) return false;
  return date >= startOfDay(range.from) && date <= endOfDay(range.to ?? range.from);
}
