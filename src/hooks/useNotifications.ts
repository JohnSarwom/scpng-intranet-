import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { useOpsService } from '@/hooks/useSharePointOps';
import { useToast } from '@/components/ui/use-toast';

export interface Notification {
    id: string;
    title: string;
    message: string;
    recipientEmail: string;
    type: 'info' | 'warning' | 'task' | 'approval' | 'system';
    category: string;
    actionUrl: string;
    isRead: boolean;
    createdBy: string;
    createdAt: string;
}

export function useNotifications() {
    const { accounts } = useMsal();
    const userEmail = accounts[0]?.username?.toLowerCase() || '';
    const getService = useOpsService();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const notificationsQuery = useQuery({
        queryKey: ['sharePoint', 'notifications', userEmail],
        queryFn: async () => {
            try {
                const service = await getService();
                const data = await service.getNotifications(userEmail);
                return data as Notification[];
            } catch (err) {
                console.error('❌ [useNotifications] Failed to load:', err);
                return [];
            }
        },
        enabled: !!userEmail,
        refetchInterval: 30_000, // Poll every 30 seconds
        staleTime: 15_000,
    });

    const unreadCount = (notificationsQuery.data || []).filter(n => !n.isRead).length;

    const markRead = useMutation({
        mutationFn: async (notificationId: string) => {
            const service = await getService();
            await service.markNotificationRead(notificationId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sharePoint', 'notifications'] });
        },
        onError: (err) => {
            console.error('❌ [useNotifications] markRead failed:', err);
            toast({
                title: 'Error',
                description: 'Failed to mark notification as read',
                variant: 'destructive',
            });
        },
    });

    const markAllRead = useMutation({
        mutationFn: async () => {
            const service = await getService();
            await service.markAllNotificationsRead(userEmail);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sharePoint', 'notifications'] });
        },
        onError: (err) => {
            console.error('❌ [useNotifications] markAllRead failed:', err);
            toast({
                title: 'Error',
                description: 'Failed to mark all notifications as read',
                variant: 'destructive',
            });
        },
    });

    return {
        notifications: (notificationsQuery.data || []) as Notification[],
        unreadCount,
        isLoading: notificationsQuery.isLoading,
        markRead: markRead.mutate,
        markAllRead: markAllRead.mutate,
        refresh: notificationsQuery.refetch,
    };
}
