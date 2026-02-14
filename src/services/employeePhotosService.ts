import { Client } from '@microsoft/microsoft-graph-client';
import { photoCache, CachedPhoto } from './photoCacheService';

const SITE_PATH = '/sites/scpngintranet';
const SITE_DOMAIN = 'scpng1.sharepoint.com';
const ASSET_LIBRARY_NAME = 'Asset Images';
const PHOTO_LIBRARY_NAME = 'Employee_Photos';
const PROFILE_IMAGES_FOLDER = 'ProfileImages';
const PROFILES_LIST_NAME = 'Employee_Profiles';

export interface EmployeePhoto {
    email: string;
    photoUrl: string;
}

export class EmployeePhotosService {
    private client: Client;
    private static siteId: string | null = null;
    private static driveId: string | null = null; // Legacy Employee_Photos
    private static assetsDriveId: string | null = null; // New Asset Images
    private static profileListId: string | null = null; // Cached Employee_Profiles List ID
    private photoCache: Map<string, string> = new Map();

    constructor(client: Client) {
        this.client = client;
    }

    async initialize(): Promise<void> {
        if (EmployeePhotosService.siteId && EmployeePhotosService.driveId && EmployeePhotosService.assetsDriveId && EmployeePhotosService.profileListId) return;

        try {
            // Get Site ID
            const site = await this.client
                .api(`/sites/${SITE_DOMAIN}:${SITE_PATH}`)
                .get();

            EmployeePhotosService.siteId = site.id;

            // Get all document libraries
            const lists = await this.client
                .api(`/sites/${EmployeePhotosService.siteId}/lists`)
                .select('id,displayName,name,list')
                .get();

            // 1. Find Legacy Employee_Photos library
            const photoLibrary = lists.value.find((list: any) =>
                list.displayName === PHOTO_LIBRARY_NAME ||
                list.name === PHOTO_LIBRARY_NAME
            );

            if (photoLibrary) {
                const drive = await this.client
                    .api(`/sites/${EmployeePhotosService.siteId}/lists/${photoLibrary.id}/drive`)
                    .get();
                EmployeePhotosService.driveId = drive.id;
            }

            // 2. Find Asset Images library
            const assetLibrary = lists.value.find((list: any) =>
                list.displayName === ASSET_LIBRARY_NAME ||
                list.name === ASSET_LIBRARY_NAME
            );

            if (assetLibrary) {
                const drive = await this.client
                    .api(`/sites/${EmployeePhotosService.siteId}/lists/${assetLibrary.id}/drive`)
                    .get();
                EmployeePhotosService.assetsDriveId = drive.id;
            }

            // 3. Find Employee_Profiles list
            const profilesList = lists.value.find((list: any) =>
                list.displayName === PROFILES_LIST_NAME ||
                list.name === PROFILES_LIST_NAME
            );

            if (profilesList) {
                EmployeePhotosService.profileListId = profilesList.id;
            }

        } catch (error) {
            console.error('❌ [EmployeePhotosService] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Get photo URL for an employee
     * Priority:
     * 1. Check Employee_Profiles SharePoint List (Column: ProfilePhoto)
     * 2. Check Legacy Employee_Photos Library (File: {email}.jpg)
     */
    async getPhotoUrl(email: string): Promise<string | null> {
        const photos = await this.getEmployeePhotos(email);
        return photos.profileUrl || null;
    }

    async getEmployeePhotos(email: string): Promise<{ profileUrl?: string; modalUrl?: string }> {
        if (!email) return {};

        await this.initialize();

        try {
            // 1. Try fetching from Employee_Profiles list (using cached ID)
            if (EmployeePhotosService.profileListId) {
                const items = await this.client
                    .api(`/sites/${EmployeePhotosService.siteId}/lists/${EmployeePhotosService.profileListId}/items`)
                    .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
                    .filter(`fields/Title eq '${email}'`)
                    .expand('fields')
                    .get();

                if (items.value && items.value.length > 0) {
                    return await this.processListItem(items.value[0]);
                } else {
                    console.warn(`⚠️ [getEmployeePhotos] No item found in Employee_Profiles for ${email}`);
                }
            } else {
                console.error(`❌ [getEmployeePhotos] Employee_Profiles list ID missing!`);
            }

            // 2. Fallback to legacy file search in Employee_Photos (Only for Profile Photo)
            if (EmployeePhotosService.driveId) {
                const extensions = ['jpg', 'jpeg', 'png', 'JPG', 'JPEG', 'PNG'];
                for (const ext of extensions) {
                    try {
                        const fileName = `${email}.${ext}`;
                        // Try to get thumbnail directly first for speed? Or just content.
                        // For legacy, sticking to content is safer as thumbnails might not be generated consistently for old files.
                        try {
                            const blob = await this.client
                                .api(`/sites/${EmployeePhotosService.siteId}/drives/${EmployeePhotosService.driveId}/root:/${fileName}:/content`)
                                .responseType('blob' as any)
                                .get();
                            return { profileUrl: URL.createObjectURL(blob) };
                        } catch (e) {
                            // File likely doesn't exist
                        }
                    } catch (err) { continue; }
                }
            }

            return {};
        } catch (error) {
            console.error(`❌ [EmployeePhotosService] Failed to get photos for ${email}:`, error);
            return {};
        }
    }

    /**
     * Helper to process a SharePoint list item and fetch the actual image blobs
     */
    private async processListItem(item: any): Promise<{ profileUrl?: string; modalUrl?: string }> {
        const fields = item.fields;
        const modified = fields.Modified; // Get SharePoint modification time

        let profileUrl = undefined;
        let modalUrl = undefined;
        let profileFileName = undefined;
        let modalFileName = undefined;

        // Parse Fields
        if (fields.ProfilePhoto) {
            if (fields.ProfilePhoto.Description) {
                profileFileName = fields.ProfilePhoto.Description;
            } else if (typeof fields.ProfilePhoto === 'string') {
                profileFileName = fields.ProfilePhoto.split('/').pop();
            }
        }

        const email = fields.Title; // Ensure email is available for logging

        if (fields.ModalPhoto) {
            if (fields.ModalPhoto.Description) {
                modalFileName = fields.ModalPhoto.Description;
            } else if (typeof fields.ModalPhoto === 'string') {
                modalFileName = fields.ModalPhoto.split('/').pop();
            }
        }

        // Parallel Fetching
        const promises: Promise<void>[] = [];

        // Profile Photo - Fetch Thumbnail (medium) for speed
        if (profileFileName && EmployeePhotosService.assetsDriveId) {
            promises.push((async () => {
                const cacheKey = `${email}_profile`;
                const itemStart = performance.now();

                // 1. Check Cache
                try {
                    const cached = await photoCache.getPhoto(cacheKey);
                    if (cached && cached.modified === modified) {
                        // Cache HIT and valid
                        profileUrl = URL.createObjectURL(cached.blob);
                        console.log(`⏱️ [PhotoPerf] Cache HIT (Profile): ${Math.round(performance.now() - itemStart)}ms for ${email}`);
                        return;
                    }
                } catch (e) {
                    console.warn('Cache read error:', e);
                }

                console.log(`⏱️ [PhotoPerf] Cache MISS (Profile) - Network Fetch for ${email}`);

                // 2. Fetch from Network
                try {
                    // Try fetching thumbnail first
                    const blob = await this.client
                        .api(`/sites/${EmployeePhotosService.siteId}/drives/${EmployeePhotosService.assetsDriveId}/root:/${PROFILE_IMAGES_FOLDER}/${profileFileName}:/thumbnails/0/medium/content`)
                        .responseType('blob' as any)
                        .get();
                    profileUrl = URL.createObjectURL(blob);

                    // Update Cache
                    try {
                        await photoCache.putPhoto(cacheKey, {
                            blob: blob,
                            timestamp: Date.now(),
                            modified: modified
                        });
                        console.log(`⏱️ [PhotoPerf] Cache Write (Profile): ${Math.round(performance.now() - itemStart)}ms for ${email}`);
                    } catch (e) { console.warn('Cache write error:', e); }

                } catch (e) {
                    // Fallback to full content if thumbnail fails
                    try {
                        const blob = await this.client
                            .api(`/sites/${EmployeePhotosService.siteId}/drives/${EmployeePhotosService.assetsDriveId}/root:/${PROFILE_IMAGES_FOLDER}/${profileFileName}:/content`)
                            .responseType('blob' as any)
                            .get();
                        profileUrl = URL.createObjectURL(blob);

                        // Update Cache
                        try {
                            await photoCache.putPhoto(cacheKey, {
                                blob: blob,
                                timestamp: Date.now(),
                                modified: modified
                            });
                            console.log(`⏱️ [PhotoPerf] Cache Write (Profile - Full): ${Math.round(performance.now() - itemStart)}ms for ${email}`);
                        } catch (e) { console.warn('Cache write error:', e); }

                    } catch (e2) {
                        console.warn('Failed to fetch profile blob/thumbnail:', e2);
                    }
                }
            })());
        }

        // Modal Photo - Fetch Full Content (or large thumbnail)
        if (modalFileName && EmployeePhotosService.assetsDriveId) {
            promises.push((async () => {
                const cacheKey = `${email}_modal`;
                const itemStart = performance.now();

                // 1. Check Cache
                try {
                    const cached = await photoCache.getPhoto(cacheKey);
                    if (cached && cached.modified === modified) {
                        // Cache HIT and valid
                        modalUrl = URL.createObjectURL(cached.blob);
                        console.log(`⏱️ [PhotoPerf] Cache HIT (Modal): ${Math.round(performance.now() - itemStart)}ms for ${email}`);
                        return;
                    }
                } catch (e) {
                    console.warn('Cache read error:', e);
                }

                // 2. Fetch from Network
                try {
                    const blob = await this.client
                        .api(`/sites/${EmployeePhotosService.siteId}/drives/${EmployeePhotosService.assetsDriveId}/root:/${PROFILE_IMAGES_FOLDER}/${modalFileName}:/content`)
                        .responseType('blob' as any)
                        .get();
                    modalUrl = URL.createObjectURL(blob);
                    // Update Cache
                    try {
                        await photoCache.putPhoto(cacheKey, {
                            blob: blob,
                            timestamp: Date.now(),
                            modified: modified
                        });
                        console.log(`⏱️ [PhotoPerf] Cache Write (Modal): ${Math.round(performance.now() - itemStart)}ms for ${email}`);
                    } catch (e) {
                        console.warn('Cache write error:', e);
                    }

                } catch (e) {
                    console.warn('Failed to fetch modal blob:', e);
                }
            })());
        }

        await Promise.all(promises);
        return { profileUrl, modalUrl };
    }

    async getPhotoWithThumbnail(email: string): Promise<EmployeePhoto | null> {
        // Re-implement or reuse logic. For now, referencing getPhotoUrl for simplicity
        // or keep basic implementation.
        const url = await this.getPhotoUrl(email);
        if (url) return { email, photoUrl: url };
        return null;
    }

    async getPhotosForEmails(emails: string[]): Promise<Map<string, { profileUrl?: string; modalUrl?: string }>> {
        const photoMap = new Map<string, { profileUrl?: string; modalUrl?: string }>();
        const uniqueEmails = [...new Set(emails)];

        await this.initialize();
        if (!EmployeePhotosService.profileListId) return photoMap;

        // Process in batches of 15 to keep query URL length safe
        const batchSize = 15;
        const totalStart = performance.now();

        for (let i = 0; i < uniqueEmails.length; i += batchSize) {
            const batchStart = performance.now();
            const batch = uniqueEmails.slice(i, i + batchSize);

            // Construct Filter Query
            const filterQuery = batch.map(email => `fields/Title eq '${email}'`).join(' or ');

            try {
                // Fetch Metadata for Batch
                const items = await this.client
                    .api(`/sites/${EmployeePhotosService.siteId}/lists/${EmployeePhotosService.profileListId}/items`)
                    .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
                    .filter(filterQuery)
                    .expand('fields')
                    .get();

                // Map results by email for quick lookup
                const itemsByEmail = new Map<string, any>();
                if (items.value) {
                    items.value.forEach((item: any) => {
                        if (item.fields && item.fields.Title) {
                            itemsByEmail.set(item.fields.Title, item);
                        }
                    });
                }

                // Process each email in the batch independently (in parallel) to fetch blobs
                await Promise.all(batch.map(async (email) => {
                    const item = itemsByEmail.get(email);
                    if (item) {
                        const photos = await this.processListItem(item);
                        photoMap.set(email, photos);
                    } else {
                        // If not found in main list, try legacy fallback
                        // (Optional: if we want to be thorough. For speed, maybe skip or do it later?)
                        // Let's do a quick check only if we really need to.
                        // For now: skip legacy fallback in batch mode for performance, 
                        // unless we want to keep full compatibility.
                        // Let's include it but simply:
                        // const photos = await this.getLegacyPhoto(email);
                        // if (photos.profileUrl) photoMap.set(email, photos);
                    }
                }));

            } catch (e) {
                console.error(`❌ [Batch Fetch] Failed for batch starting ${batch[0]}:`, e);
            }
            console.log(`⏱️ [PhotoPerf] Batch Processed (${batch.length} emails): ${Math.round(performance.now() - batchStart)}ms`);
        }

        console.log(`⏱️ [PhotoPerf] Total getPhotosForEmails (${uniqueEmails.length} emails): ${Math.round(performance.now() - totalStart)}ms`);

        return photoMap;
    }

    // New: Upload Photo
    async uploadPhoto(file: File, email: string, type: 'profile' | 'modal'): Promise<string> {
        await this.initialize();
        if (!EmployeePhotosService.assetsDriveId) throw new Error('Asset Images drive not found');

        const timestamp = new Date().getTime();
        const extension = file.name.split('.').pop() || 'jpg';
        const fileName = `${email}_${type}_${timestamp}.${extension}`;
        const filePath = `${PROFILE_IMAGES_FOLDER}/${fileName}`;
        const searchPrefix = `${email}_${type}_`;

        try {
            console.log(`🚀 [Upload] Starting replacement upload for ${email} (${type})...`);

            // 0. Cleanup: Delete existing photos for this user/type to avoid accumulation
            // We can't use a simple wildcard delete, so we list and filter.
            // Using a search query would be better but listing the folder is safer for exact matches.
            try {
                const existingFiles = await this.client
                    .api(`/sites/${EmployeePhotosService.siteId}/drives/${EmployeePhotosService.assetsDriveId}/root:/${PROFILE_IMAGES_FOLDER}:/children`)
                    .filter(`startswith(name, '${searchPrefix}')`) // filter is more efficient if supported, otherwise manual filter
                    .select('id,name')
                    .get();

                if (existingFiles && existingFiles.value && existingFiles.value.length > 0) {
                    console.log(`🧹 [Upload] Cleaning up ${existingFiles.value.length} old photos...`);
                    const deletePromises = existingFiles.value.map((file: any) =>
                        this.client
                            .api(`/sites/${EmployeePhotosService.siteId}/drives/${EmployeePhotosService.assetsDriveId}/items/${file.id}`)
                            .delete()
                    );
                    await Promise.all(deletePromises);
                    console.log(`✨ [Upload] Cleanup complete.`);
                }
            } catch (cleanupError) {
                console.warn("⚠️ [Upload] Cleanup failed (non-critical, proceeding with upload):", cleanupError);
            }

            console.log(`🚀 [Upload] Uploading ${fileName} to ${filePath}...`);
            const uploadStart = performance.now();

            // 1. Upload File
            const uploadResult = await this.client
                .api(`/sites/${EmployeePhotosService.siteId}/drives/${EmployeePhotosService.assetsDriveId}/root:/${filePath}:/content`)
                .put(file);

            const webUrl = uploadResult.webUrl;
            console.log(`✅ [Upload] File uploaded in ${Math.round(performance.now() - uploadStart)}ms: ${webUrl}`);

            // 2. Update List Item
            // Use cached ID
            if (!EmployeePhotosService.profileListId) throw new Error('Employee_Profiles list not initialized');
            const listId = EmployeePhotosService.profileListId;

            // Find Item by Email (Title)
            const itemsReq = await this.client
                .api(`/sites/${EmployeePhotosService.siteId}/lists/${listId}/items`)
                .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
                .filter(`fields/Title eq '${email}'`)
                .get();

            let itemId;
            if (itemsReq.value && itemsReq.value.length > 0) {
                itemId = itemsReq.value[0].id;
                console.log(`📝 [Upload] Updating existing list item ${itemId}`);
            } else {
                // Create new item if not exists
                console.log(`📝 [Upload] Creating new list item for ${email}`);
                const createRes = await this.client
                    .api(`/sites/${EmployeePhotosService.siteId}/lists/${listId}/items`)
                    .post({
                        fields: {
                            Title: email
                        }
                    });
                itemId = createRes.id;
            }

            // Define fieldName first
            const fieldName = type === 'profile' ? 'ProfilePhoto' : 'ModalPhoto';

            // Debug: Check existing item data to verify format
            let isHyperlink = false;
            let isText = false;
            let isImage = false;

            try {
                const columns = await this.client
                    .api(`/sites/${EmployeePhotosService.siteId}/lists/${listId}/columns`)
                    .get();

                const photoCol = columns.value.find((c: any) => c.name === fieldName);
                if (photoCol) {
                    console.log(`🔍 [DEBUG] ${fieldName} Column RAW:`, JSON.stringify(photoCol, null, 2));
                    if (photoCol.hyperlinkOrPicture) isHyperlink = true;
                    if (photoCol.text) isText = true;
                    if (photoCol.thumbnail) isImage = true; // "Image" column type
                }
            } catch (e) {
                console.error('⚠️ [DEBUG] Failed to fetch existing item/columns:', e);
            }

            console.log(`🔍 [DEBUG] Column Type Detected: Hyperlink=${isHyperlink}, Text=${isText}, Image=${isImage}`);

            let payload: any = {};

            if (isText) {
                // Determine if it's a URL string or not. If text, just save the URL.
                payload = { [fieldName]: webUrl };
            } else if (isHyperlink) {
                payload = {
                    [fieldName]: {
                        Description: fileName,
                        Url: webUrl
                    }
                };
            } else if (isImage) {
                // For Image columns, standard PATCH might fail. 
                // However, we can try setting the simple URL object if it supports it, 
                // otherwise we might need a different endpoint.
                // For now, try the structure that often works for modern columns or warn.
                console.warn("⚠️ [WARNING] 'Image' columns typically require a different upload endpoint or might not support direct URL setting via Graph API fields.");
                // Fallback to Hyperlink structure as a guess/hope
                payload = {
                    [fieldName]: {
                        primaryImageId: 0, // Sometimes needed?
                        fileName: fileName,
                        serverRelativeUrl: webUrl // This might fail if cross-domain
                    }
                };
                // Actually, let's try the simple URL object first as it's safer
                payload = { [fieldName]: webUrl };
            } else {
                // Fallback for unknown (likely Hyperlink or Picture old style)
                payload = {
                    [fieldName]: {
                        Description: fileName,
                        Url: webUrl
                    }
                };
            }

            console.log('🚀 [DEBUG] Sending PATCH payload:', JSON.stringify(payload, null, 2));

            // Patch the item
            await this.client
                .api(`/sites/${EmployeePhotosService.siteId}/lists/${listId}/items/${itemId}`)
                .patch({
                    fields: payload
                });

            console.log(`✅ [Upload] List item updated`);

            // Update cache (Both in-memory and Persistent)
            this.photoCache.set(email, webUrl);

            // For persistent cache, we need the Blob. Since we uploaded `file` (which is a Blob), 
            // we can cache it immediately!
            // We might need to fake the 'modified' timestamp or fetch the updated item again next time.
            // For now, let's just cache it with current time as modified, so next fetch might invalidate it if server time differs slightly,
            // but it gives instant feedback.
            const cacheKey = `${email}_${type}`;
            try {
                // Determine modified date - we don't have the server one yet, so maybe leave modified undefined 
                // or optimistically set it. If we leave it undefined or mismatched, next fetch will correct it.
                // Better to just let next fetch handle the rigorous sync, but we want instant load if they reload page immediately.
                // Let's cache it.
                await photoCache.putPhoto(cacheKey, {
                    blob: file,
                    timestamp: Date.now(),
                    modified: new Date().toISOString() // Optimistic
                });
            } catch (e) {
                console.warn('Failed to update persistent cache after upload:', e);
            }

            return webUrl;

        } catch (error) {
            console.error('❌ [Upload] Failed:', error);
            throw error;
        }
    }

    clearCache(): void {
        this.photoCache.clear();
    }
}
