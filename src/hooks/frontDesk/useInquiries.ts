import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FrontDeskConflictError } from '@/services/frontDesk/frontDeskGraph';
import { InquiriesService } from '@/services/frontDesk/inquiriesService';
import type { FrontDeskInquiry, InquiryInput } from '@/services/frontDesk/inquiryRules';
import { frontDeskKeys, FRONT_DESK_LIVE_REFETCH_MS } from './frontDeskQueryKeys';
import { frontDeskFailed, frontDeskSaved } from './frontDeskToasts';
import { useFrontDeskActor } from './useFrontDeskActor';
import { useFrontDeskGraph } from './useFrontDeskGraph';

function useInquiriesService() {
  const getGraph = useFrontDeskGraph();
  return async () => new InquiriesService(await getGraph());
}

/** Inquiries reported in the period, refreshed every 30 seconds so two desks stay in step. */
export function useInquiriesReported(start: string, end: string) {
  const service = useInquiriesService();
  return useQuery({
    queryKey: frontDeskKeys.inquiriesReported(start, end),
    queryFn: async () => (await service()).listReportedBetween(start, end),
    refetchInterval: FRONT_DESK_LIVE_REFETCH_MS,
  });
}

/** Every unresolved inquiry, from any day. */
export function useOpenInquiries(enabled = true) {
  const service = useInquiriesService();
  return useQuery({
    queryKey: frontDeskKeys.inquiriesOpen(),
    queryFn: async () => (await service()).listOpen(),
    refetchInterval: FRONT_DESK_LIVE_REFETCH_MS,
    enabled,
  });
}

/** What changed, for the toast after an inline or dialog save. */
function describeChange(inquiry: FrontDeskInquiry, input: InquiryInput) {
  const changes = [
    input.status !== inquiry.status && `marked ${input.status}`,
    (input.assigneeEmail || '') !== (inquiry.assigneeEmail || '') && (input.assigneeEmail ? `assigned to ${input.assigneeName || input.assigneeEmail}` : 'unassigned'),
    input.category !== inquiry.category && `moved to ${input.category}`,
  ].filter(Boolean);
  return changes.length === 1 ? `${input.title.trim()} ${changes[0]}.` : `${input.title.trim()} updated.`;
}

export function useInquiryMutations() {
  const queryClient = useQueryClient();
  const actor = useFrontDeskActor();
  const service = useInquiriesService();
  const refresh = () => queryClient.invalidateQueries({ queryKey: frontDeskKeys.inquiries() });
  const failed = (action: string) => (error: unknown) => {
    frontDeskFailed(action, error);
    if (error instanceof FrontDeskConflictError) void refresh();
  };

  const create = useMutation({
    mutationFn: async (input: InquiryInput) => (await service()).create(input, actor.email),
    onSuccess: inquiry => frontDeskSaved(`${inquiry.title} logged.`),
    onError: failed('log the inquiry'),
    onSettled: refresh,
  });

  const update = useMutation({
    mutationFn: async ({ inquiry, input }: { inquiry: FrontDeskInquiry; input: InquiryInput }) =>
      (await service()).update(inquiry, input, actor.email),
    onSuccess: (_, { inquiry, input }) => frontDeskSaved(describeChange(inquiry, input)),
    onError: failed('save the inquiry'),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (inquiry: FrontDeskInquiry) => (await service()).remove(inquiry),
    onSuccess: (_, inquiry) => frontDeskSaved(`${inquiry.title} deleted.`),
    onError: failed('delete the inquiry'),
    onSettled: refresh,
  });

  return { create, update, remove };
}
