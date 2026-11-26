import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Coins, Flag, PlayCircle, RefreshCw, ShieldAlert, Sparkles, TimerReset } from 'lucide-react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import type { Cell } from '@ton/core';
import type { CurrentDrawView } from '../types/api';
import type { GameType } from '../types/game';
import { useI18n } from '../i18n';
import { useApiResource } from '../hooks/useApiResource';
import { readFactoryNextRound } from '../services/tonChain';
import { GAS } from '../services/opcodes';
import {
  buildBallDeployDraw,
  buildBallSweepCompanyFee,
  buildCheckDeadline,
  buildCheckVrfTimeout,
  buildCloseExpiredDraw,
  buildForceStartGame,
  buildHundredKCreateDraw,
  buildHundredKSweepCompanyFee,
  buildRetryRollover,
} from '../services/messages';
import { sendTransaction } from '../services/tonConnect';
import { BLOCKED_TRANSACTION_MESSAGE, DrawAddressSecurityError } from '../services/drawTrust';
import { parseTonToNano } from '../utils/format';
import { sameAddress } from '../utils/address';
import { Modal } from './ui/Modal';

type ActionKey =
  | 'forceStart'
  | 'createRound'
  | 'sweep'
  | 'checkDeadline'
  | 'checkVrfTimeout'
  | 'retryRollover'
  | 'closeExpired';

interface PendingAction {
  key: ActionKey;
  title: string;
  description: string;
  target: string;
  amount: bigint;
  body: Cell;
}

export function AdminPanel({
  gameType,
  draw,
  factoryAddress,
  onDone,
  hideForceStart = false,
}: {
  gameType: GameType;
  draw: CurrentDrawView;
  factoryAddress: string;
  onDone: () => void;
  /** When the primary one-click Force start card is rendered above. */
  hideForceStart?: boolean;
}): JSX.Element {
  const { t } = useI18n();
  const [tonConnectUI] = useTonConnectUI();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [sweepTon, setSweepTon] = useState(draw.companyFeeAccrued.ton);

  useEffect(() => {
    setSweepTon(draw.companyFeeAccrued.ton);
  }, [draw.drawAddress, draw.companyFeeAccrued.ton]);

  const nextRound = useApiResource<number>(
    (signal) => readFactoryNextRound(gameType, factoryAddress, signal),
    [gameType, factoryAddress],
    0,
  );

  const feeNano = useMemo(() => parseTonToNano(sweepTon), [sweepTon]);
  const sweepValid = feeNano !== null && feeNano > 0n;

  const open = (key: ActionKey): void => {
    setResult(null);
    if (key === 'createRound') {
      if (nextRound.data === null) return;
      const body =
        gameType === 'BALL' ? buildBallDeployDraw(nextRound.data) : buildHundredKCreateDraw();
      setPending({
        key,
        title: t('admin.createRound'),
        description: `${t('admin.createRoundDesc')} ${t('admin.nextRoundLabel')}: ${nextRound.data}`,
        target: factoryAddress,
        amount: gameType === 'BALL' ? GAS.BALL_DEPLOY_DRAW : GAS.HUNDRED_K_CREATE_DRAW,
        body,
      });
      return;
    }
    if (key === 'forceStart') {
      setPending({
        key,
        title: t('admin.forceStart'),
        description: t('admin.forceStartDesc'),
        target: draw.drawAddress,
        amount: GAS.ADMIN_ACTION,
        body: buildForceStartGame(gameType),
      });
      return;
    }
    if (key === 'sweep') {
      const body = gameType === 'BALL' ? buildBallSweepCompanyFee(feeNano ?? 0n) : buildHundredKSweepCompanyFee();
      setPending({
        key,
        title: t('admin.sweep'),
        description: t('admin.sweepDesc'),
        target: draw.drawAddress,
        amount: GAS.ADMIN_ACTION,
        body,
      });
      return;
    }
    if (key === 'checkDeadline') {
      setPending({
        key,
        title: t('admin.checkDeadline'),
        description: t('admin.checkDeadlineDesc'),
        target: draw.drawAddress,
        amount: GAS.ADMIN_ACTION,
        body: buildCheckDeadline(gameType),
      });
      return;
    }
    if (key === 'checkVrfTimeout') {
      setPending({
        key,
        title: t('admin.checkVrfTimeout'),
        description: t('admin.checkVrfTimeoutDesc'),
        target: draw.drawAddress,
        amount: GAS.ADMIN_ACTION,
        body: buildCheckVrfTimeout(gameType),
      });
      return;
    }
    if (key === 'retryRollover') {
      setPending({
        key,
        title: t('admin.retryRollover'),
        description: t('admin.retryRolloverDesc'),
        target: draw.drawAddress,
        amount: GAS.ADMIN_ACTION,
        body: buildRetryRollover(),
      });
      return;
    }
    setPending({
      key,
      title: t('admin.closeExpired'),
      description: t('admin.closeExpiredDesc'),
      target: draw.drawAddress,
      amount: GAS.ADMIN_ACTION,
      body: buildCloseExpiredDraw(gameType),
    });
  };

  const confirm = async (): Promise<void> => {
    if (!pending) return;
    setSending(true);
    setBlocked(false);
    try {
      // Every action that targets the draw contract is verified against the
      // immutable factory before the wallet prompt. `createRound` targets the
      // factory itself (no drawAddress), so it is not guarded here.
      const drawTarget = sameAddress(pending.target, draw.drawAddress)
        ? { gameType, roundId: draw.roundId, drawAddress: draw.drawAddress }
        : undefined;
      await sendTransaction(
        tonConnectUI,
        [{ address: pending.target, amount: pending.amount.toString(), payload: pending.body }],
        drawTarget,
      );
      setResult('success');
      setPending(null);
      nextRound.refresh();
      window.setTimeout(onDone, 5000);
    } catch (error) {
      setResult('error');
      setBlocked(error instanceof DrawAddressSecurityError);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass p-4 sm:p-5" role="region" aria-label={t('admin.title')}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert size={19} strokeWidth={1.75} className="text-[var(--text-primary)]" />
            <h2 className="text-lg font-semibold tracking-tight">
              {hideForceStart ? t('admin.secondaryTitle') : t('admin.title')}
            </h2>
          </div>
          <p className="mt-0.5 max-w-2xl text-sm text-secondary">
            {hideForceStart ? t('admin.secondarySubtitle') : t('admin.subtitle')}
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={nextRound.refresh}>
          <RefreshCw size={14} strokeWidth={1.75} />
          {t('common.refresh')}
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div className="glass-nested px-3 py-2">
          <div className="text-[var(--text-muted)]">{t('admin.roundLabel')}</div>
          <div className="font-semibold tabular">#{draw.roundId}</div>
        </div>
        <div className="glass-nested px-3 py-2">
          <div className="text-[var(--text-muted)]">{t('admin.nextRoundLabel')}</div>
          <div className="font-semibold tabular">
            {nextRound.loading ? t('common.loading') : nextRound.data !== null ? `#${nextRound.data}` : '—'}
          </div>
        </div>
        <div className="glass-nested col-span-2 px-3 py-2 sm:col-span-1">
          <div className="text-[var(--text-muted)]">{t('admin.feeAccrued')}</div>
          <div className="font-semibold tabular">{draw.companyFeeAccrued.ton} {t('common.ton')}</div>
          <div className="text-[10px] text-[var(--text-muted)]">
            {t('admin.autoFeeSweptLabel')}: <span className="tabular">{draw.companyFeeSwept.ton} {t('common.ton')}</span>
          </div>
        </div>
      </div>

      <div className="glass-nested mb-3 space-y-1.5 p-3 text-[11px] leading-4 text-[var(--text-muted)]">
        <p>{t('admin.autoFeeNote')}</p>
        <p>{t('admin.keeperExpiryNote')}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {hideForceStart ? null : (
          <button
            type="button"
            className="btn btn-secondary justify-start"
            onClick={() => open('forceStart')}
            disabled={draw.status > 1}
          >
            <PlayCircle size={17} strokeWidth={1.75} />
            {t('admin.forceStart')}
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary justify-start"
          onClick={() => open('createRound')}
          disabled={nextRound.data === null}
        >
          <Sparkles size={17} strokeWidth={1.75} />
          {t('admin.createRound')}
        </button>
        <button type="button" className="btn btn-secondary justify-start" onClick={() => open('checkDeadline')}>
          <TimerReset size={17} strokeWidth={1.75} />
          {t('admin.checkDeadline')}
        </button>
      </div>

      <details className="mt-3 rounded-2xl border border-[var(--hairline)] p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-[var(--text-primary)]">
          {t('admin.maintenance')}
          <ChevronDown size={16} strokeWidth={1.75} />
        </summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="btn btn-secondary justify-start"
            onClick={() => open('sweep')}
            disabled={(gameType === 'BALL' ? !sweepValid : BigInt(draw.companyFeeAccrued.nanotons) <= 0n) || draw.status < 2}
          >
            <Coins size={17} strokeWidth={1.75} />
            {t('admin.sweep')}
          </button>
          <button type="button" className="btn btn-secondary justify-start" onClick={() => open('checkVrfTimeout')}>
            <TimerReset size={17} strokeWidth={1.75} />
            {t('admin.checkVrfTimeout')}
          </button>
          {gameType === 'BALL' ? (
            <button type="button" className="btn btn-secondary justify-start" onClick={() => open('retryRollover')}>
              <Flag size={17} strokeWidth={1.75} />
              {t('admin.retryRollover')}
            </button>
          ) : null}
          <button type="button" className="btn btn-danger justify-start" onClick={() => open('closeExpired')}>
            <ShieldAlert size={17} strokeWidth={1.75} />
            {t('admin.closeExpired')}
          </button>
        </div>
        {gameType === 'BALL' ? (
          <div className="glass-nested mt-3 flex flex-wrap items-end gap-2 p-3">
            <div className="min-w-[10rem] flex-1">
              <label className="stat-label" htmlFor="sweep-amount">
                {t('admin.sweepAmount')}
              </label>
              <input
                id="sweep-amount"
                className="input mt-1"
                inputMode="decimal"
                value={sweepTon}
                onChange={(event) => setSweepTon(event.target.value)}
              />
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSweepTon(draw.companyFeeAccrued.ton)}>
              {t('admin.sweepMax')}
            </button>
          </div>
        ) : null}
        <div className="mt-3 space-y-1.5 text-xs text-[var(--text-muted)]">
          <p>{t('admin.checkDeadlineDesc')}</p>
          <p>{t('admin.checkVrfTimeoutDesc')}</p>
          {gameType === 'BALL' ? <p>{t('admin.retryRolloverDesc')}</p> : null}
          <p>{t('admin.closeExpiredDesc')}</p>
        </div>
      </details>

      {result !== null ? (
        <div className="glass-tile mt-3 px-3 py-2 text-sm text-[var(--text-primary)]" role="status">
          {result === 'success'
            ? t('admin.success')
            : blocked
              ? BLOCKED_TRANSACTION_MESSAGE
              : t('admin.error')}
        </div>
      ) : null}

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending?.title ?? t('admin.confirmTitle')}
        closeLabel={t('common.close')}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setPending(null)} disabled={sending}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void confirm()} disabled={sending}>
              {sending ? t('admin.sending') : t('admin.confirmAction')}
            </button>
          </>
        }
      >
        <p>{pending?.description ?? t('admin.confirmBody')}</p>
        <div className="glass-nested p-3 text-xs">
          <div className="text-[var(--text-muted)]">{t('admin.confirmTitle')}</div>
          <div className="mt-1 break-all font-semibold text-[var(--text-primary)]">{pending?.title}</div>
          <div className="code mt-1 break-all text-[var(--text-secondary)]">{pending?.target}</div>
        </div>
        <p>{t('admin.infoOnly')}</p>
      </Modal>
    </div>
  );
}

