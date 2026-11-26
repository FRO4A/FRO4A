import { useI18n } from '../../i18n';
import { pad2 } from '../../utils/format';
import { cn } from '../../utils/cn';

export function Ball({
  value,
  red = false,
  size = 'md',
  matched = false,
  className,
}: {
  value: number;
  red?: boolean;
  size?: 'md' | 'sm';
  matched?: boolean;
  className?: string;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        'number-ball number-ball-static',
        size === 'sm' && 'number-ball-small',
        red ? 'number-ball-red' : 'number-ball-selected',
        matched && 'number-ball-match',
        className,
      )}
      aria-label={`${red ? t('common.redBall') : t('common.whiteBall')} ${value}${matched ? ` (${t('tickets.matchedLabel')})` : ''}`}
    >
      {pad2(value)}
    </span>
  );
}

export function BallSet({
  whites,
  red,
  size = 'md',
  matchedWhites,
  redMatched,
  className,
}: {
  whites: readonly number[];
  red?: number | null;
  size?: 'md' | 'sm';
  /** Whites of this set that matched the drawn result (rendered highlighted). */
  matchedWhites?: readonly number[];
  /** `true` when the red ball matched the drawn result. */
  redMatched?: boolean | null;
  className?: string;
}): JSX.Element {
  const matched = new Set(matchedWhites ?? []);
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {whites.map((white) => (
        <Ball key={`white-${white}`} value={white} size={size} matched={matched.has(white)} />
      ))}
      {red !== null && red !== undefined ? (
        <Ball value={red} red size={size} matched={redMatched === true} />
      ) : null}
    </div>
  );
}

export function TicketNumberChip({ number, className }: { number: number | string; className?: string }): JSX.Element {
  return (
    <span className={cn('glass-nested inline-flex items-center px-3 py-1.5 text-sm font-semibold tabular', className)}>
      #{typeof number === 'number' ? number.toString().padStart(6, '0') : number}
    </span>
  );
}
