import { describe, expect, it } from 'vitest';
import {
  API_BASE_STORAGE_KEY,
  isTrustedOverrideHost,
  parseStartParamApiBaseUrl,
  rememberOverrideApiBaseUrl,
  resolveApiAssetUrl,
  sanitizeApiBaseUrl,
  sanitizeOverrideApiBaseUrl,
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
  it('accepts `api=` payloads, underscore variants and bare URLs', () => {
    expect(parseStartParamApiBaseUrl('api=https://fro4a-start.trycloudflare.com')).toBe(
      'https://fro4a-start.trycloudflare.com',
    );
    expect(parseStartParamApiBaseUrl('api_https://fro4a-start.trycloudflare.com')).toBe(
      'https://fro4a-start.trycloudflare.com',
    );
    expect(parseStartParamApiBaseUrl('https://fro4a-start.trycloudflare.com')).toBe(
      'https://fro4a-start.trycloudflare.com',
    );
    expect(
      parseStartParamApiBaseUrl('api%3Dhttps%3A%2F%2Ffro4a-start.trycloudflare.com'),
    ).toBe('https://fro4a-start.trycloudflare.com');
  });

  it('rejects empty, insecure and malformed start parameters', () => {
    expect(parseStartParamApiBaseUrl('')).toBeNull();
    expect(parseStartParamApiBaseUrl(null)).toBeNull();
    expect(parseStartParamApiBaseUrl(undefined)).toBeNull();
    expect(parseStartParamApiBaseUrl('ref=promo')).toBeNull();
    expect(parseStartParamApiBaseUrl('api=http://example.com')).toBeNull();
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
  it('accepts only Cloudflare Quick Tunnels and localhost backends', () => {
    expect(sanitizeOverrideApiBaseUrl('https://fro4a-test.trycloudflare.com')).toBe(
      'https://fro4a-test.trycloudflare.com',
    );
    expect(sanitizeOverrideApiBaseUrl('https://trycloudflare.com/')).toBe(
      'https://trycloudflare.com',
    );
    expect(sanitizeOverrideApiBaseUrl('http://localhost:4000')).toBe('http://localhost:4000');
    expect(sanitizeOverrideApiBaseUrl('http://127.0.0.1:4000/')).toBe('http://127.0.0.1:4000');
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
      expect(sanitizeOverrideApiBaseUrl(value)).toBeNull();
    }
  });

  it('matches hosts case-insensitively and tolerates a trailing dot', () => {
    expect(isTrustedOverrideHost('ABC.TRYCLOUDFLARE.COM')).toBe(true);
    expect(isTrustedOverrideHost('abc.trycloudflare.com.')).toBe(true);
    expect(isTrustedOverrideHost('localhost')).toBe(true);
    expect(isTrustedOverrideHost('127.0.0.1')).toBe(true);
    expect(isTrustedOverrideHost('trycloudflare.com.evil.example')).toBe(false);
    expect(isTrustedOverrideHost('nottrycloudflare.com')).toBe(false);
    expect(isTrustedOverrideHost('')).toBe(false);
  });

  it('rejects hostile Telegram start parameters as well', () => {
    expect(parseStartParamApiBaseUrl('api=https://evil-attacker.com')).toBeNull();
    expect(parseStartParamApiBaseUrl('api=https://evil-trycloudflare.com')).toBeNull();
    expect(parseStartParamApiBaseUrl('api=https://ok-tunnel.trycloudflare.com')).toBe(
      'https://ok-tunnel.trycloudflare.com',
    );
  });

  it('persists overrides into sessionStorage only — never localStorage', () => {
    const session = fakeStorage();
    const local = fakeStorage();
    rememberOverrideApiBaseUrl('https://fresh-tunnel.trycloudflare.com', session.storage);
    expect(session.calls.sets).toEqual([
      `${API_BASE_STORAGE_KEY}=https://fresh-tunnel.trycloudflare.com`,
    ]);
    expect(local.calls.sets).toEqual([]);
    expect(local.values.size).toBe(0);

    // Clearing writes the same single area (removal), still never localStorage.
    writeStoredApiBaseUrl(session.storage, '');
    expect(session.calls.removes).toEqual([API_BASE_STORAGE_KEY]);
    expect(local.calls.removes).toEqual([]);
  });
});

