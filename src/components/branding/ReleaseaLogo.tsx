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
      className={cn('block h-[42px] w-[42px] shrink-0 object-contain', className)}
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
    <div className={cn('flex items-center gap-[2px]', className)}>
      <ReleaseaMark />
      <div className="flex min-w-0 flex-col items-start justify-center text-left leading-[1.2]">
        <p className={cn('text-sm font-semibold uppercase tracking-[-0.02em]', textClassName)}>
          <span className="text-foreground">release</span>
          <span className="text-primary">a</span>
        </p>
        <p className={cn('text-[11px] text-muted-foreground', subtitleClassName)}>{subtitle}</p>
      </div>
    </div>
  );
}
