import { ReactNode } from 'react';
import { SearchInput } from '@/components/layout/SearchInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type FilterOption = {
  value: string;
  label: string;
};

export type TableFilterSelect = {
  id: string;
  value: string;
  placeholder?: string;
  icon?: ReactNode;
  options: FilterOption[];
  onValueChange: (value: string) => void;
  triggerClassName?: string;
};

export type TableFilterPill = {
  id: string;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
};

interface TableFiltersBarProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  selects?: TableFilterSelect[];
  pills?: TableFilterPill[];
  className?: string;
}

export function TableFiltersBar({ search, selects = [], pills = [], className }: TableFiltersBarProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 overflow-x-auto">
        {search && (
          <SearchInput
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder ?? 'Search...'}
            className="min-w-[260px] flex-1 max-w-none"
          />
        )}
        <div className="flex items-center gap-3 ml-auto flex-nowrap">
          {selects.map((select) => (
            <Select key={select.id} value={select.value} onValueChange={select.onValueChange}>
              <SelectTrigger className={cn('min-w-[190px] bg-muted/40', select.triggerClassName)}>
                <div className="flex items-center gap-2">
                  {select.icon}
                  <SelectValue placeholder={select.placeholder} />
                </div>
              </SelectTrigger>
              <SelectContent>
                {select.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      </div>

      {pills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={pill.onClick}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                pill.active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {pill.label}
              {typeof pill.count === 'number' ? ` (${pill.count})` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
