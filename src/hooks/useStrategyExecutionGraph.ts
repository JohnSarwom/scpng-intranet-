/**
 * useStrategyExecutionGraph (Phase 3)
 *
 * Thin hook that assembles the inputs the existing SharePoint hooks already fetch
 * and memoizes a single `StrategyExecutionGraph`. The hook does no relationship
 * work itself — that lives in `strategyExecutionGraphService` (pure + tested).
 *
 * Corporate scope is the default: it fetches with `scope: 'All'` and a
 * super_admin context (mirroring the Strategy page) so the graph can see the full
 * cascade. Callers can narrow later once scoped consumers are wired.
 */

import { useMemo } from 'react';
import { useStrategySharePoint } from '@/hooks/useStrategySharePoint';
import {
  useSharePointKRAs,
  useSharePointKPIs,
  useSharePointObjectives,
  useSharePointTasks,
} from '@/hooks/useSharePointOps';
import {
  buildStrategyExecutionGraph,
  type GraphInput,
} from '@/services/strategyExecutionGraphService';
import type { StrategyExecutionGraph, ProgressScope } from '@/types/strategyExecution';
import type { StrategicGoal } from '@/types';

interface UseStrategyExecutionGraphOptions {
  scope?: ProgressScope;
}

interface UseStrategyExecutionGraphResult {
  graph: StrategyExecutionGraph;
  isLoading: boolean;
}

// Corporate-wide fetch context (mirrors Strategy.tsx).
const CORPORATE_CONTEXT = {
  division: '',
  unit: '',
  email: '',
  name: '',
  role: 'super_admin' as const,
};

export function useStrategyExecutionGraph(
  options?: UseStrategyExecutionGraphOptions,
): UseStrategyExecutionGraphResult {
  const scope: ProgressScope = options?.scope ?? 'corporate';

  const { strategyData } = useStrategySharePoint();
  const { data: allObjectives, loading: loadingObjectives } = useSharePointObjectives(
    undefined,
    'All',
    CORPORATE_CONTEXT,
  );
  const { data: allKras, loading: loadingKras } = useSharePointKRAs(undefined, 'All', CORPORATE_CONTEXT);
  const { data: allKpis, loading: loadingKpis } = useSharePointKPIs(undefined, undefined);
  const { data: allTasks, loading: loadingTasks } = useSharePointTasks(undefined, 'All', CORPORATE_CONTEXT);

  const graph = useMemo(() => {
    const strategicGoals: StrategicGoal[] = (strategyData?.strategicGoals || []).map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
    }));
    const divisionStructure: Record<string, string[]> =
      ((strategyData as any)?.hierarchy as Record<string, string[]>) || {};

    // Legacy interim: the service adapts the existing 3 lists into unified
    // PerformanceRecords. After migration, pass `performanceRecords` directly.
    const input: GraphInput = {
      scope,
      strategicGoals,
      unitObjectives: allObjectives || [],
      performanceKras: allKras || [],
      kpis: allKpis || [],
      tasks: allTasks || [],
      divisionStructure,
    };
    return buildStrategyExecutionGraph(input);
  }, [strategyData, allObjectives, allKras, allKpis, allTasks, scope]);

  return {
    graph,
    isLoading: loadingObjectives || loadingKras || loadingKpis || loadingTasks,
  };
}
