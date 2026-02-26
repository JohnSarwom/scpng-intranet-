/**
 * SharePoint List Setup Service
 * Programmatically creates Strategy System lists with proper columns and relationships
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { mockStrategyData } from '../mockData/strategyData';
import { Kra, Kpi, Task } from '@/types';
import { mapKraToSharePoint, mapKpiToSharePoint, mapTaskToSharePoint } from '@/utils/mockDataMapper';

import { mockProjects } from '@/mockData/projects';
import { initialEmployeeData } from '@/data/employeeData';
import { generateAllOfficerData, SCPNG_STAFF_DATA } from '@/data/mockPerformanceDataGenerator';

export class SharePointListSetupService {
    private client: Client;
    private siteId: string;

    constructor(client: Client, siteId: string) {
        this.client = client;
        this.siteId = siteId;
    }

    /**
     * Create all Strategy System lists
     */
    async createAllLists(): Promise<{ success: boolean; message: string; details: any }> {
        console.log('🚀 [Setup] Starting SharePoint list creation...');

        try {
            const results = {
                config: null as any,
                pillars: null as any,
                objectives: null as any
            };

            // Step 1: Create Strategy_Config list
            console.log('📝 [Setup] Creating Strategy_Config list...');
            results.config = await this.createStrategyConfigList();
            console.log('✅ [Setup] Strategy_Config created');

            // Step 2: Create Strategic_Pillars list
            console.log('📝 [Setup] Creating Strategic_Pillars list...');
            results.pillars = await this.createStrategicPillarsList();
            console.log('✅ [Setup] Strategic_Pillars created');

            // Step 3: Create Strategic_Objectives list (with lookups)
            console.log('📝 [Setup] Creating Strategic_Objectives list...');
            results.objectives = await this.createStrategicObjectivesList(results.pillars.id);
            console.log('✅ [Setup] Strategic_Objectives created');

            // Step 4: Add sample data
            await this.addSampleData(results);
            console.log('✅ [Setup] Sample data added');

            // Step 5: Create Operations Lists (KRAs, KPIs, Projects, Tasks, Risks)
            console.log('📝 [Setup] Creating Operations Lists...');
            const opsResults = await this.createOperationsLists();
            if (!opsResults.success) {
                console.warn('⚠️ [Setup] Operations lists creation had issues:', opsResults.message);
                // We don't fail the whole process but warn
            } else {
                console.log('✅ [Setup] Operations lists created');
            }

            return {
                success: true,
                message: 'All Strategy lists created successfully!',
                details: results
            };

        } catch (error: any) {
            console.error('❌ [Setup] Failed to create lists:', error);
            return {
                success: false,
                message: `Failed to create lists: ${error.message}`,
                details: error
            };
        }
    }

    /**
     * Create Strategy_Config list (Mission, Vision, Values)
     */
    private async createStrategyConfigList() {
        const list = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName: 'Strategy_Config',
                columns: [
                    {
                        name: 'Value',
                        text: { allowMultipleLines: true, maxLength: 5000 }
                    }
                ],
                list: {
                    template: 'genericList'
                }
            });

        return list;
    }

    /**
     * Create Strategic_Pillars list
     */
    private async createStrategicPillarsList() {
        const list = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName: 'Strategic_Pillars',
                columns: [
                    {
                        name: 'Description',
                        text: { allowMultipleLines: true }
                    },
                    {
                        name: 'IconName',
                        text: {}
                    },
                    {
                        name: 'SortOrder',
                        number: { decimalPlaces: 'none' }
                    },
                    {
                        name: 'Progress',
                        number: { decimalPlaces: 'none', minimum: 0, maximum: 100 }
                    },
                    {
                        name: 'Status',
                        choice: {
                            choices: ['On Track', 'At Risk', 'Behind', 'Completed']
                        }
                    }
                ],
                list: {
                    template: 'genericList'
                }
            });

        return list;
    }

    /**
     * Create Strategic_Goals list with lookups
     */
    private async createStrategicObjectivesList(pillarsListId: string) {
        // First create the list
        const list = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName: 'Strategic_Objectives',
                columns: [
                    {
                        name: 'Description',
                        text: { allowMultipleLines: true }
                    },
                    {
                        name: 'GoalType',
                        choice: {
                            choices: ['Org', 'Division']
                        }
                    },
                    {
                        name: 'Division',
                        choice: {
                            choices: [
                                'Executive Division',
                                'HR Division',
                                'Finance Division',
                                'IT Division',
                                'Operations Division',
                                'Investigations Unit'
                            ]
                        }
                    },
                    {
                        name: 'Unit',
                        text: {}
                    },
                    {
                        name: 'Status',
                        choice: {
                            choices: ['On Track', 'At Risk', 'Behind', 'Completed']
                        }
                    },
                    {
                        name: 'Progress',
                        number: { decimalPlaces: 'none', minimum: 0, maximum: 100 }
                    },
                    {
                        name: 'Year',
                        text: {}
                    },
                    {
                        name: 'StartDate',
                        dateTime: { format: 'dateOnly' }
                    },
                    {
                        name: 'EndDate',
                        dateTime: { format: 'dateOnly' }
                    },
                    {
                        name: 'Owner',
                        personOrGroup: {}
                    },
                    {
                        name: 'Icon',
                        text: {}
                    },
                    {
                        name: 'IsFeatured',
                        boolean: {}
                    },
                    {
                        name: 'Deliverables',
                        text: { allowMultipleLines: true }
                    },
                    {
                        name: 'LinkedDeliverable',
                        text: {}
                    }
                ],
                list: {
                    template: 'genericList'
                }
            });

        // Add lookup columns (need to be added after list creation)
        await this.addLookupColumn(list.id, 'ParentPillarId', pillarsListId, 'Title');
        await this.addLookupColumn(list.id, 'ParentGoalId', list.id, 'Title'); // Self-referencing

        return list;
    }

    /**
     * Helper to create a generic list with common properties
     */
    private async createList(displayName: string, description: string, columns: any[], template: string = 'genericList') {
        const check = await this.client.api(`/sites/${this.siteId}/lists`).filter(`displayName eq '${displayName}'`).get();
        if (check.value && check.value.length > 0) return check.value[0];

        const list = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName: displayName,
                description: description,
                columns: columns,
                list: { template: template }
            });
        return list;
    }

    private async createUnitObjectivesList(strategicObjectivesListId: string) {
        const list = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName: 'Unit_Objectives',
                description: 'Unit specific operational objectives',
                columns: [
                    {
                        name: 'Description',
                        text: { allowMultipleLines: true }
                    },
                    {
                        name: 'GoalType',
                        choice: {
                            choices: ['Org', 'Division', 'Unit', 'Individual']
                        }
                    },
                    {
                        name: 'Division',
                        text: {}
                    },
                    {
                        name: 'Unit',
                        text: {}
                    },
                    {
                        name: 'Progress',
                        number: { minimum: 0, maximum: 100 }
                    },
                    {
                        name: 'Status',
                        choice: {
                            choices: ['On Track', 'At Risk', 'Behind', 'Completed', 'Needs Attention', 'Not Started', 'In Progress', 'Deferred', 'Cancelled']
                        }
                    },
                    {
                        name: 'Icon',
                        text: {}
                    },
                    {
                        name: 'Owner',
                        text: {}
                    },
                    {
                        name: 'Year',
                        text: {}
                    },
                    {
                        name: 'StartDate',
                        dateTime: { format: 'dateOnly' }
                    },
                    {
                        name: 'EndDate',
                        dateTime: { format: 'dateOnly' }
                    },
                    {
                        name: 'Deliverables',
                        text: { allowMultipleLines: true }
                    },
                    {
                        name: 'LinkedDeliverable',
                        text: {}
                    }
                ],
                list: { template: 'genericList' }
            });

        // Add lookup to Strategic Objectives (Parent Goal)
        if (strategicObjectivesListId) {
            await this.addLookupColumn(list.id, 'ParentGoalId', strategicObjectivesListId, 'Title');
        }

        return list;
    }

    /**
     * Add a lookup column to a list
     */
    private async addLookupColumn(
        listId: string,
        columnName: string,
        lookupListId: string,
        lookupField: string
    ) {
        try {
            await this.client
                .api(`/sites/${this.siteId}/lists/${listId}/columns`)
                .post({
                    name: columnName,
                    lookup: {
                        listId: lookupListId,
                        columnName: lookupField
                    }
                });
            console.log(`   ✓ Added lookup column: ${columnName}`);
        } catch (error) {
            console.warn(`   ⚠️ Failed to add lookup column ${columnName}:`, error);
        }
    }

    /**
     * Add sample data to the lists
     */
    private async addSampleData(lists: any) {
        try {
            // Add Mission, Vision, Values
            await this.addConfigData(lists.config.id);

            // Add Strategic Pillars
            const pillarIds = await this.addPillarsData(lists.pillars.id);

            // Add Org Goals and Division Goals
            const objectivesList = await this.createStrategicObjectivesList(lists.pillars.id);
            lists.objectives = objectivesList;

            // Add sample data to objectives
            await this.addObjectivesSampleData(objectivesList.id, pillarIds);

        } catch (error) {
            console.warn('⚠️ [Setup] Failed to add sample data:', error);
        }
    }

    private async addConfigData(listId: string) {
        const items = [
            {
                fields: {
                    Title: 'Mission',
                    Value: 'To provide efficient and transparent public service that serves the people of Papua New Guinea'
                }
            },
            {
                fields: {
                    Title: 'Vision',
                    Value: 'A leading public service organization delivering excellence in governance and accountability'
                }
            },
            {
                fields: {
                    Title: 'Values',
                    Value: JSON.stringify([
                        { name: "Protect", description: "Safeguarding investors from scams and market manipulation.", icon: "Shield" },
                        { name: "Develop", description: "Encouraging new capital formation and innovative market products.", icon: "TrendingUp" },
                        { name: "Regulate", description: "Ensuring all market participants follow the rule of law.", icon: "Award" },
                        { name: "Mitigate", description: "Reducing systemic risks within the PNG financial landscape.", icon: "Zap" }
                    ])
                }
            }
        ];

        for (const item of items) {
            await this.client
                .api(`/sites/${this.siteId}/lists/${listId}/items`)
                .post(item);
        }
    }

    private async addPillarsData(listId: string) {
        const pillars = [
            {
                fields: {
                    Title: 'Operational Excellence',
                    Description: 'Streamline processes and improve efficiency across all operations',
                    IconName: 'target',
                    SortOrder: 1,
                    Progress: 65,
                    Status: 'On Track'
                }
            },
            {
                fields: {
                    Title: 'Digital Transformation',
                    Description: 'Modernize systems and embrace technology for better service delivery',
                    IconName: 'laptop',
                    SortOrder: 2,
                    Progress: 45,
                    Status: 'At Risk'
                }
            },
            {
                fields: {
                    Title: 'People Development',
                    Description: 'Build capacity and develop talent to achieve organizational goals',
                    IconName: 'users',
                    SortOrder: 3,
                    Progress: 80,
                    Status: 'On Track'
                }
            }
        ];

        const createdIds: string[] = [];
        for (const pillar of pillars) {
            const created = await this.client
                .api(`/sites/${this.siteId}/lists/${listId}/items`)
                .post(pillar);
            createdIds.push(created.id);
        }

        return createdIds;
    }

    private async addObjectivesSampleData(listId: string, pillarIds: string[]) {
        // Add Org Goals (these have ParentPillarId but no ParentGoalId)
        const orgGoal1 = await this.client
            .api(`/sites/${this.siteId}/lists/${listId}/items`)
            .post({
                fields: {
                    Title: 'Reduce processing time by 30%',
                    Description: 'Streamline approval workflows and reduce bureaucratic delays',
                    GoalType: 'Org',
                    ParentPillarIdLookupId: parseInt(pillarIds[0]),  // Convert to number
                    Status: 'On Track',
                    Progress: 65,
                    Year: '2025',
                    Icon: 'Target',
                    IsFeatured: false
                }
            });

        const orgGoal2 = await this.client
            .api(`/sites/${this.siteId}/lists/${listId}/items`)
            .post({
                fields: {
                    Title: 'Implement cloud infrastructure',
                    Description: 'Migrate 80% of systems to cloud-based solutions',
                    GoalType: 'Org',
                    ParentPillarIdLookupId: parseInt(pillarIds[1]),  // Convert to number
                    Status: 'At Risk',
                    Progress: 45,
                    Year: '2025',
                    Icon: 'Rocket',
                    IsFeatured: true
                }
            });

        // Add Division Goals (these have ParentGoalId but no ParentPillarId)
        await this.client
            .api(`/sites/${this.siteId}/lists/${listId}/items`)
            .post({
                fields: {
                    Title: 'Automate HR onboarding process',
                    Description: 'Reduce onboarding time from 5 days to 2 days',
                    GoalType: 'Division',
                    Division: 'Executive Division',
                    ParentGoalIdLookupId: parseInt(orgGoal1.id),  // Convert to number
                    Status: 'On Track',
                    Progress: 70,
                    Year: '2025'
                }
            });

        await this.client
            .api(`/sites/${this.siteId}/lists/${listId}/items`)
            .post({
                fields: {
                    Title: 'Deploy new finance system',
                    Description: 'Implement cloud-based ERP for finance operations',
                    GoalType: 'Division',
                    Division: 'Finance Division',
                    ParentGoalIdLookupId: parseInt(orgGoal2.id),  // Convert to number
                    Status: 'Behind',
                    Progress: 30,
                    Year: '2025'
                }
            });
    }

    /**
     * Delete all Strategy System lists
     */
    async deleteStrategyLists(): Promise<{ success: boolean; message: string }> {
        const listNames = [
            'Strategy_Config',
            'Strategic_Pillars',
            'Strategic_Objectives',
            'Performance_KRAs',
            'Performance_KPIs',
            'Operations_Projects',
            'Operations_Tasks',
            'Operations_Risks',
            'System_View_Settings',
            'Organizational_Documents',
            'Market_Companies',
            'Market_PriceHistory',
            'Market_Settings'
        ];
        try {
            for (const name of listNames) {
                try {
                    const response = await this.client
                        .api(`/sites/${this.siteId}/lists`)
                        .filter(`displayName eq '${name}'`)
                        .select('id')
                        .get();
                    if (response.value && response.value.length > 0) {
                        await this.client
                            .api(`/sites/${this.siteId}/lists/${response.value[0].id}`)
                            .delete();
                        console.log(`✅ [Setup] Deleted list: ${name}`);
                    }
                } catch (err) { console.warn(`Failed delete ${name}`, err); }
            }
            return { success: true, message: 'Strategy lists deleted' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Check if lists already exist
     */
    async checkExistingLists(): Promise<{ exists: boolean; lists: string[] }> {
        try {
            const response = await this.client
                .api(`/sites/${this.siteId}/lists`)
                .select('displayName')
                .get();

            const existingLists = response.value
                .map((list: any) => list.displayName)
                .filter((name: string) =>
                    name === 'Strategy_Config' ||
                    name === 'Strategic_Pillars' ||
                    name === 'Strategic_Objectives' ||
                    name === 'Performance_KRAs' ||
                    name === 'Performance_KPIs' ||
                    name === 'Operations_Projects' ||
                    name === 'Operations_Projects' ||
                    name === 'Operations_Tasks' ||
                    name === 'Operations_Risks' ||
                    name === 'Market_Companies' ||
                    name === 'Market_PriceHistory' ||
                    name === 'Market_Settings' ||
                    name === 'Organizational_Documents'
                );

            return {
                exists: existingLists.length > 0,
                lists: existingLists
            };
        } catch (error) {
            console.error('Failed to check existing lists:', error);
            return { exists: false, lists: [] };
        }
    }

    /**
     * Create Operations Lists (KRAs, KPIs, Projects, Tasks)
     */
    async ensureAssigneesColumn(): Promise<{ success: boolean; message: string }> {
        try {
            console.log('🔍 Checking Operations_Tasks list...');
            const list = await this.client.api(`/sites/${this.siteId}/lists`).filter("displayName eq 'Operations_Tasks'").select('id').get();

            if (!list.value || list.value.length === 0) {
                return { success: false, message: 'Operations_Tasks list not found' };
            }

            const listId = list.value[0].id;
            console.log(`✅ Found Operations_Tasks List ID: ${listId}`);

            const result = await this.ensureColumn(listId, 'Assignees', { text: { allowMultipleLines: true } });

            return {
                success: result,
                message: result ? 'Assignees column ensured successfully' : 'Failed to ensure Assignees column'
            };
        } catch (e: any) {
            console.error('Failed to ensure Assignees column:', e);
            return { success: false, message: e.message };
        }
    }

    /**
     * TARGETED UPDATE: Ensure Operations_Tasks has specific new columns (CompletionDate)
     * This allows patching the schema without recreating lists.
     */
    async ensureTaskColumns(): Promise<{ success: boolean; message: string }> {
        try {
            console.log('🔍 [Setup] Checking Operations_Tasks for new columns...');
            const list = await this.client.api(`/sites/${this.siteId}/lists`).filter("displayName eq 'Operations_Tasks'").select('id').get();

            if (!list.value || list.value.length === 0) {
                return { success: false, message: 'Operations_Tasks list not found' };
            }

            const listId = list.value[0].id;

            // 1. Ensure 'CompletionDate' exists
            // FALLBACK: Using 'text' instead of 'dateTime' to avoid strict API validation errors.
            // Dates will be stored as ISO strings.
            const dateResult = await this.ensureColumn(listId, 'CompletionDate', { text: {} });

            return {
                success: true,
                message: dateResult
                    ? 'Verified/Added CompletionDate column successfully.'
                    : 'Columns already exist or failed to add.'
            };
        } catch (e: any) {
            console.error('Failed to ensure task columns:', e);
            return { success: false, message: e.message };
        }
    }

    /**
     * Seeds random CompletionDate for 'Done' tasks that lack it.
     * Backpopulates data for demo purposes (last 30 days).
     */
    async seedRandomCompletionDates(): Promise<{ success: boolean; message: string; count: number }> {
        try {
            console.log('🌱 [Seeding] Starting CompletionDate backpopulation...');
            const tasksList = await this.client.api(`/sites/${this.siteId}/lists`).filter("displayName eq 'Operations_Tasks'").select('id').get();

            if (!tasksList.value || tasksList.value.length === 0) {
                return { success: false, message: 'Operations_Tasks list not found', count: 0 };
            }
            const listId = tasksList.value[0].id;

            // Fetch 'Done' tasks
            const items = await this.client
                .api(`/sites/${this.siteId}/lists/${listId}/items`)
                .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
                .filter("fields/Status eq 'Done'")
                .expand('fields')
                .get();

            let updateCount = 0;
            const now = new Date();
            const days30Ago = new Date();
            days30Ago.setDate(now.getDate() - 30);

            for (const item of items.value) {
                // Only update if missing (or we can overwrite if needed, but missing is safer)
                if (!item.fields.CompletionDate) {
                    // Generate random date between 30 days ago and now
                    const randomTime = days30Ago.getTime() + Math.random() * (now.getTime() - days30Ago.getTime());
                    const randomDate = new Date(randomTime);

                    await this.client.api(`/sites/${this.siteId}/lists/${listId}/items/${item.id}`)
                        .patch({
                            fields: {
                                CompletionDate: randomDate.toISOString()
                            }
                        });
                    updateCount++;
                }
            }

            return {
                success: true,
                message: `Successfully seeded CompletionDate for ${updateCount} tasks.`,
                count: updateCount
            };

        } catch (e: any) {
            console.error('Failed to seed completion dates:', e);
            return { success: false, message: e.message, count: 0 };
        }
    }

    async createOperationsLists(includeSampleData: boolean = true): Promise<{ success: boolean; message: string; details: any }> {
        console.log('🚀 [Setup] Starting Operations list creation...');
        const results = {
            kras: null as any,
            kpis: null as any,
            projects: null as any,
            tasks: null as any,
            risks: null as any,
            objectives: null as any
        };

        try {
            // Check if Strategic_Objectives exists (unified source)
            const goalListCheck = await this.client
                .api(`/sites/${this.siteId}/lists`)
                .filter("displayName eq 'Strategic_Objectives'")
                .get();

            if (!goalListCheck.value || goalListCheck.value.length === 0) {
                throw new Error('Strategic_Objectives list not found. Please create Strategy Hub Lists first.');
            }
            const goalListId = goalListCheck.value[0].id;

            // 0. Create Unit_Objectives (NEW - often missing)
            console.log('📝 [Setup] Creating Unit_Objectives...');
            const unitObjectivesList = await this.createUnitObjectivesList(goalListId);
            results.objectives = unitObjectivesList;
            console.log('✅ [Setup] Unit_Objectives created');

            // 1. Create Performance_KRAs (Linking to Unit_Objectives instead of Strategic_Objectives)
            console.log('📝 [Setup] Creating Performance_KRAs...');
            const kraList = await this.createKrasList(unitObjectivesList.id);
            results.kras = kraList;
            console.log('✅ [Setup] Performance_KRAs created');

            // 2. Create Performance_KPIs
            console.log('📝 [Setup] Creating Performance_KPIs...');
            results.kpis = await this.createKpisList(kraList.id);
            console.log('✅ [Setup] Performance_KPIs created');

            // 3. Create Operations_Projects
            console.log('📝 [Setup] Creating Operations_Projects...');
            results.projects = await this.createProjectsList(kraList.id);
            console.log('✅ [Setup] Operations_Projects created');

            // 4. Create Operations_Risks
            console.log('📝 [Setup] Creating Operations_Risks...');
            results.risks = await this.createRisksList(results.projects.id, kraList.id);
            console.log('✅ [Setup] Operations_Risks created');

            // 5. Create Operations_Tasks
            console.log('📝 [Setup] Creating Operations_Tasks...');
            results.tasks = await this.createTasksList(results.projects.id, kraList.id, results.kpis.id);
            console.log('✅ [Setup] Operations_Tasks created');

            // 6. Create System_View_Settings
            console.log('📝 [Setup] Creating System_View_Settings...');
            await this.createViewSettingsList();
            console.log('✅ [Setup] System_View_Settings created');

            // 8. Add Sample Data (Optional)
            if (includeSampleData) {
                console.log('📝 [Setup] Adding Operations sample data...');
                await this.addOperationsSampleData(goalListId, results);
                console.log('✅ [Setup] Operations sample data added');
            } else {
                console.log('ℹ️ [Setup] Skipping sample data (clean slate requested)');
            }

            return {
                success: true,
                message: 'All Operations lists created successfully!',
                details: results
            };

        } catch (error: any) {
            console.error('❌ [Setup] Failed to create operations lists:', error);
            return {
                success: false,
                message: `Failed to create lists: ${error.message}`,
                details: error
            };
        }
    }

    async recreateProjectsListOnly(): Promise<{ success: boolean; message: string }> {
        console.log('🔄 [Setup] Recreating Operations_Projects list only...');
        try {
            // 1. Get Dependency: Performance_KRAs ID
            const krasList = await this.client
                .api(`/sites/${this.siteId}/lists`)
                .filter("displayName eq 'Performance_KRAs'")
                .select('id')
                .get();

            if (!krasList.value || krasList.value.length === 0) {
                throw new Error('Performance_KRAs list not found. Cannot create Projects list without it.');
            }
            const krasListId = krasList.value[0].id;

            // 2. Delete existing Operations_Projects if it exists
            const projListCheck = await this.client
                .api(`/sites/${this.siteId}/lists`)
                .filter("displayName eq 'Operations_Projects'")
                .select('id')
                .get();

            if (projListCheck.value && projListCheck.value.length > 0) {
                console.log(`🗑️ [Setup] Deleting existing Operations_Projects list (${projListCheck.value[0].id})...`);
                await this.client.api(`/sites/${this.siteId}/lists/${projListCheck.value[0].id}`).delete();
            }

            // 3. Create List
            console.log('📝 [Setup] Creating Operations_Projects...');
            await this.createProjectsList(krasListId);
            console.log('✅ [Setup] Operations_Projects created');

            return { success: true, message: 'Operations_Projects list recreated successfully.' };

        } catch (error: any) {
            console.error('❌ [Setup] Failed to recreate Projects list:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Create Organizational Documents List Setup (Dedicated)
     */
    async createSharedDocsSetup(): Promise<{ success: boolean; message: string; details: any }> {
        console.log('🚀 [Setup] Starting Organizational Documents setup...');
        try {
            console.log('📝 [Setup] Creating Organizational_Documents...');
            const result = await this.createSharedDocumentsList();
            console.log('✅ [Setup] Organizational_Documents created');

            return {
                success: true,
                message: 'Organizational Documents library created successfully!',
                details: result,
            };
        } catch (error: any) {
            console.error('❌ [Setup] Failed to create shared docs:', error);
            return {
                success: false,
                message: `Failed to create shared docs: ${error.message}`,
                details: error,
            };
        }
    }

    /**
     * Delete Organizational Documents List Setup (Dedicated)
     */
    async deleteSharedDocsSetup(): Promise<{ success: boolean; message: string }> {
        console.log('🗑️ [Setup] Deleting Organizational Documents...');
        const listName = 'Organizational_Documents';
        try {
            const response = await this.client
                .api(`/sites/${this.siteId}/lists`)
                .filter(`displayName eq '${listName}'`)
                .select('id')
                .get();

            if (response.value && response.value.length > 0) {
                const listId = response.value[0].id;
                await this.client
                    .api(`/sites/${this.siteId}/lists/${listId}`)
                    .delete();
                console.log(`✅ [Setup] Deleted list: ${listName}`);
            } else {
                console.log(`ℹ️ [Setup] List not found: ${listName}`);
            }
            return { success: true, message: 'Organizational Documents deleted successfully' };
        } catch (error: any) {
            console.error('❌ [Setup] Failed to delete Organizational Documents:', error);
            return { success: false, message: `Failed to delete Organizational Documents: ${error.message}` };
        }
    }

    /**
     * Create Organizational_Documents Document Library
     */
    async createSharedDocumentsList() {
        // Check if exists first
        const check = await this.client.api(`/sites/${this.siteId}/lists`).filter("displayName eq 'Organizational_Documents'").get();
        if (check.value && check.value.length > 0) return check.value[0];

        const list = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName: 'Organizational_Documents',
                columns: [
                    { name: 'Category', choice: { choices: ['Governance & Legal', 'Company Strategy & Management', 'Communication & Branding', 'Training & Human Resources', 'IT & Systems', 'Records & Archives', 'External Shared Documents'] } },
                    { name: 'SubCategory', text: {} },
                    { name: 'DocDescription', text: { allowMultipleLines: true } },
                    { name: 'Tags', text: {} },
                    { name: 'ExternalUrl', text: {} }
                ],
                list: { template: 'documentLibrary' }
            });

        return list;
    }

    /**
     * Ensure Organizational_Documents has all required columns (for patching)
     */
    async ensureSharedDocsColumns(): Promise<{ success: boolean; message: string }> {
        try {
            console.log('🔍 [Setup] Checking Organizational_Documents for schema...');
            const list = await this.client.api(`/sites/${this.siteId}/lists`).filter("displayName eq 'Organizational_Documents'").select('id').get();

            if (!list.value || list.value.length === 0) {
                // Try creating it if missing
                await this.createSharedDocumentsList();
                return { success: true, message: 'Organizational_Documents list was missing and has been created.' };
            }

            const listId = list.value[0].id;

            // Ensure 'ExternalUrl' exists
            await this.ensureColumn(listId, 'ExternalUrl', { text: {} });

            // Note: Updating choice columns via Graph is complex, skipping category choice update for now
            // as 'External Shared Documents' is handled as a text value often anyway in list items.

            return {
                success: true,
                message: 'Verified/Added Organizational_Documents columns successfully.'
            };
        } catch (e: any) {
            console.error('Failed to ensure shared docs columns:', e);
            throw e;
        }
    }

    /**
     * Create Performance_KRAs
     */
    private async createKrasList(goalListId: string) {
        const list = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName: 'Performance_KRAs',
                columns: [
                    { name: 'Department', text: {} },
                    { name: 'Responsible', personOrGroup: {} },
                    { name: 'Status', choice: { choices: ['Open', 'In Progress', 'Closed'] } },
                    { name: 'Progress', number: { decimalPlaces: 'none', minimum: 0, maximum: 100 } },
                    { name: 'Description', text: { allowMultipleLines: true } },
                    { name: 'Assignees', text: { allowMultipleLines: true } }
                ],
                list: { template: 'genericList' }
            });

        // Consistent name 'UnitObjective' -> Field 'UnitObjectiveId'
        await this.addLookupColumn(list.id, 'UnitObjective', goalListId, 'Title');
        return list;
    }

    /**
     * Create Performance_KPIs
     */
    private async createKpisList(kraListId: string) {
        const list = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName: 'Performance_KPIs',
                columns: [
                    { name: 'Metric', text: {} }, // %, $, #
                    { name: 'TargetValue', number: { decimalPlaces: 'automatic' } },
                    { name: 'ActualValue', number: { decimalPlaces: 'automatic' } },
                    { name: 'Status', choice: { choices: ['On Track', 'At Risk', 'Behind', 'Completed'] } },
                    { name: 'CostAssociated', currency: { locale: 'en-AU' } },
                    { name: 'Description', text: { allowMultipleLines: true } },
                    { name: 'StartDate', dateTime: { format: 'dateOnly' } },
                    { name: 'EndDate', dateTime: { format: 'dateOnly' } },
                    { name: 'Assignees', text: { allowMultipleLines: true } },
                    { name: 'CalculationType', text: {} },
                    { name: 'ChecklistJSON', text: { allowMultipleLines: true } },
                    { name: 'IsMockData', boolean: {} }
                ],
                list: { template: 'genericList' }
            });

        await this.addLookupColumn(list.id, 'RelatedKRA', kraListId, 'Title');
        return list;
    }

    /**
     * Create Operations_Projects
     */
    private async createProjectsList(kraListId: string) {
        const list = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName: 'Operations_Projects',
                columns: [
                    { name: 'Manager', text: {} },
                    { name: 'Assignees', text: { allowMultipleLines: true } },
                    { name: 'Department', text: {} },
                    { name: 'Description', text: { allowMultipleLines: true } },
                    { name: 'Status', choice: { choices: ['Planned', 'In Progress', 'Completed', 'On Hold'] } },
                    { name: 'StartDate', dateTime: { format: 'dateOnly' } },
                    { name: 'EndDate', dateTime: { format: 'dateOnly' } },
                    { name: 'Budget', currency: { locale: 'en-AU' } },
                    { name: 'BudgetSpent', currency: { locale: 'en-AU' } },
                    { name: 'Progress', number: { minimum: 0, maximum: 100 } },
                    { name: 'RisksJSON', text: { allowMultipleLines: true } },
                    { name: 'ChecklistJSON', text: { allowMultipleLines: true } }
                ],
                list: { template: 'genericList' }
            });

        await this.addLookupColumn(list.id, 'RelatedKRA', kraListId, 'Title');
        return list;
    }

    /**
     * Create Operations_Risks
     */
    private async createRisksList(projectListId: string, kraListId: string) {
        const list = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName: 'Operations_Risks',
                columns: [
                    { name: 'Description', text: { allowMultipleLines: true } },
                    { name: 'Status', choice: { choices: ['Identified', 'Analyzing', 'Mitigating', 'Monitoring', 'Resolved', 'Accepted'] } },
                    { name: 'Impact', choice: { choices: ['Low', 'Medium', 'High', 'Critical'] } },
                    { name: 'Likelihood', choice: { choices: ['Low', 'Medium', 'High', 'Very-High'] } },
                    { name: 'Category', choice: { choices: ['Financial', 'Operational', 'Strategic', 'Compliance', 'Reputational'] } },
                    { name: 'MitigationPlan', text: { allowMultipleLines: true } },
                    { name: 'Owner', personOrGroup: {} },
                    { name: 'Department', text: {} }
                ],
                list: { template: 'genericList' }
            });

        await this.addLookupColumn(list.id, 'RelatedProject', projectListId, 'Title');
        await this.addLookupColumn(list.id, 'RelatedKRA', kraListId, 'Title');
        return list;
    }

    /**
     * Create Operations_Tasks
     */
    private async createTasksList(projectListId: string, kraListId: string, kpiListId: string) {
        const list = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName: 'Operations_Tasks',
                columns: [
                    { name: 'AssignedTo', personOrGroup: {} },
                    { name: 'Department', text: {} },
                    { name: 'DueDate', dateTime: {} },
                    { name: 'StartDate', dateTime: {} },
                    { name: 'Status', choice: { choices: ['Todo', 'In Progress', 'Review', 'Done'] } },
                    { name: 'Priority', choice: { choices: ['Low', 'Medium', 'High', 'Urgent'] } },
                    { name: 'Description', text: { allowMultipleLines: true } },
                    { name: 'SubtasksJSON', text: { allowMultipleLines: true } },
                    { name: 'Tags', text: { allowMultipleLines: true } },
                    { name: 'Recurrence', text: {} },
                    { name: 'Assignees', text: { allowMultipleLines: true } }, // JSON for multiple assignees
                    { name: 'IsMockData', boolean: {} }
                ],
                list: { template: 'genericList' }
            });

        await this.addLookupColumn(list.id, 'RelatedProject', projectListId, 'Title');
        await this.addLookupColumn(list.id, 'RelatedKRA', kraListId, 'Title');
        await this.addLookupColumn(list.id, 'RelatedKPI', kpiListId, 'Title');
        return list;
    }

    /**
     * Delete Operations Lists
     */
    async deleteOperationsLists(): Promise<{ success: boolean; message: string }> {
        const listNames = ['Performance_KRAs', 'Performance_KPIs', 'Operations_Projects', 'Operations_Tasks', 'Operations_Risks', 'System_View_Settings'];
        try {
            for (const name of listNames) {
                try {
                    const response = await this.client
                        .api(`/sites/${this.siteId}/lists`)
                        .filter(`displayName eq '${name}'`)
                        .select('id')
                        .get();
                    if (response.value && response.value.length > 0) {
                        await this.client
                            .api(`/sites/${this.siteId}/lists/${response.value[0].id}`)
                            .delete();
                        console.log(`✅ [Setup] Deleted list: ${name}`);
                    }
                } catch (err) { console.warn(`Failed delete ${name}`, err); }
            }
            return { success: true, message: 'Operations lists deleted' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Create System_View_Settings List
     */
    async createViewSettingsList() {
        // Check if exists first
        const check = await this.client.api(`/sites/${this.siteId}/lists`).filter("displayName eq 'System_View_Settings'").get();
        if (check.value && check.value.length > 0) return check.value[0];

        const list = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName: 'System_View_Settings',
                columns: [
                    { name: 'PageName', text: {} },
                    { name: 'ComponentName', text: {} },
                    { name: 'VisibilityScope', choice: { choices: ['Division', 'Unit', 'Individual', 'All'] } },
                    { name: 'Description', text: { allowMultipleLines: true } }
                ],
                list: { template: 'genericList' }
            });

        // Add Default Settings
        const defaults = [
            { fields: { Title: 'UnitPage_Objectives', PageName: 'Unit Page', ComponentName: 'Objectives', VisibilityScope: 'Division', Description: 'Strategy Objectives visibility' } },
            { fields: { Title: 'UnitPage_KRAs', PageName: 'Unit Page', ComponentName: 'KRAs', VisibilityScope: 'Division', Description: 'Key Result Areas visibility' } },
            { fields: { Title: 'UnitPage_KPIs', PageName: 'Unit Page', ComponentName: 'KPIs', VisibilityScope: 'Division', Description: 'Key Performance Indicators visibility' } },
            { fields: { Title: 'UnitPage_Projects', PageName: 'Unit Page', ComponentName: 'Projects', VisibilityScope: 'Unit', Description: 'Projects and Initiatives' } },
            { fields: { Title: 'UnitPage_Tasks', PageName: 'Unit Page', ComponentName: 'Tasks', VisibilityScope: 'Unit', Description: 'Daily Tasks' } },
            { fields: { Title: 'UnitPage_Risks', PageName: 'Unit Page', ComponentName: 'Risks', VisibilityScope: 'Division', Description: 'Risk Register' } }
        ];

        for (const item of defaults) {
            await this.client.api(`/sites/${this.siteId}/lists/${list.id}/items`).post(item);
        }

        return list;
    }

    /**
     * Create InternalAppSettings List
     * Used for storing global app configuration like API keys
     */
    async createInternalAppSettingsList(): Promise<{ success: boolean; message: string; details: any }> {
        console.log('🚀 [Setup] Creating InternalAppSettings list...');
        try {
            // Check if exists first
            const check = await this.client.api(`/sites/${this.siteId}/lists`).filter("displayName eq 'InternalAppSettings'").get();
            if (check.value && check.value.length > 0) {
                return { success: true, message: 'InternalAppSettings list already exists', details: check.value[0] };
            }

            const list = await this.client
                .api(`/sites/${this.siteId}/lists`)
                .post({
                    displayName: 'InternalAppSettings',
                    columns: [
                        { name: 'Value', text: {} },
                        { name: 'Description', text: { allowMultipleLines: true } }
                    ],
                    list: { template: 'genericList' }
                });

            console.log('✅ [Setup] InternalAppSettings list created');
            return {
                success: true,
                message: 'InternalAppSettings list created successfully!',
                details: list
            };
        } catch (error: any) {
            console.error('❌ [Setup] Failed to create InternalAppSettings:', error);
            return {
                success: false,
                message: `Failed to create InternalAppSettings list: ${error.message}`,
                details: error
            };
        }
    }

    /**
     * Setup Org Hierarchy list and seed with current hard-coded structure
     */
    async setupStrategyOrgHierarchy(): Promise<{ success: boolean; message: string; details?: any }> {
        console.log('🚀 [Setup] Starting Org Hierarchy setup...');
        try {
            // 1. Create List
            const list = await this.createOrgHierarchyList();
            console.log('✅ [Setup] Org_Hierarchy list ensured');

            // 2. Seed Data
            const result = await this.seedOrgHierarchyData(list.id);
            console.log('✅ [Setup] Org_Hierarchy data seeded');

            return {
                success: true,
                message: 'Organizational hierarchy has been successfully moved to SharePoint!',
                details: result
            };
        } catch (error: any) {
            console.error('❌ [Setup] Org Hierarchy Setup failed:', error);
            return {
                success: false,
                message: `Failed to setup Org Hierarchy: ${error.message}`,
                details: error
            };
        }
    }

    /**
     * Create Org_Hierarchy List
     */
    private async createOrgHierarchyList() {
        // Check if exists first
        const check = await this.client.api(`/sites/${this.siteId}/lists`).filter("displayName eq 'Org_Hierarchy'").get();
        if (check.value && check.value.length > 0) return check.value[0];

        const list = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName: 'Org_Hierarchy',
                columns: [
                    { name: 'Division', text: { enforceUniqueValues: false } },
                    { name: 'Unit', text: {} },
                    { name: 'SortOrder', number: { decimalPlaces: 'none' } },
                    { name: 'Head', text: {} },
                    { name: 'Email', text: {} },
                    { name: 'Phone', text: {} },
                    { name: 'Role', text: {} },
                    { name: 'Description', text: { allowMultipleLines: true } }
                ],
                list: { template: 'genericList' }
            });

        return list;
    }

    /**
     * Seed Org_Hierarchy List
     */
    private async seedOrgHierarchyData(listId: string) {
        const ORG_DETAILS = [
            {
                division: 'Office of the Chairman',
                unit: 'Executive Division',
                head: 'James Joshua',
                email: 'jjoshua@scpng.gov.pg',
                phone: '+675 321 2223',
                role: 'Acting CEO — Executive leadership and strategy',
                description: 'Oversees the operations and strategic direction of the Commission. Responsible for regulatory oversight, stakeholder engagement, and organizational governance.'
            },
            {
                division: 'Office of the Chairman',
                unit: 'Secretariat Unit',
                head: 'Andy Ambulu',
                email: 'aambulu@scpng.gov.pg',
                phone: '+675 321 2223',
                role: 'General Counsel — Legal counsel on regulatory and corporate matters',
                description: 'Provides legal support to the Board and Executive Management, ensuring compliance and robust governance.'
            },
            {
                division: 'Corporate Services Division',
                unit: 'Finance Unit',
                head: 'Sam Taki',
                email: 'staki@scpng.gov.pg',
                phone: '+675 321 2223',
                role: 'Director Corporate Service',
                description: 'Strategic Focus: Administrative Fundamentals — Internal policies, governance, HR/Finance modernization, IT infrastructure.'
            },
            {
                division: 'Corporate Services Division',
                unit: 'IT Unit',
                head: 'Eric Kipongi',
                role: 'Manager Information Technology',
                description: 'Network infrastructure, systems administration, database management, IT security, and digital transformation.'
            },
            {
                division: 'Corporate Services Division',
                unit: 'Human Resource Unit',
                head: 'Thomas Mondaya',
                role: 'Senior HR Officer',
                description: 'Recruitment, performance management, staff welfare, and organizational development.'
            },
            {
                division: 'Licensing, Market & Supervision Division',
                unit: 'Licensing Unit',
                head: 'Leeroy Wambillie',
                role: 'Senior Licensing Officer',
                description: 'License application review, compliance assessment, and maintaining the license register.'
            },
            {
                division: 'Licensing, Market & Supervision Division',
                unit: 'Supervision Unit',
                head: 'Regina Wai',
                role: 'Senior Supervision Officer',
                description: 'Supervisory oversight of licensed entities and monitoring of market participant activities.'
            },
            {
                division: 'Licensing, Market & Supervision Division',
                unit: 'Market Data Unit',
                head: 'Zomay Apini',
                role: 'Market Data Manager',
                description: 'Capital market data collection and analysis, market surveillance, and statistical reporting.'
            },
            {
                division: 'Licensing, Market & Supervision Division',
                unit: 'Investigations Unit',
                head: 'Jacob Kom',
                role: 'Senior Investigations Officer',
                description: 'Investigation of securities law violations, market misconduct, and fraud detection.'
            },
            {
                division: 'Legal Services Division',
                unit: 'Legal Advisory Unit',
                head: 'Tyson Yapao',
                email: 'tyapao@scpng.gov.pg',
                phone: '+675 321 2223',
                role: 'Legal Manager - Compliance & Enforcement',
                description: 'Strategic Focus: Regulatory Framework Reform — SC Act and Capital Market Act amendments, legal enforcement & compliance.'
            },
            {
                division: 'Research & Publication Division',
                unit: 'Research Unit',
                head: 'Max Siwi',
                role: 'Senior Research Officer',
                description: 'Capital market trend research, policy analysis, and regulatory impact assessments.'
            },
            {
                division: 'Research & Publication Division',
                unit: 'Publication Unit',
                head: 'Joy Komba',
                email: 'jkomba@scpng.gov.pg',
                phone: '+675 321 2223',
                role: 'Director Research & Publication',
                description: 'Strategic Focus: Investor Education — Social media expansion, investor bootcamps, and "Invest Smart PNG" campaign.'
            }
        ];

        const items: any[] = [];
        let sortOrder = 1;

        for (const detail of ORG_DETAILS) {
            items.push({
                fields: {
                    Title: detail.division,
                    Division: detail.division,
                    Unit: detail.unit,
                    SortOrder: sortOrder++,
                    Head: detail.head,
                    Email: detail.email || '',
                    Phone: detail.phone || '',
                    Role: detail.role,
                    Description: detail.description
                }
            });
        }

        // Add items in sequence to avoid conflicts
        const results = [];
        for (const item of items) {
            const created = await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).post(item);
            results.push(created);
        }

        return results;
    }


    /**
     * Add Linked Sample Data for Operations
     */
    private async addOperationsSampleData(goalListId: string, lists: any) {
        // 1. Get a Division Goal from Unit_Objectives to link to (e.g., "Automate HR...")
        const objectivesListId = lists.objectives.id;
        const goals = await this.client
            .api(`/sites/${this.siteId}/lists/${objectivesListId}/items`)
            .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
            .expand('fields')
            .filter("fields/GoalType eq 'Division'")
            .get();

        let targetDivisionGoal = goals.value.find((g: any) => g.fields.Division === 'Executive Division' || g.fields.Title.includes('HR')) || goals.value[0];
        let targetFinanceGoal = goals.value.find((g: any) => g.fields.Division === 'Finance Division' || g.fields.Title.includes('Finance')) || goals.value[goals.value.length - 1];

        if (!goals.value || goals.value.length === 0) {
            console.warn('⚠️ No Division Goals found. Creating a Fallback Goal for linkage...');
            try {
                const fallbackGoal = await this.client.api(`/sites/${this.siteId}/lists/${goalListId}/items`).post({
                    fields: {
                        Title: 'Operational Excellence (Mock)',
                        Description: 'Fallback goal created for Operations Setup to ensure KRA linkage.',
                        GoalType: 'Division',
                        Division: 'Executive Division',
                        Status: 'On Track',
                        Progress: 50,
                        Year: '2025'
                    }
                });
                console.log('✅ Created Fallback Division Goal:', fallbackGoal.id);
                targetDivisionGoal = fallbackGoal;
                targetFinanceGoal = fallbackGoal; // Use same for both if we only have one
            } catch (err: any) {
                console.error("❌ Failed to create fallback goal:", err);
                return; // Now we really have to stop
            }
        }

        // 2. Create KRAs
        // KRA 1 for HR
        console.log(`🔗 [Setup] Linking KRA to Goal ID: ${targetDivisionGoal.id}`);
        const kra1 = await this.client.api(`/sites/${this.siteId}/lists/${lists.kras.id}/items`).post({
            fields: {
                Title: 'Reduce Hiring Time',
                Department: 'Executive Division',
                Status: 'In Progress',
                Progress: 40,
                StrategyGoalLookupId: parseInt(targetDivisionGoal.id), // Corrected to 'LookupId'
                StartDate: '2025-01-01',
                EndDate: '2025-12-31'
            }
        });

        // KRA 2 for IT/Finance
        const kra2 = await this.client.api(`/sites/${this.siteId}/lists/${lists.kras.id}/items`).post({
            fields: {
                Title: 'Modernize Financial Reporting',
                Department: 'Finance Division',
                Status: 'In Progress',
                Progress: 20,
                StrategyGoalLookupId: parseInt(targetFinanceGoal.id),
                StartDate: '2025-01-01',
                EndDate: '2025-12-31'
            }
        });

        // 3. Create KPIs (Linked to KRA 1)
        const kpi1 = await this.client.api(`/sites/${this.siteId}/lists/${lists.kpis.id}/items`).post({
            fields: {
                Title: 'Average Days to Hire',
                Metric: 'Days',
                TargetValue: 30,
                ActualValue: 45,
                Status: 'Behind',
                RelatedKRALookupId: parseInt(kra1.id) // Using 'RelatedKRA' + 'Id'
            }
        });

        // 4. Create Project (Linked to KRA 2)
        const proj1 = await this.client.api(`/sites/${this.siteId}/lists/${lists.projects.id}/items`).post({
            fields: {
                Title: 'Finance System Migration',
                Department: 'Finance Division',
                Status: 'In Progress',
                StartDate: '2025-02-01',
                EndDate: '2025-10-30',
                Budget: 500000,
                BudgetSpent: 120000,
                RelatedKRALookupId: parseInt(kra2.id),
                RisksJSON: JSON.stringify([{ id: 1, text: 'Data migration failure', likelihood: 'Medium' }])
            }
        });

        // 5. Create Risks
        await this.client.api(`/sites/${this.siteId}/lists/${lists.risks.id}/items`).post({
            fields: {
                Title: 'Budget Overrun Risk',
                Description: 'Potential scope creep causing budget concerns',
                Status: 'Monitoring',
                Impact: 'High',
                Likelihood: 'Medium',
                Category: 'Financial',
                MitigationPlan: 'Bi-weekly budget reviews',
                Department: 'Finance Division',
                RelatedProjectLookupId: parseInt(proj1.id)
            }
        });

        await this.client.api(`/sites/${this.siteId}/lists/${lists.risks.id}/items`).post({
            fields: {
                Title: 'Hiring Delays',
                Description: 'Market shortage of qualified candidates',
                Status: 'Mitigating',
                Impact: 'Medium',
                Likelihood: 'High',
                Category: 'Operational',
                MitigationPlan: 'Engage external agencies',
                Department: 'Executive Division',
                RelatedKRALookupId: parseInt(kra1.id)
            }
        });

        // 5. Create Tasks
        // Task linked to Project
        await this.client.api(`/sites/${this.siteId}/lists/${lists.tasks.id}/items`).post({
            fields: {
                Title: 'Map legacy data fields',
                Department: 'Finance Division',
                Status: 'Done',
                Priority: 'High',
                DueDate: '2025-03-01',
                RelatedProjectLookupId: parseInt(proj1.id),
                SubtasksJSON: JSON.stringify([{ id: '1', text: 'Review schema', completed: true }])
            }
        });

        // Task linked to KRA (Ad-hoc)
        await this.client.api(`/sites/${this.siteId}/lists/${lists.tasks.id}/items`).post({
            fields: {
                Title: 'Draft new hiring policy',
                Department: 'Executive Division',
                Status: 'In Progress',
                Priority: 'Medium',
                DueDate: '2025-04-15',
                RelatedKRALookupId: parseInt(kra1.id)
            }
        });

        // Task linked to KPI (Data collection)
        await this.client.api(`/sites/${this.siteId}/lists/${lists.tasks.id}/items`).post({
            fields: {
                Title: 'Collect Q1 Hiring Metrics',
                Department: 'Executive Division',
                Status: 'Todo',
                Priority: 'Low',
                DueDate: '2025-04-01',
                RelatedKPILookupId: parseInt(kpi1.id)
            }
        });
    }


    /**
     * Create Market Data Lists
     */
    async createMarketDataLists(): Promise<{ success: boolean; message: string; details: any }> {
        console.log('🚀 [Setup] Starting Market Data list creation...');
        const results = {
            companies: null as any,
            history: null as any,
            settings: null as any
        };

        try {
            // 1. Create Market_Companies
            console.log('📝 [Setup] Creating Market_Companies...');
            results.companies = await this.createMarketCompaniesList();
            console.log('✅ [Setup] Market_Companies created');

            // 2. Create Market_PriceHistory
            console.log('📝 [Setup] Creating Market_PriceHistory...');
            results.history = await this.createMarketPriceHistoryList(results.companies.id);
            console.log('✅ [Setup] Market_PriceHistory created');

            // 3. Create Market_Settings
            console.log('📝 [Setup] Creating Market_Settings...');
            results.settings = await this.createMarketSettingsList();
            console.log('✅ [Setup] Market_Settings created');

            // 4. Seed Data
            console.log('📝 [Setup] Seeding Market Settings...');
            await this.seedMarketSettings(results.settings.id);
            console.log('✅ [Setup] Market Settings seeded');

            return {
                success: true,
                message: 'All Market Data lists created successfully!',
                details: results
            };
        } catch (error: any) {
            console.error('❌ [Setup] Failed to create Market Data lists:', error);
            return {
                success: false,
                message: `Failed to create lists: ${error.message}`,
                details: error
            };
        }
    }

    /**
     * Create Market_Companies List
     */
    private async createMarketCompaniesList() {
        const list = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName: 'Market_Companies',
                columns: [
                    { name: 'CompanyName', text: {} },
                    { name: 'Sector', text: {} },
                    { name: 'LastPrice', number: { decimalPlaces: 'automatic' } },
                    { name: 'PreviousClose', number: { decimalPlaces: 'automatic' } },
                    { name: 'ChangePercent', number: { decimalPlaces: 'automatic' } },
                    { name: 'Volume', number: { decimalPlaces: 'none' } },
                    { name: 'MarketCap', text: {} },
                    { name: 'PrimaryColor', text: {} },
                    { name: 'SecondaryColor', text: {} },
                    { name: 'IsActive', boolean: {} },
                    { name: 'DisplayOrder', number: { decimalPlaces: 'none' } },
                    { name: 'CompanyLogo', text: {} }, // Using text for URL simplication or Url type if supported
                    { name: 'Website', text: {} },
                    { name: 'Description', text: { allowMultipleLines: true } }
                ],
                list: {
                    template: 'genericList'
                }
            });
        return list;
    }

    /**
     * Create Market_PriceHistory List
     */
    private async createMarketPriceHistoryList(companiesListId: string) {
        const list = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName: 'Market_PriceHistory',
                columns: [
                    { name: 'TradeDate', dateTime: {} },
                    { name: 'OpenPrice', number: { decimalPlaces: 'automatic' } },
                    { name: 'HighPrice', number: { decimalPlaces: 'automatic' } },
                    { name: 'LowPrice', number: { decimalPlaces: 'automatic' } },
                    { name: 'ClosePrice', number: { decimalPlaces: 'automatic' } },
                    { name: 'Volume', number: { decimalPlaces: 'none' } },
                    { name: 'NumberOfTrades', number: { decimalPlaces: 'none' } },
                    { name: 'Value', number: { decimalPlaces: 'automatic' } }
                ],
                list: {
                    template: 'genericList'
                }
            });

        // Add Lookup
        await this.addLookupColumn(list.id, 'CompanySymbol', companiesListId, 'Title');
        return list;
    }

    /**
     * Create Market_Settings List
     */
    private async createMarketSettingsList() {
        return await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName: 'Market_Settings',
                columns: [
                    { name: 'SettingKey', text: { enforceUniqueValues: true } },
                    { name: 'SettingValue', text: {} },
                    {
                        name: 'SettingType',
                        choice: {
                            choices: ['String', 'Number', 'Boolean', 'JSON', 'Color'],
                            displayAs: 'dropDownMenu'
                        }
                    },
                    { name: 'Category', text: {} },
                    { name: 'Description', text: { allowMultipleLines: true } },
                    { name: 'IsActive', boolean: {} }
                ],
                list: {
                    template: 'genericList'
                }
            });
    }

    /**
     * Seed Market Settings
     */
    private async seedMarketSettings(listId: string) {
        const settings = [
            { fields: { Title: 'Default Time Range', SettingKey: 'default_time_range', SettingValue: '2M', SettingType: 'String', Category: 'Display', IsActive: true } },
            { fields: { Title: 'Live Updates Enabled', SettingKey: 'live_updates_enabled', SettingValue: 'true', SettingType: 'Boolean', Category: 'Features', IsActive: true } },
            { fields: { Title: 'Auto Cycle Enabled', SettingKey: 'auto_cycle_enabled', SettingValue: 'false', SettingType: 'Boolean', Category: 'Features', IsActive: true } },
            { fields: { Title: 'Cycle Interval', SettingKey: 'cycle_interval', SettingValue: '5000', SettingType: 'Number', Category: 'Features', IsActive: true } },
            { fields: { Title: 'Update Interval', SettingKey: 'update_interval', SettingValue: '2000', SettingType: 'Number', Category: 'Features', IsActive: true } },
            { fields: { Title: 'Chart Animation Duration', SettingKey: 'chart_animation_duration', SettingValue: '800', SettingType: 'Number', Category: 'Display', IsActive: true } },
            { fields: { Title: 'Max Data Points', SettingKey: 'max_data_points', SettingValue: '100', SettingType: 'Number', Category: 'Performance', IsActive: true } }
        ];

        for (const item of settings) {
            await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).post(item);
        }
    }

    /**
     * Delete Market Lists
     */
    async deleteMarketDataLists(): Promise<{ success: boolean; message: string }> {
        const listNames = ['Market_Companies', 'Market_PriceHistory', 'Market_Settings'];
        try {
            for (const name of listNames) {
                try {
                    const response = await this.client
                        .api(`/sites/${this.siteId}/lists`)
                        .filter(`displayName eq '${name}'`)
                        .select('id')
                        .get();
                    if (response.value && response.value.length > 0) {
                        await this.client
                            .api(`/sites/${this.siteId}/lists/${response.value[0].id}`)
                            .delete();
                        console.log(`✅ [Setup] Deleted list: ${name}`);
                    }
                } catch (err) { console.warn(`Failed delete ${name}`, err); }
            }
            return { success: true, message: 'Market Data lists deleted' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }
    /**
     * Seed Market Data (Companies and Price History)
     */
    async seedMarketData(): Promise<{ success: boolean; message: string }> {
        console.log('🚀 [Setup] Starting Market Data Seeding...');

        try {
            // 1. Get Lists
            const lists = await this.client.api(`/sites/${this.siteId}/lists`).select('id,displayName').get();
            const companiesList = lists.value.find((l: any) => l.displayName === 'Market_Companies');
            const historyList = lists.value.find((l: any) => l.displayName === 'Market_PriceHistory');

            if (!companiesList || !historyList) {
                throw new Error('Market_Companies or Market_PriceHistory list not found. Please create lists first.');
            }

            // 2. Clear existing companies (optional? No, assuming empty or appending)
            // For now, we will just add. If duplicates exist, it might be messy but acceptable for test ground.

            // 3. Loop through companies
            for (const company of INITIAL_COMPANIES) {
                console.log(`📝 [Setup] Seeding company: ${company.symbol}...`);

                // Create Company Item
                const companyItem = await this.client.api(`/sites/${this.siteId}/lists/${companiesList.id}/items`).post({
                    fields: {
                        Title: company.symbol, // Symbol as Title
                        CompanyName: company.name,
                        Sector: company.sector,
                        LastPrice: company.last,
                        PreviousClose: company.last * (1 - company.change / 100), // Approx
                        ChangePercent: company.change,
                        Volume: company.vol,
                        MarketCap: company.mcap,
                        PrimaryColor: company.colors.primary,
                        SecondaryColor: company.colors.secondary,
                        IsActive: true,
                        DisplayOrder: 0,
                        Description: `${company.name} is a leading entity in the ${company.sector} sector.`
                    }
                });

                const companyId = companyItem.id;
                console.log(`✅ [Setup] Created ${company.symbol} (ID: ${companyId})`);

                // Generate and Seed History
                console.log(`   ⏳ Generating history for ${company.symbol}...`);
                const history = this.generatePriceHistory(company.last, company.change, 60); // 60 days

                // Batch insert history? Graph requests are slow one by one.
                // We will do parallel requests in chunks of 5 to avoid throttling
                const chunkSize = 5;
                for (let i = 0; i < history.length; i += chunkSize) {
                    const chunk = history.slice(i, i + chunkSize);
                    await Promise.all(chunk.map(point => {
                        return this.client.api(`/sites/${this.siteId}/lists/${historyList.id}/items`).post({
                            fields: {
                                Title: `${company.symbol} - ${new Date(point.time).toLocaleDateString()}`,
                                CompanySymbolLookupId: companyId, // Lookup to the company item
                                TradeDate: new Date(point.time).toISOString(),
                                OpenPrice: point.open,
                                HighPrice: point.high,
                                LowPrice: point.low,
                                ClosePrice: point.close,
                                Volume: point.volume,
                                NumberOfTrades: Math.floor(point.volume / 100), // Synthetic
                                Value: point.close * point.volume
                            }
                        });
                    }));
                }
                console.log(`   ✅ History seeded for ${company.symbol}`);
            }

            return { success: true, message: 'Market Data seeding completed!' };
        } catch (error: any) {
            console.error('❌ [Setup] Seeding failed:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Helper: Generate Price History
     * (Ported from MarketData.tsx)
     */
    private generatePriceHistory(startPrice: number, change: number, days: number): any[] {
        const history: any[] = [];
        const endPrice = startPrice;
        const start = startPrice * (1 - change / 100 * 1.5);
        const volatility = startPrice * 0.02;

        for (let i = 0; i < days; i++) {
            const progress = i / (days - 1);
            const trend = start + (endPrice - start) * progress;

            // Add some realistic market patterns
            const weeklyPattern = Math.sin(i / 7) * volatility * 0.5;
            const monthlyPattern = Math.sin(i / 30) * volatility * 0.3;
            const noise = (Math.random() - 0.5) * volatility;

            const close = Math.max(0.01, trend + noise + weeklyPattern + monthlyPattern);
            const open = close + (Math.random() - 0.5) * volatility * 0.5;
            const high = Math.max(open, close) + Math.random() * volatility * 0.3;
            const low = Math.min(open, close) - Math.random() * volatility * 0.3;

            const baseVolume = 500 + Math.random() * 2000;
            const volumeSpike = Math.random() > 0.9 ? Math.random() * 3000 : 0;
            const vol = Math.round(baseVolume + volumeSpike);

            history.push({
                time: Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000,
                open: +open.toFixed(2),
                high: +high.toFixed(2),
                low: +low.toFixed(2),
                close: +close.toFixed(2),
                volume: vol
            });
        }
        return history;
    }

    public async deleteStrategyHubEngine() {
        const lists = [
            'Strategy_Config', 'Strategic_Pillars', 'Strategic_Objectives',
            'Unit_Objectives', 'Divisional_Alignment', 'Strategy_Milestones', 'Strategy_Risks'
        ];

        let results = [];
        for (const listName of lists) {
            try {
                const list = await this.client.api(`/sites/${this.siteId}/lists`).filter(`displayName eq '${listName}'`).get();
                if (list.value && list.value.length > 0) {
                    await this.client.api(`/sites/${this.siteId}/lists/${list.value[0].id}`).delete();
                    results.push(`Deleted ${listName}`);
                }
            } catch (e) {
                console.warn(`Could not delete ${listName}`, e);
            }
        }
        return { success: true, details: results };
    }

    /**
     * Create EVERYTHING for the Strategy Hub (Design Schema)
     * One-click creation and seeding from Strategy Hub Mock Data
     */
    async setupStrategyHubEngine(): Promise<{ success: boolean; message: string; details: any }> {
        console.log('🚀 [StrategyHub] Starting Engine Setup (Full Reset)...');
        const results: any = {};

        try {
            // Optional: Delete existing lists for a clean setup
            await this.deleteStrategyHubEngine();

            // 1. Config
            console.log('📝 [StrategyHub] 1/7 Strategy_Config...');
            const configList = await this.createStrategyConfigList();
            await this.seedStrategyHubConfig(configList.id);
            results.config = 'Created & Seeded';

            // 2. Pillars
            console.log('📝 [StrategyHub] 2/7 Strategic_Pillars...');
            const pillarsList = await this.createStrategicPillarsList();
            await this.seedStrategyHubPillars(pillarsList.id);
            results.pillars = 'Created & Seeded';

            // 3. Objectives (Dependent on Pillars)
            console.log('📝 [StrategyHub] 3/7 Strategic_Objectives...');
            const objList = await this.createStrategicObjectivesList(pillarsList.id);
            const objMap = await this.seedStrategyHubObjectives(objList.id);
            results.objectives = 'Created & Seeded';

            // 4. Unit Objectives (Dependent on Strategic Objectives)
            console.log('📝 [StrategyHub] 4/7 Unit_Objectives...');
            const unitObjList = await this.createUnitObjectivesList(objList.id);
            await this.seedStrategyHubUnitObjectives(unitObjList.id);
            results.unitObjectives = 'Created & Seeded';

            // 5. Alignment (Dependent on Objectives)
            console.log('📝 [StrategyHub] 5/7 Divisional_Alignment...');
            const alignList = await this.createDivisionalAlignmentList(objList.id);
            await this.seedStrategyHubAlignment(alignList.id, objMap);
            results.alignment = 'Created & Seeded';

            // 6. Milestones
            console.log('📝 [StrategyHub] 6/7 Strategy_Milestones...');
            const mileList = await this.createStrategyMilestonesList();
            await this.seedStrategyHubMilestones(mileList.id);
            results.milestones = 'Created & Seeded';

            // 7. Risks
            console.log('📝 [StrategyHub] 7/7 Strategy_Risks...');
            const riskList = await this.createStrategyRisksList();
            await this.seedStrategyHubRisks(riskList.id);
            results.risks = 'Created & Seeded';

            return {
                success: true,
                message: 'Enterprise Strategy Hub Engine deployed successfully!',
                details: results
            };

        } catch (error: any) {
            console.error('❌ [StrategyHub] Setup failed:', error);
            return { success: false, message: error.message, details: error };
        }
    }

    /**
     * Setup ONLY Strategic Objectives (Standalone)
     */
    async setupStrategicObjectivesStandalone(): Promise<{ success: boolean; message: string; details: any }> {
        console.log('🚀 [StrategyHub] Setting up Strategic Objectives only...');
        try {
            // we need pillars list ID for the lookup
            let pillarsListId = '';
            const pillarsCheck = await this.client.api(`/sites/${this.siteId}/lists`).filter("displayName eq 'Strategic_Pillars'").get();

            if (pillarsCheck.value && pillarsCheck.value.length > 0) {
                pillarsListId = pillarsCheck.value[0].id;
            } else {
                console.warn('⚠️ Strategic_Pillars list not found. Creating lookup will fail or we must create it.');
                // Option: Create pillars list if missing, or just proceed without lookup? 
                // The createStrategicObjectivesList method REQUIRES pillarsListId for the lookup column.
                // Let's create it if missing to be safe, or error.
                // For a "separate function", it implies independence, but the schema has dependencies.
                // I will try to create the Pillars list structure (empty) just to satisfy the lookup if needed, 
                // OR just pass a dummy ID which might fail the lookup creation but succeed the list creation.
                // Better approach: Warn user.
                // But to fulfill "create me one function", I'll try to find it.
                // If not found, I will create the Pillars list first (schema only).
                console.log('⚠️ Pillars list missing, creating it for dependency...');
                const pList = await this.createStrategicPillarsList();
                pillarsListId = pList.id;
            }

            const list = await this.createStrategicObjectivesList(pillarsListId);
            await this.seedStrategyHubObjectives(list.id);

            return {
                success: true,
                message: 'Strategic Objectives list created and seeded!',
                details: list
            };
        } catch (error: any) {
            return { success: false, message: error.message, details: error };
        }
    }

    private async seedStrategyHubConfig(listId: string) {
        const { organization } = mockStrategyData;
        const items = [
            { fields: { Title: 'Mission', Value: organization.mission } },
            { fields: { Title: 'Vision', Value: organization.vision } },
            { fields: { Title: 'ExecutiveSummary', Value: organization.executiveSummary || '' } }
        ];

        // Also add values if needed, though they are usually in a separate structure or JSON
        // For compliance with previous structure, we might want to add Values as a single JSON item if that's how it was consumed
        if (organization.values) {
            items.push({ fields: { Title: 'Values', Value: JSON.stringify(organization.values) } });
        }

        for (const item of items) {
            await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).post(item);
        }
    }

    private async seedStrategyHubPillars(listId: string) {
        const pillars = mockStrategyData.pillars.map(p => ({
            fields: {
                Title: p.title,
                Description: p.description,
                IconName: p.icon,
                SortOrder: p.sortOrder,
                Progress: p.progress,
                Status: p.status
            }
        }));

        for (const p of pillars) await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).post(p);
    }


    private async seedStrategyHubObjectives(listId: string) {
        const objectives = mockStrategyData.objectives || [];
        const map: Record<string, string> = {};

        for (const obj of objectives) {
            const item = {
                fields: {
                    Title: obj.title,
                    Description: obj.description,
                    Progress: obj.progress,
                    Icon: obj.icon,
                    Status: obj.status === 'at-risk' ? 'Needs Attention' : 'On Track', // Map 'at-risk' simply if needed, or keep 1:1 if list choices match
                    Deliverables: obj.deliverables ? obj.deliverables.join(', ') : '',
                    IsFeatured: obj.isFeatured || false
                }
            };
            const created = await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).post(item);
            map[obj.title] = created.id;
        }
        return map;
    }

    private async seedStrategyHubUnitObjectives(listId: string) {
        const objectives = mockStrategyData.unitObjectives || [];

        for (const obj of objectives) {
            // Infer Division/Unit for better testing visibility
            let division = 'General';
            let unit = 'General';

            if (obj.owner?.includes('IT')) { division = 'IT Division'; unit = 'IT Unit'; }
            else if (obj.owner?.includes('HR')) { division = 'HR Division'; unit = 'Recruitment'; }
            else if (obj.owner?.includes('Audit')) { division = 'Executive Division'; unit = 'Internal Audit'; }
            else if (obj.owner?.includes('Licensing')) { division = 'Operations Division'; unit = 'Licensing'; }

            const item = {
                fields: {
                    Title: obj.title,
                    Description: obj.description,
                    GoalType: 'Unit',
                    Division: division,
                    Unit: unit,
                    Year: '2025',
                    StartDate: new Date('2025-01-01').toISOString(),
                    EndDate: new Date('2025-12-31').toISOString(),
                    Progress: obj.progress,
                    Icon: obj.icon,
                    Status: obj.status === 'at-risk' ? 'Needs Attention' : (obj.status === 'on-track' ? 'On Track' : 'Not Started'),
                    Owner: obj.owner || 'Unit Lead',
                    Deliverables: obj.deliverables ? obj.deliverables.join(', ') : ''
                }
            };
            await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).post(item);
        }
    }

    private async createDivisionalAlignmentList(objectiveListId: string) {
        const check = await this.client.api(`/sites/${this.siteId}/lists`).filter("displayName eq 'Divisional_Alignment'").get();
        if (check.value && check.value.length > 0) return check.value[0];

        const list = await this.client.api(`/sites/${this.siteId}/lists`).post({
            displayName: 'Divisional_Alignment',
            columns: [
                { name: 'Director', text: {} },
                { name: 'KRAs', text: { allowMultipleLines: true } },
                { name: 'Icon', text: {} },
                { name: 'ContributionWeight', number: { decimalPlaces: 'none' } }
            ],
            list: { template: 'genericList' }
        });

        await this.addLookupColumn(list.id, 'AlignedObjective', objectiveListId, 'Title');
        return list;
    }

    private async seedStrategyHubAlignment(listId: string, objectiveMap: Record<string, string>) {
        const alignments = mockStrategyData.alignments || [];
        for (const align of alignments) {
            // Find objective ID from the map using the title or ID if available. 
            // The map uses Title as key from the previous step.
            const objId = objectiveMap[align.alignedObjectiveTitle || ''] || objectiveMap[align.alignedObjectiveId] || null;

            const item = {
                fields: {
                    Title: align.name,
                    Director: align.director,
                    Icon: align.icon,
                    ContributionWeight: align.contributionWeight,
                    KRAs: align.kras ? align.kras.join(', ') : '',
                    AlignedObjectiveLookupId: objId ? parseInt(objId) : undefined
                }
            };
            await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).post(item);
        }
    }

    private async createStrategyMilestonesList() {
        const check = await this.client.api(`/sites/${this.siteId}/lists`).filter("displayName eq 'Strategy_Milestones'").get();
        if (check.value && check.value.length > 0) return check.value[0];

        return await this.client.api(`/sites/${this.siteId}/lists`).post({
            displayName: 'Strategy_Milestones',
            columns: [
                { name: 'MilestoneDate', dateTime: { format: 'dateOnly' } },
                { name: 'Status', choice: { choices: ['Upcoming', 'Planning', 'On-Track', 'Critical'] } },
                { name: 'Context', text: {} },
                { name: 'ColorHex', text: {} }
            ],
            list: { template: 'genericList' }
        });
    }

    private async seedStrategyHubMilestones(listId: string) {
        const milestones = mockStrategyData.milestones || [];
        for (const m of milestones) {
            const item = {
                fields: {
                    Title: m.title,
                    Context: m.context,
                    MilestoneDate: m.date,
                    Status: m.status,
                    ColorHex: m.color
                }
            };
            await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).post(item);
        }
    }

    private async createStrategyRisksList() {
        const check = await this.client.api(`/sites/${this.siteId}/lists`).filter("displayName eq 'Strategy_Risks'").get();
        if (check.value && check.value.length > 0) return check.value[0];

        return await this.client.api(`/sites/${this.siteId}/lists`).post({
            displayName: 'Strategy_Risks',
            columns: [
                { name: 'ImpactLevel', choice: { choices: ['Low', 'Medium', 'High', 'Critical'] } },
                { name: 'Context', text: { allowMultipleLines: true } }
            ],
            list: { template: 'genericList' }
        });
    }

    private async seedStrategyHubRisks(listId: string) {
        const risks = mockStrategyData.risks || [];
        for (const r of risks) {
            const item = {
                fields: {
                    Title: r.title,
                    ImpactLevel: r.impact, // Ensure casing matches choices (Low, Medium, High, Critical)
                    Context: r.context
                }
            };
            await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).post(item);
        }
    }






    // ==========================================
    // MOCK DATA UPLOAD METHODS
    // ==========================================

    /**
     * Get Map of User Email -> SharePoint ID
     */
    async getSiteUserMap(): Promise<Record<string, number>> {
        console.log('   Fetching Site Users map...');
        const map: Record<string, number> = {};
        try {
            const users = await this.client.api(`/sites/${this.siteId}/lists/User Information List/items`)
                .select('id,fields')
                .expand('fields($select=EMail,Title,Name,WorkEmail)')
                .top(999)
                .get();

            users.value.forEach((u: any) => {
                const email = u.fields.EMail || u.fields.WorkEmail;
                if (email) map[email.toLowerCase()] = u.id;
            });
            console.log(`   Mapped ${Object.keys(map).length} users`);
        } catch (e) {
            console.warn('Failed to fetch user map via List, trying siteUsers...', e);
            try {
                const users = await this.client.api(`/sites/${this.siteId}/users`).top(999).get();
                users.value.forEach((u: any) => {
                    if (u.mail) map[u.mail.toLowerCase()] = u.id;
                    else if (u.userPrincipalName) map[u.userPrincipalName.toLowerCase()] = u.id;
                });
            } catch (e2) { console.error('Failed to fetch site users', e2); }
        }
        return map;
    }

    /**
     * Helper: Ensure column exists, create if missing
     */
    private async ensureColumn(listId: string, columnName: string, columnDef: any): Promise<boolean> {
        try {
            console.log(`   🔎 Checking for column '${columnName}'...`);
            // Check by internal name or displayName
            const columns = await this.client.api(`/sites/${this.siteId}/lists/${listId}/columns`)
                .select('name,displayName')
                .get();

            const exists = columns.value.find((c: any) => c.name === columnName || c.displayName === columnName);

            if (exists) {
                console.log(`   ✓ Column '${columnName}' exists (Internal: ${exists.name}).`);
                return true;
            }

            console.log(`   ⚠️ Column '${columnName}' not found. Creating...`);
            const payload = {
                name: columnName,
                displayName: columnName,
                ...columnDef
            };
            console.log('   📦 Creating column with payload:', JSON.stringify(payload));
            await this.client.api(`/sites/${this.siteId}/lists/${listId}/columns`).post(payload);
            console.log(`   ✅ Created column '${columnName}'`);
            return true;
        } catch (e: any) {
            console.error(`   ❌ Failed to ensure column '${columnName}':`, e.message);
            return false;
        }
    }

    /**
     * Helper: Resolve Field Internal Name
     * Tries to find the correct internal name for a column by display name
     */
    private async resolveFieldName(listId: string, possibleDisplayNames: string[]): Promise<string | null> {
        try {
            console.log(`   🔎 Resolving field name for [${possibleDisplayNames.join(', ')}]...`);
            const columns = await this.client.api(`/sites/${this.siteId}/lists/${listId}/columns`).select('name,displayName').get();

            const match = columns.value.find((c: any) => possibleDisplayNames.includes(c.displayName));
            if (match) {
                console.log(`   ✓ Found column: '${match.displayName}' -> Internal: '${match.name}'`);
                return match.name;
            }

            console.warn(`   ⚠️ Could not find column matching [${possibleDisplayNames.join(', ')}]. Using default.`);
            return null;
        } catch (e) {
            console.error('   ❌ Error resolving field name', e);
            return null;
        }
    }

    /**
     * Upload Mock KRAs
     */
    async uploadMockKRAs(kras: Kra[], userMap?: Record<string, number>): Promise<{ success: boolean, message: string }> {
        console.log(`🚀 [Setup] Uploading ${kras.length} Mock KRAs...`);
        try {
            if (!userMap) userMap = await this.getSiteUserMap();

            const lists = await this.client.api(`/sites/${this.siteId}/lists`).select('id,displayName').get();
            const list = lists.value.find((l: any) => l.displayName === 'Performance_KRAs');
            if (!list) throw new Error('Performance_KRAs list not found');

            // 1. Ensure Critical Columns Exist (Auto-Repair Schema)
            await this.ensureColumn(list.id, 'IsMockData', { name: 'IsMockData', boolean: {} });
            await this.ensureColumn(list.id, 'Responsible', { name: 'Responsible', personOrGroup: {} });

            // Resolve internal name for "Strategy Goal"
            const strategyGoalInternal = await this.resolveFieldName(list.id, ['StrategyGoal', 'Strategy Goal', 'Strategic Objective', 'Strategic Alignment']);
            // Use 'LookupId' suffix as recommended for Lookup columns
            const effectiveStrategyGoalKey = strategyGoalInternal ? `${strategyGoalInternal}LookupId` : 'StrategyGoalLookupId';

            // Resolve internal name for "Responsible"
            const responsibleInternal = await this.resolveFieldName(list.id, ['Responsible', 'Owner', 'Person']);
            const effectiveResponsibleKey = responsibleInternal ? `${responsibleInternal}LookupId` : 'ResponsibleLookupId';

            // Also resolve IsMockData just in case we need it later or for consistency
            // (Not used in KRA upload payload but used in filters later)

            const batchSize = 50;
            for (let i = 0; i < kras.length; i += batchSize) {
                const batch = kras.slice(i, i + batchSize);
                console.log(`   Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(kras.length / batchSize)}...`);

                await Promise.all(batch.map(async kra => {
                    const payload = mapKraToSharePoint(kra, userMap!);

                    // DYNAMIC FIX: Field Name Adjustment
                    if (effectiveStrategyGoalKey !== 'StrategyGoalId') {
                        payload.fields[effectiveStrategyGoalKey] = payload.fields.StrategyGoalId;
                        delete payload.fields.StrategyGoalId;
                    }

                    // DYNAMIC FIX: Responsible Field
                    if (effectiveResponsibleKey !== 'ResponsibleId') {
                        payload.fields[effectiveResponsibleKey] = payload.fields.ResponsibleId;
                        delete payload.fields.ResponsibleId;
                    }

                    try {
                        console.log(`🔍 [Debug] POSTing KRA to: /sites/${this.siteId}/lists/${list.id}/items`);
                        const res = await this.client.api(`/sites/${this.siteId}/lists/${list.id}/items`).post(payload);
                        console.log(`✅ [Debug] Created KRA ID: ${res.id}`);
                    } catch (err: any) {
                        console.error(`Failed to upload KRA ${kra.title}`, err.message);
                    }
                }));
            }
            return { success: true, message: `Successfully uploaded ${kras.length} KRAs` };
        } catch (error: any) {
            console.error('Failed to upload KRAs', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Upload Mock KPIs
     */
    /**
     * Upload Mock KPIs
     */
    async uploadMockKPIs(kpis: Kpi[], userMap?: Record<string, number>): Promise<{ success: boolean, message: string }> {
        console.log(`🚀 [Setup] Uploading ${kpis.length} Mock KPIs...`);
        try {
            if (!userMap) userMap = await this.getSiteUserMap();

            const lists = await this.client.api(`/sites/${this.siteId}/lists`).select('id,displayName').get();
            const kpiList = lists.value.find((l: any) => l.displayName === 'Performance_KPIs');
            const kraList = lists.value.find((l: any) => l.displayName === 'Performance_KRAs');
            if (!kpiList || !kraList) throw new Error('Lists not found');

            // 1. Ensure Critical Columns Exist
            await this.ensureColumn(kpiList.id, 'IsMockData', { name: 'IsMockData', boolean: {} });

            // Resolve proper field name for "Related KRA"
            // Resolve proper field name for "Related KRA"
            const relatedKraInternal = await this.resolveFieldName(kpiList.id, ['RelatedKRA', 'Related KRA', 'RelatedKra', 'KRA']);
            const effectiveRelatedKraKey = relatedKraInternal ? `${relatedKraInternal}LookupId` : 'RelatedKRALookupId'; // Use LookupId suffix

            // Resolve IsMockData for filtering
            const isMockDataInternal = await this.resolveFieldName(kraList.id, ['IsMockData', 'Is Mock Data', 'IsMock']);
            console.log(`[DEBUG] KRAs List ID: ${kraList.id}`);
            console.log(`[DEBUG] Resolved internal name for IsMockData: ${isMockDataInternal}`);

            let uploadedKRAs;
            try {
                // Fetch recent KRAs (sort by Created desc to ensure we get the ones just added, even if not fully indexed for filtering)
                // We fetch a large batch to be safe.
                console.log('[DEBUG] Fetching recent KRAs (Order by Created desc) to avoid indexing latency...');
                uploadedKRAs = await this.client.api(`/sites/${this.siteId}/lists/${kraList.id}/items`)
                    .expand('fields')
                    .orderby('createdDateTime desc')
                    .top(500) // Fetch top 500 recent items
                    .get();

                console.log(`[DEBUG] Fetched ${uploadedKRAs.value.length} recent KRAs.`);

            } catch (error) {
                console.error('[DEBUG] Error fetching KRAs:', error);
                throw error;
            }

            // Create Lookup Map (Mock ID -> SharePoint ID)
            const kraLookup: Record<string, string> = {};
            let matchedCount = 0;

            if (uploadedKRAs && uploadedKRAs.value) {
                for (const item of uploadedKRAs.value) {
                    // We can also double check IsMockData here in memory if needed, but the Regex is the primary linker
                    const sourceText = item.fields.Description || item.fields.Results || item.fields.Title || '';
                    const match = sourceText.match(/\(ID:(MOCK_KRA_\d+)\)/);
                    if (match && match[1]) {
                        kraLookup[match[1]] = item.id;
                        matchedCount++;
                    }
                }
            }
            console.log(`[DEBUG] Successfully mapped ${matchedCount} KRAs for linking out of ${uploadedKRAs?.value?.length || 0} fetched.`);

            // 3. Batch Create KPIs
            console.log(`Processing batch 1/${Math.ceil(kpis.length / 50)}...`);

            // Chunk for batching
            for (let i = 0; i < kpis.length; i += 50) {
                const batch = kpis.slice(i, i + 50);
                console.log(`   Processing batch ${Math.floor(i / 50) + 1}/${Math.ceil(kpis.length / 50)}...`);
                const batchPromises = batch.map(async (kpi) => {
                    // Resolve KRA Lookup
                    // kpi.kra_id holds the mock ID (e.g. MOCK_KRA_1)
                    const mockKraId = kpi.kra_id as string;
                    const kraId = kraLookup[mockKraId || ''];

                    if (!kraId) {
                        console.warn(`[DEBUG] Skipping KPI '${kpi.name}': Related KRA (Mock ID: ${mockKraId}) not found in fetched KRAs.`);
                        return null; // Skip if we can't link
                    }

                    // mapKpiToSharePoint expects 2 args
                    const mappedKPI = mapKpiToSharePoint(kpi, {});

                    // Remove potential conflicting hardcoded key from mapper
                    if ('RelatedKRAId' in mappedKPI.fields) {
                        delete mappedKPI.fields.RelatedKRAId;
                    }

                    // We must use the mappedKPI but override/ensure related field is correct
                    const fields = {
                        ...mappedKPI.fields,
                        [effectiveRelatedKraKey]: parseInt(kraId)
                    };

                    try {
                        console.log(`🔍 [Debug] POSTing KPI to: /sites/${this.siteId}/lists/${kpiList.id}/items`);
                        const res = await this.client.api(`/sites/${this.siteId}/lists/${kpiList.id}/items`).post({
                            fields: fields
                        });
                        console.log(`✅ [Debug] Created KPI ID: ${res.id}`);
                        return res;
                    } catch (err: any) {
                        console.error(`Failed to upload KPI ${kpi.name}`, err.message);
                    }
                });

                // Filter out nulls (skipped items)
                const validPromises = batchPromises.filter(p => p !== null);

                if (validPromises.length === 0) {
                    console.log('[DEBUG] No valid KPIs to upload in this batch (all missing KRA links).');
                    continue;
                }

                await Promise.all(validPromises);
            }
            return { success: true, message: `Successfully uploaded ${kpis.length} KPIs` };
        } catch (error: any) {
            console.error('Failed to upload KPIs', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Upload Mock Tasks
     */
    /**
     * Upload Mock Tasks
     */
    async uploadMockTasks(tasks: Task[], userMap?: Record<string, number>): Promise<{ success: boolean, message: string }> {
        console.log(`🚀 [Setup] Uploading ${tasks.length} Mock Tasks...`);
        try {
            if (!userMap) userMap = await this.getSiteUserMap();

            const lists = await this.client.api(`/sites/${this.siteId}/lists`).select('id,displayName').get();
            const targetTaskList = lists.value.find((l: any) => l.displayName === 'Operations_Tasks'); // Enforce Operations_Tasks
            const kpiList = lists.value.find((l: any) => l.displayName === 'Performance_KPIs');
            const projectList = lists.value.find((l: any) => l.displayName === 'Operations_Projects');
            const kraList = lists.value.find((l: any) => l.displayName === 'Performance_KRAs');

            if (!targetTaskList) throw new Error('Operations_Tasks list not found. Please create operations lists first.');
            if (!kpiList) throw new Error('Performance_KPIs list not found.');

            // 1. Ensure Critical Columns Exist
            await this.ensureColumn(targetTaskList.id, 'IsMockData', { name: 'IsMockData', boolean: {} });
            await this.ensureColumn(targetTaskList.id, 'StartDate', { name: 'StartDate', dateTime: {} });
            await this.ensureColumn(targetTaskList.id, 'Department', { name: 'Department', text: {} });
            await this.ensureColumn(targetTaskList.id, 'Priority', { name: 'Priority', choice: { choices: ['Low', 'Medium', 'High', 'Urgent'] } });
            await this.ensureColumn(targetTaskList.id, 'Status', { name: 'Status', choice: { choices: ['Todo', 'In Progress', 'Review', 'Done'] } });

            // 2. Ensure Lookup Columns Exist

            // RelatedKPI
            let relatedKpiInternal = await this.resolveFieldName(targetTaskList.id, ['RelatedKPI', 'Related KPI', 'RelatedKpi', 'KPI']);
            if (!relatedKpiInternal) {
                console.log('   ⚠️ RelatedKPI column missing. Creating lookup...');
                await this.addLookupColumn(targetTaskList.id, 'RelatedKPI', kpiList.id, 'Title');
                relatedKpiInternal = 'RelatedKPI';
            }
            const effectiveRelatedKpiKey = `${relatedKpiInternal}LookupId`;

            // AssignedTo
            let assignedToInternal = await this.resolveFieldName(targetTaskList.id, ['AssignedTo', 'Assigned To', 'Assignee']);
            if (!assignedToInternal) {
                console.log('   ⚠️ AssignedTo column missing. Creating lookup...');
                // Re-creating as personOrGroup
                await this.ensureColumn(targetTaskList.id, 'AssignedTo', { name: 'AssignedTo', personOrGroup: {} });
                assignedToInternal = 'AssignedTo';
            }
            const effectiveAssignedToKey = `${assignedToInternal}LookupId`;

            // RelatedKRA (Optional but helpful)
            let relatedKraInternal = await this.resolveFieldName(targetTaskList.id, ['RelatedKRA', 'Related KRA']);
            if (!relatedKraInternal && kraList) {
                console.log('   Note: RelatedKRA missing on Tasks. Adding...');
                await this.addLookupColumn(targetTaskList.id, 'RelatedKRA', kraList.id, 'Title');
            }

            // RelatedProject (Optional)
            let relatedProjectInternal = await this.resolveFieldName(targetTaskList.id, ['RelatedProject']);
            if (!relatedProjectInternal && projectList) {
                console.log('   Note: RelatedProject missing on Tasks. Adding...');
                await this.addLookupColumn(targetTaskList.id, 'RelatedProject', projectList.id, 'Title');
            }

            console.log('   Fetching recent KPIs (Order by Created desc) to avoid indexing latency...');
            const uploadedKPIs = await this.client.api(`/sites/${this.siteId}/lists/${kpiList.id}/items`)
                .expand('fields')
                .orderby('createdDateTime desc')
                .top(500)
                .get();

            const kpiLookup: Record<string, number> = {};
            uploadedKPIs.value.forEach((item: any) => {
                const desc = item.fields.Description || '';
                const match = desc.match(/\(ID:(MOCK_KPI_\d+)\)/);
                if (match && match[1]) {
                    kpiLookup[match[1]] = item.id;
                }
            });
            console.log(`   Mapped ${Object.keys(kpiLookup).length} KPIs for linking`);

            const batchSize = 50;
            for (let i = 0; i < tasks.length; i += batchSize) {
                const batch = tasks.slice(i, i + batchSize);
                console.log(`   Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tasks.length / batchSize)}...`);
                await Promise.all(batch.map(async task => {
                    const payload = mapTaskToSharePoint(task, kpiLookup, userMap!);

                    // DYNAMIC FIX: If resolved name differs from default 'RelatedKPIId'
                    if (effectiveRelatedKpiKey !== 'RelatedKPIId') {
                        payload.fields[effectiveRelatedKpiKey] = payload.fields.RelatedKPIId;
                        delete payload.fields.RelatedKPIId;
                    }

                    // DYNAMIC FIX: Assigned To Field
                    if (effectiveAssignedToKey !== 'AssignedToId') {
                        payload.fields[effectiveAssignedToKey] = payload.fields.AssignedToId;
                        delete payload.fields.AssignedToId;
                    }

                    try {
                        // console.log(`🔍 [Debug] POSTing Task to: /sites/${this.siteId}/lists/${targetTaskList.id}/items`);
                        const res = await this.client.api(`/sites/${this.siteId}/lists/${targetTaskList.id}/items`).post(payload);
                        // console.log(`✅ [Debug] Created Task ID: ${res.id}`);
                    } catch (err: any) {
                        console.error(`Failed to upload Task ${task.title}`, err.message);
                    }
                }));
            }
            return { success: true, message: `Successfully uploaded ${tasks.length} Tasks` };
        } catch (error: any) {
            console.error('Failed to upload Tasks', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Clear Mock Data
     */
    async clearMockPerformanceData(): Promise<{ success: boolean, message: string }> {
        console.log('🗑️ [Setup] Clearing Mock Data...');
        try {
            const listNames = ['Performance_KRAs', 'Performance_KPIs', 'Unit_Tasks', 'Operations_Tasks'];
            let count = 0;

            const lists = await this.client.api(`/sites/${this.siteId}/lists`).select('id,displayName').get();

            for (const name of listNames) {
                const list = lists.value.find((l: any) => l.displayName === name);
                if (!list) continue;

                const items = await this.client.api(`/sites/${this.siteId}/lists/${list.id}/items`)
                    .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
                    .filter("fields/IsMockData eq true")
                    .select('id')
                    .top(999)
                    .get();

                if (items.value && items.value.length > 0) {
                    console.log(`   Found ${items.value.length} mock items in ${name}, deleting...`);
                    const chunk = async (arr: any[], size: number) => {
                        for (let i = 0; i < arr.length; i += size) {
                            await Promise.all(arr.slice(i, i + size).map(item =>
                                this.client.api(`/sites/${this.siteId}/lists/${list.id}/items/${item.id}`).delete()
                                    .catch(e => console.warn(`Failed delete ${item.id}`, e.message))
                            ));
                        }
                    };
                    await chunk(items.value, 10);
                    count += items.value.length;
                }
            }
            return { success: true, message: `Cleared ${count} mock items` };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Seed operational data for all 30 SCPNG officers
     * Creates 2 KRAs + 4 KPIs + 20 tasks per officer (1,560 items total)
     * Uses direct SP ID tracking — no description embedding required
     */
    async seedOfficerOperationalData(): Promise<{ success: boolean; message: string }> {
        console.log('[Seeding] Starting officer operational data seeding...');
        try {
            // 1. Fetch user map (email → SP user ID)
            const userMap = await this.getSiteUserMap();

            // 2. Fetch strategic objectives for KRA linkage
            let objectives: Array<{ id: string | number; title: string }> = [];
            try {
                const objListRes = await this.client.api(`/sites/${this.siteId}/lists`)
                    .filter("displayName eq 'Strategy_Objectives'").select('id').get();
                if (objListRes.value && objListRes.value.length > 0) {
                    const objItems = await this.client.api(`/sites/${this.siteId}/lists/${objListRes.value[0].id}/items`)
                        .expand('fields').select('id,fields/Title').top(50).get();
                    objectives = (objItems.value || []).map((item: any) => ({
                        id: item.id,
                        title: item.fields?.Title || ''
                    }));
                    console.log(`[Seeding] Found ${objectives.length} strategic objectives.`);
                }
            } catch {
                console.warn('[Seeding] Could not fetch objectives — KRAs will seed without objective links.');
            }

            // 3. Generate all officer data
            const { kras, kpis, tasks } = generateAllOfficerData(SCPNG_STAFF_DATA, objectives);
            console.log(`[Seeding] Generated: ${kras.length} KRAs, ${kpis.length} KPIs, ${tasks.length} tasks`);

            // 4. Locate target lists
            const lists = await this.client.api(`/sites/${this.siteId}/lists`).select('id,displayName').get();
            const kraList = lists.value.find((l: any) => l.displayName === 'Performance_KRAs');
            const kpiList = lists.value.find((l: any) => l.displayName === 'Performance_KPIs');
            const taskList = lists.value.find((l: any) => l.displayName === 'Operations_Tasks');

            if (!kraList || !kpiList || !taskList) {
                return { success: false, message: 'Required lists not found. Run list setup first.' };
            }

            // 5. Upload KRAs in batches of 5, capture SharePoint item IDs
            const kraSpIdMap: Record<string, number> = {};
            let kraSuccess = 0;
            const kraBatch = 5;
            for (let i = 0; i < kras.length; i += kraBatch) {
                const batch = kras.slice(i, i + kraBatch);
                await Promise.all(batch.map(async (kra) => {
                    try {
                        const payload = mapKraToSharePoint(kra, userMap);
                        const res = await this.client.api(`/sites/${this.siteId}/lists/${kraList.id}/items`).post(payload);
                        kraSpIdMap[kra.id as string] = parseInt(res.id);
                        kraSuccess++;
                    } catch (err: any) {
                        console.warn(`[Seeding] KRA upload failed: ${kra.title}`, err.message);
                    }
                }));
            }
            console.log(`[Seeding] KRAs created: ${kraSuccess}/${kras.length}`);

            // 6. Resolve KPI list's RelatedKRA lookup field name
            const relatedKraInternal = await this.resolveFieldName(kpiList.id, ['RelatedKRA', 'Related KRA', 'RelatedKra', 'KRA']);
            const relatedKraFieldKey = relatedKraInternal ? `${relatedKraInternal}LookupId` : 'RelatedKRALookupId';

            // 7. Upload KPIs in batches of 5, linking to SP KRA IDs
            const kpiSpIdMap: Record<string, number> = {};
            let kpiSuccess = 0;
            const kpiBatch = 5;
            for (let i = 0; i < kpis.length; i += kpiBatch) {
                const batch = kpis.slice(i, i + kpiBatch);
                await Promise.all(batch.map(async (kpi) => {
                    const kraSpId = kraSpIdMap[kpi.kra_id as string];
                    if (!kraSpId) {
                        console.warn(`[Seeding] KPI skipped — no parent KRA SP ID: ${kpi.name}`);
                        return;
                    }
                    try {
                        const payload = mapKpiToSharePoint(kpi, {});
                        delete payload.fields.RelatedKRAId;
                        payload.fields[relatedKraFieldKey] = kraSpId;
                        const res = await this.client.api(`/sites/${this.siteId}/lists/${kpiList.id}/items`).post(payload);
                        kpiSpIdMap[kpi.id as string] = parseInt(res.id);
                        kpiSuccess++;
                    } catch (err: any) {
                        console.warn(`[Seeding] KPI upload failed: ${kpi.name}`, err.message);
                    }
                }));
            }
            console.log(`[Seeding] KPIs created: ${kpiSuccess}/${kpis.length}`);

            // 8. Resolve task list's RelatedKPI lookup field name
            const relatedKpiInternal = await this.resolveFieldName(taskList.id, ['RelatedKPI', 'Related KPI', 'RelatedKpi', 'KPI']);
            const relatedKpiFieldKey = relatedKpiInternal ? `${relatedKpiInternal}LookupId` : 'RelatedKPILookupId';

            // 9. Upload tasks in batches of 10
            let taskSuccess = 0;
            const taskBatch = 10;
            for (let i = 0; i < tasks.length; i += taskBatch) {
                const batch = tasks.slice(i, i + taskBatch);
                await Promise.all(batch.map(async (task) => {
                    try {
                        const payload = mapTaskToSharePoint(task, {}, userMap);
                        delete payload.fields.RelatedKPIId;
                        const kpiSpId = kpiSpIdMap[task.kpi_id as string];
                        if (kpiSpId) payload.fields[relatedKpiFieldKey] = kpiSpId;
                        await this.client.api(`/sites/${this.siteId}/lists/${taskList.id}/items`).post(payload);
                        taskSuccess++;
                    } catch (err: any) {
                        console.warn(`[Seeding] Task upload failed: ${task.title}`, err.message);
                    }
                }));
            }
            console.log(`[Seeding] Tasks created: ${taskSuccess}/${tasks.length}`);

            return {
                success: true,
                message: `Officer data seeded: ${kraSuccess} KRAs, ${kpiSuccess} KPIs, ${taskSuccess} tasks (${SCPNG_STAFF_DATA.length} staff members).`
            };
        } catch (error: any) {
            console.error('[Seeding] seedOfficerOperationalData failed', error);
            return { success: false, message: error.message };
        }
    }

    async seedProjectsData(): Promise<{ success: boolean; message: string }> {
        try {
            console.log('🌱 [Seeding] Starting Projects seeding...');
            const listCheck = await this.client.api(`/sites/${this.siteId}/lists`).filter("displayName eq 'Operations_Projects'").select('id').get();
            if (!listCheck.value || listCheck.value.length === 0) {
                return { success: false, message: 'Operations_Projects list not found' };
            }
            const listId = listCheck.value[0].id;

            let count = 0;
            for (const project of mockProjects) {
                const payload = {
                    fields: {
                        Title: project.name,
                        Description: project.description,
                        Status: project.status === 'in-progress' ? 'In Progress' :
                            project.status === 'completed' ? 'Completed' :
                                project.status === 'on-hold' ? 'On Hold' : 'Planned',
                        StartDate: project.startDate ? new Date(project.startDate).toISOString() : null,
                        EndDate: project.endDate ? new Date(project.endDate).toISOString() : null,
                        Budget: project.budget,
                        BudgetSpent: project.budgetSpent,
                        Progress: project.progress,
                        Manager: project.manager || 'Unassigned', // Text field now
                        Assignees: project.assignees ? JSON.stringify(project.assignees) : '[]',
                        Department: project.unit_id || 'General',
                        RisksJSON: '[]'
                    }
                };

                await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).post(payload);
                count++;
            }

            return { success: true, message: `Successfully seeded ${count} projects` };
        } catch (error: any) {
            console.error('Failed to seed projects:', error);
            return { success: false, message: error.message };
        }
    }
    async createEmployeeProfilesList(): Promise<{ success: boolean; message: string }> {
        console.log('🚀 [Setup] Creating Employee_Profiles list...');
        try {
            // Check if list exists
            const check = await this.client.api(`/sites/${this.siteId}/lists`).filter("displayName eq 'Employee_Profiles'").get();
            if (check.value && check.value.length > 0) {
                return { success: false, message: 'Employee_Profiles list already exists' };
            }

            // Create list
            const list = await this.client
                .api(`/sites/${this.siteId}/lists`)
                .post({
                    displayName: 'Employee_Profiles',
                    description: 'Employee profile images and metadata',
                    columns: [
                        {
                            name: 'ProfilePhoto',
                            thumbnail: {}
                        },
                        {
                            name: 'ModalPhoto',
                            thumbnail: {}
                        },
                        {
                            name: 'Designation',
                            text: {}
                        },
                        {
                            name: 'Department',
                            text: {}
                        }
                    ],
                    list: { template: 'genericList' }
                });

            console.log('✅ [Setup] Employee_Profiles list created');

            // Populate list
            await this.populateEmployeeProfiles(list.id);

            return { success: true, message: 'Employee_Profiles list created and populated' };

        } catch (error: any) {
            console.error('❌ [Setup] Failed to create Employee_Profiles list:', error);
            return { success: false, message: error.message };
        }
    }

    private async populateEmployeeProfiles(listId: string) {
        console.log('📝 [Setup] Populating Employee_Profiles...');
        try {
            for (const employee of initialEmployeeData) {
                await this.client
                    .api(`/sites/${this.siteId}/lists/${listId}/items`)
                    .post({
                        fields: {
                            Title: employee.mail, // Email as Title for lookup
                            Designation: employee.jobTitle,
                            Department: employee.department
                        }
                    });
            }
            console.log(`✅ [Setup] Populated ${initialEmployeeData.length} employee records`);
        } catch (error) {
            console.error('⚠️ [Setup] Failed to populate employee data:', error);
        }
    }

    /**
     * Delete and Recreate all Operations Lists (Clean Slate)
     */
    async purgeAndResetOperations(skipSampleData: boolean = true): Promise<{ success: boolean; message: string }> {
        console.log('🚨 [Reset] Starting full purge of Operations Lists...');
        const listNames = [
            'Operations_Tasks',      // Delete children first
            'Operations_Risks',
            'Operations_Projects',
            'Performance_KPIs',
            'Performance_KRAs',
            'Unit_Objectives',       // New list to purge
            'System_View_Settings'
            // NOTE: We do NOT delete Strategic_Pillars or Strategic_Objectives
        ];

        try {
            // 1. Delete Lists
            for (const name of listNames) {
                try {
                    const response = await this.client
                        .api(`/sites/${this.siteId}/lists`)
                        .filter(`displayName eq '${name}'`)
                        .select('id')
                        .get();
                    if (response.value && response.value.length > 0) {
                        await this.client
                            .api(`/sites/${this.siteId}/lists/${response.value[0].id}`)
                            .delete();
                        console.log(`✅ [Reset] Deleted list: ${name}`);
                    }
                } catch (err) { console.warn(`Failed delete ${name}`, err); }
            }

            // 2. Recreate Lists
            console.log('🔄 [Reset] Recreating lists...');
            const createResult = await this.createOperationsLists(skipSampleData ? false : true); // Invert for includeSampleData

            if (!createResult.success) {
                throw new Error(createResult.message);
            }


            // 3. Verify Schema (Fix for "lost mappings" or single line text issues)
            await this.verifyOperationsSchema();

            return { success: true, message: 'All operations data purged and lists reset successfully.' };

        } catch (error: any) {
            console.error('❌ [Reset] Failed:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Verify and Fix Operations Schema
     * Ensures critical columns (Assignees, JSON fields) are correctly configured as Multiline Text.
     */
    async verifyOperationsSchema(): Promise<void> {
        console.log('🔍 [Schema] Verifying Operations Schema (Assignees, JSON fields)...');
        const tasks = ['Operations_Tasks', 'Performance_KPIs', 'Operations_Projects', 'Performance_KRAs'];

        for (const listName of tasks) {
            try {
                const list = await this.client.api(`/sites/${this.siteId}/lists`).filter(`displayName eq '${listName}'`).select('id').get();
                if (list.value && list.value.length > 0) {
                    const listId = list.value[0].id;

                    // Assignees matches user request for multiple lines of text
                    await this.ensureMultiline(listId, 'Assignees');

                    if (listName === 'Operations_Tasks') {
                        await this.ensureMultiline(listId, 'SubtasksJSON');
                        await this.ensureMultiline(listId, 'RisksJSON'); // Just in case
                    }
                    if (listName === 'Operations_Projects') {
                        await this.ensureMultiline(listId, 'RisksJSON');
                    }
                }
            } catch (e) {
                console.warn(`Failed to verify schema for ${listName}`, e);
            }
        }
        console.log('✅ [Schema] Verification complete.');
    }

    /**
     * Helper: Ensure a column allows multiple lines of text
     */
    private async ensureMultiline(listId: string, columnName: string) {
        try {
            const col = await this.client.api(`/sites/${this.siteId}/lists/${listId}/columns`)
                .filter(`name eq '${columnName}' or displayName eq '${columnName}'`)
                .get();

            if (col.value && col.value.length > 0) {
                const column = col.value[0];
                // Check if already multiline
                if (column.text && column.text.allowMultipleLines) {
                    return; // All good
                }

                console.log(`⚠️ Cleaning up column '${columnName}' - enforcing Multiline Text...`);
                // PATCH update
                await this.client.api(`/sites/${this.siteId}/lists/${listId}/columns/${column.id}`)
                    .patch({
                        text: {
                            allowMultipleLines: true,
                            appendChangesToExistingText: false,
                            linesForEditing: 6
                        }
                    });
                console.log(`✅ Updated '${columnName}' to allow multiple lines.`);
            } else {
                console.log(`⚠️ Column '${columnName}' missing. Creating as Multiline Text...`);
                await this.ensureColumn(listId, columnName, { text: { allowMultipleLines: true } });
            }
        } catch (e: any) {
            console.warn(`❌ Failed to ensure multiline for '${columnName}':`, e.message);
        }
    }

    /**
     * Reset Strategic Progress to 0%
     * Updates all Strategic Objectives to have 0 progress.
     */
    async resetStrategicProgress(): Promise<{ success: boolean; message: string; count: number }> {
        console.log('🔄 [Reset] Resetting Strategic Objectives progress to 0%...');
        try {
            // 1. Get List ID
            const listCheck = await this.client
                .api(`/sites/${this.siteId}/lists`)
                .filter("displayName eq 'Strategic_Objectives'")
                .select('id')
                .get();

            if (!listCheck.value || listCheck.value.length === 0) {
                return { success: false, message: 'Strategic_Objectives list not found', count: 0 };
            }
            const listId = listCheck.value[0].id;

            // 2. Get All Items
            const items = await this.client
                .api(`/sites/${this.siteId}/lists/${listId}/items`)
                .select('id')
                .top(999)
                .get();

            // 3. Update All Items
            let count = 0;
            // Process in chunks to avoid throttling if many items (though likely few)
            const chunk = async (arr: any[], size: number) => {
                for (let i = 0; i < arr.length; i += size) {
                    await Promise.all(arr.slice(i, i + size).map(item =>
                        this.client.api(`/sites/${this.siteId}/lists/${listId}/items/${item.id}`)
                            .patch({
                                fields: {
                                    Progress: 0,
                                    Status: 'Not Started' // Optional: Reset status too? checking if user wants this. Kept it simple for now, maybe just progress. User said "reset those static values". Status is often tied to progress. Let's set Status to 'Not Started' or keep as is? User only mentioned "values" (often implying numbers). But 0% usually implies Not Started.
                                    // Actually, let's just reset Progress to 0 to be safe and strict to request.
                                    // Wait, if I set progress to 0, status 'On Track' might look weird.
                                    // Let's set Status to 'Not Started' if it exists in choices.
                                    // Looking at `createStrategicObjectivesList`: choices: ['On Track', 'At Risk', 'Behind', 'Completed'].
                                    // 'Not Started' is NOT in the choices for Strategic_Objectives in the code I read earlier (lines 183).
                                    // Choices were: ['On Track', 'At Risk', 'Behind', 'Completed'].
                                    // So I should probably set it to 'On Track' (default neutral) or just leave it.
                                    // I'll just reset Progress to 0.
                                }
                            })
                            .catch(e => console.warn(`Failed update item ${item.id}`, e.message))
                    ));
                }
            };

            await chunk(items.value, 10);
            count = items.value.length;

            return { success: true, message: `Reset progress for ${count} objectives.`, count };

        } catch (error: any) {
            console.error('❌ [Reset] Failed to reset progress:', error);
            return { success: false, message: error.message, count: 0 };
        }
    }
    /**
     * Create Operations_TaskGroups (Dedicated list for groups/buckets)
     */
    private async createTaskGroupsList() {
        const check = await this.client.api(`/sites/${this.siteId}/lists`).filter("displayName eq 'Operations_TaskGroups'").get();
        if (check.value && check.value.length > 0) return check.value[0];

        const list = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .post({
                displayName: 'Operations_TaskGroups',
                columns: [
                    { name: 'Description', text: { allowMultipleLines: true } },
                    { name: 'Status', choice: { choices: ['Planned', 'In Progress', 'Completed', 'On Hold'] } },
                    { name: 'Department', text: {} },
                    { name: 'Order', number: { decimalPlaces: 'none' } }
                ],
                list: { template: 'genericList' }
            });
        return list;
    }

    /**
     * Setup Operations_TaskGroups and update Operations_Tasks with a lookup
     */
    async setupTaskGroupsList(): Promise<{ success: boolean; message: string; details?: any }> {
        console.log('🚀 [Setup] Starting Task Groups separation setup...');
        try {
            // 1. Create TaskGroups List
            console.log('📝 [Setup] Creating Operations_TaskGroups list...');
            const taskGroupsList = await this.createTaskGroupsList();
            console.log('✅ [Setup] Operations_TaskGroups ensured/created (ID: ' + taskGroupsList.id + ')');

            // 2. Find Operations_Tasks list and ensure the Lookup column exists
            const tasksListCheck = await this.client
                .api(`/sites/${this.siteId}/lists`)
                .filter("displayName eq 'Operations_Tasks'")
                .select('id')
                .get();

            if (!tasksListCheck.value || tasksListCheck.value.length === 0) {
                console.warn('⚠️ [Setup] Operations_Tasks list not found. Standalone Task Groups list created.');
                return { success: true, message: 'Task Groups list created, but Tasks list not found to link.', details: taskGroupsList };
            }

            const tasksListId = tasksListCheck.value[0].id;
            console.log('🔗 [Setup] Ensuring RelatedTaskGroup lookup on Operations_Tasks...');
            await this.addLookupColumn(tasksListId, 'RelatedTaskGroup', taskGroupsList.id, 'Title');
            console.log('✅ [Setup] Lookup column ensured.');

            return { success: true, message: 'Operations_TaskGroups created and linked to Operations_Tasks successfully!', details: taskGroupsList };
        } catch (error: any) {
            console.error('❌ [Setup] Failed to setup Task Groups:', error);
            return { success: false, message: `Failed to setup Task Groups: ${error.message}`, details: error };
        }
    }
}

// ==========================================
// DATA CONSTANTS
// ==========================================
const INITIAL_COMPANIES = [
    {
        symbol: 'BSP',
        name: 'Bank South Pacific',
        sector: 'Financials',
        last: 28.00,
        change: 1.8,
        vol: 10200,
        mcap: 'K 60.2B',
        colors: { primary: '#0066cc', secondary: '#0099ff' }
    },
    {
        symbol: 'CCP',
        name: 'Credit Corporation PNG',
        sector: 'Financials',
        last: 1.95,
        change: 3.2,
        vol: 15000,
        mcap: 'K 8.5B',
        colors: { primary: '#2a9d8f', secondary: '#40c9b4' }
    },
    {
        symbol: 'CGA',
        name: 'Crater Gold Mining',
        sector: 'Mining',
        last: 0.15,
        change: 0.0,
        vol: 0,
        mcap: 'K 120M',
        colors: { primary: '#d97706', secondary: '#f59e0b' }
    },
    {
        symbol: 'CPL',
        name: 'CPL Group',
        sector: 'Industrial',
        last: 0.68,
        change: 1.2,
        vol: 4200,
        mcap: 'K 3.2B',
        colors: { primary: '#7c3aed', secondary: '#a78bfa' }
    },
    {
        symbol: 'KAM',
        name: 'Kina Asset Management',
        sector: 'Asset Management',
        last: 0.85,
        change: 0.6,
        vol: 3200,
        mcap: 'K 2.1B',
        colors: { primary: '#9b5de5', secondary: '#c77dff' }
    },
    {
        symbol: 'KSL',
        name: 'Kina Securities Limited',
        sector: 'Financials',
        last: 2.85,
        change: -2.1,
        vol: 8500,
        mcap: 'K 12.3B',
        colors: { primary: '#e63946', secondary: '#ff6b6b' }
    },
    {
        symbol: 'NEM',
        name: 'Newmont Corporation',
        sector: 'Mining',
        last: 45.20,
        change: 4.5,
        vol: 25000,
        mcap: 'K 95.4B',
        colors: { primary: '#f59e0b', secondary: '#fbbf24' }
    },
    {
        symbol: 'NGP',
        name: 'NGIP Agmark',
        sector: 'Agriculture',
        last: 0.42,
        change: -0.8,
        vol: 5600,
        mcap: 'K 1.8B',
        colors: { primary: '#65a30d', secondary: '#84cc16' }
    },
    {
        symbol: 'NIU',
        name: 'Niuminco Group',
        sector: 'Mining',
        last: 0.02,
        change: 0.0,
        vol: 0,
        mcap: 'K 50M',
        colors: { primary: '#78716c', secondary: '#a8a29e' }
    },
    {
        symbol: 'SST',
        name: 'Steamships Trading',
        sector: 'Conglomerate',
        last: 2.35,
        change: 0.4,
        vol: 7800,
        mcap: 'K 15.6B',
        colors: { primary: '#0891b2', secondary: '#22d3ee' }
    },
    {
        symbol: 'STO',
        name: 'Santos Limited',
        sector: 'Energy',
        last: 6.78,
        change: 2.1,
        vol: 12000,
        mcap: 'K 35.2B',
        colors: { primary: '#dc2626', secondary: '#ef4444' }
    }
];
