import type { AvailabilityState } from './ballBasket';
import { fetchAccountState, runGetter, stackAddress } from './tonapi';

/**
 * Hard BALL duplicate guard, verified directly on the TON blockchain.
 *
 * `BallDrawInstance` exposes `getTicketAddress(packedCombination)`, and the V5
 * `BallTicket` address is `contractAddress(initOf BallTicket(draw, packed))`.
 * Therefore:
 *
 *   getTicketAddress(packed) -> account status `uninit`  => combination is FREE
 *                            -> account active + owner     => combination is TAKEN
 *
 * This is lag-free: it does not depend on the FRO4A indexer or on any token index
 * (V5 has no token layer at all).
 */

export type ChainAvailability = 'available' | 'taken' | 'unknown';

export interface ChainAvailabilityResult {
  status: ChainAvailability;
  ticketAddress: string | null;
}

/** Deterministic V5 BallTicket address for a packed combination (via the draw getter). */
export async function resolveBallTicketAddress(
  drawAddress: string,
  packed: bigint,
  signal?: AbortSignal,
): Promise<string | null> {
  const result = await runGetter(drawAddress, 'getTicketAddress', signal, [packed]);
  if (result.exitCode !== 0) return null;
  const address = stackAddress(result.stack[0]);
  return address === null ? null : address.toString({ bounceable: true });
}

/**
 * Owner of a deployed BallTicket.
 *
 * V5 getter: `getTicketData()` returns a flattened tuple
 *   [drawAddress, roundId, owner, packedCombination, white1..5, red, tallied, claimed]
 * A legacy `getTicketInfo()` fallback keeps older Testnet deployments readable.
 */
async function readBallTicketOwner(
  ticketAddress: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; owner: ReturnType<typeof stackAddress> }> {
  try {
    const v5 = await runGetter(ticketAddress, 'getTicketData', signal);
    // A real V5 response has 12 stack items; a malformed/foreign response must
    // fall through to the legacy getter instead of reporting "no owner".
    if (v5.exitCode === 0 && v5.stack.length >= 3) {
      return { ok: true, owner: stackAddress(v5.stack[2]) };
    }
  } catch {
    // fall through to the legacy getter
  }
  try {
    const legacy = await runGetter(ticketAddress, 'getTicketInfo', signal);
    if (legacy.exitCode === 0) return { ok: true, owner: stackAddress(legacy.stack[1]) };
  } catch {
    // unknown ticket: caller fails closed as `unknown`
  }
  return { ok: false, owner: null };
}

const FREE_STATES = new Set(['uninit', 'nonexistent', 'frozen']);

/** True on-chain availability check for one combination. */
export async function checkBallCombinationOnChain(
  drawAddress: string,
  packed: bigint,
  signal?: AbortSignal,
): Promise<ChainAvailabilityResult> {
  try {
    const ticketAddress = await resolveBallTicketAddress(drawAddress, packed, signal);
    if (ticketAddress === null) return { status: 'unknown', ticketAddress: null };

    const account = await fetchAccountState(ticketAddress, signal);
    if (account === null) return { status: 'available', ticketAddress };
    const state = typeof account.status === 'string' ? account.status : 'unknown';
    if (FREE_STATES.has(state)) return { status: 'available', ticketAddress };
    if (state !== 'active') return { status: 'unknown', ticketAddress };

    // Deployed: the owner is assigned atomically by the first MintTicket, so a
    // non-null owner proves the combination is already tokenized.
    const info = await readBallTicketOwner(ticketAddress, signal);
    if (!info.ok) return { status: 'unknown', ticketAddress };
    return { status: info.owner === null ? 'available' : 'taken', ticketAddress };
  } catch {
    return { status: 'unknown', ticketAddress: null };
  }
}

/** Bounded-concurrency check for a basket / quick-pick batch. */
export async function checkBallCombinationsOnChain(
  drawAddress: string,
  packedList: readonly bigint[],
  signal?: AbortSignal,
  limit = 3,
): Promise<Record<string, ChainAvailabilityResult>> {
  const results: Record<string, ChainAvailabilityResult> = {};
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < packedList.length) {
      const index = cursor;
      cursor += 1;
      const packed = packedList[index];
      results[packed.toString()] = await checkBallCombinationOnChain(drawAddress, packed, signal);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, packedList.length) }, () => worker()));
  return results;
}

/**
 * Pure 0 ms UI decision: combines the live server taken Set with the local
 * basket. No network call is involved, so picking balls never freezes.
 */
export function decideSelectionStatus(input: {
  complete: boolean;
  inBasket: boolean;
  serverTaken: boolean;
}): AvailabilityState {
  if (!input.complete) return 'idle';
  if (input.serverTaken) return 'taken';
  if (input.inBasket) return 'taken';
  return 'available';
}
