import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
}

interface ItemToDelete {
  type: 'task' | 'group';
  id: string;
  name?: string;
}

type BoardColumnId = string;
type ViewMode = 'board' | 'grid' | 'list';

export const initialBuckets: Bucket[] = [
  { id: 'todo', title: 'TO DO', isCustom: false },
  { id: 'in-progress', title: 'IN PROGRESS', isCustom: false },
  { id: 'review', title: 'REVIEW', isCustom: false },
  { id: 'done', title: 'DONE', isCustom: false }
];

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
  staffMembers
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
}) => {
  const { setNodeRef } = useDroppable({ id });
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
    <div className="w-80 flex-shrink-0 flex flex-col bg-muted/30 dark:bg-muted/20 rounded-lg overflow-hidden">
      <div className="p-3 font-medium flex items-center justify-between bg-muted/50 dark:bg-muted/30">
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
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="ml-2">{tasks.length}</Badge>
          <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => onEdit(id)}>
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={onAddTask}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => onDeleteGroup(id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div ref={setNodeRef} className="p-2 flex-grow overflow-y-auto min-h-[200px] space-y-3">
        <SortableContext items={incompleteTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="w-full">
        <thead>
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
                    // Improved mapping with fallback: match by ID or email (case-insensitive), fall back to original User object
                    const assignees = task.assignees?.map(a => {
                      const staffMatch = staffMembers.find(s =>
                        s.id?.toString() === a.id?.toString() ||
                        s.email?.toLowerCase() === a.email?.toLowerCase()
                      );
                      return staffMatch || a; // Fallback to original User object if no match
                    }) || [];

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
  );
};

interface NewTasksTabProps {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id'>) => void;
  editTask: (id: string, task: Partial<Task>) => void;
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
  const [localBuckets, setLocalBuckets] = useState(initialBuckets);

  const activeBuckets = buckets || localBuckets;
  const setActiveBuckets = setBuckets || setLocalBuckets;

  const [activeDragItem, setActiveDragItem] = useState<Task | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);
  const { toast } = useToast();
  const [isAddingGroup, setIsAddingGroup] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');

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
          return; // Successfully assigned to explicit group, skip status fallback
        }

        // 🚨 Virtual Bucket Fallback:
        // If task has a projectId but the bucket is missing (e.g. shared from another unit),
        // and we have a 'Shared Projects' virtual bucket, put it there.
        if (newBoardData['shared-tasks-virtual']) {
          newBoardData['shared-tasks-virtual'].push(task);
          return;
        }
      }

      // 2. Fallback: Status-based assignment
      // Only runs if no valid Group/Project is assigned
      if (!task.status) {
        // Fallback for tasks with no status and no group: put in first bucket (usually To Do)
        const firstBucketId = activeBuckets[0]?.id || 'todo';
        if (newBoardData[firstBucketId]) newBoardData[firstBucketId].push(task);
        return;
      }

      const status = task.status.toLowerCase().trim();
      let targetBucketId = 'todo';

      if (status === 'todo' || status === 'not started' || status === 'open' || status === 'to do') {
        targetBucketId = 'todo';
      } else if (status === 'in-progress' || status === 'in progress' || status === 'doing' || status === 'active') {
        targetBucketId = 'in-progress';
      } else if (status === 'review' || status === 'in review' || status === 'under review') {
        targetBucketId = 'review';
      } else if (status === 'done' || status === 'completed' || status === 'closed' || status === 'complete') {
        targetBucketId = 'done';
      } else {
        // Fallback: Check if status text matches a bucket ID directly
        if (newBoardData[status]) {
          targetBucketId = status;
        } else {
          // Final fallback
          targetBucketId = activeBuckets[0]?.id || 'todo';
        }
      }

      // Safeguard: ensure target bucket exists
      if (!newBoardData[targetBucketId]) {
        targetBucketId = activeBuckets[0]?.id || 'todo';
      }

      if (newBoardData[targetBucketId]) {
        newBoardData[targetBucketId].push(task);
      }
    });

    setBoardData(newBoardData);
  }, [tasks, activeBuckets]);

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const activeId = active.id as string;
      const overId = over.id as string;
      const activeTask = tasks.find(t => t.id === activeId);
      if (activeTask) {
        // Update the Group (projectId) only, keeping Status independent
        editTask(activeId, { projectId: overId });
      }
    }
    setActiveDragItem(null);
  };

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
    if (itemToDelete) {
      if (itemToDelete.type === 'task') {
        deleteTask(itemToDelete.id);
      } else if (itemToDelete.type === 'group') {
        const groupId = itemToDelete.id;

        // Check if it's a persistent group (not one of the initial buckets)
        const isDefaultBucket = initialBuckets.some(b => b.id === groupId);

        // If it looks like a SharePoint ID (numeric) and not a default bucket, delete from SP
        if (!isDefaultBucket && deleteCustomGroup) {
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
      }
      setItemToDelete(null);
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    const group = activeBuckets.find(b => b.id === groupId);
    if (group) {
      // Prevent deleting default buckets if desired, though UI allows it currently. 
      // For Safety:
      // if (initialBuckets.some(b => b.id === groupId)) return; 
      setItemToDelete({ type: 'group', id: groupId, name: group.title });
    }
  };

  const handleSaveNewGroup = async () => {
    const trimmedName = newGroupName.trim();
    if (!trimmedName) return;

    if (addCustomGroup) {
      try {
        // Optimistic update could be tricky if we need the real ID.
        // Better to wait for ID to ensure dragging tasks to it works with the correct persistent ID immediately.
        const newProject = await addCustomGroup({
          name: trimmedName,
          isCustomGroup: true,
          status: 'in-progress'
        });

        const newBucket: Bucket = { id: String(newProject.id), title: trimmedName };
        setActiveBuckets(prev => [...prev, newBucket]);
        setBoardData(prev => ({ ...prev, [newBucket.id]: [] }));
      } catch (e) {
        console.error("Failed to create group", e);
        toast({ title: "Error", description: "Failed to create group", variant: "destructive" });
        return; // Don't close dialog on error
      }
    } else {
      // Fallback
      const newBucketId = `bucket-${Date.now()}`;
      const newBucket: Bucket = { id: newBucketId, title: trimmedName };
      setActiveBuckets(prev => [...prev, newBucket]);
      setBoardData(prev => ({ ...prev, [newBucketId]: [] }));
    }

    setIsAddingGroup(false);
    setNewGroupName('');
  };

  const handleCancelAddGroup = () => {
    setIsAddingGroup(false);
    setNewGroupName('');
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
        <DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
          <div className="flex-1 p-4 overflow-auto max-h-[calc(100vh-220px)] border border-gray-200 dark:border-gray-700 rounded-lg mx-4 mb-4">
            {viewMode === 'board' ? (
              <div className="flex gap-8 h-full">
                {/* Tasks/Operations Section */}
                <div className="flex flex-col">
                  <div className="mb-4 shrink-0 space-y-0.5">
                    <h2 className="text-2xl font-bold tracking-tight">Tasks/Operations</h2>
                    <p className="text-muted-foreground">Manage daily tasks and operational workflows.</p>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="flex space-x-4 overflow-x-auto pb-4">
                      {activeBuckets.map(bucket => (
                        <BoardLane
                          key={bucket.id}
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
                        />
                      ))}
                    </div>
                    {isAddingGroup ? (
                      <div className="w-80 flex-shrink-0">
                        <div className="bg-muted/30 dark:bg-muted/20 rounded-lg p-3">
                          <Input
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="Group name"
                            autoFocus
                            className="mb-2"
                          />
                          <div className="flex space-x-2">
                            <Button size="sm" onClick={handleSaveNewGroup}>Save</Button>
                            <Button size="sm" variant="outline" onClick={handleCancelAddGroup}>Cancel</Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="h-auto flex-shrink-0 w-80 border-dashed py-3 bg-muted/20 dark:bg-muted/10 hover:bg-muted/30 dark:hover:bg-muted/20"
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
            {activeDragItem ? <TaskCard {...activeDragItem} assignee={staffMembers.find(s => s.email === activeDragItem.assignee)} isDragOverlay /> : null}
          </DragOverlay>
        </DndContext>
      </main>
      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === 'task'
                ? `This will permanently delete the task "${itemToDelete?.name}".`
                : `This will permanently delete the group "${itemToDelete?.name}" and all its tasks.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteItem} className={buttonVariants({ variant: "destructive" })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
export default TasksTab;
