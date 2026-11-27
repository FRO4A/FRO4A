/**
 * FRO4A permanent Red-Team regression suite (frontend).
 *
 * Derived from live VECTOR 4 attacks: `?api=` hijacking, poisoned storage,
 * malicious Telegram start parameters, XSS sink / unsafe-href auditing of all
 * components and all 32 locale files, plus the document CSP.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  API_BASE_STORAGE_KEY,
  isTrustedOverrideHost,
  parseStartParamApiBaseUrl,
  sanitizeOverrideApiBaseUrl,
} from '../lib/runtimeConfig';
import { safeExternalUrl } from '../utils/externalUrl';

const SRC_ROOT = fileURLToPath(new URL('../', import.meta.url));
const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const indexHtml = readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');

const HOSTILE_API_BASES: readonly string[] = [
  'https://attacker.com',
  'https://attacker.com/api',
  'https://trycloudflare.com.attacker.com',
  'https://fro4a.github.io.evil.com',
  'https://evil-trycloudflare.com',
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'http://169.254.169.254',
  'http://169.254.169.254/latest/meta-data/',
  'http://metadata.google.internal',
  'file:///C:/FRO4A/server/.env',
  '//attacker.com',
  'https://user:pass@ok-tunnel.trycloudflare.com',
  'https://ok-tunnel.trycloudflare.com/?x=1',
  'https://ok-tunnel.trycloudflare.com/#frag',
  'https://ok-tunnel.trycloudflare.com\\@attacker.com',
];

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry);
    if (statSync(absolute).isDirectory()) {
      files.push(...walk(absolute));
    } else {
      files.push(absolute);
    }
  }
  return files;
}

const sourceFiles = walk(SRC_ROOT).filter(
  (file) =>
    /\.(ts|tsx)$/.test(file) &&
    !file.includes(`${path.sep}__tests__${path.sep}`) &&
    !file.endsWith('.d.ts'),
);

const localeFiles = sourceFiles.filter((file) =>
  file.includes(`${path.sep}i18n${path.sep}locales${path.sep}`),
);

describe('RED TEAM vector 4: ?api= hijacking', () => {
  it('rejects every hostile API base candidate', () => {
    for (const candidate of HOSTILE_API_BASES) {
      expect(sanitizeOverrideApiBaseUrl(candidate), candidate).toBeNull();
      expect(parseStartParamApiBaseUrl(`api=${candidate}`), candidate).toBeNull();
      expect(parseStartParamApiBaseUrl(candidate), candidate).toBeNull();
    }
    expect(isTrustedOverrideHost('trycloudflare.com.attacker.com')).toBe(false);
    expect(isTrustedOverrideHost('169.254.169.254')).toBe(false);
    expect(isTrustedOverrideHost('metadata.google.internal')).toBe(false);
  });

  it('rejects every Cloudflare Quick Tunnel override and honours localhost only in dev mode', () => {
    // Production builds never accept an override: a phishing link could point at
    // the attacker's own free Quick Tunnel.
    expect(sanitizeOverrideApiBaseUrl('https://ok-tunnel.trycloudflare.com', { production: true })).toBeNull();
    expect(sanitizeOverrideApiBaseUrl('https://trycloudflare.com', { production: true })).toBeNull();
    expect(sanitizeOverrideApiBaseUrl('http://localhost:4000', { production: true })).toBeNull();

    // Dev builds accept only the local backend.
    expect(sanitizeOverrideApiBaseUrl('https://ok-tunnel.trycloudflare.com', { production: false })).toBeNull();
    expect(sanitizeOverrideApiBaseUrl('http://localhost:4000', { production: false })).toBe('http://localhost:4000');
    expect(sanitizeOverrideApiBaseUrl('http://127.0.0.1:4000/', { production: false })).toBe('http://127.0.0.1:4000');
    expect(parseStartParamApiBaseUrl('api%3Dhttp%3A%2F%2Flocalhost%3A4000', { production: false })).toBe(
      'http://localhost:4000',
    );
    expect(parseStartParamApiBaseUrl('api%3Dhttps%3A%2F%2Fok-tunnel.trycloudflare.com', { production: false })).toBeNull();
  });

  it('rejects every hostile ?api= / tgWebAppStartParam end-to-end', async () => {
    for (const candidate of HOSTILE_API_BASES) {
      vi.resetModules();
      const values = new Map<string, string>();
      const sessionSets: string[] = [];
      vi.stubGlobal('window', {
        localStorage: {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => values.set(key, value),
          removeItem: (key: string) => values.delete(key),
        },
        sessionStorage: {
          getItem: () => null,
          setItem: (key: string, value: string) => sessionSets.push(`${key}=${value}`),
          removeItem: () => undefined,
        },
        location: { href: `https://fro4a.github.io/FRO4A/?api=${encodeURIComponent(candidate)}` },
        history: { state: null, replaceState: () => undefined },
        setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
        clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
      });
      vi.stubGlobal('fetch', async () => {
        throw new Error('offline');
      });
      const module = await import('../lib/runtimeConfig');
      const resolved = await module.initializeRuntimeConfig();
      expect(resolved, candidate).not.toContain('attacker');
      expect(resolved, candidate).not.toContain('169.254');
      expect(resolved, candidate).not.toContain('javascript');
      expect(module.getApiBaseUrl(), candidate).not.toContain('attacker');
      expect(sessionSets, candidate).toEqual([]);
      vi.unstubAllGlobals();
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });
});

describe('RED TEAM vector 4: poisoned storage / Telegram start_param', () => {
  function stubBrowser(options: {
    href: string;
    local?: Map<string, string>;
    session?: Map<string, string>;
    startParam?: string | null;
  }): { local: Map<string, string>; session: Map<string, string>; removed: string[] } {
    const local = options.local ?? new Map<string, string>();
    const session = options.session ?? new Map<string, string>();
    const removed: string[] = [];
    const storage = (map: Map<string, string>) => ({
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => map.set(key, value),
      removeItem: (key: string) => {
        removed.push(key);
        map.delete(key);
      },
    });
    vi.stubGlobal('window', {
      localStorage: storage(local),
      sessionStorage: storage(session),
      location: { href: options.href },
      history: { state: null, replaceState: () => undefined },
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
      ...(options.startParam === undefined || options.startParam === null
        ? {}
        : { Telegram: { WebApp: { initDataUnsafe: { start_param: options.startParam } } } }),
    });
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    return { local, session, removed };
  }

  it('purges a hijacked localStorage endpoint and falls back safely', async () => {
    vi.resetModules();
    const local = new Map([[API_BASE_STORAGE_KEY, 'https://attacker.com']]);
    const stub = stubBrowser({ href: 'https://fro4a.github.io/FRO4A/', local, startParam: null });
    const module = await import('../lib/runtimeConfig');
    const resolved = await module.initializeRuntimeConfig();
    expect(resolved).not.toContain('attacker');
    expect(stub.local.has(API_BASE_STORAGE_KEY)).toBe(false);
    expect(stub.removed).toContain(API_BASE_STORAGE_KEY);
    expect(stub.session.size).toBe(0);
    vi.unstubAllGlobals();
  });

  it('rejects a poisoned Telegram initDataUnsafe.start_param', async () => {
    vi.resetModules();
    const stub = stubBrowser({
      href: 'https://fro4a.github.io/FRO4A/',
      startParam: 'api=https://attacker.com',
    });
    const module = await import('../lib/runtimeConfig');
    const resolved = await module.initializeRuntimeConfig();
    expect(resolved).not.toContain('attacker');
    expect(stub.session.size).toBe(0);
    vi.unstubAllGlobals();
  });

  it('accepts a legitimate localhost start_param but only in sessionStorage', async () => {
    vi.resetModules();
    const stub = stubBrowser({
      href: 'https://fro4a.github.io/FRO4A/?tgWebAppStartParam=api%3Dhttp%3A%2F%2Flocalhost%3A4000',
      startParam: null,
    });
    const module = await import('../lib/runtimeConfig');
    const resolved = await module.initializeRuntimeConfig();
    expect(resolved).toBe('http://localhost:4000');
    expect(stub.session.get(API_BASE_STORAGE_KEY)).toBe('http://localhost:4000');
    expect(stub.local.has(API_BASE_STORAGE_KEY)).toBe(false);
    vi.unstubAllGlobals();
  });

  it('never accepts a trycloudflare tunnel start_param', async () => {
    vi.resetModules();
    const stub = stubBrowser({
      href: 'https://fro4a.github.io/FRO4A/?tgWebAppStartParam=api%3Dhttps%3A%2F%2Fattacker.trycloudflare.com',
      startParam: null,
    });
    const module = await import('../lib/runtimeConfig');
    const resolved = await module.initializeRuntimeConfig();
    expect(resolved).not.toContain('attacker');
    expect(resolved).not.toContain('trycloudflare');
    expect(stub.session.size).toBe(0);
    vi.unstubAllGlobals();
  });
});

describe('RED TEAM vector 4: XSS sinks, Telegram PII and locale audit', () => {
  it('contains no HTML injection or dynamic-code sinks outside tests', () => {
    const sinks = [
      /\bdangerouslySetInnerHTML\b/,
      /\binnerHTML\b/,
      /\bouterHTML\b/,
      /\binsertAdjacentHTML\b/,
      /\bdocument\.write\b/,
      /\beval\s*\(/,
      /\bnew\s+Function\s*\(/,
      /javascript:/i,
    ];
    for (const file of sourceFiles) {
      const body = readFileSync(file, 'utf8');
      for (const sink of sinks) {
        expect(sink.test(body), `${file} matched ${sink}`).toBe(false);
      }
    }
  });

  it('ships all 32 locale files without markup or script payloads', () => {
    expect(localeFiles.length).toBe(32);
    for (const file of localeFiles) {
      const body = readFileSync(file, 'utf8').toLowerCase();
      for (const dangerous of ['<script', '</script', 'javascript:', 'onerror=', 'onload=', '<iframe']) {
        expect(body.includes(dangerous), `${file} contains ${dangerous}`).toBe(false);
      }
    }
  });

  it('never renders Telegram identity fields', () => {
    // The only files allowed to mention initDataUnsafe at all:
    //  - runtimeConfig: start_param (host-allow-listed API override)
    //  - I18nProvider: user.language_code (locale detection only)
    //  - languages: documentation of that language_code signal only
    const allowedInitData = new Set([
      path.join(SRC_ROOT, 'lib', 'runtimeConfig.ts'),
      path.join(SRC_ROOT, 'i18n', 'I18nProvider.tsx'),
      path.join(SRC_ROOT, 'i18n', 'languages.ts'),
    ]);
    for (const file of sourceFiles) {
      const body = readFileSync(file, 'utf8');
      // Telegram identity fields only — `URL.username` in the URL sanitiser is
      // not a Telegram field, so the username check is scoped to initData.
      const identityPatterns: RegExp[] = [
        /\bfirst_name\b/,
        /\blast_name\b/,
        /\bphoto_url\b/,
        /initDataUnsafe\?*\.user\?*\.username/,
        /initData\?*\.user\?*\.username/,
      ];
      for (const pattern of identityPatterns) {
        expect(pattern.test(body), `${file} matched ${pattern}`).toBe(false);
      }
      if (!allowedInitData.has(file)) {
        expect(body.includes('initDataUnsafe'), `${file} references initDataUnsafe`).toBe(false);
      }
    }
    const runtime = readFileSync(path.join(SRC_ROOT, 'lib', 'runtimeConfig.ts'), 'utf8');
    expect(runtime).toContain('initDataUnsafe?.start_param');
    expect(runtime).toContain('sanitizeOverrideApiBaseUrl');
    const i18n = readFileSync(path.join(SRC_ROOT, 'i18n', 'I18nProvider.tsx'), 'utf8');
    expect(i18n).toContain('language_code');
    // The language tag is never persisted: only an explicit user choice is.
    expect(i18n).not.toMatch(/setItem\([^)]*language_code/);
  });

  it('sanitises every API-provided href value', () => {
    const fallback = 'https://testnet.tonviewer.com/EQtest';
    for (const hostile of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'http://evil.example/steal',
      'https://user:pass@evil.example/',
      '//evil.example',
      '',
    ]) {
      expect(safeExternalUrl(hostile, fallback), hostile).toBe(fallback);
    }
    expect(safeExternalUrl(null, fallback)).toBe(fallback);
    expect(safeExternalUrl(undefined, fallback)).toBe(fallback);
    expect(safeExternalUrl('https://testnet.tonviewer.com/EQabc', fallback)).toBe(
      'https://testnet.tonviewer.com/EQabc',
    );
    // The two components that render an API-provided explorer link must use it.
    expect(readFileSync(path.join(SRC_ROOT, 'components', 'ArchiveTable.tsx'), 'utf8')).toContain(
      'safeExternalUrl(',
    );
    expect(readFileSync(path.join(SRC_ROOT, 'pages', 'VerifierPage.tsx'), 'utf8')).toContain(
      'safeExternalUrl(',
    );
  });

  it('keeps every target=_blank anchor rel="noreferrer noopener"', () => {
    for (const file of sourceFiles.filter((entry) => entry.endsWith('.tsx'))) {
      const body = readFileSync(file, 'utf8');
      const blanks = body.match(/target="_blank"/g)?.length ?? 0;
      const safeRel = body.match(/rel="noreferrer noopener"/g)?.length ?? 0;
      expect(safeRel, file).toBeGreaterThanOrEqual(blanks);
    }
  });
});

describe('RED TEAM vector 4: document Content-Security-Policy', () => {
  function cspText(): string {
    const match = indexHtml.match(
      /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i,
    );
    return match?.[1] ?? '';
  }

  function directives(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const part of cspText().split(';')) {
      const tokens = part.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) continue;
      map.set(tokens[0], tokens.slice(1));
    }
    return map;
  }

  it('locks scripts to same-origin and blocks inline execution', () => {
    const csp = cspText();
    expect(csp.length).toBeGreaterThan(0);
    expect(directives().get('script-src')).toEqual(["'self'"]);
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);

    // Every <script> tag must be external (an inline <script> would be blocked
    // by the CSP, and must never reappear as a "fix").
    const scriptTags = [...indexHtml.matchAll(/<script\b[^>]*>/gi)].map((match) => match[0]);
    expect(scriptTags.length).toBeGreaterThan(0);
    for (const tag of scriptTags) {
      expect(tag, tag).toMatch(/\bsrc=/i);
    }
    expect(indexHtml.includes('<script src="./theme-boot.js"></script>')).toBe(true);
  });

  it('restricts objects, bases, forms and network egress', () => {
    const map = directives();
    expect(map.get('default-src')).toEqual(["'self'"]);
    expect(map.get('object-src')).toEqual(["'none'"]);
    expect(map.get('base-uri')).toEqual(["'self'"]);
    expect(map.get('form-action')).toEqual(["'self'"]);
    expect(map.get('style-src')).toContain("'self'");
    expect(map.get('style-src')).toContain("'unsafe-inline'");
    expect(indexHtml).toContain('<meta name="referrer" content="no-referrer" />');

    const connect = map.get('connect-src') ?? [];
    expect(connect).not.toContain('*');
    // TON Connect wallets advertise their own HTTPS SSE / WSS bridges, so the
    // policy is scheme-scoped. Insecure schemes stay forbidden.
    for (const origin of connect) {
      expect(origin, origin).toMatch(/^'self'$|^https:(?:\/\/.*)?$|^wss:(?:\/\/.*)?$/);
      expect(origin, origin).not.toMatch(/^http:|^ws:/);
      expect(origin).not.toMatch(/attacker|evil|169\.254|metadata\.google/i);
    }
    const images = map.get('img-src') ?? [];
    expect(images).not.toContain('*');
    for (const origin of images) {
      expect(origin, origin).toMatch(/^'self'$|^data:$|^blob:$|^https:(?:\/\/.*)?$/);
      expect(origin, origin).not.toMatch(/^http:/);
      expect(origin, origin).not.toMatch(/attacker|evil|169\.254|metadata\.google/i);
    }
  });
});
