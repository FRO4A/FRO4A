import { ed25519 } from '@noble/curves/ed25519';
import { Address, beginCell, Cell } from '@ton/core';
import type { GameType } from '../types/game';
import { placeForWinnerIndex, PLACES } from '../types/game';

/** "VRF1" domain separator used by both Tact contracts. */
export const VRF_DOMAIN = 0x56524631;

const MASK_64 = (1n << 64n) - 1n;
const SPLITMIX_GAMMA = 11400714819323198485n;
const SPLITMIX_MUL_A = 13787848793156543929n;
const FEISTEL_WALK_LIMIT = 512;

export interface VrfParameters {
  gameType: GameType;
  drawAddress: string;
  roundId: number;
  totalTicketsSold: number;
  /** BALL: uint64 closingLt, 100K: uint64 salesClosingLt. */
  closingMarker: bigint;
  /** Unix seconds. uint32 for BALL, uint64 for 100K. */
  targetVrfTime: bigint;
  signatureHex: string;
  publicKeyHex: string;
}

export interface BallVerification {
  whites: number[];
  red: number;
  display: string;
}

export interface HundredKVerification {
  tickets: number[];
  firstHalf: number[];
  secondHalf: number[];
}

export interface VerificationResult {
  payloadCell: Cell;
  payloadHex: string;
  signatureValid: boolean;
  seedHex: string;
  seed: bigint;
  ball: BallVerification | null;
  hundredK: HundredKVerification | null;
}

/**
 * Canonical cross-game VRF payload:
 *   BALL: 0x56524631 | drawAddress | totalTicketsSold:uint32 | closingLt:uint64 | targetVrfTime:uint32
 *   100K: 0x56524631 | drawAddress | totalTicketsSold:uint32 | closingLt:uint64 | targetVrfTime:uint64
 */
export function buildVrfPayloadCell(params: {
  gameType: GameType;
  drawAddress: string;
  totalTicketsSold: number;
  closingMarker: bigint;
  targetVrfTime: bigint;
}): Cell {
  const targetBits = params.gameType === 'BALL' ? 32 : 64;
  return beginCell()
    .storeUint(VRF_DOMAIN, 32)
    .storeAddress(Address.parse(params.drawAddress))
    .storeUint(BigInt(params.totalTicketsSold), 32)
    .storeUint(params.closingMarker, 64)
    .storeUint(params.targetVrfTime, targetBits)
    .endCell();
}

export function hashVrfPayload(params: {
  gameType: GameType;
  drawAddress: string;
  totalTicketsSold: number;
  closingMarker: bigint;
  targetVrfTime: bigint;
}): { cell: Cell; hex: string } {
  const cell = buildVrfPayloadCell(params);
  return { cell, hex: cell.hash().toString('hex') };
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().replace(/^0x/i, '');
  if (normalized.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(normalized)) {
    throw new Error('Invalid hex');
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** ed25519 over the 32-byte payload hash, exactly `checkSignature(hash, sig, pubkey)`. */
export function verifySignature(signatureHex: string, messageHashHex: string, publicKeyHex: string): boolean {
  try {
    const signature = hexToBytes(signatureHex);
    const message = hexToBytes(messageHashHex);
    const publicKey = hexToBytes(publicKeyHex);
    if (signature.length !== 64 || message.length !== 32 || publicKey.length !== 32) return false;
    return ed25519.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

function pickBall(raw: bigint, remaining: bigint, excluded: readonly number[]): number {
  const target = raw % remaining;
  let count = -1n;
  let result = 0;
  for (let n = 1; n <= 69; n += 1) {
    if (!excluded.includes(n)) {
      count += 1n;
      if (count === target) result = n;
    }
  }
  return result;
}

/**
 * BALL derivation, mirrored 1:1 from `BallDrawInstance.SubmitVrf`:
 * seed = signature[0..256); five picks with shrinking pools, then red = 1 + s % 26,
 * followed by the on-chain 4-pass bubble sort of the whites.
 */
export function deriveBallNumbers(seed: bigint): BallVerification {
  let s = seed;
  const w1 = pickBall(s % 69n, 69n, []);
  s /= 69n;
  const w2 = pickBall(s % 68n, 68n, [w1]);
  s /= 68n;
  const w3 = pickBall(s % 67n, 67n, [w1, w2]);
  s /= 67n;
  const w4 = pickBall(s % 66n, 66n, [w1, w2, w3]);
  s /= 66n;
  const w5 = pickBall(s % 65n, 65n, [w1, w2, w3, w4]);
  s /= 65n;
  const red = 1 + Number(s % 26n);

  const whites = [w1, w2, w3, w4, w5];
  for (let pass = 0; pass < 4; pass += 1) {
    for (let index = 0; index < 4; index += 1) {
      if (whites[index] > whites[index + 1]) {
        const swap = whites[index];
        whites[index] = whites[index + 1];
        whites[index + 1] = swap;
      }
    }
  }
  return {
    whites,
    red,
    display: `${whites.map((white) => white.toString().padStart(2, '0')).join('-')} + ${red.toString().padStart(2, '0')}`,
  };
}

function bigIntSqrtCeil(value: bigint): bigint {
  if (value <= 0n) return 0n;
  let q = value;
  let next = (q + value / q) / 2n;
  while (next < q) {
    q = next;
    next = (q + value / q) / 2n;
  }
  if (q * q < value) q += 1n;
  return q;
}

function cellHashBigInt(cell: Cell): bigint {
  return BigInt(`0x${cell.hash().toString('hex')}`);
}

export interface FeistelKeys {
  k0: bigint;
  k1: bigint;
  k2: bigint;
  k3: bigint;
  k4: bigint;
  k5: bigint;
}

/** sha256(seed:uint256 | roundIndex:uint32 | 0/1:uint8), two digests -> six 64-bit keys. */
export function deriveFeistelKeys(seed: bigint, roundIndex: number): FeistelKeys {
  const d0 = cellHashBigInt(
    beginCell().storeUint(seed, 256).storeUint(roundIndex, 32).storeUint(0, 8).endCell(),
  );
  const d1 = cellHashBigInt(
    beginCell().storeUint(seed, 256).storeUint(roundIndex, 32).storeUint(1, 8).endCell(),
  );
  return {
    k0: (d0 >> 192n) & MASK_64,
    k1: (d0 >> 128n) & MASK_64,
    k2: (d0 >> 64n) & MASK_64,
    k3: d0 & MASK_64,
    k4: (d1 >> 192n) & MASK_64,
    k5: (d1 >> 128n) & MASK_64,
  };
}

function splitMix(value: bigint, key: bigint, q: bigint): bigint {
  let t = ((value + key) * SPLITMIX_GAMMA) & MASK_64;
  t = ((t ^ (t >> 30n)) * SPLITMIX_MUL_A) & MASK_64;
  return (t ^ (t >> 27n)) % q;
}

/**
 * 100K sampleFeistelWinners(): six-round Balanced Feistel over q x q with
 * cycle-walking into [0..total). Bit-for-bit port of the Tact implementation.
 */
export function sampleFeistelWinners(
  seed: bigint,
  roundIndex: number,
  total: number,
  count: number,
): HundredKVerification {
  if (total <= 0) return { tickets: [], firstHalf: [], secondHalf: [] };
  const q = bigIntSqrtCeil(BigInt(total));
  const keys = deriveFeistelKeys(seed, roundIndex);
  const k = Math.min(count, total);
  const tickets: number[] = [];

  for (let i = 0; i < k; i += 1) {
    let x = BigInt(i);
    let walked = 0;
    for (;;) {
      let l = x / q;
      let r = x % q;
      l = (l + splitMix(r, keys.k0, q)) % q;
      r = (r + splitMix(l, keys.k1, q)) % q;
      l = (l + splitMix(r, keys.k2, q)) % q;
      r = (r + splitMix(l, keys.k3, q)) % q;
      l = (l + splitMix(r, keys.k4, q)) % q;
      r = (r + splitMix(l, keys.k5, q)) % q;
      x = l * q + r;
      walked += 1;
      if (x < BigInt(total)) break;
      if (walked >= FEISTEL_WALK_LIMIT) throw new Error('Feistel cycle-walk did not converge');
    }
    tickets.push(Number(x) + 1);
  }

  return {
    tickets,
    firstHalf: tickets.slice(0, 50),
    secondHalf: tickets.slice(50),
  };
}

export function countOfPlaceFor(place: number, k: number): number {
  const positiveMin = (limit: number, value: number): number => Math.max(0, Math.min(limit, value));
  if (place === 1) return positiveMin(1, k);
  if (place === 2) return positiveMin(4, k - 1);
  if (place === 3) return positiveMin(10, k - 5);
  if (place === 4) return positiveMin(15, k - 15);
  if (place === 5) return positiveMin(20, k - 30);
  if (place === 6) return positiveMin(50, k - 50);
  return 0;
}

export interface PayoutPlanRow {
  place: number;
  sharePercent: number;
  winners: number;
  payoutNano: bigint;
  poolNano: bigint;
}

/** Exact `planPayouts` from Draw100kInstance (remainder is added to 1st place). */
export function computePayoutPlan(prizeFund: bigint, k: number): PayoutPlanRow[] {
  const counts = PLACES.map((place) => countOfPlaceFor(place.place, k));
  const payouts = PLACES.map((place, index) => {
    const count = counts[index];
    const share = BigInt(place.sharePercent);
    return count > 0 ? (prizeFund * share) / 100n / BigInt(count) : 0n;
  });
  let distributed = 0n;
  PLACES.forEach((_place, index) => {
    distributed += payouts[index] * BigInt(counts[index]);
  });
  const rest = prizeFund - distributed;
  if (counts[0] > 0) payouts[0] += rest;
  return PLACES.map((place, index) => ({
    place: place.place,
    sharePercent: place.sharePercent,
    winners: counts[index],
    payoutNano: payouts[index],
    poolNano: (prizeFund * BigInt(place.sharePercent)) / 100n,
  }));
}

export function deriveSeed(signatureHex: string): bigint {
  const signature = hexToBytes(signatureHex);
  if (signature.length !== 64) throw new Error('Signature must be 64 bytes');
  return BigInt(`0x${bytesToHex(signature.slice(0, 32))}`);
}

export function verifyVrf(params: VrfParameters): VerificationResult {
  const { cell, hex } = hashVrfPayload(params);
  const signatureValid = verifySignature(params.signatureHex, hex, params.publicKeyHex);
  const seed = deriveSeed(params.signatureHex);
  const seedHex = seed.toString(16).padStart(64, '0');
  if (params.gameType === 'BALL') {
    return {
      payloadCell: cell,
      payloadHex: hex,
      signatureValid,
      seedHex,
      seed,
      ball: deriveBallNumbers(seed),
      hundredK: null,
    };
  }
  const k = Math.min(100, params.totalTicketsSold);
  return {
    payloadCell: cell,
    payloadHex: hex,
    signatureValid,
    seedHex,
    seed,
    ball: null,
    hundredK: sampleFeistelWinners(seed, params.roundId, params.totalTicketsSold, k),
  };
}

export function winnerPlace(index: number): number {
  return placeForWinnerIndex(index);
}


