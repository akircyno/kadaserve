const CACHE_VERSION = "kadaserve-pwa-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

const STATIC_ASSETS = [
  "/favicon.ico",
  "/favicon-32x32.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
];

const CACHEABLE_PAGES = new Set(["/", "/customer/menu"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("kadaserve-pwa-") && !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  }
});

async function handleNavigation(request, url) {
  const shouldCachePage = CACHEABLE_PAGES.has(url.pathname);

  try {
    const response = await fetch(request);

    if (shouldCachePage && response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(url.pathname, response.clone());
    }

    return response;
  } catch {
    if (shouldCachePage) {
      const cachedPage = await caches.match(url.pathname);

      if (cachedPage) {
        return cachedPage;
      }
    }

    return caches.match("/") ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }

  return response;
}
