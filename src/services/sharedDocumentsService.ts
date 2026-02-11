import { Client } from '@microsoft/microsoft-graph-client';

const SITE_PATH = '/sites/scpngintranet';
const SITE_DOMAIN = 'scpng1.sharepoint.com';
const LIST_NAME = 'Organizational_Documents';

export interface SharedDocument {
    id: string; // List Item ID
    name: string;
    webUrl: string;
    externalUrl?: string; // For links
    createdDateTime: string;
    size: number;
    category?: string;
    subCategory?: string;
    description?: string;
    tags?: string;
    createdBy: {
        user: {
            displayName: string;
            email: string;
        }
    };
    fileType?: string;
}

export const getSiteId = async (client: Client): Promise<string> => {
    const site = await client.api(`/sites/${SITE_DOMAIN}:${SITE_PATH}`).get();
    return site.id;
};

export const fetchSharedDocuments = async (client: Client): Promise<SharedDocument[]> => {
    try {
        const siteId = await getSiteId(client);
        // Expand fields to get custom columns
        // We fetch ALL items and filter in code if needed, or refine Graph query.
        const response = await client.api(`/sites/${siteId}/lists/${LIST_NAME}/items`)
            .expand('driveItem,fields')
            .get();

        return response.value.map((item: any) => ({
            id: item.id,
            name: item.fields.Title || item.driveItem?.name || "Untitled",
            webUrl: item.fields.ExternalUrl || item.driveItem?.webUrl || item.webUrl,
            externalUrl: item.fields.ExternalUrl,
            createdDateTime: item.createdDateTime,
            size: item.driveItem?.size || 0,
            category: item.fields.Category,
            subCategory: item.fields.SubCategory,
            description: item.fields.DocDescription,
            tags: item.fields.Tags,
            createdBy: item.createdBy,
            fileType: item.fields.ExternalUrl ? 'link' : (item.driveItem?.name?.split('.').pop() || 'file')
        }));
    } catch (error) {
        console.error('Error fetching shared documents:', error);
        throw error;
    }
};

export const uploadSharedDocument = async (
    client: Client,
    file: File,
    metadata: { category: string; subCategory?: string; description?: string; tags?: string }
): Promise<void> => {
    try {
        const siteId = await getSiteId(client);

        // 1. Get Drive ID for the list
        const drive = await client.api(`/sites/${siteId}/lists/${LIST_NAME}/drive`).get();
        const driveId = drive.id;

        // 2. Upload File (Stream)
        // We use PUT for small files. For large files we'd need an upload session, but standard doc requirement usually implies typical office docs.
        const uploadUrl = `/sites/${siteId}/drives/${driveId}/root:/${file.name}:/content`;
        const uploadResponse = await client.api(uploadUrl).put(file);
        const driveItemId = uploadResponse.id;

        // 3. Get List Item associated with Drive Item
        const listItemResponse = await client.api(`/sites/${siteId}/drives/${driveId}/items/${driveItemId}/listItem`).get();
        const listItemId = listItemResponse.id;

        // 4. Update Metadata fields
        const fieldsToUpdate: any = {
            Category: metadata.category,
            DocDescription: metadata.description,
            Tags: metadata.tags
        };
        if (metadata.subCategory) fieldsToUpdate.SubCategory = metadata.subCategory;

        await client.api(`/sites/${siteId}/lists/${LIST_NAME}/items/${listItemId}/fields`).patch(fieldsToUpdate);
    } catch (error) {
        console.error('Error uploading shared document:', error);
        throw error;
    }
};

export const addExternalLink = async (
    client: Client,
    linkData: { title: string; url: string; category: string; subCategory?: string; description?: string; tags?: string }
): Promise<void> => {
    try {
        const siteId = await getSiteId(client);

        // For external links, we create a list item directly.
        // If the library is a Document Library, we usually want to create a "Link" item 
        // or just a list item if it's a regular list. 
        // Organizational_Documents is likely a Doc Lib based on previous context.
        // SharePoint Doc Libs can store "Link to Document" items which are .url files,
        // but often it's easier to just store the metadata if the UI handles it.

        // Let's create a list item with the URL metadata.
        const fields: any = {
            title: linkData.title,
            Category: linkData.category,
            DocDescription: linkData.description,
            Tags: linkData.tags,
            ExternalUrl: linkData.url, // Explicitly set the external URL field
        };

        if (linkData.subCategory) fields.SubCategory = linkData.subCategory;

        // Note: In a Document Library, you can't just 'post' a new item easily without a file 
        // unless you use the 'Link' content type or just treat it as metadata.
        // If it's a Documents library, we might need to create a dummy .url file content.

        // For now, let's assume we can add it to the list.
        await client.api(`/sites/${siteId}/lists/${LIST_NAME}/items`).post({ fields });
    } catch (error) {
        console.error('Error adding external link:', error);
        throw error;
    }
};

export const deleteSharedDocument = async (client: Client, id: string): Promise<void> => {
    try {
        const siteId = await getSiteId(client);
        // Delete List Item (which deletes the file in a doc lib)
        await client.api(`/sites/${siteId}/lists/${LIST_NAME}/items/${id}`).delete();
    } catch (error) {
        console.error('Error deleting shared document:', error);
        throw error;
    }
};
