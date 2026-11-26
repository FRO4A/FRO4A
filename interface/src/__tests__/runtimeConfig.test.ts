import { describe, expect, it } from 'vitest';
import {
  API_BASE_STORAGE_KEY,
  isTrustedOverrideHost,
  isTrustedRuntimeConfigHost,
  parseStartParamApiBaseUrl,
  rememberOverrideApiBaseUrl,
  resolveApiAssetUrl,
  sanitizeApiBaseUrl,
  sanitizeOverrideApiBaseUrl,
  sanitizeRuntimeApiBaseUrl,
  selectApiBaseUrl,
  writeStoredApiBaseUrl,
} from '../lib/runtimeConfig';

describe('runtime API base URL sanitisation', () => {
  it('accepts HTTPS tunnels and local HTTP backends, trimming trailing slashes', () => {
    expect(sanitizeApiBaseUrl('https://fro4a-test.trycloudflare.com')).toBe(
      'https://fro4a-test.trycloudflare.com',
    );
    expect(sanitizeApiBaseUrl('https://fro4a-test.trycloudflare.com/')).toBe(
      'https://fro4a-test.trycloudflare.com',
    );
    expect(sanitizeApiBaseUrl('http://localhost:4000')).toBe('http://localhost:4000');
    expect(sanitizeApiBaseUrl('http://127.0.0.1:5173/')).toBe('http://127.0.0.1:5173');
  });

  it('treats empty and `/` as explicit same-origin values', () => {
    expect(sanitizeApiBaseUrl('')).toBe('');
    expect(sanitizeApiBaseUrl('   ')).toBe('');
    expect(sanitizeApiBaseUrl('/')).toBe('');
    expect(sanitizeApiBaseUrl(null)).toBeNull();
    expect(sanitizeApiBaseUrl(undefined)).toBeNull();
  });

  it('rejects plain insecure HTTP, credentials and malformed values', () => {
    expect(sanitizeApiBaseUrl('http://example.com')).toBeNull();
    expect(sanitizeApiBaseUrl('ftp://example.com')).toBeNull();
    expect(sanitizeApiBaseUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeApiBaseUrl('https://user:pass@example.com')).toBeNull();
    expect(sanitizeApiBaseUrl('not a url')).toBeNull();
    expect(sanitizeApiBaseUrl('https://example.com/?x=1')).toBeNull();
    expect(sanitizeApiBaseUrl('https://example.com/#hash')).toBeNull();
  });

  it('resolves NFT card paths against the active API base URL', () => {
    // Absolute URLs (already resolved) are never rewritten.
    expect(resolveApiAssetUrl('https://fro4a-test.trycloudflare.com/api/nft/ball/1/42.png')).toBe(
      'https://fro4a-test.trycloudflare.com/api/nft/ball/1/42.png',
    );
    // Missing values resolve to an empty string, never `"null"`.
    expect(resolveApiAssetUrl(null)).toBe('');
    expect(resolveApiAssetUrl(undefined)).toBe('');
  });
});

describe('Telegram start parameter parsing', () => {
  it('accepts localhost `api=` payloads, underscore variants and bare URLs in dev mode', () => {
    expect(parseStartParamApiBaseUrl('api=http://localhost:4000', { production: false })).toBe(
      'http://localhost:4000',
    );
    expect(parseStartParamApiBaseUrl('api_http://127.0.0.1:4000', { production: false })).toBe(
      'http://127.0.0.1:4000',
    );
    expect(parseStartParamApiBaseUrl('http://localhost:4000', { production: false })).toBe(
      'http://localhost:4000',
    );
    expect(
      parseStartParamApiBaseUrl('api%3Dhttp%3A%2F%2Flocalhost%3A4000', { production: false }),
    ).toBe('http://localhost:4000');
  });

  it('rejects Cloudflare Quick Tunnel hosts even in dev mode (phishing vector)', () => {
    expect(parseStartParamApiBaseUrl('api=https://evil.trycloudflare.com')).toBeNull();
    expect(parseStartParamApiBaseUrl('api=https://ok-tunnel.trycloudflare.com')).toBeNull();
    expect(parseStartParamApiBaseUrl('api=https://evil.trycloudflare.com', { production: false })).toBeNull();
  });

  it('rejects empty, insecure, malformed and production start parameters', () => {
    expect(parseStartParamApiBaseUrl('')).toBeNull();
    expect(parseStartParamApiBaseUrl(null)).toBeNull();
    expect(parseStartParamApiBaseUrl(undefined)).toBeNull();
    expect(parseStartParamApiBaseUrl('ref=promo')).toBeNull();
    expect(parseStartParamApiBaseUrl('api=http://example.com')).toBeNull();
    // Production builds never honour an override — not even a localhost one.
    expect(parseStartParamApiBaseUrl('api=http://localhost:4000', { production: true })).toBeNull();
    expect(parseStartParamApiBaseUrl('api=https://evil.trycloudflare.com', { production: true })).toBeNull();
  });
});

describe('runtime API base URL priority', () => {
  const query = 'https://query-tunnel.trycloudflare.com';
  const startParam = 'https://start-tunnel.trycloudflare.com';
  const published = 'https://fresh-tunnel.trycloudflare.com';
  const stored = 'https://stored-tunnel.trycloudflare.com';

  it('ranks ?api= above every other source', () => {
    expect(
      selectApiBaseUrl({ query, startParam, runtimeConfig: published, stored, fallback: '' }),
    ).toBe(query);
  });

  it('falls back to the Telegram start param, then the published config, then storage', () => {
    expect(
      selectApiBaseUrl({ query: null, startParam, runtimeConfig: published, stored, fallback: '' }),
    ).toBe(startParam);
    expect(
      selectApiBaseUrl({
        query: null,
        startParam: null,
        runtimeConfig: published,
        stored,
        fallback: '',
      }),
    ).toBe(published);
    expect(
      selectApiBaseUrl({ query: null, startParam: null, runtimeConfig: null, stored, fallback: '' }),
    ).toBe(stored);
    expect(
      selectApiBaseUrl({
        query: null,
        startParam: null,
        runtimeConfig: null,
        stored: null,
        fallback: '',
      }),
    ).toBe('');
    expect(
      selectApiBaseUrl({
        query: null,
        startParam: null,
        runtimeConfig: null,
        stored: null,
        fallback: 'http://localhost:4000',
      }),
    ).toBe('http://localhost:4000');
  });

  it('never returns an empty runtime-config value as the winner', () => {
    expect(
      selectApiBaseUrl({
        query: null,
        startParam: null,
        runtimeConfig: '',
        stored,
        fallback: '',
      }),
    ).toBe(stored);
  });
});

/** Minimal in-memory Storage stand-in for the session-scoping assertions. */
function fakeStorage() {
  const values = new Map<string, string>();
  const calls = { sets: [] as string[], removes: [] as string[] };
  return {
    storage: {
      setItem(key: string, value: string): void {
        calls.sets.push(`${key}=${value}`);
        values.set(key, value);
      },
      removeItem(key: string): void {
        calls.removes.push(key);
        values.delete(key);
      },
    },
    calls,
    values,
  };
}

describe('?api= hijack / phishing protection', () => {
  it('accepts localhost backends in dev mode and rejects every tunnel', () => {
    expect(sanitizeOverrideApiBaseUrl('http://localhost:4000', { production: false })).toBe(
      'http://localhost:4000',
    );
    expect(sanitizeOverrideApiBaseUrl('http://127.0.0.1:4000/', { production: false })).toBe(
      'http://127.0.0.1:4000',
    );
    expect(sanitizeOverrideApiBaseUrl('https://fro4a-test.trycloudflare.com', { production: false })).toBeNull();
    expect(sanitizeOverrideApiBaseUrl('https://trycloudflare.com/', { production: false })).toBeNull();
  });

  it('rejects every override in a production build (including evil trycloudflare tunnels)', () => {
    const hostile = [
      'https://evil.trycloudflare.com',
      'https://fro4a-test.trycloudflare.com',
      'https://trycloudflare.com',
      'http://localhost:4000',
      'http://127.0.0.1:4000',
    ];
    for (const value of hostile) {
      expect(sanitizeOverrideApiBaseUrl(value, { production: true }), value).toBeNull();
    }
  });

  it('rejects every arbitrary third-party domain and look-alike host', () => {
    const hostile = [
      'https://evil-attacker.com',
      'https://evil-attacker.com/api',
      'https://trycloudflare.com.evil.example',
      'https://evil-trycloudflare.com',
      'https://fro4a.github.io/FRO4A/',
      'http://localhost.evil.example:4000',
      'https://user:pass@abc.trycloudflare.com',
      'https://abc.trycloudflare.com/?redirect=1',
      'javascript:alert(1)',
    ];
    for (const value of hostile) {
      expect(sanitizeOverrideApiBaseUrl(value, { production: false })).toBeNull();
    }
  });

  it('allows only the two local dev hosts (case-insensitive, trailing dot tolerated)', () => {
    expect(isTrustedOverrideHost('ABC.TRYCLOUDFLARE.COM', { production: false })).toBe(false);
    expect(isTrustedOverrideHost('abc.trycloudflare.com.', { production: false })).toBe(false);
    expect(isTrustedOverrideHost('localhost', { production: false })).toBe(true);
    expect(isTrustedOverrideHost('LOCALHOST.', { production: false })).toBe(true);
    expect(isTrustedOverrideHost('127.0.0.1', { production: false })).toBe(true);
    expect(isTrustedOverrideHost('localhost', { production: true })).toBe(false);
    expect(isTrustedOverrideHost('trycloudflare.com.evil.example')).toBe(false);
    expect(isTrustedOverrideHost('nottrycloudflare.com')).toBe(false);
    expect(isTrustedOverrideHost('')).toBe(false);
  });

  it('rejects hostile Telegram start parameters as well', () => {
    expect(parseStartParamApiBaseUrl('api=https://evil-attacker.com')).toBeNull();
    expect(parseStartParamApiBaseUrl('api=https://evil-trycloudflare.com')).toBeNull();
    expect(parseStartParamApiBaseUrl('api=https://ok-tunnel.trycloudflare.com')).toBeNull();
    expect(parseStartParamApiBaseUrl('api=https://ok-tunnel.trycloudflare.com', { production: true })).toBeNull();
  });

  it('persists dev overrides into sessionStorage only — never localStorage', () => {
    const session = fakeStorage();
    const local = fakeStorage();
    rememberOverrideApiBaseUrl('http://localhost:4000', session.storage);
    expect(session.calls.sets).toEqual([`${API_BASE_STORAGE_KEY}=http://localhost:4000`]);
    expect(local.calls.sets).toEqual([]);
    expect(local.values.size).toBe(0);

    // Clearing writes the same single area (removal), still never localStorage.
    writeStoredApiBaseUrl(session.storage, '');
    expect(session.calls.removes).toEqual([API_BASE_STORAGE_KEY]);
    expect(local.calls.removes).toEqual([]);
  });
});

describe('canonical runtime-config validation', () => {
  it('accepts only clean https Cloudflare Quick Tunnel hosts', () => {
    expect(sanitizeRuntimeApiBaseUrl('https://fro4a-live.trycloudflare.com')).toBe(
      'https://fro4a-live.trycloudflare.com',
    );
    expect(sanitizeRuntimeApiBaseUrl('https://FRO4A-LIVE.TRYCLOUDFLARE.COM/')).toBe(
      'https://fro4a-live.trycloudflare.com',
    );
    expect(isTrustedRuntimeConfigHost('fro4a-live.trycloudflare.com')).toBe(true);
    expect(isTrustedRuntimeConfigHost('trycloudflare.com')).toBe(false);
  });

  it('rejects non-tunnel domains, plain HTTP, credentials, backslashes and query strings', () => {
    for (const candidate of [
      'http://fro4a-live.trycloudflare.com',
      'https://evil-attacker.com',
      'https://trycloudflare.com.evil.example',
      'https://evil-trycloudflare.com',
      'https://user:pass@fro4a-live.trycloudflare.com',
      'https://fro4a-live.trycloudflare.com/?redirect=1',
      'https://fro4a-live.trycloudflare.com/#fragment',
      'https://fro4a-live.trycloudflare.com\\@evil.example',
      'http://localhost:4000',
      'javascript:alert(1)',
      '',
      null,
    ]) {
      expect(sanitizeRuntimeApiBaseUrl(candidate), String(candidate)).toBeNull();
    }
  });
});

