import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { useToast } from "@/hooks/use-toast";
import { FilterGroup } from '@/components/assets/filters/FilterGroup';
import { DecommissionedAssetTableHeader } from '@/components/assets/table/DecommissionedAssetTableHeader';
import { DecommissionedAssetTableRow } from '@/components/assets/table/DecommissionedAssetTableRow';
import { useAssetsSharePoint } from '@/hooks/useAssetsSharePoint';
import { Loader2 } from 'lucide-react';

const DecommissionedAssets: React.FC = () => {
  const { toast } = useToast();
  // Fetch assets including soft-deleted ones
  const { assets, loading, refresh } = useAssetsSharePoint({ includeDeleted: true });

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [sortColumn, setSortColumn] = useState<string>('decommission_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filter for decommissioned assets only
  // Logic: Assets that ARE deleted OR have a condition like 'Out of Service' or 'Decommissioned'
  const decommissionedAssets = useMemo(() => {
    return assets.filter(asset => 
      asset.is_deleted || 
      asset.condition === 'Out of Service' || 
      asset.condition === 'Decommissioned' ||
      asset.condition === 'For Disposal'
    ).map(asset => ({
      ...asset,
      // Map SharePoint fields to the interface expected by DecommissionedAssetTableRow
      asset_id: asset.id || '', 
      reason: asset.condition || 'Decommissioned', // Use condition as reason if not explicitly stored
      decommission_date: asset.deleted_at || asset.last_updated || '',
      email: asset.assigned_to_email || '',
    }));
  }, [assets]);

  // Handle sort column click
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Extract unique values for filters
  const types = useMemo(() => [...new Set(decommissionedAssets.map(asset => asset.type).filter(Boolean))], [decommissionedAssets]);
  const reasons = useMemo(() => [...new Set(decommissionedAssets.map(asset => asset.reason).filter(Boolean))], [decommissionedAssets]);
  const units = useMemo(() => [...new Set(decommissionedAssets.map(asset => asset.unit).filter(Boolean))], [decommissionedAssets]);
  const divisions = useMemo(() => [...new Set(decommissionedAssets.map(asset => asset.division).filter(Boolean))], [decommissionedAssets]);

  // Create filter options
  const filterOptions = {
    type: {
      value: typeFilter,
      options: types.map(type => ({ value: type, label: type })),
      label: 'Type',
      tooltip: 'Filter by asset type'
    },
    reason: {
      value: reasonFilter,
      options: reasons.map(reason => ({ value: reason, label: reason })),
      label: 'Reason',
      tooltip: 'Filter by decommission reason'
    },
    unit: {
      value: unitFilter,
      options: units.map(unit => ({ value: unit, label: unit })),
      label: 'Unit',
      tooltip: 'Filter by unit'
    },
    division: {
      value: divisionFilter,
      options: divisions.map(division => ({ value: division, label: division })),
      label: 'Division',
      tooltip: 'Filter by division'
    }
  };

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    switch (key) {
      case 'type': setTypeFilter(value); break;
      case 'reason': setReasonFilter(value); break;
      case 'unit': setUnitFilter(value); break;
      case 'division': setDivisionFilter(value); break;
    }
  };

  // Apply filters and sorting
  const filteredAssets = decommissionedAssets.filter(asset => {
    const matchesSearch =
      searchTerm === '' ||
      Object.values(asset).some(val =>
        val && val.toString().toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesType = typeFilter === 'all' || asset.type === typeFilter;
    const matchesReason = reasonFilter === 'all' || asset.reason === reasonFilter;
    const matchesUnit = unitFilter === 'all' || asset.unit === unitFilter;
    const matchesDivision = divisionFilter === 'all' || asset.division === divisionFilter;

    return matchesSearch && matchesType && matchesReason && matchesUnit && matchesDivision;
  }).sort((a: any, b: any) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];

    if (!aValue && !bValue) return 0;
    if (!aValue) return 1;
    if (!bValue) return -1;

    const comparison = String(aValue).localeCompare(String(bValue));
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setReasonFilter('all');
    setUnitFilter('all');
    setDivisionFilter('all');
  };

  // Handle asset actions
  const handleViewAsset = (asset: any) => {
    toast({
      title: 'View Asset',
      description: `Viewing decommissioned asset: ${asset.name}`,
    });
  };

  const handleEditAsset = (asset: any) => {
    toast({
      title: 'Edit Asset',
      description: `Editing decommissioned asset: ${asset.name}`,
    });
  };

  const handleDeleteAsset = (asset: any) => {
    toast({
      title: 'Delete Asset',
      description: `Permanently deleting decommissioned asset: ${asset.name}`,
    });
  };

  // Format date helper
  const formatDateString = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  if (loading) {
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
            <h2 className="text-2xl font-bold tracking-tight">Decommissioned Assets</h2>
            <p className="text-muted-foreground">View assets that have been retired or removed from active use.</p>
          </div>
        </div>

        <FilterGroup
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filters={filterOptions}
          onFilterChange={handleFilterChange}
          onResetFilters={resetFilters}
        />

        <Card>
          <CardContent className="p-0">
            <div className="responsive-table-container">
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
                <Table>
                  <DecommissionedAssetTableHeader
                    onSort={handleSort}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                  />
                  <TableBody>
                    {filteredAssets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="h-24 text-center">
                          No decommissioned assets found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAssets.map((asset) => (
                        <DecommissionedAssetTableRow
                          key={asset.id}
                          asset={asset as any}
                          onView={handleViewAsset}
                          onEdit={handleEditAsset}
                          onDelete={handleDeleteAsset}
                          formatDate={formatDateString}
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-sm text-muted-foreground">
          Showing {filteredAssets.length} of {decommissionedAssets.length} decommissioned assets
        </div>
      </CardContent>
    </Card>
  );
};

export default DecommissionedAssets;
