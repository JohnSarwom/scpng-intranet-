import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  MoreVertical,
  Loader2,
  Maximize2,
  Minimize2,
  CheckCircle,
  Circle,
  Check,
  X,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import TaskCard from '@/components/unit-tabs/TaskCard';
import TaskDialog from '@/components/unit-tabs/TaskDialog';
import { StaffMember } from '@/types/staff';
import { Objective, Kra, Kpi, Task, Project } from '@/types';
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
  onAssigneesChange,
  onStatusChange,
  dropTargetInfo,
  staffMembers,
  onInsertAfter,
  container
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
  onAssigneesChange?: (id: string, assignees: StaffMember[]) => void;
  onStatusChange: (id: string, status: string) => void;
  dropTargetInfo: {
    columnId: string | null;
    overItemId: string | null;
    isBottomHalf: boolean;
  };
  staffMembers: StaffMember[];
  onInsertAfter: (groupId: string) => void;
  container?: HTMLElement | null;
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
            <DropdownMenuContent align="end" container={container}>
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
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700/50 rounded-lg flex flex-col items-center justify-center p-6 text-center h-full min-h-[150px]">
              <Kanban className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground/50 mb-3">No tasks in this group</p>
              <Button
                variant="outline"
                size="sm"
                onClick={onAddTask}
                className="pointer-events-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Task
              </Button>
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
                onAssigneesChange={onAssigneesChange}
                onStatusChange={onStatusChange}
                availableAssignees={staffMembers}
                container={container}
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
                      onAssigneesChange={onAssigneesChange}
                      onStatusChange={onStatusChange}
                      availableAssignees={staffMembers}
                      container={container}
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
  onAssigneesChange?: (id: string, assignees: StaffMember[]) => void;
  onStatusChange: (id: string, status: string) => void;
  staffMembers: StaffMember[];
  container?: HTMLElement | null;
}> = ({ tasks, onEditTask, onDeleteTask, onToggleComplete, onPriorityChange, onAssigneeChange, onAssigneesChange, onStatusChange, staffMembers, container }) => {
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
            onAssigneesChange={onAssigneesChange}
            onStatusChange={onStatusChange}
            container={container}
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
  container?: HTMLElement | null;
}> = ({ tasks, buckets, onEditTask, onDeleteTask, onToggleComplete, onPriorityChange, onAssigneeChange, onStatusChange, staffMembers, container }) => {
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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden h-full flex flex-col">
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
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 p-0 text-muted-foreground hover:text-primary"
                            onClick={() => onToggleComplete(task.id, !task.completed)}
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              {task.completed ? (
                                <motion.div
                                  key="check"
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                >
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="circle"
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <Circle className="h-4 w-4" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent container={container}>
                          <p>{task.completed ? 'Mark as incomplete' : 'Mark as complete'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
                                  <TooltipContent container={container}>
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
                              <TooltipContent container={container}>
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
  addTask: (task: Omit<Task, 'id'>) => Promise<Task | boolean | void> | void;
  editTask: (id: string, task: Partial<Task>, options?: { suppressToast?: boolean }) => Promise<void | boolean> | void;
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
  setPreselectedGroup?: (groupId: string | null) => void;
  isDialogOpen: boolean;
  editingTask: Task | null;
  preselectedGroup?: string | null;
  currentUserEmail?: string;
  kras: Kra[];
  kpis: Kpi[];
  setViewMode?: (mode: ViewMode) => void;
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
  currentUnit,
  setPreselectedGroup,
  isDialogOpen,
  editingTask,
  preselectedGroup,
  currentUserEmail,
  kras,
  kpis,
  setViewMode
}) => {
  const [boardData, setBoardData] = useState<BoardData>({});
  // Use props if provided, otherwise local state (though mostly we expect props from Unit.tsx now)
  const [localBuckets, setLocalBuckets] = useState<Bucket[]>([]);

  const activeBuckets = buckets || localBuckets;
  const setActiveBuckets = setBuckets || setLocalBuckets;

  // Local search state for full-screen mode
  const [searchQuery, setSearchQuery] = useState('');

  const [activeDragItem, setActiveDragItem] = useState<Task | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);
  const { toast } = useToast();
  const [isAddingGroup, setIsAddingGroup] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [isCreatingGroup, setIsCreatingGroup] = useState<boolean>(false);
  const [activeNewGroupId, setActiveNewGroupId] = useState<string | null>(null);

  const [insertAfterGroupId, setInsertAfterGroupId] = useState<string | null>(null);

  // Filter States
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);



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
    // 0. Filter tasks based on search query AND filters
    let tasksToProcess = tasks;

    // Search Query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      tasksToProcess = tasksToProcess.filter(t =>
        t.title?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.assignee?.toLowerCase().includes(query) ||
        t.assignees?.some(a => a.name?.toLowerCase().includes(query) || a.email?.toLowerCase().includes(query))
      );
    }

    // Priority Filter
    if (selectedPriorities.length > 0) {
      tasksToProcess = tasksToProcess.filter(t => selectedPriorities.includes(t.priority));
    }

    // Status Filter
    if (selectedStatuses.length > 0) {
      tasksToProcess = tasksToProcess.filter(t => selectedStatuses.includes(t.status));
    }

    // Assignee Filter
    if (selectedAssignees.length > 0) {
      tasksToProcess = tasksToProcess.filter(t =>
        (t.assignee && selectedAssignees.includes(t.assignee)) ||
        (t.assignees?.some(a => selectedAssignees.includes(a.email || '')))
      );
    }

    // Group Filter
    if (selectedGroups.length > 0) {
      tasksToProcess = tasksToProcess.filter(t => t.projectId && selectedGroups.includes(t.projectId));
    }

    // Initialize board data structure
    const newBoardData: BoardData = {};

    // Initialize items for all active buckets
    activeBuckets.forEach(bucket => {
      newBoardData[bucket.id] = [];
    });

    // 🛡️ DEDUPLICATION GUARD
    // Filter out duplicate tasks (same ID) which cause critical drag-and-drop bugs (ghosting, auto-migration)
    const uniqueTasks = new Map<string, Task>();
    const duplicateIds = new Set<string>();

    tasksToProcess.forEach(task => {
      if (uniqueTasks.has(task.id)) {
        duplicateIds.add(task.id);
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[TasksTab] Duplicate task ID ignored: ${task.id} ("${task.title}")`);
        }
      } else {
        uniqueTasks.set(task.id, task);
      }
    });

    if (duplicateIds.size > 0) {
      console.error(`[TasksTab] Found ${duplicateIds.size} duplicate task IDs. Duplicates removed to prevent bugs.`);
    }

    const processedTasks = Array.from(uniqueTasks.values());

    // Clean up stale optimistic updates for tasks that no longer exist
    // This prevents "zombie" tasks from persisting or moving unexpectedly
    const currentTaskIds = new Set(uniqueTasks.keys());
    optimisticUpdates.current.forEach((_, id) => {
      if (!currentTaskIds.has(id)) {
        optimisticUpdates.current.delete(id);
      }
    });

    processedTasks.forEach(task => {
      // 1. Priority: Explicit Group (Project ID) assignment
      // MOVED TO TOP: This ensures that if a user manually assigns a Group, the task stays there regardless of Status or Unit.
      if (task.projectId) {
        const projectBucket = activeBuckets.find(b => b.id === task.projectId);

        // Ensure the bucket exists in our board data (it should if it's in activeBuckets)
        if (projectBucket && newBoardData[projectBucket.id]) {
          newBoardData[projectBucket.id].push(task);
          return; // Successfully assigned to explicit group
        } else {
          console.log(`⚠️ [TasksTab] Orphaned Project: Task '${task.title}' has projectId '${task.projectId}' but bucket not found or active. Active Buckets:`, activeBuckets.map(b => b.id));
        }

        // 🚨 Virtual Bucket Fallback:
        // If task has a projectId but the bucket is missing (e.g. shared from another unit),
        // and we have a 'Shared Projects' virtual bucket, put it there.
        // 🔒 SHARED GROUP FIX: Only if NOT created by me
        const isCreatedByMe = currentUserEmail && (
          task.createdByEmail?.toLowerCase() === currentUserEmail.toLowerCase() ||
          task.authorEmail?.toLowerCase() === currentUserEmail.toLowerCase()
        );

        if (newBoardData['shared-tasks-virtual'] && !isCreatedByMe) {
          newBoardData['shared-tasks-virtual'].push(task);
          return;
        }
      }

      // 0. Priority: External Unit Tasks (Shared)
      // If task is from another unit, force it to 'shared-tasks-virtual' if that bucket exists.
      // This catches tasks with OR without Project IDs.
      if (currentUnit && task.unit_id && task.unit_id !== currentUnit) {
        console.log(`🔍 [TasksTab] Shared Task Detected: Task '${task.title}' (ID: ${task.id}) unit '${task.unit_id}' !== current '${currentUnit}'`);

        // 🔒 SHARED GROUP FIX: Only if NOT created by me
        const isCreatedByMe = currentUserEmail && (
          task.createdByEmail?.toLowerCase() === currentUserEmail.toLowerCase() ||
          task.authorEmail?.toLowerCase() === currentUserEmail.toLowerCase()
        );

        if (newBoardData['shared-tasks-virtual'] && !isCreatedByMe) {
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
          // If server data matches optimistic data, we are good! Accessing props task...
          const serverTask = tasks.find(t => t.id === taskId);

          // Check if server has caught up with specific fields we are optimistic about
          const matches = serverTask &&
            (optimisticTask.priority ? serverTask.priority === optimisticTask.priority : true) &&
            (optimisticTask.status ? serverTask.status === optimisticTask.status : true) &&
            currentColumnId === targetColumnId;

          if (matches) {
            // Server caught up. Remove from optimistic updates.
            optimisticUpdates.current.delete(taskId);
          } else {
            // Server is stale or task moved. Enforce optimistic position/state.

            // 1. Remove from where server placed it
            if (newBoardData[currentColumnId]) { // Safety check
              const idx = newBoardData[currentColumnId].findIndex(t => t.id === taskId);
              if (idx !== -1) newBoardData[currentColumnId].splice(idx, 1);
            }

            // 2. Add to where we want it with UPDATED properties
            // We use the optimisticTask object which has the updated properties
            if (!newBoardData[targetColumnId]) newBoardData[targetColumnId] = [];
            newBoardData[targetColumnId].push(optimisticTask);
          }
        }
      }
    });

    setBoardData(newBoardData);
  }, [tasks, activeBuckets, currentUnit, searchQuery, selectedPriorities, selectedStatuses, selectedAssignees, selectedGroups]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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
        // Create a deep copy of the board data to prevent state mutation
        const newData: BoardData = {};

        // Deep copy each column's task array
        Object.keys(prev).forEach(columnId => {
          newData[columnId] = [...prev[columnId]];
        });

        // Remove from source column
        newData[sourceColumnId] = newData[sourceColumnId].filter(t => t.id !== activeId);

        // Ensure destination column exists
        if (!newData[destinationColumnId]) {
          newData[destinationColumnId] = [];
        }

        // Add to destination column
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
            // Create a deep copy for rollback to prevent state mutation
            const rollbackData: BoardData = {};

            // Deep copy each column's task array
            Object.keys(prev).forEach(columnId => {
              rollbackData[columnId] = [...prev[columnId]];
            });

            // Remove from destination column
            if (rollbackData[destinationColumnId]) {
              rollbackData[destinationColumnId] = rollbackData[destinationColumnId].filter(t => t.id !== activeId);
            }

            // Add back to source column
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

  const handleCreateTask = (groupId?: string) => {
    setEditingTask(null);
    if (setPreselectedGroup && groupId) {
      setPreselectedGroup(groupId);
    } else if (setPreselectedGroup) {
      setPreselectedGroup(null);
    }
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
        // Create a deep copy to prevent state mutation
        const newData: BoardData = {};
        Object.keys(prev).forEach(columnId => {
          newData[columnId] = [...prev[columnId]];
        });
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
                    // Create a deep copy for undo action
                    const newData: BoardData = {};
                    Object.keys(prev).forEach(columnId => {
                      newData[columnId] = [...prev[columnId]];
                    });
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
            // Create a deep copy for rollback
            const newData: BoardData = {};
            Object.keys(prev).forEach(columnId => {
              newData[columnId] = [...prev[columnId]];
            });
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
    // 1. Find the task in boardData to get current state
    let task: Task | undefined;
    Object.values(boardData).forEach(col => {
      const found = col.find(t => t.id === taskId);
      if (found) task = found;
    });

    if (!task) return;

    const originalTask = { ...task };

    // 2. Logic for recurrence (kept from original)
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

    // 3. Calculate new tags and status
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

    const newStatus = !completed && (task?.status === 'completed' || task?.status === 'done') ? 'todo' : task?.status;

    // 4. Create Optimistic Update
    const updatedTask = {
      ...task,
      completed,
      tags: newTags,
      status: newStatus
    };

    optimisticUpdates.current.set(taskId, updatedTask);

    // 5. Force Local Update Immediately
    setBoardData(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        next[key] = next[key].map(t => t.id === taskId ? updatedTask : t);
      });
      return next;
    });

    // 6. Immediate Success Toast
    toast({
      title: completed ? "Task Completed" : "Task Reopened",
      description: completed ? "Task has been marked as complete." : "Task has been marked as incomplete."
    });

    // 7. Persist with Rollback
    Promise.resolve(editTask(taskId, {
      completed,
      tags: newTags,
      status: newStatus
    }, { suppressToast: true }))
      .catch((error) => {
        console.error("Failed to toggle completion", error);
        // Rollback
        optimisticUpdates.current.delete(taskId);
        setBoardData(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(key => {
            next[key] = next[key].map(t => t.id === taskId ? originalTask : t);
          });
          return next;
        });
        toast({ title: "Update Failed", description: "Could not update task status. Changes reverted.", variant: "destructive" });
      });
  };

  const handleAssigneeChange = (taskId: string, assignee: StaffMember) => {
    // 1. Find the current task
    let task: Task | undefined;
    Object.values(boardData).forEach(col => {
      const found = col.find(t => t.id === taskId);
      if (found) task = found;
    });

    if (!task) return;

    const originalTask = { ...task };

    // Prepare updates
    let updates: Partial<Task> = {};
    const assigneeName = assignee?.name || assignee?.email || "Unknown";

    if (!assignee || !assignee.email) {
      updates = { assignee: undefined, assignees: [] };
    } else {
      updates = { assignee: assignee.email, assignees: [assignee] };
    }

    // 2. Create optimistic update
    const updatedTask = { ...task, ...updates };
    optimisticUpdates.current.set(taskId, updatedTask);

    // 3. Force local update immediately
    setBoardData(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        next[key] = next[key].map(t => t.id === taskId ? updatedTask : t);
      });
      return next;
    });

    // 4. Immediate Success Toast
    toast({
      title: "Assignee Updated",
      description: assignee && assignee.email ? `Task assigned to ${assigneeName}` : "Task unassigned"
    });

    // 5. Persist with Rollback
    Promise.resolve(editTask(taskId, updates, { suppressToast: true }))
      .catch((error) => {
        console.error("Failed to update assignee", error);
        // Rollback
        optimisticUpdates.current.delete(taskId);
        setBoardData(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(key => {
            next[key] = next[key].map(t => t.id === taskId ? originalTask : t);
          });
          return next;
        });
        toast({ title: "Update Failed", description: "Could not update assignee. Changes reverted.", variant: "destructive" });
      });
  };

  const handleAssigneesChange = (taskId: string, assignees: StaffMember[]) => {
    // 1. Find the current task
    let task: Task | undefined;
    Object.values(boardData).forEach(col => {
      const found = col.find(t => t.id === taskId);
      if (found) task = found;
    });

    if (!task) return;

    const originalTask = { ...task };

    // Prepare updates
    let updates: Partial<Task> = {};
    if (!assignees || assignees.length === 0) {
      updates = { assignee: undefined, assignees: [] };
    } else {
      updates = { assignee: assignees[0].email, assignees: assignees };
    }

    // 2. Create optimistic update
    const updatedTask = { ...task, ...updates };
    optimisticUpdates.current.set(taskId, updatedTask);

    // 3. Force local update immediately
    setBoardData(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        next[key] = next[key].map(t => t.id === taskId ? updatedTask : t);
      });
      return next;
    });

    // 4. Immediate Success Toast
    toast({
      title: "Assignees Updated",
      description: "Task assignees have been updated."
    });

    // 5. Persist with Rollback
    Promise.resolve(editTask(taskId, updates, { suppressToast: true }))
      .catch((error) => {
        console.error("Failed to update assignees", error);
        // Rollback
        optimisticUpdates.current.delete(taskId);
        setBoardData(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(key => {
            next[key] = next[key].map(t => t.id === taskId ? originalTask : t);
          });
          return next;
        });
        toast({ title: "Update Failed", description: "Could not update assignees. Changes reverted.", variant: "destructive" });
      });
  };

  const handlePriorityChange = (taskId: string, priority: 'low' | 'medium' | 'high' | 'urgent') => {
    // 1. Find the current task
    let task: Task | undefined;
    Object.values(boardData).forEach(col => {
      const found = col.find(t => t.id === taskId);
      if (found) task = found;
    });

    if (!task) return;

    const originalTask = { ...task };

    // 2. Create optimistic update
    const updatedTask = { ...task, priority };
    optimisticUpdates.current.set(taskId, updatedTask);

    // 3. Force local update immediately
    setBoardData(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        next[key] = next[key].map(t => t.id === taskId ? updatedTask : t);
      });
      return next;
    });

    // 4. Immediate Success Toast
    toast({
      title: "Priority Updated",
      description: `Task priority set to ${priority}.`
    });

    // 5. Persist with Rollback
    Promise.resolve(editTask(taskId, { priority }, { suppressToast: true }))
      .catch((error) => {
        console.error("Failed to update priority", error);
        // Rollback
        optimisticUpdates.current.delete(taskId);
        setBoardData(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(key => {
            next[key] = next[key].map(t => t.id === taskId ? originalTask : t);
          });
          return next;
        });
        toast({ title: "Update Failed", description: "Could not update priority. Changes reverted.", variant: "destructive" });
      });
  };

  const handleStatusChange = (taskId: string, status: string) => {
    // 1. Find the current task
    let task: Task | undefined;
    Object.values(boardData).forEach(col => {
      const found = col.find(t => t.id === taskId);
      if (found) task = found;
    });

    if (!task) return;

    const originalTask = { ...task };

    // 2. Create optimistic update
    const updatedTask = { ...task, status: status as Task['status'] };
    optimisticUpdates.current.set(taskId, updatedTask);

    // 3. Force local update immediately
    setBoardData(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        next[key] = next[key].map(t => t.id === taskId ? updatedTask : t);
      });
      return next;
    });

    // 4. Immediate Success Toast
    // Map status to user-friendly text
    const statusLabel = status === 'todo' ? 'To Do'
      : status === 'in-progress' ? 'In Progress'
        : status === 'on-hold' ? 'On Hold'
          : status === 'in-review' || status === 'review' ? 'In Review'
            : 'Completed';
    toast({
      title: "Status Updated",
      description: `Task moved to ${statusLabel}.`
    });

    // 5. Persist with Rollback
    Promise.resolve(editTask(taskId, { status: status as Task['status'] }, { suppressToast: true }))
      .catch((error) => {
        console.error("Failed to update status", error);
        // Rollback
        optimisticUpdates.current.delete(taskId);
        setBoardData(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(key => {
            next[key] = next[key].map(t => t.id === taskId ? originalTask : t);
          });
          return next;
        });
        toast({ title: "Update Failed", description: "Could not update status. Changes reverted.", variant: "destructive" });
      });
  };

  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 flex flex-col overflow-hidden">
        <div
          ref={containerRef}
          className={cn(
            "flex flex-col bg-background/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden",
            isFullScreen ? "bg-background p-4 h-full" : "h-full"
          )}
        >
          {/* Fixed Header - Common for all views */}
          <div className="p-4 shrink-0 space-y-0.5 border-b border-gray-100 dark:border-gray-800 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Tasks/Operations</h2>
              <p className="text-muted-foreground">Manage daily tasks and operational workflows.</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Full Screen Controls */}
              {isFullScreen && (
                <>
                  <Input
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-[200px] h-8"
                  />
                  <div className="flex items-center gap-1 border-r pr-2 mr-2">
                    <Button
                      variant={viewMode === 'board' ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setViewMode?.('board')}
                      title="Board View"
                    >
                      <Kanban className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setViewMode?.('list')}
                      title="List View"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>

                  <Button size="sm" onClick={() => handleCreateTask()} className="h-8">
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Task
                  </Button>
                </>
              )}

              <Button variant="ghost" size="icon" onClick={toggleFullscreen} title={isFullScreen ? "Exit Full Screen" : "Full Screen"}>
                {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={selectedPriorities.length + selectedStatuses.length + selectedAssignees.length + selectedGroups.length > 0 ? "bg-accent text-accent-foreground border-primary" : ""}>
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                    {(selectedPriorities.length + selectedStatuses.length + selectedAssignees.length + selectedGroups.length) > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                        {selectedPriorities.length + selectedStatuses.length + selectedAssignees.length + selectedGroups.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[300px] p-0 overflow-hidden" container={(isFullScreen && containerRef.current) || undefined}>
                  <DropdownMenuLabel className="flex items-center justify-between p-3 border-b bg-muted/20">
                    Filters
                    {(selectedPriorities.length + selectedStatuses.length + selectedAssignees.length + selectedGroups.length) > 0 && (
                      <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground" onClick={() => {
                        setSelectedPriorities([]);
                        setSelectedStatuses([]);
                        setSelectedAssignees([]);
                        setSelectedGroups([]);
                      }}>
                        Clear all
                      </Button>
                    )}
                  </DropdownMenuLabel>
                  <div className="max-h-[60vh] overflow-y-auto kanban-scrollbar p-1">
                    <DropdownMenuSeparator />

                    {/* Priority Section */}
                    <div className="p-2">
                      <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Priority</div>
                      {['low', 'medium', 'high', 'urgent'].map(priority => (
                        <div key={priority} className="flex items-center space-x-2 mb-1">
                          <Checkbox
                            id={`filter-priority-${priority}`}
                            checked={selectedPriorities.includes(priority)}
                            onCheckedChange={(checked) => {
                              if (checked) setSelectedPriorities([...selectedPriorities, priority]);
                              else setSelectedPriorities(selectedPriorities.filter(p => p !== priority));
                            }}
                          />
                          <label htmlFor={`filter-priority-${priority}`} className="text-sm capitalize cursor-pointer flex-1">{priority}</label>
                        </div>
                      ))}
                    </div>
                    <DropdownMenuSeparator />

                    {/* Status Section */}
                    <div className="p-2">
                      <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Status</div>
                      {['todo', 'in-progress', 'on-hold', 'in-review', 'completed'].map(status => (
                        <div key={status} className="flex items-center space-x-2 mb-1">
                          <Checkbox
                            id={`filter-status-${status}`}
                            checked={selectedStatuses.includes(status)}
                            onCheckedChange={(checked) => {
                              if (checked) setSelectedStatuses([...selectedStatuses, status]);
                              else setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                            }}
                          />
                          <label htmlFor={`filter-status-${status}`} className="text-sm capitalize cursor-pointer flex-1">
                            {status === 'todo' ? 'To Do'
                              : status === 'in-progress' ? 'In Progress'
                                : status === 'on-hold' ? 'On Hold'
                                  : status === 'in-review' ? 'In Review'
                                    : 'Completed'}
                          </label>
                        </div>
                      ))}
                    </div>
                    <DropdownMenuSeparator />

                    {/* Groups Section */}
                    {activeBuckets.length > 0 && (
                      <>
                        <div className="p-2">
                          <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Groups</div>
                          <div className="space-y-1">
                            {activeBuckets.map(bucket => (
                              <div key={bucket.id} className="flex items-center space-x-2 mb-1">
                                <Checkbox
                                  id={`filter-group-${bucket.id}`}
                                  checked={selectedGroups.includes(bucket.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) setSelectedGroups([...selectedGroups, bucket.id]);
                                    else setSelectedGroups(selectedGroups.filter(g => g !== bucket.id));
                                  }}
                                />
                                <label htmlFor={`filter-group-${bucket.id}`} className="text-sm cursor-pointer flex-1 truncate">{bucket.title}</label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <DropdownMenuSeparator />
                      </>
                    )}

                    {staffMembers.length > 0 && (
                      <div className="p-2">
                        <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Assignees</div>
                        <div className="space-y-1">
                          {staffMembers.map(staff => (
                            <div key={staff.email} className="flex items-center space-x-2 mb-1">
                              <Checkbox
                                id={`filter-assignee-${staff.email}`}
                                checked={selectedAssignees.includes(staff.email)}
                                onCheckedChange={(checked) => {
                                  if (checked) setSelectedAssignees([...selectedAssignees, staff.email]);
                                  else setSelectedAssignees(selectedAssignees.filter(a => a !== staff.email));
                                }}
                              />
                              <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={staff.avatarUrl || staff.photoUrl} />
                                  <AvatarFallback className="text-[9px]">{staff.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <label htmlFor={`filter-assignee-${staff.email}`} className="text-sm cursor-pointer truncate">{staff.name}</label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
          >
            <div className="flex-1 p-0 flex flex-col min-h-0 border-0 mx-0 mb-0 h-full overflow-hidden">
              {viewMode === 'board' ? (
                // Board View
                <div
                  ref={scrollContainerRef}
                  className="flex-1 overflow-x-auto overflow-y-auto kanban-scrollbar px-4 pb-4 pt-4 flex items-start space-x-6 w-full h-full"
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
                        onAddTask={() => handleCreateTask(bucket.id)}
                        onEditTask={handleEditTask}
                        onEdit={() => { }}
                        onDeleteTask={handleDeleteTask}
                        onDeleteGroup={handleDeleteGroup}
                        onRenameGroup={onRenameGroup || ((id, title) => { })}
                        onToggleComplete={handleToggleComplete}
                        onPriorityChange={handlePriorityChange}
                        onAssigneeChange={handleAssigneeChange}
                        onAssigneesChange={handleAssigneesChange}
                        onStatusChange={handleStatusChange}
                        dropTargetInfo={{ columnId: null, overItemId: null, isBottomHalf: false }}
                        onInsertAfter={(id) => {
                          setInsertAfterGroupId(id);
                          setIsAddingGroup(true);
                        }}
                        container={isFullScreen ? containerRef.current : null}
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
              ) : viewMode === 'grid' ? (
                // Grid View
                <div className="flex-1 overflow-y-auto p-4">
                  <TaskGridView
                    tasks={boardData}
                    onEditTask={handleEditTask}
                    onDeleteTask={handleDeleteTask}
                    onToggleComplete={handleToggleComplete}
                    onPriorityChange={handlePriorityChange}
                    onAssigneeChange={handleAssigneeChange}
                    onAssigneesChange={handleAssigneesChange}
                    onStatusChange={handleStatusChange}
                    staffMembers={staffMembers}
                    container={isFullScreen ? containerRef.current : null}
                  />
                </div>
              ) : (
                // List View
                <div className="flex-1 h-full p-4 overflow-hidden">
                  <TaskListView
                    tasks={boardData}
                    buckets={activeBuckets}
                    onEditTask={handleEditTask}
                    onDeleteTask={handleDeleteTask}
                    onToggleComplete={handleToggleComplete}
                    onPriorityChange={handlePriorityChange}
                    onAssigneeChange={handleAssigneeChange}
                    onStatusChange={handleStatusChange}
                    staffMembers={staffMembers}
                    container={isFullScreen ? containerRef.current : null}
                  />
                </div>
              )}

              {isFullScreen && containerRef.current ? createPortal(
                <DragOverlay>
                  {activeDragItem ? (
                    <div className="opacity-90 w-[280px] cursor-grabbing">
                      <TaskCard
                        {...activeDragItem}
                        assignee={staffMembers?.find(s => s.email === activeDragItem.assignee)}
                        isDragOverlay
                        className="shadow-2xl scale-105 rotate-2 cursor-grabbing"
                      />
                    </div>
                  ) : null}
                </DragOverlay>,
                containerRef.current
              ) : (
                <DragOverlay>
                  {activeDragItem ? (
                    <div className="opacity-90 w-[280px] cursor-grabbing">
                      <TaskCard
                        {...activeDragItem}
                        assignee={staffMembers?.find(s => s.email === activeDragItem.assignee)}
                        isDragOverlay
                        className="shadow-2xl scale-105 rotate-2 cursor-grabbing"
                      />
                    </div>
                  ) : null}
                </DragOverlay>
              )}
            </div>
          </DndContext>
        </div>
      </main>

      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent container={isFullScreen ? containerRef.current : null}>
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
      {/* GroupTemplateDialog removed */}
      <TaskDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        initialData={editingTask || undefined}
        buckets={activeBuckets}
        defaultGroup={preselectedGroup || (activeBuckets.length > 0 ? activeBuckets[0].id : null)}
        staffMembers={staffMembers}
        container={isFullScreen ? containerRef.current : null}
        kras={kras}
        kpis={kpis}
        onSubmit={async (taskData) => {
          if (editingTask) {
            await editTask(editingTask.id, taskData);
            setIsDialogOpen(false);
          } else {
            // Create new task with optimistic UI
            let targetProjectId = undefined;

            if (preselectedGroup) {
              targetProjectId = preselectedGroup;
            } else if (activeBuckets.length > 0) {
              targetProjectId = activeBuckets[0].id;
            }

            const newTaskData = {
              title: taskData.title || '',
              description: taskData.description || '',
              status: taskData.status || 'todo',
              priority: taskData.priority || 'medium',
              dueDate: taskData.dueDate,
              startDate: taskData.startDate,
              assignee: taskData.assignee,
              assignees: taskData.assignees,
              projectId: taskData.projectId || targetProjectId,
              tags: taskData.tags || [],
              kra_id: taskData.kra_id,
              kpi_id: taskData.kpi_id,
              subtasks: taskData.subtasks,
              recurrence: taskData.recurrence,
              unit_id: currentUnit,
            };

            // Close dialog immediately for snappy UX
            setIsDialogOpen(false);

            // Create a temporary optimistic task for instant board rendering
            const tempId = `temp-${Date.now()}`;
            const optimisticTask: Task = {
              ...newTaskData,
              id: tempId,
              completed: false,
              dueDate: newTaskData.dueDate || '',
              status: (newTaskData.status || 'todo') as Task['status'],
              priority: (newTaskData.priority || 'medium') as Task['priority'],
            };

            // Add to board immediately
            const columnId = optimisticTask.projectId || 'uncategorized-virtual';
            setBoardData(prev => {
              const next = { ...prev };
              if (next[columnId]) {
                next[columnId] = [...next[columnId], optimisticTask];
              } else {
                // Fallback to first bucket
                const firstBucket = activeBuckets[0]?.id;
                if (firstBucket && next[firstBucket]) {
                  next[firstBucket] = [...next[firstBucket], optimisticTask];
                }
              }
              return next;
            });

            toast({ title: "Success", description: "Task added successfully" });

            // Fire API call in background — on success, the refetch will replace the temp task with real data
            try {
              await addTask(newTaskData);
              // The hook's background refetch (after ~1.2s) will replace the temp task with real data
            } catch (error) {
              // Rollback: remove optimistic task from board
              setBoardData(prev => {
                const next = { ...prev };
                Object.keys(next).forEach(key => {
                  next[key] = next[key].filter(t => t.id !== tempId);
                });
                return next;
              });
              toast({ title: "Failed to Create Task", description: "Could not save the task. Please try again.", variant: "destructive" });
            }
          }
        }}
      />
    </div >
  );
};
export default TasksTab;
