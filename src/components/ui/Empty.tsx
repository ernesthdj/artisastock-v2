import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface EmptyProps {
  icon?: ReactNode;
  title: string;
  desc?: string;
  action?: ReactNode;
  className?: string;
}

export function Empty({ icon, title, desc, action, className }: EmptyProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2.5 text-center px-5 py-10', className)}>
      {icon && <div className="text-3xl opacity-40">{icon}</div>}
      <div className="font-heading italic text-erp-xl text-choco-600">{title}</div>
      {desc && <div className="text-erp-sm text-neutral-500 max-w-[360px]">{desc}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
