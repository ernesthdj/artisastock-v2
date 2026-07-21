import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TabItem {
  key: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex border-b border-[var(--line-2)]', className)}>
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              'inline-flex items-center gap-1.5 border-0 bg-transparent px-4 py-2.5 -mb-px text-erp-sm border-b-2',
              isActive ? 'font-semibold text-choco-600 border-choco-600' : 'font-medium text-neutral-500 border-transparent'
            )}
          >
            {t.icon}
            {t.label}
            {t.count != null && (
              <span
                className={cn(
                  'text-[10.5px] font-semibold px-1.5 rounded-[var(--rx-pill)]',
                  isActive ? 'bg-or-400 text-choco-600' : 'bg-[var(--line-1)] text-neutral-500'
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
