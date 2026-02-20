import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTablePagination } from '@/hooks/use-table-pagination';
import { TablePagination } from '@/components/layout/TablePagination';
import { TableEmptyRow } from '@/components/layout/EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  render: (item: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'Nothing here yet',
  emptyDescription = 'You can add new items or adjust your search.',
  emptyIcon,
  className,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className={cn('bg-card border border-border rounded-lg overflow-hidden', className)}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap',
                      col.headerClassName
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <TableEmptyRow
                colSpan={columns.length}
                icon={emptyIcon ?? <Inbox className="h-5 w-5 text-muted-foreground" />}
                title={emptyMessage}
                description={emptyDescription}
              />
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const pagination = useTablePagination(data.length);
  const visibleRows = pagination.slice(data);
  const startIndex = (pagination.page - 1) * pagination.pageSize;

  return (
    <div className={cn('bg-card border border-border rounded-lg overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap',
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((item, index) => (
              <tr
                key={keyExtractor(item)}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={cn(
                  'border-b border-border/50 hover:bg-muted/20 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3', col.className)}>
                    {col.render(item, startIndex + index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalItems={data.length}
        totalPages={pagination.totalPages}
        onPageChange={pagination.setPage}
      />
    </div>
  );
}
