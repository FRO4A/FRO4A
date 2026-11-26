import { ExternalLink, Gift, Layers, RotateCcw } from 'lucide-react';
import type { PackView, TicketView } from '../types/game';
import { DRAW_STATUS, TICKET_STATUS, type TicketResult } from '../types/game';
import { useI18n } from '../i18n';
import { formatInteger, formatTonFromNano, pad6 } from '../utils/format';
import { computeTicketResult, isExpired, matchedBalls } from '../utils/ticket';
import { BallSet, TicketNumberChip } from './ui/Ball';
import { Countdown } from './ui/Countdown';
import { DrawStatusBadge, TicketResultBadge } from './ui/StatusBadge';
import { cn } from '../utils/cn';
import { tonviewerAddressUrl } from '../config/deployments';

export function TicketCard({
  ticket,
  pendingAction,
  onAction,
}: {
  ticket: TicketView;
  pendingAction: string | null;
  onAction: (ticket: TicketView, action: 'claim' | 'refund') => void;
}): JSX.Element {
  const { locale, t } = useI18n();
  const draw = ticket.draw;
  const drawStatus = draw?.status ?? null;
  const expired = isExpired(draw?.expiryTimestamp ?? null);
  // 100K V4: ONE `Ticket100kPack` renders as a single Liquid Glass pack card.
  if (ticket.pack) {
    return (
      <PackCard
        ticket={ticket}
        pack={ticket.pack}
        drawStatus={drawStatus}
        pendingAction={pendingAction}
        onAction={onAction}
      />
    );
  }
  const isWinner = ticket.isWinner;
  // Draw-aware result: a non-winning BALL ticket keeps on-chain status ACTIVE (0),
  // so the draw status decides between TALLYING / WINNER / NOT_WINNER.
  const result: TicketResult =
    ticket.result ?? computeTicketResult(ticket.status, drawStatus, isWinner, draw?.expiryTimestamp ?? null);
  const matches =
    ticket.matchedWhites !== undefined || ticket.redMatched !== undefined
      ? { matchedWhites: ticket.matchedWhites ?? [], redMatched: ticket.redMatched ?? null }
      : matchedBalls(ticket.whites, ticket.red, draw?.winningNumbers ?? null);
  const hasResult = draw?.winningNumbers !== null && draw?.winningNumbers !== undefined;
  const winnerCount =
    draw?.winnerCount ?? draw?.categories.reduce((sum, category) => sum + category.winners, 0) ?? 0;

  const categoryBudget =
    ticket.category !== null && draw
      ? draw.categories.find((category) => category.category === ticket.category) ?? null
      : null;
  const payoutNano = ticket.payoutNano ?? categoryBudget?.payoutPerTicket.nanotons ?? null;
  const canClaim =
    drawStatus === DRAW_STATUS.CLAIM_OPEN && isWinner && ticket.status !== TICKET_STATUS.CLAIMED && !expired;
  const canRefund =
    drawStatus === DRAW_STATUS.CANCELLED && ticket.status !== TICKET_STATUS.REFUNDED && !expired;

  const actionKey = (action: 'claim' | 'refund'): string => `${ticket.ticketAddress}:${action}`;

  return (
    <div className="glass-nested p-3.5">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="pill pill-accent">{ticket.gameType}</span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {t('common.round')} #{ticket.roundId}
          </span>
          {drawStatus !== null ? <DrawStatusBadge status={drawStatus} /> : null}
          <TicketResultBadge result={result} />
        </div>
        <a
          href={tonviewerAddressUrl(ticket.ticketAddress)}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[var(--text-muted)] hover:text-[var(--accent)]"
          aria-label={t('common.viewExplorer')}
        >
          <ExternalLink size={15} strokeWidth={1.75} />
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="stat-label mb-1">{t('tickets.yourNumbers')}</div>
          {ticket.gameType === 'BALL' && ticket.whites && ticket.red !== null ? (
            <BallSet
              whites={ticket.whites}
              red={ticket.red}
              size="sm"
              matchedWhites={hasResult ? matches.matchedWhites : undefined}
              redMatched={hasResult ? matches.redMatched : undefined}
            />
          ) : (
            <TicketNumberChip number={ticket.ticketKey} />
          )}
          {ticket.gameType === 'BALL' && ticket.nftImageUrl ? (
            <img
              src={ticket.nftImageUrl}
              alt=""
              loading="lazy"
              className="mt-2 h-28 w-28 rounded-2xl border border-[var(--hairline)] object-cover"
            />
          ) : null}
          {draw?.winningNumbers ? (
            <div className="mt-2">
              <div className="stat-label mb-1">{t('tickets.winningNumbers')}</div>
              <BallSet whites={draw.winningNumbers.whites} red={draw.winningNumbers.red} size="sm" />
            </div>
          ) : null}
          {hasResult && ticket.gameType === 'BALL' ? (
            <div className="mt-1.5 text-[11px] text-[var(--text-muted)]">
              {t('tickets.matchedLabel')}:{' '}
              <span className="font-semibold tabular text-[var(--text-primary)]">
                {matches.matchedWhites.length}/5
                {matches.redMatched === true ? ` + ${t('common.redShort')}` : ''}
              </span>
            </div>
          ) : null}
          {draw?.winningTickets && draw.winningTickets.length > 0 ? (
            <div className="mt-2 text-xs text-secondary">
              {t('tickets.winningNumbers')}:{' '}
              <span className="tabular">
                {draw.winningTickets
                  .slice(0, 6)
                  .map((number) => `#${number.toString().padStart(6, '0')}`)
                  .join(' · ')}
                {draw.winningTickets.length > 6 ? ' …' : ''}
              </span>
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5 text-sm">
          {drawStatus === DRAW_STATUS.WAITING_FIRST_TICKET || drawStatus === DRAW_STATUS.ACTIVE_SALES ? (
            <p className="text-secondary">{t('tickets.waitingDraw')}</p>
          ) : null}
          {drawStatus === DRAW_STATUS.SALES_CLOSED ? (
            <>
              <p className="text-secondary">{t('tickets.drawingMessage')}</p>
              <p className="text-xs text-[var(--text-muted)]">{t('tickets.tallyNote')}</p>
            </>
          ) : null}
          {drawStatus === DRAW_STATUS.TALLYING ? (
            <>
              <p className="font-semibold text-[var(--warning)]">{t('tickets.tallyingTitle')}</p>
              <p className="text-xs text-[var(--text-muted)]">{t('tickets.tallyNote')}</p>
              {draw?.tallyDeadline ? (
                <div className="text-xs">
                  <div className="text-[var(--text-muted)]">{t('tickets.tallyCountdown')}</div>
                  <Countdown target={draw.tallyDeadline} className="font-semibold" />
                </div>
              ) : null}
            </>
          ) : null}
          {drawStatus === DRAW_STATUS.CLAIM_OPEN ? (
            <>
              <p className="text-secondary">{t('tickets.claimOpenMessage')}</p>
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-[var(--text-muted)]">{t('tickets.winnerCountLabel')}</span>
                <span className="font-semibold tabular text-[var(--text-primary)]">
                  {formatInteger(winnerCount, locale)}
                </span>
              </div>
              {winnerCount === 0 ? (
                <p className="text-xs text-[var(--warning)]">
                  {t('tickets.zeroWinners')} #{ticket.roundId + 1}
                </p>
              ) : null}
              {draw?.rolloverOutTon ? (
                <div className="flex justify-between gap-2 text-xs">
                  <span className="text-[var(--text-muted)]">{t('tickets.rolloverOutLabel')}</span>
                  <span className="font-semibold tabular text-[var(--text-primary)]">{draw.rolloverOutTon} {t('common.ton')}</span>
                </div>
              ) : null}
            </>
          ) : null}
          {drawStatus === DRAW_STATUS.CANCELLED ? <p className="text-secondary">{t('tickets.cancelledMessage')}</p> : null}
          {drawStatus === DRAW_STATUS.CANCELLED && draw?.refundTon ? (
            <div className="flex justify-between gap-2 text-xs">
              <span className="text-secondary">{t('common.refund')}</span>
              <span className="font-semibold tabular text-[var(--text-primary)]">{draw.refundTon} {t('common.ton')}</span>
            </div>
          ) : null}

          {drawStatus === DRAW_STATUS.CLAIM_OPEN ? (
            isWinner ? (
              <div className="glass p-2.5">
                <div className="flex items-center gap-1.5 text-[var(--success)]">
                  <Gift size={15} strokeWidth={1.75} />
                  <span className="text-xs font-semibold">{t('tickets.winnerLabel')}</span>
                </div>
                <div className="mt-1 flex justify-between gap-2 text-xs">
                  <span className="text-secondary">
                    {ticket.gameType === 'BALL' ? t('tickets.categoryLabel') : t('tickets.placeLabel')}{' '}
                    <span className="font-semibold text-[var(--text-primary)]">{ticket.category ?? '—'}</span>
                  </span>
                  <span className="font-semibold tabular text-[var(--text-primary)]">
                    {payoutNano ? formatTonFromNano(payoutNano) : '—'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="glass p-2.5 text-xs text-secondary">{t('tickets.nonWinnerLabel')}</div>
            )
          ) : null}

          {draw && (drawStatus === DRAW_STATUS.CLAIM_OPEN || drawStatus === DRAW_STATUS.CANCELLED) && draw.expiryTimestamp ? (
            <div className="text-xs">
              <div className="text-[var(--text-muted)]">{t('tickets.expiryTitle')}</div>
              <Countdown target={draw.expiryTimestamp} className="font-semibold" />
            </div>
          ) : null}
          {expired && (drawStatus === DRAW_STATUS.CLAIM_OPEN || drawStatus === DRAW_STATUS.CANCELLED) ? (
            <div className="text-xs text-[var(--danger)]">{t('tickets.expiryExpired')}</div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canClaim ? (
          <button
            type="button"
            className="btn btn-success btn-sm"
            disabled={pendingAction === actionKey('claim')}
            onClick={() => onAction(ticket, 'claim')}
          >
            <Gift size={15} strokeWidth={1.75} />
            {pendingAction === actionKey('claim') ? t('common.loading') : t('tickets.claimButton')}
          </button>
        ) : null}
        {canRefund ? (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={pendingAction === actionKey('refund')}
            onClick={() => onAction(ticket, 'refund')}
          >
            <RotateCcw size={15} strokeWidth={1.75} />
            {pendingAction === actionKey('refund') ? t('common.loading') : t('tickets.refundButton')}
          </button>
        ) : null}
        {ticket.status === TICKET_STATUS.CLAIMED ? <span className="pill pill-success">{t('tickets.claimedBadge')}</span> : null}
        {ticket.status === TICKET_STATUS.REFUNDED ? <span className="pill pill-danger">{t('tickets.refundedBadge')}</span> : null}
        {result === 'NOT_WINNER' ? <span className="pill pill-neutral">{t('tickets.nonWinnerLabel')}</span> : null}
        {drawStatus === DRAW_STATUS.CLAIM_OPEN || drawStatus === DRAW_STATUS.CANCELLED ? (
          <span className="ml-auto text-[10px] text-[var(--text-muted)]">{t('tickets.gasNote')}</span>
        ) : null}
      </div>

      <div className={cn('mt-2 text-[10px] leading-4 text-[var(--text-muted)]', canClaim || canRefund ? 'block' : 'hidden')}>
        {canClaim ? t('tickets.claimNote') : null} {canRefund ? t('tickets.refundNote') : null}
      </div>
    </div>
  );
}

/**
 * 100K V4 `Ticket100kPack` card.
 *
 * ONE on-chain contract for a contiguous range: the whole pack is claimed or
 * refunded in ONE transaction (`0x3011` / `0x3012`), while every individual
 * ticket number stays visible in the expandable list with its own place/prize.
 */
function PackCard({
  ticket,
  pack,
  drawStatus,
  pendingAction,
  onAction,
}: {
  ticket: TicketView;
  pack: PackView;
  drawStatus: number | null;
  pendingAction: string | null;
  onAction: (ticket: TicketView, action: 'claim' | 'refund') => void;
}): JSX.Element {
  const { locale, t } = useI18n();
  const expired = isExpired(ticket.draw?.expiryTimestamp ?? null);
  const winners = pack.tickets.filter((line) => line.isWinner);
  const isWinner = winners.length > 0;
  const canClaim =
    drawStatus === DRAW_STATUS.CLAIM_OPEN && isWinner && ticket.status !== TICKET_STATUS.CLAIMED && !expired;
  const canRefund =
    drawStatus === DRAW_STATUS.CANCELLED && ticket.status !== TICKET_STATUS.REFUNDED && !expired;

  const summary = ((): string => {
    if (ticket.status === TICKET_STATUS.CLAIMED) return t('tickets.claimedBadge');
    if (ticket.status === TICKET_STATUS.REFUNDED) return t('tickets.refundedBadge');
    if (expired && (drawStatus === DRAW_STATUS.CLAIM_OPEN || drawStatus === DRAW_STATUS.CANCELLED)) {
      return t('tickets.expiryExpired');
    }
    switch (drawStatus) {
      case DRAW_STATUS.SALES_CLOSED:
        return t('tickets.packDrawing');
      case DRAW_STATUS.TALLYING:
        return t('tickets.packTallying');
      case DRAW_STATUS.CLAIM_OPEN:
        return isWinner
          ? `${t('tickets.packWonLabel')} ${winners.length} / ${pack.count} • ${pack.totalPrizeTon ?? '0'} ${t('common.ton')}`
          : t('tickets.nonWinnerLabel');
      case DRAW_STATUS.CANCELLED:
        return t('tickets.cancelledMessage');
      default:
        return t('tickets.packActive');
    }
  })();

  const actionKey = (action: 'claim' | 'refund'): string => `${ticket.ticketAddress}:${action}`;

  return (
    <div className="glass-nested p-3.5">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="pill pill-accent">100K</span>
          <span className="pill pill-neutral">
            <Layers size={12} strokeWidth={2} />
            {t('tickets.packLabel')}
          </span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {t('common.round')} #{ticket.roundId}
          </span>
          {drawStatus !== null ? <DrawStatusBadge status={drawStatus} /> : null}
          <TicketResultBadge result={(ticket.result ?? 'ACTIVE') as TicketResult} />
        </div>
        <a
          href={tonviewerAddressUrl(pack.packAddress)}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[var(--text-muted)] hover:text-[var(--accent)]"
          aria-label={t('common.viewExplorer')}
        >
          <ExternalLink size={15} strokeWidth={1.75} />
        </a>
      </div>


      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="tabular text-base font-semibold text-[var(--text-primary)]">
          #{pad6(pack.startNumber)} – #{pad6(pack.startNumber + pack.count - 1)} •{' '}
          {formatInteger(pack.count, locale)} {t('purchase.ticketsLabel')}
        </div>
        <span
          className={cn(
            'text-sm font-semibold',
            isWinner && drawStatus === DRAW_STATUS.CLAIM_OPEN
              ? 'text-[var(--success)]'
              : 'text-[var(--text-secondary)]',
          )}
        >
          {summary}
        </span>
      </div>

      {pack.totalPrizeTon !== null ? (
        <div className="mt-1 flex justify-between gap-2 text-xs">
          <span className="text-[var(--text-muted)]">{t('tickets.packTotalPrize')}</span>
          <span className="tabular font-semibold text-[var(--text-primary)]">{pack.totalPrizeTon} {t('common.ton')}</span>
        </div>
      ) : null}

      <details className="mt-2 rounded-2xl border border-[var(--hairline)] p-2.5">
        <summary className="cursor-pointer list-none text-xs font-semibold text-[var(--text-secondary)]">
          {t('tickets.packExpand')} ({formatInteger(pack.count, locale)})
        </summary>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {pack.tickets.map((line) => (
            <li
              key={line.ticketNumber}
              className={cn(
                'glass-row flex items-center justify-between gap-2 px-2 py-1 text-xs',
                line.isWinner && 'glass-row-alert',
              )}
            >
              <span className="tabular">#{pad6(line.ticketNumber)}</span>
              {line.isWinner ? (
                <span className="flex items-center gap-1.5">
                  <span className="pill pill-success">
                    {t('tickets.placeLabel')} {line.place}
                  </span>
                  {line.prizeTon ? (
                    <span className="tabular font-semibold text-[var(--text-primary)]">{line.prizeTon} {t('common.ton')}</span>
                  ) : null}
                </span>
              ) : (
                <span className="text-[var(--text-muted)]">—</span>
              )}
            </li>
          ))}
        </ul>
      </details>

      {ticket.draw && (drawStatus === DRAW_STATUS.CLAIM_OPEN || drawStatus === DRAW_STATUS.CANCELLED) && ticket.draw.expiryTimestamp ? (
        <div className="mt-2 text-xs">
          <div className="text-[var(--text-muted)]">{t('tickets.expiryTitle')}</div>
          <Countdown target={ticket.draw.expiryTimestamp} className="font-semibold" />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canClaim ? (
          <button
            type="button"
            className="btn btn-success btn-sm"
            disabled={pendingAction === actionKey('claim')}
            onClick={() => onAction(ticket, 'claim')}
          >
            <Gift size={15} strokeWidth={1.75} />
            {pendingAction === actionKey('claim') ? t('common.loading') : t('tickets.packClaim')}
          </button>
        ) : null}
        {canRefund ? (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={pendingAction === actionKey('refund')}
            onClick={() => onAction(ticket, 'refund')}
          >
            <RotateCcw size={15} strokeWidth={1.75} />
            {pendingAction === actionKey('refund') ? t('common.loading') : t('tickets.packRefund')}
          </button>
        ) : null}
        {ticket.status === TICKET_STATUS.CLAIMED ? <span className="pill pill-success">{t('tickets.claimedBadge')}</span> : null}
        {ticket.status === TICKET_STATUS.REFUNDED ? <span className="pill pill-danger">{t('tickets.refundedBadge')}</span> : null}
      </div>

      <div className={cn('mt-2 text-[10px] leading-4 text-[var(--text-muted)]', canClaim || canRefund ? 'block' : 'hidden')}>
        {canClaim ? t('tickets.packClaimNote') : null} {canRefund ? t('tickets.packRefundNote') : null}
      </div>
    </div>
  );
}

