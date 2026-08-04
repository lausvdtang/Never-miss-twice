import { TREND_THRESHOLDS } from '../data/presets';
import { daysBetween, isoWeekday, today as todayKey, weekKey } from './date';
import type { DayKey, Phase, WeighIn } from './types';

export interface WeighInGate {
  allowed: boolean;
  /** Waarom nu (niet)? Uitleg, nooit een verwijt. */
  reason: string;
  /** Aantal dagen tot het volgende geplande weegmoment. */
  daysUntilNext: number;
  isWeighDay: boolean;
  lastWeighIn: WeighIn | null;
}

/**
 * §8.6: maximaal 1× per week wegen, altijd onder dezelfde omstandigheden.
 * Vaker wegen levert ruis op, geen signaal — de app moedigt het actief af.
 */
export function weighInGate(
  weighIns: WeighIn[],
  weighInDay: number,
  today: DayKey = todayKey(),
): WeighInGate {
  const sorted = [...weighIns].sort((a, b) => b.day.localeCompare(a.day));
  const last = sorted[0] ?? null;
  const isWeighDay = isoWeekday(today) === weighInDay;

  const currentWeek = weekKey(today);
  const weighedThisWeek = sorted.some((w) => weekKey(w.day) === currentWeek);

  let daysUntilNext = (weighInDay - isoWeekday(today) + 7) % 7;
  if (daysUntilNext === 0 && weighedThisWeek) daysUntilNext = 7;

  if (weighedThisWeek) {
    return {
      allowed: false,
      reason:
        'Deze week al gewogen. Vaker meten laat vooral vocht en glycogeen zien — dat is ruis, geen voortgang.',
      daysUntilNext,
      isWeighDay,
      lastWeighIn: last,
    };
  }

  if (!isWeighDay) {
    return {
      allowed: true,
      reason:
        'Je vaste weegmoment is nog niet. Zelfde dag en zelfde omstandigheden aanhouden maakt de trend veel bruikbaarder.',
      daysUntilNext,
      isWeighDay,
      lastWeighIn: last,
    };
  }

  return {
    allowed: true,
    reason: 'Ochtend, nuchter, na het toilet, vóór eten en drinken.',
    daysUntilNext: 7,
    isWeighDay,
    lastWeighIn: last,
  };
}

export interface TrendPoint {
  day: DayKey;
  weightKg: number;
  /** Voortschrijdend gemiddelde over de laatste 3-4 metingen (§8.6). */
  average: number;
  bodyFatPct?: number;
}

/**
 * §8.6: toon een voortschrijdend gemiddelde over 3-4 weken in plaats van losse
 * metingen. Dagelijkse schommelingen demotiveren zonder iets te betekenen.
 */
export function trend(weighIns: WeighIn[], window = 4): TrendPoint[] {
  const sorted = [...weighIns].sort((a, b) => a.day.localeCompare(b.day));
  return sorted.map((w, i) => {
    const slice = sorted.slice(Math.max(0, i - window + 1), i + 1);
    const average = slice.reduce((s, x) => s + x.weightKg, 0) / slice.length;
    return {
      day: w.day,
      weightKg: w.weightKg,
      average: Math.round(average * 10) / 10,
      bodyFatPct: w.bodyFatPct,
    };
  });
}

export interface TrendInsight {
  /** Verandering in het gemiddelde per week, in kg. */
  kgPerWeek: number;
  pctPerWeek: number;
  weeksOfData: number;
  /** Coachingtip volgens de drempels uit §8.6, of null als er niets te melden is. */
  tip: string | null;
  direction: 'omlaag' | 'omhoog' | 'stabiel';
}

export function trendInsight(
  weighIns: WeighIn[],
  phase: Phase,
): TrendInsight | null {
  const points = trend(weighIns);
  if (points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const days = Math.max(1, daysBetween(first.day, last.day));
  const weeks = days / 7;

  /*
   * Het tempo komt uit een kleinste-kwadraten-helling over de losse metingen,
   * niet uit het verschil tussen het eerste en het laatste gemiddelde. Dat
   * eerste "gemiddelde" is namelijk nog maar één meting, terwijl het laatste
   * over vier metingen loopt: die vergelijking loopt achter en onderschat het
   * werkelijke tempo. Juist bij snel afvallen moet de drempel van 1% per week
   * (§8.6) betrouwbaar afgaan, dus daar mag geen demping in zitten.
   * Het voortschrijdend gemiddelde blijft wél de weergave in de grafiek.
   */
  const xs = points.map((p) => daysBetween(first.day, p.day));
  const meanX = xs.reduce((s, x) => s + x, 0) / xs.length;
  const meanY = points.reduce((s, p) => s + p.weightKg, 0) / points.length;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < points.length; i++) {
    numerator += (xs[i] - meanX) * (points[i].weightKg - meanY);
    denominator += (xs[i] - meanX) ** 2;
  }
  const kgPerDay = denominator === 0 ? 0 : numerator / denominator;
  const kgPerWeek = kgPerDay * 7;

  // Het gladgestreken gewicht is de beste schatting van "waar je nu zit".
  const reference = last.average > 0 ? last.average : meanY;
  const pctPerWeek = reference > 0 ? (kgPerWeek / reference) * 100 : 0;

  let direction: TrendInsight['direction'] = 'stabiel';
  if (Math.abs(kgPerWeek) >= 0.1) direction = kgPerWeek < 0 ? 'omlaag' : 'omhoog';

  let tip: string | null = null;

  // §8.6: >1% lichaamsgewicht per week eraf → suggereer meer eten.
  if (pctPerWeek < -TREND_THRESHOLDS.fastLossPctPerWeek) {
    tip =
      'Je gaat er sneller dan 1% per week af. Dat gaat ten koste van spiermassa — eet er wat bij en houd het tempo lager.';
  }

  // §8.6: geen verandering in 3-4 weken bij lean bulk → +100-150 kcal.
  const [bumpLow, bumpHigh] = TREND_THRESHOLDS.stallBumpKcal;
  if (
    phase === 'leanbulk' &&
    weeks >= TREND_THRESHOLDS.stallWeeks &&
    Math.abs(kgPerWeek) < 0.05
  ) {
    tip = `Al ${Math.round(weeks)} weken hetzelfde gewicht in een lean bulk. Probeer ${bumpLow}-${bumpHigh} kcal per dag extra.`;
  }

  return {
    kgPerWeek: Math.round(kgPerWeek * 100) / 100,
    pctPerWeek: Math.round(pctPerWeek * 100) / 100,
    weeksOfData: Math.round(weeks * 10) / 10,
    tip,
    direction,
  };
}

/** §8.1: zichtbare buikspieren komen voor ~90% uit een laag vetpercentage. */
export function bodyFatNote(bodyFatPct: number | undefined): string | null {
  if (bodyFatPct === undefined) return null;
  if (bodyFatPct <= 12) {
    return 'Je zit in de zone waar buikspieren zichtbaar worden. Hier gaat het om vasthouden, niet om harder trekken.';
  }
  const toGo = Math.round((bodyFatPct - 12) * 10) / 10;
  return `Nog ongeveer ${String(toGo).replace('.', ',')}% te gaan tot de 10-12%-zone. Dat komt voor ~90% uit voeding, niet uit meer abs-training.`;
}
