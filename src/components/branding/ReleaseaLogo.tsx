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
    <img
      src="/releasea.svg"
      alt=""
      aria-hidden="true"
      className={cn('h-8 w-8 object-contain', className)}
    />
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
