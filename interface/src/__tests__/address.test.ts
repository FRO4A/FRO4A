import { describe, expect, it } from 'vitest';
import { Address } from '@ton/core';
import { detectRole, sameAddress, addressKey } from '../utils/address';

const ADMIN = 'EQDeLewjWId6lshlusHxHXvJTlG2dM_tXdyKzqzW5SsiBs5d';
const TREASURY = 'EQBRJRTzsjEmzTWSuhNanPoakap16p-hQGW1G3R_WVhWxzzd';
const OTHER = 'EQCN7Hi07_sP5QmsM0Lz_c4tORZOJBWzZ_hZAyQihHv3pGjt';

function encode(address: string, bounceable: boolean, testOnly: boolean): string {
  return Address.parse(address).toString({ bounceable, testOnly });
}

describe('address equality and role detection', () => {
  it('treats EQ, UQ, kQ and 0Q encodings as the same address', () => {
    const eq = encode(ADMIN, true, false);
    const uq = encode(ADMIN, false, false);
    const kq = encode(ADMIN, true, true);
    const zeroQ = encode(ADMIN, false, true);
    expect(eq.startsWith('EQ')).toBe(true);
    expect(uq.startsWith('UQ')).toBe(true);
    expect(kq.startsWith('kQ')).toBe(true);
    expect(zeroQ.startsWith('0Q')).toBe(true);
    for (const candidate of [eq, uq, kq, zeroQ]) {
      expect(sameAddress(candidate, ADMIN)).toBe(true);
      expect(addressKey(candidate)).toBe(addressKey(ADMIN));
    }
  });

  it('detects ADMIN regardless of the wallet address encoding', () => {
    expect(detectRole(encode(ADMIN, false, true), ADMIN, TREASURY)).toBe('ADMIN');
    expect(detectRole(encode(ADMIN, true, true), ADMIN, TREASURY)).toBe('ADMIN');
    expect(detectRole(encode(ADMIN, false, false), ADMIN, TREASURY)).toBe('ADMIN');
  });

  it('detects TREASURY and BUYER roles', () => {
    expect(detectRole(encode(TREASURY, false, true), ADMIN, TREASURY)).toBe('TREASURY');
    expect(detectRole(encode(OTHER, true, false), ADMIN, TREASURY)).toBe('BUYER');
    expect(detectRole(null, ADMIN, TREASURY)).toBe('GUEST');
    expect(detectRole('not-an-address', ADMIN, TREASURY)).toBe('GUEST');
  });

  it('never treats different addresses as equal', () => {
    expect(sameAddress(ADMIN, TREASURY)).toBe(false);
    expect(sameAddress(OTHER, ADMIN)).toBe(false);
    expect(sameAddress(ADMIN, 'not-an-address')).toBe(false);
    expect(sameAddress(ADMIN, null)).toBe(false);
  });
});
