import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type KpiTone = 'neutral' | 'warn' | 'gold' | 'ok';

const TONE_CLASSES: Record<KpiTone, string> = {
  neutral: 'bg-neutral-0 border-[var(--line-1)]',
  warn: 'bg-[#FFF8EC] border-[#E8CE94]',
  gold: 'bg-[#FFFAE5] border-[#E2C964]',
  ok: 'bg-[#F0F8F1] border-[#BFE3C5]',
};

const TONE_VALUE_CLASSES: Record<KpiTone, string> = {
  neutral: 'text-choco-600',
  warn: 'text-framboise-400',
  gold: 'text-or-600',
  ok: 'text-[#1B7A3E]',
};

export interface KpiCardProps {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: KpiTone;
  onClick?: () => void;
  className?: string;
}

export function KpiCard({ icon, label, value, sub, tone = 'neutral', onClick, className }: KpiCardProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex-1 min-w-0 rounded-[var(--rx-card)] border px-3.5 py-[11px]',
        TONE_CLASSES[tone],
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-neutral-500">
        {icon && <span>{icon}</span>}
        {label}
      </div>
      <div className={cn('font-heading text-erp-2xl font-bold mt-1 leading-tight', TONE_VALUE_CLASSES[tone])}>{value}</div>
      {sub && <div className="text-[11px] text-neutral-500 mt-0.5">{sub}</div>}
    </div>
  );
}
