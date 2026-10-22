import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { useOpsService } from '@/hooks/useSharePointOps';
import { useToast } from '@/components/ui/use-toast';
import { useNewsletterData } from '@/hooks/useNewsletterData';

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

export function useNotifications(newsletterRequested = false) {
    const { accounts } = useMsal();
    const userEmail = accounts[0]?.username?.toLowerCase() || '';
    const getService = useOpsService();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const newsletterNotes = useNewsletterData(service => service.request<Notification[]>('notifications'), 'notifications', newsletterRequested);

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

    const combinedNotifications = [...(notificationsQuery.data || []), ...(newsletterNotes.data || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const unreadCount = combinedNotifications.filter(n => !n.isRead).length;

    const markRead = useMutation({
        mutationFn: async (notificationId: string) => {
            if (notificationId.startsWith('newsletter:')) {
                await newsletterNotes.service.request('read_notification', { noteId: notificationId });
                return;
            }
            const service = await getService();
            await service.markNotificationRead(notificationId);
        },
        onSuccess: () => {
            newsletterNotes.reload();
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
            await Promise.all((newsletterNotes.data || []).filter(n => !n.isRead).map(n => newsletterNotes.service.request('read_notification', { noteId: n.id })));
            const service = await getService();
            await service.markAllNotificationsRead(userEmail);
        },
        onSuccess: () => {
            newsletterNotes.reload();
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
        notifications: combinedNotifications as Notification[],
        unreadCount,
        isLoading: notificationsQuery.isLoading,
        newsletterLoading: newsletterNotes.loading,
        newsletterError: newsletterNotes.error,
        markRead: markRead.mutate,
        markAllRead: markAllRead.mutate,
        refresh: () => { newsletterNotes.reload(); return notificationsQuery.refetch(); },
    };
}
