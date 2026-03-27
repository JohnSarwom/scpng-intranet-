import React, { useState, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { Edit, Plus, Trash2, MessageSquare, ChevronDown, Maximize2, Minimize2, Eye, Settings, XCircle } from 'lucide-react';
import StatusBadge from '@/components/common/StatusBadge';
import { calculateObjectiveStatus, calculateStrategicProgress } from '@/utils/kpiUtils';
import KRATimelineTab from '@/components/KRATimelineTab';
import KRAInsightsTab from '@/components/KRAInsightsTab';
import KpiModal from '@/components/kpi/KpiModal';
import { Kra, Kpi, User, Objective, Task } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { StaffMember } from '@/types/staff';
import { getSupabaseClient } from '@/integrations/supabase/supabaseClient';
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import moment from 'moment';
import { useEmployeeLookup } from '@/hooks/useEmployeeLookup';
import DatePicker from '@/components/DatePicker';
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { Check, Loader2, ChevronsUpDown } from 'lucide-react';
import {
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { cn } from '@/lib/utils';
import { Division } from '@/types';
import { ChecklistItem } from '@/components/ChecklistSection';

// Helper function to format dates (DD MMM YYYY)
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return 'Invalid Date';
  }
};

// Helper function to get quarter from date string (YYYY-MM-DD)
const getQuarter = (dateString: string | undefined): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    const month = date.getMonth(); // 0-indexed (0 = January)
    if (month <= 2) return 'Q1';
    if (month <= 5) return 'Q2';
    if (month <= 8) return 'Q3';
    return 'Q4';
  } catch {
    return '-';
  }
};

// Helper function to format currency (PNG Kina)
const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return '-';
  try {
    return new Intl.NumberFormat('en-PG', { style: 'currency', currency: 'PGK' }).format(value);
  } catch (e) {
    console.error("Error formatting currency:", value, e);
    return 'Invalid Amount';
  }
};

// Map KPI status to Badge variants (can reuse getStatusVariant logic if desired)
const getKpiStatusVariant = (status: Kpi['status']): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'completed': return 'default';
    case 'at-risk': return 'destructive';
    case 'on-track': return 'default';
    case 'in-progress': return 'default';
    case 'on-hold': return 'secondary';
    case 'not-started': return 'outline';
    case 'behind': return 'destructive';
    default: return 'outline';
  }
};

// Define filters state type
interface KraFiltersState {
  department: string;
  status: string; // Filters by KPI status
}

// Updated structure for processed rows supporting two-level grouping
interface ProcessedRow {
  // Objective Info
  objectiveId: string | number | null | undefined; // Allow undefined as it might not exist
  objectiveName: string;
  isFirstRowOfObjective: boolean;
  objectiveRowSpan: number;
  // KRA Info (grouped by Title)
  kraTitle: string;
  isFirstRowOfKraTitleGroup: boolean;
  kraTitleRowSpan: number;
  // KPI Info
  kpi: Kpi;
  // Original KRA object
  originalKra: Kra;
}

// Define structure for unit data (if not already defined globally)
interface UnitData {
  id: string | number;
  name: string;
}

// Mock Divisions if not passed (or fetch them if possible, but for now we rely on simple list)
// Ideally this should come from context or props
const MOCK_DIVISIONS: Division[] = [
  { id: '1', name: 'Executive Division', code: 'EXEC', createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Corporate Services Division', code: 'CSD', createdAt: new Date(), updatedAt: new Date() },
  // Add others if needed or rely on string matching
];

// Define Props for KRAsTab
// Define Props for KRAsTab
interface KRAsTabProps {
  kras: Kra[];
  tasks: Task[];
  objectivesData: Objective[];
  onSaveObjective: (objective: Objective) => Promise<void>;
  onDeleteObjective: (objectiveId: string | number) => Promise<void>;
  units: UnitData[]; // This prop now receives the full list of units from Unit.tsx
  staffMembers?: StaffMember[];
  onDataRefresh?: () => void;
  activeTab: string;
  onTabChange: (tabValue: string) => void;
  userContext?: { division: string; unit: string; name: string; email: string };
  onSaveKra: (kra: Partial<Kra>) => Promise<any>;
  onDeleteKra: (kraId: string | number) => Promise<void>;
  onSaveKpi: (kpi: Partial<Kpi>) => Promise<void>;
  onDeleteKpi: (kpiId: string | number) => Promise<void>;
  strategicObjectives?: { id: string | number; title: string; deliverables?: string[] }[];
  canEdit?: boolean;
  onEditTask?: (id: string, task: Partial<Task>, options?: { suppressToast?: boolean }) => Promise<void | boolean> | void;
}

export const KRAsTab: React.FC<KRAsTabProps> = ({
  kras: krasFromProps,
  tasks: tasksFromProps,
  objectivesData,
  onSaveObjective,
  onDeleteObjective,
  units, // Receive the full units list here
  staffMembers,
  onDataRefresh,
  activeTab,
  onTabChange,
  userContext,
  onSaveKra,
  onDeleteKra,
  onSaveKpi,
  onDeleteKpi,
  strategicObjectives = [],
  canEdit = false,
  onEditTask
}) => {
  const kras = krasFromProps; // Use props directly
  const tasks = tasksFromProps || [];
  const { user } = useSupabaseAuth();
  const isStaff = userContext?.role === 'staff_member';
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
  const [viewScope, setViewScope] = useState<'my' | 'department' | 'organization'>('my');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Enforce "My" scope permanently
  React.useEffect(() => {
    setViewScope('my');
  }, []);

  const [timelineViewMode, setTimelineViewMode] = useState<'quarters' | 'months' | 'weeks'>('quarters');


  const [editingKra, setEditingKra] = useState<Kra | undefined>(undefined);
  const [editingKpiDetails, setEditingKpiDetails] = useState<{ kraId: string; kpi: Kpi } | undefined>(undefined);
  const [kraToDelete, setKraToDelete] = useState<Kra | null>(null);
  const [filters, setFilters] = useState<KraFiltersState>({
    department: 'all',
    status: 'all',
  });
  const [isObjectiveModalOpen, setIsObjectiveModalOpen] = useState(false);
  const [isSavingObjective, setIsSavingObjective] = useState(false);
  const [editingObjective, setEditingObjective] = useState<Objective | undefined>(undefined);


  const [newObjectiveData, setNewObjectiveData] = useState<Partial<Objective>>({
    title: '',
    description: '',
    status: 'Not Started',
    progress: 0,
    year: new Date().getFullYear().toString(),
    goalType: 'Division',
    division: '',
    unit: '',
    owner: '',
    parentGoalId: '',
    linkedDeliverable: ''
  });
  const [isOwnerPopoverOpen, setIsOwnerPopoverOpen] = useState(false);
  const [deletingKpi, setDeletingKpi] = useState<{ kraId: string; kpiId: string; kpiName: string } | null>(null);



  // Initialize Employee Lookup
  const { employees, isLoading: isLoadingEmployees, getEmployeeDetails } = useEmployeeLookup(MOCK_DIVISIONS);

  const { toast } = useToast();

  // Derive unique KRA titles for the Combobox
  const existingKraTitles = useMemo(() => {
    const titles = kras.map(kra => kra.title).filter(title => !!title); // Get all titles, filter out empty/null/undefined
    return Array.from(new Set(titles)); // Get unique titles
  }, [kras]);

  // Derive existing KRA objects (deduplicated by case-insensitive title) for ID-based linking
  const existingKraObjects = useMemo(() => {
    const seen = new Map<string, Kra>();
    for (const kra of kras) {
      if (!kra.title) continue;
      const key = kra.title.trim().toLowerCase();
      // Keep the first occurrence (which has the original casing and ID)
      if (!seen.has(key)) {
        seen.set(key, kra);
      }
    }
    return Array.from(seen.values());
  }, [kras]);

  // Derive departments for filtering - Now use the passed units prop
  const departments = useMemo(() => units.map(u => u.name), [units]);
  const kpiStatuses: (Kpi['status'] | 'all')[] = ['all', 'not-started', 'on-track', 'in-progress', 'at-risk', 'on-hold', 'completed', 'behind'];

  const handleFilterChange = useCallback((filterName: 'department' | 'status', value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      department: 'all',
      status: 'all',
    });
  }, []);

  const processedRows = useMemo((): ProcessedRow[] => {
    /* --- TEMPORARY SIMPLIFICATION FOR DEBUGGING ---
    const flatRows: ProcessedRow[] = [];
    console.log("[KRAsTab] Objectives Data for Lookup:", objectivesData); // Log objectives data
    (krasFromProps || []).forEach(kra => {
        console.log(`[KRAsTab] Processing KRA: ${kra.title}, Objective ID from KRA: ${kra.objective_id}`); // Log KRA info with correct field
        // Basic objective lookup with detailed logging
        const objective = objectivesData.find(o => {
           // Log comparison details using objective_id
           // Compare as strings for safety, handling potential null/undefined on kra.objective_id
           const isMatch = String(o.id) === String(kra.objective_id);
           console.log(`  Comparing KRA objective_id (${kra.objective_id}, type: ${typeof kra.objective_id}) with Objective ID (${o.id}, type: ${typeof o.id}) => Match: ${isMatch}`);
           return isMatch;
        });
        console.log('[KRAsTab] Found Objective:', objective); // Log the result of find
   
        // Use objective_id to determine if assigned
        const objectiveName = objective?.name || (kra.objective_id ? 'Unknown Objective' : 'Unassigned');
        const kpis = kra.unitKpis && kra.unitKpis.length > 0 ? kra.unitKpis : [{ id: `no-kpi-${kra.id}`, name: '-' } as Kpi];
   
        kpis.forEach((kpi, index) => {
            // Simple flat structure - ignoring spans and grouping for now
            flatRows.push({
                objectiveId: kra.objective_id, // Use correct field
                objectiveName: objectiveName,
                isFirstRowOfObjective: index === 0, // Simplified: first kpi is first row
                objectiveRowSpan: 1, // Simplified
                kraTitle: kra.title,
                isFirstRowOfKraTitleGroup: index === 0, // Simplified
                kraTitleRowSpan: 1, // Simplified
                kpi: kpi,
                originalKra: kra,
            });
        });
    });
   
    // Apply filters
    const filteredRows = flatRows.filter(row => {
        const departmentMatch = filters.department === 'all' || row.originalKra.unit === filters.department;
        // Use optional chaining for status as kpi might be a placeholder
        const statusMatch = filters.status === 'all' || (row.kpi?.status && row.kpi.status === filters.status);
        // If it's a placeholder KPI row, only check department
        if (row.kpi.name === '-') { 
            return departmentMatch;
        }
        return departmentMatch && statusMatch;
    });
   
    console.log("[KRAsTab] Simplified Processed rows:", filteredRows); 
    return filteredRows;
     --- END TEMPORARY SIMPLIFICATION --- */

    // --- ORIGINAL COMPLEX LOGIC (RESTORED and UPDATED) ---
    const groupedRows: ProcessedRow[] = [];
    console.log("[KRAsTab] Using complex grouping logic. Objectives:", objectivesData);
    console.log("[KRAsTab] KRAs received:", krasFromProps);

    // Filter KRAs based on department FIRST (if applicable)
    const departmentFilteredKras = filters.department === 'all'
      ? krasFromProps
      : krasFromProps.filter(kra => kra.unit === filters.department);

    console.log("[KRAsTab] KRAs after department filter:", departmentFilteredKras);

    // Group by Objective ID (using objective_id)
    const objectiveGroups = departmentFilteredKras.reduce((acc, kra) => {
      // Use objective_id, default to 'unassigned' if null/undefined
      const objIdKey = kra.objective_id ? String(kra.objective_id) : 'unassigned';

      // Log the KRA being processed and the key derived
      console.log(`[KRAsTab Reduce] Processing KRA: ${kra.title} (ID: ${kra.id}), Objective ID: ${kra.objective_id}, Derived Key: ${objIdKey}`);

      if (!acc[objIdKey]) {
        // Log before the find operation
        console.log(`[KRAsTab Reduce] Looking for Objective with ID Key: ${objIdKey}`);
        const objective = objectivesData.find(o => {
          const isMatch = String(o.id) === objIdKey;
          // Log details of each comparison within find (can be verbose)
          // console.log(`  [Find Compare] Objective ID: ${o.id} (String: ${String(o.id)}) === Key: ${objIdKey} => ${isMatch}`);
          return isMatch;
        });

        // Log the result of the find operation
        console.log(`[KRAsTab Reduce] Find result for Key ${objIdKey}:`, objective);

        acc[objIdKey] = {
          // Use found objective name or default
          name: objective?.title || (objIdKey !== 'unassigned' ? 'Unknown Objective' : 'Unassigned'),
          kras: [],
        };
        // Log the name assigned
        console.log(`[KRAsTab Reduce] Assigned Name for Key ${objIdKey}: ${acc[objIdKey].name}`);
      }
      acc[objIdKey].kras.push(kra);
      return acc;
    }, {} as Record<string, { name: string; kras: Kra[] }>);

    console.log("[KRAsTab] Grouped by Objective:", objectiveGroups);
    // Add logging here to see objectivesData right before the loop
    console.log("[KRAsTab] objectivesData available inside useMemo:", JSON.stringify(objectivesData));

    Object.entries(objectiveGroups).forEach(([objectiveIdKey, objectiveGroup]) => {
      let isFirstRowInObjective = true;
      let objectiveRows: ProcessedRow[] = []; // Collect rows for this objective group first

      // Group by KRA Title within Objective
      const kraTitleGroups = objectiveGroup.kras.reduce((acc, kra) => {
        const titleKey = kra.title || 'Untitled KRA'; // Handle untitled KRAs
        if (!acc[titleKey]) {
          acc[titleKey] = [];
        }
        acc[titleKey].push(kra);
        return acc;
      }, {} as Record<string, Kra[]>);

      Object.entries(kraTitleGroups).forEach(([kraTitle, krasWithSameTitle]) => {
        let isFirstRowInKraTitleGroup = true;
        let kraTitleRows: ProcessedRow[] = []; // Collect rows for this KRA title group

        krasWithSameTitle.forEach(kraInstance => {
          const kpis = (kraInstance.unitKpis && kraInstance.unitKpis.length > 0)
            ? kraInstance.unitKpis
            : [{ id: `no-kpi-${kraInstance.id}`, name: '-' } as Kpi]; // Placeholder if no KPIs

          kpis.forEach((kpi: Kpi) => {
            // Apply KPI status filter here
            const statusMatch = filters.status === 'all' || (kpi.status && kpi.status === filters.status);
            if (kpi.name === '-' || statusMatch) { // Always include placeholder or if status matches
              kraTitleRows.push({
                // Use objective_id from the KRA instance
                objectiveId: kraInstance.objective_id,
                objectiveName: objectiveGroup.name,
                isFirstRowOfObjective: false, // Will be set later
                objectiveRowSpan: 0, // Will be set later
                kraTitle: kraTitle,
                isFirstRowOfKraTitleGroup: false, // Will be set later
                kraTitleRowSpan: 0, // Will be set later
                kpi: kpi,
                originalKra: kraInstance,
              });
            }
          });
        });

        // Set span and first row flag for the KRA title group
        if (kraTitleRows.length > 0) {
          kraTitleRows[0].isFirstRowOfKraTitleGroup = true;
          kraTitleRows[0].kraTitleRowSpan = kraTitleRows.length;
          objectiveRows.push(...kraTitleRows); // Add rows for this title to the objective group
        }
      });

      // Set span and first row flag for the Objective group
      if (objectiveRows.length > 0) {
        objectiveRows[0].isFirstRowOfObjective = true;
        objectiveRows[0].objectiveRowSpan = objectiveRows.length;
        groupedRows.push(...objectiveRows); // Add rows for this objective to the final list
      }
    });

    console.log("[KRAsTab] Processed rows with grouping:", groupedRows);
    return groupedRows;
    // --- END ORIGINAL COMPLEX LOGIC ---

  }, [krasFromProps, objectivesData, filters.department, filters.status]); // Update dependencies

  const handleOpenAddKraModal = () => {
    setEditingKra(undefined);
    setEditingKpiDetails(undefined);
    setIsKpiModalOpen(true);
  };

  const handleOpenEditKraModal = (kra: Kra) => {
    // Ensure we find the full KRA data from the original props, including its KPIs
    const kraToEdit = krasFromProps.find(k => k.id === kra.id);
    if (kraToEdit) {
      console.log("Editing KRA:", kraToEdit);
      console.log("🔍 [KRAsTab] kraToEdit.assignees:", kraToEdit.assignees, "| kraToEdit.owner:", kraToEdit.owner);
      setEditingKra(kraToEdit); // Pass the full KRA object with KPIs
      setEditingKpiDetails(undefined); // Ensure KPI-specific edit state is cleared
      setIsKpiModalOpen(true);
    } else {
      console.error("Could not find KRA data in props to edit for ID:", kra.id);
      toast({ title: "Error", description: "Could not find the KRA data to edit.", variant: "destructive" });
    }
  };

  const handleOpenEditKpiModal = (kraId: string | number, kpi: Kpi) => {
    const kraToEdit = kras.find(k => k.id === kraId);
    if (kraToEdit) {
      // Merge linked tasks into the KPI's checklist for immediate display
      const linkedTasks = tasks.filter(t => t.kpi_id === kpi.id?.toString());
      const TASK_DONE_STATUSES = ['completed', 'done'];
      const existingChecklist: ChecklistItem[] = kpi.checklist || [];

      // Keep manual items, update/add task-linked items
      const manualItems = existingChecklist.filter(item => !item.taskId);
      const existingTaskItems = existingChecklist.filter(item => item.taskId);
      const existingTaskIds = new Set(existingTaskItems.map(i => i.taskId));

      // Update existing task-linked items
      const updatedTaskItems = existingTaskItems
        .filter(item => linkedTasks.some(t => String(t.id) === item.taskId))
        .map(item => {
          const task = linkedTasks.find(t => String(t.id) === item.taskId);
          return task ? { ...item, text: task.title, checked: TASK_DONE_STATUSES.includes(task.status?.toLowerCase() || '') } : item;
        });

      // Add new task-linked items
      const newTaskItems: ChecklistItem[] = linkedTasks
        .filter(t => !existingTaskIds.has(String(t.id)))
        .map(t => ({
          id: `task-${t.id}`,
          text: t.title,
          checked: TASK_DONE_STATUSES.includes(t.status?.toLowerCase() || ''),
          taskId: String(t.id),
          isTaskLinked: true,
        }));

      const mergedChecklist = [...manualItems, ...updatedTaskItems, ...newTaskItems];
      const mergedKpi = {
        ...kpi,
        checklist: mergedChecklist,
        calculationType: (linkedTasks.length > 0 || mergedChecklist.length > 0) ? 'checklist' as const : (kpi.calculationType || 'manual' as const),
      };

      setEditingKra(kraToEdit);
      setEditingKpiDetails({ kraId: String(kraId), kpi: mergedKpi });
      setIsKpiModalOpen(true);
    } else {
      console.error("Could not find parent KRA for KPI editing:", kraId);
    }
  };

  const handleCloseKpiModal = () => {
    setIsKpiModalOpen(false);
    setEditingKra(undefined);
    setEditingKpiDetails(undefined);
  };

  const mapStatusToDbFormat = (status: string): string => {
    // Map UI status format to VALID database format based on unit_kpis_status_check constraint
    const normalizedStatus = status?.toLowerCase();

    // Map UI status format to VALID database format based on unit_kpis_status_check constraint
    const statusMap: Record<string, string> = {
      'on track': 'on-track',
      'on-track': 'on-track',
      'at risk': 'at-risk',
      'at-risk': 'at-risk',
      'completed': 'completed',
      'behind': 'behind',
      'off track': 'behind',
      'in progress': 'behind',
      'not started': 'behind',
      'on hold': 'behind'
    };
    // Default to 'behind' if no specific mapping found or if input is invalid/null
    return statusMap[normalizedStatus] || 'behind';
  };

  const handleKpiFormSubmit = async (formData: any) => {
    console.log("[handleKpiFormSubmit] Received form data:", JSON.stringify(formData, null, 2));
    const isEditing = !!editingKra?.id;
    // Check if an existing KRA was selected from the combobox (ID came from selection, not from editing)
    // Only treat numeric IDs as real SharePoint IDs (temp IDs like "kra_123456" should be ignored)
    const rawId = !isEditing && formData.id ? formData.id : null;
    const selectedExistingKraId = rawId && !String(rawId).startsWith('kra_') && !String(rawId).startsWith('temp') ? rawId : null;
    let kraId = editingKra?.id || selectedExistingKraId;
    let operationError = false;

    // If user selected an existing KRA by title, reuse its ID — don't create a duplicate
    if (selectedExistingKraId) {
      console.log(`[handleKpiFormSubmit] Existing KRA selected by ID: ${selectedExistingKraId}. Will link KPIs to it instead of creating a new KRA.`);
    }

    // 1. Prepare KRA Payload (Map ONLY active fields from KraFormSection)
    const kraPayload: any = {
      title: formData.title || null, // Map from title input
      objective_id: formData.objectiveId || formData.objective_id || null, // Map from objective select
      unit_id: formData.unitId || null, // Map from unit select (now storing ID)
      description: formData.description || formData.comments || null, // Map description FROM comments textarea or description field
      ownerId: formData.responsibleId || formData.ownerId || null, // Map owner if present
      owner: formData.owner || null, // Full owner object — needed to embed isOwner in Assignees JSON
      assignees: formData.assignees || [], // Map assignees
      status: formData.status || formData.Status || 'open', // PERSIST STATUS - Handle both casings just in case
      progress: formData.progress ?? 0, // PERSIST PROGRESS
      // Set Department so the KRA is visible under the correct division/unit scope filter.
      // Priority: 1. Manual selection from dropdown (formData.unit), 2. Fallback to context
      department: formData.unit || formData.department || userContext?.division || userContext?.unit || '',
      // Auto-fill Unit and Division from user context — no manual selection required
      unit: formData.unit || userContext?.unit || '',
      division: userContext?.division || '',
    };

    // If editing OR reusing an existing KRA, set the ID so onSaveKra does an update (not create)
    if (isEditing || selectedExistingKraId) {
      kraPayload.id = kraId;
    }

    // Get current division ID from localStorage and add it
    const currentDivisionId = localStorage.getItem('current_division_id');
    if (currentDivisionId) {
      kraPayload.division_id = currentDivisionId;
    }

    // --- Duplicate Prevention: Case-insensitive title match as safety net ---
    // If no ID is set yet (user typed a title manually), check if an existing KRA matches
    if (!kraPayload.id && kraPayload.title) {
      const normalizedTitle = kraPayload.title.trim().toLowerCase();
      const matchingKra = krasFromProps.find(
        k => k.title && k.title.trim().toLowerCase() === normalizedTitle
      );
      if (matchingKra) {
        console.log(`[handleKpiFormSubmit] Duplicate prevention: Found existing KRA "${matchingKra.title}" (ID: ${matchingKra.id}) matching typed title "${kraPayload.title}". Reusing existing KRA.`);
        kraPayload.id = matchingKra.id;
        kraPayload.title = matchingKra.title; // Preserve original casing from SharePoint
        kraId = matchingKra.id;
      }
    }

    console.log("[handleKpiFormSubmit] Prepared KRA Payload:", kraPayload);

    // --- KRA Save/Update ---
    try {
      console.log("[handleKpiFormSubmit] Saving KRA to SharePoint via onSaveKra with Payload:", JSON.stringify(kraPayload, null, 2));
      const savedKra: any = await onSaveKra(kraPayload);
      // If we just created a new KRA, we need its ID to save KPIs
      if (savedKra && savedKra.id) {
        kraId = savedKra.id;
        console.log(`[handleKpiFormSubmit] KRA saved/updated successfully. ID: ${kraId}`);
      }
    } catch (error) {
      console.error("[handleKpiFormSubmit] Unexpected error during KRA save/update:", error);
      operationError = true;
      return;
    }

    // --- KPI Save/Update --- 
    // Only if we have a KRA ID. If we just created one, we might not have it yet unless we fetch it.
    // Ideally, we should await onSaveKra and it should return the ID.
    // Since I can't easily change the Props return type deeply without cascading changes, 
    // I will check if we have `kraId` (Editing). 
    // If New, KPIs might stay orphaned or fail.
    // To support New KRA + KPIs, we'd need onSaveKra to return the new KRA.

    if (!operationError && kraId && formData.kpis && Array.isArray(formData.kpis)) {
      console.log(`[handleKpiFormSubmit] Processing ${formData.kpis.length} KPIs for KRA ID: ${kraId}`);

      // Loop through KPIs and save/update each
      for (const kpi of formData.kpis) {
        const kpiPayload: any = {
          kra_id: kraId, // Link to the parent KRA
          name: kpi.name,
          target: kpi.target || null,
          actual: kpi.actual || null,
          status: mapStatusToDbFormat(kpi.status || 'Not Started'),
          startDate: kpi.startDate || null,
          targetDate: kpi.targetDate || null,
          assignees: kpi.assignees || [],
          description: kpi.description || null,
          comments: kpi.comments || null,
          costAssociated: kpi.costAssociated || null,
          checklist: kpi.checklist || [],
          calculationType: kpi.calculationType || 'manual',
        };

        if (kpi.id) kpiPayload.id = kpi.id;

        try {
          await onSaveKpi(kpiPayload);

          // --- NEW: Sync Task-Linked Checklist Items Back to Tasks ---
          if (onEditTask && kpi.checklist && Array.isArray(kpi.checklist)) {
            for (const item of kpi.checklist) {
              if (item.isTaskLinked && item.taskId) {
                // Find the existing task to compare
                const linkedTask = tasks.find(t => String(t.id) === item.taskId);
                if (linkedTask) {
                  const TASK_DONE_STATUSES = ['completed', 'done'];
                  const isCurrentlyComplete = TASK_DONE_STATUSES.includes(linkedTask.status?.toLowerCase() || '');

                  // If the checklist state diverges from the task state, update the underlying task
                  if (item.checked !== isCurrentlyComplete) {
                    console.log(`[handleKpiFormSubmit] Syncing task ${item.taskId} completion status to ${item.checked}`);
                    await Promise.resolve(onEditTask(item.taskId, {
                      completed: item.checked,
                      status: item.checked ? 'completed' : 'todo'
                    }, { suppressToast: true })).catch(err => {
                      console.error("[handleKpiFormSubmit] Failed to sync checklist item back to task:", err);
                    });
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error("Failed to save KPI", err);
          // continue logic?
        }
      }
    }

    // --- Final Steps ---
    if (!operationError) {
      handleCloseKpiModal();
      // Delay the full data refresh so it doesn't overwrite the optimistic cache update
      // that useSharePointKRAs.update/add already applied via setQueryData.
      // Without this delay, the immediate refetch can return stale SharePoint data
      // (especially for Assignees) before SharePoint indexing catches up.
      setTimeout(() => { onDataRefresh?.(); }, 5000);
    }
  };

  const handleDeleteKra = (kraId: string | number) => {
    // --- MODIFIED --- Find the KRA object and store it
    const kra = krasFromProps.find(k => k.id === kraId);
    if (kra) {
      console.log("Requesting delete confirmation for KRA:", kra.title, kra.id);
      setKraToDelete(kra); // Store the full object
    } else {
      console.error("Could not find KRA to delete:", kraId);
      toast({ title: "Error", description: "Could not find KRA to delete.", variant: "destructive" });
    }
  };

  const confirmDeleteKra = async () => {
    // --- MODIFIED --- Check for object and ID, get ID from object
    if (!kraToDelete?.id) return;

    const idToDelete = String(kraToDelete.id);
    const kraTitle = kraToDelete.title; // Get title for messages
    console.log("Confirming deletion for KRA:", kraTitle, idToDelete);

    try {
      await onDeleteKra(idToDelete);
      console.log("[confirmDeleteKra] KRA deleted. Attempting to call onDataRefresh...");
      onDataRefresh?.();
    } catch (error: any) {
      console.error("Error deleting KRA:", error);
    } finally {
      setKraToDelete(null); // Close the dialog
    }
  };

  const handleDeleteKpiClick = (kraId: string | number, kpi: Kpi) => {
    if (!kpi.id) return;
    setDeletingKpi({
      kraId: String(kraId),
      kpiId: String(kpi.id),
      kpiName: kpi.name || 'Untitled KPI'
    });
  };

  const handleConfirmDeleteKpi = async () => {
    if (!deletingKpi) return;
    try {
      await onDeleteKpi(deletingKpi.kpiId);

      // --- Orphan KRA cleanup ---
      // After deleting the KPI, check if the parent KRA has any remaining KPIs
      const parentKra = krasFromProps.find(k => String(k.id) === deletingKpi.kraId);
      if (parentKra) {
        const remainingKpis = (parentKra.unitKpis || []).filter(
          kpi => String(kpi.id) !== deletingKpi.kpiId
        );
        if (remainingKpis.length === 0) {
          // Check if this KRA title exists as another KRA record (potential duplicate)
          const duplicateKras = krasFromProps.filter(
            k => k.title && parentKra.title &&
              k.title.trim().toLowerCase() === parentKra.title.trim().toLowerCase() &&
              String(k.id) !== deletingKpi.kraId
          );
          if (duplicateKras.length > 0) {
            // This is an orphaned duplicate KRA with no KPIs - auto-delete it
            console.log(`[handleConfirmDeleteKpi] Orphan KRA detected: "${parentKra.title}" (ID: ${parentKra.id}) has no remaining KPIs and duplicates exist. Auto-deleting orphan.`);
            try {
              await onDeleteKra(deletingKpi.kraId);
              toast({ title: "Cleanup", description: `Orphaned duplicate KRA "${parentKra.title}" was automatically removed.` });
            } catch (cleanupError) {
              console.error("[handleConfirmDeleteKpi] Failed to cleanup orphan KRA:", cleanupError);
            }
          }
        }
      }

      onDataRefresh?.();
    } catch (error) {
      console.error("Error deleting KPI:", error);
      toast({ title: "Error", description: "Failed to delete KPI.", variant: "destructive" });
    } finally {
      setDeletingKpi(null);
    }
  };

  const handleOpenAddObjectiveModal = () => {
    setEditingObjective(undefined);
    // Pre-fill data from userContext or auth user
    const ownerName = userContext?.name || user?.user_metadata?.full_name || '';
    const userDivision = userContext?.division || user?.user_metadata?.division || '';
    const userUnit = userContext?.unit || user?.user_metadata?.unit || '';

    setNewObjectiveData({
      title: '',
      description: '',
      status: 'Not Started',
      progress: 0,
      year: new Date().getFullYear().toString(),
      goalType: 'Division',
      division: userDivision,
      unit: userUnit,
      owner: ownerName,
      parentGoalId: '',
      linkedDeliverable: ''
    });
    setIsObjectiveModalOpen(true);
  };

  const handleOpenEditObjectiveModal = (objective: Objective) => {
    setEditingObjective(objective);
    setNewObjectiveData({
      title: objective.title,
      description: objective.description,
      status: objective.status,
      progress: objective.progress,
      year: objective.year,
      goalType: objective.goalType,
      division: objective.division,
      unit: objective.unit,
      owner: objective.owner,
      parentGoalId: objective.parentGoalId?.toString() || '',
      linkedDeliverable: objective.linkedDeliverable || ''
    });
    setIsObjectiveModalOpen(true);
  };

  const handleCloseObjectiveModal = () => {
    setIsObjectiveModalOpen(false);
    setEditingObjective(undefined);
    setNewObjectiveData({
      unit: '',
      owner: '',
      parentGoalId: '',
      linkedDeliverable: ''
    });
  };

  const handleObjectiveFormChange = (field: keyof Objective, value: any) => {
    setNewObjectiveData(prev => {
      const updated = { ...prev, [field]: value };

      // Auto-fill logic when Owner changes
      if (field === 'owner') {
        const details = getEmployeeDetails(value);
        if (details) {
          updated.unit = details.department || updated.unit;
          updated.division = details.divisionName || updated.division;
          updated.division = details.divisionName || updated.division;
          updated.ownerEmail = details.email;
        }
      }

      // Reset linked deliverable if parent goal changes
      if (field === 'parentGoalId') {
        updated.linkedDeliverable = '';
      }

      return updated;
    });
  };

  const handleSaveObjective = async () => {
    if (!newObjectiveData.title || newObjectiveData.title.trim() === '') {
      toast({ title: "Error", description: "Objective name cannot be empty.", variant: "destructive" });
      return;
    }

    setIsSavingObjective(true);

    const objId = editingObjective?.id ? Number(editingObjective.id) : undefined;

    const calculatedStatus = calculateObjectiveStatus(editingObjective || newObjectiveData, kras);

    const objectivePayload: any = {
      ...(objId ? { id: objId } : {}),
      title: newObjectiveData.title,
      description: newObjectiveData.description,
      status: calculatedStatus,
      progress: newObjectiveData.progress,
      year: newObjectiveData.year,
      startDate: newObjectiveData.startDate,
      endDate: newObjectiveData.endDate,
      goalType: newObjectiveData.goalType,
      division: newObjectiveData.division,
      unit: newObjectiveData.unit,
      owner: newObjectiveData.owner,
      parentGoalId: newObjectiveData.parentGoalId || null,
      linkedDeliverable: newObjectiveData.linkedDeliverable || null
    };

    console.log('[handleSaveObjective] Attempting to save objective via parent props:', objectivePayload);

    try {
      await onSaveObjective(objectivePayload);
      handleCloseObjectiveModal();
    } catch (error) {
      console.error('[handleSaveObjective] Parent component failed to save:', error);
      // Toast is handled by parent
    } finally {
      setIsSavingObjective(false);
    }
  };

  const handleDeleteObjective = (objectiveId: string | number) => {
    if (window.confirm("Are you sure you want to delete this objective? This might affect linked KRAs.")) {
      onDeleteObjective(objectiveId);
    }
  };

  // Use activeTab prop here
  const addButtonLabel = activeTab === 'objectives' ? 'Add Objective' : 'Add KRA';
  const handleAddButtonClick = activeTab === 'objectives' ? handleOpenAddObjectiveModal : handleOpenAddKraModal;

  // --- START: Add KPI Timeline Items ---
  const kpiTimelineItems = kras.flatMap(kra =>
    (kra.unitKpis || []).map(kpi => ({
      id: `kpi-${kpi.id}`,
      title: kpi.name || 'Untitled KPI', // Assuming 'name' field exists
      group: kra.id, // Group KPI under its KRA
      start_time: moment(kpi.startDate), // Using startDate instead of start_date
      end_time: moment(kpi.targetDate), // Using targetDate instead of end_date
      itemProps: {
        style: {
          // Style based on KPI status or type - using a distinct color for now
          background: '#2196F3', // Example blue color for KPIs
          color: 'white',
          borderLeft: '3px solid #1976D2', // Add a border to distinguish
        },
      },
      details: `KPI: ${kpi.description || 'No description'}`, // Assuming 'description' field exists
    }))
  );
  // --- END: Add KPI Timeline Items ---

  // Empty arrays for timeline items to prevent errors
  const timelineItems: any[] = [];
  const kraTimelineItems: any[] = [];

  // Need groups based on objectives AND KRAs now for KPIs to group correctly
  const timelineGroups = [
    ...objectivesData.map(obj => ({
      id: obj.id,
      title: `Objective: ${obj.title}`, // Using title instead of name
    })),
    ...kras.map(kra => ({
      id: kra.id,
      title: `KRA: ${kra.title}`, // Using title instead of name
      // Optionally nest under objective: parent: kra.objective_id?.toString()
    }))
  ];

  return (
    <TooltipProvider>
      <div ref={containerRef} className={cn("transition-all duration-300", isFullScreen ? "bg-gray-950 overflow-y-auto" : "")}>
        <Card className={cn("mt-0", isFullScreen ? "border-0 shadow-none h-full bg-gray-950" : "dark:bg-gray-900 dark:border-white/10")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b dark:border-white/10 bg-white/50 dark:bg-gray-800/20 backdrop-blur-sm">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold dark:text-gray-100">{isStaff ? 'KRAs / KPIs' : 'KRAs / KPIs / Objectives'}</CardTitle>
              <CardDescription className="dark:text-gray-400">
                {isStaff ? 'Track performance and view timelines.' : 'Track performance, manage objectives, and view timelines.'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={toggleFullscreen} 
                title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                className="dark:border-white/10 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              {canEdit && (
                <Button
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
                  onClick={handleAddButtonClick}
                >
                  <Plus className="h-4 w-4" /> {addButtonLabel}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
              <div className="flex justify-between items-center px-6 py-4 border-b dark:border-white/10 bg-gray-50/30 dark:bg-gray-800/10">
                <TabsList className="bg-slate-200/50 dark:bg-gray-900 p-1 rounded-xl">
                  <TabsTrigger value="kpis" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-blue-400 dark:text-gray-400">KRA/KPIs</TabsTrigger>
                  {!isStaff && <TabsTrigger value="objectives" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-blue-400 dark:text-gray-400">Objectives</TabsTrigger>}
                  <TabsTrigger value="timeline" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-blue-400 dark:text-gray-400">Timeline</TabsTrigger>
                  <TabsTrigger value="insights" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-blue-400 dark:text-gray-400">Insights</TabsTrigger>
                </TabsList>

                {activeTab === 'timeline' && (
                  <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg border dark:border-white/10 ml-auto mr-4">
                    <Button
                      variant={timelineViewMode === 'quarters' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setTimelineViewMode('quarters')}
                      className="px-3 h-7 text-xs dark:data-[variant=secondary]:bg-gray-700 dark:text-gray-300"
                    >
                      Quarterly
                    </Button>
                    <Button
                      variant={timelineViewMode === 'months' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setTimelineViewMode('months')}
                      className="px-3 h-7 text-xs dark:data-[variant=secondary]:bg-gray-700 dark:text-gray-300"
                    >
                      Monthly
                    </Button>
                    <Button
                      variant={timelineViewMode === 'weeks' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setTimelineViewMode('weeks')}
                      className="px-3 h-7 text-xs dark:data-[variant=secondary]:bg-gray-700 dark:text-gray-300"
                    >
                      Weekly
                    </Button>
                  </div>
                )}
              </div>


              <TabsContent value="kpis">
                <div className="overflow-auto kanban-scrollbar border-x dark:border-white/10 h-[calc(100vh-220px)] relative border-b dark:border-white/10">
                  <table className="w-full caption-bottom text-sm min-w-full table-fixed md:table-auto border-separate border-spacing-0">
                    <TableHeader className="sticky top-0 z-50 bg-gray-50 dark:bg-gray-900">
                      <TableRow className="border-b dark:border-white/10">
                        <TableHead className="w-[150px] min-w-[150px] sticky left-0 top-0 z-[60] bg-gray-50 dark:bg-gray-900 border-r dark:border-white/10 font-bold dark:text-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Objective</TableHead>
                        <TableHead className="w-[180px] min-w-[180px] sticky left-[150px] top-0 z-[60] bg-gray-50 dark:bg-gray-900 border-r dark:border-white/10 font-bold dark:text-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">KRA</TableHead>
                        <TableHead className="w-[100px] min-w-[100px] sticky left-[330px] top-0 z-[60] bg-gray-50 dark:bg-gray-900 border-r dark:border-white/10 font-bold dark:text-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Status</TableHead>
                        <TableHead className="w-[20%] min-w-[200px] sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 border-b dark:border-white/10 font-bold dark:text-gray-200">KPI Deliverables</TableHead>
                        <TableHead className="min-w-[100px] sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 border-b dark:border-white/10 font-bold dark:text-gray-200 text-center">Start</TableHead>
                        <TableHead className="min-w-[100px] sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 border-b dark:border-white/10 font-bold dark:text-gray-200 text-center">Target Date</TableHead>
                        <TableHead className="min-w-[80px] sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 border-b dark:border-white/10 font-bold dark:text-gray-200 text-center">Qtr</TableHead>
                        <TableHead className="min-w-[80px] sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 border-b dark:border-white/10 font-bold dark:text-gray-200 text-right">Target</TableHead>
                        <TableHead className="min-w-[80px] sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 border-b dark:border-white/10 font-bold dark:text-gray-200 text-right">Actual</TableHead>
                        <TableHead className="min-w-[100px] sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 border-b dark:border-white/10 font-bold dark:text-gray-200">KPI Status</TableHead>
                        <TableHead className="min-w-[100px] sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 border-b dark:border-white/10 font-bold dark:text-gray-200 text-right">Cost (K)</TableHead>
                        <TableHead className="min-w-[120px] sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 border-b dark:border-white/10 font-bold dark:text-gray-200">Assignees</TableHead>
                        <TableHead className="min-w-[150px] sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 border-b dark:border-white/10 font-bold dark:text-gray-200">Comments</TableHead>
                        <TableHead className="sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 border-b dark:border-white/10 font-bold dark:text-gray-200">Links</TableHead>
                        <TableHead className="text-right min-w-[100px] sticky right-0 top-0 bg-gray-50 dark:bg-gray-900 border-l dark:border-white/10 border-b dark:border-white/10 z-50 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] font-bold dark:text-gray-200">Actions</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {processedRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={15} className="h-24 text-center dark:text-gray-400">
                            No KPIs found matching the current filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        processedRows.map((row, rowIndex) => {
                          const {
                            kpi,
                            originalKra,
                            isFirstRowOfObjective,
                            objectiveRowSpan,
                            objectiveName,
                            isFirstRowOfKraTitleGroup,
                            kraTitleRowSpan,
                            kraTitle
                          } = row;
                          const targetQuarter = getQuarter(kpi?.target_date || kpi?.targetDate);
                          
                          const linkedTasks = tasks.filter(
                            (task) => task.kpi_id === kpi.id?.toString()
                          );

                          return (
                            <TableRow key={`${originalKra.id}-${kpi?.id || rowIndex}`} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors border-b dark:border-white/10">
                              {isFirstRowOfObjective && (
                                <TableCell className="align-top border-r dark:border-white/10 text-sm font-medium sticky left-0 z-30 bg-white dark:bg-gray-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:text-gray-300" rowSpan={objectiveRowSpan}>
                                  <div className="w-full h-full min-h-full py-2">
                                    {objectiveName}
                                  </div>
                                </TableCell>
                              )}
                              {isFirstRowOfKraTitleGroup && (
                                <TableCell className="align-top border-r dark:border-white/10 sticky left-[150px] z-30 bg-white dark:bg-gray-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:text-gray-300" rowSpan={kraTitleRowSpan}>
                                  <div className="w-full h-full min-h-full py-2 font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {kraTitle}
                                  </div>
                                </TableCell>
                              )}
                              {isFirstRowOfKraTitleGroup && (
                                <TableCell className="align-top border-r dark:border-white/10 sticky left-[330px] z-30 bg-white dark:bg-gray-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" rowSpan={kraTitleRowSpan}>
                                  <div className="w-full h-full min-h-full flex items-center py-2">
                                    <Badge variant={
                                      originalKra.status?.toLowerCase() === 'closed' ? 'secondary' :
                                        originalKra.status?.toLowerCase() === 'in progress' ? 'default' :
                                          'outline'
                                    } className="dark:border-white/20">
                                      {originalKra.status || 'Open'}
                                    </Badge>
                                  </div>
                                </TableCell>
                              )}
                              {/* KPI Cells */}
                              <TableCell className="align-top text-sm border-b dark:border-white/10 dark:text-gray-300 py-4">
                                {kpi?.name !== '-' ? kpi?.name : <span className="text-muted-foreground dark:text-gray-500">-</span>}
                              </TableCell>

                              <TableCell className="align-top text-sm whitespace-nowrap border-b dark:border-white/10 dark:text-gray-400 py-4 text-center">{formatDate(kpi?.start_date || kpi?.startDate)}</TableCell>
                              <TableCell className="align-top text-sm whitespace-nowrap border-b dark:border-white/10 dark:text-gray-400 py-4 text-center">{formatDate(kpi?.target_date || kpi?.targetDate)}</TableCell>
                              <TableCell className="align-top text-sm border-b dark:border-white/10 dark:text-gray-400 py-4 text-center">{targetQuarter}</TableCell>
                              <TableCell className="align-top text-sm text-right font-mono tabular-nums border-b dark:border-white/10 dark:text-gray-300 py-4">{kpi?.target ?? '-'}</TableCell>
                              <TableCell className="align-top text-sm text-right font-mono tabular-nums border-b dark:border-white/10 dark:text-gray-300 py-4">{kpi?.actual ?? '-'}</TableCell>
                              <TableCell className="align-top whitespace-nowrap border-b dark:border-white/10 py-4">
                                {kpi?.status ? <StatusBadge status={kpi.status} /> : <span className="text-muted-foreground dark:text-gray-500">-</span>}
                              </TableCell>
                              <TableCell className="align-top text-sm text-right font-mono tabular-nums border-b dark:border-white/10 dark:text-gray-300 py-4">
                                {kpi?.cost ? `K ${Number(kpi.cost).toLocaleString()}` : <span className="text-muted-foreground dark:text-gray-500">-</span>}
                              </TableCell>
                              <TableCell className="align-top border-b dark:border-white/10 py-4">
                                {kpi?.assignees && kpi.assignees.length > 0 ? (
                                  <div className="flex -space-x-2 overflow-hidden">
                                    {(kpi.assignees as any[]).map((assignee: any, index: number) => (
                                      <Tooltip key={assignee.id || `assignee-${index}`}>
                                        <TooltipTrigger asChild>
                                          <Avatar className="h-6 w-6 border-2 border-white dark:border-gray-900 shadow-sm">
                                            <AvatarImage src={assignee.avatarUrl} />
                                            <AvatarFallback className="dark:bg-gray-800 dark:text-gray-400">{assignee.initials || assignee.name?.substring(0, 2) || '?'}</AvatarFallback>
                                          </Avatar>
                                        </TooltipTrigger>
                                        <TooltipContent className="dark:bg-gray-950 dark:border-white/10"><p>{assignee.name || 'Unknown Assignee'}</p></TooltipContent>
                                      </Tooltip>
                                    ))}
                                  </div>
                                ) : <span className="text-muted-foreground dark:text-gray-500">-</span>}
                              </TableCell>
                              <TableCell className="align-top text-xs text-muted-foreground dark:text-gray-500 border-b dark:border-white/10 py-4 max-w-[150px] truncate">{kpi?.comments || '-'}</TableCell>
                              <TableCell className="align-top border-b dark:border-white/10 py-4">
                                {linkedTasks.length > 0 ? (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" size="sm" className="h-7 py-0.5 px-2 text-[10px] dark:bg-gray-800 dark:border-white/10 dark:text-gray-300 dark:hover:bg-gray-700">
                                        {linkedTasks.length} {linkedTasks.length === 1 ? 'Task' : 'Tasks'}
                                        <ChevronDown className="h-3 w-3 ml-1" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-2 dark:bg-gray-950 dark:border-white/10" container={isFullScreen ? containerRef.current : null}>
                                      <div className="space-y-1">
                                        <p className="font-semibold text-sm mb-1 dark:text-gray-200">Linked Tasks</p>
                                        {linkedTasks.map(task => (
                                          <div key={task.id} className="text-xs p-1.5 bg-muted/50 dark:bg-gray-800/50 rounded-sm dark:text-gray-400">
                                            {task.title}
                                          </div>
                                        ))}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                ) : (
                                  <span className="text-muted-foreground dark:text-gray-500 text-xs">-</span>
                                )}
                              </TableCell>

                              <TableCell className="align-top text-right sticky right-0 bg-white dark:bg-gray-900 border-l dark:border-white/10 px-2 py-1 whitespace-nowrap align-middle border-b dark:border-white/10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                <div className="flex justify-end items-center space-x-1">

                                  {canEdit ? (
                                    <>
                                      {kpi && kpi.id && kpi.name !== '-' && (
                                        <TooltipProvider delayDuration={100}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="p-1 h-8 w-8 text-destructive hover:text-destructive dark:hover:bg-red-900/20"
                                                onClick={() => handleDeleteKpiClick(row.originalKra.id, kpi)}
                                                aria-label="Delete KPI"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="dark:bg-gray-950 dark:border-white/10">Delete KPI</TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                      {kpi && kpi.id && kpi.name !== '-' && (
                                        <TooltipProvider delayDuration={100}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="p-1 h-8 w-8 dark:text-gray-400 dark:hover:bg-gray-800"
                                                onClick={() => handleOpenEditKpiModal(row.originalKra.id, row.kpi)}
                                                aria-label="Edit KPI"
                                              >
                                                <Edit className="h-4 w-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="dark:bg-gray-950 dark:border-white/10">Edit KPI</TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                      <TooltipProvider delayDuration={100}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="p-1 h-8 w-8 mr-1 dark:text-gray-400 dark:hover:bg-gray-800"
                                              onClick={() => handleOpenEditKraModal(row.originalKra)}
                                              aria-label="Edit KRA"
                                            >
                                              <Settings className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent className="dark:bg-gray-950 dark:border-white/10">Edit KRA Settings</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>

                                      <TooltipProvider delayDuration={100}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="p-1 h-8 w-8 text-destructive hover:text-destructive dark:hover:bg-red-900/20"
                                              onClick={() => handleDeleteKra(row.originalKra.id)}
                                              aria-label="Delete KRA"
                                            >
                                              <XCircle className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent className="dark:bg-gray-950 dark:border-white/10">Delete KRA</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </>
                                  ) : (
                                    <>
                                      {kpi && kpi.id && kpi.name !== '-' && (
                                        <TooltipProvider delayDuration={100}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="p-1 h-8 w-8 dark:text-gray-400 dark:hover:bg-gray-800"
                                                onClick={() => handleOpenEditKpiModal(row.originalKra.id, row.kpi)}
                                                aria-label="View KPI"
                                              >
                                                <Eye className="h-4 w-4 text-muted-foreground hover:text-primary dark:hover:text-blue-400" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="dark:bg-gray-950 dark:border-white/10">View KPI Details</TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="objectives">
                <div className="overflow-auto border dark:border-white/10 rounded-xl bg-white dark:bg-gray-950 shadow-sm">
                  <Table>
                    <TableHeader className="bg-gray-50/50 dark:bg-gray-800/50">
                      <TableRow className="dark:border-white/10">
                        <TableHead className="w-[20%] font-bold dark:text-gray-200">Objective Name</TableHead>
                        <TableHead className="w-[20%] font-bold dark:text-gray-200">Strategic Alignment</TableHead>
                        <TableHead className="w-[20%] font-bold dark:text-gray-200">Key Deliverable</TableHead>
                        <TableHead className="w-[10%] font-bold dark:text-gray-200">Goal Type</TableHead>
                        <TableHead className="font-bold dark:text-gray-200">Description</TableHead>
                        <TableHead className="w-[10%] font-bold dark:text-gray-200">Status</TableHead>
                        <TableHead className="w-[10%] text-center font-bold dark:text-gray-200">Progress</TableHead>
                        <TableHead className="text-right w-[10%] font-bold dark:text-gray-200">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {objectivesData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center dark:text-gray-400">
                            No Objectives defined yet. Use the "Add Objective" button.
                          </TableCell>
                        </TableRow>
                      ) : (
                        objectivesData.map((objective) => (
                          <TableRow key={objective.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors dark:border-white/10">
                            <TableCell className="font-bold dark:text-gray-200">{objective.title}</TableCell>
                            <TableCell>
                              {(() => {
                                // Try to resolve title from prop or lookup
                                const title = objective.parentGoalTitle ||
                                  (objective.parentGoalId ? strategicObjectives.find(so => String(so.id) === String(objective.parentGoalId))?.title : null);

                                return title ? (
                                  <Badge variant="outline" className="bg-blue-50/50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/30">
                                    {title}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground dark:text-gray-500 text-[10px] italic">Direct/Board</span>
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              {objective.linkedDeliverable ? (
                                <span className="text-sm font-medium dark:text-gray-300">{objective.linkedDeliverable}</span>
                              ) : (
                                <span className="text-muted-foreground dark:text-gray-500 text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={objective.goalType === 'Org' ? 'default' : 'secondary'}
                                className={cn(
                                  objective.goalType === 'Org' ? 'bg-intranet-primary' : 'dark:bg-gray-800 dark:text-gray-300 dark:border-white/10'
                                )}
                              >
                                {objective.goalType || 'Unit'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground dark:text-gray-400 max-w-[200px] truncate">{objective.description || '-'}</TableCell>
                            <TableCell>
                              <StatusBadge status={calculateObjectiveStatus(objective, kras) || 'Not Started'} />
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const linkedKras = kras.filter(k =>
                                  String(k.objective_id) === String(objective.id) ||
                                  String(k.objectiveId) === String(objective.id)
                                );
                                // Collect all KPIs belonging to these KRAs
                                const linkedKpis = linkedKras.flatMap(k => (k as any).unitKpis || []);
                                const progress = calculateStrategicProgress(linkedKras, linkedKpis);

                                return (
                                  <div className="flex flex-col gap-1 min-w-[80px]">
                                    <div className="flex justify-between text-[10px] font-medium dark:text-gray-400">
                                      <span>{progress}%</span>
                                    </div>
                                    <Progress value={progress} className="h-1.5 dark:bg-gray-800" />
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-right">
                              {canEdit && (
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 dark:text-gray-400 dark:hover:bg-gray-800" onClick={() => handleOpenEditObjectiveModal(objective)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive dark:hover:bg-red-900/20" onClick={() => handleDeleteObjective(objective.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="timeline">
                <div>
                  <KRATimelineTab
                    kras={kras}
                    objectives={objectivesData}
                    viewMode={timelineViewMode}
                    onViewModeChange={setTimelineViewMode}
                  />
                </div>
              </TabsContent>

              <TabsContent value="insights">
                <KRAInsightsTab kras={kras} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <KpiModal
          isOpen={isKpiModalOpen}
          onClose={handleCloseKpiModal}
          kraData={editingKra}
          onSubmit={handleKpiFormSubmit}
          staffMembers={staffMembers}
          objectives={objectivesData}
          units={units}
          existingKraTitles={existingKraTitles}
          existingKraObjects={existingKraObjects}
          userContext={userContext}
          editingKpi={editingKpiDetails}
          container={isFullScreen ? containerRef.current : null}
          isReadOnly={!canEdit}
        />

        <Dialog open={isObjectiveModalOpen} onOpenChange={handleCloseObjectiveModal}>
          <DialogContent className="sm:max-w-3xl dark:bg-gray-950 dark:border-white/10" container={isFullScreen ? containerRef.current : null}>
            <DialogHeader>
              <DialogTitle className="dark:text-gray-100">{editingObjective ? 'Edit Objective' : 'Add New Objective'}</DialogTitle>
              <DialogDescription className="dark:text-gray-400">
                {editingObjective ? 'Update the objective details.' : 'Define a new objective for KRAs.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto px-2 kanban-scrollbar">
              {/* Strategic Alignment */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right whitespace-nowrap dark:text-gray-300">Strategic Alignment</Label>
                <div className="col-span-3">
                  <Select
                    value={newObjectiveData.parentGoalId?.toString() || 'none'}
                    onValueChange={(val) => handleObjectiveFormChange('parentGoalId', val === 'none' ? null : val)}
                    disabled={isSavingObjective}
                  >
                    <SelectTrigger className="dark:bg-gray-900 dark:border-white/10 dark:text-gray-100">
                      <SelectValue placeholder="Align with Strategic Objective..." />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-950 dark:border-white/10">
                      <SelectItem value="none">Standalone (No Alignment)</SelectItem>
                      {(strategicObjectives.length > 0 ? strategicObjectives : objectivesData)
                        .map(obj => (
                          <SelectItem key={obj.id} value={obj.id.toString()}>
                            {obj.title}
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground dark:text-gray-500 mt-1">
                    Link this unit objective to a high-level Board/Strategic objective.
                  </p>
                </div>
              </div>

              {/* Key Deliverables (Executions) Radio Group */}
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right whitespace-nowrap pt-2 dark:text-gray-300">
                  Key Deliverable<br />
                  <span className="text-[10px] text-muted-foreground dark:text-gray-500 font-normal">(Execution)</span>
                </Label>
                <div className="col-span-3">
                  {(() => {
                    if (!newObjectiveData.parentGoalId || newObjectiveData.parentGoalId === 'none') {
                      return (
                        <div className="p-3 rounded-md border border-dashed dark:border-white/20 text-sm text-muted-foreground dark:text-gray-500 bg-muted/30 dark:bg-gray-900/50">
                          Please select a <strong>Strategic Alignment</strong> above to see linked Executions/Deliverables.
                        </div>
                      );
                    }

                    const parentParams = (strategicObjectives.length > 0 ? strategicObjectives : objectivesData).find(o => o.id.toString() === newObjectiveData.parentGoalId);
                    const deliverables = parentParams?.deliverables || [];

                    if (deliverables.length === 0) {
                      return <p className="text-sm text-red-500 pt-2 font-medium">No key resource areas (KRAs) found for the selected objective.</p>;
                    }

                    return (
                      <RadioGroup
                        value={newObjectiveData.linkedDeliverable || ''}
                        onValueChange={(val) => handleObjectiveFormChange('linkedDeliverable', val)}
                        className="flex flex-col space-y-2 mt-2"
                        disabled={isSavingObjective}
                      >
                        {deliverables.map((del, idx) => (
                          <div key={idx} className="flex items-center space-x-2">
                            <RadioGroupItem value={del} id={`del-${idx}`} className="dark:border-white/20" />
                            <Label htmlFor={`del-${idx}`} className="font-normal cursor-pointer dark:text-gray-300">
                              {del}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    );
                  })()}
                  <p className="text-[10px] text-muted-foreground dark:text-gray-500 mt-2">
                    Select the specific Execution/Deliverable this unit objective contributes to.
                  </p>
                </div>
              </div>

              {/* Row 1: Title & Year */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="objective-name" className="text-right dark:text-gray-300">Name</Label>
                <Input
                  id="objective-name"
                  value={newObjectiveData.title || ''}
                  onChange={(e) => handleObjectiveFormChange('title', e.target.value)}
                  className="col-span-3 dark:bg-gray-900 dark:border-white/10 dark:text-gray-100"
                  disabled={isSavingObjective}
                  required
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="objective-year" className="text-right dark:text-gray-300">Year</Label>
                <Input
                  id="objective-year"
                  value={newObjectiveData.year || ''}
                  onChange={(e) => handleObjectiveFormChange('year', e.target.value)}
                  className="col-span-3 dark:bg-gray-900 dark:border-white/10 dark:text-gray-100"
                  placeholder="e.g. 2024"
                  disabled={isSavingObjective}
                />
              </div>

              {/* Row 2: Owner Selection */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right dark:text-gray-300">Owner</Label>
                <div className="col-span-3">
                  <Popover open={isOwnerPopoverOpen} onOpenChange={setIsOwnerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isOwnerPopoverOpen}
                        className="w-full justify-between dark:bg-gray-900 dark:border-white/10 dark:text-gray-100 dark:hover:bg-gray-800"
                        disabled={isSavingObjective}
                      >
                        {newObjectiveData.owner || "Select Owner..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 dark:bg-gray-950 dark:border-white/10" container={isFullScreen ? containerRef.current : null}>
                      <Command className="dark:bg-gray-950">
                        <CommandInput placeholder="Search employee..." className="dark:text-gray-100 dark:border-white/10" />
                        <CommandList>
                          <CommandEmpty className="dark:text-gray-400">No employee found.</CommandEmpty>
                          <CommandGroup>
                            {!isLoadingEmployees && employees && employees.map((employee: any) => (
                              <CommandItem
                                key={employee.id}
                                value={employee.displayName}
                                className="dark:text-gray-100 dark:hover:bg-gray-800"
                                onSelect={(currentValue) => {
                                  handleObjectiveFormChange('owner', currentValue);
                                  setIsOwnerPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    newObjectiveData.owner === employee.displayName ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {employee.displayName}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Row 3: Division & Unit (Auto-filled) */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right dark:text-gray-300">Division</Label>
                <Input
                  value={newObjectiveData.division || ''}
                  readOnly
                  className="col-span-3 bg-muted dark:bg-gray-800 dark:text-gray-400 dark:border-white/10"
                  placeholder="Auto-filled based on Owner"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right dark:text-gray-300">Unit</Label>
                <Input
                  value={newObjectiveData.unit || ''}
                  readOnly
                  className="col-span-3 bg-muted dark:bg-gray-800 dark:text-gray-400 dark:border-white/10"
                  placeholder="Auto-filled based on Owner"
                />
              </div>

              {/* Row 4: Status & Progress */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right dark:text-gray-300">Status</Label>
                <div className="col-span-3">
                  <Input
                    value={calculateObjectiveStatus(editingObjective || newObjectiveData, kras)}
                    readOnly
                    className="bg-muted text-muted-foreground dark:bg-gray-800 dark:text-gray-500 dark:border-white/10"
                    title="Status is automatically calculated from linked KRAs and KPIs."
                  />
                  <p className="text-[10px] text-muted-foreground dark:text-gray-500 mt-1">
                    Status is automatically calculated from linked KRAs and KPIs progress.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right dark:text-gray-300">Goal Type</Label>
                <div className="col-span-3">
                  <Select
                    value={newObjectiveData.goalType}
                    onValueChange={(val) => handleObjectiveFormChange('goalType', val)}
                    disabled={isSavingObjective}
                  >
                    <SelectTrigger className="w-full dark:bg-gray-900 dark:border-white/10 dark:text-gray-100">
                      <SelectValue placeholder="Select Goal Type" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-950 dark:border-white/10" container={isFullScreen ? containerRef.current : null}>
                      <SelectItem value="Org">Org (Board/Strategic)</SelectItem>
                      <SelectItem value="Division">Division</SelectItem>
                      <SelectItem value="Unit">Unit</SelectItem>
                      <SelectItem value="Individual">Individual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right dark:text-gray-300">Start Date</Label>
                <div className="col-span-3">
                  <DatePicker
                    date={newObjectiveData.startDate ? new Date(newObjectiveData.startDate) : undefined}
                    setDate={(date) => handleObjectiveFormChange('startDate', date)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right dark:text-gray-300">End Date</Label>
                <div className="col-span-3">
                  <DatePicker
                    date={newObjectiveData.endDate ? new Date(newObjectiveData.endDate) : undefined}
                    setDate={(date) => handleObjectiveFormChange('endDate', date)}
                  />
                </div>
              </div>


              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="objective-description" className="text-right pt-2 dark:text-gray-300">
                  Description
                </Label>
                <Textarea
                  id="objective-description"
                  value={newObjectiveData.description || ''}
                  onChange={(e) => handleObjectiveFormChange('description', e.target.value)}
                  className="col-span-3 dark:bg-gray-900 dark:border-white/10 dark:text-gray-100 focus-visible:ring-blue-500"
                  rows={5}
                />
              </div>
            </div>
            <DialogFooter className="dark:border-t dark:border-white/10 pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="dark:bg-transparent dark:border-white/20 dark:text-gray-300 dark:hover:bg-gray-900" disabled={isSavingObjective}>Cancel</Button>
              </DialogClose>
              <Button type="button" onClick={handleSaveObjective} disabled={isSavingObjective} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20">
                {isSavingObjective ? <Loader2 size={16} className="animate-spin" /> : null}
                <span>{isSavingObjective ? 'Saving...' : 'Save Objective'}</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={kraToDelete !== null} onOpenChange={(open) => !open && setKraToDelete(null)}>
          <AlertDialogContent className="dark:bg-gray-950 dark:border-white/10" container={isFullScreen ? containerRef.current : null}>
            <AlertDialogHeader>
              <AlertDialogTitle className="dark:text-gray-100">Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription className="dark:text-gray-400">
                This action cannot be undone. This will permanently delete the Key Result
                Area <strong>"{kraToDelete?.title}"</strong> and all of its associated KPIs.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="dark:border-t dark:border-white/10 pt-4 mt-2">
              <AlertDialogCancel className="dark:bg-transparent dark:border-white/20 dark:text-gray-300 dark:hover:bg-gray-900" onClick={() => setKraToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteKra} className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 text-white shadow-lg shadow-red-500/20">
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>


      {/* Delete/Archive Confirmation Dialog */}
      <AlertDialog open={!!deletingKpi} onOpenChange={(open) => !open && setDeletingKpi(null)}>
        <AlertDialogContent className="dark:bg-gray-950 dark:border-white/10" container={isFullScreen ? containerRef.current : null}>
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-gray-100">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-400">
              This will permanently delete the KPI "{deletingKpi?.kpiName}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="dark:border-t dark:border-white/10 pt-4 mt-2">
            <AlertDialogCancel className="dark:bg-transparent dark:border-white/20 dark:text-gray-300 dark:hover:bg-gray-900">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 text-white shadow-lg shadow-red-500/20"
              onClick={handleConfirmDeleteKpi}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider >
  );
};

export default KRAsTab;
