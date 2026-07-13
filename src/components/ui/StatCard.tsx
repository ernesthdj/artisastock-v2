import { cn } from '@/lib/utils/cn';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  trend?: { value: number; label?: string };
  onClick?: () => void;
  loading?: boolean;
}

export function StatCard({ label, value, icon: Icon, iconColor = 'text-primary-600', trend, onClick, loading }: StatCardProps) {
  return (
    <div
      className={cn(
        'kpi-card',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {loading ? (
        <div className="space-y-2">
          <div className="h-4 bg-neutral-200 dark:bg-slate-600 rounded animate-skeleton w-2/3" />
          <div className="h-8 bg-neutral-200 dark:bg-slate-600 rounded animate-skeleton w-1/2" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-neutral-500 dark:text-slate-400 font-medium">{label}</p>
            <div className={cn('p-2 rounded-lg bg-neutral-100 dark:bg-slate-700', iconColor.replace('text-', 'bg-').replace('600', '100'))}>
              <Icon size={18} className={iconColor} />
            </div>
          </div>
          <p className="text-3xl font-bold text-neutral-900 dark:text-white">{value}</p>
          {trend && (
            <p className={cn(
              'mt-1 text-xs font-medium flex items-center gap-1',
              trend.value >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
              {trend.label && <span className="text-neutral-400 font-normal">{trend.label}</span>}
            </p>
          )}
        </>
      )}
    </div>
  );
}
