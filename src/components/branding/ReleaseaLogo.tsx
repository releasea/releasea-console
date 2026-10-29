import { cn } from '@/lib/utils';

type BrandMarkProps = {
  className?: string;
};

type BrandLogoProps = {
  className?: string;
  textClassName?: string;
  subtitleClassName?: string;
  subtitle?: string;
};

export function ReleaseaMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn('h-8 w-8', className)}
    >
      <rect width="64" height="64" rx="16" fill="#0B1220" />
      <rect x="15" y="26" width="13" height="19" rx="3.5" fill="#334155" />
      <rect x="12" y="40" width="40" height="11" rx="3.5" fill="#F8FAFC" />
      <rect x="31" y="14" width="19" height="31" rx="4.5" fill="#3B82F6" />
      <rect x="35.5" y="20" width="10" height="3.5" rx="1.6" fill="#F8FAFC" />
    </svg>
  );
}

export function ReleaseaLogo({
  className,
  textClassName,
  subtitleClassName,
  subtitle = 'Service surface',
}: BrandLogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <ReleaseaMark />
      <div className="flex min-w-0 flex-col items-start leading-tight text-left">
        <p className={cn('text-sm font-semibold tracking-tight uppercase', textClassName)}>
          <span className="text-foreground">release</span>
          <span className="text-primary">a</span>
        </p>
        <p className={cn('text-xs text-muted-foreground', subtitleClassName)}>{subtitle}</p>
      </div>
    </div>
  );
}
