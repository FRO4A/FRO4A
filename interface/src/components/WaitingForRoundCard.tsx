import type { ReactNode } from 'react';
import { Hourglass, RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n';
import { v5Copy } from '../i18n/v5Messages';

/**
 * Clean Liquid Glass zero-round state.
 *
 * Rendered instead of an error screen / infinite spinner when the backend returns
 * `{ pending: true, waiting: true, drawAddress: null }` (HTTP 200) before the
 * Admin launches Round #1: Overview, BALL, 100K, Taken Combinations and Verifier.
 */
export function WaitingForRoundCard({
  onRefresh,
  gameLabel,
  children,
  compact = false,
}: {
  onRefresh?: () => void;
  gameLabel?: string;
  children?: ReactNode;
  compact?: boolean;
}): JSX.Element {
  const { locale } = useI18n();
  const copy = v5Copy(locale);
  return (
    <section
      className="glass p-4 sm:p-5"
      role="status"
      data-testid="waiting-for-round"
      data-state="waiting"
    >
      <div className="flex items-start gap-3">
        <span className="glass-icon h-11 w-11 shrink-0 rounded-2xl">
          <Hourglass size={21} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{copy.waitingTitle}</h2>
            {gameLabel ? <span className="pill pill-neutral">{gameLabel}</span> : null}
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">{copy.waitingBody}</p>
          {!compact && onRefresh ? (
            <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={onRefresh}>
              <RefreshCw size={14} strokeWidth={1.75} />
              {copy.waitingRefresh}
            </button>
          ) : null}
        </div>
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
