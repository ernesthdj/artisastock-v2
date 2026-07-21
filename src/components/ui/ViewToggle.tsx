import { cn } from '@/lib/utils/cn';

export type ViewToggleView = 'list' | 'kanban' | 'calendar' | 'graph' | 'pivot';

const VIEW_META: Record<ViewToggleView, { icon: string; label: string }> = {
  list: { icon: '☰', label: 'Liste' },
  kanban: { icon: '⊞', label: 'Kanban' },
  calendar: { icon: '▦', label: 'Calendrier' },
  graph: { icon: '▱', label: 'Graph' },
  pivot: { icon: '⊟', label: 'Pivot' },
};

export interface ViewToggleProps {
  value: ViewToggleView;
  onChange: (view: ViewToggleView) => void;
  views?: ViewToggleView[];
  className?: string;
}

export function ViewToggle({ value, onChange, views = ['list', 'kanban', 'calendar', 'graph'], className }: ViewToggleProps) {
  return (
    <div className={cn('inline-flex bg-neutral-0 border border-[var(--line-2)] rounded-[var(--rx-md)] overflow-hidden', className)}>
      {views.map((v) => {
        const meta = VIEW_META[v];
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            title={meta.label}
            onClick={() => onChange(v)}
            className={cn(
              'inline-flex items-center gap-1.5 border-0 px-2.5 py-1.5 text-erp-sm font-medium',
              active ? 'bg-choco-600 text-[#FCF8EF]' : 'bg-transparent text-choco-500'
            )}
          >
            <span className="text-erp-sm">{meta.icon}</span>
            <span className="text-[11.5px]">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
