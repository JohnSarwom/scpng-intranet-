import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { VisitorStatus } from '@/services/frontDesk/frontDeskConfig';
import { FrontDeskConflictError } from '@/services/frontDesk/frontDeskGraph';
import type { FrontDeskVisitor, VisitorInput } from '@/services/frontDesk/visitorRules';
import { VisitorsService } from '@/services/frontDesk/visitorsService';
import { frontDeskKeys, FRONT_DESK_LIVE_REFETCH_MS } from './frontDeskQueryKeys';
import { frontDeskFailed, frontDeskSaved } from './frontDeskToasts';
import { useFrontDeskActor } from './useFrontDeskActor';
import { useFrontDeskGraph } from './useFrontDeskGraph';

const VISITOR_QUERIES: QueryKey = ['front-desk', 'visitors'];

function useVisitorsService() {
  const getGraph = useFrontDeskGraph();
  return async () => new VisitorsService(await getGraph());
}

/** One PNG day of the visitor log, refreshed every 30 seconds so two desks stay in step. */
export function useVisitorLog(dateKey: string) {
  const service = useVisitorsService();
  return useQuery({
    queryKey: frontDeskKeys.visitors(dateKey),
    queryFn: async () => (await service()).listByDate(dateKey),
    refetchInterval: FRONT_DESK_LIVE_REFETCH_MS,
  });
}

/** Everyone currently on site, from any day. */
export function useVisitorsOnSite() {
  const service = useVisitorsService();
  return useQuery({
    queryKey: frontDeskKeys.visitorsOnSite(),
    queryFn: async () => (await service()).listOnSite(),
    refetchInterval: FRONT_DESK_LIVE_REFETCH_MS,
  });
}

/** Puts a changed visitor into every cached visitor list, adding or dropping it from the on-site list. */
function withVisitor(list: FrontDeskVisitor[] | undefined, next: FrontDeskVisitor, onSiteList: boolean) {
  if (!list) return list;
  const others = list.filter(v => v.id !== next.id);
  if (onSiteList) return next.status === 'On Site' ? [...others, next] : others;
  return list.some(v => v.id === next.id) ? list.map(v => (v.id === next.id ? next : v)) : list;
}

export function useVisitorMutations() {
  const queryClient = useQueryClient();
  const actor = useFrontDeskActor();
  const service = useVisitorsService();
  const refresh = () => queryClient.invalidateQueries({ queryKey: VISITOR_QUERIES });
  const failed = (action: string) => (error: unknown) => {
    frontDeskFailed(action, error);
    if (error instanceof FrontDeskConflictError) void refresh();
  };

  const create = useMutation({
    mutationFn: async ({ input, status }: { input: VisitorInput; status: 'Expected' | 'On Site' }) =>
      (await service()).create(input, status, actor.email, new Date().toISOString()),
    onSuccess: (visitor, { status }) =>
      frontDeskSaved(status === 'On Site' ? `${visitor.name} signed in.` : `${visitor.name} added to ${visitor.visitDate}.`),
    onError: failed('save the visitor'),
    onSettled: refresh,
  });

  const update = useMutation({
    mutationFn: async ({ visitor, input }: { visitor: FrontDeskVisitor; input: VisitorInput }) =>
      (await service()).update(visitor, input),
    onSuccess: (_, { input }) => frontDeskSaved(`${input.name.trim()} updated.`),
    onError: failed('update the visitor'),
    onSettled: refresh,
  });

  /** Sign in, sign out, no-show or a board drag. The screen changes at once and rolls back if SharePoint refuses. */
  const changeStatus = useMutation({
    mutationFn: async ({ visitor, target }: { visitor: FrontDeskVisitor; target: VisitorStatus }) =>
      (await service()).changeStatus(visitor, target, new Date().toISOString(), actor.email),
    onMutate: async ({ visitor, target }) => {
      await queryClient.cancelQueries({ queryKey: VISITOR_QUERIES });
      const snapshot = queryClient.getQueriesData<FrontDeskVisitor[]>({ queryKey: VISITOR_QUERIES });
      const now = new Date().toISOString();
      const optimistic: FrontDeskVisitor = {
        ...visitor,
        status: target,
        timeIn: target === 'On Site' ? visitor.timeIn || now : target === 'Expected' ? undefined : visitor.timeIn,
        timeOut: target === 'Signed Out' ? now : target === 'On Site' ? undefined : visitor.timeOut,
      };
      for (const [key] of snapshot) {
        const onSiteList = key[2] === 'on-site';
        queryClient.setQueryData<FrontDeskVisitor[]>(key, list => withVisitor(list, optimistic, onSiteList));
      }
      return { snapshot };
    },
    onError: (error, _, context) => {
      for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data);
      failed('change the visitor’s status')(error);
    },
    onSuccess: (next, { target }) => {
      if (target === 'Signed Out') frontDeskSaved(`${next.name} signed out.`);
      if (target === 'On Site') frontDeskSaved(`${next.name} signed in.`);
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (visitor: FrontDeskVisitor) => (await service()).remove(visitor),
    onSuccess: (_, visitor) => frontDeskSaved(`${visitor.name} deleted.`),
    onError: failed('delete the visitor'),
    onSettled: refresh,
  });

  const attachPhoto = useMutation({
    mutationFn: async ({ visitorId, file }: { visitorId: string; file: File }) => (await service()).attachPhoto(visitorId, file),
    onError: failed('upload the photo'),
    onSettled: refresh,
  });

  return { create, update, changeStatus, remove, attachPhoto };
}
