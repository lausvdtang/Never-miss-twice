export const ROUTES = [
  'vandaag',
  'training',
  'sessie',
  'gewichten',
  'voeding',
  'lichaam',
  'gewoontes',
  'week',
  'instellingen',
];

export const TABS = [
  { route: 'vandaag', label: 'Vandaag', icon: '◎' },
  { route: 'training', label: 'Training', icon: '🏋️' },
  { route: 'voeding', label: 'Voeding', icon: '🍽️' },
  { route: 'gewoontes', label: 'Gewoontes', icon: '🔁' },
  { route: 'week', label: 'Week', icon: '📅' },
];

const history = [];
const listeners = new Set();

/**
 * Hash-routing. Werkt onder elke submap — belangrijk op GitHub Pages, waar de
 * app op /<repo>/ staat en padgebaseerde routes een 404 zouden geven.
 */
export function readHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [route, param] = raw.split('/');
  return {
    route: ROUTES.includes(route) ? route : 'vandaag',
    param: param || null,
  };
}

let current = { route: 'vandaag', param: null };

export function currentRoute() {
  return current;
}

export function go(route, param) {
  history.push({ ...current });
  const hash = param ? `#/${route}/${param}` : `#/${route}`;
  if (window.location.hash === hash) {
    // Zelfde hash geeft geen hashchange-event; zelf verversen.
    current = { route, param: param ?? null };
    emit();
  } else {
    window.location.hash = hash;
  }
  window.scrollTo({ top: 0 });
}

export function back() {
  const previous = history.pop() ?? { route: 'vandaag', param: null };
  const hash = previous.param
    ? `#/${previous.route}/${previous.param}`
    : `#/${previous.route}`;
  if (window.location.hash === hash) {
    current = previous;
    emit();
  } else {
    window.location.hash = hash;
  }
}

export function onNavigate(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

export function initNav() {
  current = readHash();
  window.addEventListener('hashchange', () => {
    current = readHash();
    emit();
  });
}
