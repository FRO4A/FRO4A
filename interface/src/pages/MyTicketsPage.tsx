import { useMemo, useState } from 'react';
import { RefreshCw, Ticket, Wallet } from 'lucide-react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import type { TicketView } from '../types/game';
import { useI18n } from '../i18n';
import { useWalletTickets } from '../hooks/useWalletTickets';
import { buildClaim, buildPackAction, buildRefund } from '../services/messages';
import { BLOCKED_TRANSACTION_MESSAGE, DrawAddressSecurityError } from '../services/drawTrust';
import { sendTransaction } from '../services/tonConnect';
import { GAS } from '../services/opcodes';
import { isActiveTicketView, isPastTicketView } from '../utils/ticket';
import { TicketCard } from '../components/TicketCard';
import { ConnectionPill } from '../components/ui/ConnectionPill';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { cn } from '../utils/cn';

type TimeFilter = 'active' | 'past';
type GameFilter = 'all' | 'BALL' | '100K';

export function MyTicketsPage(): JSX.Element {
  const { t } = useI18n();
  const wallet = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('active');
  const [gameFilter, setGameFilter] = useState<GameFilter>('all');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const tickets = useWalletTickets(wallet);

  const filtered = useMemo(() => {
    return (tickets.tickets ?? []).filter((ticket) => {
      if (gameFilter !== 'all' && ticket.gameType !== gameFilter) return false;
      return timeFilter === 'active' ? isActiveTicketView(ticket) : isPastTicketView(ticket);
    });
  }, [tickets.tickets, gameFilter, timeFilter]);

  const handleAction = async (ticket: TicketView, action: 'claim' | 'refund'): Promise<void> => {
    if (!wallet) return;
    setActionError(null);
    const key = `${ticket.ticketAddress}:${action}`;
    setPendingAction(key);
    // 100K V4: ONE `Ticket100kPack` claim/refund (0x3011 / 0x3012) for the whole
    // range; BALL stays per-Soulbound-ticket (0x3008 / 0x3009).
    const isPack = ticket.gameType === '100K' && ticket.pack !== undefined && ticket.pack !== null;
    const amount = isPack
      ? action === 'claim'
        ? GAS.PACK_CLAIM
        : GAS.PACK_REFUND
      : GAS.TICKET_ACTION;
    const payload = isPack
      ? buildPackAction(action)
      : action === 'claim'
        ? buildClaim(ticket.gameType)
        : buildRefund(ticket.gameType);
    try {
      // The ticket's draw contract is verified against the immutable factory
      // BEFORE the claim/refund prompt: a spoofed API drawAddress is blocked.
      await sendTransaction(
        tonConnectUI,
        [
          {
            address: ticket.ticketAddress,
            amount: amount.toString(),
            payload,
          },
        ],
        { gameType: ticket.gameType, roundId: ticket.roundId, drawAddress: ticket.drawAddress },
      );
      window.setTimeout(tickets.refresh, 6000);
      window.setTimeout(tickets.refresh, 15000);
      window.setTimeout(() => setPendingAction(null), 6000);
    } catch (error) {
      setActionError(
        error instanceof DrawAddressSecurityError ? BLOCKED_TRANSACTION_MESSAGE : t('errors.rejected'),
      );
      setPendingAction(null);
    }
  };

  if (!wallet) {
    return (
      <div className="space-y-4">
        <PageHeading />
        <div className="glass flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="glass-icon h-11 w-11 rounded-2xl">
              <Wallet size={21} strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-base font-semibold">{t('tickets.connectTitle')}</h2>
              <p className="mt-0.5 max-w-xl text-sm text-secondary">{t('tickets.connectBody')}</p>
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => tonConnectUI.openModal()}>
            <Wallet size={15} strokeWidth={1.75} />
            {t('common.connectWallet')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeading />

      <div className="glass flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="segmented" role="tablist" aria-label={t('tickets.title')}>
            <button
              type="button"
              className={cn('segment', timeFilter === 'active' && 'segment-active')}
              onClick={() => setTimeFilter('active')}
            >
              {t('tickets.filterActive')}
            </button>
            <button
              type="button"
              className={cn('segment', timeFilter === 'past' && 'segment-active')}
              onClick={() => setTimeFilter('past')}
            >
              {t('tickets.filterPast')}
            </button>
          </div>
          <div className="segmented" role="tablist" aria-label={t('common.allGames')}>
            {(['all', 'BALL', '100K'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={cn('segment', gameFilter === value && 'segment-active')}
                onClick={() => setGameFilter(value)}
              >
                {value === 'all' ? t('tickets.filterAll') : value}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={tickets.refresh} disabled={tickets.loading}>
          <RefreshCw size={14} strokeWidth={1.75} />
          {t('tickets.refreshTickets')}
        </button>
      </div>

      {actionError ? (
        <div className="glass-tile px-3 py-2 text-sm text-[var(--text-primary)]" role="alert">
          {actionError}
        </div>
      ) : null}

      <ConnectionPill visible={tickets.reconnecting} />

      {tickets.loading && tickets.tickets === null ? (
        <LoadingState title={t('tickets.loadingTitle')} body={t('tickets.loadingBody')} />
      ) : null}

      {tickets.error !== null && tickets.tickets === null ? (
        <ErrorState title={t('tickets.errorTitle')} body={t('tickets.errorBody')} onRetry={tickets.refresh} />
      ) : null}

      {tickets.tickets !== null && filtered.length === 0 ? (
        <EmptyState
          title={t('tickets.emptyTitle')}
          body={
            timeFilter === 'active'
              ? tickets.tickets.length === 0
                ? t('tickets.emptyBody')
                : t('tickets.noActive')
              : t('tickets.noPast')
          }
          action={
            <button type="button" className="btn btn-secondary btn-sm" onClick={tickets.refresh}>
              <RefreshCw size={14} strokeWidth={1.75} />
              {t('tickets.refreshTickets')}
            </button>
          }
        />
      ) : null}

      {filtered.length > 0 ? (
        <div className="space-y-2.5">
          {filtered.map((ticket) => (
            <TicketCard key={ticket.ticketAddress} ticket={ticket} pendingAction={pendingAction} onAction={(item, action) => void handleAction(item, action)} />
          ))}
        </div>
      ) : null}

      <div className="glass-nested flex items-start gap-2 p-3 text-[11px] leading-4 text-[var(--text-muted)]">
        <Ticket size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
        <span>{t('tickets.scanNote')}</span>
      </div>
    </div>
  );
}

function PageHeading(): JSX.Element {
  const { t } = useI18n();
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">{t('tickets.title')}</h1>
      <p className="mt-1 max-w-3xl text-sm text-secondary">{t('tickets.subtitle')}</p>
    </div>
  );
}
