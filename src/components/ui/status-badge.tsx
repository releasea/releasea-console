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
  label?: string;
}

const statusConfig = {
  running: { label: 'Running', dotClass: 'status-dot-running', bgClass: 'border border-success/45 bg-success/15 text-success' },
  online: { label: 'Online', dotClass: 'status-dot-running', bgClass: 'border border-success/45 bg-success/15 text-success' },
  stopped: { label: 'Stopped', dotClass: 'status-dot-stopped', bgClass: 'border border-destructive/45 bg-destructive/15 text-destructive' },
  offline: { label: 'Offline', dotClass: 'status-dot-stopped', bgClass: 'border border-destructive/45 bg-destructive/15 text-destructive' },
  pending: { label: 'Waiting', dotClass: 'status-dot-pending', bgClass: 'border border-warning/45 bg-warning/15 text-warning' },
  creating: { label: 'Creating', dotClass: 'status-dot-pending', bgClass: 'border border-info/45 bg-info/15 text-info' },
  created: { label: 'Created', dotClass: 'status-dot-running', bgClass: 'border border-success/45 bg-success/15 text-success' },
  deleting: { label: 'Deleting', dotClass: 'status-dot-pending', bgClass: 'border border-warning/45 bg-warning/15 text-warning' },
  idle: { label: 'Not Deployed', dotClass: 'status-dot-idle', bgClass: 'border border-info/30 bg-info/10 text-info' },
  busy: { label: 'Busy', dotClass: 'status-dot-pending', bgClass: 'border border-warning/45 bg-warning/15 text-warning' },
  error: { label: 'Error', dotClass: 'status-dot-stopped', bgClass: 'border border-destructive/45 bg-destructive/15 text-destructive' },
  requested: { label: 'Requested', dotClass: 'status-dot-pending', bgClass: 'border border-info/35 bg-info/12 text-info' },
  scheduled: { label: 'Scheduled', dotClass: 'status-dot-pending', bgClass: 'border border-info/35 bg-info/12 text-info' },
  preparing: { label: 'Preparing', dotClass: 'status-dot-pending', bgClass: 'border border-info/45 bg-info/15 text-info' },
  deploying: { label: 'Deploying', dotClass: 'status-dot-pending', bgClass: 'border border-info/45 bg-info/15 text-info' },
  validating: { label: 'Validating', dotClass: 'status-dot-pending', bgClass: 'border border-warning/45 bg-warning/15 text-warning' },
  progressing: { label: 'Progressing', dotClass: 'status-dot-pending', bgClass: 'border border-warning/45 bg-warning/15 text-warning' },
  promoting: { label: 'Promoting', dotClass: 'status-dot-pending', bgClass: 'border border-warning/45 bg-warning/15 text-warning' },
  completed: { label: 'Completed', dotClass: 'status-dot-running', bgClass: 'border border-success/45 bg-success/15 text-success' },
  rollback: { label: 'Rolled back', dotClass: 'status-dot-stopped', bgClass: 'border border-warning/45 bg-warning/15 text-warning' },
  'rolling-back': { label: 'Rolling back', dotClass: 'status-dot-pending', bgClass: 'border border-warning/45 bg-warning/15 text-warning' },
  'rolled-back': { label: 'Rolled back', dotClass: 'status-dot-stopped', bgClass: 'border border-warning/45 bg-warning/15 text-warning' },
  retrying: { label: 'Retrying', dotClass: 'status-dot-pending', bgClass: 'border border-warning/45 bg-warning/15 text-warning' },
  success: { label: 'Completed', dotClass: 'status-dot-running', bgClass: 'border border-success/45 bg-success/15 text-success' },
  failed: { label: 'Failed', dotClass: 'status-dot-stopped', bgClass: 'border border-destructive/45 bg-destructive/15 text-destructive' },
  'in-progress': { label: 'Deploying', dotClass: 'status-dot-pending', bgClass: 'border border-info/45 bg-info/15 text-info' },
  queued: { label: 'Scheduled', dotClass: 'status-dot-pending', bgClass: 'border border-info/35 bg-info/12 text-info' },
  published: { label: 'Published', dotClass: 'status-dot-running', bgClass: 'border border-success/45 bg-success/15 text-success' },
  unpublished: { label: 'Unpublished', dotClass: 'status-dot-idle', bgClass: 'border border-info/30 bg-info/10 text-info' },
  publishing: { label: 'Publishing', dotClass: 'status-dot-pending', bgClass: 'border border-info/45 bg-info/15 text-info' },
  unpublishing: { label: 'Unpublishing', dotClass: 'status-dot-pending', bgClass: 'border border-warning/45 bg-warning/15 text-warning' },
};

export function StatusBadge({ status, className, label }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.pending;
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-tight',
      config.bgClass,
      className
    )}>
      <span className={cn('status-dot', config.dotClass)} />
      {label ?? config.label}
    </span>
  );
}
