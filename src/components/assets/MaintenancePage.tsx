import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { TooltipWrapper } from "@/components/ui/tooltip-wrapper";
import { formatDate } from "@/lib/utils";
import { Plus, Search, RotateCcw, Eye, Edit, Trash2, MoreHorizontal, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAssetSubSharePoint } from "@/hooks/useAssetSubSharePoint";
import { useAssetsSharePoint } from "@/hooks/useAssetsSharePoint";

export function MaintenancePage() {
  const { toast } = useToast();
  const { useMaintenance } = useAssetSubSharePoint();
  const { data: maintenanceRecords = [], isLoading: loadingMaint } = useMaintenance();
  
  // Also fetch assets to map Asset ID to Asset Name
  const { assets, loading: loadingAssets } = useAssetsSharePoint();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortColumn, setSortColumn] = useState("scheduledDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Helper to get asset name from ID
  const getAssetName = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId || a.asset_id === assetId);
    return asset ? asset.name : assetId;
  };

  // Reset filters
  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
  };

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Render sort indicator
  const renderSortIndicator = (column: string) => {
    if (sortColumn === column) {
      return <span className="ml-1">{sortDirection === "asc" ? "▲" : "▼"}</span>;
    }
    return null;
  };

  // Status badge color mapping
  const getStatusBadgeClass = (status: string) => {
    const s = status?.toLowerCase() || "";
    switch (s) {
      case "scheduled":
        return "bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full text-xs";
      case "in-progress":
        return "bg-yellow-100 text-yellow-800 border border-yellow-200 px-2 py-0.5 rounded-full text-xs";
      case "completed":
        return "bg-green-100 text-green-800 border border-green-200 px-2 py-0.5 rounded-full text-xs";
      case "cancelled":
        return "bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded-full text-xs";
      default:
        return "bg-gray-100 text-gray-800 border border-gray-200 px-2 py-0.5 rounded-full text-xs";
    }
  };

  // Type badge color mapping
  const getTypeBadgeClass = (type: string) => {
    const t = type?.toLowerCase() || "";
    switch (t) {
      case "preventive":
        return "bg-green-100 text-green-800 border border-green-200 px-2 py-0.5 rounded-full text-xs";
      case "corrective":
        return "bg-orange-100 text-orange-800 border border-orange-200 px-2 py-0.5 rounded-full text-xs";
      case "inspection":
        return "bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full text-xs";
      default:
        return "bg-gray-100 text-gray-800 border border-gray-200 px-2 py-0.5 rounded-full text-xs";
    }
  };

  // Action handlers
  const handleViewRecord = (record: any) => {
    toast({
      title: "View Maintenance Record",
      description: `Viewing maintenance record for ${getAssetName(record.asset_id)}`,
    });
  };

  const handleEditRecord = (record: any) => {
    toast({
      title: "Edit Maintenance Record",
      description: `Editing maintenance record for ${getAssetName(record.asset_id)}`,
    });
  };

  const handleDeleteRecord = (record: any) => {
    toast({
      title: "Delete Maintenance Record",
      description: `Deleting maintenance record for ${getAssetName(record.asset_id)}`,
    });
  };

  // Filter and sort maintenance records
  const filteredRecords = (maintenanceRecords || [])
    .filter((record) => {
      const assetName = getAssetName(record.asset_id);
      const matchesSearch =
        searchQuery === "" ||
        String(assetName).toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(record.asset_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(record.description).toLowerCase().includes(searchQuery.toLowerCase()) ||
        (record.technician && String(record.technician).toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === "all" || record.status?.toLowerCase() === statusFilter.toLowerCase();
      const matchesType = typeFilter === "all" || record.maintenance_type?.toLowerCase() === typeFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Map sort columns to SharePoint fields
      switch (sortColumn) {
        case "assetName": aValue = getAssetName(a.asset_id); bValue = getAssetName(b.asset_id); break;
        case "assetId": aValue = a.asset_id; bValue = b.asset_id; break;
        case "type": aValue = a.maintenance_type; bValue = b.maintenance_type; break;
        case "status": aValue = a.status; bValue = b.status; break;
        case "scheduledDate": aValue = a.scheduled_date; bValue = b.scheduled_date; break;
        case "completedDate": aValue = a.completed_date; bValue = b.completed_date; break;
        case "technician": aValue = a.technician; bValue = b.technician; break;
        case "cost": aValue = a.cost; bValue = b.cost; break;
        default: aValue = a.description; bValue = b.description;
      }

      if (aValue === undefined || aValue === null) aValue = "";
      if (bValue === undefined || bValue === null) bValue = "";

      const comparison = String(aValue).localeCompare(String(bValue));
      return sortDirection === "asc" ? comparison : -comparison;
    });

  if (loadingMaint || loadingAssets) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="w-full shadow-sm border">
      <CardContent className="p-6 space-y-6">
        <div className="shrink-0 space-y-0.5 border-b border-gray-100 dark:border-gray-800 pb-4 mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Maintenance</h2>
            <p className="text-muted-foreground">Track and schedule maintenance operations for assets.</p>
          </div>
          <TooltipWrapper content="Add new maintenance record">
            <Button className="flex items-center gap-2" onClick={() => toast({ title: "Coming Soon", description: "Use Asset Registry to add maintenance." })}>
              <Plus className="h-4 w-4" /> Add Record
            </Button>
          </TooltipWrapper>
        </div>

        <div className="flex flex-col space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <TooltipWrapper content="Search maintenance records">
              <Input
                placeholder="Search by asset, description, technician..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </TooltipWrapper>
          </div>

          <div className="flex flex-wrap gap-3">
            <TooltipWrapper content="Filter by status">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </TooltipWrapper>

            <TooltipWrapper content="Filter by type">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="preventive">Preventive</SelectItem>
                  <SelectItem value="corrective">Corrective</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                </SelectContent>
              </Select>
            </TooltipWrapper>

            <TooltipWrapper content="Reset all filters">
              <Button variant="outline" onClick={resetFilters} className="gap-1">
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
            </TooltipWrapper>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="responsive-table-container">
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-white border-b">
                    <TableRow>
                      <TableHead
                        className="font-medium cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("assetName")}
                      >
                        <TooltipWrapper content="Click to sort by asset name">
                          <div className="flex items-center">
                            Asset Name {renderSortIndicator("assetName")}
                          </div>
                        </TooltipWrapper>
                      </TableHead>
                      <TableHead
                        className="font-medium cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("assetId")}
                      >
                        <TooltipWrapper content="Click to sort by asset ID">
                          <div className="flex items-center">
                            Asset ID {renderSortIndicator("assetId")}
                          </div>
                        </TooltipWrapper>
                      </TableHead>
                      <TableHead
                        className="font-medium cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("type")}
                      >
                        <TooltipWrapper content="Click to sort by maintenance type">
                          <div className="flex items-center">
                            Type {renderSortIndicator("type")}
                          </div>
                        </TooltipWrapper>
                      </TableHead>
                      <TableHead
                        className="font-medium cursor-pointer max-w-[200px]"
                        onClick={() => handleSort("description")}
                      >
                        <TooltipWrapper content="Click to sort by description">
                          <div className="flex items-center">
                            Description {renderSortIndicator("description")}
                          </div>
                        </TooltipWrapper>
                      </TableHead>
                      <TableHead
                        className="font-medium cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("status")}
                      >
                        <TooltipWrapper content="Click to sort by status">
                          <div className="flex items-center">
                            Status {renderSortIndicator("status")}
                          </div>
                        </TooltipWrapper>
                      </TableHead>
                      <TableHead
                        className="font-medium cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("scheduledDate")}
                      >
                        <TooltipWrapper content="Click to sort by scheduled date">
                          <div className="flex items-center">
                            Scheduled Date {renderSortIndicator("scheduledDate")}
                          </div>
                        </TooltipWrapper>
                      </TableHead>
                      <TableHead
                        className="font-medium cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("completedDate")}
                      >
                        <TooltipWrapper content="Click to sort by completed date">
                          <div className="flex items-center">
                            Completed Date {renderSortIndicator("completedDate")}
                          </div>
                        </TooltipWrapper>
                      </TableHead>
                      <TableHead
                        className="font-medium cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("technician")}
                      >
                        <TooltipWrapper content="Click to sort by technician">
                          <div className="flex items-center">
                            Technician {renderSortIndicator("technician")}
                          </div>
                        </TooltipWrapper>
                      </TableHead>
                      <TableHead
                        className="font-medium cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("cost")}
                      >
                        <TooltipWrapper content="Click to sort by cost">
                          <div className="flex items-center">
                            Cost {renderSortIndicator("cost")}
                          </div>
                        </TooltipWrapper>
                      </TableHead>
                      <TableHead className="text-right font-medium sticky right-0 bg-white z-20 whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="h-24 text-center">
                          No maintenance records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="whitespace-nowrap">
                            <TooltipWrapper content={`Asset: ${getAssetName(record.asset_id)}`}>
                              {getAssetName(record.asset_id)}
                            </TooltipWrapper>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <TooltipWrapper content={`Asset ID: ${record.asset_id}`}>
                              {record.asset_id}
                            </TooltipWrapper>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <TooltipWrapper content={`Maintenance type: ${record.maintenance_type}`}>
                              <span className={getTypeBadgeClass(record.maintenance_type)}>
                                {String(record.maintenance_type).charAt(0).toUpperCase() + String(record.maintenance_type).slice(1)}
                              </span>
                            </TooltipWrapper>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            <TooltipWrapper content={record.description}>
                              {record.description}
                            </TooltipWrapper>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <TooltipWrapper content={`Status: ${record.status}`}>
                              <span className={getStatusBadgeClass(record.status)}>
                                {String(record.status).charAt(0).toUpperCase() + String(record.status).slice(1)}
                              </span>
                            </TooltipWrapper>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <TooltipWrapper content={`Scheduled for: ${formatDate(record.scheduled_date)}`}>
                              {formatDate(record.scheduled_date)}
                            </TooltipWrapper>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <TooltipWrapper content={record.completed_date ? `Completed on: ${formatDate(record.completed_date)}` : 'Not completed yet'}>
                              {record.completed_date ? formatDate(record.completed_date) : "N/A"}
                            </TooltipWrapper>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <TooltipWrapper content={record.technician || 'No technician assigned'}>
                              {record.technician || "N/A"}
                            </TooltipWrapper>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <TooltipWrapper content={record.cost ? `$${Number(record.cost).toFixed(2)}` : 'No cost recorded'}>
                              {record.cost ? `$${Number(record.cost).toFixed(2)}` : "N/A"}
                            </TooltipWrapper>
                          </TableCell>
                          <TableCell className="text-right sticky right-0 bg-white z-10">
                            <DropdownMenu>
                              <TooltipWrapper content="Maintenance record actions">
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                              </TooltipWrapper>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewRecord(record)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditRecord(record)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteRecord(record)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-sm text-muted-foreground">
          Showing {filteredRecords.length} of {maintenanceRecords.length} maintenance records
        </div>
      </CardContent>
    </Card>
  );
}
