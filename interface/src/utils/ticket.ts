import { placeForWinnerIndex } from '../types/game';
import type { TicketResult } from '../types/game';

export function isExpired(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && time <= Date.now();
}

/**
 * Draw-aware ticket result.
 *
 * On-chain BALL tickets stay `ACTIVE (0)` unless the keeper actually tallied them
 * (a non-winning ticket keeps status 0 forever), so the raw ticket status must
 * never be shown on its own once sales are closed.
 */
export function computeTicketResult(
  ticketStatus: number,
  drawStatus: number | null | undefined,
  isWinner: boolean,
  expiryTimestamp?: string | null,
): TicketResult {
  if (ticketStatus === 3) return 'CLAIMED';
  if (ticketStatus === 4) return 'REFUNDED';
  if (isExpired(expiryTimestamp)) return 'EXPIRED';
  if (drawStatus === null || drawStatus === undefined) {
    return ticketStatus === 2 ? 'TALLYING' : 'ACTIVE';
  }
  switch (drawStatus) {
    case 0:
    case 1:
      return 'ACTIVE';
    case 2:
      return 'PENDING';
    case 3:
      return 'TALLYING';
    case 4:
      return isWinner ? 'WINNER' : 'NOT_WINNER';
    default:
      return 'CANCELLED';
  }
}

/** Whites/red that match the drawn result (for the side-by-side comparison). */
export function matchedBalls(
  whites: readonly number[] | null | undefined,
  red: number | null | undefined,
  winning: { whites: readonly number[]; red: number } | null | undefined,
): { matchedWhites: number[]; redMatched: boolean | null } {
  if (!winning || !whites || red === null || red === undefined) {
    return { matchedWhites: [], redMatched: null };
  }
  const set = new Set(winning.whites);
  return {
    matchedWhites: whites.filter((white) => set.has(white)),
    redMatched: red === winning.red,
  };
}

/**
 * 100K tickets do not know their place until the prize is paid. Before that,
 * the place is derived from the index in the on-chain winning ticket list.
 */
export function hundredKWinnerPlace(
  winningTickets: readonly number[] | null | undefined,
  ticketNumber: number,
): number | null {
  if (!winningTickets) return null;
  const index = winningTickets.indexOf(ticketNumber);
  return index >= 0 ? placeForWinnerIndex(index) : null;
}

export function isActiveTicket(
  drawStatus: number | null,
  ticketStatus: number,
  expiryTimestamp?: string | null,
): boolean {
  if (ticketStatus === 3 || ticketStatus === 4) return false;
  if (drawStatus === 4 || drawStatus === 5) return !isExpired(expiryTimestamp);
  if (drawStatus === null) return ticketStatus <= 2;
  return drawStatus <= 3;
}

export function isPastTicket(
  drawStatus: number | null,
  ticketStatus: number,
  expiryTimestamp?: string | null,
): boolean {
  return !isActiveTicket(drawStatus, ticketStatus, expiryTimestamp);
}

/**
 * Ticket-aware active/past split used by My Tickets.
 *
 * A ticket from a finished round is "past" unless it is still actionable:
 * CLAIM_OPEN winners (claim) and CANCELLED draws (refund) stay in "Active".
 * Everything else — including zero-winner rounds — moves to "Past" and shows
 * the real result instead of a stale on-chain `ACTIVE`.
 */
export function isActiveTicketView(ticket: {
  status: number;
  isWinner: boolean;
  draw?: { status: number | null; expiryTimestamp: string | null } | null;
}): boolean {
  const drawStatus = ticket.draw?.status ?? null;
  const expiry = ticket.draw?.expiryTimestamp ?? null;
  if (ticket.status === 3 || ticket.status === 4) return false;
  if (isExpired(expiry)) return false;
  if (drawStatus === null) return ticket.status <= 2;
  if (drawStatus <= 3) return true;
  if (drawStatus === 4) return ticket.isWinner;
  if (drawStatus === 5) return true;
  return false;
}

export function isPastTicketView(ticket: {
  status: number;
  isWinner: boolean;
  draw?: { status: number | null; expiryTimestamp: string | null } | null;
}): boolean {
  return !isActiveTicketView(ticket);
}
