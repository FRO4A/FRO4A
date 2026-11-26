import type { AvailabilityState } from './ballBasket';
import { fetchAccountState, runGetter, stackAddress } from './tonapi';

/**
 * Hard BALL duplicate guard, verified directly on the TON blockchain.
 *
 * `BallDrawInstance` exposes `getTicketAddress(packedCombination)`, and the SBT
 * address is `contractAddress(initOf BallTicketSBT(draw, packedCombination))`.
 * Therefore:
 *
 *   getTicketAddress(packed) -> account status `uninit`  => combination is FREE
 *                            -> account active + owner     => combination is TAKEN
 *
 * This is lag-free: it does not depend on the FRO4A indexer or on TonAPI's NFT
 * indexer. Verified against live Testnet: `getTicketAddress(704499257501)` returns
 * the exact SBT `0:bd74c202…` whose `getTicketInfo` reports the buyer as owner.
 */

export type ChainAvailability = 'available' | 'taken' | 'unknown';

export interface ChainAvailabilityResult {
  status: ChainAvailability;
  ticketAddress: string | null;
}

/** Deterministic SBT address for a packed combination (via the draw getter). */
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
    const info = await runGetter(ticketAddress, 'getTicketInfo', signal);
    if (info.exitCode !== 0) return { status: 'unknown', ticketAddress };
    const owner = stackAddress(info.stack[1]);
    return { status: owner === null ? 'available' : 'taken', ticketAddress };
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
