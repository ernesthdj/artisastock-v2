import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const btnVariants = cva(
  'inline-flex items-center gap-1.5 font-medium rounded-[var(--rx-input)] border transition-colors whitespace-nowrap leading-tight disabled:cursor-not-allowed disabled:opacity-45',
  {
    variants: {
      variant: {
        default: 'bg-neutral-0 border-[var(--line-2)] text-choco-600 hover:bg-[var(--surface-hover)]',
        primary: 'bg-choco-600 border-choco-800 text-[#FCF8EF] hover:bg-choco-700',
        danger: 'bg-framboise-400 border-framboise-500 text-white hover:bg-framboise-500',
        ghost: 'bg-transparent border-transparent text-choco-500 hover:bg-[var(--line-1)]',
        link: 'bg-transparent border-transparent text-framboise-400 p-0 hover:underline hover:underline-offset-4 hover:text-framboise-500',
        gold: 'bg-[#FBF1CC] border-or-400 text-or-600 hover:bg-[#F7E7B0]',
      },
      size: {
        sm: 'text-erp-xs px-2.5 py-1',
        md: 'text-erp-sm px-3 py-1.5',
      },
      active: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      { variant: 'default', active: true, class: 'bg-[#F2EBDA]' },
      { variant: 'primary', active: true, class: 'bg-choco-700' },
      { variant: 'ghost', active: true, class: 'bg-[var(--line-1)]' },
      { variant: 'link', active: true, class: 'underline underline-offset-4' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'md',
      active: false,
    },
  }
);

export interface BtnProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof btnVariants> {
  children?: ReactNode;
  icon?: ReactNode;
  kbd?: string;
}

export function Btn({ children, variant, size, active, icon, kbd, className, type = 'button', ...props }: BtnProps) {
  return (
    <button type={type} className={cn(btnVariants({ variant, size, active }), className)} {...props}>
      {icon && <span className="text-[0.95em] leading-none opacity-90">{icon}</span>}
      {children && <span>{children}</span>}
      {kbd && <KeyHint>{kbd}</KeyHint>}
    </button>
  );
}

export function KeyHint({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] px-1.5 py-px rounded-sm bg-black/[.06] opacity-70 ml-1">
      {children}
    </span>
  );
}
