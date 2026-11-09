import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { VisitorStatus } from '@/services/frontDesk/frontDeskConfig';
import { VISITOR_STATUS_LABELS } from '@/services/frontDesk/visitorRules';
import { STATUS_BADGE } from './visitorDisplay';

export const VisitorStatusBadge: React.FC<{ status: VisitorStatus; className?: string }> = ({ status, className }) => (
  <Badge variant="outline" className={cn('px-1.5 py-0.5 text-xs font-normal whitespace-nowrap', STATUS_BADGE[status], className)}>
    {VISITOR_STATUS_LABELS[status]}
  </Badge>
);
