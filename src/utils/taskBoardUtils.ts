import type { Task } from '@/types';

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
