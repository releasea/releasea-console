import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface QuickStat {
  label: string;
  value: ReactNode;
  sublabel?: string;
  icon?: ReactNode;
}

interface QuickStatsGridProps {
  stats: QuickStat[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const columnClasses = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
};

export function QuickStatsGrid({ stats, columns = 4, className }: QuickStatsGridProps) {
  return (
    <div className={cn('grid gap-3', columnClasses[columns], className)}>
      {stats.map((stat, index) => (
        <div key={index} className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            {stat.icon && <span className="text-muted-foreground">{stat.icon}</span>}
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
          </div>
          <p className="mt-1 text-sm font-medium text-foreground truncate">{stat.value}</p>
          {stat.sublabel && (
            <p className="mt-0.5 text-xs text-muted-foreground">{stat.sublabel}</p>
          )}
        </div>
      ))}
    </div>
  );
}
