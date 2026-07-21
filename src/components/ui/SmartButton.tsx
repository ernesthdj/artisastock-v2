import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type SmartButtonTone = 'default' | 'danger' | 'gold' | 'ok';

const VALUE_TONE: Record<SmartButtonTone, string> = {
  default: 'text-choco-600',
  danger: 'text-framboise-400',
  gold: 'text-or-600',
  ok: 'text-[#1B7A3E]',
};

export interface SmartButtonProps {
  icon?: ReactNode;
  value: ReactNode;
  label: string;
  tone?: SmartButtonTone;
  active?: boolean;
  onClick?: () => void;
}

export function SmartButton({ icon, value, label, tone = 'default', active, onClick }: SmartButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-0.5 px-3.5 py-2 min-w-[110px] border-0 border-l border-[var(--line-1)] text-left',
        active && 'bg-[var(--surface-app)]',
        onClick ? 'cursor-pointer' : 'cursor-default'
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-[10.5px] tracking-wider uppercase text-neutral-500 font-semibold">
        {icon && <span className="text-[11px]">{icon}</span>}
        {label}
      </span>
      <span className={cn('text-erp-xl font-bold tabular-nums leading-tight', VALUE_TONE[tone])}>{value}</span>
    </button>
  );
}
