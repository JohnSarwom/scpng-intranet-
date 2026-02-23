import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { SharePointOpsService } from '@/services/sharePointOpsService';
import { getGraphClient } from '@/services/graphService';
import { Kra, Kpi, Project, Task, KRA, Objective, FilterScope, UserContext } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import DivisionStaffMap from '@/utils/divisionStaffMap';

// Helper to get service instance
const useOpsService = () => {
    const { instance: msalInstance } = useMsal();

    const getService = async () => {
        const account = msalInstance.getActiveAccount();
        if (!account) throw new Error('No active account');

        const graphClient = await getGraphClient(msalInstance);
        if (!graphClient) throw new Error('Failed to get Graph client');

        const service = new SharePointOpsService(graphClient);
        await service.initialize();
        return service;
    };

    return getService;
};

// --- Hooks ---

import { mockStrategyData } from '@/mockData/strategyData';

export function useSharePointObjectives(department?: string, scope: FilterScope = 'Division', context?: UserContext) {
    const getService = useOpsService();

    const query = useQuery({
        queryKey: ['sharePoint', 'objectives', department, scope, context?.division, context?.unit, context?.email, context?.role],
        queryFn: async () => {
            try {
                const service = await getService();
                // We re-use getObjectives but type cast for now if needed or rely on service typing
                let data = await service.getObjectives(scope, context);

                // Fallback to mock data if no objectives found (e.g. connection issue or empty list)
                // This ensures the "Strategic Objectives" dropdown is always populated for demo/dev purposes
                if (!data) {
                    return [];
                }

                console.log('✅ [useSharePointOps] Loaded Objectives:', data.length);

                // 🔒 INDIVIDUAL FILTERING: Staff members only see objectives they own
                const isStaff = context?.role === 'staff_member';
                const isAdmin = context?.role === 'admin' || context?.role === 'super_admin';

                if (isStaff && !isAdmin && context?.email) {
                    data = data.filter(obj => {
                        // Filter by owner name or email
                        const ownerMatch = obj.owner?.toLowerCase() === context.name?.toLowerCase() ||
                            obj.ownerEmail?.toLowerCase() === context.email.toLowerCase();

                        if (ownerMatch) {
                            console.log(`✅ [Individual Filter] Staff ${context.email} sees Objective: ${obj.title}`);
                        } else {
                            console.log(`⛔ [Individual Filter] Hiding Objective: "${obj.title}" | Owner: "${obj.owner}/${obj.ownerEmail}" vs User: "${context.name}/${context.email}"`);
                        }
                        return ownerMatch;
                    });
                    console.log(`🔒 [Individual Filter] Filtered Objectives for staff ${context.email}: ${data.length} items`);
                }

                return data;
            } catch (err) {
                console.error('❌ [useSharePointOps] Failed to fetch Objectives', err);

                // Also fallback on error
                return [];
            }
        }
    });

    return {
        data: (query.data || []) as unknown as Objective[],
        loading: query.isLoading,
        error: query.error as Error | null,
        add: async (item: Partial<Objective>) => {
            try {
                const service = await getService();
                await service.addObjective(item, department || context?.division);
                query.refetch();
                return true;
            } catch (error) {
                console.error('Failed to add objective', error);
                throw error;
            }
        },
        update: async (id: string, item: Partial<Objective>) => {
            try {
                const service = await getService();
                await service.updateObjective(id, item);
                query.refetch();
                return true;
            } catch (error) {
                console.error('Failed to update objective', error);
                throw error;
            }
        },
        remove: async (id: string) => {
            try {
                const service = await getService();
                await service.deleteObjective(id);
                query.refetch();
                return true;
            } catch (error) {
                console.error('Failed to delete objective', error);
                throw error;
            }
        },
        refresh: query.refetch
    };
}

export function useSharePointKRAs(department?: string, scope: FilterScope = 'Division', context?: UserContext) {
    const getService = useOpsService();
    const { toast } = useToast();

    const query = useQuery({
        // Include department (which is derived from context) and scope to ensure refetch on context switch
        queryKey: ['sharePoint', 'kras', department, scope, context?.division, context?.unit, context?.email, context?.role],
        queryFn: async () => {
            try {
                const service = await getService();

                // Fetch KRAs and KPIs in parallel to merge them
                const [kras, kpis] = await Promise.all([
                    service.getKRAs(scope, context),
                    service.getKPIs(department)
                ]);

                console.log('✅ [useSharePointOps] Loaded KRAs:', kras.length);
                console.log('✅ [useSharePointOps] Loaded KPIs for merging:', kpis.length);

                // Merge KPIs into their parent KRAs
                // This ensures unitKpis is populated, which the UI relies on
                let krasWithKpis = kras.map(kra => {
                    const kraKpis = kpis.filter(kpi => String(kpi.kra_id) === String(kra.id));
                    return {
                        ...kra,
                        unitKpis: kraKpis
                    };
                });

                // 🔒 INDIVIDUAL FILTERING: Staff members only see their assigned KRAs
                // Managers (role_name='manager') and Admins see all division/unit KRAs
                const isStaff = context?.role === 'staff_member';
                // Check if user is manager or admin to BYPASS filtering
                const isManagerOrAdmin = context?.role === 'manager' || context?.role === 'admin' || context?.role === 'super_admin';

                if (isStaff && !isManagerOrAdmin && context?.email) {
                    krasWithKpis = krasWithKpis.filter(kra => {
                        const userEmail = context.email.toLowerCase();

                        // Check if user created this KRA (Graph API provides createdBy.user.email natively)
                        const isCreator = (kra as any).createdByEmail?.toLowerCase() === userEmail;

                        // Check if user is in the assignees list
                        const isAssigned = kra.assignees?.some(a => a.email?.toLowerCase() === userEmail);

                        const shouldShow = isCreator || isAssigned;

                        if (shouldShow) {
                            console.log(`✅ [Individual Filter] Staff ${context.email} sees KRA: ${kra.title} (Creator: ${isCreator}, Assigned: ${isAssigned})`);
                        } else {
                            // console.log(`⛔ [Individual Filter] Hiding KRA: "${kra.title}" | Owner: "${kra.owner?.name}" vs User: "${context.name}"`);
                        }
                        return shouldShow;
                    });
                    console.log(`🔒 [Individual Filter] Filtered KRAs for staff ${context.email}: ${krasWithKpis.length} items`);
                }

                console.log(`✅ [useSharePointOps] Loaded ${krasWithKpis.length} KRAs for ${context?.division}/${context?.unit}`);

                return krasWithKpis;
            } catch (err) {
                console.error('❌ [useSharePointOps] Failed to fetch KRAs', err);
                return [];
            }
        },
        staleTime: 1000 * 60 * 5, // 5 min
    });

    // Match useSupabaseData shape
    return {
        data: (query.data || []) as unknown as Kra[], // Cast to Kra to satisfy Unit.tsx expectations
        loading: query.isLoading,
        error: query.error as Error | null,
        add: async (item: Partial<KRA>) => {
            try {
                const service = await getService();
                const newKra = await service.addKRA(item);
                query.refetch();
                toast({ title: "Success", description: "KRA added successfully" });
                return newKra; // Return the created KRA so we can use its ID
            } catch (error: any) {
                console.error('Failed to add KRA', error);
                toast({ title: "Error", description: error.message || "Failed to add KRA", variant: "destructive" });
                throw error;
            }
        },
        update: async (id: string, item: Partial<KRA>) => {
            try {
                const service = await getService();
                const updatedKra = await service.updateKRA(id, item);
                query.refetch();
                toast({ title: "Success", description: "KRA updated successfully" });
                return updatedKra; // Return the updated KRA
            } catch (error: any) {
                console.error('Failed to update KRA', error);
                toast({ title: "Error", description: error.message || "Failed to update KRA", variant: "destructive" });
                throw error;
            }
        },
        remove: async (id: string) => {
            try {
                const service = await getService();
                await service.deleteKRA(id);
                query.refetch();
                toast({ title: "Success", description: "KRA deleted successfully" });
                return true;
            } catch (error: any) {
                console.error('Failed to delete KRA', error);
                toast({ title: "Error", description: error.message || "Failed to delete KRA", variant: "destructive" });
                throw error;
            }
        },
        refresh: query.refetch
    };
}

export function useSharePointKPIs(department?: string, context?: UserContext) {
    const getService = useOpsService();
    const { toast } = useToast();

    const query = useQuery({
        queryKey: ['sharePoint', 'kpis', department, context?.email, context?.role],
        queryFn: async () => {
            try {
                const service = await getService();
                let data = await service.getKPIs(department);
                console.log('✅ [useSharePointOps] Loaded KPIs:', data.length);

                // 🔒 INDIVIDUAL FILTERING: Staff members only see KPIs they're assigned to
                const isStaff = context?.role === 'staff_member';
                const isManagerOrAdmin = context?.role === 'manager' || context?.role === 'admin' || context?.role === 'super_admin';

                if (isStaff && !isManagerOrAdmin && context?.email) {
                    data = data.filter(kpi => {
                        // Check if user is in assignees array
                        const isAssigned = kpi.assignees?.some(assignee =>
                            assignee.email?.toLowerCase() === context.email.toLowerCase()
                        );

                        if (isAssigned) {
                            console.log(`✅ [Individual Filter] Staff ${context.email} sees KPI: ${kpi.name}`);
                        }
                        return isAssigned;
                    });
                    console.log(`🔒 [Individual Filter] Filtered KPIs for staff ${context.email}: ${data.length} items`);
                }

                console.log(`✅ [useSharePointOps] Loaded ${data.length} KPIs for context`);

                return data;
            } catch (err) {
                console.error('❌ [useSharePointOps] Failed to fetch KPIs', err);
                return [];
            }
        }
    });

    return {
        data: (query.data || []) as unknown as Kpi[],
        loading: query.isLoading,
        error: query.error as Error | null,
        add: async (item: Partial<Kpi>) => {
            try {
                const service = await getService();
                await service.addKPI(item);
                query.refetch();
                toast({ title: "Success", description: "KPI added successfully" });
                return true;
            } catch (error: any) {
                console.error('Failed to add KPI', error);
                toast({ title: "Error", description: error.message || "Failed to add KPI", variant: "destructive" });
                throw error;
            }
        },
        update: async (id: string, item: Partial<Kpi>) => {
            try {
                const service = await getService();
                await service.updateKPI(id, item);
                query.refetch();
                toast({ title: "Success", description: "KPI updated successfully" });
                return true;
            } catch (error: any) {
                console.error('Failed to update KPI', error);
                toast({ title: "Error", description: error.message || "Failed to update KPI", variant: "destructive" });
                throw error;
            }
        },
        remove: async (id: string) => {
            try {
                const service = await getService();
                await service.deleteKPI(id);
                query.refetch();
                toast({ title: "Success", description: "KPI deleted successfully" });
                return true;
            } catch (error: any) {
                console.error('Failed to delete KPI', error);
                toast({ title: "Error", description: error.message || "Failed to delete KPI", variant: "destructive" });
                throw error;
            }
        },
        refresh: query.refetch
    };
}

export function useSharePointProjects(department?: string, scope: FilterScope = 'Unit', context?: UserContext) {
    const getService = useOpsService();

    const query = useQuery({
        queryKey: ['sharePoint', 'projects', department, scope, context?.division, context?.unit, context?.email, context?.role],
        queryFn: async () => {
            try {
                const service = await getService();
                const data = await service.getProjects(scope, context);
                console.log('✅ [useSharePointOps] Loaded Projects:', data.length);
                return data;
            } catch (err) {
                console.error('❌ [useSharePointOps] Failed to fetch Projects', err);
                return [];
            }
        }
    });

    return {
        data: (query.data || []) as unknown as Project[],
        loading: query.isLoading,
        error: query.error as Error | null,
        add: async (item: Partial<Project>) => {
            try {
                const service = await getService();
                const newProject = await service.addProject(item);
                query.refetch();
                // Don't show toast for custom groups to avoid noise? Or show it?
                // Let's keep it clean
                return newProject;
            } catch (error: any) {
                console.error('Failed to add project', error);
                throw error;
            }
        },
        update: async () => { }, // Projects update not needed for this feature yet
        remove: async (id: string) => {
            try {
                const service = await getService();
                await service.deleteProject(id);
                query.refetch();
                return true;
            } catch (error: any) {
                console.error('Failed to delete project', error);
                throw error;
            }
        },
        refresh: query.refetch
    };
}

export function useSharePointTasks(
    department?: string,
    scope: FilterScope = 'Unit',
    context?: UserContext,
    /** Live unit roster emails from useUnitRoster — when provided replaces DivisionStaffMap for manager filter */
    unitRosterEmails?: string[]
) {
    const getService = useOpsService();
    const { toast } = useToast();

    // Stable cache key: sorted joined string so array order doesn't matter
    const rosterKey = unitRosterEmails ? [...unitRosterEmails].sort().join(',') : '';

    const query = useQuery({
        queryKey: ['sharePoint', 'tasks', department, scope, context?.division, context?.unit, context?.email, context?.role, rosterKey],
        queryFn: async () => {
            try {
                const service = await getService();
                // DEBUG: Check columns once to verify 'Assignees' field
                // DEBUG: Check columns once to verify 'Assignees' field
                await service.debugListColumns('Operations_Tasks');
                await service.debugListColumns('Performance_KRAs');

                let data = await service.getTasks(scope, context);
                console.log('✅ [useSharePointOps] Loaded Tasks:', data.length);

                // 🔒 ROLE-BASED FILTERING:
                //   - Admin / Super Admin → no filter, see everything
                //   - Manager → see all tasks belonging to their unit staff (via DivisionStaffMap)
                //   - Staff → only see tasks they created or are assigned to
                const isAdmin = context?.role === 'admin' || context?.role === 'super_admin';
                const isManager = context?.role === 'manager';

                if (!isAdmin && context?.email) {
                    if (isManager && context?.unit) {
                        // Prefer the live roster (from useUnitRoster / SharePoint UserRoles).
                        // Fall back to the static DivisionStaffMap when the roster hasn't loaded yet.
                        const baseEmails = (unitRosterEmails && unitRosterEmails.length > 0)
                            ? unitRosterEmails
                            : DivisionStaffMap.getAllStaff()
                                .filter(s => s.unit?.toLowerCase() === context.unit!.toLowerCase())
                                .map(s => s.email.toLowerCase());

                        const unitStaffEmails = new Set(baseEmails.map(e => e.toLowerCase()));
                        // Always include the manager's own email
                        unitStaffEmails.add(context.email.toLowerCase());

                        data = data.filter(task => {
                            const creatorEmail = (task.createdByEmail || task.authorEmail || '').toLowerCase();
                            const assigneeEmails = task.assignees?.map(a => a.email?.toLowerCase() || '') || [];
                            return unitStaffEmails.has(creatorEmail) ||
                                assigneeEmails.some(e => e && unitStaffEmails.has(e));
                        });
                        console.log(`🔒 [Manager Filter] Unit "${context.unit}" tasks for ${context.email}: ${data.length} items`);
                    } else if (!isManager) {
                        // Staff members only see tasks they created or are assigned to
                        data = data.filter(task => {
                            const userEmail = context.email!.toLowerCase();
                            const isCreator = task.createdByEmail?.toLowerCase() === userEmail ||
                                task.authorEmail?.toLowerCase() === userEmail;
                            const isAssigned = task.assignees?.some(a => a.email?.toLowerCase() === userEmail);
                            return isCreator || isAssigned;
                        });
                        console.log(`🔒 [Staff Filter] Tasks for ${context.email}: ${data.length} items`);
                    }
                }

                return data;
            } catch (err) {
                console.error('❌ [useSharePointOps] Failed to fetch Tasks', err);
                return [];
            }
        },
        // Use placeholderData to keep previous data while fetching new data to prevent flicker
        placeholderData: (previousData) => previousData,
    });

    return {
        data: (query.data || []) as unknown as Task[],
        loading: query.isLoading,
        error: query.error as Error | null,
        add: async (item: Partial<Task>) => {
            try {
                const service = await getService();
                const createdTask = await service.addTask(item, department);
                // Return the created task immediately so the UI can show it optimistically.
                // Refetch in the background after a short delay for SharePoint indexing.
                setTimeout(async () => {
                    try { await query.refetch(); } catch { /* silent */ }
                }, 1200);
                return createdTask;
            } catch (error: any) {
                console.error('Failed to add Task', error);
                toast({ title: "Error", description: error.message || "Failed to add Task", variant: "destructive" });
                throw error;
            }
        },
        update: async (id: string, item: Partial<Task>, options?: { suppressToast?: boolean }) => {
            try {
                const service = await getService();
                await service.updateTask(id, item);
                await query.refetch();
                if (!options?.suppressToast) {
                    toast({ title: "Success", description: "Task updated successfully" });
                }
                return true;
            } catch (error: any) {
                console.error('Failed to update Task', error);
                toast({ title: "Error", description: error.message || "Failed to update Task", variant: "destructive" });
                throw error;
            }
        },
        remove: async (id: string) => {
            try {
                const service = await getService();
                await service.deleteTask(id);
                await query.refetch();
                // Toast is now handled by TasksTab with undo functionality
                return true;
            } catch (error: any) {
                console.error('Failed to delete Task', error);
                // Keep error toast for debugging, but TasksTab will show user-friendly rollback message
                throw error;
            }
        },
        refresh: query.refetch
    };
}

export function useSharePointRisks(department?: string, scope: FilterScope = 'Division', context?: UserContext) {
    const getService = useOpsService();

    const query = useQuery({
        queryKey: ['sharePoint', 'risks', department, scope, context?.division, context?.unit, context?.email, context?.role],
        queryFn: async () => {
            try {
                const service = await getService();
                const data = await service.getRisks(scope, context);
                console.log('✅ [useSharePointOps] Loaded Risks:', data.length);
                return data;
            } catch (err) {
                console.error('❌ [useSharePointOps] Failed to fetch Risks', err);
                return [];
            }
        }
    });

    return {
        data: (query.data || []) as unknown as any[], // Casting to any[] to avoid strict Risk type issues during transition
        loading: query.isLoading,
        error: query.error as Error | null,
        add: async () => { },
        update: async () => { },
        remove: async () => { },
        refresh: query.refetch
    };
}
