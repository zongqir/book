const VERSION = "book-site-v4";
const APP_CACHE = `${VERSION}:app`;
const PAGE_CACHE = `${VERSION}:pages`;
const DATA_CACHE = `${VERSION}:data`;
const ASSET_CACHE = `${VERSION}:assets`;
const FONT_CACHE = `${VERSION}:fonts`;
const OFFLINE_URL = "/offline/";

const APP_SHELL = [
  "/",
  "/library/",
  "/discover/",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.svg",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/data/site-content.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)));
    if ("navigationPreload" in self.registration) {
      await self.registration.navigationPreload.enable();
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isNavigation = event.request.mode === "navigate";

  if (isNavigation) {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (!isSameOrigin) {
    if (url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com") {
      event.respondWith(staleWhileRevalidate(event.request, FONT_CACHE));
    }
    return;
  }

  if (url.pathname.startsWith("/data/")) {
    event.respondWith(staleWhileRevalidate(event.request, DATA_CACHE));
    return;
  }

  if (
    url.pathname.startsWith("/_astro/") ||
    url.pathname.startsWith("/diagrams/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheFirst(event.request, ASSET_CACHE));
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function handleNavigation(event) {
  const preload = await event.preloadResponse;
  if (preload) {
    const cache = await caches.open(PAGE_CACHE);
    cache.put(event.request, preload.clone());
    return preload;
  }
  return networkFirst(event.request, PAGE_CACHE, OFFLINE_URL);
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }

    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || networkPromise;
}
