import { cn } from '@/lib/utils';
import { DeployStatusValue, ServiceStatus } from '@/types/releasea';

interface StatusBadgeProps {
  status:
    | ServiceStatus
    | DeployStatusValue
    | 'online'
    | 'offline'
    | 'busy'
    | 'published'
    | 'unpublished'
    | 'publishing'
    | 'unpublishing';
  className?: string;
}

const statusConfig = {
  running: { label: 'Running', dotClass: 'status-dot-running', bgClass: 'bg-success/10 text-success' },
  online: { label: 'Online', dotClass: 'status-dot-running', bgClass: 'bg-success/10 text-success' },
  stopped: { label: 'Stopped', dotClass: 'status-dot-stopped', bgClass: 'bg-destructive/10 text-destructive' },
  offline: { label: 'Offline', dotClass: 'status-dot-stopped', bgClass: 'bg-destructive/10 text-destructive' },
  pending: { label: 'Waiting', dotClass: 'status-dot-pending', bgClass: 'bg-warning/10 text-warning' },
  creating: { label: 'Creating', dotClass: 'status-dot-pending', bgClass: 'bg-info/10 text-info' },
  created: { label: 'Created', dotClass: 'status-dot-running', bgClass: 'bg-success/10 text-success' },
  deleting: { label: 'Deleting', dotClass: 'status-dot-pending', bgClass: 'bg-warning/10 text-warning' },
  idle: { label: 'Not Deployed', dotClass: 'status-dot-idle', bgClass: 'bg-muted/50 text-muted-foreground' },
  busy: { label: 'Busy', dotClass: 'status-dot-pending', bgClass: 'bg-warning/10 text-warning' },
  error: { label: 'Error', dotClass: 'status-dot-stopped', bgClass: 'bg-destructive/10 text-destructive' },
  requested: { label: 'Requested', dotClass: 'status-dot-pending', bgClass: 'bg-muted text-muted-foreground' },
  scheduled: { label: 'Scheduled', dotClass: 'status-dot-pending', bgClass: 'bg-muted text-muted-foreground' },
  preparing: { label: 'Preparing', dotClass: 'status-dot-pending', bgClass: 'bg-info/10 text-info' },
  deploying: { label: 'Deploying', dotClass: 'status-dot-pending', bgClass: 'bg-info/10 text-info' },
  validating: { label: 'Validating', dotClass: 'status-dot-pending', bgClass: 'bg-warning/10 text-warning' },
  progressing: { label: 'Progressing', dotClass: 'status-dot-pending', bgClass: 'bg-warning/10 text-warning' },
  promoting: { label: 'Promoting', dotClass: 'status-dot-pending', bgClass: 'bg-warning/10 text-warning' },
  completed: { label: 'Completed', dotClass: 'status-dot-running', bgClass: 'bg-success/10 text-success' },
  rollback: { label: 'Rollback', dotClass: 'status-dot-stopped', bgClass: 'bg-warning/10 text-warning' },
  retrying: { label: 'Retrying', dotClass: 'status-dot-pending', bgClass: 'bg-warning/10 text-warning' },
  success: { label: 'Completed', dotClass: 'status-dot-running', bgClass: 'bg-success/10 text-success' },
  failed: { label: 'Failed', dotClass: 'status-dot-stopped', bgClass: 'bg-destructive/10 text-destructive' },
  'in-progress': { label: 'Deploying', dotClass: 'status-dot-pending', bgClass: 'bg-info/10 text-info' },
  queued: { label: 'Scheduled', dotClass: 'status-dot-pending', bgClass: 'bg-muted text-muted-foreground' },
  published: { label: 'Published', dotClass: 'status-dot-running', bgClass: 'bg-success/10 text-success' },
  unpublished: { label: 'Unpublished', dotClass: 'status-dot-idle', bgClass: 'bg-muted/50 text-muted-foreground' },
  publishing: { label: 'Publishing', dotClass: 'status-dot-pending', bgClass: 'bg-info/10 text-info' },
  unpublishing: { label: 'Unpublishing', dotClass: 'status-dot-pending', bgClass: 'bg-warning/10 text-warning' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.pending;
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-tight',
      config.bgClass,
      className
    )}>
      <span className={cn('status-dot', config.dotClass)} />
      {config.label}
    </span>
  );
}
