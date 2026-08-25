import {
  DEFAULT_FOOD_PRESETS,
  DEFAULT_SUPPLEMENTS,
  buildDefaultHabits,
  buildTemplates,
} from './presets.js';

const STORAGE_KEY = 'nmt.state.v1';
const SCHEMA_VERSION = 1;

/* ------------------------------------------------------------ standaarden */

const DEFAULT_PROFILE = {
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

const DEFAULT_SETTINGS = {
  theme: 'system',
  celebrate: true,
  sound: false,
  alcoholRecoveryHint: true,
};

export function initialState() {
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
    /** Dagen die je zelf als "helemaal gezond gegeten" hebt gemarkeerd. */
    healthyDays: [],
    intentions: [],
    checkIns: [],
    weekPlans: [],
    dismissedNudges: [],
  };
}

/* --------------------------------------------------------------- opslag */

function load() {
  if (typeof localStorage === 'undefined') return initialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw);
    // Migratiepad: ontbrekende velden vullen met de standaard, zodat een
    // oudere opslag nooit een leeg scherm oplevert.
    return { ...initialState(), ...parsed, version: SCHEMA_VERSION };
  } catch {
    return initialState();
  }
}

let state = load();
const listeners = new Set();
let writeTimer;

function persist() {
  if (typeof localStorage === 'undefined') return;
  // Debounce: tijdens het loggen van sets vuurt dit anders bij elke tik.
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Opslaan mislukt — de app blijft werken in dit venster.', err);
    }
  }, 120);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState() {
  return state;
}

/**
 * Enige schrijfpad naar de state.
 *
 * De mutator krijgt een ondiepe kopie en mag daar direct op schrijven
 * (`s.meals = [...]`). Die kopie wordt de nieuwe state, zodat de root altijd
 * een nieuwe referentie is en de schermen weten dat er iets veranderd is.
 */
export function update(mutator) {
  const draft = { ...state };
  const next = mutator(draft);
  state = next ?? draft;
  persist();
  for (const listener of listeners) listener();
}

export function replaceState(next) {
  state = next;
  persist();
  for (const listener of listeners) listener();
}

export function resetAll() {
  replaceState(initialState());
}

/* --------------------------------------------------------------- helpers */

let counter = 0;
export function newId(prefix = 'id') {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function nowISO() {
  return new Date().toISOString();
}

/* ------------------------------------------- foto's: IndexedDB, nooit cloud */

const PHOTO_DB = 'nmt-photos';
const PHOTO_STORE = 'photos';

function openPhotoDB() {
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

export async function savePhoto(key, blob) {
  const db = await openPhotoDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    tx.objectStore(PHOTO_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadPhoto(key) {
  const db = await openPhotoDB();
  const blob = await new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readonly');
    const req = tx.objectStore(PHOTO_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

export async function deletePhoto(key) {
  const db = await openPhotoDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, 'readwrite');
    tx.objectStore(PHOTO_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
