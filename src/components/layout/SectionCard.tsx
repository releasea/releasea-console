import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  headerRight?: ReactNode;
  headerAction?: ReactNode;
  variant?: 'default' | 'destructive';
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SectionCard({
  title,
  description,
  icon,
  headerRight,
  headerAction,
  variant = 'default',
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  const isDestructive = variant === 'destructive';
  
  return (
    <div className={cn(
      'rounded-lg border bg-card overflow-hidden',
      isDestructive ? 'border-destructive/30' : 'border-border',
      className
    )}>
      <div className={cn(
        'px-4 py-3 border-b flex items-center justify-between',
        isDestructive ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/30'
      )}>
        <div className="flex items-center gap-3">
          {icon && (
            <div className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center',
              isDestructive ? 'bg-destructive/10' : 'bg-primary/10'
            )}>
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {headerRight || headerAction}
      </div>
      <div className={cn('p-4', contentClassName)}>{children}</div>
    </div>
  );
}
