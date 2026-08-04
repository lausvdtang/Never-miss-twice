import { useCallback, useSyncExternalStore } from 'react';
import {
  DEFAULT_FOOD_PRESETS,
  DEFAULT_SUPPLEMENTS,
  buildDefaultHabits,
  buildTemplates,
} from '../data/presets';
import { today } from './date';
import type { AppState, Profile, Settings } from './types';

const STORAGE_KEY = 'nmt.state.v1';
const SCHEMA_VERSION = 1;

/* ------------------------------------------------------------ standaarden */

const DEFAULT_PROFILE: Profile = {
  name: '',
  sex: 'm',
  birthYear: 1990,
  heightCm: 180,
  weightKg: 80,
  activity: 'matig',
  phase: 'recomp',
  proteinPerKg: 1.8, // §8.3: binnen 1,6-2,2 g/kg
  maintenanceOverride: null,
  teachingDays: [1, 3, 5], // ma / wo / vr — lesdagen met vroege start
  trainingTimeTeachingDay: 'ochtend',
  trainingTimeOtherDay: 'flexibel',
  weighInDay: 6, // zaterdagochtend
  stepGoal: 9000, // §8.2: 8.000-10.000 stappen per dag
  onboarded: false,
};

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  celebrate: true,
  sound: false,
  alcoholRecoveryHint: true,
};

export function initialState(): AppState {
  const now = new Date().toISOString();
  return {
    version: SCHEMA_VERSION,
    profile: { ...DEFAULT_PROFILE },
    settings: { ...DEFAULT_SETTINGS },
    supplements: DEFAULT_SUPPLEMENTS.map((s) => ({ ...s })),
    templates: buildTemplates(),
    sessions: [],
    cardio: [],
    steps: [],
    foodPresets: DEFAULT_FOOD_PRESETS.map((f) => ({ ...f })),
    meals: [],
    alcohol: [],
    supplementLogs: [],
    mealPrep: [],
    weighIns: [],
    photos: [],
    habits: buildDefaultHabits(now),
    habitLogs: [],
    intentions: [],
    checkIns: [],
    weekPlans: [],
    dismissedNudges: [],
  };
}

/* --------------------------------------------------------------- opslag */

function load(): AppState {
  if (typeof localStorage === 'undefined') return initialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    // Migratiepad: ontbrekende velden vullen met de standaard, zodat een
    // oudere opslag nooit een leeg scherm oplevert.
    const base = initialState();
    return { ...base, ...parsed, version: SCHEMA_VERSION };
  } catch {
    return initialState();
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();
let writeTimer: number | undefined;

function persist() {
  if (typeof localStorage === 'undefined') return;
  // Debounce: tijdens het loggen van sets vuurt dit anders bij elke tik.
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Opslaan mislukt — de app blijft werken in dit venster.', err);
    }
  }, 120) as unknown as number;
}

function emit() {
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): AppState {
  return state;
}

/**
 * Enige schrijfpad naar de state. Houdt persistentie en re-render bij elkaar.
 *
 * De mutator krijgt een ondiepe kopie en mag daar direct op schrijven
 * (`s.meals = [...]`). Die kopie wordt de nieuwe state, zodat de root altijd een
 * nieuwe referentie is: `useSyncExternalStore` vergelijkt snapshots met
 * `Object.is` en zou een gemuteerd origineel als "ongewijzigd" beschouwen.
 */
export function update(mutator: (draft: AppState) => AppState | void): void {
  const draft: AppState = { ...state };
  const next = mutator(draft);
  state = (next ?? draft) as AppState;
  persist();
  emit();
}

export function replaceState(next: AppState): void {
  state = next;
  persist();
  emit();
}

export function resetAll(): void {
  replaceState(initialState());
}

/* ------------------------------------------------------------- React hook */

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    subscribe,
    getState,
    getState,
  );
}

export function useUpdate() {
  return useCallback(update, []);
}

/* --------------------------------------------------------------- helpers */

let counter = 0;
export function newId(prefix = 'id'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function todayKey(): string {
  return today();
}

/* ------------------------------------------- foto's: IndexedDB, nooit cloud */

const PHOTO_DB = 'nmt-photos';
const PHOTO_STORE = 'photos';

function openPhotoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PHOTO_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePhoto(key: string, blob: Blob): Promise<void> {
  const db = await openPhotoDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    tx.objectStore(PHOTO_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadPhoto(key: string): Promise<Blob | null> {
  const db = await openPhotoDB();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readonly');
    const req = tx.objectStore(PHOTO_STORE).get(key);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

export async function deletePhoto(key: string): Promise<void> {
  const db = await openPhotoDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    tx.objectStore(PHOTO_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
