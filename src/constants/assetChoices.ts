/**
 * SharePoint Assets List - Choice Field Values
 * These must EXACTLY match the choices defined in SharePoint
 * Any mismatch will cause a 500 error when creating/updating assets
 */

export const ASSET_TYPES = [
  'Desktop PC',
  'Laptop',
  'PC Monitor',
  'Desk Phone',
  'Printer',
  'Scanner',
  'Tablet',
  'Projector',
  'Networking Equipment',
  'Server',
  'Other'
] as const;

export const ASSET_CONDITIONS = [
  'Excellent',
  'Good',
  'Fair',
  'Poor',
  'Needs Repair',
  'Out of Service'
] as const;

export const ASSET_UNITS = [
  'IT',
  'HR',
  'Finance',
  'Operations',
  'Administration',
  'Legal',
  'Procurement',
  'Other'
] as const;

// Note: Division choices should match your SharePoint list
// Update these to match your organization's divisions
export const ASSET_DIVISIONS = [
  'Administration Division',
  'Finance Division',
  'IT Division',
  'HR Division',
  'Operations Division'
] as const;

// Type exports for TypeScript
export type AssetType = typeof ASSET_TYPES[number];
export type AssetCondition = typeof ASSET_CONDITIONS[number];
export type AssetUnit = typeof ASSET_UNITS[number];
export type AssetDivision = typeof ASSET_DIVISIONS[number];

// Condition badge color mapping for consistent UI across all views
export const getConditionBadgeClass = (condition?: string): string => {
  switch (condition?.toLowerCase()) {
    case 'excellent':
    case 'new':
      return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    case 'good':
      return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
    case 'fair':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
    case 'poor':
      return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
    case 'needs repair':
      return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
    case 'out of service':
    case 'for disposal':
      return 'bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  }
};
