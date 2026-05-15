import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, ChevronRight, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useLeaveApprovals, useApproveLeave, useRejectLeave } from '@/hooks/useLeaveApprovals';
import { useGraphProfile } from '@/hooks/useGraphProfile';
import { LeaveRequest } from '@/types/hr';

const STAGE_LABELS: Record<string, string> = {
  'Manager Review': 'Manager',
  'Director Review': 'Director',
  'HR Review': 'HR',
};

const STAGE_COLOR: Record<string, string> = {
  'Manager Review': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'Director Review': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  'HR Review': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

interface RejectDialogState {
  open: boolean;
  request: LeaveRequest | null;
  reason: string;
}

interface Props {
  autoRequestId?: string;
}

const STAGE_TO_TAB: Record<string, string> = {
  'Manager Review': 'manager',
  'Director Review': 'director',
  'HR Review': 'hr',
};

const LeaveApprovalDashboard: React.FC<Props> = ({ autoRequestId }) => {
  const { profile } = useGraphProfile();
  const approverName = profile?.displayName ?? 'Approver';
  const approverEmail = profile?.mail ?? profile?.userPrincipalName ?? '';

  const { data: allPending = [], isLoading, isFetching } = useLeaveApprovals();
  const approveMutation = useApproveLeave();
  const rejectMutation = useRejectLeave();

  const [rejectDialog, setRejectDialog] = useState<RejectDialogState>({
    open: false,
    request: null,
    reason: '',
  });

  // Highlighted request from email deep-link
  const highlightedId = autoRequestId ?? null;
  const [activeStageTab, setActiveStageTab] = useState('manager');
  const highlightedRowRef = useRef<HTMLDivElement>(null);

  const managerQueue = allPending.filter(r => r.stage === 'Manager Review');
  const directorQueue = allPending.filter(r => r.stage === 'Director Review');
  const hrQueue = allPending.filter(r => r.stage === 'HR Review');

  // When data loads and we have a deep-link ID, switch to the correct stage tab and scroll
  useEffect(() => {
    if (!highlightedId || allPending.length === 0) return;
    const target = allPending.find(r => String(r.id) === highlightedId);
    if (!target?.stage) return;
    const tab = STAGE_TO_TAB[target.stage];
    if (tab) setActiveStageTab(tab);
  }, [highlightedId, allPending]);

  useEffect(() => {
    if (!highlightedId || isLoading) return;
    const timer = setTimeout(() => {
      highlightedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    return () => clearTimeout(timer);
  }, [highlightedId, isLoading, activeStageTab]);

  const handleApprove = (req: LeaveRequest) => {
    approveMutation.mutate({
      itemId: String(req.id),
      currentStage: req.stage!,
      approverName,
      approverEmail,
      employeeId: req.employeeId,
      leaveType: req.leaveType,
      daysRequested: req.daysRequested,
      employeeEmail: req.employeeEmail,
      employeeName: req.employeeName,
      startDate: req.startDate,
      endDate: req.endDate,
      division: req.division,
      unit: req.unit,
    });
  };

  const openReject = (req: LeaveRequest) =>
    setRejectDialog({ open: true, request: req, reason: '' });

  const confirmReject = () => {
    const req = rejectDialog.request;
    if (!req || !rejectDialog.reason.trim()) return;
    rejectMutation.mutate(
      {
        itemId: String(req.id),
        currentStage: req.stage!,
        approverName,
        approverEmail,
        employeeId: req.employeeId,
        reason: rejectDialog.reason.trim(),
        leaveType: req.leaveType,
        daysRequested: req.daysRequested,
        employeeEmail: req.employeeEmail,
        employeeName: req.employeeName,
        startDate: req.startDate,
        endDate: req.endDate,
        division: req.division,
        unit: req.unit,
      },
      { onSettled: () => setRejectDialog({ open: false, request: null, reason: '' }) }
    );
  };

  const RequestRow: React.FC<{ req: LeaveRequest }> = ({ req }) => {
    const isPending = approveMutation.isPending || rejectMutation.isPending;
    const isHighlighted = highlightedId && String(req.id) === highlightedId;

    return (
      <div
        ref={isHighlighted ? highlightedRowRef : undefined}
        className={`grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto_auto] gap-3 items-center p-4 border-b dark:border-white/10 last:border-0 transition-colors ${
          isHighlighted
            ? 'bg-amber-50 border-l-4 border-l-amber-400 dark:bg-amber-900/20 dark:border-l-amber-500'
            : 'hover:bg-gray-50 dark:hover:bg-white/5'
        }`}
      >
        {/* Employee + type */}
        <div>
          <p className="font-medium text-sm dark:text-gray-100">
            {req.employeeName || req.employeeId}
          </p>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            {req.leaveType} Leave
          </p>
        </div>

        {/* Dates */}
        <div className="text-sm dark:text-gray-300">
          {req.startDate && req.endDate ? (
            <>
              {format(new Date(req.startDate), 'dd MMM yyyy')}
              {' – '}
              {format(new Date(req.endDate), 'dd MMM yyyy')}
              <span className="ml-1 text-xs text-muted-foreground dark:text-gray-500">
                ({req.daysRequested} day{req.daysRequested !== 1 ? 's' : ''})
              </span>
            </>
          ) : '—'}
        </div>

        {/* Stage badge */}
        <Badge
          className={`text-xs ${STAGE_COLOR[req.stage!] ?? 'bg-gray-100 text-gray-700'}`}
          variant="secondary"
        >
          {STAGE_LABELS[req.stage!] ?? req.stage}
        </Badge>

        {/* Submitted */}
        <p className="text-xs text-muted-foreground dark:text-gray-500 whitespace-nowrap">
          {req.createdDate ? format(new Date(req.createdDate), 'dd MMM') : ''}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900/40 dark:hover:bg-red-900/20"
            onClick={() => openReject(req)}
            disabled={isPending}
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Reject
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => handleApprove(req)}
            disabled={isPending}
          >
            {approveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            )}
            {req.stage === 'HR Review' ? 'Approve & Close' : 'Approve'}
            {req.stage !== 'HR Review' && (
              <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            )}
          </Button>
        </div>
      </div>
    );
  };

  const EmptyState = ({ label }: { label: string }) => (
    <div className="py-12 text-center text-muted-foreground dark:text-gray-500 text-sm">
      No {label} requests pending.
    </div>
  );

  const QueueTab = ({
    requests,
    label,
  }: {
    requests: LeaveRequest[];
    label: string;
  }) => (
    <Card className="dark:bg-gray-800 dark:border-white/10">
      <CardContent className="p-0">
        {requests.length === 0 ? (
          <EmptyState label={label} />
        ) : (
          requests.map(req => <RequestRow key={String(req.id)} req={req} />)
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold dark:text-gray-100">Leave Approvals</h2>
            <p className="text-sm text-muted-foreground dark:text-gray-400 mt-0.5">
              Review and action pending leave requests across all stages.
            </p>
          </div>
          {isFetching && !isLoading && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground dark:text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Refreshing…
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={activeStageTab} onValueChange={setActiveStageTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="manager" className="gap-2">
                Manager Review
                {managerQueue.length > 0 && (
                  <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0 min-w-[18px]">
                    {managerQueue.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="director" className="gap-2">
                Director Review
                {directorQueue.length > 0 && (
                  <Badge className="bg-purple-600 text-white text-[10px] px-1.5 py-0 min-w-[18px]">
                    {directorQueue.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="hr" className="gap-2">
                HR Review
                {hrQueue.length > 0 && (
                  <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 min-w-[18px]">
                    {hrQueue.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manager">
              <QueueTab requests={managerQueue} label="Manager Review" />
            </TabsContent>
            <TabsContent value="director">
              <QueueTab requests={directorQueue} label="Director Review" />
            </TabsContent>
            <TabsContent value="hr">
              <QueueTab requests={hrQueue} label="HR Review" />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Rejection reason dialog */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={open => !open && setRejectDialog({ open: false, request: null, reason: '' })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>
              {rejectDialog.request && (
                <>
                  Rejecting{' '}
                  <strong>
                    {rejectDialog.request.employeeName || rejectDialog.request.employeeId}
                  </strong>
                  's {rejectDialog.request.leaveType} leave (
                  {rejectDialog.request.daysRequested} day
                  {rejectDialog.request.daysRequested !== 1 ? 's' : ''}).
                </>
              )}{' '}
              A reason is required and will be visible to the employee.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason">Reason for rejection</Label>
            <Textarea
              id="reject-reason"
              placeholder="e.g. Insufficient leave balance, business-critical period, documentation required…"
              value={rejectDialog.reason}
              onChange={e => setRejectDialog(prev => ({ ...prev, reason: e.target.value }))}
              rows={4}
              className="dark:bg-white/5 dark:border-white/10"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRejectDialog({ open: false, request: null, reason: '' })}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectDialog.reason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4 mr-2" />
              )}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LeaveApprovalDashboard;
