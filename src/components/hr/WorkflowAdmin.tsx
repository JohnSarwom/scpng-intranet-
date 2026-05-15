import React, { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
import {
  Users,
  Mail,
  FlaskConical,
  Plus,
  Pencil,
  Trash2,
  Save,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Settings2,
  Send,
} from 'lucide-react';
import {
  useWorkflowApprovers,
  useSaveWorkflowApprover,
  useDeleteWorkflowApprover,
  useEmailTemplates,
  useSaveEmailTemplate,
  useSetupWorkflowLists,
  useSendTestEmail,
} from '@/hooks/useWorkflowAdmin';
import { useGraphProfile } from '@/hooks/useGraphProfile';
import { WorkflowApprover, WorkflowStage, EmailTemplate, EmailTemplateStage } from '@/types/hr';
import { buildSCPNGPreviewHTML, buildSCPNGEmailSubject, EmailTemplateVars } from '@/utils/scpngEmailBuilder';
import { GlobalAssigneeSelector } from '@/components/common/GlobalAssigneeSelector';
import { Employee } from '@/contexts/EmployeesContext';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIVISIONS_AND_UNITS: Record<string, string[]> = {
  'Executive Division': ['Executive Unit', 'Secretariat Unit'],
  'Corporate Services Division': ['Finance Unit', 'Human Resources Unit', 'IT Unit', 'Corporate Services Unit', 'Administrative Services'],
  'Licensing Market & Supervision Division': ['Market Data Unit', 'Licensing Unit', 'Supervision Unit', 'Investigations Unit'],
  'Legal Services Division': ['Legal Advisory Unit'],
  'Research & Publication Division': ['Research Unit', 'Media & Publication Unit'],
};

const WORKFLOW_STAGES: WorkflowStage[] = ['Manager Review', 'Director Review', 'HR Review'];

const STAGE_COLORS: Record<WorkflowStage, string> = {
  'Manager Review':  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'Director Review': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  'HR Review':       'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

const EMAIL_STAGES: EmailTemplateStage[] = [
  'Submission',
  'Manager Approved',
  'Director Approved',
  'Fully Approved',
  'Rejected',
];

const TEMPLATE_VARIABLES = [
  '{{employeeName}}',
  '{{leaveType}}',
  '{{startDate}}',
  '{{endDate}}',
  '{{days}}',
  '{{approverName}}',
  '{{rejectionReason}}',
  '{{division}}',
  '{{unit}}',
];

const DEFAULT_TEMPLATES: Record<EmailTemplateStage, { subject: string; body: string }> = {
  'Submission': {
    subject: 'Leave Request Submitted — {{leaveType}} ({{days}} days)',
    body: `Dear {{employeeName}},\n\nYour leave request has been submitted successfully and is pending Manager Review.\n\nDetails:\n- Leave Type: {{leaveType}}\n- Start Date: {{startDate}}\n- End Date: {{endDate}}\n- Days Requested: {{days}}\n\nYou will be notified as your request progresses through the approval stages.\n\nRegards,\nHR Department`,
  },
  'Manager Approved': {
    subject: 'Leave Request — Manager Approved ({{leaveType}})',
    body: `Dear {{employeeName}},\n\nYour {{leaveType}} leave request ({{startDate}} – {{endDate}}, {{days}} days) has been approved by your Manager and forwarded to the Director for review.\n\nRegards,\nHR Department`,
  },
  'Director Approved': {
    subject: 'Leave Request — Director Approved ({{leaveType}})',
    body: `Dear {{employeeName}},\n\nYour {{leaveType}} leave request ({{startDate}} – {{endDate}}, {{days}} days) has been approved by the Director and forwarded to HR for final review.\n\nRegards,\nHR Department`,
  },
  'Fully Approved': {
    subject: 'Leave Request Approved — {{leaveType}} ({{days}} days)',
    body: `Dear {{employeeName}},\n\nYour leave request has been fully approved.\n\nDetails:\n- Leave Type: {{leaveType}}\n- Start Date: {{startDate}}\n- End Date: {{endDate}}\n- Days Approved: {{days}}\n\nYour leave balance has been updated accordingly. Please ensure your handover is completed before your leave commences.\n\nRegards,\nHR Department`,
  },
  'Rejected': {
    subject: 'Leave Request Declined — {{leaveType}}',
    body: `Dear {{employeeName}},\n\nWe regret to inform you that your {{leaveType}} leave request ({{startDate}} – {{endDate}}, {{days}} days) has been declined.\n\nReason: {{rejectionReason}}\n\nIf you have any questions, please contact your Manager or HR directly.\n\nRegards,\nHR Department`,
  },
};

// ---------------------------------------------------------------------------
// Sample data for preview
// ---------------------------------------------------------------------------

const SAMPLE: Record<string, string> = {
  '{{employeeName}}': 'Jane Smith',
  '{{leaveType}}': 'Annual Leave',
  '{{startDate}}': '16 Jun 2026',
  '{{endDate}}': '20 Jun 2026',
  '{{days}}': '5',
  '{{approverName}}': 'John Manager',
  '{{rejectionReason}}': 'Insufficient leave balance.',
  '{{division}}': 'Corporate Services Division',
  '{{unit}}': 'Finance Unit',
};

function renderTemplate(text: string, sample: Record<string, string>): string {
  return Object.entries(sample).reduce(
    (acc, [key, val]) => acc.replaceAll(key, val),
    text,
  );
}

// ---------------------------------------------------------------------------
// ApproversPanel
// ---------------------------------------------------------------------------

interface ApproverDialogState {
  open: boolean;
  mode: 'add' | 'edit';
  data: Partial<WorkflowApprover>;
}

const ApproversPanel: React.FC = () => {
  const { data: approvers = [], isLoading } = useWorkflowApprovers();
  const saveMutation = useSaveWorkflowApprover();
  const deleteMutation = useDeleteWorkflowApprover();
  const setupMutation = useSetupWorkflowLists();

  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(
    new Set(Object.keys(DIVISIONS_AND_UNITS)),
  );
  const [dialog, setDialog] = useState<ApproverDialogState>({
    open: false,
    mode: 'add',
    data: {},
  });
  const [deleteTarget, setDeleteTarget] = useState<WorkflowApprover | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee[]>([]);

  const handleEmployeePick = (employees: Employee[]) => {
    setSelectedEmployee(employees);
    const emp = employees[0];
    if (emp) {
      setDialog(p => ({
        ...p,
        data: {
          ...p.data,
          approverName:  emp.displayName,
          approverEmail: emp.mail ?? emp.displayName,
        },
      }));
    }
  };

  const toggleDivision = (div: string) =>
    setExpandedDivisions(prev => {
      const next = new Set(prev);
      next.has(div) ? next.delete(div) : next.add(div);
      return next;
    });

  const openAdd = (division: string, unit: string) => {
    setSelectedEmployee([]);
    setDialog({ open: true, mode: 'add', data: { division, unit, stage: 'Manager Review' } });
  };

  const openEdit = (approver: WorkflowApprover) => {
    setSelectedEmployee(
      approver.approverName
        ? [{ id: approver.approverEmail, displayName: approver.approverName, mail: approver.approverEmail, givenName: '', surname: '' }]
        : [],
    );
    setDialog({ open: true, mode: 'edit', data: { ...approver } });
  };

  const handleSave = () => {
    const d = dialog.data;
    if (!d.division || !d.unit || !d.stage || !d.approverName || !d.approverEmail) return;
    saveMutation.mutate(d as WorkflowApprover, {
      onSuccess: () => setDialog({ open: false, mode: 'add', data: {} }),
    });
  };

  const handleSkipDirectorToggle = (approver: WorkflowApprover, checked: boolean) => {
    saveMutation.mutate({ ...approver, skipDirectorReview: checked });
  };

  // Build lookup: division → unit → stage → approver
  const lookup = useMemo(() => {
    const map = new Map<string, Map<string, Map<WorkflowStage, WorkflowApprover>>>();
    for (const a of approvers) {
      if (!map.has(a.division)) map.set(a.division, new Map());
      const unitMap = map.get(a.division)!;
      if (!unitMap.has(a.unit)) unitMap.set(a.unit, new Map());
      unitMap.get(a.unit)!.set(a.stage, a);
    }
    return map;
  }, [approvers]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          Assign approvers per Division → Unit → Stage. Enable "Skip Director" to route
          Manager-approved requests directly to HR.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setupMutation.mutate()}
          disabled={setupMutation.isPending}
        >
          {setupMutation.isPending
            ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            : <Settings2 className="h-3.5 w-3.5 mr-1" />}
          Setup Lists
        </Button>
      </div>

      {/* Division accordion */}
      {Object.entries(DIVISIONS_AND_UNITS).map(([division, units]) => {
        const isOpen = expandedDivisions.has(division);
        const divMap = lookup.get(division);
        const assignedCount = divMap
          ? Array.from(divMap.values()).reduce((acc, um) => acc + um.size, 0)
          : 0;

        return (
          <Card key={division} className="dark:bg-gray-800 dark:border-white/10">
            {/* Division header */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors rounded-t-lg"
              onClick={() => toggleDivision(division)}
            >
              <div className="flex items-center gap-2">
                {isOpen
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <span className="font-medium text-sm dark:text-gray-100">{division}</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {assignedCount} approver{assignedCount !== 1 ? 's' : ''} assigned
              </Badge>
            </button>

            {/* Units */}
            {isOpen && (
              <CardContent className="pt-0 pb-3 px-4 space-y-4 border-t dark:border-white/10">
                {units.map(unit => {
                  const unitMap = divMap?.get(unit);
                  const managerRow = unitMap?.get('Manager Review');
                  const skipDirector = managerRow?.skipDirectorReview ?? false;

                  return (
                    <div key={unit} className="mt-3">
                      {/* Unit label + Skip Director toggle + Add button */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-muted-foreground dark:text-gray-400 uppercase tracking-wide">
                          {unit}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground dark:text-gray-400">
                            <Switch
                              id={`skip-${division}-${unit}`}
                              checked={skipDirector}
                              onCheckedChange={checked => {
                                if (managerRow) {
                                  handleSkipDirectorToggle(managerRow, checked);
                                }
                              }}
                              disabled={!managerRow || saveMutation.isPending}
                              className="scale-75"
                            />
                            <Label
                              htmlFor={`skip-${division}-${unit}`}
                              className="cursor-pointer select-none"
                            >
                              Skip Director
                            </Label>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            onClick={() => openAdd(division, unit)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        </div>
                      </div>

                      {/* Stage rows */}
                      <div className="rounded-md border dark:border-white/10 divide-y dark:divide-white/10">
                        {WORKFLOW_STAGES.map(stage => {
                          const row = unitMap?.get(stage);
                          const isSkipped = stage === 'Director Review' && skipDirector;

                          return (
                            <div
                              key={stage}
                              className={`flex items-center justify-between px-3 py-2 text-sm ${
                                isSkipped ? 'opacity-40' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge
                                  variant="secondary"
                                  className={`text-[10px] shrink-0 ${STAGE_COLORS[stage]}`}
                                >
                                  {stage.replace(' Review', '')}
                                </Badge>
                                {row ? (
                                  <div className="min-w-0">
                                    <span className="font-medium dark:text-gray-200 truncate block">
                                      {row.approverName}
                                    </span>
                                    <span className="text-xs text-muted-foreground dark:text-gray-500 truncate block">
                                      {row.approverEmail}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground dark:text-gray-500 italic text-xs">
                                    {isSkipped ? 'Skipped' : 'Not assigned'}
                                  </span>
                                )}
                              </div>

                              {row && !isSkipped && (
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => openEdit(row)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => setDeleteTarget(row)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Add / Edit dialog */}
      <Dialog
        open={dialog.open}
        onOpenChange={open => !open && setDialog({ open: false, mode: 'add', data: {} })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog.mode === 'add' ? 'Add Approver' : 'Edit Approver'}
            </DialogTitle>
            <DialogDescription>
              {dialog.data.division} — {dialog.data.unit}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Stage</Label>
              <Select
                value={dialog.data.stage}
                onValueChange={v =>
                  setDialog(p => ({ ...p, data: { ...p.data, stage: v as WorkflowStage } }))
                }
              >
                <SelectTrigger className="dark:bg-white/5 dark:border-white/10">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_STAGES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Approver</Label>
              <GlobalAssigneeSelector
                selected={selectedEmployee}
                onChange={handleEmployeePick}
                mode="single"
                placeholder="Search staff..."
              />
            </div>

            <div className="space-y-1">
              <Label>Email <span className="text-muted-foreground text-xs">(auto-filled)</span></Label>
              <Input
                type="email"
                value={dialog.data.approverEmail ?? ''}
                readOnly
                placeholder="Select a staff member above"
                className="dark:bg-white/5 dark:border-white/10 bg-gray-50 cursor-default text-muted-foreground"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog({ open: false, mode: 'add', data: {} })}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saveMutation.isPending ||
                !dialog.data.approverName?.trim() ||
                !dialog.data.approverEmail?.trim()
              }
            >
              {saveMutation.isPending
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove approver?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{deleteTarget?.approverName}</strong> from{' '}
              {deleteTarget?.stage} for {deleteTarget?.unit}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteTarget?.id) {
                  deleteMutation.mutate(String(deleteTarget.id), {
                    onSuccess: () => setDeleteTarget(null),
                  });
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ---------------------------------------------------------------------------
// EmailTemplatesPanel
// ---------------------------------------------------------------------------

const EmailTemplatesPanel: React.FC = () => {
  const { data: templates = [], isLoading } = useEmailTemplates();
  const saveMutation = useSaveEmailTemplate();

  const [selectedStage, setSelectedStage] = useState<EmailTemplateStage>('Submission');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [dirty, setDirty] = useState(false);

  // Sync editor when stage or templates change
  const currentTemplate = templates.find(t => t.stage === selectedStage);

  const loadStage = (stage: EmailTemplateStage) => {
    setSelectedStage(stage);
    const tpl = templates.find(t => t.stage === stage);
    setSubject(tpl?.subject ?? DEFAULT_TEMPLATES[stage].subject);
    setBody(tpl?.body ?? DEFAULT_TEMPLATES[stage].body);
    setDirty(false);
  };

  // Load initial stage once templates arrive
  React.useEffect(() => {
    if (!dirty) {
      loadStage(selectedStage);
    }
  }, [templates]);

  const handleSave = () => {
    saveMutation.mutate(
      {
        id: currentTemplate?.id,
        stage: selectedStage,
        subject,
        body,
      },
      { onSuccess: () => setDirty(false) },
    );
  };

  const insertVariable = (v: string) => {
    setBody(prev => prev + v);
    setDirty(true);
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
      {/* Stage selector sidebar */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400 mb-2 px-1">
          Trigger
        </p>
        {EMAIL_STAGES.map(stage => (
          <button
            key={stage}
            onClick={() => loadStage(stage)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
              selectedStage === stage
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-gray-100 dark:hover:bg-white/5 dark:text-gray-300'
            }`}
          >
            {stage}
          </button>
        ))}
      </div>

      {/* Editor */}
      <Card className="dark:bg-gray-800 dark:border-white/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm dark:text-gray-100">
              Template: {selectedStage}
            </CardTitle>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending || !dirty}
            >
              {saveMutation.isPending
                ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                : <Save className="h-3.5 w-3.5 mr-1" />}
              Save
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Subject */}
          <div className="space-y-1">
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={e => { setSubject(e.target.value); setDirty(true); }}
              className="dark:bg-white/5 dark:border-white/10 font-mono text-sm"
            />
          </div>

          {/* Body */}
          <div className="space-y-1">
            <Label>Body</Label>
            <Textarea
              value={body}
              onChange={e => { setBody(e.target.value); setDirty(true); }}
              rows={12}
              className="dark:bg-white/5 dark:border-white/10 font-mono text-sm"
            />
          </div>

          {/* Variable chips */}
          <div>
            <p className="text-xs text-muted-foreground dark:text-gray-500 mb-1">
              Click to insert variable:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map(v => (
                <button
                  key={v}
                  onClick={() => insertVariable(v)}
                  className="px-2 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-xs font-mono hover:bg-gray-200 dark:hover:bg-white/20 transition-colors dark:text-gray-300"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {dirty && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Unsaved changes
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TestPreviewPanel
// ---------------------------------------------------------------------------

const DEFAULT_VARS: EmailTemplateVars = {
  employeeName:    'Jane Smith',
  leaveType:       'Annual Leave',
  startDate:       '16 Jun 2026',
  endDate:         '20 Jun 2026',
  days:            '5',
  approverName:    'John Manager',
  rejectionReason: 'Insufficient leave balance for the requested period.',
  division:        'Corporate Services Division',
  unit:            'Finance Unit',
};

const TestPreviewPanel: React.FC = () => {
  const { profile } = useGraphProfile();
  const sendMutation = useSendTestEmail();

  const [selectedStage, setSelectedStage] = useState<EmailTemplateStage>('Submission');
  const [vars, setVars] = useState<EmailTemplateVars>({ ...DEFAULT_VARS });
  const [testEmail, setTestEmail] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [isBuilding, setIsBuilding] = useState(false);

  // Pre-fill with the signed-in user's email
  React.useEffect(() => {
    const email = profile?.mail ?? profile?.userPrincipalName ?? '';
    if (email && !testEmail) setTestEmail(email);
  }, [profile]);

  // Rebuild preview whenever stage or vars change
  React.useEffect(() => {
    setIsBuilding(true);
    buildSCPNGPreviewHTML(selectedStage, vars)
      .then(html => {
        setPreviewHtml(html);
        setPreviewSubject(buildSCPNGEmailSubject(selectedStage, vars));
      })
      .finally(() => setIsBuilding(false));
  }, [selectedStage, vars]);

  const setVar = (key: keyof EmailTemplateVars, value: string) =>
    setVars(prev => ({ ...prev, [key]: value }));

  const handleSend = () => {
    if (!testEmail.trim()) return;
    sendMutation.mutate({ to: testEmail.trim(), stage: selectedStage, vars });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
      {/* Controls sidebar */}
      <div className="space-y-4 text-sm">
        <div className="space-y-1">
          <Label>Stage</Label>
          <Select value={selectedStage} onValueChange={v => setSelectedStage(v as EmailTemplateStage)}>
            <SelectTrigger className="dark:bg-white/5 dark:border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMAIL_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Send test */}
        <div className="space-y-1">
          <Label>Send Test To</Label>
          <Input
            type="email"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            placeholder="your@email.com"
            className="dark:bg-white/5 dark:border-white/10"
          />
          <Button
            size="sm"
            className="w-full mt-1"
            onClick={handleSend}
            disabled={!testEmail.trim() || sendMutation.isPending || isBuilding}
          >
            {sendMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              : <Send className="h-3.5 w-3.5 mr-1.5" />}
            {sendMutation.isPending ? 'Sending…' : 'Send Test Email'}
          </Button>
          <p className="text-[11px] text-muted-foreground dark:text-gray-500 leading-snug">
            Compiles the MJML template to Outlook-safe HTML and sends it directly as the email body via your Microsoft account.
          </p>
        </div>

        {/* Sample data fields */}
        <div className="space-y-2 border-t dark:border-white/10 pt-3">
          <Label className="text-xs text-muted-foreground dark:text-gray-400 uppercase tracking-wide">Sample Data</Label>
          {(Object.keys(DEFAULT_VARS) as (keyof EmailTemplateVars)[]).map(key => (
            <div key={key} className="space-y-0.5">
              <Label className="text-xs text-muted-foreground">{key}</Label>
              <Input
                value={String(vars[key] ?? '')}
                onChange={e => setVar(key, e.target.value)}
                className="h-7 text-xs dark:bg-white/5 dark:border-white/10"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Live HTML preview */}
      <div className="space-y-2 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">Live Preview</p>
            {previewSubject && (
              <p className="text-xs text-muted-foreground dark:text-gray-500 mt-0.5">
                Subject: <span className="font-medium dark:text-gray-300">{previewSubject}</span>
              </p>
            )}
          </div>
          {isBuilding && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>

        <div className="rounded-lg border dark:border-white/10 overflow-hidden bg-gray-100 dark:bg-gray-900">
          {previewHtml ? (
            <iframe
              srcDoc={previewHtml}
              className="w-full border-0"
              style={{ height: '680px' }}
              title="Email Preview"
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const WorkflowAdmin: React.FC = () => (
  <div className="space-y-4">
    <div>
      <h2 className="text-xl font-semibold dark:text-gray-100">Workflow Configuration</h2>
      <p className="text-sm text-muted-foreground dark:text-gray-400 mt-0.5">
        Configure approval routing per division and manage email notification templates.
      </p>
    </div>

    <Tabs defaultValue="approvers" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="approvers" className="gap-2">
          <Users className="h-4 w-4" />
          Approvers
        </TabsTrigger>
        <TabsTrigger value="templates" className="gap-2">
          <Mail className="h-4 w-4" />
          Email Templates
        </TabsTrigger>
        <TabsTrigger value="preview" className="gap-2">
          <FlaskConical className="h-4 w-4" />
          Test & Preview
        </TabsTrigger>
      </TabsList>

      <TabsContent value="approvers" className="mt-0">
        <ApproversPanel />
      </TabsContent>

      <TabsContent value="templates" className="mt-0">
        <EmailTemplatesPanel />
      </TabsContent>

      <TabsContent value="preview" className="mt-0">
        <TestPreviewPanel />
      </TabsContent>
    </Tabs>
  </div>
);

export default WorkflowAdmin;
