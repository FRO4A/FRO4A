export type GameType = 'BALL' | '100K';

export type GameSlug = 'ball' | '100k';

export type AppRoute = 'overview' | 'games' | 'ball' | '100k' | 'tickets' | 'verify';

export type UserRole = 'GUEST' | 'BUYER' | 'ADMIN' | 'TREASURY';

/** Unified draw status codes (protocol-standard.md §2). */
export const DRAW_STATUS = {
  WAITING_FIRST_TICKET: 0,
  ACTIVE_SALES: 1,
  SALES_CLOSED: 2,
  TALLYING: 3,
  CLAIM_OPEN: 4,
  CANCELLED: 5,
} as const;

/** Unified TicketSBT status codes (protocol-standard.md §3). */
export const TICKET_STATUS = {
  ACTIVE: 0,
  PENDING: 1,
  TALLIED: 2,
  CLAIMED: 3,
  REFUNDED: 4,
} as const;

export const PROTOCOL_LIMITS = {
  MIN_THRESHOLD: 10_000,
  HARD_CAP_100K: 100_000,
  MAX_TICKETS_PER_WALLET: 100,
} as const;

export const PROTOCOL_TIMING = {
  SALE_PERIOD: 2_592_000,
  TALLY_WINDOW: 7_200,
  VRF_DELAY: 30,
  VRF_TIMEOUT: 86_400,
  CLAIM_EXPIRY: 5_184_000,
} as const;

export interface BallCategoryDefinition {
  category: number;
  sharePercent: number;
  rollover: boolean;
}

/** BALL payout matrix — category -> share of prizeFund (SPEC_BALL §2). */
export const BALL_CATEGORIES: readonly BallCategoryDefinition[] = [
  { category: 1, sharePercent: 15, rollover: false },
  { category: 2, sharePercent: 14, rollover: false },
  { category: 3, sharePercent: 10, rollover: false },
  { category: 4, sharePercent: 9, rollover: false },
  { category: 5, sharePercent: 9, rollover: false },
  { category: 6, sharePercent: 9, rollover: false },
  { category: 7, sharePercent: 9, rollover: false },
  { category: 8, sharePercent: 25, rollover: true },
] as const;

export interface PlaceDefinition {
  place: number;
  sharePercent: number;
  winnersCount: number;
}

/** 100K payout matrix — place -> share of prizeFund and winner count (SPEC_100K §3). */
export const PLACES: readonly PlaceDefinition[] = [
  { place: 1, sharePercent: 20, winnersCount: 1 },
  { place: 2, sharePercent: 20, winnersCount: 4 },
  { place: 3, sharePercent: 15, winnersCount: 10 },
  { place: 4, sharePercent: 13, winnersCount: 15 },
  { place: 5, sharePercent: 12, winnersCount: 20 },
  { place: 6, sharePercent: 20, winnersCount: 50 },
] as const;

export function placeForWinnerIndex(index: number): number {
  if (index <= 0) return 1;
  if (index <= 4) return 2;
  if (index <= 14) return 3;
  if (index <= 29) return 4;
  if (index <= 49) return 5;
  return 6;
}

export interface KnownDraw {
  gameType: GameType;
  roundId: number;
  drawAddress: string;
  status: number | null;
  expiryTimestamp: string | null;
  deadlineTimestamp: string | null;
  tallyDeadline?: string | null;
  claimDeadline?: string | null;
  totalTicketsSold: number;
  ticketPriceTon: string | null;
  refundTon: string | null;
  winningNumbers: { whites: number[]; red: number } | null;
  winningTickets: number[] | null;
  categories: import('./api').CategoryBudgetView[];
  winnerCount?: number;
  rolloverInTon?: string | null;
  rolloverOutTon?: string | null;
  tonviewerUrl: string | null;
}

/** Draw-aware ticket outcome (mirrors `ChainTicketResult` of the server API). */
export type TicketResult =
  | 'ACTIVE'
  | 'PENDING'
  | 'TALLYING'
  | 'WINNER'
  | 'NOT_WINNER'
  | 'CLAIMED'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'EXPIRED';

/** One individual ticket number inside a 100K `Ticket100kPack`. */
export interface PackTicketLine {
  ticketNumber: number;
  isWinner: boolean;
  place: number | null;
  prizeTon: string | null;
}

/** 100K V4 `Ticket100kPack` attached to a `TicketView` (one on-chain contract). */
export interface PackView {
  packAddress: string;
  startNumber: number;
  count: number;
  /** `#000001 – #000010 • 10 tickets` */
  displayValue: string;
  tickets: PackTicketLine[];
  totalPrizeTon: string | null;
  claimDeadline: string | null;
}

export interface OnChainTicket {
  gameType: GameType;
  ticketAddress: string;
  drawAddress: string;
  roundId: number;
  /** BALL: packed combination (decimal). 100K: ticket number (decimal). */
  ticketKey: string;
  displayValue: string;
  whites: number[] | null;
  red: number | null;
  status: number;
  category: number | null;
  place: number | null;
  payoutNano: string | null;
  name: string | null;
  /** Draw-aware result computed by the server mirror or client-side comparison. */
  result?: TicketResult;
  drawStatus?: number | null;
  /** Whites of this ticket matching the drawn winning whites. */
  matchedWhites?: number[];
  redMatched?: boolean | null;
  /** BALL TEP-64 image path (`/api/nft/ball/<roundId>/<packed>.png`). */
  nftImageUrl?: string | null;
  /** 100K V4 pack (present instead of per-ticket contracts). */
  pack?: PackView | null;
}

export interface TicketView extends OnChainTicket {
  draw: KnownDraw | null;
  isWinner: boolean;
}

export interface QuotaView {
  count: number;
  max: number;
  address: string | null;
}
