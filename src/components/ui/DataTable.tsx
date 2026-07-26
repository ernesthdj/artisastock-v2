import { type ReactNode, useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  render?: (row: T, index: number) => ReactNode;
  /** Rend la colonne triable au clic sur l'en-tête (asc → desc → ordre d'origine). */
  sortable?: boolean;
  /** Valeur brute utilisée pour le tri — nécessaire dès que `render` renvoie du JSX plutôt qu'une valeur comparable. */
  sortValue?: (row: T) => string | number;
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
  /** Tri initial appliqué au premier rendu (l'utilisateur peut ensuite le changer). */
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
}

type SortState = { key: string; direction: 'asc' | 'desc' } | null;

export function DataTable<T>({
  columns,
  rows,
  dense,
  onRowClick,
  selected,
  rowClassName,
  emptyState,
  className,
  defaultSort,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(defaultSort ?? null);
  const padY = dense ? 'py-1.5' : 'py-2.5';

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const getValue =
      col.sortValue ?? ((row: T) => (row as Record<string, unknown>)[col.key] as string | number);

    return [...rows].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sort.direction === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  const toggleSort = (col: DataTableColumn<T>) => {
    if (!col.sortable) return;
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, direction: 'asc' };
      if (prev.direction === 'asc') return { key: col.key, direction: 'desc' };
      return null;
    });
  };

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-erp-sm">
        <thead>
          <tr>
            {columns.map((col) => {
              const active = sort?.key === col.key;
              return (
                <th
                  key={col.key}
                  style={{ width: col.width, textAlign: col.align ?? 'left' }}
                  onClick={() => toggleSort(col)}
                  className={cn(
                    'sticky top-0 z-10 px-3 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-neutral-500 border-b border-[var(--line-2)] bg-[var(--surface-rowalt)] whitespace-nowrap',
                    col.sortable && 'cursor-pointer select-none hover:text-choco-600'
                  )}
                >
                  <span className={cn('inline-flex items-center gap-1', col.align === 'right' && 'flex-row-reverse')}>
                    {col.label}
                    {col.sortable && (
                      active ? (
                        sort!.direction === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                      ) : (
                        <ChevronsUpDown size={11} className="opacity-40" />
                      )
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => {
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
