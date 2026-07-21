import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  render?: (row: T, index: number) => ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  dense?: boolean;
  onRowClick?: (row: T, index: number) => void;
  selected?: number;
  rowClassName?: (row: T, index: number) => string | undefined;
  emptyState?: ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  dense,
  onRowClick,
  selected,
  rowClassName,
  emptyState,
  className,
}: DataTableProps<T>) {
  const padY = dense ? 'py-1.5' : 'py-2.5';
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-erp-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width, textAlign: col.align ?? 'left' }}
                className="px-3 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-neutral-500 border-b border-[var(--line-2)] bg-[var(--surface-rowalt)] whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isSel = selected === i;
            return (
              <tr
                key={i}
                onClick={() => onRowClick?.(row, i)}
                className={cn(
                  'border-b border-[var(--line-1)]',
                  isSel ? 'bg-[var(--surface-sel)]' : i % 2 ? 'bg-[var(--surface-rowalt)]' : 'bg-neutral-0',
                  onRowClick && 'cursor-pointer',
                  rowClassName?.(row, i)
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{ textAlign: col.align ?? 'left' }}
                    className={cn(
                      'px-3 text-choco-600 border-b border-[var(--line-1)] align-middle',
                      padY,
                      col.align === 'right' && 'tabular-nums'
                    )}
                  >
                    {col.render ? col.render(row, i) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && emptyState && <div className="px-3.5 py-4 text-erp-sm text-neutral-500 italic">{emptyState}</div>}
    </div>
  );
}
