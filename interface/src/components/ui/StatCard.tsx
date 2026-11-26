import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export function StatCard({
  label,
  value,
  sub,
  icon,
  className,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  className?: string;
  accent?: boolean;
}): JSX.Element {
  return (
    <div className={cn('glass-nested p-3.5', accent && 'ring-1 ring-[var(--accent-soft)]', className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="stat-label">{label}</span>
        {icon ? <span className="text-[var(--text-muted)]">{icon}</span> : null}
      </div>
      <div className="mt-1.5 text-[1.35rem] font-semibold leading-7 tracking-tight tabular text-[var(--text-primary)]">
        {value}
      </div>
      {sub ? <div className="stat-sub mt-0.5">{sub}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('mb-3 flex flex-wrap items-end justify-between gap-2', className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
        {subtitle ? <p className="mt-0.5 max-w-2xl text-sm text-secondary">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
