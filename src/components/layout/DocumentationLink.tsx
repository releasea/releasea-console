import { BookOpen, ExternalLink } from 'lucide-react';
import { getDocsUrl } from '@/lib/docs-url';
import { cn } from '@/lib/utils';

type DocumentationLinkProps = {
  slug: string;
  label?: string;
  variant?: 'inline' | 'button';
  className?: string;
};

export function DocumentationLink({
  slug,
  label = 'Documentation',
  variant = 'inline',
  className,
}: DocumentationLinkProps) {
  return (
    <a
      href={getDocsUrl(slug)}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label} (opens in a new tab)`}
      className={cn(
        variant === 'button'
          ? 'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          : 'inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      {variant === 'button' && <BookOpen className="h-3.5 w-3.5" />}
      {label}
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}
