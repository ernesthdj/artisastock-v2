import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, required, className, children }: FieldProps) {
  return (
    <label className={cn('flex flex-col w-full', className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
        {label}
        {required && <span className="text-framboise-400 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-neutral-500 italic mt-1">{hint}</span>}
    </label>
  );
}
