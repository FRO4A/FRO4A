/**
 * Runtime backend URL resolution — zero-rebuild Cloudflare Quick Tunnel switching.
 *
 * PRIVACY: no cookies, no accounts, no analytics. The only persisted values are
 * non-identifying API hostnames kept under `fro4a_api_base` (dev override) and
 * `fro4a_api_canonical` (repository-resolved endpoint).
 *
 * SECURITY (anti-phishing, production builds):
 *   - `?api=` and Telegram `start_param` are UNTRUSTED input. A production
 *     build NEVER honours them: anybody can spin up a free Quick Tunnel such as
 *     `https://attacker.trycloudflare.com` and share
 *     `https://fro4a.github.io/FRO4A/?api=https://attacker.trycloudflare.com`,
 *     which would serve a spoofed `drawAddress`. Only a local Vite dev build
 *     (`import.meta.env.PROD === false`) may honour an override, and then only
 *     for `localhost` / `127.0.0.1`.
 *   - The production endpoint is resolved strictly from the canonical,
 *     repository-controlled runtime config
 *     (`raw.githubusercontent.com/FRO4A/FRO4A/main/interface/public/
 *     runtime-config.json`, then `./runtime-config.json`). The published
 *     `apiBaseUrl` must be a clean `https://*.trycloudflare.com` host (or an
 *     explicitly configured production domain) without credentials, backslashes,
 *     query strings or fragments.
 *
 * Priority (production):
 *   1. Published runtime config (raw GitHub mirror, then same-origin copy).
 *   2. `import.meta.env.VITE_API_BASE_URL` / build-time `API_BASE_URL`.
 *
 * Priority (non-production dev):
 *   1. `?api=<localhost>` query parameter (sessionStorage only).
 *   2. Telegram `initDataUnsafe.start_param` holding a localhost URL.
 *   3. Published runtime config (trusted hosts only).
 *   4. Stored canonical endpoint, then a stored dev override.
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

/** The suffix accepted for the REPOSITORY-CONTROLLED runtime config (`*.` subdomain only). */
export const TRUSTED_TUNNEL_DOMAIN = 'trycloudflare.com';

/** Local development hosts (HTTP is tolerated for these two only). */
export const TRUSTED_LOCAL_HOSTS: readonly string[] = ['localhost', '127.0.0.1'];

/** Repository-resolved endpoint (runtime config): separate from dev overrides. */
export const API_CANONICAL_STORAGE_KEY = 'fro4a_api_canonical';

/** Explicit mode override used by unit tests; defaults to the Vite build flag. */
export interface OverrideOptions {
  /** `true` = production build: `.trycloudflare.com` / start-param overrides are ignored. */
  production?: boolean;
}

let activeApiBaseUrl: string | null = null;
let initialization: Promise<string> | null = null;

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

function normalizeHost(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

/** True when this build is a production bundle (overrides are never honoured). */
export function isProductionBuild(options: OverrideOptions = {}): boolean {
  if (typeof options.production === 'boolean') return options.production;
  return import.meta.env.PROD === true;
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
  // Backslashes are normalised to `/` by the WHATWG URL parser, which makes
  // `https://host\@evil` ambiguous; control characters / whitespace are never
  // part of a legitimate endpoint. Reject both before parsing (red-team
  // finding: `\\@` look-alike bypass attempt).
  if (/[\\\u0000-\u0020\u007f]/.test(trimmed)) return null;
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
 * True for a genuine Cloudflare Quick Tunnel host (`<random>.trycloudflare.com`).
 *
 * The bare apex domain is NOT a tunnel: `https://trycloudflare.com` is a
 * marketing site, never an API endpoint. `trycloudflare.com.evil.example` and
 * `evil-trycloudflare.com` are rejected by the exact suffix check.
 */
export function isTrustedTunnelHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  const suffix = `.${TRUSTED_TUNNEL_DOMAIN}`;
  return host.length > suffix.length && host.endsWith(suffix);
}

/**
 * Hosts an operator explicitly configured as the production API
 * (`VITE_API_BASE_URL` / `API_BASE_URL`). Everything else is rejected.
 */
function configuredProductionHosts(): string[] {
  const hosts = new Set<string>();
  for (const candidate of [import.meta.env.VITE_API_BASE_URL, API_BASE_URL]) {
    const value = sanitizeApiBaseUrl(candidate);
    if (value === null || value.length === 0) continue;
    try {
      hosts.add(normalizeHost(new URL(value).hostname));
    } catch {
      // Ignore malformed build-time values.
    }
  }
  return [...hosts];
}

/**
 * Host allow-list for the CANONICAL runtime config (`apiBaseUrl` published in
 * the FRO4A repository): `https://*.trycloudflare.com` or an explicitly
 * configured production domain. The repository controls this value, so a
 * Quick Tunnel hostname is legitimate here — unlike an attacker-supplied
 * `?api=` parameter.
 */
export function isTrustedRuntimeConfigHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  if (host.length === 0) return false;
  if (isTrustedTunnelHost(host)) return true;
  return configuredProductionHosts().includes(host);
}

/**
 * Validate one repository-controlled runtime-config endpoint.
 *
 * Requires `https://` (no local HTTP in production), a trusted host, and no
 * credentials / query / fragment / backslashes (rejected by
 * `sanitizeApiBaseUrl` before parsing).
 */
export function sanitizeRuntimeApiBaseUrl(raw: string | null | undefined): string | null {
  const value = sanitizeApiBaseUrl(raw);
  if (value === null || value.length === 0) return null;
  if (!value.toLowerCase().startsWith('https://')) return null;
  try {
    return isTrustedRuntimeConfigHost(new URL(value).hostname) ? value : null;
  } catch {
    return null;
  }
}

/**
 * True only for a local dev backend (`localhost` / `127.0.0.1`).
 *
 * Production builds return `false` for every hostname: an arbitrary
 * `*.trycloudflare.com` tunnel is exactly how a phishing link would serve a
 * spoofed `drawAddress`, so overrides must never be honoured there.
 */
export function isTrustedOverrideHost(hostname: string, options: OverrideOptions = {}): boolean {
  if (isProductionBuild(options)) return false;
  return TRUSTED_LOCAL_HOSTS.includes(normalizeHost(hostname));
}

/**
 * Sanitizes an UNTRUSTED override (`?api=`, Telegram start param):
 * structural URL validation first, then the DEV-only localhost allow-list.
 * Anything else returns `null` and is never stored or used.
 */
export function sanitizeOverrideApiBaseUrl(
  raw: string | null | undefined,
  options: OverrideOptions = {},
): string | null {
  const value = sanitizeApiBaseUrl(raw);
  if (value === null) return null;
  // `''` / `/` is an explicit same-origin choice, not a redirect.
  if (value.length === 0) return '';
  if (isProductionBuild(options)) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:') return null;
    return TRUSTED_LOCAL_HOSTS.includes(normalizeHost(parsed.hostname)) ? value : null;
  } catch {
    return null;
  }
}

/** Write (or clear) one storage key; failures are ignored. */
export function writeStoredApiBaseUrl(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null,
  value: string,
  key: string = API_BASE_STORAGE_KEY,
): void {
  if (storage === null) return;
  try {
    if (value.length > 0) {
      storage.setItem(key, value);
    } else {
      storage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable (private mode / embedded webview).
  }
}

/**
 * Repository-resolved endpoint (published runtime config): both storage areas,
 * under the dedicated canonical key so a legacy `?api=` value can never be
 * mistaken for a verified endpoint.
 */
function rememberApiBaseUrl(value: string): void {
  writeStoredApiBaseUrl(safeSessionStorage(), value, API_CANONICAL_STORAGE_KEY);
  writeStoredApiBaseUrl(safeLocalStorage(), value, API_CANONICAL_STORAGE_KEY);
}

/**
 * UNTRUSTED dev `?api=` / start-param override: `sessionStorage` ONLY (and only
 * a localhost URL reaches this function in a non-production build).
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

/** Read the canonical key, purging a value that is not a trusted endpoint. */
function readCanonicalStorage(storage: Storage | null): string | null {
  if (storage === null) return null;
  try {
    const stored = storage.getItem(API_CANONICAL_STORAGE_KEY);
    if (stored === null) return null;
    const value = sanitizeRuntimeApiBaseUrl(stored) ?? (isProductionBuild() ? null : sanitizeOverrideApiBaseUrl(stored));
    if (value === null || value.length === 0) {
      try {
        storage.removeItem(API_CANONICAL_STORAGE_KEY);
      } catch {
        // Ignore storage failures.
      }
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

/** Dev-only override key (`sessionStorage`, then localhost-validated localStorage). */
function readOverrideStorage(storage: Storage | null): string | null {
  if (storage === null) return null;
  try {
    const stored = storage.getItem(API_BASE_STORAGE_KEY);
    if (stored === null) return null;
    const value = sanitizeOverrideApiBaseUrl(stored);
    if (value === null || value.length === 0) {
      // Purge legacy/hijacked values (e.g. an old tunnel persisted before the
      // production override lock-down).
      try {
        storage.removeItem(API_BASE_STORAGE_KEY);
      } catch {
        // Ignore storage failures.
      }
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

/**
 * Dev-mode stored fallback: canonical endpoint first (repository-resolved),
 * then a localhost-only override. Production builds never read storage at all.
 */
function readStoredApiBaseUrl(): string | null {
  return (
    readCanonicalStorage(safeSessionStorage()) ??
    readCanonicalStorage(safeLocalStorage()) ??
    readOverrideStorage(safeSessionStorage()) ??
    readOverrideStorage(safeLocalStorage())
  );
}

/** Production hygiene: drop any pre-lock-down override stored by an older build. */
function purgeLegacyOverrideStorage(): void {
  for (const storage of [safeSessionStorage(), safeLocalStorage()]) {
    if (storage === null) continue;
    try {
      storage.removeItem(API_BASE_STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }
}

/**
 * Extract an API base URL from a Telegram start parameter / `startapp` payload.
 *
 * Accepted shapes (URL-decoded first, so `?startapp=api%3Dhttps%3A%2F%2F...`
 * works as well as `?tgWebAppStartParam=https://...`):
 *   - `api=http://localhost:4000`
 *   - `api_http://localhost:4000`
 *   - `http://127.0.0.1:4000`
 *
 * Production builds reject every value (`OverrideOptions.production`).
 */
export function parseStartParamApiBaseUrl(
  raw: string | null | undefined,
  options: OverrideOptions = {},
): string | null {
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
    const value = sanitizeOverrideApiBaseUrl(candidate.split('&')[0], options);
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
 * sanitized DEV-only localhost API base URL or `null`.
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
 * Read `?api=<url>` without side effects.
 *
 * Production builds reject every value (an attacker's own Quick Tunnel would
 * otherwise serve a spoofed `drawAddress`). Dev builds accept only
 * `http://localhost[:port]` / `http://127.0.0.1[:port]`.
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

/** How strictly a runtime-config `apiBaseUrl` is validated. */
type RuntimeConfigMode = 'strict' | 'local';

function isLocalHttpApiBaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' && TRUSTED_LOCAL_HOSTS.includes(normalizeHost(parsed.hostname));
  } catch {
    return false;
  }
}

/**
 * Fetch one runtime-config JSON file with a hard 2000 ms timeout (never blocks
 * boot).
 *
 * `strict` (production): `apiBaseUrl` must be a clean `https://*.trycloudflare.com`
 * or an explicitly configured production domain — never credentials,
 * backslashes, query strings or fragments.
 * `local` (dev): additionally tolerates a `http://localhost` dev backend.
 */
async function fetchRuntimeConfigApiBaseUrl(
  url: string,
  mode: RuntimeConfigMode,
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
    const raw = typeof payload.apiBaseUrl === 'string' ? payload.apiBaseUrl : null;
    const normalized = sanitizeRuntimeApiBaseUrl(raw);
    // An empty runtime-config value is not a choice: fall through to storage and
    // finally `VITE_API_BASE_URL` instead of pinning same-origin.
    if (normalized !== null && normalized.length > 0) return normalized;
    if (mode === 'local' && raw !== null) {
      const local = sanitizeApiBaseUrl(raw);
      if (local !== null && local.length > 0 && isLocalHttpApiBaseUrl(local)) return local;
    }
    return null;
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
async function fetchPublishedApiBaseUrl(mode: RuntimeConfigMode): Promise<string | null> {
  if (!hasWindow()) return null;
  const stamp = Date.now();
  const [mirror, local] = await Promise.all([
    fetchRuntimeConfigApiBaseUrl(`${RUNTIME_CONFIG_RAW_URL}?t=${stamp}`, 'strict'),
    fetchRuntimeConfigApiBaseUrl(`${RUNTIME_CONFIG_FILE}?t=${stamp}`, mode),
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
 *
 * PRODUCTION: no query/start-param override and no storage is consulted. The
 * endpoint comes only from the repository-controlled runtime config or the
 * build-time `VITE_API_BASE_URL`.
 */
export function initializeRuntimeConfig(): Promise<string> {
  if (activeApiBaseUrl !== null) return Promise.resolve(activeApiBaseUrl);
  if (initialization !== null) return initialization;
  initialization = (async (): Promise<string> => {
    const production = isProductionBuild();

    if (production) {
      // Cosmetic only: never honour the parameter, but strip it so a phishing
      // URL does not keep advertising an attacker tunnel in the address bar.
      clearQueryApiParam();
    } else {
      // 1. Dev-only `?api=http://localhost:4000` override (sessionStorage only).
      const query = readQueryApiBaseUrl();
      if (query !== null && query.length > 0) {
        clearQueryApiParam();
        rememberOverrideApiBaseUrl(query);
        activeApiBaseUrl = query;
        return query;
      }

      // 2. Dev-only Telegram start parameter holding a localhost URL.
      const startParam = readStartParamApiBaseUrl();
      if (startParam !== null) {
        rememberOverrideApiBaseUrl(startParam);
        activeApiBaseUrl = startParam;
        return startParam;
      }
    }

    // 3. Canonical runtime config, fetched with `cache: 'no-store'` so a laptop
    //    tunnel restart is picked up on the next Mini App launch. The mirror is
    //    always validated in strict mode; the same-origin copy may also point at
    //    a localhost backend in dev mode only.
    const runtimeConfig = await fetchPublishedApiBaseUrl(production ? 'strict' : 'local');

    // 4. Dev storage fallback, then the build-time fallback.
    const stored = production ? null : readStoredApiBaseUrl();
    const resolved = selectApiBaseUrl({
      query: null,
      startParam: null,
      runtimeConfig,
      stored,
      fallback: sanitizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL) ?? API_BASE_URL,
    });
    if (!production && runtimeConfig !== null) rememberApiBaseUrl(resolved);
    if (production) purgeLegacyOverrideStorage();
    activeApiBaseUrl = resolved;
    return activeApiBaseUrl;
  })();
  return initialization;
}

/** Synchronous value for API URLs; returns the configured fallback before init. */
export function getApiBaseUrl(): string {
  return activeApiBaseUrl ?? sanitizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL) ?? API_BASE_URL;
}
