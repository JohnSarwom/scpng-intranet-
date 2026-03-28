/**
 * SharePoint Operations Service
 * Handles data fetching and mapping for Operations (KRAs, KPIs, Projects, Tasks) from SharePoint Lists
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { Task, Project, KRA, Kpi, Objective, Risk, FilterScope, UserContext, TaskGroup } from '@/types';
import { ChecklistItem } from '@/components/ChecklistSection';
import { Report } from '@/types/reports';
import { Logger } from '@/utils/logger';
import { WorkPlan, WorkPlanGoal } from '@/types/division.types';

// Configuration for SharePoint Lists
const OPS_CONFIG = {
    SITE_DOMAIN: 'scpng1.sharepoint.com',
    SITE_PATH: '/sites/scpngintranet',
    LISTS: {
        KRAS: 'Performance_KRAs',
        KPIS: 'Performance_KPIs',
        PROJECTS: 'Operations_Projects',
        TASKS: 'Operations_Tasks',
        RISKS: 'Operations_Risks',
        OBJECTIVES: 'Unit_Objectives',
        REPORTS: 'Performance_Reports',
        SETTINGS: 'System_View_Settings',
        TASK_GROUPS: 'Operations_TaskGroups',
        COMPONENT_VISIBILITY: 'System_Component_Visibility',
        WORKPLANS: 'Division_WorkPlans',
        NOTIFICATIONS: 'System_Notifications',
        REPORT_SCHEDULES: 'Report_Schedules',
        CUSTOM_CONTACTS: 'User_Custom_Contacts'
    }
};

let cachedSiteId: string = '';
let cachedListIds: Record<string, string> = {};
let globalInitializationPromise: Promise<void> | null = null;

/** Call this after creating a new SharePoint list so the next initialize() re-resolves IDs. */
export const resetOpsServiceCache = () => {
    cachedListIds = {};
    globalInitializationPromise = null;
};

export class SharePointOpsService {
    public client: Client;

    // Use getters/setters to seamlessly bridge to the module-level globals
    // This ensures any `new SharePointOpsService(client)` shares the 
    // exact same list metadata without needing to refactor the entire app.
    get siteId() { return cachedSiteId; }
    set siteId(v) { cachedSiteId = v; }

    get listIds() { return cachedListIds; }
    set listIds(v) { cachedListIds = v; }

    get initializationPromise() { return globalInitializationPromise; }
    set initializationPromise(v) { globalInitializationPromise = v; }

    constructor(client: Client) {
        this.client = client;
    }

    initialize(): Promise<void> {
        // If already initialized (siteId is populated), return
        if (this.siteId && Object.keys(this.listIds).length > 0) return Promise.resolve();

        if (this.initializationPromise) return this.initializationPromise;

        this.initializationPromise = (async () => {
            console.log('🔧 [SharePointOpsService] Initializing (Global Module Cache)...');
            try {
                // Get Site ID
                const site = await this.client
                    .api(`/sites/${OPS_CONFIG.SITE_DOMAIN}:${OPS_CONFIG.SITE_PATH}`)
                    .get();
                this.siteId = site.id;

                // Get List IDs
                await this.resolveListIds();
                console.log('✅ [SharePointOpsService] Initialization complete');

                // Auto-ensure the Assignees column exists on Performance_KRAs
                // (fire-and-forget — doesn't block initialization)
                this.ensureAssigneesColumnOnKRAs().catch(err =>
                    console.warn('⚠️ [SP Ops] Auto-ensure Assignees column failed (non-blocking):', err.message)
                );

                // Auto-ensure the System_Notifications list exists (fire-and-forget)
                this.ensureNotificationsList().catch(err =>
                    console.warn('⚠️ [SP Ops] Auto-ensure Notifications list failed (non-blocking):', err.message)
                );

                // Auto-ensure AssigneeViewMap column on Tasks list (fire-and-forget)
                this.ensureAssigneeViewMapColumn().catch(err =>
                    console.warn('⚠️ [SP Ops] Auto-ensure AssigneeViewMap column failed (non-blocking):', err.message)
                );

                // Auto-ensure OwnerEmail column on TaskGroups list (fire-and-forget)
                this.ensureOwnerEmailColumn().catch(err =>
                    console.warn('⚠️ [SP Ops] Auto-ensure OwnerEmail column failed (non-blocking):', err.message)
                );

                // Auto-ensure custom date range columns on Report_Schedules (fire-and-forget)
                this.ensureCustomDateColumns().catch(err =>
                    console.warn('⚠️ [SP Ops] Auto-ensure custom date columns failed (non-blocking):', err.message)
                );
            } catch (error) {
                console.error('❌ [SharePointOpsService] Init failed', error);
                this.initializationPromise = null; // Reset on error
                throw error;
            }
        })();

        return this.initializationPromise;
    }

    private async resolveListIds() {
        const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '');

        // Build a map of normalized config list name → config key
        const configMap: Record<string, string> = {};
        Object.entries(OPS_CONFIG.LISTS).forEach(([key, value]) => {
            configMap[normalize(value)] = key;
        });

        // Follow @odata.nextLink pages so lists beyond the default page size are found
        let nextUrl: string | null = `/sites/${this.siteId}/lists?$select=id,displayName`;
        while (nextUrl) {
            const response = await this.client.api(nextUrl).get();
            (response.value || []).forEach((list: any) => {
                const listNorm = normalize(list.displayName);
                if (configMap[listNorm]) {
                    const key = configMap[listNorm];
                    this.listIds[key] = list.id;
                    console.log(`✅ [SharePointOpsService] Resolved List: ${key} -> ${list.id} (${list.displayName})`);
                }
            });
            nextUrl = response['@odata.nextLink'] ?? null;
        }
    }

    /**
     * Lightweight check: ensure the Assignees multi-line text column exists on key lists.
     * Runs once during init (fire-and-forget). If the column already exists, this is a no-op.
     */
    private async ensureAssigneesColumnOnKRAs(): Promise<void> {
        const listsToCheck = ['KRAS', 'KPIS', 'TASKS', 'PROJECTS'];
        for (const key of listsToCheck) {
            const listId = this.listIds[key];
            if (!listId) continue;
            try {
                // Check if Assignees column exists by trying to read its definition
                await this.client.api(`/sites/${this.siteId}/lists/${listId}/columns`).filter("name eq 'Assignees'").select('id,name').get()
                    .then((res: any) => {
                        if (!res.value || res.value.length === 0) {
                            // Column doesn't exist — create it
                            console.log(`🔧 [SP Ops] Creating Assignees column on list ${key}...`);
                            return this.client.api(`/sites/${this.siteId}/lists/${listId}/columns`).post({
                                name: 'Assignees',
                                text: { allowMultipleLines: true, textType: 'plain' },
                            });
                        } else {
                            console.log(`✅ [SP Ops] Assignees column exists on ${key}`);
                        }
                    });
            } catch (err: any) {
                console.warn(`⚠️ [SP Ops] Failed to check/create Assignees on ${key}:`, err.message);
            }
        }
    }

    private async ensureAssigneeViewMapColumn(): Promise<void> {
        const listId = this.listIds['TASKS'];
        if (!listId) return;
        try {
            const res = await this.client.api(`/sites/${this.siteId}/lists/${listId}/columns`).filter("name eq 'AssigneeViewMap'").select('id,name').get();
            if (!res.value || res.value.length === 0) {
                console.log('🔧 [SP Ops] Creating AssigneeViewMap column on Operations_Tasks...');
                await this.client.api(`/sites/${this.siteId}/lists/${listId}/columns`).post({
                    name: 'AssigneeViewMap',
                    text: { allowMultipleLines: true, textType: 'plain' },
                });
            } else {
                console.log('✅ [SP Ops] AssigneeViewMap column exists on Operations_Tasks');
            }
        } catch (err: any) {
            console.warn('⚠️ [SP Ops] Failed to check/create AssigneeViewMap on Tasks:', err.message);
        }
    }

    private async ensureOwnerEmailColumn(): Promise<void> {
        const listId = this.listIds['TASK_GROUPS'];
        if (!listId) return;
        try {
            const res = await this.client.api(`/sites/${this.siteId}/lists/${listId}/columns`).filter("name eq 'OwnerEmail'").select('id,name').get();
            if (!res.value || res.value.length === 0) {
                console.log('🔧 [SP Ops] Creating OwnerEmail column on Operations_TaskGroups...');
                await this.client.api(`/sites/${this.siteId}/lists/${listId}/columns`).post({
                    name: 'OwnerEmail',
                    text: { allowMultipleLines: false, textType: 'plain' },
                });
            } else {
                console.log('✅ [SP Ops] OwnerEmail column exists on Operations_TaskGroups');
            }
        } catch (err: any) {
            console.warn('⚠️ [SP Ops] Failed to check/create OwnerEmail on TaskGroups:', err.message);
        }
    }

    private async ensureCustomDateColumns(): Promise<void> {
        const listId = this.listIds['REPORT_SCHEDULES'];
        if (!listId) return;

        const columnsToEnsure: { name: string; def: Record<string, any> }[] = [
            { name: 'CustomStartDate', def: { dateTime: {} } },
            { name: 'CustomEndDate', def: { dateTime: {} } },
            { name: 'RollingWindowDays', def: { text: {} } },
            { name: 'CustomIntervalDays', def: { text: {} } },
            { name: 'IsOneTime', def: { text: {} } },
        ];

        for (const col of columnsToEnsure) {
            try {
                const res = await this.client.api(`/sites/${this.siteId}/lists/${listId}/columns`).filter(`name eq '${col.name}'`).select('id,name').get();
                if (!res.value || res.value.length === 0) {
                    console.log(`[SP Ops] Creating ${col.name} column on Report_Schedules...`);
                    await this.client.api(`/sites/${this.siteId}/lists/${listId}/columns`).post({
                        name: col.name,
                        ...col.def,
                    });
                }
            } catch (err: any) {
                console.warn(`[SP Ops] Failed to ensure ${col.name} on Report_Schedules:`, err.message);
            }
        }
    }

    // --- Fetch Methods ---

    async getObjectives(scope: FilterScope = 'Division', context?: UserContext): Promise<Objective[]> {
        if (!this.listIds['OBJECTIVES']) {
            console.warn('⚠️ [SP Ops] Objectives list not found via Graph API.');
            return [];
        }

        try {
            // Fetch all to avoid indexing issues with OData filters
            const response = await this.client
                .api(`/sites/${this.siteId}/lists/${this.listIds['OBJECTIVES']}/items`)
                .expand('fields')
                .get();

            console.log(`📊 [SP Ops] getObjectives fetched raw: ${response.value?.length || 0}`);

            return (response.value || [])
                .filter((item: any) => {
                    const f = item.fields;
                    // Admin Bypass
                    if (context?.role === 'admin' || context?.role === 'super_admin') return true;

                    const type = f.GoalType;
                    const isFeatured = f.IsFeatured === true || f.IsFeatured === 1 || f.IsFeatured === "1";

                    // Robust check for Organizational/Strategic objectives
                    // Check for 'Org', 'Strategic', or empty type (often implies top level)
                    const isOrgLevel = !type ||
                        type.toLowerCase() === 'org' ||
                        type.toLowerCase() === 'strategic' ||
                        type.toLowerCase() === 'board';

                    // ALWAYS include 'Org', null types (strategic fallback), or featured objectives for alignment lookups
                    if (isOrgLevel || isFeatured) return true;

                    // Debug log for rejection
                    const debugRejection = (reason: string) => {
                        // console.log(`⛔ [Filter Debug] Objective "${f.Title}" rejected. Reason: ${reason}. Scope: ${scope}. Context: Div="${context?.division}", Unit="${context?.unit}". Item: Div="${f.Division}", Unit="${f.Unit}"`);
                    };

                    // Then apply scope-specific filtering
                    if (scope === 'Division' && context?.division) {
                        if (f.Division === context.division) return true;
                        debugRejection('Division mismatch');
                        return false;
                    } else if (scope === 'Unit' && context?.unit) {
                        if (f.Unit === context.unit) return true;
                        debugRejection('Unit mismatch');
                        return false;
                    } else if (scope === 'Individual' && context?.name) {
                        return f.Owner === context.name;
                    }

                    debugRejection('No matching scope condition');
                    return false;
                })
                .map((item: any) => this.mapObjective(item));
        } catch (error) {
            console.error('❌ [SP Ops] getObjectives failed:', error);
            return [];
        }
    }

    async addObjective(objective: Partial<Objective>, department?: string): Promise<Objective> {
        if (!this.listIds['OBJECTIVES']) throw new Error('Objectives list not found');

        const payload = {
            fields: {
                Title: objective.title,
                Description: objective.description,
                GoalType: objective.goalType || 'Division',
                Division: objective.division || department || 'General',
                Status: objective.status || 'Not Started',
                Progress: objective.progress || 0,
                Year: objective.year,
                StartDate: objective.startDate ? new Date(objective.startDate).toISOString() : null,
                EndDate: objective.endDate ? new Date(objective.endDate).toISOString() : null,
                Unit: objective.unit,
                Owner: objective.owner,
                ParentGoalIdLookupId: objective.parentGoalId,
                Icon: objective.icon,
                IsFeatured: objective.isFeatured,
                Deliverables: objective.deliverables?.join(', '),
                LinkedDeliverable: objective.linkedDeliverable
            }
        };

        console.log('📝 [SP Ops] Adding Objective:', payload);
        const response = await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['OBJECTIVES']}/items`)
            .post(payload);

        return this.mapObjective(response);
    }

    async updateObjective(id: string, objective: Partial<Objective>): Promise<Objective> {
        if (!this.listIds['OBJECTIVES']) throw new Error('Objectives list not found');

        const fields: any = {
            Title: objective.title,
            Description: objective.description,
        };

        // Only add fields if they are defined in the partial update
        if (objective.status !== undefined) fields.Status = objective.status;
        if (objective.progress !== undefined) fields.Progress = objective.progress;
        if (objective.year !== undefined) fields.Year = objective.year;
        if (objective.startDate !== undefined) fields.StartDate = objective.startDate ? new Date(objective.startDate).toISOString() : null;
        if (objective.endDate !== undefined) fields.EndDate = objective.endDate ? new Date(objective.endDate).toISOString() : null;
        if (objective.goalType !== undefined) fields.GoalType = objective.goalType;
        if (objective.division !== undefined) fields.Division = objective.division;
        if (objective.unit !== undefined) fields.Unit = objective.unit;
        if (objective.owner !== undefined) fields.Owner = objective.owner;
        if (objective.parentGoalId !== undefined) fields.ParentGoalIdLookupId = objective.parentGoalId;
        if (objective.icon !== undefined) fields.Icon = objective.icon;
        if (objective.isFeatured !== undefined) fields.IsFeatured = objective.isFeatured;
        if (objective.deliverables !== undefined) fields.Deliverables = objective.deliverables?.join(', ');
        if (objective.linkedDeliverable !== undefined) fields.LinkedDeliverable = objective.linkedDeliverable;

        const payload = { fields };

        console.log(`📝 [SP Ops] Updating Objective ${id}:`, payload);
        const response = await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['OBJECTIVES']}/items/${id}`)
            .patch(payload);

        return this.mapObjective(response);
    }

    async deleteObjective(id: string): Promise<void> {
        if (!this.listIds['OBJECTIVES']) throw new Error('Objectives list not found');

        console.log(`🗑️ [SP Ops] Deleting Objective ${id}`);
        await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['OBJECTIVES']}/items/${id}`)
            .delete();
    }

    async getKRAs(scope: FilterScope = 'Division', context?: UserContext): Promise<KRA[]> {
        if (!this.listIds['KRAS']) return [];
        // Revert to simple expand for now, but add prefer header
        let query = this.client.api(`/sites/${this.siteId}/lists/${this.listIds['KRAS']}/items`).expand('fields');
        query = query.header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly');

        // Admin Bypass: Super Admins and Admins see everything
        const isAdmin = context?.role === 'admin' || context?.role === 'super_admin';

        if (isAdmin) {
            console.log(`🔓 [Admin Bypass] User: ${context?.email} | Role: ${context?.role} | Fetching ALL KRAs (no filter)`);
        } else {
            let filter = '';
            // KRAs List Schema: 'Division' column holds Division Name, 'Unit' column holds Unit Name.
            if (scope === 'Division' && context?.division) {
                filter = `fields/Division eq '${context.division}'`;
            } else if (scope === 'Unit' && context?.unit) {
                filter = `fields/Unit eq '${context.unit}'`;
            }

            if (filter) {
                query = query.filter(filter);
                console.log(`🔒 [Scoped Query] User: ${context?.email} | Role: ${context?.role} | Filter: ${filter}`);
            }
        }

        const response = await query.get();
        console.log(`📊 [KRAs Fetched] User: ${context?.email} | Count: ${response.value?.length || 0} | Admin: ${isAdmin}`);

        // AGGRESSIVE DEBUG: Check for KRA 111 or recent items
        if (response.value) {
            const target = response.value.find((i: any) => String(i.id) === '111' || String(i.id) === '108');
            if (target) {
                console.log(`🔍 [SP Ops] RAW FIELDS for KRA ${target.id}:`, JSON.stringify(target.fields));
                console.log(`🔍 [SP Ops] Has Assignees?`, 'Assignees' in target.fields);
            } else if (response.value.length > 0) {
                // Log first item if target not found
                console.log(`🔍 [SP Ops] RAW FIELDS for First KRA (${response.value[0].id}):`, Object.keys(response.value[0].fields));
            }
        }

        return response.value.map((item: any) => this.mapKRA(item));
    }

    async getKPIs(department?: string): Promise<Kpi[]> {
        // KPI filtering usually happens via Linked KRA or client side for now as explicit linkage is complex in one query
        if (!this.listIds['KPIS']) return [];
        const response = await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['KPIS']}/items`)
            .expand('fields')
            .get();
        return response.value.map((item: any) => this.mapKPI(item));
    }

    async getProjects(scope: FilterScope = 'Unit', context?: UserContext): Promise<Project[]> {
        if (!this.listIds['PROJECTS']) return [];
        let query = this.client.api(`/sites/${this.siteId}/lists/${this.listIds['PROJECTS']}/items`).expand('fields');
        query = query.header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly');

        query = query.header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly');

        // Admin Bypass
        const isAdmin = context?.role === 'admin' || context?.role === 'super_admin';

        if (isAdmin) {
            console.log(`🔓 [Admin Bypass] User: ${context?.email} | Role: ${context?.role} | Fetching ALL Projects (no filter)`);
        } else {
            let filter = '';

            // Projects List Schema: 'Department' column holds Unit Name (usually).
            // 🚨 CHANGE: Removing server-side filter to debug "Zero Projects" issue.
            // We need to see projects from other units if we have tasks in them.
            // if (scope === 'Division' && context?.division) {
            //     // Projects don't have Division column. 
            // } else if (scope === 'Unit' && context?.unit) {
            //     // filter = `fields/Department eq '${context.unit}'`;
            // }

            if (filter) {
                query = query.filter(filter);
                Logger.debug(`🔄 [Scoped Query] User: ${context?.email} | Filter: ${filter}`);
            } else {
                // Logger.info(`🌐 [Global Fetch] Projects - User: ${context?.email} | Fetching ALL (Filter Disabled for Debugging)`);
            }
        }

        const projects = await query.get();

        Logger.debug(`📊 [Projects Fetched] User: ${context?.email} | Count: ${projects.value?.length || 0} | Admin: ${isAdmin}`);

        return projects.value.map((item: any) => this.mapProject(item));
    }

    async getTasks(scope: FilterScope = 'Unit', context?: UserContext): Promise<Task[]> {
        if (!this.listIds['TASKS']) return [];

        let query = this.client.api(`/sites/${this.siteId}/lists/${this.listIds['TASKS']}/items`)
            .expand('fields');

        query = query.header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly');

        // No server-side role-based filtering — all tasks are fetched, then filtered
        // client-side in useSharePointTasks by creator/assignee for all roles (including admin).
        const isAdmin = context?.role === 'admin' || context?.role === 'super_admin';
        console.log(`🌐 [Global Fetch] User: ${context?.email} | Role: ${context?.role} | No server-side filter (client-side filtering applied)`)

        // Paginate through all results — Graph API caps at 200 items per page by default.
        // Without pagination, newly added tasks beyond item #200 are silently dropped.
        let response = await query.get();
        let allItems: any[] = response.value || [];

        while (response['@odata.nextLink']) {
            response = await this.client.api(response['@odata.nextLink']).get();
            allItems = allItems.concat(response.value || []);
        }

        console.log(`📊 [Tasks Fetched] User: ${context?.email} | Count: ${allItems.length} | Admin: ${isAdmin}`);
        return allItems.map((item: any) => this.mapTask(item));
    }

    async addTask(task: Partial<Task>, department?: string): Promise<Task> {
        if (!this.listIds['TASKS']) throw new Error('Operations Tasks list not found');

        // Handle Group ID logic — buckets come from Task Groups
        let numericGroupId = task.projectId ? Number(task.projectId) : null;
        if (isNaN(numericGroupId as number)) numericGroupId = null;

        // Update Tags to include bucket ID if it's not a real project
        const tags = this.updateTagsWithBucketId(task.tags || [], task.projectId);

        const payload: any = {
            fields: {
                Title: task.title,
                Description: task.description,
                Status: this.mapStatusForSharePoint(task.status),
                Priority: this.mapPriorityForSharePoint(task.priority),
                DueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
                StartDate: task.startDate ? new Date(task.startDate).toISOString() : null,
                Department: task.unit_id || department || 'General',
                SubtasksJSON: JSON.stringify(task.subtasks || []),
                CommentsJSON: JSON.stringify(task.comments || []),
                Tags: tags.join(','),
                Assignees: task.assignees ? JSON.stringify(task.assignees) : undefined,
                AssigneeViewMap: task.assigneeViewMap ? JSON.stringify(task.assigneeViewMap) : undefined,
                AttachmentsJSON: task.attachments ? JSON.stringify(task.attachments) : undefined,
                // Lookups
                RelatedKRALookupId: task.kra_id ? Number(task.kra_id) : null,
                RelatedKPILookupId: task.kpi_id ? Number(task.kpi_id) : null,
                // Write group ID to TaskGroup lookup only (Projects lookup targets a different list)
                RelatedTaskGroupLookupId: numericGroupId
            }
        };


        // console.log('📝 [SP Ops] Adding Task Payload:', JSON.stringify(payload, null, 2));
        let response: any;
        try {
            response = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['TASKS']}/items`).post(payload);
        } catch (err: any) {
            // If AttachmentsJSON or AssigneeViewMap columns don't exist yet, retry without them
            if (err?.message?.includes('AttachmentsJSON') || err?.message?.includes('AssigneeViewMap')) {
                if (payload.fields.AttachmentsJSON !== undefined) {
                    console.warn('⚠️ [SP Ops] AttachmentsJSON column not recognized, retrying without it');
                    delete payload.fields.AttachmentsJSON;
                }
                if (payload.fields.AssigneeViewMap !== undefined && err?.message?.includes('AssigneeViewMap')) {
                    console.warn('⚠️ [SP Ops] AssigneeViewMap column not recognized, retrying without it');
                    delete payload.fields.AssigneeViewMap;
                }
                response = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['TASKS']}/items`).post(payload);
            } else {
                throw err;
            }
        }

        // Sync KPI checklist if task is linked to a KPI
        if (task.kpi_id) {
            await this.syncKPIChecklistFromTasks(task.kpi_id.toString(), { id: response.id, status: payload.fields.Status });
        }

        return this.mapTask(response);

    }

    async updateTask(id: string, task: Partial<Task>): Promise<Task> {
        if (!this.listIds['TASKS']) throw new Error('Operations Tasks list not found');

        const fields: any = {};
        if (task.title !== undefined) fields.Title = task.title;
        if (task.description !== undefined) fields.Description = task.description;
        if (task.status !== undefined) fields.Status = this.mapStatusForSharePoint(task.status);
        if (task.priority !== undefined) fields.Priority = this.mapPriorityForSharePoint(task.priority);
        if (task.dueDate !== undefined) fields.DueDate = task.dueDate ? new Date(task.dueDate).toISOString() : null;
        if (task.startDate !== undefined) fields.StartDate = task.startDate ? new Date(task.startDate).toISOString() : null;
        if (task.unit_id !== undefined) fields.Department = task.unit_id;
        if (task.subtasks !== undefined) fields.SubtasksJSON = JSON.stringify(task.subtasks);
        if (task.comments !== undefined) fields.CommentsJSON = JSON.stringify(task.comments);
        if (task.assignees !== undefined) {
            console.log('📝 [SP Ops] Setting Assignees for Task:', task.assignees);
            fields.Assignees = JSON.stringify(task.assignees);
        }
        if (task.assigneeViewMap !== undefined) {
            fields.AssigneeViewMap = JSON.stringify(task.assigneeViewMap);
        }
        if (task.attachments !== undefined) {
            fields.AttachmentsJSON = JSON.stringify(task.attachments);
        }

        // Completion Date Logic
        if (task.status !== undefined) {
            const newStatus = this.mapStatusForSharePoint(task.status);
            if (newStatus === 'Done') {
                fields.CompletionDate = new Date().toISOString();
            } else {
                // If moving out of Done, clear the date
                fields.CompletionDate = null;
            }
        }

        // Handle Project ID / Task Group ID logic for Updates
        // Buckets in the UI come from Task Groups, so projectId maps to RelatedTaskGroupLookupId ONLY.
        // RelatedProjectLookupId is a lookup to Operations_Projects (different list) and must NOT
        // receive TaskGroup IDs — SharePoint rejects IDs that don't exist in the target list.
        if (task.projectId !== undefined) {
            let numericGroupId = task.projectId ? Number(task.projectId) : null;
            if (isNaN(numericGroupId as number)) numericGroupId = null;

            fields.RelatedTaskGroupLookupId = numericGroupId;

            // Also update tags
            if (task.tags) {
                const newTags = this.updateTagsWithBucketId(task.tags, task.projectId);
                fields.Tags = newTags.join(',');
            }
        }

        if (task.tags !== undefined && !fields.Tags) { // If tags passed but not handled by projectId block above
            fields.Tags = (task.tags || []).join(',');
        }

        // Lookups
        if (task.kra_id !== undefined) fields.RelatedKRALookupId = task.kra_id ? Number(task.kra_id) : null;
        if (task.kpi_id !== undefined) fields.RelatedKPILookupId = task.kpi_id ? Number(task.kpi_id) : null;
        // Also handle explicit groupId updates
        if (task.groupId !== undefined && task.projectId === undefined) {
            const numericGroupId = task.groupId ? Number(task.groupId) : null;
            fields.RelatedTaskGroupLookupId = isNaN(numericGroupId as number) ? null : numericGroupId;
        }

        // Fetch old task data to detect KPI linkage changes
        let oldKpiId: string | null = null;
        try {
            const oldTask = await this.client
                .api(`/sites/${this.siteId}/lists/${this.listIds['TASKS']}/items/${id}`)
                .expand('fields')
                .get();
            oldKpiId = oldTask.fields?.RelatedKPILookupId ? String(oldTask.fields.RelatedKPILookupId) : null;
        } catch { /* proceed without old data */ }

        console.log(`📝 [SP Ops] Updating Task ${id} Payload:`, JSON.stringify({ fields }, null, 2));
        let response: any;
        try {
            response = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['TASKS']}/items/${id}`).patch({ fields });
        } catch (err: any) {
            // If AttachmentsJSON or AssigneeViewMap columns don't exist yet, retry without them
            if (err?.message?.includes('AttachmentsJSON') || err?.message?.includes('AssigneeViewMap')) {
                if (fields.AttachmentsJSON !== undefined) {
                    console.warn('⚠️ [SP Ops] AttachmentsJSON column not recognized, retrying without it');
                    delete fields.AttachmentsJSON;
                }
                if (fields.AssigneeViewMap !== undefined && err?.message?.includes('AssigneeViewMap')) {
                    console.warn('⚠️ [SP Ops] AssigneeViewMap column not recognized, retrying without it');
                    delete fields.AssigneeViewMap;
                }
                response = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['TASKS']}/items/${id}`).patch({ fields });
            } else {
                throw err;
            }
        }

        // Sync KPI checklist(s) after task update
        const newKpiId = task.kpi_id !== undefined
            ? (task.kpi_id ? String(task.kpi_id) : null)
            : oldKpiId;

        // If KPI linkage changed, sync both old and new KPIs
        const overrideData = { id, status: fields.Status };

        if (oldKpiId && newKpiId !== oldKpiId) {
            await this.syncKPIChecklistFromTasks(oldKpiId, overrideData);
        }
        if (newKpiId) {
            await this.syncKPIChecklistFromTasks(newKpiId, overrideData);
        }

        return this.mapTask(response);
    }

    async deleteTask(id: string): Promise<void> {
        if (!this.listIds['TASKS']) throw new Error('Operations Tasks list not found');

        // Fetch task before deleting to get its KPI linkage
        let kpiId: string | null = null;
        try {
            const taskItem = await this.client
                .api(`/sites/${this.siteId}/lists/${this.listIds['TASKS']}/items/${id}`)
                .expand('fields')
                .get();
            kpiId = taskItem.fields?.RelatedKPILookupId ? String(taskItem.fields.RelatedKPILookupId) : null;
        } catch { /* proceed with deletion */ }

        await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['TASKS']}/items/${id}`).delete();

        // Sync KPI checklist to remove the deleted task's checklist item
        if (kpiId) {
            await this.syncKPIChecklistFromTasks(kpiId);
        }
    }

    // Helpers for mapping
    private mapStatusForSharePoint(status?: string): string {
        switch (status) {
            case 'todo': return 'Todo';
            case 'in-progress': return 'In Progress';
            case 'on-hold': return 'On Hold';
            case 'in-review': return 'Review';
            case 'completed': return 'Done';
            default: return 'Todo';
        }
    }

    private mapPriorityForSharePoint(priority?: string): string {
        switch (priority) {
            case 'low': return 'Low';
            case 'medium': return 'Medium';
            case 'high': return 'High';
            case 'urgent': return 'Urgent';
            default: return 'Medium';
        }
    }

    private getBucketIdFromTags(tags: string[]): string | undefined {
        const bucketTag = tags.find(t => t.startsWith('bucket:'));
        return bucketTag ? bucketTag.replace('bucket:', '') : undefined;
    }

    // Update tags array: Remove old bucket tags, add new one if needed
    private updateTagsWithBucketId(tags: string[], bucketId?: string): string[] {
        const cleanTags = tags.filter(t => !t.startsWith('bucket:'));
        if (bucketId && isNaN(Number(bucketId))) { // Only store as tag if NOT a numeric Project ID
            cleanTags.push(`bucket:${bucketId}`);
        }
        return cleanTags;
    }

    async getRisks(scope: FilterScope = 'Division', context?: UserContext): Promise<Risk[]> {
        if (!this.listIds['RISKS']) return [];
        let query = this.client.api(`/sites/${this.siteId}/lists/${this.listIds['RISKS']}/items`).expand('fields');
        query = query.header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly');

        query = query.header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly');

        // Admin Bypass
        if (context?.role === 'admin' || context?.role === 'super_admin') {
            // No filter
        } else {
            let filter = '';
            // Risks List Schema: 'Department' column holds Division Name (usually).
            if (scope === 'Division' && context?.division) {
                filter = `fields/Department eq '${context.division}'`;
            } else if (scope === 'Unit' && context?.unit) {
                // Risks often Division level, but if Unit level:
                // filter = `fields/Unit eq '${context.unit}'`;
            }

            if (filter) query = query.filter(filter);
        }

        const response = await query.get();
        return response.value.map((item: any) => this.mapRisk(item));
    }

    // --- Settings Methods ---

    async getViewSettings(): Promise<any[]> {
        if (!this.listIds['SETTINGS']) return [];
        try {
            const response = await this.client
                .api(`/sites/${this.siteId}/lists/${this.listIds['SETTINGS']}/items`)
                .expand('fields')
                .get();

            return response.value.map((item: any) => ({
                id: item.id,
                page: item.fields.PageName,
                component: item.fields.ComponentName,
                scope: item.fields.VisibilityScope,
                settings: item.fields.Description, // Using Description to store the JSON blob
                description: item.fields.Description
            }));
        } catch (error) {
            console.error('Failed to get view settings', error);
            return [];
        }
    }

    async updateViewSetting(componentName: string, newScope: string): Promise<void> {
        if (!this.listIds['SETTINGS']) throw new Error('Settings list not found');

        // First find the item ID for this component
        const items = await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['SETTINGS']}/items`)
            .filter(`fields/ComponentName eq '${componentName}'`)
            .get();

        if (items.value && items.value.length > 0) {
            const id = items.value[0].id;
            await this.client
                .api(`/sites/${this.siteId}/lists/${this.listIds['SETTINGS']}/items/${id}`)
                .patch({
                    fields: {
                        VisibilityScope: newScope
                    }
                });
        }
    }

    // --- Custom Contacts Methods ---

    async getCustomContacts(userEmail: string): Promise<any[]> {
        if (!this.listIds['CUSTOM_CONTACTS']) return [];
        try {
            const response = await this.client
                .api(`/sites/${this.siteId}/lists/${this.listIds['CUSTOM_CONTACTS']}/items`)
                .expand('fields')
                .filter(`fields/OwnerEmail eq '${userEmail}'`)
                .get();

            return (response.value || []).map((item: any) => ({
                id: item.id,
                displayName: item.fields.Title,
                jobTitle: item.fields.JobTitle,
                department: item.fields.Department,
                mail: item.fields.Email,
                emailAddresses: [{ address: item.fields.Email }],
                businessPhones: item.fields.Phone ? [item.fields.Phone] : [],
                mobilePhone: item.fields.Phone,
                companyName: item.fields.Company,
                officeLocation: item.fields.OfficeLocation,
                ownerEmail: item.fields.OwnerEmail,
                isCustom: true
            }));
        } catch (error) {
            console.error('Failed to get custom contacts', error);
            return [];
        }
    }

    async addCustomContact(contact: any, userEmail: string): Promise<any> {
        if (!this.listIds['CUSTOM_CONTACTS']) throw new Error('Custom Contacts list not found');

        const payload = {
            fields: {
                Title: contact.displayName,
                JobTitle: contact.jobTitle,
                Department: contact.department,
                Email: contact.mail || contact.emailAddresses?.[0]?.address,
                Phone: contact.mobilePhone || contact.businessPhones?.[0],
                Company: contact.companyName,
                OfficeLocation: contact.officeLocation,
                OwnerEmail: userEmail
            }
        };

        const response = await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['CUSTOM_CONTACTS']}/items`)
            .post(payload);

        return {
            id: response.id,
            ...contact,
            isCustom: true
        };
    }

    async updateCustomContact(id: string, contact: any): Promise<any> {
        if (!this.listIds['CUSTOM_CONTACTS']) throw new Error('Custom Contacts list not found');

        const fields: any = {};
        if (contact.displayName) fields.Title = contact.displayName;
        if (contact.jobTitle) fields.JobTitle = contact.jobTitle;
        if (contact.department) fields.Department = contact.department;
        if (contact.mail) fields.Email = contact.mail;
        if (contact.mobilePhone) fields.Phone = contact.mobilePhone;
        if (contact.companyName) fields.Company = contact.companyName;
        if (contact.officeLocation) fields.OfficeLocation = contact.officeLocation;

        const response = await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['CUSTOM_CONTACTS']}/items/${id}`)
            .patch({ fields });

        return {
            id,
            ...contact,
            isCustom: true
        };
    }

    async deleteCustomContact(id: string): Promise<void> {
        if (!this.listIds['CUSTOM_CONTACTS']) throw new Error('Custom Contacts list not found');
        await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['CUSTOM_CONTACTS']}/items/${id}`)
            .delete();
    }

    async updateGenericViewSetting(id: string, settingsJson: string): Promise<void> {
        if (!this.listIds['SETTINGS']) throw new Error('Settings list not found');

        await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['SETTINGS']}/items/${id}`)
            .patch({
                fields: {
                    Description: settingsJson // Store JSON in Description
                }
            });
    }

    async addViewSetting(item: { page: string, component: string, scope: string, settings: string }): Promise<any> {
        if (!this.listIds['SETTINGS']) throw new Error('Settings list not found');

        const payload = {
            fields: {
                PageName: item.page,
                ComponentName: item.component,
                VisibilityScope: item.scope,
                Description: item.settings
            }
        };

        const response = await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['SETTINGS']}/items`)
            .post(payload);

        return {
            id: response.id,
            ...item
        };
    }

    // --- Component Visibility Methods ---

    async getComponentVisibilitySettings(): Promise<any[]> {
        if (!this.listIds['COMPONENT_VISIBILITY']) return [];
        try {
            const response = await this.client
                .api(`/sites/${this.siteId}/lists/${this.listIds['COMPONENT_VISIBILITY']}/items`)
                .expand('fields')
                .get();

            return response.value.map((item: any) => {
                let visibleTo: string[] = [];
                try { visibleTo = JSON.parse(item.fields.VisibleTo || '[]'); } catch { /* ignore */ }
                return {
                    id: item.id,
                    settingKey: item.fields.Title,
                    page: item.fields.PageName,
                    component: item.fields.ComponentName,
                    description: item.fields.Description,
                    visibleTo,
                };
            });
        } catch (error) {
            console.error('Failed to get component visibility settings', error);
            return [];
        }
    }

    async updateComponentVisibilitySetting(itemId: string, visibleTo: string[]): Promise<void> {
        if (!this.listIds['COMPONENT_VISIBILITY']) throw new Error('Component Visibility list not found');
        await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['COMPONENT_VISIBILITY']}/items/${itemId}`)
            .patch({ fields: { VisibleTo: JSON.stringify(visibleTo) } });
    }

    async addComponentVisibilitySetting(entry: {
        settingKey: string;
        page: string;
        component: string;
        description: string;
        visibleTo: string[];
    }): Promise<any> {
        if (!this.listIds['COMPONENT_VISIBILITY']) throw new Error('Component Visibility list not found');
        const response = await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['COMPONENT_VISIBILITY']}/items`)
            .post({
                fields: {
                    Title: entry.settingKey,
                    PageName: entry.page,
                    ComponentName: entry.component,
                    Description: entry.description,
                    VisibleTo: JSON.stringify(entry.visibleTo),
                }
            });
        return {
            id: response.id,
            settingKey: entry.settingKey,
            page: entry.page,
            component: entry.component,
            description: entry.description,
            visibleTo: entry.visibleTo,
        };
    }

    async deleteComponentVisibilitySetting(itemId: string): Promise<void> {
        if (!this.listIds['COMPONENT_VISIBILITY']) throw new Error('Component Visibility list not found');
        await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['COMPONENT_VISIBILITY']}/items/${itemId}`)
            .delete();
    }

    async addKRA(kra: Partial<KRA>): Promise<KRA> {
        if (!this.listIds['KRAS']) throw new Error('KRAs list not found');

        // Write owner name to the Responsible text field (for SharePoint list display).
        // Also embed full owner object (id/name/email) into the Assignees JSON with isOwner:true
        // so the UI can reconstruct the full owner on edit without extra lookups.
        // Build the Assignees JSON: regular assignees (without isOwner) + owner entry (with isOwner).
        // If the same person is both owner AND assignee, they get TWO entries — one as regular
        // assignee (shown in "Additional Assignees") and one as owner (shown in "Owner/Lead").
        // This prevents mapKRA from filtering them out of regularAssignees.
        const cleanAssignees = ((kra.assignees as any[]) || []).map(a => {
            const { isOwner, ...rest } = a; // Strip any stale isOwner flag from regular assignees
            return rest;
        });
        const mergedAssignees: any[] = [...cleanAssignees];
        if (kra.owner) {
            mergedAssignees.push({ ...(kra.owner as any), isOwner: true });
        }

        const payload: any = {
            fields: {
                Title: kra.title,
                Responsible: kra.owner?.name || null,
                Unit: kra.unit || null,
                Division: kra.division || null,
                Status: ['completed', 'done', 'closed'].includes(kra.status?.toLowerCase() || '') ? 'Closed' : (kra.status === 'in-progress' ? 'In Progress' : 'Open'),
                Progress: kra.progress ?? 0,
                Description: kra.description,
                UnitObjectiveLookupId: kra.objective_id ? Number(kra.objective_id) : null,
                Assignees: mergedAssignees.length > 0 ? JSON.stringify(mergedAssignees) : undefined
            }
        };

        console.log('📝 [SP Ops] Adding KRA Payload:', JSON.stringify(payload, null, 2));
        try {
            // Use expand('fields') so the POST response includes all field values (incl. Assignees)
            const response = await this.client
                .api(`/sites/${this.siteId}/lists/${this.listIds['KRAS']}/items`)
                .expand('fields')
                .post(payload);
            const rawAssignees = response?.fields?.Assignees;
            console.log(`🔍 [SP Ops] POST response for new KRA — Assignees raw:`, rawAssignees);
            console.log(`🔍 [SP Ops] POST response — ALL fields:`, Object.keys(response?.fields || {}));
            if (!rawAssignees && payload.fields.Assignees) {
                console.error(`🚨 [SP Ops] ASSIGNEES COLUMN LIKELY MISSING! We sent Assignees but POST returned undefined. Run ensureAssigneesColumn from TestGround.`);
            }
            const mapped = this.mapKRA(response);
            console.log(`🔍 [SP Ops] mapKRA result — assignees:`, mapped.assignees, '| owner:', mapped.owner);
            return mapped;
        } catch (error: any) {
            console.error('❌ [SP Ops] Failed to add KRA:', error);
            if (error.body) {
                console.error('❌ [SP Ops] Error Body:', JSON.stringify(error.body, null, 2));
            }
            throw error;
        }
    }

    async updateKRA(id: string, kra: Partial<KRA>): Promise<KRA> {
        if (!this.listIds['KRAS']) throw new Error('KRAs list not found');
        const fields: any = {};
        if (kra.title !== undefined) fields.Title = kra.title;
        if (kra.owner !== undefined) fields.Responsible = kra.owner?.name || null;
        if (kra.unit !== undefined) fields.Unit = kra.unit;
        if (kra.division !== undefined) fields.Division = kra.division;
        if (kra.status !== undefined) fields.Status = ['completed', 'done', 'closed'].includes(kra.status?.toLowerCase() || '') ? 'Closed' : (kra.status === 'in-progress' ? 'In Progress' : 'Open');
        if (kra.progress !== undefined) fields.Progress = kra.progress;
        if (kra.description !== undefined) fields.Description = kra.description;
        if (kra.objective_id !== undefined) fields.UnitObjectiveLookupId = kra.objective_id ? Number(kra.objective_id) : null;
        // Rebuild Assignees JSON with owner embedded (same logic as addKRA).
        // Regular assignees get their own entries (no isOwner flag).
        // Owner gets a separate entry with isOwner:true.
        // If the same person is both, they appear twice — once as assignee, once as owner.
        if (kra.assignees !== undefined || kra.owner !== undefined) {
            const cleanAssignees = ((kra.assignees as any[]) || []).map(a => {
                const { isOwner, ...rest } = a;
                return rest;
            });
            const mergedAssignees: any[] = [...cleanAssignees];
            if (kra.owner) {
                mergedAssignees.push({ ...(kra.owner as any), isOwner: true });
            }
            fields.Assignees = JSON.stringify(mergedAssignees);
        }

        console.log(`📝 [SP Ops] Updating KRA ${id} Payload:`, JSON.stringify({ fields }, null, 2));
        try {
            // PATCH response from Graph API does not include fields by default.
            // After patching, do a GET with expand('fields') to get the full updated item
            // (including Assignees). Without this, mapKRA would return empty assignees
            // and the React Query cache would be overwritten with stale/empty data.
            await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['KRAS']}/items/${id}`).patch({ fields });
            const updated = await this.client
                .api(`/sites/${this.siteId}/lists/${this.listIds['KRAS']}/items/${id}`)
                .expand('fields')
                .get();
            const rawAssignees = updated?.fields?.Assignees;
            console.log(`🔍 [SP Ops] GET after PATCH for KRA ${id} — Assignees raw:`, rawAssignees);
            console.log(`🔍 [SP Ops] GET after PATCH — ALL fields:`, Object.keys(updated?.fields || {}));
            if (!rawAssignees && fields.Assignees) {
                console.error(`🚨 [SP Ops] ASSIGNEES COLUMN LIKELY MISSING! We sent Assignees=${fields.Assignees} but GET returned undefined. Run ensureAssigneesColumn from TestGround.`);
            }
            const mapped = this.mapKRA(updated);
            console.log(`🔍 [SP Ops] mapKRA result — assignees:`, mapped.assignees, '| owner:', mapped.owner);
            return mapped;
        } catch (error: any) {
            console.error(`❌ [SP Ops] Failed to update KRA ${id}:`, error);
            if (error.body) {
                console.error('❌ [SP Ops] Error Body:', JSON.stringify(error.body, null, 2));
            }
            throw error;
        }
    }

    async deleteKRA(id: string): Promise<void> {
        if (!this.listIds['KRAS']) throw new Error('KRAs list not found');
        await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['KRAS']}/items/${id}`).delete();
    }

    async addKPI(kpi: Partial<Kpi>): Promise<Kpi> {
        if (!this.listIds['KPIS']) throw new Error('KPIS list not found');
        const payload: any = {
            fields: {
                Title: kpi.name,
                Metric: kpi.metric,
                TargetValue: kpi.target,
                ActualValue: kpi.actual,
                Status: kpi.status === 'on-track' ? 'On Track' : (kpi.status === 'at-risk' ? 'At Risk' : (kpi.status === 'completed' ? 'Completed' : 'Behind')),
                CostAssociated: kpi.costAssociated,
                Description: kpi.description,
                StartDate: kpi.startDate ? new Date(kpi.startDate).toISOString() : null,
                EndDate: kpi.targetDate ? new Date(kpi.targetDate).toISOString() : null, // targetDate maps to EndDate
                RelatedKRALookupId: kpi.kra_id ? Number(kpi.kra_id) : null,
                CalculationType: kpi.calculationType || 'manual',
                ChecklistJSON: kpi.checklist ? JSON.stringify(kpi.checklist) : undefined
            }
        };

        if (kpi.assignees && kpi.assignees.length > 0) {
            // Assignees is a Text column storing JSON, not a true Person Lookup
            payload.fields['Assignees'] = JSON.stringify(kpi.assignees);
        }

        console.log('📝 [SP Ops] Adding KPI Payload:', JSON.stringify(payload, null, 2));
        try {
            const response = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['KPIS']}/items`).post(payload);

            // Sync KRA progress if linked
            if (kpi.kra_id) {
                await this.syncKRAProgress(kpi.kra_id.toString());
            }

            return this.mapKPI(response);
        } catch (error: any) {
            console.error('❌ [SP Ops] Failed to add KPI:', error);
            if (error.body) {
                console.error('❌ [SP Ops] Error Body:', JSON.stringify(error.body, null, 2));
            }
            throw error;
        }
    }

    async updateKPI(id: string, kpi: Partial<Kpi>): Promise<Kpi> {
        if (!this.listIds['KPIS']) throw new Error('KPIS list not found');
        const fields: any = {};
        if (kpi.name !== undefined) fields.Title = kpi.name;
        if (kpi.metric !== undefined) fields.Metric = kpi.metric;
        if (kpi.target !== undefined) fields.TargetValue = kpi.target;
        if (kpi.actual !== undefined) fields.ActualValue = kpi.actual;
        if (kpi.status !== undefined) fields.Status = kpi.status === 'on-track' ? 'On Track' : (kpi.status === 'at-risk' ? 'At Risk' : (kpi.status === 'completed' ? 'Completed' : 'Behind'));
        if (kpi.costAssociated !== undefined) fields.CostAssociated = kpi.costAssociated;
        if (kpi.description !== undefined) fields.Description = kpi.description;
        if (kpi.startDate !== undefined) fields.StartDate = kpi.startDate ? new Date(kpi.startDate).toISOString() : null;
        if (kpi.targetDate !== undefined) fields.EndDate = kpi.targetDate ? new Date(kpi.targetDate).toISOString() : null;
        if (kpi.calculationType !== undefined) fields.CalculationType = kpi.calculationType;
        if (kpi.checklist !== undefined) fields.ChecklistJSON = JSON.stringify(kpi.checklist);

        if (kpi.assignees !== undefined) {
            // Assignees is a Text column storing JSON
            fields['Assignees'] = JSON.stringify(kpi.assignees || []);
        }

        try {
            const response = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['KPIS']}/items/${id}`).patch({ fields });

            // Sync KRA progress if linked (either passed in this update or already known)
            if (kpi.kra_id) {
                await this.syncKRAProgress(kpi.kra_id.toString());
            } else {
                // Fetch the KPI to find its KRA ID if not provided in payload
                try {
                    const currentKpi = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['KPIS']}/items/${id}`).expand('fields').get();
                    const kraId = currentKpi.fields?.RelatedKRALookupId;
                    if (kraId) {
                        await this.syncKRAProgress(kraId.toString());
                    }
                } catch (e) {
                    console.warn(`[SP Ops] Could not fetch KRA ID for KPI ${id} sync`, e);
                }
            }

            return this.mapKPI(response);
        } catch (error: any) {
            console.error(`❌ [SP Ops] Failed to update KPI ${id}:`, error);
            if (error.body) {
                console.error('❌ [SP Ops] Error Body:', JSON.stringify(error.body, null, 2));
            }
            throw error;
        }
    }

    async deleteKPI(id: string): Promise<void> {
        if (!this.listIds['KPIS']) throw new Error('KPIS list not found');
        await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['KPIS']}/items/${id}`).delete();
    }

    /**
     * Syncs a KPI's checklist with its linked tasks from Operations_Tasks.
     * - Adds new task-linked checklist items for newly linked tasks
     * - Updates checked status based on task completion
     * - Removes checklist items for unlinked/deleted tasks
     * - Preserves manual (non-task) checklist items
     * - Auto-sets KPI status to 'Completed' when all items checked
     * - Auto-reverts KPI status if items become unchecked
     * - Cascades to syncKRAProgress
     * @param updatedTaskData Optional payload of the task that was just updated (to override stale Graph API fetch)
     */
    private async syncKPIChecklistFromTasks(kpiId: string, updatedTaskData?: { id: string, status?: string }): Promise<void> {
        try {
            if (!this.listIds['KPIS'] || !this.listIds['TASKS']) await this.initialize();

            // 1. Fetch the KPI item
            const kpiItem = await this.client
                .api(`/sites/${this.siteId}/lists/${this.listIds['KPIS']}/items/${kpiId}`)
                .expand('fields')
                .get();
            const kpiFields = kpiItem.fields;

            // 2. Parse existing checklist
            let checklist: ChecklistItem[] = [];
            try {
                checklist = JSON.parse(kpiFields.ChecklistJSON || '[]');
            } catch { checklist = []; }

            // 3. Fetch all tasks and filter for this KPI
            const taskResponse = await this.client
                .api(`/sites/${this.siteId}/lists/${this.listIds['TASKS']}/items`)
                .expand('fields')
                .get();

            const kpiIdNum = Number(kpiId);
            const linkedTasks = (taskResponse.value || []).filter(
                (t: any) => Number(t.fields?.RelatedKPILookupId) === kpiIdNum
            );

            // 4. Build updated checklist
            const TASK_DONE_STATUSES = ['done', 'completed'];

            // Update existing task-linked items & remove unlinked ones
            const linkedTaskIds = new Set(linkedTasks.map((t: any) => String(t.id)));
            checklist = checklist.filter(item => {
                if (!item.taskId) return true; // Keep manual items
                return linkedTaskIds.has(item.taskId); // Remove if task no longer linked
            }).map(item => {
                if (!item.taskId) return item; // Manual items unchanged
                const matchingTask = linkedTasks.find((t: any) => String(t.id) === item.taskId);
                if (!matchingTask) return item;

                // Override stale Graph API fetch if this was the freshly updated task
                const isUpdatedTask = updatedTaskData && String(matchingTask.id) === updatedTaskData.id;
                const activeStatus = isUpdatedTask && updatedTaskData.status
                    ? updatedTaskData.status
                    : matchingTask.fields.Status;

                return {
                    ...item,
                    text: matchingTask.fields.Title, // Keep title in sync
                    checked: TASK_DONE_STATUSES.includes((activeStatus || '').toLowerCase())
                };
            });

            // Add new task-linked items for tasks not yet in checklist
            const existingTaskIds = new Set(
                checklist.filter(i => i.taskId).map(i => i.taskId)
            );
            for (const task of linkedTasks) {
                if (!existingTaskIds.has(String(task.id))) {
                    const isUpdatedTask = updatedTaskData && String(task.id) === updatedTaskData.id;
                    const activeStatus = isUpdatedTask && updatedTaskData.status
                        ? updatedTaskData.status
                        : task.fields.Status;

                    checklist.push({
                        id: `task-${task.id}`,
                        text: task.fields.Title,
                        checked: TASK_DONE_STATUSES.includes((activeStatus || '').toLowerCase()),
                        taskId: String(task.id),
                        isTaskLinked: true
                    });
                }
            }

            // 5. Determine KPI status
            const allChecked = checklist.length > 0 && checklist.every(item => item.checked);
            const anyChecked = checklist.some(item => item.checked);
            const currentStatus = (kpiFields.Status || '').toLowerCase();
            let newStatus = kpiFields.Status;

            if (allChecked && checklist.length > 0) {
                newStatus = 'Completed';
            } else if (anyChecked && !allChecked) {
                // If some but not all tasks are done, make sure status isn't Not Started or Completed
                if (['not-started', 'not started', 'completed', 'done'].includes(currentStatus)) {
                    newStatus = 'In Progress';
                }
            } else if (!anyChecked && checklist.length > 0) {
                // Was completed but now nothing is checked — revert
                if (['completed', 'done'].includes(currentStatus)) {
                    newStatus = 'In Progress';
                }
            }

            // 6. Update KPI in SharePoint
            const updateFields: any = {
                ChecklistJSON: JSON.stringify(checklist),
            };

            // Auto-set calculationType to checklist when tasks are linked
            if (linkedTasks.length > 0) {
                updateFields.CalculationType = 'checklist';
            }

            if (newStatus !== kpiFields.Status) {
                updateFields.Status = newStatus;
            }

            await this.client
                .api(`/sites/${this.siteId}/lists/${this.listIds['KPIS']}/items/${kpiId}`)
                .patch({ fields: updateFields });

            console.log(`✅ [SP Ops] Synced KPI ${kpiId} checklist from tasks. ${linkedTasks.length} linked tasks, ${checklist.length} total items.`);

            // 7. Cascade: sync KRA progress
            const kraId = kpiFields.RelatedKRALookupId;
            if (kraId) {
                await this.syncKRAProgress(String(kraId));
            }
        } catch (error) {
            console.error(`❌ [SP Ops] Failed to sync KPI ${kpiId} checklist from tasks:`, error);
        }
    }

    /**
     * Recalculates and updates the Progress column of a KRA based on its linked KPIs.
     */
    private async syncKRAProgress(kraId: string): Promise<void> {
        try {
            if (!this.listIds['KRAS'] || !this.listIds['KPIS']) await this.initialize();

            // 0. Small delay to allow SharePoint indexing (Graph API filter lag)
            await new Promise(resolve => setTimeout(resolve, 500));

            // 1. Fetch all KPIs and filter client-side.
            // Note: Graph API returns HTTP 400 when using $filter on SharePoint lookup columns,
            // so we cannot use server-side filtering here. Fetch all and filter locally.
            const kpiResponse = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['KPIS']}/items`)
                .expand('fields')
                .get();

            const kraIdNum = Number(kraId);
            const kpiItems = (kpiResponse.value || []).filter((item: any) => {
                const lookupId = item.fields?.RelatedKRALookupId;
                return Number(lookupId) === kraIdNum;
            });

            // 2. Calculate progress strictly from KPI completion status.
            // KRA progress = % of KPIs that have a "completed" status. Nothing else affects it.
            const COMPLETED_STATUSES = ['completed', 'achieved', 'done'];
            const mappedKpis = kpiItems.map((item: any) => this.mapKPI(item));
            const completedCount = mappedKpis.filter((kpi: any) =>
                COMPLETED_STATUSES.includes((kpi.status || '').toLowerCase())
            ).length;
            const newProgress = mappedKpis.length > 0 ? Math.round((completedCount / mappedKpis.length) * 100) : 0;

            console.log(`[SP Ops] Syncing KRA ${kraId}: ${mappedKpis.length} KPIs found. Calculated progress: ${newProgress}%`);

            // 4. Update SharePoint KRA list
            const fields: any = { Progress: newProgress };

            // If progress is 100%, also close the KRA status in the backend
            if (newProgress === 100) {
                fields.Status = 'Closed';
            } else if (newProgress > 0) {
                fields.Status = 'Open';
            }

            await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['KRAS']}/items/${kraId}`).patch({ fields });

            console.log(`✅ [SP Ops] Successfully synced KRA ${kraId} progress (${newProgress}%) and status (${fields.Status || 'Unchanged'}) to SharePoint.`);

            // 5. Cascade to Objective
            try {
                const kraItem = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['KRAS']}/items/${kraId}`).expand('fields').get();
                const objectiveId = kraItem.fields?.UnitObjectiveLookupId;
                if (objectiveId) {
                    await this.syncObjectiveProgress(objectiveId.toString());
                }
            } catch (e) {
                console.warn(`[SP Ops] Could not cascade KRA ${kraId} sync to Objective`, e);
            }
        } catch (error) {
            console.error(`❌ [SP Ops] Failed to sync KRA ${kraId} progress:`, error);
        }
    }

    // Debugging Helper
    async debugListColumns(listKey: string): Promise<void> {
        // Resolve list ID from key (e.g. 'Performance_KRAs') or use the map key if passed
        // The listKey argument here is likely the KEY in OPS_CONFIG.LISTS (e.g. 'KRAS' or 'TASKS') OR the actual name
        // Let's try to find the ID.
        let listId = this.listIds[listKey];
        if (!listId) {
            // Try to find by config value
            const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '');
            const target = normalize(listKey);
            // Verify against valid keys
            const validKey = Object.keys(this.listIds).find(k => k === listKey);
            if (validKey) listId = this.listIds[validKey];
            else {
                // Try looking up in config
                const configEntry = Object.entries(OPS_CONFIG.LISTS).find(([k, v]) => v === listKey || k === listKey);
                if (configEntry) {
                    // Map config key to listId key (which is uppercase keys of OPS_CONFIG.LISTS in my implementation? verify resolveListIds)
                    // resolveListIds maps normalize(list.displayName) -> key
                    // So if I pass 'Performance_KRAs', I need to find the ID.
                    // Let's just iterate listIds and check display names? No, listIds keys are KRAS, KPIS, etc.
                    // If passes 'Performance_KRAs', that matches user display name.
                    // Simpler: Just rely on the keys I know: 'KRAS', 'TASKS'.
                    // If the caller passes 'Performance_KRAs', I'll map it manually or just ask for 'KRAS'.
                    // But let's support the raw name too if possible, or just fail gracefully.
                    if (listKey === 'Performance_KRAs') listId = this.listIds['KRAS'];
                    else if (listKey === 'Operations_Tasks') listId = this.listIds['TASKS'];
                }
            }
        }

        if (!listId) {
            console.warn(`⚠️ [SP Ops] debugListColumns: List '${listKey}' not found in resolved IDs.`);
            return;
        }

        try {
            const columns = await this.client
                .api(`/sites/${this.siteId}/lists/${listId}/columns`)
                .get(); // Remove select to get EVERYTHING

            console.log(`🔍 [SP Ops] --- Columns for ${listKey} ---`);
            const helpful = columns.value.map((c: any) => ({
                InternalName: c.name,
                DisplayName: c.displayName,
                Type: c.typeAsString, // Included
                Hidden: c.hidden,
                Lookup: c.lookup // Included
            })).filter((c: any) => !c.Hidden && !c.InternalName.startsWith('_'));
            console.table(helpful);

            // Inspect RelatedProject specifically
            const projCol = columns.value.find((c: any) => c.name === 'RelatedProject');
            if (projCol) {
                // console.log(`🔍 [SP Ops] 'RelatedProject' Column Details:`, JSON.stringify(projCol, null, 2));
            }

            console.log(`-------------------------------------------`);
        } catch (e) {
            console.error(`❌ [SP Ops] Failed to fetch columns for ${listKey}`, e);
        }
    }

    // --- Mappers ---

    private mapObjective(item: any): Objective {
        const f = item.fields;
        return {
            id: item.id,
            title: f.Title,
            description: f.Description || '',
            status: f.Status,
            progress: f.Progress,
            year: f.Year,
            startDate: f.StartDate ? new Date(f.StartDate) : undefined,
            endDate: f.EndDate ? new Date(f.EndDate) : undefined,
            goalType: f.GoalType,
            division: f.Division,
            unit: f.Unit,
            owner: f.Owner, // Text field usually, or expand if person
            parentGoalId: f.ParentGoalIdLookupId,
            parentGoalTitle: f.ParentGoalIdLookupValue,
            icon: f.Icon,
            isFeatured: f.IsFeatured === true || f.IsFeatured === 1 || f.IsFeatured === "1",
            deliverables: f.Deliverables ? f.Deliverables.split(',').map((s: string) => s.trim()) : [],
            linkedDeliverable: f.LinkedDeliverable
        };
    }

    private mapKRA(item: any): KRA {
        const f = item.fields;

        // Map Assignees from JSON String (Text field)
        let assignees: any[] = [];
        try {
            if (f.Assignees) {
                assignees = JSON.parse(f.Assignees);
            }
        } catch (e) {
            console.warn(`[SP Ops] Failed to parse Assignees JSON for KRA ${item.id}`, e);
        }

        // Primary: reconstruct owner from isOwner flag in Assignees JSON (full id/name/email).
        // Fallback: use the Responsible text field (name only) for display if Assignees has no owner entry.
        const ownerEntry = assignees.find((a: any) => a.isOwner === true) || null;
        const ownerObj = ownerEntry
            ? { id: ownerEntry.id, name: ownerEntry.name || ownerEntry.displayName || '', email: ownerEntry.email || ownerEntry.mail || '' }
            : (f.Responsible ? { id: '', name: f.Responsible, email: '' } : null);
        // Expose non-owner assignees separately for display
        const regularAssignees = assignees.filter((a: any) => !a.isOwner);

        return {
            id: item.id,
            title: f.Title,
            department: f.Unit || null,
            unit: f.Unit || null,
            division: f.Division || null,
            status: (f.Status?.toLowerCase() || 'open').replace(' ', '-') as any,
            progress: f.Progress || 0,
            objective_id: f.UnitObjectiveLookupId?.toString(),
            objectiveName: f.UnitObjectiveLookupId ? 'Loading...' : 'N/A',
            responsible: ownerObj?.name || f.Responsible || 'Unassigned',
            kpis: [],
            owner: ownerObj,
            ownerId: ownerObj?.id || null,
            // Graph API returns createdBy.user.email natively on every list item — no extra query needed
            createdByEmail: item.createdBy?.user?.email || '',
            assignees: regularAssignees,
            unitKpis: [],
            unitObjectives: null,
            name: f.Title,
            objectiveId: f.UnitObjectiveLookupId?.toString() ?? '',
            endDate: f.EndDate ? new Date(f.EndDate) : new Date(),
            createdAt: item.createdDateTime,
            updatedAt: item.lastModifiedDateTime,
            description: f.Description || '',
        };
    }

    private mapKPI(item: any): Kpi {
        const f = item.fields;

        let assignees: any[] = [];
        try {
            if (f.Assignees) {
                assignees = JSON.parse(f.Assignees);
            }
        } catch (e) {
            console.warn(`[SP Ops] Failed to parse Assignees JSON for KPI ${item.id}`, e);
        }

        return {
            id: item.id,
            name: f.Title,
            metric: f.Metric || '#',
            actual: f.ActualValue || 0,
            target: f.TargetValue || 0,
            status: (f.Status?.toLowerCase() || 'on-track').replace(' ', '-') as any,
            kra_id: f.RelatedKRALookupId?.toString(),
            assignees: assignees,
            unit: '',
            progress: 0,
            costAssociated: f.CostAssociated || 0,
            description: f.Description || '',
            startDate: f.StartDate || null,
            targetDate: f.EndDate || null,
            calculationType: (f.CalculationType as any) || 'manual',
            checklist: f.ChecklistJSON ? JSON.parse(f.ChecklistJSON) : [],
        };
    }
    async addProject(project: Partial<Project>): Promise<Project> {
        if (!this.listIds['PROJECTS']) throw new Error('Projects list not found');
        const payload: any = {
            fields: {
                Title: project.name,
                Description: project.isCustomGroup ? `__CUSTOM_GROUP__ ${project.description || ''}` : project.description,
                Status: project.status === 'in-progress' ? 'In Progress' : (project.status === 'completed' ? 'Completed' : 'Planned'),
                StartDate: project.startDate ? new Date(project.startDate).toISOString() : null,
                EndDate: project.endDate ? new Date(project.endDate).toISOString() : null,
                Department: project.unit_id || 'General',
                Budget: project.budget || 0,
                BudgetSpent: project.budgetSpent || 0,
                RisksJSON: JSON.stringify(project.risks || []),
                Manager: project.manager,
                Assignees: project.assignees ? JSON.stringify(project.assignees) : undefined,
            }
        };

        const response = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['PROJECTS']}/items`).post(payload);
        return this.mapProject(response);
    }

    async deleteProject(id: string): Promise<void> {
        if (!this.listIds['PROJECTS']) throw new Error('Projects list not found');
        await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['PROJECTS']}/items/${id}`).delete();
    }

    private mapProject(item: any): Project {
        const f = item.fields;
        const description = f.Description || '';
        const isCustomGroup = description.includes('__CUSTOM_GROUP__');
        const cleanDescription = isCustomGroup ? description.replace('__CUSTOM_GROUP__', '').trim() : description;

        return {
            id: item.id,
            name: f.Title,
            description: cleanDescription,
            status: (f.Status?.toLowerCase() as any) || 'planned',
            startDate: f.StartDate ? new Date(f.StartDate) : new Date(),
            endDate: f.EndDate ? new Date(f.EndDate) : new Date(),
            manager: f.Manager || 'Unassigned',
            budget: f.Budget || 0,
            budgetSpent: f.BudgetSpent || 0,
            progress: 0,
            risks: f.RisksJSON ? JSON.parse(f.RisksJSON) : [],
            tasks: [],
            unit_id: f.Department,
            isCustomGroup: isCustomGroup,
            authorEmail: item.createdBy?.user?.email || item.lastModifiedBy?.user?.email,
            assignees: this.parseAssignees(f.Assignees)
            // Removed kra_id as it does not exist on Project type
        };
    }

    private mapTask(item: any): Task {
        const f = item.fields;
        const tags = f.Tags ? f.Tags.split(',') : [];

        // Determine Project/Group ID:
        // Buckets come from Task Groups, so prefer RelatedTaskGroupLookupId
        // Fall back to RelatedProjectLookupId for backwards compatibility
        // Last resort: 'bucket:ID' found in Tags
        let groupId = f.RelatedTaskGroupLookupId?.toString();
        let projectId = groupId || f.RelatedProjectLookupId?.toString();
        if (!projectId) {
            // legacy fallback
            projectId = this.getBucketIdFromTags(tags);
        }

        // Extract creator from Graph API response
        // SharePoint Graph items have createdBy -> user -> email/displayName
        const createdByEmail = item.createdBy?.user?.email ||
            item.lastModifiedBy?.user?.email ||
            '';
        const createdByName = item.createdBy?.user?.displayName ||
            item.lastModifiedBy?.user?.displayName ||
            'Unknown';

        return {
            id: item.id,
            title: f.Title,
            description: f.Description || '',
            status: (f.Status?.toLowerCase() === 'done' ? 'completed' :
                f.Status?.toLowerCase() === 'review' ? 'in-review' :
                    f.Status?.toLowerCase() === 'todo' ? 'todo' :
                        f.Status?.toLowerCase().replace(/\s+/g, '-') || 'todo') as any,
            priority: (f.Priority?.toLowerCase() || 'medium') as any,
            assignee: f.AssignedToLookupId || 'Unassigned',
            // Normalize to yyyy-MM-dd so <input type="date"> works correctly
            dueDate: f.DueDate ? f.DueDate.split('T')[0] : '',
            startDate: f.StartDate ? new Date(f.StartDate) : undefined,
            subtasks: f.SubtasksJSON ? JSON.parse(f.SubtasksJSON) : [],
            comments: f.CommentsJSON ? JSON.parse(f.CommentsJSON) : [],
            tags: tags,
            projectId: projectId, // Use our resolved ID
            groupId: groupId,
            kra_id: f.RelatedKRALookupId?.toString(),
            kpi_id: f.RelatedKPILookupId?.toString(),
            unit_id: f.Department,
            // Computed/Optional
            completed: f.Status === 'Done' || tags.includes('completed'),
            createdAt: item.createdDateTime,
            completedAt: (f.Status === 'Done' || tags.includes('completed')) ? item.lastModifiedDateTime : undefined,
            completionDate: f.CompletionDate || undefined, // New field mapping
            assignees: this.parseAssignees(f.Assignees),
            // Map creator fields
            createdByEmail: createdByEmail,
            createdBy: createdByName, // Mapped to Task.createdBy
            authorEmail: createdByEmail, // Alias
            // Per-assignee board placement map
            assigneeViewMap: (() => { try { return f.AssigneeViewMap ? JSON.parse(f.AssigneeViewMap) : undefined; } catch { return undefined; } })(),
            attachments: (() => { try { return f.AttachmentsJSON ? JSON.parse(f.AttachmentsJSON) : undefined; } catch { return undefined; } })(),
        };
    }

    private parseAssignees(assigneesField: string): any[] {
        try {
            if (assigneesField) {
                return JSON.parse(assigneesField);
            }
        } catch (e) {
            console.error('[SP Ops] Failed to parse Assignees', e);
        }
        return [];
    }



    private mapRisk(item: any): Risk {
        const f = item.fields;
        return {
            id: item.id,
            title: f.Title,
            description: f.Description || '',
            status: (f.Status?.toLowerCase() || 'identified') as any,
            impact: (f.Impact?.toLowerCase() || 'low') as any,
            likelihood: (f.Likelihood?.toLowerCase() || 'low') as any,
            category: f.Category || 'Operational',
            owner: f.OwnerLookupId || 'Unassigned',
            identificationDate: item.createdDateTime ? new Date(item.createdDateTime) : new Date(),
            mitigationPlan: f.MitigationPlan,
            createdAt: item.createdDateTime ? new Date(item.createdDateTime) : new Date(),
            updatedAt: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : new Date(),
            unit_id: f.Department,
            division_id: f.Department // Assuming division == department for now
        };
    }

    // --- Reports ---

    async createReportsList(): Promise<void> {
        const listKey = 'REPORTS';
        const listName = OPS_CONFIG.LISTS[listKey]; // Performance_Reports

        console.log(`🔨 [SP Ops] Ensuring list '${listName}' exists...`);

        if (!this.siteId) await this.initialize();

        // Check if list exists
        let listId = this.listIds[listKey];
        if (!listId) {
            try {
                // Try to fetch it just in case
                const existing = await this.client.api(`/sites/${this.siteId}/lists/${listName}`).get();
                this.listIds[listKey] = existing.id;
                listId = existing.id;
                console.log(`✅ [SP Ops] List '${listName}' already exists.`);
            } catch (e: any) {
                if (e.statusCode === 404) {
                    // Create it
                    console.log(`✨ [SP Ops] Creating list '${listName}'...`);
                    const newList = await this.client.api(`/sites/${this.siteId}/lists`).post({
                        displayName: listName,
                        columns: [
                            { name: 'ReportType', text: {} },        // Template ID or Type
                            { name: 'GeneratedBy', text: {} },       // User Email
                            { name: 'StartDate', dateTime: {} },     // Reporting Period Start
                            { name: 'EndDate', dateTime: {} },       // Reporting Period End
                            { name: 'ContentJSON', text: { allowMultipleLines: true } }, // Full Report Data
                            { name: 'AIAnalysis', boolean: {} },     // Is AI Generated?
                            { name: 'Status', choice: { choices: ['Generated', 'Draft', 'Archived'] } }
                        ],
                        list: {
                            template: 'genericList'
                        }
                    });
                    this.listIds[listKey] = newList.id;
                    listId = newList.id;
                    console.log(`✅ [SP Ops] List '${listName}' created.`);
                } else {
                    throw e;
                }
            }
        }
    }

    // --- Report Schedules ---

    async createReportSchedulesList(): Promise<void> {
        const listKey = 'REPORT_SCHEDULES';
        const listName = OPS_CONFIG.LISTS[listKey];

        console.log(`[SP Ops] Ensuring list '${listName}' exists...`);

        if (!this.siteId) await this.initialize();

        let listId = this.listIds[listKey];
        if (!listId) {
            try {
                const existing = await this.client.api(`/sites/${this.siteId}/lists/${listName}`).get();
                this.listIds[listKey] = existing.id;
                listId = existing.id;
                console.log(`[SP Ops] List '${listName}' already exists.`);
            } catch (e: any) {
                if (e.statusCode === 404) {
                    console.log(`[SP Ops] Creating list '${listName}'...`);
                    const newList = await this.client.api(`/sites/${this.siteId}/lists`).post({
                        displayName: listName,
                        columns: [
                            { name: 'UserEmail', text: {} },
                            { name: 'Division', text: {} },
                            { name: 'Unit', text: {} },
                            { name: 'TimePeriod', text: {} },              // daily, weekly, monthly, quarterly, half-yearly, yearly, custom
                            { name: 'Categories', text: { allowMultipleLines: true } }, // JSON array e.g. ["tasks","kras"]
                            { name: 'IsActive', text: {} },                // "true" or "false"
                            { name: 'PreferredTime', text: {} },           // 24hr format e.g. "07:00"
                            { name: 'PreferredDay', text: {} },            // For weekly: "Monday", etc.
                            { name: 'PreferredDayOfMonth', text: {} },     // For monthly+: "1", "15", etc.
                            { name: 'LastSentAt', dateTime: {} },
                            { name: 'NextSendAt', dateTime: {} },
                            { name: 'ManagerEmail', text: {} },
                            { name: 'CustomStartDate', dateTime: {} },     // For custom: fixed start date
                            { name: 'CustomEndDate', dateTime: {} },       // For custom: fixed end date
                            { name: 'RollingWindowDays', text: {} },       // For custom rolling: window size e.g. "45"
                            { name: 'CustomIntervalDays', text: {} },      // For custom rolling: recurrence interval e.g. "14"
                            { name: 'IsOneTime', text: {} },               // For custom: "true" or "false"
                        ],
                        list: { template: 'genericList' }
                    });
                    this.listIds[listKey] = newList.id;
                    listId = newList.id;
                    console.log(`[SP Ops] List '${listName}' created.`);
                } else {
                    throw e;
                }
            }
        }
    }

    async getAllReportSchedules(): Promise<any[]> {
        if (!this.listIds['REPORT_SCHEDULES']) {
            try { await this.createReportSchedulesList(); } catch { return []; }
        }
        const listId = this.listIds['REPORT_SCHEDULES'];
        if (!listId) return [];

        try {
            const response = await this.client
                .api(`/sites/${this.siteId}/lists/${listId}/items`)
                .expand('fields')
                .top(100)
                .get();

            if (response.value) {
                return response.value.map((item: any) => ({ id: item.id, ...item.fields }));
            }
            return [];
        } catch (e) {
            console.error('[SP Ops] Failed to get all report schedules:', e);
            return [];
        }
    }

    async deleteReportSchedule(itemId: string): Promise<void> {
        if (!this.listIds['REPORT_SCHEDULES']) {
            await this.createReportSchedulesList();
        }
        const listId = this.listIds['REPORT_SCHEDULES'];

        await this.client
            .api(`/sites/${this.siteId}/lists/${listId}/items/${itemId}`)
            .delete();
    }

    async getReportSchedule(userEmail: string): Promise<any | null> {
        if (!this.listIds['REPORT_SCHEDULES']) {
            try { await this.createReportSchedulesList(); } catch { return null; }
        }
        const listId = this.listIds['REPORT_SCHEDULES'];
        if (!listId) return null;

        try {
            const response = await this.client
                .api(`/sites/${this.siteId}/lists/${listId}/items`)
                .filter(`fields/UserEmail eq '${userEmail}'`)
                .expand('fields')
                .top(1)
                .get();

            if (response.value && response.value.length > 0) {
                const item = response.value[0];
                return { id: item.id, ...item.fields };
            }
            return null;
        } catch (e) {
            console.error('[SP Ops] Failed to get report schedule:', e);
            return null;
        }
    }

    async saveReportSchedule(schedule: {
        userEmail: string;
        userName: string;
        division: string;
        unit: string;
        timePeriod: string;
        categories: string[];
        isActive: boolean;
        preferredTime: string;
        preferredDay: string;
        preferredDayOfMonth: string;
        managerEmail?: string;
        customStartDate?: string;
        customEndDate?: string;
        rollingWindowDays?: string;
        customIntervalDays?: string;
        isOneTime?: boolean;
    }): Promise<any> {
        if (!this.listIds['REPORT_SCHEDULES']) {
            await this.createReportSchedulesList();
        }
        const listId = this.listIds['REPORT_SCHEDULES'];

        // Calculate NextSendAt
        const nextSend = this.calculateNextSendAt(
            schedule.timePeriod,
            schedule.preferredTime,
            schedule.preferredDay,
            schedule.preferredDayOfMonth,
            schedule.timePeriod === 'custom' ? {
                isOneTime: schedule.isOneTime,
                customIntervalDays: schedule.customIntervalDays,
            } : undefined
        );

        const fields: Record<string, any> = {
            Title: schedule.userName,
            UserEmail: schedule.userEmail,
            Division: schedule.division,
            Unit: schedule.unit,
            TimePeriod: schedule.timePeriod,
            Categories: JSON.stringify(schedule.categories),
            IsActive: schedule.isActive ? 'true' : 'false',
            PreferredTime: schedule.preferredTime,
            PreferredDay: schedule.preferredDay,
            PreferredDayOfMonth: schedule.preferredDayOfMonth,
            NextSendAt: nextSend.toISOString(),
            ManagerEmail: schedule.managerEmail || '',
        };

        // Custom date range fields
        if (schedule.timePeriod === 'custom') {
            fields.IsOneTime = schedule.isOneTime ? 'true' : 'false';
            if (schedule.customStartDate) fields.CustomStartDate = schedule.customStartDate;
            if (schedule.customEndDate) fields.CustomEndDate = schedule.customEndDate;
            if (schedule.rollingWindowDays) fields.RollingWindowDays = schedule.rollingWindowDays;
            if (schedule.customIntervalDays) fields.CustomIntervalDays = schedule.customIntervalDays;
        }

        // Check if schedule already exists for this user
        const existing = await this.getReportSchedule(schedule.userEmail);

        if (existing) {
            // Update
            await this.client
                .api(`/sites/${this.siteId}/lists/${listId}/items/${existing.id}/fields`)
                .patch(fields);
            return { id: existing.id, ...fields };
        } else {
            // Create
            const result = await this.client
                .api(`/sites/${this.siteId}/lists/${listId}/items`)
                .post({ fields });
            return { id: result.id, ...fields };
        }
    }

    private calculateNextSendAt(
        period: string,
        preferredTime: string,
        preferredDay: string,
        preferredDayOfMonth: string,
        extraParams?: { isOneTime?: boolean; customIntervalDays?: string }
    ): Date {
        const [hours, minutes] = (preferredTime || '07:00').split(':').map(Number);
        const now = new Date();
        const next = new Date();
        next.setHours(hours, minutes, 0, 0);

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        switch (period) {
            case 'daily':
                // If today's time has passed, schedule for tomorrow
                if (next <= now) next.setDate(next.getDate() + 1);
                break;

            case 'weekly': {
                const targetDay = dayNames.indexOf(preferredDay || 'Monday');
                const currentDay = now.getDay();
                let daysUntil = targetDay - currentDay;
                if (daysUntil < 0) daysUntil += 7;
                if (daysUntil === 0 && next <= now) daysUntil = 7;
                next.setDate(now.getDate() + daysUntil);
                break;
            }

            case 'monthly': {
                const dayOfMonth = parseInt(preferredDayOfMonth || '1', 10);
                next.setDate(dayOfMonth);
                if (next <= now) next.setMonth(next.getMonth() + 1);
                break;
            }

            case 'quarterly': {
                const dayOfMonth = parseInt(preferredDayOfMonth || '1', 10);
                const quarterStarts = [0, 3, 6, 9]; // Jan, Apr, Jul, Oct
                const currentMonth = now.getMonth();
                const nextQuarter = quarterStarts.find(m => m > currentMonth) ?? quarterStarts[0] + 12;
                next.setMonth(nextQuarter >= 12 ? nextQuarter - 12 : nextQuarter);
                if (nextQuarter >= 12) next.setFullYear(next.getFullYear() + 1);
                next.setDate(dayOfMonth);
                if (next <= now) next.setMonth(next.getMonth() + 3);
                break;
            }

            case 'half-yearly': {
                const dayOfMonth = parseInt(preferredDayOfMonth || '1', 10);
                const currentMonth = now.getMonth();
                const nextHalf = currentMonth < 6 ? 6 : 0;
                next.setMonth(nextHalf);
                if (nextHalf === 0) next.setFullYear(next.getFullYear() + 1);
                next.setDate(dayOfMonth);
                if (next <= now) next.setMonth(next.getMonth() + 6);
                break;
            }

            case 'yearly': {
                const dayOfMonth = parseInt(preferredDayOfMonth || '1', 10);
                next.setMonth(0); // January
                next.setDate(dayOfMonth);
                if (next <= now) next.setFullYear(next.getFullYear() + 1);
                break;
            }

            case 'custom': {
                if (extraParams?.isOneTime) {
                    // One-time: send once at preferred time, tomorrow if time already passed
                    if (next <= now) next.setDate(next.getDate() + 1);
                } else {
                    // Rolling: next send = now + customIntervalDays
                    const intervalDays = parseInt(extraParams?.customIntervalDays || '14', 10);
                    next.setDate(next.getDate() + intervalDays);
                }
                break;
            }

            default:
                next.setDate(next.getDate() + 1);
        }

        return next;
    }

    async saveReport(report: Omit<Report, 'id'>): Promise<Report> {
        if (!this.listIds['REPORTS']) {
            await this.createReportsList();
        }

        const payload = {
            fields: {
                Title: report.name,
                ReportType: report.template_id,
                GeneratedBy: report.created_by,
                StartDate: report.date_range.start_date,
                EndDate: report.date_range.end_date,
                ContentJSON: JSON.stringify(report.content),
                AIAnalysis: (report.content.metadata as any).ai_generated || false,
                Status: 'Generated'
            }
        };

        const response = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['REPORTS']}/items`).post(payload);

        // Return dummy Report object with new ID
        // Note: We aren't mapping back from SP response fully here, just returning what we saved + ID
        return {
            ...report,
            id: response.id
        } as Report;
    }

    async getReports(limit: number = 50): Promise<Report[]> {
        console.log(`📥 [SP Ops] Fetching reports...`);
        if (!this.listIds['REPORTS']) await this.initialize();
        if (!this.listIds['REPORTS']) {
            console.warn(`⚠️ [SP Ops] Reports list not found, returning empty array.`);
            return [];
        }

        try {
            const response = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['REPORTS']}/items`)
                .expand('fields')
                .top(limit)
                .orderby('createdDateTime desc')
                .get();

            return response.value.map((item: any) => this.mapReport(item));
        } catch (e) {
            console.error(`❌ [SP Ops] Failed to fetch reports`, e);
            return [];
        }
    }

    private mapReport(item: any): Report {
        const f = item.fields;
        if (!f) return { id: item.id, name: 'Error: No fields', template_id: '', content: { sections: [], metadata: { generated_at: '', version: '' } }, created_by: '', created_at: '', date_range: { start_date: '', end_date: '' }, ai_analysis: false };

        let content: any = { sections: [], metadata: { generated_at: '', version: '' } };

        try {
            if (f.ContentJSON) {
                content = JSON.parse(f.ContentJSON);
            }
        } catch (e) {
            console.error(`❌ [SP Ops] Failed to parse Report ContentJSON for ${item.id}`, e);
        }

        return {
            id: item.id,
            name: f.Title,
            template_id: f.ReportType,
            content: content,
            created_by: f.GeneratedBy,
            created_at: item.createdDateTime,
            date_range: {
                start_date: f.StartDate ? new Date(f.StartDate).toISOString() : '',
                end_date: f.EndDate ? new Date(f.EndDate).toISOString() : ''
            },
            ai_analysis: f.AIAnalysis,
            // ai_insights:  // Not storing this separately yet, might be in ContentJSON
        };
    }
    // --- Task Groups ---

    async getTaskGroups(): Promise<TaskGroup[]> {
        console.log(`📥 [SP Ops] Fetching Task Groups...`);
        if (!this.siteId) await this.initialize();
        if (!this.listIds['TASK_GROUPS']) {
            console.warn('⚠️ [SP Ops] Task Groups list not found');
            return [];
        }

        try {
            const response = await this.client
                .api(`/sites/${this.siteId}/lists/${this.listIds['TASK_GROUPS']}/items`)
                .expand('fields')
                .get();

            return response.value.map((item: any) => this.mapTaskGroup(item));
        } catch (error) {
            console.error('❌ [SP Ops] Failed to fetch Task Groups:', error);
            throw error;
        }
    }

    async addTaskGroup(group: Partial<TaskGroup>): Promise<TaskGroup> {
        if (!this.listIds['TASK_GROUPS']) throw new Error('Task Groups list not found');
        const fields: any = {
            Title: group.name,
            Description: group.description || '',
            Status: group.status === 'in-progress' ? 'In Progress' : (group.status === 'completed' ? 'Completed' : 'Planned'),
            Department: group.department || '',
            Order: group.order || 0,
        };
        // Only include OwnerEmail when it has a value (avoids errors if column doesn't exist yet)
        if (group.ownerEmail) {
            fields.OwnerEmail = group.ownerEmail;
        }
        const payload = { fields };

        const response = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['TASK_GROUPS']}/items`).post(payload);
        return this.mapTaskGroup(response);
    }

    async updateTaskGroup(id: string, updates: Partial<TaskGroup>): Promise<TaskGroup> {
        if (!this.listIds['TASK_GROUPS']) throw new Error('Task Groups list not found');
        const fields: any = {};
        if (updates.name !== undefined) fields.Title = updates.name;
        if (updates.description !== undefined) fields.Description = updates.description;
        if (updates.status !== undefined) fields.Status = updates.status === 'in-progress' ? 'In Progress' : (updates.status === 'completed' ? 'Completed' : 'Planned');
        if (updates.department !== undefined) fields.Department = updates.department;
        if (updates.order !== undefined) fields.Order = updates.order;

        const response = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['TASK_GROUPS']}/items/${id}`).patch({ fields });
        return this.mapTaskGroup(response);
    }

    async deleteTaskGroup(id: string): Promise<void> {
        if (!this.listIds['TASK_GROUPS']) throw new Error('Task Groups list not found');
        await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['TASK_GROUPS']}/items/${id}`).delete();
    }

    private mapTaskGroup(item: any): TaskGroup {
        const f = item.fields;
        return {
            id: item.id,
            name: f.Title,
            description: f.Description || '',
            status: (f.Status?.toLowerCase().replace(' ', '-') as any) || 'planned',
            department: f.Department || '',
            order: f.Order || 0,
            authorEmail: item.createdBy?.user?.email || item.lastModifiedBy?.user?.email || '',
            ownerEmail: f.OwnerEmail || '',
            createdAt: item.createdDateTime,
            updatedAt: item.lastModifiedDateTime,
        };
    }

    /**
     * Recalculates and updates the Progress and Status columns of a Unit Objective based on its linked KRAs.
     */
    private async syncObjectiveProgress(objectiveId: string): Promise<void> {
        try {
            if (!this.listIds['OBJECTIVES'] || !this.listIds['KRAS']) await this.initialize();

            // 1. Fetch all KRAs linked to this Objective
            const kraResponse = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['KRAS']}/items`)
                .expand('fields')
                .get();

            const objectiveIdNum = Number(objectiveId);
            const linkedKras = (kraResponse.value || []).filter((item: any) => {
                const lookupId = item.fields?.UnitObjectiveLookupId;
                return Number(lookupId) === objectiveIdNum;
            });

            if (linkedKras.length === 0) return;

            // 2. Calculate average progress
            const totalProgress = linkedKras.reduce((sum, item) => sum + (item.fields?.Progress || 0), 0);
            const avgProgress = Math.round(totalProgress / linkedKras.length);

            // 3. Determine status
            let status = 'Not Started';
            if (avgProgress === 100) {
                status = 'Completed';
            } else if (avgProgress > 0) {
                status = 'In Progress';
            }

            console.log(`[SP Ops] Syncing Objective ${objectiveId}: Avg Progress ${avgProgress}%, Status ${status}`);

            // 4. Update SharePoint Objective list
            await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['OBJECTIVES']}/items/${objectiveId}`).patch({
                fields: {
                    Progress: avgProgress,
                    Status: status
                }
            });

            console.log(`✅ [SP Ops] Successfully synced Objective ${objectiveId} to SharePoint.`);
        } catch (error) {
            console.error(`❌ [SP Ops] Failed to sync Objective ${objectiveId}:`, error);
        }
    }

    // ─── WorkPlan CRUD ─────────────────────────────────────────────────────────

    async getWorkPlans(divisionId: string): Promise<WorkPlan[]> {
        if (!this.listIds['WORKPLANS']) return [];
        try {
            const response = await this.client
                .api(`/sites/${this.siteId}/lists/${this.listIds['WORKPLANS']}/items`)
                .expand('fields')
                .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
                .filter(`fields/DivisionId eq '${divisionId}'`)
                .get();
            return (response.value || []).map((item: any) => this.mapWorkPlan(item));
        } catch (error) {
            console.error('❌ [SP Ops] getWorkPlans failed:', error);
            return [];
        }
    }

    async addWorkPlan(plan: Partial<WorkPlan>): Promise<WorkPlan> {
        if (!this.listIds['WORKPLANS']) throw new Error('WorkPlans list not found');
        const payload = { fields: this.buildWorkPlanFields(plan) };
        console.log('📝 [SP Ops] Adding WorkPlan:', plan.title);
        const response = await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['WORKPLANS']}/items`)
            .expand('fields')
            .post(payload);
        return this.mapWorkPlan(response);
    }

    async updateWorkPlan(id: string, plan: Partial<WorkPlan>): Promise<WorkPlan> {
        if (!this.listIds['WORKPLANS']) throw new Error('WorkPlans list not found');
        const fields = this.buildWorkPlanFields(plan);
        console.log(`📝 [SP Ops] Updating WorkPlan ${id}`);
        await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['WORKPLANS']}/items/${id}`)
            .patch({ fields });
        // PATCH doesn't return fields — GET after
        const updated = await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['WORKPLANS']}/items/${id}`)
            .expand('fields')
            .get();
        return this.mapWorkPlan(updated);
    }

    async deleteWorkPlan(id: string): Promise<void> {
        if (!this.listIds['WORKPLANS']) throw new Error('WorkPlans list not found');
        await this.client
            .api(`/sites/${this.siteId}/lists/${this.listIds['WORKPLANS']}/items/${id}`)
            .delete();
    }

    /**
     * Activate a WorkPlan: creates real Objectives, KRAs, and KPIs in SharePoint
     * for each goal/activity, then stores the linked IDs back on the plan.
     * Idempotent — skips items that already have linked IDs.
     */
    async activateWorkPlan(plan: WorkPlan): Promise<WorkPlan> {
        console.log(`🚀 [SP Ops] Activating WorkPlan "${plan.title}" — creating Objectives/KRAs/KPIs...`);

        const updatedGoals: WorkPlanGoal[] = JSON.parse(JSON.stringify(plan.goals));

        for (let gi = 0; gi < updatedGoals.length; gi++) {
            const goal = updatedGoals[gi];

            // 1. Create Unit Objective for this Goal (if not already linked)
            if (!goal.linkedObjectiveId) {
                const objective = await this.addObjective({
                    title: goal.title,
                    description: goal.description || '',
                    goalType: 'Unit',
                    division: plan.divisionName,
                    unit: goal.responsibleUnitNames?.[0] || '',
                    status: 'Not Started',
                    progress: 0,
                    year: plan.year?.toString(),
                    startDate: plan.startDate ? new Date(plan.startDate) : undefined,
                    endDate: plan.endDate ? new Date(plan.endDate) : undefined,
                    parentGoalId: plan.linkedStrategicObjectiveId
                        ? Number(plan.linkedStrategicObjectiveId)
                        : undefined,
                    linkedDeliverable: goal.title,
                }, plan.divisionName);
                goal.linkedObjectiveId = objective.id.toString();
                goal.linkedObjectiveTitle = objective.title;
                console.log(`  ✅ Goal "${goal.title}" → Objective ID: ${goal.linkedObjectiveId}`);
            }

            // 2. Create KRAs + KPIs for each Activity
            for (let ai = 0; ai < goal.activities.length; ai++) {
                const activity = goal.activities[ai];

                // Create KRA (if not already linked)
                if (!activity.linkedKraId && activity.title) {
                    const kra = await this.addKRA({
                        title: activity.title,
                        description: activity.expectedOutput || activity.description || '',
                        unit: activity.assignedUnitName || goal.responsibleUnitNames?.[0] || '',
                        division: plan.divisionName,
                        objective_id: goal.linkedObjectiveId,
                        owner: activity.responsiblePersonName
                            ? { id: '', name: activity.responsiblePersonName, email: activity.responsiblePersonEmail || '' }
                            : undefined,
                        status: 'open',
                        progress: 0,
                    });
                    activity.linkedKraId = kra.id.toString();
                    console.log(`    ✅ Activity "${activity.title}" → KRA ID: ${activity.linkedKraId}`);
                }

                // Create KPI from kpiDescription (if not already linked)
                if (activity.kpiDescription && !activity.linkedKpiId && activity.linkedKraId) {
                    const kpi = await this.addKPI({
                        name: activity.kpiDescription,
                        description: activity.kpiDescription,
                        kra_id: activity.linkedKraId,
                        target: 100,
                        actual: 0,
                        status: 'on-track',
                        metric: '%',
                        calculationType: 'manual',
                        startDate: activity.startDate || plan.startDate || undefined,
                        targetDate: activity.endDate || plan.endDate || undefined,
                    });
                    activity.linkedKpiId = kpi.id.toString();
                    console.log(`      ✅ KPI "${activity.kpiDescription}" → KPI ID: ${activity.linkedKpiId}`);
                }
            }
        }

        // 3. Update WorkPlan with linked IDs and status = 'active'
        const activated = await this.updateWorkPlan(plan.id, {
            ...plan,
            goals: updatedGoals,
            status: 'active',
        });

        console.log(`🚀 [SP Ops] WorkPlan activated successfully.`);
        return { ...activated, goals: updatedGoals, status: 'active' };
    }

    /**
     * Sync an already-activated WorkPlan: updates existing linked items
     * and creates any new ones added after activation.
     */
    async syncWorkPlanToSharePoint(plan: WorkPlan): Promise<WorkPlan> {
        if (plan.status !== 'active') {
            return this.updateWorkPlan(plan.id, plan);
        }

        console.log(`🔄 [SP Ops] Syncing activated WorkPlan "${plan.title}"...`);
        const updatedGoals: WorkPlanGoal[] = JSON.parse(JSON.stringify(plan.goals));

        for (const goal of updatedGoals) {
            if (goal.linkedObjectiveId) {
                // Update existing Objective
                await this.updateObjective(goal.linkedObjectiveId, {
                    title: goal.title,
                    description: goal.description || '',
                    unit: goal.responsibleUnitNames?.[0],
                });
            } else {
                // New goal added after activation — create Objective
                const objective = await this.addObjective({
                    title: goal.title,
                    description: goal.description || '',
                    goalType: 'Unit',
                    division: plan.divisionName,
                    unit: goal.responsibleUnitNames?.[0] || '',
                    status: 'Not Started',
                    progress: 0,
                    year: plan.year?.toString(),
                    startDate: plan.startDate ? new Date(plan.startDate) : undefined,
                    endDate: plan.endDate ? new Date(plan.endDate) : undefined,
                    parentGoalId: plan.linkedStrategicObjectiveId
                        ? Number(plan.linkedStrategicObjectiveId)
                        : undefined,
                    linkedDeliverable: goal.title,
                }, plan.divisionName);
                goal.linkedObjectiveId = objective.id.toString();
                goal.linkedObjectiveTitle = objective.title;
            }

            for (const activity of goal.activities) {
                if (activity.linkedKraId) {
                    // Update existing KRA
                    await this.updateKRA(activity.linkedKraId, {
                        title: activity.title,
                        description: activity.expectedOutput || activity.description || '',
                        unit: activity.assignedUnitName || goal.responsibleUnitNames?.[0] || '',
                        objective_id: goal.linkedObjectiveId,
                    });
                } else if (activity.title) {
                    // New activity — create KRA
                    const kra = await this.addKRA({
                        title: activity.title,
                        description: activity.expectedOutput || activity.description || '',
                        unit: activity.assignedUnitName || goal.responsibleUnitNames?.[0] || '',
                        division: plan.divisionName,
                        objective_id: goal.linkedObjectiveId,
                        owner: activity.responsiblePersonName
                            ? { id: '', name: activity.responsiblePersonName, email: activity.responsiblePersonEmail || '' }
                            : undefined,
                        status: 'open',
                        progress: 0,
                    });
                    activity.linkedKraId = kra.id.toString();
                }

                if (activity.kpiDescription && activity.linkedKpiId) {
                    // Update existing KPI
                    await this.updateKPI(activity.linkedKpiId, {
                        name: activity.kpiDescription,
                        description: activity.kpiDescription,
                    });
                } else if (activity.kpiDescription && !activity.linkedKpiId && activity.linkedKraId) {
                    // New KPI — create it
                    const kpi = await this.addKPI({
                        name: activity.kpiDescription,
                        description: activity.kpiDescription,
                        kra_id: activity.linkedKraId,
                        target: 100,
                        actual: 0,
                        status: 'on-track',
                        metric: '%',
                        calculationType: 'manual',
                        startDate: activity.startDate || plan.startDate || undefined,
                        targetDate: activity.endDate || plan.endDate || undefined,
                    });
                    activity.linkedKpiId = kpi.id.toString();
                }
            }
        }

        const updated = await this.updateWorkPlan(plan.id, { ...plan, goals: updatedGoals });
        return { ...updated, goals: updatedGoals };
    }

    // ─── WorkPlan helpers ──────────────────────────────────────────────────────

    private buildWorkPlanFields(plan: Partial<WorkPlan>): Record<string, any> {
        const fields: Record<string, any> = {};
        if (plan.title !== undefined) fields.Title = plan.title;
        if (plan.description !== undefined) fields.Description = plan.description;
        if (plan.divisionId !== undefined) fields.DivisionId = plan.divisionId;
        if (plan.divisionName !== undefined) fields.DivisionName = plan.divisionName;
        if (plan.status !== undefined) fields.Status = plan.status;
        if (plan.timePeriod !== undefined) fields.TimePeriod = plan.timePeriod;
        if (plan.year !== undefined) fields.Year = plan.year;
        if (plan.startDate !== undefined) fields.StartDate = plan.startDate ? new Date(plan.startDate).toISOString() : null;
        if (plan.endDate !== undefined) fields.EndDate = plan.endDate ? new Date(plan.endDate).toISOString() : null;
        if (plan.goals !== undefined) fields.GoalsJSON = JSON.stringify(plan.goals);
        if (plan.linkedStrategicObjectiveId !== undefined) fields.LinkedStrategicObjectiveId = plan.linkedStrategicObjectiveId || '';
        if (plan.linkedStrategicObjectiveTitle !== undefined) fields.LinkedStrategicObjectiveTitle = plan.linkedStrategicObjectiveTitle || '';
        if (plan.organization !== undefined) fields.Organization = plan.organization || '';
        if (plan.preparedBy !== undefined) fields.PreparedBy = plan.preparedBy || '';
        if (plan.mandate !== undefined) fields.Mandate = plan.mandate || '';
        if (plan.monitoringAndReporting !== undefined) fields.MonitoringAndReporting = plan.monitoringAndReporting || '';
        if (plan.reviewFrequency !== undefined) fields.ReviewFrequency = plan.reviewFrequency || '';
        if (plan.reportingTo !== undefined) fields.ReportingTo = plan.reportingTo || '';
        if (plan.overallProgress !== undefined) fields.OverallProgress = plan.overallProgress;
        if (plan.createdBy !== undefined) fields.CreatedByName = plan.createdBy;
        if (plan.createdByEmail !== undefined) fields.CreatedByEmail = plan.createdByEmail;
        return fields;
    }

    private mapWorkPlan(item: any): WorkPlan {
        const f = item.fields || {};
        let goals: WorkPlanGoal[] = [];
        try { goals = JSON.parse(f.GoalsJSON || '[]'); } catch { /* empty */ }
        return {
            id: item.id?.toString(),
            title: f.Title || '',
            description: f.Description || '',
            divisionId: f.DivisionId || '',
            divisionName: f.DivisionName || '',
            status: (f.Status || 'draft') as WorkPlan['status'],
            timePeriod: (f.TimePeriod || 'annual') as WorkPlan['timePeriod'],
            year: f.Year || new Date().getFullYear(),
            startDate: f.StartDate || '',
            endDate: f.EndDate || '',
            goals,
            linkedStrategicObjectiveId: f.LinkedStrategicObjectiveId || undefined,
            linkedStrategicObjectiveTitle: f.LinkedStrategicObjectiveTitle || undefined,
            overallProgress: f.OverallProgress || 0,
            createdBy: f.CreatedByName || '',
            createdByEmail: f.CreatedByEmail || '',
            createdAt: item.createdDateTime || '',
            updatedAt: item.lastModifiedDateTime || '',
            organization: f.Organization || undefined,
            preparedBy: f.PreparedBy || undefined,
            planningPeriodLabel: f.PlanningPeriodLabel || undefined,
            mandate: f.Mandate || undefined,
            monitoringAndReporting: f.MonitoringAndReporting || undefined,
            reviewFrequency: f.ReviewFrequency || undefined,
            reportingTo: f.ReportingTo || undefined,
        };
    }

    // ─── Notifications ───────────────────────────────────────────────

    /**
     * Ensure the System_Notifications list exists. Fire-and-forget during init.
     */
    async ensureNotificationsList(): Promise<void> {
        if (this.listIds['NOTIFICATIONS']) return;

        try {
            // Try to create the list — will 409 if it already exists
            await this.client.api(`/sites/${this.siteId}/lists`).post({
                displayName: OPS_CONFIG.LISTS.NOTIFICATIONS,
                list: { template: 'genericList' },
            });
            console.log('✅ [SP Ops] Created System_Notifications list');

            // Add custom columns
            const listUrl = `/sites/${this.siteId}/lists/${OPS_CONFIG.LISTS.NOTIFICATIONS}/columns`;
            const columns = [
                { name: 'Message', text: { allowMultipleLines: true, textType: 'plain' } },
                { name: 'RecipientEmail', text: {} },
                { name: 'Type', text: {} },
                { name: 'Category', text: {} },
                { name: 'ActionUrl', text: {} },
                { name: 'IsRead', boolean: { } },
                { name: 'CreatedBy_Custom', text: {} },
            ];
            for (const col of columns) {
                try {
                    await this.client.api(listUrl).post(col);
                } catch { /* column may already exist */ }
            }

            // Re-resolve list IDs so NOTIFICATIONS is available
            await this.resolveListIds();
        } catch (err: any) {
            if (err.statusCode === 409 || err.code === 'nameAlreadyExists') {
                console.log('✅ [SP Ops] System_Notifications list already exists');
                await this.resolveListIds();
            } else {
                console.warn('⚠️ [SP Ops] Failed to ensure notifications list:', err.message);
            }
        }
    }

    /**
     * Get notifications for a user, ordered by newest first.
     */
    async getNotifications(email: string): Promise<any[]> {
        const listId = this.listIds['NOTIFICATIONS'];
        if (!listId) {
            console.warn('⚠️ [SP Ops] Notifications list not resolved');
            return [];
        }

        try {
            const normalizedEmail = email.toLowerCase();
            let allItems: any[] = [];
            let nextUrl: string | null =
                `/sites/${this.siteId}/lists/${listId}/items?$expand=fields&$top=50&$orderby=createdDateTime desc`;

            while (nextUrl) {
                const response = await this.client.api(nextUrl).get();
                const items = (response.value || []).filter((item: any) =>
                    item.fields?.RecipientEmail?.toLowerCase() === normalizedEmail
                );
                allItems = allItems.concat(items);
                // Only follow pagination if we haven't hit 50 yet
                if (allItems.length >= 50) {
                    allItems = allItems.slice(0, 50);
                    break;
                }
                nextUrl = response['@odata.nextLink'] ?? null;
            }

            return allItems.map((item: any) => this.mapNotification(item));
        } catch (err: any) {
            console.error('❌ [SP Ops] getNotifications failed:', err.message);
            return [];
        }
    }

    /**
     * Get unread notification count for a user.
     */
    async getUnreadNotificationCount(email: string): Promise<number> {
        const notifications = await this.getNotifications(email);
        return notifications.filter((n: any) => !n.isRead).length;
    }

    /**
     * Mark a single notification as read.
     */
    async markNotificationRead(itemId: string): Promise<void> {
        const listId = this.listIds['NOTIFICATIONS'];
        if (!listId) return;

        await this.client
            .api(`/sites/${this.siteId}/lists/${listId}/items/${itemId}/fields`)
            .patch({ IsRead: true });
    }

    /**
     * Mark all notifications as read for a user.
     */
    async markAllNotificationsRead(email: string): Promise<void> {
        const notifications = await this.getNotifications(email);
        const unread = notifications.filter((n: any) => !n.isRead);

        await Promise.all(
            unread.map((n: any) => this.markNotificationRead(n.id))
        );
    }

    private mapNotification(item: any) {
        const f = item.fields || {};
        return {
            id: item.id,
            title: f.Title || '',
            message: f.Message || '',
            recipientEmail: f.RecipientEmail || '',
            type: f.Type || 'info',
            category: f.Category || '',
            actionUrl: f.ActionUrl || '',
            isRead: f.IsRead === true || f.IsRead === 'true',
            createdBy: f.CreatedBy_Custom || '',
            createdAt: item.createdDateTime || '',
        };
    }

    /**
     * Create an in-app notification for a user.
     */
    async addNotification(params: {
        title: string;
        message: string;
        recipientEmail: string;
        type?: string;
        category?: string;
        actionUrl?: string;
        createdBy?: string;
    }): Promise<void> {
        const listId = this.listIds['NOTIFICATIONS'];
        if (!listId) {
            console.warn('⚠️ [SP Ops] Notifications list not resolved, skipping notification');
            return;
        }

        try {
            await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).post({
                fields: {
                    Title: params.title,
                    Message: params.message,
                    RecipientEmail: params.recipientEmail.toLowerCase(),
                    Type: params.type || 'info',
                    Category: params.category || '',
                    ActionUrl: params.actionUrl || '',
                    IsRead: false,
                    CreatedBy_Custom: params.createdBy || '',
                },
            });
        } catch (err: any) {
            console.error('❌ [SP Ops] addNotification failed:', err.message);
        }
    }

    /**
     * Send an email notification via Microsoft Graph API.
     */
    async sendEmailNotification(params: {
        toEmail: string;
        subject: string;
        body: string;
    }): Promise<void> {
        try {
            await this.client.api('/me/sendMail').post({
                message: {
                    subject: params.subject,
                    body: {
                        contentType: 'HTML',
                        content: params.body,
                    },
                    toRecipients: [
                        { emailAddress: { address: params.toEmail } },
                    ],
                },
                saveToSentItems: false,
            });
            console.log(`📧 [SP Ops] Email sent to ${params.toEmail}`);
        } catch (err: any) {
            console.error(`❌ [SP Ops] sendEmail to ${params.toEmail} failed:`, err.message);
        }
    }

    /**
     * Notify task stakeholders about a new comment.
     * Creates in-app notifications + sends emails to assignees & creator (excluding commenter).
     */
    async getOrCreateAssignedToMeGroup(assigneeEmail: string, department: string): Promise<TaskGroup> {
        const groups = await this.getTaskGroups();
        const existing = groups.find(
            g => g.ownerEmail?.toLowerCase() === assigneeEmail.toLowerCase()
        );
        if (existing) return existing;

        console.log(`🔧 [SP Ops] Creating 'Assigned to Me' group for ${assigneeEmail}`);
        return await this.addTaskGroup({
            name: 'Assigned to Me',
            description: `Auto-created group for tasks assigned to ${assigneeEmail}`,
            status: 'in-progress',
            department,
            ownerEmail: assigneeEmail.toLowerCase(),
            order: 999999, // Appears last, just before Add Group
        });
    }

    async notifyAssignment(params: {
        taskId: string;
        taskTitle: string;
        assignerName: string;
        assignerEmail: string;
        assignees: { email?: string; name?: string }[];
    }): Promise<void> {
        const { taskId, taskTitle, assignerName, assignerEmail, assignees } = params;
        const normalizedAssigner = assignerEmail.toLowerCase();

        // Collect unique recipient emails, excluding self-assignment
        const recipientEmails = new Set<string>();
        for (const a of assignees) {
            if (a.email) recipientEmails.add(a.email.toLowerCase());
        }
        recipientEmails.delete(normalizedAssigner);

        if (recipientEmails.size === 0) return;

        const actionUrl = `/unit?tab=tasks&taskId=${taskId}`;

        const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #8B0000; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
                    <h2 style="margin: 0; font-size: 18px;">Task Assigned to You</h2>
                </div>
                <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                    <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">Task:</p>
                    <p style="margin: 0 0 16px; font-weight: 600; font-size: 16px;">${taskTitle}</p>
                    <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
                        ${assignerName} has assigned this task to you.
                    </p>
                    <a href="${typeof window !== 'undefined' ? window.location.origin : ''}${actionUrl}"
                       style="display: inline-block; background: #8B0000; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">
                        View Task
                    </a>
                </div>
            </div>
        `;

        const promises: Promise<void>[] = [];
        for (const email of recipientEmails) {
            promises.push(
                this.addNotification({
                    title: `${assignerName} assigned you to "${taskTitle}"`,
                    message: `You have been assigned to the task "${taskTitle}"`,
                    recipientEmail: email,
                    type: 'task',
                    category: 'task',
                    actionUrl,
                    createdBy: normalizedAssigner,
                })
            );
            promises.push(
                this.sendEmailNotification({
                    toEmail: email,
                    subject: `Task assigned: ${taskTitle}`,
                    body: emailBody,
                })
            );
        }

        await Promise.allSettled(promises);
        console.log(`🔔 [SP Ops] Assignment notifications sent to ${recipientEmails.size} recipient(s)`);
    }

    async notifyComment(params: {
        taskId: string;
        taskTitle: string;
        commenterName: string;
        commenterEmail: string;
        commentText: string;
        assignees?: { email?: string; name?: string }[];
        creatorEmail?: string;
    }): Promise<void> {
        const { taskId, taskTitle, commenterName, commenterEmail, commentText, assignees, creatorEmail } = params;
        const normalizedCommenter = commenterEmail.toLowerCase();

        // Collect unique recipient emails (assignees + creator, minus commenter)
        const recipientEmails = new Set<string>();
        if (creatorEmail) recipientEmails.add(creatorEmail.toLowerCase());
        if (assignees) {
            for (const a of assignees) {
                if (a.email) recipientEmails.add(a.email.toLowerCase());
            }
        }
        recipientEmails.delete(normalizedCommenter);

        if (recipientEmails.size === 0) return;

        const actionUrl = `/unit?tab=tasks&taskId=${taskId}`;
        const truncatedComment = commentText.length > 100 ? commentText.substring(0, 100) + '...' : commentText;

        const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #8B0000; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
                    <h2 style="margin: 0; font-size: 18px;">New Comment on Task</h2>
                </div>
                <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                    <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">Task:</p>
                    <p style="margin: 0 0 16px; font-weight: 600; font-size: 16px;">${taskTitle}</p>
                    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                        <p style="margin: 0 0 4px; font-weight: 600; font-size: 14px;">${commenterName}</p>
                        <p style="margin: 0; font-size: 14px; color: #374151;">${commentText}</p>
                    </div>
                    <a href="${typeof window !== 'undefined' ? window.location.origin : ''}${actionUrl}"
                       style="display: inline-block; background: #8B0000; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">
                        View Task
                    </a>
                </div>
            </div>
        `;

        // Fire-and-forget: send all notifications in parallel
        const promises: Promise<void>[] = [];
        for (const email of recipientEmails) {
            // In-app notification
            promises.push(
                this.addNotification({
                    title: `${commenterName} commented on "${taskTitle}"`,
                    message: truncatedComment,
                    recipientEmail: email,
                    type: 'info',
                    category: 'task',
                    actionUrl,
                    createdBy: normalizedCommenter,
                })
            );
            // Email notification
            promises.push(
                this.sendEmailNotification({
                    toEmail: email,
                    subject: `New comment on task: ${taskTitle}`,
                    body: emailBody,
                })
            );
        }

        await Promise.allSettled(promises);
        console.log(`🔔 [SP Ops] Comment notifications sent to ${recipientEmails.size} recipient(s)`);
    }
}
