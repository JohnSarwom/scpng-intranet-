import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOpsService } from './useSharePointOps';
import { WorkPlan } from '@/types/division.types';
import { useToast } from '@/components/ui/use-toast';

const WORKPLAN_STORAGE_KEY = (divisionId: string) => `scpng_workplans_${divisionId}`;

export function useWorkPlans(divisionId: string, divisionName: string) {
    const getService = useOpsService();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const queryKey = ['sharePoint', 'workplans', divisionId];

    const query = useQuery({
        queryKey,
        queryFn: async () => {
            if (!divisionId) return [];
            const service = await getService();
            let plans = await service.getWorkPlans(divisionId);

            // One-time migration from localStorage
            if (plans.length === 0) {
                try {
                    const raw = localStorage.getItem(WORKPLAN_STORAGE_KEY(divisionId));
                    if (raw) {
                        const localPlans: WorkPlan[] = JSON.parse(raw);
                        if (Array.isArray(localPlans) && localPlans.length > 0) {
                            console.log(`[useWorkPlans] Migrating ${localPlans.length} plans from localStorage to SharePoint...`);
                            for (const lp of localPlans) {
                                await service.addWorkPlan(lp);
                            }
                            localStorage.removeItem(WORKPLAN_STORAGE_KEY(divisionId));
                            plans = await service.getWorkPlans(divisionId);
                            toast({ title: 'Work Plans Migrated', description: `${localPlans.length} plan(s) moved to SharePoint.` });
                        }
                    }
                } catch (e) {
                    console.warn('[useWorkPlans] localStorage migration failed:', e);
                }
            }

            return plans;
        },
        enabled: !!divisionId,
    });

    const addWorkPlan = async (plan: WorkPlan): Promise<WorkPlan> => {
        const service = await getService();
        const created = await service.addWorkPlan(plan);

        // Optimistic cache update
        queryClient.setQueryData(queryKey, (old: WorkPlan[] | undefined) => {
            if (!old) return [created];
            return [created, ...old];
        });
        setTimeout(() => { queryClient.invalidateQueries({ queryKey }); }, 3000);

        toast({ title: 'Success', description: 'Work Plan saved.' });
        return created;
    };

    const updateWorkPlan = async (id: string, updates: Partial<WorkPlan>): Promise<WorkPlan> => {
        const service = await getService();
        const updated = await service.updateWorkPlan(id, updates);

        queryClient.setQueryData(queryKey, (old: WorkPlan[] | undefined) =>
            (old || []).map(p => p.id === id ? { ...p, ...updated } : p)
        );
        setTimeout(() => { queryClient.invalidateQueries({ queryKey }); }, 3000);

        toast({ title: 'Success', description: 'Work Plan updated.' });
        return updated;
    };

    const deleteWorkPlan = async (id: string): Promise<void> => {
        const service = await getService();
        await service.deleteWorkPlan(id);

        queryClient.setQueryData(queryKey, (old: WorkPlan[] | undefined) =>
            (old || []).filter(p => p.id !== id)
        );
        setTimeout(() => { queryClient.invalidateQueries({ queryKey }); }, 3000);

        toast({ title: 'Deleted', description: 'Work Plan removed.' });
    };

    const activateWorkPlan = async (plan: WorkPlan): Promise<WorkPlan> => {
        const service = await getService();
        const activated = await service.activateWorkPlan(plan);

        // Invalidate workplans AND all dependent caches so Unit page + Strategy Hub see new items
        queryClient.invalidateQueries({ queryKey });
        queryClient.invalidateQueries({ queryKey: ['sharePoint', 'objectives'] });
        queryClient.invalidateQueries({ queryKey: ['sharePoint', 'kras'] });
        queryClient.invalidateQueries({ queryKey: ['sharePoint', 'kpis'] });

        toast({ title: 'Work Plan Activated', description: 'Objectives, KRAs, and KPIs have been created.' });
        return activated;
    };

    const syncWorkPlan = async (plan: WorkPlan): Promise<WorkPlan> => {
        const service = await getService();
        const synced = await service.syncWorkPlanToSharePoint(plan);

        queryClient.invalidateQueries({ queryKey });
        queryClient.invalidateQueries({ queryKey: ['sharePoint', 'objectives'] });
        queryClient.invalidateQueries({ queryKey: ['sharePoint', 'kras'] });
        queryClient.invalidateQueries({ queryKey: ['sharePoint', 'kpis'] });

        toast({ title: 'Synced', description: 'Work Plan changes synced to SharePoint.' });
        return synced;
    };

    const getWorkPlan = (id: string) => (query.data || []).find(p => p.id === id) ?? null;

    return {
        workPlans: query.data || [],
        loading: query.isLoading,
        addWorkPlan,
        updateWorkPlan,
        deleteWorkPlan,
        activateWorkPlan,
        syncWorkPlan,
        getWorkPlan,
    };
}
