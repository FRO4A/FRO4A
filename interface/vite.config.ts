import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

/**
 * GitHub Pages runs the app from `https://<user>.github.io/<repo>/`, so every
 * generated asset URL must stay relative (`base: './'`).
 *
 * TON Connect wallets require ABSOLUTE `url` / `iconUrl` values in the app
 * manifest. The GitHub Pages workflow exports `VITE_PUBLIC_BASE_URL`; this
 * plugin resolves the manifest against it at build time. Local builds without
 * the env keep the relative values from `public/tonconnect-manifest.json`.
 */
function absoluteTonConnectManifest() {
  return {
    name: 'fro4a-tonconnect-manifest',
    apply: 'build' as const,
    closeBundle(): void {
      const publicBase = (process.env.VITE_PUBLIC_BASE_URL ?? '').trim();
      if (publicBase.length === 0) return;
      try {
        const base = publicBase.endsWith('/') ? publicBase : `${publicBase}/`;
        const manifestPath = fileURLToPath(new URL('./dist/tonconnect-manifest.json', import.meta.url));
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, string>;
        const absolute = (value: string): string =>
          /^https?:\/\//i.test(value) ? value : new URL(value.replace(/^\.\//, ''), base).toString();
        manifest.url = base;
        manifest.iconUrl = absolute(manifest.iconUrl ?? 'icon.png');
        if (typeof manifest.termsOfUseUrl === 'string') manifest.termsOfUseUrl = absolute(manifest.termsOfUseUrl);
        if (typeof manifest.privacyPolicyUrl === 'string') {
          manifest.privacyPolicyUrl = absolute(manifest.privacyPolicyUrl);
        }
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      } catch {
        // A missing/renamed manifest must never fail the production build.
      }
    },
  };
}

// `@ton/core` needs Node's Buffer and crypto primitives in the browser.
// The TON Connect UI and Telegram SDK are bundled as regular ESM dependencies.
export default defineConfig({
  // Relative URLs keep JS, CSS, mountain backdrops and locale-containing
  // chunks working on any GitHub Pages subpath.
  base: './',
  plugins: [
    absoluteTonConnectManifest(),
    react(),
    nodePolyfills({
      // @ton/core needs Buffer; crypto is intentionally not polyfilled (the
      // app uses @noble/curves WebCrypto-free ed25519 + TON cell hashing).
      include: ['buffer', 'stream', 'util', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  server: {
    port: 5173,
    host: true,
    // The public ngrok hostname (and any future tunnel) must be accepted.
    allowedHosts: true,
    // Single-origin deployment: the browser talks to /api and /health on the
    // tunnel hostname and Vite forwards those requests to the local backend.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@tonconnect')) return 'tonconnect';
          if (id.includes('@ton/core') || id.includes('@noble') || id.includes('@ton/crypto')) return 'ton-crypto';
          if (id.includes('react') || id.includes('scheduler')) return 'react';
          if (id.includes('lucide-react')) return 'icons';
          return 'vendor';
        },
      },
    },
  },
  test: {
    environment: 'node',
    // `.test.ts` for pure logic, `.test.tsx` for server-rendered component tests.
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx'],
    reporters: 'default',
  },
});
