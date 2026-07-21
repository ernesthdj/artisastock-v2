import { cn } from '@/lib/utils/cn';

export interface StatusStage {
  key: string;
  label: string;
}

export interface StatusPipelineProps {
  stages: StatusStage[];
  current: string;
  onJump?: (key: string) => void;
  className?: string;
}

export function StatusPipeline({ stages, current, onJump, className }: StatusPipelineProps) {
  const idx = stages.findIndex((s) => s.key === current);
  return (
    <div className={cn('inline-flex items-center gap-0 bg-neutral-0 border border-[var(--line-2)] rounded-[var(--rx-pill)] p-[3px]', className)}>
      {stages.map((s, i) => {
        const isActive = i === idx;
        const isPast = i < idx;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onJump?.(s.key)}
            className={cn(
              'inline-flex items-center gap-1.5 border-0 rounded-[var(--rx-pill)] text-[11.5px] tracking-wide px-3.5 py-[5px] transition-colors',
              onJump ? 'cursor-pointer' : 'cursor-default',
              isActive ? 'bg-choco-600 text-[#FCF8EF] font-semibold' : isPast ? 'text-choco-500 font-medium' : 'text-neutral-500 font-medium'
            )}
          >
            {isPast && <span className="text-[11px]">✓</span>}
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
