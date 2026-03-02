import { Client } from '@microsoft/microsoft-graph-client';

const SITE_PATH = '/sites/scpngintranet';
const SITE_DOMAIN = 'scpng1.sharepoint.com';
const LIST_NAME = 'Document_Categories';
const DOCS_LIST_NAME = 'Organizational_Documents';

export interface DocumentCategory {
    id: string;
    title: string;
    description?: string;
    sortOrder: number;
    iconName?: string;
    isActive: boolean;
    subCategories: string[];
}

const getSiteId = async (client: Client): Promise<string> => {
    const site = await client.api(`/sites/${SITE_DOMAIN}:${SITE_PATH}`).get();
    return site.id;
};

export const fetchDocumentCategories = async (client: Client): Promise<DocumentCategory[]> => {
    try {
        const siteId = await getSiteId(client);
        const response = await client.api(`/sites/${siteId}/lists/${LIST_NAME}/items`)
            .expand('fields')
            .get();

        return response.value
            .map((item: any) => ({
                id: item.id,
                title: item.fields.Title || '',
                description: item.fields.Description || '',
                sortOrder: item.fields.SortOrder || 0,
                iconName: item.fields.IconName || '',
                isActive: item.fields.IsActive !== false,
                subCategories: parseSubCategories(item.fields.SubCategories),
            }))
            .filter((cat: DocumentCategory) => cat.isActive)
            .sort((a: DocumentCategory, b: DocumentCategory) => a.sortOrder - b.sortOrder);
    } catch (error) {
        console.error('Error fetching document categories:', error);
        throw error;
    }
};

/**
 * Add a new choice value to the Category column on the Organizational_Documents list.
 * This ensures documents can be uploaded with the new category name.
 */
const addCategoryChoiceToDocsList = async (client: Client, siteId: string, newCategoryName: string): Promise<void> => {
    try {
        // Get the Organizational_Documents list columns
        const columnsResp = await client.api(`/sites/${siteId}/lists/${DOCS_LIST_NAME}/columns`)
            .filter("displayName eq 'Category'")
            .get();

        if (!columnsResp.value || columnsResp.value.length === 0) {
            console.warn('Category column not found on Organizational_Documents list');
            return;
        }

        const categoryColumn = columnsResp.value[0];
        const existingChoices: string[] = categoryColumn.choice?.choices || [];

        // Only add if not already present
        if (existingChoices.includes(newCategoryName)) return;

        const updatedChoices = [...existingChoices, newCategoryName];

        await client.api(`/sites/${siteId}/lists/${DOCS_LIST_NAME}/columns/${categoryColumn.id}`)
            .patch({
                choice: { choices: updatedChoices }
            });

        console.log(`Added "${newCategoryName}" to Category choices on ${DOCS_LIST_NAME}`);
    } catch (error) {
        console.warn('Could not update Category choices on Organizational_Documents:', error);
        // Non-fatal: category is created, but uploads may need manual column update
    }
};

export const createDocumentCategory = async (
    client: Client,
    data: { title: string; description?: string; sortOrder?: number; subCategories?: string[] }
): Promise<DocumentCategory> => {
    try {
        const siteId = await getSiteId(client);

        const fields: any = {
            Title: data.title,
            Description: data.description || '',
            SortOrder: data.sortOrder || 99,
            IsActive: true,
            SubCategories: data.subCategories ? JSON.stringify(data.subCategories) : '[]',
        };

        const response = await client.api(`/sites/${siteId}/lists/${LIST_NAME}/items`).post({ fields });

        // Sync the new category name into the Organizational_Documents choice column
        await addCategoryChoiceToDocsList(client, siteId, data.title);

        return {
            id: response.id,
            title: data.title,
            description: data.description || '',
            sortOrder: data.sortOrder || 99,
            isActive: true,
            subCategories: data.subCategories || [],
        };
    } catch (error) {
        console.error('Error creating document category:', error);
        throw error;
    }
};

export const updateDocumentCategory = async (
    client: Client,
    id: string,
    data: Partial<{ title: string; description: string; sortOrder: number; isActive: boolean; subCategories: string[] }>
): Promise<void> => {
    try {
        const siteId = await getSiteId(client);

        const fields: any = {};
        if (data.title !== undefined) fields.Title = data.title;
        if (data.description !== undefined) fields.Description = data.description;
        if (data.sortOrder !== undefined) fields.SortOrder = data.sortOrder;
        if (data.isActive !== undefined) fields.IsActive = data.isActive;
        if (data.subCategories !== undefined) fields.SubCategories = JSON.stringify(data.subCategories);

        await client.api(`/sites/${siteId}/lists/${LIST_NAME}/items/${id}/fields`).patch(fields);
    } catch (error) {
        console.error('Error updating document category:', error);
        throw error;
    }
};

export const deleteDocumentCategory = async (client: Client, id: string): Promise<void> => {
    try {
        const siteId = await getSiteId(client);
        // Soft delete by setting IsActive to false
        await client.api(`/sites/${siteId}/lists/${LIST_NAME}/items/${id}/fields`).patch({ IsActive: false });
    } catch (error) {
        console.error('Error deleting document category:', error);
        throw error;
    }
};

function parseSubCategories(value: string | undefined): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}
