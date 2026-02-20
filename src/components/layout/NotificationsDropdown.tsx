import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, AlertTriangle, Info, Rocket, X, ShieldCheck, ShieldX, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: 'success' | 'warning' | 'info' | 'deploy' | 'approval-pending' | 'approval-approved' | 'approval-rejected';
  title: string;
  message: string;
  time: string;
  read: boolean;
  link?: string;
}

const initialNotifications: Notification[] = [
  {
    id: '1',
    type: 'approval-pending',
    title: 'Approval required',
    message: 'api-gateway deploy to prod awaiting your approval.',
    time: '2 min ago',
    read: false,
    link: '/governance',
  },
  {
    id: '2',
    type: 'approval-approved',
    title: 'Approval granted',
    message: 'Your auth-service deploy was approved by John Doe.',
    time: '30 min ago',
    read: false,
    link: '/governance',
  },
  {
    id: '3',
    type: 'deploy',
    title: 'Deploy completed',
    message: 'auth-service deployed to production successfully.',
    time: '35 min ago',
    read: false,
  },
  {
    id: '4',
    type: 'warning',
    title: 'High CPU usage',
    message: 'api-gateway CPU usage exceeded 80%.',
    time: '1 hour ago',
    read: true,
  },
  {
    id: '5',
    type: 'approval-rejected',
    title: 'Approval denied',
    message: 'Your legacy-endpoint rule was rejected. Security review required.',
    time: '2 hours ago',
    read: true,
    link: '/governance',
  },
  {
    id: '6',
    type: 'success',
    title: 'Worker online',
    message: 'worker-prod-03 is now online and processing jobs.',
    time: '3 hours ago',
    read: true,
  },
  {
    id: '7',
    type: 'info',
    title: 'Maintenance scheduled',
    message: 'Database maintenance scheduled for Sunday 02:00 UTC.',
    time: '5 hours ago',
    read: true,
  },
];

const typeConfig = {
  success: { icon: CheckCircle, color: 'text-success' },
  warning: { icon: AlertTriangle, color: 'text-warning' },
  info: { icon: Info, color: 'text-info' },
  deploy: { icon: Rocket, color: 'text-primary' },
  'approval-pending': { icon: Clock, color: 'text-warning' },
  'approval-approved': { icon: ShieldCheck, color: 'text-success' },
  'approval-rejected': { icon: ShieldX, color: 'text-destructive' },
};

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const unreadCount = notifications.filter((n) => !n.read).length;
  const pendingApprovals = notifications.filter(
    (n) => n.type === 'approval-pending' && !n.read
  ).length;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleNotificationClick = (notification: Notification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );
    if (notification.link) {
      setOpen(false);
      navigate(notification.link);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <div className="flex items-center gap-2">
            {pendingApprovals > 0 && (
              <Badge variant="outline" className="text-xs gap-1 border-warning/50 text-warning">
                <Clock className="w-3 h-3" />
                {pendingApprovals}
              </Badge>
            )}
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[350px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            notifications.map((notification) => {
              const config = typeConfig[notification.type];
              const Icon = config.icon;
              const isApprovalType = notification.type.startsWith('approval-');
              return (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    'flex items-start gap-3 p-3 cursor-pointer',
                    !notification.read && 'bg-muted/50',
                    isApprovalType && !notification.read && 'border-l-2 border-l-warning'
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', config.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground">
                          {notification.title}
                        </p>
                        {isApprovalType && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            Governance
                          </Badge>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleDismiss(notification.id, e)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {notification.time}
                    </p>
                  </div>
                </DropdownMenuItem>
              );
            })
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={handleMarkAllRead}
              >
                Mark all as read
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
