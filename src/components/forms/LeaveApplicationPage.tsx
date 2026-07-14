import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { FormLayoutView, FormLayoutWrapper } from '@/components/forms/FormLayoutWrapper';
import LeaveApplicationPaper from '@/components/forms/LeaveApplicationPaper';
import PrintLeaveApplicationModal from '@/components/forms/PrintLeaveApplicationModal';
import { leaveApplicationTemplate } from '@/config/formTemplates';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { useGraphProfile } from '@/hooks/useGraphProfile';
import { useHRService } from '@/hooks/useHRService';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useLeaveBalances } from '@/hooks/useLeaveBalances';
import { useCancelLeave } from '@/hooks/useLeaveApprovals';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, RefreshCw, Printer, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { LeaveApplicationTracker } from './LeaveApplicationTracker';
import { format } from 'date-fns';
import { countBusinessDays } from '@/utils/pngPublicHolidays';
import { LeaveRequest } from '@/types/hr';

const SHAREPOINT_SITEPATH = "/sites/scpngintranet";
const SHAREPOINT_LIST_NAME = "Staff Leave Requests";
const CLOSED_LEAVE_STATUSES = ['Rejected', 'Declined', 'Cancelled'];
const TERMINAL_LEAVE_STATUSES = ['Approved', ...CLOSED_LEAVE_STATUSES];

const getLeaveRequestGroup = (request: LeaveRequest) => {
  if (request.status === 'Approved' || request.stage === 'Approved') return 'approved';
  if (TERMINAL_LEAVE_STATUSES.includes(request.status) || ['Rejected', 'Cancelled'].includes(request.stage ?? '')) return 'closed';
  return 'active';
};

const getCurrentHolderLabel = (request: LeaveRequest) => {
  if (request.status === 'Approved' || request.stage === 'Approved') return 'Completed by HR';
  if (CLOSED_LEAVE_STATUSES.includes(request.status) || ['Rejected', 'Cancelled'].includes(request.stage ?? '')) return 'Closed';

  switch (request.stage) {
    case 'Manager Review':
      return 'Manager';
    case 'CEO Review':
      return 'CEO';
    case 'Director Review':
      return 'Director';
    case 'HR Review':
      return 'HR';
    default:
      return 'Pending routing';
  }
};

const canCancelLeaveRequest = (request: LeaveRequest) =>
  request.status === 'Pending' && ['Submitted', 'Manager Review'].includes(request.stage ?? 'Manager Review');

const findOverlappingLeaveRequest = (
  applications: LeaveRequest[],
  startDate: Date,
  endDate: Date,
) =>
  applications.find((request) => {
    if (CLOSED_LEAVE_STATUSES.includes(request.status)) return false;

    const existingStart = new Date(request.startDate);
    const existingEnd = new Date(request.endDate);
    if (Number.isNaN(existingStart.getTime()) || Number.isNaN(existingEnd.getTime())) return false;

    return startDate <= existingEnd && endDate >= existingStart;
  });

const buildOverlapMessage = (request: LeaveRequest) =>
  `An active leave request already covers ${request.startDate} to ${request.endDate} (ID: ${request.id}). Please cancel it before submitting a new request for the same period.`;

const LeaveApplicationPage: React.FC = () => {
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<LeaveRequest | null>(null);
  const [formView, setFormView] = useState<FormLayoutView>('digital');
  const { user } = useRoleBasedAuth();
  const { profile } = useGraphProfile();
  const { submitLeaveRequest, inspectListColumns } = useHRService();

  // Use new hooks for data fetching
  const { data: employee } = useCurrentEmployee();

  // Use faxNumber (payroll number) as the employee ID for fetching data
  // This matches what we use when submitting leave requests
  const effectiveEmployeeId = profile?.faxNumber || employee?.employeeId;

  const { data: leaveBalances = [] } = useLeaveBalances(effectiveEmployeeId);
  const { data: myApplications = [], dataUpdatedAt, isFetching } = useLeaveRequests(effectiveEmployeeId);

  const cancelMutation = useCancelLeave();
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);

  // Track previous applications to detect changes
  const prevApplicationsRef = useRef<LeaveRequest[]>([]);
  const [changedAppIds, setChangedAppIds] = useState<Set<string>>(new Set());

  // Detect status or stage changes and show notifications
  useEffect(() => {
    if (!myApplications || myApplications.length === 0) return;

    const prevApps = prevApplicationsRef.current;
    if (prevApps.length === 0) {
      // First load, just store the current state
      prevApplicationsRef.current = myApplications;
      return;
    }

    const newChangedIds = new Set<string>();

    // Check for changes in each application
    myApplications.forEach((currentApp) => {
      const prevApp = prevApps.find((app) => app.id === currentApp.id);

      if (prevApp) {
        // Check for status change
        if (prevApp.status !== currentApp.status) {
          newChangedIds.add(currentApp.id);
          toast.success(`Leave request #${currentApp.id} status changed!`, {
            description: `Status updated from "${prevApp.status}" to "${currentApp.status}"`,
            duration: 5000,
          });
        }

        // Check for stage change
        if (prevApp.stage !== currentApp.stage) {
          newChangedIds.add(currentApp.id);
          toast.info(`Leave request #${currentApp.id} moved to next stage`, {
            description: `Now at: ${currentApp.stage}`,
            duration: 5000,
          });
        }
      } else {
        // New application detected
        newChangedIds.add(currentApp.id);
        toast.success('New leave application detected!', {
          description: `${currentApp.leaveType} Leave - ${currentApp.daysRequested} days`,
          duration: 5000,
        });
      }
    });

    // Update the reference
    prevApplicationsRef.current = myApplications;

    // Update changed IDs and clear them after animation
    if (newChangedIds.size > 0) {
      setChangedAppIds(newChangedIds);
      setTimeout(() => setChangedAppIds(new Set()), 3000);
    }
  }, [myApplications, dataUpdatedAt]);

  const methods = useForm({
    mode: 'onChange',
    defaultValues: {
      payrollNumber: '',
      name: '',
      division: '',
      unit: '',
      absenceFrom: '',
      absenceTo: '',
      reason: '',
      leaveType: '',
    },
  });
  const overlapErrorAppliedRef = useRef(false);
  const absenceFrom = methods.watch('absenceFrom');
  const absenceTo = methods.watch('absenceTo');

  useEffect(() => {
    const startDate = absenceFrom ? new Date(absenceFrom) : null;
    const endDate = absenceTo ? new Date(absenceTo) : null;

    if (
      !startDate ||
      !endDate ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate < startDate
    ) {
      if (overlapErrorAppliedRef.current) {
        methods.clearErrors(['absenceFrom', 'absenceTo']);
        overlapErrorAppliedRef.current = false;
      }
      return;
    }

    const conflict = findOverlappingLeaveRequest(myApplications, startDate, endDate);
    if (!conflict) {
      if (overlapErrorAppliedRef.current) {
        methods.clearErrors(['absenceFrom', 'absenceTo']);
        overlapErrorAppliedRef.current = false;
      }
      return;
    }

    const message = buildOverlapMessage(conflict);
    methods.setError('absenceFrom', { type: 'overlap', message });
    methods.setError('absenceTo', { type: 'overlap', message });
    overlapErrorAppliedRef.current = true;
  }, [absenceFrom, absenceTo, myApplications, methods]);

  useEffect(() => {
    if (profile) {
      if (profile.displayName) methods.setValue('name', profile.displayName);
      // Map Office Location to Division
      if (profile.officeLocation) methods.setValue('division', profile.officeLocation);
      // Map Department to Unit
      if (profile.department) methods.setValue('unit', profile.department);
      // Map Fax Number to Payroll Number
      if (profile.faxNumber) methods.setValue('payrollNumber', profile.faxNumber);
    }
  }, [profile, methods]);

  const handlePrintApplication = (app: LeaveRequest) => {
    setSelectedApplication(app);
    setPrintModalOpen(true);
  };

  const onSubmit = async (data: any) => {
    const failSubmission = (message: string, fields: string[] = []) => {
      fields.forEach((fieldName) => {
        methods.setError(fieldName, { type: 'manual', message });
      });
      throw new Error(message);
    };

    // --- Validation ---
    if (!data.leaveType) {
      failSubmission('Please select a leave type before submitting.', ['leaveType']);
    }

    const startDate = data.absenceFrom ? new Date(data.absenceFrom) : null;
    const endDate = data.absenceTo ? new Date(data.absenceTo) : null;

    if (!startDate || !endDate) {
      failSubmission('Please select both a start date and an end date.', ['absenceFrom', 'absenceTo']);
    }

    if (endDate < startDate) {
      failSubmission('End date cannot be before the start date.', ['absenceTo']);
    }

    if (!data.payrollNumber) {
      failSubmission('Employee ID not found. Please contact IT support.', ['payrollNumber']);
    }

    const conflict = findOverlappingLeaveRequest(myApplications, startDate, endDate);
    if (conflict) {
      failSubmission(buildOverlapMessage(conflict), ['absenceFrom', 'absenceTo']);
    }

    const days = countBusinessDays(startDate, endDate);
    const daysRequested = days > 0 ? days : 1;

    // --- Balance sufficiency check ---
    const matchingBalance = leaveBalances.find(
      b => b.leaveType.toLowerCase() === data.leaveType.toLowerCase()
    );
    if (matchingBalance && matchingBalance.available < daysRequested) {
      failSubmission(
        `Insufficient leave balance. You have ${matchingBalance.available} day${matchingBalance.available === 1 ? '' : 's'} of ${matchingBalance.leaveType} available, but requested ${daysRequested} day${daysRequested === 1 ? '' : 's'}.`,
        ['leaveType'],
      );
    }

    try {
      const result = await submitLeaveRequest({
        employeeId: data.payrollNumber,
        leaveType: data.leaveType,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        daysRequested,
        reason: data.reason,
        name: data.name,
        division: data.division,
        unit: data.unit,
        employeeEmail: profile?.mail ?? undefined,
      });

      // Seed the ref with the just-submitted record so the polling refetch
      // does not misidentify it as a "new application detected" toast.
      if (result?.id) {
        prevApplicationsRef.current = [...prevApplicationsRef.current, result];
      }
      setFormView('tracking');
    } catch (err: any) {
      console.error('Submission failed', err);
      throw err instanceof Error
        ? err
        : new Error('Please try again or contact IT support.');
    }
  };

  const applicationGroups = useMemo(() => ({
    active: myApplications.filter((app) => getLeaveRequestGroup(app) === 'active'),
    approved: myApplications.filter((app) => getLeaveRequestGroup(app) === 'approved'),
    closed: myApplications.filter((app) => getLeaveRequestGroup(app) === 'closed'),
  }), [myApplications]);

  const renderApplicationCards = (applications: LeaveRequest[], emptyMessage: string) => {
    if (applications.length === 0) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {emptyMessage}
          </CardContent>
        </Card>
      );
    }

    return applications.map((app) => {
      const hasChanged = changedAppIds.has(String(app.id));
      const currentHolder = getCurrentHolderLabel(app);

      return (
        <Card
          key={app.id}
          className={`overflow-hidden transition-all duration-300 dark:bg-gray-800 dark:border-white/10 ${hasChanged ? 'ring-2 ring-blue-500 shadow-lg animate-pulse' : ''
            }`}
        >
          <div className="bg-gray-50 dark:bg-white/5 px-6 py-4 border-b dark:border-white/10 flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
            <div>
              <h3 className="font-semibold text-lg dark:text-gray-100">{app.leaveType} Leave</h3>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Submitted on {app.createdDate ? format(new Date(app.createdDate), 'PPP') : 'Unknown'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 md:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePrintApplication(app)}
                className="flex items-center gap-2 dark:bg-white/5 dark:border-white/10 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <Printer className="h-4 w-4" />
                Print Form
              </Button>
              {canCancelLeaveRequest(app) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelTarget(app)}
                  disabled={cancelMutation.isPending}
                  className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900/40 dark:hover:bg-red-900/20"
                >
                  <XCircle className="h-4 w-4" />
                  Cancel
                </Button>
              )}
              <div className="text-right">
                <div className="font-medium dark:text-gray-300">Request ID</div>
                <div className="text-sm text-muted-foreground dark:text-gray-500">#{app.id}</div>
              </div>
            </div>
          </div>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div>
                <span className="text-sm font-medium text-muted-foreground dark:text-gray-500">Duration</span>
                <p className="mt-1 dark:text-gray-200">
                  {format(new Date(app.startDate), 'MMM d, yyyy')} - {format(new Date(app.endDate), 'MMM d, yyyy')}
                </p>
                <p className="text-sm text-muted-foreground dark:text-gray-500">({app.daysRequested} days)</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground dark:text-gray-500">Currently With</span>
                <p className="mt-1 dark:text-gray-200">{currentHolder}</p>
                <p className="text-sm text-muted-foreground dark:text-gray-500">{app.stage || 'Submitted'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground dark:text-gray-500">Reason</span>
                <p className="mt-1 dark:text-gray-200">{app.reason || 'No reason provided'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground dark:text-gray-500">Status</span>
                <div className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${app.status === 'Approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                    CLOSED_LEAVE_STATUSES.includes(app.status) ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                  {app.status}
                </div>
              </div>
            </div>

            <div className="border-t dark:border-white/10 pt-6">
              <h4 className="text-sm font-medium text-muted-foreground dark:text-gray-500 mb-4">Application Progress</h4>
              <LeaveApplicationTracker
                currentStage={app.stage || 'Submitted'}
                status={app.status}
                dates={{
                  submitted: app.createdDate,
                  managerAction: app.managerApprovedDate,
                  ceoAction: app.ceoApprovedDate,
                  directorAction: app.directorApprovedDate,
                  hrAction: app.hrApprovedDate,
                }}
              />
            </div>
          </CardContent>
        </Card>
      );
    });
  };

  return (
    <FormProvider {...methods}>
      <FormLayoutWrapper
        title="Leave Application"
        template={leaveApplicationTemplate}
        activeView={formView}
        onViewChange={setFormView}
        onDebugSchema={() => inspectListColumns && inspectListColumns('Staff Leave Requests')}
        digitalContent={
          <>

            {/* Leave Balances Summary */}
            {leaveBalances.length > 0 && (
              <Card className="mb-6 bg-blue-50 border-blue-100 dark:bg-gray-800 dark:border-white/10">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-blue-900 dark:text-gray-100">Your Leave Balances</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {leaveBalances.map((balance) => (
                      <div key={balance.id} className="bg-white p-3 rounded-lg shadow-sm border border-blue-100 dark:bg-white/5 dark:border-white/10">
                        <p className="text-xs text-muted-foreground font-medium uppercase dark:text-gray-400">{balance.leaveType}</p>
                        <div className="flex items-end gap-1 mt-1">
                          <span className={`text-xl font-bold ${balance.available < 5 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {balance.available}
                          </span>
                          <span className="text-xs text-muted-foreground mb-1 dark:text-gray-500">days</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            <FormRenderer
              template={leaveApplicationTemplate}
              mode="fill"
              onSubmit={onSubmit}
              showErrorToast={false}
            />
          </>
        }
        paperContent={
          <>

            <form onSubmit={methods.handleSubmit(onSubmit)}>
              <LeaveApplicationPaper />
            </form>
          </>
        }
        trackingContent={
          <>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">My Leave Applications</h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {isFetching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span>{isFetching ? 'Refreshing...' : 'Auto-refresh on'}</span>
                  {dataUpdatedAt && !isFetching && (
                    <span className="text-xs">
                      - {format(new Date(dataUpdatedAt), 'HH:mm:ss')}
                    </span>
                  )}
                </div>
              </div>
              {myApplications.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No leave applications found.
                  </CardContent>
                </Card>
              ) : (
                <Tabs defaultValue="active" className="space-y-4">
                  <TabsList className="dark:bg-gray-800 dark:border-white/10">
                    <TabsTrigger value="active">
                      Active ({applicationGroups.active.length})
                    </TabsTrigger>
                    <TabsTrigger value="approved">
                      Approved ({applicationGroups.approved.length})
                    </TabsTrigger>
                    <TabsTrigger value="closed">
                      Closed ({applicationGroups.closed.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="active" className="space-y-4">
                    {renderApplicationCards(applicationGroups.active, 'No active leave applications.')}
                  </TabsContent>
                  <TabsContent value="approved" className="space-y-4">
                    {renderApplicationCards(applicationGroups.approved, 'No approved leave applications yet.')}
                  </TabsContent>
                  <TabsContent value="closed" className="space-y-4">
                    {renderApplicationCards(applicationGroups.closed, 'No cancelled or declined leave applications.')}
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </>
        }
      />

      {/* Print Modal */}
      {selectedApplication && (
        <PrintLeaveApplicationModal
          isOpen={printModalOpen}
          onClose={() => {
            setPrintModalOpen(false);
            setSelectedApplication(null);
          }}
          application={selectedApplication}
          leaveBalances={leaveBalances}
          employeeName={profile?.displayName || employee?.fullName}
          division={profile?.officeLocation || employee?.department}
          unit={profile?.department || employee?.unit}
        />
      )}

      {/* Cancel confirmation dialog */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={open => { if (!open) setCancelTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Leave Request</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget && (
                <>
                  This will cancel your{' '}
                  <strong>{cancelTarget.leaveType} Leave</strong> request for{' '}
                  {cancelTarget.daysRequested} day{cancelTarget.daysRequested !== 1 ? 's' : ''}{' '}
                  ({cancelTarget.startDate} - {cancelTarget.endDate}).
                  Your pending balance will be restored. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>
              Keep Request
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (!cancelTarget) return;
                cancelMutation.mutate(
                  {
                    itemId: String(cancelTarget.id),
                    employeeId: effectiveEmployeeId ?? cancelTarget.employeeId,
                    leaveType: cancelTarget.leaveType,
                    daysRequested: cancelTarget.daysRequested,
                    cancellerEmail: profile?.mail ?? profile?.userPrincipalName ?? '',
                  },
                  { onSettled: () => setCancelTarget(null) }
                );
              }}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Yes, Cancel Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormProvider>
  );
};

export default LeaveApplicationPage;
