import { describe, expect, it } from 'vitest';
import { PAGES_MANIFEST_URL, resolveManifestUrlForLocation } from '../config/deployments';

/**
 * TON Connect wallets (Tonkeeper, Telegram Wallet) require an absolute HTTPS
 * manifest and report "Invalid manifest / Unable to load a valid manifest" when
 * a page query string leaks into `manifestUrl`.
 */
describe('TON Connect manifest URL resolution', () => {
  it('pins GitHub Pages to the published absolute manifest', () => {
    expect(
      resolveManifestUrlForLocation(
        'https://fro4a.github.io/FRO4A/?api=https://dead-tunnel.trycloudflare.com',
      ),
    ).toBe('https://fro4a.github.io/FRO4A/tonconnect-manifest.json');
    expect(resolveManifestUrlForLocation('https://fro4a.github.io/FRO4A')).toBe(
      PAGES_MANIFEST_URL,
    );
  });

  it('pins Telegram Web hosts to the published absolute manifest', () => {
    expect(resolveManifestUrlForLocation('https://web.telegram.org/k/#-100123')).toBe(
      PAGES_MANIFEST_URL,
    );
    expect(resolveManifestUrlForLocation('https://telegram.org/')).toBe(PAGES_MANIFEST_URL);
  });

  it('keeps local development same-origin and query-free', () => {
    expect(
      resolveManifestUrlForLocation('http://localhost:5173/?api=http://127.0.0.1:4000'),
    ).toBe('http://localhost:5173/tonconnect-manifest.json');
    expect(resolveManifestUrlForLocation('http://127.0.0.1:5173/index.html#/verify')).toBe(
      'http://127.0.0.1:5173/tonconnect-manifest.json',
    );
  });

  it('resolves a subpath deployment without its document name', () => {
    expect(resolveManifestUrlForLocation('https://example.dev/app/index.html?x=1#/games')).toBe(
      'https://example.dev/app/tonconnect-manifest.json',
    );
    expect(resolveManifestUrlForLocation('https://example.dev/app')).toBe(
      'https://example.dev/app/tonconnect-manifest.json',
    );
  });

  it('falls back to the published manifest for malformed locations', () => {
    expect(resolveManifestUrlForLocation('not a url')).toBe(PAGES_MANIFEST_URL);
    expect(PAGES_MANIFEST_URL).toBe('https://fro4a.github.io/FRO4A/tonconnect-manifest.json');
  });
});
