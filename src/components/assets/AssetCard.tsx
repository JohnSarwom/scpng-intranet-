import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Briefcase, Building, CalendarDays, CheckCircle, ShieldAlert, Clock, MoreVertical, Info } from 'lucide-react';
import { UserAsset } from '@/types';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { TooltipWrapper } from '@/components/ui/tooltip-wrapper';
import { getConditionBadgeClass } from '@/config/assetConditions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface AssetCardProps {
  asset: UserAsset;
  onEdit: (asset: UserAsset) => void;
  onDelete: (asset: UserAsset) => void;
  onClick?: (asset: UserAsset) => void;
}

const AssetCard: React.FC<AssetCardProps> = ({ asset, onEdit, onDelete, onClick }) => {
  // Handler to prevent click propagation from buttons
  const handleActionClick = (e: React.MouseEvent, action: (asset: UserAsset) => void) => {
    e.stopPropagation(); // Prevent card click when clicking action buttons
    action(asset);
  };

  return (
    <Card
      className="flex flex-col h-full overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 border-gray-200 dark:border-gray-800 group relative cursor-default"
    >
      <CardHeader className="p-0 relative h-48 flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 cursor-pointer" onClick={() => onClick && onClick(asset)}>
        {/* Image or Fallback */}
        {asset.image_url ? (
          <img
            src={asset.image_url}
            alt={asset.name || 'Asset image'}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 transition-colors duration-300 group-hover:bg-gray-200 dark:group-hover:bg-gray-700">
            <span className="text-5xl font-semibold text-gray-400 dark:text-gray-500">
              {asset.name?.substring(0, 2).toUpperCase() || 'A'}
            </span>
          </div>
        )}

        {/* Actions Dropdown - hidden by default, visible on hover */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 shadow-sm" onClick={(e) => e.stopPropagation()}>
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-50">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick && onClick(asset); }}>
                <Info className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(asset); }}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(asset); }} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2 gap-2">
          <CardTitle className="text-base font-semibold truncate flex-1 cursor-pointer hover:text-primary transition-colors" title={asset.name} onClick={() => onClick && onClick(asset)}>
            {asset.name || 'Unnamed Asset'}
          </CardTitle>
          <span className="text-xs text-muted-foreground whitespace-nowrap bg-muted px-2 py-0.5 rounded-full" title="Asset ID">
            {asset.id?.substring(0, 8) || 'N/A'}
          </span>
        </div>

        {/* Type and Condition Badges */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {asset.type && (
            <Badge variant="secondary" className="font-normal text-xs">
              {asset.type}
            </Badge>
          )}
          {asset.condition && (
            <Badge variant="outline" className={cn("font-normal text-xs", getConditionBadgeClass(asset.condition))}>
              {asset.condition}
            </Badge>
          )}
        </div>

        {/* Details List */}
        <div className="space-y-2 text-sm text-foreground/80 flex-grow mb-4">
          <TooltipWrapper content={`Assigned To: ${asset.assigned_to || 'Unassigned'}`}>
            <div className="flex items-center gap-2 truncate">
              <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{asset.assigned_to || <span className="text-muted-foreground italic">Unassigned</span>}</span>
            </div>
          </TooltipWrapper>

          <TooltipWrapper content={`Location: ${asset.unit || 'N/A'} - ${asset.division || 'N/A'}`}>
            <div className="flex items-center gap-2 truncate">
              <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{asset.unit || 'N/A'} {asset.division ? `/ ${asset.division}` : ''}</span>
            </div>
          </TooltipWrapper>

          <TooltipWrapper content={`Assigned Date: ${formatDate(asset.assigned_date)}`}>
            <div className="flex items-center gap-2 truncate">
              <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{formatDate(asset.assigned_date)}</span>
            </div>
          </TooltipWrapper>
        </div>

        {/* Footer info (Divider + Vendor/Updated) */}
        <div className="mt-auto pt-3 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
          <TooltipWrapper content={`Vendor: ${asset.vendor || 'Unknown'}`}>
            <div className="flex items-center gap-1.5 truncate max-w-[50%]">
              <Building className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{asset.vendor || 'Unknown vendor'}</span>
            </div>
          </TooltipWrapper>
          <TooltipWrapper content={`Last Updated: ${formatDate(asset.last_updated)}`}>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span>{formatDate(asset.last_updated)}</span>
            </div>
          </TooltipWrapper>
        </div>
      </CardContent>
    </Card>
  );
};

export default AssetCard;
