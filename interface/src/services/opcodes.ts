/**
 * Opcodes verified against `shared/wrappers/{ball,100k}` and the Tact sources.
 *
 * Some opcode values are shared between the games, others are deliberately
 * different. The two ticket contracts are the important asymmetry:
 *   BALL BallTicketSBT: Claim 0x3008, Refund 0x3009
 *   100K Ticket100kSBT: Claim 0x3011, Refund 0x3012
 */
export const OPCODES = {
  BuyTicket: 0x1001,
  /** V4 batch purchase: BALL 1..12 combinations / 100K 1..100 tickets. */
  BuyTicketBatch: 0x1011,
  ForceStartGame: 0x2001,
  CheckDeadline: 0x2002,
  SubmitVrf: 0x2003,
  FinalizeTally: 0x2004,
  SweepCompanyFee: 0x2005,
  CheckVrfTimeout: 0x2006,
  RetryRollover: 0x2007,
  CloseExpiredDraw: 0x2008,

  BallClaim: 0x3008,
  BallRefund: 0x3009,
  HundredKClaim: 0x3011,
  HundredKRefund: 0x3012,

  BallDeployDraw: 0x4001,
  HundredKCreateDraw: 0x2007,
} as const;

/** Gas / value constants from the V4 contract sources (never ticket prices). */
export const GAS = {
  TICKET_ACTION: 50_000_000n,
  ADMIN_ACTION: 50_000_000n,
  BALL_DEPLOY_DRAW: 200_000_000n,
  HUNDRED_K_CREATE_DRAW: 1_000_000_000n,
  BUY_GAS_BUFFER: 80_000_000n,
  /** BALL `BATCH_BASE_GAS`: flat 0.08 TON per `BuyTicketBatch` message. */
  BALL_BATCH_BASE_GAS: 80_000_000n,
  /** BALL `MINT_VALUE`: 0.06 TON mint funding PER combination (excess refunded). */
  BALL_MINT_VALUE: 60_000_000n,
  /** 100K `BATCH_GAS_BUFFER`: flat 0.10 TON for the whole pack message. */
  HUNDRED_K_BATCH_GAS_BUFFER: 100_000_000n,
  /** `Ticket100kPack` Claim (0x3011) — the protocol requires >= 0.15 TON. */
  PACK_CLAIM: 150_000_000n,
  /** `Ticket100kPack` Refund (0x3012) — the protocol requires >= 0.05 TON. */
  PACK_REFUND: 50_000_000n,
} as const;

/** V4 batch limits (protocol-standard §7). */
export const V4_LIMITS = {
  /** `MAX_BALL_BATCH`: combinations per `BuyTicketBatch (0x1011)` message. */
  MAX_BALL_BATCH: 12,
  /** `MAX_PACK_SIZE`: tickets per `Ticket100kPack`. */
  MAX_PACK_SIZE: 100,
} as const;
