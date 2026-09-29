import { useQuery } from '@tanstack/react-query';
import { useOpsService } from './useSharePointOps';

export function useWorkPlanGovernanceHistory(
  divisionId: string,
  divisionName: string,
  enabled = true,
) {
  const getService = useOpsService();
  return useQuery({
    queryKey: ['sharePoint', 'workplans', 'governance-history', divisionId, divisionName],
    queryFn: async () => {
      const service = await getService();
      return service.getWorkPlanGovernanceHistory(divisionId, divisionName);
    },
    enabled: enabled && !!divisionId.trim() && !!divisionName.trim(),
    staleTime: 30_000,
  });
}
