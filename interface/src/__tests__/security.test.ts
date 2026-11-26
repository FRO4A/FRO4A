import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const indexHtml = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const themeBoot = readFileSync(new URL('../../public/theme-boot.js', import.meta.url), 'utf8');

function cspContent(): string {
  const match = indexHtml.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i,
  );
  return match?.[1] ?? '';
}

describe('hardened index.html', () => {
  it('ships a strict Content-Security-Policy meta tag', () => {
    const csp = cspContent();
    expect(csp.length).toBeGreaterThan(0);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-eval');
    // Inline styles are required by Tailwind's runtime + TON Connect UI, but
    // scripts must never be inline.
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain(
      "img-src 'self' data: blob: https://*.trycloudflare.com https://*.tonapi.io",
    );
    expect(csp).toContain("font-src 'self' data:");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'none'");
    for (const origin of [
      "'self'",
      'https://*.trycloudflare.com',
      'https://raw.githubusercontent.com',
      'https://toncenter.com',
      'https://testnet.toncenter.com',
      'https://tonapi.io',
      'https://testnet.tonapi.io',
      'https://bridge.tonapi.io',
      'wss://bridge.tonapi.io',
      'https://connect.tonhubapi.com',
    ]) {
      expect(csp).toContain(origin);
    }
  });

  it('sets a no-referrer policy and an external theme bootstrap', () => {
    expect(indexHtml).toContain('<meta name="referrer" content="no-referrer" />');
    expect(indexHtml).toContain('<script src="./theme-boot.js"></script>');
    expect(indexHtml).not.toMatch(/<script>\s*\(function/);
  });

  it('keeps the pre-paint theme bootstrap session-scoped (zero PII)', () => {
    expect(themeBoot).toContain("sessionStorage.getItem('fro4a_theme')");
    expect(themeBoot).not.toContain('localStorage');
    expect(themeBoot).not.toContain('document.cookie');
  });
});
