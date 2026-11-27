import { EXPECTED_TON_CHAIN_ID, NETWORK, type NetworkName } from '../config/deployments';

/**
 * TON Connect network guard (Mainnet safety).
 *
 * A TON Connect wallet reports its network in `wallet.account.chain`:
 *   Mainnet = `'-239'`, Testnet = `'-3'`.
 *
 * If a wallet is connected to the WRONG network, every transaction built by this
 * app would either be rejected by the wallet or (worse) broadcast on the wrong
 * chain. `sendTransaction` therefore checks this guard FIRST and throws
 * `WrongTonNetworkError` before the wallet prompt is ever opened — covering
 * Buy, Claim, Refund, ForceStartGame and Launch Round in both games.
 */

export const MAINNET_TON_CHAIN_ID = '-239';
export const TESTNET_TON_CHAIN_ID = '-3';

export const WRONG_TON_NETWORK = 'WRONG_TON_NETWORK' as const;

export class WrongTonNetworkError extends Error {
  readonly code = WRONG_TON_NETWORK;

  constructor(
    public readonly expectedChain: string,
    public readonly actualChain: string,
  ) {
    super(
      `Wallet is connected to TON chain ${actualChain}, but this app requires ${expectedChain}. Disconnect the wallet and reconnect on the correct network.`,
    );
    this.name = 'WrongTonNetworkError';
  }
}

/** Expected `wallet.account.chain` for one app network. */
export function expectedChainFor(network: NetworkName): string {
  return network === 'mainnet' ? MAINNET_TON_CHAIN_ID : TESTNET_TON_CHAIN_ID;
}

function normalizeChain(chain: string | number | null | undefined): string | null {
  if (typeof chain === 'number' && Number.isFinite(chain)) return String(Math.trunc(chain));
  if (typeof chain !== 'string') return null;
  const trimmed = chain.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * True only when a CONNECTED wallet reports a different chain than the app.
 * A disconnected wallet (`null` / empty chain) is not a mismatch.
 */
export function isWrongTonNetwork(
  chain: string | number | null | undefined,
  network: NetworkName,
): boolean {
  const actual = normalizeChain(chain);
  if (actual === null) return false;
  return actual !== expectedChainFor(network);
}

/** Throws `WrongTonNetworkError` for a connected wallet on the wrong chain. */
export function assertSigningAllowed(
  chain: string | number | null | undefined,
  network: NetworkName,
): void {
  const actual = normalizeChain(chain);
  if (actual === null) return;
  const expected = expectedChainFor(network);
  if (actual !== expected) throw new WrongTonNetworkError(expected, actual);
}

/*
 * Module-level cache of the last chain reported by `useTonWallet()`.
 * The React hook writes it; `sendTransaction` reads it so EVERY action is gated
 * without threading the wallet object through every call site.
 */
let activeChain: string | null = null;

export function setConnectedTonChain(chain: string | number | null | undefined): void {
  activeChain = normalizeChain(chain);
}

export function getConnectedTonChain(): string | null {
  return activeChain;
}

/** Test helper: clear the cached chain. */
export function resetConnectedTonChain(): void {
  activeChain = null;
}

/** Guard for the ACTIVE build network using the cached connected chain. */
export function assertActiveSigningAllowed(): void {
  assertSigningAllowed(activeChain, NETWORK);
}

/** Expected chain id of the ACTIVE build network. */
export const ACTIVE_EXPECTED_CHAIN_ID = EXPECTED_TON_CHAIN_ID;
export const ACTIVE_NETWORK = NETWORK;
