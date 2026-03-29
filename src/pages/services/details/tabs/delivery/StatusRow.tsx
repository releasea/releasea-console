import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusRowProps {
  label: string;
  description: string;
  badgeLabel: string;
  badgeClasses: string;
}

/**
 * Compact row with label, description and a trailing status badge.
 * Used as the repeating unit inside GitOps and policy sections.
 */
export function StatusRow({ label, description, badgeLabel, badgeClasses }: StatusRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 bg-background/60 px-3.5 py-2.5">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground truncate">{label}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <Badge variant="outline" className={cn('shrink-0 text-[10px] uppercase tracking-wider', badgeClasses)}>
        {badgeLabel}
      </Badge>
    </div>
  );
}
