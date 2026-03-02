import { Client } from '@microsoft/microsoft-graph-client';
import { OfficerProfile } from '@/components/strategy/OfficerProfileModal';

export class OfficerProfileService {
    private client: Client;
    private siteId: string | null = null;
    private listId: string | null = null;

    constructor(client: Client) {
        this.client = client;
    }

    private async initialize(): Promise<void> {
        if (this.siteId && this.listId) return;

        try {
            // Get site ID
            const site = await this.client
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .select('id')
                .get();
            this.siteId = site.id;

            // Get list ID
            const listCheck = await this.client
                .api(`/sites/${this.siteId}/lists`)
                .filter("displayName eq 'Strategy_Officer_Profiles'")
                .select('id')
                .get();

            if (!listCheck.value || listCheck.value.length === 0) {
                throw new Error("Strategy_Officer_Profiles list not found in SharePoint.");
            }

            this.listId = listCheck.value[0].id;
        } catch (error) {
            console.error("Failed to initialize OfficerProfileService:", error);
            throw error;
        }
    }

    private mapToSharePointItem(profile: Partial<OfficerProfile>): any {
        return {
            Title: profile.name,
            JobTitle: profile.jobTitle,
            Email: profile.email,
            Phone: profile.phone || null,
            EmployeeId: profile.employeeId,
            JoinedDate: profile.joinedDate,
            Division: profile.division,
            Unit: profile.unit,
            ProfileSummary: profile.summary,
            Skills: profile.skills ? JSON.stringify(profile.skills) : '[]',
            ReportsToName: profile.reportsTo?.name || null,
            ReportsToTitle: profile.reportsTo?.title || null,
            DirectReports: profile.directReports || 0,
            OfficeExtension: profile.officeExtension || null,
            Timezone: profile.timezone || 'PGT (GMT+10)',
            StatutoryDuty: profile.statutoryDuty || null,
            ProfileImageUrl: profile.profileImageUrl || null,
        };
    }

    async addProfile(profile: Partial<OfficerProfile>): Promise<OfficerProfile> {
        await this.initialize();
        const payload = {
            fields: this.mapToSharePointItem(profile)
        };

        const response = await this.client
            .api(`/sites/${this.siteId}/lists/${this.listId}/items`)
            .post(payload);

        return { ...profile, id: response.id } as OfficerProfile;
    }

    async updateProfile(id: string, updates: Partial<OfficerProfile>): Promise<void> {
        await this.initialize();
        const payload = {
            ...this.mapToSharePointItem(updates)
        };

        // Remove any undefined values to avoid overwriting with null unintentionally, except explicit nulls
        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) {
                delete payload[key];
            }
        });

        await this.client
            .api(`/sites/${this.siteId}/lists/${this.listId}/items/${id}/fields`)
            .patch(payload);
    }

    async deleteProfile(id: string): Promise<void> {
        await this.initialize();
        await this.client
            .api(`/sites/${this.siteId}/lists/${this.listId}/items/${id}`)
            .delete();
    }
}
