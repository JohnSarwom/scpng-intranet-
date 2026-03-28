/**
 * useStrategySharePoint Hook
 * React hook for managing Strategy data with SharePoint backend
 * Includes fallback to mock data if backend is unavailable
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { StrategyService } from '@/services/strategyService';
import { getGraphClient } from '@/services/graphService';
import { mockStrategyData } from '@/mockData/strategyData';
import { useToast } from '@/components/ui/use-toast';

export const useStrategySharePoint = () => {
    const { instance: msalInstance } = useMsal();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const getService = async () => {
        const account = msalInstance.getActiveAccount();
        if (!account) throw new Error('No active account');

        const graphClient = await getGraphClient(msalInstance);
        if (!graphClient) throw new Error('Failed to get Graph client');

        const service = new StrategyService(graphClient);
        await service.initialize();
        return service;
    };

    const query = useQuery({
        queryKey: ['strategyData'],
        queryFn: async () => {
            console.log('📥 [useStrategySharePoint] Fetching strategy data...');
            try {
                const service = await getService();
                const data = await service.getFullStrategy();

                if (!data.objectives || data.objectives.length === 0) {
                    console.warn('⚠️ [useStrategySharePoint] Objectives list is empty or missing.');
                }

                return data;
            } catch (err) {
                console.error('❌ [useStrategySharePoint] Connection Error:', err);
                return mockStrategyData;
            }
        },
        staleTime: 0, // Disable cache temporarily to ensure user sees the latest data
    });

    const updateMutation = useMutation({
        mutationFn: async (data: any) => {
            const service = await getService();
            return await service.updateFullStrategy(data);
        },
        onSuccess: () => {
            toast({
                title: 'Strategy Updated',
                description: 'Changes have been saved to SharePoint.'
            });
            queryClient.invalidateQueries({ queryKey: ['strategyData'] });
        },
        onError: (error: any) => {
            console.error('❌ [useStrategySharePoint] Save Error:', error);
            toast({
                title: 'Save Failed',
                description: error.message || 'Could not save strategy changes.',
                variant: 'destructive'
            });
        }
    });

    const updateObjectiveMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            const service = await getService();
            return await service.updateObjective(id, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['strategyData'] });
        },
        onError: (error: any) => {
            console.error('❌ [useStrategySharePoint] Update Objective Error:', error);
            throw error;
        }
    });

    return {
        strategyData: query.data || mockStrategyData,
        isLoading: query.isLoading,
        error: query.error,
        updateStrategy: updateMutation.mutateAsync,
        updateObjective: (id: string, data: any) => updateObjectiveMutation.mutateAsync({ id, data }),
        isUpdating: updateMutation.isPending || updateObjectiveMutation.isPending,
        refreshStrategy: () => queryClient.invalidateQueries({ queryKey: ['strategyData'] })
    };
};
