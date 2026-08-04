import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ToastProvider } from './components/ui';
import { NavContext, TABS, type Route } from './lib/nav';
import { useAppState } from './lib/store';
import { Body } from './screens/Body';
import { Habits } from './screens/Habits';
import { Nutrition } from './screens/Nutrition';
import { Onboarding } from './screens/Onboarding';
import { Session } from './screens/Session';
import { Settings } from './screens/Settings';
import { Today } from './screens/Today';
import { Training } from './screens/Training';
import { Week } from './screens/Week';

const ROUTES: Route[] = [
  'vandaag',
  'training',
  'sessie',
  'voeding',
  'lichaam',
  'gewoontes',
  'week',
  'instellingen',
];

function readHash(): { route: Route; param: string | null } {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [route, param] = raw.split('/');
  const match = ROUTES.find((r) => r === route);
  return { route: match ?? 'vandaag', param: param ?? null };
}

export function App() {
  const state = useAppState();
  const [nav, setNav] = useState(readHash);
  const history = useRef<{ route: Route; param: string | null }[]>([]);

  // Hash-routing houdt de terugknop van de browser bruikbaar zonder router.
  useEffect(() => {
    const onHash = () => setNav(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback(
    (route: Route, param?: string) => {
      history.current.push(nav);
      window.location.hash = param ? `/${route}/${param}` : `/${route}`;
      setNav({ route, param: param ?? null });
      window.scrollTo({ top: 0 });
    },
    [nav],
  );

  const back = useCallback(() => {
    const previous = history.current.pop();
    const target = previous ?? { route: 'vandaag' as Route, param: null };
    window.location.hash = target.param
      ? `/${target.route}/${target.param}`
      : `/${target.route}`;
    setNav(target);
  }, []);

  // Thema: expliciete keuze wint, anders volgt de app het systeem.
  useEffect(() => {
    const root = document.documentElement;
    if (state.settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', state.settings.theme);
  }, [state.settings.theme]);

  const navValue = useMemo(
    () => ({ route: nav.route, param: nav.param, go, back }),
    [nav, go, back],
  );

  if (!state.profile.onboarded) {
    return (
      <ToastProvider>
        <NavContext.Provider value={navValue}>
          <div className="app">
            <Onboarding />
          </div>
        </NavContext.Provider>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <NavContext.Provider value={navValue}>
        <div className="app">
          {nav.route === 'vandaag' && <Today />}
          {nav.route === 'training' && <Training />}
          {nav.route === 'sessie' && <Session sessionId={nav.param ?? ''} />}
          {nav.route === 'voeding' && <Nutrition />}
          {nav.route === 'lichaam' && <Body />}
          {nav.route === 'gewoontes' && <Habits />}
          {nav.route === 'week' && <Week />}
          {nav.route === 'instellingen' && <Settings />}

          {/* Tijdens een sessie geen tabbalk: één primaire taak per scherm. */}
          {nav.route !== 'sessie' && (
            <nav className="tabbar">
              <div className="tabbar-inner">
                {TABS.map((t) => (
                  <button
                    key={t.route}
                    className={`tab${nav.route === t.route ? ' on' : ''}`}
                    onClick={() => go(t.route)}
                    aria-current={nav.route === t.route ? 'page' : undefined}
                  >
                    <span className="tab-icon" aria-hidden="true">
                      {t.icon}
                    </span>
                    {t.label}
                  </button>
                ))}
              </div>
            </nav>
          )}
        </div>
      </NavContext.Provider>
    </ToastProvider>
  );
}
