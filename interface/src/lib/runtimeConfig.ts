/**
 * Runtime backend URL resolution — zero-rebuild Cloudflare Quick Tunnel switching.
 *
 * PRIVACY: no cookies, no accounts, no analytics. The only persisted value is a
 * non-identifying API hostname kept under `fro4a_api_base` in both
 * `sessionStorage` and `localStorage`.
 *
 * Priority:
 *   1. `?api=<url>` query parameter — explicit operator override, persisted to
 *      `sessionStorage` + `localStorage` immediately.
 *   2. Telegram `initDataUnsafe.start_param` / `?tgWebAppStartParam=` — lets a
 *      BotFather Mini App link carry the live tunnel.
 *   3. Published runtime config — `raw.githubusercontent.com/FRO4A/FRO4A/main/
 *      interface/public/runtime-config.json` first (updated by the tunnel
 *      script minutes after a restart), then `./runtime-config.json`.
 *   4. Stored value (`sessionStorage`, then `localStorage`).
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

/** Write (or clear) the resolved endpoint in both storage areas. */
function rememberApiBaseUrl(value: string): void {
  if (!hasWindow()) return;
  for (const storage of [safeSessionStorage(), safeLocalStorage()]) {
    if (storage === null) continue;
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

function readStorageApiBaseUrl(storage: Storage | null): string | null {
  if (storage === null) return null;
  try {
    const value = sanitizeApiBaseUrl(storage.getItem(API_BASE_STORAGE_KEY));
    return value !== null && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Stored fallback: `sessionStorage` first, then `localStorage`. */
function readStoredApiBaseUrl(): string | null {
  return (
    readStorageApiBaseUrl(safeSessionStorage()) ?? readStorageApiBaseUrl(safeLocalStorage())
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
    const value = sanitizeApiBaseUrl(candidate.split('&')[0]);
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
 * A stale value is tolerated; `initializeRuntimeConfig` persists it as soon as
 * it wins, so a reload keeps the endpoint.
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
  return sanitizeApiBaseUrl(url.searchParams.get(API_QUERY_PARAM));
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
    // 1. Explicit `?api=` override: resolve, persist and boot without any
    //    network round-trip.
    const query = readQueryApiBaseUrl();
    if (query !== null && query.length > 0) {
      clearQueryApiParam();
      rememberApiBaseUrl(query);
      activeApiBaseUrl = query;
      return query;
    }

    // 2. Telegram start parameter (`?tgWebAppStartParam=`, `?startapp=` or
    //    `initDataUnsafe.start_param`).
    const startParam = readStartParamApiBaseUrl();
    if (startParam !== null) {
      rememberApiBaseUrl(startParam);
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
