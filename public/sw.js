/**
 * Service worker voor Never Miss Twice.
 *
 * Offline-first: de app-shell wordt gecachet en bij voorkeur uit de cache
 * geserveerd. Loggen mag nooit stukgaan op een wankele verbinding — en omdat
 * alle data lokaal staat, is er ook niets om te synchroniseren.
 */

const CACHE = 'nmt-shell-v1';

// Precache alleen wat gegarandeerd bestaat; de gehashte bundels komen er
// tijdens gebruik vanzelf bij.
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigaties: eerst het netwerk (voor updates), met de cache als vangnet.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() =>
          caches
            .match('./index.html')
            .then((cached) => cached ?? caches.match('./')),
        ),
    );
    return;
  }

  // Overige bestanden: cache-first, want de bundels zijn gehasht en dus stabiel.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    }),
  );
});
