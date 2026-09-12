import { createScheduler, el, replaceContent } from './dom.js';
import { TABS, currentRoute, go, initNav, onNavigate } from './nav.js';
import { getState, subscribe } from './store.js';
import { isSheetOpen, refreshSheet } from './ui.js';
import { renderBody } from './screens/body.js';
import { renderHabits } from './screens/habits.js';
import { renderNutrition } from './screens/nutrition.js';
import { renderOnboarding, setOnboardingRerender } from './screens/onboarding.js';
import { renderSession } from './screens/session.js';
import { renderSettings } from './screens/settings.js';
import { renderToday, setTodayRerender } from './screens/today.js';
import { renderTraining } from './screens/training.js';
import { renderWeights } from './screens/weights.js';
import { renderWeek } from './screens/week.js';

const root = document.getElementById('root');

function renderRoute() {
  const { route, param } = currentRoute();
  switch (route) {
    case 'training':
      return renderTraining();
    case 'sessie':
      return renderSession(param ?? '');
    case 'gewichten':
      return renderWeights();
    case 'voeding':
      return renderNutrition();
    case 'lichaam':
      return renderBody();
    case 'gewoontes':
      return renderHabits();
    case 'week':
      return renderWeek();
    case 'instellingen':
      return renderSettings();
    default:
      return renderToday();
  }
}

function tabbar(route) {
  return el(
    'nav',
    { class: 'tabbar' },
    el(
      'div',
      { class: 'tabbar-inner' },
      ...TABS.map((t) =>
        el(
          'button',
          {
            class: `tab${route === t.route ? ' on' : ''}`,
            'aria-current': route === t.route ? 'page' : null,
            onclick: () => go(t.route),
          },
          el('span', { class: 'tab-icon', 'aria-hidden': 'true' }, t.icon),
          t.label,
        ),
      ),
    ),
  );
}

function draw() {
  const state = getState();

  // Thema: expliciete keuze wint, anders volgt de app het systeem.
  const html = document.documentElement;
  if (state.settings.theme === 'system') html.removeAttribute('data-theme');
  else html.setAttribute('data-theme', state.settings.theme);

  if (!state.profile.onboarded) {
    replaceContent(root, el('div', { class: 'app' }, renderOnboarding()), {
      keepScroll: false,
    });
    return;
  }

  const { route } = currentRoute();
  replaceContent(
    root,
    el(
      'div',
      { class: 'app' },
      renderRoute(),
      // Tijdens een sessie geen tabbalk: één primaire taak per scherm.
      route === 'sessie' ? null : tabbar(route),
    ),
  );

  // Een open venster leest ook uit de store; die moet dus mee verversen.
  if (isSheetOpen()) refreshSheet();
}

/** Hertekenen mag zichzelf niet onderbreken; zie createScheduler. */
const render = createScheduler(draw);

setOnboardingRerender(render);
setTodayRerender(render);
initNav();
subscribe(render);
onNavigate(render);
render();

/*
 * Offline-first: de service worker cachet de app-shell, zodat loggen ook werkt
 * zonder verbinding. Het pad is relatief, zodat dit ook klopt wanneer de app
 * onder een submap draait (zoals /<repo>/ op GitHub Pages).
 *
 * Alleen registreren op https of localhost — via file:// werkt het niet en dan
 * is een foutmelding in de console alleen maar verwarrend.
 */
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch(() => {
      /* geen service worker beschikbaar; de app werkt sowieso lokaal */
    });
  });
}
