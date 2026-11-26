import { describe, expect, it } from 'vitest';
import {
  computeTicketResult,
  hundredKWinnerPlace,
  isActiveTicket,
  isActiveTicketView,
  isPastTicket,
  isPastTicketView,
  matchedBalls,
} from '../utils/ticket';

describe('ticket filters', () => {
  it('keeps claimable and refundable tickets in Active until expiry', () => {
    expect(isActiveTicket(4, 0, '2099-01-01T00:00:00.000Z')).toBe(true);
    expect(isActiveTicket(5, 0, '2099-01-01T00:00:00.000Z')).toBe(true);
    expect(isActiveTicket(4, 0, '2000-01-01T00:00:00.000Z')).toBe(false);
    expect(isActiveTicket(3, 1)).toBe(true);
    expect(isActiveTicket(1, 0)).toBe(true);
    expect(isActiveTicket(4, 3)).toBe(false);
    expect(isPastTicket(4, 4)).toBe(true);
  });
});

describe('100K winner derivation before payout', () => {
  const winningTickets = Array.from({ length: 100 }, (_, index) => (index + 1) * 10);

  it('derives the exact place from the winning ticket index', () => {
    expect(hundredKWinnerPlace(winningTickets, 10)).toBe(1);
    expect(hundredKWinnerPlace(winningTickets, 20)).toBe(2);
    expect(hundredKWinnerPlace(winningTickets, 50)).toBe(2);
    expect(hundredKWinnerPlace(winningTickets, 60)).toBe(3);
    expect(hundredKWinnerPlace(winningTickets, 300)).toBe(4);
    expect(hundredKWinnerPlace(winningTickets, 500)).toBe(5);
    expect(hundredKWinnerPlace(winningTickets, 1000)).toBe(6);
  });

  it('returns null for non-winners and missing data', () => {
    expect(hundredKWinnerPlace(winningTickets, 11)).toBeNull();
    expect(hundredKWinnerPlace(null, 10)).toBeNull();
    expect(hundredKWinnerPlace([], 10)).toBeNull();
  });
});

describe('draw-aware ticket result (TASK 2)', () => {
  it('never reports a TALLYING or finished non-winning ticket as ACTIVE', () => {
    expect(computeTicketResult(0, 3, false, '2099-01-01T00:00:00.000Z')).toBe('TALLYING');
    expect(computeTicketResult(0, 4, false, '2099-01-01T00:00:00.000Z')).toBe('NOT_WINNER');
    expect(computeTicketResult(0, 4, true, '2099-01-01T00:00:00.000Z')).toBe('WINNER');
    expect(computeTicketResult(0, 5, false, '2099-01-01T00:00:00.000Z')).toBe('CANCELLED');
    expect(computeTicketResult(0, 1, false, null)).toBe('ACTIVE');
    expect(computeTicketResult(0, 2, false, null)).toBe('PENDING');
    expect(computeTicketResult(3, 4, true, null)).toBe('CLAIMED');
    expect(computeTicketResult(4, 5, false, null)).toBe('REFUNDED');
    expect(computeTicketResult(0, 4, false, '2000-01-01T00:00:00.000Z')).toBe('EXPIRED');
  });

  it('highlights matching whites and the red ball', () => {
    const winning = { whites: [3, 6, 9, 10, 47], red: 21 };
    expect(matchedBalls([3, 12, 9, 44, 51], 21, winning)).toEqual({ matchedWhites: [3, 9], redMatched: true });
    expect(matchedBalls([7, 8, 9, 10, 11], 12, winning)).toEqual({ matchedWhites: [9, 10], redMatched: false });
    expect(matchedBalls([1, 2, 3, 4, 5], 6, null)).toEqual({ matchedWhites: [], redMatched: null });
  });

  it('moves finished non-winning tickets from Active to Past', () => {
    const finishedLoser = {
      status: 0,
      isWinner: false,
      draw: { status: 4, expiryTimestamp: '2099-01-01T00:00:00.000Z' },
    };
    const finishedWinner = {
      status: 0,
      isWinner: true,
      draw: { status: 4, expiryTimestamp: '2099-01-01T00:00:00.000Z' },
    };
    const tallying = { status: 0, isWinner: false, draw: { status: 3, expiryTimestamp: null } };
    expect(isActiveTicketView(finishedLoser)).toBe(false);
    expect(isPastTicketView(finishedLoser)).toBe(true);
    expect(isActiveTicketView(finishedWinner)).toBe(true);
    expect(isActiveTicketView(tallying)).toBe(true);
  });
});

