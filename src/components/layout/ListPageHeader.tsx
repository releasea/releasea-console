import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ListPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function ListPageHeader({ title, description, actions, className }: ListPageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4', className)}>
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {description && <p className="text-muted-foreground text-sm mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
