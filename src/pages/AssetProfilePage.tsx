import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  CircleDollarSign,
  FileText,
  Loader2,
  Mail,
  Package,
  Printer,
  QrCode,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Asset } from '@/services/assetsSharePointService';
import { useAssetsSharePoint } from '@/hooks/useAssetsSharePoint';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { generateAssetQrDataUrl } from '@/utils/assetQr';

const getConditionBadgeClass = (condition?: string | null | number) => {
  if (!condition) return 'bg-gray-100 text-gray-800 border-gray-200';
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

const DetailItem = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
}) => (
  <div className="flex items-start gap-3 rounded-md border bg-background/70 p-3">
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
    <CardContent className="p-4">
      {children}
    </CardContent>
  </Card>
);

const AssetProfilePage: React.FC = () => {
  const { assetId } = useParams<{ assetId: string }>();
  const { getAssetByAssetId } = useAssetsSharePoint();
  const { user, isAdmin, hasPermission } = useRoleBasedAuth();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [qrImageSrc, setQrImageSrc] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadAsset = async () => {
      if (!assetId) {
        setError('No asset ID was provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const result = await getAssetByAssetId(decodeURIComponent(assetId));
        if (!isMounted) return;

        if (!result) {
          setAsset(null);
          setError('Asset not found.');
          return;
        }

        setAsset(result);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Could not load this asset.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAsset();

    return () => {
      isMounted = false;
    };
  }, [assetId, getAssetByAssetId]);

  useEffect(() => {
    let isMounted = true;

    if (!asset) {
      setQrImageSrc('');
      return;
    }

    generateAssetQrDataUrl(asset)
      .then((src) => {
        if (!isMounted) return;
        setQrImageSrc(src);
      })
      .catch((err) => {
        console.warn('Failed to render asset QR image:', err);
        if (isMounted) setQrImageSrc('');
      });

    return () => {
      isMounted = false;
    };
  }, [asset]);

  const handlePrint = () => window.print();
  const roleName = user?.role_name?.toLowerCase() || '';
  const unitName = user?.unit_name?.toLowerCase() || '';
  const canViewFullAssetDetails =
    isAdmin ||
    roleName === 'manager' ||
    roleName === 'admin' ||
    roleName === 'super_admin' ||
    unitName === 'it' ||
    hasPermission('assets', 'admin') ||
    hasPermission('assets', 'write');

  if (loading) {
    return (
      <PageLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading asset profile...</span>
        </div>
      </PageLayout>
    );
  }

  if (error || !asset) {
    return (
      <PageLayout>
        <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
          <Package className="mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Asset unavailable</h1>
          <p className="mt-2 text-muted-foreground">{error || 'This asset could not be loaded.'}</p>
          <Button asChild className="mt-6">
            <Link to="/asset-management">Back to Asset Registry</Link>
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <style>{`
        @media print {
          .asset-profile-actions, aside, nav, header { display: none !important; }
          main, body { background: #ffffff !important; }
          .asset-profile-shell { padding: 0 !important; }
          .asset-profile-card { box-shadow: none !important; border-color: #d1d5db !important; }
        }
      `}</style>

      <div className="asset-profile-shell mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="asset-profile-actions flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" asChild className="w-fit">
            <Link to="/asset-management">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Asset Registry
            </Link>
          </Button>
          <Button variant="outline" onClick={handlePrint} className="w-fit">
            <Printer className="mr-2 h-4 w-4" />
            Print Profile
          </Button>
        </div>

        <Card className="asset-profile-card overflow-hidden border-primary/20 shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[360px_1fr]">
            <div className="bg-muted/50 p-6">
              <div className="aspect-square overflow-hidden rounded-lg border bg-background shadow-sm">
                {asset.image_url ? (
                  <img src={asset.image_url} alt={asset.name || 'Asset'} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-7xl font-semibold text-muted-foreground/50">
                    {String(asset.name || 'A').substring(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <Badge variant="outline" className={cn("px-3 py-1 text-xs font-semibold uppercase tracking-wider", getConditionBadgeClass(asset.condition))}>
                  {asset.condition || 'Unknown'}
                </Badge>
                {qrImageSrc && (
                  <div className="rounded-md border bg-white p-1.5">
                    <img src={qrImageSrc} alt="Asset QR code" className="h-16 w-16 object-contain" />
                  </div>
                )}
              </div>
            </div>

            <div className="p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
                    <Package className="h-4 w-4" />
                    SCPNG Asset Registry
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight">{asset.name || 'Unnamed Asset'}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{asset.type || 'Uncategorized'}</Badge>
                    <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">ID: {asset.id || 'N/A'}</span>
                    {asset.serial_number && (
                      <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">Serial: {asset.serial_number}</span>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {canViewFullAssetDetails
                      ? 'Full asset record visible based on your access level.'
                      : 'General asset ownership information.'}
                  </p>
                </div>
              </div>

              {asset.description && (
                <div className="mb-5 rounded-md border bg-muted/30 p-4 text-sm leading-relaxed text-foreground/80">
                  {asset.description}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
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
              <DetailItem label="Serial Number" value={asset.serial_number || 'N/A'} icon={QrCode} />
              <DetailItem label="Condition" value={asset.condition || 'N/A'} icon={Activity} />
              {canViewFullAssetDetails && (
                <>
                  <DetailItem label="Vendor" value={asset.vendor || 'N/A'} icon={Building2} />
                  <DetailItem label="YTD Usage" value={asset.ytd_usage || 'N/A'} icon={Activity} />
                </>
              )}
            </div>
          </Section>

          <Section title={canViewFullAssetDetails ? "Lifecycle & Financials" : "Assignment Timeline"} icon={CalendarDays}>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Assigned Date" value={formatDate(asset.assigned_date)} icon={CalendarDays} />
              {canViewFullAssetDetails ? (
                <>
                  <DetailItem label="Purchase Date" value={formatDate(asset.purchase_date)} icon={CalendarDays} />
                  <DetailItem label="Warranty Expiry" value={formatDate(asset.warranty_expiry_date)} icon={ShieldCheck} />
                  <DetailItem label="Expected Expiry" value={formatDate(asset.expiry_date)} icon={CalendarDays} />
                  <DetailItem label="Purchase Cost" value={asset.purchase_cost != null ? formatCurrency(asset.purchase_cost) : 'N/A'} icon={CircleDollarSign} />
                  <DetailItem label="Depreciated Value" value={asset.depreciated_value != null ? formatCurrency(asset.depreciated_value) : 'N/A'} icon={CircleDollarSign} />
                  <DetailItem label="Life Expectancy" value={asset.life_expectancy_years ? `${asset.life_expectancy_years} years` : 'N/A'} icon={CalendarDays} />
                </>
              ) : (
                <>
                  <DetailItem label="Assigned To" value={asset.assigned_to || 'N/A'} icon={Briefcase} />
                  <DetailItem label="Unit" value={asset.unit || 'N/A'} icon={Building2} />
                  <DetailItem label="Division" value={asset.division || 'N/A'} icon={ShieldCheck} />
                </>
              )}
            </div>
          </Section>
        </div>

        {canViewFullAssetDetails && (asset.notes || asset.admin_comments || asset.invoice_url || asset.barcode_url) && (
          <Section title="Notes & References" icon={FileText}>
            <div className="space-y-4">
              {asset.notes && (
                <div>
                  <p className="text-sm font-semibold">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">{asset.notes}</p>
                </div>
              )}
              {asset.admin_comments && (
                <div>
                  <p className="text-sm font-semibold">Admin Comments</p>
                  <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">{asset.admin_comments}</p>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {asset.invoice_url && <DetailItem label="Invoice URL" value={<a href={asset.invoice_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Open invoice</a>} icon={FileText} />}
                {asset.barcode_url && <DetailItem label="Barcode URL" value={<a href={asset.barcode_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Open barcode</a>} icon={QrCode} />}
              </div>
            </div>
          </Section>
        )}
      </div>
    </PageLayout>
  );
};

export default AssetProfilePage;
