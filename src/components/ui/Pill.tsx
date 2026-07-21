import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type PillTone = 'neutral' | 'ok' | 'crit' | 'warn' | 'info' | 'gold' | 'choco';

const TONE_CLASSES: Record<PillTone, string> = {
  neutral: 'bg-[#F1ECDF] text-[#5C523F] border-[#DDD4C0]',
  ok: 'bg-[#E4F6E7] text-[#1B5E20] border-[#BFE3C5]',
  crit: 'bg-[#FFE4E4] text-[#8D1F33] border-[#F0B3B9]',
  warn: 'bg-[#FCEED7] text-[#7A4E1C] border-[#E6CB99]',
  info: 'bg-[#E4F0FF] text-[#1E468A] border-[#B6CFEE]',
  gold: 'bg-[#FBF1CC] text-or-600 border-or-400',
  choco: 'bg-choco-600 text-[#FCF8EF] border-choco-800',
};

export interface PillProps {
  children: ReactNode;
  tone?: PillTone;
  dot?: boolean;
  className?: string;
}

export function Pill({ children, tone = 'neutral', dot, className }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide px-2 py-0.5 rounded-[var(--rx-pill)] border whitespace-nowrap',
        TONE_CLASSES[tone],
        className
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
