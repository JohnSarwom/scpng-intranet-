import React, { useState } from 'react';
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
// import { ScrollArea } from "@/components/ui/scroll-area";
import ChecklistSection from '@/components/ChecklistSection';
import { Project } from '@/types';
import { StaffMember } from '@/types/staff';
import { GlobalAssigneeSelector } from '@/components/common/GlobalAssigneeSelector';
import { Employee } from '@/contexts/EmployeesContext';
import { User } from '@/types';
import { toast } from "@/components/ui/use-toast";
import DatePicker from '@/components/DatePicker';

interface AddProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddProject?: (project: Project) => void;
  project?: Partial<Project>;
  onProjectChange?: (project: Partial<Project>) => void;
  onSave?: () => void;
  staffMembers: StaffMember[];
}

const AddProjectModal: React.FC<AddProjectModalProps> = ({
  open,
  onOpenChange,
  onAddProject,
  project,
  onProjectChange,
  onSave,
  staffMembers
}) => {
  const loading = false;

  const defaultProject: Partial<Project> = {
    id: `project-${Date.now()}`,
    name: '',
    description: '',
    status: 'planned',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default end date is 30 days from now
    manager: '',
    budget: 0,
    budgetSpent: 0,
    progress: 1,
    risks: [],
    tasks: [],
    checklist: [],
    assignees: []
  };

  const projectData = project || defaultProject;

  const handleChange = (field: string, value: any) => {
    if (onProjectChange && project) {
      onProjectChange({
        ...project,
        [field]: value
      });
    }
  };

  const handleSubmit = () => {
    if (!projectData.name) {
      toast({
        title: "Error",
        description: "Project name is required",
      });
      return;
    }

    if (!projectData.manager) {
      toast({
        title: "Error",
        description: "Project manager is required",
      });
      return;
    }

    // Use either the onSave callback or the onAddProject callback
    if (onSave) {
      onSave();
    } else if (onAddProject) {
      onAddProject(projectData as Project);
    }

    onOpenChange(false);

    toast({
      title: "Project Added",
      description: "The project has been successfully added",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 flex flex-col max-h-[90vh] dark:bg-gray-900/95 dark:backdrop-blur-2xl dark:border-white/10 shadow-2xl overflow-hidden border-none text-gray-900 dark:text-gray-100">
        <DialogHeader className="p-6 pb-4 border-b border-gray-100 dark:border-white/5 flex-shrink-0 bg-gray-50/50 dark:bg-gray-800/40 backdrop-blur-md">
          <DialogTitle className="text-xl font-bold dark:text-white tracking-tight">Add New Project</DialogTitle>
          <DialogDescription className="dark:text-gray-400 font-medium">
            Create a new project with the form below.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white/50 dark:bg-black/20 backdrop-blur-sm">
          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="project-name" className="text-sm font-semibold dark:text-gray-200 ml-0.5">Project Name <span className="text-destructive">*</span></Label>
              <Input
                id="project-name"
                placeholder="Enter project name..."
                value={projectData.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                className="h-11 dark:bg-gray-950/50 dark:border-white/10 focus:ring-blue-500/50 dark:text-white placeholder:text-gray-500 transition-all backdrop-blur-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-description" className="text-sm font-semibold dark:text-gray-200 ml-0.5">Description</Label>
              <Textarea
                id="project-description"
                placeholder="Describe the project scope and goals..."
                value={projectData.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                className="min-h-[100px] dark:bg-gray-950/50 dark:border-white/10 focus:ring-blue-500/50 dark:text-white placeholder:text-gray-500 transition-all backdrop-blur-sm resize-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="project-manager" className="text-sm font-semibold dark:text-gray-200 ml-0.5">Project Manager <span className="text-destructive">*</span></Label>
                <div className="dark:bg-gray-950/50 rounded-md backdrop-blur-sm">
                  <GlobalAssigneeSelector
                    selected={projectData.manager ? [{
                      id: projectData.manager,
                      displayName: projectData.manager,
                      givenName: projectData.manager.split(' ')[0] || '',
                      surname: projectData.manager.split(' ').slice(1).join(' ') || '',
                      mail: '',
                    }] : []}
                    onChange={(employees) => {
                      const selected = employees[0];
                      if (selected) {
                        handleChange('manager', selected.displayName);
                      } else {
                        handleChange('manager', '');
                      }
                    }}
                    mode="single"
                    placeholder="Select manager"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="project-assignees" className="text-sm font-semibold dark:text-gray-200 ml-0.5">Additional Assignees</Label>
                <div className="dark:bg-gray-950/50 rounded-md backdrop-blur-sm">
                  <GlobalAssigneeSelector
                    selected={(projectData.assignees || []).map(u => ({
                      id: u.id.toString(),
                      displayName: u.name,
                      givenName: u.name.split(' ')[0] || '',
                      surname: u.name.split(' ').slice(1).join(' ') || '',
                      mail: u.email || '',
                      jobTitle: '',
                      department: '',
                      officeLocation: '',
                      mobilePhone: '',
                      businessPhones: [],
                      faxNumber: ''
                    }))}
                    onChange={(employees) => {
                      const assignees: User[] = employees.map(emp => ({
                        id: emp.id,
                        name: emp.displayName,
                        email: emp.mail,
                        initials: emp.givenName && emp.surname ? `${emp.givenName[0]}${emp.surname[0]}` : emp.displayName.substring(0, 2)
                      }));
                      handleChange('assignees', assignees);
                    }}
                    mode="multiple"
                    placeholder="Select assignees"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="project-status" className="text-sm font-semibold dark:text-gray-200 ml-0.5">Status</Label>
                <Select
                  value={projectData.status || 'planned'}
                  onValueChange={(value: 'planned' | 'in-progress' | 'completed' | 'on-hold') =>
                    handleChange('status', value)
                  }
                >
                  <SelectTrigger id="project-status" className="h-11 dark:bg-gray-950/50 dark:border-white/10 dark:text-white transition-all backdrop-blur-sm focus:ring-blue-500/50">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-900/95 dark:backdrop-blur-xl dark:border-white/10 border-none shadow-2xl">
                    <SelectItem value="planned" className="focus:bg-blue-500/20 dark:focus:bg-blue-500/20">Planned</SelectItem>
                    <SelectItem value="in-progress" className="focus:bg-blue-500/20 dark:focus:bg-blue-500/20">In Progress</SelectItem>
                    <SelectItem value="completed" className="focus:bg-blue-500/20 dark:focus:bg-blue-500/20">Completed</SelectItem>
                    <SelectItem value="on-hold" className="focus:bg-blue-500/20 dark:focus:bg-blue-500/20">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="project-start-date" className="text-sm font-semibold dark:text-gray-200 ml-0.5">Start Date</Label>
                <div className="dark:bg-gray-950/50 rounded-md backdrop-blur-sm overflow-hidden border dark:border-white/10">
                  <DatePicker
                    date={projectData.startDate}
                    setDate={(date) => handleChange('startDate', date)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="project-end-date" className="text-sm font-semibold dark:text-gray-200 ml-0.5">End Date</Label>
                <div className="dark:bg-gray-950/50 rounded-md backdrop-blur-sm overflow-hidden border dark:border-white/10">
                  <DatePicker
                    date={projectData.endDate}
                    setDate={(date) => handleChange('endDate', date)}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="project-budget" className="text-sm font-semibold dark:text-gray-200 ml-0.5">Budget (PGK)</Label>
                <div className="flex items-center group">
                  <div className="h-11 px-3 flex items-center justify-center bg-gray-100 dark:bg-white/5 border-y border-l dark:border-white/10 rounded-l-md text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-wider">
                    K
                  </div>
                  <Input
                    id="project-budget"
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={projectData.budget || 0}
                    onChange={(e) => handleChange('budget', Number(e.target.value))}
                    className="h-11 rounded-l-none dark:bg-gray-950/50 dark:border-white/10 dark:text-white transition-all backdrop-blur-sm focus:ring-blue-500/50"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="project-progress" className="text-sm font-semibold dark:text-gray-200 ml-0.5">Progress (%)</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="project-progress"
                      type="number"
                      min="1"
                      max="100"
                      value={projectData.progress || 1}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        handleChange('progress', value < 1 ? 1 : value);
                      }}
                      className="h-11 pr-10 dark:bg-gray-950/50 dark:border-white/10 dark:text-white transition-all backdrop-blur-sm focus:ring-blue-500/50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t dark:border-white/5 pt-6 mt-6">
            <ChecklistSection
              items={projectData.checklist || []}
              onChange={(items) => handleChange('checklist', items)}
            />
          </div>
        </div>

        <DialogFooter className="p-6 bg-gray-50/50 dark:bg-gray-800/40 border-t dark:border-white/5 backdrop-blur-md">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 transition-colors">Cancel</Button>
          <Button onClick={handleSubmit} className="dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white shadow-lg shadow-blue-500/20 px-8 transition-all hover:scale-[1.02] active:scale-[0.98]">Add Project</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddProjectModal;
