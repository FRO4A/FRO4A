import { useI18n } from '../../i18n';
import { useCountdown } from '../../hooks/useCountdown';
import { computeRemaining, formatRemaining, type RemainingTime } from '../../utils/time';
import { cn } from '../../utils/cn';

export function Countdown({
  target,
  blocks = false,
  className,
  emptyLabel,
}: {
  target: string | number | Date | null | undefined;
  blocks?: boolean;
  className?: string;
  emptyLabel?: string;
}): JSX.Element {
  const { t } = useI18n();
  const remaining = useCountdown(target);
  const units = { d: t('common.days'), h: t('common.hours'), m: t('common.minutes'), s: t('common.seconds') };

  if (target === null || target === undefined) {
    return <span className={cn('text-muted', className)}>{emptyLabel ?? '—'}</span>;
  }

  if (remaining.expired) {
    return <span className={cn('text-muted', className)}>{t('common.expired')}</span>;
  }

  if (!blocks) {
    return <span className={cn('tabular', className)}>{formatRemaining(remaining, units)}</span>;
  }

  return <CountdownBlocks remaining={remaining} className={className} />;
}

function CountdownBlocks({ remaining, className }: { remaining: RemainingTime; className?: string }): JSX.Element {
  const { t } = useI18n();
  const cells = [
    { value: remaining.days, label: t('common.days') },
    { value: remaining.hours, label: t('common.hours') },
    { value: remaining.minutes, label: t('common.minutes') },
    { value: remaining.seconds, label: t('common.seconds') },
  ];
  return (
    <div className={cn('flex gap-2', className)}>
      {cells.map((cell) => (
        <div key={cell.label} className="glass-nested min-w-[3.25rem] px-2 py-1.5 text-center">
          <div className="tabular text-lg font-semibold leading-6 text-[var(--text-primary)]">
            {cell.value.toString().padStart(2, '0')}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{cell.label}</div>
        </div>
      ))}
    </div>
  );
}

export function StaticCountdown({
  target,
  className,
}: {
  target: string | number | Date | null | undefined;
  className?: string;
}): JSX.Element {
  const { t } = useI18n();
  const remaining = computeRemaining(target);
  return (
    <span className={cn('tabular', className)}>
      {remaining.expired
        ? t('common.expired')
        : formatRemaining(remaining, {
            d: t('common.days'),
            h: t('common.hours'),
            m: t('common.minutes'),
            s: t('common.seconds'),
          })}
    </span>
  );
}
