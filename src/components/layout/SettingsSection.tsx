import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  variant?: 'default' | 'danger';
}

export function SettingsSection({
  title,
  description,
  children,
  actions,
  className,
  variant = 'default',
}: SettingsSectionProps) {
  const isDanger = variant === 'danger';

  return (
    <div
      className={cn(
        'rounded-lg border bg-card overflow-hidden',
        isDanger ? 'border-destructive/40' : 'border-border',
        className
      )}
    >
      <div
        className={cn(
          'px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2',
          isDanger ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-muted/30'
        )}
      >
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

interface SettingsFieldProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export function SettingsField({ label, value, className }: SettingsFieldProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="text-sm text-foreground font-medium">{value}</div>
    </div>
  );
}

interface SettingsGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function SettingsGrid({ children, columns = 2, className }: SettingsGridProps) {
  const colClass = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
  }[columns];

  return <div className={cn('grid grid-cols-1 gap-4', colClass, className)}>{children}</div>;
}
