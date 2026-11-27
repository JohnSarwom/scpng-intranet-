import type { CSSProperties } from 'react';
import type { InquiryStatus } from '@/services/frontDesk/frontDeskConfig';

export { initialsOfVisitor as initialsOf } from '../visitors/visitorDisplay';

export const STATUS_BADGE: Record<InquiryStatus, string> = {
  Open: 'border-transparent bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  'In Progress': 'border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Resolved: 'border-transparent bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

export const STATUS_DOT: Record<InquiryStatus, string> = {
  Open: 'bg-gray-400',
  'In Progress': 'bg-blue-500',
  Resolved: 'bg-green-600',
};

/** A soft colour per category, the same every time. */
export function categoryStyle(category: string): CSSProperties {
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (category.charCodeAt(i) + ((hash << 5) - hash)) | 0;
  const hue = Math.abs(hash) % 360;
  return { backgroundColor: `hsl(${hue}, 70%, 90%)`, color: `hsl(${hue}, 50%, 35%)`, borderColor: `hsl(${hue}, 60%, 80%)` };
}

export interface StaffOption { name: string; email: string; unit: string }
