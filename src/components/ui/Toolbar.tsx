import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface ToolbarProps {
  children: ReactNode;
  dense?: boolean;
  className?: string;
}

export function Toolbar({ children, dense, className }: ToolbarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 flex-wrap bg-[var(--surface-toolbar)] border-b border-[var(--line-1)]',
        dense ? 'px-3 py-1.5' : 'px-3.5 py-2',
        className
      )}
    >
      {children}
    </div>
  );
}
