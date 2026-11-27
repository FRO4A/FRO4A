/** Exact response DTOs of the anonymous FRO4A read-only API (server/src/api). */

export type GameSlug = 'ball' | '100k';

export interface AmountView {
  nanotons: string;
  ton: string;
}

export interface CategoryBudgetView {
  type: 'CATEGORY' | 'PLACE';
  category: number;
  condition: string;
  sharePercent: number;
  pool: AmountView;
  poolTotal: AmountView;
  winners: number;
  winnersClaimed: number;
  claims: number;
  payoutPerTicket: AmountView;
  estimatedPayoutPerTicket: AmountView | null;
  isFinal: boolean;
  rolloverIncluded: AmountView | null;
}

export type ApiDrawStatus = 'ACTIVE' | 'DRAWING' | 'DRAWN' | 'CANCELLED';

export interface VrfProofView {
  payloadHex: string | null;
  signatureHex: string | null;
  publicKey: string | null;
  /** First 256 bits of the ed25519 signature — the on-chain seed. */
  seedHex: string | null;
  closingMarker: string | null;
  targetVrfTime: string | null;
}

/** Per-category winner counters (0 winners is a valid, visible result). */
export interface CategoryWinnerView {
  category: number;
  condition: string;
  winners: number;
  winnersClaimed: number;
  payoutPerTicket: AmountView;
}

export interface RolloverView {
  rolloverIn: AmountView;
  rolloverOut: AmountView | null;
  rolloverOwed: AmountView;
}

export interface WinningNumbersView {
  whites: number[];
  red: number;
  display: string;
}

export interface HundredKWinnerView {
  ticketNumber: number;
  place: number;
  payout: string;
}

export interface DrawBaseView {
  gameType: 'BALL' | '100K';
  game: GameSlug;
  roundId: number;
  /** `null` at runtime for the zero-round `pending/waiting` payload. */
  drawAddress: string;
  /** Zero-round startup: the Admin has not launched Round #1 yet (HTTP 200). */
  pending?: boolean;
  /** Explicit alias of `pending` used by the UI waiting state. */
  waiting?: boolean;
  adminAddress: string | null;
  treasuryAddress: string | null;
  status: number;
  statusLabel: string;
  drawStatus: ApiDrawStatus;
  isLive: boolean;
  isArchived: boolean;
  totalTicketsSold: number;
  prizeFund: AmountView;
  rolloverJackpot: AmountView;
  totalBudget: AmountView;
  companyFeeAccrued: AmountView;
  /** V4: fee already paid automatically at settlement / cancellation. */
  companyFeeSwept: AmountView;
  rolloverOwed: AmountView;
  ticketPrice: AmountView | null;
  ticketBody: AmountView | null;
  companyFee: AmountView | null;
  minBuyValue: AmountView | null;
  minStorageReserve: AmountView | null;
  refundValue: AmountView | null;
  minThreshold: number | null;
  hardCap: number | null;
  maxTicketsPerWallet: number;
  firstTicketTimestamp: string | null;
  deadlineTimestamp: string | null;
  targetVrfTime: string | null;
  tallyDeadline: string | null;
  /** `claimDeadline` === `expiryTimestamp` (explicit alias for the UI). */
  claimDeadline: string | null;
  expiryTimestamp: string | null;
  secondsRemaining: number | null;
  /** BALL 2-hour tally window countdown (null outside TALLYING). */
  tallySecondsRemaining: number | null;
  /** V4 immutable BALL `tallyDuration` (120 s on Testnet); null for 100K. */
  tallyDurationSeconds: number | null;
  /** V4 batch purchase parameters — ONE contract message per batch. */
  batch: {
    maxBatchSize: number;
    flatGasBuffer: string;
    mintValuePerTicket: string | null;
    storageReserve: string | null;
    singleTransaction: true;
  };
  winnerCount: number;
  rolloverIn: AmountView;
  rolloverOut: AmountView | null;
  salePeriodSeconds: number;
  tonviewerUrl: string;
}

export interface CurrentDrawView extends DrawBaseView {
  categories: CategoryBudgetView[];
  places: CategoryBudgetView[];
  winningNumbers: WinningNumbersView | null;
  winningBalls: WinningNumbersView | null;
  winningTickets: { tickets: number[]; winners: HundredKWinnerView[] } | null;
  categoryWinners: CategoryWinnerView[];
  rollover: RolloverView;
  statusLabelFull: string;
  claimWindowSecondsRemaining: number | null;
  expired: boolean;
  vrf: VrfProofView;
  vrfProof: VrfProofView;
}

export interface HistoryDrawView extends DrawBaseView {
  drawStatus: ApiDrawStatus;
  categories: CategoryBudgetView[];
  places: CategoryBudgetView[];
  winningNumbers: WinningNumbersView | null;
  winningBalls: WinningNumbersView | null;
  winningTickets: { tickets: number[]; places: CategoryBudgetView[] } | null;
  categoryWinners: CategoryWinnerView[];
  winnerCount: number;
  rollover: RolloverView;
  vrf: VrfProofView;
  vrfProof: VrfProofView;
  vrfPayloadHex: string | null;
  vrfSignatureHex: string | null;
  vrfPublicKey: string | null;
  expired: boolean;
  archived: boolean;
}

export interface HistoryResponse {
  gameType: 'BALL' | '100K';
  game: GameSlug;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: HistoryDrawView[];
}

export interface OverviewGame {
  gameType: 'BALL' | '100K';
  game: GameSlug;
  current: (DrawBaseView & {
    winningNumbers: WinningNumbersView | null;
    claimWindowSecondsRemaining: number | null;
  }) | null;
}

export interface OverviewResponse {
  network: string;
  serverTime: string;
  games: OverviewGame[];
}

export interface HealthResponse {
  ok: boolean;
  network: string;
  serverTime: string;
  uptimeSeconds: number;
}

export interface TakenCombinationView {
  packed: string;
  ticketKey: string;
  whites: number[];
  red: number;
  displayValue: string;
  ticketAddress: string;
  ticketStatus: number;
}

export interface TakenCombinationsResponse {
  gameType: 'BALL';
  roundId: number;
  drawAddress: string;
  totalTicketsSold: number;
  count: number;
  combinations: TakenCombinationView[];
  lookup: {
    query: string;
    packed: string | null;
    taken: boolean;
    combination: TakenCombinationView | null;
  } | null;
  tonviewerUrl: string;
}

export interface VerifyWinningResult {
  kind: 'BALL' | '100K';
  whites?: number[];
  red?: number;
  display?: string;
  categories?: CategoryBudgetView[];
  tickets?: number[];
  winners?: HundredKWinnerView[];
  places?: CategoryBudgetView[];
}

export interface VerifyResponse {
  gameType: 'BALL' | '100K';
  game: GameSlug;
  roundId: number;
  drawAddress: string;
  status: number;
  statusLabel: string;
  totalTicketsSold: number;
  closingMarker: string | null;
  targetVrfTime: string | null;
  tallyDeadline: string | null;
  claimDeadline: string | null;
  vrfPayloadHex: string | null;
  vrfSignatureHex: string | null;
  vrfPublicKey: string | null;
  vrfSeedHex: string | null;
  vrfProof: VrfProofView;
  algorithm: 'ed25519' | string;
  payloadConstruction: string;
  evidenceComplete: boolean;
  verified: boolean;
  winningBalls: WinningNumbersView | null;
  winningNumbers: WinningNumbersView | null;
  categoryWinners: CategoryWinnerView[];
  winnerCount: number;
  rollover: RolloverView;
  winningResult: VerifyWinningResult | null;
  tonviewerUrl: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

/** `GET /api/chain/tickets/:walletAddress` — public read-only ticket mirror. */
export interface ChainDrawView extends DrawBaseView {
  claimWindowSecondsRemaining: number | null;
  expired: boolean;
  winningNumbers: WinningNumbersView | null;
  winningBalls: WinningNumbersView | null;
  winningTickets: number[] | null;
  categories: CategoryBudgetView[];
  places: CategoryBudgetView[];
}

/** Draw-aware ticket outcome returned by the mirror (never a stale "ACTIVE"). */
export type ChainTicketResult =
  | 'ACTIVE'
  | 'PENDING'
  | 'TALLYING'
  | 'WINNER'
  | 'NOT_WINNER'
  | 'CLAIMED'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface ChainTicketView {
  ticketAddress: string;
  gameType: 'BALL' | '100K';
  roundId: number;
  drawAddress: string;
  /** Public wallet that owns this on-chain ticket (canonical form). */
  owner: string;
  /** Legacy alias of `owner` kept for older mirrors. */
  ownerAddress?: string | null;
  ticketKey: string;
  displayValue: string;
  /** V5 on-chain packed BALL combination (decimal string), `null` for 100K. */
  packedCombination: string | null;
  /** Exact on-chain `[white1..white5]` (ascending 1..69). */
  whites: number[] | null;
  /** Exact on-chain red ball (1..26). */
  red: number | null;
  /** Legacy aliases used by older mirrors. */
  whiteBalls?: number[] | null;
  redBall?: number | null;
  ticketNumber: number | null;
  status: number;
  statusLabel: string;
  drawStatus: number;
  drawStatusLabel: string;
  result: ChainTicketResult;
  /** Winning tier (BALL category 1..8) when the ticket won, else null. */
  tier?: number | null;
  matchedWhites: number[];
  redMatched: boolean | null;
  lt: string;
  category: number | null;
  place: number | null;
  isWinner: boolean;
  /** V5 on-chain `TicketData.tallied`. */
  tallied?: boolean;
  /** V5 on-chain `TicketData.claimed`. */
  claimed?: boolean;
  payout: AmountView | null;
  tonviewerUrl: string;
}

/** One individual ticket number inside a 100K `Ticket100kPack`. */
export interface ChainPackTicketView {
  ticketNumber: number;
  isWinner: boolean;
  place: number | null;
  prizeTon: string | null;
}

/** 100K V4 `Ticket100kPack`: ONE contract expanded into every ticket number. */
export interface ChainPackView {
  packAddress: string;
  gameType: '100K';
  roundId: number;
  drawAddress: string;
  ownerAddress: string;
  startNumber: number;
  count: number;
  displayValue: string;
  status: number;
  statusLabel: string;
  drawStatus: number;
  drawStatusLabel: string;
  result: ChainTicketResult;
  tickets: ChainPackTicketView[];
  totalPrizeTon: string | null;
  claimDeadline: string | null;
  expiryTimestamp: string | null;
  lt: string;
  isWinner: boolean;
  tonviewerUrl: string;
}

export interface ChainQuotasView {
  ball: { roundId: number | null; used: number };
  draw100k: { roundId: number | null; used: number };
}

export interface ChainTicketsResponse {
  address: string;
  rawAddress: string;
  network: string;
  /** BALL V5 `BallTicket` receipts (one per combination, no token layer). */
  tickets: ChainTicketView[];
  /** 100K V4 packs (one row per range, every ticket number expanded). */
  packs: ChainPackView[];
  draws: Record<string, ChainDrawView>;
  quotas: ChainQuotasView;
  indexedAt: string;
}
