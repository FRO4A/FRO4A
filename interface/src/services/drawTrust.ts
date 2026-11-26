import { ACTIVE_DEPLOYMENTS } from '../config/deployments';
import type { GameType } from '../types/game';
import { sameAddress } from '../utils/address';
import { runGetter, stackAddress } from './tonapi';

/**
 * On-chain deterministic draw-address verification (anti-phishing).
 *
 * Threat: if the FRO4A backend or its Cloudflare tunnel is ever compromised,
 * it could return a malicious `drawAddress` for a dynamic round (Round 2+).
 * The UI would then build a TON Connect `BuyTicket` / `Claim` / `Refund`
 * message that sends real TON to an attacker wallet.
 *
 * Fix: before any wallet prompt, the target draw address must match the
 * canonical address the immutable on-chain Factory reports for that
 * `roundId` (`getDrawAddress(roundId)`), cached per `gameType:roundId`.
 * Round 1 additionally has a repository-controlled manifest anchor, used only
 * when the public RPC is temporarily unreachable.
 *
 * Fail-closed: when a non-round-1 address cannot be verified, the transaction
 * is blocked instead of being signed blindly.
 */

export const UNTRUSTED_DRAW_ADDRESS = 'UNTRUSTED_DRAW_ADDRESS' as const;
export const UNVERIFIABLE_DRAW_ADDRESS = 'DRAW_ADDRESS_UNVERIFIABLE' as const;

export type DrawSecurityCode = typeof UNTRUSTED_DRAW_ADDRESS | typeof UNVERIFIABLE_DRAW_ADDRESS;

/** Hard security error: the TON Connect prompt must never be opened. */
export class DrawAddressSecurityError extends Error {
  constructor(
    public readonly code: DrawSecurityCode,
    message: string,
  ) {
    super(message);
    this.name = 'DrawAddressSecurityError';
  }
}

/** User-facing text for a blocked wallet prompt (localised fallback is generic). */
export const BLOCKED_TRANSACTION_MESSAGE =
  'Transaction blocked: the draw contract address failed on-chain verification against the immutable FRO4A factory.';

export interface DrawTarget {
  gameType: GameType;
  roundId: number;
  drawAddress: string;
}

/** Injectable RPC read (`getDrawAddress(roundId)`), defaults to public TonAPI. */
export type DrawAddressReader = (
  factoryAddress: string,
  roundId: number,
  signal?: AbortSignal,
) => Promise<string | null>;

/** Immutable factory address from the repository-controlled manifest. */
export function factoryAddressFor(gameType: GameType): string {
  return gameType === 'BALL' ? ACTIVE_DEPLOYMENTS.ballFactory : ACTIVE_DEPLOYMENTS.draw100kFactory;
}

/** Round-1 draw address committed in the repository manifest (offline anchor). */
export function manifestDrawAddressFor(gameType: GameType, roundId: number): string | null {
  if (roundId !== 1) return null;
  return gameType === 'BALL' ? ACTIVE_DEPLOYMENTS.ballDrawRound1 : ACTIVE_DEPLOYMENTS.draw100kRound1;
}

/**
 * Read the canonical draw address straight from the factory contract.
 * Returns `null` when the public RPC is unreachable or the getter fails; the
 * caller then either uses the round-1 manifest anchor or fails closed.
 */
export async function readFactoryDrawAddress(
  factoryAddress: string,
  roundId: number,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const result = await runGetter(factoryAddress, 'getDrawAddress', signal, [roundId]);
    if (result.exitCode !== 0) return null;
    const address = stackAddress(result.stack[0]);
    return address === null ? null : address.toString();
  } catch {
    return null;
  }
}


const canonicalByRound = new Map<string, string>();
const pendingByRound = new Map<string, Promise<string>>();

/** Test-only helper: drop every cached canonical address. */
export function resetDrawAddressCache(): void {
  canonicalByRound.clear();
  pendingByRound.clear();
}

function roundCacheKey(target: Pick<DrawTarget, 'gameType' | 'roundId'>): string {
  return `${target.gameType}:${target.roundId}`;
}

async function resolveCanonicalDrawAddress(
  target: Pick<DrawTarget, 'gameType' | 'roundId'>,
  reader: DrawAddressReader,
  signal?: AbortSignal,
): Promise<string> {
  const key = roundCacheKey(target);
  const cached = canonicalByRound.get(key);
  if (cached !== undefined) return cached;

  const pending = pendingByRound.get(key);
  if (pending !== undefined) return pending;

  const resolution = (async (): Promise<string> => {
    const onChain = await reader(factoryAddressFor(target.gameType), target.roundId, signal);
    if (onChain !== null && onChain.length > 0) return onChain;
    const manifest = manifestDrawAddressFor(target.gameType, target.roundId);
    if (manifest !== null) return manifest;
    throw new DrawAddressSecurityError(
      UNVERIFIABLE_DRAW_ADDRESS,
      `Cannot verify ${target.gameType} round ${target.roundId}: the factory getter is unavailable and no manifest anchor exists`,
    );
  })();

  pendingByRound.set(key, resolution);
  try {
    const canonical = await resolution;
    canonicalByRound.set(key, canonical);
    return canonical;
  } finally {
    pendingByRound.delete(key);
  }
}

/**
 * Throws `UNTRUSTED_DRAW_ADDRESS` when an API-supplied `drawAddress` does not
 * match the immutable factory's canonical address for `gameType:roundId`.
 *
 * Must be awaited BEFORE `sendTransaction` builds a wallet prompt.
 */
export async function assertTrustedDrawAddress(
  target: DrawTarget,
  reader: DrawAddressReader = readFactoryDrawAddress,
  signal?: AbortSignal,
): Promise<string> {
  if (!Number.isInteger(target.roundId) || target.roundId < 1) {
    throw new DrawAddressSecurityError(
      UNTRUSTED_DRAW_ADDRESS,
      `Blocked transaction: invalid roundId ${String(target.roundId)}`,
    );
  }

  let canonical: string;
  try {
    canonical = await resolveCanonicalDrawAddress(target, reader, signal);
  } catch (error) {
    if (error instanceof DrawAddressSecurityError) throw error;
    throw new DrawAddressSecurityError(
      UNVERIFIABLE_DRAW_ADDRESS,
      `Cannot verify ${target.gameType} round ${target.roundId}: on-chain lookup failed`,
    );
  }

  if (!sameAddress(target.drawAddress, canonical)) {
    throw new DrawAddressSecurityError(
      UNTRUSTED_DRAW_ADDRESS,
      `Blocked transaction: ${target.gameType} round ${target.roundId} drawAddress ${target.drawAddress} is not the canonical on-chain contract`,
    );
  }
  return canonical;
}
