import { useMemo, useState } from 'react';
import { Dices, Eraser } from 'lucide-react';
import { useI18n } from '../i18n';
import { packCombination, secureCombination, toBasketItem } from '../services/ballBasket';
import { cn } from '../utils/cn';
import { Ball } from './ui/Ball';

export interface BallSelection {
  whites: number[];
  red: number | null;
}

/** Quick pick never returns a combination already taken or queued in the basket. */
function quickPick(blocked: ReadonlySet<string>): BallSelection {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const candidate = secureCombination();
    const packed = toBasketItem(candidate).packed;
    if (!blocked.has(packed)) return { whites: candidate.whites, red: candidate.red };
  }
  return { whites: [1, 2, 3, 4, 5], red: 1 };
}

export function TicketPicker({
  value,
  onChange,
  takenPacked,
  disabled = false,
}: {
  value: BallSelection;
  onChange: (selection: BallSelection) => void;
  takenPacked: ReadonlySet<string>;
  disabled?: boolean;
}): JSX.Element {
  const { t } = useI18n();
  const [tab, setTab] = useState<'white' | 'red'>('white');

  const selectedWhites = useMemo(() => new Set(value.whites), [value.whites]);

  const toggleWhite = (number: number): void => {
    if (disabled) return;
    const selected = new Set(value.whites);
    if (selected.has(number)) selected.delete(number);
    else if (selected.size < 5) selected.add(number);
    onChange({ whites: [...selected].sort((a, b) => a - b), red: value.red });
  };

  const toggleRed = (number: number): void => {
    if (disabled) return;
    onChange({ whites: value.whites, red: value.red === number ? null : number });
  };

  const complete = value.whites.length === 5 && value.red !== null;
  const duplicate = complete && takenPacked.has(packCombination(value.whites, value.red as number));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="segmented" role="tablist" aria-label={t('ball.pickerTitle')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'white'}
            className={cn('segment', tab === 'white' && 'segment-active')}
            onClick={() => setTab('white')}
          >
            {t('ball.whitesTitle')} · {value.whites.length}/5
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'red'}
            className={cn('segment', tab === 'red' && 'segment-active')}
            onClick={() => setTab('red')}
          >
            {t('ball.redTitle')} · {value.red === null ? 0 : 1}/1
          </button>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={disabled}
            onClick={() => onChange(quickPick(takenPacked))}
          >
            <Dices size={15} strokeWidth={1.75} />
            {t('ball.quickPick')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={disabled}
            onClick={() => onChange({ whites: [], red: null })}
          >
            <Eraser size={15} strokeWidth={1.75} />
            {t('ball.clear')}
          </button>
        </div>
      </div>

      <div className="glass-nested p-3">
        {tab === 'white' ? (
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 69 }, (_, index) => index + 1).map((number) => {
              const selected = selectedWhites.has(number);
              const muted = !selected && value.whites.length >= 5;
              return (
                <button
                  key={number}
                  type="button"
                  className={cn(
                    'number-ball h-9 w-9 text-[13px]',
                    selected && 'number-ball-selected',
                    muted && 'number-ball-muted',
                  )}
                  aria-pressed={selected}
                  disabled={disabled || muted}
                  onClick={() => toggleWhite(number)}
                >
                  {number.toString().padStart(2, '0')}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 26 }, (_, index) => index + 1).map((number) => {
              const selected = value.red === number;
              return (
                <button
                  key={number}
                  type="button"
                  className={cn('number-ball h-9 w-9 text-[13px]', selected ? 'number-ball-red' : 'number-ball-red-option')}
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={() => toggleRed(number)}
                >
                  {number.toString().padStart(2, '0')}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-h-10 flex-wrap items-center gap-1.5">
          {complete ? (
            <>
              {value.whites.map((white) => (
                <Ball key={white} value={white} size="sm" />
              ))}
              <Ball value={value.red as number} red size="sm" />
            </>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">{t('ball.emptySelection')}</span>
          )}
        </div>
        {complete ? (
          <span className={cn('pill', duplicate ? 'pill-danger' : 'pill-success')}>
            {duplicate ? t('ball.duplicateWarning') : t('ball.availableNote')}
          </span>
        ) : null}
      </div>
    </div>
  );
}

