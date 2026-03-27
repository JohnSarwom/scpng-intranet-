import React, { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

import { Progress } from '@/components/ui/progress';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import AddProjectModal from './modals/AddProjectModal';
import EditProjectModal from './modals/EditProjectModal';
import DeleteModal from './modals/DeleteModal';
import { Project, Risk, Task, Objective } from '@/types';
import { mockProjects } from '@/mockData/projects';
import { StaffMember } from '@/types/staff';

interface ProjectsTabProps {
  projects: Project[];
  tasks?: Task[]; // Added tasks prop for association check
  addProject: (project: Omit<Project, 'id' | 'risks' | 'tasks'>) => void;
  editProject: (id: string, project: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  error?: Error | null;
  onRetry?: () => void;
  staffMembers: StaffMember[];
  objectives?: Objective[];
}

export const ProjectsTab: React.FC<ProjectsTabProps> = ({
  projects,
  tasks = [],
  addProject,
  editProject,
  deleteProject,
  staffMembers,
  objectives
}) => {
  const { toast } = useToast();
  const { user } = useSupabaseAuth();
  const isStaff = user?.user_metadata?.role === 'staff_member';
  const userEmail = user?.email;
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const [newProject, setNewProject] = useState<Partial<Project>>({
    name: '',
    description: '',
    status: 'planned',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    manager: '',
    budget: 0,
    budgetSpent: 0,
    progress: 1
  });

  // Combine passed projects with mock projects
  // Use a Map to deduplicate by ID if necessary, though typical mock IDs are unique
  const displayProjects = React.useMemo(() => {
    const combined = [...projects, ...mockProjects];
    // Simple deduplication by ID just in case
    const unique = Array.from(new Map(combined.map(p => [p.id, p])).values());
    console.log(`[ProjectsTab] Displaying ${unique.length} projects (${projects.length} real, ${mockProjects.length} mock)`);
    return unique;
  }, [projects]);

  const filteredProjects = displayProjects.filter(project => {
    if (isStaff) {
      const isAssignee = project.assignees?.some(a => a.email === userEmail);
      if (!isAssignee) return false;
    }
    return project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.manager.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleEdit = (project: Project) => {
    setSelectedProject(project);
    setShowEditModal(true);
  };

  const handleDeleteClick = (project: Project) => {
    setSelectedProject(project);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedProject) return;

    const projectId = selectedProject.id;

    // 1. Optimistic Update
    setDeletingIds(prev => new Set(prev).add(projectId));
    setShowDeleteModal(false);

    // 2. Immediate Feedback
    toast({
      title: "Project deleted",
      description: `The project "${selectedProject.name}" has been deleted.`,
    });

    try {
      // 3. API Call
      await deleteProject(projectId);
      // Success - no further action needed as parent updates props
    } catch (error) {
      // 4. Rollback on Error
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
      toast({
        title: "Delete failed",
        description: "Could not delete project. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleOpenAddModal = () => {
    setNewProject({
      name: '',
      description: '',
      status: 'planned',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      manager: '',
      budget: 0,
      budgetSpent: 0,
      progress: 1
    });
    setShowAddModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'planned':
        return <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 font-semibold px-2.5 py-0.5 rounded-full">Planned</Badge>;
      case 'in-progress':
        return <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 font-semibold px-2.5 py-0.5 rounded-full">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-100 dark:border-green-500/20 font-semibold px-2.5 py-0.5 rounded-full">Completed</Badge>;
      case 'on-hold':
        return <Badge className="bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-100 dark:border-red-500/20 font-semibold px-2.5 py-0.5 rounded-full">On Hold</Badge>;
      default:
        return <Badge className="bg-gray-50 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400 border border-gray-100 dark:border-gray-500/20 font-semibold px-2.5 py-0.5 rounded-full">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) {
      amount = 0;
    }
    return new Intl.NumberFormat('en-PG', {
      style: 'currency',
      currency: 'PGK',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: Date | string | undefined) => {
    if (date instanceof Date) {
      return new Date(date).toLocaleDateString();
    } else if (typeof date === 'string') {
      return date;
    } else {
      return '';
    }
  };

  const getManagerName = (email: string) => {
    if (!staffMembers) return email;
    const staff = staffMembers.find(s => s.email === email);
    return staff ? staff.name : email;
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <>
      <Card className="dark:bg-gray-900/70 dark:backdrop-blur-xl dark:border-white/10 shadow-2xl border-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b dark:border-white/5 bg-gray-50/50 dark:bg-gray-800/40 backdrop-blur-md rounded-t-xl">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold dark:text-gray-100">Projects</CardTitle>
            <CardDescription className="dark:text-gray-400">Manage unit projects, risks, and timelines.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-[200px] dark:bg-gray-950/50 dark:border-white/10 dark:text-gray-100 focus:ring-blue-500/50 backdrop-blur-sm"
              />
            </div>
            <Button variant="outline" onClick={handleOpenAddModal} className="dark:bg-gray-800/50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-gray-700/50 transition-all">
              <Plus className="h-4 w-4 mr-2" />
              Add Project
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-auto border dark:border-white/5 rounded-xl h-[calc(100vh-220px)] relative kanban-scrollbar bg-white/50 dark:bg-black/20 backdrop-blur-sm">
            <table className="w-full caption-bottom text-sm min-w-[1200px] table-fixed md:table-auto">
              <TableHeader className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b dark:border-white/10">
                <TableRow className="dark:hover:bg-transparent border-none">
                  <TableHead className="w-[200px] min-w-[200px] sticky left-0 top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-r dark:border-white/5 dark:text-gray-300 font-semibold">Name</TableHead>
                  <TableHead className="min-w-[120px] dark:text-gray-300 font-semibold">Status</TableHead>
                  <TableHead className="min-w-[200px] dark:text-gray-300 font-semibold">Manager</TableHead>
                  <TableHead className="min-w-[150px] dark:text-gray-300 font-semibold">Assignees</TableHead>
                  <TableHead className="min-w-[200px] dark:text-gray-300 font-semibold">Timeline</TableHead>
                  <TableHead className="min-w-[150px] dark:text-gray-300 font-semibold">Budget</TableHead>
                  <TableHead className="min-w-[100px] dark:text-gray-300 font-semibold">Progress</TableHead>
                  <TableHead className="text-right min-w-[100px] sticky right-0 top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-l dark:border-white/5 dark:text-gray-300 font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-20 text-muted-foreground dark:text-gray-500 italic">
                      {searchQuery ? 'No projects found matching your search.' : 'No projects found. Create your first project by clicking "Add Project".'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProjects.map((project) => {
                    const isDeleting = deletingIds.has(project.id);
                    return (
                      <TableRow
                        key={project.id}
                        className={`transition-all duration-300 ease-out border-b border-gray-100/50 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/5 group ${isDeleting ? 'opacity-0 h-0 p-0 overflow-hidden border-0 scale-y-0' : 'opacity-100'}`}
                        style={isDeleting ? { visibility: 'hidden', height: 0, padding: 0, border: 0 } : {}}
                      >
                        <TableCell className="font-medium sticky left-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-r dark:border-white/5 dark:text-gray-100 group-hover:bg-gray-50/80 dark:group-hover:bg-gray-800/80 transition-colors">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold">{project.name}</span>
                            <span className="text-[10px] text-gray-500 truncate dark:text-gray-400 font-normal">#{project.id.split('-').pop()}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(project.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 ring-1 ring-gray-200 dark:ring-white/10 shadow-sm">
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary dark:bg-blue-500/20 dark:text-blue-400 font-bold">
                                {getInitials(getManagerName(project.manager))}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm dark:text-gray-300 font-medium">{getManagerName(project.manager)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex -space-x-2 overflow-hidden pl-1">
                            {project.assignees && project.assignees.length > 0 ? (
                              <TooltipProvider>
                                {project.assignees.slice(0, 3).map((assignee, i) => (
                                  <Tooltip key={assignee.id || i}>
                                    <TooltipTrigger asChild>
                                      <Avatar className="inline-block h-7 w-7 ring-2 ring-background cursor-help transition-transform hover:-translate-y-0.5">
                                        <AvatarFallback className="text-[10px] bg-secondary text-secondary-foreground font-semibold">
                                          {assignee.initials || getInitials(assignee.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent className="dark:bg-gray-800 dark:border-white/10 backdrop-blur-xl">
                                      <p className="text-xs">{assignee.name}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ))}
                                {project.assignees.length > 3 && (
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-background bg-muted text-[10px] font-bold dark:bg-gray-800 dark:text-gray-300">
                                    +{project.assignees.length - 3}
                                  </div>
                                )}
                              </TooltipProvider>
                            ) : (
                              <span className="text-muted-foreground dark:text-gray-500 text-xs italic">Unassigned</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="dark:text-gray-300 tabular-nums">
                          {formatDate(project.startDate)} - {formatDate(project.endDate)}
                        </TableCell>
                        <TableCell className="dark:text-gray-300 font-medium tabular-nums">
                          <div className="flex flex-col">
                            <span>{formatCurrency(project.budgetSpent)}</span>
                            <span className="text-[10px] text-gray-400">of {formatCurrency(project.budget)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5 min-w-[80px]">
                            <div className="flex justify-between items-center px-0.5">
                              <span className="text-[10px] font-bold dark:text-gray-400">{project.progress}%</span>
                            </div>
                            <Progress value={project.progress} className="h-1.5 w-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 transition-all duration-500 ease-out" 
                                style={{ width: `${project.progress}%` }} 
                              />
                            </Progress>
                          </div>
                        </TableCell>
                        <TableCell className="text-right sticky right-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-l dark:border-white/5 group-hover:bg-gray-50/80 dark:group-hover:bg-gray-800/80 transition-colors">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(project)} className="h-8 w-8 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-500/10 transition-colors">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(project)} className="h-8 w-8 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      {showAddModal && (
        <AddProjectModal
          open={showAddModal}
          onOpenChange={setShowAddModal}
          project={newProject}
          onProjectChange={setNewProject}
          onAddProject={(project) => {
            addProject(project);
            setShowAddModal(false);
          }}
          staffMembers={staffMembers}
        // objectives={objectives} // Pass if needed
        />
      )}

      {showEditModal && selectedProject && (
        <EditProjectModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          project={selectedProject}
          onProjectChange={(updatedProject) => setSelectedProject(updatedProject)}
          onSave={(updatedProject) => {
            editProject(selectedProject.id, updatedProject);
          }}
          staffMembers={staffMembers}
        // objectives={objectives} // Pass if needed
        />
      )}

      {showDeleteModal && selectedProject && (
        <DeleteModal
          open={showDeleteModal}
          onOpenChange={setShowDeleteModal}
          title="Delete Project"
          description={`Are you sure you want to delete the project "${selectedProject.name}"? ${tasks.filter(t => t.projectId === selectedProject.id).length > 0
            ? `This will also delete ${tasks.filter(t => t.projectId === selectedProject.id).length} associated tasks.`
            : 'This action cannot be undone.'
            }`}
          onDelete={handleConfirmDelete}
        />
      )}
    </>
  );
}; 