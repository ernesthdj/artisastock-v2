import { type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: SelectOption[];
  size?: 'sm' | 'md';
}

const CHEVRON =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%236F4E37' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>\")";

export function Select({ options, size = 'md', className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'w-full appearance-none rounded-[var(--rx-input)] border border-[var(--line-2)] bg-neutral-0 bg-no-repeat text-choco-600 cursor-pointer',
        size === 'sm' ? 'text-erp-xs py-1 pl-2 pr-6' : 'text-erp-sm py-[7px] pl-2.5 pr-7',
        className
      )}
      style={{ backgroundImage: CHEVRON, backgroundPosition: 'right 10px center' }}
      {...props}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
