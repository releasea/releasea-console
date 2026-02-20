import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  compact?: boolean;
  tone?: 'default' | 'muted';
}

interface TableEmptyRowProps {
  colSpan: number;
  icon: ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  compact = false,
  tone = 'default',
}: EmptyStateProps) {
  const isMuted = tone === 'muted';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 py-6' : 'gap-3 py-10',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-lg',
          isMuted ? 'bg-muted/20' : 'bg-muted/30',
          compact ? 'h-10 w-10 [&>svg]:!h-10 [&>svg]:!w-10' : 'h-12 w-12 [&>svg]:!h-12 [&>svg]:!w-12'
        )}
      >
        {icon}
      </div>
      <div className="space-y-1">
        <p className={cn(isMuted ? 'text-sm font-medium text-muted-foreground' : 'text-sm font-semibold text-foreground')}>
          {title}
        </p>
        {description && (
          <p className={cn(isMuted ? 'text-sm text-muted-foreground/70 max-w-md' : 'text-sm text-muted-foreground max-w-md')}>
            {description}
          </p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function TableEmptyRow({
  colSpan,
  icon,
  title = 'Nothing here yet',
  description = 'You can add new items or adjust your search.',
  className,
}: TableEmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className={cn('px-4 py-0', className)}>
        <EmptyState
          icon={icon}
          title={title}
          description={description}
          tone="muted"
          className="py-10 min-h-[140px]"
        />
      </td>
    </tr>
  );
}
