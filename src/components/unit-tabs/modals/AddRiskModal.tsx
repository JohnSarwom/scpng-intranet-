import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Risk, StaffMember, Project } from '@/types';
import { ChecklistItem } from '@/components/ChecklistSection';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import ChecklistSection from '@/components/ChecklistSection';
import { risksService } from '@/integrations/supabase/unitService';

interface AddRiskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddRisk: (risk: Omit<Risk, 'id' | 'createdAt' | 'updatedAt'>) => void;
  staffMembers: StaffMember[];
  projects: Project[];
}

// Internal type for the form state with string dates
interface RiskFormState {
  id: string;
  title: string;
  description: string;
  owner: string;
  category: string;
  status: Risk['status'];
  impact: Risk['impact'];
  likelihood: Risk['likelihood'];
  identificationDate: string;
  mitigationPlan: string;
  createdAt: string;
  updatedAt: string;
  checklist: ChecklistItem[];
  project_name?: string;
}

const defaultFormState: RiskFormState = {
  id: '',
  title: '',
  description: '',
  owner: '',
  category: '',
  status: 'identified',
  impact: 'medium',
  likelihood: 'low',
  identificationDate: new Date().toISOString(),
  mitigationPlan: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  checklist: [],
  project_name: '',
};

const AddRiskModal: React.FC<AddRiskModalProps> = ({
  open,
  onOpenChange,
  onAddRisk,
  staffMembers,
  projects
}) => {
  const [formState, setFormState] = useState<RiskFormState>({ ...defaultFormState });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const loading = false;

  // Calculate checklist completion percentage
  const calculateCompletionPercentage = (): number => {
    if (formState.checklist.length === 0) return 0;
    const checkedItems = formState.checklist.filter(item => item.checked).length;
    return Math.round((checkedItems / formState.checklist.length) * 100);
  };

  const completionPercentage = calculateCompletionPercentage();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));

    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormState(prev => ({ ...prev, [name]: value }));

    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleDateChange = (date: Date | undefined) => {
    setFormState(prev => ({
      ...prev,
      identificationDate: date ? date.toISOString() : new Date().toISOString()
    }));

    if (errors['identificationDate']) {
      setErrors(prev => ({ ...prev, identificationDate: '' }));
    }
  };

  const handleChecklistChange = (key: string, checked: boolean) => {
    if (checked) {
      // For radio buttons, we should clear all other selections first
      const predefinedKeys = ['riskAssessment', 'stakeholderReview', 'mitigationStrategy', 'contingencyPlan'];

      // Keep any custom checklist items
      const customItems = formState.checklist.filter(item => !predefinedKeys.includes(item.id));

      const newChecklist = [
        {
          id: key,
          text: getChecklistText(key),
          checked: true
        },
        ...customItems
      ];

      setFormState(prev => ({
        ...prev,
        checklist: newChecklist
      }));
    }
  };

  // Helper function to get text based on checklist key
  const getChecklistText = (key: string): string => {
    switch (key) {
      case 'riskAssessment': return 'Risk assessment completed';
      case 'stakeholderReview': return 'Stakeholder review conducted';
      case 'mitigationStrategy': return 'Mitigation strategy defined';
      case 'contingencyPlan': return 'Contingency plan established';
      default: return key;
    }
  };

  // Helper function to check if checklist item exists and is checked
  const isChecklistItemChecked = (key: string): boolean => {
    const item = formState.checklist.find(item => item.id === key);
    return item ? item.checked : false;
  };

  const resetForm = () => {
    setFormState({ ...defaultFormState, id: crypto.randomUUID() });
    setErrors({});
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formState.title?.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formState.owner?.trim()) {
      newErrors.owner = 'Owner is required';
    }

    if (!formState.category?.trim()) {
      newErrors.category = 'Category is required';
    }

    // Validate likelihood to ensure it meets the database constraint
    const validLikelihoods = ['low', 'medium', 'high', 'very-high'];
    if (!validLikelihoods.includes(formState.likelihood)) {
      newErrors.likelihood = 'Invalid likelihood value';
      // Fallback to a safe value
      setFormState(prev => ({ ...prev, likelihood: 'low' }));
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAdd = async () => {
    if (!validate()) return;

    /* // Removing unnecessary schema check causing errors
    try {
      await risksService.checkRiskTableSchema();
    } catch (err) {
      console.error('Failed to check schema:', err);
    }
    */

    // Ensure likelihood is one of the allowed values
    const validLikelihoods = ['low', 'medium', 'high', 'very-high'];
    const safelikelihood = validLikelihoods.includes(formState.likelihood)
      ? formState.likelihood
      : 'low';

    // Create a well-formed risk object with explicit type casting to ensure database compatibility
    const riskToAdd: Omit<Risk, 'id' | 'createdAt' | 'updatedAt'> = {
      ...formState,
      identificationDate: new Date(formState.identificationDate),
      impact: formState.impact as Risk['impact'],
      likelihood: safelikelihood as 'low' | 'medium' | 'high' | 'very-high',
      project_id: projects.find(p => p.name === formState.project_name)?.id || null,
    };

    // Log the risk object for debugging in-depth
    console.log('Risk being added with likelihood:',
      JSON.stringify({
        likelihoodType: typeof riskToAdd.likelihood,
        likelihoodValue: riskToAdd.likelihood,
        validationType: validLikelihoods.includes(riskToAdd.likelihood) ? 'valid' : 'invalid',
        fullObject: riskToAdd
      }, null, 2)
    );

    try {
      onAddRisk(riskToAdd);

      toast({
        title: "Success",
        description: "Risk added successfully",
      });

      resetForm();
      onOpenChange(false);
    } catch (err) {
      console.error('Error adding risk:', err);
      toast({
        title: "Error",
        description: "Failed to add risk. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleAddChecklistItem = () => {
    if (newChecklistItem.trim() === '') return;

    const newItem: ChecklistItem = {
      id: crypto.randomUUID(),
      text: newChecklistItem,
      checked: false
    };

    setFormState(prev => ({
      ...prev,
      checklist: [...prev.checklist, newItem]
    }));

    setNewChecklistItem('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-[700px] flex flex-col max-h-[90vh] p-0 overflow-hidden gap-0 dark:bg-gray-900 dark:border-white/10 shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm transition-colors">
          <DialogTitle className="text-xl font-semibold">Add New Risk</DialogTitle>
          <DialogDescription className="dark:text-gray-400">
            Enter the details to create a new risk entry.
          </DialogDescription>
        </DialogHeader>

        {/* Use flex-grow and overflow-y-auto for scrollable content */}
        <div className="flex-grow overflow-y-auto pr-4">
          {/* Apply two-column grid layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {/* Title (spans 2 columns) */}
            <div className="md:col-span-2 grid gap-1.5">
              <Label htmlFor="risk-title" className="dark:text-gray-300">Title <span className="text-red-500">*</span></Label>
              <Input
                id="risk-title"
                name="title"
                placeholder="Risk Title"
                value={formState.title}
                onChange={handleChange}
                className="dark:bg-gray-800 dark:border-white/10 dark:text-gray-200 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
              />
              {errors.title && <p className="text-red-500 text-sm font-medium mt-1">{errors.title}</p>}
            </div>

            {/* Description (spans 2 columns) */}
            <div className="md:col-span-2 grid gap-1.5">
              <Label htmlFor="risk-description" className="dark:text-gray-300">Description</Label>
              <Textarea
                id="risk-description"
                name="description"
                placeholder="Detailed description of the risk"
                value={formState.description}
                onChange={handleChange}
                className="dark:bg-gray-800 dark:border-white/10 dark:text-gray-200 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all custom-scrollbar"
                rows={3}
              />
            </div>

            {/* Owner */}
            <div className="grid gap-2">
              <Label htmlFor="risk-owner">Owner <span className="text-destructive">*</span></Label>
              <Select
                name="owner"
                value={formState.owner}
                onValueChange={(value) => handleSelectChange('owner', value)}
              >
                <SelectTrigger id="risk-owner" className={cn("dark:bg-gray-800 dark:border-white/10 dark:text-gray-200 focus:ring-blue-500/20", loading && "opacity-50")}>
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-900 dark:border-white/10">
                  {loading ? (
                    <SelectItem value="_loading" disabled>Loading staff...</SelectItem>
                  ) : staffMembers && staffMembers.length > 0 ? (
                    staffMembers.map((staff) => (
                      <SelectItem key={staff.id} value={staff.name}>
                        {staff.name} ({staff.job_title})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="_no_staff" disabled>No staff members found</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {errors.owner && <p className="text-sm text-destructive mt-1">{errors.owner}</p>}
            </div>

            {/* Category */}
            <div className="grid gap-1.5">
              <Label htmlFor="risk-category">Category <span className="text-red-500">*</span></Label>
              <Select
                name="category"
                value={formState.category}
                onValueChange={(value) => handleSelectChange('category', value)}
              >
                <SelectTrigger id="risk-category" className="dark:bg-gray-800 dark:border-white/10 dark:text-gray-200 focus:ring-blue-500/20">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-900 dark:border-white/10">
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="strategic">Strategic</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="reputational">Reputational</SelectItem>
                  {/* Add other relevant categories */}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-red-500 text-sm">{errors.category}</p>}
            </div>

            {/* Status */}
            <div className="grid gap-1.5">
              <Label htmlFor="risk-status">Status</Label>
              <Select
                name="status"
                value={formState.status}
                onValueChange={(value) => handleSelectChange('status', value as Risk['status'])}
              >
                <SelectTrigger id="risk-status" className="dark:bg-gray-800 dark:border-white/10 dark:text-gray-200 focus:ring-blue-500/20">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-900 dark:border-white/10">
                  <SelectItem value="identified">Identified</SelectItem>
                  <SelectItem value="analyzing">Analyzing</SelectItem>
                  <SelectItem value="mitigating">Mitigating</SelectItem>
                  <SelectItem value="monitoring">Monitoring</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Identification Date */}
            <div className="grid gap-1.5">
              <Label htmlFor="risk-identificationDate">Identification Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal dark:bg-gray-800 dark:border-white/10 dark:text-gray-200 focus:ring-blue-500/20",
                      !formState.identificationDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formState.identificationDate ? format(new Date(formState.identificationDate), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formState.identificationDate ? new Date(formState.identificationDate) : undefined}
                    onSelect={handleDateChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Impact Level */}
            <div className="grid gap-1.5">
              <Label htmlFor="risk-impact">Impact Level</Label>
              <Select
                name="impact"
                value={formState.impact}
                onValueChange={(value) => handleSelectChange('impact', value as Risk['impact'])}
              >
                <SelectTrigger id="risk-impact" className="dark:bg-gray-800 dark:border-white/10 dark:text-gray-200 focus:ring-blue-500/20">
                  <SelectValue placeholder="Select impact level" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-900 dark:border-white/10">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Likelihood */}
            <div className="grid gap-1.5">
              <Label htmlFor="risk-likelihood">Likelihood</Label>
              <Select
                name="likelihood"
                value={formState.likelihood}
                onValueChange={(value) => handleSelectChange('likelihood', value as Risk['likelihood'])}
              >
                <SelectTrigger id="risk-likelihood" className="dark:bg-gray-800 dark:border-white/10 dark:text-gray-200 focus:ring-blue-500/20">
                  <SelectValue placeholder="Select likelihood" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-900 dark:border-white/10">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="very-high">Very High</SelectItem>
                </SelectContent>
              </Select>
              {errors.likelihood && <p className="text-red-500 text-sm">{errors.likelihood}</p>}
            </div>

            {/* Mitigation Plan (spans 2 columns) */}
            <div className="md:col-span-2 grid gap-1.5">
              <Label htmlFor="risk-mitigationPlan">Mitigation Plan</Label>
              <Textarea
                id="risk-mitigationPlan"
                name="mitigationPlan"
                placeholder="Steps to mitigate the risk"
                value={formState.mitigationPlan}
                onChange={handleChange}
                className="dark:bg-gray-800 dark:border-white/10 dark:text-gray-200 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                rows={3}
              />
            </div>

            {/* Related Project */}
            <div className="grid gap-2">
              <Label htmlFor="risk-project">Related Project (Optional)</Label>
              <Select
                name="project_name"
                value={formState.project_name || ''}
                onValueChange={(value) => handleSelectChange('project_name', value)}
              >
                <SelectTrigger id="risk-project" className="dark:bg-gray-800 dark:border-white/10 dark:text-gray-200 focus:ring-blue-500/20">
                  <SelectValue placeholder="Select related project" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-900 dark:border-white/10">
                  <SelectItem value="">None</SelectItem>
                  {projects && projects.length > 0 ? (
                    projects.map((project) => (
                      <SelectItem key={project.id} value={project.name}>
                        {project.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="_no_projects" disabled>No projects available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div> {/* End grid layout */}

          {/* Checklist Section remains below the grid */}
          <div className="border-t pt-4 mt-2">
            <ChecklistSection
              items={formState.checklist}
              onChange={(items) => setFormState(prev => ({ ...prev, checklist: items }))}
            />
          </div>
        </div> {/* End scrollable content area */}

        <DialogFooter className="p-6 bg-gray-50/50 dark:bg-gray-800/50 border-t dark:border-white/10">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="dark:text-gray-400 dark:hover:text-white">Cancel</Button>
          <Button onClick={handleAdd} className="dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white shadow-lg shadow-blue-500/20">Add Risk</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddRiskModal; 