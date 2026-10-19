/**
 * Information Slideshow Types
 * Supports three categories of informational slides on the dashboard
 */

export type SlideshowCategory =
  | 'MS Office 365 Tips'
  | 'Capital Market News'
  | 'Capital Market Acts';

export type SlideshowPriority = 'Normal' | 'High';

export interface SlideshowItem {
  id: string;
  title: string;
  description: string;
  category: SlideshowCategory;
  imageUrl?: string;
  priority?: SlideshowPriority;
  publishDate: string;
  expiryDate?: string;
  isActive: boolean;
  author?: string;
  linkUrl?: string;
  orderIndex?: number;
  contentKey?: string;
  sourceName?: string;
  sourcePublishedAt?: string;
  reviewedAt?: string;
  reviewDueAt?: string;
  legalStatus?: string;
  instrumentVersion?: string;
  effectiveDate?: string;
  imageDriveId?: string;
  imageItemId?: string;
  imageAlt?: string;
  imageCredit?: string;
}

export interface SlideshowHookReturn {
  slides: SlideshowItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Category-specific interfaces for better type safety
export interface MSOffice365Tip extends SlideshowItem {
  category: 'MS Office 365 Tips';
}

export interface CapitalMarketNews extends SlideshowItem {
  category: 'Capital Market News';
}

export interface CapitalMarketAct extends SlideshowItem {
  category: 'Capital Market Acts';
}
