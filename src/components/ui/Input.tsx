'use client';

import { type InputHTMLAttributes, type ReactNode, useState } from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  icon?: ReactNode;
  suffix?: ReactNode;
  size?: 'sm' | 'md';
  containerClassName?: string;
}

export function Input({ icon, suffix, size = 'md', readOnly, className, containerClassName, onFocus, onBlur, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      className={cn(
        'relative inline-flex items-center w-full rounded-[var(--rx-input)] border bg-neutral-0 transition-[border-color,box-shadow]',
        readOnly && 'bg-[var(--surface-rowalt)]',
        focused ? 'border-choco-600 shadow-[0_0_0_3px_rgba(61,40,23,0.08)]' : 'border-[var(--line-2)]',
        containerClassName
      )}
    >
      {icon && <span className="pl-2 text-erp-sm text-neutral-500">{icon}</span>}
      <input
        readOnly={readOnly}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={cn(
          'flex-1 min-w-0 border-0 outline-none bg-transparent text-choco-600',
          size === 'sm' ? 'text-erp-xs px-2 py-1' : 'text-erp-sm px-2.5 py-[7px]',
          className
        )}
        {...props}
      />
      {suffix && <span className="pr-2.5 text-erp-xs text-neutral-500">{suffix}</span>}
    </div>
  );
}
