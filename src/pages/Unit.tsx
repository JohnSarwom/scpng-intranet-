import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import PageLayout from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  CalendarIcon, ChevronDownIcon, Inbox, LayoutGrid, Loader2,
  Mail, MoreVertical, Settings, MoreHorizontal,
  AlertTriangle, CheckCircle, Clock, Target, Calendar, BarChart2,
  Flag, Briefcase, Download, ArrowUp, ArrowDown, Upload, Play, ArrowRight,
  Edit, Eye, FileText, Filter, Plus, Trash2, User as UserIcon,
  Kanban,
  List
} from 'lucide-react';
import { Logger } from '@/utils/logger';
import { toast } from '@/components/ui/use-toast';
import KRATimeline from '@/components/KRATimeline';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Pie,
  Cell,
  ResponsiveContainer,
  Line,
  PieChart as RechartsPieChart,
  BarChart,
  LineChart
} from 'recharts';
import { useToast } from "@/components/ui/use-toast";
import KRATimelineTab from '@/components/KRATimelineTab';
import KRAInsightsTab from '@/components/KRAInsightsTab';

// Import unit-tabs components
import { KRAsTab } from '@/components/unit-tabs/KRAsTab';
import { useTaskGroupPreferences } from '@/hooks/useTaskGroupPreferences'; // Import preference hook

// Import modal components
import DailyLogModal from '@/components/unit-tabs/modals/DailyLogModal';
import AddTaskModal from '@/components/unit-tabs/modals/AddTaskModal';
import EditTaskModal from '@/components/unit-tabs/modals/EditTaskModal';
import DeleteModal from '@/components/unit-tabs/modals/DeleteModal';
import AddProjectModal from '@/components/unit-tabs/modals/AddProjectModal';
import EditProjectModal from '@/components/unit-tabs/modals/EditProjectModal';
import AddRiskModal from '@/components/unit-tabs/modals/AddRiskModal';
import EditRiskModal from '@/components/unit-tabs/modals/EditRiskModal';

import {
  useSharePointKRAs,
  useSharePointKPIs,
  useSharePointProjects,
  useSharePointTasks,
  useSharePointObjectives
} from '@/hooks/useSharePointOps';
import { useStrategySharePoint } from '@/hooks/useStrategySharePoint';

import { OrganizationUnit, Objective, Kra, Kpi, KRA, KPI, Task } from '@/types';
import { useStaffByDepartment } from '@/hooks/useStaffByDepartment';
import { StaffMember } from '@/types/staff';

import DivisionStaffMap from '@/utils/divisionStaffMap';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useGraphProfile } from '@/hooks/useGraphProfile';

// Import tab components
import TaskDialog from '@/components/unit-tabs/TaskDialog';
import { TasksTab, initialBuckets, Bucket } from '@/components/unit-tabs/TasksTab';
import { ProjectsTab } from '@/components/unit-tabs/ProjectsTab';
import { OverviewTab } from '@/components/unit-tabs/OverviewTab';
import { ReportsTab } from '@/components/unit-tabs/ReportsTab';


import { SharePointListSetupService } from '@/services/sharePointListSetupService';
import { getGraphClient } from '@/services/graphService';
import { useMsal } from '@azure/msal-react';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';


// Define status options for dropdowns
const statusOptions = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' }
];

type ViewMode = 'board' | 'grid' | 'list';

// Define structure for unit data (now representing departments)
interface UnitData {
  id: string; // Use department name as ID
  name: string;
}

interface IdentifiableWithStringId {
  id?: string; // Ensure id is always string for this hook context
  assigned_to_email?: string | null;
}

// Type assertion helper if needed, but often casting directly is fine
function ensureStringId<T extends { id?: string | number }>(item: T): T & { id?: string } {
  return { ...item, id: item.id?.toString() };
}

// StatusDropdown Component
const StatusDropdown: React.FC<{
  currentStatus: string,
  onStatusChange: (newStatus: string) => void,
  options?: Array<{ value: string, label: string }>,
}> = ({
  currentStatus,
  onStatusChange,
  options = statusOptions,
}) => {
    return (
      <Select defaultValue={currentStatus} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

// Define the main Unit component
const Unit = () => {
  const { user } = useSupabaseAuth();
  const { staffMembers, currentUserDepartment } = useStaffByDepartment();
  const { toast } = useToast();

  // Determine effective department for filtering
  // Use a default or the logged-in user's department
  // If no department found, it fetches all (good for Admin) or none. 
  // For now let's default to fetching all if undefined, or pass what we have.
  const targetDepartment = currentUserDepartment || user?.user_metadata?.divisionName;
  // console.log('🔍 [Unit.tsx] targetDepartment:', targetDepartment);

  // Read view settings
  const [viewSettings, setViewSettings] = useState<any[]>([]);
  useEffect(() => {
    const saved = localStorage.getItem('unitopia_view_settings');
    if (saved) {
      try { setViewSettings(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  const getScopeForComponent = (componentName: string, defaultScope: 'Division' | 'Unit' = 'Division') => {
    const config = viewSettings.find(c => c.component === componentName);
    return config ? config.scope : defaultScope;
  };

  // USE GRAPH PROFILE for Context (Matches Settings Page)
  const { profile: graphProfile } = useGraphProfile();

  // Move roleUser hook BEFORE userContext to avoid reference error
  const { user: roleUser } = useRoleBasedAuth();

  const userContext = useMemo(() => ({
    // Prioritize Graph Profile (matches 'User Information' page), fallback to Supabase
    division: graphProfile?.officeLocation || user?.user_metadata?.divisionName || 'General',
    unit: graphProfile?.department || user?.user_metadata?.unitName || 'General',
    email: graphProfile?.mail || user?.email || '',
    name: graphProfile?.displayName || user?.user_metadata?.full_name || user?.email || '',
    role: roleUser?.role_name
  }), [user, graphProfile, roleUser]);

  // Initialize data states first
  // Switched to SharePoint Hooks
  const taskState = useSharePointTasks(targetDepartment, getScopeForComponent('Tasks', 'Unit'), userContext);
  const projectState = useSharePointProjects(targetDepartment, getScopeForComponent('Projects', 'Unit'), userContext);
  const kraState = useSharePointKRAs(targetDepartment, getScopeForComponent('KRAs', 'Division'), userContext);
  const kpiState = useSharePointKPIs(targetDepartment, userContext);


  // SharePoint List Setup
  const { instance: msalInstance } = useMsal();

  const [isSettingUpLists, setIsSettingUpLists] = useState(false);

  // Active Tab State for the main page sections
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [kraSectionTab, setKraSectionTab] = useState<string>("kpis"); // Renamed from kraSectionTab
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDailyLogOpen, setIsDailyLogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [taskBuckets, setTaskBuckets] = useState<Bucket[]>(initialBuckets);


  const objectivesState = useSharePointObjectives(targetDepartment, getScopeForComponent('Objectives', 'Division'), userContext);
  const objectivesData = objectivesState.data;
  const objectivesLoading = objectivesState.loading;
  const objectivesError = objectivesState.error;

  // Fetch Strategy Data for Dropdown
  const { strategyData } = useStrategySharePoint();
  const strategicObjectives = useMemo(() => {
    return (strategyData.objectives || []).map(obj => ({
      id: obj.id,
      title: obj.title,
      description: obj.description,
      deliverables: (obj as any).goals || [] // Map goals to deliverables
    }));
  }, [strategyData.objectives]);

  // --- Permission Logic ---
  // Only Managers and Admins can Add/Edit/Delete KRAs and KPIs
  const canEditStrategy = useMemo(() => {
    const role = roleUser?.role_name?.toLowerCase();
    const isAdmin = roleUser?.is_admin || role === 'super_admin' || role === 'admin';
    const isManager = role === 'manager';
    return isAdmin || isManager;
  }, [roleUser]);

  // --- Wrapper for refreshing all data ---
  const handleRefreshAllData = useCallback(() => {
    objectivesState.refresh();
    kraState.refresh?.();
    kpiState.refresh?.();
    taskState.refresh?.();
    projectState.refresh?.();
  }, [objectivesState, kraState, kpiState, taskState, projectState]);

  // --- Modified Objective Handlers (Moved Down) ---
  const handleSaveObjective = useCallback(async (objective: Objective) => {
    if (!canEditStrategy) {
      toast({ title: "Permission Denied", description: "Only Managers can edit Objectives.", variant: "destructive" });
      return;
    }
    try {
      if (objective.id) {
        await objectivesState.update(String(objective.id), objective);
      } else {
        await objectivesState.add(objective);
      }
      toast({ title: "Success", description: "Objective saved to SharePoint." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to save objective", variant: "destructive" });
      throw e;
    }
  }, [objectivesState, canEditStrategy]);

  const handleDeleteObjective = useCallback(async (objectiveId: string | number) => {
    if (!canEditStrategy) {
      toast({ title: "Permission Denied", description: "Only Managers can delete Objectives.", variant: "destructive" });
      return;
    }
    try {
      await objectivesState.remove(String(objectiveId));
      toast({ title: "Success", description: "Objective deleted from SharePoint." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to delete objective", variant: "destructive" });
      throw e;
    }
  }, [objectivesState, canEditStrategy]);

  const handleSaveKra = useCallback(async (kra: Partial<KRA> | Partial<Kra>) => {
    if (!canEditStrategy) {
      toast({ title: "Permission Denied", description: "Only Managers can edit KRAs.", variant: "destructive" });
      throw new Error("Permission Denied");
    }
    try {
      let result;
      // Cast to any to bypass string/number id mismatch and different status unions
      const kraData = kra as any;
      if (kraData.id) {
        result = await kraState.update(String(kraData.id), kraData);
      } else {
        result = await kraState.add(kraData);
      }
      toast({ title: "Success", description: "KRA saved to SharePoint." });
      return result;
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to save KRA", variant: "destructive" });
      throw e;
    }
  }, [kraState, canEditStrategy]);

  const handleDeleteKra = useCallback(async (kraId: string | number) => {
    if (!canEditStrategy) {
      toast({ title: "Permission Denied", description: "Only Managers can delete KRAs.", variant: "destructive" });
      return;
    }
    try {
      await kraState.remove(String(kraId));
      toast({ title: "Success", description: "KRA deleted from SharePoint." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to delete KRA", variant: "destructive" });
      throw e;
    }
  }, [kraState, canEditStrategy]);

  const handleSaveKpi = useCallback(async (kpi: Partial<Kpi>) => {
    if (!canEditStrategy) {
      toast({ title: "Permission Denied", description: "Only Managers can edit KPIs.", variant: "destructive" });
      return;
    }
    try {
      // Logic to distinguish add/update: check if it has a real ID (SharePoint IDs are usually integers as strings)
      // If it's a new temporary item, it won't have a numeric ID from SP yet.
      // Assuming if ID is present and not matching 'temp', it's update.
      if (kpi.id && String(kpi.id).length < 10 && !String(kpi.id).startsWith('temp')) {
        await kpiState.update(String(kpi.id), kpi);
      } else {
        // Remove temp ID before sending if present? SP doesn't care about extra fields usually but clean is better
        const { id, ...kpiData } = kpi;
        await kpiState.add(kpiData);
      }
      toast({ title: "Success", description: "KPI saved to SharePoint." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to save KPI", variant: "destructive" });
      throw e;
    }
  }, [kpiState, canEditStrategy]);

  const handleDeleteKpi = useCallback(async (kpiId: string | number) => {
    if (!canEditStrategy) {
      toast({ title: "Permission Denied", description: "Only Managers can delete KPIs.", variant: "destructive" });
      return;
    }
    try {
      await kpiState.remove(String(kpiId));
      toast({ title: "Success", description: "KPI deleted from SharePoint." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to delete KPI", variant: "destructive" });
      throw e;
    }
  }, [kpiState, canEditStrategy]);

  // Create/Task Handlers
  const handleCreateTask = () => {
    setEditingTask(null);
    setIsDialogOpen(true);
  };

  const handleTaskSubmit = (taskData: Partial<Task>) => {
    if (editingTask) {
      // Safe to ignore id mismatch for now as we deal with mocked writes
      // @ts-ignore
      taskState.update(editingTask.id, { ...taskData, unit_id: userContext.unit });
    } else {
      // @ts-ignore
      taskState.add({ ...taskData, unit_id: userContext.unit } as Omit<Task, 'id'>);
    }
    setIsDialogOpen(false);
  };

  // SharePoint List Setup Handler
  const handleSetupStrategyLists = async () => {
    // Check if user is admin (SharePoint uses is_admin, not role_level)
    if (!roleUser?.is_admin) {
      toast({
        title: "Permission Denied",
        description: "Only admins can create SharePoint lists",
        variant: "destructive"
      });
      return;
    }

    setIsSettingUpLists(true);

    try {
      toast({
        title: "Creating SharePoint Lists",
        description: "This may take a minute...",
      });

      // Get Graph client
      const graphClient = await getGraphClient(msalInstance);
      if (!graphClient) {
        throw new Error('Failed to get Graph client');
      }

      // Get site ID
      const site = await graphClient
        .api('/sites/scpng1.sharepoint.com:/sites/scpngintranet')
        .get();

      // Create setup service
      const setupService = new SharePointListSetupService(graphClient, site.id);

      // Check if lists already exist
      const { exists, lists } = await setupService.checkExistingLists();

      if (exists) {
        toast({
          title: "Lists Already Exist",
          description: `Found existing lists: ${lists.join(', ')}`,
          variant: "destructive"
        });
        setIsSettingUpLists(false);
        return;
      }

      // Create all lists
      const result = await setupService.createAllLists();

      if (result.success) {
        toast({
          title: "✅ Success!",
          description: "All Strategy lists created successfully with sample data",
        });
      } else {
        throw new Error(result.message);
      }

    } catch (error: any) {
      console.error('Failed to setup lists:', error);
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to create SharePoint lists",
        variant: "destructive"
      });
    } finally {
      setIsSettingUpLists(false);
    }
  };

  // --- Derive Departments from DivisionStaffMap ---
  const derivedUnits = useMemo((): UnitData[] => {
    try {
      const allStaff = DivisionStaffMap.getAllStaff();
      // Safely access department with type check
      const departmentNames = allStaff
        .map(staff => ('department' in staff ? staff.department : null))
        .filter(Boolean) as string[];
      const uniqueDepartmentNames = Array.from(new Set(departmentNames));
      return uniqueDepartmentNames.map(name => ({ id: name, name: name }));
    } catch (error) {
      console.error("Error deriving units from DivisionStaffMap:", error);
      return [];
    }
  }, []);

  // --- Effect to load data on mount ---
  useEffect(() => {
    // Objectives are handled by the hook
    taskState.refresh?.();
    projectState.refresh?.();
    kraState.refresh?.();
    kpiState.refresh?.();
  }, [taskState.refresh, projectState.refresh, kraState.refresh, kpiState.refresh]);

  // --- Combine KRAs and KPIs --- 
  const combinedKrasForTabs = useMemo(() => {
    const kras = kraState.data || [];
    const kpis = kpiState.data || [];

    const kpisByKraId = kpis.reduce((acc, kpi) => {
      const kraId = kpi.kra_id;
      if (kraId) {
        if (!acc[kraId]) {
          acc[kraId] = [];
        }
        acc[kraId].push(kpi);
      }
      return acc;
    }, {} as Record<string | number, Kpi[]>);

    return kras.map((kra): Kra => {
      const kpisForKra: Kpi[] = kpisByKraId[kra.id] || [];
      return {
        ...kra,
        unitKpis: kpisForKra,
      };
    });
  }, [kraState.data, kpiState.data]);

  // --- Combine KRAs and KPIs for Overview ---
  const combinedKrasForOverview = useMemo(() => {
    const kpis = kpiState.data || [];
    const kpisByKraId = kpis.reduce((acc, kpi) => {
      const kraId = kpi.kra_id;
      if (kraId) {
        if (!acc[kraId]) {
          acc[kraId] = [];
        }
        acc[kraId].push(kpi);
      }
      return acc;
    }, {} as Record<string | number, Kpi[]>);

    return (kraState.data || []).map((kra): KRA => {
      const objective = objectivesData.find(o => String(o.id) === String(kra.objective_id));
      const kraKpis = kpisByKraId[kra.id] || [];

      // Map KraStatus to KRA status
      let mappedStatus: 'open' | 'in-progress' | 'closed' = 'open';
      if (kra.status === 'completed') mappedStatus = 'closed';
      else if (kra.status === 'on-track' || kra.status === 'at-risk' || kra.status === 'off-track') mappedStatus = 'in-progress';

      return {
        id: kra.id.toString(),
        name: kra.title,
        objectiveId: kra.objective_id?.toString() ?? '',
        objectiveName: objective?.title ?? 'N/A',
        department: kra.department ?? 'N/A',
        responsible: kra.owner?.name ?? 'N/A',
        startDate: kra.startDate ? new Date(kra.startDate) : new Date(),
        endDate: kra.targetDate ? new Date(kra.targetDate) : new Date(),
        progress: (kra as any).progress || 0,
        status: mappedStatus,
        kpis: kraKpis.map(k => ({
          ...k,
          id: k.id.toString(),
          date: k.startDate ? new Date(k.startDate) : new Date(),
          notes: k.comments || '',
          target: k.target.toString(),
          actual: k.actual?.toString() || '0',
          status: (k.status === 'on-track' || k.status === 'at-risk' || k.status === 'behind' || k.status === 'completed') ? k.status : 'on-track',
        })) as unknown as KPI[], // Cast to KPI[] as strict mapping might still miss fields
        createdAt: kra.createdAt ?? new Date().toISOString(),
        updatedAt: kra.updatedAt ?? new Date().toISOString(),
        title: kra.title,
        objective_id: kra.objective_id,
        unit: kra.unit,
        unitId: kra.unitId,
        targetDate: kra.targetDate,
        unitKpis: kraKpis,
        owner: kra.owner,
        ownerId: kra.ownerId,
        unitObjectives: kra.unitObjectives,
      };
    });
  }, [kraState.data, objectivesData, kpiState.data]);

  // Determine if data loading is complete
  const isDataLoading = objectivesLoading || taskState.loading || projectState.loading || kraState.loading || kpiState.loading;
  // Determine if there was an error
  const hasDataLoadingError = objectivesError || taskState.error || projectState.error || kraState.error || kpiState.error;

  // Sync Custom Groups from SharePoint Projects & Handle Orphans
  // Optimized with useMemo to prevent excessive re-calculations
  const calculatedBuckets = useMemo(() => {
    if (!projectState.data) return initialBuckets;

    const customGroups: Bucket[] = projectState.data
      .filter(p => {
        if (!p.isCustomGroup) return false;

        // Personal Custom Group Logic:
        // 1. Creator always sees it
        const isCreator = p.authorEmail?.toLowerCase() === userContext.email?.toLowerCase();
        // 2. Admins see everything
        const isAdmin = userContext.role === 'admin' || userContext.role === 'super_admin';
        // 3. Assignees of tasks in this group see it
        const hasAssignedTask = taskState.data?.some(t =>
          t.projectId === String(p.id) &&
          (t.assignedTo?.toLowerCase() === userContext.email?.toLowerCase() ||
            t.assignees?.some(a => a.email?.toLowerCase() === userContext.email?.toLowerCase()))
        );

        if (isCreator || isAdmin || hasAssignedTask) {
          return true;
        }

        return false;
      })
      .map(p => ({
        id: p.id,
        title: p.name,
        isCustom: true
      }));

    // Combine initial buckets with loaded custom groups
    const uniqueBuckets = [...initialBuckets];
    customGroups.forEach(g => {
      if (!uniqueBuckets.find(b => b.id === g.id)) {
        uniqueBuckets.push(g);
      }
    });

    // 🚨 VIRTUAL BUCKET LOGIC: "Shared Tasks"
    // Identify tasks that:
    // 1. Are visible to the user (filtered by useSharePointTasks)
    // 2. Have a projectId that matches NO visible bucket
    // 3. Are from a different unit (cross-unit assignment)
    // 4. Are assigned to user but have no project (fallback)
    const allBucketIds = new Set(uniqueBuckets.map(b => b.id));

    // Logger.debug(`🔍 [Virtual Bucket Debug] Checking ${taskState.data?.length || 0} tasks for orphans. User: ${userContext.email}, Unit: ${userContext.unit}`);

    const orphanedTasks = taskState.data?.filter(t => {
      // Orphan condition 1: Has projectId but bucket is missing
      const hasOrphanedProject = t.projectId && !allBucketIds.has(t.projectId) && t.projectId !== 'undefined';

      // Orphan condition 2: From another unit (cross-unit assignment)
      const isCrossUnit = t.unit_id && t.unit_id !== userContext.unit;

      // Orphan condition 3: Assigned to user but no matching project (fallback)
      const isAssignedOrphan = !t.projectId &&
        (t.assignees?.some(a => a.email?.toLowerCase() === userContext.email?.toLowerCase()) ||
          t.assignedTo?.toLowerCase() === userContext.email?.toLowerCase());

      const isOrphaned = hasOrphanedProject || isCrossUnit || isAssignedOrphan;

      // if (isOrphaned) {
      //   Logger.debug(
      //     `🔍 [Orphaned Task] "${t.title}" | ` +
      //     `u: "${t.unit_id}" vs "${userContext.unit}" | ` +
      //     `p: "${t.projectId}"`
      //   );
      // }

      return isOrphaned;
    }) || [];

    if (orphanedTasks.length > 0) {
      // Logger.info(`📦 [Virtual Bucket] Adding 'Shared Projects' bucket (${orphanedTasks.length} tasks)`);
      uniqueBuckets.push({
        id: 'shared-tasks-virtual', // Special ID
        title: 'Shared Projects',
        isCustom: true,
      });
    }

    return uniqueBuckets;
  }, [projectState.data, taskState.data, userContext.email, userContext.unit, userContext.role]);

  // Only update state if buckets actually changed to avoid re-render loops
  useEffect(() => {
    const isDifferent = calculatedBuckets.length !== taskBuckets.length ||
      calculatedBuckets.some((b, i) => b.id !== taskBuckets[i].id || b.title !== taskBuckets[i].title);

    if (isDifferent) {
      // console.log('🔄 [Unit] Updating task buckets state');
      setTaskBuckets(calculatedBuckets);
    }
  }, [calculatedBuckets, taskBuckets]);

  // User Preferences for Task Groups
  const {
    preferences,
    loading: preferencesLoading,
    hideGroup,
    renameGroup
  } = useTaskGroupPreferences();

  const handleRenameGroup = async (groupId: string, newTitle: string) => {
    // Check if it matches an initial bucket or custom group
    const group = taskBuckets.find(b => b.id === groupId);
    if (group) {
      await renameGroup(groupId, newTitle);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    const isDefault = initialBuckets.some(b => b.id === groupId);
    if (isDefault) {
      // Default groups are only hidden, not deleted from SP
      await hideGroup(groupId);
      toast({
        title: "Group Hidden",
        description: "Default groups are hidden from your view but not deleted permanently."
      });
    } else {
      // Custom groups - try to delete proper
      if (projectState.remove) {
        try {
          await projectState.remove(groupId);
        } catch (e) {
          // If delete failed, or effectively if we want to support hiding custom groups too, we could hide
          // But usually custom groups should be fully deletable
          console.error("Failed to delete custom group", e);
        }
      }
    }
  };


  // Apply preferences to buckets
  const visibleBuckets = useMemo(() => {
    // If loading and NO preferences (new user/empty cache), return empty to trigger loading UI
    if (preferencesLoading && (!preferences || (Object.keys(preferences.renamedGroups).length === 0 && preferences.hiddenGroups.length === 0))) {
      return [];
    }

    let filtered = taskBuckets.filter(b => !preferences.hiddenGroups.includes(b.id));

    // Apply renames
    filtered = filtered.map(b => {
      if (preferences.renamedGroups[b.id]) {
        return { ...b, title: preferences.renamedGroups[b.id] };
      }
      return b;
    });

    return filtered;
  }, [taskBuckets, preferences, preferencesLoading]);

  // Main content rendering
  return (
    <PageLayout>
      {user && (user.user_metadata?.unitName || user.user_metadata?.divisionName) && (
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {/* Display user's actual department if available from hook */}
            Unit/Department: {currentUserDepartment || user.user_metadata?.unitName || user.user_metadata?.divisionName || 'N/A'}
          </div>

          {/* Admin Setup Button */}
          {roleUser?.is_admin && (
            <Button
              onClick={handleSetupStrategyLists}
              disabled={isSettingUpLists}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {isSettingUpLists ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Lists...
                </>
              ) : (
                <>
                  <Settings className="h-4 w-4" />
                  Setup Strategy Lists
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {isDataLoading && (
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> Loading Unit & Strategy Data...</div>
      )}
      {hasDataLoadingError && (
        <Card className="mb-6 bg-destructive/10 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Data Loading Error</CardTitle>
            <CardDescription className="text-destructive">
              There was an error loading some unit data. Please check the data sources or try again later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {objectivesError && <p>Objectives Error: {objectivesError.message}</p>}
            {taskState.error && <p>Tasks Error: {taskState.error.message}</p>}
            {projectState.error && <p>Projects Error: {projectState.error.message}</p>}
            {kraState.error && <p>KRAs Error: {kraState.error.message}</p>}
            {kpiState.error && <p>KPIs Error: {kpiState.error.message}</p>}
          </CardContent>
        </Card>
      )}

      {!isDataLoading && !hasDataLoadingError && (
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>

              <TabsTrigger value="tasks">Tasks/Daily Operations</TabsTrigger>
              <TabsTrigger value="kras-objectives">KRAs & Objectives</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-4">
              {/* User Context Badge for Verification */}
              <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/50 border rounded-md text-sm text-muted-foreground whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <UserIcon className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">{userContext.name || 'Guest'}</span>
                </div>
                <div className="h-3 w-px bg-border" />
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">Div</Badge>
                  <span>{userContext.division}</span>
                </div>
                <div className="h-3 w-px bg-border" />
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">Unit</Badge>
                  <span>{userContext.unit}</span>
                </div>
              </div>

              {activeTab === 'tasks' && (
                <div className="flex items-center gap-4">
                  <Input
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="max-w-[200px]"
                  />
                  <div className="flex items-center gap-2">
                    {/* Task view buttons shortened for space */}
                    <Button variant={viewMode === 'board' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('board')} title="Board View"><Kanban className="h-4 w-4" /></Button>
                    <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')} title="List View"><List className="h-4 w-4" /></Button>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsDailyLogOpen(true)}>
                    <Clock className="mr-2 h-3.5 w-3.5" /> Check-in
                  </Button>
                  <Button size="sm" onClick={handleCreateTask}>
                    <Plus className="mr-2 h-3.5 w-3.5" /> Task
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            <OverviewTab
              projects={projectState.data}
              tasks={taskState.data}
              // kras={combinedKrasForOverview} // Pass raw KRAs for debugging
              kras={combinedKrasForOverview} // Pass the combined data structure
              objectives={objectivesData}
            />
          </TabsContent>



          {/* Tasks/Daily Operations Tab */}
          <TabsContent value="tasks" className="space-y-6">
            {visibleBuckets.length === 0 && preferencesLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="min-w-[300px] flex-shrink-0 space-y-4">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                    <Skeleton className="h-[120px] w-full rounded-lg" />
                    <Skeleton className="h-[120px] w-full rounded-lg" />
                    <Skeleton className="h-[120px] w-full rounded-lg" />
                  </div>
                ))}
              </div>
            ) : (
              <TasksTab
                tasks={taskState.data || []}
                addTask={taskState.add}
                editTask={taskState.update}
                deleteTask={taskState.remove}
                // groups={projectState.data || []} // We will just use buckets prop for now to abstract this
                buckets={visibleBuckets}
                setBuckets={setTaskBuckets} // Note: explicit setting might conflict with our derived visibleBuckets if TasksTab modifies it directly. Ideally TasksTab calls onAddGroup/onDeleteGroup
                // For now, TasksTab manages its own local state too, but we are passing controlled buckets.
                // We need to ensure TasksTab respects these prop buckets over its state if provided.

                // Pass custom handlers
                deleteCustomGroup={handleDeleteGroup}
                addCustomGroup={projectState.add}

                // We need to pass the rename handler down. 
                // Need to check if TasksTab accepts onRenameGroup prop or if we need to modify it further.
                // We already added onRenameGroup to BoardLane, but TasksTab needs to expose it or handle it.
                // Wait, TasksTab defines `const BoardLane` internally using props passed to BoardLane.
                // We need to inject the rename handler into TasksTab. 
                // Actually, looking at TasksTab signature, it doesn't accept onRenameGroup.
                // We need to add it there first. 

                staffMembers={staffMembers}
                objectives={objectivesData} // Pass objectives for mapping if needed

                // Modal state
                setEditingTask={setEditingTask}
                setIsDialogOpen={setIsDialogOpen}
                onRenameGroup={handleRenameGroup}
                viewMode={viewMode}
                currentUnit={userContext?.unit}
              />
            )}
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-6">
            <ProjectsTab
              projects={projectState.data}
              addProject={projectState.add}
              editProject={projectState.update}
              deleteProject={projectState.remove}
              error={projectState.error}
              onRetry={projectState.refresh}
              staffMembers={staffMembers}
              objectives={objectivesData}
            />
          </TabsContent>



          {/* KRAs & Objectives Tab */}
          <TabsContent value="kras-objectives" className="space-y-6">
            <KRAsTab
              kras={combinedKrasForTabs}
              tasks={taskState.data}
              objectivesData={objectivesData}
              onSaveObjective={handleSaveObjective}
              onDeleteObjective={handleDeleteObjective}
              units={derivedUnits}
              staffMembers={staffMembers}
              onDataRefresh={handleRefreshAllData}
              activeTab={kraSectionTab}
              onTabChange={setKraSectionTab}
              userContext={userContext}
              onSaveKra={handleSaveKra}
              onDeleteKra={handleDeleteKra}
              onSaveKpi={handleSaveKpi}
              onDeleteKpi={handleDeleteKpi}
              strategicObjectives={strategicObjectives}
              canEdit={canEditStrategy}
            />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <ReportsTab
              tasks={taskState.data}
              kras={combinedKrasForTabs}
              projects={projectState.data}
              objectives={objectivesData}
            />
          </TabsContent>
        </Tabs>
      )}
      <TaskDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleTaskSubmit}
        initialData={editingTask}
        staffMembers={staffMembers}
        buckets={visibleBuckets}
        kras={combinedKrasForTabs}
        kpis={kpiState.data}
      />

      <DailyLogModal
        isOpen={isDailyLogOpen}
        onClose={() => setIsDailyLogOpen(false)}
      />
    </PageLayout>
  );
};

export default Unit;
