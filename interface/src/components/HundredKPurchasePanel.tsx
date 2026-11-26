import { useEffect, useState } from 'react';
import { Layers, Minus, Plus, ShoppingCart, Wallet } from 'lucide-react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import type { CurrentDrawView } from '../types/api';
import type { QuotaView } from '../types/game';
import { PROTOCOL_LIMITS } from '../types/game';
import { useI18n } from '../i18n';
import { calculateCost, formatInteger, formatTonFromNano } from '../utils/format';
import { isSalesOpen } from '../utils/status';
import { buildHundredKPackMessage } from '../services/messages';
import { hundredKPackValue, remainingQuota } from '../services/ballBasket';
import { sendTransaction } from '../services/tonConnect';
import { ProgressBar } from './ui/ProgressBar';
import { cn } from '../utils/cn';

const PRESETS = [1, 5, 10, 25] as const;

export function HundredKPurchasePanel({
  draw,
  wallet,
  quota,
  onPurchased,
  onRefresh,
}: {
  draw: CurrentDrawView;
  wallet: string;
  quota: QuotaView | null;
  onPurchased: () => void;
  onRefresh: () => void;
}): JSX.Element {
  const { locale, t } = useI18n();
  const [tonConnectUI] = useTonConnectUI();
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const cost = calculateCost(draw.ticketBody?.nanotons, draw.companyFee?.nanotons, 0n);
  const hardCap = draw.hardCap ?? PROTOCOL_LIMITS.HARD_CAP_100K;
  const threshold = draw.minThreshold ?? PROTOCOL_LIMITS.MIN_THRESHOLD;
  const remaining = Math.max(0, hardCap - draw.totalTicketsSold);
  const quotaLeft = remainingQuota(quota);
  // V4 `MAX_PACK_SIZE (100)`: ONE `BuyTicketBatch` message per pack.
  const maxPackSize = draw.batch?.maxBatchSize ?? PROTOCOL_LIMITS.MAX_TICKETS_PER_WALLET;
  const maxBuyable = Math.max(0, Math.min(quotaLeft, remaining, maxPackSize));
  const quotaExhausted = quota !== null && quota.count >= quota.max;
  const salesOpen = isSalesOpen(draw.status);
  const capReached = draw.totalTicketsSold >= hardCap;
  const purchasing = status === 'sending';

  useEffect(() => {
    setQuantity((current) => Math.min(Math.max(1, current), Math.max(1, maxBuyable)));
  }, [maxBuyable]);

  const setClampedQuantity = (value: number): void => {
    if (!Number.isFinite(value)) return;
    setQuantity(Math.min(Math.max(1, Math.trunc(value)), Math.max(1, maxBuyable)));
  };

  // V4 price: N × (ticketBody + companyFee) + ONE flat 0.10 TON gas buffer.
  const flatGasBuffer = BigInt(draw.batch?.flatGasBuffer ?? '100000000');
  const breakdown = cost ? hundredKPackValue(quantity, cost.ticketBody, cost.companyFee, flatGasBuffer) : null;
  const attachValue = breakdown ? breakdown.total.toString() : null;

  const canBuy = Boolean(
    wallet &&
      attachValue &&
      salesOpen &&
      !quotaExhausted &&
      !capReached &&
      maxBuyable > 0 &&
      quantity >= 1 &&
      quantity <= maxBuyable &&
      !purchasing &&
      status !== 'success',
  );

  const buy = async (): Promise<void> => {
    if (!wallet) {
      tonConnectUI.openModal();
      return;
    }
    if (!canBuy || attachValue === null) return;
    setStatus('sending');
    try {
      // ONE single `BuyTicketBatch (0x1011)` message -> ONE Ticket100kPack.
      await sendTransaction(tonConnectUI, [
        {
          address: draw.drawAddress,
          amount: attachValue,
          payload: buildHundredKPackMessage(quantity),
        },
      ]);
      setStatus('success');
      window.setTimeout(onPurchased, 1500);
      window.setTimeout(onRefresh, 6000);
      window.setTimeout(onRefresh, 16_000);
      window.setTimeout(() => setStatus('idle'), 14_000);
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="glass p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t('hundredK.purchaseTitle')}</h2>
          <p className="mt-0.5 max-w-xl text-sm text-secondary">{t('hundredK.purchaseIntro')}</p>
        </div>
        <div className="glass-nested px-3 py-2 text-right">
          <div className="stat-label">{t('hundredK.quotaTitle')}</div>
          <div className="tabular text-sm font-semibold">{quota ? `${quota.count} / ${quota.max}` : '—'}</div>
          <div className="text-[11px] text-[var(--text-muted)]">
            {t('purchase.remainingQuota')}:{' '}
            <span className="tabular">{formatInteger(quotaLeft, locale)}</span>
          </div>
        </div>
      </div>

      {!salesOpen ? (
        <div className="glass-tile mb-3 px-3 py-2 text-sm text-[var(--text-primary)]">
          {t('hundredK.salesClosed')}
        </div>
      ) : null}
      {quotaExhausted ? (
        <div className="glass-tile mb-3 px-3 py-2 text-sm text-[var(--text-primary)]">
          {t('hundredK.quotaExhausted')}
        </div>
      ) : null}
      {capReached ? (
        <div className="glass-tile mb-3 px-3 py-2 text-sm text-[var(--text-primary)]">
          {t('hundredK.capReached')}
        </div>
      ) : null}

      <div className="glass-nested p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Layers size={16} strokeWidth={1.75} />
            {t('purchase.quantityTitle')}
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">
            {t('purchase.quantityHint')}: <span className="tabular">{formatInteger(maxBuyable, locale)}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="stepper">
            <button
              type="button"
              className="stepper-btn"
              aria-label={t('purchase.decrease')}
              disabled={purchasing || quantity <= 1}
              onClick={() => setClampedQuantity(quantity - 1)}
            >
              <Minus size={15} strokeWidth={2} />
            </button>
            <input
              className="stepper-input tabular"
              type="number"
              inputMode="numeric"
              min={1}
              max={Math.max(1, maxBuyable)}
              step={1}
              value={quantity}
              disabled={purchasing}
              aria-label={t('purchase.quantityTitle')}
              onChange={(event) => setClampedQuantity(Number.parseInt(event.target.value, 10))}
            />
            <button
              type="button"
              className="stepper-btn"
              aria-label={t('purchase.increase')}
              disabled={purchasing || quantity >= maxBuyable}
              onClick={() => setClampedQuantity(quantity + 1)}
            >
              <Plus size={15} strokeWidth={2} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={cn('btn btn-ghost btn-sm tabular', quantity === preset && 'btn-secondary')}
                disabled={purchasing || maxBuyable < preset}
                onClick={() => setClampedQuantity(preset)}
              >
                {preset}
              </button>
            ))}
            <button
              type="button"
              className={cn('btn btn-ghost btn-sm', quantity === maxBuyable && 'btn-secondary')}
              disabled={purchasing || maxBuyable <= 0}
              onClick={() => setClampedQuantity(maxBuyable)}
            >
              {t('purchase.max')}
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-[var(--text-muted)]">
          {t('purchase.ticketsLabel')}: <span className="tabular">{formatInteger(quantity, locale)}</span> ·{' '}
          {t('purchase.remainingQuota')}: <span className="tabular">{formatInteger(quotaLeft, locale)}</span>
        </p>
      </div>


      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="glass-nested p-3">
          <div className="stat-label mb-2">
            {t('hundredK.costTitle')} · {formatInteger(quantity, locale)} {t('purchase.ticketsLabel')}
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-secondary">{t('hundredK.costPool')}</span>
              <span className="tabular">
                {breakdown
                  ? `${formatTonFromNano(breakdown.ticketBodyTotal)} (${formatTonFromNano(breakdown.ticketBody)} × ${breakdown.count})`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-secondary">{t('hundredK.costFee')}</span>
              <span className="tabular">
                {breakdown
                  ? `${formatTonFromNano(breakdown.companyFeeTotal)} (${formatTonFromNano(breakdown.companyFee)} × ${breakdown.count})`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-secondary">{t('hundredK.costGas')}</span>
              <span className="tabular">
                {breakdown ? `${formatTonFromNano(breakdown.flatGas)} (${t('hundredK.costGasFlat')})` : '—'}
              </span>
            </div>
            <div className="divider my-1" />
            <div className="flex justify-between gap-2 font-semibold">
              <span>{t('hundredK.costTotal')}</span>
              <span className="tabular">
                {breakdown ? formatTonFromNano(breakdown.total) : t('errors.noPrice')}
              </span>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-[var(--text-muted)]">
            {t('hundredK.packCostNote')}
          </p>
        </div>

        <div className="glass-nested p-3">
          <div className="stat-label mb-2">{t('hundredK.soldLabel')}</div>
          <div className="mb-1 flex items-center justify-between text-xs text-secondary">
            <span className="tabular">
              {formatInteger(draw.totalTicketsSold, locale)} / {formatInteger(hardCap, locale)}
            </span>
            <span>
              {t('hundredK.remainingLabel')}: {formatInteger(remaining, locale)}
            </span>
          </div>
          <ProgressBar value={draw.totalTicketsSold} max={hardCap} />
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-[var(--text-muted)]">{t('hundredK.nextNumber')}</div>
              <div className="font-semibold tabular">
                #{Math.min(hardCap, draw.totalTicketsSold + 1).toString().padStart(6, '0')}
              </div>
            </div>
            <div>
              <div className="text-[var(--text-muted)]">{t('common.threshold')}</div>
              <div className="font-semibold tabular">{formatInteger(threshold, locale)}</div>
            </div>
          </div>
          <p className="glass-nested mt-2 px-2.5 py-1.5 text-[11px] leading-4 text-secondary">
            {t('hundredK.packSingleTxNote')}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          className={cn('btn btn-primary btn-lg btn-block sm:flex-1')}
          disabled={status === 'sending' || (Boolean(wallet) && !canBuy)}
          onClick={() => void buy()}
        >
          {wallet ? <ShoppingCart size={18} strokeWidth={1.75} /> : <Wallet size={18} strokeWidth={1.75} />}
          {status === 'sending'
            ? t('hundredK.buying')
            : !wallet
              ? t('common.connectWallet')
              : `${t('purchase.buyTickets')} ${formatInteger(quantity, locale)}`}
        </button>
        {wallet ? (
          <div className="text-center text-xs sm:text-right">
            {status === 'success' ? <span className="text-[var(--success)]">{t('tickets.pendingNote')}</span> : null}
            {status === 'error' ? <span className="text-[var(--danger)]">{t('errors.rejected')}</span> : null}
            {status === 'idle' && maxBuyable <= 0 ? (
              <span className="text-[var(--danger)]">
                {quotaExhausted ? t('hundredK.quotaExhausted') : t('hundredK.capReached')}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] leading-4 text-[var(--text-muted)]">{t('purchase.batchTooltip')}</p>
    </div>
  );
}
