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
        return <Badge className="bg-blue-100 text-blue-800">Planned</Badge>;
      case 'in-progress':
        return <Badge className="bg-amber-100 text-amber-800">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'on-hold':
        return <Badge className="bg-red-100 text-red-800">On Hold</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-0.5">
            <CardTitle>Projects</CardTitle>
            <CardDescription>Manage unit projects, risks, and timelines.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
            <Button variant="outline" onClick={handleOpenAddModal}>
              <Plus className="h-4 w-4 mr-2" />
              Add Project
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto border rounded-md h-[calc(100vh-220px)] relative">
            <table className="w-full caption-bottom text-sm min-w-[1200px] table-fixed md:table-auto">
              <TableHeader className="sticky top-0 z-50 bg-background border-b-2">
                <TableRow>
                  <TableHead className="w-[200px] min-w-[200px] sticky left-0 top-0 z-50 bg-background shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Name</TableHead>
                  <TableHead className="min-w-[120px] sticky top-0 z-40 bg-background">Status</TableHead>
                  <TableHead className="min-w-[200px] sticky top-0 z-40 bg-background">Manager</TableHead>
                  <TableHead className="min-w-[150px] sticky top-0 z-40 bg-background">Assignees</TableHead>
                  <TableHead className="min-w-[200px] sticky top-0 z-40 bg-background">Timeline</TableHead>
                  <TableHead className="min-w-[150px] sticky top-0 z-40 bg-background">Budget</TableHead>
                  <TableHead className="min-w-[100px] sticky top-0 z-40 bg-background">Progress</TableHead>
                  <TableHead className="text-right min-w-[100px] sticky right-0 top-0 z-50 bg-background border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr:last-child]:border-b">
                {filteredProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? 'No projects found matching your search.' : 'No projects found. Create your first project by clicking "Add Project".'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProjects.map((project) => {
                    const isDeleting = deletingIds.has(project.id);
                    return (
                      <TableRow
                        key={project.id}
                        className={`transition-all duration-300 ease-out ${isDeleting ? 'opacity-0 h-0 p-0 overflow-hidden border-0 scale-y-0' : 'opacity-100'}`}
                        style={isDeleting ? { visibility: 'hidden', height: 0, padding: 0, border: 0 } : {}}
                      >
                        <TableCell className="font-medium sticky left-0 z-20 bg-background shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{project.name}</TableCell>
                        <TableCell>{getStatusBadge(project.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                {getInitials(getManagerName(project.manager))}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{getManagerName(project.manager)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex -space-x-2 overflow-hidden pl-1">
                            {project.assignees && project.assignees.length > 0 ? (
                              <TooltipProvider>
                                {project.assignees.slice(0, 3).map((assignee, i) => (
                                  <Tooltip key={assignee.id || i}>
                                    <TooltipTrigger asChild>
                                      <Avatar className="inline-block h-6 w-6 ring-2 ring-background cursor-help">
                                        <AvatarFallback className="text-[10px] bg-secondary text-secondary-foreground">
                                          {assignee.initials || getInitials(assignee.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{assignee.name}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ))}
                                {project.assignees.length > 3 && (
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-background bg-muted text-[10px] font-medium">
                                    +{project.assignees.length - 3}
                                  </div>
                                )}
                              </TooltipProvider>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">Unassigned</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatDate(project.startDate)} - {formatDate(project.endDate)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(project.budgetSpent)} / {formatCurrency(project.budget)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={project.progress} className="h-2 w-full" />
                            <span className="text-xs font-medium">{project.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right sticky right-0 z-20 bg-background border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(project)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(project)}>
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