import { useCallback, useEffect, useRef, useState } from 'react';
import type { TicketView } from '../types/game';
import { fetchChainTickets } from '../services/api';
import { discoverUserTickets, loadKnownDraws, packViewFromChain, ticketViewFromChain } from '../services/tonChain';
import { ACTIVE_DEPLOYMENTS } from '../config/deployments';

const FAST_POLL_MS = 3_000;
const FALLBACK_INTERVAL_MS = 20_000;

export interface WalletTicketsState {
  tickets: TicketView[] | null;
  loading: boolean;
  error: Error | null;
  reconnecting: boolean;
  refresh: () => void;
}

/**
 * Instant "My Tickets" from the server's read-only public mirror.
 *
 * The direct TonAPI client-side discovery is kept ONLY as an automatic fallback
 * when `/api/chain/tickets` is unreachable. Polling every 3s makes freshly
 * minted tickets and CLAIMED/REFUNDED statuses appear without a manual refresh.
 */
export function useWalletTickets(wallet: string | null | undefined): WalletTicketsState {
  const [tickets, setTickets] = useState<TicketView[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [nonce, setNonce] = useState(0);
  const dataRef = useRef<TicketView[] | null>(null);
  dataRef.current = tickets;
  const lastFallbackRef = useRef(0);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!wallet) {
      setTickets([]);
      setError(null);
      setReconnecting(false);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(dataRef.current === null);

    const runFallback = async (): Promise<void> => {
      const now = Date.now();
      if (now - lastFallbackRef.current < FALLBACK_INTERVAL_MS) return;
      lastFallbackRef.current = now;
      try {
        const draws = await loadKnownDraws(ACTIVE_DEPLOYMENTS, controller.signal);
        const discovered = await discoverUserTickets(wallet, draws, controller.signal);
        if (!active || controller.signal.aborted) return;
        setTickets(discovered);
        setError(null);
        setReconnecting(false);
      } catch {
        // keep the last good list (or the empty skeleton)
      }
    };

    const tick = async (): Promise<void> => {
      try {
        const response = await fetchChainTickets(wallet, controller.signal);
        if (!active) return;
        setTickets([
          ...response.tickets.map((ticket) => ticketViewFromChain(ticket, response.draws)),
          // 100K V4: ONE `Ticket100kPack` row per range, every number expanded.
          ...(response.packs ?? []).map((pack) => packViewFromChain(pack, response.draws)),
        ]);
        setError(null);
        setReconnecting(false);
      } catch (cause) {
        if (!active || controller.signal.aborted) return;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        if (dataRef.current !== null) setReconnecting(true);
        await runFallback();
      } finally {
        if (active) setLoading(false);
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), FAST_POLL_MS);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [wallet, nonce]);

  return { tickets, loading, error, reconnecting, refresh };
}