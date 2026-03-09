import React, { useState, useEffect, useMemo, useRef } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Plus, Edit, Trash2, List, LayoutGrid, Search, Download,
  RotateCcw, Rows, MoreVertical, Info, ArrowUpDown, ArrowUp, ArrowDown, X,
  Maximize2, Minimize2
} from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { logger } from '@/lib/supabaseClient'; // Keep logger if used elsewhere
import { supabase } from '@/lib/supabaseClient'; // Add import for supabase client
import { useAssetsData } from '@/hooks/useSupabaseData';
import { useAssetsSharePoint } from '@/hooks/useAssetsSharePoint';
import { Asset } from '@/services/assetsSharePointService';
import { useMsal } from '@azure/msal-react'; // <--- Import useMsal from msal-react
import { InteractionStatus } from '@azure/msal-browser'; // Import InteractionStatus if needed for loading
import { UserAsset } from '@/types';
import { divisions } from '@/data/divisions'; // Import divisions data
import { units } from '@/data/units'; // Import units data
import { useStaffMembers } from '@/hooks/useStaffMembers'; // Import staff members hook
import { formatDate } from '@/lib/utils'; // Import formatDate from utils
import { cn } from '@/lib/utils'; // Import cn utility
import { getConditionBadgeClass, ASSET_CONDITIONS } from '@/config/assetConditions';

// Import modal components
import AddAssetModal from '@/components/unit-tabs/modals/AddAssetModal';
import EditAssetModal from '@/components/unit-tabs/modals/EditAssetModal';
import DeleteModal from '@/components/unit-tabs/modals/DeleteModal';
import AssetCard from '@/components/assets/AssetCard';
import HighlightMatch from '@/components/ui/HighlightMatch';
import AssetInfoModal from '@/components/assets/AssetInfoModal';
import { TooltipWrapper } from '@/components/ui/tooltip-wrapper';

// --- Add dropdown components ---
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
// --- End dropdown components ---

// --- Pagination Component (Optional, but good practice) ---
// import PaginationControls from '@/components/ui/PaginationControls'; // Removed import as component doesn't exist yet
// --- End Pagination Component ---

const ITEMS_PER_PAGE = 15; // Define items per page constant

interface AssetManagementProps {
  skipPageLayout?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const AssetManagement: React.FC<AssetManagementProps> = ({
  skipPageLayout = false,
  isFullscreen = false,
  onToggleFullscreen
}) => {
  const { instance, accounts, inProgress } = useMsal(); // <-- Use MSAL hook
  const account = useMemo(() => accounts[0], [accounts]); // Get the first (active) account
  const authLoading = useMemo(() => inProgress !== InteractionStatus.None, [inProgress]); // Determine loading state

  const { toast } = useToast();
  // Feature flag for SharePoint migration
  const USE_SHAREPOINT_ASSETS = import.meta.env.VITE_USE_SHAREPOINT_ASSETS === 'true';

  // Use SharePoint hook
  const sharePointHook = useAssetsSharePoint();

  // Use Supabase hook
  const supabaseHook = useAssetsData();

  // Select the active hook based on feature flag
  const {
    assets,
    loading: assetsLoading,
    error: assetsError,
    add: addAsset,
    update: editAsset,
    remove: deleteAsset,
    refresh: refreshAssets,
  } = USE_SHAREPOINT_ASSETS ? sharePointHook : {
    assets: supabaseHook.data,
    loading: supabaseHook.loading,
    error: supabaseHook.error,
    add: supabaseHook.add,
    update: supabaseHook.update,
    remove: supabaseHook.remove,
    refresh: supabaseHook.refresh,
  };

  // Use the staff members hook to get data from database
  // NOTE: This now uses the online 'staff_members' table instead of static data
  const {
    staffMembers,
    loading: staffLoading,
    error: staffError,
  } = useStaffMembers();

  // --- Unified modal state — only one modal open at a time ---
  type ModalType = 'add' | 'edit' | 'delete' | 'info' | null;
  const [activeModal, setActiveModal] = useState<{ type: ModalType; asset: UserAsset | null }>({ type: null, asset: null });

  const [viewMode, setViewMode] = useState<'table' | 'card' | 'detailed-list'>('table');
  const [filterText, setFilterText] = useState('');
  const [debouncedFilterText, setDebouncedFilterText] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCondition, setFilterCondition] = useState('all');
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterDivision, setFilterDivision] = useState('all');
  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  // --- End Pagination State ---

  // --- Sorting State ---
  type SortableAssetColumn = 'name' | 'id' | 'type' | 'condition' | 'assigned_to' | 'assigned_to_email' | 'unit' | 'division' | 'description' | 'assigned_date' | 'purchase_date' | 'last_updated';
  const [sortColumn, setSortColumn] = useState<SortableAssetColumn>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  // --- End Sorting State ---

  // --- Fullscreen State ---
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // --- End Fullscreen State ---

  // Debounce search text by 300ms to avoid filtering on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilterText(filterText), 300);
    return () => clearTimeout(timer);
  }, [filterText]);

  // --- Fullscreen handlers ---
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
    const handleFullscreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  // --- End fullscreen handlers ---

  // --- Derive unique lists for modal suggestions ---
  const existingNames = useMemo(() =>
    Array.from(new Set(assets.map(a => a.name).filter(Boolean) as string[])).sort(),
    [assets]
  );
  const existingTypes = useMemo(() =>
    Array.from(new Set(assets.map(a => a.type).filter(Boolean) as string[])).sort(),
    [assets]
  );
  const existingVendors = useMemo(() =>
    Array.from(new Set(assets.map(a => a.vendor).filter(Boolean) as string[])).sort(),
    [assets]
  );

  // --- Derive user name for filtering directly from MSAL account ---
  // This is now mainly used for display or potentially for the 'add' action
  const userNameForFiltering = useMemo(() => account?.name || null, [account]);

  // Log the user object and the raw assets array from the hook
  // console.log('[AssetManagement] MSAL Account object:', account);
  // console.log('[AssetManagement] User Name (for display/add):', userNameForFiltering);
  // console.log('[AssetManagement] Assets array (already filtered by hook):', assets);
  // console.log('[AssetManagement] Staff Members from database (online):', staffMembers, 'Loading:', staffLoading, 'Error:', staffError);

  // --- Filtering Logic (Client-side) --- 
  // [Cursor] Updated filtering logic to include all filters
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const searchTerm = debouncedFilterText.toLowerCase();

      // Text search check
      const textMatch = !searchTerm || (
        (asset.name && asset.name.toLowerCase().includes(searchTerm)) ||
        (asset.id && asset.id.toLowerCase().includes(searchTerm)) ||
        (asset.type && asset.type.toLowerCase().includes(searchTerm)) ||
        (asset.condition && asset.condition.toLowerCase().includes(searchTerm)) ||
        (asset.vendor && asset.vendor.toLowerCase().includes(searchTerm)) ||
        (asset.unit && asset.unit.toLowerCase().includes(searchTerm)) ||
        (asset.division && asset.division.toLowerCase().includes(searchTerm)) ||
        (asset.assigned_to && asset.assigned_to.toLowerCase().includes(searchTerm)) ||
        (asset.notes && asset.notes.toLowerCase().includes(searchTerm)) ||
        (asset.description && asset.description.toLowerCase().includes(searchTerm))
      );

      // Dropdown filter checks
      const typeMatch = filterType === 'all' || asset.type?.trim() === filterType;
      const conditionMatch = filterCondition === 'all' || asset.condition?.trim() === filterCondition;
      const unitMatch = filterUnit === 'all' || asset.unit?.trim() === filterUnit;
      const divisionMatch = filterDivision === 'all' || asset.division?.trim() === filterDivision;

      return textMatch && typeMatch && conditionMatch && unitMatch && divisionMatch;
    });
  }, [assets, debouncedFilterText, filterType, filterCondition, filterUnit, filterDivision]);

  // console.log(`[AssetManagement] Filters: Text="${filterText}", Type="${filterType}", Condition="${filterCondition}", Unit="${filterUnit}", Division="${filterDivision}", Vendor="${filterVendor}"`);
  // console.log('[AssetManagement] Assets array AFTER filtering:', filteredAssets);
  // --- End Filtering Logic ---

  // --- Sort Assets Function ---
  const sortedAssets = useMemo(() => {
    const sorted = [...filteredAssets].sort((a, b) => {
      const aValue = a[sortColumn] ?? '';
      const bValue = b[sortColumn] ?? '';

      // Handle different data types
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // For dates or other types, convert to string and compare
      const aStr = String(aValue);
      const bStr = String(bValue);
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    return sorted;
  }, [filteredAssets, sortColumn, sortDirection]);

  // --- Sort Indicator Component ---
  const SortIndicator = ({ column }: { column: SortableAssetColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 text-gray-400" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 text-blue-500" />
      : <ArrowDown className="h-3 w-3 ml-1 text-blue-500" />;
  };

  // --- Pagination Logic ---
  const totalPages = useMemo(() => {
    return Math.ceil(sortedAssets.length / ITEMS_PER_PAGE);
  }, [sortedAssets]);

  const paginatedAssets = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedAssets.slice(startIndex, endIndex);
  }, [sortedAssets, currentPage]);

  // Reset to page 1 when filters, sort, or source data change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedFilterText, filterType, filterCondition, filterUnit, filterDivision, sortColumn, sortDirection, assets]);
  // --- End Pagination Logic ---

  // --- Email for filtering (derive from MSAL account) ---
  // Ensure 'account.username' holds the email address
  const loggedInUserEmail = useMemo(() => account?.username || null, [account]);
  // --- End Email for filtering ---

  // --- Modal Handlers ---

  const handleEditClick = (asset: UserAsset) => setActiveModal({ type: 'edit', asset });
  const handleDeleteClick = (asset: UserAsset) => setActiveModal({ type: 'delete', asset });
  const handleInfoClick = (asset: UserAsset) => setActiveModal({ type: 'info', asset });
  const handleCloseModals = () => setActiveModal({ type: null, asset: null });

  // [Cursor] Handler to reset all filters
  const handleResetFilters = () => {
    setFilterText('');
    setDebouncedFilterText('');
    setFilterType('all');
    setFilterCondition('all');
    setFilterUnit('all');
    setFilterDivision('all');
    setSortColumn('name');
    setSortDirection('asc');
  };

  // --- Sorting Handler ---
  const handleSort = (column: SortableAssetColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };



  // --- Data Operation Handlers ---

  const handleSaveAdd = async (newAssetData: Partial<Omit<UserAsset, 'id' | 'created_at' | 'last_updated'>>) => {
    const today = new Date().toISOString().split('T')[0];

    // Use assignee details from modal if provided, otherwise default (though validation should prevent this)
    const completeAssetData = {
      ...newAssetData,
      assigned_to: newAssetData.assigned_to || userNameForFiltering, // Use name from modal
      assigned_to_email: newAssetData.assigned_to_email || loggedInUserEmail, // Use email from modal
      assigned_date: newAssetData.assigned_date || today, // Keep defaulting assigned_date
    } as Omit<UserAsset, 'id' | 'created_at' | 'last_updated'>;

    // Validation should now happen inside the modal, but keep a basic check here
    if (!completeAssetData.name || !completeAssetData.assigned_to) {
      toast({ title: "Error", description: "Asset name and Assigned To are required.", variant: "destructive" });
      return;
    }
    // Removed redundant check for assigned_to determination

    // --- Exclude 'specifications' before sending to Supabase ---
    const { specifications, ...dataToSend } = completeAssetData;
    // --- End exclusion ---

    try {
      // Pass the object without 'specifications'
      await addAsset(dataToSend as unknown as Asset);
      toast({ title: "Asset Added", description: "New asset has been added successfully." });
      handleCloseModals();
    } catch (err) {
      logger.error("Error adding asset:", err);
      toast({ title: "Error Adding Asset", description: err instanceof Error ? err.message : "Could not add asset.", variant: "destructive" });
    }
  };

  const handleSaveEdit = async (updatedAssetData: Partial<UserAsset>) => {
    if (!activeModal.asset) return;
    try {
      const dataToSave = loggedInUserEmail ? { ...updatedAssetData, last_updated_by: loggedInUserEmail } : updatedAssetData;
      await editAsset(activeModal.asset.id, dataToSave);
      toast({ title: "Asset Updated", description: "Asset details have been updated." });
      handleCloseModals();
    } catch (err) {
      logger.error("Error updating asset:", err);
      toast({ title: "Error Updating Asset", description: err instanceof Error ? err.message : "Could not update asset.", variant: "destructive" });
    }
  };

  const handleConfirmDelete = async () => {
    if (!activeModal.asset) return;
    try {
      await deleteAsset(activeModal.asset.id);
      toast({ title: "Asset Deleted", description: "Asset has been removed successfully." });
      handleCloseModals();
    } catch (err) {
      logger.error("Error deleting asset:", err);
      toast({ title: "Error Deleting Asset", description: err instanceof Error ? err.message : "Could not delete asset.", variant: "destructive" });
    }
  };

  // Use authLoading derived from useMsal
  if (authLoading) {
    const loadingContent = (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Initializing Authentication...</span>
      </div>
    );
    return skipPageLayout ? loadingContent : <PageLayout>{loadingContent}</PageLayout>;
  }

  // Staff members load in the background — page renders immediately.
  // Modals receive staffMembers (empty array while loading, populated once ready).
  if (staffError) {
    console.warn('Staff loading error — assignee dropdowns may be incomplete:', staffError);
  }

  // Handle case where MSAL account is not available after loading
  if (!authLoading && !account) {
    const errorContent = (
      <div className="text-center py-10 px-4 text-destructive">
        <p>User not authenticated. Please log in.</p>
        {/* Optionally add a login button here */}
      </div>
    );
    return skipPageLayout ? errorContent : <PageLayout>{errorContent}</PageLayout>;
  }

  // --- If user is authenticated but no email, show error (or handle differently) ---
  if (!authLoading && !loggedInUserEmail) {
    const errorContent = (
      <div className="text-center py-10 px-4 text-destructive">
        <p>Could not determine your user email. Please ensure your profile is complete or contact support.</p>
      </div>
    );
    return skipPageLayout ? errorContent : <PageLayout>{errorContent}</PageLayout>;
  }
  // --- End User Email Check ---

  const mainContent = (
    <div ref={containerRef} className={cn("w-full", isFullScreen && "bg-background p-4 h-screen overflow-auto")}>
    <Card className={cn("w-full shadow-sm border", isFullScreen && "h-full")}>
      <CardContent className="p-6 space-y-6 flex flex-col h-full">
        {/* Fixed Header */}
        <div className="shrink-0 space-y-0.5 border-b border-gray-100 dark:border-gray-800 pb-4 mb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Asset Registry</h2>
            <p className="text-muted-foreground">Manage and track all organizational assets.</p>
          </div>
        </div>

        {/* Search + Action Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name, ID, type, user, vendor..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-8 w-full bg-background h-9"
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* View Mode Toggle */}
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => value && setViewMode(value as 'table' | 'card' | 'detailed-list')}
              aria-label="View mode"
              className="border rounded-md p-0.5 bg-background h-9"
            >
              <TooltipWrapper content="Table view">
                <ToggleGroupItem value="table" aria-label="Table view" className="px-2 py-1 h-auto data-[state=on]:bg-intranet-primary data-[state=on]:text-primary-foreground">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipWrapper>
              <TooltipWrapper content="Card view">
                <ToggleGroupItem value="card" aria-label="Card view" className="px-2 py-1 h-auto data-[state=on]:bg-intranet-primary data-[state=on]:text-primary-foreground">
                  <LayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipWrapper>
              <TooltipWrapper content="Detailed list view">
                <ToggleGroupItem value="detailed-list" aria-label="Detailed list view" className="px-2 py-1 h-auto data-[state=on]:bg-intranet-primary data-[state=on]:text-primary-foreground">
                  <Rows className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipWrapper>
            </ToggleGroup>

            {/* Fullscreen Button */}
            <TooltipWrapper content={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}>
              <Button variant="outline" size="icon" className="h-9 w-9 bg-background" onClick={toggleFullscreen}>
                {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </TooltipWrapper>

            {/* Add Asset Button */}
            <Dialog
              open={activeModal.type === 'add'}
              onOpenChange={(open) => setActiveModal(open ? { type: 'add', asset: null } : { type: null, asset: null })}
            >
              <DialogTrigger asChild>
                <Button className="h-9">
                  <Plus className="mr-2 h-4 w-4" /> Add Asset
                </Button>
              </DialogTrigger>
              {activeModal.type === 'add' && (
                <AddAssetModal
                  isOpen={activeModal.type === 'add'}
                  onClose={handleCloseModals}
                  onAdd={handleSaveAdd}
                  divisions={divisions}
                  units={units}
                  staffMembers={staffMembers}
                  existingNames={existingNames}
                  existingTypes={existingTypes}
                  existingVendors={existingVendors}
                />
              )}
            </Dialog>

            {/* More Options Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 bg-background">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Filter Row - always visible, 4 key dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className={cn("h-8 text-xs bg-background", filterType !== 'all' ? "w-auto min-w-[100px] border-primary text-primary" : "w-32")}>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {existingTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterCondition} onValueChange={setFilterCondition}>
            <SelectTrigger className={cn("h-8 text-xs bg-background", filterCondition !== 'all' ? "w-auto min-w-[100px] border-primary text-primary" : "w-32")}>
              <SelectValue placeholder="Condition" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Conditions</SelectItem>
              {[...new Set(assets.map(a => a.condition).filter(Boolean) as string[])].sort().map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterDivision} onValueChange={setFilterDivision}>
            <SelectTrigger className={cn("h-8 text-xs bg-background", filterDivision !== 'all' ? "w-auto min-w-[100px] border-primary text-primary" : "w-36")}>
              <SelectValue placeholder="Division" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              {[...new Set(assets.map(a => a.division).filter(Boolean) as string[])].sort().map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterUnit} onValueChange={setFilterUnit}>
            <SelectTrigger className={cn("h-8 text-xs bg-background", filterUnit !== 'all' ? "w-auto min-w-[100px] border-primary text-primary" : "w-32")}>
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Units</SelectItem>
              {[...new Set(assets.map(a => a.unit).filter(Boolean) as string[])].sort().map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>

          {(filterType !== 'all' || filterCondition !== 'all' || filterDivision !== 'all' || filterUnit !== 'all' || filterText) && (
            <Button variant="ghost" size="sm" onClick={handleResetFilters} className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1">
              <X className="h-3 w-3" /> Clear
            </Button>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            {sortedAssets.length} {sortedAssets.length === 1 ? 'asset' : 'assets'}
          </span>
        </div>

        {/* Main Content Area */}
        <div className="border rounded-md w-full bg-background">
          <div className="p-0 relative h-[65vh] flex flex-col">
            <div className="overflow-auto flex-1 w-full custom-scrollbar">
              {assetsLoading && (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Loading assets...</span>
                </div>
              )}
              {assetsError && (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-10 px-4 text-destructive">
                  <p>Error loading assets: {assetsError.message}</p>
                  <Button variant="outline" size="sm" onClick={() => refreshAssets()} className="text-foreground">
                    <RotateCcw className="mr-2 h-4 w-4" /> Retry
                  </Button>
                </div>
              )}
              {!assetsLoading && !assetsError && (
                <>
                  {/* Table View - Enhanced with sticky headers and comprehensive tooltips */}
                  {viewMode === 'table' && (
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                      <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10 shadow-sm">
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground w-[60px]">
                            <TooltipWrapper content="Asset image - Click asset row to view full details">
                              <div className="flex items-center justify-center">
                                <span>Img</span>
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[200px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('name')}>
                            <TooltipWrapper content="Asset name - Click to sort alphabetically">
                              <div className="flex items-center">
                                <span>Name</span>
                                <SortIndicator column="name" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground w-[50px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('id')}>
                            <TooltipWrapper content="Unique asset identifier - Click to sort by ID">
                              <div className="flex items-center">
                                <span>ID</span>
                                <SortIndicator column="id" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('type')}>
                            <TooltipWrapper content="Asset category/type - Click to sort by type">
                              <div className="flex items-center">
                                <span>Type</span>
                                <SortIndicator column="type" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[100px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('condition')}>
                            <TooltipWrapper content="Current asset condition - Click to sort by condition">
                              <div className="flex items-center">
                                <span>Condition</span>
                                <SortIndicator column="condition" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('assigned_to')}>
                            <TooltipWrapper content="Person currently assigned this asset - Click to sort by assignee">
                              <div className="flex items-center">
                                <span>Assigned To</span>
                                <SortIndicator column="assigned_to" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[200px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('assigned_to_email')}>
                            <TooltipWrapper content="Email of assigned person - Click to sort by email">
                              <div className="flex items-center">
                                <span>Email</span>
                                <SortIndicator column="assigned_to_email" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('unit')}>
                            <TooltipWrapper content="Organizational unit - Click to sort by unit">
                              <div className="flex items-center">
                                <span>Unit</span>
                                <SortIndicator column="unit" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[200px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('division')}>
                            <TooltipWrapper content="Division within organization - Click to sort by division">
                              <div className="flex items-center">
                                <span>Division</span>
                                <SortIndicator column="division" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[200px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('description')}>
                            <TooltipWrapper content="Asset description - Click to sort by description">
                              <div className="flex items-center">
                                <span>Description</span>
                                <SortIndicator column="description" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('assigned_date')}>
                            <TooltipWrapper content="Date asset was assigned - Click to sort by assigned date">
                              <div className="flex items-center">
                                <span>Assigned Date</span>
                                <SortIndicator column="assigned_date" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('purchase_date')}>
                            <TooltipWrapper content="Date asset was purchased - Click to sort by purchase date">
                              <div className="flex items-center">
                                <span>Purchased Date</span>
                                <SortIndicator column="purchase_date" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('last_updated')}>
                            <TooltipWrapper content="Last modification date - Click to sort by last updated">
                              <div className="flex items-center">
                                <span>Last Updated</span>
                                <SortIndicator column="last_updated" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-right text-muted-foreground w-[100px] sticky right-0 bg-white dark:bg-gray-800 z-10">
                            <TooltipWrapper content="Available actions for this asset">
                              <div className="flex items-center justify-end">
                                <span>Actions</span>
                              </div>
                            </TooltipWrapper>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedAssets.length > 0 ? (
                          paginatedAssets.map(asset => (
                            <tr key={asset.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                              {/* Image Cell */}
                              <td className="p-4 align-middle cursor-pointer" onClick={() => handleInfoClick(asset)}>
                                <TooltipWrapper content={`${asset.name || 'Unknown Asset'} - Click to view full details`}>
                                  <Avatar className="h-9 w-9">
                                    <AvatarImage src={asset.image_url || undefined} alt={asset.name} />
                                    <AvatarFallback>{asset.name?.charAt(0).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                </TooltipWrapper>
                              </td>
                              {/* Name Cell */}
                              <td className="p-4 align-middle font-medium text-gray-900 whitespace-nowrap dark:text-white cursor-pointer" onClick={() => handleInfoClick(asset)}>
                                <TooltipWrapper content={`Asset: ${asset.name || 'N/A'} - Click to view full details`}>
                                  <HighlightMatch text={asset.name || 'N/A'} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* ID Cell */}
                              <td className="p-4 align-middle">
                                <TooltipWrapper content={`Asset ID: ${asset.id || 'N/A'}`}>
                                  <HighlightMatch text={asset.id || 'N/A'} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Type Cell */}
                              <td className="p-4 align-middle">
                                <TooltipWrapper content={`Asset Type: ${asset.type || 'N/A'}`}>
                                  <HighlightMatch text={asset.type || 'N/A'} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Condition Cell */}
                              <td className="p-4 align-middle">
                                <TooltipWrapper content={`Current Condition: ${asset.condition || 'N/A'}`}>
                                  <span className={cn("px-2 py-1 rounded-full text-xs font-medium border", getConditionBadgeClass(asset.condition))}>
                                    <HighlightMatch text={asset.condition || 'N/A'} searchTerm={debouncedFilterText} />
                                  </span>
                                </TooltipWrapper>
                              </td>
                              {/* Assigned To Cell */}
                              <td className="p-4 align-middle">
                                <TooltipWrapper content={`Assigned To: ${asset.assigned_to || 'N/A'}`}>
                                  <HighlightMatch text={asset.assigned_to || 'N/A'} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Email Cell */}
                              <td className="p-4 align-middle">
                                <TooltipWrapper content={`Email: ${asset.assigned_to_email || 'N/A'}`}>
                                  <HighlightMatch text={asset.assigned_to_email || 'N/A'} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Unit Cell */}
                              <td className="p-4 align-middle">
                                <TooltipWrapper content={`Unit: ${asset.unit || 'N/A'}`}>
                                  <HighlightMatch text={asset.unit || 'N/A'} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Division Cell */}
                              <td className="p-4 align-middle">
                                <TooltipWrapper content={`Division: ${asset.division || 'N/A'}`}>
                                  <HighlightMatch text={asset.division || 'N/A'} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Description Cell */}
                              <td className="p-4 align-middle max-w-xs truncate">
                                <TooltipWrapper content={`Description: ${asset.description || 'No description available'}`}>
                                  <HighlightMatch text={asset.description || 'N/A'} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Assigned Date Cell */}
                              <td className="p-4 align-middle">
                                <TooltipWrapper content={`Assigned Date: ${formatDate(asset.assigned_date) || 'N/A'}`}>
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {formatDate(asset.assigned_date) || 'N/A'}
                                  </span>
                                </TooltipWrapper>
                              </td>
                              {/* Purchase Date Cell */}
                              <td className="p-4 align-middle">
                                <TooltipWrapper content={`Purchase Date: ${formatDate(asset.purchase_date) || 'N/A'}`}>
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {formatDate(asset.purchase_date) || 'N/A'}
                                  </span>
                                </TooltipWrapper>
                              </td>
                              {/* Last Updated Cell */}
                              <td className="p-4 align-middle">
                                <TooltipWrapper content={`Last Updated: ${formatDate(asset.last_updated) || 'N/A'}`}>
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {formatDate(asset.last_updated) || 'N/A'}
                                  </span>
                                </TooltipWrapper>
                              </td>
                              {/* Actions Cell - sticky right */}
                              <td className="p-4 align-middle sticky right-0 bg-white dark:bg-gray-800 text-right z-10 group-hover:bg-gray-50 dark:group-hover:bg-gray-800/50">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                      <span className="sr-only">Open menu</span>
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="z-50">
                                    <DropdownMenuItem onClick={() => handleInfoClick(asset)}>
                                      <Info className="mr-2 h-4 w-4" />
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEditClick(asset)}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeleteClick(asset)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={14} className="h-24 text-center text-gray-500 dark:text-gray-400"> {/* Adjusted colSpan */}
                              {filterText || filterType !== 'all' || filterCondition !== 'all' || filterUnit !== 'all' || filterDivision !== 'all'
                                ? `No assets found matching the current filters.`
                                : "No assets were found."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                  {/* End Table View */}

                  {/* Card View */}
                  {viewMode === 'card' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4"> {/* Keep padding for card view */}
                      {paginatedAssets.length > 0 ? (
                        paginatedAssets.map(asset => (
                          <AssetCard
                            key={asset.id}
                            asset={asset}
                            onClick={() => handleInfoClick(asset)}
                            onEdit={() => handleEditClick(asset)}
                            onDelete={() => handleDeleteClick(asset)}
                          />
                        ))
                      ) : (
                        <div className="col-span-full text-center py-10 px-4 text-muted-foreground">
                          {filterText || filterType !== 'all' || filterCondition !== 'all' || filterUnit !== 'all' || filterDivision !== 'all'
                            ? `No assets found matching the current filters.`
                            : "No assets were found."}
                        </div>
                      )}
                    </div>
                  )}
                  {/* End Card View */}

                  {/* Detailed List View - Enhanced with sticky headers and comprehensive tooltips */}
                  {viewMode === 'detailed-list' && (
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400 min-w-max">
                      <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10 shadow-sm">
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground w-[50px] sticky left-0 bg-white dark:bg-gray-800 z-20">
                            <TooltipWrapper content="Asset image - Click asset row to view full details">
                              <div className="flex items-center justify-center">
                                <span>Img</span>
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] sticky left-[50px] bg-white dark:bg-gray-800 z-20 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('name')}>
                            <TooltipWrapper content="Asset name - Click to sort alphabetically">
                              <div className="flex items-center">
                                <span>Name</span>
                                <SortIndicator column="name" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[100px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('id')}>
                            <TooltipWrapper content="Unique asset identifier - Click to sort by ID">
                              <div className="flex items-center">
                                <span>ID</span>
                                <SortIndicator column="id" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('type')}>
                            <TooltipWrapper content="Asset category/type - Click to sort by type">
                              <div className="flex items-center">
                                <span>Type</span>
                                <SortIndicator column="type" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('brand')}>
                            <TooltipWrapper content="Asset brand/manufacturer - Click to sort by brand">
                              <div className="flex items-center">
                                <span>Brand</span>
                                <SortIndicator column="brand" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('model')}>
                            <TooltipWrapper content="Asset model - Click to sort by model">
                              <div className="flex items-center">
                                <span>Model</span>
                                <SortIndicator column="model" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('serial_number')}>
                            <TooltipWrapper content="Asset serial number - Click to sort by serial number">
                              <div className="flex items-center">
                                <span>Serial Number</span>
                                <SortIndicator column="serial_number" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('asset_id')}>
                            <TooltipWrapper content="Asset ID - Click to sort by asset ID">
                              <div className="flex items-center">
                                <span>Asset ID</span>
                                <SortIndicator column="asset_id" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[100px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('condition')}>
                            <TooltipWrapper content="Current asset condition - Click to sort by condition">
                              <div className="flex items-center">
                                <span>Condition</span>
                                <SortIndicator column="condition" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('assigned_to')}>
                            <TooltipWrapper content="Person currently assigned this asset - Click to sort by assignee">
                              <div className="flex items-center">
                                <span>Assigned To</span>
                                <SortIndicator column="assigned_to" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[200px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('assigned_to_email')}>
                            <TooltipWrapper content="Email of assigned person - Click to sort by email">
                              <div className="flex items-center">
                                <span>Email</span>
                                <SortIndicator column="assigned_to_email" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('unit')}>
                            <TooltipWrapper content="Organizational unit - Click to sort by unit">
                              <div className="flex items-center">
                                <span>Unit</span>
                                <SortIndicator column="unit" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[200px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('division')}>
                            <TooltipWrapper content="Division within organization - Click to sort by division">
                              <div className="flex items-center">
                                <span>Division</span>
                                <SortIndicator column="division" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[200px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('description')}>
                            <TooltipWrapper content="Asset description - Click to sort by description">
                              <div className="flex items-center">
                                <span>Description</span>
                                <SortIndicator column="description" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('assigned_date')}>
                            <TooltipWrapper content="Date asset was assigned - Click to sort by assigned date">
                              <div className="flex items-center">
                                <span>Assigned Date</span>
                                <SortIndicator column="assigned_date" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('purchase_date')}>
                            <TooltipWrapper content="Date asset was purchased - Click to sort by purchase date">
                              <div className="flex items-center">
                                <span>Purchase Date</span>
                                <SortIndicator column="purchase_date" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('purchase_cost')}>
                            <TooltipWrapper content="Cost of asset purchase - Click to sort by purchase cost">
                              <div className="flex items-center">
                                <span>Purchase Cost</span>
                                <SortIndicator column="purchase_cost" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('vendor')}>
                            <TooltipWrapper content="Asset vendor/supplier - Click to sort by vendor">
                              <div className="flex items-center">
                                <span>Vendor</span>
                                <SortIndicator column="vendor" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('warranty_expiry_date')}>
                            <TooltipWrapper content="Warranty expiration date - Click to sort by warranty expiry">
                              <div className="flex items-center">
                                <span>Warranty Expiry</span>
                                <SortIndicator column="warranty_expiry_date" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('expiry_date')}>
                            <TooltipWrapper content="Asset expiration date - Click to sort by expiry date">
                              <div className="flex items-center">
                                <span>Expiry Date</span>
                                <SortIndicator column="expiry_date" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('life_expectancy_years')}>
                            <TooltipWrapper content="Expected asset lifespan in years - Click to sort by life expectancy">
                              <div className="flex items-center">
                                <span>Life Exp (Yrs)</span>
                                <SortIndicator column="life_expectancy_years" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('depreciated_value')}>
                            <TooltipWrapper content="Current depreciated value - Click to sort by depreciated value">
                              <div className="flex items-center">
                                <span>Depreciated Value</span>
                                <SortIndicator column="depreciated_value" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('ytd_usage')}>
                            <TooltipWrapper content="Year-to-date usage information - Click to sort by YTD usage">
                              <div className="flex items-center">
                                <span>YTD Usage</span>
                                <SortIndicator column="ytd_usage" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('notes')}>
                            <TooltipWrapper content="Additional notes about the asset - Click to sort by notes">
                              <div className="flex items-center">
                                <span>Notes</span>
                                <SortIndicator column="notes" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('last_updated')}>
                            <TooltipWrapper content="Last modification date - Click to sort by last updated">
                              <div className="flex items-center">
                                <span>Last Updated</span>
                                <SortIndicator column="last_updated" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('last_updated_by')}>
                            <TooltipWrapper content="Person who last updated this asset - Click to sort by updated by">
                              <div className="flex items-center">
                                <span>Updated By</span>
                                <SortIndicator column="last_updated_by" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('created_at')}>
                            <TooltipWrapper content="Asset creation date - Click to sort by created at">
                              <div className="flex items-center">
                                <span>Created At</span>
                                <SortIndicator column="created_at" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('created_by')}>
                            <TooltipWrapper content="Person who created/uploaded this asset - Click to sort by created by">
                              <div className="flex items-center">
                                <span>Created By</span>
                                <SortIndicator column="created_by" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('admin_comments')}>
                            <TooltipWrapper content="Administrative comments - Click to sort by admin comments">
                              <div className="flex items-center">
                                <span>Admin Comments</span>
                                <SortIndicator column="admin_comments" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('invoice_url')}>
                            <TooltipWrapper content="Invoice document URL - Click to sort by invoice URL">
                              <div className="flex items-center">
                                <span>Invoice URL</span>
                                <SortIndicator column="invoice_url" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-left text-muted-foreground min-w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => handleSort('barcode_url')}>
                            <TooltipWrapper content="Barcode document URL - Click to sort by barcode URL">
                              <div className="flex items-center">
                                <span>Barcode URL</span>
                                <SortIndicator column="barcode_url" />
                              </div>
                            </TooltipWrapper>
                          </th>
                          <th scope="col" className="h-12 px-4 text-sm font-medium text-right text-muted-foreground w-[100px] sticky right-0 bg-white dark:bg-gray-800 z-20">
                            <TooltipWrapper content="Available actions for this asset">
                              <div className="flex items-center justify-end">
                                <span>Actions</span>
                              </div>
                            </TooltipWrapper>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedAssets.length === 0 ? (
                          <tr>
                            <td colSpan={32} className="h-16 text-center text-muted-foreground py-1 px-2">
                              {filterText || filterType !== 'all' || filterCondition !== 'all' || filterUnit !== 'all' || filterDivision !== 'all'
                                ? `No assets found matching the current filters.`
                                : "No assets were found."}
                            </td>
                          </tr>
                        ) : (
                          paginatedAssets.map((asset) => (
                            <tr key={asset.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                              {/* Image Cell */}
                              <td className="p-4 align-middle w-[50px] sticky left-0 z-10 bg-white group-hover:bg-gray-50 dark:bg-gray-800 dark:group-hover:bg-gray-800/50 cursor-pointer transition-colors" onClick={() => handleInfoClick(asset)}>
                                <TooltipWrapper content={`${asset.name || 'Unknown Asset'} - Click to view full details`}>
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={asset.image_url || undefined} alt={asset.name} />
                                    <AvatarFallback>{asset.name?.charAt(0).toUpperCase() || 'A'}</AvatarFallback>
                                  </Avatar>
                                </TooltipWrapper>
                              </td>
                              {/* Name Cell */}
                              <td className="p-4 align-middle min-w-[150px] font-medium text-gray-900 whitespace-nowrap dark:text-white sticky left-[50px] bg-white group-hover:bg-gray-50 dark:bg-gray-800 dark:group-hover:bg-gray-800/50 z-10 cursor-pointer transition-colors" onClick={() => handleInfoClick(asset)}>
                                <TooltipWrapper content={`Asset: ${asset.name || 'N/A'} - Click to view full details`}>
                                  <HighlightMatch text={asset.name} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* ID Cell */}
                              <td className="p-4 align-middle min-w-[100px]">
                                <TooltipWrapper content={`Asset ID: ${asset.id || 'N/A'}`}>
                                  <HighlightMatch text={asset.id} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Type Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Asset Type: ${asset.type || 'N/A'}`}>
                                  <HighlightMatch text={asset.type} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Brand Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Brand: ${asset.brand || 'N/A'}`}>
                                  <HighlightMatch text={asset.brand || 'N/A'} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Model Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Model: ${asset.model || 'N/A'}`}>
                                  <HighlightMatch text={asset.model || 'N/A'} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Serial Number Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Serial Number: ${asset.serial_number || 'N/A'}`}>
                                  <HighlightMatch text={asset.serial_number || 'N/A'} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Asset ID Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Asset ID: ${asset.asset_id || 'N/A'}`}>
                                  <HighlightMatch text={asset.asset_id || 'N/A'} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Condition Cell */}
                              <td className="p-4 align-middle min-w-[100px]">
                                <TooltipWrapper content={`Current Condition: ${asset.condition || 'N/A'}`}>
                                  <span className={cn(
                                    "px-2 py-1 rounded-full text-xs font-medium",
                                    asset.condition === 'Good' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' :
                                      asset.condition === 'Fair' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' :
                                        asset.condition === 'Poor' ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100' :
                                          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                                  )}>
                                    <HighlightMatch text={asset.condition} searchTerm={debouncedFilterText} />
                                  </span>
                                </TooltipWrapper>
                              </td>
                              {/* Assigned To Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Assigned To: ${asset.assigned_to || 'N/A'}`}>
                                  <HighlightMatch text={asset.assigned_to} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Email Cell */}
                              <td className="p-4 align-middle min-w-[200px]">
                                <TooltipWrapper content={`Email: ${asset.assigned_to_email || 'N/A'}`}>
                                  <span className="text-sm">{asset.assigned_to_email || 'N/A'}</span>
                                </TooltipWrapper>
                              </td>
                              {/* Unit Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Unit: ${asset.unit || 'N/A'}`}>
                                  <HighlightMatch text={asset.unit} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Division Cell */}
                              <td className="p-4 align-middle min-w-[200px]">
                                <TooltipWrapper content={`Division: ${asset.division || 'N/A'}`}>
                                  <HighlightMatch text={asset.division} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Description Cell */}
                              <td className="p-4 align-middle max-w-[200px] truncate">
                                <TooltipWrapper content={`Description: ${asset.description || 'No description available'}`}>
                                  <HighlightMatch text={asset.description || 'N/A'} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Assigned Date Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Assigned Date: ${formatDate(asset.assigned_date) || 'N/A'}`}>
                                  <span className="text-sm text-muted-foreground">{formatDate(asset.assigned_date) || 'N/A'}</span>
                                </TooltipWrapper>
                              </td>
                              {/* Purchase Date Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Purchase Date: ${formatDate(asset.purchase_date) || 'N/A'}`}>
                                  <span className="text-sm text-muted-foreground">{formatDate(asset.purchase_date) || 'N/A'}</span>
                                </TooltipWrapper>
                              </td>
                              {/* Purchase Cost Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Purchase Cost: ${asset.purchase_cost != null ? `$${asset.purchase_cost.toFixed(2)}` : 'N/A'}`}>
                                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                    {asset.purchase_cost != null ? `$${asset.purchase_cost.toFixed(2)}` : 'N/A'}
                                  </span>
                                </TooltipWrapper>
                              </td>
                              {/* Vendor Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Vendor: ${asset.vendor || 'N/A'}`}>
                                  <HighlightMatch text={asset.vendor} searchTerm={debouncedFilterText} />
                                </TooltipWrapper>
                              </td>
                              {/* Warranty Expiry Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Warranty Expiry: ${formatDate(asset.warranty_expiry_date) || 'N/A'}`}>
                                  <span className="text-sm text-muted-foreground">{formatDate(asset.warranty_expiry_date) || 'N/A'}</span>
                                </TooltipWrapper>
                              </td>
                              {/* Expiry Date Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Expiry Date: ${formatDate(asset.expiry_date) || 'N/A'}`}>
                                  <span className="text-sm text-muted-foreground">{formatDate(asset.expiry_date) || 'N/A'}</span>
                                </TooltipWrapper>
                              </td>
                              {/* Life Expectancy Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Life Expectancy: ${asset.life_expectancy_years ?? 'N/A'} years`}>
                                  <span className="text-sm">{asset.life_expectancy_years ?? 'N/A'}</span>
                                </TooltipWrapper>
                              </td>
                              {/* Depreciated Value Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Depreciated Value: ${asset.depreciated_value != null ? `$${asset.depreciated_value.toFixed(2)}` : 'N/A'}`}>
                                  <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                                    {asset.depreciated_value != null ? `$${asset.depreciated_value.toFixed(2)}` : 'N/A'}
                                  </span>
                                </TooltipWrapper>
                              </td>
                              {/* YTD Usage Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`YTD Usage: ${asset.ytd_usage || 'N/A'}`}>
                                  <span className="text-sm">{asset.ytd_usage || 'N/A'}</span>
                                </TooltipWrapper>
                              </td>
                              {/* Notes Cell */}
                              <td className="p-4 align-middle max-w-[150px] truncate">
                                <TooltipWrapper content={`Notes: ${asset.notes || 'No notes available'}`}>
                                  <span className="text-sm text-muted-foreground">{asset.notes || 'N/A'}</span>
                                </TooltipWrapper>
                              </td>
                              {/* Last Updated Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Last Updated: ${formatDate(asset.last_updated) || 'N/A'}`}>
                                  <span className="text-sm text-muted-foreground">{formatDate(asset.last_updated) || 'N/A'}</span>
                                </TooltipWrapper>
                              </td>
                              {/* Updated By Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Updated By: ${asset.last_updated_by || 'N/A'}`}>
                                  <span className="text-sm">{asset.last_updated_by || 'N/A'}</span>
                                </TooltipWrapper>
                              </td>
                              {/* Created At Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Created At: ${formatDate(asset.created_at) || 'N/A'}`}>
                                  <span className="text-sm text-muted-foreground">{formatDate(asset.created_at) || 'N/A'}</span>
                                </TooltipWrapper>
                              </td>
                              {/* Created By Cell */}
                              <td className="p-4 align-middle min-w-[150px]">
                                <TooltipWrapper content={`Created By: ${asset.created_by || 'N/A'}`}>
                                  <span className="text-sm">{asset.created_by || 'N/A'}</span>
                                </TooltipWrapper>
                              </td>
                              {/* Admin Comments Cell */}
                              <td className="p-4 align-middle max-w-[150px] truncate">
                                <TooltipWrapper content={`Admin Comments: ${asset.admin_comments || 'No admin comments'}`}>
                                  <span className="text-sm text-muted-foreground">{asset.admin_comments || 'N/A'}</span>
                                </TooltipWrapper>
                              </td>
                              {/* Invoice URL Cell */}
                              <td className="p-4 align-middle max-w-[150px] truncate">
                                <TooltipWrapper content={`Invoice URL: ${asset.invoice_url || 'No invoice URL'}`}>
                                  <span className="text-sm text-blue-600 dark:text-blue-400">{asset.invoice_url || 'N/A'}</span>
                                </TooltipWrapper>
                              </td>
                              {/* Barcode URL Cell */}
                              <td className="p-4 align-middle max-w-[150px] truncate">
                                <TooltipWrapper content={`Barcode URL: ${asset.barcode_url || 'No barcode URL'}`}>
                                  <span className="text-sm text-blue-600 dark:text-blue-400">{asset.barcode_url || 'N/A'}</span>
                                </TooltipWrapper>
                              </td>
                              {/* Actions Cell */}
                              <td className="p-4 align-middle sticky right-0 bg-white dark:bg-gray-800 text-right z-10 group-hover:bg-gray-50 dark:group-hover:bg-gray-800/50">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                      <span className="sr-only">Open menu</span>
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="z-50">
                                    <DropdownMenuItem onClick={() => handleInfoClick(asset)}>
                                      <Info className="mr-2 h-4 w-4" />
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEditClick(asset)}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeleteClick(asset)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                  {/* End Detailed List View */}
                </> /* Closing Fragment for !loading && !error */
              )}
              {/* Pagination Controls (Now directly inside CardContent, after the conditional content) */}
              {!assetsLoading && !assetsError && totalPages > 1 && (
                <div className="sticky bottom-0 bg-background flex items-center justify-between border-t p-4 flex-shrink-0 z-40"> {/* Made pagination sticky */}
                  <span className="text-sm text-muted-foreground">
                    Showing {paginatedAssets.length} of {sortedAssets.length} assets
                    {sortColumn && (
                      <span className="ml-2 text-blue-600 dark:text-blue-400">
                        (sorted by {sortColumn} {sortDirection === 'asc' ? '↑' : '↓'})
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm font-medium">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div> {/* Close scroll container */}
          </div>
        </div>

        {/* Modals — only one renders at a time via activeModal state */}
        {activeModal.type === 'edit' && activeModal.asset && (
          <EditAssetModal
            isOpen={activeModal.type === 'edit'}
            onClose={handleCloseModals}
            onEdit={handleSaveEdit}
            asset={activeModal.asset}
            onDelete={() => handleDeleteClick(activeModal.asset!)}
            divisions={divisions}
            units={units}
            staffMembers={staffMembers}
            existingNames={existingNames}
            existingTypes={existingTypes}
            existingVendors={existingVendors}
          />
        )}

        {activeModal.type === 'delete' && activeModal.asset && (
          <DeleteModal
            open={activeModal.type === 'delete'}
            onOpenChange={(open) => !open && handleCloseModals()}
            onDelete={handleConfirmDelete}
            title="Delete Asset"
            description={`Are you sure you want to delete the asset "${activeModal.asset.name || "this asset"}"? This action cannot be undone.`}
          />
        )}

        <AssetInfoModal
          asset={activeModal.type === 'info' ? activeModal.asset : null}
          isOpen={activeModal.type === 'info'}
          onClose={handleCloseModals}
        />
      </CardContent>
    </Card>
    </div>
  );

  return skipPageLayout ? mainContent : <PageLayout>{mainContent}</PageLayout>;
};

export default AssetManagement; 
