/**
 * Regression suite for TON Connect wallet networking inside the Telegram Mini
 * App (`https://fro4a.github.io/FRO4A/`).
 *
 * Live bug: wallet tiles rendered as blank dark squares and "Connect" hung
 * forever. Root causes covered here:
 *  - the document CSP used a host allow-list for `img-src` / `connect-src`, so
 *    third-party wallet icons and the independent wallet SSE bridges listed in
 *    `wallets-list-v2.json` were blocked (the wallets list itself lives on
 *    `https://config.ton.org`, which was not allow-listed either);
 *  - the service worker is a second interception point: it must hard-bypass
 *    every cross-origin request so it can neither buffer an SSE bridge stream
 *    nor serve a stale wallet icon.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ORIGIN = 'https://fro4a.github.io';

const indexHtml = readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
const serviceWorkerSource = readFileSync(path.join(PROJECT_ROOT, 'public', 'sw.js'), 'utf8');
const appSource = readFileSync(path.join(PROJECT_ROOT, 'src', 'App.tsx'), 'utf8');
const styles = readFileSync(path.join(PROJECT_ROOT, 'src', 'styles', 'index.css'), 'utf8');
const manifest = JSON.parse(
  readFileSync(path.join(PROJECT_ROOT, 'public', 'tonconnect-manifest.json'), 'utf8'),
) as Record<string, unknown>;

/** Icons advertised by `wallets-v2.json` / the SDK fallback list. */
const WALLET_ICON_URLS = [
  'https://tonkeeper.com/assets/tonconnect-icon.png',
  'https://tonkeeper.com/assets/tonconnect-icon-pro.png',
  'https://tonhub.com/tonconnect_logo.png',
  'https://config.ton.org/assets/mytonwallet.png',
  'https://config.ton.org/assets/telegram_wallet.png',
  'https://static.okx.com/cdn/assets/imgs/2411/8BE1A4A434D8F58A.png',
  'https://public.bnbstatic.com/static/binance-w3w/ton-provider/binancew3w.png',
  'https://raw.githubusercontent.com/ton-connect/sdk/main/assets/walletconnect-icon-288.png',
  'https://cdn.mirailabs.co/miraihub/miraiapp-tg-icon-288.png',
  'https://static.nicegram.app/icon.png',
];

/** Bridges + remote config used while connecting a wallet. */
const WALLET_BRIDGE_URLS = [
  'https://config.ton.org/wallets-v2.json',
  'https://bridge.tonapi.io/bridge/events?client_id=fro4a',
  'https://bridge.ton.space/bridge/events?client_id=fro4a',
  'https://connect.tonhubapi.com/tonconnect/events?client_id=fro4a',
  'https://tonconnectbridge.mytonwallet.org/bridge/events?client_id=fro4a',
  'https://sse-bridge.hot-labs.org/events?client_id=fro4a',
  'https://wallet.binance.com/tonbridge/bridge/events?client_id=fro4a',
  'https://ton-connect-bridge.bgwapi.io/bridge/events?client_id=fro4a',
  'https://bridge.dewallet.pro/bridge/events?client_id=fro4a',
  'https://ton-connect.mytokenpocket.vip/bridge/events?client_id=fro4a',
  'wss://bridge.tonapi.io/bridge',
];

function cspDirectives(): Map<string, string[]> {
  const match = indexHtml.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i,
  );
  const map = new Map<string, string[]>();
  for (const part of (match?.[1] ?? '').split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length > 0) map.set(tokens[0], tokens.slice(1));
  }
  return map;
}

/** Minimal CSP source-list matcher (scheme sources, 'self' and host sources). */
function cspAllows(sources: readonly string[], target: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return false;
  }
  return sources.some((source) => {
    if (source === "'self'") return parsed.origin === ORIGIN;
    if (/^[a-z][a-z0-9+.-]*:$/i.test(source)) return parsed.protocol === source.toLowerCase();
    if (source.startsWith('https://')) {
      const hostPattern = source.slice('https://'.length).split('/')[0];
      if (parsed.protocol !== 'https:') return false;
      return hostPattern.startsWith('*.')
        ? parsed.hostname.endsWith(hostPattern.slice(1))
        : parsed.hostname === hostPattern;
    }
    return false;
  });
}


describe('document CSP: TON Connect wallet icons', () => {
  it('allows HTTPS icons from every wallet CDN used by wallets-v2.json', () => {
    const images = cspDirectives().get('img-src') ?? [];
    expect(images).toContain('https:');
    expect(images).toContain("'self'");
    expect(images).toContain('data:');
    expect(images).toContain('blob:');
    for (const icon of WALLET_ICON_URLS) {
      expect(cspAllows(images, icon), icon).toBe(true);
    }
  });

  it('still refuses insecure image sources and wildcards', () => {
    const images = cspDirectives().get('img-src') ?? [];
    expect(images).not.toContain('*');
    expect(cspAllows(images, 'http://tonkeeper.com/assets/tonconnect-icon.png')).toBe(false);
    // Host-specific entries (e.g. an old tonapi-only allow-list) are gone.
    expect(images.filter((source) => source.includes('//'))).toEqual([]);
  });
});

describe('document CSP: TON Connect bridges and wallets list', () => {
  it('allows every HTTPS/WSS wallet bridge and the remote wallets list', () => {
    const connect = cspDirectives().get('connect-src') ?? [];
    expect(connect).toContain('https:');
    expect(connect).toContain('wss:');
    for (const bridge of WALLET_BRIDGE_URLS) {
      expect(cspAllows(connect, bridge), bridge).toBe(true);
    }
  });

  it('keeps the document policy strict everywhere else', () => {
    const map = cspDirectives();
    expect(map.get('default-src')).toEqual(["'self'"]);
    expect(map.get('script-src')).toEqual(["'self'"]);
    expect(map.get('object-src')).toEqual(["'none'"]);
    expect(map.get('base-uri')).toEqual(["'self'"]);
    expect(map.get('form-action')).toEqual(["'self'"]);
    expect(map.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(map.get('font-src')).toContain('https:');
    expect(indexHtml).not.toContain('unsafe-eval');
    expect(cspAllows(map.get('connect-src') ?? [], 'ws://bridge.tonapi.io/bridge')).toBe(false);
    expect(cspAllows(map.get('connect-src') ?? [], 'http://bridge.tonapi.io/bridge')).toBe(false);
    expect(cspAllows(map.get('connect-src') ?? [], 'https://bridge.ton.space/bridge')).toBe(true);
  });
});

interface FakeRequest {
  url: string;
  method: string;
  mode: string;
}

interface FetchEventLike {
  request: FakeRequest;
  respondWith(response: Promise<Response>): void;
  waitUntil(task: Promise<unknown>): void;
}

interface DispatchResult {
  responded: Promise<Response> | null;
  pending: Array<Promise<unknown>>;
}

interface ServiceWorkerHarness {
  dispatchFetch(url: string, options?: { mode?: string; method?: string }): DispatchResult;
  fetchCalls: string[];
}

/** Runs `public/sw.js` in an isolated VM with fake Cache/Fetch primitives. */
function loadServiceWorker(): ServiceWorkerHarness {
  const listeners = new Map<string, (event: FetchEventLike) => void>();
  const fetchCalls: string[] = [];
  const stored = new Map<string, Response>();
  const cache = {
    match: async (request: FakeRequest) => stored.get(request.url),
    put: async (request: FakeRequest, response: Response) => {
      stored.set(request.url, response);
    },
    add: async (url: string) => {
      stored.set(url, new Response('precached', { status: 200 }));
    },
  };
  const caches = {
    open: async () => cache,
    keys: async () => [] as string[],
    delete: async () => true,
  };
  const sandbox = {
    self: {
      location: { origin: ORIGIN },
      registration: { scope: `${ORIGIN}/FRO4A/` },
      clients: { claim: async () => undefined },
      skipWaiting: async () => undefined,
      addEventListener: (type: string, listener: (event: FetchEventLike) => void) => {
        listeners.set(type, listener);
      },
    },
    caches,
    fetch: async (request: FakeRequest) => {
      fetchCalls.push(request.url);
      return new Response(`network:${request.url}`, { status: 200 });
    },
    Response,
    URL,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(serviceWorkerSource, sandbox, { filename: 'sw.js' });

  const dispatchFetch = (
    url: string,
    options: { mode?: string; method?: string } = {},
  ): DispatchResult => {
    const listener = listeners.get('fetch');
    if (!listener) throw new Error('sw.js did not register a fetch listener');
    const state: { responded: Promise<Response> | null } = { responded: null };
    const pending: Array<Promise<unknown>> = [];
    listener({
      request: { url, method: options.method ?? 'GET', mode: options.mode ?? 'no-cors' },
      respondWith: (response) => {
        state.responded = Promise.resolve(response);
      },
      waitUntil: (task) => {
        pending.push(task);
      },
    });
    return { responded: state.responded, pending };
  };

  return { dispatchFetch, fetchCalls };
}


describe('service worker: cross-origin hard bypass', () => {
  const CROSS_ORIGIN = [
    ...WALLET_ICON_URLS,
    ...WALLET_BRIDGE_URLS,
    'https://telegram.org/img/t_logo_2x.png',
    'https://t.me/fro4a_lottery_bot',
  ];

  it('never calls respondWith() for wallet icons, bridges or the wallets list', () => {
    const sw = loadServiceWorker();
    for (const url of CROSS_ORIGIN) {
      const result = sw.dispatchFetch(url);
      expect(result.responded, url).toBeNull();
      expect(result.pending, url).toEqual([]);
    }
    // It must not even issue its own fetch: an SSE bridge stream stays live.
    expect(sw.fetchCalls).toEqual([]);
  });

  it('never intercepts a cross-origin navigation (wallet / Telegram return)', () => {
    const sw = loadServiceWorker();
    const result = sw.dispatchFetch('https://t.me/fro4a_lottery_bot', { mode: 'navigate' });
    expect(result.responded).toBeNull();
    expect(sw.fetchCalls).toEqual([]);
  });
});

describe('service worker: same-origin rules', () => {
  it('bypasses /api, /health, runtime-config.json and tonconnect-manifest.json', () => {
    const sw = loadServiceWorker();
    for (const requestPath of [
      '/FRO4A/api/state',
      '/FRO4A/health',
      '/FRO4A/runtime-config.json',
      '/FRO4A/runtime-config.json?ts=1',
      '/FRO4A/tonconnect-manifest.json',
      '/FRO4A/tonconnect-manifest.json?ts=1',
    ]) {
      expect(sw.dispatchFetch(`${ORIGIN}${requestPath}`).responded, requestPath).toBeNull();
    }
    expect(sw.fetchCalls).toEqual([]);
  });

  it('caches same-origin bundles and ships the bumped cache version', async () => {
    const sw = loadServiceWorker();
    const assetUrl = `${ORIGIN}/FRO4A/assets/index-abc123.js`;
    const first = sw.dispatchFetch(assetUrl);
    expect(first.responded).not.toBeNull();
    const firstResponse = await first.responded!;
    expect(await firstResponse.text()).toBe(`network:${assetUrl}`);
    await Promise.all(first.pending);

    const second = sw.dispatchFetch(assetUrl);
    expect(second.responded).not.toBeNull();
    const secondResponse = await second.responded!;
    expect(await secondResponse.text()).toBe(`network:${assetUrl}`);
    expect(sw.fetchCalls).toEqual([assetUrl]);

    expect(serviceWorkerSource).toContain("const CACHE_VERSION = 'fro4a-shell-v4'");
    expect(serviceWorkerSource).toContain('if (url.origin !== self.location.origin) return;');
  });

  it('serves navigations network-first (so a new bundle is never stale)', async () => {
    const sw = loadServiceWorker();
    const nav = sw.dispatchFetch(`${ORIGIN}/FRO4A/`, { mode: 'navigate' });
    expect(nav.responded).not.toBeNull();
    const response = await nav.responded!;
    expect(await response.text()).toBe(`network:${ORIGIN}/FRO4A/`);
    await Promise.all(nav.pending);
  });

  it('leaves non-GET requests untouched', () => {
    const sw = loadServiceWorker();
    const result = sw.dispatchFetch(`${ORIGIN}/FRO4A/api/buy`, { method: 'POST' });
    expect(result.responded).toBeNull();
    expect(sw.fetchCalls).toEqual([]);
  });
});

describe('TON Connect manifest, Telegram return URL and CSS', () => {
  it('uses an absolute HTTPS manifest whose icon exists in public/', () => {
    expect(manifest.url).toBe('https://fro4a.github.io/FRO4A/');
    expect(manifest.iconUrl).toBe('https://fro4a.github.io/FRO4A/tonconnect-icon.png');
    const iconName = String(manifest.iconUrl).split('/').pop() ?? '';
    expect(existsSync(path.join(PROJECT_ROOT, 'public', iconName))).toBe(true);
  });

  it('configures the Telegram Mini App return URL', () => {
    expect(appSource).toContain('manifestUrl={resolveManifestUrl()}');
    expect(appSource).toContain(
      "actionsConfiguration={{ twaReturnUrl: 'https://t.me/fro4a_lottery_bot' }}",
    );
  });

  it('has no CSS that hides <img> elements inside the TON Connect modal', () => {
    expect(styles).toContain('[data-tc-connect-button]');
    expect(styles).not.toMatch(/\[data-tc-[^{]*\{[^}]*display:\s*none/i);
    expect(styles).not.toMatch(/tc-root[^{]*\{[^}]*display:\s*none/i);
    expect(styles).not.toMatch(/\bimg\s*\{[^}]*display:\s*none/i);
    expect(styles).not.toMatch(/\bimg\s*\{[^}]*visibility:\s*hidden/i);
  });
});

