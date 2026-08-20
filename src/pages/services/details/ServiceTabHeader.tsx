import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

type ServiceTabHeaderProps = {
  title: string;
  description: string;
  environment?: string;
  actions?: ReactNode;
};

export const ServiceTabHeader = ({
  title,
  description,
  environment,
  actions,
}: ServiceTabHeaderProps) => (
  <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {environment ? (
          <Badge variant="outline" className="normal-case">
            {environment}
          </Badge>
        ) : null}
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
    </div>
    {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);
