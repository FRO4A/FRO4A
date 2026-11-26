import { Address } from '@ton/core';
import type { UserRole } from '../types/game';

export function parseAddressSafe(value: string | null | undefined): Address | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  try {
    return Address.parse(value.trim());
  } catch {
    return null;
  }
}

/**
 * Protocol rule: TON addresses are NEVER compared as raw strings.
 * `Address.parse(a).equals(Address.parse(b))` accepts `0Q…`, `EQ…`, `UQ…` and
 * `kQ…` encodings of the same 256-bit address (and testnet-only flags).
 */
export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = parseAddressSafe(a);
  const right = parseAddressSafe(b);
  if (left === null || right === null) return false;
  return left.equals(right);
}

/** Deterministic index key derived from the parsed address (never a raw compare). */
export function addressKey(value: string | null | undefined): string | null {
  const parsed = parseAddressSafe(value);
  return parsed === null ? null : parsed.toRawString();
}

export function shortAddress(value: string | null | undefined, front = 4, back = 4): string {
  if (!value) return '—';
  if (value.length <= front + back + 1) return value;
  return `${value.slice(0, front)}…${value.slice(-back)}`;
}

export function detectRole(
  walletAddress: string | null | undefined,
  adminAddress: string | null | undefined,
  treasuryAddress: string | null | undefined,
): UserRole {
  if (parseAddressSafe(walletAddress) === null) return 'GUEST';
  if (sameAddress(walletAddress, adminAddress)) return 'ADMIN';
  if (sameAddress(walletAddress, treasuryAddress)) return 'TREASURY';
  return 'BUYER';
}

export function isZeroAddress(value: string | null | undefined): boolean {
  const parsed = parseAddressSafe(value);
  if (parsed === null) return false;
  return parsed.equals(Address.parseRaw('0:0000000000000000000000000000000000000000000000000000000000000000'));
}
