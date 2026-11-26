import { cn } from '../../utils/cn';
import { clampPercent } from '../../utils/format';

export function ProgressBar({
  value,
  max,
  tone = 'accent',
  className,
}: {
  value: number;
  max: number;
  tone?: 'accent' | 'success' | 'warning';
  className?: string;
}): JSX.Element {
  const percent = max > 0 ? clampPercent((value / max) * 100) : 0;
  const fill = tone === 'success' ? 'progress-fill-success' : tone === 'warning' ? 'progress-fill-warning' : '';
  return (
    <div className={cn('progress-track', className)} role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('progress-fill', fill)} style={{ width: `${percent}%` }} />
    </div>
  );
}
