import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DocumentationLink } from './DocumentationLink';

interface ListPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  docsSlug?: string;
  docsLabel?: string;
}

export function ListPageHeader({ title, description, actions, className, docsSlug, docsLabel = 'Learn more' }: ListPageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/50', className)}>
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">{title}</h1>
        {(description || docsSlug) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
            {docsSlug && <DocumentationLink slug={docsSlug} label={docsLabel} />}
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
