import { useMemo, useState } from 'react';
import type { Cell } from '@ton/core';
import {
  CircleCheck,
  CircleDashed,
  Dices,
  LoaderCircle,
  Plus,
  ShoppingBasket,
  ShoppingCart,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import type { CurrentDrawView, TakenCombinationsResponse } from '../types/api';
import type { QuotaView } from '../types/game';
import { useI18n } from '../i18n';
import { fetchTakenCombinations } from '../services/api';
import { calculateCost, formatInteger, formatTonFromNano } from '../utils/format';
import { isSalesOpen } from '../utils/status';
import { GAS } from '../services/opcodes';
import { buildBallBatchMessages } from '../services/messages';
import { decideSelectionStatus } from '../services/ballAvailability';
import {
  ballBatchValue,
  canAddToBasket,
  packCombination,
  pickUniqueCombinations,
  pushBasketItem,
  remainingQuota,
  removeBasketItem,
  toBasketItem,
  validateBasketAvailability,
  type AvailabilityState,
  type BallBasketItem,
} from '../services/ballBasket';
import { V4_LIMITS } from '../services/opcodes';
import {
  chunkMessages,
  maxMessagesForWallet,
  sendBatchedTransactions,
  type BatchProgress,
} from '../services/tonTransactions';
import { TicketPicker, type BallSelection } from './TicketPicker';
import { ProgressBar } from './ui/ProgressBar';
import { Ball } from './ui/Ball';
import { cn } from '../utils/cn';

type Notice = 'reverify' | 'duplicate' | 'quota' | 'unknown' | null;

function AvailabilityPill({ state }: { state: AvailabilityState }): JSX.Element | null {
  const { t } = useI18n();
  if (state === 'idle') return null;
  if (state === 'checking') {
    return (
      <span className="pill pill-neutral">
        <LoaderCircle size={12} className="animate-spin" strokeWidth={2} />
        {t('purchase.availabilityChecking')}
      </span>
    );
  }
  if (state === 'available') {
    return (
      <span className="pill pill-success">
        <CircleCheck size={12} strokeWidth={2} />
        {t('purchase.availabilityFree')}
      </span>
    );
  }
  if (state === 'taken') {
    return (
      <span className="pill pill-danger">
        <X size={12} strokeWidth={2} />
        {t('purchase.availabilityTaken')}
      </span>
    );
  }
  return (
    <span className="pill pill-warning">
      <CircleDashed size={12} strokeWidth={2} />
      {t('purchase.availabilityUnknown')}
    </span>
  );
}

export function BallPurchasePanel({
  draw,
  wallet,
  quota,
  taken,
  onPurchased,
  onRefresh,
}: {
  draw: CurrentDrawView;
  wallet: string;
  quota: QuotaView | null;
  taken: TakenCombinationsResponse | null;
  onPurchased: () => void;
  onRefresh: () => void;
}): JSX.Element {
  const { locale, t } = useI18n();
  const [tonConnectUI] = useTonConnectUI();
  const walletInfo = useTonWallet();
  const [selection, setSelection] = useState<BallSelection>({ whites: [], red: null });
  const [basket, setBasket] = useState<BallBasketItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [takenOverride, setTakenOverride] = useState<Set<string>>(new Set());
  const [guarding, setGuarding] = useState(false);

  const takenPacked = useMemo(
    () =>
      new Set([
        ...(taken?.combinations ?? []).map((combination) => combination.packed),
        ...takenOverride,
      ]),
    [taken, takenOverride],
  );
  const basketPacked = useMemo(() => new Set(basket.map((item) => item.packed)), [basket]);
  const blockedPacked = useMemo(
    () => new Set([...takenPacked, ...basketPacked]),
    [takenPacked, basketPacked],
  );

  const complete = selection.whites.length === 5 && selection.red !== null;
  const packed = complete ? packCombination(selection.whites, selection.red as number) : null;
  const quotaLeft = remainingQuota(quota);
  const salesOpen = isSalesOpen(draw.status);
  const cost = calculateCost(draw.ticketBody?.nanotons, draw.companyFee?.nanotons, GAS.BUY_GAS_BUFFER);
  const minBuyValue = draw.minBuyValue?.nanotons ?? cost?.minBuyValue.toString() ?? null;
  const quotaExhausted = quota !== null && quota.count >= quota.max;

  // 0 ms check against the live server Set + local basket. No TonAPI round-trip.
  const selectionStatus: AvailabilityState = decideSelectionStatus({
    complete,
    inBasket: packed !== null && basketPacked.has(packed),
    serverTaken: packed !== null && takenPacked.has(packed),
  });

  const addDecision = canAddToBasket({
    selectionComplete: complete,
    salesOpen,
    remainingQuota: quotaLeft,
    basketSize: basket.length,
    packed,
    serverTaken: takenPacked,
    basketPacked,
    availability: selectionStatus,
  });

  const basketValidation = useMemo(
    () => validateBasketAvailability(basket, takenPacked),
    [basket, takenPacked],
  );

  const directItem = useMemo(() => {
    if (basket.length > 0 || !complete || selection.red === null) return null;
    if (selectionStatus !== 'available') return null;
    return toBasketItem({ whites: selection.whites, red: selection.red });
  }, [basket.length, complete, selection.whites, selection.red, selectionStatus]);

  const entries = basket.length > 0 ? basket : directItem !== null ? [directItem] : [];
  const ticketCount = entries.length;
  // V4 `BuyTicketBatch (0x1011)`: up to 12 combinations per contract message.
  const contractMessageCount = Math.max(1, Math.ceil(ticketCount / V4_LIMITS.MAX_BALL_BATCH));
  const flatGas = BigInt(draw.batch?.flatGasBuffer ?? GAS.BALL_BATCH_BASE_GAS.toString());
  const mintValue = BigInt(draw.batch?.mintValuePerTicket ?? GAS.BALL_MINT_VALUE.toString());
  const perBatchCount = Math.min(ticketCount, V4_LIMITS.MAX_BALL_BATCH);
  const breakdown = cost
    ? ballBatchValue(perBatchCount, cost.ticketBody, cost.companyFee, { flatGas, mintValue })
    : null;
  const maxMessages = maxMessagesForWallet(walletInfo);

  const purchasing = status === 'sending';
  const canBuy = Boolean(
    wallet &&
      salesOpen &&
      !quotaExhausted &&
      !purchasing &&
      !guarding &&
      status !== 'success' &&
      minBuyValue &&
      ticketCount > 0 &&
      ticketCount <= quotaLeft &&
      (basket.length === 0 ? selectionStatus === 'available' : basketValidation.ok),
  );


  /**
   * One fast silent refresh right before opening the wallet. This is the only
   * network call in the purchase flow (single request, <50ms): it guards against
   * a last-second race where another buyer minted the same combination.
   */
  const refreshTakenSet = async (): Promise<Set<string> | null> => {
    try {
      const response = await fetchTakenCombinations(draw.roundId);
      return new Set(response.combinations.map((combination) => combination.packed));
    } catch {
      return null;
    }
  };

  const addSelection = (): void => {
    if (!packed || selection.red === null) return;
    if (!addDecision.ok) {
      if (addDecision.blocker === 'quota') setNotice('quota');
      else if (
        addDecision.blocker === 'taken-server' ||
        addDecision.blocker === 'taken-chain' ||
        addDecision.blocker === 'basket-duplicate'
      ) {
        setNotice('duplicate');
      } else if (addDecision.blocker === 'unknown') setNotice('unknown');
      else setNotice('reverify');
      return;
    }
    const item = toBasketItem({ whites: selection.whites, red: selection.red });
    setBasket((previous) => pushBasketItem(previous, item));
    setSelection({ whites: [], red: null });
    setNotice(null);
  };

  /** Instant local quick pick: the server Set already knows every taken combination. */
  const quickPick = (count: number): void => {
    const room = quotaLeft - basket.length;
    const target = Math.max(0, Math.min(count, room));
    if (!salesOpen) return;
    if (target === 0) {
      setNotice('quota');
      return;
    }
    const excluded = new Set<string>([...takenPacked, ...basketPacked]);
    if (packed !== null) excluded.add(packed);
    const picked = pickUniqueCombinations(target, excluded, Math.random, 8_000);
    if (picked.length === 0) {
      setNotice('duplicate');
      return;
    }
    setBasket((previous) => {
      let next = previous;
      for (const item of picked) next = pushBasketItem(next, item);
      return next;
    });
    setNotice(null);
  };


  const buy = async (): Promise<void> => {
    if (!wallet) {
      tonConnectUI.openModal();
      return;
    }
    if (!minBuyValue || !cost || ticketCount === 0) return;
    if (!canBuy) {
      setNotice(basket.length > 0 && !basketValidation.ok ? 'reverify' : quotaLeft <= 0 ? 'quota' : 'duplicate');
      return;
    }
    setStatus('sending');
    setNotice(null);
    setProgress(null);
    setGuarding(true);
    try {
      // Last-second race guard: one fast server refresh (<50ms), never TonAPI.
      const latest = await refreshTakenSet();
      if (latest !== null) {
        const guarded = new Set([...takenPacked, ...latest]);
        if (!validateBasketAvailability(entries, guarded).ok) {
          setTakenOverride(guarded);
          setStatus('error');
          setNotice('duplicate');
          onRefresh();
          return;
        }
      }

      const packedList = entries.map((item) => BigInt(item.packed));
      // Chunk the basket into `MAX_BALL_BATCH (12)` combinations per message and
      // attach the exact V4 value to each: count × (body + fee) + 0.08 flat +
      // count × 0.06 mint funding (excess mint gas is refunded on-chain).
      const contractMessages: { address: string; amount: string; payload: Cell }[] = [];
      for (let offset = 0; offset < packedList.length; offset += V4_LIMITS.MAX_BALL_BATCH) {
        const chunk = packedList.slice(offset, offset + V4_LIMITS.MAX_BALL_BATCH);
        const value = ballBatchValue(chunk.length, cost.ticketBody, cost.companyFee, { flatGas, mintValue });
        contractMessages.push({
          address: draw.drawAddress,
          amount: value.total.toString(),
          payload: buildBallBatchMessages(chunk)[0],
        });
      }
      await sendBatchedTransactions(tonConnectUI, chunkMessages(contractMessages, maxMessages), (value) =>
        setProgress(value),
      );

      setStatus('success');
      setBasket([]);
      setSelection({ whites: [], red: null });
      setProgress(null);
      window.setTimeout(onPurchased, 1500);
      window.setTimeout(onRefresh, 6000);
      window.setTimeout(onRefresh, 16_000);
      window.setTimeout(() => setStatus('idle'), 14_000);
    } catch {
      setStatus('error');
      setProgress(null);
    } finally {
      setGuarding(false);
    }
  };


  return (
    <div className="glass p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t('ball.pickerTitle')}</h2>
          <p className="mt-0.5 max-w-xl text-sm text-secondary">{t('ball.pickerIntro')}</p>
        </div>
        <div className="glass-nested px-3 py-2 text-right">
          <div className="stat-label">{t('ball.quotaTitle')}</div>
          <div className="tabular text-sm font-semibold">
            {quota ? `${quota.count} / ${quota.max}` : '—'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            {t('purchase.remainingQuota')}:{' '}
            <span className="tabular">{formatInteger(quotaLeft, locale)}</span>
          </div>
        </div>
      </div>

      {!salesOpen ? (
        <div className="glass-tile mb-3 px-3 py-2 text-sm text-[var(--text-primary)]">
          {t('ball.salesClosed')}
        </div>
      ) : null}
      {quotaExhausted ? (
        <div className="glass-tile mb-3 px-3 py-2 text-sm text-[var(--text-primary)]">
          {t('ball.quotaExhausted')}
        </div>
      ) : null}
      {notice !== null ? (
        <div className="glass-tile mb-3 px-3 py-2 text-sm text-[var(--text-primary)]" role="alert">
          {notice === 'duplicate'
            ? t('purchase.availabilityTaken')
            : notice === 'quota'
              ? t('purchase.basketQuotaExceeded')
              : notice === 'unknown'
                ? t('purchase.availabilityUnknown')
                : t('purchase.basketReverify')}
        </div>
      ) : null}

      <TicketPicker
        value={selection}
        onChange={setSelection}
        takenPacked={blockedPacked}
        disabled={!salesOpen || quotaExhausted || purchasing}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <AvailabilityPill state={selectionStatus} />
          {packed !== null && takenPacked.has(packed) ? (
            <span className="text-[11px] text-[var(--text-muted)]">{t('purchase.lockedHint')}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!addDecision.ok || purchasing}
            onClick={addSelection}
          >
            <Plus size={15} strokeWidth={1.75} />
            {t('purchase.addCombination')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!salesOpen || quotaExhausted || purchasing || quotaLeft - basket.length <= 0}
            onClick={() => quickPick(1)}
          >
            <Dices size={15} strokeWidth={1.75} />
            {t('purchase.quickPickOne')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!salesOpen || quotaExhausted || purchasing || quotaLeft - basket.length <= 0}
            onClick={() => quickPick(5)}
          >
            <Dices size={15} strokeWidth={1.75} />
            {t('purchase.quickPickFive')}
          </button>
        </div>
      </div>


      <div className="glass-nested mt-4 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <ShoppingBasket size={16} strokeWidth={1.75} />
            {t('purchase.basketTitle')}
            <span className="pill pill-neutral tabular">{basket.length}</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={basket.length === 0 || purchasing}
            onClick={() => {
              setBasket([]);
              setNotice(null);
            }}
          >
            <Trash2 size={14} strokeWidth={1.75} />
            {t('purchase.clearBasket')}
          </button>
        </div>

        {basket.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">{t('purchase.basketEmpty')}</p>
        ) : (
          <ul className="space-y-1.5">
            {basket.map((item, index) => {
              const state: AvailabilityState = takenPacked.has(item.packed) ? 'taken' : 'available';
              return (
                <li
                  key={item.packed}
                  className={cn(
                    'glass-row flex flex-wrap items-center justify-between gap-2 px-2.5 py-2',
                    state !== 'available' && 'glass-row-alert',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="tabular text-[11px] text-[var(--text-muted)]">
                      {index + 1}.
                    </span>
                    {item.whites.map((white) => (
                      <Ball key={`${item.packed}-${white}`} value={white} size="sm" />
                    ))}
                    <Ball value={item.red} red size="sm" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <AvailabilityPill state={state} />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-label={t('purchase.remove')}
                      disabled={purchasing}
                      onClick={() => {
                        setBasket((previous) => removeBasketItem(previous, item.packed));
                      }}
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-[11px] leading-4 text-[var(--text-muted)]">
          {basket.length > 0 && !basketValidation.ok
            ? t('purchase.basketInvalid')
            : t('purchase.basketValid')}
        </p>
      </div>


      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="glass-nested p-3">
          <div className="stat-label mb-2">
            {t('ball.costTitle')} · {formatInteger(ticketCount, locale)} {t('purchase.ticketsLabel')}
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-secondary">{t('ball.costPool')}</span>
              <span className="tabular">
                {breakdown
                  ? `${formatTonFromNano(breakdown.ticketBodyTotal)} (${formatTonFromNano(breakdown.ticketBody)} × ${breakdown.count})`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-secondary">{t('ball.costFee')}</span>
              <span className="tabular">
                {breakdown
                  ? `${formatTonFromNano(breakdown.companyFeeTotal)} (${formatTonFromNano(breakdown.companyFee)} × ${breakdown.count})`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-secondary">{t('ball.costGas')}</span>
              <span className="tabular">
                {breakdown ? `${formatTonFromNano(breakdown.flatGas)} (${t('ball.costGasFlat')})` : '—'}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-secondary">{t('ball.costMint')}</span>
              <span className="tabular">
                {breakdown
                  ? `${formatTonFromNano(breakdown.mintTotal)} (${formatTonFromNano(mintValue)} × ${breakdown.count})`
                  : '—'}
              </span>
            </div>
            <div className="divider my-1" />
            <div className="flex justify-between gap-2 font-semibold">
              <span>{t('ball.costTotal')}</span>
              <span className="tabular">
                {breakdown
                  ? `${formatTonFromNano(breakdown.total)}${contractMessageCount > 1 ? ` × ${contractMessageCount}` : ''}`
                  : t('errors.noPrice')}
              </span>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-[var(--text-muted)]">
            {t('ball.batchV4Note')}
          </p>
        </div>

        <div className="glass-nested p-3">
          <div className="stat-label mb-2">{t('common.progress')}</div>
          <div className="mb-1 flex items-center justify-between text-xs text-secondary">
            <span>
              {formatInteger(draw.totalTicketsSold, locale)} / {formatInteger(draw.minThreshold ?? 10_000, locale)}
            </span>
            <span>{t('common.threshold')}</span>
          </div>
          <ProgressBar value={draw.totalTicketsSold} max={draw.minThreshold ?? 10_000} tone="success" />
          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-secondary">{t('common.ticketsSold')}</span>
              <span className="tabular">{formatInteger(taken?.count ?? draw.totalTicketsSold, locale)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-secondary">{t('common.ticketPrice')}</span>
              <span className="tabular">{draw.ticketPrice ? `${draw.ticketPrice.ton} ${t('common.ton')}` : '—'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-secondary">{t('purchase.remainingQuota')}</span>
              <span className="tabular">{formatInteger(quotaLeft, locale)}</span>
            </div>
          </div>
          {contractMessageCount > 1 ? (
            <p className="glass-nested mt-2 px-2.5 py-1.5 text-[11px] leading-4 text-secondary">
              {t('purchase.batchNote')}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          className={cn('btn btn-primary btn-lg btn-block sm:flex-1', !wallet && 'opacity-100')}
          disabled={status === 'sending' || (Boolean(wallet) && !canBuy)}
          onClick={() => void buy()}
        >
          {wallet ? <ShoppingCart size={18} strokeWidth={1.75} /> : <Wallet size={18} strokeWidth={1.75} />}
          {status === 'sending'
            ? progress !== null
              ? `${t('purchase.batchProgress')} ${progress.batch} ${t('purchase.batchOf')} ${progress.total}`
              : t('ball.buying')
            : !wallet
              ? t('common.connectWallet')
              : ticketCount === 0
                ? t('ball.pickerFirst')
                : `${t('purchase.buyTickets')} ${formatInteger(ticketCount, locale)}`}
        </button>
        {wallet ? (
          <div className="text-center text-xs sm:text-right">
            {status === 'success' ? <span className="text-[var(--success)]">{t('tickets.pendingNote')}</span> : null}
            {status === 'error' ? <span className="text-[var(--danger)]">{t('errors.rejected')}</span> : null}
            {status === 'idle' && progress === null && ticketCount > 0 && !canBuy ? (
              <span className="text-[var(--danger)]">{t('purchase.availabilityTaken')}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] leading-4 text-[var(--text-muted)]">{t('ball.noLockNote')}</p>
    </div>
  );
}
