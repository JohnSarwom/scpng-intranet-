import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarIcon, User as UserIcon, Send, PaperclipIcon, Repeat, Trash2, PlusCircle, Loader2, X, FileIcon, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from "react-day-picker";
import { cn } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";
import DateRangePicker from '@/components/ui/DateRangePicker';
import { StaffMember } from '@/types/staff';
import { Task, TaskComment, Kra, Kpi, User } from '@/types';
import { GlobalAssigneeSelector } from '@/components/common/GlobalAssigneeSelector';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { useSharePointUpload } from '@/hooks/useSharePointUpload';
import { toast } from '@/components/ui/use-toast';

type Subtask = { id: string; text: string; completed: boolean };

interface StatusOption {
  id: string;
  name: string;
}

interface TaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: Partial<Task>) => void | Promise<void>;
  onSaveComment?: (taskId: string, comments: TaskComment[]) => Promise<void>;
  onNotifyComment?: (params: { taskId: string; taskTitle: string; commenterName: string; commenterEmail: string; commentText: string; assignees?: { email?: string; name?: string }[]; creatorEmail?: string }) => void;
  initialData?: Partial<Task> | null; // For editing
  statuses?: StatusOption[]; // Available status options
  defaultStatus?: string | null; // Added prop for default status on create
  buckets?: { id: string; title: string }[]; // Available buckets/groups
  defaultGroup?: string | null; // Default group for new tickets
  staffMembers: StaffMember[];
  kras: Kra[];

  kpis: Kpi[];
  currentDivision?: string;
  currentUnit?: string;
  container?: HTMLElement | null;
}

const DEFAULT_STATUSES = [
  { id: 'todo', name: 'To Do' },
  { id: 'in-progress', name: 'In Progress' },
  { id: 'on-hold', name: 'On Hold' },
  { id: 'in-review', name: 'In Review' },
  { id: 'completed', name: 'Completed' }
];

const DEFAULT_BUCKETS = [
  { id: 'todo', title: 'TO DO' },
  { id: 'in-progress', title: 'IN PROGRESS' },
  { id: 'on-hold', title: 'ON HOLD' },
  { id: 'in-review', title: 'IN REVIEW' },
  { id: 'completed', title: 'COMPLETED' }
];

const TaskDialog: React.FC<TaskDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onSaveComment,
  onNotifyComment,
  initialData,
  statuses = DEFAULT_STATUSES,
  defaultStatus,
  buckets = [],
  defaultGroup,
  staffMembers,
  kras = [],
  kpis = [],
  currentDivision,
  currentUnit,
  container
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [status, setStatus] = useState<string>('todo');
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newCommentText, setNewCommentText] = useState(''); // State for new comment input
  const [assignee, setAssignee] = useState<string | undefined>(undefined);
  const [recurrence, setRecurrence] = useState<string>('none');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [selectedKraId, setSelectedKraId] = useState<string | undefined>(undefined);
  const [selectedKpiId, setSelectedKpiId] = useState<string | undefined>(undefined);
  const [selectedAssignees, setSelectedAssignees] = useState<User[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<{ name: string; url: string; size?: number }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const commentsScrollAreaRef = useRef<HTMLDivElement>(null);

  const { uploadFile } = useSharePointUpload();

  const scrollToBottom = () => {
    // Small delay to ensure DOM is rendered before scrolling
    setTimeout(() => {
      if (commentsScrollAreaRef.current) {
        // Find the Radix ScrollArea viewport to scroll ONLY that container
        const viewport = commentsScrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: 'smooth'
          });
          return; // Success, don't use fallback
        }
      }

      // Fallback if we can't find the viewport or ref is missing
      if (commentsEndRef.current) {
        // 'nearest' avoids scrolling parent containers if the element is already visible in them
        commentsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 150);
  };

  // Authentication & Roles
  const { user: authUser } = useRoleBasedAuth();
  const isManagerOrAdmin = authUser?.is_admin || authUser?.role_name === 'manager' || authUser?.role_name === 'admin' || authUser?.role_name === 'super_admin';

  // Make KPIs dynamically filtered
  const visibleKpis = React.useMemo(() => {
    if (isManagerOrAdmin) return kpis;
    return kpis.filter(kpi => kpi.assignees?.some(a => a.email?.toLowerCase() === authUser?.user_email?.toLowerCase()));
  }, [kpis, isManagerOrAdmin, authUser]);

  // Ensure we have buckets to show
  const effectiveBuckets = buckets.length > 0 ? buckets : DEFAULT_BUCKETS;

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setPriority(initialData.priority || 'medium');

      let currentStatus = initialData.status || defaultStatus || statuses[0]?.id || 'todo';

      // Normalize status to match available options (handle "To Do" vs "todo" mismatch)
      const normalizedStatus = statuses.find(s =>
        s.id === currentStatus ||
        s.name.toLowerCase() === currentStatus.toLowerCase() ||
        s.id.toLowerCase() === currentStatus.toLowerCase().replace(' ', '-')
      );

      if (normalizedStatus) {
        currentStatus = normalizedStatus.id;
      } else {
        // Fallback map for common variations if not in statuses array
        const lower = currentStatus.toLowerCase();
        if (lower === 'to do' || lower === 'not started' || lower === 'open') currentStatus = 'todo';
        else if (lower === 'in progress' || lower === 'doing') currentStatus = 'in-progress';
        else if (lower === 'on hold') currentStatus = 'on-hold';
        else if (lower === 'review' || lower === 'in review' || lower === 'under review') currentStatus = 'in-review';
        else if (lower === 'done' || lower === 'completed' || lower === 'closed') currentStatus = 'completed';
      }

      setStatus(currentStatus);

      // Initialize Group:
      // 1. Try explicit projectId (Group ID)
      // 2. Fallback: Try to map current Status to a Bucket ID if projectId is missing (legacy data support)
      // 3. Last resort: defaultGroup
      let initialGroupId = initialData.projectId || defaultGroup;

      // If no group is set, try to find a bucket that matches the current status
      if (!initialGroupId) {
        // Robust matching: Check IDs first, then case-insensitive IDs
        const statusMatch = effectiveBuckets.find(b => b.id === currentStatus || b.id.toLowerCase() === currentStatus.toLowerCase());
        if (statusMatch) {
          initialGroupId = statusMatch.id;
        }
      }

      // If still nothing, default to first bucket (usually To Do)
      if (!initialGroupId && effectiveBuckets.length > 0) {
        initialGroupId = effectiveBuckets[0].id;
      }

      setGroupId(initialGroupId);

      setAssignee(initialData.assignee);

      // Initialize multiple assignees
      if (initialData.assignees && initialData.assignees.length > 0) {
        setSelectedAssignees(initialData.assignees);
      } else if (initialData.assignee) {
        // Fallback: Create User object from single assignee string (email)
        const staff = staffMembers.find(s => s.email === initialData.assignee);
        if (staff) {
          setSelectedAssignees([{
            id: staff.id,
            name: staff.name,
            email: staff.email,
            avatarUrl: (staff as any).avatarUrl,
            initials: (staff as any).initials || staff.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
          }]);
        } else {
          // Minimal user object if not found in staff list
          setSelectedAssignees([{
            id: initialData.assignee,
            name: initialData.assignee,
            email: initialData.assignee
          }]);
        }
      } else {
        setSelectedAssignees([]);
      }

      setRecurrence(initialData.recurrence || 'none');
      setSubtasks(initialData.subtasks || []);
      setSelectedKraId(initialData.kra_id);
      setSelectedKpiId(initialData.kpi_id);
      setExistingAttachments(initialData.attachments || []);
      setPendingFiles([]);

      if (initialData.startDate) {
        setDateRange({
          from: new Date(initialData.startDate),
          to: initialData.dueDate ? new Date(initialData.dueDate) : undefined
        });
      } else {
        setDateRange(undefined);
      }

      setComments(initialData.comments || []);
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');

      const initStatus = defaultStatus || statuses[0]?.id || 'todo';
      setStatus(initStatus);

      // Default Group for new task
      let initGroup = defaultGroup;
      if (!initGroup && effectiveBuckets.length > 0) {
        // Default to matching status or first bucket
        const statusMatch = effectiveBuckets.find(b => b.id === initStatus);
        initGroup = statusMatch ? statusMatch.id : effectiveBuckets[0].id;
      }
      setGroupId(initGroup);

      setDateRange(undefined);
      setComments([]);
      setAssignee(undefined);
      setSelectedAssignees([]);
      setRecurrence('none');
      setSubtasks([]);
      setSelectedKraId(undefined);
      setSelectedKpiId(undefined);
      setExistingAttachments([]);
      setPendingFiles([]);
    }
    setNewCommentText('');
    setNewSubtaskText('');
  }, [initialData, isOpen, defaultStatus, defaultGroup, buckets, effectiveBuckets]); // Added buckets dependency


  // Sanitize folder names for SharePoint paths
  const sanitizeFolderName = (name: string) =>
    name.replace(/[#%*:<>?/\\|"]/g, '').replace(/\s+/g, ' ').trim() || 'Untitled';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setPendingFiles(prev => [...prev, ...newFiles]);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleRemovePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingAttachment = (index: number) => {
    setExistingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files);
      setPendingFiles(prev => [...prev, ...newFiles]);
    }
  };

  const uploadPendingFiles = async (taskTitle: string): Promise<{ name: string; url: string; size?: number }[]> => {
    if (pendingFiles.length === 0) return [];

    const division = sanitizeFolderName(currentDivision || 'General');
    const unit = sanitizeFolderName(currentUnit || 'General');
    const taskFolder = sanitizeFolderName(taskTitle);
    const folderPath = `${division}/${unit}/${taskFolder}`;

    const uploaded: { name: string; url: string; size?: number }[] = [];

    for (const file of pendingFiles) {
      const url = await uploadFile(
        file,
        '/sites/scpngintranet',
        'Task_Registry_Attachements',
        folderPath
      );
      if (url) {
        uploaded.push({ name: file.name, url, size: file.size });
      }
    }

    return uploaded;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast({ title: "Validation Error", description: "Task title is required", variant: "destructive" });
      return;
    }

    console.log(`[Metrics] TaskDialog Save Clicked at ${performance.now().toFixed(2)}ms`);
    console.time('TaskDialog-SaveReaction');

    const inferredKraId = selectedKpiId && selectedKpiId !== 'none'
      ? kpis.find(k => k.id.toString() === selectedKpiId)?.kra_id?.toString() || selectedKraId
      : selectedKraId;

    const taskData: Partial<Task> = {
      id: initialData?.id,
      title: trimmedTitle,
      description,
      priority,
      status: status as Task['status'],
      projectId: groupId || (effectiveBuckets.find(b => b.id === status)?.id || effectiveBuckets[0]?.id), // Ensure projectId is set
      startDate: dateRange?.from || undefined,
      dueDate: dateRange?.to?.toISOString() || '',
      assignee: selectedAssignees.length > 0 ? (selectedAssignees[0].email || 'Unassigned') : undefined,
      assignees: selectedAssignees,
      recurrence: recurrence,
      subtasks: subtasks,
      comments: comments,
      tags: initialData?.tags, // Pass existing tags so service can update bucket tag
      kra_id: inferredKraId,
      kpi_id: selectedKpiId,
    };

    setIsSubmitting(true);
    try {
      // Upload pending files to SharePoint (Division/Unit/TaskTitle folder)
      let allAttachments = [...existingAttachments];
      if (pendingFiles.length > 0) {
        setIsUploading(true);
        try {
          const uploaded = await uploadPendingFiles(trimmedTitle);
          allAttachments = [...allAttachments, ...uploaded];
          setPendingFiles([]);
        } catch (err) {
          console.error('File upload failed:', err);
          toast({ title: "Upload Error", description: "Some files failed to upload. Task will be saved without them.", variant: "destructive" });
        } finally {
          setIsUploading(false);
        }
      }

      if (allAttachments.length > 0) {
        taskData.attachments = allAttachments;
      }

      await onSubmit(taskData);
      console.log(`[Metrics] TaskDialog onSubmit Called at ${performance.now().toFixed(2)}ms`);
    } finally {
      setIsSubmitting(false);
      try { console.timeEnd('TaskDialog-SaveReaction'); } catch (e) { }
    }
  };

  // Performance metrics for Modal Open/Close
  useEffect(() => {
    if (isOpen) {
      try { console.timeEnd('UI-Reaction-TaskDialog-Open'); } catch (e) { }
      console.log(`[Metrics] TaskDialog (${initialData ? 'Edit' : 'Add'}) Opened at ${performance.now().toFixed(2)}ms`);
      console.time(`TaskDialog-${initialData ? 'Edit' : 'Add'}-OpenDuration`);
      scrollToBottom();
    } else {
      console.log(`[Metrics] TaskDialog Closed at ${performance.now().toFixed(2)}ms`);
      try { console.timeEnd(`TaskDialog-Add-OpenDuration`); } catch (e) { }
      try { console.timeEnd(`TaskDialog-Edit-OpenDuration`); } catch (e) { }
    }
  }, [isOpen, initialData]);

  // Scroll to bottom when comments are updated
  useEffect(() => {
    if (isOpen && comments.length > 0) {
      scrollToBottom();
    }
  }, [comments, isOpen]);

  // Function to handle adding a new comment — saves immediately to SharePoint
  const [isSavingComment, setIsSavingComment] = useState(false);
  const handleAddComment = async () => {
    if (!newCommentText.trim() || isSavingComment) return;
    const userName = authUser?.user_name || authUser?.user_email || 'Unknown User';
    const newComment: TaskComment = {
      id: `comment-${Date.now()}`,
      authorName: userName,
      authorEmail: authUser?.user_email || '',
      timestamp: new Date().toISOString(),
      text: newCommentText,
    };
    const updatedComments = [...comments, newComment];
    setComments(updatedComments);
    setNewCommentText('');

    // Persist immediately if editing an existing task
    if (initialData?.id && onSaveComment) {
      setIsSavingComment(true);
      try {
        await onSaveComment(initialData.id, updatedComments);
        // Fire-and-forget: notify assignees & creator
        onNotifyComment?.({
          taskId: initialData.id,
          taskTitle: initialData.title || '',
          commenterName: userName,
          commenterEmail: authUser?.user_email || '',
          commentText: newCommentText.trim() || newComment.text,
          assignees: initialData.assignees,
          creatorEmail: initialData.createdByEmail || initialData.authorEmail,
        });
      } catch (err) {
        console.error('Failed to save comment', err);
        // Revert on failure
        setComments(comments);
      } finally {
        setIsSavingComment(false);
      }
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtaskText.trim()) return;
    const newSubtask: Subtask = {
      id: `subtask-${Date.now()}`,
      text: newSubtaskText,
      completed: false,
    };
    setSubtasks(prev => [...prev, newSubtask]);
    setNewSubtaskText('');
  };

  const handleToggleSubtask = (id: string) => {
    setSubtasks(prev =>
      prev.map(subtask =>
        subtask.id === id ? { ...subtask, completed: !subtask.completed } : subtask
      )
    );
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(prev => prev.filter(subtask => subtask.id !== id));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden dark:bg-gray-950 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 pb-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl font-semibold dark:text-gray-100">{initialData ? 'Edit Task' : 'Create New Task'}</DialogTitle>
              <DialogDescription className="dark:text-gray-400">
                {initialData ? 'Update the details of the task.' : 'Fill in the details for the new task.'}
              </DialogDescription>
            </div>
            {initialData?.createdBy && (
              <div className="flex flex-col items-end">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Created by</span>
                <span className="text-sm font-medium text-foreground">{initialData.createdBy}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto px-6 pt-4">
          <form onSubmit={handleSubmit} id="task-form">
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 pb-4 transition-opacity duration-200"
              style={isSubmitting ? { opacity: 0.6, pointerEvents: 'none' } : {}}
            >
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="title" className="dark:text-gray-300">Title*</Label>
                <Input
                  id="title"
                  placeholder="Enter task title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="py-3 px-4 rounded-lg dark:bg-gray-900 dark:border-white/10 focus:ring-intranet-primary/50 dark:text-gray-100"
                  required
                  autoFocus
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="description" className="dark:text-gray-300">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Add a detailed description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="py-3 px-4 rounded-lg dark:bg-gray-900 dark:border-white/10 focus:ring-intranet-primary/50 dark:text-gray-100"
                  rows={4}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="group" className="dark:text-gray-300">Group/Column</Label>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger id="group" className="py-3 px-4 rounded-lg dark:bg-gray-900 dark:border-white/10 dark:text-gray-100">
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent container={container} className="dark:bg-gray-950 dark:border-white/10">
                    {effectiveBuckets.map((bucket) => (
                      <SelectItem key={bucket.id} value={bucket.id}>
                        {bucket.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="status" className="dark:text-gray-300">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status" className="py-3 px-4 rounded-lg dark:bg-gray-900 dark:border-white/10 dark:text-gray-100">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent container={container} className="dark:bg-gray-950 dark:border-white/10">
                    {statuses.map((statusOption) => (
                      <SelectItem key={statusOption.id} value={statusOption.id}>
                        {statusOption.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="priority" className="dark:text-gray-300">Priority</Label>
                <Select value={priority} onValueChange={(value: 'low' | 'medium' | 'high' | 'urgent') => setPriority(value)}>
                  <SelectTrigger id="priority" className="py-3 px-4 rounded-lg dark:bg-gray-900 dark:border-white/10 dark:text-gray-100">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent container={container} className="dark:bg-gray-950 dark:border-white/10">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="dateRange">Date Range</Label>
                <DateRangePicker
                  id="dateRange"
                  selectedRange={dateRange}
                  onSelectRange={setDateRange}
                  placeholder="Pick a date range"
                  numberOfMonths={2}
                  className="py-3 px-4 rounded-lg"
                  container={container}
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="assignee">Assignees</Label>
                <GlobalAssigneeSelector
                  selected={selectedAssignees.map(u => ({
                    id: u.id.toString(),
                    displayName: u.name,
                    givenName: '',
                    surname: '',
                    mail: u.email || '',
                    jobTitle: ''
                  }))}
                  onChange={(employees) => {
                    const mappedUsers: User[] = employees.map(e => ({
                      id: e.id || Date.now().toString(),
                      name: e.displayName || 'Unknown User',
                      email: e.mail || '',
                      // Fallback logic for avatar if needed
                      initials: (e.displayName || 'U').charAt(0).toUpperCase()
                    }));

                    setSelectedAssignees(mappedUsers);

                    // Update legacy single assignee for display state if needed
                    if (mappedUsers.length > 0) {
                      setAssignee(mappedUsers[0].email);
                    } else {
                      setAssignee(undefined);
                    }
                  }}
                  mode="multiple"
                  placeholder="Assign to team members..."
                  container={container}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="kpi">Link to KPI</Label>
                <Select value={selectedKpiId} onValueChange={setSelectedKpiId}>
                  <SelectTrigger id="kpi" className="py-3 px-4 rounded-lg">
                    <SelectValue placeholder="Select a KPI" />
                  </SelectTrigger>
                  <SelectContent container={container}>
                    <SelectItem value="none">None</SelectItem>
                    {visibleKpis.map((kpi) => (
                      <SelectItem key={kpi.id} value={kpi.id.toString()}>
                        {kpi.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="recurrence" className="dark:text-gray-300">Repeat</Label>
                <Select value={recurrence} onValueChange={setRecurrence}>
                  <SelectTrigger id="recurrence" className="py-3 px-4 rounded-lg dark:bg-gray-900 dark:border-white/10 dark:text-gray-100 focus:ring-intranet-primary/50">
                    <SelectValue placeholder="Select recurrence" />
                  </SelectTrigger>
                  <SelectContent container={container} className="dark:bg-gray-950 dark:border-white/10">
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="attachments">Attachments</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click or drag files here to attach
                  </p>
                </div>

                {/* Existing attachments (from saved task) */}
                {existingAttachments.length > 0 && (
                  <div className="space-y-1">
                    {existingAttachments.map((att, i) => (
                      <div key={`existing-${i}`} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded-md">
                        <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="truncate flex-1 hover:underline text-primary">
                          {att.name}
                        </a>
                        {att.size && <span className="text-xs text-muted-foreground flex-shrink-0">{(att.size / 1024).toFixed(0)} KB</span>}
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => handleRemoveExistingAttachment(i)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending files (not yet uploaded) */}
                {pendingFiles.length > 0 && (
                  <div className="space-y-1">
                    {pendingFiles.map((file, i) => (
                      <div key={`pending-${i}`} className="flex items-center gap-2 text-sm p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
                        <PaperclipIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <span className="truncate flex-1">{file.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => handleRemovePendingFile(i)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </form>

          <div className="pt-4 mt-4 border-t border-gray-200 dark:border-white/10">
            <h3 className="text-lg font-medium mb-3 dark:text-gray-100">Checklist</h3>
            <div className="space-y-2 mb-4">
              {subtasks.map(subtask => (
                <div key={subtask.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={subtask.completed}
                    onChange={() => handleToggleSubtask(subtask.id)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-white/20 dark:bg-gray-800 text-intranet-primary focus:ring-intranet-primary"
                  />
                  <span className={cn("flex-grow dark:text-gray-300 text-sm", subtask.completed && "line-through text-muted-foreground")}>
                    {subtask.text}
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 dark:text-gray-400 dark:hover:bg-gray-800" onClick={() => handleRemoveSubtask(subtask.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add a checklist item"
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                className="dark:bg-gray-900 dark:border-white/10 dark:text-gray-100"
              />
              <Button type="button" onClick={handleAddSubtask} variant="outline" className="dark:bg-gray-800 dark:border-white/10 dark:text-gray-300">
                <PlusCircle className="h-4 w-4 mr-2" /> Add
              </Button>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-gray-200 dark:border-white/10">
            <h3 className="text-lg font-medium mb-3 dark:text-gray-100">Comments</h3>
            <ScrollArea ref={commentsScrollAreaRef} className="h-[200px] w-full mb-4 border rounded-xl p-3 bg-gray-50 dark:bg-gray-800/20 dark:border-white/10 backdrop-blur-sm">
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[100px]">
                  <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
                  <div ref={commentsEndRef} />
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => {
                    const isMe = comment.authorEmail?.toLowerCase() === authUser?.user_email?.toLowerCase();
                    const initials = comment.authorName
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase();
                    return (
                      <div key={comment.id} className={cn("flex items-end gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                        <Avatar className="h-7 w-7 flex-shrink-0">
                          <AvatarFallback className={cn("text-xs", isMe ? "bg-primary text-primary-foreground" : "")}>{initials}</AvatarFallback>
                        </Avatar>
                        <div className={cn("max-w-[75%] rounded-lg px-3 py-2", isMe ? "bg-primary text-primary-foreground rounded-br-none" : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-bl-none")}>
                          {!isMe && <p className="text-xs font-semibold mb-0.5">{comment.authorName}</p>}
                          <p className={cn("text-sm", isMe ? "text-primary-foreground/90" : "text-foreground")}>{comment.text}</p>
                          <p className={cn("text-[10px] mt-1", isMe ? "text-primary-foreground/60 text-right" : "text-muted-foreground")}>
                            {format(new Date(comment.timestamp), "p")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={commentsEndRef} />
                </div>
              )}
            </ScrollArea>
            <div className="flex gap-2 items-start mb-4">
              <Avatar className="h-9 w-9 mt-1">
                <AvatarFallback>
                  {(authUser?.user_name || authUser?.user_email || 'U')
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Textarea
                placeholder="Add a comment..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                rows={3}
                className="flex-1 py-2 px-3 rounded-lg"
              />
              <Button
                type="button"
                size="icon"
                onClick={handleAddComment}
                disabled={!newCommentText.trim() || isSavingComment}
                className="mt-1"
              >
                {isSavingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="sr-only">Send comment</span>
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-700/50 flex-shrink-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="px-6 py-2 rounded-lg">Cancel</Button>
          <Button type="submit" form="task-form" disabled={isSubmitting} className="bg-intranet-primary hover:bg-intranet-secondary text-white px-6 py-2 rounded-lg shadow-lg">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isUploading ? 'Uploading files...' : (initialData ? 'Saving...' : 'Creating...')}
              </>
            ) : (
              initialData ? 'Save Changes' : 'Create Task'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDialog;
