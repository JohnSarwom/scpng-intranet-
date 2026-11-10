import type { IAnnouncement } from '@/types';

/** Only the existing, staff-wide manual board is eligible. Restricted mail is never promoted. */
export function getUnseenStaffAnnouncements(
  announcements: IAnnouncement[],
  dismissedIds: ReadonlySet<string>,
  now = new Date(),
): IAnnouncement[] {
  return announcements.filter(notice => {
    const sender = notice.sourceEmail?.trim().toLowerCase();
    return notice.source === 'manual' && notice.category === 'Announcement' &&
      (!notice.audience || notice.audience === 'All Staff') &&
      typeof notice.title === 'string' && !!notice.title.trim() &&
      typeof notice.content === 'string' && !!notice.content.trim() &&
      Number.isFinite(notice.createdDate.getTime()) && notice.createdDate <= now &&
      (!notice.expiryDate || notice.expiryDate > now) &&
      sender !== 'powerautomatenoreply@microsoft.com' && sender !== 'microsoft-noreply@microsoft.com' &&
      !/^alert:\s*your operation has been throttled/i.test(notice.title.trim()) &&
      !dismissedIds.has(notice.id);
  }).sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
}

const memoryDismissals = new Map<string, Set<string>>();

export function readDismissedStaffNotices(accountId: string): Set<string> {
  const dismissed = new Set(memoryDismissals.get(accountId));
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(`scpng:staff-notices:v1:${accountId}`) || '[]');
    if (Array.isArray(stored)) {
      stored.filter((id): id is string => typeof id === 'string').forEach(id => dismissed.add(id));
    }
  } catch { /* Private/blocked storage must not prevent opening the home screen. */ }
  return dismissed;
}

export function dismissStaffNotices(accountId: string, noticeIds: string[]): void {
  const dismissed = readDismissedStaffNotices(accountId);
  noticeIds.forEach(id => dismissed.add(id));
  memoryDismissals.set(accountId, dismissed);
  try {
    // Store IDs only, never email bodies, summaries or user profile data.
    localStorage.setItem(`scpng:staff-notices:v1:${accountId}`, JSON.stringify([...dismissed].slice(-1000)));
  } catch { /* The in-memory fallback still suppresses repeats in this app session. */ }
}
