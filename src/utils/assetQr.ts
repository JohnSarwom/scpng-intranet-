import QRCode from 'qrcode';
import type { Asset } from '@/services/assetsSharePointService';

export interface AssetQrSnapshot {
  id?: string;
  name?: string;
  type?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  condition?: string;
  assigned_to?: string;
  assigned_to_email?: string;
  assigned_date?: string;
  unit?: string;
  division?: string;
  description?: string;
  purchase_date?: string;
  purchase_cost?: number;
  vendor?: string;
  warranty_expiry_date?: string;
  expiry_date?: string;
  life_expectancy_years?: number;
  ytd_usage?: string;
  notes?: string;
  generated_at?: string;
}

const toBase64Url = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const fromBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new TextDecoder().decode(bytes);
};

export const buildAssetQrSnapshot = (asset: Asset): AssetQrSnapshot => ({
  id: asset.id,
  name: asset.name,
  type: asset.type,
  brand: asset.brand,
  model: asset.model,
  serial_number: asset.serial_number,
  condition: asset.condition,
  assigned_to: asset.assigned_to,
  assigned_to_email: asset.assigned_to_email,
  assigned_date: asset.assigned_date,
  unit: asset.unit,
  division: asset.division,
  description: asset.description,
  purchase_date: asset.purchase_date,
  purchase_cost: asset.purchase_cost,
  vendor: asset.vendor,
  warranty_expiry_date: asset.warranty_expiry_date,
  expiry_date: asset.expiry_date,
  life_expectancy_years: asset.life_expectancy_years,
  ytd_usage: asset.ytd_usage,
  notes: asset.notes,
  generated_at: new Date().toISOString(),
});

export const encodeAssetQrSnapshot = (asset: Asset): string => {
  return toBase64Url(JSON.stringify(buildAssetQrSnapshot(asset)));
};

export const decodeAssetQrSnapshot = (payload: string): AssetQrSnapshot => {
  return JSON.parse(fromBase64Url(payload));
};

export const buildAssetProfileUrl = (assetOrId: Asset | string): string => {
  const configuredBaseUrl = import.meta.env.VITE_ASSET_QR_BASE_URL?.trim();
  const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const origin = (configuredBaseUrl || runtimeOrigin).replace(/\/$/, '');

  if (typeof assetOrId === 'string') {
    return `${origin}/asset-view/${encodeURIComponent(assetOrId)}`;
  }

  const assetId = assetOrId.id || assetOrId.sharepoint_item_id || '';
  return `${origin}/asset-view/${encodeURIComponent(assetId)}`;
};

export const generateAssetQrDataUrl = (assetOrId: Asset | string): Promise<string> => {
  return QRCode.toDataURL(buildAssetProfileUrl(assetOrId), {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 8,
    color: {
      dark: '#111827',
      light: '#ffffff',
    },
  });
};
