import { Client } from '@microsoft/microsoft-graph-client';
import { MockDivisionData } from '@/components/strategy/DivisionModal';

const SITE_DOMAIN = 'scpng1.sharepoint.com';
const SITE_PATH = '/sites/scpngintranet';
const ASSET_LIBRARY_NAME = 'Asset Images';
const DIVISION_IMAGES_FOLDER = 'DivisionImages';

export class DivisionService {
    private client: Client;
    private siteId: string | null = null;
    private listId: string | null = null;
    private static assetsDriveId: string | null = null;

    constructor(client: Client) {
        this.client = client;
    }

    private async initialize(): Promise<void> {
        if (this.siteId && this.listId) return;

        try {
            const site = await this.client
                .api(`/sites/${SITE_DOMAIN}:${SITE_PATH}`)
                .select('id')
                .get();
            this.siteId = site.id;

            const lists = await this.client
                .api(`/sites/${this.siteId}/lists`)
                .select('id,displayName,name')
                .get();

            const divisionList = lists.value.find((list: any) =>
                list.displayName === 'Strategy_Divisions' || list.name === 'Strategy_Divisions'
            );
            if (!divisionList) {
                throw new Error("Strategy_Divisions list not found in SharePoint.");
            }
            this.listId = divisionList.id;

            // Find Asset Images library for division images
            if (!DivisionService.assetsDriveId) {
                const assetLibrary = lists.value.find((list: any) =>
                    list.displayName === ASSET_LIBRARY_NAME || list.name === ASSET_LIBRARY_NAME
                );
                if (assetLibrary) {
                    const drive = await this.client
                        .api(`/sites/${this.siteId}/lists/${assetLibrary.id}/drive`)
                        .get();
                    DivisionService.assetsDriveId = drive.id;
                }
            }
        } catch (error) {
            console.error("Failed to initialize DivisionService:", error);
            throw error;
        }
    }

    private mapToSharePointItem(division: Partial<MockDivisionData>): any {
        return {
            Title: division.divisionName,
            Branch: division.branch,
            ContactEmail: division.primaryContact?.email || null,
            Location: division.location || null,
            DirectorName: division.director?.name || null,
            DirectorQuote: division.director?.quote || null,
            MissionStatement: division.missionStatement || null,
            StatutoryDuties: division.statutoryDuties || '',
            Achievements: division.achievements ? JSON.stringify(division.achievements) : '[]',
            SubDepartments: division.subDepartments ? JSON.stringify(division.subDepartments) : '[]',
            DivisionImage: division.divisionImage || null,
            SortOrder: division.totalStaff || 0
        };
    }

    private parseStatutoryDuties(raw: string | undefined): string {
        if (!raw) return '';
        // Handle legacy data stored via JSON.stringify (array or quoted string)
        if (raw.startsWith('[') || raw.startsWith('"')) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed.join('\n\n');
                if (typeof parsed === 'string') return parsed;
            } catch { /* not valid JSON, use as-is */ }
        }
        return raw;
    }

    private mapFromSharePointItem(item: any): MockDivisionData {
        const parseJsonFallback = (jsonString: string, fallback: any) => {
            if (!jsonString) return fallback;
            try { return JSON.parse(jsonString); } catch (e) { return fallback; }
        };

        return {
            id: item.id,
            divisionName: item.fields.Title || '',
            branch: item.fields.Branch || '',
            primaryContact: { label: 'Primary Contact', email: item.fields.ContactEmail || '' },
            location: item.fields.Location || '',
            totalStaff: item.fields.SortOrder || 0,
            director: {
                name: item.fields.DirectorName || '',
                quote: item.fields.DirectorQuote || ''
            },
            missionStatement: item.fields.MissionStatement || '',
            achievements: parseJsonFallback(item.fields.Achievements, []),
            statutoryDuties: this.parseStatutoryDuties(item.fields.StatutoryDuties),
            subDepartments: parseJsonFallback(item.fields.SubDepartments, []),
            divisionImage: item.fields.DivisionImage || undefined
        };
    }

    async getDivisions(): Promise<MockDivisionData[]> {
        await this.initialize();
        const response = await this.client
            .api(`/sites/${this.siteId}/lists/${this.listId}/items`)
            .expand('fields')
            .get();

        return (response.value || []).map((item: any) => this.mapFromSharePointItem(item));
    }

    async addDivision(division: Partial<MockDivisionData>): Promise<MockDivisionData> {
        await this.initialize();
        const payload = { fields: this.mapToSharePointItem(division) };

        const response = await this.client
            .api(`/sites/${this.siteId}/lists/${this.listId}/items`)
            .post(payload);

        return this.mapFromSharePointItem(response);
    }

    async updateDivision(id: string, updates: Partial<MockDivisionData>): Promise<void> {
        await this.initialize();
        const payload = { ...this.mapToSharePointItem(updates) };

        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) delete payload[key];
        });

        await this.client
            .api(`/sites/${this.siteId}/lists/${this.listId}/items/${id}/fields`)
            .patch(payload);
    }

    async deleteDivision(id: string): Promise<void> {
        await this.initialize();
        await this.client
            .api(`/sites/${this.siteId}/lists/${this.listId}/items/${id}`)
            .delete();
    }

    /**
     * Fetch a division image blob URL from Asset Images/DivisionImages/
     */
    async getDivisionImageUrl(filename: string): Promise<string | null> {
        if (!filename) return null;
        await this.initialize();
        if (!DivisionService.assetsDriveId) return null;

        try {
            // Try thumbnail first for faster load
            const blob = await this.client
                .api(`/sites/${this.siteId}/drives/${DivisionService.assetsDriveId}/root:/${DIVISION_IMAGES_FOLDER}/${filename}:/thumbnails/0/large/content`)
                .responseType('blob' as any)
                .get();
            return URL.createObjectURL(blob);
        } catch {
            try {
                // Fallback to full content
                const blob = await this.client
                    .api(`/sites/${this.siteId}/drives/${DivisionService.assetsDriveId}/root:/${DIVISION_IMAGES_FOLDER}/${filename}:/content`)
                    .responseType('blob' as any)
                    .get();
                return URL.createObjectURL(blob);
            } catch (e) {
                console.warn(`Failed to fetch division image ${filename}:`, e);
                return null;
            }
        }
    }

    /**
     * Upload a division image to Asset Images/DivisionImages/ and update the list item
     */
    async uploadDivisionImage(divisionId: string, file: File, divisionName: string): Promise<string> {
        await this.initialize();
        if (!DivisionService.assetsDriveId) throw new Error('Asset Images drive not found');

        const timestamp = Date.now();
        const extension = file.name.split('.').pop() || 'jpg';
        const safeName = divisionName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const fileName = `${safeName}_${timestamp}.${extension}`;
        const filePath = `${DIVISION_IMAGES_FOLDER}/${fileName}`;

        // Cleanup old images for this division
        try {
            const existingFiles = await this.client
                .api(`/sites/${this.siteId}/drives/${DivisionService.assetsDriveId}/root:/${DIVISION_IMAGES_FOLDER}:/children`)
                .select('id,name')
                .get();

            if (existingFiles?.value) {
                const oldFiles = existingFiles.value.filter((f: any) => f.name.startsWith(`${safeName}_`));
                await Promise.all(oldFiles.map((f: any) =>
                    this.client
                        .api(`/sites/${this.siteId}/drives/${DivisionService.assetsDriveId}/items/${f.id}`)
                        .delete()
                ));
            }
        } catch (e) {
            console.warn('Cleanup of old division images failed (non-critical):', e);
        }

        // Upload new file
        await this.client
            .api(`/sites/${this.siteId}/drives/${DivisionService.assetsDriveId}/root:/${filePath}:/content`)
            .put(file);

        // Update the DivisionImage field on the list item
        await this.client
            .api(`/sites/${this.siteId}/lists/${this.listId}/items/${divisionId}/fields`)
            .patch({ DivisionImage: fileName });

        return fileName;
    }
}
