/**
 * Datamodel voor Never Miss Twice.
 *
 * Alles wordt lokaal opgeslagen. Datums zijn ISO-dagsleutels ("2026-08-04")
 * zodat een dag altijd de lokale dag van de gebruiker is, niet een UTC-dag.
 */

export type DayKey = string; // "YYYY-MM-DD" (lokale dag)
export type WeekKey = string; // "YYYY-Www" (ISO-week, maandag als start)
export type ISOTimestamp = string;
export type ID = string;

/* ---------------------------------------------------------------- profiel */

export type Phase = 'recomp' | 'leanbulk' | 'cut';
export type Sex = 'm' | 'v';
export type ActivityLevel = 'zittend' | 'licht' | 'matig' | 'actief' | 'zeer_actief';
export type ThemeMode = 'system' | 'dark' | 'light';

export interface Profile {
  name: string;
  sex: Sex;
  birthYear: number;
  heightCm: number;
  /** Laatst bekende gewicht in kg — gevoed door weegmomenten, met handmatige fallback. */
  weightKg: number;
  activity: ActivityLevel;
  phase: Phase;
  /** g eiwit per kg lichaamsgewicht. Kennisbasis: 1,6–2,2 (cut: 2,0–2,4). */
  proteinPerKg: number;
  /** Handmatige override van onderhoudscalorieën; leeg = berekend via Mifflin-St Jeor. */
  maintenanceOverride: number | null;
  /** Lesdagen met vroege start. 1 = maandag ... 7 = zondag. */
  teachingDays: number[];
  /** Voorkeurstijdstip training op lesdagen resp. overige dagen. */
  trainingTimeTeachingDay: 'ochtend' | 'avond';
  trainingTimeOtherDay: 'ochtend' | 'avond' | 'flexibel';
  /** Vaste weegdag (1 = ma ... 7 = zo) en dagdeel. */
  weighInDay: number;
  stepGoal: number;
  onboarded: boolean;
}

export interface Settings {
  theme: ThemeMode;
  /** Subtiele haptiek/animatie bij voltooien. */
  celebrate: boolean;
  sound: boolean;
  /** Toont de zachte alcohol-na-training-hint. */
  alcoholRecoveryHint: boolean;
}

/* --------------------------------------------------------------- training */

export type SplitKind = 'ppl6' | 'upperlower5' | 'upperlower4' | 'fullbody3';

export interface TemplateExercise {
  id: ID;
  name: string;
  sets: number;
  /** Weergavetekst voor het repdoel, bijv. "6-8". */
  repRange: string;
  /** Ondergrens van het repdoel, gebruikt voor progressive-overload-logica. */
  repLow: number;
  repHigh: number;
  /** Oefening die als "minimale versie" telt op een slechte dag. */
  isKeystone?: boolean;
  note?: string;
}

export interface WorkoutTemplate {
  id: ID;
  /** Bijv. "Push A", "Upper A", "Full Body A". */
  name: string;
  split: SplitKind;
  /** Volgorde binnen de week van dit schema. */
  order: number;
  exercises: TemplateExercise[];
  /** "1 oefening, 5 minuten" — telt altijd als voltooid. */
  minimalVersion: string;
}

export type SessionStatus = 'gepland' | 'bezig' | 'voltooid' | 'minimaal' | 'gemist';

export interface SetLog {
  id: ID;
  exerciseName: string;
  setIndex: number;
  weightKg: number;
  reps: number;
  done: boolean;
  loggedAt: ISOTimestamp;
}

export interface WorkoutSession {
  id: ID;
  day: DayKey;
  templateId: ID | null;
  templateName: string;
  status: SessionStatus;
  startedAt: ISOTimestamp | null;
  finishedAt: ISOTimestamp | null;
  sets: SetLog[];
  /** Ingevuld wanneer de sessie via de "Even geen dag"-knop is teruggebracht. */
  minimalNote?: string;
  notes?: string;
}

export type CardioKind = 'hardlopen' | 'wandelen' | 'fietsen' | 'zone2' | 'overig';

export interface CardioSession {
  id: ID;
  day: DayKey;
  kind: CardioKind;
  minutes: number;
  /** Optioneel; los van het krachtschema. */
  distanceKm?: number;
  loggedAt: ISOTimestamp;
  note?: string;
}

export interface StepLog {
  day: DayKey;
  steps: number;
}

/* --------------------------------------------------------------- voeding */

/** 80/20: 'basis' = onbewerkt/voedzaam, 'vrij' = vrij te besteden budget. */
export type FoodQuality = 'basis' | 'vrij';

export interface FoodPreset {
  id: ID;
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  quality: FoodQuality;
  /** Standaardportie-omschrijving, bijv. "1 portie (150 g)". */
  portion: string;
  /** Favoriet = bovenaan in de snelkiezer. */
  favorite?: boolean;
  emergency?: boolean;
}

export interface MealEntry {
  id: ID;
  day: DayKey;
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  quality: FoodQuality;
  servings: number;
  presetId?: ID;
  loggedAt: ISOTimestamp;
}

export interface AlcoholPreset {
  id: ID;
  name: string;
  /** Kennisbasis 8.4. */
  volumeMl: number;
  kcal: number;
  /** Nederlandse standaardglazen (~10 g pure alcohol = ~71 kcal). */
  standardGlasses: number;
  abv: number;
}

export interface AlcoholEntry {
  id: ID;
  day: DayKey;
  name: string;
  kcal: number;
  standardGlasses: number;
  count: number;
  presetId?: ID;
  loggedAt: ISOTimestamp;
  /** Waar was de zachte hersteltip van toepassing? Puur informatief, nooit blokkerend. */
  withinHoursOfTraining?: number | null;
}

export type SupplementKey = 'creatine' | 'eiwitpoeder' | 'vitamined' | 'omega3' | 'cafeine';

export interface Supplement {
  key: SupplementKey;
  name: string;
  dose: string;
  /** Hoger = belangrijker; creatine staat bovenaan. */
  priority: number;
  /** Ook op rustdagen relevant? */
  everyDay: boolean;
  enabled: boolean;
  hint?: string;
}

export interface SupplementLog {
  day: DayKey;
  taken: SupplementKey[];
}

/* -------------------------------------------------------------- meal prep */

export type PrepComponent = 'eiwit' | 'koolhydraat' | 'groente' | 'smaakmaker';

export interface PrepItem {
  id: ID;
  name: string;
  component: PrepComponent;
  /** Aantal porties dat je van dit onderdeel klaarmaakt. */
  portions: number;
  /** Noodmaaltijd-tag: moet altijd klaarstaan voor slechte dagen. */
  emergency: boolean;
  done: boolean;
}

export interface MealPrepPlan {
  week: WeekKey;
  items: PrepItem[];
  /** Handmatig toegevoegde extra's op de boodschappenlijst. */
  extras: { id: ID; name: string; checked: boolean }[];
  cookedAt: ISOTimestamp | null;
}

/* ------------------------------------------------------------- lichaam */

export interface WeighIn {
  id: ID;
  day: DayKey;
  weightKg: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  loggedAt: ISOTimestamp;
  note?: string;
}

export interface ProgressPhoto {
  id: ID;
  day: DayKey;
  /** Sleutel in IndexedDB; de afbeelding zelf verlaat het apparaat nooit. */
  blobKey: string;
  weighInId?: ID;
}

/* ------------------------------------------------------------- gewoontes */

export type HabitKey = string;

export interface Habit {
  id: ID;
  /** Identity-based framing: "Ik ben iemand die ..." */
  identity: string;
  /** Korte naam voor lijsten en streaks. */
  name: string;
  /** Habit stacking: het bestaande anker waaraan dit vastzit. */
  anchor: string;
  /** De minimale instapversie (two-minute rule). */
  minimalVersion: string;
  /** Op welke dagen telt deze gewoonte mee? Leeg = elke dag. */
  activeDays: number[];
  icon: string;
  archived: boolean;
  createdAt: ISOTimestamp;
  /** Automatisch gevuld door andere modules (training/eiwit/supplementen/stappen). */
  autoSource?: 'training' | 'eiwit' | 'supplementen' | 'stappen' | null;
}

export type HabitCompletion = 'vol' | 'minimaal';

export interface HabitLog {
  habitId: ID;
  day: DayKey;
  completion: HabitCompletion;
  loggedAt: ISOTimestamp;
}

export interface ImplementationIntention {
  id: ID;
  /** "Als het regent" */
  trigger: string;
  /** "dan doe ik 15 min bodyweight thuis" */
  action: string;
  /** Optioneel gekoppeld aan een gewoonte. */
  habitId?: ID;
  timesUsed: number;
  createdAt: ISOTimestamp;
}

/* ------------------------------------------------------- week & check-in */

export interface WeeklyCheckIn {
  week: WeekKey;
  /** Hoeveel dagen zijn deze week haalbaar (3–6). Bepaalt het schema. */
  availableDays: number;
  /** 1–5. */
  energy: number;
  /** Vrij veld, max één zin. */
  adjust: string;
  completedAt: ISOTimestamp;
}

export interface WeekPlan {
  week: WeekKey;
  split: SplitKind;
  /** Templates gekoppeld aan dagen (1 = ma ... 7 = zo). */
  assignments: { day: number; templateId: ID }[];
}

/* ------------------------------------------------------------ root state */

export interface AppState {
  version: number;
  profile: Profile;
  settings: Settings;
  supplements: Supplement[];
  templates: WorkoutTemplate[];
  sessions: WorkoutSession[];
  cardio: CardioSession[];
  steps: StepLog[];
  foodPresets: FoodPreset[];
  meals: MealEntry[];
  alcohol: AlcoholEntry[];
  supplementLogs: SupplementLog[];
  mealPrep: MealPrepPlan[];
  weighIns: WeighIn[];
  photos: ProgressPhoto[];
  habits: Habit[];
  habitLogs: HabitLog[];
  intentions: ImplementationIntention[];
  checkIns: WeeklyCheckIn[];
  weekPlans: WeekPlan[];
  /** Zachte interventies die de gebruiker al heeft gezien, zodat ze niet blijven terugkomen. */
  dismissedNudges: string[];
}
