import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GroupTemplateDialog } from '@/components/unit-tabs/GroupTemplateDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  Plus,
  LayoutGrid,
  Filter,
  Search,
  Trash2,
  Kanban,
  List,
  CalendarIcon,
  User,
  MoreVertical,
  Loader2,
} from 'lucide-react';
import TaskCard from '@/components/unit-tabs/TaskCard';
import TaskDialog from '@/components/unit-tabs/TaskDialog';
import { StaffMember } from '@/types/staff';
import { Objective, Kra, Task, Project } from '@/types';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
  DragOverlay,
  useDroppable,
  pointerWithin,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { addDays, addWeeks, addMonths } from 'date-fns';

interface BoardData {
  [key: string]: Task[];
}

export interface Bucket {
  id: string;
  title: string;
  isCustom?: boolean;
  order?: number;
}

interface ItemToDelete {
  type: 'task' | 'group';
  id: string;
  name?: string;
}

type BoardColumnId = string;
type ViewMode = 'board' | 'grid' | 'list';

// Initial buckets removed - using dynamic custom groups only

const BoardLane = ({
  id,
  title,
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onDeleteGroup,
  onEdit,
  isOver = false,
  onRenameGroup,
  onToggleComplete,
  onPriorityChange,
  onAssigneeChange,
  onStatusChange,
  dropTargetInfo,
  staffMembers,
  onInsertAfter
}: {
  id: string;
  title: string;
  tasks: Task[];
  onAddTask: () => void;
  onEditTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onEdit: (id: string) => void;
  isOver?: boolean;
  onRenameGroup: (groupId: string, newTitle: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onPriorityChange: (id: string, priority: 'low' | 'medium' | 'high' | 'urgent') => void;
  onAssigneeChange: (id: string, assignee: StaffMember) => void;
  onStatusChange: (id: string, status: string) => void;
  dropTargetInfo: {
    columnId: string | null;
    overItemId: string | null;
    isBottomHalf: boolean;
  };
  staffMembers: StaffMember[];
  onInsertAfter: (groupId: string) => void;
}) => {
  const dropId = `group-${id}`;
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({ id: dropId });
  // local isOver override or use hook
  const isActuallyOver = isOver || isDroppableOver;
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const completedTasks = tasks.filter(task => task.completed);
  const incompleteTasks = tasks.filter(task => !task.completed);

  // Rename handlers
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setTempTitle(title);
  };

  const handleBlur = () => {
    if (tempTitle.trim() && tempTitle !== title) {
      onRenameGroup(id, tempTitle);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (tempTitle.trim() && tempTitle !== title) {
        onRenameGroup(id, tempTitle);
      }
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setTempTitle(title);
    }
  };

  return (
    <div className={cn(
      "w-72 flex-shrink-0 flex flex-col bg-muted/30 dark:bg-muted/20 rounded-lg transition-colors border-2",
      isActuallyOver ? "bg-accent/50 border-primary border-dashed ring-2 ring-primary/10 shadow-lg" : "border-transparent"
    )}>
      <div className="p-3 font-medium flex items-center justify-between bg-muted/50 dark:bg-muted/30 rounded-t-lg">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="bg-background text-foreground p-1 rounded w-full mr-2"
            autoFocus
          />
        ) : (
          <h3 onDoubleClick={handleDoubleClick} className="cursor-pointer hover:bg-muted/50 rounded px-1 transition-colors flex-grow" title="Double click to rename">
            {title}
          </h3>
        )}
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="ml-2">{tasks.length}</Badge>
          <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={onAddTask}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(id)}>
                Rename Group
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onInsertAfter(id)}>
                Insert Group After
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDeleteGroup(id)} className="text-red-600 focus:text-red-600">
                Delete Group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div ref={setNodeRef} className="p-2 flex-grow space-y-3 relative min-h-[500px] h-full">
        {/* min-h-full ensures the drop zone covers the entire lane height even if empty */}
        <SortableContext items={incompleteTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
          {incompleteTasks.length === 0 && completedTasks.length === 0 && (
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700/50 rounded-lg flex flex-col items-center justify-center p-4 text-center pointer-events-none opacity-60 h-full min-h-[150px]">
              <Kanban className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground/50">No tasks in this group</p>
            </div>
          )}

          {incompleteTasks.map((task) => {
            const assignee = staffMembers.find(s => s.email === task.assignee);
            // Improved mapping with fallback: match by ID or email (case-insensitive), fall back to original User object
            const assignees = task.assignees?.map(a => {
              const staffMatch = staffMembers.find(s =>
                s.id?.toString() === a.id?.toString() ||
                s.email?.toLowerCase() === a.email?.toLowerCase()
              );
              return staffMatch || a; // Fallback to original User object if no match
            }) || [];
            return (
              <TaskCard
                key={task.id}
                {...task}
                assignee={assignee}
                assignees={assignees}
                onEdit={() => onEditTask(task.id)}
                onDelete={() => onDeleteTask(task.id)}
                onComplete={onToggleComplete}
                onPriorityChange={onPriorityChange}
                onAssigneeChange={onAssigneeChange}
                onStatusChange={onStatusChange}
                availableAssignees={staffMembers}
              />
            )
          })}
        </SortableContext>
        {completedTasks.length > 0 && (
          <div className="mt-4">
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setShowCompleted(!showCompleted)}>
              Completed ({completedTasks.length})
            </Button>
            {showCompleted && (
              <div className="mt-2 space-y-3">
                {completedTasks.map((task) => {
                  const assignee = staffMembers.find(s => s.email === task.assignee);
                  // Improved mapping with fallback: match by ID or email (case-insensitive), fall back to original User object
                  const assignees = task.assignees?.map(a => {
                    const staffMatch = staffMembers.find(s =>
                      s.id?.toString() === a.id?.toString() ||
                      s.email?.toLowerCase() === a.email?.toLowerCase()
                    );
                    return staffMatch || a; // Fallback to original User object if no match
                  }) || [];
                  return (
                    <TaskCard
                      key={task.id}
                      {...task}
                      assignee={assignee}
                      assignees={assignees}
                      onEdit={() => onEditTask(task.id)}
                      onDelete={() => onDeleteTask(task.id)}
                      onComplete={onToggleComplete}
                      onPriorityChange={onPriorityChange}
                      onAssigneeChange={onAssigneeChange}
                      onStatusChange={onStatusChange}
                      availableAssignees={staffMembers}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const TaskGridView: React.FC<{
  tasks: BoardData;
  onEditTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onPriorityChange: (id: string, priority: 'low' | 'medium' | 'high' | 'urgent') => void;
  onAssigneeChange: (id: string, assignee: StaffMember) => void;
  onStatusChange: (id: string, status: string) => void;
  staffMembers: StaffMember[];
}> = ({ tasks, onEditTask, onDeleteTask, onToggleComplete, onPriorityChange, onAssigneeChange, onStatusChange, staffMembers }) => {
  const allTasks = useMemo(() => {
    const flattened: Task[] = [];
    Object.values(tasks).forEach(columnTasks => {
      flattened.push(...columnTasks);
    });
    return flattened;
  }, [tasks]);

  if (allTasks.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No tasks found</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {allTasks.map((task) => {
        const assignee = staffMembers.find(s => s.email === task.assignee);
        // Improved mapping with fallback: match by ID or email (case-insensitive), fall back to original User object
        const assignees = task.assignees?.map(a => {
          const staffMatch = staffMembers.find(s =>
            s.id?.toString() === a.id?.toString() ||
            s.email?.toLowerCase() === a.email?.toLowerCase()
          );
          return staffMatch || a; // Fallback to original User object if no match
        }) || [];
        return (
          <TaskCard
            key={task.id}
            {...task}
            assignee={assignee}
            assignees={assignees}
            onEdit={() => onEditTask(task.id)}
            onDelete={() => onDeleteTask(task.id)}
            onComplete={onToggleComplete}
            onPriorityChange={onPriorityChange}
            onAssigneeChange={onAssigneeChange}
            onStatusChange={onStatusChange}
          />
        );
      })}
    </div>
  );
};

const TaskListView: React.FC<{
  tasks: BoardData;
  buckets: Bucket[];
  onEditTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onPriorityChange: (id: string, priority: 'low' | 'medium' | 'high' | 'urgent') => void;
  onAssigneeChange: (id: string, assignee: StaffMember) => void;
  onStatusChange: (id: string, status: string) => void;
  staffMembers: StaffMember[];
}> = ({ tasks, buckets, onEditTask, onDeleteTask, onToggleComplete, onPriorityChange, onAssigneeChange, onStatusChange, staffMembers }) => {
  const allTasks = useMemo(() => {
    const flattened: (Task & { columnId: string, columnTitle: string })[] = [];
    Object.entries(tasks).forEach(([columnId, columnTasks]) => {
      const bucketTitle = buckets.find(b => b.id === columnId)?.title || columnId;

      columnTasks.forEach(task => {
        flattened.push({
          ...task,
          columnId,
          columnTitle: bucketTitle,
        });
      });
    });
    return flattened.sort((a, b) => (a.completed ? 1 : -1) - (b.completed ? 1 : -1) || buckets.findIndex(bucket => bucket.id === a.columnId) - buckets.findIndex(bucket => bucket.id === b.columnId));
  }, [tasks, buckets]);

  if (allTasks.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No tasks found</div>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden h-[calc(100vh-240px)] flex flex-col">
      <div className="flex-1 overflow-auto kanban-scrollbar relative">
        <table className="w-full min-w-[1000px]">
          <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10 shadow-sm">
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-xs font-medium text-left p-3 text-muted-foreground w-10"></th>
              <th className="text-xs font-medium text-left p-3 text-muted-foreground">Tasks/Operations</th>
              <th className="text-xs font-medium text-left p-3 text-muted-foreground">Group</th>
              <th className="text-xs font-medium text-left p-3 text-muted-foreground">Priority</th>
              <th className="text-xs font-medium text-left p-3 text-muted-foreground">Due Date</th>
              <th className="text-xs font-medium text-left p-3 text-muted-foreground">Assignee</th>
              <th className="text-xs font-medium text-left p-3 text-muted-foreground w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {allTasks.map((task) => {
              const assignee = staffMembers.find(s => s.email === task.assignee);
              // Improved mapping with fallback: match by ID or email (case-insensitive), fall back to original User object
              const assignees = task.assignees?.map(a => {
                const staffMatch = staffMembers.find(s =>
                  s.id?.toString() === a.id?.toString() ||
                  s.email?.toLowerCase() === a.email?.toLowerCase()
                );
                return staffMatch || a; // Fallback to original User object if no match
              }) || [];
              return (
                <tr key={task.id} className={cn("border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50", task.completed && "bg-gray-50 dark:bg-gray-800/50")}>
                  <td className="p-3 text-center">
                    <Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-muted-foreground hover:text-primary" onClick={() => onToggleComplete(task.id, !task.completed)}>
                      {task.completed ? <Kanban className="h-4 w-4 text-green-600" /> : <List className="h-4 w-4" />}
                    </Button>
                  </td>
                  <td className="p-3">
                    <div className={cn("font-medium text-sm", task.completed && "line-through text-muted-foreground")}>{task.title}</div>
                    {task.description && <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{task.description}</div>}
                  </td>
                  <td className="p-3"><Badge variant="outline">{task.columnTitle}</Badge></td>
                  <td className="p-3"><Badge variant={task.priority === 'high' || task.priority === 'urgent' ? 'destructive' : 'outline'}>{task.priority}</Badge></td>
                  <td className="p-3">{task.dueDate}</td>
                  <td className="p-3">
                    {(() => {
                      if (assignees.length > 0) {
                        return (
                          <div className="flex -space-x-2 overflow-hidden pl-1">
                            {assignees.slice(0, 3).map((person, index) => (
                              <TooltipProvider key={index}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Avatar className="h-8 w-8 border-2 border-background ring-2 ring-background">
                                      <AvatarImage src={(person as any).avatarUrl || (person as any).photoUrl} alt={person.name} />
                                      <AvatarFallback className="text-xs font-medium">
                                        {person.name?.split(' ').map((n, i, arr) => (i === 0 || i === arr.length - 1) ? n[0] : '').join('').toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{person.name}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                            {assignees.length > 3 && (
                              <div className="flex items-center justify-center h-8 w-8 rounded-full ring-2 ring-background bg-muted text-xs font-medium border-2 border-background">
                                +{assignees.length - 3}
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (assignee) {
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center pl-1">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs font-medium">
                                      {assignee.name?.split(' ').map((n, i, arr) => (i === 0 || i === arr.length - 1) ? n[0] : '').join('').toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{assignee.name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      }

                      return (
                        <div className="h-8 w-8 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center ml-1" title="Unassigned">
                          <User className="h-4 w-4 text-gray-400" />
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={() => onEditTask(task.id)}><List className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600" onClick={() => onDeleteTask(task.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface NewTasksTabProps {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id'>) => void;
  editTask: (id: string, task: Partial<Task>, options?: { suppressToast?: boolean }) => void;
  deleteTask: (id: string) => void;
  error?: Error | null;
  onRetry?: () => void;
  staffMembers: StaffMember[];
  objectives?: Objective[];
  setEditingTask: (task: Task | null) => void;
  setIsDialogOpen: (isOpen: boolean) => void;
  viewMode: ViewMode;
  buckets?: Bucket[];
  setBuckets?: React.Dispatch<React.SetStateAction<Bucket[]>>;
  addCustomGroup?: (project: Partial<Project>) => Promise<Project>;
  deleteCustomGroup?: (id: string) => Promise<void>;
  onRenameGroup?: (groupId: string, newTitle: string) => void;
  currentUnit?: string;
}

export const TasksTab: React.FC<NewTasksTabProps> = ({
  tasks,
  addTask,
  editTask,
  deleteTask,
  staffMembers,
  objectives,
  setEditingTask,
  setIsDialogOpen,
  viewMode,
  buckets,
  setBuckets,
  addCustomGroup,
  deleteCustomGroup,
  onRenameGroup,
  currentUnit
}) => {
  const [boardData, setBoardData] = useState<BoardData>({});
  // Use props if provided, otherwise local state (though mostly we expect props from Unit.tsx now)
  const [localBuckets, setLocalBuckets] = useState<Bucket[]>([]);

  const activeBuckets = buckets || localBuckets;
  const setActiveBuckets = setBuckets || setLocalBuckets;

  const [activeDragItem, setActiveDragItem] = useState<Task | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);
  const { toast } = useToast();
  const [isAddingGroup, setIsAddingGroup] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [isCreatingGroup, setIsCreatingGroup] = useState<boolean>(false);
  const [activeNewGroupId, setActiveNewGroupId] = useState<string | null>(null);
  const [insertAfterGroupId, setInsertAfterGroupId] = useState<string | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  const handleCreateFromTemplate = async (templateData: any) => {
    try {
      if (addCustomGroup) {
        // Create a new project group from template
        const newProject = {
          name: templateData.name,
          description: templateData.description,
          isCustomGroup: true,
          department: currentUnit,
          status: 'in-progress' as const,
        };

        await addCustomGroup(newProject);
        toast({ title: "Success", description: `${templateData.name} group created successfully.` });
        setShowTemplateDialog(false);
      } else {
        toast({ title: "Error", description: "Functionality not available", variant: "destructive" });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create group from template",
        variant: "destructive"
      });
    }
  };

  // Auto-scroll to new group
  useEffect(() => {
    if (activeNewGroupId) {
      // Small timeout to allow DOM to render
      const timer = setTimeout(() => {
        const element = document.getElementById(`board-lane-${activeNewGroupId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          // Flash effect or focus?
        }
        setActiveNewGroupId(null); // Reset
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeNewGroupId, activeBuckets]);

  /*
   * OPTIMISTIC UI STRATEGY:
   * We use a ref to track "pending" updates that haven't been confirmed by the backend (via props) yet.
   * When props (tasks) update, we verify if the backend has caught up.
   * If the backend task matches our optimistic one, we clear the pending state.
   * If the backend task is still old, we override it with our optimistic state to prevent "snap back".
   */
  const optimisticUpdates = useRef<Map<string, Task>>(new Map());

  useEffect(() => {
    // Initialize board data structure
    const newBoardData: BoardData = {};

    // Initialize items for all active buckets
    activeBuckets.forEach(bucket => {
      newBoardData[bucket.id] = [];
    });

    tasks.forEach(task => {
      // 0. Priority: External Unit Tasks (Shared)
      // If task is from another unit, force it to 'shared-tasks-virtual' if that bucket exists.
      // This catches tasks with OR without Project IDs.
      if (currentUnit && task.unit_id && task.unit_id !== currentUnit) {
        if (newBoardData['shared-tasks-virtual']) {
          newBoardData['shared-tasks-virtual'].push(task);
          return;
        }
      }

      // 1. Priority: Explicit Group (Project ID) assignment
      // This ensures that if a user manually assigns a Group, the task stays there regardless of Status
      if (task.projectId) {
        const projectBucket = activeBuckets.find(b => b.id === task.projectId);
        // Ensure the bucket exists in our board data (it should if it's in activeBuckets)
        if (projectBucket && newBoardData[projectBucket.id]) {
          newBoardData[projectBucket.id].push(task);
          return; // Successfully assigned to explicit group
        }

        // 🚨 Virtual Bucket Fallback:
        // If task has a projectId but the bucket is missing (e.g. shared from another unit),
        // and we have a 'Shared Projects' virtual bucket, put it there.
        if (newBoardData['shared-tasks-virtual']) {
          newBoardData['shared-tasks-virtual'].push(task);
          return;
        }
      }

      // 2. Fallback: Uncategorized (no project assignment)
      if (newBoardData['uncategorized-virtual']) {
        newBoardData['uncategorized-virtual'].push(task);
      } else {
        const firstBucketId = activeBuckets[0]?.id;
        if (firstBucketId && newBoardData[firstBucketId]) {
          newBoardData[firstBucketId].push(task);
        }
      }
    });

    // Apply Optimistic Overrides
    // This allows us to maintain the UI state even if the backend 'tasks' prop is stale
    optimisticUpdates.current.forEach((optimisticTask, taskId) => {
      // Find where the task currently is in our PROCESSED boardData (which came from stale props)
      let currentColumnId = '';
      let currentTaskIndex = -1;

      for (const [colId, tasks] of Object.entries(newBoardData)) {
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
          currentColumnId = colId;
          currentTaskIndex = idx;
          break;
        }
      }

      // If we found the task in stale data
      if (currentColumnId) {
        // Compare with optimistic expectation
        const intendedColumnId = optimisticTask.projectId || optimisticTask.status || ''; // Simplification

        // Actually, we trust optimisticTask.projectId matches the bucket ID we put it in.
        // We need to move it from currentColumnId to the optimistic column.

        // NOTE: In boardData logic above, we placed tasks based on their PROPS data.
        // So 'currentColumnId' is where the SERVER thinks it is.
        // We want to force it to where WE think it is.

        const targetColumnId = optimisticTask.projectId; // This should be the bucket ID

        if (targetColumnId && newBoardData[targetColumnId]) {
          // If server data matches optimistic data, we are good! Accessing props task...
          const serverTask = tasks.find(t => t.id === taskId);

          // Simple check: logic above placed it in 'currentColumnId'.
          // If currentColumnId === targetColumnId, then server has caught up!
          if (currentColumnId === targetColumnId) {
            // Server caught up. Remove from optimistic updates.
            optimisticUpdates.current.delete(taskId);
          } else {
            // Server is stale. Enforce optimistic position.

            // 1. Remove from where server placed it
            newBoardData[currentColumnId].splice(currentTaskIndex, 1);

            // 2. Add to where we want it
            // We use the optimisticTask object which has the updated projectId
            newBoardData[targetColumnId].push(optimisticTask);
          }
        }
      }
    });

    setBoardData(newBoardData);
  }, [tasks, activeBuckets, currentUnit]);

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveDragItem(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the task and its current column
    let sourceColumnId = '';
    let taskToMove: Task | undefined;

    // Scan boardData to find the task
    for (const [columnId, columnTasks] of Object.entries(boardData)) {
      const foundTask = columnTasks.find(t => t.id === activeId);
      if (foundTask) {
        sourceColumnId = columnId;
        taskToMove = foundTask;
        break;
      }
    }

    // If task not found or displayed in a way we can't track, abort
    if (!taskToMove || !sourceColumnId) {
      setActiveDragItem(null);
      return;
    }

    // Determine destination column
    let destinationColumnId = overId; // Default to assuming overId is a column ID

    // FIXED: Handle Group ID Prefix
    // Since we prefixed BoardLane IDs with 'group-' to avoid collision with Task IDs (which can be same string "10"),
    // we must check for that prefix here.
    const isGroupDrop = overId.startsWith('group-');
    if (isGroupDrop) {
      destinationColumnId = overId.replace(/^group-/, '');
    }

    // Determine if we are over a column directly
    // If it started with 'group-', it IS a column.
    // Otherwise check if it matches a known bucket ID (legacy/just in case)
    const isOverColumn = isGroupDrop || Object.keys(boardData).includes(overId) || activeBuckets.some(b => b.id === overId);

    if (!isOverColumn) {
      // Find which column this task belongs to (Dropping ONTO another task)
      for (const [colId, columnTasks] of Object.entries(boardData)) {
        if (columnTasks.find(t => t.id === overId)) {
          destinationColumnId = colId;
          break;
        }
      }
    }

    // Check if moved to a different column
    if (sourceColumnId !== destinationColumnId) {
      // 1. Optimistic Update: Update local state immediately
      const updatedTask = { ...taskToMove!, projectId: destinationColumnId };

      // Store in ref to persist across prop updates
      optimisticUpdates.current.set(activeId, updatedTask);

      setBoardData(prev => {
        const newData = { ...prev };

        // Remove from source
        newData[sourceColumnId] = newData[sourceColumnId].filter(t => t.id !== activeId);

        // Add to destination
        if (!newData[destinationColumnId]) {
          newData[destinationColumnId] = [];
        }

        // Add to new column
        newData[destinationColumnId] = [...newData[destinationColumnId], updatedTask];

        return newData;
      });

      // 2. Perform API Update
      // We do NOT await this, letting it happen in background.
      const performUpdate = async () => {
        try {
          await editTask(activeId, { projectId: destinationColumnId }, { suppressToast: true });

          // Success confirmed by backend
          const taskTitle = taskToMove?.title || 'Task';
          const destColumn = activeBuckets.find(b => b.id === destinationColumnId);
          const destTitle = destColumn?.title || 'new column';

          toast({
            title: "Task Moved",
            description: `Moved "${taskTitle}" to ${destTitle}`,
            action: (
              <ToastAction altText="Undo" onClick={() => editTask(activeId, { projectId: sourceColumnId }, { suppressToast: false })}>
                Undo
              </ToastAction>
            ),
          });

        } catch (error) {
          console.error("Failed to move task:", error);

          // ROLLBACK on failure
          toast({
            title: "Move Failed",
            description: `Cannot move "${taskToMove?.title || 'task'}" to this column. Reverting.`,
            variant: "destructive"
          });

          optimisticUpdates.current.delete(activeId);
          // Trigger a re-render from props effectively by clearing optimistic cache and maybe force update?
          // Simplest is to let next prop update fix it, or manually revert state.
          // For now, removing from optimistic map means next prop sync will put it back.
          // To see immediate revert, we would need to setBoardData again.
          setBoardData(prev => {
            // Revert logic is complex without full rebuild.
            // We can just rely on the next effect run or force one?
            // Let's manually put it back for immediate visual feedback.
            const rollbackData = { ...prev };
            if (rollbackData[destinationColumnId]) {
              rollbackData[destinationColumnId] = rollbackData[destinationColumnId].filter(t => t.id !== activeId);
            }
            if (!rollbackData[sourceColumnId] && taskToMove) {
              rollbackData[sourceColumnId] = [];
            }
            if (rollbackData[sourceColumnId]) {
              rollbackData[sourceColumnId] = [...rollbackData[sourceColumnId], taskToMove!];
            }
            return rollbackData;
          });
        }
      };

      performUpdate();

    } else {
      // Reordering within same column - handled by SortableContext sort of,
      // but we need to persist index if we supported manual sorting.
      // Current implementation seems to just sort by status/date in ListView,
      // BoardView uses boardData order.
      // If we want to support reordering, we'd need an 'order' field.
      // For now, just let it drop back.
    }

    setActiveDragItem(null);
  };



  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initialize scroll position to 0 (far left)
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [viewMode, activeBuckets.length]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    if (task) {
      setActiveDragItem(task);
    }
  };

  const handleCreateTask = () => {
    setEditingTask(null);
    setIsDialogOpen(true);
  };

  const handleEditTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setEditingTask(task);
      setIsDialogOpen(true);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setItemToDelete({ type: 'task', id: taskId, name: task.title });
    }
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;

    if (itemToDelete.type === 'task') {
      const taskId = itemToDelete.id;
      const taskName = itemToDelete.name;

      // Find the task and its current column for rollback
      let taskToDelete: Task | undefined;
      let sourceColumnId = '';

      for (const [columnId, columnTasks] of Object.entries(boardData)) {
        const foundTask = columnTasks.find(t => t.id === taskId);
        if (foundTask) {
          taskToDelete = foundTask;
          sourceColumnId = columnId;
          break;
        }
      }

      if (!taskToDelete || !sourceColumnId) {
        console.error('Task not found in boardData');
        setItemToDelete(null);
        return;
      }

      // STEP 1: Optimistic Update - Remove task from UI immediately
      setBoardData(prev => {
        const newData = { ...prev };
        newData[sourceColumnId] = newData[sourceColumnId].filter(t => t.id !== taskId);
        return newData;
      });

      // Close modal immediately
      setItemToDelete(null);

      // STEP 2: Perform API call in background
      const performDelete = async () => {
        try {
          await deleteTask(taskId);

          // STEP 3: Show success toast with Undo button
          toast({
            title: "Task Deleted",
            description: `"${taskName}" has been deleted.`,
            action: (
              <ToastAction
                altText="Undo deletion"
                onClick={() => {
                  // Restore the task to boardData
                  setBoardData(prev => {
                    const newData = { ...prev };
                    if (!newData[sourceColumnId]) {
                      newData[sourceColumnId] = [];
                    }
                    // Add task back to its original position
                    newData[sourceColumnId] = [...newData[sourceColumnId], taskToDelete!];
                    return newData;
                  });

                  toast({
                    title: "Deletion Undone",
                    description: `"${taskName}" has been restored.`,
                  });
                }}
              >
                Undo
              </ToastAction>
            ),
          });

        } catch (error) {
          console.error('Failed to delete task:', error);

          // STEP 4: Rollback on failure - Restore task to UI
          setBoardData(prev => {
            const newData = { ...prev };
            if (!newData[sourceColumnId]) {
              newData[sourceColumnId] = [];
            }
            newData[sourceColumnId] = [...newData[sourceColumnId], taskToDelete!];
            return newData;
          });

          // Show error toast
          toast({
            title: "Failed to Delete Task",
            description: `Could not delete "${taskName}". It has been restored.`,
            variant: "destructive",
          });
        }
      };

      performDelete();

    } else if (itemToDelete.type === 'group') {
      const groupId = itemToDelete.id;

      if (deleteCustomGroup) {
        try {
          await deleteCustomGroup(groupId);
        } catch (e) {
          console.error("Failed to delete group from backend", e);
          toast({ title: "Error", description: "Failed to delete group from server, but removing locally.", variant: "destructive" });
        }
      }

      setActiveBuckets(prev => prev.filter(b => b.id !== groupId));
      setBoardData(prev => {
        const newBoardData = { ...prev };
        delete newBoardData[groupId];
        return newBoardData;
      });

      setItemToDelete(null);
    }
  };


  const handleDeleteGroup = (groupId: string) => {
    const group = activeBuckets.find(b => b.id === groupId);
    if (group) {
      // Custom groups are now fully deletable
      setItemToDelete({ type: 'group', id: groupId, name: group.title });
    }
  };

  const handleSaveNewGroup = async () => {
    const trimmedName = newGroupName.trim();
    if (!trimmedName) return;

    setIsCreatingGroup(true);

    if (addCustomGroup) {
      try {
        // Calculate Order and Index
        let order = activeBuckets.length; // Default to end
        let insertIndex = activeBuckets.length;

        if (insertAfterGroupId) {
          const targetIndex = activeBuckets.findIndex(b => b.id === insertAfterGroupId);
          if (targetIndex !== -1) {
            insertIndex = targetIndex + 1;
            // For now, simple +1 to target order. Or re-index all?
            // Backend should handle complex re-ordering if needed.
            // Client side we just need to insert accurately for display.
            const targetGroup = activeBuckets[targetIndex];
            order = (targetGroup.order || targetIndex) + 1;
          }
        }

        const newProject = await addCustomGroup({
          name: trimmedName,
          isCustomGroup: true,
          status: 'in-progress',
          order: order
        });

        const newBucket: Bucket = { id: String(newProject.id), title: trimmedName, order: order };

        setActiveBuckets(prev => {
          const updated = [...prev];
          updated.splice(insertIndex, 0, newBucket);
          return updated;
        });

        setBoardData(prev => ({ ...prev, [newBucket.id]: [] }));

        // Trigger validation/scroll
        setActiveNewGroupId(newBucket.id);
        setIsAddingGroup(false);
        setNewGroupName('');
        setInsertAfterGroupId(null);
      } catch (e) {
        console.error("Failed to create group", e);
        toast({ title: "Error", description: "Failed to create group", variant: "destructive" });
        return; // Don't close dialog on error
      } finally {
        setIsCreatingGroup(false);
      }
    } else {
      // Fallback
      const newBucketId = `bucket-${Date.now()}`;
      const newBucket: Bucket = { id: newBucketId, title: trimmedName };

      // Handle insert locally
      let insertIndex = activeBuckets.length;
      if (insertAfterGroupId) {
        const targetIndex = activeBuckets.findIndex(b => b.id === insertAfterGroupId);
        if (targetIndex !== -1) insertIndex = targetIndex + 1;
      }

      setActiveBuckets(prev => {
        const updated = [...prev];
        updated.splice(insertIndex, 0, newBucket);
        return updated;
      });

      setBoardData(prev => ({ ...prev, [newBucketId]: [] }));

      setActiveNewGroupId(newBucketId);
      setIsAddingGroup(false);
      setNewGroupName('');
      setIsCreatingGroup(false);
      setInsertAfterGroupId(null);
    }
  };

  const handleCancelAddGroup = () => {
    setIsAddingGroup(false);
    setNewGroupName('');
    setInsertAfterGroupId(null);
  };

  const handleToggleComplete = (taskId: string, completed: boolean) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && completed && task.recurrence && task.recurrence !== 'none') {
      const now = new Date();
      let newStartDate: Date | undefined;
      let newDueDate: string | undefined;

      if (task.startDate) {
        const startDate = new Date(task.startDate);
        switch (task.recurrence) {
          case 'daily':
            newStartDate = addDays(startDate, 1);
            break;
          case 'weekly':
            newStartDate = addWeeks(startDate, 1);
            break;
          case 'monthly':
            newStartDate = addMonths(startDate, 1);
            break;
        }
      }

      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        switch (task.recurrence) {
          case 'daily':
            newDueDate = addDays(dueDate, 1).toISOString();
            break;
          case 'weekly':
            newDueDate = addWeeks(dueDate, 1).toISOString();
            break;
          case 'monthly':
            newDueDate = addMonths(dueDate, 1).toISOString();
            break;
        }
      }

      if (newStartDate) {
        const newTask: Omit<Task, 'id'> = {
          ...task,
          startDate: newStartDate,
          dueDate: newDueDate || '',
          completed: false,
        };
        addTask(newTask);
      }
    }
    // Toggle the 'completed' tag instead of status
    const currentTags = task?.tags || [];
    let newTags: string[];

    if (completed) {
      if (!currentTags.includes('completed')) {
        newTags = [...currentTags, 'completed'];
      } else {
        newTags = currentTags;
      }
    } else {
      newTags = currentTags.filter(t => t !== 'completed');
    }

    editTask(taskId, {
      completed,
      tags: newTags,
      // Only reset status to 'todo' if un-completing AND it was 'done'
      // Otherwise keep existing status so it stays in its column
      status: !completed && task?.status === 'done' ? 'todo' : task?.status
    });
  };

  const handleAssigneeChange = (taskId: string, assignee: StaffMember) => {
    if (!assignee || !assignee.email) {
      // Unassign
      editTask(taskId, { assignee: undefined, assignees: [] });
      return;
    }
    // For now, replacing the assignee. In future strict add/remove can be implemented.
    editTask(taskId, {
      assignee: assignee.email,
      assignees: [assignee]
    });
  };

  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 flex flex-col overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragEnd={handleDragEnd}
          onDragStart={handleDragStart}
        >
          <div className="flex-1 p-0 flex flex-col min-h-0 border-0 mx-0 mb-0 h-full">
            {viewMode === 'board' ? (
              <div className="flex flex-col h-full bg-background/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Tasks/Operations Section */}
                <div className="flex flex-col h-full">

                  {/* Fixed Header */}
                  <div className="p-4 shrink-0 space-y-0.5 border-b border-gray-100 dark:border-gray-800 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Tasks/Operations</h2>
                      <p className="text-muted-foreground">Manage daily tasks and operational workflows.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowTemplateDialog(true)}>
                      <LayoutGrid className="mr-2 h-4 w-4" />
                      Create from Template
                    </Button>
                  </div>

                  {/* Container Specific Scrollbar - Flex-1 to take remaining height */}
                  <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-x-auto overflow-y-auto kanban-scrollbar px-4 pb-4 pt-4 flex items-start space-x-6 w-full min-h-0 h-[calc(100vh-450px)]"
                  >
                    {activeBuckets.map(bucket => (
                      <div
                        key={bucket.id}
                        id={`board-lane-${bucket.id}`}
                        className="animate-in fade-in zoom-in-95 slide-in-from-right-4 duration-300 h-full"
                      >
                        <BoardLane
                          id={bucket.id}
                          title={bucket.title}
                          tasks={boardData[bucket.id] || []}
                          staffMembers={staffMembers}
                          onAddTask={handleCreateTask}
                          onEditTask={handleEditTask}
                          onEdit={() => { }}
                          onDeleteTask={handleDeleteTask}
                          onDeleteGroup={handleDeleteGroup}
                          onRenameGroup={onRenameGroup || ((id, title) => { })}
                          onToggleComplete={handleToggleComplete}
                          onPriorityChange={() => { }}
                          onAssigneeChange={handleAssigneeChange}
                          onStatusChange={() => { }}
                          dropTargetInfo={{ columnId: null, overItemId: null, isBottomHalf: false }}
                          onInsertAfter={(id) => {
                            setInsertAfterGroupId(id);
                            setIsAddingGroup(true);
                          }}
                        />
                      </div>
                    ))}

                    {isAddingGroup ? (
                      <div className="w-80 flex-shrink-0 animate-fade-in">
                        <div className="bg-muted/30 dark:bg-muted/20 rounded-lg p-3 h-full flex flex-col">
                          <Input
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="Group name"
                            autoFocus
                            className="mb-2"
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveNewGroup()}
                          />
                          <div className="flex space-x-2">
                            <Button size="sm" onClick={handleSaveNewGroup} className="flex-1" disabled={isCreatingGroup}>
                              {isCreatingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancelAddGroup} className="flex-1" disabled={isCreatingGroup}>Cancel</Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="h-[52px] flex-shrink-0 w-80 border-dashed bg-muted/20 dark:bg-muted/10 hover:bg-muted/30 dark:hover:bg-muted/20 text-muted-foreground"
                        onClick={() => setIsAddingGroup(true)}
                      >
                        <Plus className="mr-2 h-5 w-5" />
                        Add New Group
                      </Button>
                    )}
                  </div>
                </div>

              </div>
            ) : viewMode === 'grid' ? (
              <TaskGridView
                tasks={boardData}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onToggleComplete={handleToggleComplete}
                onPriorityChange={() => { }}
                onAssigneeChange={handleAssigneeChange}
                onStatusChange={() => { }}
                staffMembers={staffMembers}
              />
            ) : (
              <TaskListView
                tasks={boardData}
                buckets={activeBuckets}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onToggleComplete={handleToggleComplete}
                onPriorityChange={() => { }}
                onAssigneeChange={handleAssigneeChange}
                onStatusChange={() => { }}
                staffMembers={staffMembers}
              />
            )}
          </div>
          <DragOverlay>
            {activeDragItem ? (
              <div className="opacity-90 w-[280px] cursor-grabbing">
                <TaskCard
                  {...activeDragItem}
                  assignee={staffMembers.find(s => s.email === activeDragItem.assignee)}
                  isDragOverlay
                  className="shadow-2xl scale-105 rotate-2 cursor-grabbing"
                // Attempt to fix layout thrashing by maintaining dimensions?
                // TaskCard has internal sizing, but we can enforce width here if needed
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {itemToDelete?.type === 'task' ? 'Delete Task?' : 'Delete Group?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === 'task'
                ? <>This will permanently delete the task <strong>"{itemToDelete?.name}"</strong>.</>
                : <>This will permanently delete the group <strong>"{itemToDelete?.name}"</strong> and all its tasks.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteItem} className={buttonVariants({ variant: "destructive" })}>
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <GroupTemplateDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        onCreateFromTemplate={handleCreateFromTemplate}
      />
    </div>
  );
};
export default TasksTab;
