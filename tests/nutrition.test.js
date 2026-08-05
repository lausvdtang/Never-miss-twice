import { describe, expect, it } from 'vitest';
import {
  eightyTwenty,
  estimateMaintenance,
  macroTargets,
  proteinPerMeal,
  proteinRange,
  sumAlcohol,
  sumMeals,
} from '../app/nutrition.js';
import { ALCOHOL_PRESETS, KCAL_PER_STANDARD_GLASS } from '../app/presets.js';

const profile = {
  name: 'Test',
  sex: 'm',
  birthYear: 1990,
  heightCm: 182,
  weightKg: 82,
  activity: 'matig',
  phase: 'recomp',
  proteinPerKg: 1.8,
  maintenanceOverride: null,
  teachingDays: [1, 3, 5],
  trainingTimeTeachingDay: 'ochtend',
  trainingTimeOtherDay: 'flexibel',
  weighInDay: 6,
  stepGoal: 9000,
  onboarded: true,
};

function meal(over) {
  return {
    id: 'm',
    day: '2026-08-04',
    name: 'Test',
    kcal: 100,
    proteinG: 10,
    carbsG: 10,
    fatG: 2,
    quality: 'basis',
    servings: 1,
    loggedAt: '',
    ...over,
  };
}

describe('macrodoelen', () => {
  it('respecteert de fase-offsets uit de kennisbasis', () => {
    const maintenance = estimateMaintenance(profile);
    expect(macroTargets(profile).kcal).toBe(maintenance);
    // Lean bulk: +200-300 kcal
    const bulk = macroTargets({ ...profile, phase: 'leanbulk' }).kcal - maintenance;
    expect(bulk).toBeGreaterThanOrEqual(200);
    expect(bulk).toBeLessThanOrEqual(300);
    // Cut: 300-500 kcal tekort
    const cut = maintenance - macroTargets({ ...profile, phase: 'cut' }).kcal;
    expect(cut).toBeGreaterThanOrEqual(300);
    expect(cut).toBeLessThanOrEqual(500);
  });

  it('gebruikt de handmatige onderhoudswaarde als die is ingesteld', () => {
    expect(estimateMaintenance({ ...profile, maintenanceOverride: 2600 })).toBe(2600);
  });

  it('rekent eiwit uit op basis van g/kg', () => {
    expect(macroTargets(profile).proteinG).toBe(Math.round(1.8 * 82));
  });

  it('houdt vet op minimaal 0,8 g/kg', () => {
    const t = macroTargets({ ...profile, maintenanceOverride: 1400, phase: 'cut' });
    expect(t.fatG).toBeGreaterThanOrEqual(Math.round(0.8 * profile.weightKg));
  });

  it('vult koolhydraten met wat er overblijft en gaat nooit negatief', () => {
    const t = macroTargets(profile);
    const kcalFromMacros = t.proteinG * 4 + t.fatG * 9 + t.carbsG * 4;
    expect(Math.abs(kcalFromMacros - t.kcal)).toBeLessThan(10);

    const extreme = macroTargets({
      ...profile,
      maintenanceOverride: 800,
      proteinPerKg: 2.4,
    });
    expect(extreme.carbsG).toBeGreaterThanOrEqual(0);
  });

  it('adviseert meer eiwit in een cut', () => {
    expect(proteinRange('cut')).toEqual([2.0, 2.4]);
    expect(proteinRange('recomp')).toEqual([1.6, 2.2]);
  });

  it('verdeelt eiwit over 3-4 maaltijden van 25-40 g', () => {
    const { meals, perMeal } = proteinPerMeal(148);
    expect(meals).toBeGreaterThanOrEqual(3);
    expect(meals).toBeLessThanOrEqual(4);
    expect(perMeal).toBeGreaterThanOrEqual(25);
    expect(perMeal).toBeLessThanOrEqual(40);
  });
});

describe('optellen', () => {
  it('telt porties mee', () => {
    const totals = sumMeals([meal({ servings: 2 }), meal({ servings: 0.5 })]);
    expect(totals.kcal).toBe(250);
    expect(totals.proteinG).toBe(25);
  });

  it('telt alcohol op met aantal', () => {
    const entry = {
      id: 'a',
      day: '2026-08-04',
      name: 'Pils',
      kcal: 135,
      standardGlasses: 1.3,
      count: 3,
      loggedAt: '',
    };
    const { kcal, glasses } = sumAlcohol([entry]);
    expect(kcal).toBe(405);
    expect(glasses).toBeCloseTo(3.9, 5);
  });
});

describe('80/20-balans', () => {
  it('rekent het aandeel basisproducten uit', () => {
    const balance = eightyTwenty(
      [meal({ kcal: 800, quality: 'basis' }), meal({ kcal: 200, quality: 'vrij' })],
      [],
      1000,
    );
    expect(balance.basePct).toBe(80);
    expect(balance.onTrack).toBe(true);
  });

  it('rekent alcohol mee in het vrije deel', () => {
    const drink = {
      id: 'a',
      day: '2026-08-04',
      name: 'Speciaalbier',
      kcal: 231,
      standardGlasses: 2,
      count: 1,
      loggedAt: '',
    };
    const balance = eightyTwenty([meal({ kcal: 769, quality: 'basis' })], [drink], 1000);
    expect(balance.freeKcal).toBe(231);
    expect(balance.basePct).toBe(77);
    expect(balance.onTrack).toBe(false);
  });

  it('geeft een weekbudget van 20% en meldt hoeveel er over is', () => {
    const balance = eightyTwenty([meal({ kcal: 300, quality: 'vrij' })], [], 10000);
    expect(balance.freeBudget).toBe(2000);
    expect(balance.freeRemaining).toBe(1700);
  });

  it('oordeelt niet bij een lege week', () => {
    const balance = eightyTwenty([], [], 10000);
    expect(balance.onTrack).toBe(true);
    expect(balance.basePct).toBe(100);
  });
});

describe('alcoholpresets uit de kennisbasis', () => {
  it('houdt de pils-waarden binnen de opgegeven range', () => {
    const pils = ALCOHOL_PRESETS.find((p) => p.id === 'alc_pils_flesje');
    expect(pils.volumeMl).toBe(330);
    expect(pils.kcal).toBeGreaterThanOrEqual(130);
    expect(pils.kcal).toBeLessThanOrEqual(140);

    const vaasje = ALCOHOL_PRESETS.find((p) => p.id === 'alc_pils_vaasje');
    expect(vaasje.kcal).toBeGreaterThanOrEqual(100);
    expect(vaasje.kcal).toBeLessThanOrEqual(105);
    expect(vaasje.standardGlasses).toBe(1);
  });

  it('rekent speciaalbier als ongeveer twee standaardglazen', () => {
    const speciaal = ALCOHOL_PRESETS.find((p) => p.id === 'alc_speciaal');
    expect(speciaal.standardGlasses).toBe(2);
    expect(speciaal.kcal).toBeGreaterThan(200);
  });

  it('houdt tripel op ~76 kcal per 100 ml', () => {
    const tripel = ALCOHOL_PRESETS.find((p) => p.id === 'alc_tripel');
    expect(Math.round((tripel.kcal / tripel.volumeMl) * 100)).toBe(76);
  });

  it('kent de standaardglas-waarde', () => {
    expect(KCAL_PER_STANDARD_GLASS).toBe(71);
  });
});
