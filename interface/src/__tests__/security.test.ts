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
    // TON Connect wallet icons are served by dozens of independent wallet CDNs
    // (`wallets-list-v2.json`): only a scheme-level source can cover them all.
    expect(csp).toContain("img-src 'self' data: blob: https:");
    expect(csp).toContain("font-src 'self' data: https:");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    // Every wallet registers its own bridge (HTTPS SSE, some WSS): the policy
    // must be scheme-based or "Connect" hangs on a blocked event stream.
    expect(csp).toContain("connect-src 'self' https: wss:");
    for (const token of ["'self'", 'https:', 'wss:']) {
      expect(csp).toContain(token);
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
