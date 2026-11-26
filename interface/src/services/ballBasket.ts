import type { QuotaView } from '../types/game';
import { encodeBallCombination } from '../utils/format';

/**
 * Pure BALL basket / duplicate-guard logic.
 *
 * Keeping these rules free of React and of the network makes the zero-wasted-gas
 * guarantee unit-testable: the UI can only enable a purchase when every rule here
 * returns `ok`, and the same functions are re-run immediately before signing.
 */

export type AvailabilityState = 'idle' | 'checking' | 'available' | 'taken' | 'unknown';

export interface BallCombination {
  whites: number[];
  red: number;
}

export interface BallBasketItem extends BallCombination {
  /** Decimal packed combination (the exact uint64 stored on-chain). */
  packed: string;
}

export type AddBlocker =
  | 'incomplete'
  | 'sales-closed'
  | 'quota'
  | 'taken-server'
  | 'taken-chain'
  | 'basket-duplicate'
  | 'checking'
  | 'unknown';

export interface AddDecision {
  ok: boolean;
  blocker: AddBlocker | null;
}

export type BasketIssue = 'taken-server' | 'taken-chain' | 'checking' | 'unknown' | 'unchecked';

export interface BasketValidation {
  ok: boolean;
  invalid: string[];
  reasons: Record<string, BasketIssue>;
}

/** Packed decimal key for a combination (the same encoding the contract stores). */
export function packCombination(whites: readonly number[], red: number): string {
  return encodeBallCombination(whites, red).toString();
}

export function toBasketItem(combination: BallCombination): BallBasketItem {
  return {
    whites: [...combination.whites],
    red: combination.red,
    packed: packCombination(combination.whites, combination.red),
  };
}

/** `Math.max(0, 100 - usedQuota)`; unknown quota is treated as the full 100. */
export function remainingQuota(quota: QuotaView | null | undefined): number {
  if (!quota) return 100;
  const max = Number.isFinite(quota.max) && quota.max > 0 ? quota.max : 100;
  const used = Number.isFinite(quota.count) ? quota.count : 0;
  return Math.max(0, max - used);
}

/**
 * Every condition that must hold before a combination may enter the basket.
 * A duplicate (server-indexed OR already confirmed on-chain OR already queued)
 * can never pass, and a still-loading / unverifiable check is blocked too.
 */
export function canAddToBasket(input: {
  selectionComplete: boolean;
  salesOpen: boolean;
  remainingQuota: number;
  basketSize: number;
  packed: string | null;
  serverTaken: ReadonlySet<string>;
  basketPacked: ReadonlySet<string>;
  availability: AvailabilityState;
}): AddDecision {
  if (!input.selectionComplete || input.packed === null) return { ok: false, blocker: 'incomplete' };
  if (!input.salesOpen) return { ok: false, blocker: 'sales-closed' };
  if (input.remainingQuota <= 0 || input.basketSize >= input.remainingQuota) {
    return { ok: false, blocker: 'quota' };
  }
  if (input.serverTaken.has(input.packed)) return { ok: false, blocker: 'taken-server' };
  if (input.basketPacked.has(input.packed)) return { ok: false, blocker: 'basket-duplicate' };
  if (input.availability === 'taken') return { ok: false, blocker: 'taken-chain' };
  if (input.availability === 'checking' || input.availability === 'idle') {
    return { ok: false, blocker: 'checking' };
  }
  if (input.availability === 'unknown') return { ok: false, blocker: 'unknown' };
  return { ok: true, blocker: null };
}

/**
 * Re-validates the whole basket right before signing. Any combination that is
 * taken (server or chain), still verifying, or unverifiable blocks the batch.
 */
export function validateBasket(
  entries: readonly BallBasketItem[],
  serverTaken: ReadonlySet<string>,
  onChain: Readonly<Record<string, AvailabilityState>>,
): BasketValidation {
  const invalid: string[] = [];
  const reasons: Record<string, BasketIssue> = {};
  for (const entry of entries) {
    let issue: BasketIssue | null = null;
    if (serverTaken.has(entry.packed)) issue = 'taken-server';
    else {
      const state = onChain[entry.packed];
      if (state === 'taken') issue = 'taken-chain';
      else if (state === 'checking') issue = 'checking';
      else if (state === 'unknown' || state === 'idle') issue = 'unknown';
      else if (state !== 'available') issue = 'unchecked';
    }
    if (issue !== null) {
      invalid.push(entry.packed);
      reasons[entry.packed] = issue;
    }
  }
  return { ok: invalid.length === 0, invalid, reasons };
}

/**
 * Server-only basket validation used by the instant picker: every combination
 * must be absent from the live taken Set. No per-ticket chain latency.
 */
export function validateBasketAvailability(
  entries: readonly BallBasketItem[],
  serverTaken: ReadonlySet<string>,
): BasketValidation {
  const invalid: string[] = [];
  const reasons: Record<string, BasketIssue> = {};
  for (const entry of entries) {
    if (serverTaken.has(entry.packed)) {
      invalid.push(entry.packed);
      reasons[entry.packed] = 'taken-server';
    }
  }
  return { ok: invalid.length === 0, invalid, reasons };
}

export interface BatchCostBreakdown {
  count: number;
  ticketBody: bigint;
  companyFee: bigint;
  gasBuffer: bigint;
  ticketBodyTotal: bigint;
  companyFeeTotal: bigint;
  gasBufferTotal: bigint;
  total: bigint;
}

/**
 * Transparent N-ticket cost: `N × ticketBody + N × companyFee + N × gas buffer`.
 * The gas buffer is attached, not burned: the contracts refund unused gas.
 */
export function batchCost(
  count: number,
  ticketBody: bigint,
  companyFee: bigint,
  gasBuffer: bigint,
): BatchCostBreakdown {
  const safeCount = Math.max(0, Math.trunc(count));
  const multiplier = BigInt(safeCount);
  const ticketBodyTotal = ticketBody * multiplier;
  const companyFeeTotal = companyFee * multiplier;
  const gasBufferTotal = gasBuffer * multiplier;
  return {
    count: safeCount,
    ticketBody,
    companyFee,
    gasBuffer,
    ticketBodyTotal,
    companyFeeTotal,
    gasBufferTotal,
    total: ticketBodyTotal + companyFeeTotal + gasBufferTotal,
  };
}

export type RandomSource = () => number;

/**
 * BALL V4 `BuyTicketBatch` cost (protocol-standard §7.1), per contract message:
 *
 *   count × (ticketBody + companyFee)
 * + BATCH_BASE_GAS (0.08 TON flat, never scales with count)
 * + count × MINT_VALUE (0.06 TON mint funding, excess refunded with
 *   `OwnershipAssigned`)
 *
 * Prices always come from the API / on-chain `getBuyQuote`; only the two gas
 * constants use the protocol defaults.
 */
export interface BallBatchValue {
  count: number;
  ticketBody: bigint;
  companyFee: bigint;
  ticketBodyTotal: bigint;
  companyFeeTotal: bigint;
  flatGas: bigint;
  mintTotal: bigint;
  total: bigint;
}

export function ballBatchValue(
  count: number,
  ticketBody: bigint,
  companyFee: bigint,
  options: { flatGas?: bigint; mintValue?: bigint } = {},
): BallBatchValue {
  const safeCount = Math.max(0, Math.trunc(count));
  const multiplier = BigInt(safeCount);
  const flatGas = options.flatGas ?? 80_000_000n;
  const mintValue = options.mintValue ?? 60_000_000n;
  const ticketBodyTotal = ticketBody * multiplier;
  const companyFeeTotal = companyFee * multiplier;
  const mintTotal = mintValue * multiplier;
  return {
    count: safeCount,
    ticketBody,
    companyFee,
    ticketBodyTotal,
    companyFeeTotal,
    flatGas,
    mintTotal,
    total: ticketBodyTotal + companyFeeTotal + flatGas + mintTotal,
  };
}

/**
 * 100K V4 `BuyTicketBatch` cost for ONE `Ticket100kPack` (protocol-standard §7.2):
 *
 *   count × (ticketBody + companyFee) + BATCH_GAS_BUFFER (0.10 TON flat)
 */
export interface HundredKPackValue {
  count: number;
  ticketBody: bigint;
  companyFee: bigint;
  ticketBodyTotal: bigint;
  companyFeeTotal: bigint;
  flatGas: bigint;
  total: bigint;
}

export function hundredKPackValue(
  count: number,
  ticketBody: bigint,
  companyFee: bigint,
  flatGas: bigint = 100_000_000n,
): HundredKPackValue {
  const safeCount = Math.max(0, Math.trunc(count));
  const multiplier = BigInt(safeCount);
  const ticketBodyTotal = ticketBody * multiplier;
  const companyFeeTotal = companyFee * multiplier;
  return {
    count: safeCount,
    ticketBody,
    companyFee,
    ticketBodyTotal,
    companyFeeTotal,
    flatGas,
    total: ticketBodyTotal + companyFeeTotal + flatGas,
  };
}

function cryptoRandom(maxExclusive: number): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

/** One uniformly-random valid BALL combination (5 sorted whites + 1 red). */
export function randomCombination(random: RandomSource = Math.random): BallCombination {
  const index = (maxExclusive: number): number => {
    const value = random();
    const bounded = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999999) : 0;
    return Math.floor(bounded * maxExclusive);
  };
  const pool = new Set<number>();
  while (pool.size < 5) pool.add(1 + index(69));
  return { whites: [...pool].sort((a, b) => a - b), red: 1 + index(26) };
}

/** CSPRNG-based combination for the UI (no Math.random bias in the browser). */
export function secureCombination(): BallCombination {
  const pool = new Set<number>();
  while (pool.size < 5) pool.add(1 + cryptoRandom(69));
  return { whites: [...pool].sort((a, b) => a - b), red: 1 + cryptoRandom(26) };
}

/**
 * Generates up to `count` unique combinations that are not in `excluded`.
 * Deterministic when a deterministic `random` is injected (used by unit tests).
 */
export function pickUniqueCombinations(
  count: number,
  excluded: ReadonlySet<string>,
  random: RandomSource = Math.random,
  maxAttempts = 6000,
): BallBasketItem[] {
  const target = Math.max(0, Math.trunc(count));
  if (target === 0) return [];
  const picked: BallBasketItem[] = [];
  const seen = new Set(excluded);
  for (let attempt = 0; attempt < maxAttempts && picked.length < target; attempt += 1) {
    const item = toBasketItem(randomCombination(random));
    if (seen.has(item.packed)) continue;
    seen.add(item.packed);
    picked.push(item);
  }
  return picked;
}

/** Adds a verified combination to the basket without ever duplicating it. */
export function pushBasketItem(
  basket: readonly BallBasketItem[],
  item: BallBasketItem,
): BallBasketItem[] {
  if (basket.some((entry) => entry.packed === item.packed)) return [...basket];
  return [...basket, item];
}

export function removeBasketItem(
  basket: readonly BallBasketItem[],
  packed: string,
): BallBasketItem[] {
  return basket.filter((entry) => entry.packed !== packed);
}
