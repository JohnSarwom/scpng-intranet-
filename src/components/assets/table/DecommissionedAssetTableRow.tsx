import React from 'react';
import { TableRow, TableCell } from "@/components/ui/table";
import { TooltipWrapper } from "@/components/ui/tooltip-wrapper";
import { TableActions } from './TableActions';
import { Asset } from '@/services/assetsSharePointService';

interface DecommissionedAssetTableRowProps {
  asset: Asset & { reason?: string; decommission_date?: string };
  onView: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
  formatDate: (date: string | undefined) => string;
}

export const DecommissionedAssetTableRow: React.FC<DecommissionedAssetTableRowProps> = ({
  asset,
  onView,
  onEdit,
  onDelete,
  formatDate
}) => {
  const handleViewClick = () => {
    if (onView) {
      onView(asset);
    }
  };

  return (
    <TableRow>
      <TableCell 
        className="whitespace-nowrap hover:bg-muted/50 transition-colors"
        style={{ cursor: onView ? 'pointer' : 'default' }}
        onClick={handleViewClick}
      >
        <TooltipWrapper content={`Asset name: ${asset.name}`}>
          {asset.name}
        </TooltipWrapper>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <TooltipWrapper content={`Asset ID: ${asset.id}`}>
          {asset.id}
        </TooltipWrapper>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <TooltipWrapper content={`Asset type: ${asset.type}`}>
          {asset.type}
        </TooltipWrapper>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <TooltipWrapper content={`Reason for decommissioning: ${asset.reason || asset.condition || 'Decommissioned'}`}>
          {asset.reason || asset.condition || 'Decommissioned'}
        </TooltipWrapper>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <TooltipWrapper content={`Last assigned to: ${asset.assigned_to || 'N/A'}`}>
          {asset.assigned_to}
        </TooltipWrapper>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <TooltipWrapper content={asset.assigned_to_email || 'N/A'}>
          {asset.assigned_to_email}
        </TooltipWrapper>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <TooltipWrapper content={asset.unit || 'N/A'}>
          {asset.unit}
        </TooltipWrapper>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <TooltipWrapper content={asset.division || 'N/A'}>
          {asset.division}
        </TooltipWrapper>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <TooltipWrapper content={`Decommissioned on: ${formatDate(asset.decommission_date || asset.deleted_at || asset.last_updated)}`}>
          {formatDate(asset.decommission_date || asset.deleted_at || asset.last_updated)}
        </TooltipWrapper>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <TooltipWrapper content={`Purchased on: ${formatDate(asset.purchase_date)}`}>
          {formatDate(asset.purchase_date)}
        </TooltipWrapper>
      </TableCell>
      <TableCell className="max-w-[200px] truncate">
        <TooltipWrapper content={asset.description || 'N/A'}>
          {asset.description}
        </TooltipWrapper>
      </TableCell>
      <TableCell className="text-right sticky right-0 bg-white z-10">
        <TableActions 
          asset={asset as Asset}
          onView={onView as any}
          onEdit={onEdit as any}
          onDelete={onDelete as any}
        />
      </TableCell>
    </TableRow>
  );
};
