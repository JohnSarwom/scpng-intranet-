import { Client } from '@microsoft/microsoft-graph-client';
import { MOCK_CASES } from '../modules/regulatory/constants';
import { RegulatoryCase } from '../modules/regulatory/types';

export class RegulatorySharePointSetupService {
    private client: Client;
    private siteId: string;
    private listDisplayName = 'Regulatory_Intelligence_Cases';

    constructor(client: Client, siteId: string) {
        this.client = client;
        this.siteId = siteId;
    }

    /**
     * Checks if the Regulatory Intelligence Cases list exists.
     */
    async checkExistingList(): Promise<boolean> {
        try {
            const response = await this.client
                .api(`/sites/${this.siteId}/lists`)
                .filter(`displayName eq '${this.listDisplayName}'`)
                .get();

            return response.value && response.value.length > 0;
        } catch (error) {
            console.error('Failed to check existing regulatory list:', error);
            return false;
        }
    }

    /**
     * Creates the Regulatory Intelligence Cases list with the appropriate schema.
     */
    async setupRegulatoryList(): Promise<{ success: boolean; message: string; listId?: string }> {
        console.log(`🚀 [Regulatory Setup] Setting up ${this.listDisplayName} list...`);

        try {
            const exists = await this.checkExistingList();
            if (exists) {
                return { success: false, message: `List ${this.listDisplayName} already exists.` };
            }

            const list = await this.client
                .api(`/sites/${this.siteId}/lists`)
                .post({
                    displayName: this.listDisplayName,
                    description: 'Storage for Regulatory Intelligence Cases (Scams, Enquiries, Whistleblower, Compliance, Investigations)',
                    columns: [
                        {
                            name: 'CaseId',
                            text: {}
                        },
                        {
                            name: 'CaseType',
                            choice: {
                                choices: ['scam', 'enquiry', 'whistleblower', 'compliance', 'investigation']
                            }
                        },
                        {
                            name: 'Category',
                            text: {}
                        },
                        {
                            name: 'RiskLevel',
                            choice: {
                                choices: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
                            }
                        },
                        {
                            name: 'Status',
                            choice: {
                                choices: ['RECEIVED', 'UNDER_REVIEW', 'INVESTIGATING', 'ESCALATED', 'CLOSED', 'RESOLVED']
                            }
                        },
                        {
                            name: 'Source',
                            text: {}
                        },
                        {
                            name: 'Anonymous',
                            boolean: {}
                        },
                        {
                            name: 'Description',
                            text: { allowMultipleLines: true }
                        },
                        {
                            name: 'AssignedUnit',
                            text: {}
                        },
                        {
                            name: 'AssignedOfficer',
                            text: {}
                        },
                        {
                            name: 'LastUpdate',
                            dateTime: {}
                        },
                        {
                            name: 'SecureToken',
                            text: {}
                        },
                        {
                            name: 'Summary',
                            text: { allowMultipleLines: true }
                        },
                        {
                            name: 'ReporterName',
                            text: {}
                        },
                        {
                            name: 'ReporterContact',
                            text: {}
                        }
                    ],
                    list: {
                        template: 'genericList'
                    }
                });

            console.log(`✅ [Regulatory Setup] ${this.listDisplayName} created successfully.`);
            return {
                success: true,
                message: `${this.listDisplayName} list created successfully.`,
                listId: list.id
            };

        } catch (error: any) {
            console.error(`❌ [Regulatory Setup] Failed to create list:`, error);
            return {
                success: false,
                message: `Failed to create list: ${error.message}`
            };
        }
    }

    /**
     * Seeds the Regulatory Intelligence Cases list with mock data.
     */
    async seedRegulatoryList(): Promise<{ success: boolean; message: string }> {
        console.log(`🌱 [Regulatory Setup] Seeding ${this.listDisplayName} with mock data...`);

        try {
            // Find the list ID
            const listsResponse = await this.client
                .api(`/sites/${this.siteId}/lists`)
                .filter(`displayName eq '${this.listDisplayName}'`)
                .select('id')
                .get();

            if (!listsResponse.value || listsResponse.value.length === 0) {
                return { success: false, message: `List ${this.listDisplayName} not found. Please create it first.` };
            }

            const listId = listsResponse.value[0].id;

            // Optional: check if list already has items to prevent duplicate seeding
            const existingItems = await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).top(1).get();
            if (existingItems.value && existingItems.value.length > 0) {
                console.log(`⚠️ [Regulatory Setup] List already has data. Skipping seed.`);
                return { success: true, message: 'List already contains data, skipping seed.' };
            }

            // Seed items
            for (const item of MOCK_CASES) {
                const spItem = {
                    Title: item.title || `Case ${item.caseId}`,
                    CaseId: item.caseId,
                    CaseType: item.type,
                    Category: item.category,
                    RiskLevel: item.risk,
                    Status: item.status,
                    Source: item.source || '',
                    Anonymous: item.anonymous || false,
                    Description: item.description || '',
                    AssignedUnit: item.assignedUnit,
                    AssignedOfficer: item.assignedOfficer || '',
                    LastUpdate: item.lastUpdate || new Date().toISOString(),
                    SecureToken: item.secureToken || '',
                    Summary: item.summary || '',
                    ReporterName: item.reporterName || '',
                    ReporterContact: item.reporterContact || ''
                };

                await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).post({ fields: spItem });
            }

            console.log(`✅ [Regulatory Setup] Seeded mock data successfully.`);
            return { success: true, message: "Mock data seeded successfully." };
        } catch (error: any) {
            console.error('❌ [Regulatory Setup] Seeding failed:', error);
            return { success: false, message: `Seeding failed: ${error.message}` };
        }
    }

    /**
     * Deploy the Regulatory Engine: Creates the list and seeds data in one operation.
     */
    async deployRegulatoryEngine(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            console.log('🚀 [Regulatory Setup] Deploying Regulatory Intelligence Engine...');

            // 1. Setup List
            const setupResult = await this.setupRegulatoryList();

            if (!setupResult.success && !setupResult.message.includes('already exists')) {
                throw new Error(setupResult.message);
            }

            // 2. Seed Data
            const seedResult = await this.seedRegulatoryList();

            if (!seedResult.success) {
                throw new Error(seedResult.message);
            }

            return {
                success: true,
                message: 'Regulatory Intelligence Engine deployed successfully!'
            };
        } catch (error: any) {
            console.error('❌ [Regulatory Setup] Engine deployment failed:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }
}
