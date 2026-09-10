import { useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { SharePointOpsService } from '@/services/sharePointOpsService';
import {
  createSharePointStrategyReportArchiveService,
  type StoredStrategyReportArchive,
} from '@/services/strategyReportArchiveService';
import {
  selectStrategyAIArchive,
  type StrategyAIArchiveRequest,
} from '@/services/strategyReportAIService';

export interface ArchivedStrategyAIState {
  archive?: StoredStrategyReportArchive;
  isLoading: boolean;
  error?: Error;
}

/** Read-only loader for an authorized, checksum-verified AI evidence snapshot. */
export function useArchivedStrategyAI(request: StrategyAIArchiveRequest): ArchivedStrategyAIState {
  const { instance } = useMsal();
  const [state, setState] = useState<ArchivedStrategyAIState>({ isLoading: true });
  const division = request.division?.trim() || '';

  useEffect(() => {
    let active = true;
    setState({ isLoading: true });
    (async () => {
      try {
        const client = await getGraphClient(instance);
        if (!client) throw new Error('The archived report store is unavailable because no Graph client could be created.');
        const gateway = new SharePointOpsService(client);
        await gateway.initialize();
        const history = await createSharePointStrategyReportArchiveService(gateway).history(100);
        const archive = selectStrategyAIArchive(history, { audience: request.audience, division });
        if (active) setState({ archive, isLoading: false });
      } catch (error) {
        if (active) setState({ isLoading: false, error: error instanceof Error ? error : new Error(String(error)) });
      }
    })();
    return () => { active = false; };
  }, [instance, request.audience, division]);

  return state;
}
