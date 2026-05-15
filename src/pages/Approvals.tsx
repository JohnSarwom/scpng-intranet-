import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  History,
  Loader2,
  MessageSquare,
  Paperclip,
  Search,
  Send,
  UserCheck,
  XCircle,
} from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { useGraphProfile } from '@/hooks/useGraphProfile';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useAllLeaveApprovals, useApproveLeave, useRejectLeave } from '@/hooks/useLeaveApprovals';
import { useWorkflowApprovers } from '@/hooks/useWorkflowAdmin';
import { useSharePointUpload } from '@/hooks/useSharePointUpload';
import { ApprovalAttachment, ApprovalHistoryEntry, LeaveRequest } from '@/types/hr';
import { cn } from '@/lib/utils';

type ActionMode = 'approve' | 'reject';

interface ActionDialogState {
  open: boolean;
  mode: ActionMode;
  request: LeaveRequest | null;
  comments: string;
  files: File[];
}

const PENDING_STAGES = ['Manager Review', 'Director Review', 'HR Review'];

const STAGE_TONE: Record<string, string> = {
  Submitted: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'Manager Review': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Director Review': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'HR Review': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  Rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  Cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const ACTION_TONE: Record<string, string> = {
  Approved: 'text-green-600 dark:text-green-400',
  Rejected: 'text-red-600 dark:text-red-400',
  Escalated: 'text-amber-600 dark:text-amber-400',
  Submitted: 'text-blue-600 dark:text-blue-400',
  Cancelled: 'text-gray-600 dark:text-gray-400',
};

const fmtDate = (value?: string) => {
  if (!value) return 'Not recorded';
  try {
    return format(new Date(value), 'dd MMM yyyy');
  } catch {
    return value;
  }
};

const fmtDateTime = (value?: string) => {
  if (!value) return 'Not recorded';
  try {
    return format(new Date(value), 'dd MMM yyyy, h:mm a');
  } catch {
    return value;
  }
};

const sameEmail = (a?: string, b?: string) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

const isTerminal = (request: LeaveRequest) =>
  ['Approved', 'Rejected', 'Declined', 'Cancelled'].includes(request.status) ||
  ['Approved', 'Rejected', 'Cancelled'].includes(request.stage ?? '');

const buildFallbackHistory = (request: LeaveRequest): ApprovalHistoryEntry[] => {
  const entries: ApprovalHistoryEntry[] = [];

  if (request.createdDate) {
    entries.push({
      id: `${request.id}-submitted`,
      stage: 'Submitted',
      action: 'Submitted',
      actorName: request.employeeName ?? request.employeeId,
      actorEmail: request.employeeEmail,
      comments: request.reason,
      toStage: request.stage,
      createdAt: request.createdDate,
    });
  }

  if (request.managerApprovedDate) {
    entries.push({
      id: `${request.id}-manager`,
      stage: 'Manager Review',
      action: 'Approved',
      actorName: request.approverManager ?? 'Manager',
      toStage: 'Director Review',
      createdAt: request.managerApprovedDate,
    });
  }

  if (request.directorApprovedDate) {
    entries.push({
      id: `${request.id}-director`,
      stage: 'Director Review',
      action: 'Approved',
      actorName: request.approverDirector ?? 'Director',
      toStage: 'HR Review',
      createdAt: request.directorApprovedDate,
    });
  }

  if (request.hrApprovedDate || request.approvedDate) {
    entries.push({
      id: `${request.id}-final`,
      stage: request.stage === 'Rejected' ? 'Rejected' : 'HR Review',
      action: request.stage === 'Rejected' || request.status === 'Rejected' ? 'Rejected' : 'Approved',
      actorName: request.approvedBy ?? request.approverHR ?? 'Approver',
      comments: request.comments,
      toStage: request.stage,
      createdAt: request.hrApprovedDate ?? request.approvedDate ?? '',
    });
  }

  return entries;
};

const getHistory = (request: LeaveRequest) =>
  request.approvalHistory?.length ? request.approvalHistory : buildFallbackHistory(request);

const stageProgress = (request: LeaveRequest) => {
  const stage = request.stage ?? 'Submitted';
  if (request.status === 'Rejected' || stage === 'Rejected') return 100;
  if (stage === 'Approved') return 100;
  const index = ['Submitted', ...PENDING_STAGES, 'Approved'].indexOf(stage);
  return Math.max(0, index) * 25;
};

const RequestSummary: React.FC<{ request: LeaveRequest; selected: boolean; onSelect: () => void }> = ({
  request,
  selected,
  onSelect,
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={cn(
      'w-full text-left border-b last:border-b-0 p-4 transition-colors dark:border-white/10',
      selected ? 'bg-[#f8f4f0] dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5',
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate dark:text-gray-100">
          {request.employeeName ?? request.employeeId}
        </p>
        <p className="text-xs text-muted-foreground">
          {request.leaveType} leave · {request.daysRequested} day{request.daysRequested !== 1 ? 's' : ''}
        </p>
      </div>
      <Badge className={cn('shrink-0 text-xs', STAGE_TONE[request.stage ?? request.status] ?? STAGE_TONE.Submitted)}>
        {request.stage ?? request.status}
      </Badge>
    </div>
    <div className="mt-3 text-xs text-muted-foreground">
      {fmtDate(request.startDate)} to {fmtDate(request.endDate)}
    </div>
  </button>
);

const WorkflowTimeline: React.FC<{ request: LeaveRequest }> = ({ request }) => {
  const history = getHistory(request);

  return (
    <div className="space-y-3">
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">No approval actions have been recorded yet.</p>
      ) : (
        history.map((entry) => (
          <div key={entry.id} className="flex gap-3 rounded-md border p-3 dark:border-white/10">
            <div className="mt-0.5">
              {entry.action === 'Rejected' ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : entry.action === 'Approved' ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Clock className="h-4 w-4 text-blue-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className={cn('text-sm font-semibold', ACTION_TONE[entry.action] ?? 'dark:text-gray-100')}>
                  {entry.action}
                </p>
                <span className="text-xs text-muted-foreground">{entry.stage}</span>
                {entry.toStage && (
                  <>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{entry.toStage}</span>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {entry.actorName}{entry.actorEmail ? ` · ${entry.actorEmail}` : ''} · {fmtDateTime(entry.createdAt)}
              </p>
              {entry.comments && (
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{entry.comments}</p>
              )}
              {entry.attachments && entry.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.attachments.map((file) => (
                    <a
                      key={`${entry.id}-${file.name}`}
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground dark:border-white/10"
                    >
                      <Paperclip className="h-3 w-3" />
                      {file.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const RequestDetail: React.FC<{
  request?: LeaveRequest;
  canAct: boolean;
  selfActionBlocked: boolean;
  onAction: (mode: ActionMode, request: LeaveRequest) => void;
}> = ({ request, canAct, selfActionBlocked, onAction }) => {
  if (!request) {
    return (
      <Card className="dark:bg-gray-800 dark:border-white/10">
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Select a request to review its workflow, comments, and history.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="dark:bg-gray-800 dark:border-white/10">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-xl">{request.leaveType} Leave</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {request.employeeName ?? request.employeeId} · {fmtDate(request.startDate)} to {fmtDate(request.endDate)}
              </p>
            </div>
            <Badge className={cn('w-fit', STAGE_TONE[request.stage ?? request.status] ?? STAGE_TONE.Submitted)}>
              {request.stage ?? request.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Submitted</span>
              <span>Manager</span>
              <span>Director</span>
              <span>HR</span>
              <span>Closed</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className={cn(
                  'h-2 rounded-full transition-all',
                  request.status === 'Rejected' || request.stage === 'Rejected' ? 'bg-red-500' : 'bg-green-500',
                )}
                style={{ width: `${stageProgress(request)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-md border p-3 dark:border-white/10">
              <p className="text-xs text-muted-foreground">Days Requested</p>
              <p className="text-lg font-semibold">{request.daysRequested}</p>
            </div>
            <div className="rounded-md border p-3 dark:border-white/10">
              <p className="text-xs text-muted-foreground">Division</p>
              <p className="text-sm font-medium">{request.division || 'Not recorded'}</p>
            </div>
            <div className="rounded-md border p-3 dark:border-white/10">
              <p className="text-xs text-muted-foreground">Unit</p>
              <p className="text-sm font-medium">{request.unit || 'Not recorded'}</p>
            </div>
          </div>

          {request.reason && (
            <div className="rounded-md bg-gray-50 p-3 dark:bg-white/5">
              <p className="text-xs font-medium text-muted-foreground mb-1">Applicant Reason</p>
              <p className="text-sm dark:text-gray-300">{request.reason}</p>
            </div>
          )}

          {selfActionBlocked && (
            <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              This is your own request. Approval must be handled by a higher-level approver.
            </div>
          )}

          {canAct && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
                onClick={() => onAction('reject', request)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Decline
              </Button>
              <Button
                className="bg-green-600 text-white hover:bg-green-700"
                onClick={() => onAction('approve', request)}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {request.stage === 'HR Review' ? 'Approve & Close' : 'Approve'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="dark:bg-gray-800 dark:border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Approval History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorkflowTimeline request={request} />
        </CardContent>
      </Card>
    </div>
  );
};

const Approvals: React.FC = () => {
  const { isAdmin, hasPermission } = useRoleBasedAuth();
  const { profile } = useGraphProfile();
  const { data: employee } = useCurrentEmployee();
  const currentEmail = profile?.mail ?? profile?.userPrincipalName ?? '';
  const effectiveEmployeeId = profile?.faxNumber || employee?.employeeId;

  const { data: workflowApprovers = [] } = useWorkflowApprovers();
  const isConfiguredApprover = workflowApprovers.some((approver) =>
    sameEmail(approver.approverEmail, currentEmail),
  );
  const canViewApproverWorkspace =
    isAdmin ||
    hasPermission('approvals', 'read') ||
    hasPermission('approvals', 'write') ||
    hasPermission('hr', 'read') ||
    isConfiguredApprover;

  const { data: myRequests = [], isLoading: isLoadingMine } = useLeaveRequests(effectiveEmployeeId);
  const { data: allLeaveRequests = [], isLoading: isLoadingAll, isFetching } =
    useAllLeaveApprovals(canViewApproverWorkspace);
  const approveMutation = useApproveLeave();
  const rejectMutation = useRejectLeave();
  const { uploadFile, isLoading: isUploading } = useSharePointUpload();

  const [activeTab, setActiveTab] = useState('my-requests');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActionDialogState>({
    open: false,
    mode: 'approve',
    request: null,
    comments: '',
    files: [],
  });

  const visibleRequests = canViewApproverWorkspace ? allLeaveRequests : myRequests;
  const myActiveRequests = myRequests.filter((request) => !isTerminal(request));
  const myClosedRequests = myRequests.filter((request) => isTerminal(request));
  const pendingRequests = visibleRequests.filter((request) => PENDING_STAGES.includes(request.stage ?? ''));
  const historyRequests = visibleRequests.filter((request) => isTerminal(request));

  const filteredRequests = useMemo(() => {
    const source =
      activeTab === 'queue'
        ? pendingRequests
        : activeTab === 'history'
          ? (canViewApproverWorkspace ? historyRequests : myClosedRequests)
          : myActiveRequests;

    if (!query.trim()) return source;
    const q = query.toLowerCase();
    return source.filter((request) =>
      [
        request.employeeName,
        request.employeeId,
        request.leaveType,
        request.stage,
        request.status,
        request.division,
        request.unit,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [activeTab, pendingRequests, historyRequests, myActiveRequests, myClosedRequests, canViewApproverWorkspace, query]);

  const selectedRequest = useMemo(() => {
    if (!filteredRequests.length) return undefined;
    return filteredRequests.find((request) => String(request.id) === selectedId) ?? filteredRequests[0];
  }, [filteredRequests, selectedId]);

  const isStageApprover = (request: LeaveRequest) => {
    if (isAdmin || hasPermission('approvals', 'write') || hasPermission('hr', 'write')) return true;
    return workflowApprovers.some((approver) =>
      sameEmail(approver.approverEmail, currentEmail) &&
      approver.stage === request.stage &&
      (!approver.division || approver.division === request.division) &&
      (!approver.unit || approver.unit === request.unit),
    );
  };

  const selfActionBlocked = selectedRequest
    ? sameEmail(selectedRequest.employeeEmail, currentEmail)
    : false;

  const canActOnSelected = selectedRequest
    ? PENDING_STAGES.includes(selectedRequest.stage ?? '') &&
      isStageApprover(selectedRequest) &&
      !selfActionBlocked
    : false;

  const openActionDialog = (mode: ActionMode, request: LeaveRequest) => {
    setDialog({
      open: true,
      mode,
      request,
      comments: '',
      files: [],
    });
  };

  const uploadAttachments = async (request: LeaveRequest, files: File[]): Promise<ApprovalAttachment[]> => {
    const uploaded: ApprovalAttachment[] = [];
    for (const file of files) {
      const url = await uploadFile(
        file,
        '/sites/scpngintranet',
        'HR_Documents',
        `Approval Attachments/${request.id}`,
      );
      if (!url) {
        throw new Error(`Could not upload ${file.name}.`);
      }
      uploaded.push({
        name: file.name,
        url,
        uploadedBy: currentEmail,
        uploadedAt: new Date().toISOString(),
      });
    }
    return uploaded;
  };

  const submitAction = async () => {
    const request = dialog.request;
    if (!request) return;
    if (dialog.mode === 'reject' && !dialog.comments.trim()) return;

    const attachments = dialog.files.length > 0
      ? await uploadAttachments(request, dialog.files)
      : [];

    const basePayload = {
      itemId: String(request.id),
      currentStage: request.stage ?? 'Manager Review',
      approverName: profile?.displayName ?? currentEmail,
      approverEmail: currentEmail,
      employeeId: request.employeeId,
      leaveType: request.leaveType,
      daysRequested: request.daysRequested,
      employeeEmail: request.employeeEmail,
      employeeName: request.employeeName,
      startDate: request.startDate,
      endDate: request.endDate,
      division: request.division,
      unit: request.unit,
      attachments,
    };

    if (dialog.mode === 'approve') {
      await approveMutation.mutateAsync({
        ...basePayload,
        comments: dialog.comments.trim() || undefined,
      });
    } else {
      await rejectMutation.mutateAsync({
        ...basePayload,
        reason: dialog.comments.trim(),
      });
    }

    setDialog({ open: false, mode: 'approve', request: null, comments: '', files: [] });
  };

  const isBusy = approveMutation.isPending || rejectMutation.isPending || isUploading;
  const isLoading = activeTab === 'my-requests' ? isLoadingMine : isLoadingAll;

  return (
    <PageLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold dark:text-gray-100">Approvals</h1>
            <p className="text-muted-foreground mt-1">
              Track requests, review workflow progress, and action approvals from one place.
            </p>
          </div>
          {isFetching && !isLoadingAll && (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Refreshing approval data
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="dark:bg-gray-800 dark:border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">My Active Requests</p>
                  <p className="text-2xl font-bold">{myActiveRequests.length}</p>
                </div>
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="dark:bg-gray-800 dark:border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Queue</p>
                  <p className="text-2xl font-bold">{canViewApproverWorkspace ? pendingRequests.length : 0}</p>
                </div>
                <UserCheck className="h-5 w-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="dark:bg-gray-800 dark:border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Historical Records</p>
                  <p className="text-2xl font-bold">{canViewApproverWorkspace ? historyRequests.length : myClosedRequests.length}</p>
                </div>
                <History className="h-5 w-5 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="my-requests" className="gap-2">
              <FileText className="h-4 w-4" />
              My Requests
            </TabsTrigger>
            {canViewApproverWorkspace && (
              <TabsTrigger value="queue" className="gap-2">
                <UserCheck className="h-4 w-4" />
                Approval Queue
              </TabsTrigger>
            )}
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          {['my-requests', 'queue', 'history'].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-0">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
                <Card className="dark:bg-gray-800 dark:border-white/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {tab === 'queue' ? <UserCheck className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                      Requests
                    </CardTitle>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search approvals..."
                        className="pl-9"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredRequests.length === 0 ? (
                      <div className="py-16 text-center text-sm text-muted-foreground">
                        No approval records found.
                      </div>
                    ) : (
                      <div className="max-h-[680px] overflow-y-auto">
                        {filteredRequests.map((request) => (
                          <RequestSummary
                            key={String(request.id)}
                            request={request}
                            selected={String(selectedRequest?.id) === String(request.id)}
                            onSelect={() => setSelectedId(String(request.id))}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <RequestDetail
                  request={selectedRequest}
                  canAct={activeTab === 'queue' && canActOnSelected}
                  selfActionBlocked={activeTab === 'queue' && selfActionBlocked}
                  onAction={openActionDialog}
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <Dialog
        open={dialog.open}
        onOpenChange={(open) => !open && setDialog({ open: false, mode: 'approve', request: null, comments: '', files: [] })}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog.mode === 'approve' ? 'Approve Request' : 'Decline Request'}
            </DialogTitle>
            <DialogDescription>
              Add remarks and optional supporting documents. The action will be stored in the approval history.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="approval-comments">
                {dialog.mode === 'reject' ? 'Reason for decline' : 'Comments'}
                {dialog.mode === 'reject' && <span className="text-red-500"> *</span>}
              </Label>
              <Textarea
                id="approval-comments"
                rows={4}
                value={dialog.comments}
                onChange={(event) => setDialog((prev) => ({ ...prev, comments: event.target.value }))}
                placeholder={dialog.mode === 'reject' ? 'Explain why this request is declined...' : 'Add an optional approval remark...'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="approval-attachments">Supporting documents</Label>
              <Input
                id="approval-attachments"
                type="file"
                multiple
                onChange={(event) =>
                  setDialog((prev) => ({
                    ...prev,
                    files: Array.from(event.target.files ?? []),
                  }))
                }
              />
              {dialog.files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {dialog.files.map((file) => (
                    <Badge key={`${file.name}-${file.size}`} variant="outline" className="gap-1">
                      <Paperclip className="h-3 w-3" />
                      {file.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={isBusy}
              onClick={() => setDialog({ open: false, mode: 'approve', request: null, comments: '', files: [] })}
            >
              Cancel
            </Button>
            <Button
              variant={dialog.mode === 'reject' ? 'destructive' : 'default'}
              disabled={isBusy || (dialog.mode === 'reject' && !dialog.comments.trim())}
              onClick={submitAction}
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : dialog.mode === 'approve' ? (
                <Send className="h-4 w-4 mr-2" />
              ) : (
                <MessageSquare className="h-4 w-4 mr-2" />
              )}
              {dialog.mode === 'approve' ? 'Confirm Approval' : 'Confirm Decline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default Approvals;
