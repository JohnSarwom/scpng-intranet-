import { useState, useCallback, useEffect, useMemo } from 'react';
import { useMsal } from '@azure/msal-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AssetsSharePointService, Asset } from '@/services/assetsSharePointService';
import { getGraphClient } from '@/services/graphService';
import { useToast } from '@/hooks/use-toast';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { useStaffMembers } from '@/hooks/useStaffMembers';
import {
  canCreateAsset,
  canModifyAsset,
  canViewAsset,
  type AssetAccessViewer,
} from '@/lib/assetAccessPolicy';

export interface UseAssetsOptions {
  includeDeleted?: boolean;
}

export function useAssetsSharePoint(options: UseAssetsOptions = {}) {
  const { includeDeleted = false } = options;
  const { instance: msalInstance, accounts } = useMsal();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Keep service in state as it maintains connection details
  const [service, setService] = useState<AssetsSharePointService | null>(null);

  // Get current user info and role
  const { user: roleUser, isAdmin } = useRoleBasedAuth();
  const { staffMembers } = useStaffMembers();
  const currentUser = accounts[0];
  const userEmail = currentUser?.username || currentUser?.email;
  const divisionName = roleUser?.division_name;
  const unitName = roleUser?.unit_name;
  const currentStaff = useMemo(() => staffMembers.find(
    member => member.email?.trim().toLowerCase() === userEmail?.trim().toLowerCase()
  ), [staffMembers, userEmail]);
  const viewer = useMemo<AssetAccessViewer>(() => ({
    email: userEmail,
    name: currentUser?.name || roleUser?.user_name,
    roleName: roleUser?.role_name,
    jobTitle: currentStaff?.jobTitle,
    divisionName,
    unitName,
    isAdmin,
  }), [
    currentStaff?.jobTitle,
    currentUser?.name,
    divisionName,
    isAdmin,
    roleUser?.role_name,
    roleUser?.user_name,
    unitName,
    userEmail,
  ]);

  /**
   * Initialize the SharePoint service
   */
  const initializeService = useCallback(async () => {
    // If already initialized, return it (though this function re-creates if dependencies change)
    if (service) return service;

    try {
      console.log('🔄 [useAssetsSharePoint] Initializing SharePoint service...');
      const graphClient = await getGraphClient(msalInstance);

      if (!graphClient) {
        throw new Error('Failed to initialize Graph client. Please ensure you are logged in.');
      }

      const assetsService = new AssetsSharePointService(graphClient);
      await assetsService.initialize();

      setService(assetsService);
      return assetsService;
    } catch (err: unknown) {
      console.error('❌ [useAssetsSharePoint] Service initialization failed:', err);
      const error = err instanceof Error ? err : new Error('Unknown error');
      toast({
        title: 'SharePoint Connection Error',
        description: error.message || 'Failed to connect to SharePoint. Please try again.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [msalInstance, service, toast]);

  // Ensure service is initialized
  useEffect(() => {
    if (!service && msalInstance) {
      initializeService().catch(console.error);
    }
  }, [initializeService, service, msalInstance]);

  /**
   * React Query: Fetch Assets
   */
  const {
    data: assets = [],
    isLoading: loading,
    error,
    refetch: refreshAssets
  } = useQuery({
    queryKey: ['assets', viewer, includeDeleted],
    queryFn: async () => {
      console.log(`📥 [useAssetsSharePoint] Fetching assets (includeDeleted: ${includeDeleted}) via React Query...`);
      let currentService = service;
      if (!currentService) {
        currentService = await initializeService();
      }
      return currentService.getAssets(viewer, includeDeleted);
    },
    // Only fetch when we have user info. Service will be init'd on demand if needed.
    enabled: !!userEmail && (!!roleUser || !isAdmin),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  /**
   * React Query: Add Asset Mutation
   */
  const addAssetMutation = useMutation({
    mutationFn: async (assetData: Partial<Asset>) => {
      if (!canCreateAsset(viewer)) {
        throw new Error('You do not have permission to register assets.');
      }

      let currentService = service;
      if (!currentService) {
        currentService = await initializeService();
      }

      const assetToCreate = {
        ...assetData,
        created_by: assetData.created_by || userEmail,
        last_updated_by: assetData.last_updated_by || userEmail,
      };

      return currentService.addAsset(assetToCreate);
    },
    onSuccess: (newAsset) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast({
        title: 'Asset Created',
        description: `${newAsset.name} has been added successfully.`,
      });
    },
    onError: (err: unknown) => {
      const error = err instanceof Error ? err : new Error('Unknown error');
      toast({
        title: 'Error Creating Asset',
        description: error.message || 'Failed to create asset.',
        variant: 'destructive',
      });
    }
  });

  /**
   * React Query: Update Asset Mutation
   */
  const updateAssetMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Asset> }) => {
      const existingAsset = assets.find(asset =>
        asset.id === id || asset.sharepoint_item_id === id
      );
      if (!existingAsset || !canModifyAsset(existingAsset, viewer)) {
        throw new Error('You can only update assets you created or assets you manage within your unit or division.');
      }

      let currentService = service;
      if (!currentService) {
        currentService = await initializeService();
      }

      const updatesToApply = {
        ...updates,
        last_updated_by: userEmail,
      };

      return currentService.updateAsset(id, updatesToApply);
    },
    onSuccess: (updatedAsset) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast({
        title: 'Asset Updated',
        description: `${updatedAsset.name} has been updated successfully.`,
      });
    },
    onError: (err: unknown) => {
      const error = err instanceof Error ? err : new Error('Unknown error');
      toast({
        title: 'Error Updating Asset',
        description: error.message || 'Failed to update asset.',
        variant: 'destructive',
      });
    }
  });

  /**
   * React Query: Delete Asset Mutation
   */
  const deleteAssetMutation = useMutation({
    mutationFn: async (id: string) => {
      const existingAsset = assets.find(asset =>
        asset.id === id || asset.sharepoint_item_id === id
      );
      if (!existingAsset || !canModifyAsset(existingAsset, viewer)) {
        throw new Error('You can only delete assets you created or assets you manage within your unit or division.');
      }

      let currentService = service;
      if (!currentService) {
        currentService = await initializeService();
      }
      return currentService.deleteAsset(id, userEmail!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast({
        title: 'Asset Deleted',
        description: 'Asset has been deleted successfully.',
      });
    },
    onError: (err: unknown) => {
      const error = err instanceof Error ? err : new Error('Unknown error');
      toast({
        title: 'Error Deleting Asset',
        description: error.message || 'Failed to delete asset.',
        variant: 'destructive',
      });
    }
  });

  /**
   * React Query: Restore Asset Mutation
   */
  const restoreAssetMutation = useMutation({
    mutationFn: async (id: string) => {
      const existingAsset = assets.find(asset =>
        asset.id === id || asset.sharepoint_item_id === id
      );
      if (!existingAsset || !canModifyAsset(existingAsset, viewer)) {
        throw new Error('You do not have permission to restore this asset.');
      }

      let currentService = service;
      if (!currentService) {
        currentService = await initializeService();
      }
      return currentService.restoreAsset(id);
    },
    onSuccess: (restoredAsset) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast({
        title: 'Asset Restored',
        description: `${restoredAsset.name} has been restored successfully.`,
      });
    },
    onError: (err: unknown) => {
      const error = err instanceof Error ? err : new Error('Unknown error');
      toast({
        title: 'Error Restoring Asset',
        description: error.message || 'Failed to restore asset.',
        variant: 'destructive',
      });
    }
  });

  /**
   * React Query: Generate missing asset QR code image
   */
  const ensureQrCodeMutation = useMutation({
    mutationFn: async (asset: Asset) => {
      if (!canModifyAsset(asset, viewer)) {
        throw new Error('You do not have permission to update this asset QR code.');
      }

      let currentService = service;
      if (!currentService) {
        currentService = await initializeService();
      }
      return currentService.ensureAssetQrCode(asset);
    },
    onSuccess: (updatedAsset) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast({
        title: 'QR Code Ready',
        description: `${updatedAsset.name} now has a QR code image.`,
      });
    },
    onError: (err: unknown) => {
      const error = err instanceof Error ? err : new Error('Unknown error');
      toast({
        title: 'Error Generating QR Code',
        description: error.message || 'Failed to generate QR code.',
        variant: 'destructive',
      });
    }
  });

  // Wrappers to match original interface
  const addAsset = useCallback((assetData: Partial<Asset>) => addAssetMutation.mutateAsync(assetData), [addAssetMutation]);
  const updateAsset = useCallback((id: string, updates: Partial<Asset>) => updateAssetMutation.mutateAsync({ id, updates }), [updateAssetMutation]);
  const deleteAsset = useCallback((id: string) => deleteAssetMutation.mutateAsync(id), [deleteAssetMutation]);
  const restoreAsset = useCallback((id: string) => restoreAssetMutation.mutateAsync(id), [restoreAssetMutation]);
  const ensureQrCode = useCallback((asset: Asset, forceRegenerate: boolean = false) => {
    if (forceRegenerate) {
      return (async () => {
        if (!canModifyAsset(asset, viewer)) {
          throw new Error('You do not have permission to update this asset QR code.');
        }

        let currentService = service;
        if (!currentService) {
          currentService = await initializeService();
        }
        const updatedAsset = await currentService.ensureAssetQrCode(asset, true);
        queryClient.invalidateQueries({ queryKey: ['assets'] });
        toast({
          title: 'QR Code Updated',
          description: `${updatedAsset.name} now points to the asset profile page.`,
        });
        return updatedAsset;
      })();
    }

    return ensureQrCodeMutation.mutateAsync(asset);
  }, [ensureQrCodeMutation, initializeService, queryClient, service, toast]);

  const getQrCodeImageSrc = useCallback(async (asset: Asset) => {
    let currentService = service;
    if (!currentService) {
      currentService = await initializeService();
    }
    return currentService.getAssetQrCodeImageObjectUrl(asset);
  }, [initializeService, service]);

  const getAssetByAssetId = useCallback(async (assetId: string) => {
    let currentService = service;
    if (!currentService) {
      currentService = await initializeService();
    }
    const asset = await currentService.getAssetByAssetId(assetId);
    return asset && canViewAsset(asset, viewer) ? asset : null;
  }, [initializeService, service, viewer]);

  return {
    // Data
    assets,
    loading,
    error: error as Error | null,

    // Operations
    add: addAsset,
    update: updateAsset,
    remove: deleteAsset,
    restore: restoreAsset,
    ensureQrCode,
    getQrCodeImageSrc,
    getAssetByAssetId,
    refresh: refreshAssets,

    // Service instance (for advanced usage if needed)
    service,
    viewer,
    canCreate: canCreateAsset(viewer),
    canModify: (asset?: Asset | null) => canModifyAsset(asset, viewer),
  };
}
