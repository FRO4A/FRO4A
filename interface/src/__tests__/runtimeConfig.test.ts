import { describe, expect, it } from 'vitest';
import {
  parseStartParamApiBaseUrl,
  resolveApiAssetUrl,
  sanitizeApiBaseUrl,
  selectApiBaseUrl,
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
