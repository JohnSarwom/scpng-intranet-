import { useQuery } from '@tanstack/react-query';
import { useOpsService } from '@/hooks/useSharePointOps';
import { buildLinkageInventory, type LinkageInventory } from '@/services/linkageInventoryService';
import { isOperationalTask } from '@/utils/taskAlignment';

// Unfiltered read: the inventory must resolve links that cross Division lines,
// so the list readers' scope filters are bypassed here. Who may view the result
// is decided by canViewLinkageInventory, and SharePoint still enforces read access.
const UNFILTERED_READ = { division: '', unit: '', email: '', name: '', role: 'admin' };

/**
 * Read-only linkage inventory for one Division. Loads every page of Tasks, KPIs,
 * KRAs and Unit Objectives; nothing is written. Fetch failures surface as
 * `error` instead of an empty (and misleadingly clean) inventory.
 */
export function useLinkageInventory(divisionName: string | undefined, unitNames: string[], enabled: boolean) {
  const getService = useOpsService();

  return useQuery<LinkageInventory, Error>({
    queryKey: ['linkageInventory', divisionName, unitNames],
    enabled: enabled && !!divisionName,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const service = await getService();
      const [tasks, kpis, kras, objectives] = await Promise.all([
        service.getTasks('Unit', UNFILTERED_READ),
        service.getKPIs(),
        service.getKRAs('Division', UNFILTERED_READ),
        service.getObjectives('Division', UNFILTERED_READ),
      ]);
      return buildLinkageInventory({
        divisionName: divisionName || '',
        unitNames,
        tasks: tasks.map(task => ({
          id: String(task.id),
          title: task.title,
          status: task.status,
          unit_id: task.unit_id,
          kpi_id: task.kpi_id,
          kra_id: task.kra_id,
          operational: isOperationalTask(task.tags),
        })),
        kpis: kpis.map(kpi => ({ id: String(kpi.id), name: kpi.name, kra_id: kpi.kra_id })),
        kras: kras.map(kra => ({
          id: String(kra.id), title: kra.title, unit: kra.unit, division: kra.division, objective_id: kra.objective_id,
        })),
        objectives: objectives.map(objective => ({
          id: String(objective.id),
          title: objective.title,
          goalType: objective.goalType,
          unit: objective.unit,
          division: objective.division,
          parentGoalId: objective.parentGoalId,
          linkedDeliverable: objective.linkedDeliverable,
        })),
      });
    },
  });
}
