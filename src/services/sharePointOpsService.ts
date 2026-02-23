/**
 * SharePoint Operations Service
 * Handles data fetching and mapping for Operations (KRAs, KPIs, Projects, Tasks) from SharePoint Lists
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { Task, Project, KRA, Kpi, Objective, Risk, FilterScope, UserContext } from '@/types';
import { Report } from '@/types/reports';
import { Logger } from '@/utils/logger';

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
        SETTINGS: 'System_View_Settings'
    }
};

export class SharePointOpsService {
    private client: Client;
    private siteId: string = '';
    private listIds: Record<string, string> = {};

    constructor(client: Client) {
        this.client = client;
    }

    async initialize(): Promise<void> {
        console.log('🔧 [SharePointOpsService] Initializing...');
        try {
            // Get Site ID
            const site = await this.client
                .api(`/sites/${OPS_CONFIG.SITE_DOMAIN}:${OPS_CONFIG.SITE_PATH}`)
                .get();
            this.siteId = site.id;

            // Get List IDs
            await this.resolveListIds();
            console.log('✅ [SharePointOpsService] Initialization complete');
        } catch (error) {
            console.error('❌ [SharePointOpsService] Init failed', error);
            throw error;
        }
    }

    private async resolveListIds() {
        const lists = await this.client
            .api(`/sites/${this.siteId}/lists`)
            .select('id,displayName')
            .get();

        const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '');

        // Create a map of Normalized Config Name -> Config Key
        const configMap: Record<string, string> = {};
        Object.entries(OPS_CONFIG.LISTS).forEach(([key, value]) => {
            configMap[normalize(value)] = key;
        });

        lists.value.forEach((list: any) => {
            const listNorm = normalize(list.displayName);
            if (configMap[listNorm]) {
                const key = configMap[listNorm];
                this.listIds[key] = list.id;
                console.log(`✅ [SharePointOpsService] Resolved List: ${key} -> ${list.id} (${list.displayName})`);
            }
        });
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

        // Admin Bypass
        const isAdmin = context?.role === 'admin' || context?.role === 'super_admin';

        if (isAdmin) {
            console.log(`🔓 [Admin Bypass] User: ${context?.email} | Role: ${context?.role} | Fetching ALL Tasks (no filter)`);
        } else {
            let filter = '';
            // Tasks List Schema: 'Department' column holds Unit Name.
            // 🚨 CHANGE: We are removing the server-side Department filter for Tasks.
            // This allows "Direct Visibility" of tasks assigned to the user from OTHER departments.
            // The client-side hook (useSharePointTasks) already filters by (Creator OR Assignee).
            // if (scope === 'Division' && context?.division) {
            //     // See Projects note.
            // } else if (scope === 'Unit' && context?.unit) {
            //     // filter = `fields/Department eq '${context.unit}'`; 
            //     // ^ ENABLED: Filters out tasks from other units assigned to me.
            //     // ^ DISABLED: Fetches all, Client filters relevant ones.
            // } else if (scope === 'Individual' && context?.email) {
            //     // filter = `fields/AssignedTo/Email eq '${context.email}'`;
            // }

            // Optimization: If list > 5000, this will need a more complex OR query or Search API.
            // For now, fetching all (scoped by permissions/view) is safe for < 2000 items.
            if (filter) {
                query = query.filter(filter);
                console.log(`🔒 [Scoped Query] User: ${context?.email} | Filter: ${filter}`);
            } else {
                console.log(`🌐 [Global Fetch] User: ${context?.email} | No server-side filter (cross-unit visibility enabled)`);
            }
        }

        const response = await query.get();
        console.log(`📊 [Tasks Fetched] User: ${context?.email} | Count: ${response.value?.length || 0} | Admin: ${isAdmin}`);

        // if ((!response.value || response.value.length === 0)) {
        //     console.warn(`⚠️ [SP Ops] No tasks found. Probing list content/permissions...`);
        //     // Probe: Is list empty or is expand failing?
        //     try {
        //         const probe = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['TASKS']}/items`).top(5).select('id,fields').expand('fields').get();
        //         console.log(`🕵️ [SP Ops] List Probe Result (Top 5): ${probe.value?.length} items exist. Permission check: OK.`);
        //         if (probe.value?.length > 0) {
        //             console.log(`🕵️ [SP Ops] Probe Sample Fields:`, Object.keys(probe.value[0].fields));
        //         }
        //     } catch (e) {
        //         console.error(`❌ [SP Ops] List Probe Failed`, e);
        //     }
        // }

        // if (response.value && response.value.length > 0) {
        //     // Log first task fields keys
        //     console.log('🔍 [SP Ops] First Task Fields Keys:', Object.keys(response.value[0].fields));
        // }
        return response.value.map((item: any) => this.mapTask(item));
    }

    async addTask(task: Partial<Task>, department?: string): Promise<Task> {
        if (!this.listIds['TASKS']) throw new Error('Operations Tasks list not found');

        // Handle Project ID vs Bucket ID logic
        let relatedProjectId = task.projectId ? Number(task.projectId) : null;
        if (isNaN(relatedProjectId as number)) relatedProjectId = null;

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
                Tags: tags.join(','),
                Assignees: task.assignees ? JSON.stringify(task.assignees) : undefined,
                // Lookups
                RelatedKRALookupId: task.kra_id ? Number(task.kra_id) : null,
                RelatedKPILookupId: task.kpi_id ? Number(task.kpi_id) : null,
                RelatedProjectLookupId: relatedProjectId
            }
        };


        // console.log('📝 [SP Ops] Adding Task Payload:', JSON.stringify(payload, null, 2));
        const response = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['TASKS']}/items`).post(payload);

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
        if (task.subtasks !== undefined) fields.SubtasksJSON = JSON.stringify(task.subtasks);
        if (task.assignees !== undefined) {
            console.log('📝 [SP Ops] Setting Assignees for Task:', task.assignees);
            fields.Assignees = JSON.stringify(task.assignees);
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

        // Handle Project ID vs Bucket ID logic for Updates
        if (task.projectId !== undefined) {
            let relatedProjectId = task.projectId ? Number(task.projectId) : null;
            if (isNaN(relatedProjectId as number)) relatedProjectId = null;
            fields.RelatedProjectLookupId = relatedProjectId;

            // Also update tags
            // Note: We need existing tags to preserve them, but partial update might not have them.
            // If tags ARE passed, use them. If not, we might overwrite?
            // UI should pass tags in updateTask if possible.
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
        // ProjectId handled above

        // ProjectId handled above

        console.log(`📝 [SP Ops] Updating Task ${id} Payload:`, JSON.stringify({ fields }, null, 2));
        const response = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['TASKS']}/items/${id}`).patch({ fields });
        return this.mapTask(response);
    }

    async deleteTask(id: string): Promise<void> {
        if (!this.listIds['TASKS']) throw new Error('Operations Tasks list not found');
        await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['TASKS']}/items/${id}`).delete();
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

    async addKRA(kra: Partial<KRA>): Promise<KRA> {
        if (!this.listIds['KRAS']) throw new Error('KRAs list not found');

        // Write owner name to the Responsible text field (for SharePoint list display).
        // Also embed full owner object (id/name/email) into the Assignees JSON with isOwner:true
        // so the UI can reconstruct the full owner on edit without extra lookups.
        const mergedAssignees: any[] = [...((kra.assignees as any[]) || [])];
        if (kra.owner) {
            const ownerIdx = mergedAssignees.findIndex(a => a.id === (kra.owner as any).id);
            if (ownerIdx !== -1) {
                mergedAssignees[ownerIdx] = { ...mergedAssignees[ownerIdx], isOwner: true };
            } else {
                mergedAssignees.push({ ...(kra.owner as any), isOwner: true });
            }
        }

        const payload: any = {
            fields: {
                Title: kra.title,
                Responsible: kra.owner?.name || null,
                Unit: kra.unit || null,
                Division: kra.division || null,
                Status: kra.status === 'in-progress' ? 'In Progress' : (kra.status === 'closed' ? 'Closed' : 'Open'),
                Progress: kra.progress,
                Description: kra.description,
                UnitObjectiveLookupId: kra.objective_id ? Number(kra.objective_id) : null,
                Assignees: mergedAssignees.length > 0 ? JSON.stringify(mergedAssignees) : undefined
            }
        };

        console.log('📝 [SP Ops] Adding KRA Payload:', JSON.stringify(payload, null, 2));
        try {
            const response = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['KRAS']}/items`).post(payload);
            return this.mapKRA(response);
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
        if (kra.status !== undefined) fields.Status = kra.status === 'in-progress' ? 'In Progress' : (kra.status === 'closed' ? 'Closed' : 'Open');
        if (kra.progress !== undefined) fields.Progress = kra.progress;
        if (kra.description !== undefined) fields.Description = kra.description;
        if (kra.objective_id !== undefined) fields.UnitObjectiveLookupId = kra.objective_id ? Number(kra.objective_id) : null;
        // Rebuild Assignees JSON with owner embedded (same logic as addKRA)
        if (kra.assignees !== undefined || kra.owner !== undefined) {
            const mergedAssignees: any[] = [...((kra.assignees as any[]) || [])];
            if (kra.owner) {
                const ownerIdx = mergedAssignees.findIndex(a => a.id === (kra.owner as any).id);
                if (ownerIdx !== -1) {
                    mergedAssignees[ownerIdx] = { ...mergedAssignees[ownerIdx], isOwner: true };
                } else {
                    mergedAssignees.push({ ...(kra.owner as any), isOwner: true });
                }
            }
            fields.Assignees = JSON.stringify(mergedAssignees);
        }

        console.log(`📝 [SP Ops] Updating KRA ${id} Payload:`, JSON.stringify({ fields }, null, 2));
        try {
            const response = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['KRAS']}/items/${id}`).patch({ fields });
            return this.mapKRA(response);
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
     * Recalculates and updates the Progress column of a KRA based on its linked KPIs.
     */
    private async syncKRAProgress(kraId: string): Promise<void> {
        try {
            if (!this.listIds['KRAS'] || !this.listIds['KPIS']) await this.initialize();

            // 0. Small delay to allow SharePoint indexing (Graph API filter lag)
            await new Promise(resolve => setTimeout(resolve, 500));

            // 1. Fetch all KPIs for this KRA
            const kpiResponse = await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['KPIS']}/items`)
                .expand('fields')
                .filter(`fields/RelatedKRALookupId eq ${kraId}`)
                .get();

            const kpiItems = kpiResponse.value.map((item: any) => this.mapKPI(item));

            // 2. Import calculation utility
            const { calculateKraProgress } = await import('@/utils/kpiUtils');

            // 3. Calculate average
            const mockKra = { id: kraId, status: 'open', progress: 0 };
            const newProgress = calculateKraProgress(mockKra, kpiItems) || 0;

            console.log(`[SP Ops] Syncing KRA ${kraId}: ${kpiItems.length} KPIs found. Calculated progress: ${newProgress}%`);

            // 4. Update SharePoint KRA list
            await this.client.api(`/sites/${this.siteId}/lists/${this.listIds['KRAS']}/items/${kraId}`).patch({
                fields: {
                    Progress: newProgress
                }
            });

            console.log(`✅ [SP Ops] Successfully synced KRA ${kraId} progress to SharePoint.`);
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
        // 1. Prefer explicit Lookup ID if available
        // 2. Fall back to 'bucket:ID' found in Tags
        let projectId = f.RelatedProjectLookupId?.toString();
        if (!projectId) {
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
            dueDate: f.DueDate || '',
            subtasks: f.SubtasksJSON ? JSON.parse(f.SubtasksJSON) : [],
            tags: tags,
            projectId: projectId, // Use our resolved ID
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
                AIAnalysis: report.content.metadata.ai_generated || false,
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
        if (!f) return { id: item.id, name: 'Error: No fields', template_id: '', content: { sections: [], metadata: {} }, created_by: '', created_at: '', date_range: {}, ai_analysis: false };

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
}
