import { Client } from '@microsoft/microsoft-graph-client';
import type { GalleryData, GalleryPhoto } from '@/integrations/supabase/galleryService';

const SITE_DOMAIN = 'scpng1.sharepoint.com';
const SITE_PATH = '/sites/scpngintranet';
const ASSET_LIBRARY_NAME = 'Asset Images';

type GalleryPhotoWithDisplayUrl = GalleryPhoto & {
  display_url?: string;
};

let siteId: string | null = null;
let assetDriveId: string | null = null;
const urlCache = new Map<string, string>();

const isBlobUrl = (url?: string) => Boolean(url?.startsWith('blob:'));

export const getGalleryPhotoDisplayUrl = (photo: Pick<GalleryPhotoWithDisplayUrl, 'image_url' | 'display_url'>) =>
  photo.display_url || photo.image_url;

export const revokeGalleryDisplayUrls = (data: GalleryData) => {
  Object.values(data).forEach(events => {
    events.forEach(event => {
      event.images.forEach(photo => {
        const displayUrl = (photo as GalleryPhotoWithDisplayUrl).display_url;
        if (isBlobUrl(displayUrl)) {
          URL.revokeObjectURL(displayUrl);
        }
      });
    });
  });
};

export const clearGalleryImageUrlCache = () => {
  urlCache.forEach(url => {
    if (isBlobUrl(url)) {
      URL.revokeObjectURL(url);
    }
  });
  urlCache.clear();
};

const initialize = async (client: Client) => {
  if (siteId && assetDriveId) return;

  const site = await client
    .api(`/sites/${SITE_DOMAIN}:${SITE_PATH}`)
    .select('id')
    .get();
  siteId = site.id;

  const lists = await client
    .api(`/sites/${siteId}/lists`)
    .select('id,displayName,name')
    .get();

  const assetLibrary = lists.value.find((list: any) =>
    list.displayName === ASSET_LIBRARY_NAME || list.name === ASSET_LIBRARY_NAME
  );

  if (!assetLibrary) {
    throw new Error(`${ASSET_LIBRARY_NAME} library not found in SharePoint.`);
  }

  const drive = await client
    .api(`/sites/${siteId}/lists/${assetLibrary.id}/drive`)
    .select('id')
    .get();
  assetDriveId = drive.id;
};

const extractAssetLibraryPath = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const decodedPath = decodeURIComponent(parsed.pathname);
    const sitePrefix = `${SITE_PATH}/${ASSET_LIBRARY_NAME}/`;
    const prefixIndex = decodedPath.indexOf(sitePrefix);

    if (prefixIndex === -1) return null;

    return decodedPath.slice(prefixIndex + sitePrefix.length).replace(/^\/+/, '');
  } catch {
    return null;
  }
};

export const resolveGalleryPhotoImageUrl = async (
  client: Client | null,
  photo: Pick<GalleryPhotoWithDisplayUrl, 'image_url' | 'sharepoint_url' | 'display_url'>
): Promise<string | null> => {
  if (!client) return null;

  const imageUrl = photo.display_url || photo.sharepoint_url || photo.image_url;
  if (!imageUrl || isBlobUrl(imageUrl) || !imageUrl.includes(SITE_DOMAIN)) {
    return null;
  }

  if (urlCache.has(imageUrl)) {
    return urlCache.get(imageUrl) || null;
  }

  const assetPath = extractAssetLibraryPath(imageUrl);
  if (!assetPath) return null;

  await initialize(client);
  if (!siteId || !assetDriveId) return null;

  const encodedAssetPath = assetPath
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');

  try {
    const blob = await client
      .api(`/sites/${siteId}/drives/${assetDriveId}/root:/${encodedAssetPath}:/thumbnails/0/large/content`)
      .responseType('blob' as any)
      .get();
    const objectUrl = URL.createObjectURL(blob);
    urlCache.set(imageUrl, objectUrl);
    return objectUrl;
  } catch {
    try {
      const blob = await client
        .api(`/sites/${siteId}/drives/${assetDriveId}/root:/${encodedAssetPath}:/content`)
        .responseType('blob' as any)
        .get();
      const objectUrl = URL.createObjectURL(blob);
      urlCache.set(imageUrl, objectUrl);
      return objectUrl;
    } catch (error) {
      console.warn(`Failed to fetch gallery image through Microsoft Graph: ${assetPath}`, error);
      return null;
    }
  }
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  });

  await Promise.all(workers);
  return results;
};

export const resolveGalleryDataImageUrls = async (client: Client | null, data: GalleryData): Promise<GalleryData> => {
  if (!client) return data;

  const photos = Object.values(data).flatMap(events => events.flatMap(event => event.images));
  const resolvedPhotos = new Map<string, GalleryPhotoWithDisplayUrl>();

  await mapWithConcurrency(photos, 6, async photo => {
    const displayUrl = await resolveGalleryPhotoImageUrl(client, photo);
    resolvedPhotos.set(photo.id, displayUrl ? { ...photo, display_url: displayUrl } : photo);
  });

  const resolvedData: GalleryData = {};
  Object.entries(data).forEach(([year, events]) => {
    resolvedData[year] = events.map(event => ({
      ...event,
      images: event.images.map(photo => resolvedPhotos.get(photo.id) || photo),
    }));
  });

  return resolvedData;
};
