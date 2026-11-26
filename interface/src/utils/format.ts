import type { AmountView } from '../types/api';

const ONE_TON = 1_000_000_000n;

/** Nanotons (decimal string or bigint) -> human TON string, trailing zeros trimmed. */
export function nanotonsToTon(value: string | bigint | null | undefined): string {
  if (value === null || value === undefined) return '0';
  const source = typeof value === 'bigint' ? value.toString() : value.trim();
  if (!/^-?\d+$/.test(source)) return '0';
  const negative = source.startsWith('-');
  const digits = negative ? source.slice(1) : source;
  const padded = digits.padStart(10, '0');
  const whole = padded.slice(0, padded.length - 9);
  const fraction = padded.slice(padded.length - 9).replace(/0+$/, '');
  const result = fraction.length > 0 ? `${whole}.${fraction}` : whole;
  return negative && result !== '0' ? `-${result}` : result;
}

export function toBigInt(value: string | bigint | number | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? BigInt(Math.trunc(value)) : 0n;
    const trimmed = value.trim();
    if (/^-?\d+$/.test(trimmed)) return BigInt(trimmed);
    if (/^0x[0-9a-f]+$/i.test(trimmed)) return BigInt(trimmed);
    return 0n;
  } catch {
    return 0n;
  }
}

export function tonFromView(amount: AmountView | null | undefined): string {
  if (!amount) return '—';
  return amount.ton;
}

export function formatTon(amount: AmountView | null | undefined): string {
  if (!amount) return '—';
  return `${amount.ton} TON`;
}

export function formatTonFromNano(nanotons: string | bigint | null | undefined): string {
  if (nanotons === null || nanotons === undefined) return '—';
  return `${nanotonsToTon(nanotons)} TON`;
}

export function formatInteger(value: number | bigint, locale = 'en'): string {
  try {
    return new Intl.NumberFormat(locale).format(typeof value === 'bigint' ? value : Math.trunc(value));
  } catch {
    try {
      return new Intl.NumberFormat('en-US').format(typeof value === 'bigint' ? value : Math.trunc(value));
    } catch {
      return value.toString();
    }
  }
}

export function formatCompact(value: number, locale = 'en'): string {
  try {
    return new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return value.toString();
  }
}

export function formatPercent(value: number, fractionDigits = 0): string {
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatDateTime(iso: string | null | undefined, locale = 'en'): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function pad2(value: number): string {
  return Math.max(0, Math.trunc(value)).toString().padStart(2, '0');
}

export function pad6(value: number | bigint | string): string {
  const numeric = typeof value === 'bigint' ? Number(value) : typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (!Number.isFinite(numeric)) return '000000';
  return Math.trunc(numeric).toString().padStart(6, '0');
}

export function formatBallCombination(whites: readonly number[], red: number): string {
  return `${whites.map((white) => pad2(white)).join('-')} + ${pad2(red)}`;
}

export function formatTicketNumber(ticketNumber: number | bigint | string): string {
  return `#${pad6(ticketNumber)}`;
}

/** Packed layout from BallDrawInstance: w1 | w2<<7 | … | w5<<28 | red<<35. */
export function encodeBallCombination(whites: readonly number[], red: number): bigint {
  let packed = 0n;
  whites.forEach((white, index) => {
    packed |= BigInt(white) << (7n * BigInt(index));
  });
  packed |= BigInt(red) << 35n;
  return packed;
}

export function decodeBallCombination(packed: bigint): { whites: number[]; red: number } {
  const mask = 127n;
  const whites = Array.from({ length: 5 }, (_, index) => Number((packed >> (7n * BigInt(index))) & mask));
  const red = Number((packed >> 35n) & 31n);
  return { whites, red };
}

export function parseTonToNano(value: string): bigint | null {
  const trimmed = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{0,9})?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  return BigInt(whole) * ONE_TON + BigInt(fraction.padEnd(9, '0'));
}

export interface CostBreakdown {
  ticketBody: bigint;
  companyFee: bigint;
  ticketPrice: bigint;
  gasBuffer: bigint;
  minBuyValue: bigint;
}

export function calculateCost(
  ticketBodyNano: string | null | undefined,
  companyFeeNano: string | null | undefined,
  gasBuffer: bigint,
): CostBreakdown | null {
  if (!ticketBodyNano || !companyFeeNano) return null;
  const ticketBody = toBigInt(ticketBodyNano);
  const companyFee = toBigInt(companyFeeNano);
  if (ticketBody <= 0n) return null;
  const ticketPrice = ticketBody + companyFee;
  return { ticketBody, companyFee, ticketPrice, gasBuffer, minBuyValue: ticketPrice + gasBuffer };
}

export function bigintMin(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export function bigintMax(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

export function shortHex(value: string | null | undefined, size = 8): string {
  if (!value) return '—';
  if (value.length <= size * 2 + 1) return value;
  return `${value.slice(0, size)}…${value.slice(-size)}`;
}
