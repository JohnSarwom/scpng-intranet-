import React, { useMemo } from 'react';
import {
  Activity,
  Briefcase,
  Building2,
  CalendarDays,
  CircleDollarSign,
  FileText,
  Mail,
  Package,
  Printer,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { AssetQrSnapshot, decodeAssetQrSnapshot } from '@/utils/assetQr';

const getConditionBadgeClass = (condition?: string | null | number) => {
  if (!condition) return 'bg-gray-100 text-gray-800 border-gray-200';
  const conditionStr = String(condition).toLowerCase();

  switch (conditionStr) {
    case 'new':
    case 'good':
    case 'excellent':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'fair':
    case 'maintenance':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'poor':
    case 'needs repair':
    case 'damaged':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const DetailItem = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
}) => (
  <div className="flex items-start gap-3 rounded-md border bg-white p-3">
    <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium text-foreground break-words">{value || 'N/A'}</div>
    </div>
  </div>
);

const Section = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) => (
  <Card className="overflow-hidden">
    <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3 text-sm font-semibold">
      <Icon className="h-4 w-4 text-primary" />
      {title}
    </div>
    <CardContent className="p-4">{children}</CardContent>
  </Card>
);

const AssetPublicProfilePage: React.FC = () => {
  const asset = useMemo<AssetQrSnapshot | null>(() => {
    const payload = window.location.hash.replace(/^#/, '');
    if (!payload) return null;

    try {
      return decodeAssetQrSnapshot(payload);
    } catch (error) {
      console.error('Could not decode asset QR snapshot:', error);
      return null;
    }
  }, []);

  if (!asset) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <Card className="max-w-md text-center">
          <CardContent className="p-8">
            <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h1 className="text-2xl font-semibold">Asset QR unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This QR code does not contain a readable asset snapshot.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <style>{`
        @media print {
          .asset-public-actions { display: none !important; }
          body { background: #ffffff !important; }
        }
      `}</style>

      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="asset-public-actions flex justify-end">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>

        <Card className="overflow-hidden border-primary/20 shadow-sm">
          <div className="grid gap-0 md:grid-cols-[280px_1fr]">
            <div className="bg-white p-6">
              <div className="flex aspect-square items-center justify-center rounded-lg border bg-muted/40 text-7xl font-semibold text-muted-foreground/50">
                {String(asset.name || 'AS').substring(0, 2).toUpperCase()}
              </div>
              <div className="mt-4">
                <Badge variant="outline" className={cn("px-3 py-1 text-xs font-semibold uppercase tracking-wider", getConditionBadgeClass(asset.condition))}>
                  {asset.condition || 'Unknown'}
                </Badge>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
                <Package className="h-4 w-4" />
                SCPNG Asset Registry
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{asset.name || 'Unnamed Asset'}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{asset.type || 'Uncategorized'}</Badge>
                <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">ID: {asset.id || 'N/A'}</span>
                {asset.serial_number && (
                  <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">Serial: {asset.serial_number}</span>
                )}
              </div>

              {asset.description && (
                <div className="mt-5 rounded-md border bg-muted/30 p-4 text-sm leading-relaxed text-foreground/80">
                  {asset.description}
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <DetailItem label="Assigned To" value={asset.assigned_to || 'N/A'} icon={Briefcase} />
                <DetailItem label="Email" value={asset.assigned_to_email || 'N/A'} icon={Mail} />
                <DetailItem label="Unit" value={asset.unit || 'N/A'} icon={Building2} />
                <DetailItem label="Division" value={asset.division || 'N/A'} icon={ShieldCheck} />
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Hardware Details" icon={Wrench}>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Brand" value={asset.brand || 'N/A'} icon={Package} />
              <DetailItem label="Model" value={asset.model || 'N/A'} icon={Package} />
              <DetailItem label="Vendor" value={asset.vendor || 'N/A'} icon={Building2} />
              <DetailItem label="YTD Usage" value={asset.ytd_usage || 'N/A'} icon={Activity} />
            </div>
          </Section>

          <Section title="Lifecycle & Financials" icon={CalendarDays}>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Purchase Date" value={formatDate(asset.purchase_date)} icon={CalendarDays} />
              <DetailItem label="Assigned Date" value={formatDate(asset.assigned_date)} icon={CalendarDays} />
              <DetailItem label="Warranty Expiry" value={formatDate(asset.warranty_expiry_date)} icon={ShieldCheck} />
              <DetailItem label="Expected Expiry" value={formatDate(asset.expiry_date)} icon={CalendarDays} />
              <DetailItem label="Purchase Cost" value={asset.purchase_cost != null ? formatCurrency(asset.purchase_cost) : 'N/A'} icon={CircleDollarSign} />
              <DetailItem label="Life Expectancy" value={asset.life_expectancy_years ? `${asset.life_expectancy_years} years` : 'N/A'} icon={CircleDollarSign} />
            </div>
          </Section>
        </div>

        {asset.notes && (
          <Section title="Notes" icon={FileText}>
            <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">{asset.notes}</p>
          </Section>
        )}

        {asset.generated_at && (
          <p className="pb-4 text-center text-xs text-muted-foreground">
            Snapshot generated {formatDate(asset.generated_at, true)}
          </p>
        )}
      </div>
    </div>
  );
};

export default AssetPublicProfilePage;
