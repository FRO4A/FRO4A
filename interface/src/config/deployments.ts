import type { Deployments } from '../types/deployments';

/**
 * Read-only mirror of `shared/deployments/testnet.json`.
 *
 * The FRO4A API is always the primary source for live pricing and admin/treasury
 * addresses; this manifest is the deployment fallback and the source of the
 * factory / round-1 contract links. No price is ever assumed for Mainnet.
 */
export const TESTNET_DEPLOYMENTS: Deployments = {
  network: 'testnet',
  version: 'v4',
  adminAddress: 'EQDeLewjWId6lshlusHxHXvJTlG2dM_tXdyKzqzW5SsiBs5d',
  treasuryAddress: 'EQBRJRTzsjEmzTWSuhNanPoakap16p-hQGW1G3R_WVhWxzzd',
  vrfPublicKey: '95dc46c710a37024bbfc4e6c9bb03d88b0240de8de56c4fd6627bc1f8ffe3086',
  ballFactory: 'EQANFErztU7m0lSZctUUQpuvP9la_Cg7A1EbfsRlDA_3_RI9',
  ballDrawRound1: 'EQBDmEwZzUyiftLmi15PZZx6sppUExd8jQ925E-4cnjqBqKy',
  draw100kFactory: 'EQD3gRUTFHOlx1gEHGSC0B37KUJwgtJyhmNyMsRC0pP_w5aE',
  draw100kRound1: 'EQCwV2WQRwVyd0XH4jUiNaoe0zpSW1-72VhumeRzaNXE13Gf',
  ball: {
    tallyDuration: 120,
    nftBaseUrl: 'https://zoophoric-rihanna-solvently.ngrok-free.dev',
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
 * Label-only network switch. The FRO4A deployment currently exists exclusively
 * on TON Testnet, so `ACTIVE_DEPLOYMENTS`, the public TON API and every explorer
 * link below are pinned to Testnet regardless of this value.
 */
export const NETWORK = (import.meta.env.VITE_NETWORK ?? 'testnet').toLowerCase() === 'mainnet' ? 'mainnet' : 'testnet';

export const ACTIVE_DEPLOYMENTS: Deployments = TESTNET_DEPLOYMENTS;

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

/** Public TON API — Testnet by default, never `https://tonapi.io/v2` (Mainnet). */
export const TONAPI_BASE_URL = (
  import.meta.env.VITE_TONAPI_BASE_URL ?? 'https://testnet.tonapi.io/v2'
).replace(/\/+$/, '');

export const TONAPI_KEY = import.meta.env.VITE_TONAPI_KEY ?? '';

/** Explorer links always point at Testnet (`https://testnet.tonviewer.com`). */
export const TONVIEWER_BASE = 'https://testnet.tonviewer.com';

export function tonviewerAddressUrl(address: string): string {
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

