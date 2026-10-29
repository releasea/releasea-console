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
      <path d="M15 45h34" fill="none" stroke="#F8FAFC" strokeWidth="5" strokeLinecap="round" />
      <path d="M18 45c4-15 12-21 28-21" fill="none" stroke="#3B82F6" strokeWidth="5" strokeLinecap="round" />
      <circle cx="46" cy="24" r="5.2" fill="#3B82F6" />
      <circle cx="46" cy="24" r="2.1" fill="#F8FAFC" />
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
