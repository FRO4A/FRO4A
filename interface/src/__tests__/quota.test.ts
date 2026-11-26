import { Address } from '@ton/core';
import { describe, expect, it } from 'vitest';
import { userQuotaAddress } from '../services/quota';
import { calculateCost } from '../utils/format';

const DRAW = 'EQCN7Hi07_sP5QmsM0Lz_c4tORZOJBWzZ_hZAyQihHv3pGjt';
const HUNDRED_DRAW = 'EQCOJWxFyH7TwBb8aABc8VettIUS24ARTz1L0JcNSbfrae8K';
const WALLET = 'EQDeLewjWId6lshlusHxHXvJTlG2dM_tXdyKzqzW5SsiBs5d';
const OTHER = 'EQBRJRTzsjEmzTWSuhNanPoakap16p-hQGW1G3R_WVhWxzzd';

describe('deterministic UserQuota address', () => {
  it('matches the on-chain getUserQuotaAddress getter for both games', () => {
    expect(userQuotaAddress('BALL', DRAW, WALLET)).toBe('EQBQvfiTCCP9s_sOfhVHvErQ7kweWBtmXgw5WKq2DX0M7xdc');
    expect(userQuotaAddress('100K', HUNDRED_DRAW, WALLET)).toBe('EQD3807Rizt_yhUgMhJxXhRoQPDy7cSGoHetPnTnp59INzV0');
  });

  it('is stable for the same game / draw / owner', () => {
    const first = userQuotaAddress('BALL', DRAW, WALLET);
    const second = userQuotaAddress('BALL', DRAW, WALLET);
    expect(first).toBe(second);
    expect(() => Address.parse(first)).not.toThrow();
  });

  it('depends on the owner, the draw and the game', () => {
    const base = userQuotaAddress('BALL', DRAW, WALLET);
    expect(userQuotaAddress('BALL', DRAW, OTHER)).not.toBe(base);
    expect(userQuotaAddress('100K', DRAW, WALLET)).not.toBe(base);
    expect(userQuotaAddress('BALL', OTHER, WALLET)).not.toBe(base);
  });
});

describe('live cost breakdown', () => {
  it('never guesses a price and sums body + fee + gas buffer', () => {
    expect(calculateCost(null, null, 80_000_000n)).toBeNull();
    expect(calculateCost('0', '0', 80_000_000n)).toBeNull();
    const cost = calculateCost('200000000', '20000000', 80_000_000n);
    expect(cost?.ticketPrice).toBe(220_000_000n);
    expect(cost?.minBuyValue).toBe(300_000_000n);
  });
});
