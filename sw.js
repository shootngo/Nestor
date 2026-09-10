/* Nestor service worker — cache name must stay unique vs Nickey / Rosa / Stashr */
const CACHE = "nestor-v9";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./assets/splash.jpg",
  "./css/app.css",
  "./js/config.js",
  "./js/util.js",
  "./js/firebase.js",
  "./js/auth.js",
  "./js/store.js",
  "./js/store-sync.js",
  "./js/calendar.js",
  "./js/bills.js",
  "./js/events.js",
  "./js/maintenance.js",
  "./js/vehicles.js",
  "./js/app.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (const url of SHELL) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn("[Nestor SW] skip", url, err);
        }
      }
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isHTML =
    req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html");

  event.respondWith(
    (async () => {
      if (isHTML) {
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok) {
            const cache = await caches.open(CACHE);
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch (err) {
          return (
            (await caches.match(req, { ignoreSearch: true })) ||
            (await caches.match("./index.html")) ||
            Promise.reject(err)
          );
        }
      }

      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (
          fresh &&
          fresh.ok &&
          (req.url.startsWith(self.location.origin) ||
            req.url.includes("gstatic.com/firebasejs") ||
            req.url.includes("cdn.jsdelivr.net"))
        ) {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        throw err;
      }
    })()
  );
});
