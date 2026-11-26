/* FRO4A instant-open Service Worker — dependency-free, GitHub Pages safe.
 *
 * Cache-first for immutable JS/CSS bundles, stale-while-revalidate for the
 * mountain backdrops and icons. `/api/*`, `/health`, `runtime-config.json` and
 * `tonconnect-manifest.json` are ALWAYS network-only so live blockchain data,
 * zero-rebuild tunnel switches and TON Connect wallet manifests can never be
 * served from an old cache.
 *
 * Bump CACHE_VERSION on every release: `activate` deletes every older cache, so
 * Telegram mobile clients purge stale bundles on the next launch.
 */
const CACHE_VERSION = 'fro4a-shell-v2';
const PRECACHE_PATHS = [
  './',
  './index.html',
  './favicon.svg',
  './tonconnect-icon.png',
  './collection.png',
  './icon.png',
  './alpine-light.svg',
  './alpine-dark.svg',
];

const scopeUrl = (path) => new URL(path, self.registration.scope).toString();
const NEVER_CACHE =
  /(?:^|\/)(?:api(?:\/|$)|health(?:\/|$)|runtime-config\.json(?:\?|$)|tonconnect-manifest\.json(?:\?|$))/i;
const IMMUTABLE_ASSET = /\.(?:js|mjs|css|woff2?|ttf|otf)$/i;
const STATIC_ASSET = /\.(?:js|mjs|css|svg|png|jpe?g|webp|avif|ico|woff2?|ttf|otf|json|webmanifest)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await Promise.all(
        PRECACHE_PATHS.map((path) => cache.add(scopeUrl(path)).catch(() => undefined)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

function isCacheableRequest(url) {
  if (url.origin !== self.location.origin) return false;
  return !NEVER_CACHE.test(`${url.pathname}${url.search}`);
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
      return response;
    }
    return response;
  } catch {
    const cached =
      (await cache.match(request)) ||
      (await cache.match(scopeUrl('./index.html'))) ||
      (await cache.match(scopeUrl('./')));
    if (cached) return cached;
    return new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } });
  }
}

async function cacheFirst(request, event) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) event.waitUntil(cache.put(request, response.clone()));
    return response;
  } catch {
    return new Response('', { status: 504 });
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response && response.ok) return cache.put(request, response.clone());
      return undefined;
    })
    .catch(() => undefined);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  const response = await refresh.then(() => cache.match(request));
  return response || new Response('', { status: 504 });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (!isCacheableRequest(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (!STATIC_ASSET.test(url.pathname)) return;
  if (IMMUTABLE_ASSET.test(url.pathname)) {
    event.respondWith(cacheFirst(request, event));
    return;
  }
  event.respondWith(staleWhileRevalidate(request, event));
});
