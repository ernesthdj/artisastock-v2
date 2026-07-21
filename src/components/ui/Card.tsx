import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  foot?: ReactNode;
  padded?: boolean;
  className?: string;
}

export function Card({ title, subtitle, actions, children, foot, padded = true, className }: CardProps) {
  return (
    <div className={cn('bg-neutral-0 border border-[var(--line-1)] rounded-[var(--rx-card)] shadow-[var(--shadow-card)]', className)}>
      {(title || actions) && (
        <div className="flex items-center gap-3 px-3.5 pt-[11px] pb-2.5 border-b border-[var(--line-1)]">
          <div className="flex-1 min-w-0">
            {title && <div className="text-erp-sm font-semibold text-choco-600 tracking-wide">{title}</div>}
            {subtitle && <div className="text-[11.5px] text-neutral-500 mt-0.5">{subtitle}</div>}
          </div>
          {actions && <div className="flex gap-1.5">{actions}</div>}
        </div>
      )}
      <div className={padded ? 'p-3.5' : undefined}>{children}</div>
      {foot && <div className="border-t border-[var(--line-1)] px-3.5 py-2.5 bg-[var(--surface-rowalt)] text-erp-sm text-choco-500">{foot}</div>}
    </div>
  );
}
