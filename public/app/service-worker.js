const CACHE_NAME = "codex-remote-shell-v5";
const SHELL_ASSETS = [
  "/app/",
  "/app/index.html",
  "/app/styles.css",
  "/app/app.js",
  "/app/manifest.webmanifest",
  "/app/icons/icon-192.svg",
  "/app/icons/icon-512.svg",
  "/src/client/codex-remote-app-session.js",
  "/src/client/codex-remote-stores.js",
  "/src/client/codex-remote-client.js",
  "/src/client/app-persistence.js",
  "/src/client/codex-remote-view-models.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/app/") || url.pathname.startsWith("/src/client/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => {
            if (cached) {
              return cached;
            }

            return fetch(event.request);
          })
        )
    );
  }
});
