import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Info, AlertTriangle, ListTodo, ShieldCheck, Monitor, FileText, Target, BarChart3, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

function getTimeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function getTypeIcon(type: string, category: string) {
    const iconClass = 'h-4 w-4';
    // Category-specific icons take priority
    switch (category) {
        case 'kra': return <Target className={cn(iconClass, 'text-purple-500')} />;
        case 'kpi': return <BarChart3 className={cn(iconClass, 'text-blue-500')} />;
        case 'task': return <ListTodo className={cn(iconClass, 'text-green-500')} />;
        case 'project': return <FolderKanban className={cn(iconClass, 'text-orange-500')} />;
        case 'document': return <FileText className={cn(iconClass, 'text-gray-500')} />;
    }
    // Fallback to type-based icons
    switch (type) {
        case 'warning': return <AlertTriangle className={cn(iconClass, 'text-amber-500')} />;
        case 'approval': return <ShieldCheck className={cn(iconClass, 'text-indigo-500')} />;
        case 'system': return <Monitor className={cn(iconClass, 'text-gray-500')} />;
        case 'task': return <ListTodo className={cn(iconClass, 'text-green-500')} />;
        default: return <Info className={cn(iconClass, 'text-blue-500')} />;
    }
}

function NotificationItem({
    notification,
    onRead,
    onNavigate,
}: {
    notification: Notification;
    onRead: (id: string) => void;
    onNavigate: (url: string) => void;
}) {
    const handleClick = () => {
        if (!notification.isRead) {
            onRead(notification.id);
        }
        if (notification.actionUrl) {
            onNavigate(notification.actionUrl);
        }
    };

    return (
        <button
            onClick={handleClick}
            className={cn(
                'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3 items-start',
                !notification.isRead && 'bg-blue-50/50 dark:bg-blue-950/20'
            )}
        >
            <div className="mt-0.5 shrink-0">
                {getTypeIcon(notification.type, notification.category)}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className={cn(
                        'text-sm truncate',
                        !notification.isRead ? 'font-semibold' : 'font-medium text-muted-foreground'
                    )}>
                        {notification.title}
                    </p>
                    {!notification.isRead && (
                        <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                </div>
                {notification.message && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                    </p>
                )}
                <p className="text-xs text-muted-foreground/70 mt-1">
                    {getTimeAgo(notification.createdAt)}
                </p>
            </div>
        </button>
    );
}

export function NotificationPanel() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications();

    const handleNavigate = (url: string) => {
        setOpen(false);
        navigate(url);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10 icon-hover-effect relative"
                >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px] font-bold"
                        >
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className="w-80 p-0"
                sideOffset={8}
            >
                <div className="flex items-center justify-between px-4 py-3">
                    <h4 className="font-semibold text-sm">Notifications</h4>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => markAllRead()}
                        >
                            <CheckCheck className="h-3 w-3 mr-1" />
                            Mark all read
                        </Button>
                    )}
                </div>
                <Separator />
                <ScrollArea className="max-h-[400px]">
                    {isLoading ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            Loading...
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="py-8 text-center">
                            <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No notifications</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">You're all caught up</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onRead={markRead}
                                    onNavigate={handleNavigate}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
