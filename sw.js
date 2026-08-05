/**
 * Service worker voor Never Miss Twice.
 *
 * Offline-first: de app-shell wordt gecachet zodat loggen ook werkt zonder
 * verbinding. Omdat alle data lokaal staat, is er niets om te synchroniseren.
 *
 * Er is geen buildstap en dus geen hash in de bestandsnamen. Daarom gebruiken
 * we stale-while-revalidate: je krijgt meteen de gecachete versie te zien en op
 * de achtergrond wordt de nieuwe opgehaald voor de volgende keer. Cache-first
 * zou een update nooit binnenhalen; network-first zou het loggen vertragen bij
 * slecht bereik in de sportschool.
 */

const CACHE = 'nmt-shell-v2';

// Relatief t.o.v. de scope, zodat dit ook klopt onder /<repo>/ op GitHub Pages.
const CORE = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icon.svg',
  './app/main.js',
  './app/dom.js',
  './app/nav.js',
  './app/store.js',
  './app/ui.js',
  './app/date.js',
  './app/presets.js',
  './app/nutrition.js',
  './app/training.js',
  './app/habits.js',
  './app/body.js',
  './app/selectors.js',
  './app/export.js',
  './app/screens/today.js',
  './app/screens/training.js',
  './app/screens/session.js',
  './app/screens/nutrition.js',
  './app/screens/body.js',
  './app/screens/habits.js',
  './app/screens/week.js',
  './app/screens/settings.js',
  './app/screens/onboarding.js',
  './app/screens/sheets.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Losse requests: één ontbrekend bestand mag de hele installatie niet
      // laten mislukken.
      .then((cache) => Promise.all(CORE.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigaties: netwerk eerst, met de cache als vangnet. Zo zie je na een
  // update meteen de nieuwe app-shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached ?? caches.match('./'))),
    );
    return;
  }

  // Overige bestanden: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached ?? network;
    }),
  );
});
