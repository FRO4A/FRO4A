import type { GameType } from '../types/game';
import { addressKey } from '../utils/address';
import { ballTicketAddress } from './ballTicketAddress';
import { runGetter, stackAddress, stackNumber } from './tonapi';

/**
 * Genuine ticket / pack contract verification (anti-phishing, fail-closed).
 *
 * `drawTrust.ts` proves that a round's `drawAddress` is the canonical contract
 * the immutable factory deploys. That is NOT enough for Claim / Refund: the
 * wallet message is sent to the ticket / pack contract, not to the draw.
 *
 * Threat: a compromised FRO4A backend (or a MITM) answers
 * `/api/chain/tickets/:wallet` with the CORRECT public `drawAddress` but an
 * attacker-controlled `ticketAddress` (BALL) / `packAddress` (100K). The UI used
 * to pass the draw check and then open Tonkeeper with
 * `0x3008 / 0x3009 / 0x3011 / 0x3012` addressed to the attacker's wallet,
 * gifting it the attached TON.
 *
 * Fix (both games, before ANY wallet prompt):
 *   BALL — the genuine address is deterministic and fully local:
 *          contractAddress(initOf BallTicket(canonicalDraw, packedCombination))
 *          derived with the pinned compiled code (`ballTicketCode.ts`).
 *   100K — the pack is read on-chain (`getPackInfo`) and the returned
 *          `drawAddress` must equal the canonical draw, while `owner` must be
 *          the connected wallet.
 * Anything that cannot be verified blocks the transaction instead of signing it.
 */

export const UNTRUSTED_TICKET_ADDRESS = 'UNTRUSTED_TICKET_ADDRESS' as const;
export const UNVERIFIABLE_TICKET_ADDRESS = 'TICKET_ADDRESS_UNVERIFIABLE' as const;

export type TicketSecurityCode =
  | typeof UNTRUSTED_TICKET_ADDRESS
  | typeof UNVERIFIABLE_TICKET_ADDRESS;

/** Hard security error: the TON Connect prompt must never be opened. */
export class TicketAddressSecurityError extends Error {
  constructor(
    public readonly code: TicketSecurityCode,
    message: string,
  ) {
    super(message);
    this.name = 'TicketAddressSecurityError';
  }
}

/** User-facing text for a blocked claim / refund (same wording pattern as drawTrust). */
export const BLOCKED_TICKET_TRANSACTION_MESSAGE =
  'Transaction blocked: the ticket contract failed on-chain verification against the immutable FRO4A factory and the connected wallet.';

/** On-chain `Ticket100kPack.getPackInfo()` view (7-field Tact struct). */
export interface PackState {
  drawAddress: string | null;
  roundId: number | null;
  owner: string | null;
  startNumber: number | null;
  count: number | null;
  status: number | null;
}

/** Injectable RPC read (`getPackInfo()`), defaults to public TonAPI. */
export type PackStateReader = (packAddress: string, signal?: AbortSignal) => Promise<PackState | null>;

function toSafeNumber(value: bigint | null): number | null {
  if (value === null) return null;
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(value);
}

/**
 * Reads `Ticket100kPack.getPackInfo()`:
 *   [drawAddress, roundId, owner?, startNumber, count, status, paidAmount]
 *
 * Returns `null` when the account is not deployed / the getter fails, which the
 * caller treats as UNVERIFIABLE and therefore blocks.
 */
export async function readPackState(packAddress: string, signal?: AbortSignal): Promise<PackState | null> {
  try {
    const result = await runGetter(packAddress, 'getPackInfo', signal);
    if (result.exitCode !== 0) return null;
    const stack = result.stack;
    if (stack.length < 5) return null;
    const drawAddress = stackAddress(stack[0]);
    const owner = stackAddress(stack[2]);
    return {
      drawAddress: drawAddress === null ? null : drawAddress.toString(),
      roundId: toSafeNumber(stackNumber(stack[1])),
      owner: owner === null ? null : owner.toString(),
      startNumber: toSafeNumber(stackNumber(stack[3])),
      count: toSafeNumber(stackNumber(stack[4])),
      status: toSafeNumber(stackNumber(stack[5])),
    };
  } catch {
    return null;
  }
}

function normalizePacked(value: string | bigint | number | null | undefined): bigint | null {
  if (typeof value === 'bigint') return value >= 0n ? value : null;
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  try {
    const parsed = BigInt(trimmed);
    return parsed >= 0n ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Byte-for-byte contract identity: both values must parse to the SAME workchain
 * + 256-bit hash. Any unparsable (e.g. attacker) string is a mismatch.
 */
function assertExactContract(actual: string | null, expected: string, label: string): void {
  const actualKey = addressKey(actual);
  const expectedKey = addressKey(expected);
  if (actualKey === null || expectedKey === null || actualKey !== expectedKey) {
    throw new TicketAddressSecurityError(
      UNTRUSTED_TICKET_ADDRESS,
      `Blocked transaction: ${label} ${actual ?? '(none)'} is not the genuine contract ${expected}`,
    );
  }
}

/** BALL `BallTicket`: the target must be the locally derived V5 address. */
export interface BallTicketTrustTarget {
  gameType: 'BALL';
  /** Canonical draw address, already verified against the pinned factory. */
  drawAddress: string;
  /** Address supplied by the (possibly hostile) API payload. */
  ticketAddress: string;
  /** On-chain packed 5+1 combination (decimal string / bigint). */
  packedCombination: string | bigint | number | null | undefined;
}

/** 100K `Ticket100kPack`: draw + owner are proven with the live getter. */
export interface HundredKPackTrustTarget {
  gameType: '100K';
  /** Canonical draw address, already verified against the pinned factory. */
  drawAddress: string;
  /** Address supplied by the (possibly hostile) API payload. */
  ticketAddress: string;
  /** Connected wallet that must be the on-chain pack owner. */
  expectedOwner: string;
  /** Test seam only; production always uses the public TonAPI reader. */
  reader?: PackStateReader;
  signal?: AbortSignal;
}

export type TicketTrustTarget = BallTicketTrustTarget | HundredKPackTrustTarget;

/**
 * Verifies a Claim / Refund destination contract BEFORE the wallet prompt.
 *
 * @returns the verified contract address (the only address the wallet may sign).
 * @throws TicketAddressSecurityError when spoofed or unverifiable.
 */
export async function assertTrustedTicketAddress(target: TicketTrustTarget): Promise<string> {
  if (target.gameType === 'BALL') {
    const packed = normalizePacked(target.packedCombination);
    if (packed === null) {
      throw new TicketAddressSecurityError(
        UNVERIFIABLE_TICKET_ADDRESS,
        'Cannot verify BALL ticket: the on-chain packed combination is missing from the ticket payload',
      );
    }
    let derived: string;
    try {
      derived = ballTicketAddress(target.drawAddress, packed);
    } catch {
      throw new TicketAddressSecurityError(
        UNVERIFIABLE_TICKET_ADDRESS,
        `Cannot verify BALL ticket: the canonical draw ${target.drawAddress} is not a valid TON address`,
      );
    }
    assertExactContract(target.ticketAddress, derived, 'BALL ticket contract');
    return derived;
  }

  // 100K: the pack address is API supplied, so it is proven against the chain.
  if (addressKey(target.ticketAddress) === null) {
    throw new TicketAddressSecurityError(
      UNTRUSTED_TICKET_ADDRESS,
      `Blocked transaction: 100K pack address ${target.ticketAddress} is not a valid TON contract address`,
    );
  }
  if (addressKey(target.expectedOwner) === null) {
    throw new TicketAddressSecurityError(
      UNTRUSTED_TICKET_ADDRESS,
      'Blocked transaction: no connected wallet to bind the 100K pack owner to',
    );
  }

  const state = await (target.reader ?? readPackState)(target.ticketAddress, target.signal);
  if (state === null) {
    throw new TicketAddressSecurityError(
      UNVERIFIABLE_TICKET_ADDRESS,
      `Cannot verify 100K pack ${target.ticketAddress}: getPackInfo() is unavailable`,
    );
  }
  if (state.drawAddress === null) {
    throw new TicketAddressSecurityError(
      UNVERIFIABLE_TICKET_ADDRESS,
      `Cannot verify 100K pack ${target.ticketAddress}: the contract reports no draw address`,
    );
  }
  assertExactContract(state.drawAddress, target.drawAddress, `100K pack ${target.ticketAddress} draw contract`);
  if (state.owner === null) {
    throw new TicketAddressSecurityError(
      UNTRUSTED_TICKET_ADDRESS,
      `Blocked transaction: 100K pack ${target.ticketAddress} has no on-chain owner`,
    );
  }
  assertExactContract(state.owner, target.expectedOwner, `100K pack ${target.ticketAddress} owner`);
  if (state.count === null || state.count < 1) {
    throw new TicketAddressSecurityError(
      UNTRUSTED_TICKET_ADDRESS,
      `Blocked transaction: 100K pack ${target.ticketAddress} was never minted (count = 0)`,
    );
  }
  return target.ticketAddress;
}

/** One verified Claim / Refund target, shared by the UI and `sendTransaction`. */
export interface TicketContractGuard {
  address: string;
  /** BALL only: the packed combination the address must be derived from. */
  packedCombination?: string | bigint | null;
  /** 100K only: the connected wallet that must own the pack. */
  owner?: string | null;
}

/**
 * Builds the Claim / Refund guard from a `TicketView`-shaped payload.
 *
 * For BALL the packed combination falls back to `ticketKey` (V5 stores the
 * packed combination there), so a payload that omits `packedCombination` still
 * fails closed instead of being signed blindly.
 */
export function ticketContractGuard(input: {
  gameType: GameType;
  ticketAddress: string;
  packedCombination?: string | bigint | null;
  ticketKey?: string | null;
  owner?: string | null;
}): TicketContractGuard {
  if (input.gameType === 'BALL') {
    return {
      address: input.ticketAddress,
      packedCombination: input.packedCombination ?? input.ticketKey ?? null,
    };
  }
  return { address: input.ticketAddress, owner: input.owner ?? null };
}


