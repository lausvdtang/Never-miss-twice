import type { AlcoholEntry, MealEntry, Phase, Profile } from './types';

export interface MacroTargets {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  maintenance: number;
  /** Uitleg van de gekozen fase, in de taal van de app. */
  phaseNote: string;
}

export interface MacroTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const EMPTY_TOTALS: MacroTotals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

const ACTIVITY_FACTORS: Record<Profile['activity'], number> = {
  zittend: 1.2,
  licht: 1.375,
  matig: 1.55,
  actief: 1.725,
  zeer_actief: 1.9,
};

export const ACTIVITY_LABELS: Record<Profile['activity'], string> = {
  zittend: 'Zittend werk, weinig beweging',
  licht: 'Licht actief',
  matig: 'Matig actief',
  actief: 'Actief — veel op de been',
  zeer_actief: 'Zeer actief',
};

export const PHASE_LABELS: Record<Phase, string> = {
  recomp: 'Recomp',
  leanbulk: 'Lean bulk',
  cut: 'Cut',
};

export const PHASE_DESCRIPTIONS: Record<Phase, string> = {
  recomp: 'Onderhoud of ~10% eronder. Spier erbij, vet eraf, rustig aan.',
  leanbulk: '+200-300 kcal boven onderhoud. Ongeveer 0,25-0,5 kg per maand erbij.',
  cut: '300-500 kcal tekort. Maximaal 0,5-1% lichaamsgewicht per week eraf.',
};

/**
 * Onderhoudscalorieën via Mifflin-St Jeor × activiteitsfactor.
 * De kennisbasis geeft de fase-offsets (§8.3), niet de basisformule; deze
 * schatting is altijd handmatig te overschrijven in de instellingen.
 */
export function estimateMaintenance(profile: Profile): number {
  if (profile.maintenanceOverride && profile.maintenanceOverride > 0) {
    return Math.round(profile.maintenanceOverride);
  }
  const age = new Date().getFullYear() - profile.birthYear;
  const bmr =
    10 * profile.weightKg +
    6.25 * profile.heightCm -
    5 * age +
    (profile.sex === 'm' ? 5 : -161);
  return Math.round(bmr * ACTIVITY_FACTORS[profile.activity]);
}

/** §8.3: eiwit 1,6-2,2 g/kg; in een cut richting 2,0-2,4 g/kg. */
export function proteinRange(phase: Phase): [number, number] {
  return phase === 'cut' ? [2.0, 2.4] : [1.6, 2.2];
}

export function macroTargets(profile: Profile): MacroTargets {
  const maintenance = estimateMaintenance(profile);

  let kcal = maintenance;
  let phaseNote = PHASE_DESCRIPTIONS[profile.phase];
  if (profile.phase === 'leanbulk') kcal = maintenance + 250; // §8.3: +200-300
  if (profile.phase === 'cut') kcal = maintenance - 400; // §8.3: 300-500 tekort

  const proteinG = Math.round(profile.proteinPerKg * profile.weightKg);

  // §8.3: vet ~25% van de calorieën, met een ondergrens van 0,6-0,8 g/kg.
  const fatFromPct = (kcal * 0.25) / 9;
  const fatFloor = 0.8 * profile.weightKg;
  const fatG = Math.round(Math.max(fatFromPct, fatFloor));

  // §8.3: koolhydraten vullen de rest van het budget.
  const carbsG = Math.max(
    0,
    Math.round((kcal - proteinG * 4 - fatG * 9) / 4),
  );

  return { kcal, proteinG, fatG, carbsG, maintenance, phaseNote };
}

/** §8.3: verdeel het eiwitdoel over 3-4 maaltijden van 25-40 g. */
export function proteinPerMeal(proteinG: number): { meals: number; perMeal: number } {
  for (const meals of [3, 4]) {
    const perMeal = Math.round(proteinG / meals);
    if (perMeal >= 25 && perMeal <= 40) return { meals, perMeal };
  }
  const meals = proteinG > 160 ? 5 : 4;
  return { meals, perMeal: Math.round(proteinG / meals) };
}

export function sumMeals(meals: MealEntry[]): MacroTotals {
  return meals.reduce<MacroTotals>(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal * m.servings,
      proteinG: acc.proteinG + m.proteinG * m.servings,
      carbsG: acc.carbsG + m.carbsG * m.servings,
      fatG: acc.fatG + m.fatG * m.servings,
    }),
    { ...EMPTY_TOTALS },
  );
}

export function sumAlcohol(entries: AlcoholEntry[]): {
  kcal: number;
  glasses: number;
} {
  return entries.reduce(
    (acc, a) => ({
      kcal: acc.kcal + a.kcal * a.count,
      glasses: acc.glasses + a.standardGlasses * a.count,
    }),
    { kcal: 0, glasses: 0 },
  );
}

/**
 * §8.3, 80/20-regel: 80% van de calorieën uit onbewerkte producten, 20% vrij
 * te besteden (inclusief alcohol en snacks). Geen oordeel per product — dit is
 * een weekbalans, geen dagelijks stoplicht.
 */
export interface EightyTwentyBalance {
  baseKcal: number;
  freeKcal: number;
  totalKcal: number;
  /** Aandeel van de calorieën uit 'basis'-producten, 0-100. */
  basePct: number;
  /** Hoeveel vrije kcal er deze week nog in het budget passen. */
  freeRemaining: number;
  freeBudget: number;
  onTrack: boolean;
}

export function eightyTwenty(
  meals: MealEntry[],
  alcohol: AlcoholEntry[],
  weeklyKcalTarget: number,
): EightyTwentyBalance {
  let baseKcal = 0;
  let freeKcal = 0;
  for (const m of meals) {
    const k = m.kcal * m.servings;
    if (m.quality === 'basis') baseKcal += k;
    else freeKcal += k;
  }
  freeKcal += sumAlcohol(alcohol).kcal;

  const totalKcal = baseKcal + freeKcal;
  const basePct = totalKcal > 0 ? Math.round((baseKcal / totalKcal) * 100) : 100;
  const freeBudget = Math.round(weeklyKcalTarget * 0.2);

  return {
    baseKcal: Math.round(baseKcal),
    freeKcal: Math.round(freeKcal),
    totalKcal: Math.round(totalKcal),
    basePct,
    freeBudget,
    freeRemaining: Math.round(freeBudget - freeKcal),
    onTrack: totalKcal === 0 || basePct >= 80,
  };
}

export function remaining(target: MacroTargets, totals: MacroTotals, alcoholKcal: number) {
  return {
    kcal: Math.round(target.kcal - totals.kcal - alcoholKcal),
    proteinG: Math.round(target.proteinG - totals.proteinG),
    carbsG: Math.round(target.carbsG - totals.carbsG),
    fatG: Math.round(target.fatG - totals.fatG),
  };
}
