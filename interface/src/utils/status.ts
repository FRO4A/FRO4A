import type { TranslationDictionary } from '../i18n';
import { DRAW_STATUS } from '../types/game';
import type { TicketResult } from '../types/game';

export type PillTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export function drawStatusKey(status: number): keyof TranslationDictionary['status'] {
  switch (status) {
    case DRAW_STATUS.WAITING_FIRST_TICKET:
      return 'waitingFirstTicket';
    case DRAW_STATUS.ACTIVE_SALES:
      return 'activeSales';
    case DRAW_STATUS.SALES_CLOSED:
      return 'salesClosed';
    case DRAW_STATUS.TALLYING:
      return 'tallying';
    case DRAW_STATUS.CLAIM_OPEN:
      return 'claimOpen';
    case DRAW_STATUS.CANCELLED:
      return 'cancelled';
    default:
      return 'unknown';
  }
}

export function drawStatusTone(status: number): PillTone {
  switch (status) {
    case DRAW_STATUS.WAITING_FIRST_TICKET:
      return 'neutral';
    case DRAW_STATUS.ACTIVE_SALES:
      return 'success';
    case DRAW_STATUS.SALES_CLOSED:
    case DRAW_STATUS.TALLYING:
      return 'warning';
    case DRAW_STATUS.CLAIM_OPEN:
      return 'accent';
    case DRAW_STATUS.CANCELLED:
      return 'danger';
    default:
      return 'neutral';
  }
}

export function ticketStatusKey(status: number): keyof TranslationDictionary['status'] {
  switch (status) {
    case 0:
      return 'ticketActive';
    case 1:
      return 'ticketPending';
    case 2:
      return 'ticketTallied';
    case 3:
      return 'ticketClaimed';
    case 4:
      return 'ticketRefunded';
    default:
      return 'unknown';
  }
}

export function ticketStatusTone(status: number): PillTone {
  switch (status) {
    case 0:
      return 'success';
    case 1:
      return 'warning';
    case 2:
      return 'accent';
    case 3:
      return 'neutral';
    case 4:
      return 'danger';
    default:
      return 'neutral';
  }
}

export function isSalesOpen(status: number | null | undefined): boolean {
  return status === DRAW_STATUS.WAITING_FIRST_TICKET || status === DRAW_STATUS.ACTIVE_SALES;
}

export function isFinalStatus(status: number | null | undefined): boolean {
  return status === DRAW_STATUS.CLAIM_OPEN || status === DRAW_STATUS.CANCELLED;
}

export function isTicketActiveStatus(status: number): boolean {
  return status === DRAW_STATUS.WAITING_FIRST_TICKET || status === DRAW_STATUS.ACTIVE_SALES;
}

const TICKET_RESULT_KEYS: Record<TicketResult, keyof TranslationDictionary['status']> = {
  ACTIVE: 'ticketActive',
  PENDING: 'ticketPending',
  TALLYING: 'ticketTallying',
  WINNER: 'ticketWinner',
  NOT_WINNER: 'ticketNotWinner',
  CLAIMED: 'ticketClaimed',
  REFUNDED: 'ticketRefunded',
  CANCELLED: 'cancelled',
  EXPIRED: 'ticketExpired',
};

const TICKET_RESULT_TONES: Record<TicketResult, PillTone> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  TALLYING: 'warning',
  WINNER: 'success',
  NOT_WINNER: 'neutral',
  CLAIMED: 'neutral',
  REFUNDED: 'danger',
  CANCELLED: 'danger',
  EXPIRED: 'neutral',
};

export function ticketResultKey(result: TicketResult): keyof TranslationDictionary['status'] {
  return TICKET_RESULT_KEYS[result];
}

export function ticketResultTone(result: TicketResult): PillTone {
  return TICKET_RESULT_TONES[result];
}
