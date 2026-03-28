import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ChecklistSection from '@/components/ChecklistSection';
import { Task } from '@/types';
import type { StaffMember } from '@/types/staff';
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { GlobalAssigneeSelector } from '@/components/common/GlobalAssigneeSelector';

interface EditTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  onSave: (updatedTask: Task) => void;
  staffMembers: StaffMember[];
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({
  open,
  onOpenChange,
  task,
  onSave,
  staffMembers
}) => {
  const loading = false;
  const currentUserDepartment = staffMembers?.[0]?.department || 'Unknown';

  const [editedTask, setEditedTask] = useState<Task>({ ...task });

  useEffect(() => {
    setEditedTask({ ...task });
  }, [task]);

  const handleUpdateTask = () => {
    // Basic validation
    if (!editedTask.title) {
      toast({
        title: "Error",
        description: "Task title is required",
      });
      return;
    }

    // Format dates properly
    const taskToSave = {
      ...editedTask,
      // Ensure dueDate is a string
      dueDate: typeof editedTask.dueDate === 'string'
        ? editedTask.dueDate
        : (editedTask.dueDate as Date)?.toISOString?.()?.split('T')[0] || null,

      // Ensure startDate is a proper date object or null
      startDate: editedTask.startDate instanceof Date
        ? editedTask.startDate
        : typeof editedTask.startDate === 'string' && editedTask.startDate
          ? new Date(editedTask.startDate)
          : null
    };

    onSave(taskToSave);
    onOpenChange(false);

    toast({
      title: "Task Updated",
      description: "The task has been successfully updated",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] flex flex-col max-h-[90vh] dark:bg-gray-950 dark:border-white/10 shadow-2xl overflow-hidden p-0">
        <DialogHeader className="p-6 pb-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm">
          <DialogTitle className="text-xl font-semibold">Edit Task</DialogTitle>
          <DialogDescription>
            Update the task details below.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-grow pr-2 -mr-2 px-6">
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                placeholder="Task Title"
                value={editedTask.title || ''}
                onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                className="dark:bg-gray-800 dark:border-white/10 focus:ring-intranet-primary/50"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                placeholder="Task Description"
                value={editedTask.description || ''}
                onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                className="dark:bg-gray-800 dark:border-white/10 focus:ring-intranet-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="task-assignee">
                  Assignee {currentUserDepartment && <span className="text-sm text-muted-foreground">({currentUserDepartment})</span>}
                </Label>
                <Select
                  value={editedTask.assignee || ''}
                  onValueChange={(value) => setEditedTask({ ...editedTask, assignee: value })}
                >
                  <SelectTrigger id="task-assignee" className={cn("dark:bg-gray-800 dark:border-white/10", loading && "opacity-50")}>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {loading ? (
                      <SelectItem value="_loading" disabled>Loading staff members...</SelectItem>
                    ) : staffMembers && staffMembers.length > 0 ? (
                      staffMembers.map((staff) => (
                        <SelectItem key={staff.id} value={staff.name}>
                          {staff.name} ({staff.jobTitle || 'No Title'})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="_no_staff" disabled>No staff members found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="task-status">Status</Label>
                <Select
                  value={editedTask.status || 'todo'}
                  onValueChange={(value: 'todo' | 'in-progress' | 'on-hold' | 'in-review' | 'completed') =>
                    setEditedTask({ ...editedTask, status: value })
                  }
                >
                  <SelectTrigger id="task-status" className="dark:bg-gray-800 dark:border-white/10">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                    <SelectItem value="in-review">In Review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  value={editedTask.priority || 'medium'}
                  onValueChange={(value: 'low' | 'medium' | 'high' | 'urgent') =>
                    setEditedTask({ ...editedTask, priority: value })
                  }
                >
                  <SelectTrigger id="task-priority" className="dark:bg-gray-800 dark:border-white/10">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="task-start-date">Start Date</Label>
                <Input
                  id="task-start-date"
                  type="date"
                  value={editedTask.startDate instanceof Date ? editedTask.startDate.toISOString().split('T')[0] : typeof editedTask.startDate === 'string' && editedTask.startDate ? editedTask.startDate.split('T')[0] : ''}
                  onChange={(e) => setEditedTask({ ...editedTask, startDate: new Date(e.target.value) })}
                  className="dark:bg-gray-800 dark:border-white/10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assignee</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {editedTask.assignees?.map((assignee) => (
                  <Badge key={assignee.id} variant="secondary" className="pl-1 pr-2 py-1 flex items-center gap-1">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={assignee.avatarUrl} />
                      <AvatarFallback className="text-[10px]">{assignee.initials || assignee.name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{assignee.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAssignee(assignee.id.toString())}
                      className="hover:text-destructive ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <GlobalAssigneeSelector
                selected={editedTask.assignees?.map(u => ({
                  id: u.id.toString(),
                  displayName: u.name,
                  givenName: '',
                  surname: '',
                  mail: u.email || '',
                  jobTitle: u.jobTitle || ''
                })) || []}
                onSelect={(selectedUsers) => {
                  const newAssignees = selectedUsers.map(user => ({
                    id: parseInt(user.id),
                    name: user.displayName,
                    email: user.mail,
                    avatarUrl: '', // You might need to fetch or generate this
                    initials: user.givenName.charAt(0) + user.surname.charAt(0),
                    jobTitle: user.jobTitle,
                  }));
                  setEditedTask(prev => ({ ...prev, assignees: newAssignees }));
                }}
                staffMembers={staffMembers.map(staff => ({
                  id: staff.id.toString(),
                  displayName: staff.name,
                  givenName: staff.name.split(' ')[0],
                  surname: staff.name.split(' ').slice(1).join(' '),
                  mail: staff.email,
                  jobTitle: staff.jobTitle,
                }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="task-due-date">Due Date</Label>
                <Input
                  id="task-due-date"
                  type="date"
                  value={typeof editedTask.dueDate === 'string' ? editedTask.dueDate.split('T')[0] : ''}
                  onChange={(e) => setEditedTask({ ...editedTask, dueDate: e.target.value })}
                  className="dark:bg-gray-800 dark:border-white/10"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="task-percentage">Completion %</Label>
                <Input
                  id="task-percentage"
                  type="number"
                  min="0"
                  max="100"
                  value={editedTask.completionPercentage || 0}
                  onChange={(e) => setEditedTask({ ...editedTask, completionPercentage: parseInt(e.target.value) || 0 })}
                  className="dark:bg-gray-800 dark:border-white/10"
                />
              </div>
            </div>

            <div className="border-t pt-4 mt-2">
              <ChecklistSection
                items={editedTask.checklist || []}
                onChange={(items) => setEditedTask({ ...editedTask, checklist: items })}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-gray-50/50 dark:bg-gray-800/50 border-t dark:border-white/10">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="dark:text-gray-400 dark:hover:text-white">Cancel</Button>
          <Button onClick={handleUpdateTask} className="bg-intranet-primary hover:bg-intranet-secondary text-white shadow-lg">Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditTaskModal; 