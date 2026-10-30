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
      <rect width="64" height="64" rx="15" fill="#07111F" />
      <rect x="1" y="1" width="62" height="62" rx="14" fill="none" stroke="#2563EB" strokeOpacity=".38" strokeWidth="2" />
      <path d="M17 50V14h19c9.3 0 15 5.3 15 14s-5.7 14-15 14H25" fill="none" stroke="#F8FAFC" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M34 39.5 50 52" fill="none" stroke="#3B82F6" strokeWidth="8" strokeLinecap="round" />
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
