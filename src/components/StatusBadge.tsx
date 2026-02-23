import React from 'react';
import { Badge } from '@/components/ui/badge';

// Define a type for all possible status values
export type StatusType =
  | 'todo' | 'in-progress' | 'on-hold' | 'in-review' | 'completed'
  | 'identified' | 'analyzing' | 'mitigating' | 'monitoring' | 'resolved'
  | 'planned' | 'open' | 'closed'
  | 'active' | 'maintenance' | 'retired'
  | 'on-track' | 'at-risk' | 'behind';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusColor = () => {
    // Cast status to any for switch to handle legacy values gracefully
    const val = (status || '').toLowerCase();

    switch (val) {
      case 'todo':
      case 'not-started':
      case 'open':
        return 'bg-gray-100 text-gray-800';
      case 'in-progress':
      case 'active':
        return 'bg-amber-100 text-amber-800';
      case 'on-hold':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800';
      case 'in-review':
      case 'review':
      case 'under review':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'completed':
      case 'done':
      case 'closed':
      case 'complete':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'identified':
        return 'bg-purple-100 text-purple-800';
      case 'analyzing':
        return 'bg-indigo-100 text-indigo-800';
      case 'mitigating':
        return 'bg-yellow-100 text-yellow-800';
      case 'monitoring':
        return 'bg-teal-100 text-teal-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'planned':
        return 'bg-blue-100 text-blue-800';
      case 'maintenance':
        return 'bg-amber-100 text-amber-800';
      case 'retired':
        return 'bg-gray-100 text-gray-800';
      case 'on-track':
        return 'bg-green-100 text-green-800';
      case 'at-risk':
        return 'bg-amber-100 text-amber-800';
      case 'behind':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = () => {
    const val = (status || '').toLowerCase();

    switch (val) {
      case 'todo':
      case 'not-started':
      case 'open':
        return 'To Do';
      case 'in-progress':
        return 'In Progress';
      case 'on-hold':
        return 'On Hold';
      case 'in-review':
      case 'review':
      case 'under review':
        return 'In Review';
      case 'completed':
      case 'done':
      case 'complete':
        return 'Completed';
      case 'identified':
        return 'Identified';
      case 'analyzing':
        return 'Analyzing';
      case 'mitigating':
        return 'Mitigating';
      case 'monitoring':
        return 'Monitoring';
      case 'resolved':
        return 'Resolved';
      case 'planned':
        return 'Planned';
      case 'closed':
        return 'Closed';
      case 'active':
        return 'Active';
      case 'maintenance':
        return 'Maintenance';
      case 'retired':
        return 'Retired';
      case 'on-track':
        return 'On Track';
      case 'at-risk':
        return 'At Risk';
      case 'behind':
        return 'Behind';
      default:
        return typeof status === 'string'
          ? status.charAt(0).toUpperCase() + status.slice(1)
          : 'Unknown';
    }
  };

  return (
    <Badge className={`${getStatusColor()} hover:${getStatusColor()}`}>
      {getStatusLabel()}
    </Badge>
  );
};

export default StatusBadge;