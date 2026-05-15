import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getEffectiveGroupId } from '@/utils/taskBoardUtils';
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
import { KRAsTab, KRAsTabHandle } from '@/components/unit-tabs/KRAsTab';
import { useTaskGroupPreferences } from '@/hooks/useTaskGroupPreferences'; // Import preference hook

// Import modal components

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
  useSharePointObjectives,
  useSharePointTaskGroups
} from '@/hooks/useSharePointOps';
import { useStrategySharePoint } from '@/hooks/useStrategySharePoint';
import { useUnitRoster } from '@/hooks/useUnitRoster';

import { OrganizationUnit, Objective, Kra, Kpi, KRA, KPI, Task } from '@/types';
import { useStaffByDepartment } from '@/hooks/useStaffByDepartment';
import { StaffMember } from '@/types/staff';

import DivisionStaffMap from '@/utils/divisionStaffMap';
import { useOfficerProfiles } from '@/hooks/useOfficerProfiles';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useGraphProfile } from '@/hooks/useGraphProfile';

// Import tab components
import TaskDialog from '@/components/unit-tabs/TaskDialog';
import { TasksTab, Bucket } from '@/components/unit-tabs/TasksTab';
import { ProjectsTab } from '@/components/unit-tabs/ProjectsTab';
import { OverviewTab } from '@/components/unit-tabs/OverviewTab';
import { StaffMetricsTab } from '@/components/unit-tabs/StaffMetricsTab';
import { ReportsTab } from '@/components/unit-tabs/ReportsTab';

// Import skeleton
import { KRADataGridSkeleton } from '@/components/skeletons/KRADataGridSkeleton';

import { SharePointListSetupService } from '@/services/sharePointListSetupService';
import { getGraphClient } from '@/services/graphService';
import { useMsal } from '@azure/msal-react';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { useComponentVisibility } from '@/hooks/useComponentVisibility';


// Define status options for dropdowns
const statusOptions = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'in-review', label: 'In Review' },
  { value: 'completed', label: 'Completed' }
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
  const { data: officerProfiles = [] } = useOfficerProfiles();
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
    // Prioritize Graph Profile (matches 'User Information' page), fallback to Supabase, then UserRoles
    division: graphProfile?.officeLocation || user?.user_metadata?.divisionName || roleUser?.division_name || 'General',
    unit: graphProfile?.department || user?.user_metadata?.unitName || roleUser?.unit_name || 'General',
    email: graphProfile?.mail || user?.email || '',
    name: graphProfile?.displayName || user?.user_metadata?.full_name || user?.email || '',
    role: roleUser?.role_name
  }), [user, graphProfile, roleUser]);

  // Live unit staff roster from SharePoint UserRoles — updates when admin adds/removes people
  const { unitRoster, unitRosterEmails } = useUnitRoster(userContext);

  // Initialize data states first
  // Switched to SharePoint Hooks
  const taskState = useSharePointTasks(targetDepartment, getScopeForComponent('Tasks', 'Unit'), userContext, unitRosterEmails);
  const projectState = useSharePointProjects(targetDepartment, getScopeForComponent('Projects', 'Unit'), userContext);
  const kraState = useSharePointKRAs(targetDepartment, getScopeForComponent('KRAs', 'Division'), userContext);
  const kpiState = useSharePointKPIs(targetDepartment, userContext);
  const taskGroupState = useSharePointTaskGroups();
  const { instance: msalInstance } = useMsal();

  const [isSettingUpLists, setIsSettingUpLists] = useState(false);

  // Active Tab State for the main page sections
  const [activeTab, setActiveTab] = useState<string>("tasks");
  const [kraSectionTab, setKraSectionTab] = useState<string>("kpis"); // Renamed from kraSectionTab
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const kraTabRef = useRef<KRAsTabHandle>(null);

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [taskBuckets, setTaskBuckets] = useState<Bucket[]>([]);
  const [defaultGroupId, setDefaultGroupId] = useState<string | null>(null);



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
      deliverables: (obj as any).kras || []
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

  // Staff Metrics visibility — temporarily hidden (uncomment to re-enable)
  const { isComponentVisible } = useComponentVisibility();
  const canViewStaffMetrics = false; // isComponentVisible('Unit', 'Staff Metrics Tab');

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
      toast({ title: "Permission Denied", description: "Only Managers can edit Initiatives.", variant: "destructive" });
      return;
    }
    try {
      if (objective.id) {
        await objectivesState.update(String(objective.id), objective);
      } else {
        await objectivesState.add(objective);
      }
      toast({ title: "Success", description: "Initiative saved to SharePoint." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to save initiative", variant: "destructive" });
      throw e;
    }
  }, [objectivesState, canEditStrategy]);

  const handleDeleteObjective = useCallback(async (objectiveId: string | number) => {
    if (!canEditStrategy) {
      toast({ title: "Permission Denied", description: "Only Managers can delete Initiatives.", variant: "destructive" });
      return;
    }
    try {
      await objectivesState.remove(String(objectiveId));
      toast({ title: "Success", description: "Initiative deleted from SharePoint." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to delete initiative", variant: "destructive" });
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

  const handleSubmitKpiForReview = async (kpiId: string | number, reviewerEmail: string) => {
    try {
      const graphClient = await getGraphClient(msalInstance);
      if (!graphClient) return;
      const { SharePointOpsService } = await import('@/services/sharePointOpsService');
      const service = new SharePointOpsService(graphClient);
      await service.initialize();
      await service.addNotification({
        title: 'KPI Review Requested',
        message: `${userContext?.name || 'A user'} submitted a KPI for your review.`,
        recipientEmail: reviewerEmail,
        type: 'review',
        category: 'KPI',
        actionUrl: '/unit',
        createdBy: userContext?.email || '',
      });
    } catch (err: any) {
      console.error('handleSubmitKpiForReview error:', err);
    }
  };

  // Create/Task Handlers
  const handleCreateTask = (groupId?: string) => {
    setEditingTask(null);
    if (groupId) {
      setDefaultGroupId(groupId);
    } else {
      setDefaultGroupId(null);
    }
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

  // --- Derive unit list from live officer profiles (fallback: static map) ---
  const derivedUnits = useMemo((): UnitData[] => {
    try {
      let unitNames: string[] = [];

      if (officerProfiles.length > 0) {
        // Find user's division from their profile
        const userProfile = officerProfiles.find(
          p => p.email?.toLowerCase() === userContext.email?.toLowerCase()
        );
        const userDivision = userProfile?.division?.toLowerCase() || '';

        // Filter profiles to the user's division, or all if not found
        const relevant = userDivision
          ? officerProfiles.filter(p => p.division?.toLowerCase() === userDivision)
          : officerProfiles;

        unitNames = Array.from(new Set(
          relevant.map(p => p.unit).filter(u => u && u.toLowerCase().includes('unit') && !u.toLowerCase().includes('division'))
        )) as string[];
      } else {
        // Fallback to static map
        let relevantStaff = DivisionStaffMap.getStaffForUserDivision(userContext.email);
        if (relevantStaff.length === 0) relevantStaff = DivisionStaffMap.getAllStaff();
        unitNames = Array.from(new Set(
          relevantStaff.map(s => s.unit).filter(u => u && u.toLowerCase().includes('unit') && !u.toLowerCase().includes('division'))
        )) as string[];
      }

      return unitNames.sort().map(name => ({ id: name, name }));
    } catch (error) {
      console.error("Error deriving units:", error);
      return [];
    }
  }, [userContext.email, officerProfiles]);

  // Data loading is handled by React Query's cache + persistence.
  // staleTime (5 min) ensures cached data is served instantly on navigation.
  // Manual refresh is available via handleRefreshAllData for user-triggered updates.

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
      // Find the objective for this KRA
      const objective = objectivesData.find(o => String(o.id) === String(kra.objective_id));

      return {
        ...kra,
        unitKpis: kpisForKra,
        unitObjectives: objective // Attach the full objective object to fix 'Unknown Objective' in charts
      };
    });
  }, [kraState.data, kpiState.data, objectivesData]);

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
      const normalizedStatus = kra.status?.toLowerCase() || '';
      if (['completed', 'closed', 'done'].includes(normalizedStatus)) mappedStatus = 'closed';
      else if (['on-track', 'at-risk', 'off-track', 'in-progress'].includes(normalizedStatus)) mappedStatus = 'in-progress';

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
          id: k.id?.toString() ?? '',
          date: k.startDate ? new Date(k.startDate) : new Date(),
          notes: k.comments || '',
          target: k.target?.toString() ?? '0',
          actual: k.actual?.toString() ?? '0',
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
  const isDataLoading = objectivesLoading || taskState.loading || projectState.loading || kraState.loading || kpiState.loading || taskGroupState.loading;
  // Determine if there was an error
  const hasDataLoadingError = objectivesError || taskState.error || projectState.error || kraState.error || kpiState.error || taskGroupState.error;

  // Sync Custom Groups from SharePoint Projects & Handle Orphans
  // Optimized with useMemo to prevent excessive re-calculations
  const calculatedBuckets = useMemo(() => {
    if (!taskGroupState.data) return [];

    // 1. Get task groups — show only groups owned by the current user
    // Groups with ownerEmail show only to their owner (includes ATM + user-created groups)
    // Groups without ownerEmail are hidden (orphaned/legacy — fix by setting OwnerEmail in SharePoint)
    const normalizedEmail = userContext.email?.toLowerCase() || '';
    const customGroups: Bucket[] = taskGroupState.data
      .filter(p => {
        if (!p.ownerEmail) return false;
        return p.ownerEmail.toLowerCase() === normalizedEmail;
      })
      .map(p => {
        // ATM groups are identified by order 999999 (auto-created for assignees)
        const isAtm = p.order === 999999;
        return {
          id: String(p.id),
          title: isAtm ? 'Assigned to Me' : p.name,
          isCustom: true,
          isAtm,
          order: isAtm ? 999999 : (p.order || 9999)
        };
      });

    // Sort by order ("Assigned to Me" pinned last, just before Add Group)
    customGroups.sort((a, b) => (a.order || 0) - (b.order || 0));

    // No initial buckets anymore - start with custom groups
    const uniqueBuckets = [...customGroups];

    // 2. Add "Uncategorized" virtual bucket logic
    // For tasks that have NO effective group for the current user
    const hasUncategorized = taskState.data?.some(t => {
      const effectiveId = getEffectiveGroupId(t, normalizedEmail);
      return !effectiveId && t.status !== 'done';
    });

    if (hasUncategorized) {
      uniqueBuckets.push({
        id: 'uncategorized-virtual',
        title: 'Uncategorized',
        isCustom: true
      });
    }

    return uniqueBuckets;
  }, [taskState.data, userContext.email, userContext.unit, userContext.role, taskGroupState.data]);

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
    // Custom groups - try to delete proper
    if (taskGroupState.remove) {
      try {
        await taskGroupState.remove(groupId);
        // Toast handled by mutation typically, but adding one here for feedback
        toast({ title: "Group Deleted", description: "The task group has been removed." });
      } catch (e) {
        console.error("Failed to delete custom group", e);
        toast({ title: "Error", description: "Failed to delete group", variant: "destructive" });
        throw e;
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

      {hasDataLoadingError && (
        <Card className="mb-6 bg-destructive/10 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Data Loading Error</CardTitle>
            <CardDescription className="text-destructive">
              There was an error loading some unit data. Please check the data sources or try again later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {objectivesError && <p>Initiatives Error: {objectivesError.message}</p>}
            {taskState.error && <p>Tasks Error: {taskState.error.message}</p>}
            {projectState.error && <p>Projects Error: {projectState.error.message}</p>}
            {kraState.error && <p>KRAs Error: {kraState.error.message}</p>}
            {kpiState.error && <p>KPIs Error: {kpiState.error.message}</p>}
          </CardContent>
        </Card>
      )}

      {!hasDataLoadingError && (
        <Tabs defaultValue="tasks" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
            <TabsList className="dark:bg-gray-800/50 dark:border-white/10 border p-1">
              <TabsTrigger value="tasks" className="dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white transition-all">Tasks & Daily Operations</TabsTrigger>
              <TabsTrigger value="kras-objectives" className="dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white transition-all">KRAs & Initiatives</TabsTrigger>
              <TabsTrigger value="projects" className="dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white transition-all">Projects</TabsTrigger>
              <TabsTrigger value="overview" className="dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white transition-all">Overview</TabsTrigger>
              {canViewStaffMetrics && (
                <TabsTrigger value="staff-metrics" className="dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white transition-all">Staff Metrics</TabsTrigger>
              )}
              <TabsTrigger value="reports" className="dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white transition-all">Reports</TabsTrigger>
            </TabsList>


            <div className="flex items-center gap-4">
              {activeTab === 'tasks' && (
                <div className="flex items-center gap-4">
                  <Input
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="max-w-[200px]"
                  />
                  <div className="flex items-center gap-2">
                    <Button variant={viewMode === 'board' ? 'default' : 'ghost'} size="icon" className="h-8 w-8 dark:bg-gray-800 dark:border-white/10" onClick={() => setViewMode('board')} title="Board View"><Kanban className="h-4 w-4" /></Button>
                    <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" className="h-8 w-8 dark:bg-gray-800 dark:border-white/10" onClick={() => setViewMode('list')} title="List View"><List className="h-4 w-4" /></Button>
                  </div>

                  <Button size="sm" onClick={() => handleCreateTask()} disabled={isDataLoading} className="bg-intranet-primary hover:bg-intranet-secondary text-white shadow-lg">
                    {isDataLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
                    Task
                  </Button>
                </div>
              )}

              {activeTab === 'kras-objectives' && canEditStrategy && (
                <div className="flex items-center gap-4">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (kraSectionTab === 'objectives') {
                        kraTabRef.current?.handleOpenAddObjectiveModal();
                      } else {
                        kraTabRef.current?.handleOpenAddKraModal();
                      }
                    }}
                    disabled={isDataLoading}
                    className="bg-intranet-primary hover:bg-intranet-secondary text-white shadow-lg"
                  >
                    {isDataLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
                    {kraSectionTab === 'objectives' ? 'Add Initiative' : 'Add KRA'}
                  </Button>
                </div>
              )}

            </div>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8 dark:bg-gray-800/40 dark:border-white/5 border rounded-xl p-6 backdrop-blur-sm shadow-xl">
            {isDataLoading ? (
              <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> Loading Overview...</div>
            ) : (
              <OverviewTab
                projects={projectState.data}
                tasks={taskState.data}
                buckets={visibleBuckets}
                kras={combinedKrasForOverview}
                objectives={objectivesData}
                userContext={userContext}
                unitRoster={unitRoster}
              />
            )}
          </TabsContent>

          {/* Staff Metrics Tab */}
          {canViewStaffMetrics && (
            <TabsContent value="staff-metrics" className="space-y-8">
              {isDataLoading ? (
                <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> Loading Metrics...</div>
              ) : (
                <StaffMetricsTab
                  tasks={taskState.data}
                  kras={combinedKrasForOverview}
                  unitRoster={unitRoster}
                  userContext={userContext}
                />
              )}
            </TabsContent>
          )}

          {/* Tasks/Daily Operations Tab */}
          <TabsContent value="tasks" className="h-[calc(100vh-200px)] dark:bg-gray-800/20 dark:border-white/5 border rounded-xl p-4 backdrop-blur-sm">
            <div className="flex flex-col gap-4 h-full">

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
                  buckets={visibleBuckets}
                  setBuckets={setTaskBuckets}
                  deleteCustomGroup={handleDeleteGroup}
                  addCustomGroup={taskGroupState.add}
                  staffMembers={staffMembers}
                  objectives={objectivesData}
                  setEditingTask={setEditingTask}
                  setIsDialogOpen={setIsDialogOpen}
                  onRenameGroup={handleRenameGroup}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  currentUnit={userContext?.unit}
                  currentDivision={userContext?.division}
                  setPreselectedGroup={setDefaultGroupId}
                  preselectedGroup={defaultGroupId}
                  isDialogOpen={isDialogOpen}
                  editingTask={editingTask}
                  currentUserEmail={userContext?.email}
                  kras={combinedKrasForTabs}
                  kpis={kpiState.data || []}
                  onDataRefresh={handleRefreshAllData}
                />
              )}
            </div>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-6 dark:bg-gray-800/40 dark:border-white/5 border rounded-xl p-6 backdrop-blur-sm shadow-xl">
            <ProjectsTab
              projects={projectState.data}
              tasks={taskState.data}
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
          <TabsContent value="kras-objectives" className="mt-0 p-0 block">
            {isDataLoading ? (
              <KRADataGridSkeleton />
            ) : (
              <KRAsTab
                ref={kraTabRef}
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
                onEditTask={taskState.update}
                onSubmitForReview={handleSubmitKpiForReview}
              />
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <ReportsTab
              tasks={taskState.data || []}
              kras={(kraState.data || []) as any}
              kpis={(kpiState.data || []) as any}
              objectives={objectivesData || []}
              userContext={userContext}
            />
          </TabsContent>
        </Tabs >
      )}



    </PageLayout >
  );
};

export default Unit;
