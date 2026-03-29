import { useState, useCallback, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AssetSubSharePointService, MaintenanceRecord, InvoiceRecord } from '@/services/assetSubSharePointService';
import { getGraphClient } from '@/services/graphService';
import { useToast } from '@/hooks/use-toast';

export function useAssetSubSharePoint() {
  const { instance: msalInstance } = useMsal();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [service, setService] = useState<AssetSubSharePointService | null>(null);

  /**
   * Initialize Service
   */
  const initializeService = useCallback(async () => {
    if (service) return service;
    try {
      const graphClient = await getGraphClient(msalInstance);
      if (!graphClient) throw new Error('Graph client not available');
      const subService = new AssetSubSharePointService(graphClient);
      await subService.initialize();
      setService(subService);
      return subService;
    } catch (err: any) {
      console.error('❌ [useAssetSubSharePoint] Init failed:', err);
      throw err;
    }
  }, [msalInstance, service]);

  useEffect(() => {
    if (!service) initializeService().catch(() => {});
  }, [initializeService, service]);

  /**
   * Query: Maintenance Records
   */
  const useMaintenance = (assetId?: string) => useQuery({
    queryKey: ['asset-maintenance', assetId],
    queryFn: async () => {
      const s = service || await initializeService();
      return s.getMaintenanceRecords(assetId);
    },
    enabled: !!msalInstance,
    staleTime: 1000 * 60 * 5
  });

  /**
   * Query: Invoice Records
   */
  const useInvoices = (assetId?: string) => useQuery({
    queryKey: ['asset-invoices', assetId],
    queryFn: async () => {
      const s = service || await initializeService();
      return s.getInvoiceRecords(assetId);
    },
    enabled: !!msalInstance,
    staleTime: 1000 * 60 * 5
  });

  /**
   * Mutation: Add Maintenance
   */
  const addMaintenance = useMutation({
    mutationFn: async (record: Partial<MaintenanceRecord>) => {
      const s = service || await initializeService();
      return s.addMaintenanceRecord(record);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-maintenance'] });
      toast({ title: 'Success', description: 'Maintenance record added.' });
    }
  });

  /**
   * Mutation: Add Invoice
   */
  const addInvoice = useMutation({
    mutationFn: async (record: Partial<InvoiceRecord>) => {
      const s = service || await initializeService();
      return s.addInvoiceRecord(record);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-invoices'] });
      toast({ title: 'Success', description: 'Invoice record added.' });
    }
  });

  return {
    useMaintenance,
    useInvoices,
    addMaintenance,
    addInvoice,
    refreshMaintenance: () => queryClient.invalidateQueries({ queryKey: ['asset-maintenance'] }),
    refreshInvoices: () => queryClient.invalidateQueries({ queryKey: ['asset-invoices'] })
  };
}
