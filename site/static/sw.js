const CACHE_NAME = "book-site-v2";
const CORE_ASSETS = [
  "/",
  "/library/",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/data/site-content.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const isDocument = event.request.mode === "navigate";
  const isStaticAsset =
    url.pathname.startsWith("/_astro/") ||
    url.pathname.startsWith("/data/") ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/manifest.webmanifest";

  if (isDocument) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (isStaticAsset) {
    event.respondWith(cacheFirst(event.request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    return cache.match("/");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}
