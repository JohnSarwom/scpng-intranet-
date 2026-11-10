import type { Task } from '@/types';
import { format, isSameDay, isValid, parseISO } from 'date-fns';

/**
 * Determines which group ID a task should appear in for the current user,
 * based on whether they are the creator, an assignee, or a viewer.
 *
 * - Creator sees the task via `projectId` (their chosen group)
 * - Assignee sees the task via `assigneeViewMap[email]` (falls back to projectId)
 * - Viewer (neither) falls through to `projectId`
 */
export function getEffectiveGroupId(
  task: Task,
  currentUserEmail: string
): string | undefined {
  const normalizedEmail = currentUserEmail?.toLowerCase() || '';
  if (!normalizedEmail) return task.projectId;

  const isCreator =
    task.createdByEmail?.toLowerCase() === normalizedEmail ||
    task.authorEmail?.toLowerCase() === normalizedEmail;

  if (isCreator) {
    return task.projectId;
  }

  const isAssignee = task.assignees?.some(
    a => a.email?.toLowerCase() === normalizedEmail
  );

  if (isAssignee && task.assigneeViewMap) {
    return task.assigneeViewMap[normalizedEmail] || task.projectId;
  }

  return task.projectId;
}

/**
 * Date label for a task card: "Apr 13", or "Apr 13 - Apr 27" when the end is on a later day.
 * Date-only strings such as a task's `dueDate` ("2026-04-13") are read as local calendar days.
 * The end is left off when it is missing, invalid or on the same day as the start.
 */
export function formatTaskDateRange(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
): string {
  const toDate = (value: Date | string | null | undefined): Date | null => {
    if (!value) return null;
    const date = typeof value === 'string' ? parseISO(value) : value;
    return isValid(date) ? date : null;
  };
  const start = toDate(startDate);
  if (!start) return '';
  const end = toDate(endDate);
  if (!end || isSameDay(start, end)) return format(start, 'MMM d');
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`;
}
