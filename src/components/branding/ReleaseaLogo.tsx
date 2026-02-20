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
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#0B1324" />
      <rect x="4" y="4" width="56" height="56" rx="14" fill="none" stroke="#25344A" />
      <text
        x="32"
        y="41"
        textAnchor="middle"
        fontSize="33"
        fontWeight="800"
        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
        fill="#22D3EE"
      >
        R
      </text>
    </svg>
  );
}

export function ReleaseaLogo({
  className,
  textClassName,
  subtitleClassName,
  subtitle = 'Platform Orchestrator',
}: BrandLogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <ReleaseaMark />
      <div className="flex min-w-0 flex-col items-start leading-tight text-left">
        <p className={cn('text-sm font-semibold tracking-tight uppercase', textClassName)}>
          <span className="text-foreground">release</span>
          <span className="text-[#22D3EE]">a</span>
        </p>
        <p className={cn('text-xs text-muted-foreground', subtitleClassName)}>{subtitle}</p>
      </div>
    </div>
  );
}
