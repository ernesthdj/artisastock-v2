import { Fragment } from 'react';
import { cn } from '@/lib/utils/cn';

export interface CrumbProps {
  items: string[];
  className?: string;
}

export function Crumb({ items, className }: CrumbProps) {
  return (
    <div className={cn('flex items-center gap-1.5 text-erp-sm text-neutral-500', className)}>
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="opacity-40">›</span>}
          <span className={i === items.length - 1 ? 'text-choco-600 font-semibold' : 'text-neutral-500 font-medium'}>{item}</span>
        </Fragment>
      ))}
    </div>
  );
}
