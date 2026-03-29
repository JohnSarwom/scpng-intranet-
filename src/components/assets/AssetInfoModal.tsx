import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Building, CalendarDays, ShieldAlert, Clock, Info, Activity, Box, Package } from "lucide-react";
import { Asset } from '@/services/assetsSharePointService';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import { DialogFooter } from "@/components/ui/dialog";

interface AssetInfoModalProps {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
}

// Helper function for condition badge styling (similar to AssetCard)
const getConditionBadgeClass = (condition?: string | null | number) => {
  if (!condition) return '';
  const conditionStr = String(condition).toLowerCase();
  switch (conditionStr) {
    case 'new':
    case 'good':
    case 'excellent':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    case 'fair':
    case 'maintenance':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
    case 'poor':
    case 'needs repair':
    case 'damaged':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
    case 'retired':
    case 'decommissioned':
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  }
};

const InfoRow = ({ label, value, icon: Icon }: { label: string, value: React.ReactNode, icon?: React.ElementType }) => (
  <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-border/50 last:border-0">
    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground/70" />}
      {label}
    </span>
    <span className="text-sm text-foreground font-medium sm:text-right break-words mt-1 sm:mt-0">{value}</span>
  </div>
);

const AssetInfoModal: React.FC<AssetInfoModalProps> = ({ asset, isOpen, onClose }) => {
  if (!asset) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl flex flex-col max-h-[90vh] p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border/50 bg-muted/30">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Asset Details
          </DialogTitle>
          <DialogDescription className="hidden">
            Detailed information for asset: {asset.name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="flex flex-col sm:flex-row gap-6 mb-6">
            <div className="w-full sm:w-1/3 flex-shrink-0">
              <div className="relative w-full aspect-square overflow-hidden rounded-xl border border-border shadow-sm bg-muted flex items-center justify-center">
                {asset.image_url ? (
                  <img
                    src={asset.image_url}
                    alt={asset.name || 'Asset image'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-6xl font-semibold text-muted-foreground/50">
                      {String(asset.name || '').substring(0, 2).toUpperCase() || 'AS'}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-col items-center">
                <Badge variant="outline" className={cn("px-3 py-1 text-xs font-semibold uppercase tracking-wider", getConditionBadgeClass(asset.condition))}>
                  {asset.condition || 'Unknown State'}
                </Badge>
              </div>
            </div>

            <div className="w-full sm:w-2/3 flex flex-col">
              <div className="mb-4">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  {asset.name || 'Unnamed Asset'}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="font-normal">{asset.type || 'Uncategorized'}</Badge>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">ID: {String(asset.id || '').substring(0, 8) || 'N/A'}</span>
                </div>
              </div>

              {asset.description && (
                <div className="mb-4 bg-muted/30 p-3 rounded-lg border border-border/50">
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {asset.description}
                  </p>
                </div>
              )}

              <div className="space-y-0.5">
                <InfoRow label="Assigned To" value={asset.assigned_to || 'N/A'} icon={Briefcase} />
                <InfoRow label="Email" value={asset.assigned_to_email || 'N/A'} icon={Activity} />
                <InfoRow label="Location" value={`${asset.unit || 'N/A'} ${asset.division ? ' / ' + asset.division : ''}`} icon={Building} />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
              <div className="px-4 py-2 bg-muted/40 font-medium text-sm text-foreground flex items-center gap-2 border-b">
                <Box className="h-4 w-4 text-primary/70" />
                Hardware Details
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                <InfoRow label="Vendor" value={asset.vendor || 'N/A'} />
                <InfoRow label="Brand" value={asset.brand || 'N/A'} />
                <InfoRow label="Model" value={asset.model || 'N/A'} />
                <InfoRow label="Serial Number" value={
                  asset.serial_number ? <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{asset.serial_number}</span> : 'N/A'
                } />
              </div>
            </div>

            <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
              <div className="px-4 py-2 bg-muted/40 font-medium text-sm text-foreground flex items-center gap-2 border-b">
                <CalendarDays className="h-4 w-4 text-primary/70" />
                Lifecycle & Financials
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                <InfoRow label="Purchase Date" value={formatDate(asset.purchase_date)} />
                <InfoRow label="Assigned Date" value={formatDate(asset.assigned_date)} />
                <InfoRow label="Expected Expiry" value={formatDate(asset.expiry_date)} />
                <InfoRow label="Warranty Expiry" value={formatDate(asset.warranty_expiry_date)} />
                <InfoRow label="Purchase Cost" value={asset.purchase_cost != null ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatCurrency(asset.purchase_cost)}</span> : 'N/A'} />
                <InfoRow label="Depreciated Value" value={asset.depreciated_value != null ? <span className="text-orange-600 dark:text-orange-400 font-semibold">{formatCurrency(asset.depreciated_value)}</span> : 'N/A'} />
                <InfoRow label="Life Expectancy" value={asset.life_expectancy_years ? `${asset.life_expectancy_years} Years` : 'N/A'} />
                <InfoRow label="YTD Usage" value={asset.ytd_usage || 'N/A'} />
              </div>
            </div>

            {(asset.invoice_url || asset.barcode_url) && (
              <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                <div className="px-4 py-2 bg-muted/40 font-medium text-sm text-foreground flex items-center gap-2 border-b">
                  <Info className="h-4 w-4 text-primary/70" />
                  References
                </div>
                <div className="p-4 grid grid-cols-1 gap-1">
                  {asset.invoice_url && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm font-medium text-muted-foreground">Invoice URL</span>
                      <a href={asset.invoice_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate max-w-[300px] mt-1 sm:mt-0">
                        {asset.invoice_url}
                      </a>
                    </div>
                  )}
                  {asset.barcode_url && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm font-medium text-muted-foreground">Barcode URL</span>
                      <a href={asset.barcode_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate max-w-[300px] mt-1 sm:mt-0">
                        {asset.barcode_url}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {asset.notes && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-500 mb-2">
                  <Info className="h-4 w-4" />
                  Notes
                </h4>
                <p className="text-sm text-amber-900/80 dark:text-amber-200/80 whitespace-pre-wrap">{asset.notes}</p>
              </div>
            )}

            {asset.admin_comments && (
              <div className="bg-muted/50 border rounded-lg p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                  <ShieldAlert className="h-4 w-4" />
                  Admin Comments
                </h4>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{asset.admin_comments}</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/50 bg-muted/30 sm:justify-between flex-col sm:flex-row gap-4 sm:gap-0">
          <div className="flex flex-col text-xs text-muted-foreground">
            <span>Created: {formatDate(asset.created_at, true) || 'N/A'}</span>
            <span>Last Updated: {formatDate(asset.last_updated, true) || 'N/A'} by {asset.last_updated_by || 'System'}</span>
          </div>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssetInfoModal;
