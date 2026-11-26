/**
 * Runtime backend URL resolution — zero-rebuild Cloudflare Quick Tunnel switching.
 *
 * PRIVACY: no cookies, no accounts, no analytics. The only persisted value is a
 * non-identifying API hostname kept under `fro4a_api_base`.
 *
 * SECURITY (anti-hijack): the `?api=` / Telegram start-param overrides are
 * UNTRUSTED input. They are only honoured when the hostname is a Cloudflare
 * Quick Tunnel (`*.trycloudflare.com`) or the local dev backend
 * (`localhost` / `127.0.0.1`), and they are persisted to `sessionStorage`
 * ONLY — never to `localStorage`. A shared phishing link such as
 * `https://fro4a.github.io/FRO4A/?api=https://evil-attacker.com` is therefore
 * rejected outright and can never survive a new browser session.
 *
 * Priority:
 *   1. `?api=<url>` query parameter — explicit operator override, validated
 *      against the tunnel/local host allow-list and kept in `sessionStorage`.
 *   2. Telegram `initDataUnsafe.start_param` / `?tgWebAppStartParam=` — lets a
 *      BotFather Mini App link carry the live tunnel (same allow-list,
 *      `sessionStorage` scope).
 *   3. Published runtime config — `raw.githubusercontent.com/FRO4A/FRO4A/main/
 *      interface/public/runtime-config.json` first (updated by the tunnel
 *      script minutes after a restart), then `./runtime-config.json`. This is
 *      the canonical, repository-controlled source.
 *   4. Stored value (`sessionStorage`, then a host-checked `localStorage`).
 *   5. `import.meta.env.VITE_API_BASE_URL`.
 *
 * An empty result means "same-origin relative requests" (`/api/...`).
 */
import { API_BASE_URL } from '../config/deployments';

export const API_BASE_STORAGE_KEY = 'fro4a_api_base';
export const API_QUERY_PARAM = 'api';
export const RUNTIME_CONFIG_FILE = './runtime-config.json';
/** Public zero-config mirror, refreshed by `start-hybrid-tunnel.ps1` on every tunnel restart. */
export const RUNTIME_CONFIG_RAW_URL =
  'https://raw.githubusercontent.com/FRO4A/FRO4A/main/interface/public/runtime-config.json';
export const RUNTIME_CONFIG_TIMEOUT_MS = 2000;
/** Telegram Web/desktop forwards `?startapp=<value>` as these query keys. */
export const START_PARAM_QUERY_KEYS: readonly string[] = ['tgWebAppStartParam', 'start_param'];

/** The only suffix accepted for tunnel overrides (exact or `*.` subdomain). */
export const TRUSTED_TUNNEL_DOMAIN = 'trycloudflare.com';

/** Local development hosts (HTTP is tolerated for these two only). */
export const TRUSTED_LOCAL_HOSTS: readonly string[] = ['localhost', '127.0.0.1'];

let activeApiBaseUrl: string | null = null;
let initialization: Promise<string> | null = null;

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}


/**
 * Validate one API base URL.
 *
 * Returns:
 * - a normalized URL (no trailing slash) for `https://...` or local HTTP,
 * - `''` for an explicit same-origin value (`''` or `/`),
 * - `null` for anything invalid (never persisted).
 */
export function sanitizeApiBaseUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed === '/') return '';
  if (!/^https?:\/\//i.test(trimmed)) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) return null;
  if (parsed.search.length > 0 || parsed.hash.length > 0) return null;
  const isHttps = parsed.protocol === 'https:';
  const isLocalHttp =
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
  if (!isHttps && !isLocalHttp) return null;
  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
}

/**
 * True for `*.trycloudflare.com` (or the bare domain) and the local dev hosts.
 *
 * Deliberately strict: `trycloudflare.com.evil.example`,
 * `evil-trycloudflare.com`, `fro4a.github.io` and every other third-party
 * domain are rejected, so a shared `?api=` phishing link cannot redirect API
 * traffic to an attacker.
 */
export function isTrustedOverrideHost(hostname: string): boolean {
  const host = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (host.length === 0) return false;
  if (TRUSTED_LOCAL_HOSTS.includes(host)) return true;
  return host === TRUSTED_TUNNEL_DOMAIN || host.endsWith(`.${TRUSTED_TUNNEL_DOMAIN}`);
}

/**
 * Sanitizes an UNTRUSTED override (`?api=`, Telegram start param): structural
 * URL validation first, then the tunnel/local host allow-list. Anything else
 * returns `null` and is never stored or used.
 */
export function sanitizeOverrideApiBaseUrl(raw: string | null | undefined): string | null {
  const value = sanitizeApiBaseUrl(raw);
  if (value === null || value.length === 0) return value;
  try {
    return isTrustedOverrideHost(new URL(value).hostname) ? value : null;
  } catch {
    return null;
  }
}

/** Write (or clear) the endpoint in one storage area; failures are ignored. */
export function writeStoredApiBaseUrl(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null,
  value: string,
): void {
  if (storage === null) return;
  try {
    if (value.length > 0) {
      storage.setItem(API_BASE_STORAGE_KEY, value);
    } else {
      storage.removeItem(API_BASE_STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable (private mode / embedded webview).
  }
}

/** Canonical endpoint (published runtime config): both storage areas. */
function rememberApiBaseUrl(value: string): void {
  writeStoredApiBaseUrl(safeSessionStorage(), value);
  writeStoredApiBaseUrl(safeLocalStorage(), value);
}

/**
 * UNTRUSTED `?api=` / start-param override: `sessionStorage` ONLY.
 * It is never written to `localStorage`, so a phishing link cannot survive the
 * tab session; the next visit resolves the canonical runtime config again.
 */
export function rememberOverrideApiBaseUrl(
  value: string,
  session: Pick<Storage, 'setItem' | 'removeItem'> | null = safeSessionStorage(),
): void {
  writeStoredApiBaseUrl(session, value);
}


function safeSessionStorage(): Storage | null {
  if (!hasWindow()) return null;
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function safeLocalStorage(): Storage | null {
  if (!hasWindow()) return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStorageApiBaseUrl(
  storage: Storage | null,
  trustedHostOnly: boolean,
): string | null {
  if (storage === null) return null;
  try {
    const stored = storage.getItem(API_BASE_STORAGE_KEY);
    const value = trustedHostOnly
      ? sanitizeOverrideApiBaseUrl(stored)
      : sanitizeApiBaseUrl(stored);
    if (value === null || value.length === 0) {
      // Purge legacy/hijacked values (e.g. an old `?api=` override persisted to
      // localStorage before overrides became session-scoped).
      if (stored !== null && trustedHostOnly) {
        try {
          storage.removeItem(API_BASE_STORAGE_KEY);
        } catch {
          // Ignore storage failures.
        }
      }
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

/**
 * Stored fallback: `sessionStorage` first (may hold a host-validated override
 * or a canonical tunnel), then `localStorage` — which is only trusted when its
 * host passes the tunnel/local allow-list.
 */
function readStoredApiBaseUrl(): string | null {
  return (
    readStorageApiBaseUrl(safeSessionStorage(), false) ??
    readStorageApiBaseUrl(safeLocalStorage(), true)
  );
}

/**
 * Extract an API base URL from a Telegram start parameter / `startapp` payload.
 *
 * Accepted shapes (URL-decoded first, so `?startapp=api%3Dhttps%3A%2F%2F...`
 * works as well as `?tgWebAppStartParam=https://...`):
 *   - `api=https://tunnel.trycloudflare.com`
 *   - `api_https://tunnel.trycloudflare.com`
 *   - `https://tunnel.trycloudflare.com`
 */
export function parseStartParamApiBaseUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    decoded = trimmed;
  }
  const lower = decoded.toLowerCase();
  const candidates: string[] = [];
  if (lower.startsWith('api=')) {
    candidates.push(decoded.slice('api='.length));
  } else if (lower.startsWith('api_')) {
    const rest = decoded.slice('api_'.length);
    candidates.push(rest.startsWith('=') ? rest.slice(1) : rest);
  }
  const marker = lower.indexOf('api=');
  if (marker >= 0) candidates.push(decoded.slice(marker + 'api='.length));
  candidates.push(decoded);
  for (const candidate of candidates) {
    const value = sanitizeOverrideApiBaseUrl(candidate.split('&')[0]);
    if (value !== null && value.length > 0) return value;
  }
  return null;
}

/** Telegram WebApp bridge, available after `@twa-dev/sdk` boots. */
function readTelegramStartParam(): string | null {
  if (!hasWindow()) return null;
  const bridge = (window as unknown as {
    Telegram?: { WebApp?: { initDataUnsafe?: { start_param?: unknown } } };
  }).Telegram;
  const startParam = bridge?.WebApp?.initDataUnsafe?.start_param;
  return typeof startParam === 'string' && startParam.length > 0 ? startParam : null;
}

/**
 * Read the Telegram start parameter from the URL (`?tgWebAppStartParam=`,
 * `?startapp=`) or the WebApp `initDataUnsafe.start_param` bridge; returns a
 * sanitized API base URL or `null`.
 */
function readStartParamApiBaseUrl(): string | null {
  if (!hasWindow()) return null;
  let url: URL | null = null;
  try {
    url = new URL(window.location.href);
  } catch {
    url = null;
  }
  if (url !== null) {
    for (const key of [...START_PARAM_QUERY_KEYS, 'startapp']) {
      const value = url.searchParams.get(key);
      const parsed = parseStartParamApiBaseUrl(value);
      if (parsed !== null) return parsed;
    }
  }
  return parseStartParamApiBaseUrl(readTelegramStartParam());
}

/**
 * Read `?api=<tunnel>` without side effects.
 *
 * Only a `*.trycloudflare.com` or localhost/127.0.0.1 host is accepted; any
 * other value is ignored, so a shared phishing link cannot hijack the API.
 * A stale trusted value is still tolerated: `initializeRuntimeConfig` keeps it
 * in `sessionStorage` for this tab only.
 */
function readQueryApiBaseUrl(): string | null {
  if (!hasWindow()) return null;
  let url: URL;
  try {
    url = new URL(window.location.href);
  } catch {
    return null;
  }
  if (!url.searchParams.has(API_QUERY_PARAM)) return null;
  return sanitizeOverrideApiBaseUrl(url.searchParams.get(API_QUERY_PARAM));
}

/**
 * Remove `?api=` from the visible URL (hash routes are preserved). Cosmetic only:
 * the resolved endpoint is already memoized and persisted.
 */
function clearQueryApiParam(): void {
  if (!hasWindow()) return;
  let url: URL;
  try {
    url = new URL(window.location.href);
  } catch {
    return;
  }
  if (!url.searchParams.has(API_QUERY_PARAM)) return;
  url.searchParams.delete(API_QUERY_PARAM);
  try {
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // History rewriting may be blocked inside an embedded webview.
  }
}

/**
 * Fetch one runtime-config JSON file with a hard 2000 ms timeout (never blocks
 * boot). The published raw mirror must contain an absolute `https://` endpoint;
 * the same-origin copy may also point at a local HTTP dev server.
 */
async function fetchRuntimeConfigApiBaseUrl(
  url: string,
  requireHttps: boolean,
): Promise<string | null> {
  if (!hasWindow() || typeof fetch !== 'function') return null;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), RUNTIME_CONFIG_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { apiBaseUrl?: unknown };
    const normalized = sanitizeApiBaseUrl(
      typeof payload.apiBaseUrl === 'string' ? payload.apiBaseUrl : null,
    );
    // An empty runtime-config value is not a choice: fall through to storage and
    // finally `VITE_API_BASE_URL` instead of pinning same-origin.
    if (normalized === null || normalized.length === 0) return null;
    if (requireHttps && !normalized.startsWith('https://')) return null;
    return normalized;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Resolve the published runtime config: the `raw.githubusercontent.com` mirror
 * (refreshed by `start-hybrid-tunnel.ps1` seconds after a tunnel restart) wins
 * over the copy published with the last GitHub Pages build.
 */
async function fetchPublishedApiBaseUrl(): Promise<string | null> {
  if (!hasWindow()) return null;
  const stamp = Date.now();
  const [mirror, local] = await Promise.all([
    fetchRuntimeConfigApiBaseUrl(`${RUNTIME_CONFIG_RAW_URL}?t=${stamp}`, true),
    fetchRuntimeConfigApiBaseUrl(`${RUNTIME_CONFIG_FILE}?t=${stamp}`, false),
  ]);
  return mirror ?? local;
}

/**
 * Pure priority selector (unit-tested without a browser environment):
 * `?api=` > Telegram start param > published runtime config > storage > build fallback.
 */
export function selectApiBaseUrl(input: {
  query: string | null;
  startParam: string | null;
  runtimeConfig: string | null;
  stored: string | null;
  fallback: string;
}): string {
  for (const candidate of [input.query, input.startParam, input.runtimeConfig, input.stored]) {
    if (candidate !== null && candidate.length > 0) return candidate;
  }
  return input.fallback;
}

/**
 * Resolve the active backend base URL once per page load and memoize it.
 * Safe to call from any request path; concurrent callers share one lookup.
 */
export function initializeRuntimeConfig(): Promise<string> {
  if (activeApiBaseUrl !== null) return Promise.resolve(activeApiBaseUrl);
  if (initialization !== null) return initialization;
  initialization = (async (): Promise<string> => {
    // 1. Explicit `?api=` override: host-allow-listed, kept in sessionStorage
    //    only, and booted without any network round-trip.
    const query = readQueryApiBaseUrl();
    if (query !== null && query.length > 0) {
      clearQueryApiParam();
      rememberOverrideApiBaseUrl(query);
      activeApiBaseUrl = query;
      return query;
    }

    // 2. Telegram start parameter (`?tgWebAppStartParam=`, `?startapp=` or
    //    `initDataUnsafe.start_param`) — same host allow-list, session scope.
    const startParam = readStartParamApiBaseUrl();
    if (startParam !== null) {
      rememberOverrideApiBaseUrl(startParam);
      activeApiBaseUrl = startParam;
      return startParam;
    }

    // 3. Published runtime config, fetched with `cache: 'no-store'` so a laptop
    //    tunnel restart is picked up on the next Mini App launch.
    const runtimeConfig = await fetchPublishedApiBaseUrl();

    // 4. Stored value, then the build-time fallback.
    const stored = readStoredApiBaseUrl();
    const resolved = selectApiBaseUrl({
      query: null,
      startParam: null,
      runtimeConfig,
      stored,
      fallback: sanitizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL) ?? API_BASE_URL,
    });
    if (runtimeConfig !== null) rememberApiBaseUrl(resolved);
    activeApiBaseUrl = resolved;
    return activeApiBaseUrl;
  })();
  return initialization;
}

/** Synchronous value for image URLs; returns the configured fallback before init. */
export function getApiBaseUrl(): string {
  return activeApiBaseUrl ?? sanitizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL) ?? API_BASE_URL;
}

/**
 * Resolve a server-relative asset path (`/api/nft/...`) against the active API.
 * Same-origin deployments keep the original relative path.
 */
export function resolveApiAssetUrl(path: string | null | undefined): string {
  if (typeof path !== 'string' || path.length === 0) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const base = getApiBaseUrl();
  if (base.length === 0) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
