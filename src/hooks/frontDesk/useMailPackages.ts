import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MailStatus } from '@/services/frontDesk/frontDeskConfig';
import { FrontDeskConflictError } from '@/services/frontDesk/frontDeskGraph';
import { MailPackagesService } from '@/services/frontDesk/mailPackagesService';
import type { FrontDeskMailItem, MailInput } from '@/services/frontDesk/mailRules';
import { frontDeskKeys, FRONT_DESK_LIVE_REFETCH_MS } from './frontDeskQueryKeys';
import { frontDeskFailed, frontDeskSaved } from './frontDeskToasts';
import { useFrontDeskActor } from './useFrontDeskActor';
import { useFrontDeskGraph } from './useFrontDeskGraph';

function useMailService() {
  const getGraph = useFrontDeskGraph();
  return async () => new MailPackagesService(await getGraph());
}

/** Items received in the period, refreshed every 30 seconds so two desks stay in step. */
export function useMailInPeriod(start: string, end: string) {
  const service = useMailService();
  return useQuery({
    queryKey: frontDeskKeys.mailInPeriod(start, end),
    queryFn: async () => (await service()).listReceivedBetween(start, end),
    refetchInterval: FRONT_DESK_LIVE_REFETCH_MS,
  });
}

/** Everything still waiting at reception, from any day. */
export function useMailOutstanding() {
  const service = useMailService();
  return useQuery({
    queryKey: frontDeskKeys.mailOutstanding(),
    queryFn: async () => (await service()).listOutstanding(),
    refetchInterval: FRONT_DESK_LIVE_REFETCH_MS,
  });
}

export function useMailMutations() {
  const queryClient = useQueryClient();
  const actor = useFrontDeskActor();
  const service = useMailService();
  const refresh = () => queryClient.invalidateQueries({ queryKey: frontDeskKeys.mailPackages() });
  const failed = (action: string) => (error: unknown) => {
    frontDeskFailed(action, error);
    if (error instanceof FrontDeskConflictError) void refresh();
  };
  const label = (item: { itemType: string; recipientName: string }) => `${item.itemType === 'Package' ? 'Parcel' : 'Mail'} for ${item.recipientName}`;

  const create = useMutation({
    mutationFn: async (input: MailInput) => (await service()).create(input, actor.email),
    onSuccess: item => frontDeskSaved(`${label(item)} logged.`),
    onError: failed('log the item'),
    onSettled: refresh,
  });

  const update = useMutation({
    mutationFn: async ({ item, input }: { item: FrontDeskMailItem; input: MailInput }) => (await service()).update(item, input),
    onSuccess: (_, { input }) => frontDeskSaved(`${label(input)} updated.`),
    onError: failed('update the item'),
    onSettled: refresh,
  });

  const changeStatus = useMutation({
    mutationFn: async ({ item, target, collection }: { item: FrontDeskMailItem; target: MailStatus; collection?: { collectedBy: string; collectedAt: string } }) =>
      (await service()).changeStatus(item, target, collection),
    onSuccess: next => frontDeskSaved(next.status === 'Delivered' ? `${label(next)} collected by ${next.collectedBy}.` : `${label(next)}: status changed.`),
    onError: failed('change the status'),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (item: FrontDeskMailItem) => (await service()).remove(item),
    onSuccess: (_, item) => frontDeskSaved(`${label(item)} deleted.`),
    onError: failed('delete the item'),
    onSettled: refresh,
  });

  return { create, update, changeStatus, remove };
}
