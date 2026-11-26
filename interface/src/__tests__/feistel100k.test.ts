import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  computePayoutPlan,
  countOfPlaceFor,
  hashVrfPayload,
  sampleFeistelWinners,
  verifyVrf,
} from '../services/vrfVerifier';
import { PLACES } from '../types/game';

const HUNDRED_DRAW = 'EQCOJWxFyH7TwBb8aABc8VettIUS24ARTz1L0JcNSbfrae8K';
const SEED_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const SEED = BigInt(`0x${SEED_HEX}`);

describe('in-browser 100K six-round Feistel permutation', () => {
  it('matches the reference contract vector for N=100000, round=7, K=100', () => {
    const result = sampleFeistelWinners(SEED, 7, 100_000, 100);
    expect(result.tickets.slice(0, 10)).toEqual([
      16308, 16072, 12953, 40780, 59390, 37851, 43893, 38433, 37706, 30228,
    ]);
    expect(result.tickets.slice(-5)).toEqual([29263, 88608, 17569, 25852, 18526]);
    expect(new Set(result.tickets).size).toBe(100);
    expect(result.tickets.every((number) => number >= 1 && number <= 100_000)).toBe(true);
    expect(createHash('sha256').update(result.tickets.join(',')).digest('hex')).toBe(
      '713905009e25e18f9630d26893a99d9833d9893c98371aa4a7fa80396d25ada9',
    );
    expect(result.firstHalf).toHaveLength(50);
    expect(result.secondHalf).toHaveLength(50);
  });

  it('is a bijection on small domains', () => {
    const result = sampleFeistelWinners(SEED, 3, 7, 7);
    expect(result.tickets).toEqual([7, 6, 1, 3, 2, 4, 5]);
    expect(new Set(result.tickets).size).toBe(7);
  });

  it('never yields a ticket outside 1..total for many rounds', () => {
    for (const total of [1, 2, 7, 100, 317, 1000, 65_537, 100_000]) {
      const result = sampleFeistelWinners(SEED + BigInt(total), 11, total, Math.min(100, total));
      expect(result.tickets).toHaveLength(Math.min(100, total));
      expect(result.tickets.every((number) => number >= 1 && number <= total)).toBe(true);
      expect(new Set(result.tickets).size).toBe(result.tickets.length);
    }
  });

  it('uses roundId as part of the Feistel key derivation', () => {
    const round7 = sampleFeistelWinners(SEED, 7, 1000, 10);
    const round8 = sampleFeistelWinners(SEED, 8, 1000, 10);
    expect(round7.tickets).not.toEqual(round8.tickets);
  });

  it('builds the canonical 100K payload with a 64-bit targetVrfTime', () => {
    const { hex } = hashVrfPayload({
      gameType: '100K',
      drawAddress: HUNDRED_DRAW,
      totalTicketsSold: 54321,
      closingMarker: 1234567890n,
      targetVrfTime: 1700000000n,
    });
    expect(hex).toBe('378247af0a1150aee1eb880f575ed1ca6b54dd16063087217e7951ff7e5517dd');
  });

  it('verifyVrf uses the draw roundId and reproduces the same winners', () => {
    const signature = `${SEED_HEX}${'00'.repeat(32)}`;
    const result = verifyVrf({
      gameType: '100K',
      drawAddress: HUNDRED_DRAW,
      roundId: 7,
      totalTicketsSold: 100_000,
      closingMarker: 1n,
      targetVrfTime: 2n,
      signatureHex: signature,
      publicKeyHex: '00'.repeat(32),
    });
    expect(result.hundredK?.tickets.slice(0, 10)).toEqual([
      16308, 16072, 12953, 40780, 59390, 37851, 43893, 38433, 37706, 30228,
    ]);
    expect(result.ball).toBeNull();
  });

  it('assigns place counts exactly like countOfPlaceFor', () => {
    const counts = PLACES.map((place) => countOfPlaceFor(place.place, 100));
    expect(counts).toEqual([1, 4, 10, 15, 20, 50]);
    expect(counts.reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it('distributes the exact prize fund with the remainder on 1st place', () => {
    const fund = 100_000_000_000n; // 100 TON in nanotons
    const plan = computePayoutPlan(fund, 100);
    const distributed = plan.reduce((sum, row) => sum + row.payoutNano * BigInt(row.winners), 0n);
    expect(distributed).toBe(fund);
    expect(plan.map((row) => row.winners)).toEqual([1, 4, 10, 15, 20, 50]);
    expect(plan[0].payoutNano).toBeGreaterThan(plan[1].payoutNano);
  });
});
