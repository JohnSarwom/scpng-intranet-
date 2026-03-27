import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Eye } from 'lucide-react';
import AddAssetModal from './modals/AddAssetModal';
import EditAssetModal from './modals/EditAssetModal';
import TableErrorMessage from '@/components/TableErrorMessage';
import { StaffMember, divisions, staffMembers } from '@/data/divisions';
import { units } from '@/data/units';
import { UserAsset } from '@/types';

interface AssetsTabProps {
  assets: UserAsset[];
  addAsset: (asset: Omit<UserAsset, 'id'>) => void;
  editAsset: (id: string, asset: Partial<UserAsset>) => void;
  deleteAsset?: (id: string) => void;
  error?: Error | null;
  onRetry?: () => void;
  staffMembers?: StaffMember[]; // Prop kept for compatibility if needed elsewhere
}

export const AssetsTab: React.FC<AssetsTabProps> = ({ 
  assets, 
  addAsset, 
  editAsset,
  deleteAsset,
  error,
  onRetry,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<UserAsset | null>(null);

  const handleEdit = (asset: UserAsset) => {
    setSelectedAsset(asset);
    setShowEditModal(true);
  };

  const getTypeBadge = (type: string | undefined) => {
    if (!type) return <Badge variant="outline">Unknown</Badge>;
    switch (type.toLowerCase()) {
      case 'laptop':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/30">Laptop</Badge>;
      case 'mobile':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30">Mobile</Badge>;
      case 'tablet':
        return <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800/30">Tablet</Badge>;
      case 'software':
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/30">Software</Badge>;
      case 'other':
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 dark:border-white/10">Other</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 dark:border-white/10">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    if (!status) return <Badge variant="outline">Unknown</Badge>;
    switch (status.toLowerCase()) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/30">Active</Badge>;
      case 'maintenance':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30">Maintenance</Badge>;
      case 'retired':
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 dark:border-white/10">Retired</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 dark:border-white/10">{status}</Badge>;
    }
  };

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  // Derive helper values for modals
  const existingNames = Array.from(new Set(assets.map(a => a.name))).filter(Boolean) as string[];
  const existingTypes = Array.from(new Set(assets.map(a => a.type))).filter(Boolean) as string[];
  const existingVendors = Array.from(new Set(assets.map(a => a.vendor))).filter(Boolean) as string[];

  return (
    <>
      {/* Show error message if there is an error */}
      {error && (
        <TableErrorMessage 
          error={error} 
          entityName="Assets" 
          onRetry={onRetry}
        />
      )}
      
      <Card className="dark:bg-gray-900 dark:border-white/10">
        <CardHeader className="flex flex-row items-center justify-between border-b dark:border-white/10 pb-4">
          <CardTitle className="dark:text-gray-100">User Assets</CardTitle>
          <Button variant="outline" onClick={() => setShowAddModal(true)} className="dark:border-white/10 dark:bg-gray-800 dark:hover:bg-gray-700">
            <Plus className="h-4 w-4 mr-2 text-blue-500" />
            Add Asset
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="dark:border-white/10 hover:bg-transparent">
                <TableHead className="dark:text-gray-400 font-bold uppercase text-[10px] tracking-wider">Name</TableHead>
                <TableHead className="dark:text-gray-400 font-bold uppercase text-[10px] tracking-wider">Type</TableHead>
                <TableHead className="dark:text-gray-400 font-bold uppercase text-[10px] tracking-wider">Assigned To</TableHead>
                <TableHead className="dark:text-gray-400 font-bold uppercase text-[10px] tracking-wider">Status</TableHead>
                <TableHead className="dark:text-gray-400 font-bold uppercase text-[10px] tracking-wider">Purchase Date</TableHead>
                <TableHead className="dark:text-gray-400 font-bold uppercase text-[10px] tracking-wider">Warranty Expiry</TableHead>
                <TableHead className="text-right dark:text-gray-400 font-bold uppercase text-[10px] tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {error 
                      ? "Unable to load assets from the database. Showing offline mode." 
                      : "No assets found. Add your first asset by clicking 'Add Asset'."}
                  </TableCell>
                </TableRow>
              ) : (
                assets.map((asset) => (
                  <TableRow key={asset.id} className="dark:border-white/10 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                    <TableCell className="font-medium dark:text-gray-300">{asset.name}</TableCell>
                    <TableCell>{getTypeBadge(asset.type)}</TableCell>
                    <TableCell className="dark:text-gray-400">{asset.assigned_to || asset.assigned_to_email || 'Unassigned'}</TableCell>
                    <TableCell>{getStatusBadge(asset.status)}</TableCell>
                    <TableCell className="dark:text-gray-400">{formatDate(asset.purchase_date)}</TableCell>
                    <TableCell className="dark:text-gray-400">{formatDate(asset.warranty_expiry_date)}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleEdit(asset)}
                        className="dark:hover:bg-gray-800 dark:text-gray-400"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Asset Modal */}
      <AddAssetModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        onAdd={addAsset}
        divisions={divisions}
        units={units}
        existingNames={existingNames}
        existingTypes={existingTypes}
        existingVendors={existingVendors}
      />

      {/* Edit Asset Modal */}
      {selectedAsset && (
        <EditAssetModal 
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          asset={selectedAsset}
          onEdit={(editedAsset) => {
            editAsset(selectedAsset.id, editedAsset);
            setShowEditModal(false);
          }}
          onDelete={deleteAsset ? () => {
            if (deleteAsset) {
              deleteAsset(selectedAsset.id);
              setShowEditModal(false);
            }
          } : () => {}}
          divisions={divisions}
          units={units}
          staffMembers={staffMembers}
          existingNames={existingNames}
          existingTypes={existingTypes}
          existingVendors={existingVendors}
        />
      )}
    </>
  );
};
 