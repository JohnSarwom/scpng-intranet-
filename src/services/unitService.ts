import { Client } from '@microsoft/microsoft-graph-client';
import { MockUnitData } from '@/components/strategy/UnitModal';

export class UnitService {
    private client: Client;
    private siteId: string | null = null;
    private listId: string | null = null;

    constructor(client: Client) {
        this.client = client;
    }

    private async initialize(): Promise<void> {
        if (this.siteId && this.listId) return;

        try {
            const site = await this.client
                .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
                .select('id')
                .get();
            this.siteId = site.id;

            const listCheck = await this.client
                .api(`/sites/${this.siteId}/lists`)
                .filter("displayName eq 'Strategy_Units'")
                .select('id')
                .get();

            if (!listCheck.value || listCheck.value.length === 0) {
                throw new Error("Strategy_Units list not found in SharePoint.");
            }

            this.listId = listCheck.value[0].id;
        } catch (error) {
            console.error("Failed to initialize UnitService:", error);
            throw error;
        }
    }

    private mapToSharePointItem(unit: Partial<MockUnitData>): any {
        return {
            Title: unit.unitName,
            ParentDivision: unit.parentDivision,
            ContactEmail: unit.primaryContact?.email || null,
            Location: unit.location || null,
            ManagerName: unit.manager?.name || null,
            ManagerQuote: unit.manager?.quote || null,
            MissionStatement: unit.missionStatement || null,
            CoreFunctions: unit.coreFunctions ? JSON.stringify(unit.coreFunctions) : '[]',
            Achievements: unit.achievements ? JSON.stringify(unit.achievements) : '[]',
            StatutoryDuties: unit.statutoryDuties || '',
            SortOrder: unit.totalStaff || 0
        };
    }

    private parseStatutoryDuties(raw: string | undefined): string {
        if (!raw) return '';
        if (raw.startsWith('[') || raw.startsWith('"')) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed.join('\n\n');
                if (typeof parsed === 'string') return parsed;
            } catch { /* not valid JSON, use as-is */ }
        }
        return raw;
    }

    private mapFromSharePointItem(item: any): MockUnitData {
        const parseJsonFallback = (jsonString: string, fallback: any) => {
            if (!jsonString) return fallback;
            try { return JSON.parse(jsonString); } catch (e) { return fallback; }
        };

        return {
            id: item.id,
            unitName: item.fields.Title || '',
            parentDivision: item.fields.ParentDivision || '',
            primaryContact: { label: 'Primary Contact', email: item.fields.ContactEmail || '' },
            location: item.fields.Location || '',
            totalStaff: item.fields.SortOrder || 0,
            manager: {
                name: item.fields.ManagerName || '',
                quote: item.fields.ManagerQuote || ''
            },
            missionStatement: item.fields.MissionStatement || '',
            coreFunctions: parseJsonFallback(item.fields.CoreFunctions, []),
            achievements: parseJsonFallback(item.fields.Achievements, []),
            statutoryDuties: this.parseStatutoryDuties(item.fields.StatutoryDuties)
        };
    }

    async getUnits(): Promise<MockUnitData[]> {
        await this.initialize();
        const response = await this.client
            .api(`/sites/${this.siteId}/lists/${this.listId}/items`)
            .expand('fields')
            .get();

        return (response.value || []).map((item: any) => this.mapFromSharePointItem(item));
    }

    async addUnit(unit: Partial<MockUnitData>): Promise<MockUnitData> {
        await this.initialize();
        const payload = { fields: this.mapToSharePointItem(unit) };

        const response = await this.client
            .api(`/sites/${this.siteId}/lists/${this.listId}/items`)
            .post(payload);

        return this.mapFromSharePointItem(response);
    }

    async updateUnit(id: string, updates: Partial<MockUnitData>): Promise<void> {
        await this.initialize();
        const payload = { ...this.mapToSharePointItem(updates) };

        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) delete payload[key];
        });

        await this.client
            .api(`/sites/${this.siteId}/lists/${this.listId}/items/${id}/fields`)
            .patch(payload);
    }

    async deleteUnit(id: string): Promise<void> {
        await this.initialize();
        await this.client
            .api(`/sites/${this.siteId}/lists/${this.listId}/items/${id}`)
            .delete();
    }
}
