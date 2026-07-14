import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { Loader2, CheckCircle, XCircle, AlertCircle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLeaveRequestById, useApproveLeave, useRejectLeave } from '@/hooks/useLeaveApprovals';
import { LeaveRequest } from '@/types/hr';

type Phase = 'loading' | 'confirm' | 'processing' | 'done' | 'error' | 'already-actioned' | 'unauthorized';

const TERMINAL_STATUSES = ['Approved', 'Rejected', 'Declined', 'Cancelled'];
const ALLOW_SELF_LEAVE_APPROVAL_TESTING = true;

const sameEmail = (a?: string, b?: string) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

export default function LeaveActionPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { accounts } = useMsal();

  const requestId = params.get('requestId') ?? '';
  const action = params.get('action') as 'approve' | 'decline' | null;

  const [phase, setPhase] = useState<Phase>('loading');
  const [declineReason, setDeclineReason] = useState('');
  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [resultMessage, setResultMessage] = useState('');

  const approverEmail = accounts[0]?.username ?? '';
  const approverName = accounts[0]?.name ?? approverEmail;

  const {
    data: requestData,
    isLoading,
    isFetching,
    isSuccess,
    isError,
    error,
  } = useLeaveRequestById(requestId);
  const approveMutation = useApproveLeave({ showToasts: false });
  const rejectMutation = useRejectLeave({ showToasts: false });

  useEffect(() => {
    if (!requestId || !action) {
      setPhase('error');
      setResultMessage('Invalid link - missing request ID or action.');
      return;
    }

    if (isLoading || isFetching) {
      setPhase('loading');
      return;
    }

    if (isError) {
      setPhase('error');
      setResultMessage(error instanceof Error ? error.message : 'Could not load this leave request.');
      return;
    }

    if (!isSuccess) return;

    if (!requestData) {
      setRequest(null);
      setPhase('already-actioned');
      setResultMessage('This request was not found. It may have already been actioned, removed, or recreated.');
      return;
    }

    setRequest(requestData);

    if (TERMINAL_STATUSES.includes(requestData.status)) {
      setPhase('already-actioned');
      setResultMessage(`This request is already ${requestData.status.toLowerCase()}.`);
      return;
    }

    if (!ALLOW_SELF_LEAVE_APPROVAL_TESTING && sameEmail(approverEmail, requestData.employeeEmail)) {
      setPhase('unauthorized');
      setResultMessage('You cannot approve or decline your own leave request. It must be routed to a higher-level approver.');
      return;
    }

    setPhase('confirm');
  }, [requestId, action, isLoading, isFetching, isSuccess, isError, error, requestData, approverEmail]);

  const handleApprove = async () => {
    if (!request) return;
    setPhase('processing');
    try {
      await approveMutation.mutateAsync({
        itemId: String(request.id),
        currentStage: request.stage ?? 'Manager Review',
        approverName,
        approverEmail,
        employeeId: request.employeeId,
        leaveType: request.leaveType,
        daysRequested: request.daysRequested,
        employeeEmail: request.employeeEmail,
        employeeName: request.employeeName,
        startDate: request.startDate,
        endDate: request.endDate,
        division: request.division,
        unit: request.unit,
      });
      setResultMessage(`Leave approved for ${request.employeeName ?? request.employeeId}.`);
      setPhase('done');
    } catch (e: any) {
      setResultMessage(e?.message ?? 'Approval failed. Please try again from the dashboard.');
      setPhase('error');
    }
  };

  const handleDecline = async () => {
    if (!request) return;
    if (!declineReason.trim()) return;
    setPhase('processing');
    try {
      await rejectMutation.mutateAsync({
        itemId: String(request.id),
        currentStage: request.stage ?? 'Manager Review',
        approverName,
        approverEmail,
        employeeId: request.employeeId,
        reason: declineReason.trim(),
        leaveType: request.leaveType,
        daysRequested: request.daysRequested,
        employeeEmail: request.employeeEmail,
        employeeName: request.employeeName,
        startDate: request.startDate,
        endDate: request.endDate,
        division: request.division,
        unit: request.unit,
      });
      setResultMessage(`Leave declined for ${request.employeeName ?? request.employeeId}.`);
      setPhase('done');
    } catch (e: any) {
      setResultMessage(e?.message ?? 'Decline failed. Please try again from the dashboard.');
      setPhase('error');
    }
  };

  const fmt = (d?: string) => {
    if (!d) return 'Not recorded';
    try {
      return new Date(d).toLocaleDateString('en-PG', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const renderRequestDetails = (item: LeaveRequest) => (
    <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
      {[
        ['Employee', item.employeeName ?? item.employeeId],
        ['Leave Type', item.leaveType],
        ['Dates', `${fmt(item.startDate)} - ${fmt(item.endDate)}`],
        ['Days', `${item.daysRequested} working day${item.daysRequested !== 1 ? 's' : ''}`],
        ['Stage', item.stage ?? 'Not recorded'],
      ].map(([label, value]) => (
        <div key={label} className="flex px-4 py-2.5 gap-3">
          <span className="text-gray-400 w-24 shrink-0">{label}</span>
          <span className="text-gray-800 font-medium">{value}</span>
        </div>
      ))}
    </div>
  );

  const renderTimeline = (item: LeaveRequest) => (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600">
      <p className="font-semibold text-gray-700 mb-2">Request timeline</p>
      <div className="space-y-1">
        <p>Submitted: {fmt(item.createdDate)}</p>
        <p>Current stage: {item.stage ?? 'Not recorded'}</p>
        {item.approvalHistory?.slice(-3).map((entry) => (
          <p key={entry.id}>
            {entry.action} by {entry.actorName} on {fmt(entry.createdAt)}
          </p>
        ))}
      </div>
    </div>
  );

  const renderRequestSkeleton = () => (
    <div className="space-y-4 py-1">
      <div className="h-4 w-4/5 animate-pulse rounded bg-gray-200" />
      <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="flex px-4 py-3 gap-3">
            <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
            <div className="h-3 flex-1 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <div className="h-10 flex-1 animate-pulse rounded bg-gray-200" />
        <div className="h-10 flex-1 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f4f0] p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
        <div className="bg-[#400010] px-6 py-5 flex items-center gap-3">
          <img src="/images/SCPNG Original Logo.png" alt="SCPNG" className="h-10 w-auto" />
          <div>
            <p className="text-[#d4a62a] text-xs font-semibold tracking-widest uppercase">SCPNG Intranet</p>
            <p className="text-white text-sm font-bold">Leave {action === 'approve' ? 'Approval' : 'Decline'}</p>
          </div>
        </div>

        <div className="px-6 py-6">
          {phase === 'loading' && renderRequestSkeleton()}

          {phase === 'already-actioned' && (
            <div className="flex flex-col gap-4 py-2 text-center">
              <div className="flex flex-col items-center gap-3">
                <AlertCircle className="h-10 w-10 text-amber-500" />
                <p className="text-gray-800 font-semibold">Request not available</p>
                <p className="text-gray-500 text-sm">{resultMessage}</p>
              </div>
              {request && renderRequestDetails(request)}
              <Button variant="outline" size="sm" className="mt-1" onClick={() => navigate('/approvals')}>
                View Leave Approvals
              </Button>
            </div>
          )}

          {phase === 'unauthorized' && (
            <div className="flex flex-col gap-4 py-2 text-center">
              <div className="flex flex-col items-center gap-3">
                <ShieldAlert className="h-10 w-10 text-red-500" />
                <p className="text-gray-800 font-semibold">Unauthorized Action</p>
                <p className="text-gray-500 text-sm">{resultMessage}</p>
              </div>
              {request && renderRequestDetails(request)}
              <Button variant="outline" size="sm" className="mt-1" onClick={() => navigate('/approvals')}>
                View Leave Approvals
              </Button>
            </div>
          )}

          {phase === 'confirm' && request && (
            <div className="space-y-4">
              <p className="text-gray-700 text-sm">
                You are about to <strong>{action === 'approve' ? 'approve' : 'decline'}</strong> the
                following leave request:
              </p>

              {renderRequestDetails(request)}
              {renderTimeline(request)}

              {action === 'decline' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    Reason for declining <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    placeholder="Please provide a reason..."
                    value={declineReason}
                    onChange={e => setDeclineReason(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-1">
                {action === 'approve' ? (
                  <Button className="flex-1 bg-[#1a5e2a] hover:bg-[#14491f] text-white" onClick={handleApprove}>
                    Confirm Approval
                  </Button>
                ) : (
                  <Button
                    className="flex-1 bg-[#7a1020] hover:bg-[#5b0b12] text-white"
                    onClick={handleDecline}
                    disabled={!declineReason.trim()}
                  >
                    Confirm Decline
                  </Button>
                )}
                <Button variant="outline" className="flex-1" onClick={() => navigate('/approvals')}>
                  View Dashboard
                </Button>
              </div>
            </div>
          )}

          {phase === 'processing' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-[#400010]" />
              <p className="text-gray-500 text-sm">
                {action === 'approve' ? 'Approving...' : 'Declining...'}
              </p>
            </div>
          )}

          {phase === 'done' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-gray-800 font-semibold text-base">{resultMessage}</p>
              <p className="text-gray-500 text-sm">
                The employee has been notified by email.
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/approvals')}>
                View Leave Approvals
              </Button>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <XCircle className="h-10 w-10 text-red-500" />
              <p className="text-gray-800 font-semibold">Something went wrong</p>
              <p className="text-gray-500 text-sm">{resultMessage}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/approvals')}>
                Go to Leave Approvals
              </Button>
            </div>
          )}
        </div>

        <div className="border-t px-6 py-3 bg-gray-50">
          <p className="text-xs text-gray-400 text-center">
            SCPNG Intranet - HR Department - {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
