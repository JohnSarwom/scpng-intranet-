import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { toast } from 'sonner';
import { getGraphClient } from '@/services/graphService';
import { getHRServiceInstance } from '@/services/hrSharePointService';
import { ApprovalAttachment, LeaveRequest } from '@/types/hr';

/**
 * Fetch all in-flight leave requests for the approver dashboard.
 * filterStage: when supplied, only that workflow stage is returned.
 * Polls every 60 seconds, frequent enough to catch changes while staying light.
 */
export const useLeaveApprovals = (filterStage?: string) => {
  const { instance: msalInstance } = useMsal();

  return useQuery<LeaveRequest[]>({
    queryKey: ['hr', 'leave-approvals', filterStage ?? 'all'],
    queryFn: async () => {
      if (!msalInstance) return [];
      const client = await getGraphClient(msalInstance);
      if (!client) throw new Error('Graph client unavailable');
      const service = await getHRServiceInstance(client);
      return service.getAllPendingLeaveRequests(filterStage);
    },
    enabled: !!msalInstance,
    refetchInterval: 60_000,
  });
};

export const useLeaveRequestById = (itemId?: string) => {
  const { instance: msalInstance } = useMsal();

  return useQuery<LeaveRequest | null>({
    queryKey: ['hr', 'leave-request', itemId],
    queryFn: async () => {
      if (!itemId || !msalInstance) return null;
      const client = await getGraphClient(msalInstance);
      if (!client) throw new Error('Graph client unavailable');
      const service = await getHRServiceInstance(client);
      return service.getLeaveRequestById(itemId);
    },
    enabled: !!itemId && !!msalInstance,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });
};

export const useAllLeaveApprovals = (enabled = true) => {
  const { instance: msalInstance } = useMsal();

  return useQuery<LeaveRequest[]>({
    queryKey: ['hr', 'leave-approvals', 'history'],
    queryFn: async () => {
      if (!msalInstance) return [];
      const client = await getGraphClient(msalInstance);
      if (!client) throw new Error('Graph client unavailable');
      const service = await getHRServiceInstance(client);
      return service.getAllLeaveRequests();
    },
    enabled: !!msalInstance && enabled,
    refetchInterval: 60_000,
  });
};

interface ApprovePayload {
  itemId: string;
  currentStage: string;
  approverName: string;
  approverEmail: string;
  employeeId: string;
  leaveType: string;
  daysRequested: number;
  comments?: string;
  attachments?: ApprovalAttachment[];
  employeeEmail?: string;
  employeeName?: string;
  startDate?: string;
  endDate?: string;
  division?: string;
  unit?: string;
}

interface LeaveActionMutationOptions {
  showToasts?: boolean;
}

/** Approve a request and advance it to the next stage. */
export const useApproveLeave = (options: LeaveActionMutationOptions = {}) => {
  const { instance: msalInstance } = useMsal();
  const queryClient = useQueryClient();
  const showToasts = options.showToasts ?? true;

  return useMutation({
    mutationFn: async (payload: ApprovePayload) => {
      const client = await getGraphClient(msalInstance);
      if (!client) throw new Error('Graph client unavailable');
      const service = await getHRServiceInstance(client);
      const emailCtx = (payload.division || payload.unit || payload.employeeEmail)
        ? {
            employeeEmail: payload.employeeEmail ?? '',
            employeeName: payload.employeeName ?? payload.employeeId,
            startDate: payload.startDate ?? '',
            endDate: payload.endDate ?? '',
            division: payload.division,
            unit: payload.unit,
          }
        : undefined;

      await service.approveLeaveRequest(
        payload.itemId,
        payload.currentStage,
        payload.approverName,
        payload.approverEmail,
        payload.employeeId,
        payload.leaveType,
        payload.daysRequested,
        payload.comments,
        payload.attachments,
        emailCtx
      );
    },
    onSuccess: (_data, vars) => {
      const isFullyApproved = vars.currentStage === 'HR Review';
      if (showToasts) {
        toast.success(
          isFullyApproved
            ? 'Leave approved - balance deducted.'
            : `Forwarded to ${vars.currentStage === 'Manager Review' ? 'Director' : 'HR'} Review.`
        );
      }
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-request'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-balances'] });
    },
    onError: (e: unknown) => {
      if (showToasts) {
        toast.error('Approval failed', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    },
  });
};

interface RejectPayload {
  itemId: string;
  currentStage: string;
  approverName: string;
  approverEmail: string;
  employeeId: string;
  reason: string;
  leaveType: string;
  daysRequested: number;
  attachments?: ApprovalAttachment[];
  employeeEmail?: string;
  employeeName?: string;
  startDate?: string;
  endDate?: string;
  division?: string;
  unit?: string;
}

/** Reject a request at any stage with a required reason. Reverses pending balance. */
export const useRejectLeave = (options: LeaveActionMutationOptions = {}) => {
  const { instance: msalInstance } = useMsal();
  const queryClient = useQueryClient();
  const showToasts = options.showToasts ?? true;

  return useMutation({
    mutationFn: async (payload: RejectPayload) => {
      const client = await getGraphClient(msalInstance);
      if (!client) throw new Error('Graph client unavailable');
      const service = await getHRServiceInstance(client);
      const emailCtx = (payload.division || payload.unit || payload.employeeEmail)
        ? {
            employeeEmail: payload.employeeEmail ?? '',
            employeeName: payload.employeeName ?? payload.employeeId,
            startDate: payload.startDate ?? '',
            endDate: payload.endDate ?? '',
            division: payload.division,
            unit: payload.unit,
          }
        : undefined;

      await service.rejectLeaveRequest(
        payload.itemId,
        payload.currentStage,
        payload.approverName,
        payload.approverEmail,
        payload.employeeId,
        payload.reason,
        payload.leaveType,
        payload.daysRequested,
        payload.attachments,
        emailCtx
      );
    },
    onSuccess: () => {
      if (showToasts) {
        toast.success('Leave request rejected.');
      }
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-request'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-requests'] });
    },
    onError: (e: unknown) => {
      if (showToasts) {
        toast.error('Rejection failed', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    },
  });
};

interface CancelPayload {
  itemId: string;
  employeeId: string;
  leaveType: string;
  daysRequested: number;
  cancellerEmail: string;
}

/** Employee cancels their own pending leave request. */
export const useCancelLeave = () => {
  const { instance: msalInstance } = useMsal();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CancelPayload) => {
      const client = await getGraphClient(msalInstance);
      if (!client) throw new Error('Graph client unavailable');
      const service = await getHRServiceInstance(client);
      await service.cancelLeaveRequest(
        payload.itemId,
        payload.employeeId,
        payload.leaveType,
        payload.daysRequested,
        payload.cancellerEmail
      );
    },
    onSuccess: () => {
      toast.success('Leave request cancelled.');
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-balances'] });
    },
    onError: (e: unknown) => {
      toast.error('Cancellation failed', {
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });
};
