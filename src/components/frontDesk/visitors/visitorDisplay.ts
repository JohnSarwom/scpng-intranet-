import type { VisitorStatus } from '@/services/frontDesk/frontDeskConfig';

export const STATUS_DOT: Record<VisitorStatus, string> = {
  Expected: 'bg-blue-500',
  'On Site': 'bg-green-600',
  'Signed Out': 'bg-gray-500',
  'No Show': 'bg-red-600',
};

export const STATUS_BADGE: Record<VisitorStatus, string> = {
  Expected: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  'On Site': 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300',
  'Signed Out': 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700/30 dark:text-gray-300',
  'No Show': 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300',
};

/** "26/10/2026", the paper sheet's date column. */
export const shortDate = (dateKey: string) => (dateKey ? dateKey.split('-').reverse().join('/') : '');

/** First letter or digit of each word, skipping brackets and other symbols. */
export const initialsOfVisitor = (name: string) =>
  name.split(/\s+/).map(part => part.match(/[\p{L}\p{N}]/u)?.[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
