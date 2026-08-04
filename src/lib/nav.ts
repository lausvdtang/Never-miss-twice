import { createContext, useContext } from 'react';

export type Route =
  | 'vandaag'
  | 'training'
  | 'sessie'
  | 'voeding'
  | 'lichaam'
  | 'gewoontes'
  | 'week'
  | 'instellingen';

export const TABS: { route: Route; label: string; icon: string }[] = [
  { route: 'vandaag', label: 'Vandaag', icon: '◎' },
  { route: 'training', label: 'Training', icon: '🏋️' },
  { route: 'voeding', label: 'Voeding', icon: '🍽️' },
  { route: 'gewoontes', label: 'Gewoontes', icon: '🔁' },
  { route: 'week', label: 'Week', icon: '📅' },
];

export interface NavState {
  route: Route;
  /** Actieve sessie-id wanneer route === 'sessie'. */
  param: string | null;
  go: (route: Route, param?: string) => void;
  back: () => void;
}

export const NavContext = createContext<NavState>({
  route: 'vandaag',
  param: null,
  go: () => {},
  back: () => {},
});

export function useNav(): NavState {
  return useContext(NavContext);
}
