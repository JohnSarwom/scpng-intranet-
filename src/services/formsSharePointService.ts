/**
 * Forms SharePoint Service
 * Handles data fetching and persistence for Form Groups and Registered Forms
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { Logger } from '@/utils/logger';

export interface FormRegistration {
    id: string;
    title: string;
    description: string;
    templateId: string;
    groupId: string;
    status: 'active' | 'draft' | 'archived';
    estimatedTime?: string;
}

export interface FormGroup {
    id: string;
    title: string;
    description: string;
    iconName: string;
    displayOrder: number;
    color?: string;
}

const FORMS_CONFIG = {
    SITE_DOMAIN: 'scpng1.sharepoint.com',
    SITE_PATH: '/sites/scpngintranet',
    LISTS: {
        GROUPS: 'Form_Groups',
        REGISTRATIONS: 'Form_Registrations'
    }
};

export class FormsSharePointService {
    private client: Client;
    private siteId: string = '';
    private listIds: Record<string, string> = {};

    constructor(client: Client) {
        this.client = client;
    }

    async initialize(): Promise<void> {
        if (this.siteId && Object.keys(this.listIds).length === 2) return;

        try {
            const site = await this.client
                .api(`/sites/${FORMS_CONFIG.SITE_DOMAIN}:${FORMS_CONFIG.SITE_PATH}`)
                .get();
            this.siteId = site.id;

            const lists = await this.client
                .api(`/sites/${this.siteId}/lists`)
                .select('id,displayName')
                .get();

            const groupsList = lists.value.find((l: any) => l.displayName === FORMS_CONFIG.LISTS.GROUPS);
            const registrationsList = lists.value.find((l: any) => l.displayName === FORMS_CONFIG.LISTS.REGISTRATIONS);

            if (groupsList) this.listIds['GROUPS'] = groupsList.id;
            if (registrationsList) this.listIds['REGISTRATIONS'] = registrationsList.id;

            Logger.info('✅ [Forms Service] Initialized', this.listIds);
        } catch (error) {
            Logger.error('❌ [Forms Service] Initialization failed', error);
            throw error;
        }
    }

    async getGroups(): Promise<FormGroup[]> {
        await this.initialize();
        if (!this.listIds['GROUPS']) return [];

        try {
            const response = await this.client
                .api(`/sites/${this.siteId}/lists/${this.listIds['GROUPS']}/items`)
                .expand('fields')
                .get();

            return response.value.map((item: any) => ({
                id: item.id,
                title: item.fields.Title,
                description: item.fields.Description,
                iconName: item.fields.IconName || 'FileText',
                displayOrder: item.fields.DisplayOrder || 0,
                color: item.fields.Color
            }));
        } catch (error) {
            Logger.error('❌ [Forms Service] getGroups failed', error);
            return [];
        }
    }

    async addGroup(group: Partial<FormGroup>): Promise<FormGroup> {
        await this.initialize();
        if (!this.listIds['GROUPS']) throw new Error('Form_Groups list not found');

        const payload = {
            fields: {
                Title: group.title,
                Description: group.description,
                IconName: group.iconName,
                DisplayOrder: group.displayOrder,
                Color: group.color
            }
        };

        const response = await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['GROUPS']}/items`)
            .post(payload);

        return {
            id: response.id,
            title: response.fields.Title,
            description: response.fields.Description,
            iconName: response.fields.IconName,
            displayOrder: response.fields.DisplayOrder,
            color: response.fields.Color
        };
    }

    async getRegistrations(): Promise<FormRegistration[]> {
        await this.initialize();
        if (!this.listIds['REGISTRATIONS']) return [];

        try {
            const response = await this.client
                .api(`/sites/${this.siteId}/lists/${this.listIds['REGISTRATIONS']}/items`)
                .expand('fields')
                .get();

            return response.value.map((item: any) => ({
                id: item.id,
                title: item.fields.Title,
                description: item.fields.Description,
                templateId: item.fields.TemplateID,
                groupId: item.fields.GroupID,
                status: item.fields.Status || 'active',
                estimatedTime: item.fields.EstimatedTime
            }));
        } catch (error) {
            Logger.error('❌ [Forms Service] getRegistrations failed', error);
            return [];
        }
    }

    async addRegistration(form: Partial<FormRegistration>): Promise<FormRegistration> {
        await this.initialize();
        if (!this.listIds['REGISTRATIONS']) throw new Error('Form_Registrations list not found');

        const payload = {
            fields: {
                Title: form.title,
                Description: form.description,
                TemplateID: form.templateId,
                GroupID: form.groupId,
                Status: form.status,
                EstimatedTime: form.estimatedTime
            }
        };

        const response = await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['REGISTRATIONS']}/items`)
            .post(payload);

        return {
            id: response.id,
            title: response.fields.Title,
            description: response.fields.Description,
            templateId: response.fields.TemplateID,
            groupId: response.fields.GroupID,
            status: response.fields.Status,
            estimatedTime: response.fields.EstimatedTime
        };
    }
}
