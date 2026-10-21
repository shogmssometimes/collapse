// Bump cache version to force a new cache after major deploys.
// If you need faster invalidation in the future, update this to v3, v4, etc.
const CACHE_NAME = "collapse-fullbuild-v10";

// Derive the base path from the service worker registration so it works from any repo path.
const scopeUrl = new URL(self.registration.scope);
const APP_BASE = scopeUrl.pathname.endsWith("/") ? scopeUrl.pathname : `${scopeUrl.pathname}/`;
const DOC_FALLBACKS = [
  `${APP_BASE}index.html`,
  `${APP_BASE}gm.html`,
  `${APP_BASE}cvttweb/index.html`,
  `${APP_BASE}chud/index.html`,
  `${APP_BASE}csmatrix/index.html`
];
const ICON_ASSETS = [
  `${APP_BASE}icons/icon-180.png`,
  `${APP_BASE}icons/icon-192.png`,
  `${APP_BASE}icons/icon-512.png`,
  `${APP_BASE}icons/favicon-32.png`,
  `${APP_BASE}icons/favicon-16.png`
];
const APP_SHELL = [
  APP_BASE,
  ...DOC_FALLBACKS,
  `${APP_BASE}manifest.webmanifest`,
  ...ICON_ASSETS
];

self.addEventListener("install", (event) => {
  // Activate this service worker immediately on install so new assets are used on next reload
  // Note: skipWaiting should be used carefully; this will take over existing pages.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", (event) => {
  // Ensure this service worker starts controlling uncontrolled clients as soon as it activates
  // so the new cached assets (index + new bundles) serve right away.
  clients.claim();
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Network-first for everything, falling back to cache only when offline.
  // Several files in this app (notably the CHUD iframe's chud-app.js,
  // meter-bridge.js, chud.css) are served under fixed, non-hashed
  // filenames rather than content-hashed ones, so a cache-first strategy
  // would pin a browser to a stale copy of those files indefinitely after
  // the very first install — any later deploy would be invisible until the
  // user manually cleared site data. Preferring the network (with the
  // cache only as an offline fallback) means every reload picks up the
  // latest deployed assets whenever the user has connectivity.
  const url = new URL(event.request.url);
  const isDocument = event.request.destination === "document";
  const docFallback = DOC_FALLBACKS.find((path) => url.pathname === path) ?? DOC_FALLBACKS[0];
  const fallback = isDocument ? docFallback : event.request;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match(fallback)))
  );
});
