import { describe, expect, it } from 'vitest';
import {
  batchCost,
  canAddToBasket,
  packCombination,
  pickUniqueCombinations,
  pushBasketItem,
  remainingQuota,
  removeBasketItem,
  toBasketItem,
  validateBasket,
  type BallBasketItem,
} from '../services/ballBasket';

const TAKEN = packCombination([1, 2, 3, 4, 5], 1);
const FREE = packCombination([6, 7, 8, 9, 10], 2);
const SECOND = packCombination([11, 12, 13, 14, 15], 3);
const FREE_SET = new Set<string>();

function decision(overrides: Partial<Parameters<typeof canAddToBasket>[0]> = {}) {
  return canAddToBasket({
    selectionComplete: true,
    salesOpen: true,
    remainingQuota: 10,
    basketSize: 0,
    packed: FREE,
    serverTaken: FREE_SET,
    basketPacked: FREE_SET,
    availability: 'available',
    ...overrides,
  });
}

describe('BALL duplicate combination blocking', () => {
  it('allows a complete, open, verified-free combination', () => {
    expect(decision()).toEqual({ ok: true, blocker: null });
  });

  it('blocks a combination present in the server taken list', () => {
    expect(decision({ serverTaken: new Set([FREE]) })).toEqual({ ok: false, blocker: 'taken-server' });
  });

  it('blocks a combination already confirmed on-chain', () => {
    expect(decision({ availability: 'taken' })).toEqual({ ok: false, blocker: 'taken-chain' });
  });

  it('blocks a combination already queued in the basket', () => {
    expect(decision({ basketPacked: new Set([FREE]) })).toEqual({
      ok: false,
      blocker: 'basket-duplicate',
    });
  });

  it('blocks while the availability check is still loading or unknown', () => {
    expect(decision({ availability: 'checking' })).toEqual({ ok: false, blocker: 'checking' });
    expect(decision({ availability: 'idle' })).toEqual({ ok: false, blocker: 'checking' });
    expect(decision({ availability: 'unknown' })).toEqual({ ok: false, blocker: 'unknown' });
  });

  it('blocks incomplete picks, closed sales and exhausted / full quota', () => {
    expect(decision({ selectionComplete: false, packed: null })).toEqual({
      ok: false,
      blocker: 'incomplete',
    });
    expect(decision({ salesOpen: false })).toEqual({ ok: false, blocker: 'sales-closed' });
    expect(decision({ remainingQuota: 0 })).toEqual({ ok: false, blocker: 'quota' });
    expect(decision({ remainingQuota: 2, basketSize: 2 })).toEqual({ ok: false, blocker: 'quota' });
  });

  it('computes the remaining on-chain quota without ever going negative', () => {
    expect(remainingQuota({ count: 3, max: 100, address: null })).toBe(97);
    expect(remainingQuota({ count: 100, max: 100, address: null })).toBe(0);
    expect(remainingQuota({ count: 120, max: 100, address: null })).toBe(0);
    expect(remainingQuota(null)).toBe(100);
  });
});

describe('BALL basket validation before signing', () => {
  const basket: BallBasketItem[] = [
    toBasketItem({ whites: [6, 7, 8, 9, 10], red: 2 }),
    toBasketItem({ whites: [11, 12, 13, 14, 15], red: 3 }),
  ];

  it('accepts a basket where every combination is verified available', () => {
    const result = validateBasket(basket, new Set(), { [FREE]: 'available', [SECOND]: 'available' });
    expect(result.ok).toBe(true);
    expect(result.invalid).toEqual([]);
  });

  it('blocks the batch when one combination became taken on-chain or in the index', () => {
    const chainTaken = validateBasket(basket, new Set(), { [FREE]: 'available', [SECOND]: 'taken' });
    expect(chainTaken.ok).toBe(false);
    expect(chainTaken.invalid).toEqual([SECOND]);
    expect(chainTaken.reasons[SECOND]).toBe('taken-chain');

    const serverTaken = validateBasket(basket, new Set([SECOND]), {
      [FREE]: 'available',
      [SECOND]: 'available',
    });
    expect(serverTaken.ok).toBe(false);
    expect(serverTaken.reasons[SECOND]).toBe('taken-server');
  });

  it('blocks the batch while a check is still loading or unknown', () => {
    expect(
      validateBasket(basket, new Set(), { [FREE]: 'checking', [SECOND]: 'available' }).reasons[FREE],
    ).toBe('checking');
    expect(validateBasket(basket, new Set(), { [FREE]: 'available' }).reasons[SECOND]).toBe('unchecked');
    expect(
      validateBasket(basket, new Set(), { [FREE]: 'available', [SECOND]: 'unknown' }).reasons[SECOND],
    ).toBe('unknown');
  });

  it('never queues the same combination twice and can remove one', () => {
    const item = toBasketItem({ whites: [6, 7, 8, 9, 10], red: 2 });
    const once = pushBasketItem([], item);
    expect(pushBasketItem(once, item)).toHaveLength(1);
    expect(removeBasketItem(once, item.packed)).toHaveLength(0);
  });
});

describe('BALL multi-ticket cost breakdown', () => {
  it('multiplies every component by N tickets', () => {
    const breakdown = batchCost(3, 200_000_000n, 20_000_000n, 80_000_000n);
    expect(breakdown.ticketBodyTotal).toBe(600_000_000n);
    expect(breakdown.companyFeeTotal).toBe(60_000_000n);
    expect(breakdown.gasBufferTotal).toBe(240_000_000n);
    expect(breakdown.total).toBe(900_000_000n);
    expect(breakdown.total).toBe(3n * (200_000_000n + 20_000_000n + 80_000_000n));
  });

  it('is zero for zero tickets', () => {
    expect(batchCost(0, 1n, 2n, 3n).total).toBe(0n);
  });
});

describe('BALL quick pick generation', () => {
  it('never returns an excluded combination and stays unique', () => {
    let seed = 1;
    const deterministic = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const excluded = new Set([TAKEN]);
    const picked = pickUniqueCombinations(5, excluded, deterministic);
    expect(picked).toHaveLength(5);
    expect(new Set(picked.map((item) => item.packed)).size).toBe(5);
    for (const item of picked) {
      expect(item.packed).not.toBe(TAKEN);
      expect(item.whites).toHaveLength(5);
      expect(item.red).toBeGreaterThanOrEqual(1);
      expect(item.red).toBeLessThanOrEqual(26);
      expect(item.whites).toEqual([...item.whites].sort((a, b) => a - b));
    }
  });

  it('returns nothing when the requested count is zero', () => {
    expect(pickUniqueCombinations(0, new Set())).toEqual([]);
  });
});

