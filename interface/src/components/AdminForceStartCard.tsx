import { useState } from 'react';
import { PlayCircle, ShieldAlert } from 'lucide-react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import type { CurrentDrawView } from '../types/api';
import type { GameType } from '../types/game';
import { useI18n, type Translate } from '../i18n';
import { buildForceStartGame } from '../services/messages';
import { sendTransaction } from '../services/tonConnect';
import { GAS } from '../services/opcodes';
import { cn } from '../utils/cn';

function phaseText(t: Translate, status: number): string {
  if (status === 0) return t('status.waitingFirstTicket');
  if (status === 1) return t('status.activeSales');
  if (status === 2) return t('status.salesClosed');
  if (status === 3) return t('status.tallying');
  if (status === 4) return t('status.claimOpen');
  if (status === 5) return t('status.cancelled');
  return t('status.unknown');
}

/**
 * Primary admin action: one click → Tonkeeper signature → ForceStartGame.
 *
 * There is deliberately no intermediate confirmation modal: the wallet itself
 * is the confirmation step. Buyer pickers are never rendered for this role.
 */
export function AdminForceStartCard({
  gameType,
  draw,
  onDone,
}: {
  gameType: GameType;
  draw: CurrentDrawView;
  onDone: () => void;
}): JSX.Element {
  const { t } = useI18n();
  const [tonConnectUI] = useTonConnectUI();
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const closed = draw.status >= 2;
  const disabled = closed || status === 'sending';

  const forceStart = async (): Promise<void> => {
    if (disabled) return;
    setStatus('sending');
    try {
      await sendTransaction(tonConnectUI, [
        {
          address: draw.drawAddress,
          amount: GAS.ADMIN_ACTION.toString(),
          payload: buildForceStartGame(gameType),
        },
      ]);
      setStatus('success');
      window.setTimeout(onDone, 5_000);
    } catch {
      setStatus('error');
    }
  };

  return (
    <section className="glass p-4 sm:p-5" aria-label={t('admin.forceStartTitle')}>
      <div className="mb-3 flex items-start gap-3">
        <span className="glass-icon h-11 w-11 shrink-0 rounded-2xl">
          <ShieldAlert size={21} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t('admin.forceStartTitle')}</h2>
          <p className="mt-0.5 max-w-2xl text-sm leading-5 text-secondary">{t('admin.forceStartSubtitle')}</p>
        </div>
      </div>

      <div className="glass-nested mb-3 flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <span className="stat-label">{t('admin.phaseLabel')}</span>
        <span className={cn('pill', closed ? 'pill-warning' : 'pill-success')}>
          {phaseText(t, draw.status)}
        </span>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-lg btn-block"
        disabled={disabled}
        onClick={() => void forceStart()}
      >
        <PlayCircle size={19} strokeWidth={1.75} />
        {status === 'sending' ? t('admin.forceStartSending') : t('admin.forceStartTitle')}
      </button>

      {closed ? <p className="mt-2 text-xs text-[var(--text-muted)]">{t('admin.forceStartDisabled')}</p> : null}
      {status === 'success' ? (
        <p className="mt-2 text-xs text-[var(--success)]" role="status">
          {t('admin.forceStartSuccess')}
        </p>
      ) : null}
      {status === 'error' ? (
        <p className="mt-2 text-xs text-[var(--danger)]" role="alert">
          {t('admin.error')}
        </p>
      ) : null}
    </section>
  );
}