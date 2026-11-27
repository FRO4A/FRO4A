import type { Deployments } from '../types/deployments';
import {
  isConfiguredAddress,
  isMainnetFactoryConfigured,
  MAINNET_DEPLOYMENT,
  missingMainnetFactories,
  type MainnetDeploymentManifest,
} from './mainnetDeployment';

/**
 * Read-only mirror of `shared/deployments/testnet.json`.
 *
 * The FRO4A API is always the primary source for live pricing and admin/treasury
 * addresses; this manifest is the deployment fallback and the source of the
 * factory / round-1 contract links. No price is ever assumed for Mainnet.
 */
export const TESTNET_DEPLOYMENTS: Deployments = {
  network: 'testnet',
  version: 'v5',
  adminAddress: 'EQDeLewjWId6lshlusHxHXvJTlG2dM_tXdyKzqzW5SsiBs5d',
  treasuryAddress: 'EQBRJRTzsjEmzTWSuhNanPoakap16p-hQGW1G3R_WVhWxzzd',
  vrfPublicKey: '95dc46c710a37024bbfc4e6c9bb03d88b0240de8de56c4fd6627bc1f8ffe3086',
  ballFactory: 'EQANFErztU7m0lSZctUUQpuvP9la_Cg7A1EbfsRlDA_3_RI9',
  ballDrawRound1: 'EQBDmEwZzUyiftLmi15PZZx6sppUExd8jQ925E-4cnjqBqKy',
  draw100kFactory: 'EQD3gRUTFHOlx1gEHGSC0B37KUJwgtJyhmNyMsRC0pP_w5aE',
  draw100kRound1: 'EQCwV2WQRwVyd0XH4jUiNaoe0zpSW1-72VhumeRzaNXE13Gf',
  ball: {
    tallyDuration: 120,
    maxBatchSize: 12,
    batchBaseGas: '80000000',
    mintValue: '60000000',
    ticketStorageReserve: '12000000',
  },
  hundredK: {
    maxPackSize: 100,
    batchGasBuffer: '100000000',
    packStorageReserve: '12000000',
  },
  pricing: {
    ball: {
      ticketBody: '200000000',
      companyFee: '20000000',
      ticketPrice: '220000000',
      minBuyValue: '300000000',
      minStorageReserve: '200000000',
    },
    '100k': {
      ticketBody: '100000000',
      companyFee: '10000000',
      ticketPrice: '110000000',
      minBuyValue: '190000000',
      minStorageReserve: '200000000',
    },
  },
  deployedAt: '2026-11-25T06:20:00.000Z',
};

/**
 * Real network switch driven exclusively by `VITE_NETWORK` (`mainnet` | `testnet`).
 *
 * Everything network-dependent is derived from this value:
 *   - `ACTIVE_DEPLOYMENTS` (canonical V5 Mainnet factories vs Testnet manifest)
 *   - `TONAPI_BASE_URL` (`tonapi.io/v2` vs `testnet.tonapi.io/v2`)
 *   - `TONVIEWER_BASE` (`tonviewer.com` vs `testnet.tonviewer.com`)
 *   - `EXPECTED_TON_CHAIN_ID` (`-239` vs `-3`) for the TON Connect guard.
 */
export type NetworkName = 'mainnet' | 'testnet';

export const NETWORK: NetworkName =
  (import.meta.env.VITE_NETWORK ?? 'testnet').trim().toLowerCase() === 'mainnet' ? 'mainnet' : 'testnet';

/**
 * Public-only view of the Mainnet manifest. `null` factory addresses become `''`
 * so the UI has no ambiguous "undefined" state; `assertActiveNetworkReady`
 * fails closed before any transaction is built.
 */
export function buildMainnetDeployments(manifest: MainnetDeploymentManifest): Deployments {
  const ballPricing = manifest.pricing.ball;
  const hundredPricing = manifest.pricing['100k'];
  return {
    network: 'mainnet',
    version: manifest.version,
    adminAddress: manifest.adminAddress ?? '',
    treasuryAddress: manifest.treasuryAddress ?? '',
    vrfPublicKey: manifest.vrfPublicKey ?? '',
    ballFactory: manifest.ballFactory ?? '',
    ballDrawRound1: manifest.ballDrawRound1 ?? '',
    draw100kFactory: manifest.draw100kFactory ?? '',
    draw100kRound1: manifest.draw100kRound1 ?? '',
    ball: manifest.ball ?? undefined,
    hundredK: manifest.hundredK ?? undefined,
    pricing: {
      ball: ballPricing ?? {
        ticketBody: '2000000000',
        companyFee: '200000000',
        ticketPrice: '2200000000',
        minBuyValue: '3000000000',
        minStorageReserve: '2000000000',
      },
      '100k': hundredPricing ?? {
        ticketBody: '1000000000',
        companyFee: '100000000',
        ticketPrice: '1100000000',
        minBuyValue: '1900000000',
        minStorageReserve: '2000000000',
      },
    },
    deployedAt: manifest.deployedAt ?? '',
  };
}

/** Canonical V5 Mainnet deployment (placeholder `null` factories before Step 4). */
export const MAINNET_DEPLOYMENTS: Deployments = buildMainnetDeployments(MAINNET_DEPLOYMENT);

export const ACTIVE_DEPLOYMENTS: Deployments =
  NETWORK === 'mainnet' ? MAINNET_DEPLOYMENTS : TESTNET_DEPLOYMENTS;

/** TON Connect `wallet.account.chain` expected for the active app network. */
export const EXPECTED_TON_CHAIN_ID = NETWORK === 'mainnet' ? '-239' : '-3';

/** Explorer + public TON API bases for one network (pure, unit-tested). */
export function networkEndpointsFor(network: NetworkName): {
  tonviewerBase: string;
  tonapiBase: string;
  chainId: string;
} {
  return network === 'mainnet'
    ? { tonviewerBase: 'https://tonviewer.com', tonapiBase: 'https://tonapi.io/v2', chainId: '-239' }
    : {
        tonviewerBase: 'https://testnet.tonviewer.com',
        tonapiBase: 'https://testnet.tonapi.io/v2',
        chainId: '-3',
      };
}

/** Hard build/runtime guard for an undeployed Mainnet manifest. */
export class MainnetDeploymentError extends Error {
  constructor(
    public readonly missing: string[],
    message: string,
  ) {
    super(message);
    this.name = 'MainnetDeploymentError';
  }
}

/** Missing canonical factories for the active network (`[]` on Testnet). */
export function missingActiveFactories(): string[] {
  if (NETWORK !== 'mainnet') return [];
  return missingMainnetFactories(MAINNET_DEPLOYMENT);
}

/** True when the active network has a canonical factory for this game. */
export function isActiveFactoryConfigured(gameType?: 'BALL' | '100K'): boolean {
  if (NETWORK !== 'mainnet') return true;
  if (gameType === 'BALL') return isConfiguredAddress(MAINNET_DEPLOYMENT.ballFactory);
  if (gameType === '100K') return isConfiguredAddress(MAINNET_DEPLOYMENT.draw100kFactory);
  return isMainnetFactoryConfigured(MAINNET_DEPLOYMENT);
}

/**
 * Pure fail-closed guard for a Mainnet manifest (unit-tested without env
 * switching). Throws while any canonical factory is missing.
 */
export function assertMainnetManifestReady(
  manifest: MainnetDeploymentManifest,
  gameType?: 'BALL' | '100K',
): void {
  const missing = missingMainnetFactories(manifest);
  if (missing.length > 0) {
    throw new MainnetDeploymentError(
      missing,
      `Mainnet V5 is not deployed yet: missing canonical ${missing.join(' / ')}. Run the Step 4 deployment and scripts/sync-mainnet-manifest-to-interface.mjs first.`,
    );
  }
  if (gameType === 'BALL' && !isConfiguredAddress(manifest.ballFactory)) {
    throw new MainnetDeploymentError(['ballFactory'], 'Mainnet BALL factory is not configured.');
  }
  if (gameType === '100K' && !isConfiguredAddress(manifest.draw100kFactory)) {
    throw new MainnetDeploymentError(['draw100kFactory'], 'Mainnet 100K factory is not configured.');
  }
}

/**
 * Fail-closed guard: refuses to build ANY Mainnet transaction while the canonical
 * factory addresses are still missing. Never called for the Testnet build.
 */
export function assertActiveNetworkReady(gameType?: 'BALL' | '100K'): void {
  if (NETWORK !== 'mainnet') return;
  assertMainnetManifestReady(MAINNET_DEPLOYMENT, gameType);
}

/**
 * Empty (`VITE_API_BASE_URL=`) or `/` means same-origin relative requests.
 *
 * In the hybrid deployment this constant is only the LAST fallback: production
 * builds resolve the backend strictly from the repository-controlled
 * `runtime-config.json` (an attacker-supplied `?api=` / Telegram start_param is
 * never honoured), while local dev additionally accepts a localhost override.
 * See `src/lib/runtimeConfig.ts`.
 */
const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
export const API_BASE_URL = configuredApiBaseUrl === '/' ? '' : configuredApiBaseUrl.replace(/\/+$/, '');

/** Public TON API for the ACTIVE network (env override still supported). */
export const TONAPI_BASE_URL = (
  import.meta.env.VITE_TONAPI_BASE_URL ?? networkEndpointsFor(NETWORK).tonapiBase
).replace(/\/+$/, '');

export const TONAPI_KEY = import.meta.env.VITE_TONAPI_KEY ?? '';

/** Explorer links always match the ACTIVE network. */
export const TONVIEWER_BASE = networkEndpointsFor(NETWORK).tonviewerBase;

export function tonviewerAddressUrl(address: string): string {
  if (!isConfiguredAddress(address)) return '';
  return `${TONVIEWER_BASE}/${encodeURIComponent(address)}`;
}

/**
 * Canonical production manifest. TON Connect 2.0 wallets (Tonkeeper, Telegram
 * Wallet) reject relative `url` / `iconUrl` values, so the published GitHub
 * Pages manifest is always referenced by its absolute HTTPS address.
 */
export const PAGES_BASE_URL = 'https://fro4a.github.io/FRO4A/';
export const PAGES_MANIFEST_URL = `${PAGES_BASE_URL}tonconnect-manifest.json`;

/** Hosts where the Mini App is served from the published GitHub Pages bundle. */
function isPublishedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'github.io' ||
    host.endsWith('.github.io') ||
    host === 'telegram.org' ||
    host.endsWith('.telegram.org')
  );
}

/**
 * Directory of the current document, always with a trailing slash.
 * `/FRO4A`, `/FRO4A/`, `/FRO4A/index.html` and `/FRO4A/index.html?x=1`
 * all resolve to `/FRO4A/`.
 */
function documentDirectory(pathname: string): string {
  if (pathname.length === 0) return '/';
  if (pathname.endsWith('/')) return pathname;
  const lastSlash = pathname.lastIndexOf('/');
  const lastSegment = pathname.slice(lastSlash + 1);
  if (lastSegment.includes('.')) return pathname.slice(0, lastSlash + 1);
  return `${pathname}/`;
}

/**
 * Resolve the TON Connect manifest URL for one page location.
 *
 * Query strings and hashes are NEVER forwarded: a stale `?api=<dead tunnel>`
 * left in `@BotFather` (or any tracking param) must not corrupt `manifestUrl`,
 * otherwise wallets report "Invalid manifest / Unable to load a valid manifest".
 */
export function resolveManifestUrlForLocation(href: string): string {
  try {
    const location = new URL(href);
    // GitHub Pages / Telegram Web always use the published absolute manifest.
    if (isPublishedHost(location.hostname)) return PAGES_MANIFEST_URL;
    // Any other host (local Vite dev, self-hosted tunnel) resolves relatively,
    // but still against a clean origin + directory without `?query`/`#hash`.
    const directory = `${location.origin}${documentDirectory(location.pathname)}`;
    return new URL('tonconnect-manifest.json', directory).toString();
  } catch {
    return PAGES_MANIFEST_URL;
  }
}

/**
 * Absolute HTTPS TON Connect manifest URL for the current app shell.
 *
 * Order: explicit `VITE_TONCONNECT_MANIFEST_URL` override, then the published
 * GitHub Pages manifest (production/Telegram), then a query-free same-origin
 * resolution for local development.
 */
export function resolveManifestUrl(): string {
  const configured = (import.meta.env.VITE_TONCONNECT_MANIFEST_URL ?? '').trim();
  if (configured.length > 0) return configured;
  if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
    return resolveManifestUrlForLocation(window.location.href);
  }
  return PAGES_MANIFEST_URL;
}

